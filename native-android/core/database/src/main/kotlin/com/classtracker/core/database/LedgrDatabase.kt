package com.classtracker.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        TeacherProfileEntity::class,
        TeacherMetadataEntity::class,
        TeacherClassEntity::class,
        TeacherEntryEntity::class,
        TeacherTrashedEntryEntity::class,
        EntryMutationEntity::class,
    ],
    version = 3,
    exportSchema = true,
)
abstract class LedgrDatabase : RoomDatabase() {
    abstract fun teacherDao(): TeacherDao

    companion object {
        fun create(context: Context): LedgrDatabase = Room.databaseBuilder(
            context,
            LedgrDatabase::class.java,
            "ledgr-teacher.db",
        )
            .addMigrations(MIGRATION_1_2)
            .addMigrations(MIGRATION_2_3)
            .build()

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `teacher_trashed_entries` (
                        `uid` TEXT NOT NULL,
                        `entryId` TEXT NOT NULL,
                        `classId` TEXT NOT NULL,
                        `className` TEXT NOT NULL,
                        `instituteName` TEXT NOT NULL,
                        `dateKey` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `body` TEXT NOT NULL,
                        `tag` TEXT NOT NULL,
                        `status` TEXT NOT NULL,
                        `timeStart` TEXT,
                        `timeEnd` TEXT,
                        `teacherName` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `deletedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`uid`, `entryId`)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE INDEX IF NOT EXISTS `index_teacher_trashed_entries_uid_classId`
                    ON `teacher_trashed_entries` (`uid`, `classId`)
                    """.trimIndent(),
                )
                db.execSQL("ALTER TABLE `entry_mutations` ADD COLUMN `teacherName` TEXT")
                db.execSQL("ALTER TABLE `entry_mutations` ADD COLUMN `deletedAt` INTEGER")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    ALTER TABLE `teacher_classes`
                    ADD COLUMN `timeSlots` TEXT NOT NULL DEFAULT ''
                    """.trimIndent(),
                )
            }
        }
    }
}
