package com.classtracker.nativeapp

import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.firebase.TeacherRevisionConflictException
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
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
        val viewModel = MainViewModel(
            authRepository,
            dataRepository,
        )

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
        assertFalse(viewModel.state.value.loadingData)
    }

    @Test
    fun entryFlowSavingReplacesSnapshotAndSignalsCompletion() = runTest(dispatcher) {
        val teacher = AuthenticatedTeacher(
            uid = "teacher-1",
            displayName = "Teacher",
            email = "teacher@example.com",
            photoUrl = null,
        )
        val original = snapshotFor(teacher)
        val updated = original.copy(revision = 2)
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = EntryFlowViewModel(dataRepository)

        viewModel.prime(teacher, original)
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
        assertEquals(2L, updated.revision)
        assertEquals(true, viewModel.state.value.entrySaved)
        assertFalse(viewModel.state.value.saving)

        viewModel.consumeEntrySaved()
        assertFalse(viewModel.state.value.entrySaved)
    }

    @Test
    fun entryFlowRevisionConflictRecognizesAlreadyCommittedMutation() = runTest(dispatcher) {
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
        val dataRepository = RevisionConflictRepository(latest)
        val viewModel = EntryFlowViewModel(dataRepository)

        viewModel.prime(teacher, original)
        viewModel.saveEntry(draft)
        advanceUntilIdle()

        assertEquals(true, viewModel.state.value.entrySaved)
        assertEquals(null, viewModel.state.value.errorMessage)
    }

    @Test
    fun classMutationDeleteClearsProgress() = runTest(dispatcher) {
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
        val dataRepository = FakeDataRepository(original, updated)
        val viewModel = ClassMutationViewModel(dataRepository)

        viewModel.prime(teacher, original)
        viewModel.deleteClass(teacherClass)

        assertEquals("class-1", viewModel.state.value.deletingClassId)

        advanceUntilIdle()

        assertEquals(1, dataRepository.deleteClassCount)
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
        val viewModel = MainViewModel(
            authRepository,
            dataRepository,
        )

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
        val viewModel = MainViewModel(
            authRepository,
            dataRepository,
        )

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
        val viewModel = MainViewModel(
            authRepository,
            dataRepository,
        )

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
    private val latest: TeacherSnapshot,
) : TeacherDataRepository {
    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot = latest

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
