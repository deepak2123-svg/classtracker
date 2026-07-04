package com.ledgr.timetable.data

object TimetableSeedData {
    suspend fun seedDemo(dao: TimetableDao, now: Long) {
        val instituteId = "seed-kis-sip"
        val timetableId = "seed-kis-sip-main"
        dao.upsertInstitute(
            InstituteEntity(
                id = instituteId,
                name = "KIS SIP, Karnal, Haryana",
                createdAt = now,
            ),
        )
        dao.upsertTimetable(
            TimetableEntity(
                id = timetableId,
                instituteId = instituteId,
                name = "Main weekly timetable",
                status = TIMETABLE_STATUS_DRAFT,
                createdAt = now,
                updatedAt = now,
                publishedAt = null,
                archivedAt = null,
            ),
        )
        dao.upsertSlots(defaultSlots(timetableId))

        val sections = listOf("Madhav 3", "Virat 4", "10th B", "10th C")
            .mapIndexed { index, name ->
                SectionEntity(
                    id = "section-${name.slug()}",
                    timetableId = timetableId,
                    name = name,
                    sortOrder = index,
                )
            }
        sections.forEach { dao.upsertSection(it) }

        val staff = listOf(
            StaffEntity(
                id = "teacher-deepak",
                timetableId = timetableId,
                name = "Deepak Kumar",
                subjectsCsv = "GS",
            ),
            StaffEntity(
                id = "teacher-ashish",
                timetableId = timetableId,
                name = "Ashish Dhyani",
                subjectsCsv = "Chemistry",
            ),
            StaffEntity(
                id = "teacher-anubhav",
                timetableId = timetableId,
                name = "Anubhav kumar",
                subjectsCsv = "Physics",
            ),
        )
        staff.forEach { dao.upsertStaff(it) }

        listOf(
            MappingEntity(
                id = "map-madhav-gs",
                timetableId = timetableId,
                sectionId = sections[0].id,
                subject = "GS",
                staffId = staff[0].id,
                frequencyPerWeek = 4,
            ),
            MappingEntity(
                id = "map-virat-gs",
                timetableId = timetableId,
                sectionId = sections[1].id,
                subject = "GS",
                staffId = staff[0].id,
                frequencyPerWeek = 4,
            ),
            MappingEntity(
                id = "map-10b-chem",
                timetableId = timetableId,
                sectionId = sections[2].id,
                subject = "Chemistry",
                staffId = staff[1].id,
                frequencyPerWeek = 3,
            ),
            MappingEntity(
                id = "map-10c-physics",
                timetableId = timetableId,
                sectionId = sections[3].id,
                subject = "Physics",
                staffId = staff[2].id,
                frequencyPerWeek = 3,
            ),
        ).forEach { dao.upsertMapping(it) }
    }

    fun defaultSlots(timetableId: String): List<SlotEntity> =
        listOf(
            SlotEntity("slot-0900-$timetableId", timetableId, "9:00-10:00", 9 * 60, 10 * 60, SLOT_TYPE_CLASS, 0),
            SlotEntity("slot-1000-$timetableId", timetableId, "10:00-11:00", 10 * 60, 11 * 60, SLOT_TYPE_CLASS, 1),
            SlotEntity("slot-1115-$timetableId", timetableId, "11:15-12:15", 11 * 60 + 15, 12 * 60 + 15, SLOT_TYPE_CLASS, 2),
            SlotEntity("slot-1215-$timetableId", timetableId, "12:15-1:00", 12 * 60 + 15, 13 * 60, SLOT_TYPE_CLASS, 3),
            SlotEntity("slot-1300-$timetableId", timetableId, "1:00-1:45", 13 * 60, 13 * 60 + 45, SLOT_TYPE_BREAK, 4),
        )

    private fun String.slug(): String =
        lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
}
