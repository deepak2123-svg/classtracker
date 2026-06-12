package com.classtracker.nativeapp

import android.app.Application
import android.util.Log
import androidx.work.Configuration
import com.classtracker.core.sync.LedgrWorkerFactory
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class LedgrApplication : Application(), Configuration.Provider {
    @Inject
    lateinit var workerFactory: LedgrWorkerFactory

    override fun onCreate() {
        super.onCreate()
        FirebaseBootstrap.getOrInitialize(this)
        AdminNoticeMessagingService.ensureChannel(this)
        val topic = AdminNoticeTopics.forEnvironment(BuildConfig.ENVIRONMENT)
        FirebaseMessaging.getInstance()
            .subscribeToTopic(topic)
            .addOnSuccessListener {
                Log.i(AdminNoticeLogTag, "Subscribed to admin notice topic: $topic")
            }
            .addOnFailureListener { error ->
                Log.w(AdminNoticeLogTag, "Admin notice topic subscription failed.", error)
            }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}

internal const val AdminNoticeLogTag = "LedgrAdminNotices"
