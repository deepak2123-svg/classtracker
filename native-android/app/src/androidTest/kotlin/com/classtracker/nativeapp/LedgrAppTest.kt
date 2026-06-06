package com.classtracker.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

class LedgrAppTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun launchShowsTeacherWorkspace() {
        composeRule.onNodeWithText("Ledgr").assertIsDisplayed()
        composeRule.onNodeWithText("Teacher workspace").assertIsDisplayed()
        composeRule.onNodeWithText("Today").assertIsDisplayed()
        composeRule.onNodeWithText("Classes").assertIsDisplayed()
        composeRule.onNodeWithText("Profile").assertIsDisplayed()
    }
}
