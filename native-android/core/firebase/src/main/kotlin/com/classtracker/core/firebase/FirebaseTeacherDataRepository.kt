package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

class FirebaseTeacherDataRepository(
    private val firestore: FirebaseFirestore,
) : TeacherDataRepository {
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

        val mainSnapshot = mainDeferred.await()
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
}
