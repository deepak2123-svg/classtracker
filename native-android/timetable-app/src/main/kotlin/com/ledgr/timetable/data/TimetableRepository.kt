package com.ledgr.timetable.data

import androidx.room.withTransaction
import com.ledgr.timetable.engine.TimetableGenerator
import java.util.UUID
import kotlinx.coroutines.flow.Flow

class TimetableRepository(
    private val database: TimetableDatabase,
    private val generator: TimetableGenerator = TimetableGenerator(),
) {
    private val dao = database.dao()

    fun observeInstitutes(): Flow<List<InstituteEntity>> = dao.observeInstitutes()

    fun observeTimetables(instituteId: String): Flow<List<TimetableEntity>> =
        dao.observeTimetables(instituteId)

    fun observeSlots(timetableId: String): Flow<List<SlotEntity>> =
        dao.observeSlots(timetableId)

    fun observeStaff(timetableId: String): Flow<List<StaffEntity>> =
        dao.observeStaff(timetableId)

    fun observeSections(timetableId: String): Flow<List<SectionEntity>> =
        dao.observeSections(timetableId)

    fun observeMappings(timetableId: String): Flow<List<MappingEntity>> =
        dao.observeMappings(timetableId)

    fun observePeriods(timetableId: String): Flow<List<GeneratedPeriodEntity>> =
        dao.observePeriods(timetableId)

    suspend fun seedIfEmpty() {
        if (dao.getInstitutes().isNotEmpty()) return

        database.withTransaction {
            TimetableSeedData.seedDemo(dao, now = System.currentTimeMillis())
        }
    }

    suspend fun createInstitute(name: String): String {
        val id = "institute-${UUID.randomUUID()}"
        dao.upsertInstitute(
            InstituteEntity(
                id = id,
                name = name.trim(),
                createdAt = System.currentTimeMillis(),
            ),
        )
        return id
    }

    suspend fun createTimetable(instituteId: String, name: String): String {
        val id = "timetable-${UUID.randomUUID()}"
        val now = System.currentTimeMillis()
        database.withTransaction {
            dao.upsertTimetable(
                TimetableEntity(
                    id = id,
                    instituteId = instituteId,
                    name = name.trim(),
                    status = TIMETABLE_STATUS_DRAFT,
                    createdAt = now,
                    updatedAt = now,
                    publishedAt = null,
                    archivedAt = null,
                ),
            )
            dao.upsertSlots(TimetableSeedData.defaultSlots(id))
        }
        return id
    }

    suspend fun addSection(timetableId: String, name: String) {
        val existing = dao.getSections(timetableId)
        dao.upsertSection(
            SectionEntity(
                id = "section-${UUID.randomUUID()}",
                timetableId = timetableId,
                name = name.trim(),
                sortOrder = existing.size,
            ),
        )
    }

    suspend fun addStaff(timetableId: String, name: String, subjectsCsv: String) {
        dao.upsertStaff(
            StaffEntity(
                id = "staff-${UUID.randomUUID()}",
                timetableId = timetableId,
                name = name.trim(),
                subjectsCsv = subjectsCsv.trim(),
            ),
        )
    }

    suspend fun addMapping(
        timetableId: String,
        sectionId: String,
        staffId: String,
        subject: String,
        frequencyPerWeek: Int,
    ) {
        dao.upsertMapping(
            MappingEntity(
                id = "mapping-${UUID.randomUUID()}",
                timetableId = timetableId,
                sectionId = sectionId,
                subject = subject.trim(),
                staffId = staffId,
                frequencyPerWeek = frequencyPerWeek.coerceAtLeast(1),
            ),
        )
    }

    suspend fun generate(timetableId: String): TimetableGenerationResult {
        val slots = dao.getSlots(timetableId)
        val sections = dao.getSections(timetableId)
        val staff = dao.getStaff(timetableId)
        val mappings = dao.getMappings(timetableId)
        val availability = dao.getAvailability(timetableId)
        val result = generator.generate(
            slots = slots,
            sections = sections,
            staff = staff,
            mappings = mappings,
            availability = availability,
        )

        database.withTransaction {
            dao.deleteGeneratedPeriods(timetableId)
            dao.upsertPeriods(
                result.periods.map { draft ->
                    GeneratedPeriodEntity(
                        id = "period-${UUID.randomUUID()}",
                        timetableId = timetableId,
                        day = draft.day,
                        slotId = draft.slotId,
                        sectionId = draft.sectionId,
                        staffId = draft.staffId,
                        subject = draft.subject,
                        source = "generated",
                    )
                },
            )
        }

        return result
    }

    suspend fun publish(timetableId: String) {
        val timetable = dao.getTimetable(timetableId) ?: return
        val now = System.currentTimeMillis()
        database.withTransaction {
            dao.archivePublishedForInstitute(timetable.instituteId, now)
            dao.publishTimetable(timetableId, now)
        }
    }

}
