package com.ledgr.timetable.domain

import com.ledgr.timetable.data.Assignment

enum class AssignmentConflictType {
    TeacherDoubleBooked,
    SectionDoubleBooked,
}

data class AssignmentConflict(
    val type: AssignmentConflictType,
    val slotId: String,
    val assignmentIds: List<String>,
    val teacherId: String? = null,
    val sectionId: String? = null,
)

fun findConflicts(assignments: List<Assignment>): List<AssignmentConflict> {
    val teacherConflicts = assignments
        .groupBy { assignment -> assignment.slotId to assignment.teacherId }
        .filterValues { groupedAssignments -> groupedAssignments.size > 1 }
        .map { (slotAndTeacher, groupedAssignments) ->
            AssignmentConflict(
                type = AssignmentConflictType.TeacherDoubleBooked,
                slotId = slotAndTeacher.first,
                teacherId = slotAndTeacher.second,
                assignmentIds = groupedAssignments.map { it.id }.sorted(),
            )
        }

    val sectionConflicts = assignments
        .groupBy { assignment -> assignment.slotId to assignment.sectionId }
        .filterValues { groupedAssignments -> groupedAssignments.size > 1 }
        .map { (slotAndSection, groupedAssignments) ->
            AssignmentConflict(
                type = AssignmentConflictType.SectionDoubleBooked,
                slotId = slotAndSection.first,
                sectionId = slotAndSection.second,
                assignmentIds = groupedAssignments.map { it.id }.sorted(),
            )
        }

    return (teacherConflicts + sectionConflicts).sortedWith(
        compareBy<AssignmentConflict> { it.slotId }
            .thenBy { it.type.name }
            .thenBy { it.teacherId.orEmpty() }
            .thenBy { it.sectionId.orEmpty() },
    )
}
