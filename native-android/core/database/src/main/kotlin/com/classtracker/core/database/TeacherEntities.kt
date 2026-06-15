package com.classtracker.core.database

import androidx.room.Entity
import androidx.room.Index

@Entity(tableName = "teacher_profiles", primaryKeys = ["uid"])
data class TeacherProfileEntity(
    val uid: String,
    val name: String,
    val email: String,
    val photoUrl: String?,
    val subjects: String,
    val institutes: String,
    val subjectIds: String,
    val subjectAssignmentVersion: Long,
)

@Entity(tableName = "teacher_metadata", primaryKeys = ["uid"])
data class TeacherMetadataEntity(
    val uid: String,
    val availableInstitutes: String,
    val configuredInstituteCount: Int,
    val revision: Long,
    val isFromCache: Boolean,
    val loadedAtMillis: Long,
)

@Entity(tableName = "teacher_classes", primaryKeys = ["uid", "classId"])
data class TeacherClassEntity(
    val uid: String,
    val classId: String,
    val sectionName: String,
    val instituteName: String,
    val subjectName: String,
    val startTime: String?,
    val endTime: String?,
    val createdAt: Long,
    val timeSlots: String,
)

@Entity(tableName = "teacher_entries", primaryKeys = ["uid", "entryId"])
data class TeacherEntryEntity(
    val uid: String,
    val entryId: String,
    val classId: String,
    val dateKey: String,
    val title: String,
    val body: String,
    val tag: String,
    val status: String,
    val timeStart: String?,
    val timeEnd: String?,
    val teacherName: String?,
    val createdAt: Long,
    val syllabusTemplateId: String,
    val syllabusVersion: Int,
    val syllabusChapterId: String,
    val syllabusChapterTitle: String,
    val completedSyllabusTopicIds: String,
    val syllabusChapterCompleted: Boolean,
)

@Entity(
    tableName = "teacher_trashed_entries",
    primaryKeys = ["uid", "entryId"],
    indices = [
        Index(value = ["uid", "classId"]),
    ],
)
data class TeacherTrashedEntryEntity(
    val uid: String,
    val entryId: String,
    val classId: String,
    val className: String,
    val instituteName: String,
    val dateKey: String,
    val title: String,
    val body: String,
    val tag: String,
    val status: String,
    val timeStart: String?,
    val timeEnd: String?,
    val teacherName: String?,
    val createdAt: Long,
    val deletedAt: Long,
    val syllabusTemplateId: String,
    val syllabusVersion: Int,
    val syllabusChapterId: String,
    val syllabusChapterTitle: String,
    val completedSyllabusTopicIds: String,
    val syllabusChapterCompleted: Boolean,
)

@Entity(
    tableName = "entry_mutations",
    primaryKeys = ["mutationId"],
    indices = [
        Index(value = ["uid", "state", "queuedAt"]),
        Index(value = ["uid", "resolvedEntryId"]),
    ],
)
data class EntryMutationEntity(
    val mutationId: String,
    val uid: String,
    val operation: String,
    val expectedRevision: Long,
    val resolvedEntryId: String,
    val entryId: String?,
    val classId: String,
    val dateKey: String,
    val title: String,
    val body: String,
    val tag: String,
    val status: String,
    val timeStart: String,
    val timeEnd: String,
    val teacherName: String?,
    val createdAt: Long?,
    val deletedAt: Long?,
    val syllabusTemplateId: String,
    val syllabusVersion: Int,
    val syllabusChapterId: String,
    val syllabusChapterTitle: String,
    val completedSyllabusTopicIds: String,
    val syllabusChapterCompleted: Boolean,
    val state: String,
    val attemptCount: Int,
    val lastError: String?,
    val queuedAt: Long,
    val updatedAt: Long,
)

object MutationOperation {
    const val Upsert = "UPSERT"
    const val Delete = "DELETE"
    const val Restore = "RESTORE"
}

internal object MutationState {
    const val Pending = "PENDING"
    const val Syncing = "SYNCING"
    const val Failed = "FAILED"
}
