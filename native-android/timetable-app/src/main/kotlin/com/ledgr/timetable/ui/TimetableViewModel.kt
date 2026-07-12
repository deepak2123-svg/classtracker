package com.ledgr.timetable.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.ledgr.timetable.data.Institute
import com.ledgr.timetable.data.Section
import com.ledgr.timetable.data.Teacher
import com.ledgr.timetable.data.TimetableDatabaseProvider
import com.ledgr.timetable.data.TimetableRepository
import com.ledgr.timetable.domain.AssignmentConflict
import com.ledgr.timetable.domain.AvailabilityWarning
import com.ledgr.timetable.domain.DraftAssignment
import com.ledgr.timetable.domain.DraftTeacherUnavailability
import com.ledgr.timetable.domain.DraftTimeSlot
import com.ledgr.timetable.domain.DraftTimeSlotEditor
import com.ledgr.timetable.domain.findAvailabilityWarnings
import com.ledgr.timetable.domain.findConflicts
import com.ledgr.timetable.domain.toAssignment
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class TimetableViewModel(
    private val repository: TimetableRepository,
) : ViewModel() {
    private val timeSlotEditor = DraftTimeSlotEditor()
    private val selectedInstituteId = MutableStateFlow<String?>(null)
    private val draftTimeSlotInstituteId = MutableStateFlow<String?>(null)
    private val draftTimeSlots = MutableStateFlow<List<DraftTimeSlot>>(emptyList())
    private val draftAssignments = MutableStateFlow<List<DraftAssignment>>(emptyList())
    private val draftTeacherUnavailability = MutableStateFlow<List<DraftTeacherUnavailability>>(emptyList())
    private val institutes = repository.observeInstitutes()
    private val teachers = selectedInstituteId.flatMapLatest { instituteId ->
        if (instituteId == null) {
            flowOf(emptyList())
        } else {
            repository.observeTeachersForInstitute(instituteId)
        }
    }
    private val sections = selectedInstituteId.flatMapLatest { instituteId ->
        if (instituteId == null) {
            flowOf(emptyList())
        } else {
            repository.observeSectionsForInstitute(instituteId)
        }
    }
    private val draftWizardState = combine(
        draftTimeSlots,
        draftAssignments,
        draftTeacherUnavailability,
    ) { timeSlotRows, assignmentRows, unavailabilityRows ->
        DraftWizardState(
            timeSlots = timeSlotRows,
            assignments = assignmentRows,
            teacherUnavailability = unavailabilityRows,
        )
    }

    val uiState = combine(
        institutes,
        selectedInstituteId,
        teachers,
        sections,
        draftWizardState,
    ) { instituteRows, selectedId, teacherRows, sectionRows, draftState ->
        val selectedInstitute = instituteRows.firstOrNull { it.id == selectedId }
        TimetableUiState(
            institutes = instituteRows,
            selectedInstitute = selectedInstitute,
            teachers = teacherRows,
            sections = sectionRows,
            draftTimeSlots = draftState.timeSlots,
            draftAssignments = draftState.assignments,
            assignmentConflicts = findConflicts(draftState.assignments.map { it.toAssignment() }),
            draftTeacherUnavailability = draftState.teacherUnavailability,
            availabilityWarnings = findAvailabilityWarnings(
                assignments = draftState.assignments,
                unavailability = draftState.teacherUnavailability,
            ),
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = TimetableUiState(),
    )

    fun selectInstitute(id: String) {
        if (selectedInstituteId.value != id) {
            draftTimeSlotInstituteId.value = null
            draftTimeSlots.value = emptyList()
            draftAssignments.value = emptyList()
            draftTeacherUnavailability.value = emptyList()
        }
        selectedInstituteId.value = id
    }

    fun createInstitute(name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return

        viewModelScope.launch {
            draftTimeSlotInstituteId.value = null
            draftTimeSlots.value = emptyList()
            draftAssignments.value = emptyList()
            draftTeacherUnavailability.value = emptyList()
            selectedInstituteId.value = repository.createInstitute(trimmed).id
        }
    }

    fun createTeacher(name: String) {
        val trimmed = name.trim()
        val instituteId = selectedInstituteId.value
        if (trimmed.isEmpty() || instituteId == null) return

        viewModelScope.launch {
            repository.createTeacher(instituteId, trimmed)
        }
    }

    fun renameTeacher(teacher: Teacher, name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return

        viewModelScope.launch {
            repository.updateTeacher(teacher, trimmed)
        }
    }

    fun deleteTeacher(teacher: Teacher) {
        draftAssignments.value = draftAssignments.value.filterNot { it.teacherId == teacher.id }
        draftTeacherUnavailability.value = draftTeacherUnavailability.value.filterNot {
            it.teacherId == teacher.id
        }
        viewModelScope.launch {
            repository.deleteTeacher(teacher.id)
        }
    }

    fun createSection(name: String) {
        val trimmed = name.trim()
        val instituteId = selectedInstituteId.value
        if (trimmed.isEmpty() || instituteId == null) return

        viewModelScope.launch {
            repository.createSection(instituteId, trimmed)
        }
    }

    fun renameSection(section: Section, name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return

        viewModelScope.launch {
            repository.updateSection(section, trimmed)
        }
    }

    fun deleteSection(section: Section) {
        viewModelScope.launch {
            repository.deleteSection(section.id)
        }
    }

    fun startTimeSlotDraft() {
        val instituteId = selectedInstituteId.value ?: return
        if (draftTimeSlotInstituteId.value == instituteId) return

        viewModelScope.launch {
            draftTimeSlots.value = repository.prefillTimeSlotsForNewDraft(instituteId)
            draftTimeSlotInstituteId.value = instituteId
        }
    }

    fun addTimeSlot(startTime: String, endTime: String, type: String) {
        if (startTime.trim().isEmpty() || endTime.trim().isEmpty()) return

        draftTimeSlots.value = timeSlotEditor.addSlot(
            slots = draftTimeSlots.value,
            startTime = startTime,
            endTime = endTime,
            type = type,
        )
    }

    fun updateTimeSlot(slot: DraftTimeSlot, startTime: String, endTime: String, type: String) {
        if (startTime.trim().isEmpty() || endTime.trim().isEmpty()) return

        draftTimeSlots.value = timeSlotEditor.updateSlot(
            slots = draftTimeSlots.value,
            id = slot.id,
            startTime = startTime,
            endTime = endTime,
            type = type,
        )
    }

    fun moveTimeSlot(fromIndex: Int, toIndex: Int) {
        draftTimeSlots.value = timeSlotEditor.moveSlot(
            slots = draftTimeSlots.value,
            fromIndex = fromIndex,
            toIndex = toIndex,
        )
    }

    fun deleteTimeSlot(slot: DraftTimeSlot) {
        draftTimeSlots.value = timeSlotEditor.deleteSlot(
            slots = draftTimeSlots.value,
            id = slot.id,
        )
        draftAssignments.value = draftAssignments.value.filterNot { it.slotId == slot.id }
        draftTeacherUnavailability.value = draftTeacherUnavailability.value.filterNot {
            it.slotId == slot.id
        }
    }

    fun assignTeacherToSubjectSlot(
        slotId: String,
        sectionId: String,
        subjectName: String,
        teacherId: String,
    ) {
        val existingAssignment = draftAssignments.value.firstOrNull { assignment ->
            assignment.slotId == slotId &&
                assignment.sectionId == sectionId &&
                assignment.subjectName == subjectName
        }
        val nextAssignment = if (existingAssignment == null) {
            DraftAssignment(
                id = UUID.randomUUID().toString(),
                slotId = slotId,
                sectionId = sectionId,
                subjectName = subjectName,
                teacherId = teacherId,
            )
        } else {
            existingAssignment.copy(teacherId = teacherId)
        }

        draftAssignments.value = draftAssignments.value
            .filterNot { it.id == nextAssignment.id }
            .plus(nextAssignment)
    }

    fun clearAssignment(assignment: DraftAssignment) {
        draftAssignments.value = draftAssignments.value.filterNot { it.id == assignment.id }
    }

    fun toggleTeacherUnavailability(teacherId: String, slotId: String) {
        val existingMark = draftTeacherUnavailability.value.firstOrNull { mark ->
            mark.teacherId == teacherId && mark.slotId == slotId
        }

        draftTeacherUnavailability.value = if (existingMark == null) {
            draftTeacherUnavailability.value.plus(
                DraftTeacherUnavailability(
                    id = UUID.randomUUID().toString(),
                    teacherId = teacherId,
                    slotId = slotId,
                ),
            )
        } else {
            draftTeacherUnavailability.value.filterNot { it.id == existingMark.id }
        }
    }

    companion object {
        fun factory(context: Context): ViewModelProvider.Factory {
            val appContext = context.applicationContext
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    val database = TimetableDatabaseProvider.getDatabase(appContext)
                    return TimetableViewModel(
                        repository = TimetableRepository(database.dao()),
                    ) as T
                }
            }
        }
    }
}

data class TimetableUiState(
    val institutes: List<Institute> = emptyList(),
    val selectedInstitute: Institute? = null,
    val teachers: List<Teacher> = emptyList(),
    val sections: List<Section> = emptyList(),
    val draftTimeSlots: List<DraftTimeSlot> = emptyList(),
    val draftAssignments: List<DraftAssignment> = emptyList(),
    val assignmentConflicts: List<AssignmentConflict> = emptyList(),
    val draftTeacherUnavailability: List<DraftTeacherUnavailability> = emptyList(),
    val availabilityWarnings: List<AvailabilityWarning> = emptyList(),
)

private data class DraftWizardState(
    val timeSlots: List<DraftTimeSlot>,
    val assignments: List<DraftAssignment>,
    val teacherUnavailability: List<DraftTeacherUnavailability>,
)
