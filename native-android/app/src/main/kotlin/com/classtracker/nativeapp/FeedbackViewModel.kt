package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherEntryConflictException
import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherProfile
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
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

data class FeedbackUiState(
    val conversation: TeacherFeedbackConversation = TeacherFeedbackConversation(),
    val unavailableMessage: String? = null,
    val sending: Boolean = false,
    val sent: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class FeedbackViewModel @Inject constructor(
    private val feedbackRepository: TeacherFeedbackRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(FeedbackUiState())
    val state: StateFlow<FeedbackUiState> = mutableState.asStateFlow()

    private var currentUid: String? = null
    private var feedbackJob: Job? = null

    fun prime(uid: String) {
        if (currentUid == uid && feedbackJob != null) return
        currentUid = uid
        mutableState.value = FeedbackUiState()
        feedbackJob?.cancel()
        feedbackJob = viewModelScope.launch {
            feedbackRepository.observeConversation(uid)
                .catch {
                    mutableState.update { current ->
                        current.copy(
                            conversation = TeacherFeedbackConversation(),
                            unavailableMessage = "Feedback is temporarily unavailable.",
                        )
                    }
                }
                .collectLatest { conversation ->
                    mutableState.update { current ->
                        current.copy(
                            conversation = conversation,
                            unavailableMessage = null,
                        )
                    }
                }
        }
    }

    fun sendFeedback(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    ) {
        val uid = currentUid ?: teacher.uid
        if (mutableState.value.sending) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    sending = true,
                    sent = false,
                    errorMessage = null,
                )
            }
            runCatching {
                feedbackRepository.sendMessage(
                    teacher = teacher,
                    profile = profile,
                    body = body,
                )
            }.onSuccess {
                currentUid = uid
                mutableState.update {
                    it.copy(
                        sending = false,
                        sent = true,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        sending = false,
                        sent = false,
                        errorMessage = error.toFriendlyMessage(),
                    )
                }
            }
        }
    }

    fun markFeedbackRead() {
        val uid = currentUid ?: return
        if (mutableState.value.conversation.unreadByTeacher == 0) return
        viewModelScope.launch {
            runCatching { feedbackRepository.markTeacherRead(uid) }
        }
    }

    fun consumeSent() {
        mutableState.update { it.copy(sent = false) }
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
