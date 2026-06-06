package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot

internal fun mapLegacyTeacherSnapshot(
    teacher: AuthenticatedTeacher,
    main: Map<String, Any?>,
    teacherIndex: Map<String, Any?>,
    noteDocuments: Map<String, Map<String, Any?>>,
    instituteConfig: Map<String, Any?>,
    sectionConfig: Map<String, Any?>,
): TeacherSnapshot {
    val classMaps = legacyClassMaps(main)
    val classes = classMaps
        .mapNotNull(::mapLegacyClass)
        .sortedWith(
            compareBy<TeacherClass> { it.instituteName.lowercase() }
                .thenBy { it.sectionName.lowercase() },
        )

    val entries = classes
        .flatMap { teacherClass ->
            mapLegacyEntries(
                classId = teacherClass.id,
                noteDocument = noteDocuments[teacherClass.id].orEmpty(),
            )
        }
        .sortedWith(
            compareBy<TeacherEntry> { it.dateKey }
                .thenBy { it.timeStart.orEmpty() }
                .thenBy { it.createdAt },
        )

    val profileMap = main.map("profile")
    val classInstitutes = classes.map { it.instituteName }
    val classSubjects = classes.map { it.subjectName }
    val profileInstitutes = profileMap.stringList("institutes")
    val profileSubjects = profileMap.stringList("subjects")
    val indexInstitutes = teacherIndex.stringList("institutes")
    val indexSubjects = teacherIndex.stringList("subjects")
    val availableInstitutes = instituteConfig.stringList("list")

    return TeacherSnapshot(
        profile = TeacherProfile(
            uid = teacher.uid,
            name = firstNonBlank(
                profileMap.string("name"),
                teacherIndex.string("name"),
                teacher.displayName,
            ),
            email = firstNonBlank(
                teacher.email,
                teacherIndex.string("email"),
            ),
            photoUrl = teacher.photoUrl ?: teacherIndex.string("photoURL").ifBlank { null },
            subjects = uniqueLabels(profileSubjects + indexSubjects + classSubjects),
            institutes = uniqueLabels(profileInstitutes + indexInstitutes + classInstitutes),
        ),
        classes = classes,
        entries = entries,
        availableInstitutes = uniqueLabels(availableInstitutes + classInstitutes),
        configuredInstituteCount = sectionConfig.keys.count { it.isNotBlank() },
        revision = main.map("_meta").long("revision"),
    )
}

internal fun legacyClassMaps(main: Map<String, Any?>): List<Map<String, Any?>> =
    main.mapList("classes").filterNot { it.boolean("left") }

private fun mapLegacyClass(source: Map<String, Any?>): TeacherClass? {
    val id = source.string("id")
    if (id.isBlank()) return null
    return TeacherClass(
        id = id,
        sectionName = source.string("section").ifBlank { "Untitled class" },
        instituteName = source.string("institute").ifBlank { "No institute" },
        subjectName = source.string("subject"),
        startTime = source.string("timeStart").ifBlank { null },
        endTime = source.string("timeEnd").ifBlank { null },
    )
}

private fun mapLegacyEntries(
    classId: String,
    noteDocument: Map<String, Any?>,
): List<TeacherEntry> = noteDocument.entries.flatMap { (dateKey, rawEntries) ->
    val entries = rawEntries as? List<*> ?: return@flatMap emptyList()
    entries.mapNotNull { raw ->
        val source = raw as? Map<*, *> ?: return@mapNotNull null
        val map = source.entries.associate { (key, value) -> key.toString() to value }
        val id = map.string("id")
        TeacherEntry(
            id = id.ifBlank {
                "$classId-$dateKey-${map.long("created")}-${map.string("timeStart")}"
            },
            classId = classId,
            dateKey = dateKey,
            title = map.string("title"),
            body = map.string("body"),
            tag = map.string("tag").ifBlank { "note" },
            status = map.string("status"),
            timeStart = map.string("timeStart").ifBlank { null },
            timeEnd = map.string("timeEnd").ifBlank { null },
            teacherName = map.string("teacherName").ifBlank { null },
            createdAt = map.long("created"),
        )
    }
}

private fun firstNonBlank(vararg values: String?): String =
    values.firstOrNull { !it.isNullOrBlank() }?.trim().orEmpty()

private fun uniqueLabels(values: List<String>): List<String> {
    val seen = mutableSetOf<String>()
    return values.map(String::trim).filter { value ->
        value.isNotBlank() && seen.add(value.lowercase())
    }
}

internal fun Map<String, Any?>.string(key: String): String =
    get(key)?.toString()?.trim().orEmpty()

private fun Map<String, Any?>.boolean(key: String): Boolean =
    get(key) as? Boolean ?: false

private fun Map<String, Any?>.long(key: String): Long =
    when (val value = get(key)) {
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: 0L
        else -> 0L
    }

private fun Map<String, Any?>.map(key: String): Map<String, Any?> {
    val source = get(key) as? Map<*, *> ?: return emptyMap()
    return source.entries.associate { (mapKey, value) -> mapKey.toString() to value }
}

private fun Map<String, Any?>.mapList(key: String): List<Map<String, Any?>> =
    (get(key) as? List<*>).orEmpty().mapNotNull { value ->
        val source = value as? Map<*, *> ?: return@mapNotNull null
        source.entries.associate { (mapKey, mapValue) -> mapKey.toString() to mapValue }
    }

private fun Map<String, Any?>.stringList(key: String): List<String> =
    (get(key) as? List<*>).orEmpty().mapNotNull { it?.toString()?.trim() }
