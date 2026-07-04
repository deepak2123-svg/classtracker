package com.ledgr.timetable.ui

import com.ledgr.timetable.data.GeneratedPeriodEntity
import com.ledgr.timetable.data.InstituteEntity
import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableEntity

enum class TimetableMode(val label: String) {
    Setup("Setup"),
    Generate("Generate"),
    Result("Result"),
}

data class TimetableUiState(
    val institutes: List<InstituteEntity> = emptyList(),
    val selectedInstitute: InstituteEntity? = null,
    val timetables: List<TimetableEntity> = emptyList(),
    val selectedTimetable: TimetableEntity? = null,
    val slots: List<SlotEntity> = emptyList(),
    val staff: List<StaffEntity> = emptyList(),
    val sections: List<SectionEntity> = emptyList(),
    val mappings: List<MappingEntity> = emptyList(),
    val periods: List<GeneratedPeriodEntity> = emptyList(),
    val conflicts: List<TimetableConflict> = emptyList(),
    val mode: TimetableMode = TimetableMode.Setup,
)
