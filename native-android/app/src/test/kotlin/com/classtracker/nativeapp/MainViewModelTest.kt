package com.classtracker.nativeapp

import com.classtracker.core.firebase.AuthSession
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
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
        val viewModel = MainViewModel(authRepository, dataRepository)

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

private class FakeDataRepository(
    private val snapshot: TeacherSnapshot,
) : TeacherDataRepository {
    var loadCount: Int = 0
        private set

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot {
        loadCount += 1
        return snapshot
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
