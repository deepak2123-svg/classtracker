import { slugifyDownloadPart } from "../utils/adminText.js";

export function makeSyllabusLocalId(prefix){
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  return `${prefix}-${random}`;
}

export function currentAcademicYearLabel(){
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function normaliseSyllabusScope(scope, fallbackInstitute = "", fallbackSection = ""){
  const grouped = new Map();
  (Array.isArray(scope)?scope:[]).forEach(item=>{
    const instituteName=String(item?.instituteName||"").trim();
    if(!instituteName) return;
    const key=instituteName.toLowerCase();
    const current=grouped.get(key)||{instituteName,sectionNames:[]};
    const values=Array.isArray(item?.sectionNames)?item.sectionNames:[item?.sectionName];
    values.forEach(value=>{
      const sectionName=String(value||"").trim();
      if(sectionName&&!current.sectionNames.some(existing=>existing.toLowerCase()===sectionName.toLowerCase())){
        current.sectionNames.push(sectionName);
      }
    });
    grouped.set(key,current);
  });
  const instituteName=String(fallbackInstitute||"").trim();
  const sectionName=String(fallbackSection||"").trim();
  if(!grouped.size&&instituteName&&sectionName){
    grouped.set(instituteName.toLowerCase(),{instituteName,sectionNames:[sectionName]});
  }
  return [...grouped.values()]
    .map(item=>({...item,sectionNames:[...item.sectionNames].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base"}))}))
    .filter(item=>item.sectionNames.length)
    .sort((a,b)=>a.instituteName.localeCompare(b.instituteName,undefined,{sensitivity:"base"}));
}

export function syllabusScopePairs(scope){
  return normaliseSyllabusScope(scope).flatMap(item=>
    item.sectionNames.map(sectionName=>({instituteName:item.instituteName,sectionName}))
  );
}

export function syllabusScopeKey(scope){
  return syllabusScopePairs(scope)
    .map(item=>`${item.instituteName.trim().toLowerCase()}::${item.sectionName.trim().toLowerCase()}`)
    .sort()
    .join("|");
}

export function syllabusSubjectIdentityKey(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^class-subject-/, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function syllabusTemplateMatchesSubject(template, subject){
  const templateKeys = new Set([
    syllabusSubjectIdentityKey(template?.subjectId),
    syllabusSubjectIdentityKey(template?.subjectName),
  ].filter(Boolean));
  const subjectKeys = [
    syllabusSubjectIdentityKey(subject?.id),
    syllabusSubjectIdentityKey(subject?.name),
  ].filter(Boolean);
  return subjectKeys.some(key => templateKeys.has(key));
}

export function syllabusTargetIdentityKey(target){
  const teacherUid = String(target?.teacherUid || "").trim();
  const classId = String(target?.classId || "").trim();
  return teacherUid && classId ? `${teacherUid}::${classId}` : "";
}

export function syllabusTemplateMatchesTargets(template, targets = []){
  const templateKeys = new Set([
    ...((Array.isArray(template?.draft?.targets) ? template.draft.targets : []).map(syllabusTargetIdentityKey)),
    ...((Array.isArray(template?.published?.targets) ? template.published.targets : []).map(syllabusTargetIdentityKey)),
  ].filter(Boolean));
  if(!templateKeys.size) return false;
  return (Array.isArray(targets) ? targets : [])
    .map(syllabusTargetIdentityKey)
    .filter(Boolean)
    .some(key => templateKeys.has(key));
}

export function syllabusTemplateScope(template){
  const draft=template?.draft||template||{};
  const published=template?.published||{};
  const scopeSource =
    (Array.isArray(draft.scope) && draft.scope.length ? draft.scope : null)
    || ((Array.isArray(template?.scope) && template.scope.length) ? template.scope : null)
    || published.scope;
  return normaliseSyllabusScope(
    scopeSource,
    draft.instituteName || template?.instituteName || published.instituteName,
    draft.sectionName || template?.sectionName || published.sectionName,
  );
}

export function emptySyllabusDraft(subject){
  return {
    id:"",
    subjectId:subject.id,
    subjectName:subject.name,
    status:"draft",
    currentVersion:0,
    draft:{
      name:"",
      instituteName:"",
      sectionName:"",
      scope:[],
      academicYear:currentAcademicYearLabel(),
      curriculum:"",
      gradeLabel:"",
      chapters:[],
      targets:[],
    },
    published:null,
  };
}

export function normaliseSyllabusTopicRecord(topic, chapterId, topicIndex){
  const source = topic && typeof topic === "object" ? topic : {};
  const title = typeof topic === "string" ? topic : String(source?.title || "");
  const fallbackId = `${chapterId}-topic-${topicIndex + 1}-${slugifyDownloadPart(title || `topic_${topicIndex + 1}`)}`;
  return {
    ...source,
    id:String(source?.id || fallbackId),
    title,
  };
}

export function normaliseSyllabusChapterRecord(chapter, chapterIndex){
  const source = chapter && typeof chapter === "object" ? chapter : {};
  const title = typeof chapter === "string" ? chapter : String(source?.title || "");
  const fallbackId = `chapter-${chapterIndex + 1}-${slugifyDownloadPart(title || `chapter_${chapterIndex + 1}`)}`;
  return {
    ...source,
    id:String(source?.id || fallbackId),
    title,
    topics:(Array.isArray(source?.topics) ? source.topics : []).map((topic, topicIndex)=>
      normaliseSyllabusTopicRecord(topic, String(source?.id || fallbackId), topicIndex)
    ),
  };
}

export function normaliseSyllabusTemplateRecord(template){
  if(!template || typeof template !== "object") return template;
  const normaliseSection = section => {
    const source = section && typeof section === "object" ? section : {};
    return {
      ...source,
      chapters:(Array.isArray(source?.chapters) ? source.chapters : []).map(normaliseSyllabusChapterRecord),
    };
  };
  return {
    ...template,
    draft:normaliseSection(template.draft),
    published:template.published ? normaliseSection(template.published) : template.published,
  };
}
