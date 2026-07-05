package com.ledgr.timetable.data

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TimetableDatabaseSmokeTest {
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
    fun insertsEveryTableAndReadsBackForeignKeyRelations() = runBlocking {
        val now = 1_788_000_000_000L

        val institute = Institute(
            id = "institute-1",
            name = "North Campus",
            createdAt = now,
        )
        val teacher = Teacher(
            id = "teacher-1",
            instituteId = institute.id,
            name = "Ms Rao",
            createdAt = now + 1,
        )
        val section = Section(
            id = "section-1",
            instituteId = institute.id,
            name = "Grade 6-A",
            createdAt = now + 2,
        )
        val sourceTimetable = Timetable(
            id = "timetable-source",
            instituteId = institute.id,
            createdAt = now + 3,
            supersededAt = null,
            validUntil = VALID_UNTIL_END_OF_WEEK,
            status = TIMETABLE_STATUS_SUPERSEDED,
            duplicatedFromId = null,
        )
        val timetable = Timetable(
            id = "timetable-1",
            instituteId = institute.id,
            createdAt = now + 4,
            supersededAt = null,
            validUntil = VALID_UNTIL_END_OF_MONTH,
            status = TIMETABLE_STATUS_ACTIVE,
            duplicatedFromId = sourceTimetable.id,
        )
        val slot = TimeSlot(
            id = "slot-1",
            timetableId = timetable.id,
            startTime = "09:00",
            endTime = "09:45",
            type = TIME_SLOT_TYPE_CLASS,
            sortOrder = 0,
            createdAt = now + 5,
        )
        val assignment = Assignment(
            id = "assignment-1",
            timetableId = timetable.id,
            slotId = slot.id,
            sectionId = section.id,
            subjectName = "Mathematics",
            teacherId = teacher.id,
            createdAt = now + 6,
        )
        val unavailability = TeacherUnavailability(
            id = "unavailability-1",
            timetableId = timetable.id,
            teacherId = teacher.id,
            slotId = slot.id,
            createdAt = now + 7,
        )
        val default = SubjectTeacherDefault(
            id = "default-1",
            instituteId = institute.id,
            subjectName = "Mathematics",
            teacherId = teacher.id,
            sectionId = section.id,
            createdAt = now + 8,
        )

        dao.insertInstitute(institute)
        dao.insertTeacher(teacher)
        dao.insertSection(section)
        dao.insertTimetable(sourceTimetable)
        dao.insertTimetable(timetable)
        dao.insertTimeSlot(slot)
        dao.insertAssignment(assignment)
        dao.insertTeacherUnavailability(unavailability)
        dao.insertSubjectTeacherDefault(default)

        assertEquals(institute, dao.getInstitute(institute.id))
        assertEquals(listOf(teacher), dao.getTeachersForInstitute(institute.id))
        assertEquals(listOf(section), dao.getSectionsForInstitute(institute.id))
        assertEquals(timetable, dao.getTimetable(timetable.id))
        assertEquals(listOf(slot), dao.getTimeSlotsForTimetable(timetable.id))
        assertEquals(listOf(assignment), dao.getAssignmentsForTimetable(timetable.id))
        assertEquals(listOf(unavailability), dao.getTeacherUnavailabilityForTimetable(timetable.id))
        assertEquals(listOf(default), dao.getSubjectTeacherDefaultsForInstitute(institute.id))

        dao.deleteInstitute(institute.id)

        assertNull(dao.getInstitute(institute.id))
        assertEquals(emptyList<Teacher>(), dao.getTeachersForInstitute(institute.id))
        assertEquals(emptyList<Section>(), dao.getSectionsForInstitute(institute.id))
        assertNull(dao.getTimetable(timetable.id))
        assertEquals(emptyList<TimeSlot>(), dao.getTimeSlotsForTimetable(timetable.id))
        assertEquals(emptyList<Assignment>(), dao.getAssignmentsForTimetable(timetable.id))
        assertEquals(emptyList<TeacherUnavailability>(), dao.getTeacherUnavailabilityForTimetable(timetable.id))
        assertEquals(emptyList<SubjectTeacherDefault>(), dao.getSubjectTeacherDefaultsForInstitute(institute.id))
    }
}
