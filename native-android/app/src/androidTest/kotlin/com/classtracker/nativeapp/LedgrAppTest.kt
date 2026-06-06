package com.classtracker.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.feature.auth.AuthScreen
import org.junit.Rule
import org.junit.Test

class LedgrAppTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun launchShowsNativeSignIn() {
        composeRule.setContent {
            LedgrTheme(darkTheme = false) {
                AuthScreen(
                    loading = false,
                    errorMessage = null,
                    googleSignInConfigured = false,
                    onGoogleSignIn = {},
                    onEmailSignIn = { _, _ -> },
                    onClearError = {},
                )
            }
        }

        composeRule.onNodeWithText("Ledgr").assertIsDisplayed()
        composeRule.onNodeWithText("Teacher").assertIsDisplayed()
        composeRule.onNodeWithText("Email").assertIsDisplayed()
        composeRule.onNodeWithText("Password").assertIsDisplayed()
        composeRule.onNodeWithText("Sign in").assertIsDisplayed()
    }
}
