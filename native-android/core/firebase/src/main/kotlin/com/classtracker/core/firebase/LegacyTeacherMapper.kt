package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherTimeSlot
import com.classtracker.core.model.TeacherTrashedEntry
import java.util.Locale

internal fun mapLegacyTeacherSnapshot(
    teacher: AuthenticatedTeacher,
    main: Map<String, Any?>,
    teacherIndex: Map<String, Any?>,
    noteDocuments: Map<String, Map<String, Any?>>,
    instituteConfig: Map<String, Any?>,
    sectionConfig: Map<String, Any?>,
    isFromCache: Boolean = false,
    loadedAtMillis: Long = 0L,
): TeacherSnapshot {
    val classMaps = legacyClassMaps(main)
    val classes = classMaps
        .mapNotNull { mapLegacyClass(it, sectionConfig) }
        .sortedWith(
            compareByDescending<TeacherClass> { it.createdAt }
                .thenBy { it.instituteName.lowercase() }
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
    val classesById = classes.associateBy(TeacherClass::id)
    val trashedEntries = mapLegacyTrashedEntries(main, classesById)

    val profileMap = main.map("profile")
    val classInstitutes = classes.map { it.instituteName }
    val classSubjects = classes.map { it.subjectName }
    val profileInstitutes = profileMap.stringList("institutes")
    val profileSubjects = profileMap.stringList("subjects")
    val indexInstitutes = teacherIndex.stringList("institutes")
    val indexSubjects = teacherIndex.stringList("subjects")
    val subjectAssignmentVersion = teacherIndex.long("subjectAssignmentVersion")
    val assignedSubjects = teacherIndex.mapList("assignedSubjects")
    val assignedSubjectNames = uniqueLabels(assignedSubjects.map { it.string("name") })
    val assignedSubjectIds = uniqueLabels(
        teacherIndex.stringList("assignedSubjectIds") + assignedSubjects.map { it.string("id") },
    )
    val availableInstitutes = instituteConfig.stringList("list")
    val resolvedSubjects = if (subjectAssignmentVersion > 0L) {
        assignedSubjectNames
    } else {
        uniqueLabels(profileSubjects + indexSubjects + classSubjects)
    }

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
            subjects = resolvedSubjects,
            institutes = uniqueLabels(profileInstitutes + indexInstitutes + classInstitutes),
            subjectIds = assignedSubjectIds,
            subjectAssignmentVersion = subjectAssignmentVersion,
        ),
        classes = classes,
        entries = entries,
        trashedEntries = trashedEntries,
        availableInstitutes = uniqueLabels(availableInstitutes + classInstitutes),
        configuredInstituteCount = sectionConfig.keys.count { it.isNotBlank() },
        revision = main.map("_meta").long("revision"),
        isFromCache = isFromCache,
        loadedAtMillis = loadedAtMillis,
        availableSectionsByInstitute = sectionConfig.availableSectionsByInstitute(),
    )
}

private fun Map<String, Any?>.availableSectionsByInstitute(): Map<String, List<String>> =
    entries.mapNotNull { (instituteName, rawConfig) ->
        val instituteConfig = rawConfig as? Map<*, *> ?: return@mapNotNull null
        val normalizedConfig = instituteConfig.entries.associate { (key, value) ->
            key.toString() to value
        }
        val sections = normalizedConfig.mapList("gradeGroups")
            .flatMap { group ->
                group.stringList("sections") + group.map("sectionOverrides").keys
            }
            .let(::uniqueLabels)
        instituteName.trim()
            .takeIf(String::isNotBlank)
            ?.let { it to sections }
    }.toMap()

private fun mapLegacyTrashedEntries(
    main: Map<String, Any?>,
    classesById: Map<String, TeacherClass>,
): List<TeacherTrashedEntry> =
    main.map("trash")
        .mapList("notes")
        .mapNotNull { map ->
            val id = map.string("id")
            val classId = map.string("classId")
            val dateKey = map.string("dateKey")
            if (id.isBlank() || classId.isBlank() || dateKey.isBlank()) return@mapNotNull null
            val teacherClass = classesById[classId]
            TeacherTrashedEntry(
                id = id,
                classId = classId,
                className = firstNonBlank(
                    map.string("className"),
                    teacherClass?.sectionName,
                ),
                instituteName = firstNonBlank(
                    map.string("institute"),
                    map.string("instituteName"),
                    teacherClass?.instituteName,
                ),
                dateKey = dateKey,
                title = map.string("title"),
                body = map.string("body"),
                tag = map.string("tag").ifBlank { "note" },
                status = map.string("status"),
                timeStart = map.string("timeStart").ifBlank { null },
                timeEnd = map.string("timeEnd").ifBlank { null },
                teacherName = map.string("teacherName").ifBlank { null },
                createdAt = map.long("created"),
                deletedAt = map.long("deletedAt"),
                syllabusTemplateId = map.string("syllabusTemplateId"),
                syllabusVersion = map.int("syllabusVersion"),
                syllabusChapterId = map.string("syllabusChapterId"),
                syllabusChapterTitle = map.string("syllabusChapterTitle"),
                completedSyllabusTopicIds = map.stringList("completedSyllabusTopicIds"),
                syllabusChapterCompleted = map.boolean("syllabusChapterCompleted"),
            )
        }
        .sortedWith(compareByDescending<TeacherTrashedEntry> { it.deletedAt }.thenBy { it.id })

internal fun legacyClassMaps(main: Map<String, Any?>): List<Map<String, Any?>> =
    main.mapList("classes").filterNot { it.boolean("left") }

private fun mapLegacyClass(
    source: Map<String, Any?>,
    sectionConfig: Map<String, Any?>,
): TeacherClass? {
    val id = source.string("id")
    if (id.isBlank()) return null
    val sectionName = source.string("section").ifBlank { "Untitled class" }
    val instituteName = source.string("institute").ifBlank { "No institute" }
    val startTime = source.string("timeStart").ifBlank { null }
    val endTime = source.string("timeEnd").ifBlank { null }
    return TeacherClass(
        id = id,
        sectionName = sectionName,
        instituteName = instituteName,
        subjectName = source.string("subject"),
        startTime = startTime,
        endTime = endTime,
        createdAt = source.long("created"),
        timeSlots = resolveTimeSlots(
            instituteName = instituteName,
            sectionName = sectionName,
            startTime = startTime,
            endTime = endTime,
            sectionConfig = sectionConfig,
        ),
    )
}

private fun resolveTimeSlots(
    instituteName: String,
    sectionName: String,
    startTime: String?,
    endTime: String?,
    sectionConfig: Map<String, Any?>,
): List<TeacherTimeSlot> {
    val configured = findConfiguredSlots(
        instituteName = instituteName,
        sectionName = sectionName,
        sectionConfig = sectionConfig,
    )
    if (configured.isNotEmpty()) return configured

    val fallback = kisSipSlots(instituteName, sectionName)
    if (fallback.isNotEmpty()) return fallback

    if (!startTime.isNullOrBlank() && !endTime.isNullOrBlank()) {
        return listOfNotNull(buildTimeSlot(startTime, endTime, null))
    }
    return emptyList()
}

private fun findConfiguredSlots(
    instituteName: String,
    sectionName: String,
    sectionConfig: Map<String, Any?>,
): List<TeacherTimeSlot> {
    val instituteConfig = sectionConfig.mapForCaseInsensitiveKey(instituteName)
    val groups = instituteConfig.mapList("gradeGroups")
    val sectionKey = normalizedLabel(sectionName)
    groups.forEach { group ->
        val sections = group.stringList("sections").map(::normalizedLabel)
        if (sectionKey in sections) {
            val overrides = group.map("sectionOverrides")
            val overrideSlots = overrides.mapListForCaseInsensitiveKey(sectionName).toTimeSlots()
            if (overrideSlots.isNotEmpty()) return overrideSlots
            val sharedSlots = group.mapList("slots").toTimeSlots()
            if (sharedSlots.isNotEmpty()) return sharedSlots
        }
    }
    return emptyList()
}

private fun List<Map<String, Any?>>.toTimeSlots(): List<TeacherTimeSlot> =
    mapNotNull { map ->
        buildTimeSlot(
            start = map.string("start"),
            end = map.string("end"),
            duration = map.int("durMins"),
        )
    }.distinctBy { it.start }
        .sortedBy { it.start }

private fun buildTimeSlot(
    start: String?,
    end: String?,
    duration: Int?,
): TeacherTimeSlot? {
    val cleanStart = start?.trim().orEmpty().takeIf(::isValidTime) ?: return null
    val cleanEnd = end?.trim().orEmpty().takeIf(::isValidTime)
        ?: duration?.takeIf { it > 0 }?.let { addMinutes(cleanStart, it) }
        ?: return null
    val resolvedDuration = duration?.takeIf { it > 0 } ?: durationMinutes(cleanStart, cleanEnd)
    return TeacherTimeSlot(
        start = cleanStart,
        end = cleanEnd,
        durationMinutes = resolvedDuration.takeIf { it > 0 } ?: 60,
    )
}

private fun kisSipSlots(instituteName: String, sectionName: String): List<TeacherTimeSlot> {
    val institute = instituteName.lowercase(Locale.US)
    if (!institute.contains("kis") || !institute.contains("sip")) return emptyList()
    val grade = extractGrade(sectionName) ?: return emptyList()
    return when {
        grade >= 11 -> listOf(
            TeacherTimeSlot("09:00", "10:30", 90),
            TeacherTimeSlot("10:45", "12:00", 75),
            TeacherTimeSlot("12:00", "13:30", 90),
            TeacherTimeSlot("15:00", "16:15", 75),
            TeacherTimeSlot("16:15", "17:30", 75),
        )
        grade >= 6 -> listOf(
            TeacherTimeSlot("09:00", "10:00", 60),
            TeacherTimeSlot("10:00", "11:00", 60),
            TeacherTimeSlot("11:15", "12:15", 60),
            TeacherTimeSlot("12:15", "13:00", 45),
            TeacherTimeSlot("15:00", "16:00", 60),
            TeacherTimeSlot("16:00", "17:00", 60),
        )
        else -> emptyList()
    }
}

private fun extractGrade(sectionName: String): Int? {
    Regex("""\b(\d{1,2})(st|nd|rd|th)?\b""", RegexOption.IGNORE_CASE)
        .find(sectionName)
        ?.groupValues
        ?.getOrNull(1)
        ?.toIntOrNull()
        ?.takeIf { it in 1..12 }
        ?.let { return it }

    val words = sectionName.trim().split(Regex("""\s+"""))
    return words.firstNotNullOfOrNull { romanToGrade(it) }
}

private fun romanToGrade(value: String): Int? {
    val roman = value.lowercase(Locale.US).filter { it in "ivx" }
    if (roman.isBlank()) return null
    val values = mapOf('i' to 1, 'v' to 5, 'x' to 10)
    var total = 0
    var previous = 0
    roman.reversed().forEach { char ->
        val next = values[char] ?: return null
        total += if (next < previous) -next else next
        previous = next
    }
    return total.takeIf { it in 1..12 }
}

private fun durationMinutes(start: String, end: String): Int {
    val startMinutes = timeMinutes(start) ?: return 0
    val endMinutes = timeMinutes(end) ?: return 0
    return endMinutes - startMinutes
}

private fun addMinutes(start: String, minutes: Int): String? {
    val startMinutes = timeMinutes(start) ?: return null
    val next = (startMinutes + minutes).coerceIn(0, (23 * 60) + 59)
    return "%02d:%02d".format(Locale.US, next / 60, next % 60)
}

private fun timeMinutes(value: String): Int? {
    val parts = value.split(":")
    if (parts.size < 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    if (hour !in 0..23 || minute !in 0..59) return null
    return (hour * 60) + minute
}

private fun isValidTime(value: String): Boolean = timeMinutes(value) != null

private fun normalizedLabel(value: String): String =
    value.trim().replace(Regex("""\s+"""), " ").lowercase(Locale.US)

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
            syllabusTemplateId = map.string("syllabusTemplateId"),
            syllabusVersion = map.int("syllabusVersion"),
            syllabusChapterId = map.string("syllabusChapterId"),
            syllabusChapterTitle = map.string("syllabusChapterTitle"),
            completedSyllabusTopicIds = map.stringList("completedSyllabusTopicIds"),
            syllabusChapterCompleted = map.boolean("syllabusChapterCompleted"),
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

private fun Map<String, Any?>.int(key: String): Int =
    (get(key) as? Number)?.toInt() ?: get(key)?.toString()?.toIntOrNull() ?: 0

private fun Map<String, Any?>.stringList(key: String): List<String> =
    (get(key) as? List<*>).orEmpty().mapNotNull { it?.toString()?.trim() }.filter(String::isNotBlank)

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

private fun Map<String, Any?>.mapForCaseInsensitiveKey(key: String): Map<String, Any?> {
    val direct = get(key) as? Map<*, *>
    val source = direct ?: entries.firstOrNull {
        normalizedLabel(it.key) == normalizedLabel(key)
    }?.value as? Map<*, *> ?: return emptyMap()
    return source.entries.associate { (mapKey, value) -> mapKey.toString() to value }
}

private fun Map<String, Any?>.mapListForCaseInsensitiveKey(key: String): List<Map<String, Any?>> {
    val direct = get(key) as? List<*>
    val source = direct ?: entries.firstOrNull {
        normalizedLabel(it.key) == normalizedLabel(key)
    }?.value as? List<*> ?: return emptyList()
    return source.mapNotNull { value ->
        val map = value as? Map<*, *> ?: return@mapNotNull null
        map.entries.associate { (mapKey, mapValue) -> mapKey.toString() to mapValue }
    }
}
