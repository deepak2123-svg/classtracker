package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherEntryConflictException
import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClassValidation
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherEntryValidation
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.toTrashedEntry
import com.classtracker.core.model.validateTeacherClassDraft
import com.classtracker.core.model.validateTeacherEntryDraft
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
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

data class MainUiState(
    val checkingSession: Boolean = true,
    val teacher: AuthenticatedTeacher? = null,
    val snapshot: TeacherSnapshot? = null,
    val loadingData: Boolean = false,
    val authenticating: Boolean = false,
    val refreshing: Boolean = false,
    val savingEntry: Boolean = false,
    val savingClass: Boolean = false,
    val deletingClassId: String? = null,
    val mutatingEntry: Boolean = false,
    val entrySaved: Boolean = false,
    val classSaved: Boolean = false,
    val syncSummary: TeacherSyncSummary = TeacherSyncSummary.Idle,
    val feedbackConversation: TeacherFeedbackConversation = TeacherFeedbackConversation(),
    val feedbackErrorMessage: String? = null,
    val sendingFeedback: Boolean = false,
    val feedbackSent: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val authRepository: TeacherAuthRepository,
    private val dataRepository: TeacherDataRepository,
    private val feedbackRepository: TeacherFeedbackRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()

    private var loadJob: Job? = null
    private var snapshotJob: Job? = null
    private var syncSummaryJob: Job? = null
    private var feedbackJob: Job? = null
    private var loadedUid: String? = null
    private var availableSectionsByInstitute: Map<String, List<String>> = emptyMap()

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                when (session) {
                    AuthSession.Loading -> {
                        mutableState.update { it.copy(checkingSession = true) }
                    }
                    AuthSession.SignedOut -> {
                        loadedUid = null
                        availableSectionsByInstitute = emptyMap()
                        loadJob?.cancel()
                        snapshotJob?.cancel()
                        syncSummaryJob?.cancel()
                        feedbackJob?.cancel()
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
                            observeLocalData(session.teacher.uid)
                            observeFeedback(session.teacher.uid)
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

    fun retrySync() {
        val uid = mutableState.value.teacher?.uid ?: return
        viewModelScope.launch {
            dataRepository.retryFailed(uid)
        }
    }

    fun sendFeedback(body: String) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val profile = current.snapshot?.profile ?: return
        if (current.sendingFeedback) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    sendingFeedback = true,
                    feedbackSent = false,
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
                mutableState.update {
                    it.copy(
                        sendingFeedback = false,
                        feedbackSent = true,
                    )
                }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        sendingFeedback = false,
                        errorMessage = error.toFriendlyMessage(),
                    )
                }
            }
        }
    }

    fun markFeedbackRead() {
        val uid = mutableState.value.teacher?.uid ?: return
        if (mutableState.value.feedbackConversation.unreadByTeacher == 0) return
        viewModelScope.launch {
            runCatching { feedbackRepository.markTeacherRead(uid) }
        }
    }

    fun consumeFeedbackSent() {
        mutableState.update { it.copy(feedbackSent = false) }
    }

    fun saveEntry(draft: TeacherEntryDraft) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.savingEntry) return

        when (
            val validation = validateTeacherEntryDraft(
                draft = draft,
                existingEntries = snapshot.entriesForClass(draft.classId),
            )
        ) {
            TeacherEntryValidation.Valid -> Unit
            is TeacherEntryValidation.Overlap -> Unit // UI soft-warned; allow save
            is TeacherEntryValidation.Invalid -> {
                mutableState.update { it.copy(errorMessage = validation.message) }
                return
            }
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    savingEntry = true,
                    entrySaved = false,
                    errorMessage = null,
                )
            }
            runCatching {
                dataRepository.saveEntry(
                    teacher = teacher,
                    expectedRevision = snapshot.revision,
                    draft = draft,
                )
            }.onSuccess { updatedSnapshot ->
                val mergedSnapshot = updatedSnapshot.withAvailableSections()
                mutableState.update {
                    it.copy(
                        snapshot = mergedSnapshot,
                        savingEntry = false,
                        entrySaved = true,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(teacher) }
                        .onSuccess { latestSnapshot ->
                            val mergedSnapshot = latestSnapshot.withAvailableSections()
                            val alreadySaved = latestSnapshot.entries.any { entry ->
                                entry.id == draft.resolvedIdOrNull() &&
                                    entry.classId == draft.classId &&
                                    entry.dateKey == draft.dateKey &&
                                    entry.title == draft.title.trim() &&
                                    entry.timeStart.orEmpty() == draft.timeStart.trim()
                            }
                            mutableState.update {
                                it.copy(
                                    snapshot = mergedSnapshot,
                                    savingEntry = false,
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
                                    savingEntry = false,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            savingEntry = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun createClass(draft: TeacherClassDraft) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.savingClass) return

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
                    teacher = teacher,
                    expectedRevision = snapshot.revision,
                    draft = draft,
                )
            }.onSuccess { updatedSnapshot ->
                val mergedSnapshot = updatedSnapshot.withAvailableSections()
                mutableState.update {
                    it.copy(
                        snapshot = mergedSnapshot,
                        savingClass = false,
                        classSaved = true,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(teacher) }
                        .onSuccess { latestSnapshot ->
                            val mergedSnapshot = latestSnapshot.withAvailableSections()
                            mutableState.update {
                                it.copy(
                                    snapshot = mergedSnapshot,
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
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.deletingClassId != null) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    deletingClassId = teacherClass.id,
                    errorMessage = null,
                )
            }
            runCatching {
                dataRepository.deleteClass(
                    teacher = teacher,
                    expectedRevision = snapshot.revision,
                    teacherClass = teacherClass,
                )
            }.onSuccess { updatedSnapshot ->
                mutableState.update {
                    it.copy(
                        snapshot = updatedSnapshot.withAvailableSections(),
                        deletingClassId = null,
                        errorMessage = null,
                    )
                }
            }.onFailure { error ->
                if (error is TeacherRevisionConflictException) {
                    runCatching { dataRepository.loadTeacherSnapshot(teacher) }
                        .onSuccess { latestSnapshot ->
                            mutableState.update {
                                it.copy(
                                    snapshot = latestSnapshot.withAvailableSections(),
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

    fun consumeEntrySaved() {
        mutableState.update { it.copy(entrySaved = false) }
    }

    fun consumeClassSaved() {
        mutableState.update { it.copy(classSaved = false) }
    }

    fun deleteEntry(
        entry: TeacherEntry,
        teacherClass: TeacherClass,
    ) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.mutatingEntry) return
        if (entry.syncState != TeacherEntrySyncState.Synced) {
            mutableState.update {
                it.copy(errorMessage = "Wait for this entry to sync before deleting it.")
            }
            return
        }

        val trashedEntry = entry.toTrashedEntry(
            className = teacherClass.sectionName,
            instituteName = teacherClass.instituteName,
            deletedAt = System.currentTimeMillis(),
        )
        runEntryMutation {
            dataRepository.deleteEntry(
                teacher = teacher,
                expectedRevision = snapshot.revision,
                entry = trashedEntry,
            )
        }
    }

    fun restoreEntry(entry: TeacherTrashedEntry) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.mutatingEntry) return
        if (entry.syncState == TeacherEntrySyncState.Syncing) {
            mutableState.update {
                it.copy(errorMessage = "Wait for this entry to sync before restoring it.")
            }
            return
        }

        runEntryMutation {
            dataRepository.restoreEntry(
                teacher = teacher,
                expectedRevision = snapshot.revision,
                entry = entry,
            )
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

    private fun runEntryMutation(action: suspend () -> TeacherSnapshot) {
        val teacher = mutableState.value.teacher ?: return
        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    mutatingEntry = true,
                    errorMessage = null,
                )
            }
            runCatching { action() }
                .onSuccess { updatedSnapshot ->
                    val mergedSnapshot = updatedSnapshot.withAvailableSections()
                    mutableState.update {
                        it.copy(
                            snapshot = mergedSnapshot,
                            mutatingEntry = false,
                            errorMessage = null,
                        )
                    }
                }
                .onFailure { error ->
                    if (error is TeacherRevisionConflictException) {
                        runCatching { dataRepository.loadTeacherSnapshot(teacher) }
                            .onSuccess { latestSnapshot ->
                                val mergedSnapshot = latestSnapshot.withAvailableSections()
                                mutableState.update {
                                    it.copy(
                                        snapshot = mergedSnapshot,
                                        mutatingEntry = false,
                                        errorMessage = "Newer web changes were loaded. Review and try again.",
                                    )
                                }
                            }
                            .onFailure { refreshError ->
                                mutableState.update {
                                    it.copy(
                                        mutatingEntry = false,
                                        errorMessage = refreshError.toFriendlyMessage(),
                                    )
                                }
                            }
                    } else {
                        mutableState.update {
                            it.copy(
                                mutatingEntry = false,
                                errorMessage = error.toFriendlyMessage(),
                            )
                        }
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
                    val mergedSnapshot = snapshot.withAvailableSections()
                    mutableState.update {
                        it.copy(
                            snapshot = mergedSnapshot,
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

    private fun observeLocalData(uid: String) {
        snapshotJob?.cancel()
        snapshotJob = viewModelScope.launch {
            dataRepository.observeTeacherSnapshot(uid).collectLatest { snapshot ->
                if (snapshot != null) {
                    val mergedSnapshot = snapshot.withAvailableSections()
                    mutableState.update {
                        it.copy(
                            snapshot = mergedSnapshot,
                            loadingData = false,
                        )
                    }
                }
            }
        }

        syncSummaryJob?.cancel()
        syncSummaryJob = viewModelScope.launch {
            dataRepository.observeSyncSummary(uid).collectLatest { summary ->
                mutableState.update { it.copy(syncSummary = summary) }
            }
        }
    }

    private fun observeFeedback(uid: String) {
        feedbackJob?.cancel()
        feedbackJob = viewModelScope.launch {
            feedbackRepository.observeConversation(uid)
                .catch {
                    mutableState.update {
                        it.copy(
                            feedbackConversation = TeacherFeedbackConversation(),
                            feedbackErrorMessage = "Feedback is temporarily unavailable.",
                        )
                    }
                }
                .collectLatest { conversation ->
                    mutableState.update {
                        it.copy(
                            feedbackConversation = conversation,
                            feedbackErrorMessage = null,
                        )
                    }
                }
        }
    }

    private fun TeacherSnapshot.withAvailableSections(): TeacherSnapshot {
        val sections = availableSectionsByInstitute
        if (sections.isNotEmpty()) {
            this@MainViewModel.availableSectionsByInstitute = sections
            return this
        }
        return if (this@MainViewModel.availableSectionsByInstitute.isEmpty()) {
            this
        } else {
            copy(availableSectionsByInstitute = this@MainViewModel.availableSectionsByInstitute)
        }
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
