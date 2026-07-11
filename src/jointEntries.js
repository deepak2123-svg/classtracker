function cleanId(value) {
  return String(value || "").trim();
}

function cleanIds(values = []) {
  const output = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const id = cleanId(value);
    if (id && !output.includes(id)) output.push(id);
  });
  return output;
}

function entryDateInRange(dateKey, startKey = "", endKey = "") {
  const key = String(dateKey || "");
  if (startKey && key < startKey) return false;
  if (endKey && key > endKey) return false;
  return true;
}

export function getJointPrimaryClassId(entry, fallbackClassId = "") {
  return cleanId(entry?.jointPrimaryClassId || entry?.primaryClassId || fallbackClassId);
}

export function getJointSessionId(entry) {
  return cleanId(entry?.jointSessionId || entry?.jointClassSessionId || "");
}

export function getJointClassIds(entry, fallbackClassId = "") {
  const fallback = cleanId(fallbackClassId);
  const ids = cleanIds([
    entry?.jointPrimaryClassId,
    entry?.primaryClassId,
    ...(Array.isArray(entry?.jointClassIds) ? entry.jointClassIds : []),
    ...(Array.isArray(entry?.jointClasses) ? entry.jointClasses.map(item => item?.classId || item?.id) : []),
    ...(Array.isArray(entry?.jointClassesSnapshot) ? entry.jointClassesSnapshot.map(item => item?.classId || item?.id) : []),
  ]);
  if (fallback && !ids.includes(fallback)) ids.unshift(fallback);
  return ids;
}

export function isJointClassEntry(entry) {
  return Boolean(entry?.jointClass || getJointSessionId(entry) || getJointClassIds(entry).length > 1);
}

export function getEntryCoverageClassIds(entry, sourceClassId = "") {
  return isJointClassEntry(entry) ? getJointClassIds(entry, sourceClassId) : cleanIds([sourceClassId]);
}

export function isCanonicalTeachingEntryForSource(entry, sourceClassId = "") {
  if (!isJointClassEntry(entry)) return true;
  const source = cleanId(sourceClassId);
  const primary = getJointPrimaryClassId(entry, source);
  return !primary || !source || source === primary;
}

export function jointSessionDedupKey(entry, sourceClassId = "", dateKey = "", index = 0) {
  const sessionId = getJointSessionId(entry);
  if (sessionId) return `joint:${sessionId}`;
  const id = cleanId(entry?.id || entry?.entryId || "");
  if (isJointClassEntry(entry) && id) return `joint:${id}`;
  return `entry:${cleanId(sourceClassId)}:${String(dateKey || "")}:${id || index}`;
}

export function buildJointClassesSnapshot(classes = []) {
  return (Array.isArray(classes) ? classes : [])
    .map(cls => ({
      classId: cleanId(cls?.id || cls?.classId),
      section: String(cls?.section || cls?.name || "").trim(),
      institute: String(cls?.institute || "").trim(),
      subject: String(cls?.subject || "").trim(),
    }))
    .filter(item => item.classId);
}

export function collectCanonicalTeachingEntryRecords(notes = {}, entryFilter = null, { startKey = "", endKey = "" } = {}) {
  const records = [];
  const seen = new Set();
  Object.entries(notes || {}).forEach(([sourceClassId, classNotes]) => {
    Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
      if (!entryDateInRange(dateKey, startKey, endKey)) return;
      if (!Array.isArray(entries)) return;
      entries.forEach((entry, index) => {
        if (!entry || (entryFilter && !entryFilter(entry))) return;
        const dedupKey = jointSessionDedupKey(entry, sourceClassId, dateKey, index);
        if (isJointClassEntry(entry) && !isCanonicalTeachingEntryForSource(entry, sourceClassId) && seen.has(dedupKey)) return;
        if (seen.has(dedupKey)) return;
        if (isJointClassEntry(entry) && !isCanonicalTeachingEntryForSource(entry, sourceClassId)) return;
        seen.add(dedupKey);
        records.push({
          dateKey,
          entry,
          sourceClassId: cleanId(sourceClassId),
          coverageClassId: getJointPrimaryClassId(entry, sourceClassId) || cleanId(sourceClassId),
          jointSessionId: getJointSessionId(entry),
          isJointCoverage: false,
        });
      });
    });
  });
  return records.sort((a, b) => {
    if ((b.dateKey || "") !== (a.dateKey || "")) return (b.dateKey || "").localeCompare(a.dateKey || "");
    return String(a.entry?.timeStart || "").localeCompare(String(b.entry?.timeStart || ""));
  });
}

export function collectEffectiveTeachingEntryRecords(notes = {}, targetClassId = "", entryFilter = null, { startKey = "", endKey = "" } = {}) {
  const target = cleanId(targetClassId);
  if (!target) return [];
  const records = [];
  const seen = new Set();
  Object.entries(notes || {}).forEach(([sourceClassId, classNotes]) => {
    Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
      if (!entryDateInRange(dateKey, startKey, endKey)) return;
      if (!Array.isArray(entries)) return;
      entries.forEach((entry, index) => {
        if (!entry || (entryFilter && !entryFilter(entry))) return;
        const coverageIds = getEntryCoverageClassIds(entry, sourceClassId);
        if (!coverageIds.includes(target)) return;
        const dedupKey = `${target}:${jointSessionDedupKey(entry, sourceClassId, dateKey, index)}`;
        if (seen.has(dedupKey)) return;
        seen.add(dedupKey);
        records.push({
          dateKey,
          entry,
          sourceClassId: cleanId(sourceClassId),
          coverageClassId: target,
          jointSessionId: getJointSessionId(entry),
          isJointCoverage: cleanId(sourceClassId) !== target,
        });
      });
    });
  });
  return records.sort((a, b) => {
    if ((b.dateKey || "") !== (a.dateKey || "")) return (b.dateKey || "").localeCompare(a.dateKey || "");
    return String(a.entry?.timeStart || "").localeCompare(String(b.entry?.timeStart || ""));
  });
}

export function buildEffectiveClassNotes(notes = {}, targetClassId = "", entryFilter = null, options = {}) {
  return collectEffectiveTeachingEntryRecords(notes, targetClassId, entryFilter, options)
    .reduce((acc, record) => {
      if (!acc[record.dateKey]) acc[record.dateKey] = [];
      acc[record.dateKey].push({
        ...record.entry,
        _jointSourceClassId: record.sourceClassId,
        _jointCoverageClassId: record.coverageClassId,
        _jointCoverage: record.isJointCoverage,
      });
      return acc;
    }, {});
}

export function countCanonicalTeachingEntriesForMonth(notes = {}, entryFilter = null, monthKey = "") {
  return collectCanonicalTeachingEntryRecords(notes, entryFilter, {
    startKey: monthKey ? `${monthKey}-01` : "",
    endKey: monthKey ? `${monthKey}-31` : "",
  }).length;
}

export function lastCanonicalTeachingEntryTs(notes = {}, entryFilter = null) {
  return collectCanonicalTeachingEntryRecords(notes, entryFilter).reduce((latest, record) => {
    const created = Number(record?.entry?.created || record?.entry?.createdAt || 0) || 0;
    return Math.max(latest, created);
  }, 0) || null;
}
