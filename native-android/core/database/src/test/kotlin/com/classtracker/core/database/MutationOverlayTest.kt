package com.classtracker.core.database

import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntrySyncState
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
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
}

private fun mutation(
    resolvedEntryId: String,
    title: String,
    state: String,
) = EntryMutationEntity(
    mutationId = "mutation-$resolvedEntryId",
    uid = "teacher-1",
    operation = MutationOperation.Upsert,
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
    createdAt = 1L,
    state = state,
    attemptCount = 0,
    lastError = null,
    queuedAt = 1L,
    updatedAt = 1L,
)
