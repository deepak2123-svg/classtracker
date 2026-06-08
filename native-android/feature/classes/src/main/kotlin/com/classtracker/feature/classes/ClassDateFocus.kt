package com.classtracker.feature.classes

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherEntry
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
internal fun DateStripCard(
    dates: List<String>,
    selectedDate: String,
    entryCounts: Map<String, Int>,
    onDateSelected: (String) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 2.dp,
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "DATE FOCUS",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
                modifier = Modifier.padding(horizontal = 14.dp),
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(dates, key = { it }) { dateKey ->
                    DateChip(
                        dateKey = dateKey,
                        count = entryCounts[dateKey] ?: 0,
                        selected = dateKey == selectedDate,
                        onClick = { onDateSelected(dateKey) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DateChip(
    dateKey: String,
    count: Int,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val today = dateKey == todayKey()
    val containerColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.surface,
        label = "date-chip-container",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
        label = "date-chip-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.outline,
        label = "date-chip-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.04f else 1f,
        animationSpec = spring(stiffness = 460f, dampingRatio = 0.8f),
        label = "date-chip-scale",
    )
    Surface(
        modifier = Modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(onClick = onClick),
        color = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = borderColor,
        ),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = if (today) "Today" else shortDateLabel(dateKey),
                style = MaterialTheme.typography.labelMedium,
            )
            Text(
                text = "$count ${if (count == 1) "entry" else "entries"}",
                style = MaterialTheme.typography.bodySmall,
                color = if (selected) Color.White.copy(alpha = 0.78f) else colors.textMuted,
            )
        }
    }
}

@Composable
internal fun DateFocusCard(
    selectedDate: String,
    entryCount: Int,
    canAdd: Boolean,
    onAddEntry: () -> Unit,
) {
    val actionColor by animateColorAsState(
        targetValue = if (canAdd) colors.teal else colors.surfaceAlt,
        label = "date-focus-action",
    )
    val actionContent by animateColorAsState(
        targetValue = if (canAdd) Color.White else colors.textSubtle,
        label = "date-focus-action-content",
    )
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = "DATE FOCUS",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textSubtle,
                )
                Text(
                    text = displayDateLabel(selectedDate),
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    text = "$entryCount ${if (entryCount == 1) "entry" else "entries"}",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (entryCount > 0) colors.teal else colors.textMuted,
                )
            }
            Surface(
                modifier = Modifier.clickable(enabled = canAdd, onClick = onAddEntry),
                color = actionColor,
                contentColor = actionContent,
                shape = RoundedCornerShape(12.dp),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Add,
                        contentDescription = null,
                    )
                    Text(
                        text = "Add Entry",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
    }
}

internal fun buildFocusDateKeys(
    entries: List<TeacherEntry>,
    todayKey: String,
): List<String> {
    val windowKeys = buildDateWindow(todayKey)
    val entryKeys = entries.map(TeacherEntry::dateKey)
    return (windowKeys + entryKeys)
        .distinct()
        .sortedDescending()
}

private fun buildDateWindow(todayKey: String): List<String> {
    val calendar = parseDate(todayKey) ?: Calendar.getInstance()
    return List(8) {
        val key = dateKey(calendar.time)
        calendar.add(Calendar.DAY_OF_YEAR, -1)
        key
    }
}

private fun displayDateLabel(dateKey: String): String {
    if (dateKey == todayKey()) return "Today"
    val parsed = parseDate(dateKey) ?: return dateKey
    return SimpleDateFormat("EEEE, d MMMM", Locale.US).format(parsed.time)
}

private fun shortDateLabel(dateKey: String): String {
    val parsed = parseDate(dateKey) ?: return dateKey
    return SimpleDateFormat("d MMM", Locale.US).format(parsed.time)
}

internal fun todayKey(): String =
    dateKey(Date())

private fun dateKey(date: Date): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

private fun parseDate(value: String): Calendar? {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val parsed = runCatching { formatter.parse(value) }.getOrNull() ?: return null
    return Calendar.getInstance().apply { time = parsed }
}
