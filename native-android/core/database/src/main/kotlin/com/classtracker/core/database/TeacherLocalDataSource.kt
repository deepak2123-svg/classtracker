package com.classtracker.core.database

import androidx.room.withTransaction
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.resolvedEntryId
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

data class PendingEntryMutation(
    val mutationId: String,
    val uid: String,
    val expectedRevision: Long,
    val resolvedEntryId: String,
    val draft: TeacherEntryDraft,
    val attemptCount: Int,
)

interface TeacherLocalDataSource {
    fun observeSnapshot(uid: String): Flow<TeacherSnapshot?>

    fun observeSyncSummary(uid: String): Flow<TeacherSyncSummary>

    suspend fun readSnapshot(uid: String): TeacherSnapshot?

    suspend fun replaceSnapshot(uid: String, snapshot: TeacherSnapshot)

    suspend fun enqueueEntry(
        uid: String,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot

    suspend fun resetSyncing(uid: String)

    suspend fun nextMutation(uid: String): PendingEntryMutation?

    suspend fun markSyncing(mutation: PendingEntryMutation)

    suspend fun markPending(mutation: PendingEntryMutation, error: String?)

    suspend fun markFailed(mutation: PendingEntryMutation, error: String)

    suspend fun completeMutation(
        uid: String,
        mutation: PendingEntryMutation,
        snapshot: TeacherSnapshot,
    )

    suspend fun retryFailed(uid: String)
}

class RoomTeacherLocalDataSource(
    private val database: LedgrDatabase,
) : TeacherLocalDataSource {
    private val dao = database.teacherDao()

    override fun observeSnapshot(uid: String): Flow<TeacherSnapshot?> = combine(
        dao.observeProfile(uid),
        dao.observeMetadata(uid),
        dao.observeClasses(uid),
        dao.observeEntries(uid),
        dao.observeMutations(uid),
    ) { profile, metadata, classes, entries, mutations ->
        buildSnapshot(profile, metadata, classes, entries)
            ?.let { overlayMutations(it, mutations) }
    }

    override fun observeSyncSummary(uid: String): Flow<TeacherSyncSummary> =
        dao.observeMutations(uid).map(::syncSummary)

    override suspend fun readSnapshot(uid: String): TeacherSnapshot? =
        buildSnapshot(
            profile = dao.profile(uid),
            metadata = dao.metadata(uid),
            classes = dao.classes(uid),
            entries = dao.entries(uid),
        )?.let { snapshot ->
            overlayMutations(snapshot, dao.mutations(uid))
        }

    override suspend fun replaceSnapshot(uid: String, snapshot: TeacherSnapshot) {
        database.withTransaction {
            replaceConfirmedSnapshot(uid, snapshot)
        }
    }

    override suspend fun enqueueEntry(
        uid: String,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot = database.withTransaction {
        val now = System.currentTimeMillis()
        val existing = draft.entryId?.let { dao.latestMutationForEntry(uid, it) }
        val replaceable = existing?.takeUnless { it.state == MutationState.Syncing }
        val mutationId = replaceable?.mutationId
            ?: draft.mutationId.takeIf(String::isNotBlank)
            ?: "native_${UUID.randomUUID()}"
        val resolvedEntryId = draft.resolvedEntryId(mutationId)
        val queuedAt = replaceable?.queuedAt ?: now
        val persistedDraft = draft.copy(
            mutationId = mutationId,
            createdAt = draft.createdAt ?: replaceable?.createdAt ?: now,
        )
        dao.upsertMutation(
            persistedDraft.toEntity(
                uid = uid,
                mutationId = mutationId,
                resolvedEntryId = resolvedEntryId,
                expectedRevision = replaceable?.expectedRevision ?: expectedRevision,
                queuedAt = queuedAt,
                now = now,
            ),
        )
        requireNotNull(
            buildSnapshot(
                profile = dao.profile(uid),
                metadata = dao.metadata(uid),
                classes = dao.classes(uid),
                entries = dao.entries(uid),
            ),
        ).let { snapshot ->
            overlayMutations(snapshot, dao.mutations(uid))
        }
    }

    override suspend fun resetSyncing(uid: String) {
        dao.resetSyncing(uid, System.currentTimeMillis())
    }

    override suspend fun nextMutation(uid: String): PendingEntryMutation? =
        dao.nextPendingMutation(uid)?.toPendingMutation()

    override suspend fun markSyncing(mutation: PendingEntryMutation) {
        dao.updateMutationState(
            mutationId = mutation.mutationId,
            state = MutationState.Syncing,
            attemptCount = mutation.attemptCount + 1,
            lastError = null,
            updatedAt = System.currentTimeMillis(),
        )
    }

    override suspend fun markPending(
        mutation: PendingEntryMutation,
        error: String?,
    ) {
        dao.updateMutationState(
            mutationId = mutation.mutationId,
            state = MutationState.Pending,
            attemptCount = mutation.attemptCount + 1,
            lastError = error,
            updatedAt = System.currentTimeMillis(),
        )
    }

    override suspend fun markFailed(
        mutation: PendingEntryMutation,
        error: String,
    ) {
        dao.updateMutationState(
            mutationId = mutation.mutationId,
            state = MutationState.Failed,
            attemptCount = mutation.attemptCount + 1,
            lastError = error,
            updatedAt = System.currentTimeMillis(),
        )
    }

    override suspend fun completeMutation(
        uid: String,
        mutation: PendingEntryMutation,
        snapshot: TeacherSnapshot,
    ) {
        database.withTransaction {
            replaceConfirmedSnapshot(uid, snapshot)
            dao.deleteMutation(mutation.mutationId)
            dao.rebasePendingMutations(
                uid = uid,
                oldRevision = mutation.expectedRevision,
                newRevision = snapshot.revision,
                updatedAt = System.currentTimeMillis(),
            )
        }
    }

    override suspend fun retryFailed(uid: String) {
        dao.retryFailed(uid, System.currentTimeMillis())
    }

    private suspend fun replaceConfirmedSnapshot(
        uid: String,
        snapshot: TeacherSnapshot,
    ) {
        dao.upsertProfile(snapshot.profile.toEntity(uid))
        dao.upsertMetadata(snapshot.toMetadataEntity(uid))
        dao.deleteClasses(uid)
        dao.deleteEntries(uid)
        dao.insertClasses(snapshot.classes.map { it.toEntity(uid) })
        dao.insertEntries(snapshot.entries.map { it.toEntity(uid) })
    }
}
