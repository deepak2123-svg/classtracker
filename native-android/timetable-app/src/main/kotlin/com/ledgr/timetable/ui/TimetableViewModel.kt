package com.ledgr.timetable.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.ledgr.timetable.data.GeneratedPeriodEntity
import com.ledgr.timetable.data.InstituteEntity
import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableEntity
import com.ledgr.timetable.data.TimetableRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
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
    private val selectedInstituteId = MutableStateFlow<String?>(null)
    private val selectedTimetableId = MutableStateFlow<String?>(null)
    private val selectedMode = MutableStateFlow(TimetableMode.Setup)
    private val conflicts = MutableStateFlow<List<TimetableConflict>>(emptyList())

    private val institutes = repository.observeInstitutes()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val selectedInstitute = combine(institutes, selectedInstituteId) { values, selectedId ->
        values.firstOrNull { it.id == selectedId } ?: values.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val timetables = selectedInstitute.flatMapLatest { institute ->
        institute?.let { repository.observeTimetables(it.id) } ?: flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val selectedTimetable = combine(timetables, selectedTimetableId) { values, selectedId ->
        values.firstOrNull { it.id == selectedId } ?: values.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val slots = selectedTimetable.observeChild { repository.observeSlots(it.id) }
    private val staff = selectedTimetable.observeChild { repository.observeStaff(it.id) }
    private val sections = selectedTimetable.observeChild { repository.observeSections(it.id) }
    private val mappings = selectedTimetable.observeChild { repository.observeMappings(it.id) }
    private val periods = selectedTimetable.observeChild { repository.observePeriods(it.id) }

    private data class ChromeState(
        val institutes: List<InstituteEntity>,
        val selectedInstitute: InstituteEntity?,
        val timetables: List<TimetableEntity>,
        val selectedTimetable: TimetableEntity?,
        val mode: TimetableMode,
    )

    private data class TimetableDataState(
        val slots: List<SlotEntity>,
        val staff: List<StaffEntity>,
        val sections: List<SectionEntity>,
        val mappings: List<MappingEntity>,
        val periods: List<GeneratedPeriodEntity>,
    )

    private val chromeState = combine(
        institutes,
        selectedInstitute,
        timetables,
        selectedTimetable,
        selectedMode,
    ) { institutes, selectedInstitute, timetables, selectedTimetable, mode ->
        ChromeState(
            institutes = institutes,
            selectedInstitute = selectedInstitute,
            timetables = timetables,
            selectedTimetable = selectedTimetable,
            mode = mode,
        )
    }

    private val timetableDataState = combine(
        slots,
        staff,
        sections,
        mappings,
        periods,
    ) { slots, staff, sections, mappings, periods ->
        TimetableDataState(
            slots = slots,
            staff = staff,
            sections = sections,
            mappings = mappings,
            periods = periods,
        )
    }

    val uiState = combine(chromeState, timetableDataState, conflicts) { chrome, data, conflicts ->
        TimetableUiState(
            institutes = chrome.institutes,
            selectedInstitute = chrome.selectedInstitute,
            timetables = chrome.timetables,
            selectedTimetable = chrome.selectedTimetable,
            slots = data.slots,
            staff = data.staff,
            sections = data.sections,
            mappings = data.mappings,
            periods = data.periods,
            conflicts = conflicts,
            mode = chrome.mode,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TimetableUiState())

    fun selectInstitute(instituteId: String) {
        selectedInstituteId.value = instituteId
        selectedTimetableId.value = null
        conflicts.value = emptyList()
    }

    fun selectTimetable(timetableId: String) {
        selectedTimetableId.value = timetableId
        conflicts.value = emptyList()
    }

    fun selectMode(mode: TimetableMode) {
        selectedMode.value = mode
    }

    fun addInstitute(name: String) {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            selectedInstituteId.value = repository.createInstitute(trimmed)
            selectedTimetableId.value = null
            conflicts.value = emptyList()
        }
    }

    fun addTimetable(instituteId: String, name: String) {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            selectedTimetableId.value = repository.createTimetable(instituteId, trimmed)
            conflicts.value = emptyList()
        }
    }

    fun addSection(timetableId: String, name: String) {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            repository.addSection(timetableId, trimmed)
        }
    }

    fun addStaff(timetableId: String, name: String, subjectsCsv: String) {
        val trimmedName = name.trim()
        if (trimmedName.isBlank()) return
        viewModelScope.launch {
            repository.addStaff(timetableId, trimmedName, subjectsCsv.trim())
        }
    }

    fun addMapping(
        timetableId: String,
        sectionId: String,
        staffId: String,
        subject: String,
        frequencyPerWeek: Int,
    ) {
        val trimmedSubject = subject.trim()
        if (trimmedSubject.isBlank()) return
        viewModelScope.launch {
            repository.addMapping(
                timetableId = timetableId,
                sectionId = sectionId,
                staffId = staffId,
                subject = trimmedSubject,
                frequencyPerWeek = frequencyPerWeek,
            )
        }
    }

    fun generate(timetableId: String) {
        viewModelScope.launch {
            conflicts.value = repository.generate(timetableId).conflicts
            selectedMode.value = TimetableMode.Result
        }
    }

    fun publish(timetableId: String) {
        viewModelScope.launch {
            repository.publish(timetableId)
        }
    }

    class Factory(
        private val repository: TimetableRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(TimetableViewModel::class.java)) {
                return TimetableViewModel(repository) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class ${modelClass.name}")
        }
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
private inline fun <T, R> Flow<T?>.observeChild(
    crossinline block: (T) -> Flow<List<R>>,
) = flatMapLatest { parent ->
    parent?.let { block(it) } ?: flowOf(emptyList())
}
