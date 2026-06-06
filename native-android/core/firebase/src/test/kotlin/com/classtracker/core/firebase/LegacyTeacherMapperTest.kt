package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LegacyTeacherMapperTest {
    @Test
    fun mapsLegacyMainAndNotesWithoutChangingOrdering() {
        val snapshot = mapLegacyTeacherSnapshot(
            teacher = AuthenticatedTeacher(
                uid = "teacher-1",
                displayName = "Auth Name",
                email = "teacher@example.com",
                photoUrl = null,
            ),
            main = mapOf(
                "profile" to mapOf(
                    "name" to "Teacher Name",
                    "subjects" to listOf("Physics"),
                    "institutes" to listOf("Genesis"),
                ),
                "classes" to listOf(
                    mapOf(
                        "id" to "class-1",
                        "section" to "KESHAV-1",
                        "institute" to "Genesis",
                        "subject" to "Physics",
                    ),
                    mapOf(
                        "id" to "left-class",
                        "section" to "OLD",
                        "left" to true,
                    ),
                ),
                "_meta" to mapOf("revision" to 7L),
            ),
            teacherIndex = emptyMap(),
            noteDocuments = mapOf(
                "class-1" to mapOf(
                    "2026-06-02" to listOf(
                        mapOf(
                            "id" to "entry-2",
                            "title" to "Second",
                            "timeStart" to "10:00",
                            "created" to 2L,
                        ),
                    ),
                    "2026-06-01" to listOf(
                        mapOf(
                            "id" to "entry-1",
                            "title" to "First",
                            "timeStart" to "09:00",
                            "created" to 1L,
                        ),
                    ),
                ),
            ),
            instituteConfig = mapOf("list" to listOf("Genesis", "KIS")),
            sectionConfig = mapOf("Genesis" to mapOf<String, Any?>()),
        )

        assertEquals("Teacher Name", snapshot.profile.name)
        assertEquals(1, snapshot.classes.size)
        assertFalse(snapshot.classes.any { it.id == "left-class" })
        assertEquals(listOf("entry-1", "entry-2"), snapshot.entries.map { it.id })
        assertEquals(listOf("Genesis", "KIS"), snapshot.availableInstitutes)
        assertEquals(7L, snapshot.revision)
    }
}
