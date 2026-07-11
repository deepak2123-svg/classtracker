import { isTeachingActivityEntry } from "../syllabus/syllabusReportUtils.js";
import { activeAdminTeacherClasses } from "../utils/adminTeachers.js";
import { entryDurationMinutes } from "../utils/adminDates.js";
import { exportTextSorter, normaliseName, safeAdminText, sameInstituteName } from "../utils/adminText.js";
import { buildEffectiveClassNotes, collectCanonicalTeachingEntryRecords } from "../../jointEntries.js";

export const TEACHER_PROFILE_ALL_SECTIONS_KEY = "__all_sections__";

const PLACEHOLDER_INSTITUTE = "No institute assigned";

function uniqueLabels(values = []) {
  const output = [];
  values.forEach(value => {
    const text = String(value || "").trim();
    if (!text) return;
    if (output.some(existing => existing.toLowerCase() === text.toLowerCase())) return;
    output.push(text);
  });
  return output;
}

function teacherInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function fallbackName(teacher, row) {
  return safeAdminText(row?.name || row?.rawName || teacher?.name || teacher?.displayName || teacher?.email, "Teacher");
}

function fallbackEmail(teacher, row) {
  return safeAdminText(row?.email || teacher?.email, "Email not available");
}

function defaultSectionName(cls) {
  return normaliseName(cls?.section || cls?.name || "Class") || "Class";
}

function defaultSubjectName(cls) {
  return safeAdminText(cls?.subject, "No subject");
}

function resolveSection(resolveSectionName, cls) {
  try {
    const resolved = typeof resolveSectionName === "function" ? resolveSectionName(cls) : "";
    return normaliseName(resolved || defaultSectionName(cls)) || "Class";
  } catch {
    return defaultSectionName(cls);
  }
}

function resolveSubject(resolveClassSubject, teacher, cls) {
  try {
    const resolved = typeof resolveClassSubject === "function" ? resolveClassSubject(teacher, cls) : "";
    return safeAdminText(resolved || defaultSubjectName(cls), "No subject");
  } catch {
    return defaultSubjectName(cls);
  }
}

function stableClassKey(cls, section, subject, institute) {
  const id = String(cls?.id || cls?.classId || "").trim();
  if (id) return id;
  return [
    normaliseName(section || "class").toLowerCase(),
    normaliseName(subject || "subject").toLowerCase(),
    normaliseName(institute || PLACEHOLDER_INSTITUTE).toLowerCase(),
  ].join("::");
}

function parseClockMinutes(value) {
  if (!/^\d{1,2}:\d{2}$/.test(String(value || ""))) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function dateKeyTimeMs(dateKey, timeStart = "") {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return 0;
  const startMinutes = parseClockMinutes(timeStart);
  const hours = startMinutes === null ? 12 : Math.floor(startMinutes / 60);
  const minutes = startMinutes === null ? 0 : startMinutes % 60;
  return new Date(year, month - 1, day, hours, minutes, 0).getTime();
}

function entryTimestamp(dateKey, entry) {
  const explicit = Number(entry?.created || entry?.createdAt || entry?.updatedAt || 0) || 0;
  return Math.max(explicit, dateKeyTimeMs(dateKey, entry?.timeStart));
}

function compareTimelineEntries(a, b) {
  if ((b.dateKey || "") !== (a.dateKey || "")) return (b.dateKey || "").localeCompare(a.dateKey || "");
  const bStart = parseClockMinutes(b.timeStart);
  const aStart = parseClockMinutes(a.timeStart);
  if (bStart !== aStart) return (bStart ?? -1) - (aStart ?? -1);
  return (b.sortTs || 0) - (a.sortTs || 0) || exportTextSorter.compare(a.title || "", b.title || "");
}

function makeInstituteGroups(sectionRows, fallbackGroups = [], fallbackInstitutes = []) {
  const map = new Map();
  const ensure = (instituteName) => {
    const institute = String(instituteName || PLACEHOLDER_INSTITUTE).trim() || PLACEHOLDER_INSTITUTE;
    const key = normaliseName(institute).toLowerCase();
    if (!map.has(key)) {
      const fallbackGroup = fallbackGroups.find(group => sameInstituteName(group?.institute, institute));
      map.set(key, {
        key,
        institute,
        classCount: 0,
        minutes: 0,
        entries: 0,
        sections: [],
        subjects: [],
        sourceGroup: fallbackGroup || { institute, classCount: 0 },
      });
    }
    return map.get(key);
  };

  sectionRows.forEach(section => {
    const group = ensure(section.institute);
    group.classCount += 1;
    group.minutes += section.minutes || 0;
    group.entries += section.entries || 0;
    group.sections = uniqueLabels([...group.sections, section.label]);
    group.subjects = uniqueLabels([...group.subjects, section.subject]);
  });

  fallbackInstitutes.forEach(ensure);
  fallbackGroups.forEach(group => {
    const ensured = ensure(group?.institute);
    if (!sectionRows.some(section => sameInstituteName(section.institute, ensured.institute))) {
      ensured.classCount = Math.max(ensured.classCount, Number(group?.classCount || 0));
    }
  });

  return Array.from(map.values()).sort((a, b) => (
    (b.minutes || 0) - (a.minutes || 0)
    || (b.entries || 0) - (a.entries || 0)
    || exportTextSorter.compare(a.institute, b.institute)
  ));
}

function timelineTitle(entry, subject) {
  return safeAdminText(entry?.title || entry?.topic || entry?.chapter || entry?.lesson, subject || "Class entry");
}

function timelineBody(entry) {
  return safeAdminText(entry?.body || entry?.notes || entry?.note || entry?.description || entry?.details, "");
}

export function buildTeacherProfileModel({
  teacher = {},
  teacherData = null,
  row = null,
  resolveSectionName = null,
  resolveClassSubject = null,
  isInstituteActionable = null,
} = {}) {
  const uid = teacher?.uid || row?.teacher?.uid || "";
  const name = fallbackName(teacher, row);
  const branchGroups = (row?.allInstituteGroups?.length ? row.allInstituteGroups : row?.instituteGroups) || [];
  const rowInstitutes = uniqueLabels([
    row?.primaryInstitute,
    ...(row?.membershipInstitutes || []),
    ...(row?.extraInstitutes || []),
    ...branchGroups.map(group => group?.institute),
  ]);
  const detailsReady = !!row?.detailsReady || !!teacherData;
  const classes = teacherData ? activeAdminTeacherClasses(teacherData) : [];
  const classById = new Map(classes.map(cls => [String(cls?.id || cls?.classId || "").trim(), cls]));
  const sectionRows = [];
  const allTimelineEntries = [];
  let totalMinutes = 0;
  let totalEntries = 0;
  let untimedEntries = 0;
  let lastEntryTimestamp = 0;
  const activeDays = new Set();

  classes.forEach(cls => {
    const classId = String(cls?.id || cls?.classId || "").trim();
    const section = resolveSection(resolveSectionName, cls);
    const subject = resolveSubject(resolveClassSubject, teacher, cls);
    const institute = safeAdminText(cls?.institute || row?.primaryInstitute, PLACEHOLDER_INSTITUTE);
    const key = stableClassKey(cls, section, subject, institute);
    const classNotes = classId ? buildEffectiveClassNotes(teacherData?.notes || {}, classId, isTeachingActivityEntry) : {};
    const sectionTimelineEntries = [];
    let minutes = 0;
    let entries = 0;
    let sectionUntimedEntries = 0;
    let sectionLastTs = Number(cls?.created || cls?.updatedAt || 0) || 0;
    const sectionDays = new Set();

    Object.entries(classNotes || {}).forEach(([dateKey, dayEntries]) => {
      if (!Array.isArray(dayEntries)) return;
      dayEntries.forEach((entry, entryIndex) => {
        if (!isTeachingActivityEntry(entry)) return;
        const duration = entryDurationMinutes(entry);
        const sortTs = entryTimestamp(dateKey, entry);
        const timelineEntry = {
          id: safeAdminText(entry?.id || entry?.entryId || `${key}_${dateKey}_${entryIndex}`, `${key}_${dateKey}_${entryIndex}`),
          dateKey,
          sortTs,
          timeStart: safeAdminText(entry?.timeStart, ""),
          timeEnd: safeAdminText(entry?.timeEnd, ""),
          minutes: duration,
          title: timelineTitle(entry, subject),
          body: timelineBody(entry),
          status: safeAdminText(entry?.status, ""),
          tag: safeAdminText(entry?.tag, ""),
          sectionKey: key,
          sectionLabel: section,
          classId,
          subject,
          institute,
        };

        entries += 1;
        totalEntries += 1;
        minutes += duration;
        totalMinutes += duration;
        if (!duration) {
          sectionUntimedEntries += 1;
          untimedEntries += 1;
        }
        sectionDays.add(dateKey);
        activeDays.add(dateKey);
        sectionLastTs = Math.max(sectionLastTs, sortTs);
        lastEntryTimestamp = Math.max(lastEntryTimestamp, sortTs);
        sectionTimelineEntries.push(timelineEntry);
        allTimelineEntries.push(timelineEntry);
      });
    });

    sectionTimelineEntries.sort(compareTimelineEntries);
    sectionRows.push({
      key,
      classId,
      label: section,
      subject,
      institute,
      minutes,
      entries,
      untimedEntries: sectionUntimedEntries,
      activeDays: sectionDays.size,
      lastActivityTs: sectionLastTs || 0,
      classRef: cls,
      timelineEntries: sectionTimelineEntries,
      isActionableInstitute: typeof isInstituteActionable === "function" ? isInstituteActionable(institute) : true,
    });
  });

  totalMinutes = 0;
  totalEntries = 0;
  untimedEntries = 0;
  lastEntryTimestamp = 0;
  activeDays.clear();
  allTimelineEntries.length = 0;

  collectCanonicalTeachingEntryRecords(teacherData?.notes || {}, isTeachingActivityEntry).forEach((record, recordIndex) => {
    const entry = record?.entry;
    if (!entry) return;
    const sourceClass = classById.get(String(record?.sourceClassId || ""));
    const section = sourceClass ? resolveSection(resolveSectionName, sourceClass) : "Class";
    const subject = sourceClass ? resolveSubject(resolveClassSubject, teacher, sourceClass) : "No subject";
    const institute = safeAdminText(sourceClass?.institute || row?.primaryInstitute, PLACEHOLDER_INSTITUTE);
    const key = stableClassKey(sourceClass || {}, section, subject, institute);
    const duration = entryDurationMinutes(entry);
    const sortTs = entryTimestamp(record.dateKey, entry);
    totalEntries += 1;
    totalMinutes += duration;
    if (!duration) untimedEntries += 1;
    if (record.dateKey) activeDays.add(record.dateKey);
    lastEntryTimestamp = Math.max(lastEntryTimestamp, sortTs);
    allTimelineEntries.push({
      id: safeAdminText(entry?.id || entry?.entryId || `${key}_${record.dateKey}_${recordIndex}`, `${key}_${record.dateKey}_${recordIndex}`),
      dateKey: record.dateKey,
      sortTs,
      timeStart: safeAdminText(entry?.timeStart, ""),
      timeEnd: safeAdminText(entry?.timeEnd, ""),
      minutes: duration,
      title: timelineTitle(entry, subject),
      body: timelineBody(entry),
      status: safeAdminText(entry?.status, ""),
      tag: safeAdminText(entry?.tag, ""),
      sectionKey: key,
      sectionLabel: section,
      classId: String(sourceClass?.id || record?.sourceClassId || ""),
      subject,
      institute,
    });
  });

  sectionRows.sort((a, b) => (
    (b.minutes || 0) - (a.minutes || 0)
    || (b.entries || 0) - (a.entries || 0)
    || exportTextSorter.compare(a.institute || "", b.institute || "")
    || exportTextSorter.compare(a.label || "", b.label || "")
    || exportTextSorter.compare(a.subject || "", b.subject || "")
  ));
  allTimelineEntries.sort(compareTimelineEntries);

  const institutes = makeInstituteGroups(sectionRows, branchGroups, rowInstitutes)
    .map(group => ({
      ...group,
      isActionableInstitute: typeof isInstituteActionable === "function" ? isInstituteActionable(group.institute) : true,
    }));
  const defaultSection = sectionRows.find(section => section.minutes > 0)
    || sectionRows.find(section => section.entries > 0)
    || sectionRows[0]
    || null;

  return {
    uid,
    detailsReady,
    identity: {
      uid,
      name,
      rawName: row?.rawName || name,
      email: fallbackEmail(teacher, row),
      initials: teacherInitials(name),
      photoURL: teacher?.photoURL || teacherData?.profile?.photoURL || "",
      isMe: !!row?.isMe,
      isAdminTeacher: !!row?.isAdminTeacher,
      hasLeftWorkspace: !!row?.hasLeftWorkspace,
      departedLabel: row?.departedLabel || "Left workspace",
    },
    summary: {
      totalMinutes,
      totalEntries,
      untimedEntries,
      activeDays: activeDays.size,
      lastEntryTimestamp,
      classCount: sectionRows.length || Number(row?.classCount || 0),
      instituteCount: institutes.length || Number(row?.instituteCount || 0),
      subjectCount: uniqueLabels(sectionRows.map(section => section.subject)).length || Number(row?.subjectCount || 0),
    },
    institutes,
    branchGroups,
    sections: sectionRows,
    allSectionsOption: {
      key: TEACHER_PROFILE_ALL_SECTIONS_KEY,
      label: "All Sections",
      subject: "All subjects",
      institute: institutes.length === 1 ? institutes[0].institute : `${institutes.length || rowInstitutes.length || 0} institutes`,
      minutes: totalMinutes,
      entries: totalEntries,
      untimedEntries,
      activeDays: activeDays.size,
      lastActivityTs: lastEntryTimestamp,
      timelineEntries: allTimelineEntries,
    },
    defaultSectionKey: defaultSection?.key || TEACHER_PROFILE_ALL_SECTIONS_KEY,
    timelineEntries: allTimelineEntries,
  };
}

export function resolveTeacherProfileSection(model, selectedSectionKey) {
  if (!model) return null;
  const key = selectedSectionKey || model.defaultSectionKey || TEACHER_PROFILE_ALL_SECTIONS_KEY;
  if (key === TEACHER_PROFILE_ALL_SECTIONS_KEY) return model.allSectionsOption;
  return model.sections.find(section => section.key === key) || model.sections[0] || model.allSectionsOption;
}

export function selectTeacherProfileTimeline(model, selectedSectionKey, limit = 30) {
  const selectedSection = resolveTeacherProfileSection(model, selectedSectionKey);
  const safeLimit = Math.max(1, Number(limit || 30));
  const entries = [...(selectedSection?.timelineEntries || [])].sort(compareTimelineEntries);
  const visibleEntries = entries.slice(0, safeLimit);
  const groups = [];
  visibleEntries.forEach(entry => {
    let group = groups.find(item => item.dateKey === entry.dateKey);
    if (!group) {
      group = { dateKey: entry.dateKey, entries: [], minutes: 0 };
      groups.push(group);
    }
    group.entries.push(entry);
    group.minutes += entry.minutes || 0;
  });
  return {
    selectedSection,
    groups,
    visibleEntries,
    visibleCount: visibleEntries.length,
    totalCount: entries.length,
    hasMore: visibleEntries.length < entries.length,
  };
}
