package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

interface TeacherRemoteDataSource {
    suspend fun loadTeacherSnapshot(teacher: AuthenticatedTeacher): TeacherSnapshot

    suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot
}

interface TeacherDataRepository : TeacherRemoteDataSource {
    fun observeTeacherSnapshot(uid: String): Flow<TeacherSnapshot?> = flowOf(null)

    fun observeSyncSummary(uid: String): Flow<TeacherSyncSummary> =
        flowOf(TeacherSyncSummary.Idle)

    suspend fun retryFailed(uid: String) = Unit
}

class TeacherDataMissingException : IllegalStateException(
    "No teacher workspace exists for this account.",
)

class TeacherRevisionConflictException(
    val expectedRevision: Long,
    val actualRevision: Long,
) : IllegalStateException(
    "A newer version of this teacher workspace is available.",
)

class TeacherEntryConflictException(
    message: String,
) : IllegalStateException(message)
