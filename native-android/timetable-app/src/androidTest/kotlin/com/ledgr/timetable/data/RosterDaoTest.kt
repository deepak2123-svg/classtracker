package com.ledgr.timetable.data

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RosterDaoTest {
    private lateinit var database: TimetableDatabase
    private lateinit var dao: TimetableDao

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        database = Room.inMemoryDatabaseBuilder(context, TimetableDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = database.dao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun instituteTeacherAndSectionRosterCrudIsScopedByInstitute() = runBlocking {
        val now = 1_788_100_000_000L
        val alpha = Institute(
            id = "institute-alpha",
            name = "Alpha School",
            createdAt = now,
        )
        val beta = Institute(
            id = "institute-beta",
            name = "Beta College",
            createdAt = now + 1,
        )
        val alphaTeacher = Teacher(
            id = "teacher-alpha",
            instituteId = alpha.id,
            name = "Ms Rao",
            createdAt = now + 2,
        )
        val betaTeacher = Teacher(
            id = "teacher-beta",
            instituteId = beta.id,
            name = "Mr Sen",
            createdAt = now + 3,
        )
        val alphaSection = Section(
            id = "section-alpha",
            instituteId = alpha.id,
            name = "Grade 6-A",
            createdAt = now + 4,
        )
        val betaSection = Section(
            id = "section-beta",
            instituteId = beta.id,
            name = "Grade 7-B",
            createdAt = now + 5,
        )

        dao.insertInstitute(beta)
        dao.insertInstitute(alpha)
        dao.insertTeacher(alphaTeacher)
        dao.insertTeacher(betaTeacher)
        dao.insertSection(alphaSection)
        dao.insertSection(betaSection)

        assertEquals(listOf(alpha, beta), dao.getInstitutes())
        assertEquals(listOf(alphaTeacher), dao.getTeachersForInstitute(alpha.id))
        assertEquals(listOf(alphaSection), dao.getSectionsForInstitute(alpha.id))

        val renamedTeacher = alphaTeacher.copy(name = "Ms Rao Updated")
        val renamedSection = alphaSection.copy(name = "Grade 6-A Updated")

        dao.updateTeacher(renamedTeacher)
        dao.updateSection(renamedSection)

        assertEquals(listOf(renamedTeacher), dao.getTeachersForInstitute(alpha.id))
        assertEquals(listOf(betaTeacher), dao.getTeachersForInstitute(beta.id))
        assertEquals(listOf(renamedSection), dao.getSectionsForInstitute(alpha.id))
        assertEquals(listOf(betaSection), dao.getSectionsForInstitute(beta.id))

        dao.deleteTeacher(alphaTeacher.id)
        dao.deleteSection(alphaSection.id)

        assertEquals(emptyList<Teacher>(), dao.getTeachersForInstitute(alpha.id))
        assertEquals(listOf(betaTeacher), dao.getTeachersForInstitute(beta.id))
        assertEquals(emptyList<Section>(), dao.getSectionsForInstitute(alpha.id))
        assertEquals(listOf(betaSection), dao.getSectionsForInstitute(beta.id))
    }

    @Test
    fun repositoryCreatedSecondInstituteDoesNotShareRosterRowsWithFirstInstitute() = runBlocking {
        val ids = mutableListOf(
            "bucket1-academy",
            "bucket1-second",
            "bucket1-academy-teacher",
            "bucket1-second-teacher",
            "bucket1-academy-section",
            "bucket1-second-section",
        )
        val repository = TimetableRepository(
            dao = dao,
            nowMillis = { 1_788_200_000_000L },
            newId = { ids.removeAt(0) },
        )

        val firstInstitute = repository.createInstitute("Bucket1Academy")
        val secondInstitute = repository.createInstitute("Bucket1Second")

        repository.createTeacher(firstInstitute.id, "Bucket1AcademyTeacher")
        repository.createTeacher(secondInstitute.id, "Bucket1SecondTeacher")
        repository.createSection(firstInstitute.id, "Bucket1AcademySection")
        repository.createSection(secondInstitute.id, "Bucket1SecondSection")

        assertEquals(
            listOf("Bucket1AcademyTeacher"),
            dao.getTeachersForInstitute(firstInstitute.id).map { it.name },
        )
        assertEquals(
            listOf("Bucket1SecondTeacher"),
            dao.getTeachersForInstitute(secondInstitute.id).map { it.name },
        )
        assertEquals(
            listOf("Bucket1AcademySection"),
            dao.getSectionsForInstitute(firstInstitute.id).map { it.name },
        )
        assertEquals(
            listOf("Bucket1SecondSection"),
            dao.getSectionsForInstitute(secondInstitute.id).map { it.name },
        )
    }
}
