import { todayKey } from "../../shared.jsx";
import { addDaysToDateKey, currentMonthKey, monthBoundsFromKey } from "../utils/adminDates.js";
import { isTeachingActivityEntry } from "../syllabus/syllabusReportUtils.js";
import { activeAdminTeacherClasses } from "../utils/adminTeachers.js";
import { exportTextSorter, sameInstituteName } from "../utils/adminText.js";
import { collectCanonicalTeachingEntryRecords, getEntryCoverageClassIds } from "../../jointEntries.js";

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
  const classIds = new Set(classes.map(c => String(c?.id || "")).filter(Boolean));
  const touchesInstitute = record => getEntryCoverageClassIds(record?.entry, record?.sourceClassId)
    .some(classId => classIds.has(String(classId || "")));
  const countRange = (startKey, endKey) => collectCanonicalTeachingEntryRecords(data.notes || {}, isTeachingActivityEntry, { startKey, endKey })
    .filter(touchesInstitute)
    .length;
  const allRecords = collectCanonicalTeachingEntryRecords(data.notes || {}, isTeachingActivityEntry).filter(touchesInstitute);
  const stats = {
    todayEntries: countRange(today, today),
    weekEntries: countRange(weekStart, today),
    monthEntries: countRange(monthBounds.startKey, monthBounds.endKey),
    lastEntryTs: allRecords.reduce((latest, record) => Math.max(latest, Number(record?.entry?.created || record?.entry?.createdAt || 0) || 0), fallbackLastEntryTs || 0),
  };
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
