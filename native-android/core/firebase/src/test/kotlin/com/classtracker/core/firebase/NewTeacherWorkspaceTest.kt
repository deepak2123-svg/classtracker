package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NewTeacherWorkspaceTest {
    private val teacher = AuthenticatedTeacher(
        uid = "new-teacher",
        displayName = "New Teacher",
        email = "new@example.com",
        photoUrl = "https://example.com/avatar.png",
    )

    @Test
    fun mainDocumentStartsAsEmptyCompatibleWorkspace() {
        val document = newTeacherMainDocument(teacher, now = 123L)
        val profile = document["profile"] as Map<*, *>
        val metadata = document["_meta"] as Map<*, *>
        val trash = document["trash"] as Map<*, *>

        assertEquals("New Teacher", profile["name"])
        assertEquals("new@example.com", profile["email"])
        assertEquals(emptyList<Any>(), document["classes"])
        assertEquals(emptyList<Any>(), trash["notes"])
        assertEquals(0L, metadata["revision"])
        assertEquals(3, metadata["schemaVersion"])
    }

    @Test
    fun teacherIndexIsImmediatelyDiscoverableByAdmin() {
        val document = newTeacherIndexDocument(teacher, now = 456L)

        assertEquals("new-teacher", document["uid"])
        assertEquals("New Teacher", document["name"])
        assertEquals("active", document["accountStatus"])
        assertEquals(true, document["active"])
        assertEquals(0, document["classCount"])
        assertTrue((document["assignedSubjects"] as List<*>).isEmpty())
    }

    @Test
    fun roleDefaultsToTeacher() {
        assertEquals(
            mapOf(
                "role" to "teacher",
                "grantedAt" to 789L,
                "grantedBy" to "self-signup",
            ),
            newTeacherRoleDocument(now = 789L),
        )
    }
}
