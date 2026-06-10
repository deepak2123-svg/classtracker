package com.classtracker.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TeacherReportsTest {
    @Test
    fun weeklyReportFiltersByCurrentWeekAndInstitute() {
        val report = reportSnapshot().teacherReport(
            period = TeacherReportPeriod.Weekly,
            todayKey = "2026-06-10",
            instituteName = "KIS",
        )

        assertEquals("This week", report.range.label)
        assertEquals("2026-06-08", report.range.startDateKey)
        assertEquals("2026-06-14", report.range.endDateKey)
        assertEquals("KIS", report.scopeLabel)
        assertEquals(2, report.totalEntries)
        assertEquals(150, report.totalMinutes)
        assertEquals(2, report.activeDays)
        assertEquals(1, report.classCount)
        assertEquals("Madhav 3", report.classRows.first().className)
    }

    @Test
    fun customReportNormalizesDateOrderAndBuildsShareText() {
        val report = reportSnapshot().teacherReport(
            period = TeacherReportPeriod.Custom,
            todayKey = "2026-06-10",
            customStartDateKey = "2026-06-10",
            customEndDateKey = "2026-06-08",
        )

        assertEquals("2026-06-08", report.range.startDateKey)
        assertEquals("2026-06-10", report.range.endDateKey)
        assertEquals(3, report.totalEntries)
        assertEquals(210, report.totalMinutes)

        val shareText = report.toShareText()

        assertTrue(shareText.contains("Ledgr Teacher Report"))
        assertTrue(shareText.contains("Custom · All institutes"))
        assertTrue(shareText.contains("Madhav 3"))
        assertTrue(shareText.contains("Keshav 1"))
    }

    @Test
    fun reportCanFilterMultipleInstitutes() {
        val report = reportSnapshot().teacherReport(
            period = TeacherReportPeriod.Weekly,
            todayKey = "2026-06-10",
            instituteNames = setOf("GIS", "KIS"),
        )

        assertEquals("GIS, KIS", report.scopeLabel)
        assertEquals(setOf("GIS", "KIS"), report.scopedInstituteNames)
        assertEquals(3, report.totalEntries)
        assertEquals(210, report.totalMinutes)
        assertEquals(2, report.classCount)
        assertEquals(2, report.instituteCount)
    }

    private fun reportSnapshot(): TeacherSnapshot = TeacherSnapshot(
        profile = TeacherProfile(
            uid = "teacher-1",
            name = "Deepak",
            email = "teacher@example.com",
            photoUrl = null,
            subjects = listOf("GS"),
            institutes = listOf("KIS", "GIS"),
        ),
        classes = listOf(
            TeacherClass(
                id = "class-1",
                sectionName = "Madhav 3",
                instituteName = "KIS",
                subjectName = "GS",
                startTime = null,
                endTime = null,
            ),
            TeacherClass(
                id = "class-2",
                sectionName = "Keshav 1",
                instituteName = "GIS",
                subjectName = "GS",
                startTime = null,
                endTime = null,
            ),
        ),
        entries = listOf(
            TeacherEntry(
                id = "entry-1",
                classId = "class-1",
                dateKey = "2026-06-08",
                title = "Physical Geography",
                body = "",
                tag = "note",
                status = "started",
                timeStart = "09:00",
                timeEnd = "10:30",
                teacherName = "Deepak",
                createdAt = 1L,
            ),
            TeacherEntry(
                id = "entry-2",
                classId = "class-1",
                dateKey = "2026-06-09",
                title = "Polity",
                body = "",
                tag = "note",
                status = "completed",
                timeStart = "10:00",
                timeEnd = "11:00",
                teacherName = "Deepak",
                createdAt = 2L,
            ),
            TeacherEntry(
                id = "entry-3",
                classId = "class-2",
                dateKey = "2026-06-10",
                title = "Economy",
                body = "",
                tag = "note",
                status = "inprogress",
                timeStart = "12:00",
                timeEnd = "13:00",
                teacherName = "Deepak",
                createdAt = 3L,
            ),
            TeacherEntry(
                id = "entry-old",
                classId = "class-1",
                dateKey = "2026-06-01",
                title = "Outside range",
                body = "",
                tag = "note",
                status = "completed",
                timeStart = "12:00",
                timeEnd = "13:00",
                teacherName = "Deepak",
                createdAt = 4L,
            ),
        ),
        trashedEntries = emptyList(),
        availableInstitutes = listOf("KIS", "GIS"),
        configuredInstituteCount = 2,
        revision = 1L,
    )
}
