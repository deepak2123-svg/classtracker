import { STATUS_STYLES, TAG_STYLES } from "../../shared.jsx";
import {
  currentMonthKey,
  daysAgo,
  entryDurationMinutes,
  formatDurationShort,
  getEntriesInRange,
  lastEntryTs,
  longDateLabel,
  shortDateLabel,
} from "../utils/adminDates.js";
import {
  activeAdminTeacherClasses,
  getTeacherDisplayNameFromMap,
  teacherBelongsToInstituteFromMap,
} from "../utils/adminTeachers.js";
import { exportTextSorter, normaliseName, sameInstituteName } from "../utils/adminText.js";
import {
  buildSyllabusReportRowsForClass,
  countTeachingEntriesForMonth,
  getPublishedSyllabusPayload,
  getSyllabusProgressChapterTitle,
  isSyllabusProgressEntry,
  isTeachingActivityEntry,
} from "../syllabus/syllabusReportUtils.js";
import { getInstituteGlancePeriodMeta } from "./instituteGlanceReportUtils.js";

export const EMPTY_INSTITUTE_GLANCE_SUMMARY = {
  totalInstitutes: 0,
  totalTeachers: 0,
  filledToday: 0,
  missingToday: 0,
  loadedTeachers: 0,
  sectionsTaught: 0,
  totalStudyMinutes: 0,
  totalTodayEntries: 0,
};

function firstClassCreatedTs(classes = []) {
  return (classes || []).reduce((earliest, cls) => {
    const created = Number(cls?.created || 0) || 0;
    if (!created) return earliest;
    if (!earliest) return created;
    return Math.min(earliest, created);
  }, 0) || null;
}

export function instituteGlanceLastActivityLabel(teacherRow) {
  if (teacherRow?.lastEntryTs) {
    return longDateLabel(teacherRow.lastEntryTs);
  }
  if (teacherRow?.joinedAtTs) {
    return `Signed up ${longDateLabel(teacherRow.joinedAtTs)}`;
  }
  return "No logs yet";
}

function instituteGlanceTodayStatusLabel(teacherRow) {
  return teacherRow?.updatedToday ? "Filled today" : "Pending today";
}

export function instituteGlanceTeacherHoursLabel(teacherRow) {
  return teacherRow?.totalMinutes > 0
    ? formatDurationShort(teacherRow.totalMinutes)
    : teacherRow?.untimedEntries > 0
      ? "Untimed"
      : "0m";
}

export function instituteGlanceTeacherSectionCaption(teacherRow) {
  return teacherRow?.sectionNames?.length
    ? teacherRow.sectionNames.join(", ")
    : teacherRow?.updatedToday
      ? "Uploaded without a section name"
      : "No section was taught today";
}

export function lastEntryCaption(ts) {
  if (!ts) return "Last entry: no logs yet";
  const relative = daysAgo(ts);
  return `Last entry: ${relative || shortDateLabel(ts)}`;
}

function buildInstituteGlanceTeacherActivity({ teacher, instituteName, fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], period = "daily", rangeStartKey = "", rangeEndKey = "" }) {
  const data = fullDataMap?.[teacher?.uid];
  const classesHere = data
    ? activeAdminTeacherClasses(data).filter(cls => sameInstituteName(cls?.institute, instituteName))
    : [];
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const monthKey = currentMonthKey();
  const sectionMap = new Map();
  const syllabusCoverageMap = new Map();
  const syllabusDeclaredMap = new Map();
  const publishedSyllabi = (Array.isArray(syllabusTemplates) ? syllabusTemplates : [])
    .map(getPublishedSyllabusPayload)
    .filter(Boolean);
  const todayDetails = [];
  let todayEntries = 0;
  let monthEntries = 0;
  let totalMinutes = 0;
  let untimedEntries = 0;

  classesHere.forEach(cls => {
    const classNotes = (data.notes || {})[cls.id] || {};
    const notesToday = getEntriesInRange(classNotes, periodMeta.days, periodMeta.startKey, periodMeta.endKey);
    monthEntries += countTeachingEntriesForMonth(classNotes, monthKey);

    const resolvedSection = typeof resolveSectionName === "function"
      ? resolveSectionName(cls?.section, cls?.institute || instituteName)
      : cls?.section;
    const sectionLabel = normaliseName(String(resolvedSection || cls?.section || "Untitled section").trim() || "Untitled section");
    const currentSection = sectionMap.get(sectionLabel) || {
      name: sectionLabel,
      entryCount: 0,
      totalMinutes: 0,
    };

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
      if (!isTeachingActivityEntry(entry)) return;
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
        type: entry?.tag || "note",
        typeLabel: TAG_STYLES[entry?.tag]?.label || entry?.tag || "note",
        status: entry?.status || "",
        statusLabel: STATUS_STYLES[entry?.status]?.label || entry?.status || "",
        title: entry?.title || "",
        notes: entry?.body || "",
        minutes: mins,
      });
    });

    if (currentSection.entryCount > 0) sectionMap.set(sectionLabel, currentSection);
  });

  const lastEntry = data
    ? classesHere.reduce((latest, cls) => Math.max(latest, lastEntryTs((data.notes || {})[cls.id] || {}, isTeachingActivityEntry) || 0), 0)
    : Number(teacher?.lastActive || 0) || 0;
  const joinedAtTs = classesHere.length
    ? firstClassCreatedTs(classesHere)
    : firstClassCreatedTs(data?.classes || []);
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
    lastActivityLabel: instituteGlanceLastActivityLabel({
      lastEntryTs: lastEntry || null,
      joinedAtTs: joinedAtTs || null,
    }),
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

export function buildInstituteGlanceRows({ institutes = [], teachers = [], fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], roles = {}, roleDetails = {}, period = "daily", rangeStartKey = "", rangeEndKey = "" }) {
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const isExpectedReportTeacher = uid => roles?.[uid] !== "admin"
    || roleDetails?.[uid]?.adminMode === "admin_teacher"
    || roleDetails?.[uid]?.teaches === true;
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
      }))
      .filter(item => isExpectedReportTeacher(item.uid));
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

export function summariseInstituteGlanceRows(rows = []) {
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
