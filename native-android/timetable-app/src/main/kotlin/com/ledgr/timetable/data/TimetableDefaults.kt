package com.ledgr.timetable.data

object TimetableDefaults {
    fun defaultSlots(timetableId: String): List<SlotEntity> =
        listOf(
            SlotEntity("slot-0900-$timetableId", timetableId, "9:00-10:00", 9 * 60, 10 * 60, SLOT_TYPE_CLASS, 0),
            SlotEntity("slot-1000-$timetableId", timetableId, "10:00-11:00", 10 * 60, 11 * 60, SLOT_TYPE_CLASS, 1),
            SlotEntity("slot-1115-$timetableId", timetableId, "11:15-12:15", 11 * 60 + 15, 12 * 60 + 15, SLOT_TYPE_CLASS, 2),
            SlotEntity("slot-1215-$timetableId", timetableId, "12:15-1:00", 12 * 60 + 15, 13 * 60, SLOT_TYPE_CLASS, 3),
            SlotEntity("slot-1300-$timetableId", timetableId, "1:00-1:45", 13 * 60, 13 * 60 + 45, SLOT_TYPE_BREAK, 4),
        )
}
