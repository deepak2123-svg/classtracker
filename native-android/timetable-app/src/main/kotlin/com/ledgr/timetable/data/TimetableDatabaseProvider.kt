package com.ledgr.timetable.data

import android.content.Context
import androidx.room.Room

object TimetableDatabaseProvider {
    @Volatile
    private var database: TimetableDatabase? = null

    fun getDatabase(context: Context): TimetableDatabase {
        return database ?: synchronized(this) {
            database ?: Room.databaseBuilder(
                context.applicationContext,
                TimetableDatabase::class.java,
                "ledgr-timetable.db",
            ).build().also { database = it }
        }
    }
}
