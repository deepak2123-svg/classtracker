package com.classtracker.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TeacherDashboardTest {
    @Test
    fun emptyDashboardHasNoTeacherData() {
        val dashboard = TeacherDashboard.Empty

        assertEquals(0, dashboard.classCount)
        assertEquals(0, dashboard.entryCountToday)
        assertTrue(dashboard.upcomingClasses.isEmpty())
    }

    @Test(expected = IllegalArgumentException::class)
    fun negativeCountsAreRejected() {
        TeacherDashboard(
            teacherName = "Teacher",
            classCount = -1,
            entryCountToday = 0,
            studyMinutesToday = 0,
            upcomingClasses = emptyList(),
        )
    }

    @Test
    fun snapshotBuildsDashboardForRequestedDate() {
        val snapshot = TeacherSnapshot(
            profile = TeacherProfile(
                uid = "teacher-1",
                name = "Deepak",
                email = "teacher@example.com",
                photoUrl = null,
                subjects = listOf("Physics"),
                institutes = listOf("Genesis"),
            ),
            classes = listOf(
                TeacherClass(
                    id = "class-1",
                    sectionName = "KESHAV-1",
                    instituteName = "Genesis",
                    subjectName = "Physics",
                    startTime = null,
                    endTime = null,
                ),
            ),
            entries = listOf(
                TeacherEntry(
                    id = "entry-1",
                    classId = "class-1",
                    dateKey = "2026-06-06",
                    title = "Motion",
                    body = "",
                    tag = "note",
                    status = "",
                    timeStart = "09:00",
                    timeEnd = "10:15",
                    teacherName = "Deepak",
                    createdAt = 1L,
                ),
            ),
            availableInstitutes = listOf("Genesis"),
            configuredInstituteCount = 1,
            revision = 3,
        )

        val dashboard = snapshot.dashboard("2026-06-06")

        assertEquals(1, dashboard.classCount)
        assertEquals(1, dashboard.entryCountToday)
        assertEquals(75, dashboard.studyMinutesToday)
    }
}
