package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherEntryConflictException
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClassValidation
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.validateTeacherClassDraft
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

data class ClassMutationUiState(
    val savingClass: Boolean = false,
    val deletingClassId: String? = null,
    val classSaved: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class ClassMutationViewModel @Inject constructor(
    private val dataRepository: TeacherDataRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(ClassMutationUiState())
    val state: StateFlow<ClassMutationUiState> = mutableState.asStateFlow()

    private var teacher: AuthenticatedTeacher? = null
    private var snapshot: TeacherSnapshot? = null

    fun prime(
        teacher: AuthenticatedTeacher,
        snapshot: TeacherSnapshot,
    ) {
        this.teacher = teacher
        this.snapshot = snapshot
    }

    fun createClass(draft: TeacherClassDraft) {
        val currentTeacher = teacher ?: return
        val currentSnapshot = snapshot ?: return
        if (mutableState.value.savingClass) return

        when (val validation = validateTeacherClassDraft(draft)) {
            TeacherClassValidation.Valid -> Unit
            is TeacherClassValidation.Invalid -> {
                mutableState.update { it.copy(errorMessage = validation.message) }
                return
            }
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    savingClass = true,
                    classSaved = false,
                    errorMessage = null,
                )
            }

            runCatching {
                dataRepository.createClass(
                    teacher = currentTeacher,
                    expectedRevision = currentSnapshot.revision,
                    draft = draft,
                )
            }.onSuccess { updatedSnapshot ->
                snapshot = updatedSnapshot
                mutableState.update {
                    it.copy(
                        savingClass = false,
                        classSaved = true,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(currentTeacher) }
                        .onSuccess { latestSnapshot ->
                            snapshot = latestSnapshot
                            mutableState.update {
                                it.copy(
                                    savingClass = false,
                                    errorMessage = "Newer web changes were loaded. Review and add the class again.",
                                )
                            }
                        }
                        .onFailure { refreshError ->
                            mutableState.update {
                                it.copy(
                                    savingClass = false,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            savingClass = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun deleteClass(teacherClass: TeacherClass) {
        val currentTeacher = teacher ?: return
        val currentSnapshot = snapshot ?: return
        if (mutableState.value.deletingClassId != null) return

        mutableState.update {
            it.copy(
                deletingClassId = teacherClass.id,
                errorMessage = null,
            )
        }

        viewModelScope.launch {
            runCatching {
                dataRepository.deleteClass(
                    teacher = currentTeacher,
                    expectedRevision = currentSnapshot.revision,
                    teacherClass = teacherClass,
                )
            }.onSuccess { updatedSnapshot ->
                snapshot = updatedSnapshot
                mutableState.update {
                    it.copy(
                        deletingClassId = null,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(currentTeacher) }
                        .onSuccess { latestSnapshot ->
                            snapshot = latestSnapshot
                            mutableState.update {
                                it.copy(
                                    deletingClassId = null,
                                    errorMessage = "Newer web changes were loaded. Review and delete the class again.",
                                )
                            }
                        }
                        .onFailure { refreshError ->
                            mutableState.update {
                                it.copy(
                                    deletingClassId = null,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            deletingClassId = null,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun consumeClassSaved() {
        mutableState.update { it.copy(classSaved = false) }
    }

    fun consumeError() {
        mutableState.update { it.copy(errorMessage = null) }
    }
}

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
