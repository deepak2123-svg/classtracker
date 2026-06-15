package com.classtracker.nativeapp.di

import android.content.Context
import com.classtracker.core.firebase.FirebaseTeacherAuthRepository
import com.classtracker.core.firebase.FirebaseTeacherDataRepository
import com.classtracker.core.firebase.FirebaseTeacherFeedbackRepository
import com.classtracker.core.firebase.FirebaseTeacherSyllabusRepository
import com.classtracker.core.firebase.TeacherAuthRepository
import com.classtracker.core.firebase.TeacherFeedbackRepository
import com.classtracker.core.firebase.TeacherRemoteDataSource
import com.classtracker.core.firebase.TeacherSyllabusRepository
import com.classtracker.nativeapp.FirebaseBootstrap
import com.google.firebase.FirebaseApp
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
    ): FirebaseApp = FirebaseBootstrap.getOrInitialize(context)

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
    fun provideTeacherRemoteDataSource(
        firestore: FirebaseFirestore,
    ): TeacherRemoteDataSource = FirebaseTeacherDataRepository(firestore)

    @Provides
    @Singleton
    fun provideTeacherFeedbackRepository(
        firestore: FirebaseFirestore,
    ): TeacherFeedbackRepository = FirebaseTeacherFeedbackRepository(firestore)

    @Provides
    @Singleton
    fun provideTeacherSyllabusRepository(
        firestore: FirebaseFirestore,
    ): TeacherSyllabusRepository = FirebaseTeacherSyllabusRepository(firestore)
}
