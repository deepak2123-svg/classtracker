package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherEntryConflictException
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntryValidation
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.validateTeacherEntryDraft
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.google.firebase.firestore.FirebaseFirestoreException
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EntryFlowUiState(
    val saving: Boolean = false,
    val entrySaved: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class EntryFlowViewModel @Inject constructor(
    private val dataRepository: TeacherDataRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(EntryFlowUiState())
    val state: StateFlow<EntryFlowUiState> = mutableState.asStateFlow()

    private var teacher: AuthenticatedTeacher? = null
    private var snapshot: TeacherSnapshot? = null

    fun prime(
        teacher: AuthenticatedTeacher,
        snapshot: TeacherSnapshot,
    ) {
        this.teacher = teacher
        this.snapshot = snapshot
    }

    fun saveEntry(draft: TeacherEntryDraft) {
        val currentTeacher = teacher ?: return
        val currentSnapshot = snapshot ?: return
        if (mutableState.value.saving) return

        when (
            val validation = validateTeacherEntryDraft(
                draft = draft,
                existingEntries = currentSnapshot.entriesForClass(draft.classId),
            )
        ) {
            TeacherEntryValidation.Valid -> Unit
            is TeacherEntryValidation.Overlap -> Unit
            is TeacherEntryValidation.Invalid -> {
                mutableState.update { it.copy(errorMessage = validation.message) }
                return
            }
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    saving = true,
                    entrySaved = false,
                    errorMessage = null,
                )
            }

            runCatching {
                dataRepository.saveEntry(
                    teacher = currentTeacher,
                    expectedRevision = currentSnapshot.revision,
                    draft = draft,
                )
            }.onSuccess { updatedSnapshot ->
                snapshot = updatedSnapshot
                mutableState.update {
                    it.copy(
                        saving = false,
                        entrySaved = true,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(currentTeacher) }
                        .onSuccess { latestSnapshot ->
                            snapshot = latestSnapshot
                            val alreadySaved = latestSnapshot.entries.any { entry ->
                                entry.id == draft.resolvedIdOrNull() &&
                                    entry.classId == draft.classId &&
                                    entry.dateKey == draft.dateKey &&
                                    entry.title == draft.title.trim() &&
                                    entry.timeStart.orEmpty() == draft.timeStart.trim()
                            }
                            mutableState.update {
                                it.copy(
                                    saving = false,
                                    entrySaved = alreadySaved,
                                    errorMessage = if (alreadySaved) {
                                        null
                                    } else {
                                        "Newer web changes were loaded. Review and save again."
                                    },
                                )
                            }
                        }
                        .onFailure { refreshError ->
                            mutableState.update {
                                it.copy(
                                    saving = false,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            saving = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun consumeEntrySaved() {
        mutableState.update { it.copy(entrySaved = false) }
    }

    fun consumeError() {
        mutableState.update { it.copy(errorMessage = null) }
    }
}

private fun TeacherEntryDraft.resolvedIdOrNull(): String? =
    entryId ?: mutationId.takeIf(String::isNotBlank)

private fun Throwable.toFriendlyMessage(): String = when (this) {
    is TeacherDataMissingException -> message.orEmpty()
    is TeacherRevisionConflictException ->
        "Newer web changes are available. Review and save again."
    is TeacherEntryConflictException -> message.orEmpty()
    is FirebaseNetworkException -> "Unable to reach the server. Check your connection."
    is FirebaseAuthRecentLoginRequiredException ->
        "For security, sign out, sign in again, then retry account deletion."
    is FirebaseAuthException -> when (errorCode) {
        "ERROR_INVALID_CREDENTIAL",
        "ERROR_WRONG_PASSWORD",
        "ERROR_USER_NOT_FOUND",
        -> "Email or password is incorrect."
        else -> localizedMessage ?: "Authentication failed."
    }
    is FirebaseFirestoreException -> when (code) {
        FirebaseFirestoreException.Code.PERMISSION_DENIED ->
            "This account does not have access to the teacher workspace."
        FirebaseFirestoreException.Code.UNAVAILABLE ->
            "Teacher data is temporarily unavailable."
        else -> localizedMessage ?: "Teacher data could not be loaded."
    }
    else -> localizedMessage?.takeIf { it.isNotBlank() }
        ?: "Something went wrong. Please try again."
}
