import crypto from "node:crypto";

export const PARENT_WHATSAPP_TIME_ZONE = "Asia/Kolkata";
export const PARENT_WHATSAPP_LANGUAGE = "en";
export const PARENT_WHATSAPP_DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5, 6];
export const PARENT_WHATSAPP_TEMPLATE_NAMES = Object.freeze({
  daily: "ledgr_parent_daily_update_en_v1",
  noUpdate: "ledgr_parent_no_update_en_v1",
  corrected: "ledgr_parent_corrected_update_en_v1",
});
export const PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS = 90;
export const PARENT_WHATSAPP_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

const reportSorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function cleanParentText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function cleanParentMultilineText(value, maxLength = 3000) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

export function normaliseParentPhone(value, defaultCountryCode = "+91") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  const plusCount = (compact.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !compact.startsWith("+"))) return "";

  if (!compact.startsWith("+")) {
    let digits = compact.replace(/\D/g, "");
    const countryDigits = String(defaultCountryCode || "+91").replace(/\D/g, "") || "91";
    if (countryDigits === "91" && digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (countryDigits === "91" && digits.length === 12 && digits.startsWith("91")) {
      compact = `+${digits}`;
    } else if (countryDigits === "91" && digits.length === 10) {
      compact = `+91${digits}`;
    } else {
      compact = `+${countryDigits}${digits}`;
    }
  }

  const digits = compact.slice(1);
  if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) return "";
  return `+${digits}`;
}

export function parentPhoneHash(phone) {
  const normalised = normaliseParentPhone(phone);
  if (!normalised) return "";
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

export function maskParentPhone(phone) {
  const normalised = normaliseParentPhone(phone);
  if (!normalised) return "";
  return `${normalised.slice(0, Math.min(3, normalised.length - 4))}••••${normalised.slice(-4)}`;
}

export function normaliseParentSectionKey(value) {
  return cleanParentText(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildParentSectionPlanId(instituteId, sectionKey) {
  const source = `${cleanParentText(instituteId, 160)}::${normaliseParentSectionKey(sectionKey)}`;
  const digest = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
  const prefix = normaliseParentSectionKey(sectionKey).slice(0, 42) || "section";
  return `${prefix}_${digest}`;
}

export function buildParentDeliveryId({
  dateKey,
  sectionPlanId,
  phoneHash,
  reportVersion = 1,
  kind = "daily",
}) {
  const source = [
    cleanParentText(dateKey, 20),
    cleanParentText(sectionPlanId, 180),
    cleanParentText(phoneHash, 80),
    String(Math.max(1, Number(reportVersion || 1))),
    cleanParentText(kind, 32),
  ].join("::");
  return crypto.createHash("sha256").update(source).digest("hex");
}

export function getParentDateContext(now = new Date(), timeZone = PARENT_WHATSAPP_TIME_ZONE) {
  const instant = now instanceof Date ? now : new Date(now);
  const parts = {};
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(instant).forEach(part => {
    if (part.type !== "literal") parts[part.type] = part.value;
  });
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    now: instant,
    nowMs: instant.getTime(),
    timeZone,
    dateKey,
    timeKey: `${parts.hour}:${parts.minute}`,
    weekday: weekdayMap[parts.weekday] ?? instant.getUTCDay(),
    dateLabel: new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(instant),
  };
}

export function normaliseParentScheduleTime(value, fallback = "20:00") {
  const clean = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(clean) ? clean : fallback;
}

export function buildParentQstashCron(timeKey) {
  const [hour, minute] = normaliseParentScheduleTime(timeKey).split(":").map(Number);
  return `CRON_TZ=${PARENT_WHATSAPP_TIME_ZONE} ${minute} ${hour} * * *`;
}

export function normaliseWeekdays(value) {
  const source = Array.isArray(value) ? value : PARENT_WHATSAPP_DEFAULT_WEEKDAYS;
  const output = [...new Set(source.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return output.length ? output : [...PARENT_WHATSAPP_DEFAULT_WEEKDAYS];
}

export function shouldRunParentSection(section = {}, dateContext = getParentDateContext()) {
  if (section?.enabled !== true || section?.status === "closed") return false;
  if (!normaliseWeekdays(section?.weekdays).includes(dateContext.weekday)) return false;
  const skipDates = new Set((Array.isArray(section?.skipDates) ? section.skipDates : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
  return !skipDates.has(dateContext.dateKey);
}

export function groupParentRecipients({ contacts = [], subscriptions = [], sectionPlanId = "" } = {}) {
  const contactById = new Map(
    (Array.isArray(contacts) ? contacts : [])
      .filter(contact => contact?.id)
      .map(contact => [String(contact.id), contact]),
  );
  const groups = new Map();
  (Array.isArray(subscriptions) ? subscriptions : []).forEach(subscription => {
    if (String(subscription?.sectionPlanId || "") !== String(sectionPlanId || "")) return;
    if (subscription?.status !== "active" || subscription?.adminPaused === true) return;
    const contact = contactById.get(String(subscription?.contactId || ""));
    if (!contact || contact?.status !== "active" || Number(contact?.optedOutAt || 0) > 0) return;
    const phone = normaliseParentPhone(contact?.phoneE164 || contact?.phone);
    if (!phone) return;
    const phoneHash = contact?.phoneHash || parentPhoneHash(phone);
    const key = `${phoneHash}::${sectionPlanId}`;
    const current = groups.get(key) || {
      phone,
      phoneHash,
      parentName: cleanParentText(contact?.parentName || "Parent", 120) || "Parent",
      contactIds: [],
      subscriptionIds: [],
      childNames: [],
    };
    if (!current.contactIds.includes(String(contact.id))) current.contactIds.push(String(contact.id));
    if (!current.subscriptionIds.includes(String(subscription.id))) current.subscriptionIds.push(String(subscription.id));
    const childName = cleanParentText(subscription?.childName || "your child", 120) || "your child";
    if (!current.childNames.some(existing => existing.toLowerCase() === childName.toLowerCase())) {
      current.childNames.push(childName);
    }
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => {
    const parentOrder = reportSorter.compare(a.parentName || "", b.parentName || "");
    return parentOrder || reportSorter.compare(a.phoneHash || "", b.phoneHash || "");
  });
}

export function validateParentImportRows(rows = []) {
  const results = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const parentName = cleanParentText(row?.parentName || row?.parent_name, 120);
    const childName = cleanParentText(row?.childName || row?.studentName || row?.student_name, 120);
    const relationship = cleanParentText(row?.relationship || "Guardian", 80) || "Guardian";
    const phone = normaliseParentPhone(row?.phoneE164 || row?.phone);
    const errors = [];
    if (!parentName) errors.push("parent_name is required");
    if (!childName) errors.push("student_name is required");
    if (!phone) errors.push("phone is invalid");
    const dedupeKey = phone && childName ? `${parentPhoneHash(phone)}::${childName.toLowerCase()}` : "";
    const duplicate = !!dedupeKey && seen.has(dedupeKey);
    if (dedupeKey) seen.add(dedupeKey);
    results.push({
      row: index + 1,
      parentName,
      childName,
      relationship,
      phone,
      duplicate,
      valid: errors.length === 0,
      errors,
    });
  });
  return {
    rows: results,
    validRows: results.filter(item => item.valid && !item.duplicate),
    invalidRows: results.filter(item => !item.valid),
    duplicateRows: results.filter(item => item.duplicate),
  };
}

export function sortParentReportEntries(entries = []) {
  return [...(Array.isArray(entries) ? entries : [])].sort((a, b) => {
    if ((a.sortTime || "") !== (b.sortTime || "")) return (a.sortTime || "").localeCompare(b.sortTime || "");
    const subjectOrder = reportSorter.compare(a.subject || "", b.subject || "");
    if (subjectOrder) return subjectOrder;
    const teacherOrder = reportSorter.compare(a.teacherName || "", b.teacherName || "");
    if (teacherOrder) return teacherOrder;
    return reportSorter.compare(a.title || "", b.title || "");
  });
}

export function buildParentReportHash(report = {}) {
  const canonical = {
    dateKey: String(report?.dateKey || ""),
    instituteId: String(report?.instituteId || ""),
    sectionPlanId: String(report?.sectionPlanId || ""),
    sectionLabel: cleanParentText(report?.sectionLabel, 160),
    entries: sortParentReportEntries(report?.entries).map(entry => ({
      sourceId: String(entry?.sourceId || ""),
      subject: cleanParentText(entry?.subject, 160),
      title: cleanParentText(entry?.title, 300),
      notes: cleanParentMultilineText(entry?.notes, 3000),
      teacherName: cleanParentText(entry?.teacherName, 160),
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function buildParentTextSummary(entries = [], maxLength = 600) {
  const seen = new Set();
  const lines = [];
  sortParentReportEntries(entries).forEach(entry => {
    const subject = cleanParentText(entry?.subject || "Class update", 120) || "Class update";
    const title = cleanParentText(entry?.title || entry?.notes || "Update recorded", 220) || "Update recorded";
    const key = `${subject.toLowerCase()}::${title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`• ${subject}: ${title}`);
  });
  if (!lines.length) return "No classroom update is available today.";
  let output = "";
  for (const line of lines) {
    const candidate = output ? `${output}\n${line}` : line;
    if (candidate.length <= maxLength) {
      output = candidate;
      continue;
    }
    if (!output) output = `${line.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
    break;
  }
  if (output.length < maxLength && lines.length > output.split("\n").length) {
    const suffix = "\n• More details in the attached PDF.";
    output = `${output.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
  }
  return output.slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildParentSectionPdfHtml(report = {}) {
  const entries = sortParentReportEntries(report?.entries);
  const rows = entries.length
    ? entries.map(entry => `
      <article class="entry">
        <div class="entry-top">
          <span class="subject">${escapeHtml(entry.subject || "Subject")}</span>
          <span class="teacher">${escapeHtml(entry.teacherName || "Teacher")}</span>
        </div>
        <h2>${escapeHtml(entry.title || "Class update")}</h2>
        <p>${escapeHtml(entry.notes || "No additional teaching notes were recorded.")}</p>
      </article>`).join("")
    : `<div class="empty">No classroom update is available for this section today.</div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(report.instituteName)} · ${escapeHtml(report.sectionLabel)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17251f; background: #fff; font-family: Inter, Arial, sans-serif; }
    header { border-radius: 18px; background: #102820; color: #fff; padding: 24px 26px; }
    .eyebrow { color: #9fdbc0; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
    h1 { margin: 8px 0 4px; font-size: 28px; line-height: 1.15; }
    .meta { color: #d9ebe2; font-size: 13px; line-height: 1.5; }
    main { display: grid; gap: 12px; margin-top: 18px; }
    .entry { break-inside: avoid; border: 1px solid #dce8e1; border-radius: 14px; padding: 16px 18px; }
    .entry-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .subject { color: #126e46; background: #e9f8f0; border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 800; }
    .teacher { color: #63776d; font-size: 11px; font-weight: 700; text-align: right; }
    h2 { margin: 12px 0 6px; font-size: 17px; line-height: 1.35; }
    p { margin: 0; color: #4f6359; font-size: 13px; line-height: 1.65; white-space: pre-wrap; }
    .empty { border: 1px dashed #c8d9cf; border-radius: 14px; padding: 32px; text-align: center; color: #64766d; }
    footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e4ece7; color: #7b8d84; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Daily learning update</div>
    <h1>${escapeHtml(report.instituteName || "Institute")}</h1>
    <div class="meta">${escapeHtml(report.sectionLabel || "Section")} · ${escapeHtml(report.dateLabel || report.dateKey || "")}</div>
  </header>
  <main>${rows}</main>
  <footer>Powered by Ledgr · This report contains class-wide teaching information.</footer>
</body>
</html>`;
}

function parentTemplateText(value, fallback, maxLength = 1024) {
  return cleanParentText(value || fallback, maxLength) || fallback;
}

export function buildParentTemplatePayload({
  to,
  kind = "daily",
  parentName,
  childNames = [],
  instituteName,
  sectionLabel,
  dateLabel,
  summary,
  mediaId = "",
  filename = "ledgr-class-update.pdf",
  templates = PARENT_WHATSAPP_TEMPLATE_NAMES,
}) {
  const phone = normaliseParentPhone(to);
  if (!phone) throw new Error("A valid WhatsApp phone number is required.");
  const children = (Array.isArray(childNames) ? childNames : [])
    .map(value => cleanParentText(value, 120))
    .filter(Boolean)
    .join(", ") || "your child";
  const templateName = kind === "corrected"
    ? templates.corrected
    : kind === "no_update"
      ? templates.noUpdate
      : templates.daily;
  const bodyParameters = kind === "no_update"
    ? [
      parentTemplateText(parentName, "Parent", 120),
      parentTemplateText(children, "your child", 240),
      parentTemplateText(sectionLabel, "Section", 160),
      parentTemplateText(instituteName, "Institute", 160),
      parentTemplateText(dateLabel, "today", 80),
    ]
    : [
      parentTemplateText(parentName, "Parent", 120),
      parentTemplateText(children, "your child", 240),
      parentTemplateText(sectionLabel, "Section", 160),
      parentTemplateText(instituteName, "Institute", 160),
      parentTemplateText(dateLabel, "today", 80),
      parentTemplateText(summary, "Please see the attached class update.", 600),
    ];
  const components = [];
  if (kind !== "no_update") {
    if (!mediaId) throw new Error("A Meta media id is required for a PDF template.");
    components.push({
      type: "header",
      parameters: [{
        type: "document",
        document: {
          id: String(mediaId),
          filename: cleanParentText(filename, 180) || "ledgr-class-update.pdf",
        },
      }],
    });
  }
  components.push({
    type: "body",
    parameters: bodyParameters.map(text => ({ type: "text", text })),
  });
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.slice(1),
    type: "template",
    template: {
      name: templateName,
      language: { code: PARENT_WHATSAPP_LANGUAGE },
      components,
    },
  };
}

export function parseParentJoinDetails(value) {
  const parts = String(value || "").split("|").map(part => cleanParentText(part, 160));
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return {
    parentName: parts[0],
    childName: parts[1],
    relationship: parts[2] || "Guardian",
  };
}

export function parentReportFilename(report = {}) {
  const slug = value => normaliseParentSectionKey(value).replace(/-/g, "_") || "section";
  return `${slug(report.instituteName)}_${slug(report.sectionLabel)}_${String(report.dateKey || "daily")}_class_update.pdf`;
}
