package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot

interface TeacherDataRepository {
    suspend fun loadTeacherSnapshot(teacher: AuthenticatedTeacher): TeacherSnapshot

    suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot
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
