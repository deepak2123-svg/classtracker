package com.ledgr.timetable.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface TimetableDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertInstitute(value: Institute)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTeacher(value: Teacher)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSection(value: Section)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTimetable(value: Timetable)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTimeSlot(value: TimeSlot)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertAssignment(value: Assignment)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTeacherUnavailability(value: TeacherUnavailability)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSubjectTeacherDefault(value: SubjectTeacherDefault)

    @Query("SELECT * FROM institutes WHERE id = :id")
    suspend fun getInstitute(id: String): Institute?

    @Query("SELECT * FROM teachers WHERE instituteId = :instituteId ORDER BY name")
    suspend fun getTeachersForInstitute(instituteId: String): List<Teacher>

    @Query("SELECT * FROM sections WHERE instituteId = :instituteId ORDER BY name")
    suspend fun getSectionsForInstitute(instituteId: String): List<Section>

    @Query("SELECT * FROM timetables WHERE id = :id")
    suspend fun getTimetable(id: String): Timetable?

    @Query("SELECT * FROM time_slots WHERE timetableId = :timetableId ORDER BY sortOrder")
    suspend fun getTimeSlotsForTimetable(timetableId: String): List<TimeSlot>

    @Query("SELECT * FROM assignments WHERE timetableId = :timetableId ORDER BY subjectName")
    suspend fun getAssignmentsForTimetable(timetableId: String): List<Assignment>

    @Query("SELECT * FROM teacher_unavailability WHERE timetableId = :timetableId ORDER BY createdAt")
    suspend fun getTeacherUnavailabilityForTimetable(timetableId: String): List<TeacherUnavailability>

    @Query("SELECT * FROM subject_teacher_defaults WHERE instituteId = :instituteId ORDER BY subjectName")
    suspend fun getSubjectTeacherDefaultsForInstitute(instituteId: String): List<SubjectTeacherDefault>

    @Query("DELETE FROM institutes WHERE id = :id")
    suspend fun deleteInstitute(id: String)
}
