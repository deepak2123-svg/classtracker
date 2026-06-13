package com.classtracker.core.sync

import com.classtracker.core.database.TeacherLocalDataSource
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherRemoteDataSource
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.firestore.FirebaseFirestoreException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

@Singleton
class OfflineTeacherDataRepository @Inject constructor(
    private val remote: TeacherRemoteDataSource,
    private val local: TeacherLocalDataSource,
    private val scheduler: TeacherSyncScheduler,
) : TeacherDataRepository {
    override fun observeTeacherSnapshot(uid: String): Flow<TeacherSnapshot?> =
        local.observeSnapshot(uid)

    override fun observeSyncSummary(uid: String): Flow<TeacherSyncSummary> =
        local.observeSyncSummary(uid)

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot {
        val result = runCatching { remote.loadTeacherSnapshot(teacher) }
        val snapshot = result.getOrNull()
        if (snapshot != null) {
            local.replaceSnapshot(teacher.uid, snapshot)
            scheduler.enqueue(teacher.uid)
            return snapshot
        }

        val failure = requireNotNull(result.exceptionOrNull())
        if (!failure.allowsOfflineFallback()) throw failure

        val cached = local.readSnapshot(teacher.uid)?.copy(isFromCache = true)
        if (cached != null) {
            local.replaceSnapshot(teacher.uid, cached)
            scheduler.enqueue(teacher.uid)
            return cached
        }
        throw failure
    }

    override suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot {
        val snapshot = local.enqueueEntry(
            uid = teacher.uid,
            expectedRevision = expectedRevision,
            draft = draft,
        )
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot {
        val snapshot = remote.createClass(
            teacher = teacher,
            expectedRevision = expectedRevision,
            draft = draft,
        )
        local.replaceSnapshot(teacher.uid, snapshot)
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun deleteClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        teacherClass: TeacherClass,
    ): TeacherSnapshot {
        val snapshot = remote.deleteClass(
            teacher = teacher,
            expectedRevision = expectedRevision,
            teacherClass = teacherClass,
        )
        local.replaceSnapshot(teacher.uid, snapshot)
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        val snapshot = local.enqueueDelete(
            uid = teacher.uid,
            expectedRevision = expectedRevision,
            entry = entry,
        )
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        val snapshot = local.enqueueRestore(
            uid = teacher.uid,
            expectedRevision = expectedRevision,
            entry = entry,
        )
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun deleteAllTrashedEntries(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
    ): TeacherSnapshot {
        val snapshot = remote.deleteAllTrashedEntries(
            teacher = teacher,
            expectedRevision = expectedRevision,
        )
        local.replaceSnapshot(teacher.uid, snapshot)
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun deleteTrashedEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        val snapshot = remote.deleteTrashedEntry(
            teacher = teacher,
            expectedRevision = expectedRevision,
            entry = entry,
        )
        local.replaceSnapshot(teacher.uid, snapshot)
        scheduler.enqueue(teacher.uid)
        return snapshot
    }

    override suspend fun setTeacherDeparted(
        teacher: AuthenticatedTeacher,
        departed: Boolean,
    ) {
        remote.setTeacherDeparted(teacher, departed)
    }

    override suspend fun retryFailed(uid: String) {
        local.retryFailed(uid)
        scheduler.enqueue(uid)
    }
}

private fun Throwable.allowsOfflineFallback(): Boolean = when (this) {
    is FirebaseNetworkException -> true
    is FirebaseFirestoreException -> code in setOf(
        FirebaseFirestoreException.Code.CANCELLED,
        FirebaseFirestoreException.Code.DEADLINE_EXCEEDED,
        FirebaseFirestoreException.Code.INTERNAL,
        FirebaseFirestoreException.Code.RESOURCE_EXHAUSTED,
        FirebaseFirestoreException.Code.UNAVAILABLE,
        FirebaseFirestoreException.Code.UNKNOWN,
    )
    else -> false
}
