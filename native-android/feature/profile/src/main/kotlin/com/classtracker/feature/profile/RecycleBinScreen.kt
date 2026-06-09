package com.classtracker.feature.profile

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.RestoreFromTrash
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherTrashedEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Global recycle bin screen — shows all trashed entries across all classes,
 * grouped by class name, sorted by deletion date newest first.
 */
@Composable
fun RecycleBinScreen(
    trashedEntries: List<TeacherTrashedEntry>,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (trashedEntries.isEmpty()) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            LedgrEmptyState(
                title = "Recycle bin is empty",
                message = "Deleted entries from all your classes will appear here. You can restore them anytime.",
                icon = Icons.Outlined.DeleteForever,
            )
        }
        return
    }

    // Group by className + instituteName, sorted by most recently deleted first
    val grouped = remember(trashedEntries) {
        trashedEntries
            .sortedByDescending { it.deletedAt }
            .groupBy { "${it.className}|${it.instituteName}" }
            .entries
            .toList()
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 36.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "bin-summary") {
            BinSummaryBanner(count = trashedEntries.size)
        }

        grouped.forEach { (groupKey, groupEntries) ->
            val parts = groupKey.split("|")
            val className = parts.getOrElse(0) { "Unknown class" }
            val instituteName = parts.getOrElse(1) { "" }

            item(key = "header-$groupKey") {
                Column(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    if (instituteName.isNotBlank()) {
                        Text(
                            text = instituteName,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = androidx.compose.material3.MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                        )
                    }
                    Text(
                        text = className,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = androidx.compose.material3.MaterialTheme.colorScheme.onSurface,
                    )
                }
            }

            items(
                items = groupEntries,
                key = { "trash-${it.id}" },
            ) { entry ->
                TrashedEntryCard(
                    entry = entry,
                    onRestore = { onRestoreEntry(entry) },
                )
            }
        }
    }
}

// ── Summary banner ────────────────────────────────────────────────────────────

@Composable
private fun BinSummaryBanner(count: Int) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.warningSurface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, colors.textMuted.copy(alpha = 0.18f)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.DeleteForever,
                contentDescription = null,
                tint = colors.textSecondary,
                modifier = Modifier.size(24.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$count deleted ${if (count == 1) "entry" else "entries"}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "Restore entries to move them back to their class.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

// ── Trashed entry card ────────────────────────────────────────────────────────

@Composable
fun TrashedEntryCard(
    entry: TeacherTrashedEntry,
    onRestore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val restoring = entry.syncState == TeacherEntrySyncState.Syncing
    val failed = entry.syncState == TeacherEntrySyncState.Failed

    val borderColor by animateColorAsState(
        targetValue = when {
            failed -> colors.red.copy(alpha = 0.45f)
            restoring -> colors.teal.copy(alpha = 0.45f)
            else -> MaterialTheme.colorScheme.outline
        },
        label = "trash-card-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (restoring) 0.98f else 1f,
        animationSpec = spring(stiffness = 380f, dampingRatio = 0.78f),
        label = "trash-card-scale",
    )

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale },
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Title + status row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = entry.title.ifBlank { "Untitled entry" },
                        style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp),
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (entry.body.isNotBlank()) {
                        Text(
                            text = entry.body,
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                            maxLines = 2,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                    }
                }
                if (entry.status.isNotBlank()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusPill(status = entry.status)
                }
            }

            // Date + time row
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MetaChip(label = formatDateKey(entry.dateKey))
                if (!entry.timeStart.isNullOrBlank()) {
                    MetaChip(
                        label = listOfNotNull(entry.timeStart, entry.timeEnd)
                            .joinToString(" – "),
                    )
                }
                MetaChip(
                    label = "Deleted ${formatDeletedAt(entry.deletedAt)}",
                    muted = true,
                )
            }

            // Restore button
            Button(
                onClick = onRestore,
                enabled = !restoring,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.forest,
                    contentColor = androidx.compose.ui.graphics.Color.White,
                ),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
            ) {
                if (restoring) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = androidx.compose.ui.graphics.Color.White,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.RestoreFromTrash,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (failed) "Retry restore" else "Restore entry",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            if (failed) {
                Text(
                    text = "Restore failed. Tap to retry.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.red,
                )
            }
        }
    }
}

// ── Sub-composables ───────────────────────────────────────────────────────────

@Composable
private fun StatusPill(status: String) {
    val label = TeacherEntryStatus.entries
        .firstOrNull { it.storageValue == status }?.label ?: status
    Surface(
        color = colors.surfaceAlt,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = colors.textSecondary,
        )
    }
}

@Composable
private fun MetaChip(label: String, muted: Boolean = false) {
    Surface(
        color = colors.surfaceAlt,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = if (muted) colors.textSubtle else colors.textSecondary,
        )
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun formatDateKey(dateKey: String): String = runCatching {
    val input = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val output = SimpleDateFormat("d MMM yyyy", Locale.US)
    output.format(input.parse(dateKey)!!)
}.getOrElse { dateKey }

private fun formatDeletedAt(millis: Long): String = runCatching {
    val output = SimpleDateFormat("d MMM", Locale.US)
    output.format(Date(millis))
}.getOrElse { "" }
