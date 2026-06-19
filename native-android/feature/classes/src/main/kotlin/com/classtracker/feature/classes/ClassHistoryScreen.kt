package com.classtracker.feature.classes

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.filterTeacherEntries
import com.classtracker.core.model.isTeacherEntryDateWithinWindow
import com.classtracker.core.model.sortTeacherEntriesNewestFirst
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

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
    val haptics = rememberLedgrHaptics()
    val todayKey = remember { todayKey() }
    var deleteCandidate by remember { mutableStateOf<TeacherEntry?>(null) }
    var historyQuery by rememberSaveable(teacherClass.id, "history-query") {
        mutableStateOf("")
    }
    var selectedStatusFilter by rememberSaveable(teacherClass.id, "history-status") {
        mutableStateOf(AllStatusFilter)
    }
    var selectedDateKey by rememberSaveable(teacherClass.id, "history-date") {
        mutableStateOf(entries.maxByOrNull(TeacherEntry::dateKey)?.dateKey ?: todayKey)
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
    val historyEntryCounts = remember(entries) {
        entries.groupingBy(TeacherEntry::dateKey).eachCount()
    }
    val selectedDateEntries = remember(filteredHistoryEntries, selectedDateKey) {
        filteredHistoryEntries.filter { it.dateKey == selectedDateKey }
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
    val selectedDateLabel = remember(selectedDateKey) {
        formatHistoryDisplayDate(selectedDateKey)
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(classHistoryCanvasColor()),
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

        if (entries.isNotEmpty()) {
            item(key = "history-filter") {
                HistoryFilterCard(
                    query = historyQuery,
                    selectedStatus = selectedStatusFilter,
                    filteredCount = selectedDateEntries.size,
                    totalCount = entries.size,
                    onQueryChange = { historyQuery = it },
                    onStatusSelected = {
                        haptics.selection()
                        selectedStatusFilter = it
                    },
                    onClear = {
                        haptics.selection()
                        historyQuery = ""
                        selectedStatusFilter = AllStatusFilter
                    },
                )
            }
        }

        item(key = "archive-heading") {
            LedgrSectionHeading(
                title = "Past entries",
                supportingText = if (historyFilterActive || selectedDateKey != todayKey) {
                    "$selectedDateLabel • ${selectedDateEntries.size} shown"
                } else {
                    "Choose a date to view class history"
                },
                modifier = Modifier.padding(top = 6.dp),
            )
        }

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
            item(key = "history-calendar") {
                HistoryDateCalendar(
                    selectedDate = selectedDateKey,
                    entryCounts = historyEntryCounts,
                    onDateSelected = {
                        haptics.selection()
                        selectedDateKey = it
                    },
                )
            }

            item(key = "history-date-summary") {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            text = selectedDateLabel,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = if (selectedDateEntries.isEmpty()) {
                                "No entries for this date"
                            } else {
                                "${selectedDateEntries.size} ${if (selectedDateEntries.size == 1) "entry" else "entries"}"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                }
            }

            if (selectedDateEntries.isEmpty()) {
                item(key = "history-date-empty-$selectedDateKey") {
                    LedgrEmptyState(
                        title = "Nothing on this day",
                        message = "Pick another date from the calendar to see past entries.",
                        icon = Icons.Outlined.History,
                    )
                }
            } else {
                items(
                    items = selectedDateEntries,
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
                        onEdit = { onEditEntry(entry) },
                        onDuplicate = { onDuplicateEntry(entry) },
                        onDelete = {
                            haptics.warning()
                            deleteCandidate = entry
                        },
                    )
                }
            }
        }

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

    deleteCandidate?.let { entry ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            icon = {
                Icon(
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
                        haptics.warning()
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
private fun HistoryDateCalendar(
    selectedDate: String,
    entryCounts: Map<String, Int>,
    onDateSelected: (String) -> Unit,
) {
    val selectedCalendar = remember(selectedDate) {
        parseHistoryDate(selectedDate) ?: Calendar.getInstance()
    }
    var viewYear by remember(selectedDate) {
        mutableIntStateOf(selectedCalendar.get(Calendar.YEAR))
    }
    var viewMonth by remember(selectedDate) {
        mutableIntStateOf(selectedCalendar.get(Calendar.MONTH))
    }
    val todayKey = remember { historyDateKey(Calendar.getInstance().time) }
    val cells = remember(viewYear, viewMonth, selectedDate, todayKey, entryCounts) {
        buildHistoryMonthCells(
            viewYear = viewYear,
            viewMonth = viewMonth,
            selectedDate = selectedDate,
            todayKey = todayKey,
            entryCounts = entryCounts,
        )
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HistoryCalendarNavButton(
                    icon = Icons.Outlined.ChevronLeft,
                    onClick = {
                        val next = Calendar.getInstance().apply {
                            set(Calendar.YEAR, viewYear)
                            set(Calendar.MONTH, viewMonth)
                            set(Calendar.DAY_OF_MONTH, 1)
                            add(Calendar.MONTH, -1)
                        }
                        viewYear = next.get(Calendar.YEAR)
                        viewMonth = next.get(Calendar.MONTH)
                    },
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CalendarMonth,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = historyMonthTitle(viewYear, viewMonth),
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontSize = 17.sp,
                                lineHeight = 20.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onSurface,
                            ),
                        )
                    }
                    Text(
                        text = formatHistoryDisplayDate(selectedDate),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        color = colors.textMuted,
                    )
                }
                HistoryCalendarNavButton(
                    icon = Icons.Outlined.ChevronRight,
                    onClick = {
                        val next = Calendar.getInstance().apply {
                            set(Calendar.YEAR, viewYear)
                            set(Calendar.MONTH, viewMonth)
                            set(Calendar.DAY_OF_MONTH, 1)
                            add(Calendar.MONTH, 1)
                        }
                        viewYear = next.get(Calendar.YEAR)
                        viewMonth = next.get(Calendar.MONTH)
                    },
                )
            }

            HistoryCalendarWeekLabels()

            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                cells.chunked(7).forEach { week ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        week.forEach { cell ->
                            HistoryCalendarDayCell(
                                cell = cell,
                                onClick = { onDateSelected(cell.key) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryCalendarNavButton(
    icon: ImageVector,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick),
        color = if (LedgrTheme.isDark) {
            MaterialTheme.colorScheme.surfaceVariant
        } else {
            Color(0xFFEAF4FF)
        },
        contentColor = MaterialTheme.colorScheme.onSurface,
        shape = CircleShape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun HistoryCalendarWeekLabels() {
    val days = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        days.forEach { day ->
            Text(
                text = day,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.labelLarge.copy(fontSize = 11.sp),
                color = colors.textMuted,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun HistoryCalendarDayCell(
    cell: HistoryCalendarCell,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val background by animateColorAsState(
        targetValue = if (cell.selected) colors.forest else Color.Transparent,
        label = "history-calendar-day-bg",
    )
    val contentColor by animateColorAsState(
        targetValue = when {
            cell.selected -> Color.White
            cell.sunday -> Color(0xFFEF4444)
            cell.canSelect || cell.entryCount > 0 -> MaterialTheme.colorScheme.onSurface
            else -> colors.textSubtle
        },
        label = "history-calendar-day-content",
    )
    val scale by animateFloatAsState(
        targetValue = if (cell.selected) 1.04f else 1f,
        animationSpec = spring(stiffness = 450f, dampingRatio = 0.78f),
        label = "history-calendar-day-scale",
    )
    val dotSize by animateDpAsState(
        targetValue = if (cell.entryCount > 0) 4.dp else 0.dp,
        label = "history-calendar-dot-size",
    )
    Surface(
        modifier = modifier
            .height(38.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(enabled = cell.canSelect, onClick = onClick),
        color = Color.Transparent,
        contentColor = contentColor,
    ) {
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .size(if (cell.selected) 32.dp else 30.dp)
                    .background(background, CircleShape),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = cell.day.toString(),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 14.sp,
                        lineHeight = 16.sp,
                    ),
                    fontWeight = FontWeight.Bold,
                    color = contentColor.copy(
                        alpha = when {
                            cell.otherMonth -> 0.35f
                            cell.canSelect || cell.selected -> 1f
                            else -> 0.55f
                        },
                    ),
                )
                Box(
                    modifier = Modifier
                        .size(dotSize)
                        .background(colors.green, CircleShape),
                )
            }
        }
    }
}

private data class HistoryCalendarCell(
    val key: String,
    val day: Int,
    val otherMonth: Boolean,
    val selected: Boolean,
    val canSelect: Boolean,
    val sunday: Boolean,
    val entryCount: Int,
)

private fun buildHistoryMonthCells(
    viewYear: Int,
    viewMonth: Int,
    selectedDate: String,
    todayKey: String,
    entryCounts: Map<String, Int>,
): List<HistoryCalendarCell> {
    val firstDay = Calendar.getInstance().apply {
        set(Calendar.YEAR, viewYear)
        set(Calendar.MONTH, viewMonth)
        set(Calendar.DAY_OF_MONTH, 1)
    }.get(Calendar.DAY_OF_WEEK) - 1
    val daysInMonth = Calendar.getInstance().apply {
        set(Calendar.YEAR, viewYear)
        set(Calendar.MONTH, viewMonth + 1)
        set(Calendar.DAY_OF_MONTH, 0)
    }.get(Calendar.DAY_OF_MONTH)
    val totalCells = ((firstDay + daysInMonth + 6) / 7) * 7

    return List(totalCells) { index ->
        val date = Calendar.getInstance().apply {
            set(Calendar.YEAR, viewYear)
            set(Calendar.MONTH, viewMonth)
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.DAY_OF_MONTH, index - firstDay)
        }
        val key = historyDateKey(date.time)
        val otherMonth = date.get(Calendar.MONTH) != viewMonth
        HistoryCalendarCell(
            key = key,
            day = date.get(Calendar.DAY_OF_MONTH),
            otherMonth = otherMonth,
            selected = key == selectedDate,
            canSelect = !otherMonth && key <= todayKey,
            sunday = date.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY,
            entryCount = entryCounts[key] ?: 0,
        )
    }
}

private fun historyMonthTitle(year: Int, month: Int): String =
    SimpleDateFormat("MMMM yyyy", Locale.US).format(
        Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month)
            set(Calendar.DAY_OF_MONTH, 1)
        }.time,
    )

private fun formatHistoryDisplayDate(dateKey: String): String {
    val source = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val target = SimpleDateFormat("EEE, d MMM yyyy", Locale.US)
    return runCatching { target.format(requireNotNull(source.parse(dateKey))) }
        .getOrDefault(dateKey)
}

@Composable
private fun ArchiveFilterSection(
    title: String,
    supportingText: String,
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (LedgrTheme.isDark) {
            MaterialTheme.colorScheme.surfaceVariant
        } else {
            MaterialTheme.colorScheme.surface
        },
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = supportingText,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            content()
        }
    }
}

@Composable
private fun ArchivePill(
    title: String,
    supportingText: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val containerColor by animateColorAsState(
        targetValue = if (selected) colors.teal.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface,
        label = "archive-pill-container",
    )
    val titleColor by animateColorAsState(
        targetValue = if (selected) colors.teal else MaterialTheme.colorScheme.onSurface,
        label = "archive-pill-title",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) colors.teal.copy(alpha = 0.7f) else MaterialTheme.colorScheme.outline,
        label = "archive-pill-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.02f else 1f,
        animationSpec = spring(stiffness = 460f, dampingRatio = 0.82f),
        label = "archive-pill-scale",
    )
    Surface(
        modifier = Modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(onClick = onClick),
        color = containerColor,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = if (selected) 2.dp else 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.ExtraBold,
                color = titleColor,
            )
            Text(
                text = supportingText,
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun HistoryCollapsedHint(
    title: String,
    message: String,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun WeekArchiveBlock(
    week: HistoryWeekGroup,
    editEnabled: Boolean,
    duplicateEnabled: Boolean,
    deleteEnabled: Boolean,
    onEditEntry: (TeacherEntry) -> Unit,
    onDuplicateEntry: (TeacherEntry) -> Unit,
    onDeleteEntry: (TeacherEntry) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Surface(
            color = Color.Transparent,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.45f)),
            shape = RoundedCornerShape(14.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = week.title,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "${week.entries.size} ${if (week.entries.size == 1) "entry" else "entries"}",
                    style = MaterialTheme.typography.labelMedium,
                    color = colors.textMuted,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            week.entries.forEach { entry ->
                val canMutateEntry = isTeacherEntryDateWithinWindow(entry.dateKey) &&
                    entry.syncState != TeacherEntrySyncState.Syncing
                EntryCard(
                    entry = entry,
                    showDate = true,
                    editEnabled = editEnabled && canMutateEntry,
                    duplicateEnabled = duplicateEnabled && canMutateEntry,
                    deleteEnabled = deleteEnabled &&
                        entry.syncState == TeacherEntrySyncState.Synced,
                    onEdit = { onEditEntry(entry) },
                    onDuplicate = { onDuplicateEntry(entry) },
                    onDelete = { onDeleteEntry(entry) },
                )
            }
        }
    }
}

private data class HistoryMonthGroup(
    val key: String,
    val title: String,
    val supportingText: String,
    val weeks: List<HistoryWeekGroup>,
)

private data class HistoryWeekGroup(
    val key: String,
    val title: String,
    val entries: List<TeacherEntry>,
)

private fun buildHistoryArchive(
    entries: List<TeacherEntry>,
): List<HistoryMonthGroup> {
    if (entries.isEmpty()) return emptyList()

    val monthBuckets = linkedMapOf<String, MutableList<TeacherEntry>>()
    entries.forEach { entry ->
        val monthKey = parseHistoryDate(entry.dateKey)?.let(::monthKeyFor) ?: "unknown"
        monthBuckets.getOrPut(monthKey) { mutableListOf() }.add(entry)
    }

    return monthBuckets.map { (monthKey, monthEntries) ->
        val weeks = buildWeekGroups(monthEntries)
        val monthTitle = parseHistoryDate(monthEntries.first().dateKey)?.let(::monthTitleFor)
            ?: "Older entries"
        HistoryMonthGroup(
            key = monthKey,
            title = monthTitle,
            supportingText = buildMonthSupportingText(
                entryCount = monthEntries.size,
                weekCount = weeks.size,
            ),
            weeks = weeks,
        )
    }
}

private fun buildWeekGroups(
    entries: List<TeacherEntry>,
): List<HistoryWeekGroup> {
    val weekBuckets = linkedMapOf<String, MutableList<TeacherEntry>>()
    entries.forEach { entry ->
        val parsed = parseHistoryDate(entry.dateKey)
        val weekStart = parsed?.let(::startOfWeek)
        val weekKey = weekStart?.let { historyDateKey(it.time) } ?: entry.dateKey
        weekBuckets.getOrPut(weekKey) { mutableListOf() }.add(entry)
    }

    return weekBuckets.map { (weekKey, weekEntries) ->
        val weekStart = parseHistoryDate(weekKey)
        HistoryWeekGroup(
            key = weekKey,
            title = weekStart?.let(::weekTitleFor) ?: "Unsorted",
            entries = weekEntries,
        )
    }
}

private fun buildMonthSupportingText(
    entryCount: Int,
    weekCount: Int,
): String {
    val entryLabel = if (entryCount == 1) "entry" else "entries"
    val weekLabel = if (weekCount == 1) "week" else "weeks"
    return "$entryCount $entryLabel across $weekCount $weekLabel"
}

private fun monthKeyFor(calendar: Calendar): String =
    SimpleDateFormat("yyyy-MM", Locale.US).format(calendar.time)

private fun monthTitleFor(calendar: Calendar): String =
    SimpleDateFormat("MMMM yyyy", Locale.US).format(calendar.time)

private fun weekTitleFor(weekStart: Calendar): String {
    val start = weekStart.clone() as Calendar
    val end = weekStart.clone() as Calendar
    end.add(Calendar.DAY_OF_YEAR, 6)

    val sameMonth = start.get(Calendar.MONTH) == end.get(Calendar.MONTH) &&
        start.get(Calendar.YEAR) == end.get(Calendar.YEAR)
    val formatter = if (sameMonth) {
        SimpleDateFormat("d", Locale.US)
    } else {
        SimpleDateFormat("d MMM", Locale.US)
    }
    val startLabel = SimpleDateFormat("d MMM", Locale.US).format(start.time)
    val endLabel = if (sameMonth) {
        "${formatter.format(end.time)} ${SimpleDateFormat("MMM", Locale.US).format(end.time)}"
    } else {
        SimpleDateFormat("d MMM", Locale.US).format(end.time)
    }
    return "Week $startLabel - $endLabel"
}

private fun startOfWeek(calendar: Calendar): Calendar =
    (calendar.clone() as Calendar).apply {
        firstDayOfWeek = Calendar.MONDAY
        set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
    }

private fun parseHistoryDate(value: String): Calendar? {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val parsed = runCatching { formatter.parse(value) }.getOrNull() ?: return null
    return Calendar.getInstance().apply { time = parsed }
}

private fun historyDateKey(date: Date): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

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
    val containerColor by animateColorAsState(
        targetValue = if (selected) colors.forest else colors.surfaceAlt,
        label = "history-chip-container",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) Color.White else colors.textSecondary,
        label = "history-chip-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.outline,
        label = "history-chip-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.03f else 1f,
        animationSpec = spring(stiffness = 460f, dampingRatio = 0.82f),
        label = "history-chip-scale",
    )
    Surface(
        modifier = Modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
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

@Composable
private fun classHistoryCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else Color(0xFFEAF4FF)
