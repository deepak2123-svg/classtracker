export const exportTextSorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function normaliseName(raw){
  if(!raw) return raw;
  return String(raw).trim().replace(/\s+/g, " ");
}

export function normaliseInstituteNameKey(raw){
  return normaliseName(String(raw || "")).toLowerCase();
}

export function classNum(name){
  const match = (name || "").match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

export function exportClassMeta(name){
  const clean = (name || "").trim();
  const grade = classNum(clean);
  const gradeOrder = grade >= 6 && grade <= 12 ? grade : 99;
  return { gradeOrder, clean };
}

export function sameInstituteName(a,b){
  return normaliseInstituteNameKey(a) === normaliseInstituteNameKey(b);
}

export function compareExportRows(a,b){
  const aClass = exportClassMeta(a.class);
  const bClass = exportClassMeta(b.class);
  if (aClass.gradeOrder !== bClass.gradeOrder) return aClass.gradeOrder - bClass.gradeOrder;
  const classCmp = exportTextSorter.compare(aClass.clean, bClass.clean);
  if (classCmp !== 0) return classCmp;
  if ((a.date || "") !== (b.date || "")) return (a.date || "").localeCompare(b.date || "");
  if ((a.start_time || "") !== (b.start_time || "")) return (a.start_time || "").localeCompare(b.start_time || "");
  if ((a.end_time || "") !== (b.end_time || "")) return (a.end_time || "").localeCompare(b.end_time || "");
  const teacherCmp = exportTextSorter.compare(a.teacher || "", b.teacher || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}

export function compareChronologicalRows(a,b){
  if ((a.date || "") !== (b.date || "")) return (a.date || "").localeCompare(b.date || "");
  if ((a.start_time || "") !== (b.start_time || "")) return (a.start_time || "").localeCompare(b.start_time || "");
  if ((a.end_time || "") !== (b.end_time || "")) return (a.end_time || "").localeCompare(b.end_time || "");
  const teacherCmp = exportTextSorter.compare(a.teacher || "", b.teacher || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}

export function compareAdminPanelEntries(a,b){
  if ((a.dateKey || "") !== (b.dateKey || "")) return (a.dateKey || "").localeCompare(b.dateKey || "");
  if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
  if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
  const teacherCmp = exportTextSorter.compare(a.teacherName || "", b.teacherName || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}

export function escapeExportHtml(value){
  return String(value || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

export function exportHtmlWithBreaks(value){
  return escapeExportHtml(value).replace(/\n/g,"<br/>");
}

export function fmt12(value){
  if(!value) return "";
  if(typeof value !== "string") return "";
  const [hours, minutes] = value.split(":").map(Number);
  if(Number.isNaN(hours) || Number.isNaN(minutes)) return "";
  return `${hours%12||12}:${String(minutes).padStart(2,"0")} ${hours>=12?"PM":"AM"}`;
}

export function formatExportPdfDate(dateKey){
  if(!dateKey) return "";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("en-IN", {
    day:"2-digit",
    month:"short",
    year:"numeric",
  });
}

export function formatExportPdfTime(start, end){
  if(!start && !end) return "";
  if(start && end) return `${fmt12(start)} - ${fmt12(end)}`;
  return fmt12(start || end || "");
}

export function safeAdminText(value, fallback = ""){
  if(value===null || value===undefined) return fallback;
  if(typeof value==="string") return value;
  if(typeof value==="number" || typeof value==="boolean") return String(value);
  if(Array.isArray(value)){
    const text = value.map(item=>safeAdminText(item, "")).filter(Boolean).join(", ");
    return text || fallback;
  }
  if(typeof value==="object"){
    const candidate = value.label ?? value.name ?? value.title ?? value.text ?? value.value;
    if(candidate!==undefined && candidate!==value) return safeAdminText(candidate, fallback);
    return fallback;
  }
  return fallback;
}

export function slugifyDownloadPart(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "report";
}
