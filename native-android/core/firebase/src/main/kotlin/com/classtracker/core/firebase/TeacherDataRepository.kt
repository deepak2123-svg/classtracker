package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

interface TeacherRemoteDataSource {
    suspend fun loadTeacherSnapshot(teacher: AuthenticatedTeacher): TeacherSnapshot

    suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot

    suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot

    suspend fun deleteClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        teacherClass: TeacherClass,
    ): TeacherSnapshot = throw UnsupportedOperationException("Class deletion is unavailable.")

    suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot

    suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot

    suspend fun deleteAllTrashedEntries(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
    ): TeacherSnapshot = throw UnsupportedOperationException(
        "Permanent recycle-bin deletion is unavailable.",
    )
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
