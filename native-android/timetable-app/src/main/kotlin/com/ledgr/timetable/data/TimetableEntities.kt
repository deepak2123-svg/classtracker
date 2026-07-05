package com.ledgr.timetable.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

const val TIMETABLE_STATUS_ACTIVE = "ACTIVE"
const val TIMETABLE_STATUS_SUPERSEDED = "SUPERSEDED"

const val VALID_UNTIL_TOMORROW = "TOMORROW"
const val VALID_UNTIL_END_OF_WEEK = "END_OF_WEEK"
const val VALID_UNTIL_END_OF_MONTH = "END_OF_MONTH"
const val VALID_UNTIL_END_OF_YEAR = "END_OF_YEAR"

const val TIME_SLOT_TYPE_CLASS = "CLASS"
const val TIME_SLOT_TYPE_BREAK = "BREAK"

@Entity(tableName = "institutes")
data class Institute(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
)

@Entity(
    tableName = "teachers",
    foreignKeys = [
        ForeignKey(
            entity = Institute::class,
            parentColumns = ["id"],
            childColumns = ["instituteId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("instituteId")],
)
data class Teacher(
    @PrimaryKey val id: String,
    val instituteId: String,
    val name: String,
    val createdAt: Long,
)

@Entity(
    tableName = "sections",
    foreignKeys = [
        ForeignKey(
            entity = Institute::class,
            parentColumns = ["id"],
            childColumns = ["instituteId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("instituteId")],
)
data class Section(
    @PrimaryKey val id: String,
    val instituteId: String,
    val name: String,
    val createdAt: Long,
)

@Entity(
    tableName = "timetables",
    foreignKeys = [
        ForeignKey(
            entity = Institute::class,
            parentColumns = ["id"],
            childColumns = ["instituteId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Timetable::class,
            parentColumns = ["id"],
            childColumns = ["duplicatedFromId"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("instituteId"), Index("duplicatedFromId")],
)
data class Timetable(
    @PrimaryKey val id: String,
    val instituteId: String,
    val createdAt: Long,
    val supersededAt: Long?,
    val validUntil: String,
    val status: String,
    val duplicatedFromId: String?,
)

@Entity(
    tableName = "time_slots",
    foreignKeys = [
        ForeignKey(
            entity = Timetable::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId")],
)
data class TimeSlot(
    @PrimaryKey val id: String,
    val timetableId: String,
    val startTime: String,
    val endTime: String,
    val type: String,
    val sortOrder: Int,
    val createdAt: Long,
)

@Entity(
    tableName = "assignments",
    foreignKeys = [
        ForeignKey(
            entity = Timetable::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = TimeSlot::class,
            parentColumns = ["id"],
            childColumns = ["slotId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Section::class,
            parentColumns = ["id"],
            childColumns = ["sectionId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Teacher::class,
            parentColumns = ["id"],
            childColumns = ["teacherId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("timetableId"),
        Index("slotId"),
        Index("sectionId"),
        Index("teacherId"),
    ],
)
data class Assignment(
    @PrimaryKey val id: String,
    val timetableId: String,
    val slotId: String,
    val sectionId: String,
    val subjectName: String,
    val teacherId: String,
    val createdAt: Long,
)

@Entity(
    tableName = "teacher_unavailability",
    foreignKeys = [
        ForeignKey(
            entity = Timetable::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Teacher::class,
            parentColumns = ["id"],
            childColumns = ["teacherId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = TimeSlot::class,
            parentColumns = ["id"],
            childColumns = ["slotId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId"), Index("teacherId"), Index("slotId")],
)
data class TeacherUnavailability(
    @PrimaryKey val id: String,
    val timetableId: String,
    val teacherId: String,
    val slotId: String,
    val createdAt: Long,
)

@Entity(
    tableName = "subject_teacher_defaults",
    foreignKeys = [
        ForeignKey(
            entity = Institute::class,
            parentColumns = ["id"],
            childColumns = ["instituteId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Teacher::class,
            parentColumns = ["id"],
            childColumns = ["teacherId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Section::class,
            parentColumns = ["id"],
            childColumns = ["sectionId"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("instituteId"), Index("teacherId"), Index("sectionId")],
)
data class SubjectTeacherDefault(
    @PrimaryKey val id: String,
    val instituteId: String,
    val subjectName: String,
    val teacherId: String,
    val sectionId: String?,
    val createdAt: Long,
)
