package com.classtracker.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        TeacherProfileEntity::class,
        TeacherMetadataEntity::class,
        TeacherClassEntity::class,
        TeacherEntryEntity::class,
        EntryMutationEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class LedgrDatabase : RoomDatabase() {
    abstract fun teacherDao(): TeacherDao

    companion object {
        fun create(context: Context): LedgrDatabase = Room.databaseBuilder(
            context,
            LedgrDatabase::class.java,
            "ledgr-teacher.db",
        ).build()
    }
}
