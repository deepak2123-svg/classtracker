package com.classtracker.core.designsystem

import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

class LedgrHaptics internal constructor(private val view: View) {
    fun selection() = perform(HapticFeedbackConstants.CLOCK_TICK)
    fun confirm() = perform(HapticFeedbackConstants.KEYBOARD_TAP)
    fun warning() = perform(HapticFeedbackConstants.LONG_PRESS)
    fun dragStart() = perform(HapticFeedbackConstants.LONG_PRESS)
    fun dragDrop() = perform(HapticFeedbackConstants.KEYBOARD_TAP)

    private fun perform(type: Int) {
        if (!view.isInEditMode) {
            view.performHapticFeedback(type)
        }
    }
}

@Composable
fun rememberLedgrHaptics(): LedgrHaptics {
    val view = LocalView.current
    return remember(view) { LedgrHaptics(view) }
}
