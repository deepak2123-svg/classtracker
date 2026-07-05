import { sameInstituteName } from "./adminText.js";

export function isActiveAdminTeacherClass(cls){
  if(!cls || typeof cls !== "object") return false;
  if(cls.left || cls.archived || cls.archivedByAdmin || cls.transferArchive) return false;
  const deletedAt = Number(cls.deletedAt || 0) || 0;
  return deletedAt <= 0;
}

export function activeAdminTeacherClasses(data){
  return Array.isArray(data?.classes) ? data.classes.filter(isActiveAdminTeacherClass) : [];
}

export function getTeacherInstituteListFromMap(teacher, fullDataMap){
  const list = [];
  const add = (value) => {
    const next = String(value || "").trim();
    if(!next) return;
    if(list.some(existing => sameInstituteName(existing, next))) return;
    list.push(next);
  };
  const data = fullDataMap?.[teacher?.uid];
  const hasLoadedClasses = Array.isArray(data?.classes);
  if(hasLoadedClasses){
    activeAdminTeacherClasses(data).forEach(cls => add(cls?.institute));
    return list;
  }
  (teacher?.institutes || []).forEach(add);
  (data?.profile?.institutes || []).forEach(add);
  return list;
}

export function teacherBelongsToInstituteFromMap(teacher, instituteName, fullDataMap){
  if(!teacher || !instituteName) return false;
  return getTeacherInstituteListFromMap(teacher, fullDataMap).some(inst => sameInstituteName(inst, instituteName));
}

export function getTeacherDisplayNameFromMap(teacher, fullDataMap){
  return fullDataMap?.[teacher?.uid]?.profile?.name || teacher?.name || "Teacher";
}
