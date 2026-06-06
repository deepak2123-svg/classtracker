package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherSnapshot
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.firestore.FirebaseFirestoreException
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val checkingSession: Boolean = true,
    val teacher: AuthenticatedTeacher? = null,
    val snapshot: TeacherSnapshot? = null,
    val loadingData: Boolean = false,
    val authenticating: Boolean = false,
    val refreshing: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val authRepository: TeacherAuthRepository,
    private val dataRepository: TeacherDataRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()

    private var loadJob: Job? = null
    private var loadedUid: String? = null

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                when (session) {
                    AuthSession.Loading -> {
                        mutableState.update { it.copy(checkingSession = true) }
                    }
                    AuthSession.SignedOut -> {
                        loadedUid = null
                        loadJob?.cancel()
                        mutableState.value = MainUiState(checkingSession = false)
                    }
                    is AuthSession.SignedIn -> {
                        mutableState.update {
                            it.copy(
                                checkingSession = false,
                                teacher = session.teacher,
                                authenticating = false,
                                errorMessage = null,
                            )
                        }
                        if (loadedUid != session.teacher.uid) {
                            loadedUid = session.teacher.uid
                            loadTeacherData(session.teacher, refresh = false)
                        }
                    }
                }
            }
        }
    }

    fun signInWithGoogleIdToken(idToken: String) {
        runAuthAction { authRepository.signInWithGoogleIdToken(idToken) }
    }

    fun signInWithEmail(email: String, password: String) {
        runAuthAction { authRepository.signInWithEmail(email, password) }
    }

    fun refresh() {
        val teacher = mutableState.value.teacher ?: return
        loadTeacherData(teacher, refresh = true)
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
        }
    }

    fun clearError() {
        mutableState.update { it.copy(errorMessage = null) }
    }

    fun reportError(message: String) {
        mutableState.update {
            it.copy(
                authenticating = false,
                errorMessage = message,
            )
        }
    }

    private fun runAuthAction(action: suspend () -> Unit) {
        if (mutableState.value.authenticating) return
        viewModelScope.launch {
            mutableState.update { it.copy(authenticating = true, errorMessage = null) }
            runCatching { action() }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            authenticating = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
        }
    }

    private fun loadTeacherData(
        teacher: AuthenticatedTeacher,
        refresh: Boolean,
    ) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            mutableState.update {
                it.copy(
                    loadingData = !refresh && it.snapshot == null,
                    refreshing = refresh,
                    errorMessage = null,
                )
            }
            runCatching { dataRepository.loadTeacherSnapshot(teacher) }
                .onSuccess { snapshot ->
                    mutableState.update {
                        it.copy(
                            snapshot = snapshot,
                            loadingData = false,
                            refreshing = false,
                            errorMessage = null,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            loadingData = false,
                            refreshing = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
        }
    }
}

private fun Throwable.toFriendlyMessage(): String = when (this) {
    is TeacherDataMissingException -> message.orEmpty()
    is FirebaseNetworkException -> "Unable to reach the server. Check your connection."
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
