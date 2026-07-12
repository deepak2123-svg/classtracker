import { syllabusReportNameKey } from "../syllabus/syllabusReportUtils.js";
import { formatDurationShort } from "../utils/adminDates.js";
import { escapeExportHtml, exportTextSorter, formatExportPdfTime, normaliseName } from "../utils/adminText.js";
import {
  instituteGlanceLastActivityLabel,
  instituteGlanceTeacherHoursLabel,
  instituteGlanceTeacherSectionCaption,
} from "./instituteGlanceRows.js";
import { getInstituteGlancePeriodMeta, readableDownloadPart } from "./instituteGlanceReportUtils.js";

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

// ── HTML-based centre summary export ─────────────────────────────────────────
// Builds a rich HTML template (DM Sans, scorecards, teacher blocks, pending
// table with priority badges). The browser's native print engine handles
// page breaks cleanly via CSS break-inside/break-after rules. @page CSS
// suppresses all browser chrome (URL, date, page numbers).

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
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
    margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--ink);
  }
  .page-header .meta { font-size: 11.5px; color: var(--ink-3); text-align: right; line-height: 1.7; }
  .centre-hero {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff; border-radius: 20px; padding: 28px 34px; margin-bottom: 20px;
    text-align: center; border: 1px solid rgba(255,255,255,0.16);
  }
  .centre-hero .brand-row { justify-content: center; margin-bottom: 22px; }
  .centre-hero .eyebrow { color: #93c5fd; margin-bottom: 9px; }
  .centre-hero .institute-title { color: #fff; max-width: 820px; margin: 0 auto; font-size: 34px; }
  .centre-hero .institute-subtitle { color: rgba(255,255,255,0.72); font-size: 14px; margin-top: 10px; }
  .centre-hero-meta { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  .centre-hero-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 7px 12px; font-size: 12px; color: rgba(255,255,255,0.82); }
  .centre-hero-pill strong { color: #fff; font-weight: 800; margin-left: 5px; }
  .institute-title { font-size: 30px; line-height: 1.08; letter-spacing: -0.7px; font-weight: 800; color: var(--ink); max-width: 660px; }
  .institute-subtitle { font-size: 13px; color: var(--ink-3); margin-top: 7px; }
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
  .syllabus-mini-headline {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-bottom: 8px;
  }
  .syllabus-mini-summary {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    color: var(--ink-3); font-size: 10px; font-weight: 700;
  }
  .syllabus-mini-summary strong { color: var(--ink); font-size: 11.5px; font-weight: 800; }
  .syllabus-mini-grid {
    display: grid; grid-template-columns: minmax(210px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px; align-items: stretch;
  }
  .syllabus-mini-table {
    border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: #fff;
  }
  .syllabus-mini-head, .syllabus-mini-row { display: grid; grid-template-columns: 86px minmax(108px, 1fr) 88px; gap: 8px; align-items: center; }
  .syllabus-mini-head { color: var(--ink-4); font-size: 9px; font-weight: 700; letter-spacing: 0.45px; text-transform: uppercase; padding: 7px 10px; background: #f8fbff; }
  .syllabus-mini-row { color: var(--ink-2); font-size: 10.5px; padding: 8px 10px; border-top: 0.5px solid #e8eef8; background: #fff; }
  .syllabus-mini-row .chapter { color: var(--ink); font-weight: 700; }
  .syllabus-mini-row .muted { color: var(--ink-3); }
  .syllabus-chapter-panel {
    border: 1px solid var(--rule); border-radius: 10px; background: #fff; padding: 9px 10px 10px;
  }
  .syllabus-chapter-panel h4 {
    margin: 0 0 8px; font-size: 9.75px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .syllabus-chapter-panel.covered h4 { color: var(--green); }
  .syllabus-chapter-panel.pending h4 { color: #7c889b; }
  .syllabus-chapter-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .syllabus-chapter-chip {
    display: inline-flex; align-items: center; gap: 5px; min-height: 24px;
    padding: 5px 8px; border-radius: 999px; font-size: 9.75px; font-weight: 700; line-height: 1.2;
    border: 1px solid transparent;
  }
  .syllabus-chapter-chip.covered { color: #166534; background: #e9faf3; border-color: #c7eddc; }
  .syllabus-chapter-chip.pending { color: #64748b; background: #f6f8fc; border-color: #e2e8f0; }
  .syllabus-chapter-mark {
    width: 14px; height: 14px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 900; line-height: 1; flex: 0 0 14px;
  }
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
  .days-warn   { color: var(--amber); }
  .days-ok     { color: var(--ink-3); }
  .td-right { text-align: right; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; letter-spacing: 0.2px; }
  .badge-red   { background: var(--red-bg);   color: var(--red);   border: 0.5px solid var(--red-border); }
  .badge-amber { background: var(--amber-bg); color: var(--amber); border: 0.5px solid var(--amber-border); }
  .badge-green { background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); }
  .teacher-activity-page { background: #f3f6fc; color: var(--ink); }
  .activity-topbar {
    background: var(--navy); color: #fff; margin: -30px -24px 26px; padding: 40px 66px;
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .activity-brand { display: flex; align-items: center; gap: 18px; }
  .activity-mark {
    width: 58px; height: 58px; border-radius: 16px; background: #3478f6;
    display: flex; align-items: center; justify-content: center; color: #fff;
    font-size: 30px; font-weight: 800; letter-spacing: -0.4px;
  }
  .activity-brand-title { color: #fff; font-size: 30px; line-height: 1.05; font-weight: 800; letter-spacing: -0.6px; }
  .activity-brand-sub { color: rgba(255,255,255,0.78); font-size: 13px; margin-top: 7px; }
  .activity-period-pill {
    background: rgba(59,130,246,0.22); color: #fff; border-radius: 999px; padding: 13px 34px;
    min-width: 210px; text-align: center; font-size: 12.5px; font-weight: 800;
  }
  .activity-heading { margin: 0 0 26px; }
  .activity-heading h1 { font-size: 30px; line-height: 1.05; font-weight: 800; letter-spacing: -0.65px; color: var(--ink); }
  .activity-heading p { color: var(--ink-3); font-size: 13px; margin-top: 12px; max-width: 780px; }
  .activity-centre-meta { color: var(--blue); font-weight: 800; margin-top: 9px; font-size: 12px; }
  .activity-card-list { display: grid; gap: 18px; }
  .activity-card {
    background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; overflow: hidden;
    page-break-inside: avoid; break-inside: avoid;
  }
  .activity-card-head {
    background: #eaf0f7; display: flex; align-items: center; gap: 12px; padding: 9px 18px;
  }
  .activity-avatar {
    width: 32px; height: 32px; border-radius: 50%; background: var(--blue-bg);
    border: 1px solid #9cc3ff; color: var(--blue); display: flex; align-items: center;
    justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;
  }
  .activity-teacher-name { font-size: 14.5px; font-weight: 800; color: var(--ink); }
  .activity-subject-pill {
    margin-left: auto; background: var(--blue-bg); color: var(--blue); border: 1px solid #bfdbfe;
    border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: 800; max-width: 210px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .activity-table-wrap { padding: 12px 18px 14px; }
  .activity-table {
    width: 100%; max-width: 100%; box-sizing: border-box; table-layout: fixed;
    border-collapse: separate; border-spacing: 0; border: 1px solid var(--rule-strong);
    border-radius: 10px; overflow: hidden; background: #fff; font-size: 11.5px;
  }
  .activity-table th {
    background: #f8fafc; color: var(--ink-3); font-size: 10.5px; font-weight: 800; text-align: left;
    padding: 9px 12px; border-bottom: 1px solid var(--rule);
  }
  .activity-table td {
    padding: 11px 12px; border-bottom: 1px solid var(--rule); color: var(--ink-2); vertical-align: middle;
    min-width: 0; overflow-wrap: anywhere; word-break: normal;
  }
  .activity-table tr:last-child td { border-bottom: none; }
  .activity-table .class-cell { font-weight: 800; color: var(--ink); white-space: nowrap; }
  .activity-table .time-cell { color: var(--ink-3); white-space: nowrap; }
  .activity-table .notes-cell { color: var(--ink-3); max-width: 210px; }
  .activity-status { font-weight: 800; white-space: nowrap; }
  .activity-status.completed { color: #059669; }
  .activity-status.progress { color: #a16207; }
  .activity-status.started { color: var(--blue); }
  .activity-status.other { color: var(--ink-3); }
  .activity-syllabus {
    margin: 0 18px 14px; padding-top: 2px; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-syllabus-title { color: #059669; font-size: 11px; font-weight: 900; margin-bottom: 8px; }
  .activity-syllabus .activity-table th { background: #fbfefa; }
  .activity-syllabus-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .activity-syllabus-summary {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    color: var(--ink-3); font-size: 10px; font-weight: 700;
  }
  .activity-syllabus-summary strong { color: var(--ink); font-size: 11.5px; font-weight: 800; }
  .activity-syllabus-grid {
    display: grid; grid-template-columns: minmax(210px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px; align-items: stretch;
  }
  .activity-covered {
    margin-top: 0; padding: 9px 11px; background: #f8fafc; border: 1px solid var(--rule);
    border-radius: 9px; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-covered-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    color: var(--ink-2); font-size: 10.5px; font-weight: 900;
    padding-bottom: 7px; border-bottom: 1px solid var(--rule);
  }
  .activity-covered-count {
    color: #059669; font-size: 9.5px; white-space: nowrap;
  }
  .activity-covered-list {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 18px; row-gap: 6px; margin-top: 7px;
  }
  .activity-chapter-chip {
    display: inline-flex; align-items: center; gap: 6px; min-width: 0;
    color: #166534; padding: 1px 0; font-size: 10px; font-weight: 750;
  }
  .activity-chapter-chip.pending { color: #64748b; }
  .activity-chapter-check {
    width: 13px; height: 13px; border-radius: 4px; background: #059669; color: #fff;
    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 13px;
    font-size: 8px; font-weight: 900; line-height: 1;
  }
  .activity-chapter-mark {
    width: 13px; height: 13px; border-radius: 999px; background: #e2e8f0; color: #94a3b8;
    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 13px;
    font-size: 8px; font-weight: 900; line-height: 1;
  }
  .activity-covered-empty { color: var(--ink-3); font-size: 10.5px; margin-top: 6px; }
  .activity-pending-note {
    background: #fffbeb; border: 1px solid var(--amber-border); color: #92400e; border-radius: 12px;
    padding: 12px 15px; font-size: 12px; font-weight: 700; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-footer {
    margin-top: 54px; color: var(--ink-3); display: flex; justify-content: space-between; gap: 18px;
    font-size: 10.5px; border-top: 1px solid var(--rule); padding-top: 10px;
  }
  .page-footer { margin-top: 36px; padding-top: 12px; border-top: 0.5px solid var(--rule); display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-4); }
  .institute-divider { border: none; margin: 0; page-break-before: always; }
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
    .teacher-activity-page { background: #f3f6fc !important; }
    .teacher-activity-page .activity-topbar { margin: -1.1cm -1.2cm 26px; padding: 0.95cm 1.2cm; }
    .teacher-activity-page .activity-card,
    .teacher-activity-page .activity-syllabus,
    .teacher-activity-page .activity-pending-note { page-break-inside: avoid; break-inside: avoid; }
    .pending-table tr { page-break-inside: avoid; break-inside: avoid; }
    .scorecard, .centre-card, .executive-summary { page-break-inside: avoid; break-inside: avoid; }
    .section-title { page-break-after: avoid; break-after: avoid; }
    .followup-actions { display: none !important; }
  }
`;

export function buildInstituteGlanceActivityHtmlPage(row, generatedOnLabel, options = {}){
  const e = escapeExportHtml;
  const { standalone = true, period = "daily", rangeStartKey = "", rangeEndKey = "" } = options;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const generatedParts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const filled = row.filledTeacherRows || [];
  const pending = row.pendingTeacherRows || [];
  const total = row.totalTeachers || 0;
  const filledCount = row.filledToday || 0;
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const showEntryDates = periodMeta.key !== "daily";

  const teacherCards = filled.length ? filled.map(teacher => {
    const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
    const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
    const subjectSet = [...new Set([
      ...details.map(d => d.subject).filter(Boolean),
      ...syllabusRows.map(d => d.subject).filter(Boolean),
    ])];
    const subjectLabel = subjectSet.join(", ") || "-";
    const headCells = showEntryDates
      ? ["Date", "Class", "Time", "Status", "Daily entry", "Notes"]
      : ["Class", "Time", "Status", "Daily entry", "Notes"];
    const bodyRows = details.length ? details.map(detail => {
      const status = activityStatusMeta(detail);
      return `<tr>
        ${showEntryDates ? `<td class="time-cell">${e(formatInstituteReportEntryDate(detail.dateKey))}</td>` : ""}
        <td class="class-cell">${e(detail.section || "-")}</td>
        <td class="time-cell">${e(formatExportPdfTime(detail.timeStart, detail.timeEnd) || "-")}</td>
        <td><span class="activity-status ${status.cls}">${e(status.label)}</span></td>
        <td>${e(detail.title || detail.subject || "-")}</td>
        <td class="notes-cell">${e(detail.notes || "-")}</td>
      </tr>`;
    }).join("") : (() => {
      const status = activityStatusMeta({}, teacher.todayStatusLabel || periodMeta.updatedLabel);
      return `<tr>
        ${showEntryDates ? `<td class="time-cell">-</td>` : ""}
        <td class="class-cell">${e(instituteGlanceTeacherSectionCaption(teacher))}</td>
        <td class="time-cell">-</td>
        <td><span class="activity-status ${status.cls}">${e(status.label)}</span></td>
        <td>${e(`${teacher.todayEntries || 0} entr${teacher.todayEntries === 1 ? "y" : "ies"} uploaded`)}</td>
        <td class="notes-cell">${e(instituteGlanceTeacherHoursLabel(teacher))}</td>
      </tr>`;
    })();
    const syllabusHtml = syllabusRows.length ? `
      <div class="activity-syllabus">
        ${syllabusRows.map(item => {
          const totalChapters = Math.max(0, Number(item.totalCount || 0));
          const coveredChapters = Math.max(0, Number(item.coveredCount || 0));
          const progressPct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0;
          const statusClass = item.status === "Complete" ? "completed" : item.status === "In progress" ? "progress" : "other";
          const coveredTitles = Array.isArray(item.coveredChapterTitles) ? item.coveredChapterTitles : [];
          const pendingTitles = Array.isArray(item.pendingChapterTitles) ? item.pendingChapterTitles : [];
          return `
            <div class="activity-syllabus-head">
              <div class="activity-syllabus-title">Syllabus tracker</div>
              <div class="activity-syllabus-summary">
                <span><strong>${e(`${coveredChapters} of ${totalChapters}`)}</strong> chapters covered</span>
                <span>${progressPct}%</span>
                <span><span class="activity-status ${statusClass}">${e(item.status || "Not started")}</span></span>
              </div>
            </div>
            <div class="activity-syllabus-grid">
              <table class="activity-table">
                <thead><tr><th>Section</th><th>Syllabus</th><th>Updated</th></tr></thead>
                <tbody>
                  <tr>
                    <td class="class-cell">${e(item.section || "-")}</td>
                    <td>${e(item.syllabusName || item.subject || subjectLabel || "-")}</td>
                    <td class="time-cell">${e(syllabusUpdatedLabelForReport(teacher, item))}</td>
                  </tr>
                </tbody>
              </table>
              <div class="activity-covered">
                <div class="activity-covered-head">
                  <span>Covered chapters</span>
                  <span class="activity-covered-count">${e(`${coveredTitles.length} completed`)}</span>
                </div>
                ${coveredTitles.length
                  ? `<div class="activity-covered-list">${coveredTitles.map(title => `<span class="activity-chapter-chip"><span class="activity-chapter-check">&#10003;</span><span>${e(title)}</span></span>`).join("")}</div>`
                  : `<div class="activity-covered-empty">No chapters marked covered yet.</div>`}
              </div>
              <div class="activity-covered">
                <div class="activity-covered-head">
                  <span>Not covered yet</span>
                  <span class="activity-covered-count">${e(`${pendingTitles.length} pending`)}</span>
                </div>
                ${pendingTitles.length
                  ? `<div class="activity-covered-list">${pendingTitles.map(title => `<span class="activity-chapter-chip pending"><span class="activity-chapter-mark">&bull;</span><span>${e(title)}</span></span>`).join("")}</div>`
                  : `<div class="activity-covered-empty">Every chapter is marked covered.</div>`}
              </div>
            </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="activity-card">
        <div class="activity-card-head">
          <div class="activity-avatar">${e(_avatarInitials(teacher.name))}</div>
          <div class="activity-teacher-name">${e(teacher.name || "Teacher")}</div>
          <div class="activity-subject-pill">${e(subjectLabel)}</div>
        </div>
        <div class="activity-table-wrap">
          <table class="activity-table">
            <thead><tr>${headCells.map(label => `<th>${e(label)}</th>`).join("")}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        ${syllabusHtml}
      </div>`;
  }).join("") : `<div class="empty-notice">No teacher has uploaded during this ${e(periodMeta.label.toLowerCase())} period.</div>`;

  const pendingHtml = pending.length
    ? `<div class="activity-pending-note">${pending.length} teacher${pending.length === 1 ? "" : "s"} pending for this period: ${e(pending.slice(0, 8).map(item => item.name || "Teacher").join(", "))}${pending.length > 8 ? "..." : ""}</div>`
    : "";

  return `
    ${standalone ? `<section class="report-page teacher-activity-page">` : `<div class="teacher-activity-page">`}
      <div class="activity-topbar">
        <div class="activity-brand">
          <div class="activity-mark">L</div>
          <div>
            <div class="activity-brand-title">Ledgr Report</div>
            <div class="activity-brand-sub">Teacher activity with syllabus tracker</div>
          </div>
        </div>
        <div class="activity-period-pill">${e(periodMeta.label)} - ${e(generatedParts.date)}</div>
      </div>
      <div class="activity-heading">
        <h1>Teacher activity</h1>
        <p>Normal daily entries come first. Syllabus appears only for teachers where admin has published it.</p>
        <div class="activity-centre-meta">${e(row.institute || "Institute")} - ${filledCount}/${total} teachers updated - ${pct}% submission rate</div>
      </div>
      <div class="activity-card-list">
        ${teacherCards}
        ${pendingHtml}
      </div>
      <div class="activity-footer">
        <span>Rule: no published syllabus = daily entry table only. Published syllabus = compact tracker immediately below that teacher.</span>
        <span>${e(generatedOnLabel)}</span>
      </div>
    ${standalone ? `</section>` : `</div>`}`;
}

export function buildInstituteGlanceHtmlPage(row, generatedOnLabel, options = {}){
  const e = escapeExportHtml;
  const { standalone = true, period = "daily", rangeStartKey = "", rangeEndKey = "" } = options;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const filled = row.filledTeacherRows || [];
  const pending = row.pendingTeacherRows || [];
  const total = row.totalTeachers || 0;
  const filledCount = row.filledToday || 0;
  const pendingCount = row.missingToday || 0;
  const sections = row.sectionsTaught || 0;
  const hours = formatDurationShort(row.totalStudyMinutes || 0);
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const showEntryDates = periodMeta.key !== "daily";

  // Filled teachers HTML
  let filledHtml = "";
  if(!filled.length){
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
        ...details.map(d => d.subject).filter(Boolean),
        ...declaredSyllabusRows.map(d => d.subject).filter(Boolean),
      ])];
      const subjectLabel = subjectSet.join(", ") || "—";
      let rows = "";
      if(!details.length){
        rows = showEntryDates
          ? `<div class="session-row multi-day"><span class="date-str">—</span><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries===1?"y":"ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`
          : `<div class="session-row"><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries===1?"y":"ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`;
      } else {
        rows = details.map(d =>
          `<div class="session-row${showEntryDates ? " multi-day" : ""}">
            ${showEntryDates ? `<span class="date-str">${e(formatInstituteReportEntryDate(d.dateKey))}</span>` : ""}
            <span class="section-name">${e(d.section || "—")}</span>
            <span class="time-str">${e(formatExportPdfTime(d.timeStart, d.timeEnd) || "—")}</span>
            <span class="topic">${e(d.title || d.subject || "—")}</span>
            <span class="notes-str">${e(d.notes || "—")}</span>
          </div>`
        ).join("");
      }
      const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      if(syllabusRows.length){
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

  // Pending teachers HTML
  let pendingHtml = "";
  if(!pending.length){
    pendingHtml = `<div class="empty-notice green">All linked teachers in this centre have already uploaded their entries today.</div>`;
  } else {
    const rows = pending.map((teacher, i) => {
      const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
      const { label: daysLabel, cls: daysCls } = _pendingDaysLabel(teacher);
      const badge = _pendingBadge(teacher);
      return `<tr>
        <td class="num">${i + 1}</td>
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

  return `
    ${standalone ? `<section class="report-page">` : ""}
      <div class="centre-hero">
        <div class="institute-title">${e(row.institute || "Centre Summary")}</div>
        <div class="institute-subtitle">${e(periodMeta.title)} · Submissions, pending teachers, sections, and hours.</div>
        <div class="centre-hero-meta">
          <span class="centre-hero-pill">Period <strong>${e(periodMeta.label)}</strong></span>
          <span class="centre-hero-pill">Date <strong>${e(getInstituteGlanceGeneratedParts(generatedOnLabel).date)}</strong></span>
          ${getInstituteGlanceGeneratedParts(generatedOnLabel).time ? `<span class="centre-hero-pill">Generated <strong>${e(getInstituteGlanceGeneratedParts(generatedOnLabel).time)}</strong></span>` : ""}
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

export function buildInstituteGlanceSummaryHtml({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes" }){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const completionPct = summary.totalTeachers > 0 ? Math.round(((summary.filledToday || 0) / summary.totalTeachers) * 100) : 0;
  const sortedRows = [...(rows || [])].sort((a, b) => {
    if((b.missingToday || 0) !== (a.missingToday || 0)) return (b.missingToday || 0) - (a.missingToday || 0);
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

  const centreCards = sortedRows.map(row => buildInstituteGlanceCentreCard(row, period, rangeStartKey, rangeEndKey)).join("");
  const institutePages = (rows || []).map(row => buildInstituteGlanceHtmlPage(row, generatedOnLabel, { standalone:true, period, rangeStartKey, rangeEndKey })).join("");

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

export function buildInstituteGlanceInstituteHtml(row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = ""){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${e(row.institute || "Centre")} - ${e(periodMeta.title)} - ${e(parts.date)}${parts.time ? ` ${e(parts.time)}` : ""}</title>
    <style>${CENTRE_SUMMARY_CSS}</style>
  </head><body>
    ${buildInstituteGlanceHtmlPage(row, generatedOnLabel, { period, rangeStartKey, rangeEndKey })}
  </body></html>`;
}

// ── PDF export: window.print() with clean @page CSS ─────────────────────────
// Using the browser's native print engine gives perfect text rendering,
// proper page breaks (via CSS break-inside/break-after), and zero canvas
// artefacts. The HTML template's @media print block suppresses all browser
// chrome (URL, date, page numbers) and forces background colours to print.

export function _printHtml(html, filename){
  const win = window.open("", "_blank", "width=900,height=700");
  if(!win){
    window.alert("Pop-ups are blocked. Please allow pop-ups for this site, then try again.");
    return;
  }
  const printTitle = readableDownloadPart(
    String(filename || "Ledgr Report").replace(/\.[a-z0-9]+$/i, ""),
    "Ledgr Report"
  );
  const htmlWithTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeExportHtml(printTitle)}</title>`)
    : html.replace(/<head([^>]*)>/i, `<head$1><title>${escapeExportHtml(printTitle)}</title>`);
  // Inject a print-and-close script so Save as PDF works with one click
  const htmlWithPrint = htmlWithTitle.replace(
    "</body>",
    `<script>
      window.onload = function(){
        document.title = ${JSON.stringify(printTitle)};
        // Small delay so fonts finish loading before the dialog opens
        setTimeout(function(){ window.print(); }, 380);
      };
    <\/script></body>`
  );
  win.document.open();
  win.document.write(htmlWithPrint);
  win.document.close();
}
