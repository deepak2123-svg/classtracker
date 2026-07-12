import { FieldPath } from "firebase-admin/firestore";

const exportTextSorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function normaliseName(raw) {
  if (!raw) return raw;
  return String(raw).trim().replace(/\s+/g, " ");
}

function sameInstituteName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function uniqueTrimmed(values) {
  const seen = new Set();
  const list = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const clean = String(value || "").trim();
    const key = clean.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(clean);
  });
  return list;
}

function slugifyDownloadPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "report";
}

function parseClockMins(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function fmt12(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function entryDurationMinutes(entry) {
  const start = parseClockMins(entry?.timeStart);
  const end = parseClockMins(entry?.timeEnd);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

function formatDurationShort(totalMins) {
  const mins = Math.max(0, Math.round(totalMins || 0));
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function getTimeZoneParts(timeZone = "Asia/Kolkata", value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const raw = {};
  formatter.formatToParts(value).forEach(part => {
    if (part.type !== "literal") raw[part.type] = part.value;
  });
  return {
    year: Number(raw.year || 0),
    month: Number(raw.month || 0),
    day: Number(raw.day || 0),
    hour: Number(raw.hour || 0),
    minute: Number(raw.minute || 0),
  };
}

export function buildDateContext(timeZone = "Asia/Kolkata", now = new Date()) {
  const parts = getTimeZoneParts(timeZone, now);
  const todayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const currentMonthKey = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  const currentTimeKey = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const generatedOnLabel = `Generated ${new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now)}`;
  return {
    timeZone,
    now,
    nowMs: now.getTime(),
    todayKey,
    currentMonthKey,
    currentTimeKey,
    generatedOnLabel,
  };
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || localDateKey()).split("-").map(Number);
  const next = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  next.setDate(next.getDate() + days);
  return localDateKey(next);
}

function monthBoundsFromKey(monthKey) {
  const [rawYear, rawMonth] = String(monthKey || "").split("-").map(Number);
  const year = rawYear || new Date().getFullYear();
  const month = rawMonth || (new Date().getMonth() + 1);
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startKey: `${year}-${paddedMonth}-01`,
    endKey: `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
    monthKey: `${year}-${paddedMonth}`,
  };
}

function shortDateLabel(ts, dateContext) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: dateContext?.timeZone,
    day: "numeric",
    month: "short",
  }).format(new Date(ts));
}

function longDateLabel(ts, dateContext) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: dateContext?.timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

function daysAgo(ts, dateContext) {
  if (!ts) return null;
  const days = Math.floor(((dateContext?.nowMs || Date.now()) - ts) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function lastEntryTs(notes = {}) {
  let latest = 0;
  const scan = value => {
    if (Array.isArray(value)) {
      value.forEach(entry => {
        if (entry && entry.created > latest) latest = entry.created;
      });
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.values(value).forEach(scan);
  };
  scan(notes || {});
  return latest || null;
}

function firstClassCreatedTs(classes = []) {
  return (classes || []).reduce((earliest, cls) => {
    const created = Number(cls?.created || 0) || 0;
    if (!created) return earliest;
    if (!earliest) return created;
    return Math.min(earliest, created);
  }, 0) || null;
}

function normaliseSectionKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getInstituteSectionConfigKey(instituteSections, instituteName) {
  if (!instituteSections || !instituteName) return instituteName || "";
  if (Object.prototype.hasOwnProperty.call(instituteSections, instituteName)) return instituteName;
  const match = Object.keys(instituteSections).find(name => sameInstituteName(name, instituteName));
  return match || instituteName;
}

function getInstituteSectionConfig(instituteSections, instituteName) {
  const key = getInstituteSectionConfigKey(instituteSections, instituteName);
  return key ? instituteSections?.[key] || null : null;
}

function getInstituteSectionNames(instData) {
  return [...new Set(
    [
      ...((instData?.gradeGroups || []).flatMap(group => group.sections || [])),
      ...(instData?.extraSections || []),
    ]
      .map(section => String(section || "").trim())
      .filter(Boolean),
  )];
}

function splitSectionTokens(value) {
  return normaliseSectionKey(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreSectionRenameTarget(oldSection, candidate) {
  const oldTokens = splitSectionTokens(oldSection);
  const nextTokens = splitSectionTokens(candidate);
  if (!oldTokens.length || !nextTokens.length) return 0;
  let score = 0;
  if (oldTokens[0] && nextTokens[0] && oldTokens[0] === nextTokens[0]) score += 4;
  const shared = oldTokens.filter(token => nextTokens.includes(token));
  score += shared.length * 2;
  if (
    normaliseSectionKey(candidate).startsWith(normaliseSectionKey(oldSection))
    || normaliseSectionKey(oldSection).startsWith(normaliseSectionKey(candidate))
  ) {
    score += 1;
  }
  return score;
}

function findStrongSectionRenameTarget(oldSection, candidateSections) {
  const oldKey = normaliseSectionKey(oldSection);
  const pool = uniqueTrimmed(candidateSections).filter(section => normaliseSectionKey(section) !== oldKey);
  if (!oldKey || !pool.length) return "";
  if (pool.length === 1) return pool[0];
  const ranked = pool
    .map((value, index) => ({ value, index, score: scoreSectionRenameTarget(oldSection, value) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 4) return "";
  if (second && second.score >= top.score - 1 && top.score < 7) return "";
  return top.value || "";
}

function getAdminInstituteSectionChangeEvents(instData) {
  return [...(instData?.sectionChangeEvents || [])]
    .filter(event => Array.isArray(event?.changes) && event.changes.length > 0)
    .sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
}

function resolveAdminSectionName(section, instituteName, instituteSections) {
  const original = String(section || "").trim();
  if (!original) return "";
  const instData = getInstituteSectionConfig(instituteSections, instituteName);
  if (!instData) return original;
  let current = original;
  getAdminInstituteSectionChangeEvents(instData).forEach(event => {
    const match = (event.changes || []).find(change =>
      normaliseSectionKey(change?.oldSection) === normaliseSectionKey(current)
      && String(change?.newSection || "").trim(),
    );
    if (match) current = String(match.newSection || "").trim();
  });
  const currentSections = getInstituteSectionNames(instData);
  const currentKey = normaliseSectionKey(current);
  const inCurrentList = currentSections.some(item => normaliseSectionKey(item) === currentKey);
  if (!inCurrentList) {
    const guessed = findStrongSectionRenameTarget(current, currentSections);
    if (guessed) return guessed;
  }
  return current || original;
}

function normaliseSyllabusScope(scope, fallbackInstitute = "", fallbackSection = "") {
  const grouped = new Map();
  (Array.isArray(scope) ? scope : []).forEach(item => {
    const instituteName = String(item?.instituteName || "").trim();
    if (!instituteName) return;
    const key = instituteName.toLowerCase();
    const current = grouped.get(key) || { instituteName, sectionNames: [] };
    const sections = Array.isArray(item?.sectionNames) ? item.sectionNames : [item?.sectionName];
    sections.forEach(value => {
      const sectionName = String(value || "").trim();
      if (!sectionName) return;
      if (!current.sectionNames.some(existing => existing.toLowerCase() === sectionName.toLowerCase())) {
        current.sectionNames.push(sectionName);
      }
    });
    grouped.set(key, current);
  });
  const legacyInstitute = String(fallbackInstitute || "").trim();
  const legacySection = String(fallbackSection || "").trim();
  if (!grouped.size && legacyInstitute && legacySection) {
    grouped.set(legacyInstitute.toLowerCase(), {
      instituteName: legacyInstitute,
      sectionNames: [legacySection],
    });
  }
  return [...grouped.values()]
    .map(item => ({
      instituteName: item.instituteName,
      sectionNames: [...item.sectionNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    }))
    .filter(item => item.sectionNames.length)
    .sort((a, b) => a.instituteName.localeCompare(b.instituteName, undefined, { sensitivity: "base" }));
}

function syllabusScopePairs(scope) {
  return normaliseSyllabusScope(scope).flatMap(item =>
    item.sectionNames.map(sectionName => ({ instituteName: item.instituteName, sectionName })),
  );
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

function syllabusReportNameKey(value) {
  return normaliseName(String(value || "").trim()).toLowerCase();
}

function getSyllabusProgressChapterTitle(entry) {
  const explicit = String(entry?.syllabusChapterTitle || entry?.chapterTitle || "").trim();
  if (explicit) return explicit;
  const title = String(entry?.title || "").trim();
  if (/^completed\s+/i.test(title)) return title.replace(/^completed\s+/i, "").trim();
  return title;
}

function isSyllabusProgressEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const title = String(entry?.title || "").trim();
  const notes = String(entry?.body || entry?.notes || "").trim();
  const hasSyllabusMarker = Boolean(
    entry?.syllabusTemplateId
    || entry?.syllabusId
    || entry?.syllabusChapterId
    || entry?.syllabusChapterTitle
    || entry?.chapterTitle
    || entry?.syllabusChapterCompleted
    || (Array.isArray(entry?.completedSyllabusChapterIds) && entry.completedSyllabusChapterIds.length)
    || (Array.isArray(entry?.coveredSyllabusChapterIds) && entry.coveredSyllabusChapterIds.length)
    || (Array.isArray(entry?.completedSyllabusTopicIds) && entry.completedSyllabusTopicIds.length)
  );
  if (!hasSyllabusMarker) return false;
  return (
    entry?.syllabusChapterCompleted === true
    || /^completed\s+/i.test(title)
    || /syllabus progress update/i.test(title)
    || /^gs syllabus$/i.test(notes)
    || /syllabus/i.test(notes)
  );
}

function getPublishedSyllabusPayload(template) {
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
    && String(target?.classId || "").trim() === cleanClassId,
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
    && sectionKeys.has(syllabusReportNameKey(pair.sectionName)),
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

function buildSyllabusReportRowsForClass({ publishedSyllabi = [], teacherUid = "", cls = {}, classNotes = {}, instituteName = "", sectionLabel = "", periodEndKey = "" } = {}) {
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
      const chapterTitles = published.chapters.map(chapter => String(chapter?.title || "").trim()).filter(Boolean);
      const coveredChapterTitles = completed.map(chapter => String(chapter?.title || "").trim()).filter(Boolean);
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

function countTeachingEntriesForMonth(classNotes = {}, monthKey = "") {
  return Object.entries(classNotes || {}).reduce((sum, [dateKey, entries]) => {
    if (!dateKey.startsWith(monthKey) || !Array.isArray(entries)) return sum;
    return sum + entries.filter(entry => !isSyllabusProgressEntry(entry)).length;
  }, 0);
}

function getEntriesInRange(classNotes = {}, days = null, startKey = null, endKey = null, nowMs = Date.now()) {
  const cutoff = days ? nowMs - days * 24 * 60 * 60 * 1000 : 0;
  const result = [];
  Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
    if (days && new Date(dateKey).getTime() < cutoff) return;
    if (!days && startKey && dateKey < startKey) return;
    if (!days && endKey && dateKey > endKey) return;
    if (!Array.isArray(entries)) return;
    entries.forEach(entry => {
      if (entry) result.push({ dateKey, entry });
    });
  });
  result.sort((a, b) => {
    if (b.dateKey !== a.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return String(a.entry?.timeStart || "").localeCompare(String(b.entry?.timeStart || ""));
  });
  return result;
}

function getTeacherInstituteListFromMap(teacher, fullDataMap) {
  const list = [];
  const add = value => {
    const next = String(value || "").trim();
    if (!next) return;
    if (list.some(existing => sameInstituteName(existing, next))) return;
    list.push(next);
  };
  (teacher?.institutes || []).forEach(add);
  const data = fullDataMap?.[teacher?.uid];
  (data?.profile?.institutes || []).forEach(add);
  (data?.classes || []).forEach(cls => add(cls?.institute));
  return list;
}

function teacherBelongsToInstituteFromMap(teacher, instituteName, fullDataMap) {
  if (!teacher || !instituteName) return false;
  return getTeacherInstituteListFromMap(teacher, fullDataMap).some(inst => sameInstituteName(inst, instituteName));
}

function getTeacherDisplayNameFromMap(teacher, fullDataMap) {
  return fullDataMap?.[teacher?.uid]?.profile?.name || teacher?.name || "Teacher";
}

const EMPTY_INSTITUTE_GLANCE_SUMMARY = {
  totalInstitutes: 0,
  totalTeachers: 0,
  filledToday: 0,
  missingToday: 0,
  loadedTeachers: 0,
  sectionsTaught: 0,
  totalStudyMinutes: 0,
  totalTodayEntries: 0,
};

function getInstituteGlancePeriodMeta(period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext()) {
  const today = dateContext.todayKey;
  const rangeStart = String(rangeStartKey || today).trim();
  const rangeEnd = String(rangeEndKey || rangeStart || today).trim();
  const safeRangeStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const safeRangeEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  if (period === "range") {
    return {
      key: "range",
      days: null,
      startKey: safeRangeStart,
      endKey: safeRangeEnd,
      filePart: `range_${safeRangeStart}_to_${safeRangeEnd}`,
      label: "Range",
      periodValue: `${safeRangeStart} to ${safeRangeEnd}`,
      updatedLabel: "Updated in range",
      pendingLabel: "Pending in range",
      activeLabel: "Teachers active in range",
      submissionLabel: "Submission rate in range",
      sectionsSubLabel: "in range",
      hoursSubLabel: "logged in range",
      title: "Ledgr Report",
    };
  }
  if (period === "monthly") {
    const monthBounds = monthBoundsFromKey(String(rangeStartKey || "").slice(0, 7) || dateContext.currentMonthKey);
    return {
      key: "monthly",
      days: null,
      startKey: monthBounds.startKey,
      endKey: monthBounds.endKey,
      filePart: monthBounds.monthKey,
      label: "Monthly",
      periodValue: new Date(`${monthBounds.startKey}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      updatedLabel: "Updated this month",
      pendingLabel: "Pending this month",
      activeLabel: "Teachers active this month",
      submissionLabel: "Submission rate this month",
      sectionsSubLabel: "this month",
      hoursSubLabel: "logged this month",
      title: "Ledgr Report",
    };
  }
  if (period === "weekly") {
    return {
      key: "weekly",
      days: 7,
      startKey: addDaysToDateKey(today, -6),
      endKey: today,
      filePart: "weekly",
      label: "Weekly",
      periodValue: "Last 7 days",
      updatedLabel: "Updated this week",
      pendingLabel: "Pending this week",
      activeLabel: "Teachers active this week",
      submissionLabel: "Submission rate this week",
      sectionsSubLabel: "this week",
      hoursSubLabel: "logged this week",
      title: "Ledgr Report",
    };
  }
  if (period === "yesterday") {
    const yesterday = addDaysToDateKey(today, -1);
    return {
      key: "yesterday",
      days: null,
      startKey: yesterday,
      endKey: yesterday,
      filePart: "yesterday",
      label: "Yesterday",
      periodValue: "Yesterday",
      updatedLabel: "Updated yesterday",
      pendingLabel: "Pending yesterday",
      activeLabel: "Teachers active yesterday",
      submissionLabel: "Submission rate yesterday",
      sectionsSubLabel: "yesterday",
      hoursSubLabel: "logged yesterday",
      title: "Ledgr Report",
    };
  }
  return {
    key: "daily",
    days: 1,
    startKey: today,
    endKey: today,
    filePart: "daily",
    label: "Daily",
    periodValue: "Today",
    updatedLabel: "Updated today",
    pendingLabel: "Pending today",
    activeLabel: "Teachers active today",
    submissionLabel: "Submission rate today",
    sectionsSubLabel: "today",
    hoursSubLabel: "logged today",
    title: "Ledgr Report",
  };
}

function instituteGlanceLastActivityLabel(teacherRow, dateContext) {
  if (teacherRow?.lastEntryTs) return longDateLabel(teacherRow.lastEntryTs, dateContext);
  if (teacherRow?.joinedAtTs) return `Signed up ${longDateLabel(teacherRow.joinedAtTs, dateContext)}`;
  return "No logs yet";
}

function instituteGlanceTodayStatusLabel(teacherRow) {
  return teacherRow?.updatedToday ? "Filled today" : "Pending today";
}

function instituteGlanceTeacherHoursLabel(teacherRow) {
  return teacherRow?.totalMinutes > 0
    ? formatDurationShort(teacherRow.totalMinutes)
    : teacherRow?.untimedEntries > 0
      ? "Untimed"
      : "0m";
}

function instituteGlanceTeacherSectionCaption(teacherRow) {
  return teacherRow?.sectionNames?.length
    ? teacherRow.sectionNames.join(", ")
    : teacherRow?.updatedToday
      ? "Uploaded without a section name"
      : "No section was taught today";
}

function buildInstituteGlanceTeacherActivity({ teacher, instituteName, fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext() }) {
  const data = fullDataMap?.[teacher?.uid];
  const classesHere = data ? (data.classes || []).filter(cls => sameInstituteName(cls?.institute, instituteName)) : [];
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext);
  const monthKey = dateContext.currentMonthKey;
  const sectionMap = new Map();
  const syllabusCoverageMap = new Map();
  const syllabusDeclaredMap = new Map();
  const publishedSyllabi = (Array.isArray(syllabusTemplates) ? syllabusTemplates : []).map(getPublishedSyllabusPayload).filter(Boolean);
  const todayDetails = [];
  let todayEntries = 0;
  let monthEntries = 0;
  let totalMinutes = 0;
  let untimedEntries = 0;

  classesHere.forEach(cls => {
    const classNotes = (data.notes || {})[cls.id] || {};
    const notesToday = getEntriesInRange(classNotes, periodMeta.days, periodMeta.startKey, periodMeta.endKey, dateContext.nowMs);
    monthEntries += countTeachingEntriesForMonth(classNotes, monthKey);

    const resolvedSection = typeof resolveSectionName === "function"
      ? resolveSectionName(cls?.section, cls?.institute || instituteName)
      : cls?.section;
    const sectionLabel = normaliseName(String(resolvedSection || cls?.section || "Untitled section").trim() || "Untitled section");
    const currentSection = sectionMap.get(sectionLabel) || { name: sectionLabel, entryCount: 0, totalMinutes: 0 };

    buildSyllabusReportRowsForClass({
      publishedSyllabi,
      teacherUid: teacher?.uid,
      cls,
      classNotes,
      instituteName,
      sectionLabel,
      periodEndKey: periodMeta.endKey,
    }).forEach(item => {
      const key = item.key || `${item.section}::${item.subject}::${item.syllabusName}`;
      syllabusDeclaredMap.set(key, item);
    });

    Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
      if (!Array.isArray(entries)) return;
      if (periodMeta.endKey && dateKey > periodMeta.endKey) return;
      entries.forEach(entry => {
        if (!isSyllabusProgressEntry(entry)) return;
        const title = getSyllabusProgressChapterTitle(entry);
        if (!title || /syllabus progress update/i.test(title)) return;
        const key = `${sectionLabel}::${cls?.subject || ""}::${entry?.syllabusChapterId || title}`;
        const current = syllabusCoverageMap.get(key);
        if (current && String(current.dateKey || "") >= String(dateKey || "")) return;
        syllabusCoverageMap.set(key, {
          dateKey,
          section: sectionLabel,
          subject: cls?.subject || "",
          chapterTitle: title,
          status: "Covered",
        });
      });
    });

    if (!notesToday.length) {
      if (currentSection.entryCount > 0) sectionMap.set(sectionLabel, currentSection);
      return;
    }

    notesToday.forEach(({ dateKey, entry }) => {
      if (isSyllabusProgressEntry(entry)) return;
      const mins = entryDurationMinutes(entry);
      todayEntries += 1;
      totalMinutes += mins;
      currentSection.entryCount += 1;
      currentSection.totalMinutes += mins;
      if (mins <= 0) untimedEntries += 1;
      todayDetails.push({
        teacherName: getTeacherDisplayNameFromMap(teacher, fullDataMap),
        dateKey,
        section: sectionLabel,
        subject: cls?.subject || "",
        timeStart: entry?.timeStart || "",
        timeEnd: entry?.timeEnd || "",
        title: entry?.title || "",
        notes: entry?.body || "",
        minutes: mins,
      });
    });

    sectionMap.set(sectionLabel, currentSection);
  });

  const lastEntry = data
    ? classesHere.reduce((latest, cls) => Math.max(latest, lastEntryTs((data.notes || {})[cls.id] || {}) || 0), 0)
    : Number(teacher?.lastActive || 0) || 0;
  const joinedAtTs = classesHere.length ? firstClassCreatedTs(classesHere) : firstClassCreatedTs(data?.classes || []);
  const sections = Array.from(sectionMap.values()).sort((a, b) => {
    if ((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
    if ((b.entryCount || 0) !== (a.entryCount || 0)) return (b.entryCount || 0) - (a.entryCount || 0);
    return exportTextSorter.compare(a.name || "", b.name || "");
  });

  return {
    uid: teacher?.uid,
    name: getTeacherDisplayNameFromMap(teacher, fullDataMap),
    loaded: !!data,
    todayEntries,
    monthEntries,
    updatedToday: todayEntries > 0,
    lastEntryTs: lastEntry || null,
    joinedAtTs: joinedAtTs || null,
    lastActivityLabel: instituteGlanceLastActivityLabel({ lastEntryTs: lastEntry || null, joinedAtTs: joinedAtTs || null }, dateContext),
    todayStatusLabel: periodMeta.key !== "daily"
      ? (todayEntries > 0 ? periodMeta.updatedLabel : periodMeta.pendingLabel)
      : instituteGlanceTodayStatusLabel({ updatedToday: todayEntries > 0 }),
    sectionCount: sections.length,
    sectionNames: sections.map(section => section.name),
    sections,
    todayDetails: todayDetails.sort((a, b) => {
      if ((a.dateKey || "") !== (b.dateKey || "")) return (a.dateKey || "").localeCompare(b.dateKey || "");
      if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if (sectionCmp !== 0) return sectionCmp;
      return exportTextSorter.compare(a.title || "", b.title || "");
    }),
    syllabusCoveredRows: Array.from(syllabusCoverageMap.values()).sort((a, b) => {
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if (sectionCmp !== 0) return sectionCmp;
      const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
      if (subjectCmp !== 0) return subjectCmp;
      return exportTextSorter.compare(a.chapterTitle || "", b.chapterTitle || "");
    }),
    syllabusDeclaredRows: Array.from(syllabusDeclaredMap.values()).sort((a, b) => {
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if (sectionCmp !== 0) return sectionCmp;
      const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
      if (subjectCmp !== 0) return subjectCmp;
      return exportTextSorter.compare(a.syllabusName || "", b.syllabusName || "");
    }),
    totalMinutes,
    untimedEntries,
  };
}

function buildInstituteGlanceRows({ institutes = [], teachers = [], fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], roles = {}, period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext() }) {
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext);
  return institutes.map(inst => {
    const teacherRows = teachers
      .filter(teacher => teacherBelongsToInstituteFromMap(teacher, inst, fullDataMap))
      .map(teacher => buildInstituteGlanceTeacherActivity({
        teacher,
        instituteName: inst,
        fullDataMap,
        resolveSectionName,
        syllabusTemplates,
        period,
        rangeStartKey,
        rangeEndKey,
        dateContext,
      }))
      .filter(item => roles[item.uid] !== "admin" || item.todayEntries > 0);
    const filledTeachers = teacherRows
      .filter(item => item.updatedToday)
      .sort((a, b) => {
        if ((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
        if ((b.todayEntries || 0) !== (a.todayEntries || 0)) return (b.todayEntries || 0) - (a.todayEntries || 0);
        if ((b.sectionCount || 0) !== (a.sectionCount || 0)) return (b.sectionCount || 0) - (a.sectionCount || 0);
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const missingTeachers = teacherRows
      .filter(item => !item.updatedToday)
      .sort((a, b) => {
        const aSortTs = a.lastEntryTs || a.joinedAtTs || 0;
        const bSortTs = b.lastEntryTs || b.joinedAtTs || 0;
        if (aSortTs !== bSortTs) return aSortTs - bSortTs;
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const orderedTeachers = [...filledTeachers, ...missingTeachers];
    const loadedTeachers = orderedTeachers.filter(item => item.loaded).length;
    const totalTeachers = orderedTeachers.length;
    const taughtSectionMap = new Map();

    filledTeachers.forEach(teacher => {
      (teacher.sections || []).forEach(section => {
        const current = taughtSectionMap.get(section.name) || {
          name: section.name,
          entryCount: 0,
          totalMinutes: 0,
          teachers: new Set(),
        };
        current.entryCount += section.entryCount || 0;
        current.totalMinutes += section.totalMinutes || 0;
        current.teachers.add(teacher.name);
        taughtSectionMap.set(section.name, current);
      });
    });

    const sectionRows = Array.from(taughtSectionMap.values())
      .map(section => ({
        ...section,
        teacherNames: Array.from(section.teachers).sort((a, b) => exportTextSorter.compare(a || "", b || "")),
      }))
      .sort((a, b) => {
        if ((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
        if ((b.entryCount || 0) !== (a.entryCount || 0)) return (b.entryCount || 0) - (a.entryCount || 0);
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const totalStudyMinutes = filledTeachers.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
    const totalTodayEntries = filledTeachers.reduce((sum, item) => sum + (item.todayEntries || 0), 0);

    return {
      institute: inst,
      teacherUids: orderedTeachers.map(item => item.uid),
      teacherRows: orderedTeachers,
      filledTeacherRows: filledTeachers,
      pendingTeacherRows: missingTeachers,
      totalTeachers,
      filledToday: filledTeachers.length,
      missingToday: missingTeachers.length,
      missingNames: missingTeachers.map(item => item.name),
      filledNames: filledTeachers.map(item => item.name),
      loadedTeachers,
      period: periodMeta.key,
      periodLabel: periodMeta.label,
      sectionsTaught: sectionRows.length,
      sectionRows,
      totalStudyMinutes,
      totalTodayEntries,
      untimedEntries: filledTeachers.reduce((sum, item) => sum + (item.untimedEntries || 0), 0),
      noTeachersSignedUp: totalTeachers === 0,
      ready: loadedTeachers >= totalTeachers,
      loadedPct: totalTeachers ? Math.round((loadedTeachers / totalTeachers) * 100) : 100,
      completionPct: totalTeachers ? Math.round((filledTeachers.length / totalTeachers) * 100) : 0,
    };
  });
}

function summariseInstituteGlanceRows(rows = []) {
  return rows.reduce((acc, row) => {
    acc.totalInstitutes += 1;
    acc.totalTeachers += row.totalTeachers || 0;
    acc.filledToday += row.filledToday || 0;
    acc.missingToday += row.missingToday || 0;
    acc.loadedTeachers += row.loadedTeachers || 0;
    acc.sectionsTaught += row.sectionsTaught || 0;
    acc.totalStudyMinutes += row.totalStudyMinutes || 0;
    acc.totalTodayEntries += row.totalTodayEntries || 0;
    return acc;
  }, { ...EMPTY_INSTITUTE_GLANCE_SUMMARY });
}

function escapeExportHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExportPdfTime(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${fmt12(start)} - ${fmt12(end)}`;
  return fmt12(start || end || "");
}

function _avatarInitials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "?").slice(0, 2).toUpperCase();
}

function _pendingDaysLabel(teacher) {
  const last = teacher.lastActivityLabel || "No logs yet";
  const dateMatch = last.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!dateMatch) return { label: "—", cls: "days-urgent" };
  const date = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
  if (Number.isNaN(date.getTime())) return { label: "—", cls: "days-urgent" };
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 1) return { label: days === 1 ? "1 day" : "today", cls: "days-ok" };
  if (days <= 8) return { label: `${days} days`, cls: "days-warn" };
  return { label: `${days} days`, cls: "days-urgent" };
}

function _pendingBadge(teacher) {
  const last = teacher.lastActivityLabel || "No logs yet";
  const isNeverLogged = /no logs yet/i.test(last);
  const isSignedUpOnly = /signed up/i.test(last) && teacher.monthEntries === 0;
  const { cls } = _pendingDaysLabel(teacher);
  if (isNeverLogged) return { label: "Never logged", cls: "badge-red" };
  if (isSignedUpOnly) return { label: "New · no logs", cls: "badge-amber" };
  if (cls === "days-urgent") return { label: "Inactive", cls: "badge-red" };
  if (cls === "days-warn") return { label: "Missed today", cls: "badge-amber" };
  return { label: "Active · missed today", cls: "badge-green" };
}

function getInstituteGlanceGeneratedParts(generatedOnLabel) {
  const raw = String(generatedOnLabel || "").replace(/^Generated\s+/i, "").trim();
  const [datePart, timePart] = raw.split(",").map(part => part.trim());
  return {
    raw,
    date: datePart || raw || "Today",
    time: timePart || "",
  };
}

function buildInstituteGlanceDateCard(generatedOnLabel, label = "Generated") {
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  return `
    <div class="date-card">
      <div class="label">${e(label)}</div>
      <div class="date">${e(parts.date)}</div>
      ${parts.time ? `<div class="time">${e(parts.time)}</div>` : ""}
    </div>`;
}

function formatInstituteReportEntryDate(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return String(dateKey || "—");
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildInstituteGlanceCentreCard(row, period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext()) {
  const e = escapeExportHtml;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext);
  const tone = row.noTeachersSignedUp ? "empty" : row.missingToday === 0 ? "good" : "warn";
  const status = row.noTeachersSignedUp
    ? "No sign-ups yet"
    : row.missingToday === 0
      ? "All teachers updated"
      : `${row.missingToday || 0} pending`;
  const submission = row.noTeachersSignedUp
    ? "No linked teachers"
    : `${row.filledToday || 0}/${row.totalTeachers || 0} teachers updated`;
  return `
    <div class="centre-card ${tone}">
      <span class="centre-pill ${tone}">${e(status)}</span>
      <h3>${e(row.institute || "Institute")}</h3>
      <div class="metric-line"><span>Submission</span><strong>${e(submission)}</strong></div>
      <div class="metric-line"><span>Sections taught</span><strong>${row.sectionsTaught || 0}</strong></div>
      <div class="metric-line"><span>Study hours</span><strong>${e(formatDurationShort(row.totalStudyMinutes || 0))}</strong></div>
      <div class="metric-line"><span>Period</span><strong>${e(periodMeta.label)}</strong></div>
    </div>`;
}

function reportValueMatches(a, b) {
  const left = normaliseName(String(a || "").trim());
  const right = normaliseName(String(b || "").trim());
  if (!left || !right) return true;
  return left === right;
}

function syllabusUpdatedLabelForReport(teacher = {}, syllabusRow = {}) {
  const rows = (Array.isArray(teacher.syllabusCoveredRows) ? teacher.syllabusCoveredRows : [])
    .filter(row => reportValueMatches(row.section, syllabusRow.section) && reportValueMatches(row.subject, syllabusRow.subject))
    .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
  return rows[0]?.dateKey ? formatInstituteReportEntryDate(rows[0].dateKey) : "-";
}

const CENTRE_SUMMARY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #111827; --ink-2: #374151; --ink-3: #667085; --ink-4: #98a2b3;
    --rule: #e5e7eb; --rule-strong: #cbd5e1;
    --surface: #ffffff; --surface-2: #f8fafc; --surface-3: #eef2f7;
    --green: #16a34a; --green-bg: #f0fdf4; --green-border: #bbf7d0;
    --amber: #b45309; --amber-bg: #fffbeb; --amber-border: #fde68a;
    --red: #dc2626; --red-bg: #fef2f2; --red-border: #fecaca;
    --blue: #1d4ed8; --blue-bg: #eff6ff; --blue-border: #bfdbfe;
    --teal: #0d9488; --teal-bg: #f0fdfa; --teal-border: #99f6e4;
    --navy: #172554; --navy-2: #1e3a8a;
  }
  body {
    font-family: 'DM Sans', sans-serif; background: var(--surface-2);
    color: var(--ink); font-size: 13.5px; line-height: 1.5;
    padding: 30px 24px 56px; max-width: 980px; margin: 0 auto;
  }
  .report-page { page-break-after: always; min-height: 980px; }
  .report-page:last-child { page-break-after: auto; }
  .cover {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff; border-radius: 20px; padding: 42px 44px; min-height: 650px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .brand-row { display: flex; align-items: center; gap: 14px; }
  .brand-mark { width: 54px; height: 54px; border-radius: 16px; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; }
  .brand-title { font-size: 28px; font-weight: 800; letter-spacing: -0.4px; }
  .brand-sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.68); margin-top: 3px; }
  .cover h1 { font-size: 46px; line-height: 1.02; letter-spacing: -1.2px; margin: 80px 0 12px; max-width: 680px; }
  .cover-copy { font-size: 18px; color: rgba(255,255,255,0.78); max-width: 690px; line-height: 1.55; }
  .cover-meta-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 42px; }
  .cover-meta { background: rgba(255,255,255,0.11); border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 14px 16px; }
  .cover-meta .label { color: rgba(255,255,255,0.64); font-size: 10px; letter-spacing: 1.3px; text-transform: uppercase; margin-bottom: 6px; }
  .cover-meta .value { color: #fff; font-size: 18px; font-weight: 700; }
  .executive-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid var(--ink); margin-bottom: 18px; }
  .eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--blue); margin-bottom: 6px; }
  .executive-header h1, .page-header h1 { font-size: 28px; line-height: 1.08; letter-spacing: -0.6px; font-weight: 800; color: var(--ink); }
  .date-card { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 12px 14px; min-width: 190px; text-align: right; }
  .date-card .label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-4); font-weight: 700; }
  .date-card .date { font-size: 16px; color: var(--ink); font-weight: 800; margin-top: 5px; }
  .date-card .time { font-size: 13px; color: var(--ink-3); font-weight: 600; margin-top: 2px; }
  .centre-hero {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff; border-radius: 20px; padding: 28px 34px; margin-bottom: 20px;
    text-align: center; border: 1px solid rgba(255,255,255,0.16);
  }
  .centre-hero .institute-title { color: #fff; max-width: 820px; margin: 0 auto; font-size: 34px; }
  .centre-hero .institute-subtitle { color: rgba(255,255,255,0.72); font-size: 14px; margin-top: 10px; }
  .centre-hero-meta { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  .centre-hero-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 7px 12px; font-size: 12px; color: rgba(255,255,255,0.82); }
  .centre-hero-pill strong { color: #fff; font-weight: 800; margin-left: 5px; }
  .scorecard { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .scorecard.five { grid-template-columns: repeat(5, 1fr); }
  .card { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 10px; padding: 13px 14px; }
  .card .label { font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink-3); margin-bottom: 4px; }
  .card .value { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: var(--ink); line-height: 1.1; }
  .card .sub { font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .card.alert .value { color: var(--red); }
  .card.ok .value { color: var(--green); }
  .executive-summary { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 18px 20px; margin: 16px 0; }
  .executive-summary h2 { font-size: 17px; margin-bottom: 8px; }
  .executive-summary p { color: var(--ink-2); font-size: 13px; line-height: 1.65; }
  .centre-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
  .centre-card { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 14px 15px; page-break-inside: avoid; }
  .centre-card.warn { border-color: var(--amber-border); background: #fffaf2; }
  .centre-card.good { border-color: var(--green-border); background: #f7fef9; }
  .centre-card.empty { background: #f8fafc; }
  .centre-card h3 { font-size: 15px; line-height: 1.25; margin-bottom: 7px; color: var(--ink); }
  .centre-card .metric-line { display: flex; justify-content: space-between; gap: 10px; color: var(--ink-3); font-size: 12px; margin-top: 5px; }
  .centre-card .metric-line strong { color: var(--ink); }
  .centre-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 10.5px; font-weight: 800; margin-bottom: 8px; }
  .centre-pill.good { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
  .centre-pill.warn { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
  .centre-pill.empty { background: var(--surface-3); color: var(--ink-3); border: 1px solid var(--rule); }
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--ink-3); margin-bottom: 8px; margin-top: 24px;
    padding-bottom: 5px; border-bottom: 0.5px solid var(--rule);
  }
  .teacher-block { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
  .teacher-name-row { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: var(--surface-3); border-bottom: 0.5px solid var(--rule); }
  .avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--blue-bg); border: 0.5px solid var(--blue-border); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: var(--blue); flex-shrink: 0; }
  .tname { font-weight: 600; font-size: 12.5px; color: var(--ink); }
  .subject-tag { margin-left: auto; font-size: 10.5px; padding: 2px 8px; border-radius: 99px; background: var(--blue-bg); color: var(--blue); border: 0.5px solid var(--blue-border); font-weight: 500; }
  .col-head { display: grid; grid-template-columns: 90px 130px 1fr 1fr; gap: 0; padding: 5px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-4); border-bottom: 0.5px solid var(--rule); background: var(--surface); }
  .session-row { display: grid; grid-template-columns: 90px 130px 1fr 1fr; gap: 0; padding: 7px 14px; border-bottom: 0.5px solid var(--rule); align-items: center; font-size: 12px; }
  .col-head.multi-day, .session-row.multi-day { grid-template-columns: 86px 82px 112px minmax(150px, 1fr) minmax(100px, 0.8fr); }
  .session-row:last-child { border-bottom: none; }
  .date-str { color: var(--ink); font-size: 11px; font-weight: 600; white-space: nowrap; }
  .section-name { font-weight: 500; color: var(--ink); }
  .time-str { color: var(--ink-3); font-size: 11.5px; }
  .topic { color: var(--ink-2); }
  .notes-str { color: var(--ink-4); font-size: 11px; text-align: right; }
  .syllabus-mini { border-top: 0.5px solid var(--rule); background: #fbfefa; padding: 10px 14px 12px; }
  .syllabus-mini-title { color: var(--green); font-size: 10px; font-weight: 800; letter-spacing: 0.65px; text-transform: uppercase; margin-bottom: 6px; }
  .syllabus-mini-headline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .syllabus-mini-summary { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--ink-3); font-size: 10px; font-weight: 700; }
  .syllabus-mini-summary strong { color: var(--ink); font-size: 11.5px; font-weight: 800; }
  .syllabus-mini-grid { display: grid; grid-template-columns: minmax(210px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: stretch; }
  .syllabus-mini-table { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: #fff; }
  .syllabus-mini-head, .syllabus-mini-row { display: grid; grid-template-columns: 86px minmax(108px, 1fr) 88px; gap: 8px; align-items: center; }
  .syllabus-mini-head { color: var(--ink-4); font-size: 9px; font-weight: 700; letter-spacing: 0.45px; text-transform: uppercase; padding: 7px 10px; background: #f8fbff; }
  .syllabus-mini-row { color: var(--ink-2); font-size: 10.5px; padding: 8px 10px; border-top: 0.5px solid #e8eef8; background: #fff; }
  .syllabus-mini-row .chapter { color: var(--ink); font-weight: 700; }
  .syllabus-mini-row .muted { color: var(--ink-3); }
  .syllabus-chapter-panel { border: 1px solid var(--rule); border-radius: 10px; background: #fff; padding: 9px 10px 10px; }
  .syllabus-chapter-panel h4 { margin: 0 0 8px; font-size: 9.75px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
  .syllabus-chapter-panel.covered h4 { color: var(--green); }
  .syllabus-chapter-panel.pending h4 { color: #7c889b; }
  .syllabus-chapter-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .syllabus-chapter-chip { display: inline-flex; align-items: center; gap: 5px; min-height: 24px; padding: 5px 8px; border-radius: 999px; font-size: 9.75px; font-weight: 700; line-height: 1.2; border: 1px solid transparent; }
  .syllabus-chapter-chip.covered { color: #166534; background: #e9faf3; border-color: #c7eddc; }
  .syllabus-chapter-chip.pending { color: #64748b; background: #f6f8fc; border-color: #e2e8f0; }
  .syllabus-chapter-mark { width: 14px; height: 14px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; line-height: 1; flex: 0 0 14px; }
  .syllabus-chapter-chip.covered .syllabus-chapter-mark { background: #059669; color: #fff; }
  .syllabus-chapter-chip.pending .syllabus-chapter-mark { background: #e2e8f0; color: #94a3b8; }
  .syllabus-chapter-empty { color: var(--ink-3); font-size: 10px; }
  .syllabus-status { display: inline-block; border-radius: 99px; background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); padding: 2px 8px; font-size: 10px; font-weight: 700; }
  .syllabus-status.progress { background: var(--teal-bg); color: var(--teal); border-color: var(--teal-border); }
  .syllabus-status.pending { background: var(--surface-3); color: var(--ink-3); border-color: var(--rule); }
  .empty-notice { background: var(--blue-bg); border: 0.5px solid var(--blue-border); border-radius: 8px; padding: 16px 18px; color: var(--blue); font-size: 12.5px; margin-bottom: 8px; }
  .empty-notice.green { background: var(--green-bg); border-color: var(--green-border); color: var(--green); }
  .pending-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 0.5px solid var(--rule-strong); border-radius: 8px; overflow: hidden; font-size: 12px; }
  .pending-table thead tr { background: var(--surface-3); }
  .pending-table th { padding: 7px 12px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-4); border-bottom: 0.5px solid var(--rule-strong); white-space: nowrap; }
  .pending-table td { padding: 7px 12px; border-bottom: 0.5px solid var(--rule); color: var(--ink-2); vertical-align: middle; }
  .pending-table tr:last-child td { border-bottom: none; }
  .pending-table .num { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-4); }
  .pending-table .name { font-weight: 500; color: var(--ink); }
  .pending-table .days-col { font-family: 'DM Mono', monospace; font-size: 11.5px; font-weight: 600; }
  .days-urgent { color: var(--red); }
  .days-warn { color: var(--amber); }
  .days-ok { color: var(--ink-3); }
  .td-right { text-align: right; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; letter-spacing: 0.2px; }
  .badge-red { background: var(--red-bg); color: var(--red); border: 0.5px solid var(--red-border); }
  .badge-amber { background: var(--amber-bg); color: var(--amber); border: 0.5px solid var(--amber-border); }
  .badge-green { background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); }
  .page-footer { margin-top: 36px; padding-top: 12px; border-top: 0.5px solid var(--rule); display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-4); }
  @media print {
    @page {
      margin: 0;
      size: A4 portrait;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      background: white !important;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    .report-page {
      min-height: 0;
      padding: 1.1cm 1.2cm;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    body > .page-footer { margin: 0 1.2cm 1.1cm; }
    .teacher-block, .syllabus-mini { page-break-inside: avoid; break-inside: avoid; }
    .pending-table tr { page-break-inside: avoid; break-inside: avoid; }
    .scorecard, .centre-card, .executive-summary { page-break-inside: avoid; break-inside: avoid; }
    .section-title { page-break-after: avoid; break-after: avoid; }
  }
`;

function buildInstituteGlanceHtmlPage(row, generatedOnLabel, options = {}) {
  const e = escapeExportHtml;
  const dateContext = options.dateContext || buildDateContext();
  const { standalone = true, period = "daily", rangeStartKey = "", rangeEndKey = "" } = options;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext);
  const filled = row.filledTeacherRows || [];
  const pending = row.pendingTeacherRows || [];
  const total = row.totalTeachers || 0;
  const filledCount = row.filledToday || 0;
  const pendingCount = row.missingToday || 0;
  const sections = row.sectionsTaught || 0;
  const hours = formatDurationShort(row.totalStudyMinutes || 0);
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const showEntryDates = periodMeta.key !== "daily";

  let filledHtml = "";
  if (!filled.length) {
    filledHtml = `<div class="empty-notice">No teacher has uploaded during this ${e(periodMeta.label.toLowerCase())} period.</div>`;
  } else {
    filledHtml = showEntryDates
      ? `<div class="col-head multi-day"><span>Date</span><span>Section</span><span>Time</span><span>Topic / Title</span><span style="text-align:right">Notes</span></div>`
      : `<div class="col-head"><span>Section</span><span>Time</span><span>Topic / Title</span><span style="text-align:right">Notes</span></div>`;
    filled.forEach(teacher => {
      const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
      const initials = _avatarInitials(teacher.name);
      const declaredSyllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      const subjectSet = [...new Set([
        ...details.map(detail => detail.subject).filter(Boolean),
        ...declaredSyllabusRows.map(detail => detail.subject).filter(Boolean),
      ])];
      const subjectLabel = subjectSet.join(", ") || "—";
      let rows = "";
      if (!details.length) {
        rows = showEntryDates
          ? `<div class="session-row multi-day"><span class="date-str">—</span><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries === 1 ? "y" : "ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`
          : `<div class="session-row"><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries === 1 ? "y" : "ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`;
      } else {
        rows = details.map(detail => `
          <div class="session-row${showEntryDates ? " multi-day" : ""}">
            ${showEntryDates ? `<span class="date-str">${e(formatInstituteReportEntryDate(detail.dateKey))}</span>` : ""}
            <span class="section-name">${e(detail.section || "—")}</span>
            <span class="time-str">${e(formatExportPdfTime(detail.timeStart, detail.timeEnd) || "—")}</span>
            <span class="topic">${e(detail.title || detail.subject || "—")}</span>
            <span class="notes-str">${e(detail.notes || "—")}</span>
          </div>`).join("");
      }
      const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      if (syllabusRows.length) {
        rows += `
          <div class="syllabus-mini">
            ${syllabusRows.map(item => {
              const totalChapters = Math.max(0, Number(item.totalCount || 0));
              const coveredChapters = Math.max(0, Number(item.coveredCount || 0));
              const progressPct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0;
              const statusClass = item.status === "Complete" ? "" : item.status === "In progress" ? " progress" : " pending";
              const coveredTitles = Array.isArray(item.coveredChapterTitles) ? item.coveredChapterTitles : [];
              const pendingTitles = Array.isArray(item.pendingChapterTitles) ? item.pendingChapterTitles : [];
              return `
                <div class="syllabus-mini-headline">
                  <div class="syllabus-mini-title">Syllabus tracker</div>
                  <div class="syllabus-mini-summary">
                    <span><strong>${e(`${coveredChapters} of ${totalChapters}`)}</strong> chapters covered</span>
                    <span>${progressPct}%</span>
                    <span><span class="syllabus-status${statusClass}">${e(item.status || "Not started")}</span></span>
                  </div>
                </div>
                <div class="syllabus-mini-grid">
                  <div class="syllabus-mini-table">
                    <div class="syllabus-mini-head">
                      <span>Section</span><span>Syllabus</span><span>Updated</span>
                    </div>
                    <div class="syllabus-mini-row">
                      <span class="muted">${e(item.section || "—")}</span>
                      <span class="chapter">${e(item.syllabusName || item.subject || subjectLabel || "—")}</span>
                      <span class="muted">${e(syllabusUpdatedLabelForReport(teacher, item))}</span>
                    </div>
                  </div>
                  <div class="syllabus-chapter-panel covered">
                    <h4>Covered chapters</h4>
                    ${coveredTitles.length
                      ? `<div class="syllabus-chapter-list">${coveredTitles.map(title => `<span class="syllabus-chapter-chip covered"><span class="syllabus-chapter-mark">&#10003;</span><span>${e(title)}</span></span>`).join("")}</div>`
                      : `<div class="syllabus-chapter-empty">No chapters marked covered yet.</div>`}
                  </div>
                  <div class="syllabus-chapter-panel pending">
                    <h4>Not covered yet</h4>
                    ${pendingTitles.length
                      ? `<div class="syllabus-chapter-list">${pendingTitles.map(title => `<span class="syllabus-chapter-chip pending"><span class="syllabus-chapter-mark">&bull;</span><span>${e(title)}</span></span>`).join("")}</div>`
                      : `<div class="syllabus-chapter-empty">Every chapter is marked covered.</div>`}
                  </div>
                </div>`;
            }).join("")}
          </div>`;
      }
      filledHtml += `
        <div class="teacher-block">
          <div class="teacher-name-row">
            <div class="avatar">${e(initials)}</div>
            <span class="tname">${e(teacher.name || "Teacher")}</span>
            <span class="subject-tag">${e(subjectLabel)}</span>
          </div>
          ${rows}
        </div>`;
    });
  }

  let pendingHtml = "";
  if (!pending.length) {
    pendingHtml = `<div class="empty-notice green">All linked teachers in this centre have already uploaded their entries today.</div>`;
  } else {
    const rows = pending.map((teacher, index) => {
      const last = teacher.lastActivityLabel || "No logs yet";
      const { label: daysLabel, cls: daysCls } = _pendingDaysLabel(teacher);
      const badge = _pendingBadge(teacher);
      return `<tr>
        <td class="num">${index + 1}</td>
        <td class="name">${e(teacher.name || "Teacher")}</td>
        <td>${e(last)}</td>
        <td class="td-right days-col ${daysCls}">${e(daysLabel)}</td>
        <td class="td-right num">${teacher.monthEntries || 0}</td>
        <td class="td-right"><span class="badge ${badge.cls}">${e(badge.label)}</span></td>
      </tr>`;
    }).join("");
    pendingHtml = `
      <table class="pending-table">
        <thead><tr>
          <th>#</th><th>Teacher</th><th>Last entry</th>
          <th class="td-right">Days inactive</th>
          <th class="td-right">Sections this month</th>
          <th class="td-right">Priority</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const generatedParts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  return `
    ${standalone ? `<section class="report-page">` : ""}
      <div class="centre-hero">
        <div class="institute-title">${e(row.institute || "Centre Summary")}</div>
        <div class="institute-subtitle">${e(periodMeta.title)} · Submissions, pending teachers, sections, and hours.</div>
        <div class="centre-hero-meta">
          <span class="centre-hero-pill">Period <strong>${e(periodMeta.label)}</strong></span>
          <span class="centre-hero-pill">Date <strong>${e(generatedParts.date)}</strong></span>
          ${generatedParts.time ? `<span class="centre-hero-pill">Generated <strong>${e(generatedParts.time)}</strong></span>` : ""}
        </div>
      </div>

      <div class="scorecard">
        <div class="card ok">
          <div class="label">${e(periodMeta.updatedLabel)}</div>
          <div class="value">${filledCount}/${total}</div>
          <div class="sub">${pct}% submission rate</div>
        </div>
        <div class="card alert">
          <div class="label">${e(periodMeta.pendingLabel)}</div>
          <div class="value">${pendingCount}</div>
          <div class="sub">not filled yet</div>
        </div>
        <div class="card">
          <div class="label">Sections taught</div>
          <div class="value">${sections}</div>
          <div class="sub">${e(periodMeta.sectionsSubLabel)}</div>
        </div>
        <div class="card">
          <div class="label">Study hours</div>
          <div class="value">${e(hours)}</div>
          <div class="sub">${e(periodMeta.hoursSubLabel)}</div>
        </div>
      </div>

      <div class="section-title">${e(periodMeta.activeLabel)} (${filled.length})</div>
      ${filledHtml}

      <div class="section-title">Pending follow-up (${pending.length})${pending.length ? " - sorted by urgency" : ""}</div>
      ${pendingHtml}

      <div class="page-footer">
        <span>${e(row.institute || "Centre")} · Ledgr</span>
        <span>${e(generatedOnLabel)}</span>
      </div>
    ${standalone ? `</section>` : ""}`;
}

function buildInstituteGlanceSummaryHtml({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes", dateContext = buildDateContext() }) {
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext);
  const completionPct = summary.totalTeachers > 0 ? Math.round(((summary.filledToday || 0) / summary.totalTeachers) * 100) : 0;
  const sortedRows = [...(rows || [])].sort((a, b) => {
    if ((b.missingToday || 0) !== (a.missingToday || 0)) return (b.missingToday || 0) - (a.missingToday || 0);
    return exportTextSorter.compare(a.institute || "", b.institute || "");
  });
  const coverScorecard = `
    <div class="scorecard five">
      <div class="card"><div class="label">Institutes</div><div class="value">${summary.totalInstitutes || 0}</div></div>
      <div class="card ok"><div class="label">${e(periodMeta.updatedLabel)}</div><div class="value">${summary.filledToday || 0}/${summary.totalTeachers || 0}</div></div>
      <div class="card alert"><div class="label">${e(periodMeta.pendingLabel)}</div><div class="value">${summary.missingToday || 0}</div></div>
      <div class="card"><div class="label">Sections taught</div><div class="value">${summary.sectionsTaught || 0}</div></div>
      <div class="card"><div class="label">Study hours</div><div class="value">${e(formatDurationShort(summary.totalStudyMinutes || 0))}</div></div>
    </div>`;

  const centreCards = sortedRows.map(row => buildInstituteGlanceCentreCard(row, period, rangeStartKey, rangeEndKey, dateContext)).join("");
  const institutePages = (rows || []).map(row => buildInstituteGlanceHtmlPage(row, generatedOnLabel, {
    standalone: true,
    period,
    rangeStartKey,
    rangeEndKey,
    dateContext,
  })).join("");

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${e(periodMeta.title)} - ${e(parts.date)}${parts.time ? ` ${e(parts.time)}` : ""}</title>
    <style>${CENTRE_SUMMARY_CSS}</style>
  </head><body>
    <section class="report-page">
      <div class="cover">
        <div>
          <div class="brand-row">
            <div class="brand-mark">L</div>
            <div>
              <div class="brand-title">Ledgr</div>
              <div class="brand-sub">${e(periodMeta.label)} Report</div>
            </div>
          </div>
          <h1>${e(periodMeta.title)}</h1>
          <div class="cover-copy">Teacher submissions and pending follow-up for ${e(scopeLabel === "All institutes" ? "all institutes" : scopeLabel)}.</div>
          <div class="cover-meta-grid">
            <div class="cover-meta"><div class="label">Report period</div><div class="value">${e(periodMeta.periodValue || periodMeta.label)}</div></div>
            <div class="cover-meta"><div class="label">Scope</div><div class="value">${e(scopeLabel)}</div></div>
            <div class="cover-meta"><div class="label">Generated</div><div class="value">${e(`${parts.date}${parts.time ? ` · ${parts.time}` : ""}`)}</div></div>
          </div>
        </div>
        <div class="cover-copy">Pending institutes appear first.</div>
      </div>
    </section>

    <section class="report-page">
      <div class="executive-header">
        <div>
          <div class="eyebrow">Overview</div>
          <h1>${e(periodMeta.title)}</h1>
        </div>
        ${buildInstituteGlanceDateCard(generatedOnLabel, "Report generated")}
      </div>
      ${coverScorecard}
      <div class="executive-summary">
        <h2>Summary</h2>
        <p>${summary.filledToday || 0} of ${summary.totalTeachers || 0} teachers updated (${completionPct}%). ${summary.missingToday || 0} teachers are pending follow-up. The network logged ${summary.sectionsTaught || 0} sections and ${e(formatDurationShort(summary.totalStudyMinutes || 0))} of study time.</p>
      </div>
      <div class="section-title">Institutes - pending first</div>
      <div class="centre-grid">${centreCards}</div>
    </section>

    ${institutePages}
    <div class="page-footer">
      <span>Ledgr · ${e(scopeLabel)} summary</span>
      <span>${e(generatedOnLabel)}</span>
    </div>
  </body></html>`;
}

function buildTeacherIndexPayload(uid, data) {
  const classes = Array.isArray(data?.classes) ? data.classes : [];
  const classInstitutes = uniqueTrimmed(classes.map(cls => cls?.institute));
  const profileInstitutes = uniqueTrimmed(Array.isArray(data?.profile?.institutes) ? data.profile.institutes : []);
  const classSubjects = uniqueTrimmed(classes.map(cls => cls?.subject));
  const profileSubjects = uniqueTrimmed(Array.isArray(data?.profile?.subjects) ? data.profile.subjects : []);
  return {
    uid,
    name: data?.profile?.name || "",
    institutes: uniqueTrimmed([...classInstitutes, ...profileInstitutes]),
    subjects: uniqueTrimmed([...classSubjects, ...profileSubjects]),
    classCount: classes.length,
    lastActive: Number(data?._meta?.lastActive || 0) || Date.now(),
  };
}

async function readAllTeacherSummaries(db) {
  try {
    const [teachersSnap, rolesSnap, appdataSnap] = await Promise.all([
      db.collection("teachers").get(),
      db.collection("roles").get(),
      db.collectionGroup("appdata").where(FieldPath.documentId(), "==", "main").get(),
    ]);

    const merged = new Map();
    teachersSnap.docs.forEach(docSnap => {
      merged.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() });
    });
    rolesSnap.docs.forEach(docSnap => {
      if (!merged.has(docSnap.id)) {
        merged.set(docSnap.id, { uid: docSnap.id, name: "", institutes: [], classCount: 0 });
      }
    });
    appdataSnap.docs.forEach(docSnap => {
      const uid = docSnap.ref.parent.parent?.id;
      if (!uid) return;
      const data = docSnap.data() || {};
      const summary = buildTeacherIndexPayload(uid, data);
      if (!summary.name && summary.classCount === 0) return;
      const existing = merged.get(uid) || { uid, name: "", institutes: [], classCount: 0 };
      merged.set(uid, {
        ...existing,
        ...summary,
        name: summary.name || existing.name,
        institutes: summary.institutes.length ? summary.institutes : (existing.institutes || []),
        classCount: Math.max(summary.classCount || 0, existing.classCount || 0),
      });
    });
    return Array.from(merged.values());
  } catch {
    return [];
  }
}

async function readAllRoles(db) {
  try {
    const snap = await db.collection("roles").get();
    const map = {};
    snap.docs.forEach(docSnap => {
      map[docSnap.id] = docSnap.data()?.role || "";
    });
    return map;
  } catch {
    return {};
  }
}

async function readSyllabusTemplates(db) {
  try {
    const snap = await db.collection("syllabusTemplates").get();
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch {
    return [];
  }
}

async function readInstituteSections(db) {
  try {
    const snap = await db.doc("config/sections").get();
    return snap.exists ? (snap.data() || {}) : {};
  } catch {
    return {};
  }
}

async function loadTeacherFullDataMap(db, teacherUids = []) {
  const map = {};
  await Promise.all((teacherUids || []).map(async uid => {
    try {
      const mainRef = db.doc(`users/${uid}/appdata/main`);
      const mainSnap = await mainRef.get();
      if (!mainSnap.exists) return;
      const main = mainSnap.data() || {};
      const classes = Array.isArray(main.classes) ? main.classes : [];
      const noteRefs = classes.map(cls => db.doc(`users/${uid}/appdata/notes_${cls.id}`));
      const noteSnaps = noteRefs.length ? await db.getAll(...noteRefs) : [];
      const notes = {};
      noteSnaps.forEach((noteSnap, index) => {
        const classId = classes[index]?.id;
        if (!classId) return;
        notes[classId] = noteSnap.exists ? (noteSnap.data() || {}) : {};
      });
      map[uid] = {
        ...main,
        notes,
      };
    } catch {}
  }));
  return map;
}

function normaliseLedgrScheduleTimes(times) {
  return [...new Set((times || [])
    .map(value => String(value || "").trim())
    .filter(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)))]
    .sort((a, b) => a.localeCompare(b));
}

export function normaliseTelegramChatId(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function normaliseTelegramUsername(value) {
  const clean = String(value || "").trim().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function normaliseLedgrTelegramRecipients(list) {
  const seen = new Set();
  return (list || [])
    .map((item, index) => {
      const institute = String(item?.institute || "").trim().replace(/\s+/g, " ");
      const label = String(item?.label || "").trim();
      const username = normaliseTelegramUsername(item?.username);
      const chatId = normaliseTelegramChatId(item?.chatId);
      const notes = String(item?.notes || "").trim();
      const destinationType = ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "channel";
      const enabled = item?.enabled !== false;
      const touched = institute || label || username || chatId || notes;
      if (!touched) return null;
      if (!institute || !chatId || !/^-?\d{5,}$/.test(chatId)) return null;
      const dedupeKey = `${institute.toLowerCase()}__${chatId}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        id: String(item?.id || `${institute}_${chatId}_${index + 1}`).trim().replace(/\s+/g, "_"),
        institute,
        label,
        username,
        chatId,
        notes,
        destinationType,
        enabled,
      };
    })
    .filter(Boolean);
}

function normaliseLedgrTelegramFullReportRecipients(list) {
  const seen = new Set();
  return (list || [])
    .map((item, index) => {
      const label = String(item?.label || "").trim();
      const username = normaliseTelegramUsername(item?.username);
      const chatId = normaliseTelegramChatId(item?.chatId);
      const notes = String(item?.notes || "").trim();
      const destinationType = ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "private";
      const enabled = item?.enabled !== false;
      const touched = label || username || chatId || notes;
      if (!touched) return null;
      if (!chatId || !/^-?\d{5,}$/.test(chatId)) return null;
      if (seen.has(chatId)) return null;
      seen.add(chatId);
      return {
        id: String(item?.id || `telegram_full_${chatId}_${index + 1}`).trim().replace(/\s+/g, "_"),
        label,
        username,
        chatId,
        notes,
        destinationType,
        enabled,
      };
    })
    .filter(Boolean);
}

function resolveScheduleReportWindow(schedule = {}, dateContext = buildDateContext()) {
  const rawPeriod = ["daily", "yesterday", "weekly", "monthly", "range"].includes(schedule?.report?.period)
    ? schedule.report.period
    : "daily";
  if (rawPeriod === "monthly") {
    const bounds = monthBoundsFromKey(dateContext.currentMonthKey);
    return { period: "monthly", rangeStartKey: bounds.startKey, rangeEndKey: bounds.endKey };
  }
  if (rawPeriod === "range") {
    const start = String(schedule?.report?.rangeStart || dateContext.todayKey).trim();
    const end = String(schedule?.report?.rangeEnd || start).trim() || start;
    return start <= end
      ? { period: "range", rangeStartKey: start, rangeEndKey: end }
      : { period: "range", rangeStartKey: end, rangeEndKey: start };
  }
  return { period: rawPeriod, rangeStartKey: "", rangeEndKey: "" };
}

function buildScopedRecipients(schedule = {}, telegramConfig = {}) {
  const recipients = normaliseLedgrTelegramRecipients(telegramConfig?.recipients || [])
    .filter(item => item.enabled !== false);
  const scopeType = schedule?.scope?.type === "selected" ? "selected" : "all";
  const selectedInstitutes = scopeType === "selected"
    ? uniqueTrimmed(schedule?.scope?.institutes || [])
    : [];
  return recipients.filter(item =>
    scopeType !== "selected"
      || selectedInstitutes.some(institute => sameInstituteName(institute, item.institute)),
  );
}

function buildFullReportRecipients(telegramConfig = {}) {
  return normaliseLedgrTelegramFullReportRecipients(telegramConfig?.fullReportRecipients || [])
    .filter(item => item.enabled !== false);
}

const HOBBY_BATCH_TIME_KEY = "20:00";

export function getDueScheduledSlot(schedule = {}, now = new Date()) {
  const timeZone = String(schedule?.timezone || "Asia/Kolkata").trim() || "Asia/Kolkata";
  const dateContext = buildDateContext(timeZone, now);
  const times = [HOBBY_BATCH_TIME_KEY];
  const enabled = !!schedule?.enabled;
  return {
    enabled,
    mode: "daily_batch",
    timeZone,
    times,
    dateContext,
    due: !!enabled,
    dueTimeKey: HOBBY_BATCH_TIME_KEY,
    slotKey: `${dateContext.todayKey}@${HOBBY_BATCH_TIME_KEY}`,
  };
}

function instituteRowScopeLabel(row) {
  return row?.institute || "Institute";
}

function instituteCaption(row) {
  return `Ledgr Report | ${row?.institute || "Institute"}`;
}

export async function buildScheduledTelegramJobs({ db, schedule = {}, telegramConfig = {}, now = new Date() }) {
  const dateContext = buildDateContext(String(schedule?.timezone || "Asia/Kolkata").trim() || "Asia/Kolkata", now);
  const recipients = buildScopedRecipients(schedule, telegramConfig);
  const fullReportRecipients = buildFullReportRecipients(telegramConfig);
  if (!recipients.length && !fullReportRecipients.length) {
    return {
      dateContext,
      recipients: [],
      fullReportRecipients: [],
      rows: [],
      summary: { ...EMPTY_INSTITUTE_GLANCE_SUMMARY },
      jobs: [],
      period: "daily",
      rangeStartKey: "",
      rangeEndKey: "",
      scopeLabel: "All institutes",
      generatedOnLabel: dateContext.generatedOnLabel,
    };
  }

  const { period, rangeStartKey, rangeEndKey } = resolveScheduleReportWindow(schedule, dateContext);
  const [allTeachers, roles, syllabusTemplates, instituteSections] = await Promise.all([
    readAllTeacherSummaries(db),
    readAllRoles(db),
    readSyllabusTemplates(db),
    readInstituteSections(db),
  ]);

  const requestedInstitutes = (() => {
    if (recipients.length) {
      return uniqueTrimmed(recipients.map(item => item.institute));
    }
    if (schedule?.scope?.type === "selected") {
      return uniqueTrimmed(schedule?.scope?.institutes || []);
    }
    return uniqueTrimmed(allTeachers.flatMap(teacher => teacher?.institutes || []));
  })();
  const scopeLabel = schedule?.scope?.type === "selected"
    ? `${requestedInstitutes.length} institute${requestedInstitutes.length === 1 ? "" : "s"} selected`
    : "All institutes";

  const relevantTeachers = allTeachers.filter(teacher =>
    requestedInstitutes.some(institute =>
      (teacher?.institutes || []).some(current => sameInstituteName(current, institute)),
    ),
  );

  const fullDataMap = await loadTeacherFullDataMap(db, relevantTeachers.map(teacher => teacher.uid).filter(Boolean));
  const rows = buildInstituteGlanceRows({
    institutes: requestedInstitutes,
    teachers: relevantTeachers,
    fullDataMap,
    resolveSectionName: (section, instituteName) => resolveAdminSectionName(section, instituteName, instituteSections),
    syllabusTemplates,
    roles,
    period,
    rangeStartKey,
    rangeEndKey,
    dateContext,
  });
  const summary = summariseInstituteGlanceRows(rows);
  const generatedOnLabel = dateContext.generatedOnLabel;
  const jobs = recipients.map(recipient => {
    const row = rows.find(item => sameInstituteName(item?.institute, recipient.institute));
    const rowList = row ? [row] : [];
    const html = buildInstituteGlanceSummaryHtml({
      rows: rowList,
      summary: summariseInstituteGlanceRows(rowList),
      generatedOnLabel,
      period,
      rangeStartKey,
      rangeEndKey,
      scopeLabel: instituteRowScopeLabel(row),
      dateContext,
    });
    return {
      recipientId: recipient.id,
      institute: recipient.institute,
      label: recipient.label || "",
      chatId: recipient.chatId,
      destinationType: recipient.destinationType || "channel",
      notes: recipient.notes || "",
      filename: instituteGlancePdfFilename(recipient.institute, period, rangeStartKey, rangeEndKey, dateContext),
      caption: instituteCaption(row || recipient),
      html,
      reportKind: "institute",
    };
  });
  if (fullReportRecipients.length) {
    const html = buildInstituteGlanceSummaryHtml({
      rows,
      summary,
      generatedOnLabel,
      period,
      rangeStartKey,
      rangeEndKey,
      scopeLabel,
      dateContext,
    });
    fullReportRecipients.forEach(recipient => {
      jobs.push({
        recipientId: recipient.id,
        institute: "",
        label: recipient.label || "",
        username: recipient.username || "",
        chatId: recipient.chatId,
        destinationType: recipient.destinationType || "private",
        notes: recipient.notes || "",
        filename: allInstitutesGlancePdfFilename(period, rangeStartKey, rangeEndKey, dateContext),
        caption: `Ledgr Report | ${scopeLabel}`,
        html,
        reportKind: "full_report",
      });
    });
  }

  return {
    dateContext,
    recipients,
    fullReportRecipients,
    rows,
    summary,
    jobs,
    period,
    rangeStartKey,
    rangeEndKey,
    scopeLabel,
    generatedOnLabel,
  };
}

function instituteGlancePdfFilename(instituteName, period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext()) {
  return `${slugifyDownloadPart(instituteName)}_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext).filePart}_ledgr_report_${dateContext.todayKey}.pdf`;
}

function allInstitutesGlancePdfFilename(period = "daily", rangeStartKey = "", rangeEndKey = "", dateContext = buildDateContext()) {
  return `all_institutes_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey, dateContext).filePart}_ledgr_report_${dateContext.todayKey}.pdf`;
}
