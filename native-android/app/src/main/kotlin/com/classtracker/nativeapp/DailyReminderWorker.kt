package com.classtracker.nativeapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar

class DailyReminderWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : Worker(appContext, workerParameters) {
    override fun doWork(): Result {
        val preferences = ReminderPreferenceStore(applicationContext).read()
        val notificationManager = NotificationManagerCompat.from(applicationContext)
        if (preferences.enabled && !todayIsSunday() && notificationManager.areNotificationsEnabled()) {
            ensureChannel(applicationContext)
            notificationManager.notify(
                NotificationId,
                buildNotification(applicationContext).build(),
            )
        }
        DailyReminderScheduler.apply(applicationContext, preferences)
        return Result.success()
    }

    private fun buildNotification(context: Context): NotificationCompat.Builder {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("Time to log today's classes")
            .setContentText("Open Ledgr and add your teaching entries.")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
    }

    private fun todayIsSunday(): Boolean =
        Calendar.getInstance().get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY

    companion object {
        private const val ChannelId = "daily_entry_reminders"
        private const val ChannelName = "Daily entry reminders"
        private const val NotificationId = 4101

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                ChannelId,
                ChannelName,
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "One reminder per teaching day to log class entries."
            }
            manager.createNotificationChannel(channel)
        }
    }
}
