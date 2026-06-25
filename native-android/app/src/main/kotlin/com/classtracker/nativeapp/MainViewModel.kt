package com.classtracker.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataMissingException
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherEntryConflictException
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClassValidation
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.toTrashedEntry
import com.classtracker.core.model.validateTeacherClassDraft
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
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val checkingSession: Boolean = true,
    val teacher: AuthenticatedTeacher? = null,
    val snapshot: TeacherSnapshot? = null,
    val loadingData: Boolean = false,
    val authenticating: Boolean = false,
    val savingClass: Boolean = false,
    val deletingClassId: String? = null,
    val deletingAllTrashedEntries: Boolean = false,
    val deletingTrashedEntryId: String? = null,
    val deletingAccount: Boolean = false,
    val classSaved: Boolean = false,
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
    private var snapshotJob: Job? = null
    private var loadedUid: String? = null
    private var availableSectionsByInstitute: Map<String, List<String>> = emptyMap()
    private var entryMutationInFlight = false

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

    fun createAccount(
        name: String,
        email: String,
        password: String,
    ) {
        runAuthAction { authRepository.createAccount(name, email, password) }
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

        mutableState.update {
            it.copy(
                snapshot = snapshot.copy(
                    classes = snapshot.classes.filterNot { item -> item.id == teacherClass.id },
                    entries = snapshot.entries.filterNot { entry -> entry.classId == teacherClass.id },
                ),
                deletingClassId = teacherClass.id,
                errorMessage = null,
            )
        }
        viewModelScope.launch {
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
                            snapshot = snapshot,
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

    fun deleteEntry(
        entry: TeacherEntry,
        teacherClass: TeacherClass,
    ) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (entryMutationInFlight) return
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
        if (entryMutationInFlight) return
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

    fun deleteAllTrashedEntries() {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.deletingAllTrashedEntries || snapshot.trashedEntries.isEmpty()) return

        mutableState.update {
            it.copy(
                snapshot = snapshot.copy(trashedEntries = emptyList()),
                deletingAllTrashedEntries = true,
                errorMessage = null,
            )
        }
        viewModelScope.launch {
            runCatching {
                dataRepository.deleteAllTrashedEntries(
                    teacher = teacher,
                    expectedRevision = snapshot.revision,
                )
            }.onSuccess { updatedSnapshot ->
                mutableState.update {
                    it.copy(
                        snapshot = updatedSnapshot.withAvailableSections(),
                        deletingAllTrashedEntries = false,
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
                                    deletingAllTrashedEntries = false,
                                    errorMessage = "Newer web changes were loaded. Review the recycle bin and try again.",
                                )
                            }
                        }
                        .onFailure { refreshError ->
                            mutableState.update {
                                it.copy(
                                    snapshot = snapshot,
                                    deletingAllTrashedEntries = false,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            snapshot = snapshot,
                            deletingAllTrashedEntries = false,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun deleteTrashedEntry(entry: TeacherTrashedEntry) {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        val snapshot = current.snapshot ?: return
        if (current.deletingTrashedEntryId != null) return

        mutableState.update {
            it.copy(
                snapshot = snapshot.copy(
                    trashedEntries = snapshot.trashedEntries.filterNot { item ->
                        item.id == entry.id
                    },
                ),
                deletingTrashedEntryId = entry.id,
                errorMessage = null,
            )
        }
        viewModelScope.launch {
            runCatching {
                dataRepository.deleteTrashedEntry(
                    teacher = teacher,
                    expectedRevision = snapshot.revision,
                    entry = entry,
                )
            }.onSuccess { updatedSnapshot ->
                mutableState.update {
                    it.copy(
                        snapshot = updatedSnapshot.withAvailableSections(),
                        deletingTrashedEntryId = null,
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
                                    deletingTrashedEntryId = null,
                                    errorMessage = "Newer web changes were loaded. Review the recycle bin and try again.",
                                )
                            }
                        }
                        .onFailure { refreshError ->
                            mutableState.update {
                                it.copy(
                                    snapshot = snapshot,
                                    deletingTrashedEntryId = null,
                                    errorMessage = refreshError.toFriendlyMessage(),
                                )
                            }
                        }
                } else {
                    mutableState.update {
                        it.copy(
                            snapshot = snapshot,
                            deletingTrashedEntryId = null,
                            errorMessage = error.toFriendlyMessage(),
                        )
                    }
                }
            }
        }
    }

    fun deleteAccount() {
        val current = mutableState.value
        val teacher = current.teacher ?: return
        if (current.deletingAccount) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(deletingAccount = true, errorMessage = null)
            }
            runCatching {
                dataRepository.setTeacherDeparted(teacher, departed = true)
                try {
                    authRepository.deleteAccount()
                } catch (error: Throwable) {
                    runCatching {
                        dataRepository.setTeacherDeparted(teacher, departed = false)
                    }
                    throw error
                }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        deletingAccount = false,
                        errorMessage = error.toFriendlyMessage(),
                    )
                }
            }
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
        if (entryMutationInFlight) return
        entryMutationInFlight = true
        viewModelScope.launch {
            try {
                if (mutableState.value.errorMessage != null) {
                    mutableState.update { it.copy(errorMessage = null) }
                }
                runCatching { action() }
                    .onSuccess { updatedSnapshot ->
                        val mergedSnapshot = updatedSnapshot.withAvailableSections()
                        mutableState.update {
                            it.copy(
                                snapshot = mergedSnapshot,
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
                                            errorMessage = "Newer web changes were loaded. Review and try again.",
                                        )
                                    }
                                }
                                .onFailure { refreshError ->
                                    mutableState.update {
                                        it.copy(errorMessage = refreshError.toFriendlyMessage())
                                    }
                                }
                        } else {
                            mutableState.update {
                                it.copy(errorMessage = error.toFriendlyMessage())
                            }
                        }
                    }
            } finally {
                entryMutationInFlight = false
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
                            errorMessage = null,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            loadingData = false,
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
