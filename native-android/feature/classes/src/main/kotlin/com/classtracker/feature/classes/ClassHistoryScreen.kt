package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry

@Composable
fun ClassHistoryScreen(
    teacherClass: TeacherClass,
    entries: List<TeacherEntry>,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 20.dp,
            top = 22.dp,
            end = 20.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            LedgrSectionHeading(
                title = teacherClass.sectionName,
                supportingText = buildString {
                    append(teacherClass.instituteName)
                    if (teacherClass.subjectName.isNotBlank()) {
                        append(" | ")
                        append(teacherClass.subjectName)
                    }
                },
                modifier = Modifier.padding(bottom = 8.dp),
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
                EntryCard(entry = entry)
            }
        }
    }
}

@Composable
private fun EntryCard(entry: TeacherEntry) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = formatDateKey(entry.dateKey),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = formatTime(entry.timeStart, entry.timeEnd),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = entry.title.ifBlank { "Teaching entry" },
                style = MaterialTheme.typography.titleMedium,
            )
            if (entry.body.isNotBlank()) {
                Text(
                    text = entry.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
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
