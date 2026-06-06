package com.classtracker.feature.today

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.ledgrSectionTone
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherDashboard
import com.classtracker.core.model.TeacherEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val AllInstitutes = "All Classes"

@Composable
fun HomeScreen(
    dashboard: TeacherDashboard,
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    onClassClick: (TeacherClass) -> Unit,
    modifier: Modifier = Modifier,
) {
    val institutes = remember(classes) {
        classes.map(TeacherClass::instituteName).distinct()
    }
    var selectedInstitute by rememberSaveable { mutableStateOf(AllInstitutes) }
    val visibleClasses = remember(classes, selectedInstitute) {
        if (selectedInstitute == AllInstitutes) {
            classes
        } else {
            classes.filter { it.instituteName == selectedInstitute }
        }
    }
    val visibleClassIds = remember(visibleClasses) { visibleClasses.mapTo(hashSetOf(), TeacherClass::id) }
    val loggedToday = visibleClasses.count { it.id in dashboard.loggedClassIdsToday }
    val notLoggedToday = (visibleClasses.size - loggedToday).coerceAtLeast(0)
    val monthPrefix = currentMonthPrefix()
    val monthEntries = entries.count {
        it.classId in visibleClassIds && it.dateKey.startsWith(monthPrefix)
    }

    if (selectedInstitute != AllInstitutes && selectedInstitute !in institutes) {
        selectedInstitute = AllInstitutes
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 26.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            HomeSummaryCard(
                visibleCount = visibleClasses.size,
                loggedToday = loggedToday,
                monthEntries = monthEntries,
                notLoggedToday = notLoggedToday,
            )
        }

        if (institutes.size > 1) {
            item {
                InstituteFilterCard(
                    classes = classes,
                    institutes = institutes,
                    selectedInstitute = selectedInstitute,
                    onInstituteSelected = { selectedInstitute = it },
                )
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 4.dp, top = 2.dp, end = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "YOUR CLASSES",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = "${visibleClasses.size} " +
                            if (visibleClasses.size == 1) "class ready" else "classes ready",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 18.sp,
                            lineHeight = 23.sp,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                    )
                }
                LedgrPill(
                    text = "${visibleClasses.size}/${visibleClasses.size} shown",
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = colors.textSecondary,
                )
            }
        }

        if (visibleClasses.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No classes yet",
                    message = "Assigned classes will appear here.",
                    icon = Icons.Outlined.Book,
                )
            }
        } else {
            items(
                items = visibleClasses,
                key = TeacherClass::id,
            ) { teacherClass ->
                LedgrClassCard(
                    sectionName = teacherClass.sectionName,
                    instituteName = teacherClass.instituteName,
                    subjectName = teacherClass.subjectName,
                    loggedToday = teacherClass.id in dashboard.loggedClassIdsToday,
                    compact = true,
                    onClick = { onClassClick(teacherClass) },
                )
            }
        }

        item {
            Text(
                text = "Every class. Every teacher. One place.",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 10.dp),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun HomeSummaryCard(
    visibleCount: Int,
    loggedToday: Int,
    monthEntries: Int,
    notLoggedToday: Int,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 4.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "TODAY",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = currentDateLabel(),
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 19.sp,
                            lineHeight = 23.sp,
                        ),
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "VISIBLE",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = visibleCount.toString(),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 30.sp,
                            lineHeight = 32.sp,
                        ),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SummaryPill("$loggedToday logged today", Modifier.weight(1f))
                SummaryPill("$monthEntries entries this month", Modifier.weight(1f))
            }
            SummaryPill(
                text = "$notLoggedToday not logged today",
                warning = notLoggedToday > 0,
            )
        }
    }
}

@Composable
private fun SummaryPill(
    text: String,
    modifier: Modifier = Modifier,
    warning: Boolean = false,
) {
    LedgrPill(
        text = text,
        modifier = modifier,
        containerColor = if (warning) colors.warningSurface else colors.surfaceAlt,
        contentColor = if (warning) Color(0xFFB45309) else colors.textSecondary,
        borderColor = if (warning) Color(0xFFFED7AA) else MaterialTheme.colorScheme.outline,
    )
}

@Composable
private fun InstituteFilterCard(
    classes: List<TeacherClass>,
    institutes: List<String>,
    selectedInstitute: String,
    onInstituteSelected: (String) -> Unit,
) {
    val options = listOf(AllInstitutes) + institutes
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 4.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "INSTITUTE FILTER",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
                modifier = Modifier.padding(horizontal = 2.dp, vertical = 1.dp),
            )
            options.chunked(2).forEach { rowOptions ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    rowOptions.forEach { institute ->
                        val toneSeed = classes.firstOrNull {
                            it.instituteName == institute
                        }?.sectionName ?: institute
                        InstituteOption(
                            label = institute,
                            toneSeed = toneSeed,
                            selected = institute == selectedInstitute,
                            onClick = { onInstituteSelected(institute) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowOptions.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun InstituteOption(
    label: String,
    toneSeed: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val allClasses = label == AllInstitutes
    val tone = ledgrSectionTone(toneSeed)
    val background = if (allClasses) {
        MaterialTheme.colorScheme.surface
    } else {
        tone.surface
    }
    val borderColor = when {
        selected && allClasses -> colors.outlineStrong
        selected -> tone.accent
        allClasses -> MaterialTheme.colorScheme.outline
        else -> tone.border
    }
    val textColor = if (allClasses) MaterialTheme.colorScheme.onSurface else tone.text

    Surface(
        modifier = modifier
            .heightIn(min = 54.dp)
            .clickable(onClick = onClick),
        color = background,
        contentColor = textColor,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(if (selected) 2.dp else 1.5.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    modifier = Modifier.size(10.dp),
                    shape = CircleShape,
                    color = if (allClasses) {
                        if (selected) colors.textSecondary else Color.Transparent
                    } else {
                        tone.accent
                    },
                    border = BorderStroke(
                        1.dp,
                        if (allClasses) colors.outlineStrong else tone.border,
                    ),
                ) {}
            }
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun currentDateLabel(): String =
    SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())

private fun currentMonthPrefix(): String =
    SimpleDateFormat("yyyy-MM", Locale.US).format(Date())

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
private fun HomeScreenPreview() {
    val classes = listOf(
        TeacherClass("1", "VIRAT-1", "GIS Karnal, Haryana", "GS", null, null),
        TeacherClass("2", "10th C", "KIS SIP, Karnal, Haryana", "SS", null, null),
        TeacherClass("3", "11th", "KIS Competition Wing", "GS", null, null),
    )
    LedgrTheme(darkTheme = false) {
        HomeScreen(
            dashboard = TeacherDashboard(
                teacherName = "Deepak",
                classCount = classes.size,
                entryCountToday = 0,
                studyMinutesToday = 0,
                upcomingClasses = classes,
                entryCountThisMonth = 0,
                instituteCount = 3,
            ),
            classes = classes,
            entries = emptyList(),
            onClassClick = {},
        )
    }
}
