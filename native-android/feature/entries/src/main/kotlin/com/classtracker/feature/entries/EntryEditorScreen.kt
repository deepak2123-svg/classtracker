package com.classtracker.feature.entries

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.classtracker.core.designsystem.LedgrClassCard
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherEntryValidation
import com.classtracker.core.model.TeacherTimeSlot
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.validateTeacherEntryDraft
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

private val EntryCanvas = Color(0xFFEAF4FF)
private val EntryInk = Color(0xFF202A55)
private val EntryMuted = Color(0xFF85837D)
private val EntryBorder = Color(0xFFD6D2CA)
private val EntryPlaceholder = Color(0xFFBFBDB8)
private val EntryGreen = Color(0xFF1AA079)

@Composable
private fun entryCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else EntryCanvas

@Composable
private fun entrySurfaceColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.surface else Color.White

@Composable
private fun entryFieldColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else Color.White

@Composable
private fun entryInkColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurface else EntryInk

@Composable
private fun entryMutedColor() =
    if (LedgrTheme.isDark) LedgrTheme.colors.textMuted else EntryMuted

@Composable
private fun entryBorderColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.outlineVariant else EntryBorder

@Composable
private fun entryPlaceholderColor() =
    if (LedgrTheme.isDark) LedgrTheme.colors.textSubtle else EntryPlaceholder

@Composable
private fun entryPrimaryControlColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.primaryContainer else EntryInk

@Composable
private fun entryPrimaryControlContentColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onPrimaryContainer else Color.White

@Composable
private fun entrySubtleTextColor() =
    if (LedgrTheme.isDark) LedgrTheme.colors.textMuted else Color(0xFFB1ADA4)

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
    val haptics = rememberLedgrHaptics()
    val validation = remember(draft, existingEntries) {
        validateTeacherEntryDraft(draft, existingEntries)
    }
    var showCustomTimeFields by rememberSaveable(
        teacherClass.id,
        draft.entryId,
        teacherClass.timeSlots,
    ) {
        mutableStateOf(
            teacherClass.timeSlots.isEmpty() ||
                (
                    draft.timeStart.isNotBlank() &&
                        teacherClass.timeSlots.none { slot ->
                            slot.start == draft.timeStart && slot.end == draft.timeEnd
                        }
                    ),
        )
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(entryCanvasColor())
            .imePadding(),
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
                )
            }
        }

        item {
            ScheduleCard(
                draft = draft,
                existingEntries = existingEntries,
                timeSlots = teacherClass.timeSlots,
                showCustomTimeFields = showCustomTimeFields,
                onShowCustomTimeFields = { showCustomTimeFields = it },
                onDraftChanged = onDraftChanged,
            )
        }

        if (showCustomTimeFields && draft.timeStart.isNotBlank()) {
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
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 13.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                    color = entryInkColor(),
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
                onClick = {
                    haptics.confirm()
                    onSave(draft)
                },
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
    timeSlots: List<TeacherTimeSlot>,
    showCustomTimeFields: Boolean,
    onShowCustomTimeFields: (Boolean) -> Unit,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
) {
    var timePickerTarget by remember { mutableStateOf<TimePickerTarget?>(null) }
    val usedStarts = remember(existingEntries, draft.dateKey, draft.entryId) {
        existingEntries
            .filter { entry ->
                entry.dateKey == draft.dateKey && entry.id != draft.entryId
            }
            .mapNotNullTo(linkedSetOf()) { it.timeStart?.takeIf(String::isNotBlank) }
    }

    timePickerTarget?.let { target ->
        ScrollDrumTimeDialog(
            initialValue = when (target) {
                TimePickerTarget.Start -> draft.timeStart
                TimePickerTarget.End -> draft.timeEnd.ifBlank { draft.timeStart }
            },
            onDismiss = { timePickerTarget = null },
            onSelected = { selected ->
                onDraftChanged(
                    when (target) {
                        TimePickerTarget.Start -> draft.copy(
                            timeStart = selected,
                            timeEnd = draft.timeEnd.ifBlank { addMinutes(selected, 60) },
                        )
                        TimePickerTarget.End -> draft.copy(timeEnd = selected)
                    },
                )
                timePickerTarget = null
            },
        )
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = entryCanvasColor()),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(0.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
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

            if (timeSlots.isNotEmpty()) {
                TimetableSlots(
                    slots = timeSlots,
                    usedStarts = usedStarts,
                    selectedStart = draft.timeStart,
                    selectedEnd = draft.timeEnd,
                    showCustomTimeFields = showCustomTimeFields,
                    onCustomTimeClick = { onShowCustomTimeFields(true) },
                    onSlotSelected = { slot ->
                        onShowCustomTimeFields(false)
                        onDraftChanged(
                            draft.copy(
                                timeStart = slot.start,
                                timeEnd = slot.end,
                            ),
                        )
                    },
                )
            }

            if (showCustomTimeFields) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PickerField(
                        label = "Start",
                        value = formatDisplayTime(draft.timeStart).ifBlank { "Pick time" },
                        icon = Icons.Outlined.Schedule,
                        onClick = {
                            timePickerTarget = TimePickerTarget.Start
                        },
                        modifier = Modifier.weight(1f),
                    )
                    PickerField(
                        label = "End",
                        value = formatDisplayTime(draft.timeEnd).ifBlank { "Optional" },
                        icon = Icons.Outlined.Schedule,
                        onClick = {
                            timePickerTarget = TimePickerTarget.End
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

private enum class TimePickerTarget {
    Start,
    End,
}

@Composable
private fun TimetableSlots(
    slots: List<TeacherTimeSlot>,
    usedStarts: Set<String>,
    selectedStart: String,
    selectedEnd: String,
    showCustomTimeFields: Boolean,
    onCustomTimeClick: () -> Unit,
    onSlotSelected: (TeacherTimeSlot) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "TIMETABLE SLOTS",
            style = MaterialTheme.typography.labelLarge.copy(
                fontSize = 14.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.Normal,
            ),
            color = entryMutedColor(),
        )
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            slots.chunked(2).forEach { rowSlots ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    rowSlots.forEach { slot ->
                        val used = slot.start in usedStarts
                        val selected = slot.start == selectedStart && slot.end == selectedEnd
                        TimeSlotChip(
                            slot = slot,
                            used = used,
                            selected = selected,
                            onClick = { onSlotSelected(slot) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowSlots.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        if (!showCustomTimeFields) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
                    .clickable(onClick = onCustomTimeClick),
                color = entrySurfaceColor(),
                contentColor = entryInkColor(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, entryBorderColor()),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(21.dp),
                        tint = entryInkColor(),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(
                            text = "Time slot not listed?",
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 14.sp,
                                lineHeight = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                            ),
                        )
                        Text(
                            text = "Choose a custom time",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontSize = 13.sp,
                                lineHeight = 17.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                            color = entryMutedColor(),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TimeSlotChip(
    slot: TeacherTimeSlot,
    used: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val background by animateColorAsState(
        targetValue = when {
            selected -> MaterialTheme.colorScheme.primary
            else -> entrySurfaceColor()
        },
        label = "slot-background",
    )
    val foreground by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.onPrimary
        } else {
            entryInkColor()
        },
        label = "slot-foreground",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            entryBorderColor()
        },
        label = "slot-border",
    )
    Surface(
        modifier = modifier
            .height(46.dp)
            .clickable(enabled = !used, onClick = onClick),
        color = background,
        contentColor = entryInkColor(),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = borderColor,
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "${formatDisplayTime(slot.start)} – ${formatDisplayTime(slot.end)}",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontSize = 14.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = foreground,
                ),
                maxLines = 1,
                textAlign = TextAlign.Center,
            )
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
        color = entrySurfaceColor(),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, entryBorderColor()),
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
                            tint = entryInkColor(),
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = monthTitle(viewYear, viewMonth),
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontSize = 17.sp,
                                lineHeight = 20.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = entryInkColor(),
                            ),
                        )
                    }
                    Text(
                        text = formatDisplayDate(selectedDate),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        color = entryMutedColor(),
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
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
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
        color = if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else EntryCanvas,
        contentColor = entryInkColor(),
        shape = CircleShape,
        border = BorderStroke(1.dp, entryBorderColor()),
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
private fun CalendarWeekLabels() {
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
                color = entryMutedColor(),
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
    val ink = entryInkColor()
    val selectedBackground = entryPrimaryControlColor()
    val disabledColor = if (LedgrTheme.isDark) LedgrTheme.colors.textSubtle else Color(0xFFBDBAB4)
    val dotColor = if (LedgrTheme.isDark) LedgrTheme.colors.green else EntryGreen
    val background by animateColorAsState(
        targetValue = when {
            cell.selected -> selectedBackground
            else -> Color.Transparent
        },
        label = "calendar-day-bg",
    )
    val contentColor by animateColorAsState(
        targetValue = when {
            cell.selected -> Color.White
            cell.sunday -> Color(0xFFEF4444)
            cell.canSelect || cell.entryCount > 0 -> ink
            else -> disabledColor
        },
        label = "calendar-day-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (cell.selected) {
            selectedBackground
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
            modifier = Modifier
                .fillMaxWidth(),
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
                        .background(
                            color = dotColor,
                            shape = CircleShape,
                        ),
                )
            }
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
        modifier = modifier
            .height(68.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else EntryCanvas,
        border = BorderStroke(1.dp, entryBorderColor()),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 13.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = entryMutedColor(),
            )
            Column {
                Text(
                    text = label.uppercase(Locale.US),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontSize = 13.sp,
                        lineHeight = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                    color = entryMutedColor(),
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 18.sp,
                        lineHeight = 22.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                    color = if (value == "Optional" || value == "Pick time") {
                        entryPlaceholderColor()
                    } else {
                        entryInkColor()
                    },
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
    val tone = statusTone(status, LedgrTheme.isDark)
    Surface(
        modifier = modifier
            .height(48.dp)
            .clickable(onClick = onClick),
        color = if (selected) tone.background else MaterialTheme.colorScheme.surface,
        contentColor = if (selected) tone.content else entryInkColor(),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.5.dp,
            color = if (selected) tone.dot else MaterialTheme.colorScheme.outline,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.5.dp)
                    .background(
                        color = if (selected) tone.dot else LedgrTheme.colors.textSubtle,
                        shape = CircleShape,
                    ),
            )
            Text(
                text = tone.label,
                style = MaterialTheme.typography.labelLarge.copy(
                    fontSize = 14.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun EntryTextAndSavePanel(
    draft: TeacherEntryDraft,
    saving: Boolean,
    saveCompleted: Boolean,
    validation: TeacherEntryValidation,
    showInvalid: Boolean,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSaveClick: () -> Unit,
) {
    val bringIntoViewRequester = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val requestBringIntoView: () -> Unit = {
        scope.launch {
            delay(240)
            bringIntoViewRequester.bringIntoView()
        }
        Unit
    }
    val buttonScale by animateFloatAsState(
        targetValue = when {
            saveCompleted -> 1.012f
            saving -> 0.988f
            else -> 1f
        },
        animationSpec = spring(stiffness = 420f, dampingRatio = 0.92f),
        label = "entrySaveButtonScale",
    )
    val buttonContainerColor by animateColorAsState(
        targetValue = if (saveCompleted) EntryGreen else entryPrimaryControlColor(),
        animationSpec = spring(stiffness = 520f, dampingRatio = 0.92f),
        label = "entrySaveButtonContainer",
    )
    val buttonContentColor by animateColorAsState(
        targetValue = if (saveCompleted) Color.White else entryPrimaryControlContentColor(),
        animationSpec = spring(stiffness = 520f, dampingRatio = 0.92f),
        label = "entrySaveButtonContent",
    )

    Column(
        modifier = Modifier
            .bringIntoViewRequester(bringIntoViewRequester)
            .animateContentSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Topic",
            style = MaterialTheme.typography.labelLarge.copy(
                fontSize = 12.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.Medium,
            ),
            color = entryInkColor(),
        )
        EntryTextBox(
            value = draft.title,
            onValueChange = { onDraftChanged(draft.copy(title = it)) },
            placeholder = "What did you cover?",
            icon = Icons.Outlined.MenuBook,
            singleLine = true,
            onFocused = requestBringIntoView,
        )
        Text(
            text = if (showInvalid) {
                (validation as TeacherEntryValidation.Invalid).message
            } else {
                "Required"
            },
            color = if (showInvalid) Color(0xFFFF3B3B) else entrySubtleTextColor(),
            style = MaterialTheme.typography.labelLarge.copy(
                fontSize = 12.sp,
                lineHeight = 16.sp,
                fontWeight = if (showInvalid) FontWeight.Bold else FontWeight.Medium,
            ),
        )
        Text(
            text = "Notes (optional)",
            style = MaterialTheme.typography.labelLarge.copy(
                fontSize = 12.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.Medium,
            ),
            color = entryInkColor(),
        )
        EntryTextBox(
            value = draft.body,
            onValueChange = { onDraftChanged(draft.copy(body = it)) },
            placeholder = "Add a short note, if needed",
            icon = Icons.Outlined.Notes,
            singleLine = false,
            onFocused = requestBringIntoView,
        )
        if (validation is TeacherEntryValidation.Overlap) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = if (LedgrTheme.isDark) LedgrTheme.colors.warningSurface else Color(0xFFFFF4C8),
                contentColor = if (LedgrTheme.isDark) Color(0xFFFDE68A) else Color(0xFF805E00),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(
                    text = validation.message,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        Button(
            onClick = {
                focusManager.clearFocus(force = true)
                keyboardController?.hide()
                onSaveClick()
            },
            enabled = !saving && !saveCompleted,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .graphicsLayer {
                    scaleX = buttonScale
                    scaleY = buttonScale
                },
            contentPadding = PaddingValues(vertical = 12.dp),
            shape = RoundedCornerShape(16.dp),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = buttonContainerColor,
                contentColor = buttonContentColor,
                disabledContainerColor = buttonContainerColor.copy(alpha = 0.5f),
                disabledContentColor = buttonContentColor.copy(alpha = 0.82f),
            ),
        ) {
            if (saveCompleted) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = "Saved",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                    )
                }
            } else if (saving) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = entryPrimaryControlContentColor(),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = "Saving...",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                    )
                }
            } else {
                Icon(
                    imageVector = Icons.Outlined.Check,
                    contentDescription = null,
                    modifier = Modifier.size(19.dp),
                )
                Text(
                    text = if (draft.entryId == null) "Save entry" else "Save changes",
                    modifier = Modifier.padding(start = 8.dp),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                )
            }
        }
    }
}

@Composable
private fun EntryTextBox(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    singleLine: Boolean,
    onFocused: () -> Unit = {},
) {
    val bringIntoViewRequester = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .bringIntoViewRequester(bringIntoViewRequester),
        color = entrySurfaceColor(),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, entryBorderColor()),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = entryPlaceholderColor(),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .size(19.dp),
            )
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .height(if (singleLine) 46.dp else 96.dp),
                color = entryFieldColor(),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, entryBorderColor()),
            ) {
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 14.dp, vertical = if (singleLine) 0.dp else 12.dp)
                        .onFocusChanged { focusState ->
                            if (focusState.isFocused) {
                                onFocused()
                                scope.launch {
                                    delay(260)
                                    bringIntoViewRequester.bringIntoView()
                                }
                            }
                        },
                    textStyle = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 18.sp,
                        lineHeight = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = entryInkColor(),
                    ),
                    singleLine = singleLine,
                    maxLines = if (singleLine) 1 else 4,
                    cursorBrush = SolidColor(entryInkColor()),
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = if (singleLine) Alignment.CenterStart else Alignment.TopStart,
                        ) {
                            if (value.isBlank()) {
                                Text(
                                    text = placeholder,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontSize = 18.sp,
                                        lineHeight = 24.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = entryPlaceholderColor(),
                                    ),
                                )
                            }
                            innerTextField()
                        }
                    },
                )
            }
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

@Composable
private fun ScrollDrumTimeDialog(
    initialValue: String,
    onDismiss: () -> Unit,
    onSelected: (String) -> Unit,
) {
    val initial = remember(initialValue) { parseTimePickerInitial(initialValue) }
    val hours = remember { (1..12).map { "%02d".format(Locale.US, it) } }
    val minutes = remember { (0..59).map { "%02d".format(Locale.US, it) } }
    val periods = remember { listOf("AM", "PM") }
    val hourState = rememberLazyListState(initialFirstVisibleItemIndex = initial.hour12 - 1)
    val minuteState = rememberLazyListState(initialFirstVisibleItemIndex = initial.minute)
    val periodState = rememberLazyListState(initialFirstVisibleItemIndex = initial.periodIndex)

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            color = Color(0xFF151925),
            contentColor = Color.White,
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, Color(0xFF30364A)),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                Text(
                    text = "Pick time",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 20.sp,
                        lineHeight = 24.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DrumWheel(
                        items = hours,
                        state = hourState,
                        label = "HOUR",
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = ":",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                        ),
                        color = Color.White.copy(alpha = 0.76f),
                    )
                    DrumWheel(
                        items = minutes,
                        state = minuteState,
                        label = "MIN",
                        modifier = Modifier.weight(1f),
                    )
                    DrumWheel(
                        items = periods,
                        state = periodState,
                        label = "PERIOD",
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = {
                            val hour12 = hours[hourState.centeredItemIndex(hours.size)].toInt()
                            val minute = minutes[minuteState.centeredItemIndex(minutes.size)].toInt()
                            val period = periods[periodState.centeredItemIndex(periods.size)]
                            val hour24 = if (period == "PM") {
                                (hour12 % 12) + 12
                            } else {
                                if (hour12 == 12) 0 else hour12
                            }
                            onSelected("%02d:%02d".format(Locale.US, hour24, minute))
                        },
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text("Set time")
                    }
                }
            }
        }
    }
}

@Composable
private fun DrumWheel(
    items: List<String>,
    state: LazyListState,
    label: String,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(state, items.size) {
        snapshotFlow { state.isScrollInProgress }
            .distinctUntilChanged()
            .collect { scrolling ->
                if (!scrolling) {
                    val selected = state.centeredItemIndex(items.size)
                    if (state.firstVisibleItemIndex != selected || state.firstVisibleItemScrollOffset != 0) {
                        state.animateScrollToItem(selected)
                    }
                }
            }
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(164.dp),
            color = Color.White,
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.dp, Color(0xFFD4D4D8)),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(48.dp)
                        .padding(horizontal = 8.dp)
                        .background(
                            Color(0xFFF1F1F1).copy(alpha = 0.9f),
                            RoundedCornerShape(7.dp),
                        ),
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    state = state,
                    contentPadding = PaddingValues(vertical = 56.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    items.indices.forEach { index ->
                        item(key = "$label-$index") {
                            val selectedIndex = state.centeredItemIndex(items.size)
                            val distance = abs(index - selectedIndex)
                            Text(
                                text = items[index],
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp),
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.headlineSmall.copy(
                                    fontSize = 26.sp,
                                    lineHeight = 52.sp,
                                    fontWeight = if (distance == 0) {
                                        FontWeight.ExtraBold
                                    } else {
                                        FontWeight.Bold
                                    },
                                ),
                                color = Color.Black.copy(
                                    alpha = when (distance) {
                                        0 -> 1f
                                        1 -> 0.38f
                                        else -> 0.14f
                                    },
                                ),
                            )
                        }
                    }
                }
            }
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium.copy(
                fontSize = 12.sp,
                lineHeight = 14.sp,
                fontWeight = FontWeight.ExtraBold,
            ),
            color = Color.White.copy(alpha = 0.72f),
        )
    }
}

private data class TimePickerInitial(
    val hour12: Int,
    val minute: Int,
    val periodIndex: Int,
)

private fun parseTimePickerInitial(value: String): TimePickerInitial {
    val minutes = timeMinutes(value)
    val calendar = Calendar.getInstance()
    val hour24 = minutes?.div(60) ?: calendar.get(Calendar.HOUR_OF_DAY)
    val minute = minutes?.rem(60) ?: calendar.get(Calendar.MINUTE)
    val hour12 = (hour24 % 12).let { if (it == 0) 12 else it }
    return TimePickerInitial(
        hour12 = hour12,
        minute = minute.coerceIn(0, 59),
        periodIndex = if (hour24 >= 12) 1 else 0,
    )
}

private fun LazyListState.centeredItemIndex(itemCount: Int): Int {
    val visibleItems = layoutInfo.visibleItemsInfo
    if (visibleItems.isEmpty()) {
        return firstVisibleItemIndex.coerceIn(0, itemCount - 1)
    }
    val viewportCenter = layoutInfo.viewportStartOffset +
        ((layoutInfo.viewportEndOffset - layoutInfo.viewportStartOffset) / 2)
    return visibleItems
        .minByOrNull { item -> abs((item.offset + (item.size / 2)) - viewportCenter) }
        ?.index
        ?.coerceIn(0, itemCount - 1)
        ?: firstVisibleItemIndex.coerceIn(0, itemCount - 1)
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

private fun statusTone(status: TeacherEntryStatus, dark: Boolean): StatusTone = when (status) {
    TeacherEntryStatus.Started -> if (dark) {
        StatusTone(Color(0xFF102A4F), Color(0xFFBFDBFE), Color(0xFF60A5FA), "Started")
    } else {
        StatusTone(Color(0xFFDBEAFE), Color(0xFF1D4ED8), Color(0xFF3B82F6), "Started")
    }
    TeacherEntryStatus.InProgress -> if (dark) {
        StatusTone(Color(0xFF3A2A11), Color(0xFFFDE68A), Color(0xFFF59E0B), "In Progress")
    } else {
        StatusTone(Color(0xFFFEF3C7), Color(0xFFB45309), Color(0xFFF59E0B), "In Progress")
    }
    TeacherEntryStatus.Completed -> if (dark) {
        StatusTone(Color(0xFF123528), Color(0xFFA7F3D0), Color(0xFF34D399), "Completed")
    } else {
        StatusTone(Color(0xFFD1FAE5), Color(0xFF065F46), Color(0xFF10B981), "Completed")
    }
    TeacherEntryStatus.Doubts -> if (dark) {
        StatusTone(Color(0xFF3B2112), Color(0xFFFED7AA), Color(0xFFFB923C), "Doubts")
    } else {
        StatusTone(Color(0xFFFFEDD5), Color(0xFF9A3412), Color(0xFFF97316), "Doubts")
    }
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
    timeSlots: List<TeacherTimeSlot> = emptyList(),
    saving: Boolean,
    saveCompleted: Boolean = false,
    validation: TeacherEntryValidation,
    syllabus: PublishedSyllabus? = null,
    onDraftChanged: (TeacherEntryDraft) -> Unit,
    onSave: (TeacherEntryDraft) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberLedgrHaptics()
    // Only show validation errors after the user has tapped Save at least once.
    // Resets whenever the draft's mutationId changes (i.e. after a successful save).
    var saveAttempted by remember(draft.mutationId) { mutableStateOf(false) }
    var showCustomTimeFields by rememberSaveable(draft.classId, draft.entryId, timeSlots) {
        mutableStateOf(
            timeSlots.isEmpty() ||
                (
                    draft.timeStart.isNotBlank() &&
                        timeSlots.none { slot ->
                            slot.start == draft.timeStart && slot.end == draft.timeEnd
                        }
                    ),
        )
    }
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScheduleCard(
            draft = draft,
            existingEntries = existingEntries,
            timeSlots = timeSlots,
            showCustomTimeFields = showCustomTimeFields,
            onShowCustomTimeFields = { showCustomTimeFields = it },
            onDraftChanged = onDraftChanged,
        )

        if (showCustomTimeFields && draft.timeStart.isNotBlank()) {
            DurationCard(
                draft = draft,
                onDraftChanged = onDraftChanged,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "STATUS",
                style = MaterialTheme.typography.labelLarge.copy(
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                color = entryInkColor(),
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
                            haptics.selection()
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
                            haptics.selection()
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

        EntryTextAndSavePanel(
            draft = draft,
            saving = saving,
            saveCompleted = saveCompleted,
            validation = validation,
            showInvalid = saveAttempted && validation is TeacherEntryValidation.Invalid,
            onDraftChanged = onDraftChanged,
            onSaveClick = {
                saveAttempted = true
                if (validation == TeacherEntryValidation.Valid ||
                    validation is TeacherEntryValidation.Overlap
                ) {
                    haptics.confirm()
                    onSave(draft)
                } else {
                    haptics.warning()
                }
            },
        )
    }
}
