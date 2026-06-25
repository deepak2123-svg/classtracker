package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherSyllabusRepository
import com.classtracker.core.model.PublishedSyllabus
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

data class SyllabiUiState(
    val teacherUid: String = "",
    val publishedSyllabi: List<PublishedSyllabus> = emptyList(),
    val loading: Boolean = false,
    val loaded: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class SyllabiViewModel @Inject constructor(
    private val authRepository: TeacherAuthRepository,
    private val syllabusRepository: TeacherSyllabusRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(SyllabiUiState())
    val state: StateFlow<SyllabiUiState> = mutableState.asStateFlow()

    private var loadJob: Job? = null

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                when (session) {
                    AuthSession.Loading -> Unit
                    AuthSession.SignedOut -> reset()
                    is AuthSession.SignedIn -> {
                        val uid = session.teacher.uid
                        val current = mutableState.value
                        if (current.teacherUid != uid || !current.loaded) {
                            load(uid)
                        }
                    }
                }
            }
        }
    }

    fun refresh() {
        val uid = mutableState.value.teacherUid.takeIf(String::isNotBlank) ?: return
        load(uid)
    }

    private fun reset() {
        loadJob?.cancel()
        mutableState.value = SyllabiUiState()
    }

    private fun load(uid: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            mutableState.update {
                it.copy(
                    teacherUid = uid,
                    loading = true,
                    errorMessage = null,
                )
            }
            runCatching { syllabusRepository.loadPublishedSyllabi(uid) }
                .onSuccess { syllabi ->
                    mutableState.update {
                        it.copy(
                            teacherUid = uid,
                            publishedSyllabi = syllabi,
                            loading = false,
                            loaded = true,
                            errorMessage = null,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            teacherUid = uid,
                            loading = false,
                            loaded = true,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
        }
    }
}

private fun Throwable.toFriendlyMessage(): String = when (this) {
    is FirebaseNetworkException -> "Unable to reach the server. Check your connection."
    is FirebaseAuthException -> when (errorCode) {
        "ERROR_USER_DISABLED" -> "This account is disabled."
        "ERROR_INVALID_CREDENTIAL" -> "Your saved login expired. Sign in again."
        else -> localizedMessage ?: "Authentication failed. Try again."
    }
    is FirebaseFirestoreException -> when (code) {
        FirebaseFirestoreException.Code.PERMISSION_DENIED ->
            "You do not have permission to view syllabus."
        FirebaseFirestoreException.Code.UNAVAILABLE ->
            "Syllabus is temporarily unavailable. Check your connection."
        else -> localizedMessage ?: "Could not load syllabus."
    }
    else -> localizedMessage ?: "Could not load syllabus."
}
