package com.classtracker.feature.classes

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
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.RestoreFromTrash
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.filterTeacherEntries
import com.classtracker.core.model.isTeacherEntryDateWithinWindow
import com.classtracker.core.model.sortTeacherEntriesNewestFirst
import com.classtracker.core.model.validateTeacherEntryDraft
import com.classtracker.feature.entries.EntryEditorColumn

/**
 * Combined class entry screen — Phase 4 checkpoint 10.
 *
 * Replaces the three-screen flow (home → class detail → add entry) with a
 * single screen: sticky class header + inline entry editor + full history.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClassEntryScreen(
    teacherClass: TeacherClass,
    entries: List<TeacherEntry>,
    trashedEntries: List<TeacherTrashedEntry> = emptyList(),
    draft: TeacherEntryDraft,
    saving: Boolean,
    recoveredDraft: Boolean,
    createEnabled: Boolean = false,
    editEnabled: Boolean = false,
    deleteEnabled: Boolean = false,
    editorVisible: Boolean = true,
    syllabus: PublishedSyllabus? = null,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSave: (TeacherEntryDraft) -> Unit,
    onAddAnotherEntry: () -> Unit = {},
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
    var historyQuery by rememberSaveable(teacherClass.id, "entry-history-query") {
        mutableStateOf("")
    }
    var selectedStatusFilter by rememberSaveable(teacherClass.id, "entry-history-status") {
        mutableStateOf(AllStatusFilter)
    }
    val filteredHistoryEntries = remember(entries, historyQuery, selectedStatusFilter) {
        sortTeacherEntriesNewestFirst(
            filterTeacherEntries(
                entries = entries,
                query = historyQuery,
                status = selectedStatusFilter,
            ),
        )
    }
    val historyFilterActive = historyQuery.isNotBlank() || selectedStatusFilter.isNotBlank()
    val listState = rememberLazyListState()

    androidx.compose.runtime.LaunchedEffect(editorVisible, entries.size) {
        if (!editorVisible && entries.isNotEmpty()) {
            listState.animateScrollToItem(1)
        }
    }

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
            )
        }

        // ── Recovered draft banner ────────────────────────────────────────────
        if (recoveredDraft) {
            item(key = "recovered-draft-banner") {
                RecoveredDraftBanner()
            }
        }

        // ── Inline entry editor ───────────────────────────────────────────────
        if (editorVisible) {
            item(key = "entry-editor") {
                EntryEditorColumn(
                    draft = draft,
                    existingEntries = entries,
                    timeSlots = teacherClass.timeSlots,
                    saving = saving,
                    validation = validation,
                    syllabus = syllabus,
                    onDraftChanged = onDraftChanged,
                    onSave = onSave,
                )
            }
        }

        if (entries.isNotEmpty()) {
            item(key = "history-section-break") {
                ClassHistorySectionBreak(
                    count = entries.size,
                    modifier = Modifier.padding(top = 14.dp),
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

        // ── History filter card ───────────────────────────────────────────────
        if (entries.isNotEmpty()) {
            item(key = "history-filter") {
                ClassEntryHistoryFilterCard(
                    query = historyQuery,
                    selectedStatus = selectedStatusFilter,
                    filteredCount = filteredHistoryEntries.size,
                    totalCount = entries.size,
                    onQueryChange = { historyQuery = it },
                    onStatusSelected = { selectedStatusFilter = it },
                    onClear = {
                        historyQuery = ""
                        selectedStatusFilter = AllStatusFilter
                    },
                )
            }
        }

        // ── All history heading ───────────────────────────────────────────────
        item(key = "history-heading") {
            LedgrSectionHeading(
                title = "Entries",
                supportingText = if (historyFilterActive) {
                    "${filteredHistoryEntries.size} of ${entries.size} shown"
                } else {
                    "Newest first"
                },
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        // ── History entries ───────────────────────────────────────────────────
        if (entries.isEmpty()) {
            item(key = "history-empty") {
                LedgrEmptyState(
                    title = "No history yet",
                    message = "Teaching entries for this class will appear here.",
                    icon = Icons.Outlined.History,
                )
            }
        } else if (filteredHistoryEntries.isEmpty()) {
            item(key = "history-no-match") {
                LedgrEmptyState(
                    title = "No matching entries",
                    message = "Try another search or status.",
                    icon = Icons.Outlined.Search,
                )
            }
        } else {
            items(
                items = filteredHistoryEntries,
                key = { "history-${it.id}" },
            ) { entry ->
                val canMutateEntry = isTeacherEntryDateWithinWindow(entry.dateKey) &&
                    entry.syncState != TeacherEntrySyncState.Syncing
                EntryCard(
                    entry = entry,
                    showDate = true,
                    editEnabled = editEnabled && canMutateEntry,
                    duplicateEnabled = createEnabled && canMutateEntry,
                    deleteEnabled = deleteEnabled &&
                        entry.syncState == TeacherEntrySyncState.Synced,
                    onEdit = {
                        haptics.selection()
                        onEditEntry(entry)
                    },
                    onDuplicate = {
                        haptics.selection()
                        onDuplicateEntry(entry)
                    },
                    onDelete = {
                        haptics.warning()
                        deleteCandidate = entry
                    },
                )
            }
        }

        // ── Recycle bin ───────────────────────────────────────────────────────
        if (trashedEntries.isNotEmpty()) {
            item(key = "recycle-heading") {
                LedgrSectionHeading(
                    title = "Recycle bin",
                    supportingText = "${trashedEntries.size} deleted " +
                        if (trashedEntries.size == 1) "entry" else "entries",
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            items(
                items = trashedEntries,
                key = { "trash-${it.id}" },
            ) { entry ->
                TrashedEntryCard(
                    entry = entry,
                    restoreEnabled = deleteEnabled &&
                        entry.syncState != TeacherEntrySyncState.Syncing,
                    onRestore = {
                        haptics.confirm()
                        onRestoreEntry(entry)
                    },
                )
            }
        } else if (deleteEnabled) {
            item(key = "recycle-empty") {
                LedgrEmptyState(
                    title = "Recycle bin is empty",
                    message = "Deleted entries from this class will appear here.",
                    icon = Icons.Outlined.RestoreFromTrash,
                )
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

// ── History filter card ───────────────────────────────────────────────────────

@Composable
private fun ClassEntryHistoryFilterCard(
    query: String,
    selectedStatus: String,
    filteredCount: Int,
    totalCount: Int,
    onQueryChange: (String) -> Unit,
    onStatusSelected: (String) -> Unit,
    onClear: () -> Unit,
) {
    val active = query.isNotBlank() || selectedStatus.isNotBlank()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 1.dp,
    ) {
        androidx.compose.foundation.layout.Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.compose.foundation.layout.Column(
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = "FILTERS",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textSubtle,
                    )
                    Text(
                        text = "$filteredCount of $totalCount entries",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (active) colors.teal else colors.textMuted,
                    )
                }
                if (active) {
                    TextButton(onClick = onClear) { Text("Clear") }
                }
            }

            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search history") },
                singleLine = true,
                leadingIcon = {
                    Icon(imageVector = Icons.Outlined.Search, contentDescription = null)
                },
                trailingIcon = {
                    if (query.isNotBlank()) {
                        IconButton(onClick = { onQueryChange("") }) {
                            Icon(
                                imageVector = Icons.Outlined.Close,
                                contentDescription = "Clear search",
                            )
                        }
                    }
                },
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 1.dp),
            ) {
                items(ClassEntryHistoryStatusFilters, key = { it.value }) { filter ->
                    ClassEntryHistoryStatusChip(
                        label = filter.label,
                        selected = selectedStatus == filter.value,
                        onClick = { onStatusSelected(filter.value) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ClassEntryHistoryStatusChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val containerColor by animateColorAsState(
        targetValue = if (selected) colors.forest else colors.surfaceAlt,
        label = "class-entry-chip-container",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) Color.White else colors.textSecondary,
        label = "class-entry-chip-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.outline,
        label = "class-entry-chip-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.03f else 1f,
        animationSpec = spring(stiffness = 460f, dampingRatio = 0.82f),
        label = "class-entry-chip-scale",
    )
    Surface(
        modifier = Modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .size(width = 112.dp, height = 42.dp)
            .clickable(onClick = onClick),
        color = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = borderColor,
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
            )
        }
    }
}

// ── Status filter data ────────────────────────────────────────────────────────

private data class ClassEntryHistoryStatusFilter(val value: String, val label: String)
private const val AllStatusFilter = ""
private val ClassEntryHistoryStatusFilters = listOf(
    ClassEntryHistoryStatusFilter(AllStatusFilter, "All"),
    ClassEntryHistoryStatusFilter(
        TeacherEntryStatus.Started.storageValue,
        TeacherEntryStatus.Started.label,
    ),
    ClassEntryHistoryStatusFilter(
        TeacherEntryStatus.InProgress.storageValue,
        TeacherEntryStatus.InProgress.label,
    ),
    ClassEntryHistoryStatusFilter(
        TeacherEntryStatus.Completed.storageValue,
        TeacherEntryStatus.Completed.label,
    ),
    ClassEntryHistoryStatusFilter(
        TeacherEntryStatus.Doubts.storageValue,
        TeacherEntryStatus.Doubts.label,
    ),
)

@Composable
private fun ClassHistorySectionBreak(
    count: Int,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "CLASS HISTORY",
                style = MaterialTheme.typography.labelLarge.copy(
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                color = colors.textMuted,
            )
            Text(
                text = "$count ${if (count == 1) "entry" else "entries"} saved",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun classEntryCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else Color(0xFFEFEEE8)
