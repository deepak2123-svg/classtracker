package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.progress

@Composable
fun SyllabusScreen(
    teacherUid: String,
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    syllabi: List<PublishedSyllabus>,
    loading: Boolean,
    errorMessage: String?,
    onClassClick: (TeacherClass) -> Unit,
    modifier: Modifier = Modifier,
) {
    val assignments = remember(teacherUid, classes, syllabi) {
        classes.mapNotNull { teacherClass ->
            syllabi
                .filter { it.appliesTo(teacherUid, teacherClass.id) }
                .maxByOrNull(PublishedSyllabus::version)
                ?.let { teacherClass to it }
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            LedgrSectionHeading(
                title = "Syllabus",
                supportingText = "Published by your admin",
            )
        }
        if (loading && assignments.isEmpty()) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
        } else if (assignments.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No syllabus assigned",
                    message = errorMessage
                        ?: "Published syllabi for your classes will appear here.",
                    icon = Icons.Outlined.MenuBook,
                )
            }
        } else {
            items(assignments, key = { it.first.id }) { (teacherClass, syllabus) ->
                SyllabusClassCard(
                    teacherClass = teacherClass,
                    syllabus = syllabus,
                    entries = entries.filter { it.classId == teacherClass.id },
                    onClick = { onClassClick(teacherClass) },
                )
            }
        }
    }
}

@Composable
private fun SyllabusClassCard(
    teacherClass: TeacherClass,
    syllabus: PublishedSyllabus,
    entries: List<TeacherEntry>,
    onClick: () -> Unit,
) {
    val progress = remember(syllabus, entries) { syllabus.progress(entries) }
    var expanded by remember { mutableStateOf(false) }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shadowElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier
                .clickable { expanded = !expanded }
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = teacherClass.sectionName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Text(
                        text = "${teacherClass.instituteName} · ${teacherClass.subjectName}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = "${progress.percent}%",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            LinearProgressIndicator(
                progress = { progress.percent / 100f },
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "${progress.completedChapters} of ${progress.totalChapters} chapters completed",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
            )
            if (expanded) {
                syllabus.chapters.forEach { chapter ->
                    val chapterEntries = entries.filter { it.syllabusChapterId == chapter.id }
                    val completedTopics = chapterEntries
                        .flatMapTo(linkedSetOf()) { it.completedSyllabusTopicIds }
                    val complete = chapterEntries.any(TeacherEntry::syllabusChapterCompleted) ||
                        (chapter.topics.isNotEmpty() &&
                            chapter.topics.all { it.id in completedTopics })
                    Text(
                        text = "${if (complete) "✓" else "○"} ${chapter.order}. ${chapter.title}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (complete) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                    )
                }
                Text(
                    text = "Open class entry",
                    modifier = Modifier.clickable(onClick = onClick),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}
