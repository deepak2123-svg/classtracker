package com.ledgr.timetable.data

import kotlinx.coroutines.flow.Flow
import java.util.UUID

class TimetableRepository(
    private val dao: TimetableDao,
    private val nowMillis: () -> Long = { System.currentTimeMillis() },
    private val newId: () -> String = { UUID.randomUUID().toString() },
) {
    fun observeInstitutes(): Flow<List<Institute>> {
        return dao.observeInstitutes()
    }

    fun observeTeachersForInstitute(instituteId: String): Flow<List<Teacher>> {
        return dao.observeTeachersForInstitute(instituteId)
    }

    fun observeSectionsForInstitute(instituteId: String): Flow<List<Section>> {
        return dao.observeSectionsForInstitute(instituteId)
    }

    suspend fun createInstitute(name: String): Institute {
        val institute = Institute(
            id = newId(),
            name = name.trim(),
            createdAt = nowMillis(),
        )
        dao.insertInstitute(institute)
        return institute
    }

    suspend fun createTeacher(instituteId: String, name: String): Teacher {
        val teacher = Teacher(
            id = newId(),
            instituteId = instituteId,
            name = name.trim(),
            createdAt = nowMillis(),
        )
        dao.insertTeacher(teacher)
        return teacher
    }

    suspend fun updateTeacher(teacher: Teacher, name: String) {
        dao.updateTeacher(teacher.copy(name = name.trim()))
    }

    suspend fun deleteTeacher(id: String) {
        dao.deleteTeacher(id)
    }

    suspend fun createSection(instituteId: String, name: String): Section {
        val section = Section(
            id = newId(),
            instituteId = instituteId,
            name = name.trim(),
            createdAt = nowMillis(),
        )
        dao.insertSection(section)
        return section
    }

    suspend fun updateSection(section: Section, name: String) {
        dao.updateSection(section.copy(name = name.trim()))
    }

    suspend fun deleteSection(id: String) {
        dao.deleteSection(id)
    }
}
