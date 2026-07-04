package com.ledgr.timetable.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "institutes")
data class InstituteEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
)

@Entity(
    tableName = "timetables",
    foreignKeys = [
        ForeignKey(
            entity = InstituteEntity::class,
            parentColumns = ["id"],
            childColumns = ["instituteId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("instituteId"), Index(value = ["instituteId", "status"])],
)
data class TimetableEntity(
    @PrimaryKey val id: String,
    val instituteId: String,
    val name: String,
    val status: String,
    val createdAt: Long,
    val updatedAt: Long,
    val publishedAt: Long?,
    val archivedAt: Long?,
)

@Entity(
    tableName = "slots",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId")],
)
data class SlotEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val label: String,
    val startMinutes: Int,
    val endMinutes: Int,
    val type: String,
    val sortOrder: Int,
)

@Entity(
    tableName = "staff",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId")],
)
data class StaffEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val name: String,
    val subjectsCsv: String,
)

@Entity(
    tableName = "sections",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId")],
)
data class SectionEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val name: String,
    val sortOrder: Int,
)

@Entity(
    tableName = "mappings",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = SectionEntity::class,
            parentColumns = ["id"],
            childColumns = ["sectionId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = StaffEntity::class,
            parentColumns = ["id"],
            childColumns = ["staffId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId"), Index("sectionId"), Index("staffId")],
)
data class MappingEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val sectionId: String,
    val subject: String,
    val staffId: String,
    val frequencyPerWeek: Int,
)

@Entity(
    tableName = "availability",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = StaffEntity::class,
            parentColumns = ["id"],
            childColumns = ["staffId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = SlotEntity::class,
            parentColumns = ["id"],
            childColumns = ["slotId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("timetableId"), Index("staffId"), Index("slotId")],
)
data class AvailabilityEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val staffId: String,
    val day: String,
    val slotId: String,
    val available: Boolean,
)

@Entity(
    tableName = "generated_periods",
    foreignKeys = [
        ForeignKey(
            entity = TimetableEntity::class,
            parentColumns = ["id"],
            childColumns = ["timetableId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = SlotEntity::class,
            parentColumns = ["id"],
            childColumns = ["slotId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = SectionEntity::class,
            parentColumns = ["id"],
            childColumns = ["sectionId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = StaffEntity::class,
            parentColumns = ["id"],
            childColumns = ["staffId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("timetableId"),
        Index("slotId"),
        Index("sectionId"),
        Index("staffId"),
        Index(value = ["timetableId", "day", "slotId", "sectionId"], unique = true),
    ],
)
data class GeneratedPeriodEntity(
    @PrimaryKey val id: String,
    val timetableId: String,
    val day: String,
    val slotId: String,
    val sectionId: String,
    val staffId: String,
    val subject: String,
    val source: String,
)
