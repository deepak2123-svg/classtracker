package com.ledgr.timetable.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SLOT_TYPE_CLASS
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableEntity
import com.ledgr.timetable.ui.components.ConflictPanel
import com.ledgr.timetable.ui.components.SetupCard
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun GenerateScreen(
    timetable: TimetableEntity?,
    slots: List<SlotEntity>,
    staff: List<StaffEntity>,
    sections: List<SectionEntity>,
    mappings: List<MappingEntity>,
    conflicts: List<TimetableConflict>,
    onGenerate: (String) -> Unit,
) {
    if (timetable == null) {
        Text("Add a timetable before generating.", color = TimetableColors.Muted)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SetupCard(title = "Generate weekly timetable") {
            Text(
                "The offline generator fills Mon-Sat class slots, avoids teacher double-booking, and reports anything it cannot place.",
                color = TimetableColors.Muted,
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { onGenerate(timetable.id) },
                enabled = slots.any { it.type == SLOT_TYPE_CLASS } && sections.isNotEmpty() && staff.isNotEmpty() && mappings.isNotEmpty(),
            ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Generate timetable")
            }
        }
        ConflictPanel(conflicts)
    }
}
