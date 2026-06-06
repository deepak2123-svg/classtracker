package com.classtracker.feature.classes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass

private const val AllInstitutes = "All classes"

@Composable
fun ClassesScreen(
    classes: List<TeacherClass>,
    entryCount: (String) -> Int,
    hasEntryToday: (String) -> Boolean,
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

    if (selectedInstitute != AllInstitutes && selectedInstitute !in institutes) {
        selectedInstitute = AllInstitutes
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 30.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Classes",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "${classes.size} assigned across ${institutes.size} " +
                        if (institutes.size == 1) "institute" else "institutes",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }
        }

        if (institutes.size > 1) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "INSTITUTE FILTER",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                        modifier = Modifier.padding(horizontal = 2.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(end = 2.dp),
                    ) {
                        items(listOf(AllInstitutes) + institutes) { institute ->
                            val selected = selectedInstitute == institute
                            FilterChip(
                                selected = selected,
                                onClick = { selectedInstitute = institute },
                                label = {
                                    Text(
                                        text = institute,
                                        maxLines = 1,
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                ),
                            )
                        }
                    }
                }
            }
        }

        item {
            LedgrSectionHeading(
                title = "Your classes",
                supportingText = "${visibleClasses.size} ${if (visibleClasses.size == 1) "class" else "classes"} ready",
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        if (visibleClasses.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No assigned classes",
                    message = "Classes assigned to your teacher account will be listed here.",
                    icon = Icons.Outlined.School,
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
                    detail = classTimeLabel(teacherClass),
                    entryCount = entryCount(teacherClass.id),
                    loggedToday = hasEntryToday(teacherClass.id),
                    onClick = { onClassClick(teacherClass) },
                )
            }
        }
    }
}

private fun classTimeLabel(teacherClass: TeacherClass): String = when {
    !teacherClass.startTime.isNullOrBlank() && !teacherClass.endTime.isNullOrBlank() ->
        "${teacherClass.startTime} - ${teacherClass.endTime}"
    !teacherClass.startTime.isNullOrBlank() -> teacherClass.startTime.orEmpty()
    else -> "Schedule not set"
}

@Preview(showBackground = true, widthDp = 390, heightDp = 800)
@Composable
private fun ClassesScreenPreview() {
    LedgrTheme(darkTheme = false) {
        ClassesScreen(
            classes = listOf(
                TeacherClass(
                    id = "1",
                    sectionName = "KESHAV-1",
                    instituteName = "Genesis, Panipat",
                    subjectName = "Physics",
                    startTime = "09:00",
                    endTime = "10:15",
                ),
            ),
            entryCount = { 4 },
            hasEntryToday = { true },
            onClassClick = {},
        )
    }
}
