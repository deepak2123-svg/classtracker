package com.classtracker.core.sync

import com.classtracker.core.database.PendingEntryMutation
import com.classtracker.core.database.TeacherLocalDataSource
import com.classtracker.core.firebase.TeacherRemoteDataSource
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TeacherSyncProcessorTest {
    @Test
    fun successfulUploadCompletesMutationAndStoresReturnedRevision() = runTest {
        val mutation = pendingMutation()
        val local = FakeLocalDataSource(mutation)
        val returned = snapshot(revision = 8)
        val remote = FakeRemoteDataSource(returned)
        val processor = TeacherSyncProcessor(local, remote)

        val result = processor.process(
            uid = "teacher-1",
            teacher = teacher(),
        )

        assertEquals(TeacherSyncResult.Success, result)
        assertEquals(1, remote.saveCount)
        assertEquals(8L, local.completedSnapshot?.revision)
        assertNull(local.pending)
    }

    @Test
    fun permanentUploadFailureLeavesVisibleFailedMutation() = runTest {
        val mutation = pendingMutation()
        val local = FakeLocalDataSource(mutation)
        val remote = FakeRemoteDataSource(
            returnedSnapshot = snapshot(revision = 8),
            saveFailure = IllegalStateException("Permission denied"),
        )
        val processor = TeacherSyncProcessor(local, remote)

        val result = processor.process(
            uid = "teacher-1",
            teacher = teacher(),
        )

        assertEquals(TeacherSyncResult.Success, result)
        assertEquals("Permission denied", local.failedError)
        assertEquals(mutation, local.pending)
    }

    @Test
    fun deleteMutationUsesRemoteDeletePath() = runTest {
        val mutation = pendingDeleteMutation()
        val local = FakeLocalDataSource(mutation)
        val returned = snapshot(revision = 8)
        val remote = FakeRemoteDataSource(returned)
        val processor = TeacherSyncProcessor(local, remote)

        val result = processor.process(
            uid = "teacher-1",
            teacher = teacher(),
        )

        assertEquals(TeacherSyncResult.Success, result)
        assertEquals(1, remote.deleteCount)
        assertEquals(0, remote.saveCount)
        assertEquals(8L, local.completedSnapshot?.revision)
    }

    @Test
    fun restoreMutationUsesRemoteRestorePath() = runTest {
        val mutation = pendingRestoreMutation()
        val local = FakeLocalDataSource(mutation)
        val returned = snapshot(revision = 8)
        val remote = FakeRemoteDataSource(returned)
        val processor = TeacherSyncProcessor(local, remote)

        val result = processor.process(
            uid = "teacher-1",
            teacher = teacher(),
        )

        assertEquals(TeacherSyncResult.Success, result)
        assertEquals(1, remote.restoreCount)
        assertEquals(0, remote.saveCount)
        assertEquals(8L, local.completedSnapshot?.revision)
    }
}

private class FakeRemoteDataSource(
    private val returnedSnapshot: TeacherSnapshot,
    private val saveFailure: Throwable? = null,
) : TeacherRemoteDataSource {
    var saveCount = 0
    var deleteCount = 0
    var restoreCount = 0

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot = returnedSnapshot

    override suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot {
        saveCount += 1
        saveFailure?.let { throw it }
        return returnedSnapshot
    }

    override suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot = returnedSnapshot

    override suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        deleteCount += 1
        return returnedSnapshot
    }

    override suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        restoreCount += 1
        return returnedSnapshot
    }
}

private class FakeLocalDataSource(
    var pending: PendingEntryMutation?,
) : TeacherLocalDataSource {
    var completedSnapshot: TeacherSnapshot? = null
    var failedError: String? = null

    override fun observeSnapshot(uid: String): Flow<TeacherSnapshot?> = flowOf(null)

    override fun observeSyncSummary(uid: String): Flow<TeacherSyncSummary> =
        flowOf(TeacherSyncSummary.Idle)

    override suspend fun readSnapshot(uid: String): TeacherSnapshot? = null

    override suspend fun replaceSnapshot(uid: String, snapshot: TeacherSnapshot) = Unit

    override suspend fun enqueueEntry(
        uid: String,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot = snapshot(expectedRevision)

    override suspend fun enqueueDelete(
        uid: String,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = snapshot(expectedRevision)

    override suspend fun enqueueRestore(
        uid: String,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = snapshot(expectedRevision)

    override suspend fun resetSyncing(uid: String) = Unit

    override suspend fun nextMutation(uid: String): PendingEntryMutation? = pending

    override suspend fun markSyncing(mutation: PendingEntryMutation) = Unit

    override suspend fun markPending(
        mutation: PendingEntryMutation,
        error: String?,
    ) = Unit

    override suspend fun markFailed(
        mutation: PendingEntryMutation,
        error: String,
    ) {
        failedError = error
    }

    override suspend fun completeMutation(
        uid: String,
        mutation: PendingEntryMutation,
        snapshot: TeacherSnapshot,
    ) {
        completedSnapshot = snapshot
        pending = null
    }

    override suspend fun retryFailed(uid: String) = Unit
}

private fun pendingMutation() = PendingEntryMutation(
    mutationId = "native-entry",
    uid = "teacher-1",
    expectedRevision = 7,
    resolvedEntryId = "native-entry",
    draft = TeacherEntryDraft(
        mutationId = "native-entry",
        classId = "class-1",
        dateKey = "2026-06-07",
        title = "Motion",
        timeStart = "09:00",
    ),
    attemptCount = 0,
)

private fun pendingDeleteMutation() = PendingEntryMutation(
    mutationId = "delete-entry",
    uid = "teacher-1",
    operation = "DELETE",
    expectedRevision = 7,
    resolvedEntryId = "entry-1",
    draft = TeacherEntryDraft(
        entryId = "entry-1",
        classId = "class-1",
        dateKey = "2026-06-07",
        title = "Motion",
        timeStart = "09:00",
    ),
    trashedEntry = TeacherTrashedEntry(
        id = "entry-1",
        classId = "class-1",
        className = "11th",
        instituteName = "Institute",
        dateKey = "2026-06-07",
        title = "Motion",
        body = "",
        tag = "note",
        status = "",
        timeStart = "09:00",
        timeEnd = null,
        teacherName = "Teacher",
        createdAt = 1L,
        deletedAt = 2L,
    ),
    attemptCount = 0,
)

private fun pendingRestoreMutation() = pendingDeleteMutation().copy(
    mutationId = "restore-entry",
    operation = "RESTORE",
)

private fun teacher() = AuthenticatedTeacher(
    uid = "teacher-1",
    displayName = "Teacher",
    email = "teacher@example.com",
    photoUrl = null,
)

private fun snapshot(revision: Long) = TeacherSnapshot(
    profile = TeacherProfile(
        uid = "teacher-1",
        name = "Teacher",
        email = "teacher@example.com",
        photoUrl = null,
        subjects = emptyList(),
        institutes = emptyList(),
    ),
    classes = emptyList(),
    entries = emptyList(),
    availableInstitutes = emptyList(),
    configuredInstituteCount = 0,
    revision = revision,
)
