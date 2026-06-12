package com.classtracker.nativeapp

import android.content.Context
import androidx.core.content.edit

data class ReminderPreferences(
    val prompted: Boolean = false,
    val enabled: Boolean = false,
    val hour: Int = 20,
    val minute: Int = 0,
) {
    val timeLabel: String
        get() {
            val hour12 = when (val value = hour % 12) {
                0 -> 12
                else -> value
            }
            val period = if (hour < 12) "AM" else "PM"
            return "$hour12:${minute.toString().padStart(2, '0')} $period"
        }
}

class ReminderPreferenceStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "ledgr_native_reminders",
        Context.MODE_PRIVATE,
    )

    fun read(): ReminderPreferences = ReminderPreferences(
        prompted = preferences.getBoolean(PromptedKey, false),
        enabled = preferences.getBoolean(EnabledKey, false),
        hour = preferences.getInt(HourKey, 20).coerceIn(0, 23),
        minute = preferences.getInt(MinuteKey, 0).coerceIn(0, 59),
    )

    fun write(value: ReminderPreferences) {
        preferences.edit {
            putBoolean(PromptedKey, value.prompted)
            putBoolean(EnabledKey, value.enabled)
            putInt(HourKey, value.hour.coerceIn(0, 23))
            putInt(MinuteKey, value.minute.coerceIn(0, 59))
        }
    }

    private companion object {
        const val PromptedKey = "prompted"
        const val EnabledKey = "enabled"
        const val HourKey = "hour"
        const val MinuteKey = "minute"
    }
}
