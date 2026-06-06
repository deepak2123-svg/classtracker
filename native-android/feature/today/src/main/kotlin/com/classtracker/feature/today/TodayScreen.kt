package com.classtracker.feature.today

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrMetricCard
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherDashboard
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TodayScreen(
    dashboard: TeacherDashboard,
    modifier: Modifier = Modifier,
) {
    val firstName = dashboard.teacherName
        ?.trim()
        ?.substringBefore(" ")
        ?.takeIf(String::isNotBlank)
    val pendingCount = (dashboard.classCount - dashboard.loggedClassCountToday).coerceAtLeast(0)

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 30.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = greeting(firstName),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Your teaching workspace for today",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shape = MaterialTheme.shapes.large,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
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
                                text = "TODAY",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textMuted,
                            )
                            Text(
                                text = currentDateLabel(),
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                        Column {
                            Text(
                                text = "CLASSES",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textMuted,
                            )
                            Text(
                                text = dashboard.classCount.toString(),
                                style = MaterialTheme.typography.headlineSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        LedgrPill(
                            text = "${dashboard.loggedClassCountToday} logged today",
                            modifier = Modifier.weight(1f),
                            containerColor = colors.successSurface,
                            contentColor = colors.green,
                            borderColor = colors.green.copy(alpha = 0.28f),
                            leadingColor = colors.green,
                        )
                        LedgrPill(
                            text = "$pendingCount pending",
                            modifier = Modifier.weight(1f),
                            containerColor = if (pendingCount > 0) {
                                colors.warningSurface
                            } else {
                                colors.surfaceAlt
                            },
                            contentColor = if (pendingCount > 0) colors.amber else colors.textSecondary,
                            borderColor = if (pendingCount > 0) {
                                colors.amber.copy(alpha = 0.28f)
                            } else {
                                MaterialTheme.colorScheme.outline
                            },
                            leadingColor = if (pendingCount > 0) colors.amber else colors.textSubtle,
                        )
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LedgrMetricCard(
                    label = "Entries",
                    value = dashboard.entryCountToday.toString(),
                    modifier = Modifier.weight(1f),
                    accent = colors.teal,
                )
                LedgrMetricCard(
                    label = "Minutes",
                    value = dashboard.studyMinutesToday.toString(),
                    modifier = Modifier.weight(1f),
                )
                LedgrMetricCard(
                    label = "This month",
                    value = dashboard.entryCountThisMonth.toString(),
                    modifier = Modifier.weight(1f),
                )
            }
        }

        item {
            LedgrSectionHeading(
                title = "Your classes",
                supportingText = if (dashboard.upcomingClasses.isEmpty()) {
                    "Nothing assigned yet"
                } else {
                    "Next ${dashboard.upcomingClasses.size} to review"
                },
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        if (dashboard.upcomingClasses.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No classes to show",
                    message = "Assigned classes will appear here after your account is connected.",
                    icon = Icons.Outlined.EventBusy,
                )
            }
        } else {
            items(
                items = dashboard.upcomingClasses,
                key = TeacherClass::id,
            ) { teacherClass ->
                LedgrClassCard(
                    sectionName = teacherClass.sectionName,
                    instituteName = teacherClass.instituteName,
                    subjectName = teacherClass.subjectName,
                    detail = classTimeLabel(teacherClass),
                    loggedToday = teacherClass.id in dashboard.loggedClassIdsToday,
                )
            }
        }
    }
}

private fun greeting(firstName: String?): String {
    val hour = SimpleDateFormat("H", Locale.US).format(Date()).toIntOrNull() ?: 12
    val period = when (hour) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        else -> "Good evening"
    }
    return firstName?.let { "$period, $it" } ?: period
}

private fun currentDateLabel(): String =
    SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())

private fun classTimeLabel(teacherClass: TeacherClass): String = when {
    !teacherClass.startTime.isNullOrBlank() && !teacherClass.endTime.isNullOrBlank() ->
        "${teacherClass.startTime} - ${teacherClass.endTime}"
    !teacherClass.startTime.isNullOrBlank() -> teacherClass.startTime.orEmpty()
    else -> "Schedule not set"
}

@Preview(showBackground = true, widthDp = 390, heightDp = 800)
@Composable
private fun TodayScreenPreview() {
    LedgrTheme(darkTheme = false) {
        TodayScreen(
            dashboard = TeacherDashboard(
                teacherName = "Deepak Kumar",
                classCount = 6,
                entryCountToday = 2,
                studyMinutesToday = 150,
                upcomingClasses = listOf(
                    TeacherClass(
                        id = "1",
                        sectionName = "VIRAT-1",
                        instituteName = "GIS Karnal, Haryana",
                        subjectName = "GS",
                        startTime = "09:00",
                        endTime = "10:00",
                    ),
                ),
                loggedClassCountToday = 2,
                entryCountThisMonth = 18,
                instituteCount = 3,
                loggedClassIdsToday = setOf("1"),
            ),
        )
    }
}
