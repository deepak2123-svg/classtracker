package com.ledgr.timetable.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableEntity
import com.ledgr.timetable.ui.TimetableMode
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun TimetableChips(
    timetables: List<TimetableEntity>,
    selectedTimetableId: String?,
    onSelectTimetable: (String) -> Unit,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        timetables.forEach { timetable ->
            FilterChip(
                selected = timetable.id == selectedTimetableId,
                onClick = { onSelectTimetable(timetable.id) },
                label = {
                    Text(
                        "${timetable.name} · ${timetable.status}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
            )
        }
    }
}

@Composable
fun ModeTabs(mode: TimetableMode, onModeChange: (TimetableMode) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TimetableMode.entries.forEach { item ->
            FilterChip(
                selected = mode == item,
                onClick = { onModeChange(item) },
                label = { Text(item.label) },
                leadingIcon = {
                    when (item) {
                        TimetableMode.Setup -> Icon(Icons.Outlined.Group, contentDescription = null)
                        TimetableMode.Generate -> Icon(Icons.Outlined.AutoAwesome, contentDescription = null)
                        TimetableMode.Result -> Icon(Icons.Outlined.Print, contentDescription = null)
                    }
                },
            )
        }
    }
}

@Composable
fun MetricStrip(values: List<Pair<String, String>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        values.forEach { (label, value) ->
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                border = BorderStroke(1.dp, Color(0xFFBFDBFE)),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(label.uppercase(), color = TimetableColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(value, color = TimetableColors.Ink, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
fun TwoColumn(content: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        content()
    }
}

@Composable
fun SetupCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, TimetableColors.Border),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Black, color = TimetableColors.Ink)
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
fun RowScope.SetupCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.weight(1f),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, TimetableColors.Border),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Black, color = TimetableColors.Ink)
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
fun CompactEntryRow(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    button: String,
    onSubmit: () -> Unit,
    trailingValue: String? = null,
    onTrailingChange: (String) -> Unit = {},
    trailingLabel: String = "",
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            singleLine = true,
            modifier = Modifier.weight(1f),
        )
        if (trailingValue != null) {
            OutlinedTextField(
                value = trailingValue,
                onValueChange = onTrailingChange,
                label = { Text(trailingLabel) },
                singleLine = true,
                modifier = Modifier.weight(0.42f),
            )
        }
        Button(onClick = onSubmit) {
            Text(button)
        }
    }
}

@Composable
fun ChipList(
    values: List<Pair<String, String>>,
    selectedId: String?,
    onSelect: (String) -> Unit,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        values.forEach { (id, label) ->
            FilterChip(
                selected = id == selectedId,
                onClick = { onSelect(id) },
                label = { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            )
        }
    }
}

@Composable
fun ConflictPanel(conflicts: List<TimetableConflict>) {
    if (conflicts.isEmpty()) return
    SetupCard(title = "Conflicts") {
        conflicts.forEach { conflict ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.Warning, contentDescription = null, tint = TimetableColors.Orange, modifier = Modifier.size(18.dp))
                Text(
                    "${conflict.sectionName}: ${conflict.subject} with ${conflict.teacherName} - ${conflict.reason}",
                    color = TimetableColors.Ink,
                )
            }
            Spacer(Modifier.height(6.dp))
        }
    }
}
