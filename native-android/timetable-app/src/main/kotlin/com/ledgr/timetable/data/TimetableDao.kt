package com.ledgr.timetable.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TimetableDao {
    @Query("SELECT * FROM institutes ORDER BY name")
    fun observeInstitutes(): Flow<List<InstituteEntity>>

    @Query("SELECT * FROM institutes ORDER BY name")
    suspend fun getInstitutes(): List<InstituteEntity>

    @Query("SELECT * FROM timetables WHERE instituteId = :instituteId ORDER BY status = 'published' DESC, updatedAt DESC")
    fun observeTimetables(instituteId: String): Flow<List<TimetableEntity>>

    @Query("SELECT * FROM timetables WHERE id = :timetableId")
    suspend fun getTimetable(timetableId: String): TimetableEntity?

    @Query("SELECT * FROM slots WHERE timetableId = :timetableId ORDER BY sortOrder")
    fun observeSlots(timetableId: String): Flow<List<SlotEntity>>

    @Query("SELECT * FROM slots WHERE timetableId = :timetableId ORDER BY sortOrder")
    suspend fun getSlots(timetableId: String): List<SlotEntity>

    @Query("SELECT * FROM staff WHERE timetableId = :timetableId ORDER BY name")
    fun observeStaff(timetableId: String): Flow<List<StaffEntity>>

    @Query("SELECT * FROM staff WHERE timetableId = :timetableId ORDER BY name")
    suspend fun getStaff(timetableId: String): List<StaffEntity>

    @Query("SELECT * FROM sections WHERE timetableId = :timetableId ORDER BY sortOrder, name")
    fun observeSections(timetableId: String): Flow<List<SectionEntity>>

    @Query("SELECT * FROM sections WHERE timetableId = :timetableId ORDER BY sortOrder, name")
    suspend fun getSections(timetableId: String): List<SectionEntity>

    @Query("SELECT * FROM mappings WHERE timetableId = :timetableId ORDER BY subject")
    fun observeMappings(timetableId: String): Flow<List<MappingEntity>>

    @Query("SELECT * FROM mappings WHERE timetableId = :timetableId ORDER BY subject")
    suspend fun getMappings(timetableId: String): List<MappingEntity>

    @Query("SELECT * FROM availability WHERE timetableId = :timetableId")
    suspend fun getAvailability(timetableId: String): List<AvailabilityEntity>

    @Query("SELECT * FROM generated_periods WHERE timetableId = :timetableId ORDER BY day, slotId, sectionId")
    fun observePeriods(timetableId: String): Flow<List<GeneratedPeriodEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertInstitute(value: InstituteEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTimetable(value: TimetableEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSlots(values: List<SlotEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertStaff(value: StaffEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSection(value: SectionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMapping(value: MappingEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPeriods(values: List<GeneratedPeriodEntity>)

    @Query("DELETE FROM generated_periods WHERE timetableId = :timetableId AND source = 'generated'")
    suspend fun deleteGeneratedPeriods(timetableId: String)

    @Query("UPDATE timetables SET status = 'archived', archivedAt = :now, updatedAt = :now WHERE instituteId = :instituteId AND status = 'published'")
    suspend fun archivePublishedForInstitute(instituteId: String, now: Long)

    @Query("UPDATE timetables SET status = 'published', publishedAt = :now, archivedAt = NULL, updatedAt = :now WHERE id = :timetableId")
    suspend fun publishTimetable(timetableId: String, now: Long)
}
