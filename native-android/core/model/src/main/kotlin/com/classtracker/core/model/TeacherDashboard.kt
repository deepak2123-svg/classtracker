package com.classtracker.core.model

data class TeacherDashboard(
    val teacherName: String?,
    val classCount: Int,
    val entryCountToday: Int,
    val studyMinutesToday: Int,
    val upcomingClasses: List<TeacherClass>,
) {
    init {
        require(classCount >= 0)
        require(entryCountToday >= 0)
        require(studyMinutesToday >= 0)
    }

    companion object {
        val Empty = TeacherDashboard(
            teacherName = null,
            classCount = 0,
            entryCountToday = 0,
            studyMinutesToday = 0,
            upcomingClasses = emptyList(),
        )
    }
}

data class TeacherClass(
    val id: String,
    val sectionName: String,
    val instituteName: String,
    val subjectName: String,
    val startTime: String?,
    val endTime: String?,
)
