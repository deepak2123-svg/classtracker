package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherSnapshot

interface TeacherDataRepository {
    suspend fun loadTeacherSnapshot(teacher: AuthenticatedTeacher): TeacherSnapshot
}

class TeacherDataMissingException : IllegalStateException(
    "No teacher workspace exists for this account.",
)
