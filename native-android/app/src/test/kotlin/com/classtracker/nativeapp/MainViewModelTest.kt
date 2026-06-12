package com.classtracker.nativeapp

import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTrashedEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun signedInSessionLoadsOnceUntilManualRefresh() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val authRepository = FakeAuthRepository()
        val dataRepository = FakeDataRepository(snapshotFor(teacher))
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()

        assertEquals(1, dataRepository.loadCount)
        assertEquals("teacher-1", viewModel.state.value.snapshot?.profile?.uid)
        assertFalse(viewModel.state.value.loadingData)

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        assertEquals(1, dataRepository.loadCount)

        viewModel.refresh()
        advanceUntilIdle()
        assertEquals(2, dataRepository.loadCount)
        assertFalse(viewModel.state.value.refreshing)
    }

    @Test
    fun savingEntryReplacesSnapshotAndSignalsCompletion() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val authRepository = FakeAuthRepository()
        val original = snapshotFor(teacher)
        val updated = original.copy(revision = 2)
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.saveEntry(
            TeacherEntryDraft(
                classId = "class-1",
                dateKey = "2026-06-07",
                title = "Motion",
                timeStart = "09:00",
            ),
        )
        advanceUntilIdle()

        assertEquals(1, dataRepository.saveCount)
        assertEquals(2L, viewModel.state.value.snapshot?.revision)
        assertEquals(true, viewModel.state.value.entrySaved)
        assertFalse(viewModel.state.value.savingEntry)

        viewModel.consumeEntrySaved()
        assertFalse(viewModel.state.value.entrySaved)
    }

    @Test
    fun revisionConflictRecognizesAlreadyCommittedMutation() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val draft = TeacherEntryDraft(
            mutationId = "native-fixed-id",
            classId = "class-1",
            dateKey = "2026-06-07",
            title = "Motion",
            timeStart = "09:00",
        )
        val original = snapshotFor(teacher)
        val latest = original.copy(
            revision = 2,
            entries = listOf(
                TeacherEntry(
                    id = draft.mutationId,
                    classId = draft.classId,
                    dateKey = draft.dateKey,
                    title = draft.title,
                    body = "",
                    tag = "note",
                    status = "",
                    timeStart = draft.timeStart,
                    timeEnd = null,
                    teacherName = "Teacher",
                    createdAt = 1L,
                ),
            ),
        )
        val authRepository = FakeAuthRepository()
        val dataRepository = RevisionConflictRepository(original, latest)
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.saveEntry(draft)
        advanceUntilIdle()

        assertEquals(2L, viewModel.state.value.snapshot?.revision)
        assertEquals(true, viewModel.state.value.entrySaved)
        assertEquals(null, viewModel.state.value.errorMessage)
    }

    @Test
    fun sendingFeedbackSignalsCompletion() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val authRepository = FakeAuthRepository()
        val feedbackRepository = FakeFeedbackRepository()
        val viewModel = MainViewModel(
            authRepository,
            FakeDataRepository(snapshotFor(teacher)),
            feedbackRepository,
        )

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.sendFeedback("The timetable list is incomplete.")
        advanceUntilIdle()

        assertEquals(listOf("The timetable list is incomplete."), feedbackRepository.sentBodies)
        assertEquals(true, viewModel.state.value.feedbackSent)
        assertFalse(viewModel.state.value.sendingFeedback)

        viewModel.consumeFeedbackSent()
        assertFalse(viewModel.state.value.feedbackSent)
    }
}

private class RevisionConflictRepository(
    private val original: TeacherSnapshot,
    private val latest: TeacherSnapshot,
) : TeacherDataRepository {
    private var loadCount = 0

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot {
        loadCount += 1
        return if (loadCount == 1) original else latest
    }

    override suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot {
        throw TeacherRevisionConflictException(
            expectedRevision = expectedRevision,
            actualRevision = expectedRevision + 1,
        )
    }

    override suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot = latest

    override suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = latest

    override suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = latest
}

private class FakeAuthRepository : TeacherAuthRepository {
    val sessions = MutableStateFlow<AuthSession>(AuthSession.SignedOut)
    override val session: Flow<AuthSession> = sessions

    override suspend fun signInWithGoogleIdToken(idToken: String) = Unit

    override suspend fun signInWithEmail(email: String, password: String) = Unit

    override suspend fun signOut() {
        sessions.value = AuthSession.SignedOut
    }
}

private class FakeFeedbackRepository : TeacherFeedbackRepository {
    val sentBodies = mutableListOf<String>()

    override fun observeConversation(uid: String): Flow<TeacherFeedbackConversation> =
        MutableStateFlow(TeacherFeedbackConversation())

    override suspend fun sendMessage(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    ) {
        sentBodies += body
    }

    override suspend fun markTeacherRead(uid: String) = Unit
}

private class FakeDataRepository(
    private val snapshot: TeacherSnapshot,
    private val savedSnapshot: TeacherSnapshot = snapshot,
) : TeacherDataRepository {
    var loadCount: Int = 0
        private set
    var saveCount: Int = 0
        private set

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot {
        loadCount += 1
        return snapshot
    }

    override suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot {
        saveCount += 1
        return savedSnapshot
    }

    override suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot = savedSnapshot

    override suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = savedSnapshot

    override suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = savedSnapshot
}

private fun snapshotFor(teacher: AuthenticatedTeacher): TeacherSnapshot =
    TeacherSnapshot(
        profile = TeacherProfile(
            uid = teacher.uid,
            name = teacher.displayName.orEmpty(),
            email = teacher.email.orEmpty(),
            photoUrl = teacher.photoUrl,
            subjects = emptyList(),
            institutes = emptyList(),
        ),
        classes = emptyList(),
        entries = emptyList(),
        availableInstitutes = emptyList(),
        configuredInstituteCount = 0,
        revision = 1,
    )
