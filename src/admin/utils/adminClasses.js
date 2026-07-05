import {
  compareAdminPanelEntries,
  compareChronologicalRows,
  exportClassMeta,
  exportTextSorter,
  safeAdminText,
} from "./adminText.js";
import { normaliseSectionKey } from "./adminSections.js";

export function compareClassCardsByActivity(a,b){
  const aTs = Number(a?.lastActivityTs || 0);
  const bTs = Number(b?.lastActivityTs || 0);
  if(bTs !== aTs) return bTs - aTs;
  return exportTextSorter.compare(a?.display || "", b?.display || "");
}

const ADMIN_PROGRAM_GROUPS = [
  { key:"jee", label:"JEE", accent:"#1D4ED8", bg:"#EEF4FF", border:"#BFDBFE" },
  { key:"neet", label:"NEET", accent:"#059669", bg:"#ECFDF5", border:"#A7F3D0" },
  { key:"foundation", label:"Foundation", accent:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
];
const ADMIN_JEE_SECTION_HINTS = ["virat", "madhav", "parth", "iit", "jee"];
const ADMIN_NEET_SECTION_HINTS = ["sankalp", "keshav", "govind", "medical", "neet"];
const ADMIN_FOUNDATION_SECTION_HINTS = ["lakshay", "aarambh", "foundation"];

function extractExplicitClassGrade(value){
  const match = String(value || "").match(/(?:^|\b)(6|7|8|9|10|11|12)(?:st|nd|rd|th)\b/i);
  return match ? Number(match[1]) : 0;
}

function includesAnyProgramHint(haystack, hints){
  return (hints || []).some(hint => haystack.includes(hint));
}

function detectAdminClassProgramGroup(cls){
  const label = `${cls?.display || ""} ${cls?.raw || ""}`;
  const normalisedLabel = normaliseSectionKey(label);
  const grade = extractExplicitClassGrade(label);
  if(grade >= 6 && grade <= 10) return "foundation";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_FOUNDATION_SECTION_HINTS)) return "foundation";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_NEET_SECTION_HINTS)) return "neet";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_JEE_SECTION_HINTS)) return "jee";

  const subjectKeys = (cls?.subjects || []).map(normaliseSectionKey);
  const hasBiology = subjectKeys.some(subject => subject.includes("biology"));
  const hasMathematics = subjectKeys.some(subject => subject.includes("mathematics"));
  const hasPhysics = subjectKeys.some(subject => subject.includes("physics"));
  const hasChemistry = subjectKeys.some(subject => subject.includes("chemistry"));

  if(hasBiology && !hasMathematics) return "neet";
  if(grade >= 11) return "jee";
  if(hasMathematics || hasPhysics || hasChemistry) return "jee";
  return "jee";
}

export function buildAdminProgramClassGroups(classes){
  const grouped = {
    jee:[],
    neet:[],
    foundation:[],
  };
  (classes || []).forEach(cls => {
    const groupKey = detectAdminClassProgramGroup(cls);
    if(!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(cls);
  });
  return ADMIN_PROGRAM_GROUPS
    .map(group => ({ ...group, items: grouped[group.key] || [] }))
    .filter(group => group.items.length > 0);
}

export function groupAdminPdfRows(rows){
  const byInstitute = new Map();
  rows.forEach(row=>{
    const instName = (row.institute || "No Institute").trim() || "No Institute";
    const className = (row.class || "Untitled Class").trim() || "Untitled Class";
    if(!byInstitute.has(instName)){
      byInstitute.set(instName, { name:instName, classMap:new Map(), entryCount:0 });
    }
    const inst = byInstitute.get(instName);
    if(!inst.classMap.has(className)){
      inst.classMap.set(className, { className, entries:[], teachers:new Set(), subjects:new Set() });
    }
    const group = inst.classMap.get(className);
    group.entries.push(row);
    if(row.teacher) group.teachers.add(row.teacher);
    if(row.subject) group.subjects.add(row.subject);
    inst.entryCount += 1;
  });

  return Array.from(byInstitute.values())
    .sort((a,b)=>exportTextSorter.compare(a.name, b.name))
    .map(inst=>{
      const classes = Array.from(inst.classMap.values())
        .sort((a,b)=>{
          const aMeta = exportClassMeta(a.className);
          const bMeta = exportClassMeta(b.className);
          if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
          return exportTextSorter.compare(aMeta.clean, bMeta.clean);
        })
        .map(group=>({
          ...group,
          teacherList:Array.from(group.teachers).sort(exportTextSorter.compare),
          subjectList:Array.from(group.subjects).sort(exportTextSorter.compare),
          entries:[...group.entries].sort(compareChronologicalRows),
        }));
      return {
        name:inst.name,
        classes,
        classCount:classes.length,
        entryCount:inst.entryCount,
      };
    });
}

export function groupAdminPanelEntries(entries){
  const classMap = new Map();
  entries.forEach(entry=>{
    const className = safeAdminText(entry.className, "Untitled Class").trim() || "Untitled Class";
    if(!classMap.has(className)){
      classMap.set(className, { className, entries:[], teachers:new Set(), subjects:new Set() });
    }
    const group = classMap.get(className);
    group.entries.push(entry);
    const teacherName = safeAdminText(entry.teacherName, "");
    const subject = safeAdminText(entry.subject, "");
    if(teacherName) group.teachers.add(teacherName);
    if(subject) group.subjects.add(subject);
  });

  return Array.from(classMap.values())
    .sort((a,b)=>{
      const aMeta = exportClassMeta(a.className);
      const bMeta = exportClassMeta(b.className);
      if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
      return exportTextSorter.compare(aMeta.clean, bMeta.clean);
    })
    .map(group=>({
      ...group,
      teacherList:Array.from(group.teachers).sort(exportTextSorter.compare),
      subjectList:Array.from(group.subjects).sort(exportTextSorter.compare),
      entries:[...group.entries].sort(compareAdminPanelEntries),
    }));
}

function cleanAdminSubjectName(value){
  return String(value || "").trim();
}

function adminSubjectNameKey(value){
  return cleanAdminSubjectName(value).toLowerCase();
}

function collectAdminTeacherSubjectNames(teacher, teacherData, subjectCatalog = []){
  const seen = new Set();
  const names = [];
  const addName = value => {
    const clean = cleanAdminSubjectName(value);
    const key = adminSubjectNameKey(clean);
    if(!key || seen.has(key)) return;
    seen.add(key);
    names.push(clean);
  };
  const catalogById = new Map(
    (Array.isArray(subjectCatalog) ? subjectCatalog : [])
      .map(item => [String(item?.id || "").trim(), cleanAdminSubjectName(item?.name)])
      .filter(([id, name]) => id && name)
  );
  (Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects : []).forEach(item => addName(item?.name));
  (Array.isArray(teacher?.assignedSubjectIds) ? teacher.assignedSubjectIds : []).forEach(id => addName(catalogById.get(String(id || "").trim())));
  (Array.isArray(teacher?.subjects) ? teacher.subjects : []).forEach(addName);
  (Array.isArray(teacherData?.profile?.subjects) ? teacherData.profile.subjects : []).forEach(addName);
  return names;
}

export function resolveAdminTeacherClassSubjectLabel(teacher, teacherData, cls, subjectCatalog = [], fallbackSubject = ""){
  const classSubject = cleanAdminSubjectName(cls?.subject || fallbackSubject);
  const teacherSubjects = collectAdminTeacherSubjectNames(teacher, teacherData, subjectCatalog);
  if(classSubject){
    const matched = teacherSubjects.find(name => adminSubjectNameKey(name) === adminSubjectNameKey(classSubject));
    if(matched) return matched;
  }
  if(teacherSubjects.length === 1) return teacherSubjects[0];
  if(classSubject) return classSubject;
  return teacherSubjects[0] || "";
}
