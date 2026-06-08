package com.classtracker.core.database

import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTrashedEntry
import org.junit.Assert.assertEquals
import org.junit.Test

class MutationOverlayTest {
    @Test
    fun pendingMutationOverridesConfirmedEntryWithoutChangingRevision() {
        val snapshot = TeacherSnapshot(
            profile = TeacherProfile(
                uid = "teacher-1",
                name = "Teacher",
                email = "teacher@example.com",
                photoUrl = null,
                subjects = emptyList(),
                institutes = emptyList(),
            ),
            classes = emptyList(),
            entries = listOf(
                TeacherEntry(
                    id = "entry-1",
                    classId = "class-1",
                    dateKey = "2026-06-07",
                    title = "Confirmed title",
                    body = "",
                    tag = "note",
                    status = "",
                    timeStart = "09:00",
                    timeEnd = "10:00",
                    teacherName = "Teacher",
                    createdAt = 1L,
                ),
            ),
            availableInstitutes = emptyList(),
            configuredInstituteCount = 0,
            revision = 4,
        )
        val mutation = mutation(
            resolvedEntryId = "entry-1",
            title = "Edited offline",
            state = MutationState.Pending,
        )

        val overlaid = overlayMutations(snapshot, listOf(mutation))

        assertEquals(4L, overlaid.revision)
        assertEquals(1, overlaid.entries.size)
        assertEquals("Edited offline", overlaid.entries.single().title)
        assertEquals(TeacherEntrySyncState.Pending, overlaid.entries.single().syncState)
    }

    @Test
    fun failedNewMutationRemainsVisibleForRetry() {
        val snapshot = TeacherSnapshot(
            profile = TeacherProfile(
                uid = "teacher-1",
                name = "Teacher",
                email = "teacher@example.com",
                photoUrl = null,
                subjects = emptyList(),
                institutes = emptyList(),
            ),
            classes = emptyList(),
            entries = emptyList(),
            availableInstitutes = emptyList(),
            configuredInstituteCount = 0,
            revision = 4,
        )

        val overlaid = overlayMutations(
            snapshot,
            listOf(
                mutation(
                    resolvedEntryId = "native-entry",
                    title = "Still on device",
                    state = MutationState.Failed,
                ),
            ),
        )

        assertEquals("native-entry", overlaid.entries.single().id)
        assertEquals(TeacherEntrySyncState.Failed, overlaid.entries.single().syncState)
    }

    @Test
    fun pendingDeleteMovesConfirmedEntryToTrash() {
        val snapshot = TeacherSnapshot(
            profile = profile(),
            classes = emptyList(),
            entries = listOf(entry("entry-1")),
            availableInstitutes = emptyList(),
            configuredInstituteCount = 0,
            revision = 4,
        )

        val overlaid = overlayMutations(
            snapshot,
            listOf(
                mutation(
                    resolvedEntryId = "entry-1",
                    title = "Deleted offline",
                    operation = MutationOperation.Delete,
                    state = MutationState.Pending,
                    deletedAt = 10L,
                ),
            ),
        )

        assertEquals(emptyList<TeacherEntry>(), overlaid.entries)
        assertEquals("entry-1", overlaid.trashedEntries.single().id)
        assertEquals(TeacherEntrySyncState.Pending, overlaid.trashedEntries.single().syncState)
    }

    @Test
    fun pendingRestoreMovesTrashedEntryBackToEntries() {
        val snapshot = TeacherSnapshot(
            profile = profile(),
            classes = emptyList(),
            entries = emptyList(),
            trashedEntries = listOf(
                TeacherTrashedEntry(
                    id = "entry-1",
                    classId = "class-1",
                    className = "11th",
                    instituteName = "Institute",
                    dateKey = "2026-06-07",
                    title = "Confirmed trash",
                    body = "",
                    tag = "note",
                    status = "",
                    timeStart = "09:00",
                    timeEnd = "10:00",
                    teacherName = "Teacher",
                    createdAt = 1L,
                    deletedAt = 10L,
                ),
            ),
            availableInstitutes = emptyList(),
            configuredInstituteCount = 0,
            revision = 4,
        )

        val overlaid = overlayMutations(
            snapshot,
            listOf(
                mutation(
                    resolvedEntryId = "entry-1",
                    title = "Restored offline",
                    operation = MutationOperation.Restore,
                    state = MutationState.Pending,
                    deletedAt = 10L,
                ),
            ),
        )

        assertEquals(emptyList<TeacherTrashedEntry>(), overlaid.trashedEntries)
        assertEquals("entry-1", overlaid.entries.single().id)
        assertEquals(TeacherEntrySyncState.Pending, overlaid.entries.single().syncState)
    }
}

private fun mutation(
    resolvedEntryId: String,
    title: String,
    state: String,
    operation: String = MutationOperation.Upsert,
    deletedAt: Long? = null,
) = EntryMutationEntity(
    mutationId = "mutation-$resolvedEntryId",
    uid = "teacher-1",
    operation = operation,
    expectedRevision = 4,
    resolvedEntryId = resolvedEntryId,
    entryId = resolvedEntryId,
    classId = "class-1",
    dateKey = "2026-06-07",
    title = title,
    body = "",
    tag = "note",
    status = "",
    timeStart = "09:00",
    timeEnd = "10:00",
    teacherName = "Teacher",
    createdAt = 1L,
    deletedAt = deletedAt,
    state = state,
    attemptCount = 0,
    lastError = null,
    queuedAt = 1L,
    updatedAt = 1L,
)

private fun profile() = TeacherProfile(
    uid = "teacher-1",
    name = "Teacher",
    email = "teacher@example.com",
    photoUrl = null,
    subjects = emptyList(),
    institutes = emptyList(),
)

private fun entry(id: String) = TeacherEntry(
    id = id,
    classId = "class-1",
    dateKey = "2026-06-07",
    title = "Confirmed title",
    body = "",
    tag = "note",
    status = "",
    timeStart = "09:00",
    timeEnd = "10:00",
    teacherName = "Teacher",
    createdAt = 1L,
)
