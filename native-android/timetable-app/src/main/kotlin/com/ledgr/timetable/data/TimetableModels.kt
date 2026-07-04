package com.ledgr.timetable.data

const val TIMETABLE_STATUS_DRAFT = "draft"
const val TIMETABLE_STATUS_PUBLISHED = "published"
const val TIMETABLE_STATUS_ARCHIVED = "archived"

const val SLOT_TYPE_CLASS = "class"
const val SLOT_TYPE_BREAK = "break"

val TimetableDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

data class TimetableConflict(
    val sectionName: String,
    val subject: String,
    val teacherName: String,
    val reason: String,
)

data class GeneratedPeriodDraft(
    val day: String,
    val slotId: String,
    val sectionId: String,
    val staffId: String,
    val subject: String,
)

data class TimetableGenerationResult(
    val periods: List<GeneratedPeriodDraft>,
    val conflicts: List<TimetableConflict>,
)
