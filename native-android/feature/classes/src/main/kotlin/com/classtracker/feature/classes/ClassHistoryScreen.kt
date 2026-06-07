package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.isTeacherEntryDateWithinWindow

@Composable
fun ClassHistoryScreen(
    teacherClass: TeacherClass,
    entries: List<TeacherEntry>,
    createEnabled: Boolean = false,
    editEnabled: Boolean = false,
    onAddEntry: () -> Unit = {},
    onEditEntry: (TeacherEntry) -> Unit = {},
    modifier: Modifier = Modifier,
) {
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
            LedgrClassCard(
                sectionName = teacherClass.sectionName,
                instituteName = teacherClass.instituteName,
                subjectName = teacherClass.subjectName,
                detail = "${entries.size} ${if (entries.size == 1) "entry" else "entries"} in history",
            )
        }

        if (createEnabled) {
            item {
                Button(
                    onClick = onAddEntry,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Add,
                        contentDescription = null,
                    )
                    Text(
                        text = "Add teaching entry",
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }

        item {
            LedgrSectionHeading(
                title = "Teaching history",
                supportingText = "Oldest entries first",
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        if (entries.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No entries yet",
                    message = "Teaching entries for this class will appear here.",
                    icon = Icons.Outlined.History,
                )
            }
        } else {
            items(
                items = entries,
                key = TeacherEntry::id,
            ) { entry ->
                EntryCard(
                    entry = entry,
                    editEnabled = editEnabled &&
                        isTeacherEntryDateWithinWindow(entry.dateKey),
                    onEdit = { onEditEntry(entry) },
                )
            }
        }
    }
}

@Composable
private fun EntryCard(
    entry: TeacherEntry,
    editEnabled: Boolean,
    onEdit: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = formatDateKey(entry.dateKey),
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.teal,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = formatTime(entry.timeStart, entry.timeEnd),
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.textMuted,
                    )
                    if (editEnabled) {
                        IconButton(onClick = onEdit) {
                            Icon(
                                imageVector = Icons.Outlined.Edit,
                                contentDescription = "Edit entry",
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = entry.title.ifBlank { "Teaching entry" },
                    style = MaterialTheme.typography.titleMedium,
                )
                if (entry.body.isNotBlank()) {
                    Text(
                        text = entry.body,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                    )
                }
            }
        }
    }
}

private fun formatDateKey(dateKey: String): String {
    val parts = dateKey.split("-")
    if (parts.size != 3) return dateKey
    return "${parts[2]}/${parts[1]}/${parts[0]}"
}

private fun formatTime(start: String?, end: String?): String = when {
    !start.isNullOrBlank() && !end.isNullOrBlank() -> "$start - $end"
    !start.isNullOrBlank() -> start
    else -> "No time"
}
