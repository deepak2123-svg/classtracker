package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.model.TeacherSyncSummary
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.firestore.FirebaseFirestoreException
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SyncUiState(
    val teacherUid: String = "",
    val summary: TeacherSyncSummary = TeacherSyncSummary.Idle,
    val retrying: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class SyncViewModel @Inject constructor(
    private val dataRepository: TeacherDataRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(SyncUiState())
    val state: StateFlow<SyncUiState> = mutableState.asStateFlow()

    private var syncJob: Job? = null

    fun prime(uid: String) {
        if (mutableState.value.teacherUid == uid && syncJob != null) return
        syncJob?.cancel()
        mutableState.value = SyncUiState(teacherUid = uid)
        syncJob = viewModelScope.launch {
            dataRepository.observeSyncSummary(uid)
                .catch { error ->
                    mutableState.update {
                        it.copy(errorMessage = error.toFriendlyMessage())
                    }
                }
                .collectLatest { summary ->
                    mutableState.update {
                        it.copy(summary = summary, errorMessage = null)
                    }
                }
        }
    }

    fun retry() {
        val uid = mutableState.value.teacherUid.takeIf(String::isNotBlank) ?: return
        if (mutableState.value.retrying) return
        viewModelScope.launch {
            mutableState.update { it.copy(retrying = true, errorMessage = null) }
            runCatching { dataRepository.retryFailed(uid) }
                .onSuccess {
                    mutableState.update { it.copy(retrying = false, errorMessage = null) }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            retrying = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
        }
    }

    fun consumeError() {
        mutableState.update { it.copy(errorMessage = null) }
    }
}

private fun Throwable.toFriendlyMessage(): String = when (this) {
    is FirebaseNetworkException -> "Unable to reach the server. Check your connection."
    is FirebaseFirestoreException -> when (code) {
        FirebaseFirestoreException.Code.PERMISSION_DENIED ->
            "This account cannot retry sync right now."
        FirebaseFirestoreException.Code.UNAVAILABLE ->
            "Sync is temporarily unavailable. Check your connection."
        else -> localizedMessage ?: "Could not update sync status."
    }
    else -> localizedMessage ?: "Could not update sync status."
}
