package com.classtracker.nativeapp

import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherProfile
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
class FeedbackViewModelTest {
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
    fun sendingFeedbackSignalsCompletion() = runTest(dispatcher) {
        val teacher = teacher()
        val feedbackRepository = FakeFeedbackRepository()
        val viewModel = FeedbackViewModel(feedbackRepository)

        viewModel.prime(teacher.uid)
        advanceUntilIdle()
        viewModel.sendFeedback(
            teacher = teacher,
            profile = profileFor(teacher),
            body = "The timetable list is incomplete.",
        )
        advanceUntilIdle()

        assertEquals(listOf("The timetable list is incomplete."), feedbackRepository.sentBodies)
        assertEquals(true, viewModel.state.value.sent)
        assertFalse(viewModel.state.value.sending)

        viewModel.consumeSent()
        assertFalse(viewModel.state.value.sent)
    }

    @Test
    fun feedbackListenerFailureDoesNotCrashSignedInWorkspace() = runTest(dispatcher) {
        val teacher = teacher()
        val viewModel = FeedbackViewModel(FailingFeedbackRepository())

        viewModel.prime(teacher.uid)
        advanceUntilIdle()

        assertEquals(emptyList<com.classtracker.core.model.TeacherFeedbackMessage>(), viewModel.state.value.conversation.messages)
        assertEquals(
            "Feedback is temporarily unavailable.",
            viewModel.state.value.unavailableMessage,
        )
        assertEquals(null, viewModel.state.value.errorMessage)
    }
}

private fun teacher() = AuthenticatedTeacher(
    uid = "teacher-1",
    displayName = "Teacher",
    email = "teacher@example.com",
    photoUrl = null,
)

private fun profileFor(teacher: AuthenticatedTeacher) = TeacherProfile(
    uid = teacher.uid,
    name = teacher.displayName.orEmpty(),
    email = teacher.email.orEmpty(),
    photoUrl = teacher.photoUrl,
    subjects = emptyList(),
    institutes = emptyList(),
)

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
    override fun observeConversation(uid: String): Flow<TeacherFeedbackConversation> =
        flow { error("Missing or insufficient permissions.") }

    override suspend fun sendMessage(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    ) = Unit

    override suspend fun markTeacherRead(uid: String) = Unit
}
