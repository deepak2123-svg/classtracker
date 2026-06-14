package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTrashedEntry
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

class FirebaseTeacherDataRepository(
    private val firestore: FirebaseFirestore,
) : TeacherRemoteDataSource {
    private val entryWriter = FirebaseTeacherEntryWriter(firestore)

    override suspend fun loadTeacherSnapshot(
        teacher: AuthenticatedTeacher,
    ): TeacherSnapshot = coroutineScope {
        val mainDeferred = async {
            firestore.document("users/${teacher.uid}/appdata/main").get().await()
        }
        val teacherIndexDeferred = async {
            runCatching {
                firestore.document("teachers/${teacher.uid}").get().await().data.orEmpty()
            }.getOrDefault(emptyMap())
        }
        val institutesDeferred = async {
            runCatching {
                firestore.document("config/institutes").get().await().data.orEmpty()
            }.getOrDefault(emptyMap())
        }
        val sectionsDeferred = async {
            runCatching {
                firestore.document("config/sections").get().await().data.orEmpty()
            }.getOrDefault(emptyMap())
        }

        var mainSnapshot = mainDeferred.await()
        if (!mainSnapshot.exists()) {
            createTeacherWorkspace(teacher)
            mainSnapshot = firestore.document("users/${teacher.uid}/appdata/main").get().await()
        }
        if (!mainSnapshot.exists()) throw TeacherDataMissingException()

        val main = mainSnapshot.data.orEmpty()
        val classes = legacyClassMaps(main)
        val noteDocuments = classes.map { classMap ->
            async {
                val classId = classMap.string("id")
                classId to runCatching {
                    firestore.document("users/${teacher.uid}/appdata/notes_$classId")
                        .get()
                        .await()
                        .data
                        .orEmpty()
                }.getOrDefault(emptyMap())
            }
        }.awaitAll().toMap()

        mapLegacyTeacherSnapshot(
            teacher = teacher,
            main = main,
            teacherIndex = teacherIndexDeferred.await(),
            noteDocuments = noteDocuments,
            instituteConfig = institutesDeferred.await(),
            sectionConfig = sectionsDeferred.await(),
            isFromCache = mainSnapshot.metadata.isFromCache,
            loadedAtMillis = System.currentTimeMillis(),
        )
    }

    override suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
    ): TeacherSnapshot = entryWriter.saveEntry(
        teacher = teacher,
        expectedRevision = expectedRevision,
        draft = draft,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
    ): TeacherSnapshot = entryWriter.createClass(
        teacher = teacher,
        expectedRevision = expectedRevision,
        draft = draft,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun deleteClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        teacherClass: TeacherClass,
    ): TeacherSnapshot = entryWriter.deleteClass(
        teacher = teacher,
        expectedRevision = expectedRevision,
        teacherClass = teacherClass,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = entryWriter.deleteEntry(
        teacher = teacher,
        expectedRevision = expectedRevision,
        entry = entry,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = entryWriter.restoreEntry(
        teacher = teacher,
        expectedRevision = expectedRevision,
        entry = entry,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun deleteAllTrashedEntries(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
    ): TeacherSnapshot = entryWriter.deleteAllTrashedEntries(
        teacher = teacher,
        expectedRevision = expectedRevision,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun deleteTrashedEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
    ): TeacherSnapshot = entryWriter.deleteTrashedEntry(
        teacher = teacher,
        expectedRevision = expectedRevision,
        entry = entry,
        reload = { loadTeacherSnapshot(teacher) },
    )

    override suspend fun setTeacherDeparted(
        teacher: AuthenticatedTeacher,
        departed: Boolean,
    ) {
        val patch = if (departed) {
            mapOf(
                "accountStatus" to "departed",
                "active" to false,
                "departedAt" to System.currentTimeMillis(),
                "departedBy" to "teacher",
            )
        } else {
            mapOf(
                "accountStatus" to "active",
                "active" to true,
                "departedAt" to FieldValue.delete(),
                "departedBy" to FieldValue.delete(),
            )
        }
        firestore.document("teachers/${teacher.uid}")
            .set(patch, SetOptions.merge())
            .await()
    }

    private suspend fun createTeacherWorkspace(teacher: AuthenticatedTeacher) {
        val mainRef = firestore.document("users/${teacher.uid}/appdata/main")
        val teacherRef = firestore.document("teachers/${teacher.uid}")
        val roleRef = firestore.document("roles/${teacher.uid}")
        val now = System.currentTimeMillis()

        firestore.runTransaction { transaction ->
            val mainSnapshot = transaction.get(mainRef)
            val teacherSnapshot = transaction.get(teacherRef)
            val roleSnapshot = transaction.get(roleRef)

            if (!mainSnapshot.exists()) {
                transaction.set(mainRef, newTeacherMainDocument(teacher, now))
            }
            if (!teacherSnapshot.exists()) {
                transaction.set(teacherRef, newTeacherIndexDocument(teacher, now))
            }
            if (!roleSnapshot.exists()) {
                transaction.set(roleRef, newTeacherRoleDocument(now))
            }
        }.await()
    }
}

internal fun newTeacherMainDocument(
    teacher: AuthenticatedTeacher,
    now: Long,
): Map<String, Any?> = mapOf(
    "profile" to mapOf(
        "name" to teacher.resolvedName(),
        "email" to teacher.email.orEmpty(),
        "photoURL" to teacher.photoUrl.orEmpty(),
        "institutes" to emptyList<String>(),
        "subjects" to emptyList<String>(),
    ),
    "classes" to emptyList<Map<String, Any?>>(),
    "institutes" to emptyList<String>(),
    "trash" to mapOf(
        "classes" to emptyList<Map<String, Any?>>(),
        "notes" to emptyList<Map<String, Any?>>(),
    ),
    "_meta" to mapOf(
        "revision" to 0L,
        "schemaVersion" to 3,
        "updatedAt" to now,
        "createdAt" to now,
        "createdBy" to "native-beta",
    ),
)

internal fun newTeacherIndexDocument(
    teacher: AuthenticatedTeacher,
    now: Long,
): Map<String, Any?> = mapOf(
    "uid" to teacher.uid,
    "name" to teacher.resolvedName(),
    "email" to teacher.email.orEmpty(),
    "photoURL" to teacher.photoUrl.orEmpty(),
    "institutes" to emptyList<String>(),
    "subjects" to emptyList<String>(),
    "assignedSubjects" to emptyList<Map<String, Any?>>(),
    "assignedSubjectIds" to emptyList<String>(),
    "subjectAssignmentVersion" to 0L,
    "classCount" to 0,
    "entryCount" to 0,
    "active" to true,
    "accountStatus" to "active",
    "createdAt" to now,
    "lastActive" to now,
)

internal fun newTeacherRoleDocument(now: Long): Map<String, Any?> = mapOf(
    "role" to "teacher",
    "grantedAt" to now,
    "grantedBy" to "self-signup",
)

private fun AuthenticatedTeacher.resolvedName(): String =
    displayName?.trim()?.takeIf(String::isNotBlank)
        ?: email?.substringBefore("@")?.trim()?.takeIf(String::isNotBlank)
        ?: "Teacher"
