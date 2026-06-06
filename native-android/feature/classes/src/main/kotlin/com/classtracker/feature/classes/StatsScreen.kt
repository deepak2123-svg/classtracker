package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.ledgrSectionTone
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun StatsScreen(
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    onClassClick: (TeacherClass) -> Unit,
    modifier: Modifier = Modifier,
) {
    val analytics = remember(classes, entries) { buildTeacherAnalytics(classes, entries) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 14.dp,
            top = 16.dp,
            end = 14.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            IntroCard()
        }

        if (classes.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No classes yet",
                    message = "Once classes are added, their teaching timelines will appear here.",
                    icon = Icons.Outlined.BarChart,
                )
            }
        } else {
            item {
                TotalTimeHero(analytics = analytics)
            }
            item {
                MetricsGrid(analytics = analytics)
            }
            item {
                WeekRhythmCard(analytics = analytics)
            }
            item {
                Text(
                    text = if (analytics.institutes.size > 1) "INSTITUTES" else "ALL CLASSES",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    modifier = Modifier.padding(start = 2.dp, top = 2.dp, end = 2.dp),
                )
            }

            if (analytics.institutes.size > 1) {
                items(
                    items = analytics.institutes,
                    key = InstituteAnalytics::name,
                ) { institute ->
                    InstituteStatsCard(
                        analytics = institute,
                        onClassClick = onClassClick,
                    )
                }
            } else {
                items(
                    items = analytics.classes,
                    key = ClassAnalytics::teacherClassId,
                ) { classAnalytics ->
                    val teacherClass = classes.first { it.id == classAnalytics.teacherClassId }
                    ClassStatsCard(
                        teacherClass = teacherClass,
                        analytics = classAnalytics,
                        onClick = { onClassClick(teacherClass) },
                    )
                }
            }
        }
    }
}

@Composable
private fun IntroCard() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 15.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = "TEACHING OVERVIEW",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
            )
            Text(
                text = "View stats",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "Teaching time, current progress, and weekly rhythm stay together here.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun TotalTimeHero(analytics: TeacherAnalytics) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surfaceSoft,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                modifier = Modifier.size(52.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = colors.teal,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, colors.teal.copy(alpha = 0.18f)),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    androidx.compose.material3.Icon(
                        imageVector = Icons.Outlined.AccessTime,
                        contentDescription = null,
                        modifier = Modifier.size(26.dp),
                    )
                }
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    text = "TOTAL TEACHING TIME",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                )
                Text(
                    text = formatMinutes(analytics.totalMinutes),
                    style = MaterialTheme.typography.displaySmall.copy(
                        fontSize = 38.sp,
                        lineHeight = 40.sp,
                    ),
                )
                Text(
                    text = "${analytics.classes.size} sections · ${analytics.totalEntries} entries · " +
                        "${analytics.timedSessions} timed sessions",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    LedgrPill("${analytics.activeDays} active days")
                    LedgrPill(
                        "${analytics.institutes.size} " +
                            if (analytics.institutes.size == 1) "institute" else "institutes",
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricsGrid(analytics: TeacherAnalytics) {
    val metrics = listOf(
        Triple("Today", formatMinutes(analytics.todayMinutes), analytics.todayEntries),
        Triple("This week", formatMinutes(analytics.weekMinutes), analytics.weekEntries),
        Triple("This month", formatMinutes(analytics.monthMinutes), analytics.monthEntries),
        Triple("Entries", analytics.totalEntries.toString(), analytics.activeDays),
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        metrics.chunked(2).forEach { rowMetrics ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                rowMetrics.forEach { metric ->
                    MetricCard(
                        label = metric.first,
                        value = metric.second,
                        note = if (metric.first == "Entries") {
                            "${metric.third} active ${if (metric.third == 1) "day" else "days"}"
                        } else {
                            "${metric.third} ${if (metric.third == 1) "entry" else "entries"}"
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricCard(
    label: String,
    value: String,
    note: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontSize = 26.sp,
                    lineHeight = 28.sp,
                ),
            )
            Text(
                text = note,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun WeekRhythmCard(analytics: TeacherAnalytics) {
    val maximum = analytics.weekBars.maxOfOrNull(DayBar::minutes)?.coerceAtLeast(1) ?: 1
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column {
                    Text(
                        text = "CURRENT WEEK",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = "This week's teaching rhythm",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSubtle,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
                Text(
                    text = "${formatMinutes(analytics.weekMinutes)} this week",
                    style = MaterialTheme.typography.labelMedium,
                    color = colors.textSecondary,
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(104.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                analytics.weekBars.forEach { day ->
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Bottom,
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(
                                    if (day.minutes == 0) {
                                        5.dp
                                    } else {
                                        (78f * day.minutes / maximum).coerceAtLeast(8f).dp
                                    },
                                )
                                .background(
                                    color = if (day.minutes > 0) colors.teal else colors.surfaceAlt,
                                    shape = RoundedCornerShape(
                                        topStart = 8.dp,
                                        topEnd = 8.dp,
                                        bottomStart = 3.dp,
                                        bottomEnd = 3.dp,
                                    ),
                                ),
                        )
                        Text(
                            text = day.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (day.isToday) colors.teal else colors.textSubtle,
                            modifier = Modifier.padding(top = 7.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InstituteStatsCard(
    analytics: InstituteAnalytics,
    onClassClick: (TeacherClass) -> Unit,
) {
    val tone = ledgrSectionTone(analytics.name)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, tone.border),
    ) {
        Column(
            modifier = Modifier.padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier = Modifier
                        .padding(top = 5.dp)
                        .size(12.dp)
                        .background(tone.accent, CircleShape),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = analytics.name,
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "${analytics.classes.size} " +
                            (if (analytics.classes.size == 1) "class" else "classes") +
                            " · ${analytics.entryCount} entries",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = formatMinutes(analytics.totalMinutes),
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        text = "all time",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSubtle,
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MiniMetric("Today", formatMinutes(analytics.todayMinutes), Modifier.weight(1f))
                MiniMetric("Week", formatMinutes(analytics.weekMinutes), Modifier.weight(1f))
                MiniMetric("Month", formatMinutes(analytics.monthMinutes), Modifier.weight(1f))
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                analytics.classes.forEach { classAnalytics ->
                    val teacherClass = analytics.teacherClasses.first {
                        it.id == classAnalytics.teacherClassId
                    }
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onClassClick(teacherClass) },
                        color = tone.surface,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, tone.border),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = teacherClass.sectionName,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = tone.text,
                                )
                                Text(
                                    text = "${classAnalytics.entryCount} entries",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.textMuted,
                                )
                            }
                            Text(
                                text = formatMinutes(classAnalytics.totalMinutes),
                                style = MaterialTheme.typography.labelLarge,
                                color = tone.text,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MiniMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = colors.surfaceSoft,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp)) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun ClassStatsCard(
    teacherClass: TeacherClass,
    analytics: ClassAnalytics,
    onClick: () -> Unit,
) {
    val tone = ledgrSectionTone(teacherClass.sectionName)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, tone.border),
    ) {
        Column(
            modifier = Modifier.padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = teacherClass.sectionName,
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        text = teacherClass.instituteName,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    text = formatMinutes(analytics.totalMinutes),
                    style = MaterialTheme.typography.titleLarge,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniMetric("Today", formatMinutes(analytics.todayMinutes), Modifier.weight(1f))
                MiniMetric("Week", formatMinutes(analytics.weekMinutes), Modifier.weight(1f))
                MiniMetric("Month", formatMinutes(analytics.monthMinutes), Modifier.weight(1f))
            }
        }
    }
}

private data class TeacherAnalytics(
    val totalMinutes: Int,
    val todayMinutes: Int,
    val weekMinutes: Int,
    val monthMinutes: Int,
    val totalEntries: Int,
    val todayEntries: Int,
    val weekEntries: Int,
    val monthEntries: Int,
    val timedSessions: Int,
    val activeDays: Int,
    val weekBars: List<DayBar>,
    val classes: List<ClassAnalytics>,
    val institutes: List<InstituteAnalytics>,
)

private data class ClassAnalytics(
    val teacherClassId: String,
    val totalMinutes: Int,
    val todayMinutes: Int,
    val weekMinutes: Int,
    val monthMinutes: Int,
    val entryCount: Int,
)

private data class InstituteAnalytics(
    val name: String,
    val totalMinutes: Int,
    val todayMinutes: Int,
    val weekMinutes: Int,
    val monthMinutes: Int,
    val entryCount: Int,
    val teacherClasses: List<TeacherClass>,
    val classes: List<ClassAnalytics>,
)

private data class DayBar(
    val key: String,
    val label: String,
    val minutes: Int,
    val isToday: Boolean,
)

private fun buildTeacherAnalytics(
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
): TeacherAnalytics {
    val today = dateKey(Date())
    val monthPrefix = today.take(7)
    val weekKeys = currentWeekKeys()
    val weekKeySet = weekKeys.mapTo(hashSetOf(), Pair<String, String>::first)

    fun matches(classId: String): List<TeacherEntry> = entries.filter { it.classId == classId }
    fun minutes(values: List<TeacherEntry>): Int = values.sumOf(::entryMinutes)

    val classAnalytics = classes.map { teacherClass ->
        val classEntries = matches(teacherClass.id)
        ClassAnalytics(
            teacherClassId = teacherClass.id,
            totalMinutes = minutes(classEntries),
            todayMinutes = minutes(classEntries.filter { it.dateKey == today }),
            weekMinutes = minutes(classEntries.filter { it.dateKey in weekKeySet }),
            monthMinutes = minutes(classEntries.filter { it.dateKey.startsWith(monthPrefix) }),
            entryCount = classEntries.size,
        )
    }

    val institutes = classes
        .groupBy(TeacherClass::instituteName)
        .map { (name, instituteClasses) ->
            val ids = instituteClasses.mapTo(hashSetOf(), TeacherClass::id)
            val instituteEntries = entries.filter { it.classId in ids }
            val analyticsById = classAnalytics.associateBy(ClassAnalytics::teacherClassId)
            InstituteAnalytics(
                name = name,
                totalMinutes = minutes(instituteEntries),
                todayMinutes = minutes(instituteEntries.filter { it.dateKey == today }),
                weekMinutes = minutes(instituteEntries.filter { it.dateKey in weekKeySet }),
                monthMinutes = minutes(instituteEntries.filter { it.dateKey.startsWith(monthPrefix) }),
                entryCount = instituteEntries.size,
                teacherClasses = instituteClasses,
                classes = instituteClasses.mapNotNull { analyticsById[it.id] },
            )
        }
        .sortedWith(
            compareByDescending<InstituteAnalytics> { it.totalMinutes }
                .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name },
        )

    return TeacherAnalytics(
        totalMinutes = minutes(entries),
        todayMinutes = minutes(entries.filter { it.dateKey == today }),
        weekMinutes = minutes(entries.filter { it.dateKey in weekKeySet }),
        monthMinutes = minutes(entries.filter { it.dateKey.startsWith(monthPrefix) }),
        totalEntries = entries.size,
        todayEntries = entries.count { it.dateKey == today },
        weekEntries = entries.count { it.dateKey in weekKeySet },
        monthEntries = entries.count { it.dateKey.startsWith(monthPrefix) },
        timedSessions = entries.count { entryMinutes(it) > 0 },
        activeDays = entries.map(TeacherEntry::dateKey).distinct().size,
        weekBars = weekKeys.map { (key, label) ->
            DayBar(
                key = key,
                label = label,
                minutes = minutes(entries.filter { it.dateKey == key }),
                isToday = key == today,
            )
        },
        classes = classAnalytics,
        institutes = institutes,
    )
}

private fun currentWeekKeys(): List<Pair<String, String>> {
    val calendar = Calendar.getInstance()
    val currentDay = calendar.get(Calendar.DAY_OF_WEEK)
    val daysSinceMonday = (currentDay + 5) % 7
    calendar.add(Calendar.DAY_OF_YEAR, -daysSinceMonday)
    val dayFormatter = SimpleDateFormat("EEE", Locale.US)
    return List(7) {
        val key = dateKey(calendar.time)
        val label = dayFormatter.format(calendar.time).take(1)
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        key to label
    }
}

private fun dateKey(date: Date): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

private fun entryMinutes(entry: TeacherEntry): Int {
    val start = timeMinutes(entry.timeStart) ?: return 0
    val end = timeMinutes(entry.timeEnd) ?: return 0
    return (end - start).takeIf { it in 1..479 } ?: 0
}

private fun timeMinutes(value: String?): Int? {
    val parts = value?.split(":") ?: return null
    if (parts.size < 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    return hour * 60 + minute
}

private fun formatMinutes(total: Int): String {
    if (total <= 0) return "0m"
    val hours = total / 60
    val minutes = total % 60
    return when {
        hours == 0 -> "${minutes}m"
        minutes == 0 -> "${hours}h"
        else -> "${hours}h ${minutes}m"
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
private fun StatsScreenPreview() {
    val classes = listOf(
        TeacherClass("1", "VIRAT-1", "GIS Karnal, Haryana", "GS", null, null),
        TeacherClass("2", "10th C", "KIS SIP, Karnal, Haryana", "SS", null, null),
    )
    LedgrTheme(darkTheme = false) {
        StatsScreen(
            classes = classes,
            entries = emptyList(),
            onClassClick = {},
        )
    }
}
