package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherSyllabusRepository
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.TeacherSnapshot
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val teacherUid: String = "",
    val snapshot: TeacherSnapshot? = null,
    val publishedSyllabi: List<PublishedSyllabus> = emptyList(),
    val syllabiLoaded: Boolean = false,
) {
    companion object {
        val Empty = HomeUiState()
    }
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    authRepository: TeacherAuthRepository,
    private val dataRepository: TeacherDataRepository,
    private val syllabusRepository: TeacherSyllabusRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(HomeUiState.Empty)
    val state: StateFlow<HomeUiState> = mutableState.asStateFlow()

    private var snapshotJob: Job? = null
    private var syllabusJob: Job? = null
    private var loadedUid: String? = null

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                when (session) {
                    AuthSession.Loading,
                    AuthSession.SignedOut,
                    -> reset()

                    is AuthSession.SignedIn -> {
                        mutableState.update { current ->
                            current.copy(teacherUid = session.teacher.uid)
                        }
                        if (loadedUid != session.teacher.uid) {
                            mutableState.value = HomeUiState(teacherUid = session.teacher.uid)
                            loadedUid = session.teacher.uid
                            observeHomeData(session.teacher.uid)
                            loadPublishedSyllabi(session.teacher.uid)
                        }
                    }
                }
            }
        }
    }

    private fun observeHomeData(uid: String) {
        snapshotJob?.cancel()
        snapshotJob = viewModelScope.launch {
            dataRepository.observeTeacherSnapshot(uid).collectLatest { snapshot ->
                mutableState.update { current ->
                    current.copy(snapshot = snapshot)
                }
            }
        }
    }

    private fun loadPublishedSyllabi(uid: String) {
        syllabusJob?.cancel()
        syllabusJob = viewModelScope.launch {
            val publishedSyllabi = runCatching {
                syllabusRepository.loadPublishedSyllabi(uid)
            }.getOrDefault(emptyList())
            mutableState.update { current ->
                current.copy(
                    publishedSyllabi = publishedSyllabi,
                    syllabiLoaded = true,
                )
            }
        }
    }

    private fun reset() {
        loadedUid = null
        snapshotJob?.cancel()
        syllabusJob?.cancel()
        mutableState.value = HomeUiState.Empty
    }
}
