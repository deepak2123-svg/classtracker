package com.classtracker.core.model

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class TeacherDashboard(
    val teacherName: String?,
    val classCount: Int,
    val entryCountToday: Int,
    val studyMinutesToday: Int,
    val upcomingClasses: List<TeacherClass>,
    val loggedClassCountToday: Int = 0,
    val entryCountThisMonth: Int = 0,
    val instituteCount: Int = 0,
    val loggedClassIdsToday: Set<String> = emptySet(),
) {
    init {
        require(classCount >= 0)
        require(entryCountToday >= 0)
        require(studyMinutesToday >= 0)
        require(loggedClassCountToday >= 0)
        require(entryCountThisMonth >= 0)
        require(instituteCount >= 0)
    }

    companion object {
        val Empty = TeacherDashboard(
            teacherName = null,
            classCount = 0,
            entryCountToday = 0,
            studyMinutesToday = 0,
            upcomingClasses = emptyList(),
            loggedClassCountToday = 0,
            entryCountThisMonth = 0,
            instituteCount = 0,
            loggedClassIdsToday = emptySet(),
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
    val createdAt: Long = 0L,
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
    val syncState: TeacherEntrySyncState = TeacherEntrySyncState.Synced,
)

data class TeacherTrashedEntry(
    val id: String,
    val classId: String,
    val className: String,
    val instituteName: String,
    val dateKey: String,
    val title: String,
    val body: String,
    val tag: String,
    val status: String,
    val timeStart: String?,
    val timeEnd: String?,
    val teacherName: String?,
    val createdAt: Long,
    val deletedAt: Long,
    val syncState: TeacherEntrySyncState = TeacherEntrySyncState.Synced,
)

enum class TeacherEntrySyncState {
    Synced,
    Pending,
    Syncing,
    Failed,
}

data class TeacherSyncSummary(
    val pendingCount: Int = 0,
    val syncingCount: Int = 0,
    val failedCount: Int = 0,
    val lastError: String? = null,
) {
    val hasWork: Boolean
        get() = pendingCount > 0 || syncingCount > 0 || failedCount > 0

    companion object {
        val Idle = TeacherSyncSummary()
    }
}

data class TeacherEntryDraft(
    val entryId: String? = null,
    val mutationId: String = "",
    val classId: String,
    val dateKey: String,
    val title: String = "",
    val body: String = "",
    val tag: String = "note",
    val status: String = "",
    val timeStart: String = "",
    val timeEnd: String = "",
    val createdAt: Long? = null,
)

fun TeacherEntryDraft.resolvedEntryId(fallback: String): String =
    entryId ?: mutationId.takeIf(String::isNotBlank) ?: fallback

fun TeacherEntry.toDuplicateDraft(mutationId: String): TeacherEntryDraft = TeacherEntryDraft(
    mutationId = mutationId,
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart.orEmpty(),
    timeEnd = timeEnd.orEmpty(),
)

fun TeacherEntry.toTrashedEntry(
    className: String,
    instituteName: String,
    deletedAt: Long,
    syncState: TeacherEntrySyncState = TeacherEntrySyncState.Pending,
): TeacherTrashedEntry = TeacherTrashedEntry(
    id = id,
    classId = classId,
    className = className,
    instituteName = instituteName,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart,
    timeEnd = timeEnd,
    teacherName = teacherName,
    createdAt = createdAt,
    deletedAt = deletedAt,
    syncState = syncState,
)

fun TeacherTrashedEntry.toRestoreDraft(mutationId: String): TeacherEntryDraft = TeacherEntryDraft(
    entryId = id,
    mutationId = mutationId,
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart.orEmpty(),
    timeEnd = timeEnd.orEmpty(),
    createdAt = createdAt,
)

enum class TeacherEntryStatus(
    val storageValue: String,
    val label: String,
) {
    Started("started", "Started"),
    InProgress("inprogress", "In Progress"),
    Completed("completed", "Completed"),
    Doubts("doubts", "Doubts"),
}

sealed interface TeacherEntryValidation {
    data object Valid : TeacherEntryValidation

    data class Invalid(val message: String) : TeacherEntryValidation
}

fun validateTeacherEntryDraft(
    draft: TeacherEntryDraft,
    existingEntries: List<TeacherEntry> = emptyList(),
): TeacherEntryValidation {
    if (!isValidDateKey(draft.dateKey)) {
        return TeacherEntryValidation.Invalid("Choose a valid entry date.")
    }
    if (draft.title.trim().isEmpty()) {
        return TeacherEntryValidation.Invalid("Add the topic before saving.")
    }
    val startMinutes = timeToMinutes(draft.timeStart)
        ?: return TeacherEntryValidation.Invalid("Add a valid start time.")
    val endMinutes = draft.timeEnd
        .takeIf(String::isNotBlank)
        ?.let(::timeToMinutes)
        ?: if (draft.timeEnd.isBlank()) null else {
            return TeacherEntryValidation.Invalid("Add a valid end time.")
        }
    if (endMinutes != null && endMinutes <= startMinutes) {
        return TeacherEntryValidation.Invalid("End time must be after start time.")
    }

    val overlappingEntry = existingEntries.firstOrNull { entry ->
        entry.id != draft.entryId &&
            entry.classId == draft.classId &&
            entry.dateKey == draft.dateKey &&
            entriesOverlap(
                firstStart = startMinutes,
                firstEnd = endMinutes,
                secondStart = timeToMinutes(entry.timeStart),
                secondEnd = timeToMinutes(entry.timeEnd),
            )
    }
    if (overlappingEntry != null) {
        return TeacherEntryValidation.Invalid(
            "Another entry already uses ${overlappingEntry.timeStart.orEmpty()} for this class.",
        )
    }
    return TeacherEntryValidation.Valid
}

fun isTeacherEntryDateWithinWindow(
    dateKey: String,
    nowMillis: Long = System.currentTimeMillis(),
    previousDays: Int = 7,
): Boolean {
    if (previousDays < 0) return false
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val entryDate = runCatching { formatter.parse(dateKey) }.getOrNull() ?: return false
    val start = Calendar.getInstance().apply {
        timeInMillis = nowMillis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        add(Calendar.DAY_OF_YEAR, -previousDays)
    }.time
    val end = Calendar.getInstance().apply {
        timeInMillis = nowMillis
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
        set(Calendar.MILLISECOND, 999)
    }.time
    return !entryDate.before(start) && !entryDate.after(end)
}

data class TeacherSnapshot(
    val profile: TeacherProfile,
    val classes: List<TeacherClass>,
    val entries: List<TeacherEntry>,
    val trashedEntries: List<TeacherTrashedEntry> = emptyList(),
    val availableInstitutes: List<String>,
    val configuredInstituteCount: Int,
    val revision: Long,
    val isFromCache: Boolean = false,
    val loadedAtMillis: Long = 0L,
) {
    fun entriesForClass(classId: String): List<TeacherEntry> =
        entries.filter { it.classId == classId }

    fun trashedEntriesForClass(classId: String): List<TeacherTrashedEntry> =
        trashedEntries.filter { it.classId == classId }

    fun dashboard(todayKey: String): TeacherDashboard {
        val todayEntries = entries.filter { it.dateKey == todayKey }
        val monthPrefix = todayKey.take(7)
        val loggedClassIds = todayEntries.mapTo(linkedSetOf(), TeacherEntry::classId)
        return TeacherDashboard(
            teacherName = profile.name.ifBlank { null },
            classCount = classes.size,
            entryCountToday = todayEntries.size,
            studyMinutesToday = todayEntries.sumOf(::entryDurationMinutes),
            upcomingClasses = classes.take(3),
            loggedClassCountToday = loggedClassIds.size,
            entryCountThisMonth = entries.count { it.dateKey.startsWith(monthPrefix) },
            instituteCount = classes.map(TeacherClass::instituteName).distinct().size,
            loggedClassIdsToday = loggedClassIds,
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
    if (hour !in 0..23 || minute !in 0..59) return null
    return (hour * 60) + minute
}

private fun entriesOverlap(
    firstStart: Int,
    firstEnd: Int?,
    secondStart: Int?,
    secondEnd: Int?,
): Boolean {
    if (secondStart == null) return false
    if (firstStart == secondStart) return true
    if (firstEnd == null || secondEnd == null) return false
    return firstStart < secondEnd && firstEnd > secondStart
}

private val DATE_KEY_PATTERN = Regex("""\d{4}-\d{2}-\d{2}""")

private fun isValidDateKey(value: String): Boolean {
    if (!DATE_KEY_PATTERN.matches(value)) return false
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    return runCatching { formatter.parse(value) }.getOrNull() != null
}
