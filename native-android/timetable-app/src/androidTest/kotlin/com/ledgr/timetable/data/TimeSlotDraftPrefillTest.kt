package com.ledgr.timetable.data

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TimeSlotDraftPrefillTest {
    private lateinit var database: TimetableDatabase
    private lateinit var dao: TimetableDao

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        database = Room.inMemoryDatabaseBuilder(context, TimetableDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = database.dao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun firstInstituteHasEmptyDraftSlotsAndPriorTimetableIsCopiedWithNewIds() = runBlocking {
        val ids = mutableListOf("copy-1", "copy-2")
        val repository = TimetableRepository(
            dao = dao,
            nowMillis = { 1_788_300_000_000L },
            newId = { ids.removeAt(0) },
        )
        val firstInstitute = Institute(
            id = "first-institute",
            name = "First Institute",
            createdAt = 1L,
        )
        val priorInstitute = Institute(
            id = "prior-institute",
            name = "Prior Institute",
            createdAt = 2L,
        )
        val priorTimetable = Timetable(
            id = "prior-timetable",
            instituteId = priorInstitute.id,
            createdAt = 3L,
            supersededAt = null,
            validUntil = VALID_UNTIL_END_OF_WEEK,
            status = TIMETABLE_STATUS_ACTIVE,
            duplicatedFromId = null,
        )
        val firstPriorSlot = TimeSlot(
            id = "prior-slot-1",
            timetableId = priorTimetable.id,
            startTime = "08:00",
            endTime = "08:45",
            type = TIME_SLOT_TYPE_CLASS,
            sortOrder = 0,
            createdAt = 4L,
        )
        val secondPriorSlot = TimeSlot(
            id = "prior-slot-2",
            timetableId = priorTimetable.id,
            startTime = "08:45",
            endTime = "09:00",
            type = TIME_SLOT_TYPE_BREAK,
            sortOrder = 1,
            createdAt = 5L,
        )

        dao.insertInstitute(firstInstitute)
        dao.insertInstitute(priorInstitute)
        dao.insertTimetable(priorTimetable)
        dao.insertTimeSlot(firstPriorSlot)
        dao.insertTimeSlot(secondPriorSlot)

        assertEquals(emptyList<Any>(), repository.prefillTimeSlotsForNewDraft(firstInstitute.id))

        val copiedSlots = repository.prefillTimeSlotsForNewDraft(priorInstitute.id)

        assertEquals(listOf("08:00", "08:45"), copiedSlots.map { it.startTime })
        assertEquals(listOf("08:45", "09:00"), copiedSlots.map { it.endTime })
        assertEquals(listOf(TIME_SLOT_TYPE_CLASS, TIME_SLOT_TYPE_BREAK), copiedSlots.map { it.type })
        assertEquals(listOf(0, 1), copiedSlots.map { it.sortOrder })
        assertEquals(listOf("copy-1", "copy-2"), copiedSlots.map { it.id })
        assertNotEquals(firstPriorSlot.id, copiedSlots[0].id)
        assertNotEquals(secondPriorSlot.id, copiedSlots[1].id)
    }
}
