package com.ledgr.timetable.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ledgr.timetable.data.GeneratedPeriodEntity
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableDays
import com.ledgr.timetable.ui.components.ConflictPanel
import com.ledgr.timetable.ui.components.SetupCard
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun ResultScreen(
    slots: List<SlotEntity>,
    staff: List<StaffEntity>,
    sections: List<SectionEntity>,
    periods: List<GeneratedPeriodEntity>,
    conflicts: List<TimetableConflict>,
) {
    val slotsById = slots.associateBy { it.id }
    val staffById = staff.associateBy { it.id }
    val sectionsById = sections.associateBy { it.id }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (periods.isEmpty()) {
            SetupCard(title = "No generated timetable yet") {
                Text("Use Generate after adding sections, teachers, and subject mappings.", color = TimetableColors.Muted)
            }
        }
        TimetableDays.forEach { day ->
            val dayPeriods = periods.filter { it.day == day }
            if (dayPeriods.isNotEmpty()) {
                SetupCard(title = day) {
                    dayPeriods
                        .sortedBy { slotsById[it.slotId]?.sortOrder ?: Int.MAX_VALUE }
                        .forEach { period ->
                            PeriodRow(
                                period = period,
                                slot = slotsById[period.slotId],
                                section = sectionsById[period.sectionId],
                                teacher = staffById[period.staffId],
                            )
                        }
                }
            }
        }
        ConflictPanel(conflicts)
    }
}

@Composable
private fun PeriodRow(
    period: GeneratedPeriodEntity,
    slot: SlotEntity?,
    section: SectionEntity?,
    teacher: StaffEntity?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("${section?.name ?: "Section"} · ${period.subject}", fontWeight = FontWeight.Black)
            Text(teacher?.name ?: "Teacher", color = TimetableColors.Muted)
        }
        Text(slot?.label ?: "Slot", color = TimetableColors.Blue, fontWeight = FontWeight.Bold)
    }
    HorizontalDivider()
}
