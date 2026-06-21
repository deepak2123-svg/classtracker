package com.classtracker.feature.classes

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.tween
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.validateTeacherEntryDraft
import com.classtracker.feature.entries.EntryEditorColumn

/**
 * Combined class entry screen — Phase 4 checkpoint 10.
 *
 * Replaces the three-screen flow (home → class detail → add entry) with a
 * single screen: sticky class header + inline entry editor, while past entries
 * live in a separate archive view.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClassEntryScreen(
    teacherClass: TeacherClass,
    entries: List<TeacherEntry>,
    trashedEntries: List<TeacherTrashedEntry> = emptyList(),
    draft: TeacherEntryDraft,
    saving: Boolean,
    saveCompleted: Boolean = false,
    recoveredDraft: Boolean,
    createEnabled: Boolean = false,
    editEnabled: Boolean = false,
    deleteEnabled: Boolean = false,
    editorVisible: Boolean = true,
    syllabus: PublishedSyllabus? = null,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSave: (TeacherEntryDraft) -> Unit,
    onAddAnotherEntry: () -> Unit = {},
    onOpenPastEntries: () -> Unit = {},
    onOpenPreviousClass: () -> Unit = {},
    onOpenNextClass: () -> Unit = {},
    canSwipeToPreviousClass: Boolean = false,
    canSwipeToNextClass: Boolean = false,
    onEditEntry: (TeacherEntry) -> Unit = {},
    onDuplicateEntry: (TeacherEntry) -> Unit = {},
    onDeleteEntry: (TeacherEntry) -> Unit = {},
    onRestoreEntry: (TeacherTrashedEntry) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val haptics = rememberLedgrHaptics()
    val todayKey = remember { todayKey() }
    val monthPrefix = todayKey.take(7)
    val metrics = remember(entries, todayKey) {
        ClassDetailMetrics(
            todayEntries = entries.count { it.dateKey == todayKey },
            monthEntries = entries.count { it.dateKey.startsWith(monthPrefix) },
            totalEntries = entries.size,
            activeDays = entries.map(TeacherEntry::dateKey).distinct().size,
        )
    }
    val validation = remember(draft, entries) {
        validateTeacherEntryDraft(draft, entries)
    }
    var deleteCandidate by remember { mutableStateOf<TeacherEntry?>(null) }
    val hasHistoryContent = entries.isNotEmpty() || trashedEntries.isNotEmpty()
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        modifier = modifier
            .fillMaxSize()
            .background(classEntryCanvasColor())
            .imePadding(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 36.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Sticky class header ───────────────────────────────────────────────
        stickyHeader(key = "class-hero-${teacherClass.id}") {
            ClassDetailHero(
                teacherClass = teacherClass,
                metrics = metrics,
                swipeEnabled = canSwipeToPreviousClass || canSwipeToNextClass,
                canSwipePrevious = canSwipeToPreviousClass,
                canSwipeNext = canSwipeToNextClass,
                onSwipePrevious = onOpenPreviousClass,
                onSwipeNext = onOpenNextClass,
            )
        }

        // ── Recovered draft banner ────────────────────────────────────────────
        if (recoveredDraft) {
            item(key = "recovered-draft-banner") {
                RecoveredDraftBanner()
            }
        }

        // ── Inline entry editor ───────────────────────────────────────────────
        item(key = "entry-editor") {
            AnimatedVisibility(
                visible = editorVisible,
                enter = expandVertically(animationSpec = tween(durationMillis = 180)) +
                    fadeIn(animationSpec = tween(durationMillis = 180)),
                exit = shrinkVertically(animationSpec = tween(durationMillis = 220)) +
                    fadeOut(animationSpec = tween(durationMillis = 180)),
            ) {
                EntryEditorColumn(
                    draft = draft,
                    existingEntries = entries,
                    timeSlots = teacherClass.timeSlots,
                    saving = saving,
                    saveCompleted = saveCompleted,
                    validation = validation,
                    syllabus = syllabus,
                    onDraftChanged = onDraftChanged,
                    onSave = onSave,
                )
            }
        }

        if (!editorVisible) {
            item(key = "add-another-entry") {
                Button(
                    onClick = {
                        haptics.selection()
                        onAddAnotherEntry()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.teal,
                        contentColor = Color.White,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 13.dp),
                ) {
                    Text(
                        text = "Add another entry",
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }

        if (hasHistoryContent) {
            item(key = "history-toggle") {
                Button(
                    onClick = {
                        haptics.selection()
                        onOpenPastEntries()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.teal.copy(alpha = 0.14f),
                        contentColor = colors.teal,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.History,
                        contentDescription = null,
                        modifier = Modifier.padding(end = 8.dp),
                    )
                    Text(
                        text = "View history",
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }

    // ── Delete confirm dialog ─────────────────────────────────────────────────
    deleteCandidate?.let { entry ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            icon = { Icon(imageVector = Icons.Outlined.Delete, contentDescription = null) },
            title = { Text("Move entry to recycle bin?") },
            text = { Text(entry.title.ifBlank { "This teaching entry can be restored later." }) },
            confirmButton = {
                TextButton(onClick = {
                    haptics.warning()
                    deleteCandidate = null
                    onDeleteEntry(entry)
                }) {
                    Text("Move to bin")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteCandidate = null }) { Text("Cancel") }
            },
        )
    }
}

// ── Recovered draft banner ────────────────────────────────────────────────────

@Composable
private fun RecoveredDraftBanner() {
    Surface(
        color = colors.successSurface,
        contentColor = colors.green,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.green.copy(alpha = 0.35f)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.CheckCircle,
                contentDescription = null,
            )
            Text(
                text = "Draft restored from this device",
                style = MaterialTheme.typography.labelLarge,
            )
        }
    }
}

@Composable
private fun classEntryCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else Color(0xFFEAF4FF)
