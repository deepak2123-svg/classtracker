import { todayKey } from "../../shared.jsx";
import { addDaysToDateKey, currentMonthKey, getEntriesInRange, lastEntryTs, monthBoundsFromKey } from "../utils/adminDates.js";
import { isTeachingActivityEntry } from "../syllabus/syllabusReportUtils.js";
import { activeAdminTeacherClasses } from "../utils/adminTeachers.js";
import { exportTextSorter, sameInstituteName } from "../utils/adminText.js";

export function buildTeacherEntryStatusItem(teacher, data, instituteName, fallbackLastEntryTs = null) {
  const teacherName = data?.profile?.name || teacher?.name || "Teacher";
  if (!data) {
    return {
      uid: teacher?.uid || teacherName,
      name: teacherName,
      loaded: false,
      classCount: null,
      todayEntries: 0,
      weekEntries: 0,
      monthEntries: 0,
      todayUpdated: false,
      lastEntryTs: fallbackLastEntryTs || null,
    };
  }
  const classes = activeAdminTeacherClasses(data).filter(c => sameInstituteName(c.institute, instituteName));
  const today = todayKey();
  const weekStart = addDaysToDateKey(today, -6);
  const monthBounds = monthBoundsFromKey(currentMonthKey());
  const teachingEntryCount = (classNotes, startKey, endKey) => getEntriesInRange(classNotes, null, startKey, endKey)
    .filter(({ entry }) => isTeachingActivityEntry(entry))
    .length;
  const stats = classes.reduce((acc, c) => {
    const classNotes = (data.notes || {})[c.id] || {};
    acc.todayEntries += teachingEntryCount(classNotes, today, today);
    acc.weekEntries += teachingEntryCount(classNotes, weekStart, today);
    acc.monthEntries += teachingEntryCount(classNotes, monthBounds.startKey, monthBounds.endKey);
    acc.lastEntryTs = Math.max(acc.lastEntryTs, lastEntryTs(classNotes, isTeachingActivityEntry) || 0);
    return acc;
  }, { todayEntries: 0, weekEntries: 0, monthEntries: 0, lastEntryTs: fallbackLastEntryTs || 0 });
  return {
    uid: teacher?.uid || teacherName,
    name: teacherName,
    loaded: true,
    classCount: classes.length,
    todayEntries: stats.todayEntries,
    weekEntries: stats.weekEntries,
    monthEntries: stats.monthEntries,
    todayUpdated: stats.todayEntries > 0,
    lastEntryTs: stats.lastEntryTs || fallbackLastEntryTs || null,
  };
}

export function sortTeacherStatusForShare(items = []) {
  return [...items].sort((a, b) => {
    if (!!a.todayUpdated !== !!b.todayUpdated) return a.todayUpdated ? 1 : -1;
    if (!a.todayUpdated && !b.todayUpdated) {
      if ((a.lastEntryTs || 0) !== (b.lastEntryTs || 0)) return (a.lastEntryTs || 0) - (b.lastEntryTs || 0);
    } else {
      if ((b.todayEntries || 0) !== (a.todayEntries || 0)) return (b.todayEntries || 0) - (a.todayEntries || 0);
      if ((b.lastEntryTs || 0) !== (a.lastEntryTs || 0)) return (b.lastEntryTs || 0) - (a.lastEntryTs || 0);
    }
    if ((b.weekEntries || 0) !== (a.weekEntries || 0)) return (b.weekEntries || 0) - (a.weekEntries || 0);
    if ((b.monthEntries || 0) !== (a.monthEntries || 0)) return (b.monthEntries || 0) - (a.monthEntries || 0);
    return exportTextSorter.compare(a.name || "", b.name || "");
  });
}
