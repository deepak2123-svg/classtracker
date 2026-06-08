package com.classtracker.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class TeacherEntryFiltersTest {
    @Test
    fun blankFiltersReturnEveryEntry() {
        val entries = listOf(entry("one"), entry("two", status = "completed"))

        assertEquals(entries, filterTeacherEntries(entries, query = "", status = ""))
    }

    @Test
    fun queryMatchesTopicNotesDateTimeAndTeacher() {
        val entries = listOf(
            entry(
                id = "motion",
                title = "Equation of motion",
                body = "Newton practice",
                dateKey = "2026-06-08",
                timeStart = "09:00",
                teacherName = "Deepak",
            ),
            entry(
                id = "light",
                title = "Reflection",
                body = "Ray diagrams",
                dateKey = "2026-06-07",
                timeStart = "10:00",
                teacherName = "Teacher",
            ),
        )

        assertEquals(
            listOf("motion"),
            filterTeacherEntries(entries, query = "motion deepak", status = "")
                .map(TeacherEntry::id),
        )
        assertEquals(
            listOf("motion"),
            filterTeacherEntries(entries, query = "2026-06-08 09:00", status = "")
                .map(TeacherEntry::id),
        )
    }

    @Test
    fun statusFilterUsesStoredStatusValue() {
        val entries = listOf(
            entry("started", status = "started"),
            entry("completed", status = "completed"),
            entry("doubts", status = "doubts"),
        )

        assertEquals(
            listOf("completed"),
            filterTeacherEntries(entries, query = "", status = "completed")
                .map(TeacherEntry::id),
        )
    }

    @Test
    fun queryMatchesStatusLabel() {
        val entries = listOf(
            entry("ongoing", status = "inprogress"),
            entry("closed", status = "completed"),
        )

        assertEquals(
            listOf("ongoing"),
            filterTeacherEntries(entries, query = "in progress", status = "")
                .map(TeacherEntry::id),
        )
    }

    @Test
    fun newestFirstSortUsesDateTimeCreatedAtAndId() {
        val entries = listOf(
            entry("older-date", dateKey = "2026-04-16", timeStart = "11:00", createdAt = 50L),
            entry("newer-date", dateKey = "2026-04-18", timeStart = "09:00", createdAt = 10L),
            entry("later-time", dateKey = "2026-04-17", timeStart = "10:30", createdAt = 20L),
            entry("earlier-time", dateKey = "2026-04-17", timeStart = "09:00", createdAt = 30L),
            entry("later-created", dateKey = "2026-04-17", timeStart = "09:00", createdAt = 40L),
        )

        assertEquals(
            listOf("newer-date", "later-time", "later-created", "earlier-time", "older-date"),
            sortTeacherEntriesNewestFirst(entries).map(TeacherEntry::id),
        )
    }
}

private fun entry(
    id: String,
    title: String = "Topic",
    body: String = "",
    status: String = "",
    dateKey: String = "2026-06-08",
    timeStart: String? = "09:00",
    teacherName: String? = "Teacher",
    createdAt: Long = 1L,
) = TeacherEntry(
    id = id,
    classId = "class-1",
    dateKey = dateKey,
    title = title,
    body = body,
    tag = "note",
    status = status,
    timeStart = timeStart,
    timeEnd = "10:00",
    teacherName = teacherName,
    createdAt = createdAt,
)
