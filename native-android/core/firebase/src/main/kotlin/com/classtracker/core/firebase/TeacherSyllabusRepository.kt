package com.classtracker.core.firebase

import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.SyllabusChapter
import com.classtracker.core.model.SyllabusTarget
import com.classtracker.core.model.SyllabusTopic
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

interface TeacherSyllabusRepository {
    suspend fun loadPublishedSyllabi(teacherUid: String): List<PublishedSyllabus>
}

class FirebaseTeacherSyllabusRepository(
    private val firestore: FirebaseFirestore,
) : TeacherSyllabusRepository {
    override suspend fun loadPublishedSyllabi(teacherUid: String): List<PublishedSyllabus> =
        firestore.collection("publishedSyllabi")
            .get()
            .await()
            .documents
            .mapNotNull { document ->
                val data = document.data.orEmpty()
                val targets = data.syllabusMapList("targets").mapNotNull(::mapTarget)
                if (targets.none { it.teacherUid == teacherUid }) return@mapNotNull null
                PublishedSyllabus(
                    templateId = document.id,
                    name = data.syllabusString("name").ifBlank {
                        "${data.syllabusString("subjectName")} syllabus"
                    },
                    subjectName = data.syllabusString("subjectName"),
                    version = data.syllabusInt("version"),
                    academicYear = data.syllabusString("academicYear"),
                    curriculum = data.syllabusString("curriculum"),
                    gradeLabel = data.syllabusString("gradeLabel"),
                    chapters = data.syllabusMapList("chapters")
                        .mapNotNull(::mapChapter)
                        .sortedBy(SyllabusChapter::order),
                    targets = targets,
                    publishedAt = data.syllabusLong("publishedAt"),
                )
            }
            .filter { it.chapters.isNotEmpty() }
            .sortedWith(
                compareBy<PublishedSyllabus> { it.subjectName.lowercase() }
                    .thenByDescending(PublishedSyllabus::publishedAt),
            )
}

private fun mapChapter(map: Map<String, Any?>): SyllabusChapter? {
    val id = map.syllabusString("id")
    val title = map.syllabusString("title")
    if (id.isBlank() || title.isBlank()) return null
    return SyllabusChapter(
        id = id,
        title = title,
        order = map.syllabusInt("order"),
        topics = map.syllabusMapList("topics")
            .mapNotNull(::mapTopic)
            .sortedBy(SyllabusTopic::order),
    )
}

private fun mapTopic(map: Map<String, Any?>): SyllabusTopic? {
    val id = map.syllabusString("id")
    val title = map.syllabusString("title")
    if (id.isBlank() || title.isBlank()) return null
    return SyllabusTopic(
        id = id,
        title = title,
        order = map.syllabusInt("order"),
    )
}

private fun mapTarget(map: Map<String, Any?>): SyllabusTarget? {
    val teacherUid = map.syllabusString("teacherUid")
    val classId = map.syllabusString("classId")
    if (teacherUid.isBlank() || classId.isBlank()) return null
    return SyllabusTarget(
        teacherUid = teacherUid,
        teacherName = map.syllabusString("teacherName"),
        classId = classId,
        className = map.syllabusString("className"),
        instituteName = map.syllabusString("instituteName"),
        sectionName = map.syllabusString("sectionName"),
        subjectName = map.syllabusString("subjectName"),
    )
}

private fun Map<String, Any?>.syllabusString(key: String): String =
    get(key)?.toString()?.trim().orEmpty()

private fun Map<String, Any?>.syllabusLong(key: String): Long =
    when (val value = get(key)) {
        is Timestamp -> value.toDate().time
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: 0L
        else -> 0L
    }

private fun Map<String, Any?>.syllabusInt(key: String): Int =
    (get(key) as? Number)?.toInt() ?: get(key)?.toString()?.toIntOrNull() ?: 0

private fun Map<String, Any?>.syllabusMapList(key: String): List<Map<String, Any?>> =
    (get(key) as? List<*>).orEmpty().mapNotNull { raw ->
        (raw as? Map<*, *>)?.entries?.associate { (entryKey, value) ->
            entryKey.toString() to value
        }
    }
