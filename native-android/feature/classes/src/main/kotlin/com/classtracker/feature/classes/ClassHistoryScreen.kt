package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.RestoreFromTrash
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.filterTeacherEntries
import com.classtracker.core.model.isTeacherEntryDateWithinWindow
import com.classtracker.core.model.sortTeacherEntriesNewestFirst

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClassHistoryScreen(
    teacherClass: TeacherClass,
    entries: List<TeacherEntry>,
    trashedEntries: List<TeacherTrashedEntry> = emptyList(),
    createEnabled: Boolean = false,
    editEnabled: Boolean = false,
    deleteEnabled: Boolean = false,
    onAddEntry: (String) -> Unit = {},
    onEditEntry: (TeacherEntry) -> Unit = {},
    onDuplicateEntry: (TeacherEntry) -> Unit = {},
    onDeleteEntry: (TeacherEntry) -> Unit = {},
    onRestoreEntry: (TeacherTrashedEntry) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val todayKey = remember { todayKey() }
    var selectedDate by rememberSaveable(teacherClass.id) { androidx.compose.runtime.mutableStateOf(todayKey) }
    var deleteCandidate by remember { mutableStateOf<TeacherEntry?>(null) }
    var historyQuery by rememberSaveable(teacherClass.id, "history-query") {
        mutableStateOf("")
    }
    var selectedStatusFilter by rememberSaveable(teacherClass.id, "history-status") {
        mutableStateOf(AllStatusFilter)
    }
    val dateCounts = remember(entries) { entries.groupingBy(TeacherEntry::dateKey).eachCount() }
    val focusDates = remember(entries, todayKey) { buildFocusDateKeys(entries, todayKey) }
    val focusedEntries = remember(entries, selectedDate) {
        entries.filter { it.dateKey == selectedDate }
            .sortedWith(compareBy<TeacherEntry> { it.timeStart.orEmpty() }.thenBy { it.createdAt })
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
    val monthPrefix = todayKey.take(7)
    val metrics = remember(entries, todayKey) {
        ClassDetailMetrics(
            todayEntries = entries.count { it.dateKey == todayKey },
            monthEntries = entries.count { it.dateKey.startsWith(monthPrefix) },
            totalEntries = entries.size,
            activeDays = entries.map(TeacherEntry::dateKey).distinct().size,
        )
    }
    val canAddForSelectedDate = createEnabled && isTeacherEntryDateWithinWindow(selectedDate)

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
        stickyHeader(key = "class-hero-${teacherClass.id}") {
            ClassDetailHero(
                teacherClass = teacherClass,
                metrics = metrics,
            )
        }

        item {
            DateStripCard(
                dates = focusDates,
                selectedDate = selectedDate,
                entryCounts = dateCounts,
                onDateSelected = { selectedDate = it },
            )
        }

        item {
            DateFocusCard(
                selectedDate = selectedDate,
                entryCount = focusedEntries.size,
                canAdd = canAddForSelectedDate,
                onAddEntry = { onAddEntry(selectedDate) },
            )
        }

        if (focusedEntries.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = if (canAddForSelectedDate) "No entries yet" else "No entries for this date",
                    message = if (canAddForSelectedDate) {
                        "Tap Add Entry to log this class."
                    } else {
                        "Older dates remain visible when entries already exist."
                    },
                    icon = Icons.Outlined.Edit,
                )
            }
        } else {
            items(
                items = focusedEntries,
                key = TeacherEntry::id,
            ) { entry ->
                val canMutateEntry = isTeacherEntryDateWithinWindow(entry.dateKey) &&
                    entry.syncState != TeacherEntrySyncState.Syncing
                EntryCard(
                    entry = entry,
                    showDate = false,
                    editEnabled = editEnabled && canMutateEntry,
                    duplicateEnabled = createEnabled && canMutateEntry,
                    deleteEnabled = deleteEnabled && entry.syncState == TeacherEntrySyncState.Synced,
                    onEdit = { onEditEntry(entry) },
                    onDuplicate = { onDuplicateEntry(entry) },
                    onDelete = { deleteCandidate = entry },
                )
            }
        }

        if (entries.isNotEmpty()) {
            item {
                HistoryFilterCard(
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

        item {
            LedgrSectionHeading(
                title = "All history",
                supportingText = if (historyFilterActive) {
                    "${filteredHistoryEntries.size} of ${entries.size} shown"
                } else {
                    "Newest entries first"
                },
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        if (entries.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No history yet",
                    message = "Teaching entries for this class will appear here.",
                    icon = Icons.Outlined.History,
                )
            }
        } else if (filteredHistoryEntries.isEmpty()) {
            item {
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
                    deleteEnabled = deleteEnabled && entry.syncState == TeacherEntrySyncState.Synced,
                    onEdit = { onEditEntry(entry) },
                    onDuplicate = { onDuplicateEntry(entry) },
                    onDelete = { deleteCandidate = entry },
                )
            }
        }

        if (trashedEntries.isNotEmpty()) {
            item {
                LedgrSectionHeading(
                    title = "Recycle bin",
                    supportingText = "${trashedEntries.size} deleted ${if (trashedEntries.size == 1) "entry" else "entries"}",
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            items(
                items = trashedEntries,
                key = { "trash-${it.id}" },
            ) { entry ->
                TrashedEntryCard(
                    entry = entry,
                    restoreEnabled = deleteEnabled && entry.syncState != TeacherEntrySyncState.Syncing,
                    onRestore = { onRestoreEntry(entry) },
                )
            }
        } else if (deleteEnabled) {
            item {
                LedgrEmptyState(
                    title = "Recycle bin is empty",
                    message = "Deleted entries from this class will appear here.",
                    icon = Icons.Outlined.RestoreFromTrash,
                )
            }
        }
    }

    deleteCandidate?.let { entry ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            icon = {
                androidx.compose.material3.Icon(
                    imageVector = Icons.Outlined.Delete,
                    contentDescription = null,
                )
            },
            title = { Text("Move entry to recycle bin?") },
            text = {
                Text(entry.title.ifBlank { "This teaching entry can be restored later." })
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        deleteCandidate = null
                        onDeleteEntry(entry)
                    },
                ) {
                    Text("Move to bin")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteCandidate = null }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun HistoryFilterCard(
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
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "HISTORY FILTERS",
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
                    TextButton(onClick = onClear) {
                        Text("Clear")
                    }
                }
            }

            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search history") },
                singleLine = true,
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Outlined.Search,
                        contentDescription = null,
                    )
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
                items(HistoryStatusFilters, key = HistoryStatusFilter::value) { filter ->
                    HistoryStatusChip(
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
private fun HistoryStatusChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .size(width = 112.dp, height = 42.dp)
            .clickable(onClick = onClick),
        color = if (selected) colors.forest else colors.surfaceAlt,
        contentColor = if (selected) Color.White else colors.textSecondary,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = if (selected) colors.forest else MaterialTheme.colorScheme.outline,
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

private data class HistoryStatusFilter(
    val value: String,
    val label: String,
)

private const val AllStatusFilter = ""

private val HistoryStatusFilters = listOf(
    HistoryStatusFilter(AllStatusFilter, "All"),
    HistoryStatusFilter(TeacherEntryStatus.Started.storageValue, TeacherEntryStatus.Started.label),
    HistoryStatusFilter(TeacherEntryStatus.InProgress.storageValue, TeacherEntryStatus.InProgress.label),
    HistoryStatusFilter(TeacherEntryStatus.Completed.storageValue, TeacherEntryStatus.Completed.label),
    HistoryStatusFilter(TeacherEntryStatus.Doubts.storageValue, TeacherEntryStatus.Doubts.label),
)
