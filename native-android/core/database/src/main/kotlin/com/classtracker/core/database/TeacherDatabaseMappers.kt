package com.classtracker.core.database

import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.toTrashedEntry

internal fun overlayMutations(
    snapshot: TeacherSnapshot,
    mutations: List<EntryMutationEntity>,
): TeacherSnapshot {
    val entries = snapshot.entries.associateByTo(linkedMapOf(), TeacherEntry::id)
    val trashedEntries = snapshot.trashedEntries.associateByTo(
        linkedMapOf(),
        TeacherTrashedEntry::id,
    )
    val classesById = snapshot.classes.associateBy(TeacherClass::id)
    mutations.sortedWith(compareBy(EntryMutationEntity::queuedAt, EntryMutationEntity::mutationId))
        .forEach { mutation ->
            when (mutation.operation) {
                MutationOperation.Delete -> {
                    val source = entries.remove(mutation.resolvedEntryId)
                    trashedEntries[mutation.resolvedEntryId] = source
                        ?.toTrashedEntry(
                            className = classesById[source.classId]?.sectionName.orEmpty(),
                            instituteName = classesById[source.classId]?.instituteName.orEmpty(),
                            deletedAt = mutation.deletedAt ?: mutation.queuedAt,
                            syncState = mutation.toSyncState(),
                        )
                        ?: mutation.toTeacherTrashedEntry(classesById)
                }
                MutationOperation.Restore -> {
                    trashedEntries.remove(mutation.resolvedEntryId)
                    entries[mutation.resolvedEntryId] = mutation.toTeacherEntry()
                }
                else -> {
                    trashedEntries.remove(mutation.resolvedEntryId)
                    entries[mutation.resolvedEntryId] = mutation.toTeacherEntry()
                }
            }
        }
    return snapshot.copy(
        entries = entries.values.sortedWith(
            compareBy(TeacherEntry::dateKey, TeacherEntry::createdAt, TeacherEntry::id),
        ),
        trashedEntries = trashedEntries.values.sortedWith(
            compareByDescending<TeacherTrashedEntry> { it.deletedAt }.thenBy { it.id },
        ),
    )
}

internal fun syncSummary(mutations: List<EntryMutationEntity>): TeacherSyncSummary =
    TeacherSyncSummary(
        pendingCount = mutations.count { it.state == MutationState.Pending },
        syncingCount = mutations.count { it.state == MutationState.Syncing },
        failedCount = mutations.count { it.state == MutationState.Failed },
        lastError = mutations.asReversed().firstNotNullOfOrNull(EntryMutationEntity::lastError),
    )

internal fun buildSnapshot(
    profile: TeacherProfileEntity?,
    metadata: TeacherMetadataEntity?,
    classes: List<TeacherClassEntity>,
    entries: List<TeacherEntryEntity>,
    trashedEntries: List<TeacherTrashedEntryEntity>,
): TeacherSnapshot? {
    profile ?: return null
    metadata ?: return null
    return TeacherSnapshot(
        profile = profile.toTeacherProfile(),
        classes = classes.map(TeacherClassEntity::toTeacherClass),
        entries = entries.map(TeacherEntryEntity::toTeacherEntry),
        trashedEntries = trashedEntries.map(TeacherTrashedEntryEntity::toTeacherTrashedEntry),
        availableInstitutes = decodeList(metadata.availableInstitutes),
        configuredInstituteCount = metadata.configuredInstituteCount,
        revision = metadata.revision,
        isFromCache = metadata.isFromCache,
        loadedAtMillis = metadata.loadedAtMillis,
    )
}

internal fun TeacherProfile.toEntity(uid: String) = TeacherProfileEntity(
    uid = uid,
    name = name,
    email = email,
    photoUrl = photoUrl,
    subjects = encodeList(subjects),
    institutes = encodeList(institutes),
)

internal fun TeacherSnapshot.toMetadataEntity(uid: String) = TeacherMetadataEntity(
    uid = uid,
    availableInstitutes = encodeList(availableInstitutes),
    configuredInstituteCount = configuredInstituteCount,
    revision = revision,
    isFromCache = isFromCache,
    loadedAtMillis = loadedAtMillis,
)

internal fun TeacherClass.toEntity(uid: String) = TeacherClassEntity(
    uid = uid,
    classId = id,
    sectionName = sectionName,
    instituteName = instituteName,
    subjectName = subjectName,
    startTime = startTime,
    endTime = endTime,
    createdAt = createdAt,
)

internal fun TeacherEntry.toEntity(uid: String) = TeacherEntryEntity(
    uid = uid,
    entryId = id,
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart,
    timeEnd = timeEnd,
    teacherName = teacherName,
    createdAt = createdAt,
)

internal fun TeacherTrashedEntry.toEntity(uid: String) = TeacherTrashedEntryEntity(
    uid = uid,
    entryId = id,
    classId = classId,
    className = className,
    instituteName = instituteName,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart,
    timeEnd = timeEnd,
    teacherName = teacherName,
    createdAt = createdAt,
    deletedAt = deletedAt,
)

internal fun TeacherEntryDraft.toEntity(
    uid: String,
    mutationId: String,
    resolvedEntryId: String,
    expectedRevision: Long,
    queuedAt: Long,
    now: Long,
) = EntryMutationEntity(
    mutationId = mutationId,
    uid = uid,
    operation = MutationOperation.Upsert,
    expectedRevision = expectedRevision,
    resolvedEntryId = resolvedEntryId,
    entryId = entryId,
    classId = classId,
    dateKey = dateKey,
    title = title.trim(),
    body = body.trim(),
    tag = tag.ifBlank { "note" },
    status = status.trim(),
    timeStart = timeStart.trim(),
    timeEnd = timeEnd.trim(),
    teacherName = null,
    createdAt = createdAt,
    deletedAt = null,
    state = MutationState.Pending,
    attemptCount = 0,
    lastError = null,
    queuedAt = queuedAt,
    updatedAt = now,
)

internal fun TeacherTrashedEntry.toMutationEntity(
    uid: String,
    operation: String,
    mutationId: String,
    expectedRevision: Long,
    queuedAt: Long,
    now: Long,
) = EntryMutationEntity(
    mutationId = mutationId,
    uid = uid,
    operation = operation,
    expectedRevision = expectedRevision,
    resolvedEntryId = id,
    entryId = id,
    classId = classId,
    dateKey = dateKey,
    title = title.trim(),
    body = body.trim(),
    tag = tag.ifBlank { "note" },
    status = status.trim(),
    timeStart = timeStart.orEmpty().trim(),
    timeEnd = timeEnd.orEmpty().trim(),
    teacherName = teacherName,
    createdAt = createdAt,
    deletedAt = deletedAt,
    state = MutationState.Pending,
    attemptCount = 0,
    lastError = null,
    queuedAt = queuedAt,
    updatedAt = now,
)

internal fun TeacherProfileEntity.toTeacherProfile() = TeacherProfile(
    uid = uid,
    name = name,
    email = email,
    photoUrl = photoUrl,
    subjects = decodeList(subjects),
    institutes = decodeList(institutes),
)

internal fun TeacherClassEntity.toTeacherClass() = TeacherClass(
    id = classId,
    sectionName = sectionName,
    instituteName = instituteName,
    subjectName = subjectName,
    startTime = startTime,
    endTime = endTime,
    createdAt = createdAt,
)

internal fun TeacherEntryEntity.toTeacherEntry() = TeacherEntry(
    id = entryId,
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart,
    timeEnd = timeEnd,
    teacherName = teacherName,
    createdAt = createdAt,
)

internal fun TeacherTrashedEntryEntity.toTeacherTrashedEntry() = TeacherTrashedEntry(
    id = entryId,
    classId = classId,
    className = className,
    instituteName = instituteName,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart,
    timeEnd = timeEnd,
    teacherName = teacherName,
    createdAt = createdAt,
    deletedAt = deletedAt,
)

internal fun EntryMutationEntity.toTeacherEntry() = TeacherEntry(
    id = resolvedEntryId,
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart.ifBlank { null },
    timeEnd = timeEnd.ifBlank { null },
    teacherName = teacherName,
    createdAt = createdAt ?: queuedAt,
    syncState = toSyncState(),
)

internal fun EntryMutationEntity.toTeacherTrashedEntry(
    classesById: Map<String, TeacherClass>,
) = TeacherTrashedEntry(
    id = resolvedEntryId,
    classId = classId,
    className = classesById[classId]?.sectionName.orEmpty(),
    instituteName = classesById[classId]?.instituteName.orEmpty(),
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart.ifBlank { null },
    timeEnd = timeEnd.ifBlank { null },
    teacherName = teacherName,
    createdAt = createdAt ?: queuedAt,
    deletedAt = deletedAt ?: queuedAt,
    syncState = toSyncState(),
)

internal fun EntryMutationEntity.toPendingMutation() = PendingEntryMutation(
    mutationId = mutationId,
    uid = uid,
    operation = operation,
    expectedRevision = expectedRevision,
    resolvedEntryId = resolvedEntryId,
    draft = TeacherEntryDraft(
        entryId = entryId,
        mutationId = mutationId,
        classId = classId,
        dateKey = dateKey,
        title = title,
        body = body,
        tag = tag,
        status = status,
        timeStart = timeStart,
        timeEnd = timeEnd,
        createdAt = createdAt,
    ),
    trashedEntry = toTeacherTrashedEntry(emptyMap()),
    attemptCount = attemptCount,
)

private fun EntryMutationEntity.toSyncState(): TeacherEntrySyncState = when (state) {
    MutationState.Syncing -> TeacherEntrySyncState.Syncing
    MutationState.Failed -> TeacherEntrySyncState.Failed
    else -> TeacherEntrySyncState.Pending
}

private const val ListSeparator = "\u001F"

private fun encodeList(values: List<String>): String = values.joinToString(ListSeparator)

private fun decodeList(value: String): List<String> =
    value.split(ListSeparator).filter(String::isNotBlank)
