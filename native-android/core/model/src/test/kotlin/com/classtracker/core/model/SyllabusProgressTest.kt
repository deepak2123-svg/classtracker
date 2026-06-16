package com.classtracker.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class SyllabusProgressTest {
    private val syllabus = PublishedSyllabus(
        templateId = "syllabus-1",
        name = "NDA General Studies",
        subjectName = "General Studies",
        version = 2,
        academicYear = "",
        curriculum = "",
        gradeLabel = "",
        chapters = listOf(
            SyllabusChapter(
                id = "chapter-1",
                title = "History",
                order = 1,
                topics = listOf(
                    SyllabusTopic("topic-1", "Ancient India", 1),
                    SyllabusTopic("topic-2", "Modern India", 2),
                ),
            ),
            SyllabusChapter(
                id = "chapter-2",
                title = "Current Affairs",
                order = 2,
                topics = emptyList(),
            ),
        ),
        targets = emptyList(),
        publishedAt = 1L,
    )

    @Test
    fun progressCombinesCoverageAcrossEntries() {
        val progress = syllabus.progress(
            listOf(
                entry(
                    id = "entry-1",
                    chapterId = "chapter-1",
                    completedTopicIds = listOf("topic-1"),
                ),
                entry(
                    id = "entry-2",
                    chapterId = "chapter-1",
                    completedTopicIds = listOf("topic-2"),
                ),
                entry(
                    id = "entry-3",
                    chapterId = "chapter-2",
                    chapterCompleted = true,
                ),
            ),
        )

        assertEquals(2, progress.completedChapters)
        assertEquals(2, progress.totalChapters)
        assertEquals(2, progress.completedTopics)
        assertEquals(2, progress.totalTopics)
        assertEquals(100, progress.percent)
    }

    @Test
    fun progressIgnoresEntriesForAnotherSyllabus() {
        val progress = syllabus.progress(
            listOf(
                entry(
                    id = "entry-1",
                    chapterId = "chapter-1",
                    completedTopicIds = listOf("topic-1", "topic-2"),
                ).copy(syllabusTemplateId = "another-syllabus"),
            ),
        )

        assertEquals(0, progress.completedChapters)
        assertEquals(0, progress.completedTopics)
        assertEquals(0, progress.percent)
    }

    @Test
    fun progressCountsChapterMarkerAsWholeChapterCoverage() {
        val progress = syllabus.progress(
            listOf(
                entry(
                    id = "entry-1",
                    chapterId = "chapter-1",
                    completedTopicIds = listOf(syllabusChapterCompletionMarker("chapter-1")),
                ),
            ),
        )

        assertEquals(1, progress.completedChapters)
        assertEquals(0, progress.completedTopics)
        assertEquals(66, progress.percent)
    }

    @Test
    fun latestSnapshotOverridesOlderCoverage() {
        val progress = syllabus.progress(
            listOf(
                entry(
                    id = "entry-1",
                    chapterId = "chapter-1",
                    completedTopicIds = listOf("topic-1", "topic-2"),
                    createdAt = 1L,
                ),
                entry(
                    id = "entry-2",
                    chapterId = "",
                    completedTopicIds = listOf(syllabusChapterCompletionMarker("chapter-2")),
                    tag = "syllabus",
                    title = SyllabusProgressSnapshotTitle,
                    createdAt = 2L,
                ),
            ),
        )

        assertEquals(1, progress.completedChapters)
        assertEquals(0, progress.completedTopics)
        assertEquals(33, progress.percent)
    }

    private fun entry(
        id: String,
        chapterId: String,
        completedTopicIds: List<String> = emptyList(),
        chapterCompleted: Boolean = false,
        tag: String = "note",
        title: String = "Lesson",
        createdAt: Long = 1L,
    ) = TeacherEntry(
        id = id,
        classId = "class-1",
        dateKey = "2026-06-15",
        title = title,
        body = "",
        tag = tag,
        status = "Started",
        timeStart = null,
        timeEnd = null,
        teacherName = "Teacher",
        createdAt = createdAt,
        syllabusTemplateId = syllabus.templateId,
        syllabusVersion = syllabus.version,
        syllabusChapterId = chapterId,
        syllabusChapterTitle = "",
        completedSyllabusTopicIds = completedTopicIds,
        syllabusChapterCompleted = chapterCompleted,
    )
}
