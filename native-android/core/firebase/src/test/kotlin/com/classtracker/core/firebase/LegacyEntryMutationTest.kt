package com.classtracker.core.firebase

import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherTrashedEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LegacyEntryMutationTest {
    @Test
    fun createsWebCompatibleEntryAtStartOfSelectedDay() {
        val draft = TeacherEntryDraft(
            mutationId = "native-fixed-id",
            classId = "class-1",
            dateKey = "2026-06-07",
            title = "Equation of motion",
            body = "Worked examples",
            status = "started",
            timeStart = "09:00",
            timeEnd = "10:00",
        )
        val entry = buildLegacyEntryMap(
            draft = draft,
            teacherName = "Deepak",
            now = 1234L,
        )
        val updated = upsertLegacyEntry(
            noteDocument = mapOf(
                "2026-06-07" to listOf(mapOf("id" to "older")),
            ),
            dateKey = draft.dateKey,
            entryMap = entry,
        )
        val day = updated["2026-06-07"] as List<*>
        val first = day.first() as Map<*, *>

        assertEquals("native-fixed-id", first["id"])
        assertEquals("Equation of motion", first["title"])
        assertEquals("Deepak", first["teacherName"])
        assertEquals(2, day.size)
    }

    @Test
    fun editingEntryPreservesItsPositionAndCreatedTime() {
        val entry = buildLegacyEntryMap(
            draft = TeacherEntryDraft(
                entryId = "entry-1",
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "Updated topic",
                timeStart = "10:00",
                createdAt = 50L,
            ),
            teacherName = "Teacher",
            now = 100L,
        )
        val updated = upsertLegacyEntry(
            noteDocument = mapOf(
                "2026-06-07" to listOf(
                    mapOf("id" to "entry-1", "title" to "Old"),
                    mapOf("id" to "entry-2", "title" to "Second"),
                ),
            ),
            dateKey = "2026-06-07",
            entryMap = entry,
        )
        val day = updated["2026-06-07"] as List<*>
        val first = day.first() as Map<*, *>

        assertEquals("entry-1", first["id"])
        assertEquals("Updated topic", first["title"])
        assertEquals(50L, first["created"])
        assertEquals(2, day.size)
    }

    @Test
    fun movingEntryToAnotherDateRemovesTheOldCopy() {
        val entry = buildLegacyEntryMap(
            draft = TeacherEntryDraft(
                entryId = "entry-1",
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "Moved topic",
                timeStart = "10:00",
                createdAt = 50L,
            ),
            teacherName = "Teacher",
            now = 100L,
        )
        val updated = upsertLegacyEntry(
            noteDocument = mapOf(
                "2026-06-06" to listOf(
                    mapOf("id" to "entry-1", "title" to "Old"),
                ),
                "2026-06-07" to listOf(
                    mapOf("id" to "entry-2", "title" to "Existing"),
                ),
            ),
            dateKey = "2026-06-07",
            entryMap = entry,
        )
        val targetDay = updated["2026-06-07"] as List<*>

        assertEquals(null, updated["2026-06-06"])
        assertEquals("entry-1", (targetDay.first() as Map<*, *>)["id"])
        assertEquals(2, targetDay.size)
    }

    @Test
    fun removingEntryReturnsUpdatedNotesAndRemovedPayload() {
        val removal = removeLegacyEntry(
            noteDocument = mapOf(
                "2026-06-06" to listOf(mapOf("id" to "entry-1", "title" to "Old")),
                "2026-06-07" to listOf(mapOf("id" to "entry-2", "title" to "Keep")),
            ),
            entryId = "entry-1",
        )

        assertEquals("2026-06-06", removal.dateKey)
        assertEquals("Old", removal.entryMap?.get("title"))
        assertNull(removal.noteDocument["2026-06-06"])
        assertEquals(1, (removal.noteDocument["2026-06-07"] as List<*>).size)
    }

    @Test
    fun trashAndRestoreUseWebCompatibleMainShape() {
        val trashEntry = buildLegacyTrashEntryMap(
            entry = TeacherTrashedEntry(
                id = "entry-1",
                classId = "class-1",
                className = "11th",
                instituteName = "Institute",
                dateKey = "2026-06-07",
                title = "Motion",
                body = "",
                tag = "note",
                status = "completed",
                timeStart = "09:00",
                timeEnd = "10:00",
                teacherName = "Teacher",
                createdAt = 100L,
                deletedAt = 200L,
            ),
            noteEntry = mapOf(
                "id" to "entry-1",
                "title" to "Motion",
                "created" to 100L,
            ),
            classMap = mapOf("section" to "11th", "institute" to "Institute"),
            dateKey = "2026-06-07",
            deletedAt = 200L,
        )
        val main = addLegacyTrashNote(
            main = mapOf("trash" to mapOf("classes" to emptyList<Map<String, Any?>>())),
            trashEntry = trashEntry,
        )
        val notes = ((main["trash"] as Map<*, *>)["notes"] as List<*>)
        val restored = removeLegacyTrashNote(main, "entry-1")

        assertEquals("Institute", (notes.single() as Map<*, *>)["institute"])
        assertEquals(emptyList<Any>(), ((restored?.main?.get("trash") as Map<*, *>)["notes"]))
        assertEquals("Motion", restored.trashEntry["title"])
    }

    @Test
    fun classTrashPreservesClassAndNotesInWebCompatibleShape() {
        val main = mapOf(
            "classes" to listOf(
                mapOf(
                    "id" to "class-1",
                    "section" to "11th",
                    "institute" to "Institute",
                    "subject" to "GS",
                    "created" to 100L,
                ),
                mapOf("id" to "class-2", "section" to "12th"),
            ),
            "trash" to mapOf(
                "classes" to emptyList<Map<String, Any?>>(),
                "notes" to listOf(mapOf("id" to "entry-trash")),
            ),
        )
        val savedNotes = mapOf(
            "2026-06-13" to listOf(mapOf("id" to "entry-1", "title" to "Motion")),
        )

        val updated = requireNotNull(
            trashLegacyClass(
                main = main,
                classId = "class-1",
                savedNotes = savedNotes,
                deletedAt = 500L,
                deletedByName = "Deepak",
            ),
        )
        val activeClasses = updated["classes"] as List<*>
        val trash = updated["trash"] as Map<*, *>
        val trashedClass = (trash["classes"] as List<*>).single() as Map<*, *>

        assertEquals("class-2", (activeClasses.single() as Map<*, *>)["id"])
        assertEquals("class-1", trashedClass["id"])
        assertEquals(500L, trashedClass["deletedAt"])
        assertEquals("Deepak", trashedClass["deletedByName"])
        assertEquals(savedNotes, trashedClass["savedNotes"])
        assertEquals(1, (trash["notes"] as List<*>).size)
    }

    @Test
    fun clearingTrashNotesPreservesTrashedClasses() {
        val trashedClass = mapOf("id" to "class-1", "section" to "11th")
        val main = mapOf(
            "trash" to mapOf(
                "classes" to listOf(trashedClass),
                "notes" to listOf(
                    mapOf("id" to "entry-1"),
                    mapOf("id" to "entry-2"),
                ),
            ),
        )

        val updated = clearLegacyTrashNotes(main)
        val trash = updated["trash"] as Map<*, *>

        assertEquals(emptyList<Any>(), trash["notes"])
        assertEquals(listOf(trashedClass), trash["classes"])
    }
}
