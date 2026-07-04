package com.ledgr.timetable.engine

import com.ledgr.timetable.data.AvailabilityEntity
import com.ledgr.timetable.data.GeneratedPeriodDraft
import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SLOT_TYPE_CLASS
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import com.ledgr.timetable.data.TimetableConflict
import com.ledgr.timetable.data.TimetableDays
import com.ledgr.timetable.data.TimetableGenerationResult

class TimetableGenerator {
    fun generate(
        slots: List<SlotEntity>,
        sections: List<SectionEntity>,
        staff: List<StaffEntity>,
        mappings: List<MappingEntity>,
        availability: List<AvailabilityEntity>,
    ): TimetableGenerationResult {
        val classSlots = slots
            .filter { it.type == SLOT_TYPE_CLASS }
            .sortedBy { it.sortOrder }
        val sectionById = sections.associateBy { it.id }
        val staffById = staff.associateBy { it.id }
        val availabilityByTeacherDaySlot = availability.associateBy {
            Triple(it.staffId, it.day, it.slotId)
        }
        val teacherBusy = mutableSetOf<Triple<String, String, String>>()
        val sectionBusy = mutableSetOf<Triple<String, String, String>>()
        val sectionSubjectByDay = mutableSetOf<Triple<String, String, String>>()
        val periods = mutableListOf<GeneratedPeriodDraft>()
        val conflicts = mutableListOf<TimetableConflict>()

        val units = mappings
            .filter { it.frequencyPerWeek > 0 }
            .sortedWith(
                compareByDescending<MappingEntity> { it.frequencyPerWeek }
                    .thenBy { sectionById[it.sectionId]?.name.orEmpty() }
                    .thenBy { it.subject },
            )
            .flatMap { mapping ->
                List(mapping.frequencyPerWeek) { index -> mapping to index }
            }

        for ((mapping, unitIndex) in units) {
            val section = sectionById[mapping.sectionId]
            val teacher = staffById[mapping.staffId]
            if (section == null || teacher == null) {
                conflicts += TimetableConflict(
                    sectionName = section?.name ?: "Unknown section",
                    subject = mapping.subject,
                    teacherName = teacher?.name ?: "Unknown teacher",
                    reason = "Missing section or teacher for mapping",
                )
                continue
            }

            val candidates = candidateCells(
                classSlots = classSlots,
                unitIndex = unitIndex,
                sectionId = section.id,
            )
            val firstPass = candidates.firstOrNull { (day, slot) ->
                canPlace(
                    day = day,
                    slot = slot,
                    mapping = mapping,
                    teacherBusy = teacherBusy,
                    sectionBusy = sectionBusy,
                    sectionSubjectByDay = sectionSubjectByDay,
                    availability = availabilityByTeacherDaySlot,
                    avoidSameSubjectPerDay = true,
                )
            }
            val relaxedPass = firstPass ?: candidates.firstOrNull { (day, slot) ->
                canPlace(
                    day = day,
                    slot = slot,
                    mapping = mapping,
                    teacherBusy = teacherBusy,
                    sectionBusy = sectionBusy,
                    sectionSubjectByDay = sectionSubjectByDay,
                    availability = availabilityByTeacherDaySlot,
                    avoidSameSubjectPerDay = false,
                )
            }

            if (relaxedPass == null) {
                conflicts += TimetableConflict(
                    sectionName = section.name,
                    subject = mapping.subject,
                    teacherName = teacher.name,
                    reason = "No free slot without teacher or section clash",
                )
                continue
            }

            val (day, slot) = relaxedPass
            teacherBusy += Triple(mapping.staffId, day, slot.id)
            sectionBusy += Triple(mapping.sectionId, day, slot.id)
            sectionSubjectByDay += Triple(mapping.sectionId, day, mapping.subject.normalized())
            periods += GeneratedPeriodDraft(
                day = day,
                slotId = slot.id,
                sectionId = mapping.sectionId,
                staffId = mapping.staffId,
                subject = mapping.subject,
            )
        }

        return TimetableGenerationResult(
            periods = periods.sortedWith(
                compareBy<GeneratedPeriodDraft> { TimetableDays.indexOf(it.day).takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }
                    .thenBy { period -> classSlots.indexOfFirst { it.id == period.slotId } },
            ),
            conflicts = conflicts,
        )
    }

    private fun candidateCells(
        classSlots: List<SlotEntity>,
        unitIndex: Int,
        sectionId: String,
    ): List<Pair<String, SlotEntity>> {
        val sectionOffset = sectionId.hashCode().absoluteMod(TimetableDays.size)
        val slotOffset = (unitIndex + sectionId.hashCode().absoluteMod(classSlots.size.coerceAtLeast(1)))
            .absoluteMod(classSlots.size.coerceAtLeast(1))
        val orderedDays = TimetableDays.drop(sectionOffset) + TimetableDays.take(sectionOffset)

        return orderedDays.flatMap { day ->
                val orderedSlots = classSlots.drop(slotOffset) + classSlots.take(slotOffset)
                orderedSlots.map { slot -> day to slot }
            }
    }

    private fun canPlace(
        day: String,
        slot: SlotEntity,
        mapping: MappingEntity,
        teacherBusy: Set<Triple<String, String, String>>,
        sectionBusy: Set<Triple<String, String, String>>,
        sectionSubjectByDay: Set<Triple<String, String, String>>,
        availability: Map<Triple<String, String, String>, AvailabilityEntity>,
        avoidSameSubjectPerDay: Boolean,
    ): Boolean {
        if (teacherBusy.contains(Triple(mapping.staffId, day, slot.id))) return false
        if (sectionBusy.contains(Triple(mapping.sectionId, day, slot.id))) return false
        if (
            avoidSameSubjectPerDay &&
            sectionSubjectByDay.contains(Triple(mapping.sectionId, day, mapping.subject.normalized()))
        ) {
            return false
        }
        return availability[Triple(mapping.staffId, day, slot.id)]?.available ?: true
    }

    private fun Int.absoluteMod(mod: Int): Int =
        if (mod == 0) 0 else Math.floorMod(this, mod)

    private fun String.normalized(): String =
        trim().lowercase()
}
