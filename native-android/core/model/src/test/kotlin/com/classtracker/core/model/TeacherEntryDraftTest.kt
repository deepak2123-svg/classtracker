package com.classtracker.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TeacherEntryDraftTest {
    @Test
    fun requiresTopicAndStartTime() {
        val missingTopic = validateTeacherEntryDraft(
            TeacherEntryDraft(
                classId = "class-1",
                dateKey = "2026-06-07",
                timeStart = "09:00",
            ),
        )
        val missingTime = validateTeacherEntryDraft(
            TeacherEntryDraft(
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "Motion",
            ),
        )

        assertEquals(
            "Add the topic before saving.",
            (missingTopic as TeacherEntryValidation.Invalid).message,
        )
        assertEquals(
            "Add a valid start time.",
            (missingTime as TeacherEntryValidation.Invalid).message,
        )
    }

    @Test
    fun rejectsOverlappingClassEntryButAllowsEditingItself() {
        val existing = TeacherEntry(
            id = "entry-1",
            classId = "class-1",
            dateKey = "2026-06-07",
            title = "Existing",
            body = "",
            tag = "note",
            status = "",
            timeStart = "09:00",
            timeEnd = "10:00",
            teacherName = null,
            createdAt = 1L,
        )
        val newOverlap = validateTeacherEntryDraft(
            draft = TeacherEntryDraft(
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "New",
                timeStart = "09:30",
                timeEnd = "10:30",
            ),
            existingEntries = listOf(existing),
        )
        val sameEntryEdit = validateTeacherEntryDraft(
            draft = TeacherEntryDraft(
                entryId = "entry-1",
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "Edited",
                timeStart = "09:00",
                timeEnd = "10:00",
            ),
            existingEntries = listOf(existing),
        )

        assertTrue(newOverlap is TeacherEntryValidation.Invalid)
        assertEquals(TeacherEntryValidation.Valid, sameEntryEdit)
    }
}
