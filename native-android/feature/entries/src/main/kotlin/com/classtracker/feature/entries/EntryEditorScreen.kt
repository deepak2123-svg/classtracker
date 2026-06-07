package com.classtracker.feature.entries

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
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

        item {
            LedgrSectionHeading(
                title = if (draft.entryId == null) "New entry" else "Entry details",
                supportingText = "Saved entries remain compatible with the teacher web app.",
            )
        }

        item {
            ScheduleCard(
                draft = draft,
                onDraftChanged = onDraftChanged,
            )
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
                                onDraftChanged(draft.copy(status = status.storageValue))
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
                                onDraftChanged(draft.copy(status = status.storageValue))
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

        item {
            Button(
                onClick = { onSave(draft) },
                enabled = validation == TeacherEntryValidation.Valid && !saving,
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
    onDraftChanged: (TeacherEntryDraft) -> Unit,
) {
    val context = LocalContext.current
    val selectedDate = remember(draft.dateKey) {
        parseDateKey(draft.dateKey) ?: Calendar.getInstance()
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PickerField(
                label = "Date",
                value = formatDisplayDate(draft.dateKey),
                icon = Icons.Outlined.CalendarMonth,
                onClick = {
                    val dialog = DatePickerDialog(
                        context,
                        { _, year, month, day ->
                            onDraftChanged(
                                draft.copy(
                                    dateKey = "%04d-%02d-%02d".format(
                                        Locale.US,
                                        year,
                                        month + 1,
                                        day,
                                    ),
                                ),
                            )
                        },
                        selectedDate.get(Calendar.YEAR),
                        selectedDate.get(Calendar.MONTH),
                        selectedDate.get(Calendar.DAY_OF_MONTH),
                    )
                    val today = Calendar.getInstance()
                    val earliest = Calendar.getInstance().apply {
                        add(Calendar.DAY_OF_YEAR, -7)
                    }
                    dialog.datePicker.minDate = earliest.timeInMillis
                    dialog.datePicker.maxDate = today.timeInMillis
                    dialog.show()
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
                            onSelected = { onDraftChanged(draft.copy(timeStart = it)) },
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
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                text = status.label,
                modifier = Modifier.fillMaxWidth(),
                fontWeight = FontWeight.SemiBold,
            )
        },
        modifier = modifier,
    )
}

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
