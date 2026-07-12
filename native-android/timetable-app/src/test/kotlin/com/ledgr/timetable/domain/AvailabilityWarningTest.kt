package com.ledgr.timetable.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AvailabilityWarningTest {
    @Test
    fun flagsAssignmentWhenTeacherIsUnavailableForThatSlot() {
        val warnings = findAvailabilityWarnings(
            assignments = listOf(
                draftAssignment(
                    id = "assignment-1",
                    teacherId = "teacher-1",
                    slotId = "slot-1",
                ),
            ),
            unavailability = listOf(
                DraftTeacherUnavailability(
                    id = "unavailable-1",
                    teacherId = "teacher-1",
                    slotId = "slot-1",
                ),
            ),
        )

        assertEquals(1, warnings.size)
        assertEquals("assignment-1", warnings.single().assignmentId)
        assertEquals("teacher-1", warnings.single().teacherId)
        assertEquals("slot-1", warnings.single().slotId)
    }

    @Test
    fun returnsNoWarningsWhenUnavailableTeacherHasNoAssignmentInThatSlot() {
        val warnings = findAvailabilityWarnings(
            assignments = listOf(
                draftAssignment(
                    id = "assignment-1",
                    teacherId = "teacher-1",
                    slotId = "slot-1",
                ),
            ),
            unavailability = listOf(
                DraftTeacherUnavailability(
                    id = "unavailable-1",
                    teacherId = "teacher-1",
                    slotId = "slot-2",
                ),
            ),
        )

        assertTrue(warnings.isEmpty())
    }

    private fun draftAssignment(
        id: String,
        teacherId: String,
        slotId: String,
    ): DraftAssignment {
        return DraftAssignment(
            id = id,
            slotId = slotId,
            sectionId = "section-1",
            subjectName = "Mathematics",
            teacherId = teacherId,
        )
    }
}
