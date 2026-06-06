package com.classtracker.nativeapp

import android.content.Context
import androidx.core.content.edit
import com.classtracker.core.designsystem.LedgrThemeMode

class ThemePreferenceStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "ledgr_native_preferences",
        Context.MODE_PRIVATE,
    )

    fun read(): LedgrThemeMode = when (preferences.getString(ThemeKey, null)) {
        LedgrThemeMode.Dark.name -> LedgrThemeMode.Dark
        LedgrThemeMode.System.name -> LedgrThemeMode.System
        else -> LedgrThemeMode.Light
    }

    fun write(themeMode: LedgrThemeMode) {
        preferences.edit {
            putString(ThemeKey, themeMode.name)
        }
    }

    private companion object {
        const val ThemeKey = "theme_mode"
    }
}
