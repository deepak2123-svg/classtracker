package com.classtracker.core.model

fun filterTeacherEntries(
    entries: List<TeacherEntry>,
    query: String,
    status: String,
): List<TeacherEntry> {
    val normalizedStatus = status.trim()
    return entries.filter { entry ->
        entry.matchesStatus(normalizedStatus) && entry.matchesQuery(query)
    }
}

fun TeacherEntry.matchesStatus(status: String): Boolean =
    status.isBlank() || this.status == status

fun TeacherEntry.matchesQuery(query: String): Boolean {
    val terms = query.trim()
        .lowercase()
        .split(Regex("\\s+"))
        .filter(String::isNotBlank)
    if (terms.isEmpty()) return true

    val searchable = listOfNotNull(
        title,
        body,
        tag,
        TeacherEntryStatus.entries.firstOrNull { it.storageValue == status }?.label,
        status,
        dateKey,
        timeStart,
        timeEnd,
        teacherName,
    ).joinToString(" ").lowercase()

    return terms.all(searchable::contains)
}
