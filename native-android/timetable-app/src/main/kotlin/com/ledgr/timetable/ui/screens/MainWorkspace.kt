package com.ledgr.timetable.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ledgr.timetable.data.TIMETABLE_STATUS_PUBLISHED
import com.ledgr.timetable.ui.TimetableMode
import com.ledgr.timetable.ui.TimetableUiState
import com.ledgr.timetable.ui.components.Label
import com.ledgr.timetable.ui.components.ModeTabs
import com.ledgr.timetable.ui.components.TimetableChips
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun MainWorkspace(
    modifier: Modifier,
    uiState: TimetableUiState,
    onSelectTimetable: (String) -> Unit,
    onCreateTimetable: (String, String) -> Unit,
    onModeChange: (TimetableMode) -> Unit,
    onPublish: (String) -> Unit,
    onGenerate: (String) -> Unit,
    onAddSection: (String, String) -> Unit,
    onAddStaff: (String, String, String) -> Unit,
    onAddMapping: (String, String, String, String, Int) -> Unit,
) {
    var newTimetable by rememberSaveable { mutableStateOf("") }
    val selectedInstitute = uiState.selectedInstitute
    val selectedTimetable = uiState.selectedTimetable

    Card(
        modifier = modifier.fillMaxSize(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, TimetableColors.Border),
    ) {
        if (selectedInstitute == null) {
            EmptyState()
            return@Card
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(18.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Label("Institute")
                    Text(selectedInstitute.name, color = TimetableColors.Ink, fontSize = 32.sp, fontWeight = FontWeight.Black)
                    Text(
                        "${uiState.timetables.size} timetable${if (uiState.timetables.size == 1) "" else "s"} stored locally",
                        color = TimetableColors.Muted,
                    )
                }
                OutlinedButton(onClick = { selectedTimetable?.id?.let(onPublish) }) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(8.dp))
                    Text(if (selectedTimetable?.status == TIMETABLE_STATUS_PUBLISHED) "Published" else "Publish")
                }
            }
            Spacer(Modifier.height(14.dp))
            TimetableChips(
                timetables = uiState.timetables,
                selectedTimetableId = selectedTimetable?.id,
                onSelectTimetable = onSelectTimetable,
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = newTimetable,
                    onValueChange = { newTimetable = it },
                    label = { Text("New timetable") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = {
                        if (newTimetable.isNotBlank()) {
                            onCreateTimetable(selectedInstitute.id, newTimetable)
                            newTimetable = ""
                        }
                    },
                    modifier = Modifier.align(Alignment.CenterVertically),
                ) {
                    Text("Add")
                }
            }
            Spacer(Modifier.height(14.dp))
            ModeTabs(mode = uiState.mode, onModeChange = onModeChange)
            Spacer(Modifier.height(14.dp))
            when (uiState.mode) {
                TimetableMode.Setup -> SetupScreen(
                    timetable = selectedTimetable,
                    slots = uiState.slots,
                    staff = uiState.staff,
                    sections = uiState.sections,
                    mappings = uiState.mappings,
                    onAddSection = onAddSection,
                    onAddStaff = onAddStaff,
                    onAddMapping = onAddMapping,
                )
                TimetableMode.Generate -> GenerateScreen(
                    timetable = selectedTimetable,
                    slots = uiState.slots,
                    staff = uiState.staff,
                    sections = uiState.sections,
                    mappings = uiState.mappings,
                    conflicts = uiState.conflicts,
                    onGenerate = onGenerate,
                )
                TimetableMode.Result -> ResultScreen(
                    slots = uiState.slots,
                    staff = uiState.staff,
                    sections = uiState.sections,
                    periods = uiState.periods,
                    conflicts = uiState.conflicts,
                )
            }
        }
    }
}
