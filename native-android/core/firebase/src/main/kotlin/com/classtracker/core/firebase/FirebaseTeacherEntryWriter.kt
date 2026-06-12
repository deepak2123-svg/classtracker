package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClassValidation
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntryValidation
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.resolvedEntryId
import com.classtracker.core.model.validateTeacherClassDraft
import com.classtracker.core.model.validateTeacherEntryDraft
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

internal class FirebaseTeacherEntryWriter(
    private val firestore: FirebaseFirestore,
) {
    suspend fun saveEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherEntryDraft,
        reload: suspend () -> TeacherSnapshot,
    ): TeacherSnapshot {
        val mainReference = firestore.document("users/${teacher.uid}/appdata/main")
        val notesReference = firestore.document(
            "users/${teacher.uid}/appdata/notes_${draft.classId}",
        )
        val teacherReference = firestore.document("teachers/${teacher.uid}")
        val backupReference = firestore.document(
            "users/${teacher.uid}/appdata/main_backup_latest",
        )

        firestore.runTransaction { transaction ->
            val mainSnapshot = transaction.get(mainReference)
            if (!mainSnapshot.exists()) throw TeacherDataMissingException()

            val main = mainSnapshot.data.orEmpty()
            val actualRevision = main.nestedMap("_meta").longValue("revision")
            if (actualRevision != expectedRevision) {
                throw TeacherRevisionConflictException(
                    expectedRevision = expectedRevision,
                    actualRevision = actualRevision,
                )
            }
            if (legacyClassMaps(main).none { it.string("id") == draft.classId }) {
                throw TeacherEntryConflictException(
                    "This class is no longer available. Refresh and try again.",
                )
            }

            val notesSnapshot = transaction.get(notesReference)
            val noteDocument = notesSnapshot.data.orEmpty()
            val existingEntries = mapLegacyEntriesForMutation(
                classId = draft.classId,
                noteDocument = noteDocument,
            )
            when (val validation = validateTeacherEntryDraft(draft, existingEntries)) {
                TeacherEntryValidation.Valid -> Unit
                is TeacherEntryValidation.Overlap -> Unit // UI soft-warned; allow save
                is TeacherEntryValidation.Invalid -> {
                    throw TeacherEntryConflictException(validation.message)
                }
            }

            val now = System.currentTimeMillis()
            val entryMap = buildLegacyEntryMap(
                draft = draft,
                teacherName = main.nestedMap("profile").string("name").ifBlank {
                    teacher.displayName.orEmpty()
                },
                now = now,
            )
            val updatedNotes = upsertLegacyEntry(
                noteDocument = noteDocument,
                dateKey = draft.dateKey,
                entryMap = entryMap,
            )
            val nextRevision = actualRevision + 1
            val source = if (draft.entryId == null) {
                "nativeCreateEntry"
            } else {
                "nativeEditEntry"
            }
            val updatedMain = main.withRevision(
                revision = nextRevision,
                previousRevision = actualRevision,
                updatedAt = now,
                source = source,
            )
            val backupId = "${nextRevision.toString().padStart(6, '0')}_$now"
            val backupPayload = buildBackupPayload(
                main = updatedMain,
                revision = nextRevision,
                savedAt = now,
                source = source,
                backupId = backupId,
            )
            val historyReference = firestore.document(
                "users/${teacher.uid}/appdata/main_backup_$backupId",
            )

            transaction.set(notesReference, updatedNotes)
            transaction.set(mainReference, updatedMain)
            transaction.set(
                teacherReference,
                buildTeacherIndexPatch(
                    teacher = teacher,
                    main = updatedMain,
                    revision = nextRevision,
                    savedAt = now,
                ),
                SetOptions.merge(),
            )
            transaction.set(backupReference, backupPayload)
            transaction.set(historyReference, backupPayload)
        }.await()

        runCatching { pruneBackupHistory(teacher.uid) }
        return reload()
    }

    suspend fun createClass(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        draft: TeacherClassDraft,
        reload: suspend () -> TeacherSnapshot,
    ): TeacherSnapshot {
        when (val validation = validateTeacherClassDraft(draft)) {
            TeacherClassValidation.Valid -> Unit
            is TeacherClassValidation.Invalid -> {
                throw TeacherEntryConflictException(validation.message)
            }
        }

        val mainReference = firestore.document("users/${teacher.uid}/appdata/main")
        val teacherReference = firestore.document("teachers/${teacher.uid}")
        val backupReference = firestore.document(
            "users/${teacher.uid}/appdata/main_backup_latest",
        )
        val now = System.currentTimeMillis()
        val classId = now.toString()
        val notesReference = firestore.document(
            "users/${teacher.uid}/appdata/notes_$classId",
        )

        firestore.runTransaction { transaction ->
            val mainSnapshot = transaction.get(mainReference)
            if (!mainSnapshot.exists()) throw TeacherDataMissingException()

            val main = mainSnapshot.data.orEmpty()
            val actualRevision = main.nestedMap("_meta").longValue("revision")
            if (actualRevision != expectedRevision) {
                throw TeacherRevisionConflictException(
                    expectedRevision = expectedRevision,
                    actualRevision = actualRevision,
                )
            }

            val nextRevision = actualRevision + 1
            val source = "nativeCreateClass"
            val updatedMain = addLegacyClass(
                main = main,
                classMap = buildLegacyClassMap(
                    draft = draft,
                    classId = classId,
                    createdAt = now,
                ),
            ).withRevision(
                revision = nextRevision,
                previousRevision = actualRevision,
                updatedAt = now,
                source = source,
            )
            val backupId = "${nextRevision.toString().padStart(6, '0')}_$now"
            val backupPayload = buildBackupPayload(
                main = updatedMain,
                revision = nextRevision,
                savedAt = now,
                source = source,
                backupId = backupId,
            )
            val historyReference = firestore.document(
                "users/${teacher.uid}/appdata/main_backup_$backupId",
            )

            transaction.set(notesReference, emptyMap<String, Any?>())
            transaction.set(mainReference, updatedMain)
            transaction.set(
                teacherReference,
                buildTeacherIndexPatch(
                    teacher = teacher,
                    main = updatedMain,
                    revision = nextRevision,
                    savedAt = now,
                ),
                SetOptions.merge(),
            )
            transaction.set(backupReference, backupPayload)
            transaction.set(historyReference, backupPayload)
        }.await()

        runCatching { pruneBackupHistory(teacher.uid) }
        return reload()
    }

    suspend fun deleteEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
        reload: suspend () -> TeacherSnapshot,
    ): TeacherSnapshot {
        val mainReference = firestore.document("users/${teacher.uid}/appdata/main")
        val notesReference = firestore.document(
            "users/${teacher.uid}/appdata/notes_${entry.classId}",
        )
        val teacherReference = firestore.document("teachers/${teacher.uid}")
        val backupReference = firestore.document(
            "users/${teacher.uid}/appdata/main_backup_latest",
        )

        firestore.runTransaction { transaction ->
            val mainSnapshot = transaction.get(mainReference)
            if (!mainSnapshot.exists()) throw TeacherDataMissingException()

            val main = mainSnapshot.data.orEmpty()
            val actualRevision = main.nestedMap("_meta").longValue("revision")
            if (actualRevision != expectedRevision) {
                throw TeacherRevisionConflictException(
                    expectedRevision = expectedRevision,
                    actualRevision = actualRevision,
                )
            }
            val classMap = legacyClassMaps(main)
                .firstOrNull { it.string("id") == entry.classId }
                ?: throw TeacherEntryConflictException(
                    "This class is no longer available. Refresh and try again.",
                )

            val notesSnapshot = transaction.get(notesReference)
            val removal = removeLegacyEntry(
                noteDocument = notesSnapshot.data.orEmpty(),
                entryId = entry.id,
            )
            val removedEntry = removal.entryMap
                ?: throw TeacherEntryConflictException(
                    "This entry is no longer available. Refresh and try again.",
                )

            val now = System.currentTimeMillis()
            val trashEntry = buildLegacyTrashEntryMap(
                entry = entry,
                noteEntry = removedEntry,
                classMap = classMap,
                dateKey = requireNotNull(removal.dateKey),
                deletedAt = now,
            )
            val nextRevision = actualRevision + 1
            val source = "nativeDeleteEntry"
            val updatedMain = addLegacyTrashNote(main, trashEntry).withRevision(
                revision = nextRevision,
                previousRevision = actualRevision,
                updatedAt = now,
                source = source,
            )
            val backupId = "${nextRevision.toString().padStart(6, '0')}_$now"
            val backupPayload = buildBackupPayload(
                main = updatedMain,
                revision = nextRevision,
                savedAt = now,
                source = source,
                backupId = backupId,
            )
            val historyReference = firestore.document(
                "users/${teacher.uid}/appdata/main_backup_$backupId",
            )

            transaction.set(notesReference, removal.noteDocument)
            transaction.set(mainReference, updatedMain)
            transaction.set(
                teacherReference,
                buildTeacherIndexPatch(
                    teacher = teacher,
                    main = updatedMain,
                    revision = nextRevision,
                    savedAt = now,
                ),
                SetOptions.merge(),
            )
            transaction.set(backupReference, backupPayload)
            transaction.set(historyReference, backupPayload)
        }.await()

        runCatching { pruneBackupHistory(teacher.uid) }
        return reload()
    }

    suspend fun restoreEntry(
        teacher: AuthenticatedTeacher,
        expectedRevision: Long,
        entry: TeacherTrashedEntry,
        reload: suspend () -> TeacherSnapshot,
    ): TeacherSnapshot {
        val mainReference = firestore.document("users/${teacher.uid}/appdata/main")
        val notesReference = firestore.document(
            "users/${teacher.uid}/appdata/notes_${entry.classId}",
        )
        val teacherReference = firestore.document("teachers/${teacher.uid}")
        val backupReference = firestore.document(
            "users/${teacher.uid}/appdata/main_backup_latest",
        )

        firestore.runTransaction { transaction ->
            val mainSnapshot = transaction.get(mainReference)
            if (!mainSnapshot.exists()) throw TeacherDataMissingException()

            val main = mainSnapshot.data.orEmpty()
            val actualRevision = main.nestedMap("_meta").longValue("revision")
            if (actualRevision != expectedRevision) {
                throw TeacherRevisionConflictException(
                    expectedRevision = expectedRevision,
                    actualRevision = actualRevision,
                )
            }
            if (legacyClassMaps(main).none { it.string("id") == entry.classId }) {
                throw TeacherEntryConflictException(
                    "This class is no longer available. Refresh and try again.",
                )
            }

            val restoredTrash = removeLegacyTrashNote(main, entry.id)
                ?: throw TeacherEntryConflictException(
                    "This entry is no longer in the recycle bin. Refresh and try again.",
                )
            val draft = restoredTrash.trashEntry.toDraftForRestore()
            val notesSnapshot = transaction.get(notesReference)
            val noteDocument = notesSnapshot.data.orEmpty()
            val existingEntries = mapLegacyEntriesForMutation(
                classId = draft.classId,
                noteDocument = noteDocument,
            )
            when (val validation = validateTeacherEntryDraft(draft, existingEntries)) {
                TeacherEntryValidation.Valid -> Unit
                is TeacherEntryValidation.Overlap -> Unit // UI soft-warned; allow restore
                is TeacherEntryValidation.Invalid -> {
                    throw TeacherEntryConflictException(validation.message)
                }
            }

            val now = System.currentTimeMillis()
            val updatedNotes = upsertLegacyEntry(
                noteDocument = noteDocument,
                dateKey = draft.dateKey,
                entryMap = buildLegacyEntryMapFromTrash(restoredTrash.trashEntry),
            )
            val nextRevision = actualRevision + 1
            val source = "nativeRestoreEntry"
            val updatedMain = restoredTrash.main.withRevision(
                revision = nextRevision,
                previousRevision = actualRevision,
                updatedAt = now,
                source = source,
            )
            val backupId = "${nextRevision.toString().padStart(6, '0')}_$now"
            val backupPayload = buildBackupPayload(
                main = updatedMain,
                revision = nextRevision,
                savedAt = now,
                source = source,
                backupId = backupId,
            )
            val historyReference = firestore.document(
                "users/${teacher.uid}/appdata/main_backup_$backupId",
            )

            transaction.set(notesReference, updatedNotes)
            transaction.set(mainReference, updatedMain)
            transaction.set(
                teacherReference,
                buildTeacherIndexPatch(
                    teacher = teacher,
                    main = updatedMain,
                    revision = nextRevision,
                    savedAt = now,
                ),
                SetOptions.merge(),
            )
            transaction.set(backupReference, backupPayload)
            transaction.set(historyReference, backupPayload)
        }.await()

        runCatching { pruneBackupHistory(teacher.uid) }
        return reload()
    }

    private suspend fun pruneBackupHistory(uid: String) {
        val appData = firestore.collection("users/$uid/appdata").get().await()
        appData.documents
            .filter { document ->
                document.id.startsWith("main_backup_") &&
                    document.id != "main_backup_latest"
            }
            .sortedWith(
                compareByDescending<DocumentSnapshot> {
                    it.getLong("savedAt") ?: 0L
                }.thenByDescending {
                    it.getLong("revision") ?: 0L
                },
            )
            .drop(12)
            .forEach { stale ->
                runCatching { stale.reference.delete().await() }
            }
    }
}

private fun mapLegacyEntriesForMutation(
    classId: String,
    noteDocument: Map<String, Any?>,
): List<TeacherEntry> = noteDocument.entries.flatMap { (dateKey, rawEntries) ->
    (rawEntries as? List<*>).orEmpty().mapNotNull { rawEntry ->
        val map = rawEntry.asStringMap() ?: return@mapNotNull null
        TeacherEntry(
            id = map.string("id"),
            classId = classId,
            dateKey = dateKey,
            title = map.string("title"),
            body = map.string("body"),
            tag = map.string("tag").ifBlank { "note" },
            status = map.string("status"),
            timeStart = map.string("timeStart").ifBlank { null },
            timeEnd = map.string("timeEnd").ifBlank { null },
            teacherName = map.string("teacherName").ifBlank { null },
            createdAt = map.longValue("created"),
        )
    }
}

internal fun buildLegacyClassMap(
    draft: TeacherClassDraft,
    classId: String,
    createdAt: Long,
): Map<String, Any?> = linkedMapOf(
    "id" to classId,
    "institute" to draft.instituteName.trim(),
    "section" to draft.sectionName.trim(),
    "subject" to draft.subjectName.trim(),
    "created" to createdAt,
)

internal fun addLegacyClass(
    main: Map<String, Any?>,
    classMap: Map<String, Any?>,
): Map<String, Any?> {
    val institute = classMap.string("institute")
    val section = classMap.string("section")
    val subject = classMap.string("subject")
    val profile = main.nestedMap("profile")
    return main.toMutableMap().apply {
        put("classes", legacyClassMaps(main) + classMap)
        put("institutes", uniqueLabels(stringListValue("institutes") + institute))
        put("sections", uniqueLabels(stringListValue("sections") + section))
        put("subjects", uniqueLabels(stringListValue("subjects") + subject))
        put(
            "profile",
            profile.toMutableMap().apply {
                put("institutes", uniqueLabels(stringListValue("institutes") + institute))
                if (subject.isNotBlank()) {
                    put("subjects", uniqueLabels(stringListValue("subjects") + subject))
                } else {
                    putIfAbsent("subjects", stringListValue("subjects"))
                }
            },
        )
    }
}

internal fun buildLegacyEntryMap(
    draft: TeacherEntryDraft,
    teacherName: String,
    now: Long,
): Map<String, Any?> = linkedMapOf(
    "id" to draft.resolvedEntryId(now.toString()),
    "title" to draft.title.trim(),
    "body" to draft.body.trim(),
    "tag" to draft.tag.ifBlank { "note" },
    "status" to draft.status.trim(),
    "timeStart" to draft.timeStart.trim(),
    "timeEnd" to draft.timeEnd.trim(),
    "teacherName" to teacherName.trim(),
    "created" to (draft.createdAt ?: now),
)

internal fun upsertLegacyEntry(
    noteDocument: Map<String, Any?>,
    dateKey: String,
    entryMap: Map<String, Any?>,
): Map<String, Any?> {
    val entryId = entryMap["id"].toString()
    val originalDay = (noteDocument[dateKey] as? List<*>)
        .orEmpty()
        .mapNotNull(Any?::asStringMap)
    val existingIndex = originalDay.indexOfFirst { it.string("id") == entryId }
    val existingDay = originalDay.filterNot { it.string("id") == entryId }
    val updatedDay = if (existingIndex >= 0) {
        existingDay.toMutableList().apply {
            add(existingIndex.coerceAtMost(size), entryMap)
        }
    } else {
        listOf(entryMap) + existingDay
    }
    return noteDocument.mapValues { (_, rawEntries) ->
        (rawEntries as? List<*>)
            .orEmpty()
            .mapNotNull(Any?::asStringMap)
            .filterNot { it.string("id") == entryId }
    }.filterValues(List<*>::isNotEmpty).toMutableMap().apply {
        put(dateKey, updatedDay)
    }
}

internal data class LegacyEntryRemoval(
    val noteDocument: Map<String, Any?>,
    val entryMap: Map<String, Any?>?,
    val dateKey: String?,
)

internal fun removeLegacyEntry(
    noteDocument: Map<String, Any?>,
    entryId: String,
): LegacyEntryRemoval {
    var removedEntry: Map<String, Any?>? = null
    var removedDateKey: String? = null
    val updated = noteDocument.mapValues { (dateKey, rawEntries) ->
        (rawEntries as? List<*>)
            .orEmpty()
            .mapNotNull(Any?::asStringMap)
            .filterNot { entry ->
                val shouldRemove = entry.string("id") == entryId
                if (shouldRemove && removedEntry == null) {
                    removedEntry = entry
                    removedDateKey = dateKey
                }
                shouldRemove
            }
    }.filterValues(List<*>::isNotEmpty)
    return LegacyEntryRemoval(
        noteDocument = updated,
        entryMap = removedEntry,
        dateKey = removedDateKey,
    )
}

internal fun addLegacyTrashNote(
    main: Map<String, Any?>,
    trashEntry: Map<String, Any?>,
): Map<String, Any?> {
    val entryId = trashEntry["id"]?.toString().orEmpty()
    val trash = main.nestedMap("trash")
    val existingNotes = (trash["notes"] as? List<*>)
        .orEmpty()
        .mapNotNull(Any?::asStringMap)
        .filterNot { it.string("id") == entryId }
    return main.toMutableMap().apply {
        put(
            "trash",
            trash.toMutableMap().apply {
                put("notes", existingNotes + trashEntry)
                putIfAbsent("classes", (trash["classes"] as? List<*>).orEmpty())
            },
        )
    }
}

internal data class LegacyTrashRestore(
    val main: Map<String, Any?>,
    val trashEntry: Map<String, Any?>,
)

internal fun removeLegacyTrashNote(
    main: Map<String, Any?>,
    entryId: String,
): LegacyTrashRestore? {
    val trash = main.nestedMap("trash")
    var restored: Map<String, Any?>? = null
    val remainingNotes = (trash["notes"] as? List<*>)
        .orEmpty()
        .mapNotNull(Any?::asStringMap)
        .filterNot { entry ->
            val shouldRestore = entry.string("id") == entryId
            if (shouldRestore && restored == null) {
                restored = entry
            }
            shouldRestore
        }
    val trashEntry = restored ?: return null
    val updatedMain = main.toMutableMap().apply {
        put(
            "trash",
            trash.toMutableMap().apply {
                put("notes", remainingNotes)
                putIfAbsent("classes", (trash["classes"] as? List<*>).orEmpty())
            },
        )
    }
    return LegacyTrashRestore(
        main = updatedMain,
        trashEntry = trashEntry,
    )
}

internal fun buildLegacyTrashEntryMap(
    entry: TeacherTrashedEntry,
    noteEntry: Map<String, Any?>,
    classMap: Map<String, Any?>,
    dateKey: String,
    deletedAt: Long,
): Map<String, Any?> = linkedMapOf(
    "id" to entry.id,
    "title" to noteEntry.string("title").ifBlank { entry.title },
    "body" to noteEntry.string("body").ifBlank { entry.body },
    "tag" to noteEntry.string("tag").ifBlank { entry.tag.ifBlank { "note" } },
    "status" to noteEntry.string("status").ifBlank { entry.status },
    "timeStart" to noteEntry.string("timeStart").ifBlank { entry.timeStart.orEmpty() },
    "timeEnd" to noteEntry.string("timeEnd").ifBlank { entry.timeEnd.orEmpty() },
    "teacherName" to noteEntry.string("teacherName").ifBlank { entry.teacherName.orEmpty() },
    "created" to noteEntry.longValue("created").takeIf { it > 0L }.let {
        it ?: entry.createdAt
    },
    "classId" to entry.classId,
    "className" to classMap.string("section").ifBlank { entry.className },
    "institute" to classMap.string("institute").ifBlank { entry.instituteName },
    "dateKey" to dateKey,
    "deletedAt" to deletedAt,
)

internal fun buildLegacyEntryMapFromTrash(
    trashEntry: Map<String, Any?>,
): Map<String, Any?> = linkedMapOf(
    "id" to trashEntry.string("id"),
    "title" to trashEntry.string("title"),
    "body" to trashEntry.string("body"),
    "tag" to trashEntry.string("tag").ifBlank { "note" },
    "status" to trashEntry.string("status"),
    "timeStart" to trashEntry.string("timeStart"),
    "timeEnd" to trashEntry.string("timeEnd"),
    "teacherName" to trashEntry.string("teacherName"),
    "created" to trashEntry.longValue("created"),
)

private fun Map<String, Any?>.toDraftForRestore(): TeacherEntryDraft = TeacherEntryDraft(
    entryId = string("id"),
    classId = string("classId"),
    dateKey = string("dateKey"),
    title = string("title"),
    body = string("body"),
    tag = string("tag").ifBlank { "note" },
    status = string("status"),
    timeStart = string("timeStart"),
    timeEnd = string("timeEnd"),
    createdAt = longValue("created"),
)

private fun Map<String, Any?>.withRevision(
    revision: Long,
    previousRevision: Long,
    updatedAt: Long,
    source: String,
): Map<String, Any?> = toMutableMap().apply {
    put(
        "_meta",
        nestedMap("_meta").toMutableMap().apply {
            put("updatedAt", updatedAt)
            put("schemaVersion", 3)
            put("revision", revision)
            put("previousRevision", previousRevision)
            put("source", source)
        },
    )
}

private fun buildBackupPayload(
    main: Map<String, Any?>,
    revision: Long,
    savedAt: Long,
    source: String,
    backupId: String,
): Map<String, Any?> {
    val classes = legacyClassMaps(main)
    return mapOf(
        "data" to main,
        "savedAt" to savedAt,
        "revision" to revision,
        "classCount" to classes.size,
        "instituteCount" to classes
            .map { it.string("institute").lowercase() }
            .filter(String::isNotBlank)
            .distinct()
            .size,
        "source" to source,
        "backupId" to backupId,
    )
}

private fun buildTeacherIndexPatch(
    teacher: AuthenticatedTeacher,
    main: Map<String, Any?>,
    revision: Long,
    savedAt: Long,
): Map<String, Any?> {
    val profile = main.nestedMap("profile")
    val classes = legacyClassMaps(main)
    val institutes = uniqueLabels(
        classes.map { it.string("institute") } +
            profile.stringListValue("institutes"),
    )
    val subjects = uniqueLabels(
        classes.map { it.string("subject") } +
            profile.stringListValue("subjects"),
    )
    return mapOf(
        "uid" to teacher.uid,
        "name" to profile.string("name").ifBlank {
            teacher.displayName.orEmpty()
        },
        "email" to teacher.email.orEmpty(),
        "photoURL" to teacher.photoUrl.orEmpty(),
        "institutes" to institutes,
        "subjects" to subjects,
        "classCount" to classes.size,
        "mainRevision" to revision,
        "lastActive" to savedAt,
    )
}

private fun Any?.asStringMap(): Map<String, Any?>? {
    val source = this as? Map<*, *> ?: return null
    return source.entries.associate { (key, value) -> key.toString() to value }
}

private fun Map<String, Any?>.nestedMap(key: String): Map<String, Any?> =
    get(key).asStringMap().orEmpty()

private fun Map<String, Any?>.longValue(key: String): Long =
    when (val value = get(key)) {
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: 0L
        else -> 0L
    }

private fun Map<String, Any?>.stringListValue(key: String): List<String> =
    (get(key) as? List<*>).orEmpty().mapNotNull { it?.toString()?.trim() }

private fun uniqueLabels(values: List<String>): List<String> {
    val seen = mutableSetOf<String>()
    return values.map(String::trim).filter { value ->
        value.isNotBlank() && seen.add(value.lowercase())
    }
}
