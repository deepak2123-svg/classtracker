package com.classtracker.core.model

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TreeSet

enum class TeacherReportPeriod(
    val label: String,
) {
    Daily("Daily"),
    Weekly("Weekly"),
    Monthly("Monthly"),
    Custom("Custom"),
}

data class TeacherReportRange(
    val startDateKey: String,
    val endDateKey: String,
    val label: String,
)

data class TeacherReportClassRow(
    val classId: String,
    val className: String,
    val instituteName: String,
    val subjectName: String,
    val entryCount: Int,
    val timedEntryCount: Int,
    val totalMinutes: Int,
    val statusCounts: Map<String, Int>,
)

data class TeacherReportSummary(
    val period: TeacherReportPeriod,
    val scopeLabel: String,
    val range: TeacherReportRange,
    val totalEntries: Int,
    val timedEntryCount: Int,
    val totalMinutes: Int,
    val activeDays: Int,
    val classCount: Int,
    val instituteCount: Int,
    val classRows: List<TeacherReportClassRow>,
    val scopedInstituteNames: Set<String>? = null,
)

fun TeacherSnapshot.teacherReport(
    period: TeacherReportPeriod,
    todayKey: String,
    instituteName: String? = null,
    instituteNames: Set<String>? = null,
    monthlyDateKey: String? = null,
    customStartDateKey: String? = null,
    customEndDateKey: String? = null,
): TeacherReportSummary {
    val range = reportRange(
        period = period,
        todayKey = todayKey,
        monthlyDateKey = monthlyDateKey,
        customStartDateKey = customStartDateKey,
        customEndDateKey = customEndDateKey,
    )
    val selectedInstituteNames = selectedInstituteNames(
        instituteName = instituteName,
        instituteNames = instituteNames,
    )
    val scopedClasses = classes
        .filter { selectedInstituteNames == null || it.instituteName in selectedInstituteNames }
        .sortedWith(
            compareBy<TeacherClass> { it.instituteName.lowercase(Locale.US) }
                .thenBy { it.sectionName.lowercase(Locale.US) },
        )
    val classIds = scopedClasses.mapTo(hashSetOf(), TeacherClass::id)
    val scopedEntries = entries
        .filter { it.classId in classIds }
        .filter { it.dateKey in range.startDateKey..range.endDateKey }
    val entriesByClass = scopedEntries.groupBy(TeacherEntry::classId)

    val rows = scopedClasses.map { teacherClass ->
        val classEntries = entriesByClass[teacherClass.id].orEmpty()
        TeacherReportClassRow(
            classId = teacherClass.id,
            className = teacherClass.sectionName,
            instituteName = teacherClass.instituteName,
            subjectName = teacherClass.subjectName,
            entryCount = classEntries.size,
            timedEntryCount = classEntries.count { it.durationMinutes() > 0 },
            totalMinutes = classEntries.sumOf { it.durationMinutes() },
            statusCounts = classEntries
                .map { it.status.ifBlank { "unspecified" } }
                .groupingBy { it }
                .eachCount(),
        )
    }.sortedWith(
        compareByDescending<TeacherReportClassRow> { it.totalMinutes }
            .thenByDescending { it.entryCount }
            .thenBy { it.className.lowercase(Locale.US) },
    )

    return TeacherReportSummary(
        period = period,
        scopeLabel = reportScopeLabel(selectedInstituteNames),
        range = range,
        totalEntries = scopedEntries.size,
        timedEntryCount = scopedEntries.count { it.durationMinutes() > 0 },
        totalMinutes = scopedEntries.sumOf { it.durationMinutes() },
        activeDays = scopedEntries.map(TeacherEntry::dateKey).distinct().size,
        classCount = rows.count { it.entryCount > 0 },
        instituteCount = scopedClasses.map(TeacherClass::instituteName).distinct().size,
        classRows = rows,
        scopedInstituteNames = selectedInstituteNames,
    )
}

fun TeacherReportSummary.toShareText(): String {
    val rows = classRows
        .filter { it.entryCount > 0 }
        .joinToString(separator = "\n") { row ->
            "- ${row.className} (${row.instituteName}): ${row.entryCount} entries, " +
                formatReportMinutes(row.totalMinutes)
        }
        .ifBlank { "- No entries in this report window." }

    return buildString {
        appendLine("Ledgr Teacher Report")
        appendLine("${period.label} · $scopeLabel")
        appendLine("${range.label}: ${range.startDateKey} to ${range.endDateKey}")
        appendLine()
        appendLine("Entries: $totalEntries")
        appendLine("Teaching time: ${formatReportMinutes(totalMinutes)}")
        appendLine("Active days: $activeDays")
        appendLine("Classes logged: $classCount")
        appendLine()
        appendLine("Class breakdown")
        append(rows)
    }
}

fun formatReportMinutes(total: Int): String {
    if (total <= 0) return "0m"
    val hours = total / 60
    val minutes = total % 60
    return when {
        hours == 0 -> "${minutes}m"
        minutes == 0 -> "${hours}h"
        else -> "${hours}h ${minutes}m"
    }
}

private fun reportRange(
    period: TeacherReportPeriod,
    todayKey: String,
    monthlyDateKey: String?,
    customStartDateKey: String?,
    customEndDateKey: String?,
): TeacherReportRange {
    val today = parseDateKey(todayKey) ?: Calendar.getInstance()
    return when (period) {
        TeacherReportPeriod.Daily -> TeacherReportRange(
            startDateKey = todayKey,
            endDateKey = todayKey,
            label = "Today",
        )
        TeacherReportPeriod.Weekly -> {
            val start = today.clone() as Calendar
            val daysSinceMonday = (start.get(Calendar.DAY_OF_WEEK) + 5) % 7
            start.add(Calendar.DAY_OF_YEAR, -daysSinceMonday)
            val end = start.clone() as Calendar
            end.add(Calendar.DAY_OF_YEAR, 6)
            TeacherReportRange(
                startDateKey = dateKey(start),
                endDateKey = dateKey(end),
                label = "This week",
            )
        }
        TeacherReportPeriod.Monthly -> {
            val selectedMonth = monthlyDateKey
                ?.takeIf(::isDateKey)
                ?.let(::parseDateKey)
                ?: today
            val start = selectedMonth.clone() as Calendar
            start.set(Calendar.DAY_OF_MONTH, 1)
            val end = start.clone() as Calendar
            end.set(Calendar.DAY_OF_MONTH, end.getActualMaximum(Calendar.DAY_OF_MONTH))
            TeacherReportRange(
                startDateKey = dateKey(start),
                endDateKey = dateKey(end),
                label = monthLabel(start),
            )
        }
        TeacherReportPeriod.Custom -> {
            val start = customStartDateKey?.takeIf(::isDateKey) ?: todayKey
            val end = customEndDateKey?.takeIf(::isDateKey) ?: todayKey
            TeacherReportRange(
                startDateKey = minOf(start, end),
                endDateKey = maxOf(start, end),
                label = "Custom range",
            )
        }
    }
}

private fun selectedInstituteNames(
    instituteName: String?,
    instituteNames: Set<String>?,
): Set<String>? {
    val names = instituteNames
        ?.takeIf { it.isNotEmpty() }
        ?: instituteName?.let(::setOf)
        ?: return null
    val sorted = TreeSet<String>(String.CASE_INSENSITIVE_ORDER)
    names
        .map(String::trim)
        .filter(String::isNotEmpty)
        .forEach(sorted::add)
    return sorted.takeIf { it.isNotEmpty() }
}

private fun reportScopeLabel(instituteNames: Set<String>?): String = when {
    instituteNames == null -> "All institutes"
    instituteNames.size == 1 -> instituteNames.first()
    instituteNames.size <= 3 -> instituteNames.joinToString(", ")
    else -> "${instituteNames.size} institutes"
}

private fun TeacherEntry.durationMinutes(): Int {
    val start = timeToMinutes(timeStart) ?: return 0
    val end = timeToMinutes(timeEnd) ?: return 0
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

private fun parseDateKey(value: String): Calendar? {
    val parsed = runCatching {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value)
    }.getOrNull() ?: return null
    return Calendar.getInstance().apply { time = parsed }
}

private fun isDateKey(value: String): Boolean = parseDateKey(value) != null

private fun dateKey(calendar: Calendar): String =
    "%04d-%02d-%02d".format(
        Locale.US,
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH) + 1,
        calendar.get(Calendar.DAY_OF_MONTH),
    )

private fun monthLabel(calendar: Calendar): String =
    SimpleDateFormat("MMMM yyyy", Locale.US).format(calendar.time)
