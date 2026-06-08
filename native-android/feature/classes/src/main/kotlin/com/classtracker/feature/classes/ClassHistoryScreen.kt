package com.classtracker.feature.classes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.isTeacherEntryDateWithinWindow

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
    val dateCounts = remember(entries) { entries.groupingBy(TeacherEntry::dateKey).eachCount() }
    val focusDates = remember(entries, todayKey) { buildFocusDateKeys(entries, todayKey) }
    val focusedEntries = remember(entries, selectedDate) {
        entries.filter { it.dateKey == selectedDate }
            .sortedWith(compareBy<TeacherEntry> { it.timeStart.orEmpty() }.thenBy { it.createdAt })
    }
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
        item {
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

        item {
            LedgrSectionHeading(
                title = "All history",
                supportingText = "Oldest entries first",
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
        } else {
            items(
                items = entries,
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
