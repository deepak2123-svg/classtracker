package com.classtracker.feature.classes

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.model.TeacherClass
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val HeroInk = Color(0xFF202A55)
private val HeroStatSurface = Color(0xFF3E486F)
private val HeroMint = Color(0xFF63D9B5)
private val HeroWarning = Color(0xFFFFF4C8)

@Composable
internal fun ClassDetailHero(
    teacherClass: TeacherClass,
    metrics: ClassDetailMetrics,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = HeroInk,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = teacherClass.sectionName,
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontSize = 23.sp,
                                lineHeight = 27.sp,
                                fontWeight = FontWeight.ExtraBold,
                            ),
                            color = Color.White,
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LedgrPill(
                                text = teacherClass.instituteName.ifBlank { "No institute" },
                                modifier = Modifier.weight(1f, fill = false),
                                containerColor = Color.White.copy(alpha = 0.14f),
                                contentColor = Color.White,
                                borderColor = Color.Transparent,
                                leadingColor = HeroMint,
                            )
                            if (teacherClass.subjectName.isNotBlank()) {
                                LedgrPill(
                                    text = teacherClass.subjectName,
                                    modifier = Modifier.weight(1f, fill = false),
                                    containerColor = Color.White.copy(alpha = 0.14f),
                                    contentColor = Color.White,
                                    borderColor = Color.Transparent,
                                )
                            }
                        }
                    }
                    TodayStatusPill(metrics.todayEntries)
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth(),
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
        color = if (logged) Color(0xFFDFF8E8) else HeroWarning,
        contentColor = if (logged) Color(0xFF176B3D) else Color(0xFF805E00),
        shape = RoundedCornerShape(999.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .background(color = if (logged) Color(0xFF18A05A) else Color(0xFFF59E0B), shape = CircleShape),
            )
            Text(
                text = if (logged) "Logged today" else "Not logged today",
                style = MaterialTheme.typography.labelMedium,
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
        color = HeroStatSurface,
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 21.sp,
                    lineHeight = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                color = Color.White,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.72f),
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
