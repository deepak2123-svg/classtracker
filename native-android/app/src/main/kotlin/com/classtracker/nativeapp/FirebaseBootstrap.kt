package com.classtracker.nativeapp

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

object FirebaseBootstrap {
    fun getOrInitialize(context: Context): FirebaseApp {
        FirebaseApp.getApps(context).firstOrNull()?.let { return it }

        val options = FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setStorageBucket(BuildConfig.FIREBASE_STORAGE_BUCKET)
            .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
            .build()

        return requireNotNull(FirebaseApp.initializeApp(context, options)) {
            "Firebase could not be initialized."
        }
    }
}
