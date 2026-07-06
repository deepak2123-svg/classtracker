package com.ledgr.timetable.domain

import com.ledgr.timetable.data.Assignment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AssignmentConflictDetectorTest {
    @Test
    fun flagsSameTeacherDoubleBookedInTheSameSlot() {
        val conflicts = findConflicts(
            listOf(
                assignment(
                    id = "assignment-1",
                    slotId = "slot-1",
                    sectionId = "section-a",
                    teacherId = "teacher-1",
                ),
                assignment(
                    id = "assignment-2",
                    slotId = "slot-1",
                    sectionId = "section-b",
                    teacherId = "teacher-1",
                ),
            ),
        )

        assertEquals(1, conflicts.size)
        assertEquals(AssignmentConflictType.TeacherDoubleBooked, conflicts.single().type)
        assertEquals("slot-1", conflicts.single().slotId)
        assertEquals("teacher-1", conflicts.single().teacherId)
        assertEquals(listOf("assignment-1", "assignment-2"), conflicts.single().assignmentIds)
    }

    @Test
    fun flagsSameSectionDoubleBookedInTheSameSlot() {
        val conflicts = findConflicts(
            listOf(
                assignment(
                    id = "assignment-1",
                    slotId = "slot-1",
                    sectionId = "section-a",
                    teacherId = "teacher-1",
                ),
                assignment(
                    id = "assignment-2",
                    slotId = "slot-1",
                    sectionId = "section-a",
                    teacherId = "teacher-2",
                ),
            ),
        )

        assertEquals(1, conflicts.size)
        assertEquals(AssignmentConflictType.SectionDoubleBooked, conflicts.single().type)
        assertEquals("slot-1", conflicts.single().slotId)
        assertEquals("section-a", conflicts.single().sectionId)
        assertEquals(listOf("assignment-1", "assignment-2"), conflicts.single().assignmentIds)
    }

    @Test
    fun returnsNoConflictsWhenTeachersAndSectionsAreUniquePerSlot() {
        val conflicts = findConflicts(
            listOf(
                assignment(
                    id = "assignment-1",
                    slotId = "slot-1",
                    sectionId = "section-a",
                    teacherId = "teacher-1",
                ),
                assignment(
                    id = "assignment-2",
                    slotId = "slot-1",
                    sectionId = "section-b",
                    teacherId = "teacher-2",
                ),
                assignment(
                    id = "assignment-3",
                    slotId = "slot-2",
                    sectionId = "section-a",
                    teacherId = "teacher-1",
                ),
            ),
        )

        assertTrue(conflicts.isEmpty())
    }

    private fun assignment(
        id: String,
        slotId: String,
        sectionId: String,
        teacherId: String,
    ): Assignment {
        return Assignment(
            id = id,
            timetableId = "timetable-1",
            slotId = slotId,
            sectionId = sectionId,
            subjectName = "Mathematics",
            teacherId = teacherId,
            createdAt = 1L,
        )
    }
}
