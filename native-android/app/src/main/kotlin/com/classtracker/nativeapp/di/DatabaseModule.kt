package com.classtracker.nativeapp.di

import android.content.Context
import com.classtracker.core.database.LedgrDatabase
import com.classtracker.core.database.RoomTeacherLocalDataSource
import com.classtracker.core.database.TeacherLocalDataSource
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideLedgrDatabase(
        @ApplicationContext context: Context,
    ): LedgrDatabase = LedgrDatabase.create(context)

    @Provides
    @Singleton
    fun provideTeacherLocalDataSource(
        database: LedgrDatabase,
    ): TeacherLocalDataSource = RoomTeacherLocalDataSource(database)
}
