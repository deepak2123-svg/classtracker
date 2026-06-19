package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.SyllabusChapter
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.completedSyllabusUnitIds
import com.classtracker.core.model.progressForCompletedUnitIds
import com.classtracker.core.model.syllabusChapterCompletionMarker

private val SyllabusLightCanvas = Color(0xFFEAF4FF)
private val SyllabusInk = Color(0xFF10204A)
private val SyllabusMuted = Color(0xFF85837D)
private val SyllabusGreen = Color(0xFF0F7D6F)

@Composable
private fun syllabusCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else SyllabusLightCanvas

@Composable
private fun syllabusCardColor() =
    if (LedgrTheme.isDark) Color(0xFF1D1D1F) else Color.White

@Composable
private fun syllabusCardInnerColor() =
    if (LedgrTheme.isDark) Color(0xFF252527) else Color(0xFFF3F5F8)

@Composable
private fun syllabusInkColor() =
    if (LedgrTheme.isDark) Color.White else SyllabusInk

@Composable
private fun syllabusMutedColor() =
    if (LedgrTheme.isDark) Color(0xFF8C8C8C) else SyllabusMuted

@Composable
private fun syllabusBorderColor() =
    if (LedgrTheme.isDark) Color(0xFF343437) else Color(0xFFD7DCE4)

@Composable
private fun syllabusAccentColor() =
    if (LedgrTheme.isDark) Color(0xFF0B806D) else SyllabusGreen

@Composable
fun SyllabusScreen(
    teacherUid: String,
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    syllabi: List<PublishedSyllabus>,
    loading: Boolean,
    errorMessage: String?,
    onClassClick: (TeacherClass) -> Unit,
    onSaveProgress: (TeacherClass, PublishedSyllabus, Set<String>) -> Unit,
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
            .background(syllabusCanvasColor()),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "SYLLABUS",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                    color = syllabusMutedColor(),
                )
                Text(
                    text = "Syllabus",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 21.sp,
                        lineHeight = 25.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = syllabusInkColor(),
                    ),
                )
            }
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
                    onSaveProgress = { completedUnitIds ->
                        onSaveProgress(teacherClass, syllabus, completedUnitIds)
                    },
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
    onSaveProgress: (Set<String>) -> Unit,
) {
    val haptics = rememberLedgrHaptics()
    val savedUnitIds = remember(syllabus, entries) {
        completedSyllabusUnitIds(entries.filter { it.syllabusTemplateId == syllabus.templateId })
    }
    var expanded by remember { mutableStateOf(false) }
    var draftUnitIds by remember(syllabus.templateId, savedUnitIds) {
        mutableStateOf(savedUnitIds)
    }
    val visibleUnitIds = if (expanded) draftUnitIds else savedUnitIds
    val progress = remember(syllabus, visibleUnitIds) {
        syllabus.progressForCompletedUnitIds(visibleUnitIds)
    }
    val hasChanges = draftUnitIds != savedUnitIds
    val remainingChapters = (progress.totalChapters - progress.completedChapters).coerceAtLeast(0)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(24.dp),
        color = syllabusCardColor(),
        contentColor = syllabusInkColor(),
        border = BorderStroke(1.dp, syllabusBorderColor()),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = teacherClass.sectionName,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 19.sp,
                            lineHeight = 23.sp,
                        ),
                        fontWeight = FontWeight.ExtraBold,
                        color = syllabusInkColor(),
                    )
                    Text(
                        text = "${teacherClass.instituteName} · ${teacherClass.subjectName}",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            lineHeight = 18.sp,
                        ),
                        fontWeight = FontWeight.Bold,
                        color = syllabusMutedColor(),
                    )
                }
                Text(
                    text = "${progress.percent}%",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 23.sp,
                        lineHeight = 27.sp,
                    ),
                    fontWeight = FontWeight.ExtraBold,
                    color = syllabusAccentColor(),
                )
            }
            LinearProgressIndicator(
                progress = { progress.percent / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(7.dp),
                color = syllabusAccentColor(),
                trackColor = if (LedgrTheme.isDark) Color(0xFF28282A) else Color(0xFFE8E0F5),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                SyllabusStatTile(
                    label = "Completed",
                    value = "${progress.completedChapters} ch.",
                    modifier = Modifier.weight(1f),
                )
                SyllabusStatTile(
                    label = "Remaining",
                    value = "$remainingChapters ch.",
                    modifier = Modifier.weight(1f),
                )
                SyllabusStatTile(
                    label = "Total",
                    value = "${progress.totalChapters} ch.",
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                text = if (expanded) "Hide chapters  ^" else "View chapters  v",
                modifier = Modifier.clickable {
                    haptics.selection()
                    expanded = !expanded
                    if (!expanded) draftUnitIds = savedUnitIds
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = syllabusAccentColor(),
            )
            if (expanded) {
                HorizontalDivider(color = syllabusBorderColor())
                syllabus.chapters.forEach { chapter ->
                    SyllabusCompletionRow(
                        chapter = chapter,
                        completedUnitIds = draftUnitIds,
                        onCompletedUnitIdsChanged = { draftUnitIds = it },
                    )
                }
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    color = syllabusCardInnerColor(),
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = if (hasChanges) {
                                "Review your selections, then save syllabus progress."
                            } else {
                                "Select completed chapters or topics. You can untick anything before saving."
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = syllabusMutedColor(),
                            fontWeight = FontWeight.Bold,
                        )
                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            enabled = hasChanges,
                            onClick = {
                                haptics.confirm()
                                onSaveProgress(draftUnitIds)
                                expanded = false
                            },
                        ) {
                            Text("Save syllabus progress")
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            TextButton(
                                enabled = hasChanges,
                                onClick = {
                                    haptics.selection()
                                    draftUnitIds = savedUnitIds
                                },
                            ) {
                                Text("Reset changes")
                            }
                            TextButton(onClick = {
                                haptics.selection()
                                onClick()
                            }) { Text("Open class entry") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SyllabusStatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.height(62.dp),
        shape = RoundedCornerShape(12.dp),
        color = syllabusCardInnerColor(),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = syllabusMutedColor(),
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = syllabusInkColor(),
            )
        }
    }
}

@Composable
private fun SyllabusCompletionRow(
    chapter: SyllabusChapter,
    completedUnitIds: Set<String>,
    onCompletedUnitIdsChanged: (Set<String>) -> Unit,
) {
    val haptics = rememberLedgrHaptics()
    val marker = syllabusChapterCompletionMarker(chapter.id)
    val chapterComplete = marker in completedUnitIds ||
        (chapter.topics.isNotEmpty() && chapter.topics.all { it.id in completedUnitIds })
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    haptics.selection()
                    val topicIds = chapter.topics.map { it.id }.toSet()
                    onCompletedUnitIdsChanged(
                        if (chapterComplete) {
                            completedUnitIds - marker - topicIds
                        } else {
                            completedUnitIds + marker + topicIds
                        },
                    )
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SyllabusCheckBox(
                checked = chapterComplete,
                onClick = {
                    haptics.selection()
                    val topicIds = chapter.topics.map { topic -> topic.id }.toSet()
                    onCompletedUnitIdsChanged(
                        if (chapterComplete) {
                            completedUnitIds - marker - topicIds
                        } else {
                            completedUnitIds + marker + topicIds
                        },
                    )
                },
            )
            Text(
                text = "${chapter.order}. ${chapter.title}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.ExtraBold,
                color = if (chapterComplete) {
                    syllabusAccentColor()
                } else {
                    syllabusInkColor()
                },
            )
        }
        HorizontalDivider(color = syllabusBorderColor())
        if (chapter.topics.isNotEmpty()) {
            chapter.topics.forEach { topic ->
                val topicComplete = marker in completedUnitIds || topic.id in completedUnitIds
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 28.dp)
                        .clickable {
                            haptics.selection()
                            onCompletedUnitIdsChanged(
                                completedUnitIds.toggledTopicIds(
                                    chapter = chapter,
                                    topicId = topic.id,
                                    currentlyComplete = topicComplete,
                                ),
                            )
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SyllabusCheckBox(
                        checked = topicComplete,
                        onClick = {
                            haptics.selection()
                            onCompletedUnitIdsChanged(
                                completedUnitIds.toggledTopicIds(
                                    chapter = chapter,
                                    topicId = topic.id,
                                    currentlyComplete = topicComplete,
                                ),
                            )
                        },
                    )
                    Text(
                        text = topic.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (topicComplete) {
                            syllabusAccentColor()
                        } else {
                            syllabusMutedColor()
                        },
                    )
                }
                HorizontalDivider(
                    modifier = Modifier.padding(start = 28.dp),
                    color = syllabusBorderColor(),
                )
            }
        }
    }
}

@Composable
private fun SyllabusCheckBox(
    checked: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .padding(end = 10.dp)
            .size(24.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(5.dp),
        color = if (checked) syllabusAccentColor() else Color.Transparent,
        border = BorderStroke(
            2.dp,
            if (checked) syllabusAccentColor() else syllabusBorderColor(),
        ),
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (checked) {
                Text(
                    text = "✓",
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

private fun Set<String>.toggledTopicIds(
    chapter: SyllabusChapter,
    topicId: String,
    currentlyComplete: Boolean,
): Set<String> {
    val marker = syllabusChapterCompletionMarker(chapter.id)
    val topicIds = chapter.topics.map { it.id }.toSet()
    val base = if (marker in this) {
        (this - marker) + topicIds
    } else {
        this
    }
    val next = if (currentlyComplete) {
        base - topicId
    } else {
        base + topicId
    }
    return if (topicIds.isNotEmpty() && topicIds.all { it in next }) {
        next + marker
    } else {
        next - marker
    }
}
