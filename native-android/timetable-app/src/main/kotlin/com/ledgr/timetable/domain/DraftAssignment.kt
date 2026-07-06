package com.ledgr.timetable.domain

import com.ledgr.timetable.data.Assignment

data class DraftAssignment(
    val id: String,
    val slotId: String,
    val sectionId: String,
    val subjectName: String,
    val teacherId: String,
)

fun DraftAssignment.toAssignment(): Assignment {
    return Assignment(
        id = id,
        timetableId = "draft-timetable",
        slotId = slotId,
        sectionId = sectionId,
        subjectName = subjectName,
        teacherId = teacherId,
        createdAt = 0L,
    )
}
