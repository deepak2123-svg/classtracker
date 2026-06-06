package com.classtracker.nativeapp.di

import android.content.Context
import com.classtracker.core.firebase.FirebaseTeacherAuthRepository
import com.classtracker.core.firebase.FirebaseTeacherDataRepository
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherDataRepository
import com.classtracker.nativeapp.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {
    @Provides
    @Singleton
    fun provideFirebaseApp(
        @ApplicationContext context: Context,
    ): FirebaseApp {
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

    @Provides
    @Singleton
    fun provideFirebaseAuth(app: FirebaseApp): FirebaseAuth =
        FirebaseAuth.getInstance(app)

    @Provides
    @Singleton
    fun provideFirestore(app: FirebaseApp): FirebaseFirestore =
        FirebaseFirestore.getInstance(app)

    @Provides
    @Singleton
    fun provideTeacherAuthRepository(
        auth: FirebaseAuth,
    ): TeacherAuthRepository = FirebaseTeacherAuthRepository(auth)

    @Provides
    @Singleton
    fun provideTeacherDataRepository(
        firestore: FirebaseFirestore,
    ): TeacherDataRepository = FirebaseTeacherDataRepository(firestore)
}
