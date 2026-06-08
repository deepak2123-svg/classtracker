package com.classtracker.core.sync

import com.classtracker.core.database.PendingEntryMutation
import com.classtracker.core.database.TeacherLocalDataSource
import com.classtracker.core.firebase.TeacherRemoteDataSource
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherSnapshot
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.firestore.FirebaseFirestoreException
import javax.inject.Inject
import javax.inject.Singleton

enum class TeacherSyncResult {
    Success,
    Retry,
}

@Singleton
class TeacherSyncProcessor @Inject constructor(
    private val local: TeacherLocalDataSource,
    private val remote: TeacherRemoteDataSource,
) {
    suspend fun process(
        uid: String,
        teacher: AuthenticatedTeacher,
    ): TeacherSyncResult {
        local.resetSyncing(uid)
        while (true) {
            val mutation = local.nextMutation(uid) ?: return TeacherSyncResult.Success
            local.markSyncing(mutation)
            try {
                val snapshot = syncMutation(teacher, mutation)
                local.completeMutation(uid, mutation, snapshot)
            } catch (conflict: TeacherRevisionConflictException) {
                val resolution = resolveRevisionConflict(teacher, mutation)
                if (resolution == TeacherSyncResult.Retry) return resolution
                if (resolution == null) return TeacherSyncResult.Success
            } catch (error: Throwable) {
                if (error.isRetryableNetworkFailure()) {
                    local.markPending(mutation, error.syncMessage())
                    return TeacherSyncResult.Retry
                }
                local.markFailed(mutation, error.syncMessage())
                return TeacherSyncResult.Success
            }
        }
    }

    private suspend fun syncMutation(
        teacher: AuthenticatedTeacher,
        mutation: PendingEntryMutation,
    ): TeacherSnapshot = when (mutation.operation) {
        OperationDelete -> remote.deleteEntry(
            teacher = teacher,
            expectedRevision = mutation.expectedRevision,
            entry = requireNotNull(mutation.trashedEntry),
        )
        OperationRestore -> remote.restoreEntry(
            teacher = teacher,
            expectedRevision = mutation.expectedRevision,
            entry = requireNotNull(mutation.trashedEntry),
        )
        else -> remote.saveEntry(
            teacher = teacher,
            expectedRevision = mutation.expectedRevision,
            draft = mutation.draft,
        )
    }

    private suspend fun resolveRevisionConflict(
        teacher: AuthenticatedTeacher,
        mutation: PendingEntryMutation,
    ): TeacherSyncResult? {
        val latest = try {
            remote.loadTeacherSnapshot(teacher)
        } catch (error: Throwable) {
            if (error.isRetryableNetworkFailure()) {
                local.markPending(mutation, error.syncMessage())
                return TeacherSyncResult.Retry
            }
            local.markFailed(mutation, error.syncMessage())
            return null
        }

        val committed = latest.hasCommitted(mutation)
        if (committed) {
            local.completeMutation(teacher.uid, mutation, latest)
            return TeacherSyncResult.Success
        }

        local.replaceSnapshot(teacher.uid, latest)
        local.markFailed(
            mutation,
            "Newer web changes were loaded. Review this entry and retry.",
        )
        return null
    }
}

private const val OperationDelete = "DELETE"
private const val OperationRestore = "RESTORE"

private fun TeacherSnapshot.hasCommitted(mutation: PendingEntryMutation): Boolean =
    when (mutation.operation) {
        OperationDelete -> entries.none { it.id == mutation.resolvedEntryId } &&
            trashedEntries.any { it.id == mutation.resolvedEntryId }
        OperationRestore -> entries.any { entry -> entry.matches(mutation) } &&
            trashedEntries.none { it.id == mutation.resolvedEntryId }
        else -> entries.any { entry -> entry.matches(mutation) }
    }

private fun TeacherEntry.matches(mutation: PendingEntryMutation): Boolean =
    id == mutation.resolvedEntryId &&
        classId == mutation.draft.classId &&
        dateKey == mutation.draft.dateKey &&
        title == mutation.draft.title.trim() &&
        timeStart.orEmpty() == mutation.draft.timeStart.trim()

private fun Throwable.isRetryableNetworkFailure(): Boolean = when (this) {
    is FirebaseNetworkException -> true
    is FirebaseFirestoreException -> code in setOf(
        FirebaseFirestoreException.Code.ABORTED,
        FirebaseFirestoreException.Code.CANCELLED,
        FirebaseFirestoreException.Code.DEADLINE_EXCEEDED,
        FirebaseFirestoreException.Code.INTERNAL,
        FirebaseFirestoreException.Code.RESOURCE_EXHAUSTED,
        FirebaseFirestoreException.Code.UNAVAILABLE,
        FirebaseFirestoreException.Code.UNKNOWN,
    )
    else -> false
}

private fun Throwable.syncMessage(): String =
    localizedMessage?.takeIf(String::isNotBlank) ?: "Entry could not be synced."
