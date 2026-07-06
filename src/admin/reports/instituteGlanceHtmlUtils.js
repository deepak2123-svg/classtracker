import { syllabusReportNameKey } from "../syllabus/syllabusReportUtils.js";
import { formatDurationShort } from "../utils/adminDates.js";
import { escapeExportHtml, normaliseName } from "../utils/adminText.js";
import { instituteGlanceLastActivityLabel } from "./instituteGlanceRows.js";
import { getInstituteGlancePeriodMeta } from "./instituteGlanceReportUtils.js";

export function _avatarInitials(name){
  const parts = String(name || "").trim().split(/\s+/);
  if(parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "?").slice(0, 2).toUpperCase();
}

export function _pendingDaysLabel(teacher){
  const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
  // Try to parse a days-ago number from strings like "28 May 2026" or "Signed up 28 May 2026".
  const dateMatch = last.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if(!dateMatch) return { label: "—", cls: "days-urgent" };
  const d = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
  if(isNaN(d)) return { label: "—", cls: "days-urgent" };
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if(days <= 1) return { label: days === 1 ? "1 day" : "today", cls: "days-ok" };
  if(days <= 8) return { label: `${days} days`, cls: "days-warn" };
  return { label: `${days} days`, cls: "days-urgent" };
}

export function _pendingBadge(teacher){
  const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
  const isNeverLogged = /no logs yet/i.test(last);
  const isSignedUpOnly = /signed up/i.test(last) && teacher.monthEntries === 0;
  const { cls } = _pendingDaysLabel(teacher);
  if(isNeverLogged) return { label: "Never logged", cls: "badge-red" };
  if(isSignedUpOnly) return { label: "New · no logs", cls: "badge-amber" };
  if(cls === "days-urgent") return { label: "Inactive", cls: "badge-red" };
  if(cls === "days-warn") return { label: "Missed today", cls: "badge-amber" };
  return { label: "Active · missed today", cls: "badge-green" };
}

export function getInstituteGlanceGeneratedParts(generatedOnLabel){
  const raw = String(generatedOnLabel || "").replace(/^Generated\s+/i, "").trim();
  const [datePart, timePart] = raw.split(",").map(part => part.trim());
  return {
    raw,
    date: datePart || raw || "Today",
    time: timePart || "",
  };
}

export function buildInstituteGlanceDateCard(generatedOnLabel, label = "Generated"){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  return `
    <div class="date-card">
      <div class="label">${e(label)}</div>
      <div class="date">${e(parts.date)}</div>
      ${parts.time ? `<div class="time">${e(parts.time)}</div>` : ""}
    </div>`;
}

export function formatInstituteReportEntryDate(dateKey){
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if(!year || !month || !day) return String(dateKey || "—");
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day:"numeric",
    month:"short",
    year:"numeric",
  });
}

export function buildInstituteGlanceCentreCard(row, period = "daily", rangeStartKey = "", rangeEndKey = ""){
  const e = escapeExportHtml;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
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

export function reportValueMatches(a, b){
  const left = normaliseName(String(a || "").trim());
  const right = normaliseName(String(b || "").trim());
  if(!left || !right) return true;
  return left === right;
}

export function activityStatusMeta(detail = {}, fallbackLabel = ""){
  const label = String(detail.statusLabel || fallbackLabel || detail.status || "Started").trim() || "Started";
  const raw = String(detail.status || label).toLowerCase();
  const labelLower = label.toLowerCase();
  if(raw.includes("complete") || labelLower.includes("complete")) return { label, cls:"completed" };
  if(raw.includes("progress") || labelLower.includes("progress")) return { label, cls:"progress" };
  if(raw.includes("start") || labelLower.includes("start")) return { label, cls:"started" };
  return { label, cls:"other" };
}

export function syllabusCoveredTitlesForReport(teacher = {}, syllabusRow = {}){
  const rows = Array.isArray(teacher.syllabusCoveredRows) ? teacher.syllabusCoveredRows : [];
  const seen = new Set();
  return rows
    .filter(row => reportValueMatches(row.section, syllabusRow.section) && reportValueMatches(row.subject, syllabusRow.subject))
    .map(row => String(row.chapterTitle || "").trim())
    .filter(title => {
      if(!title) return false;
      const key = syllabusReportNameKey(title);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function syllabusUpdatedLabelForReport(teacher = {}, syllabusRow = {}){
  const rows = (Array.isArray(teacher.syllabusCoveredRows) ? teacher.syllabusCoveredRows : [])
    .filter(row => reportValueMatches(row.section, syllabusRow.section) && reportValueMatches(row.subject, syllabusRow.subject))
    .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
  return rows[0]?.dateKey ? formatInstituteReportEntryDate(rows[0].dateKey) : "-";
}
