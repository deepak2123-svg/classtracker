package com.ledgr.timetable.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SLOT_TYPE_CLASS
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableEntity
import com.ledgr.timetable.ui.components.ChipList
import com.ledgr.timetable.ui.components.CompactEntryRow
import com.ledgr.timetable.ui.components.MetricStrip
import com.ledgr.timetable.ui.components.SetupCard
import com.ledgr.timetable.ui.components.TwoColumn
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun SetupScreen(
    timetable: TimetableEntity?,
    slots: List<SlotEntity>,
    staff: List<StaffEntity>,
    sections: List<SectionEntity>,
    mappings: List<MappingEntity>,
    onAddSection: (String, String) -> Unit,
    onAddStaff: (String, String, String) -> Unit,
    onAddMapping: (String, String, String, String, Int) -> Unit,
) {
    var sectionName by rememberSaveable { mutableStateOf("") }
    var teacherName by rememberSaveable { mutableStateOf("") }
    var teacherSubjects by rememberSaveable { mutableStateOf("") }
    var subject by rememberSaveable { mutableStateOf("") }
    var frequency by rememberSaveable { mutableStateOf("3") }
    var selectedSectionId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedStaffId by rememberSaveable { mutableStateOf<String?>(null) }

    if (timetable == null) {
        Text("Add a timetable to start setup.", color = TimetableColors.Muted)
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        MetricStrip(
            values = listOf(
                "Slots" to slots.count { it.type == SLOT_TYPE_CLASS }.toString(),
                "Teachers" to staff.size.toString(),
                "Sections" to sections.size.toString(),
                "Mappings" to mappings.size.toString(),
            ),
        )
        TwoColumn {
            SetupCard(title = "Sections") {
                CompactEntryRow(
                    value = sectionName,
                    onValueChange = { sectionName = it },
                    label = "Section name",
                    button = "Add",
                    onSubmit = {
                        if (sectionName.isNotBlank()) {
                            onAddSection(timetable.id, sectionName)
                            sectionName = ""
                        }
                    },
                )
                Spacer(Modifier.height(8.dp))
                ChipList(
                    values = sections.map { it.id to it.name },
                    selectedId = selectedSectionId,
                    onSelect = { selectedSectionId = it },
                )
            }
            SetupCard(title = "Teachers") {
                OutlinedTextField(
                    value = teacherName,
                    onValueChange = { teacherName = it },
                    label = { Text("Teacher name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                CompactEntryRow(
                    value = teacherSubjects,
                    onValueChange = { teacherSubjects = it },
                    label = "Subjects",
                    button = "Add",
                    onSubmit = {
                        if (teacherName.isNotBlank()) {
                            onAddStaff(timetable.id, teacherName, teacherSubjects)
                            teacherName = ""
                            teacherSubjects = ""
                        }
                    },
                )
                Spacer(Modifier.height(8.dp))
                ChipList(
                    values = staff.map { it.id to "${it.name} · ${it.subjectsCsv.ifBlank { "No subject" }}" },
                    selectedId = selectedStaffId,
                    onSelect = { selectedStaffId = it },
                )
            }
        }
        SetupCard(title = "Subject mapping") {
            Text("Select one section and one teacher above, then add weekly frequency.", color = TimetableColors.Muted)
            Spacer(Modifier.height(8.dp))
            CompactEntryRow(
                value = subject,
                onValueChange = { subject = it },
                label = "Subject",
                button = "Map",
                trailingValue = frequency,
                onTrailingChange = { frequency = it.filter(Char::isDigit).take(2) },
                trailingLabel = "Per week",
                onSubmit = {
                    val sectionId = selectedSectionId
                    val staffId = selectedStaffId
                    if (sectionId != null && staffId != null && subject.isNotBlank()) {
                        onAddMapping(
                            timetable.id,
                            sectionId,
                            staffId,
                            subject,
                            frequency.toIntOrNull() ?: 1,
                        )
                        subject = ""
                    }
                },
            )
            Spacer(Modifier.height(12.dp))
            mappings.forEach { mapping ->
                val section = sections.firstOrNull { it.id == mapping.sectionId }?.name ?: "Missing section"
                val teacher = staff.firstOrNull { it.id == mapping.staffId }?.name ?: "Missing teacher"
                Text("$section · ${mapping.subject} · $teacher · ${mapping.frequencyPerWeek}/week", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}
