package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import kotlinx.coroutines.flow.Flow

sealed interface AuthSession {
    data object Loading : AuthSession
    data object SignedOut : AuthSession
    data class SignedIn(val teacher: AuthenticatedTeacher) : AuthSession
}

interface TeacherAuthRepository {
    val session: Flow<AuthSession>

    suspend fun signInWithGoogleIdToken(idToken: String)

    suspend fun signInWithEmail(email: String, password: String)

    suspend fun signOut()
}
