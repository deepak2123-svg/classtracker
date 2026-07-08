import { currentMonthKey } from "../utils/adminDates.js";
import { normaliseName, sameInstituteName } from "../utils/adminText.js";
import { normaliseSyllabusScope, syllabusScopePairs } from "./syllabusUtils.js";

export function getSyllabusProgressChapterTitle(entry) {
  const explicit = String(entry?.syllabusChapterTitle || entry?.chapterTitle || "").trim();
  if (explicit) return explicit;
  const title = String(entry?.title || "").trim();
  if (/^completed\s+/i.test(title)) return title.replace(/^completed\s+/i, "").trim();
  return title;
}

export function isSyllabusProgressEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const title = String(entry?.title || "").trim();
  const notes = String(entry?.body || entry?.notes || "").trim();
  const hasSyllabusMarker = Boolean(
    entry?.syllabusTemplateId ||
    entry?.syllabusId ||
    entry?.syllabusChapterId ||
    entry?.syllabusChapterTitle ||
    entry?.chapterTitle ||
    entry?.syllabusChapterCompleted ||
    (Array.isArray(entry?.completedSyllabusChapterIds) && entry.completedSyllabusChapterIds.length) ||
    (Array.isArray(entry?.coveredSyllabusChapterIds) && entry.coveredSyllabusChapterIds.length) ||
    (Array.isArray(entry?.completedSyllabusTopicIds) && entry.completedSyllabusTopicIds.length)
  );
  if (!hasSyllabusMarker) return false;
  return (
    entry?.syllabusChapterCompleted === true ||
    /^completed\s+/i.test(title) ||
    /syllabus progress update/i.test(title) ||
    /^gs syllabus$/i.test(notes) ||
    /syllabus/i.test(notes)
  );
}

export function isTeachingActivityEntry(entry) {
  return !isSyllabusProgressEntry(entry);
}

function syllabusReportArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(item => String(item || "").trim()).filter(Boolean);
    } catch {}
    return trimmed.split(",").map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function syllabusReportChapterMarker(chapterId) {
  const id = String(chapterId || "").trim();
  return id ? `chapter:${id}` : "";
}

export function syllabusReportNameKey(value) {
  return normaliseName(String(value || "").trim()).toLowerCase();
}

export function getPublishedSyllabusPayload(template) {
  if (!template?.published || Number(template?.currentVersion || template?.published?.version || 0) <= 0) return null;
  const published = template.published || {};
  const chapters = (Array.isArray(published.chapters) ? published.chapters : [])
    .map((chapter, index) => ({
      id: String(chapter?.id || "").trim(),
      title: String(chapter?.title || "").trim(),
      topics: Array.isArray(chapter?.topics) ? chapter.topics : [],
      order: index,
    }))
    .filter(chapter => chapter.title);
  if (!chapters.length) return null;
  return {
    templateId: String(template.id || published.templateId || "").trim(),
    version: Number(published.version || template.currentVersion || 0),
    subjectName: String(published.subjectName || template.subjectName || "").trim(),
    name: String(published.name || template.name || "").trim(),
    scope: normaliseSyllabusScope(published.scope, published.instituteName, published.sectionName),
    targets: Array.isArray(published.targets) ? published.targets : [],
    chapters,
  };
}

function publishedSyllabusMatchesClass(published, { teacherUid = "", classId = "", instituteName = "", sectionLabel = "", classSection = "", subject = "" } = {}) {
  if (!published) return false;
  const cleanTeacherUid = String(teacherUid || "").trim();
  const cleanClassId = String(classId || "").trim();
  if (published.targets.some(target =>
    String(target?.teacherUid || "").trim() === cleanTeacherUid
    && String(target?.classId || "").trim() === cleanClassId
  )) return true;

  const classSubject = syllabusReportNameKey(subject);
  const syllabusSubject = syllabusReportNameKey(published.subjectName);
  if (!classSubject || !syllabusSubject || classSubject !== syllabusSubject) return false;

  const sectionKeys = new Set([
    syllabusReportNameKey(sectionLabel),
    syllabusReportNameKey(classSection),
  ].filter(Boolean));
  return syllabusScopePairs(published.scope).some(pair =>
    sameInstituteName(pair.instituteName, instituteName)
    && sectionKeys.has(syllabusReportNameKey(pair.sectionName))
  );
}

function collectSyllabusProgressForClass(classNotes = {}, templateId = "", endKey = "") {
  const cleanTemplateId = String(templateId || "").trim();
  let latestSnapshot = null;
  const unitIds = new Set();
  const chapterIds = new Set();
  const chapterTitles = new Set();

  Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
    if (!Array.isArray(entries)) return;
    if (endKey && dateKey > endKey) return;
    entries.forEach(entry => {
      if (!isSyllabusProgressEntry(entry)) return;
      const entryTemplateId = String(entry?.syllabusTemplateId || entry?.syllabusId || "").trim();
      if (cleanTemplateId && entryTemplateId && entryTemplateId !== cleanTemplateId) return;

      const ids = syllabusReportArray(entry?.completedSyllabusTopicIds);
      const directChapterIds = [
        ...syllabusReportArray(entry?.completedSyllabusChapterIds),
        ...syllabusReportArray(entry?.coveredSyllabusChapterIds),
      ];
      const title = getSyllabusProgressChapterTitle(entry);
      const created = Number(entry?.created || entry?.createdAt || 0) || 0;
      const snapshotTimeKey = `${dateKey || ""}:${String(created).padStart(16, "0")}`;
      const isSnapshot = String(entry?.tag || "").trim() === "syllabus"
        || /syllabus progress update/i.test(String(entry?.title || ""));

      if (isSnapshot && (ids.length || directChapterIds.length)) {
        if (!latestSnapshot || snapshotTimeKey >= latestSnapshot.sortKey) {
          latestSnapshot = {
            sortKey: snapshotTimeKey,
            ids: [
              ...ids,
              ...directChapterIds.map(syllabusReportChapterMarker).filter(Boolean),
            ],
          };
        }
        return;
      }

      ids.forEach(id => unitIds.add(id));
      directChapterIds.forEach(id => {
        const marker = syllabusReportChapterMarker(id);
        if (marker) unitIds.add(marker);
        chapterIds.add(id);
      });
      if (entry?.syllabusChapterCompleted === true) {
        const marker = syllabusReportChapterMarker(entry?.syllabusChapterId);
        if (marker) unitIds.add(marker);
      }
      if (entry?.syllabusChapterId) chapterIds.add(String(entry.syllabusChapterId).trim());
      if (title && !/syllabus progress update/i.test(title)) chapterTitles.add(syllabusReportNameKey(title));
    });
  });

  if (latestSnapshot) {
    return {
      unitIds: new Set(latestSnapshot.ids),
      chapterIds: new Set(),
      chapterTitles: new Set(),
    };
  }
  return { unitIds, chapterIds, chapterTitles };
}

export function buildSyllabusReportRowsForClass({ publishedSyllabi = [], teacherUid = "", cls = {}, classNotes = {}, instituteName = "", sectionLabel = "", periodEndKey = "" } = {}) {
  return publishedSyllabi
    .filter(published => publishedSyllabusMatchesClass(published, {
      teacherUid,
      classId: cls?.id,
      instituteName,
      sectionLabel,
      classSection: cls?.section,
      subject: cls?.subject,
    }))
    .map(published => {
      const progress = collectSyllabusProgressForClass(classNotes, published.templateId, periodEndKey);
      const completed = published.chapters.filter(chapter => {
        const marker = syllabusReportChapterMarker(chapter.id);
        if (marker && progress.unitIds.has(marker)) return true;
        if (chapter.id && progress.chapterIds.has(chapter.id)) return true;
        if (progress.chapterTitles.has(syllabusReportNameKey(chapter.title))) return true;
        const topicIds = (chapter.topics || []).map(topic => String(topic?.id || "").trim()).filter(Boolean);
        return topicIds.length > 0 && topicIds.every(id => progress.unitIds.has(id));
      });
      const chapterTitles = published.chapters
        .map(chapter => String(chapter?.title || "").trim())
        .filter(Boolean);
      const coveredChapterTitles = completed
        .map(chapter => String(chapter?.title || "").trim())
        .filter(Boolean);
      const coveredKeys = new Set(coveredChapterTitles.map(syllabusReportNameKey));
      const pendingChapterTitles = chapterTitles.filter(title => !coveredKeys.has(syllabusReportNameKey(title)));
      const totalCount = published.chapters.length;
      const coveredCount = completed.length;
      const status = coveredCount <= 0 ? "Not started" : coveredCount >= totalCount ? "Complete" : "In progress";
      return {
        key: `${published.templateId || published.name}::${sectionLabel}::${published.subjectName}`,
        section: sectionLabel,
        subject: published.subjectName || cls?.subject || "",
        syllabusName: published.name || `${published.subjectName || cls?.subject || "Subject"} syllabus`,
        coveredCount,
        totalCount,
        status,
        chapterTitles,
        coveredChapterTitles,
        pendingChapterTitles,
      };
    });
}

export function countTeachingEntriesForMonth(classNotes = {}, monthKey = currentMonthKey()) {
  return Object.entries(classNotes || {}).reduce((sum, [dk, entries]) => {
    if (!dk.startsWith(monthKey) || !Array.isArray(entries)) return sum;
    return sum + entries.filter(isTeachingActivityEntry).length;
  }, 0);
}
