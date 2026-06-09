package com.classtracker.feature.entries

import android.app.TimePickerDialog
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherEntryValidation
import com.classtracker.core.model.validateTeacherEntryDraft
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun EntryEditorScreen(
    teacherClass: TeacherClass,
    draft: TeacherEntryDraft,
    existingEntries: List<TeacherEntry>,
    saving: Boolean,
    recoveredDraft: Boolean,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSave: (TeacherEntryDraft) -> Unit,
    modifier: Modifier = Modifier,
    showClassHeader: Boolean = true,
) {
    val validation = remember(draft, existingEntries) {
        validateTeacherEntryDraft(draft, existingEntries)
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 36.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (showClassHeader) {
            item {
                LedgrClassCard(
                    sectionName = teacherClass.sectionName,
                    instituteName = teacherClass.instituteName,
                    subjectName = teacherClass.subjectName,
                    detail = if (draft.entryId == null) {
                        "Add a teaching entry"
                    } else {
                        "Editing teaching entry"
                    },
                )
            }
        }

        if (recoveredDraft) {
            item {
                Surface(
                    color = LedgrTheme.colors.successSurface,
                    contentColor = LedgrTheme.colors.green,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(
                        width = 1.dp,
                        color = LedgrTheme.colors.green.copy(alpha = 0.35f),
                    ),
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
        }

        if (showClassHeader) {
            item {
                LedgrSectionHeading(
                    title = if (draft.entryId == null) "New entry" else "Entry details",
                    supportingText = "Saved entries remain compatible with the teacher web app.",
                )
            }
        }

        item {
            ScheduleCard(
                draft = draft,
                existingEntries = existingEntries,
                onDraftChanged = onDraftChanged,
            )
        }

        if (draft.timeStart.isNotBlank()) {
            item {
                DurationCard(
                    draft = draft,
                    onDraftChanged = onDraftChanged,
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "STATUS",
                    style = MaterialTheme.typography.labelLarge,
                    color = LedgrTheme.colors.textMuted,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TeacherEntryStatus.entries.take(2).forEach { status ->
                        StatusChip(
                            status = status,
                            selected = draft.status == status.storageValue,
                            onClick = {
                                onDraftChanged(
                                    draft.copy(
                                        status = if (draft.status == status.storageValue) {
                                            ""
                                        } else {
                                            status.storageValue
                                        },
                                    ),
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TeacherEntryStatus.entries.drop(2).forEach { status ->
                        StatusChip(
                            status = status,
                            selected = draft.status == status.storageValue,
                            onClick = {
                                onDraftChanged(
                                    draft.copy(
                                        status = if (draft.status == status.storageValue) {
                                            ""
                                        } else {
                                            status.storageValue
                                        },
                                    ),
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        item {
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Topic / title") },
                supportingText = { Text("Required") },
                singleLine = true,
            )
        }

        item {
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Notes") },
                minLines = 4,
                maxLines = 8,
            )
        }

        if (validation is TeacherEntryValidation.Invalid) {
            item {
                Text(
                    text = validation.message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        if (validation is TeacherEntryValidation.Overlap) {
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = LedgrTheme.colors.warningSurface,
                    contentColor = LedgrTheme.colors.textSecondary,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        text = validation.message,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = LedgrTheme.colors.textSecondary,
                    )
                }
            }
        }

        item {
            Button(
                onClick = { onSave(draft) },
                enabled = (validation == TeacherEntryValidation.Valid ||
                    validation is TeacherEntryValidation.Overlap) && !saving,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 15.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                if (saving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.Save,
                        contentDescription = null,
                    )
                    Text(
                        text = if (draft.entryId == null) "Save entry" else "Save changes",
                        modifier = Modifier.padding(start = 10.dp),
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun ScheduleCard(
    draft: TeacherEntryDraft,
    existingEntries: List<TeacherEntry>,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
) {
    val context = LocalContext.current

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            EntryDateCalendar(
                selectedDate = draft.dateKey,
                entryCounts = remember(existingEntries) {
                    existingEntries.groupingBy(TeacherEntry::dateKey).eachCount()
                },
                onDateSelected = { dateKey ->
                    onDraftChanged(draft.copy(dateKey = dateKey))
                },
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PickerField(
                    label = "Start",
                    value = formatDisplayTime(draft.timeStart),
                    icon = Icons.Outlined.Schedule,
                    onClick = {
                        showTimePicker(
                            initialValue = draft.timeStart,
                            onSelected = { selectedStart ->
                                onDraftChanged(
                                    draft.copy(
                                        timeStart = selectedStart,
                                        timeEnd = draft.timeEnd.ifBlank {
                                            addMinutes(selectedStart, 60)
                                        },
                                    ),
                                )
                            },
                            context = context,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                PickerField(
                    label = "End",
                    value = formatDisplayTime(draft.timeEnd).ifBlank { "Optional" },
                    icon = Icons.Outlined.Schedule,
                    onClick = {
                        showTimePicker(
                            initialValue = draft.timeEnd.ifBlank { draft.timeStart },
                            onSelected = { onDraftChanged(draft.copy(timeEnd = it)) },
                            context = context,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun EntryDateCalendar(
    selectedDate: String,
    entryCounts: Map<String, Int>,
    onDateSelected: (String) -> Unit,
) {
    val selectedCalendar = remember(selectedDate) {
        parseDateKey(selectedDate) ?: Calendar.getInstance()
    }
    var viewYear by remember(selectedDate) {
        mutableIntStateOf(selectedCalendar.get(Calendar.YEAR))
    }
    var viewMonth by remember(selectedDate) {
        mutableIntStateOf(selectedCalendar.get(Calendar.MONTH))
    }
    val todayKey = remember { dateKey(Calendar.getInstance()) }
    val editableDateKeys = remember(todayKey) { buildEditableDateKeys(todayKey).toSet() }
    val cells = remember(viewYear, viewMonth, selectedDate, todayKey, editableDateKeys, entryCounts) {
        buildMonthCells(
            viewYear = viewYear,
            viewMonth = viewMonth,
            selectedDate = selectedDate,
            todayKey = todayKey,
            editableDateKeys = editableDateKeys,
            entryCounts = entryCounts,
        )
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        color = LedgrTheme.colors.surfaceSoft,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CalendarNavButton(
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
                            tint = LedgrTheme.colors.green,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = monthTitle(viewYear, viewMonth),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        text = formatDisplayDate(selectedDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = LedgrTheme.colors.textMuted,
                    )
                }
                CalendarNavButton(
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

            CalendarWeekLabels()

            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                cells.chunked(7).forEach { week ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        week.forEach { cell ->
                            CalendarDayCell(
                                cell = cell,
                                onClick = {
                                    if (cell.canSelect) {
                                        onDateSelected(cell.key)
                                    }
                                },
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
private fun CalendarNavButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        contentColor = LedgrTheme.colors.textMuted,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(19.dp),
            )
        }
    }
}

@Composable
private fun CalendarWeekLabels() {
    val days = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        days.forEach { day ->
            Text(
                text = day,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.labelSmall,
                color = if (day == "Su") {
                    MaterialTheme.colorScheme.error
                } else {
                    LedgrTheme.colors.textSubtle
                },
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun CalendarDayCell(
    cell: CalendarCell,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val background by animateColorAsState(
        targetValue = when {
            cell.selected || cell.today -> LedgrTheme.colors.forest
            cell.editable -> LedgrTheme.colors.successSurface
            else -> Color.Transparent
        },
        label = "calendar-day-bg",
    )
    val contentColor by animateColorAsState(
        targetValue = when {
            cell.selected || cell.today -> Color.White
            cell.sunday -> MaterialTheme.colorScheme.error
            cell.editable || cell.entryCount > 0 -> MaterialTheme.colorScheme.onSurface
            else -> LedgrTheme.colors.textSubtle
        },
        label = "calendar-day-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (cell.selected) {
            LedgrTheme.colors.green
        } else {
            Color.Transparent
        },
        label = "calendar-day-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (cell.selected) 1.04f else 1f,
        animationSpec = spring(stiffness = 450f, dampingRatio = 0.78f),
        label = "calendar-day-scale",
    )
    val dotSize by animateDpAsState(
        targetValue = if (cell.entryCount > 0) 4.dp else 0.dp,
        label = "calendar-dot-size",
    )
    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(enabled = cell.canSelect, onClick = onClick),
        color = background,
        contentColor = contentColor,
        shape = RoundedCornerShape(9.dp),
        border = BorderStroke(
            width = if (cell.selected) 1.5.dp else 0.dp,
            color = borderColor,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = cell.day.toString(),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (cell.selected || cell.today || cell.editable) {
                    FontWeight.Bold
                } else {
                    FontWeight.Normal
                },
                color = contentColor.copy(
                    alpha = when {
                        cell.otherMonth -> 0.22f
                        cell.canSelect -> 1f
                        else -> 0.42f
                    },
                ),
            )
            Box(
                modifier = Modifier
                    .size(dotSize)
                    .background(
                        color = if (cell.selected || cell.today) {
                            LedgrTheme.colors.green
                        } else {
                            LedgrTheme.colors.teal
                        },
                        shape = CircleShape,
                    ),
            )
        }
    }
}

@Composable
private fun DurationCard(
    draft: TeacherEntryDraft,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
) {
    val options = listOf(45, 60, 75, 90, 105, 120)
    val selectedDuration = durationMinutes(draft.timeStart, draft.timeEnd)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "DURATION",
                style = MaterialTheme.typography.labelLarge,
                color = LedgrTheme.colors.textMuted,
                modifier = Modifier.padding(horizontal = 14.dp),
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(options, key = { it }) { minutes ->
                    DurationChip(
                        minutes = minutes,
                        selected = selectedDuration == minutes,
                        onClick = {
                            onDraftChanged(
                                draft.copy(
                                    timeEnd = addMinutes(draft.timeStart, minutes),
                                ),
                            )
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun DurationChip(
    minutes: Int,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = if (selected) LedgrTheme.colors.forest else Color.Transparent,
        contentColor = if (selected) Color.White else LedgrTheme.colors.textMuted,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.5.dp,
            color = if (selected) LedgrTheme.colors.forest else MaterialTheme.colorScheme.outline,
        ),
    ) {
        Text(
            text = durationLabel(minutes),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp),
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

@Composable
private fun PickerField(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = LedgrTheme.colors.surfaceSoft,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Column {
                Text(
                    text = label.uppercase(Locale.US),
                    style = MaterialTheme.typography.labelSmall,
                    color = LedgrTheme.colors.textMuted,
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun StatusChip(
    status: TeacherEntryStatus,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tone = statusTone(status)
    Surface(
        modifier = modifier
            .clickable(onClick = onClick),
        color = if (selected) tone.background else MaterialTheme.colorScheme.surface,
        contentColor = if (selected) tone.content else LedgrTheme.colors.textMuted,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            width = 1.5.dp,
            color = if (selected) tone.dot else MaterialTheme.colorScheme.outline,
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(
                        color = if (selected) tone.dot else LedgrTheme.colors.textSubtle,
                        shape = CircleShape,
                    ),
            )
            Text(
                text = tone.label,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

private data class CalendarCell(
    val key: String,
    val day: Int,
    val otherMonth: Boolean,
    val selected: Boolean,
    val today: Boolean,
    val editable: Boolean,
    val canSelect: Boolean,
    val sunday: Boolean,
    val entryCount: Int,
)

private fun buildMonthCells(
    viewYear: Int,
    viewMonth: Int,
    selectedDate: String,
    todayKey: String,
    editableDateKeys: Set<String>,
    entryCounts: Map<String, Int>,
): List<CalendarCell> {
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
        val key = dateKey(date)
        val otherMonth = date.get(Calendar.MONTH) != viewMonth
        val editable = !otherMonth && key in editableDateKeys
        val future = key > todayKey
        CalendarCell(
            key = key,
            day = date.get(Calendar.DAY_OF_MONTH),
            otherMonth = otherMonth,
            selected = key == selectedDate,
            today = key == todayKey,
            editable = editable,
            canSelect = editable && !future,
            sunday = date.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY,
            entryCount = entryCounts[key] ?: 0,
        )
    }
}

private fun buildEditableDateKeys(todayKey: String): List<String> {
    val calendar = parseDateKey(todayKey) ?: Calendar.getInstance()
    return List(8) {
        val key = dateKey(calendar)
        calendar.add(Calendar.DAY_OF_YEAR, -1)
        key
    }
}

private fun monthTitle(year: Int, month: Int): String =
    SimpleDateFormat("MMMM yyyy", Locale.US).format(
        Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month)
            set(Calendar.DAY_OF_MONTH, 1)
        }.time,
    )

private fun showTimePicker(
    initialValue: String,
    onSelected: (String) -> Unit,
    context: android.content.Context,
) {
    val initialParts = initialValue.split(":")
    val now = Calendar.getInstance()
    val initialHour = initialParts.getOrNull(0)?.toIntOrNull()
        ?: now.get(Calendar.HOUR_OF_DAY)
    val initialMinute = initialParts.getOrNull(1)?.toIntOrNull()
        ?: now.get(Calendar.MINUTE)
    TimePickerDialog(
        context,
        { _, hour, minute ->
            onSelected("%02d:%02d".format(Locale.US, hour, minute))
        },
        initialHour,
        initialMinute,
        false,
    ).show()
}

private fun parseDateKey(value: String): Calendar? {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val parsed = runCatching { formatter.parse(value) }.getOrNull() ?: return null
    return Calendar.getInstance().apply { time = parsed }
}

private fun dateKey(calendar: Calendar): String =
    "%04d-%02d-%02d".format(
        Locale.US,
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH) + 1,
        calendar.get(Calendar.DAY_OF_MONTH),
    )

private fun formatDisplayDate(dateKey: String): String {
    val source = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val target = SimpleDateFormat("EEE, d MMM yyyy", Locale.US)
    return runCatching { target.format(requireNotNull(source.parse(dateKey))) }
        .getOrDefault(dateKey)
}

private fun formatDisplayTime(value: String): String {
    if (value.isBlank()) return ""
    val source = SimpleDateFormat("HH:mm", Locale.US).apply {
        isLenient = false
    }
    val target = SimpleDateFormat("h:mm a", Locale.US)
    return runCatching { target.format(requireNotNull(source.parse(value))) }
        .getOrDefault(value)
}

private data class StatusTone(
    val background: Color,
    val content: Color,
    val dot: Color,
    val label: String,
)

private fun statusTone(status: TeacherEntryStatus): StatusTone = when (status) {
    TeacherEntryStatus.Started -> StatusTone(
        background = Color(0xFFDBEAFE),
        content = Color(0xFF1D4ED8),
        dot = Color(0xFF3B82F6),
        label = "Started",
    )
    TeacherEntryStatus.InProgress -> StatusTone(
        background = Color(0xFFFEF3C7),
        content = Color(0xFFB45309),
        dot = Color(0xFFF59E0B),
        label = "In Progress",
    )
    TeacherEntryStatus.Completed -> StatusTone(
        background = Color(0xFFD1FAE5),
        content = Color(0xFF065F46),
        dot = Color(0xFF10B981),
        label = "Completed",
    )
    TeacherEntryStatus.Doubts -> StatusTone(
        background = Color(0xFFFFEDD5),
        content = Color(0xFF9A3412),
        dot = Color(0xFFF97316),
        label = "Doubts",
    )
}

private fun durationMinutes(start: String, end: String): Int? {
    val startMinutes = timeMinutes(start) ?: return null
    val endMinutes = timeMinutes(end) ?: return null
    return (endMinutes - startMinutes).takeIf { it in 1..479 }
}

private fun addMinutes(start: String, minutes: Int): String {
    val startMinutes = timeMinutes(start) ?: return ""
    val next = (startMinutes + minutes).coerceIn(0, 23 * 60 + 59)
    return "%02d:%02d".format(Locale.US, next / 60, next % 60)
}

private fun timeMinutes(value: String): Int? {
    val parts = value.split(":")
    if (parts.size < 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    if (hour !in 0..23 || minute !in 0..59) return null
    return hour * 60 + minute
}

private fun durationLabel(minutes: Int): String {
    if (minutes < 60) return "${minutes}m"
    val hours = minutes / 60
    val remainder = minutes % 60
    return if (remainder == 0) {
        "${hours} hr"
    } else {
        "${hours}h ${remainder}m"
    }
}

/**
 * Non-scrolling Column variant of the entry editor form.
 * Used by ClassEntryScreen to embed the editor inside its own LazyColumn
 * without nesting scrollable containers.
 */
@Composable
fun EntryEditorColumn(
    draft: TeacherEntryDraft,
    existingEntries: List<TeacherEntry>,
    saving: Boolean,
    validation: TeacherEntryValidation,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSave: (TeacherEntryDraft) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Only show validation errors after the user has tapped Save at least once.
    // Resets whenever the draft's mutationId changes (i.e. after a successful save).
    var saveAttempted by remember(draft.mutationId) { mutableStateOf(false) }
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScheduleCard(
            draft = draft,
            existingEntries = existingEntries,
            onDraftChanged = onDraftChanged,
        )

        if (draft.timeStart.isNotBlank()) {
            DurationCard(
                draft = draft,
                onDraftChanged = onDraftChanged,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "STATUS",
                style = MaterialTheme.typography.labelLarge,
                color = LedgrTheme.colors.textMuted,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TeacherEntryStatus.entries.take(2).forEach { status ->
                    StatusChip(
                        status = status,
                        selected = draft.status == status.storageValue,
                        onClick = {
                            onDraftChanged(
                                draft.copy(
                                    status = if (draft.status == status.storageValue) "" else status.storageValue,
                                ),
                            )
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TeacherEntryStatus.entries.drop(2).forEach { status ->
                    StatusChip(
                        status = status,
                        selected = draft.status == status.storageValue,
                        onClick = {
                            onDraftChanged(
                                draft.copy(
                                    status = if (draft.status == status.storageValue) "" else status.storageValue,
                                ),
                            )
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        OutlinedTextField(
            value = draft.title,
            onValueChange = { onDraftChanged(draft.copy(title = it)) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Topic / title") },
            supportingText = { Text("Required") },
            singleLine = true,
        )

        OutlinedTextField(
            value = draft.body,
            onValueChange = { onDraftChanged(draft.copy(body = it)) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Notes") },
            minLines = 4,
            maxLines = 8,
        )

        if (saveAttempted && validation is TeacherEntryValidation.Invalid) {
            Text(
                text = validation.message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // Soft overlap warning — shown proactively, allows saving anyway
        if (validation is TeacherEntryValidation.Overlap) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = LedgrTheme.colors.warningSurface,
                contentColor = LedgrTheme.colors.textSecondary,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = validation.message,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                        color = LedgrTheme.colors.textSecondary,
                    )
                }
            }
        }

        Button(
            onClick = {
                saveAttempted = true
                if (validation == TeacherEntryValidation.Valid ||
                    validation is TeacherEntryValidation.Overlap
                ) onSave(draft)
            },
            enabled = !saving,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(vertical = 15.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            if (saving) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Icon(
                    imageVector = Icons.Outlined.Save,
                    contentDescription = null,
                )
                Text(
                    text = if (draft.entryId == null) "Save entry" else "Save changes",
                    modifier = Modifier.padding(start = 10.dp),
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
