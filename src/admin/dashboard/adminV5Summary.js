import { normaliseSectionKey } from "../utils/adminSections.js";
import { safeAdminText } from "../utils/adminText.js";

export function adminV5SummaryNumber(...values){
  for(const value of values){
    const number = Number(value);
    if(Number.isFinite(number)) return Math.max(0, Math.round(number));
  }
  return null;
}

export function adminV5InstituteSummaryKey(value){
  return normaliseSectionKey(safeAdminText(value, ""));
}

export function normaliseAdminV5DailySummary(raw, fallbackInstitute = ""){
  if(!raw || typeof raw !== "object") return null;
  const institute = safeAdminText(raw.institute || raw.instituteName || raw.name || fallbackInstitute, fallbackInstitute);
  const activeCount = adminV5SummaryNumber(
    raw.activeTeachers,
    raw.teachersTotal,
    raw.totalTeachers,
    raw.teacherCount,
    raw.totalTeacherCount,
    raw.total,
  );
  const loggedCount = adminV5SummaryNumber(
    raw.loggedToday,
    raw.updatedToday,
    raw.teachersUpdated,
    raw.updatedTeachers,
    raw.loggedTeachers,
    raw.filledToday,
  );
  const pendingCount = adminV5SummaryNumber(
    raw.pendingTeachers,
    raw.pending,
    raw.notUpdatedTeachers,
    activeCount !== null && loggedCount !== null ? activeCount - loggedCount : null,
  );
  return {
    institute,
    key:adminV5InstituteSummaryKey(institute),
    activeCount,
    loggedCount,
    pendingCount,
    classCount:adminV5SummaryNumber(raw.classCount, raw.classesTotal, raw.totalClasses),
    todayEntryCount:adminV5SummaryNumber(raw.todayEntryCount, raw.entriesToday, raw.entryCount, raw.entriesCount),
    todayMinutes:adminV5SummaryNumber(raw.todayMinutes, raw.minutesToday, raw.totalMinutes, raw.studyMinutes),
    updatedAt:raw.updatedAt || raw.generatedAt || raw.createdAt || null,
  };
}
