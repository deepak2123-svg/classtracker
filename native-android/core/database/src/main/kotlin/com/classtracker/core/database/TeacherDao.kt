package com.classtracker.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TeacherDao {
    @Query("SELECT * FROM teacher_profiles WHERE uid = :uid")
    fun observeProfile(uid: String): Flow<TeacherProfileEntity?>

    @Query("SELECT * FROM teacher_metadata WHERE uid = :uid")
    fun observeMetadata(uid: String): Flow<TeacherMetadataEntity?>

    @Query("SELECT * FROM teacher_classes WHERE uid = :uid ORDER BY createdAt, classId")
    fun observeClasses(uid: String): Flow<List<TeacherClassEntity>>

    @Query("SELECT * FROM teacher_entries WHERE uid = :uid ORDER BY dateKey, createdAt, entryId")
    fun observeEntries(uid: String): Flow<List<TeacherEntryEntity>>

    @Query("SELECT * FROM teacher_trashed_entries WHERE uid = :uid ORDER BY deletedAt DESC, entryId")
    fun observeTrashedEntries(uid: String): Flow<List<TeacherTrashedEntryEntity>>

    @Query("SELECT * FROM entry_mutations WHERE uid = :uid ORDER BY queuedAt, mutationId")
    fun observeMutations(uid: String): Flow<List<EntryMutationEntity>>

    @Query("SELECT * FROM teacher_profiles WHERE uid = :uid")
    suspend fun profile(uid: String): TeacherProfileEntity?

    @Query("SELECT * FROM teacher_metadata WHERE uid = :uid")
    suspend fun metadata(uid: String): TeacherMetadataEntity?

    @Query("SELECT * FROM teacher_classes WHERE uid = :uid ORDER BY createdAt, classId")
    suspend fun classes(uid: String): List<TeacherClassEntity>

    @Query("SELECT * FROM teacher_entries WHERE uid = :uid ORDER BY dateKey, createdAt, entryId")
    suspend fun entries(uid: String): List<TeacherEntryEntity>

    @Query("SELECT * FROM teacher_trashed_entries WHERE uid = :uid ORDER BY deletedAt DESC, entryId")
    suspend fun trashedEntries(uid: String): List<TeacherTrashedEntryEntity>

    @Query("SELECT * FROM entry_mutations WHERE uid = :uid ORDER BY queuedAt, mutationId")
    suspend fun mutations(uid: String): List<EntryMutationEntity>

    @Query(
        """
        SELECT * FROM entry_mutations
        WHERE uid = :uid AND state = 'PENDING'
        ORDER BY queuedAt, mutationId
        LIMIT 1
        """,
    )
    suspend fun nextPendingMutation(uid: String): EntryMutationEntity?

    @Query(
        """
        SELECT * FROM entry_mutations
        WHERE uid = :uid AND resolvedEntryId = :entryId
        ORDER BY queuedAt DESC
        LIMIT 1
        """,
    )
    suspend fun latestMutationForEntry(
        uid: String,
        entryId: String,
    ): EntryMutationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProfile(profile: TeacherProfileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMetadata(metadata: TeacherMetadataEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClasses(classes: List<TeacherClassEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntries(entries: List<TeacherEntryEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrashedEntries(entries: List<TeacherTrashedEntryEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMutation(mutation: EntryMutationEntity)

    @Query("DELETE FROM teacher_classes WHERE uid = :uid")
    suspend fun deleteClasses(uid: String)

    @Query("DELETE FROM teacher_entries WHERE uid = :uid")
    suspend fun deleteEntries(uid: String)

    @Query("DELETE FROM teacher_trashed_entries WHERE uid = :uid")
    suspend fun deleteTrashedEntries(uid: String)

    @Query("DELETE FROM entry_mutations WHERE mutationId = :mutationId")
    suspend fun deleteMutation(mutationId: String)

    @Query(
        """
        UPDATE entry_mutations
        SET state = :state,
            attemptCount = :attemptCount,
            lastError = :lastError,
            updatedAt = :updatedAt
        WHERE mutationId = :mutationId
        """,
    )
    suspend fun updateMutationState(
        mutationId: String,
        state: String,
        attemptCount: Int,
        lastError: String?,
        updatedAt: Long,
    )

    @Query(
        """
        UPDATE entry_mutations
        SET state = 'PENDING', updatedAt = :updatedAt
        WHERE uid = :uid AND state = 'SYNCING'
        """,
    )
    suspend fun resetSyncing(uid: String, updatedAt: Long)

    @Query(
        """
        UPDATE entry_mutations
        SET state = 'PENDING', lastError = NULL, updatedAt = :updatedAt
        WHERE uid = :uid AND state = 'FAILED'
        """,
    )
    suspend fun retryFailed(uid: String, updatedAt: Long)

    @Query(
        """
        UPDATE entry_mutations
        SET expectedRevision = :newRevision, updatedAt = :updatedAt
        WHERE uid = :uid
          AND state = 'PENDING'
          AND expectedRevision = :oldRevision
        """,
    )
    suspend fun rebasePendingMutations(
        uid: String,
        oldRevision: Long,
        newRevision: Long,
        updatedAt: Long,
    )
}
