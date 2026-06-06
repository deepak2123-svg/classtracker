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
}
