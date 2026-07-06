package com.ledgr.timetable.domain

import com.ledgr.timetable.data.TIME_SLOT_TYPE_BREAK
import com.ledgr.timetable.data.TIME_SLOT_TYPE_CLASS
import org.junit.Assert.assertEquals
import org.junit.Test

class DraftTimeSlotEditorTest {
    @Test
    fun addsUpdatesReordersAndDeletesDraftTimeSlots() {
        val editor = DraftTimeSlotEditor(newId = sequentialIds())
        val first = editor.addSlot(
            slots = emptyList(),
            startTime = "08:00",
            endTime = "08:45",
            type = TIME_SLOT_TYPE_CLASS,
        )
        val second = editor.addSlot(
            slots = first,
            startTime = "08:45",
            endTime = "09:30",
            type = TIME_SLOT_TYPE_CLASS,
        )
        val third = editor.addSlot(
            slots = second,
            startTime = "09:30",
            endTime = "09:45",
            type = TIME_SLOT_TYPE_BREAK,
        )

        assertEquals(listOf("slot-1", "slot-2", "slot-3"), third.map { it.id })
        assertEquals(listOf(0, 1, 2), third.map { it.sortOrder })

        val updated = editor.updateSlot(
            slots = third,
            id = "slot-2",
            startTime = "08:50",
            endTime = "09:35",
            type = TIME_SLOT_TYPE_CLASS,
        )

        assertEquals("08:50", updated[1].startTime)
        assertEquals("09:35", updated[1].endTime)

        val moved = editor.moveSlot(
            slots = updated,
            fromIndex = 2,
            toIndex = 0,
        )

        assertEquals(listOf("slot-3", "slot-1", "slot-2"), moved.map { it.id })
        assertEquals(listOf(0, 1, 2), moved.map { it.sortOrder })

        val deleted = editor.deleteSlot(
            slots = moved,
            id = "slot-1",
        )

        assertEquals(listOf("slot-3", "slot-2"), deleted.map { it.id })
        assertEquals(listOf(0, 1), deleted.map { it.sortOrder })
    }

    private fun sequentialIds(): () -> String {
        var nextId = 1
        return { "slot-${nextId++}" }
    }
}
