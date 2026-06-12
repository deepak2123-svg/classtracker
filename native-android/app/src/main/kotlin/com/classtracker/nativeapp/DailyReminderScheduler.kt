package com.classtracker.nativeapp

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.Calendar
import java.util.concurrent.TimeUnit

object DailyReminderScheduler {
    const val WorkName = "ledgr_daily_entry_reminder"

    fun apply(context: Context, preferences: ReminderPreferences) {
        val workManager = WorkManager.getInstance(context.applicationContext)
        if (!preferences.enabled) {
            workManager.cancelUniqueWork(WorkName)
            return
        }

        DailyReminderWorker.ensureChannel(context.applicationContext)
        val request = OneTimeWorkRequestBuilder<DailyReminderWorker>()
            .setInitialDelay(
                nextDelayMillis(preferences.hour, preferences.minute),
                TimeUnit.MILLISECONDS,
            )
            .build()
        workManager.enqueueUniqueWork(
            WorkName,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    fun nextDelayMillis(
        hour: Int,
        minute: Int,
        nowMillis: Long = System.currentTimeMillis(),
    ): Long {
        val target = Calendar.getInstance().apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, hour.coerceIn(0, 23))
            set(Calendar.MINUTE, minute.coerceIn(0, 59))
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= nowMillis) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
            while (get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }
        return (target.timeInMillis - nowMillis).coerceAtLeast(TimeUnit.MINUTES.toMillis(1))
    }
}
