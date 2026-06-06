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

data class TeacherProfile(
    val uid: String,
    val name: String,
    val email: String,
    val photoUrl: String?,
    val subjects: List<String>,
    val institutes: List<String>,
)

data class TeacherEntry(
    val id: String,
    val classId: String,
    val dateKey: String,
    val title: String,
    val body: String,
    val tag: String,
    val status: String,
    val timeStart: String?,
    val timeEnd: String?,
    val teacherName: String?,
    val createdAt: Long,
)

data class TeacherSnapshot(
    val profile: TeacherProfile,
    val classes: List<TeacherClass>,
    val entries: List<TeacherEntry>,
    val availableInstitutes: List<String>,
    val configuredInstituteCount: Int,
    val revision: Long,
) {
    fun entriesForClass(classId: String): List<TeacherEntry> =
        entries.filter { it.classId == classId }

    fun dashboard(todayKey: String): TeacherDashboard {
        val todayEntries = entries.filter { it.dateKey == todayKey }
        return TeacherDashboard(
            teacherName = profile.name.ifBlank { null },
            classCount = classes.size,
            entryCountToday = todayEntries.size,
            studyMinutesToday = todayEntries.sumOf(::entryDurationMinutes),
            upcomingClasses = classes.take(3),
        )
    }
}

data class AuthenticatedTeacher(
    val uid: String,
    val displayName: String?,
    val email: String?,
    val photoUrl: String?,
)

private fun entryDurationMinutes(entry: TeacherEntry): Int {
    val start = timeToMinutes(entry.timeStart) ?: return 0
    val end = timeToMinutes(entry.timeEnd) ?: return 0
    return (end - start).takeIf { it in 1..479 } ?: 0
}

private fun timeToMinutes(value: String?): Int? {
    val parts = value?.split(":") ?: return null
    if (parts.size < 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    return (hour * 60) + minute
}
