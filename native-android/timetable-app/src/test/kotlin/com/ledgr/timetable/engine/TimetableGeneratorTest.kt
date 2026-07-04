package com.ledgr.timetable.engine

import com.ledgr.timetable.data.MappingEntity
import com.ledgr.timetable.data.SLOT_TYPE_CLASS
import com.ledgr.timetable.data.SectionEntity
import com.ledgr.timetable.data.SlotEntity
import com.ledgr.timetable.data.StaffEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TimetableGeneratorTest {
    private val generator = TimetableGenerator()

    @Test
    fun `generator avoids teacher double booking`() {
        val result = generator.generate(
            slots = slots(count = 2),
            sections = listOf(section("s1", "Virat 1"), section("s2", "Virat 2")),
            staff = listOf(staff("t1", "Deepak")),
            mappings = listOf(
                mapping("m1", "s1", "GS", "t1", 3),
                mapping("m2", "s2", "GS", "t1", 3),
            ),
            availability = emptyList(),
        )

        val teacherCells = result.periods.map { Triple(it.staffId, it.day, it.slotId) }
        assertEquals(teacherCells.distinct().size, teacherCells.size)
    }

    @Test
    fun `generator places requested frequency when solvable`() {
        val result = generator.generate(
            slots = slots(count = 4),
            sections = listOf(section("s1", "Madhav 3")),
            staff = listOf(staff("t1", "Deepak")),
            mappings = listOf(mapping("m1", "s1", "GS", "t1", 5)),
            availability = emptyList(),
        )

        assertEquals(5, result.periods.size)
        assertTrue(result.conflicts.isEmpty())
    }

    @Test
    fun `generator reports conflict when impossible`() {
        val result = generator.generate(
            slots = slots(count = 1),
            sections = listOf(section("s1", "Madhav 3")),
            staff = listOf(staff("t1", "Deepak")),
            mappings = listOf(mapping("m1", "s1", "GS", "t1", 10)),
            availability = emptyList(),
        )

        assertEquals(6, result.periods.size)
        assertEquals(4, result.conflicts.size)
    }

    private fun slots(count: Int): List<SlotEntity> =
        (0 until count).map { index ->
            SlotEntity(
                id = "slot-$index",
                timetableId = "time",
                label = "${9 + index}:00",
                startMinutes = (9 + index) * 60,
                endMinutes = (10 + index) * 60,
                type = SLOT_TYPE_CLASS,
                sortOrder = index,
            )
        }

    private fun section(id: String, name: String): SectionEntity =
        SectionEntity(id = id, timetableId = "time", name = name, sortOrder = 0)

    private fun staff(id: String, name: String): StaffEntity =
        StaffEntity(id = id, timetableId = "time", name = name, subjectsCsv = "GS")

    private fun mapping(
        id: String,
        sectionId: String,
        subject: String,
        staffId: String,
        frequency: Int,
    ): MappingEntity =
        MappingEntity(
            id = id,
            timetableId = "time",
            sectionId = sectionId,
            subject = subject,
            staffId = staffId,
            frequencyPerWeek = frequency,
        )
}
