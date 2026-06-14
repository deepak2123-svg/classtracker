package com.classtracker.nativeapp

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class AdminNoticeMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val notice = AdminNotice.from(message)
        ensureChannel(this)

        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        NotificationManagerCompat.from(this).notify(
            notice.notificationId,
            buildNotification(notice),
        )
    }

    override fun onNewToken(token: String) {
        FirebaseBootstrap.getOrInitialize(this)
        val topic = AdminNoticeTopics.forEnvironment(BuildConfig.ENVIRONMENT)
        FirebaseMessaging.getInstance()
            .subscribeToTopic(topic)
            .addOnSuccessListener {
                Log.i(AdminNoticeLogTag, "Refreshed admin notice topic: $topic")
            }
            .addOnFailureListener { error ->
                Log.w(AdminNoticeLogTag, "Admin notice token subscription failed.", error)
            }
    }

    private fun buildNotification(notice: AdminNotice): android.app.Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(AdminNoticeIdExtra, notice.id)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            notice.notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, ChannelId)
            .setSmallIcon(R.drawable.ic_stat_ledgr)
            .setContentTitle(notice.title)
            .setContentText(notice.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notice.body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
    }

    companion object {
        const val ChannelId = "admin_notices"
        private const val ChannelName = "Admin notices"
        private const val AdminNoticeIdExtra = "admin_notice_id"

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    ChannelId,
                    ChannelName,
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = "Updates and announcements from your administrator."
                },
            )
        }
    }
}

internal object AdminNoticeTopics {
    fun forEnvironment(environment: String): String =
        if (environment == "production") {
            "teacher_admin_notices"
        } else {
            "teacher_admin_notices_beta"
        }
}

private data class AdminNotice(
    val id: String,
    val title: String,
    val body: String,
) {
    val notificationId: Int
        get() = id.hashCode() and Int.MAX_VALUE

    companion object {
        fun from(message: RemoteMessage): AdminNotice {
            val data = message.data
            return AdminNotice(
                id = data["noticeId"]
                    ?.takeIf(String::isNotBlank)
                    ?: message.messageId
                    ?: System.currentTimeMillis().toString(),
                title = data["title"]
                    ?.takeIf(String::isNotBlank)
                    ?: message.notification?.title
                    ?.takeIf(String::isNotBlank)
                    ?: "Ledgr update",
                body = data["body"]
                    ?.takeIf(String::isNotBlank)
                    ?: message.notification?.body
                    ?.takeIf(String::isNotBlank)
                    ?: "You have a new notice from your administrator.",
            )
        }
    }
}
