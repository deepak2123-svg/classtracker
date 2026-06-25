package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.RestoreFromTrash
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherTrashedEntry

@Composable
internal fun EntryCard(
    entry: TeacherEntry,
    showDate: Boolean,
    editEnabled: Boolean,
    duplicateEnabled: Boolean,
    deleteEnabled: Boolean,
    onEdit: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 1.dp,
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
                    if (duplicateEnabled) {
                        IconButton(
                            onClick = onDuplicate,
                            modifier = Modifier.size(38.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.ContentCopy,
                                contentDescription = "Duplicate entry",
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    if (editEnabled) {
                        IconButton(
                            onClick = onEdit,
                            modifier = Modifier.size(38.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Edit,
                                contentDescription = "Edit entry",
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    if (deleteEnabled) {
                        IconButton(
                            onClick = onDelete,
                            modifier = Modifier.size(38.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Delete,
                                contentDescription = "Delete entry",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (!showDate) {
                    EntryMetaRow(entry)
                }
                Text(
                    text = entry.title.ifBlank { "Teaching entry" },
                    style = MaterialTheme.typography.titleMedium,
                )
                if (entry.syncState != TeacherEntrySyncState.Synced) {
                    Text(
                        text = when (entry.syncState) {
                            TeacherEntrySyncState.Pending -> "Saved on this device"
                            TeacherEntrySyncState.Syncing -> "Syncing"
                            TeacherEntrySyncState.Failed -> "Sync needs attention"
                            TeacherEntrySyncState.Synced -> ""
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = when (entry.syncState) {
                            TeacherEntrySyncState.Failed -> MaterialTheme.colorScheme.error
                            else -> MaterialTheme.colorScheme.primary
                        },
                    )
                }
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

@Composable
internal fun TrashedEntryCard(
    entry: TeacherTrashedEntry,
    restoreEnabled: Boolean,
    onRestore: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 1.dp,
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
                    color = colors.textSecondary,
                )
                IconButton(
                    onClick = onRestore,
                    enabled = restoreEnabled,
                    modifier = Modifier.size(38.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.RestoreFromTrash,
                        contentDescription = "Restore entry",
                        tint = if (restoreEnabled) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            colors.textMuted
                        },
                    )
                }
            }
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (!entry.timeStart.isNullOrBlank()) {
                        LedgrPill(
                            text = formatTime(entry.timeStart, entry.timeEnd),
                            containerColor = colors.surfaceAlt,
                            contentColor = colors.textSecondary,
                            leadingColor = colors.textMuted,
                        )
                    }
                    if (entry.syncState != TeacherEntrySyncState.Synced) {
                        StatusPill(
                            when (entry.syncState) {
                                TeacherEntrySyncState.Pending -> "pending"
                                TeacherEntrySyncState.Syncing -> "syncing"
                                TeacherEntrySyncState.Failed -> "failed"
                                TeacherEntrySyncState.Synced -> ""
                            },
                        )
                    }
                }
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

@Composable
private fun EntryMetaRow(entry: TeacherEntry) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (!entry.timeStart.isNullOrBlank()) {
            LedgrPill(
                text = formatTime(entry.timeStart, entry.timeEnd),
                containerColor = colors.surfaceAlt,
                contentColor = colors.textSecondary,
                leadingColor = colors.textMuted,
            )
        }
        if (entry.status.isNotBlank()) {
            StatusPill(entry.status)
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val tone = when (status) {
        "started" -> StatusTone(colors.chipSurface, colors.blue, "Started")
        "inprogress" -> StatusTone(colors.warningSurface, colors.warningText, "In Progress")
        "completed" -> StatusTone(colors.successSurface, colors.successStrong, "Completed")
        "doubts" -> StatusTone(colors.errorSurface, colors.red, "Doubts")
        else -> StatusTone(colors.surfaceAlt, colors.textSecondary, status)
    }
    Surface(
        color = tone.background,
        contentColor = tone.content,
        shape = RoundedCornerShape(10.dp),
    ) {
        Text(
            text = tone.label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

private data class StatusTone(
    val background: Color,
    val content: Color,
    val label: String,
)

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
