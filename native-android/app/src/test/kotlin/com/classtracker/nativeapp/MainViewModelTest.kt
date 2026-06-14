package com.classtracker.nativeapp

import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
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
import kotlinx.coroutines.flow.flow
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

    @Test
    fun feedbackListenerFailureDoesNotCrashSignedInWorkspace() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val authRepository = FakeAuthRepository()
        val viewModel = MainViewModel(
            authRepository,
            FakeDataRepository(snapshotFor(teacher)),
            FailingFeedbackRepository(),
        )

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()

        assertEquals("teacher-1", viewModel.state.value.snapshot?.profile?.uid)
        assertEquals(
            "Feedback is temporarily unavailable.",
            viewModel.state.value.feedbackErrorMessage,
        )
        assertEquals(null, viewModel.state.value.errorMessage)
    }

    @Test
    fun deletingClassReplacesSnapshotAndClearsProgress() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val teacherClass = TeacherClass(
            id = "class-1",
            sectionName = "11th",
            instituteName = "Institute",
            subjectName = "GS",
            startTime = null,
            endTime = null,
            createdAt = 1L,
        )
        val original = snapshotFor(teacher).copy(classes = listOf(teacherClass))
        val updated = original.copy(classes = emptyList(), revision = 2L)
        val authRepository = FakeAuthRepository()
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.deleteClass(teacherClass)

        assertEquals(emptyList<TeacherClass>(), viewModel.state.value.snapshot?.classes)
        assertEquals("class-1", viewModel.state.value.deletingClassId)

        advanceUntilIdle()

        assertEquals(1, dataRepository.deleteClassCount)
        assertEquals(emptyList<TeacherClass>(), viewModel.state.value.snapshot?.classes)
        assertEquals(null, viewModel.state.value.deletingClassId)
    }

    @Test
    fun deletingAllTrashedEntriesClearsBinOptimistically() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val trashedEntry = TeacherTrashedEntry(
            id = "entry-1",
            classId = "class-1",
            className = "11th",
            instituteName = "Institute",
            dateKey = "2026-06-07",
            title = "Motion",
            body = "",
            tag = "note",
            status = "completed",
            timeStart = "09:00",
            timeEnd = "10:00",
            teacherName = "Teacher",
            createdAt = 1L,
            deletedAt = 2L,
        )
        val original = snapshotFor(teacher).copy(trashedEntries = listOf(trashedEntry))
        val updated = original.copy(trashedEntries = emptyList(), revision = 2L)
        val authRepository = FakeAuthRepository()
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.deleteAllTrashedEntries()

        assertEquals(emptyList<TeacherTrashedEntry>(), viewModel.state.value.snapshot?.trashedEntries)
        assertEquals(true, viewModel.state.value.deletingAllTrashedEntries)

        advanceUntilIdle()

        assertEquals(1, dataRepository.deleteAllTrashedEntriesCount)
        assertFalse(viewModel.state.value.deletingAllTrashedEntries)
    }

    @Test
    fun deletingOneTrashedEntryRemovesOnlyThatEntryOptimistically() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher("teacher-1", "Teacher", "teacher@example.com", null)
        val first = trashedEntry("entry-1")
        val second = trashedEntry("entry-2")
        val original = snapshotFor(teacher).copy(trashedEntries = listOf(first, second))
        val updated = original.copy(trashedEntries = listOf(second), revision = 2L)
        val authRepository = FakeAuthRepository()
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.deleteTrashedEntry(first)

        assertEquals(listOf("entry-2"), viewModel.state.value.snapshot?.trashedEntries?.map { it.id })
        assertEquals("entry-1", viewModel.state.value.deletingTrashedEntryId)

        advanceUntilIdle()

        assertEquals(1, dataRepository.deleteTrashedEntryCount)
        assertEquals(null, viewModel.state.value.deletingTrashedEntryId)
    }

    @Test
    fun deletingAccountMarksDepartureThenDeletesAuthentication() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher("teacher-1", "Teacher", "teacher@example.com", null)
        val authRepository = FakeAuthRepository()
        val dataRepository = FakeDataRepository(snapshotFor(teacher))
        val viewModel = MainViewModel(authRepository, dataRepository, FakeFeedbackRepository())

        authRepository.sessions.value = AuthSession.SignedIn(teacher)
        advanceUntilIdle()
        viewModel.deleteAccount()
        advanceUntilIdle()

        assertEquals(listOf(true), dataRepository.departureUpdates)
        assertEquals(1, authRepository.deleteAccountCount)
        assertEquals(null, viewModel.state.value.teacher)
    }
}

private fun trashedEntry(id: String) = TeacherTrashedEntry(
    id = id,
    classId = "class-1",
    className = "11th",
    instituteName = "Institute",
    dateKey = "2026-06-07",
    title = "Motion",
    body = "",
    tag = "note",
    status = "completed",
    timeStart = "09:00",
    timeEnd = "10:00",
    teacherName = "Teacher",
    createdAt = 1L,
    deletedAt = 2L,
)

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

    override suspend fun createAccount(name: String, email: String, password: String) = Unit

    override suspend fun signOut() {
        sessions.value = AuthSession.SignedOut
    }

    var deleteAccountCount = 0

    override suspend fun deleteAccount() {
        deleteAccountCount += 1
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

private class FailingFeedbackRepository : TeacherFeedbackRepository {
    override fun observeConversation(uid: String): Flow<TeacherFeedbackConversation> = flow {
        error("Missing or insufficient permissions.")
    }

    override suspend fun sendMessage(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    ) = Unit

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
    var deleteClassCount: Int = 0
        private set
    var deleteAllTrashedEntriesCount: Int = 0
        private set
    var deleteTrashedEntryCount: Int = 0
        private set
    val departureUpdates = mutableListOf<Boolean>()

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

    override suspend fun deleteClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        teacherClass: TeacherClass,
    ): TeacherSnapshot {
        deleteClassCount += 1
        return savedSnapshot
    }

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

    override suspend fun deleteAllTrashedEntries(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
    ): TeacherSnapshot {
        deleteAllTrashedEntriesCount += 1
        return savedSnapshot
    }

    override suspend fun deleteTrashedEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot {
        deleteTrashedEntryCount += 1
        return savedSnapshot
    }

    override suspend fun setTeacherDeparted(
        teacher: AuthenticatedTeacher,
        departed: Boolean,
    ) {
        departureUpdates += departed
    }
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
