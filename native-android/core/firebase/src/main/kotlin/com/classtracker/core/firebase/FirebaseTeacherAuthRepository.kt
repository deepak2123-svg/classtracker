package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirebaseTeacherAuthRepository(
    private val auth: FirebaseAuth,
) : TeacherAuthRepository {
    override val session: Flow<AuthSession> = callbackFlow {
        trySend(auth.currentUser.toSession())
        val listener = FirebaseAuth.AuthStateListener { currentAuth ->
            trySend(currentAuth.currentUser.toSession())
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    override suspend fun signInWithGoogleIdToken(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }

    override suspend fun signInWithEmail(email: String, password: String) {
        auth.signInWithEmailAndPassword(email.trim(), password).await()
    }

    override suspend fun signOut() {
        auth.signOut()
    }
}

private fun com.google.firebase.auth.FirebaseUser?.toSession(): AuthSession =
    if (this == null) {
        AuthSession.SignedOut
    } else {
        AuthSession.SignedIn(
            teacher = AuthenticatedTeacher(
                uid = uid,
                displayName = displayName,
                email = email,
                photoUrl = photoUrl?.toString(),
            ),
        )
    }
