import { todayKey } from "../../shared.jsx";
import { addDaysToDateKey, currentMonthKey, monthBoundsFromKey } from "../utils/adminDates.js";

export function readableDownloadPart(value, fallback = "Report") {
  return String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function readableDownloadTimestamp(date = new Date()) {
  const datePart = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/,/g, "");
  const timePart = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/\s+/g, " ").replace(/:/g, "-").toUpperCase();
  return readableDownloadPart(`${datePart} ${timePart}`, "Generated");
}

export function getInstituteGlancePeriodMeta(period = "daily", rangeStartKey = "", rangeEndKey = "") {
  const today = todayKey();
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
    const monthBounds = monthBoundsFromKey(String(rangeStartKey || "").slice(0, 7) || currentMonthKey());
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
      days: null,
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
    days: null,
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

function readableInstituteGlancePeriodPart(period = "daily", rangeStartKey = "", rangeEndKey = "") {
  const meta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  if (meta.key === "range") return `Range ${meta.periodValue.replace(/\s+to\s+/i, " to ")}`;
  if (meta.key === "monthly") return meta.periodValue || "Monthly";
  return meta.label || meta.periodValue || "Daily";
}

export function ledgrReportDownloadFilename(scopeLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", extension = "pdf", options = {}) {
  const prefix = options.prefix || "Ledgr Report";
  const ext = String(extension || "pdf").replace(/^\./, "").toLowerCase();
  const timestamp = options.timestamp || readableDownloadTimestamp();
  const parts = [
    prefix,
    readableDownloadPart(scopeLabel, "All Institutes"),
    readableDownloadPart(readableInstituteGlancePeriodPart(period, rangeStartKey, rangeEndKey), "Daily"),
    timestamp,
  ].filter(Boolean);
  return `${parts.join(" - ")}.${ext}`;
}

export function instituteGlancePdfFilename(instituteName, period = "daily", rangeStartKey = "", rangeEndKey = "") {
  return ledgrReportDownloadFilename(instituteName || "Institute", period, rangeStartKey, rangeEndKey, "pdf");
}

export function allInstitutesGlancePdfFilename(period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All Institutes") {
  return ledgrReportDownloadFilename(scopeLabel || "All Institutes", period, rangeStartKey, rangeEndKey, "pdf");
}

export function instituteGlanceZipFilename(period = "daily", rangeStartKey = "", rangeEndKey = "", count = 0) {
  const countPart = Number(count) > 0 ? `${count} Institutes` : "Institutes";
  return ledgrReportDownloadFilename(countPart, period, rangeStartKey, rangeEndKey, "zip", { prefix: "Ledgr Report PDFs" });
}
