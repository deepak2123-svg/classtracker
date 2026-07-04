package com.ledgr.timetable.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        InstituteEntity::class,
        TimetableEntity::class,
        SlotEntity::class,
        StaffEntity::class,
        SectionEntity::class,
        MappingEntity::class,
        AvailabilityEntity::class,
        GeneratedPeriodEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class TimetableDatabase : RoomDatabase() {
    abstract fun dao(): TimetableDao

    companion object {
        @Volatile
        private var instance: TimetableDatabase? = null

        fun get(context: Context): TimetableDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    TimetableDatabase::class.java,
                    "ledgr-timetable.db",
                ).build().also { instance = it }
            }
    }
}
