import { classNum, exportTextSorter, sameInstituteName } from "./adminText.js";
import { DELETE_SECTION_ACTION } from "../constants/adminKeys.js";
import { activeAdminTeacherClasses, isActiveAdminTeacherClass } from "./adminTeachers.js";

export function getInstituteSectionConfigKey(instituteSections, instituteName){
  if(!instituteSections || !instituteName) return instituteName || "";
  if(Object.prototype.hasOwnProperty.call(instituteSections, instituteName)) return instituteName;
  const match = Object.keys(instituteSections).find(name => sameInstituteName(name, instituteName));
  return match || instituteName;
}

export function getInstituteSectionConfig(instituteSections, instituteName){
  const key = getInstituteSectionConfigKey(instituteSections, instituteName);
  return key ? instituteSections?.[key] || null : null;
}

export function normaliseSectionKey(value){
  const text = String(value || "");
  const normalised = typeof text.normalize === "function" ? text.normalize("NFKC") : text;
  return normalised
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .toLowerCase();
}

export function getInstituteSectionNames(instData){
  return [...new Set(
    [
      ...(instData?.gradeGroups || []).flatMap(group => group.sections || []),
      ...(instData?.extraSections || []),
    ]
      .map(section => String(section || "").trim())
      .filter(Boolean)
  )];
}

export function uniqueSectionNames(values){
  return [...new Set((values || []).map(value => String(value || "").trim()).filter(Boolean))];
}

function splitSectionTokens(value){
  return normaliseSectionKey(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreSectionRenameTarget(oldSection, candidate){
  const oldTokens = splitSectionTokens(oldSection);
  const nextTokens = splitSectionTokens(candidate);
  if(!oldTokens.length || !nextTokens.length) return 0;
  let score = 0;
  if(oldTokens[0] && nextTokens[0] && oldTokens[0] === nextTokens[0]) score += 4;
  const shared = oldTokens.filter(token => nextTokens.includes(token));
  score += shared.length * 2;
  if(normaliseSectionKey(candidate).startsWith(normaliseSectionKey(oldSection)) || normaliseSectionKey(oldSection).startsWith(normaliseSectionKey(candidate))) {
    score += 1;
  }
  return score;
}

export function guessSectionRenameTarget(oldSection, preferredSections, fallbackSections = []){
  const pool = [...(preferredSections || []), ...(fallbackSections || []).filter(item => !(preferredSections || []).includes(item))];
  if((preferredSections || []).length === 1) return preferredSections[0];
  const ranked = pool
    .map((value, index) => ({ value, index, score:scoreSectionRenameTarget(oldSection, value) }))
    .sort((a,b)=>b.score-a.score || a.index-b.index);
  return ranked[0]?.score > 0 ? ranked[0].value : "";
}

export function findStrongSectionRenameTarget(oldSection, candidateSections){
  const oldKey = normaliseSectionKey(oldSection);
  const pool = uniqueSectionNames(candidateSections).filter(section => normaliseSectionKey(section) !== oldKey);
  if(!oldKey || !pool.length) return "";
  if(pool.length === 1) return pool[0];
  const ranked = pool
    .map((value, index) => ({ value, index, score:scoreSectionRenameTarget(oldSection, value) }))
    .sort((a,b)=>b.score-a.score || a.index-b.index);
  const top = ranked[0];
  const second = ranked[1];
  if(!top || top.score < 4) return "";
  if(second && second.score >= top.score - 1 && top.score < 7) return "";
  return top.value || "";
}

function buildGroupScheduleFingerprint(group){
  const slots = (group?.slots || []).map(slot => ({
    start:String(slot?.start || ""),
    end:String(slot?.end || ""),
    durMins:Number(slot?.durMins || 0),
  }));
  const overrides = Object.fromEntries(
    Object.entries(group?.sectionOverrides || {})
      .sort((a,b)=>exportTextSorter.compare(a[0], b[0]))
      .map(([section, rows])=>[
        section,
        (rows || []).map(slot => ({
          start:String(slot?.start || ""),
          end:String(slot?.end || ""),
          durMins:Number(slot?.durMins || 0),
        })),
      ])
  );
  return JSON.stringify({ slots, overrides });
}

export function buildSectionChangeDraft(previousGroup, nextGroup){
  const previousSections = uniqueSectionNames(previousGroup?.sections || []);
  const nextSections = uniqueSectionNames(nextGroup?.sections || []);
  const nextLookup = new Set(nextSections.map(normaliseSectionKey));
  const previousLookup = new Set(previousSections.map(normaliseSectionKey));
  const removedSections = previousSections.filter(section => !nextLookup.has(normaliseSectionKey(section)));
  const addedSections = nextSections.filter(section => !previousLookup.has(normaliseSectionKey(section)));
  return {
    removedSections,
    addedSections,
    currentSections: nextSections,
    timetableChanged: buildGroupScheduleFingerprint(previousGroup) !== buildGroupScheduleFingerprint(nextGroup),
  };
}

export function buildInitialSectionRenameSelections(draft){
  const selections = {};
  (draft?.removedSections || []).forEach((oldSection, index) => {
    const preferred = draft?.addedSections || [];
    const fallback = draft?.currentSections || [];
    const guessed = preferred[index] || guessSectionRenameTarget(oldSection, preferred, fallback) || "";
    selections[oldSection] = guessed;
  });
  return selections;
}

export function mergeExplicitSectionRenames(records, oldSection, newSection){
  const oldLabel = String(oldSection || "").trim();
  const nextLabel = String(newSection || "").trim();
  const oldKey = normaliseSectionKey(oldLabel);
  const nextKey = normaliseSectionKey(nextLabel);
  if(!oldKey || !nextKey || oldKey === nextKey) return records || [];
  const nextRecords = [];
  let linked = false;
  (records || []).forEach(record => {
    const recordOld = String(record?.oldSection || "").trim();
    const recordNew = String(record?.newSection || "").trim();
    const recordOldKey = normaliseSectionKey(recordOld);
    const recordNewKey = normaliseSectionKey(recordNew);
    if(!recordOldKey || !recordNewKey) return;
    if(recordNewKey === oldKey || recordOldKey === oldKey){
      nextRecords.push({ oldSection: recordOld, newSection: nextLabel });
      linked = true;
      return;
    }
    nextRecords.push({ oldSection: recordOld, newSection: recordNew });
  });
  if(!linked){
    nextRecords.push({ oldSection: oldLabel, newSection: nextLabel });
  }
  const byOld = new Map();
  nextRecords.forEach(record => {
    const recordOld = String(record?.oldSection || "").trim();
    const recordNew = String(record?.newSection || "").trim();
    const recordOldKey = normaliseSectionKey(recordOld);
    const recordNewKey = normaliseSectionKey(recordNew);
    if(!recordOldKey || !recordNewKey || recordOldKey === recordNewKey) return;
    byOld.set(recordOldKey, { oldSection: recordOld, newSection: recordNew });
  });
  return [...byOld.values()];
}

export function pruneExplicitSectionRenames(records, removedSection){
  const removedKey = normaliseSectionKey(removedSection);
  return (records || []).filter(record => {
    const oldKey = normaliseSectionKey(record?.oldSection);
    const newKey = normaliseSectionKey(record?.newSection);
    return oldKey && newKey && oldKey !== removedKey && newKey !== removedKey;
  });
}

export function buildExplicitSectionRenameSelections(previousGroup, nextGroup, records){
  const previousSections = uniqueSectionNames(previousGroup?.sections || []);
  const nextSections = uniqueSectionNames(nextGroup?.sections || []);
  const previousLookup = new Set(previousSections.map(normaliseSectionKey));
  const nextLookup = new Set(nextSections.map(normaliseSectionKey));
  const selections = {};
  (records || []).forEach(record => {
    const oldSection = String(record?.oldSection || "").trim();
    const newSection = String(record?.newSection || "").trim();
    const oldKey = normaliseSectionKey(oldSection);
    const newKey = normaliseSectionKey(newSection);
    if(!oldKey || !newKey || oldKey === newKey) return;
    if(!previousLookup.has(oldKey)) return;
    if(nextLookup.has(oldKey)) return;
    if(!nextLookup.has(newKey)) return;
    selections[oldSection] = newSection;
  });
  return selections;
}

export function applySectionRenameSelections(group, selections){
  const currentSections = new Set(uniqueSectionNames(group?.sections || []));
  const nextOverrides = { ...(group?.sectionOverrides || {}) };
  Object.entries(selections || {}).forEach(([oldSection, newSection])=>{
    const fromKey = String(oldSection || "").trim();
    const toKey = String(newSection || "").trim();
    if(!fromKey) return;
    if(toKey && currentSections.has(toKey) && !nextOverrides[toKey] && (nextOverrides[fromKey] || []).length){
      nextOverrides[toKey] = nextOverrides[fromKey];
    }
    delete nextOverrides[fromKey];
  });
  const filteredOverrides = Object.fromEntries(
    Object.entries(nextOverrides).filter(([section]) => currentSections.has(section))
  );
  return { ...group, sectionOverrides: filteredOverrides };
}

export function buildSectionChangeEvents(inst, previousGroup, nextGroup, selections, timetableChanged){
  const changes = Object.entries(selections || {})
    .map(([oldSection, newSection]) => ({
      oldSection:String(oldSection || "").trim(),
      newSection:String(newSection || "").trim(),
    }))
    .filter(change => change.oldSection && change.newSection && normaliseSectionKey(change.oldSection) !== normaliseSectionKey(change.newSection));
  if(!changes.length) return [];
  return [{
    id:`secchg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    institute: inst,
    groupId: nextGroup?.id || previousGroup?.id || "",
    groupLabel: nextGroup?.label || previousGroup?.label || "",
    createdAt: Date.now(),
    timetableChanged: !!timetableChanged,
    changes,
  }];
}

export function getInstituteEntityLabels(instType){
  const coaching = instType === "coaching_12" || instType === "coaching_grad";
  return coaching
    ? { singular:"batch", plural:"batches" }
    : { singular:"section", plural:"sections" };
}

const COACHING_CATEGORY_ORDER = {
  coaching_12: ["JEE","NEET","NDA","CLAT","CUET","Foundation","Dropper","Other"],
  coaching_grad: ["Banking","SSC","UPSC","CAT","GATE","RRB","Defence","Other"],
};

function coachingClassificationLabel(instType, sectionName = "", groupLabel = "") {
  const text = `${sectionName} ${groupLabel}`.toLowerCase();
  const fallback = (groupLabel || "").trim() || "Other";
  if (instType === "coaching_12") {
    if (text.includes("jee")) return "JEE";
    if (text.includes("neet") || text.includes("medical") || /\bmed\b/.test(text)) return "NEET";
    if (text.includes("nda")) return "NDA";
    if (text.includes("clat")) return "CLAT";
    if (text.includes("cuet")) return "CUET";
    if (text.includes("foundation")) return "Foundation";
    if (text.includes("dropper")) return "Dropper";
    return fallback;
  }
  if (instType === "coaching_grad") {
    if (text.includes("bank")) return "Banking";
    if (text.includes("ssc")) return "SSC";
    if (text.includes("upsc")) return "UPSC";
    if (text.includes("cat")) return "CAT";
    if (text.includes("gate")) return "GATE";
    if (text.includes("rrb") || text.includes("rail")) return "RRB";
    if (text.includes("defence") || text.includes("defense")) return "Defence";
    return fallback;
  }
  return fallback;
}

export function buildInstituteClassification(instType, groups) {
  const bucketMap = new Map();
  const addToBucket = ({ key, title, sectionLabel, sections, slots, overrideSections, group, sortOrder }) => {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        title,
        sectionLabel,
        sortOrder,
        sections: new Set(),
        slotMap: new Map(),
        overrideSections: new Set(),
        sourceGroups: [],
      });
    }
    const bucket = bucketMap.get(key);
    (sections || []).forEach(section => section && bucket.sections.add(section));
    (slots || []).forEach(slot => {
      const slotKey = `${slot?.start || ""}|${slot?.end || ""}|${slot?.durMins || ""}`;
      if (slot?.start) bucket.slotMap.set(slotKey, slot);
    });
    (overrideSections || []).forEach(section => section && bucket.overrideSections.add(section));
    if (!bucket.sourceGroups.some(item => item.id === group.id)) {
      bucket.sourceGroups.push(group);
    }
  };

  (groups || []).forEach(group => {
    const sections = Array.isArray(group?.sections) ? group.sections.filter(Boolean) : [];
    const slots = Array.isArray(group?.slots) ? group.slots : [];
    const overrides = Object.keys(group?.sectionOverrides || {}).filter(key => (group.sectionOverrides?.[key] || []).length > 0);

    if (instType === "school") {
      const grades = Array.isArray(group?.gradeNums) && group.gradeNums.length
        ? [...group.gradeNums].sort((a, b) => b - a)
        : [...new Set(sections.map(section => classNum(section)).filter(Boolean))].sort((a, b) => b - a);
      if (!grades.length) {
        addToBucket({
          key: `group_${group.id}`,
          title: group?.label || "Ungrouped",
          sectionLabel: "sections",
          sections,
          slots,
          overrideSections: overrides,
          group,
          sortOrder: 0,
        });
        return;
      }
      grades.forEach(grade => {
        let gradeSections = sections.filter(section => classNum(section) === grade);
        if (!gradeSections.length && grades.length === 1) {
          gradeSections = sections;
        }
        const gradeOverrides = overrides.filter(section => classNum(section) === grade || (!classNum(section) && grades.length === 1));
        addToBucket({
          key: `grade_${grade}`,
          title: `${grade}th`,
          sectionLabel: "sections",
          sections: gradeSections,
          slots,
          overrideSections: gradeOverrides,
          group,
          sortOrder: grade,
        });
      });
      return;
    }

    const categoryMap = new Map();
    if (sections.length) {
      sections.forEach(section => {
        const category = coachingClassificationLabel(instType, section, group?.label || "");
        if (!categoryMap.has(category)) categoryMap.set(category, []);
        categoryMap.get(category).push(section);
      });
    } else {
      categoryMap.set(coachingClassificationLabel(instType, "", group?.label || ""), []);
    }

    categoryMap.forEach((categorySections, category) => {
      const categoryOverrides = overrides.filter(section => coachingClassificationLabel(instType, section, group?.label || "") === category);
      const order = COACHING_CATEGORY_ORDER[instType] || [];
      const idx = order.indexOf(category);
      addToBucket({
        key: `${instType}_${category}`,
        title: category,
        sectionLabel: "batches",
        sections: categorySections,
        slots,
        overrideSections: categoryOverrides,
        group,
        sortOrder: idx === -1 ? 999 : idx,
      });
    });
  });

  return Array.from(bucketMap.values())
    .map(bucket => ({
      ...bucket,
      sections: [...bucket.sections].sort(exportTextSorter.compare),
      slots: [...bucket.slotMap.values()].sort((a, b) => (a?.start || "").localeCompare(b?.start || "")),
      overrideSections: [...bucket.overrideSections].sort(exportTextSorter.compare),
      sourceGroups: [...bucket.sourceGroups].sort((a, b) => exportTextSorter.compare(a?.label || "", b?.label || "")),
    }))
    .sort((a, b) => {
      if (instType === "school" && a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return exportTextSorter.compare(a.title, b.title);
    });
}

export function mergeInstituteSectionChangeEvents(existingEvents, nextEvents){
  const merged = [...(existingEvents || []), ...(nextEvents || [])];
  return merged
    .sort((a,b)=>(a?.createdAt || 0) - (b?.createdAt || 0))
    .slice(-60);
}

export function getAdminInstituteSectionChangeEvents(instData){
  return [...(instData?.sectionChangeEvents || [])]
    .filter(event => Array.isArray(event?.changes) && event.changes.length > 0)
    .sort((a,b)=>(a?.createdAt || 0) - (b?.createdAt || 0));
}

export function resolveAdminSectionName(section, instituteName, instituteSections){
  const original = String(section || "").trim();
  if(!original) return "";
  const instData = getInstituteSectionConfig(instituteSections, instituteName);
  if(!instData) return original;
  let current = original;
  getAdminInstituteSectionChangeEvents(instData).forEach(event => {
    const match = (event.changes || []).find(change =>
      normaliseSectionKey(change?.oldSection) === normaliseSectionKey(current) &&
      String(change?.newSection || "").trim()
    );
    if(match){
      current = String(match.newSection || "").trim();
    }
  });
  const currentSections = getInstituteSectionNames(instData);
  const currentKey = normaliseSectionKey(current);
  const inCurrentList = currentSections.some(sectionName => normaliseSectionKey(sectionName) === currentKey);
  if(!inCurrentList){
    const guessed = findStrongSectionRenameTarget(current, currentSections);
    if(guessed) return guessed;
  }
  return current || original;
}

export function dedupeSectionLabels(values){
  const seen = new Set();
  const result = [];
  (values || []).forEach(value => {
    const label = String(value || "").trim();
    const key = normaliseSectionKey(label);
    if(!key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
}

function replaceInstituteNameLocal(value, oldName, newName) {
  const label = String(value || "").trim();
  if (!label) return "";
  return sameInstituteName(label, oldName) ? String(newName || "").trim() : label;
}

function replaceInstituteListLocal(values, oldName, newName) {
  const seen = new Set();
  const next = [];
  (values || []).forEach(value => {
    const label = replaceInstituteNameLocal(value, oldName, newName);
    const key = label.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    next.push(label);
  });
  return next;
}

function renameInstituteInsideLocalNotices(notices, oldName, newName) {
  return (Array.isArray(notices) ? notices : []).map(item => {
    if (!item) return item;
    const institute = replaceInstituteNameLocal(item.institute, oldName, newName);
    const preserveHistoricalRename = item.kind === "institute_renamed";
    const oldInstitute = preserveHistoricalRename
      ? String(item.oldInstitute || "").trim()
      : replaceInstituteNameLocal(item.oldInstitute, oldName, newName);
    const newInstitute = preserveHistoricalRename
      ? String(item.newInstitute || "").trim()
      : replaceInstituteNameLocal(item.newInstitute, oldName, newName);
    if (
      institute === String(item.institute || "").trim() &&
      oldInstitute === String(item.oldInstitute || "").trim() &&
      newInstitute === String(item.newInstitute || "").trim()
    ) {
      return item;
    }
    return {
      ...item,
      institute,
      oldInstitute,
      newInstitute,
    };
  });
}

export function renameInstituteInsideLocalTeacherData(data, oldName, newName) {
  if (!data) return data;
  const nextClasses = (data.classes || []).map(cls =>
    sameInstituteName(cls?.institute, oldName)
      ? { ...cls, institute: String(newName || "").trim() }
      : cls
  );
  const nextInstitutes = replaceInstituteListLocal(data.institutes, oldName, newName);
  const nextProfileInstitutes = replaceInstituteListLocal(data.profile?.institutes, oldName, newName);
  const nextTrashClasses = (data.trash?.classes || []).map(cls =>
    sameInstituteName(cls?.institute, oldName)
      ? { ...cls, institute: String(newName || "").trim() }
      : cls
  );
  const nextTrashNotes = (data.trash?.notes || []).map(note =>
    sameInstituteName(note?.institute, oldName)
      ? { ...note, institute: String(newName || "").trim() }
      : note
  );
  const nextPendingNotices = renameInstituteInsideLocalNotices(data?._meta?.pendingAdminClassNotices, oldName, newName);
  const legacyNotice = data?._meta?.pendingSectionChangeNotice;
  const nextLegacyItems = renameInstituteInsideLocalNotices(legacyNotice?.items, oldName, newName);

  return {
    ...data,
    classes: nextClasses,
    institutes: nextInstitutes,
    profile: {
      ...(data.profile || {}),
      institutes: nextProfileInstitutes,
    },
    trash: {
      ...(data.trash || {}),
      classes: nextTrashClasses,
      notes: nextTrashNotes,
    },
    _meta: {
      ...(data._meta || {}),
      pendingAdminClassNotices: nextPendingNotices,
      ...(legacyNotice ? {
        pendingSectionChangeNotice: {
          ...legacyNotice,
          items: nextLegacyItems,
        },
      } : {}),
    },
  };
}

export function renameInstituteInsideLocalSectionsMap(instituteSections, oldName, newName) {
  if (!instituteSections) return instituteSections;
  const currentKey = Object.keys(instituteSections).find(name => sameInstituteName(name, oldName));
  const nextKey = String(newName || "").trim();
  if (!currentKey || !nextKey) return instituteSections;
  const nextSections = { ...instituteSections };
  const payload = nextSections[currentKey];
  delete nextSections[currentKey];
  nextSections[nextKey] = payload;
  return nextSections;
}

export function updateInstituteExtraSectionsLocal(instituteSections, instituteName, updater) {
  if (!instituteSections || !instituteName || typeof updater !== "function") return instituteSections;
  const currentKey = getInstituteSectionConfigKey(instituteSections, instituteName) || String(instituteName || "").trim();
  const currentData = instituteSections[currentKey] || {};
  const nextExtraSections = uniqueSectionNames(updater(currentData.extraSections || []));
  return {
    ...instituteSections,
    [currentKey]: {
      ...currentData,
      extraSections: nextExtraSections,
    },
  };
}

export function applyAdminSectionChangeEventsToTeacherData(data, instituteName, sectionChangeEvents){
  const changes = (sectionChangeEvents || [])
    .flatMap(event => Array.isArray(event?.changes) ? event.changes : [])
    .map(change => ({
      oldSection:String(change?.oldSection || "").trim(),
      newSection:String(change?.newSection || "").trim(),
    }))
    .filter(change => change.oldSection && change.newSection && normaliseSectionKey(change.oldSection) !== normaliseSectionKey(change.newSection));
  if(!data || !changes.length) return data;

  let changed = false;
  const resolveSectionLabel = (section, targetInstitute) => {
    if(!sameInstituteName(targetInstitute, instituteName)) return String(section || "").trim();
    let nextSection = String(section || "").trim();
    changes.forEach(change => {
      if(normaliseSectionKey(change.oldSection) === normaliseSectionKey(nextSection)){
        nextSection = change.newSection;
      }
    });
    return nextSection;
  };
  const updateClassLike = (item, sectionField = "section", instituteField = "institute") => {
    if(!item) return item;
    const currentSection = String(item?.[sectionField] || "").trim();
    const nextSection = resolveSectionLabel(currentSection, item?.[instituteField]);
    if(normaliseSectionKey(nextSection) === normaliseSectionKey(currentSection)) return item;
    changed = true;
    return { ...item, [sectionField]: nextSection };
  };
  const nextClasses = (data.classes || []).map(cls => updateClassLike(cls));
  const nextSections = dedupeSectionLabels((data.sections || []).map(section => resolveSectionLabel(section, instituteName)));
  const existingSections = data.sections || [];
  if(
    nextSections.length !== existingSections.length ||
    nextSections.some((section, index) => normaliseSectionKey(section) !== normaliseSectionKey(existingSections[index]))
  ){
    changed = true;
  }
  const nextTrashClasses = (data.trash?.classes || []).map(cls => updateClassLike(cls));
  const nextTrashNotes = (data.trash?.notes || []).map(note => {
    if(!note) return note;
    const currentClassName = String(note.className || "").trim();
    const nextClassName = resolveSectionLabel(currentClassName, note.institute);
    if(normaliseSectionKey(nextClassName) === normaliseSectionKey(currentClassName)) return note;
    changed = true;
    return { ...note, className: nextClassName };
  });
  if(!changed) return data;
  return {
    ...data,
    classes: nextClasses,
    sections: nextSections,
    trash: {
      ...(data.trash || {}),
      classes: nextTrashClasses,
      notes: nextTrashNotes,
    },
  };
}

export function collectLegacySectionRepairItems(fullDataByUid, teachers, instituteName, instituteSections){
  const currentSections = getInstituteSectionNames(getInstituteSectionConfig(instituteSections, instituteName));
  const currentLookup = new Set(currentSections.map(normaliseSectionKey));
  const byLegacySection = new Map();

  (teachers || []).forEach(teacher => {
    const data = fullDataByUid?.[teacher.uid];
    if(!data) return;
    const teacherName = data.profile?.name || teacher.name || "Teacher";
    activeAdminTeacherClasses(data).forEach(cls => {
      if(!sameInstituteName(cls.institute, instituteName)) return;
      const rawSection = String(cls.section || "").trim();
      if(!rawSection) return;
      const rawKey = normaliseSectionKey(rawSection);
      const resolvedSection = String(resolveAdminSectionName(rawSection, cls.institute, instituteSections) || rawSection).trim();
      const resolvedKey = normaliseSectionKey(resolvedSection);
      const suggested =
        resolvedKey && resolvedKey !== rawKey && currentLookup.has(resolvedKey)
          ? resolvedSection
          : findStrongSectionRenameTarget(rawSection, currentSections);
      const shouldInclude = !currentLookup.has(rawKey) || (suggested && normaliseSectionKey(suggested) !== rawKey);
      if(!shouldInclude) return;

      const key = rawKey;
      if(!byLegacySection.has(key)){
        byLegacySection.set(key, {
          oldSection: rawSection,
          teacherNames: new Set(),
          subjects: new Set(),
          classRefs: [],
          suggested: suggested || guessSectionRenameTarget(rawSection, currentSections, currentSections) || "",
        });
      }
      const bucket = byLegacySection.get(key);
      if(!bucket.suggested && suggested){
        bucket.suggested = suggested;
      }
      bucket.teacherNames.add(teacherName);
      if(cls.subject) bucket.subjects.add(String(cls.subject).trim());
      bucket.classRefs.push({
        uid: teacher.uid,
        classId: cls.id,
        rawSection,
        teacherName,
        subject: String(cls.subject || "").trim(),
        institute: cls.institute || instituteName,
      });
    });
  });

  return {
    currentSections,
    items: Array.from(byLegacySection.values())
      .map(item => {
        const teacherNames = Array.from(item.teacherNames).sort(exportTextSorter.compare);
        const subjects = Array.from(item.subjects).sort(exportTextSorter.compare);
        return {
          oldSection: item.oldSection,
          suggested: item.suggested,
          classRefs: item.classRefs,
          teacherNames,
          subjects,
          affectedClassCount: item.classRefs.length,
          affectedTeacherCount: teacherNames.length,
        };
      })
      .sort((a,b)=>exportTextSorter.compare(a.oldSection, b.oldSection)),
  };
}

export function collectAllLegacySectionRepairItems(fullDataByUid, teachers, instituteNames, instituteSections){
  return (instituteNames || []).flatMap(instituteName => {
    const repair = collectLegacySectionRepairItems(fullDataByUid, teachers, instituteName, instituteSections);
    return repair.items.map(item => ({
      ...item,
      institute: instituteName,
      options: repair.currentSections,
      selectionKey: `${instituteName}::${item.oldSection}`,
    }));
  }).sort((a,b)=>
    exportTextSorter.compare(a.institute || "", b.institute || "") ||
    exportTextSorter.compare(a.oldSection || "", b.oldSection || "")
  );
}

export function collectPendingInstituteSections(fullDataByUid, teachers, instituteName, instituteSections){
  const currentSections = getInstituteSectionNames(getInstituteSectionConfig(instituteSections, instituteName));
  const currentLookup = new Set(currentSections.map(normaliseSectionKey));
  const bySection = new Map();

  (teachers || []).forEach(teacher => {
    const data = fullDataByUid?.[teacher.uid];
    if(!data) return;
    const teacherName = data.profile?.name || teacher.name || "Teacher";
    activeAdminTeacherClasses(data).forEach(cls => {
      if(!sameInstituteName(cls.institute, instituteName)) return;
      const rawSection = String(cls.section || "").trim();
      const rawKey = normaliseSectionKey(rawSection);
      if(!rawKey || currentLookup.has(rawKey)) return;
      if(!bySection.has(rawKey)){
        bySection.set(rawKey, {
          section: rawSection,
          teacherNames: new Set(),
          subjects: new Set(),
          classRefs: [],
        });
      }
      const bucket = bySection.get(rawKey);
      bucket.teacherNames.add(teacherName);
      if(cls.subject) bucket.subjects.add(String(cls.subject || "").trim());
      bucket.classRefs.push({
        uid: teacher.uid,
        classId: cls.id,
        section: rawSection,
        teacherName,
        subject: String(cls.subject || "").trim(),
        institute: cls.institute || instituteName,
      });
    });
  });

  return Array.from(bySection.values())
    .map(item => {
      const teacherNames = Array.from(item.teacherNames).sort(exportTextSorter.compare);
      const subjects = Array.from(item.subjects).sort(exportTextSorter.compare);
      return {
        section: item.section,
        teacherNames,
        subjects,
        classRefs: item.classRefs,
        affectedClassCount: item.classRefs.length,
        affectedTeacherCount: teacherNames.length,
      };
    })
    .sort((a,b)=>exportTextSorter.compare(a.section || "", b.section || ""));
}

function mergeEntryDateMaps(existingMap, incomingMap){
  const next = {};
  const keys = new Set([
    ...Object.keys(existingMap || {}),
    ...Object.keys(incomingMap || {}),
  ]);
  keys.forEach(dateKey => {
    const existing = Array.isArray(existingMap?.[dateKey]) ? existingMap[dateKey] : [];
    const incoming = Array.isArray(incomingMap?.[dateKey]) ? incomingMap[dateKey] : [];
    if(!existing.length && !incoming.length) return;
    next[dateKey] = [...existing, ...incoming].sort((a,b)=>
      String(a?.timeStart || "").localeCompare(String(b?.timeStart || "")) ||
      String(a?.timeEnd || "").localeCompare(String(b?.timeEnd || "")) ||
      String(a?.id || "").localeCompare(String(b?.id || ""))
    );
  });
  return next;
}

export function applyInstituteSectionActionsToTeacherData(data, instituteName, actionMap){
  if(!data) return { data, changed:false, removedClassIds:[] };
  const actions = Object.fromEntries(
    Object.entries(actionMap || {})
      .map(([section, action])=>[normaliseSectionKey(section), String(action || "").trim()])
      .filter(([sectionKey, action])=>sectionKey && action)
  );
  if(!Object.keys(actions).length) return { data, changed:false, removedClassIds:[] };

  let changed = false;
  let classes = [...(data.classes || [])];
  const notes = { ...(data.notes || {}) };
  const removedClassIds = [];

  Object.entries(actions).forEach(([oldSectionKey, action]) => {
    const matchingClasses = classes.filter(cls =>
      isActiveAdminTeacherClass(cls) &&
      sameInstituteName(cls.institute, instituteName) &&
      normaliseSectionKey(cls.section) === oldSectionKey
    );
    if(!matchingClasses.length) return;

    if(action === DELETE_SECTION_ACTION){
      matchingClasses.forEach(cls => {
        classes = classes.filter(item => item.id !== cls.id);
        delete notes[cls.id];
        removedClassIds.push(cls.id);
        changed = true;
      });
      return;
    }

    matchingClasses.forEach(cls => {
      const targetSection = action;
      const targetKey = normaliseSectionKey(targetSection);
      const existingTarget = classes.find(other =>
        isActiveAdminTeacherClass(other) &&
        other.id !== cls.id &&
        sameInstituteName(other.institute, cls.institute) &&
        normaliseSectionKey(other.section) === targetKey &&
        normaliseSectionKey(other.subject) === normaliseSectionKey(cls.subject)
      );

      if(existingTarget){
        notes[existingTarget.id] = mergeEntryDateMaps(notes[existingTarget.id] || {}, notes[cls.id] || {});
        delete notes[cls.id];
        classes = classes.filter(item => item.id !== cls.id);
        removedClassIds.push(cls.id);
        changed = true;
        return;
      }

      classes = classes.map(item => item.id === cls.id ? { ...item, section: targetSection } : item);
      changed = true;
    });
  });

  if(!changed) return { data, changed:false, removedClassIds:[] };

  const transformedSections = (data.sections || []).map(section => {
    const action = actions[normaliseSectionKey(section)];
    if(!action) return section;
    if(action === DELETE_SECTION_ACTION) return "";
    return action;
  }).filter(Boolean);
  const derivedSections = classes
    .filter(cls => isActiveAdminTeacherClass(cls) && sameInstituteName(cls?.institute, instituteName))
    .map(cls => String(cls.section || "").trim())
    .filter(Boolean);

  return {
    data: {
      ...data,
      classes,
      notes,
      sections: uniqueSectionNames([...transformedSections, ...derivedSections]),
    },
    changed:true,
    removedClassIds:[...new Set(removedClassIds)],
  };
}
