package com.ledgr.timetable.data

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        Institute::class,
        Teacher::class,
        Section::class,
        Timetable::class,
        TimeSlot::class,
        Assignment::class,
        TeacherUnavailability::class,
        SubjectTeacherDefault::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class TimetableDatabase : RoomDatabase() {
    abstract fun dao(): TimetableDao
}
