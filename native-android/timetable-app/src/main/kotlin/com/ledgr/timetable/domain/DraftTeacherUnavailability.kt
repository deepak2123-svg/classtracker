package com.ledgr.timetable.domain

data class DraftTeacherUnavailability(
    val id: String,
    val teacherId: String,
    val slotId: String,
)

data class AvailabilityWarning(
    val assignmentId: String,
    val teacherId: String,
    val slotId: String,
    val sectionId: String,
    val subjectName: String,
)

fun findAvailabilityWarnings(
    assignments: List<DraftAssignment>,
    unavailability: List<DraftTeacherUnavailability>,
): List<AvailabilityWarning> {
    val unavailableTeacherSlots = unavailability
        .map { mark -> mark.teacherId to mark.slotId }
        .toSet()

    return assignments
        .filter { assignment -> assignment.teacherId to assignment.slotId in unavailableTeacherSlots }
        .map { assignment ->
            AvailabilityWarning(
                assignmentId = assignment.id,
                teacherId = assignment.teacherId,
                slotId = assignment.slotId,
                sectionId = assignment.sectionId,
                subjectName = assignment.subjectName,
            )
        }
        .sortedWith(
            compareBy<AvailabilityWarning> { it.slotId }
                .thenBy { it.teacherId }
                .thenBy { it.sectionId }
                .thenBy { it.subjectName },
        )
}
