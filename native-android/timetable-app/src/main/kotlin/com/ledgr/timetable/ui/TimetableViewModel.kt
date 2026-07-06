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
import com.ledgr.timetable.domain.DraftTimeSlot
import com.ledgr.timetable.domain.DraftTimeSlotEditor
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class TimetableViewModel(
    private val repository: TimetableRepository,
) : ViewModel() {
    private val timeSlotEditor = DraftTimeSlotEditor()
    private val selectedInstituteId = MutableStateFlow<String?>(null)
    private val draftTimeSlotInstituteId = MutableStateFlow<String?>(null)
    private val draftTimeSlots = MutableStateFlow<List<DraftTimeSlot>>(emptyList())
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

    val uiState = combine(
        institutes,
        selectedInstituteId,
        teachers,
        sections,
        draftTimeSlots,
    ) { instituteRows, selectedId, teacherRows, sectionRows, timeSlotRows ->
        val selectedInstitute = instituteRows.firstOrNull { it.id == selectedId }
        TimetableUiState(
            institutes = instituteRows,
            selectedInstitute = selectedInstitute,
            teachers = teacherRows,
            sections = sectionRows,
            draftTimeSlots = timeSlotRows,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = TimetableUiState(),
    )

    fun selectInstitute(id: String) {
        selectedInstituteId.value = id
    }

    fun createInstitute(name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return

        viewModelScope.launch {
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
)
