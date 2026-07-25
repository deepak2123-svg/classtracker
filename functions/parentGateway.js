"use strict";

const crypto = require("node:crypto");

function normaliseText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function parentKey(value) {
  const text = normaliseText(value);
  const normalised = typeof text.normalize === "function" ? text.normalize("NFKC") : text;
  return normalised
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .toLowerCase();
}

function sha(value, length = 40) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function parentAccessDocId(sectionId, uid) {
  return `${normaliseText(sectionId)}__${normaliseText(uid)}`;
}

function isSyllabusProgressEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const title = normaliseText(entry.title);
  const notes = normaliseText(entry.body || entry.notes);
  const hasMarker = Boolean(
    entry.syllabusTemplateId ||
    entry.syllabusId ||
    entry.syllabusChapterId ||
    entry.syllabusChapterTitle ||
    entry.chapterTitle ||
    entry.syllabusChapterCompleted ||
    (Array.isArray(entry.completedSyllabusChapterIds) && entry.completedSyllabusChapterIds.length) ||
    (Array.isArray(entry.coveredSyllabusChapterIds) && entry.coveredSyllabusChapterIds.length) ||
    (Array.isArray(entry.completedSyllabusTopicIds) && entry.completedSyllabusTopicIds.length)
  );
  if (!hasMarker) return false;
  return (
    entry.syllabusChapterCompleted === true ||
    /^completed\s+/i.test(title) ||
    /syllabus progress update/i.test(title) ||
    /^gs syllabus$/i.test(notes) ||
    /syllabus/i.test(notes)
  );
}

function isTeachingActivityEntry(entry) {
  return Boolean(entry && typeof entry === "object" && !isSyllabusProgressEntry(entry));
}

function jointSessionIdentity(entry) {
  if (!entry || typeof entry !== "object") return "";
  const sessionId = normaliseText(entry.jointSessionId || entry.jointClassSessionId);
  if (sessionId) return sessionId;
  const jointClassIds = [
    ...(Array.isArray(entry.jointClassIds) ? entry.jointClassIds : []),
    ...(Array.isArray(entry.jointClasses) ? entry.jointClasses.map(item => item?.classId || item?.id) : []),
    ...(Array.isArray(entry.jointClassesSnapshot) ? entry.jointClassesSnapshot.map(item => item?.classId || item?.id) : []),
  ].map(normaliseText).filter(Boolean);
  const isJoint = Boolean(
    entry.jointClass
    || entry.jointPrimaryClassId
    || entry.primaryClassId
    || jointClassIds.length > 1
  );
  return isJoint ? normaliseText(entry.id || entry.entryId) : "";
}

function projectParentFeedEntries({
  entries,
  sectionId,
  teacherUid,
  classId,
  dateKey,
  subject,
  teacherDisplayName,
}) {
  const sourceHash = sha(`${teacherUid}|${classId}|${dateKey}`);
  const projected = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    if (!isTeachingActivityEntry(entry)) return;
    const title = normaliseText(entry.title);
    const body = normaliseText(entry.body);
    if (!title && !body) return;
    const jointSessionId = jointSessionIdentity(entry);
    const entryIdentity = normaliseText(entry.id) || `${index}|${title}|${body}`;
    const canonical = jointSessionId
      ? `joint|${sectionId}|${teacherUid}|${dateKey}|${jointSessionId}`
      : `entry|${sectionId}|${sourceHash}|${entryIdentity}`;
    const id = sha(canonical);
    projected.set(id, {
      id,
      dateKey:normaliseText(dateKey),
      title,
      body,
      subject:normaliseText(subject) || "Class update",
      teacherDisplayName:normaliseText(teacherDisplayName || entry.teacherName) || "Teacher",
      sortAt:Number(entry.created || entry.updatedAt || 0) || index,
      sourceHash,
      sourceHashes:[sourceHash],
      jointSessionKey:jointSessionId ? sha(`${teacherUid}|${dateKey}|${jointSessionId}`, 24) : "",
    });
  });
  return projected;
}

function planParentFeedMutations(beforeMap, afterMap) {
  const previous = beforeMap instanceof Map ? beforeMap : new Map();
  const next = afterMap instanceof Map ? afterMap : new Map();
  return {
    remove:[...previous.keys()].filter(id => !next.has(id)),
    upsert:[...next.keys()],
  };
}

module.exports = {
  isSyllabusProgressEntry,
  isTeachingActivityEntry,
  jointSessionIdentity,
  normaliseText,
  parentAccessDocId,
  parentKey,
  planParentFeedMutations,
  projectParentFeedEntries,
  sha,
};
