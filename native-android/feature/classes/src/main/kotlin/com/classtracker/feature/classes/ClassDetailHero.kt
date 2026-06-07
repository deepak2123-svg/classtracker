package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.ledgrSectionTone
import com.classtracker.core.model.TeacherClass
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
internal fun ClassDetailHero(
    teacherClass: TeacherClass,
    metrics: ClassDetailMetrics,
) {
    val tone = ledgrSectionTone(teacherClass.sectionName)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.5.dp, Color(0xFF0F172A).copy(alpha = 0.92f)),
        shadowElevation = 4.dp,
    ) {
        Column {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.surface)
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            text = teacherClass.sectionName,
                            style = MaterialTheme.typography.headlineMedium,
                            color = tone.text,
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LedgrPill(
                                text = teacherClass.instituteName.ifBlank { "No institute" },
                                modifier = Modifier.weight(1f, fill = false),
                                containerColor = MaterialTheme.colorScheme.surface,
                                contentColor = colors.textSecondary,
                                borderColor = tone.border,
                                leadingColor = tone.accent,
                            )
                            if (teacherClass.subjectName.isNotBlank()) {
                                LedgrPill(
                                    text = teacherClass.subjectName,
                                    modifier = Modifier.weight(1f, fill = false),
                                    containerColor = MaterialTheme.colorScheme.surface,
                                    contentColor = colors.textSecondary,
                                    borderColor = tone.border,
                                )
                            }
                        }
                    }
                    TodayStatusPill(metrics.todayEntries)
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                HeroStat("Today", metrics.todayEntries.toString(), Modifier.weight(1f))
                HeroStat(currentMonthLabel(), metrics.monthEntries.toString(), Modifier.weight(1f))
                HeroStat("Total", metrics.totalEntries.toString(), Modifier.weight(1f))
                HeroStat("Days", metrics.activeDays.toString(), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun TodayStatusPill(todayEntries: Int) {
    val logged = todayEntries > 0
    Surface(
        color = if (logged) colors.successSurface else colors.warningSurface,
        contentColor = if (logged) colors.green else Color(0xFFB45309),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, if (logged) Color(0xFFBBF7D0) else Color(0xFFFED7AA)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .background(color = if (logged) colors.green else Color(0xFFB45309), shape = CircleShape),
            )
            Text(
                text = if (logged) "Logged today" else "Not logged today",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun HeroStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = colors.surfaceSoft,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
                maxLines = 1,
            )
        }
    }
}

internal data class ClassDetailMetrics(
    val todayEntries: Int,
    val monthEntries: Int,
    val totalEntries: Int,
    val activeDays: Int,
)

private fun currentMonthLabel(): String =
    SimpleDateFormat("MMM", Locale.US).format(Date())
