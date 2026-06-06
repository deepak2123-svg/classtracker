package com.classtracker.nativeapp

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

class GoogleCredentialReader(
    private val activity: Activity,
) {
    private val credentialManager = CredentialManager.create(activity)

    suspend fun requestIdToken(serverClientId: String): String {
        val googleOption = GetSignInWithGoogleOption.Builder(
            serverClientId = serverClientId,
        )
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build()

        val credential = credentialManager
            .getCredential(context = activity, request = request)
            .credential

        require(credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "The selected credential is not a Google ID token."
        }

        return GoogleIdTokenCredential
            .createFrom(credential.data)
            .idToken
    }
}

fun Throwable.toSignInMessage(): String = when (this) {
    is GetCredentialCancellationException -> "Sign-in was cancelled."
    is NoCredentialException -> "No eligible Google account is available on this device."
    else -> message?.takeIf { it.isNotBlank() } ?: "Sign-in failed. Please try again."
}
