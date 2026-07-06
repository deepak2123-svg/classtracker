package com.ledgr.timetable.domain

import java.util.UUID

data class DraftTimeSlot(
    val id: String,
    val startTime: String,
    val endTime: String,
    val type: String,
    val sortOrder: Int,
)

class DraftTimeSlotEditor(
    private val newId: () -> String = { UUID.randomUUID().toString() },
) {
    fun addSlot(
        slots: List<DraftTimeSlot>,
        startTime: String,
        endTime: String,
        type: String,
    ): List<DraftTimeSlot> {
        val nextSlot = DraftTimeSlot(
            id = newId(),
            startTime = startTime.trim(),
            endTime = endTime.trim(),
            type = type,
            sortOrder = slots.size,
        )
        return (slots + nextSlot).reindex()
    }

    fun updateSlot(
        slots: List<DraftTimeSlot>,
        id: String,
        startTime: String,
        endTime: String,
        type: String,
    ): List<DraftTimeSlot> {
        return slots.map { slot ->
            if (slot.id == id) {
                slot.copy(
                    startTime = startTime.trim(),
                    endTime = endTime.trim(),
                    type = type,
                )
            } else {
                slot
            }
        }.reindex()
    }

    fun moveSlot(
        slots: List<DraftTimeSlot>,
        fromIndex: Int,
        toIndex: Int,
    ): List<DraftTimeSlot> {
        if (fromIndex !in slots.indices || toIndex !in slots.indices || fromIndex == toIndex) {
            return slots.reindex()
        }

        val mutableSlots = slots.toMutableList()
        val moved = mutableSlots.removeAt(fromIndex)
        mutableSlots.add(toIndex, moved)
        return mutableSlots.reindex()
    }

    fun deleteSlot(
        slots: List<DraftTimeSlot>,
        id: String,
    ): List<DraftTimeSlot> {
        return slots.filterNot { it.id == id }.reindex()
    }
}

private fun List<DraftTimeSlot>.reindex(): List<DraftTimeSlot> {
    return mapIndexed { index, slot -> slot.copy(sortOrder = index) }
}
