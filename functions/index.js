"use strict";

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

const db = admin.firestore();
const TIME_ZONE = "Asia/Kolkata";
const SUMMARY_SCHEMA_VERSION = 1;

function normaliseText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function summaryKey(value) {
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

function sameInstituteName(a, b) {
  const keyA = summaryKey(a);
  const keyB = summaryKey(b);
  return !!keyA && keyA === keyB;
}

function uniqueLabels(values) {
  const seen = new Set();
  const result = [];
  (values || []).forEach(value => {
    const label = normaliseText(value);
    const key = summaryKey(label);
    if (!label || !key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function dateKeyForTimeZone(date = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseClockMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function entryDurationMinutes(entry) {
  const direct = Number(
    entry?.minutes ??
    entry?.durationMinutes ??
    entry?.durationMins ??
    entry?._dur ??
    entry?.mins
  );
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const start = parseClockMinutes(entry?.timeStart);
  const end = parseClockMinutes(entry?.timeEnd);
  if (start === null || end === null) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0;
}

function comparableEntry(entry) {
  if (!entry || typeof entry !== "object") return entry || null;
  return {
    id: normaliseText(entry.id),
    title: normaliseText(entry.title),
    body: normaliseText(entry.body),
    tag: normaliseText(entry.tag),
    status: normaliseText(entry.status),
    timeStart: normaliseText(entry.timeStart),
    timeEnd: normaliseText(entry.timeEnd),
    created: Number(entry.created || 0) || 0,
    teacherName: normaliseText(entry.teacherName),
    minutes: entryDurationMinutes(entry),
  };
}

function datePayloadDigest(map, dateKey) {
  const entries = Array.isArray(map?.[dateKey]) ? map[dateKey] : [];
  return JSON.stringify(entries.map(comparableEntry));
}

function changedDateKeys(beforeMap, afterMap) {
  const keys = new Set([
    ...Object.keys(beforeMap || {}),
    ...Object.keys(afterMap || {}),
  ].filter(isDateKey));
  return [...keys].filter(dateKey => datePayloadDigest(beforeMap, dateKey) !== datePayloadDigest(afterMap, dateKey));
}

function entriesForDate(map, dateKey) {
  return Array.isArray(map?.[dateKey]) ? map[dateKey].filter(Boolean) : [];
}

function collectEntryInstitutes(map, dateKeys) {
  const institutes = [];
  (dateKeys || []).forEach(dateKey => {
    entriesForDate(map, dateKey).forEach(entry => {
      institutes.push(entry?.institute);
    });
  });
  return uniqueLabels(institutes);
}

function classIdFromNotesDocId(notesDocId) {
  const id = String(notesDocId || "");
  return id.startsWith("notes_") ? id.slice(6) : "";
}

function classIdOf(cls) {
  return normaliseText(cls?.id || cls?.classId || cls?.cid);
}

function classDisplayName(cls) {
  return normaliseText(cls?.section || cls?.name || cls?.className || cls?.title || "Class");
}

function classSubject(cls) {
  return normaliseText(cls?.subject || cls?.subjectName || cls?.course || "");
}

function classesFromMain(main) {
  return Array.isArray(main?.classes) ? main.classes.filter(Boolean) : [];
}

function classFromMain(main, classId) {
  const target = normaliseText(classId);
  if (!target) return null;
  return classesFromMain(main).find(cls => classIdOf(cls) === target) || null;
}

function classInstituteFromMain(main, classId) {
  return normaliseText(classFromMain(main, classId)?.institute);
}

function instituteNamesFromMain(main) {
  return uniqueLabels([
    ...(Array.isArray(main?.institutes) ? main.institutes : []),
    ...(Array.isArray(main?.profile?.institutes) ? main.profile.institutes : []),
    ...classesFromMain(main).map(cls => cls?.institute),
  ]);
}

function instituteNamesFromTeacher(teacher, main) {
  return uniqueLabels([
    ...(Array.isArray(teacher?.institutes) ? teacher.institutes : []),
    ...instituteNamesFromMain(main),
  ]);
}

function teacherBelongsToInstitute(teacher, main, instituteName) {
  return instituteNamesFromTeacher(teacher, main).some(item => sameInstituteName(item, instituteName));
}

function classesForInstitute(main, instituteName) {
  return classesFromMain(main).filter(cls => {
    if (cls?.left || cls?.archived) return false;
    return sameInstituteName(cls?.institute, instituteName);
  });
}

function mainMembershipDigest(main) {
  return JSON.stringify({
    institutes: instituteNamesFromMain(main).map(summaryKey).sort(),
    classes: classesFromMain(main).map(cls => ({
      id: classIdOf(cls),
      institute: summaryKey(cls?.institute),
      section: summaryKey(classDisplayName(cls)),
      subject: summaryKey(classSubject(cls)),
      left: !!cls?.left,
      archived: !!cls?.archived,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
}

function teacherIndexDigest(teacher) {
  return JSON.stringify({
    institutes: uniqueLabels(teacher?.institutes || []).map(summaryKey).sort(),
    classCount: Number(teacher?.classCount || 0) || 0,
    name: normaliseText(teacher?.name),
  });
}

async function readRemovedTeacherIds() {
  const snap = await db.doc("config/removedTeachers").get();
  const ids = Array.isArray(snap.data()?.ids) ? snap.data().ids : [];
  return new Set(ids.map(uid => normaliseText(uid)).filter(Boolean));
}

async function readInstituteConfig() {
  const snap = await db.doc("config/institutes").get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    list: uniqueLabels(Array.isArray(data.list) ? data.list : []),
    deletedList: uniqueLabels(Array.isArray(data.deletedList) ? data.deletedList : []),
  };
}

async function readRoles() {
  const snap = await db.collection("roles").get();
  const roles = new Map();
  snap.docs.forEach(docSnap => {
    roles.set(docSnap.id, normaliseText(docSnap.data()?.role || "teacher") || "teacher");
  });
  return roles;
}

async function readTeacherIndex() {
  const snap = await db.collection("teachers").get();
  const teachers = new Map();
  snap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    teachers.set(docSnap.id, { ...data, uid: normaliseText(data.uid || docSnap.id) });
  });
  return teachers;
}

async function readTeacherMains(uids) {
  const mains = new Map();
  const refs = uids.map(uid => db.doc(`users/${uid}/appdata/main`));
  for (const refsChunk of chunk(refs, 200)) {
    const snaps = await db.getAll(...refsChunk);
    snaps.forEach(snap => {
      const uid = snap.ref.parent.parent?.id;
      if (uid) mains.set(uid, snap.exists ? snap.data() || {} : {});
    });
  }
  return mains;
}

async function readAllUserMains() {
  const mains = new Map();
  try {
    const userRefs = await db.collection("users").listDocuments();
    const refs = userRefs.map(userRef => userRef.collection("appdata").doc("main"));
    for (const refsChunk of chunk(refs, 200)) {
      const snaps = await db.getAll(...refsChunk);
      snaps.forEach(snap => {
        if (!snap.exists) return;
        const uid = snap.ref.parent.parent?.id;
        if (uid) mains.set(uid, snap.data() || {});
      });
    }
  } catch (error) {
    logger.warn("Could not list all user main docs for daily stats", { error });
  }
  return mains;
}

function teacherSummaryFromMain(uid, main) {
  const classes = classesFromMain(main);
  return {
    uid,
    name: normaliseText(main?.profile?.name),
    institutes: instituteNamesFromMain(main),
    subjects: uniqueLabels([
      ...(Array.isArray(main?.profile?.subjects) ? main.profile.subjects : []),
      ...classes.map(classSubject),
    ]),
    classCount: classes.length,
  };
}

async function buildStatsContext() {
  const [removedTeacherIds, roles, teacherIndex, instituteConfig] = await Promise.all([
    readRemovedTeacherIds(),
    readRoles(),
    readTeacherIndex(),
    readInstituteConfig(),
  ]);

  const discoveredMains = await readAllUserMains();
  discoveredMains.forEach((main, uid) => {
    const summary = teacherSummaryFromMain(uid, main);
    if (!teacherIndex.has(uid) && (summary.name || summary.classCount || summary.institutes.length)) {
      teacherIndex.set(uid, summary);
      return;
    }
    if (teacherIndex.has(uid)) {
      const existing = teacherIndex.get(uid) || { uid };
      const existingInstitutes = Array.isArray(existing.institutes) ? existing.institutes : [];
      const existingSubjects = Array.isArray(existing.subjects) ? existing.subjects : [];
      teacherIndex.set(uid, {
        ...existing,
        name: existing.name || summary.name,
        institutes: existingInstitutes.length ? existingInstitutes : summary.institutes,
        subjects: existingSubjects.length ? existingSubjects : summary.subjects,
        classCount: Math.max(Number(existing.classCount || 0) || 0, summary.classCount || 0),
        uid,
      });
    }
  });

  roles.forEach((role, uid) => {
    if (!teacherIndex.has(uid)) {
      teacherIndex.set(uid, { uid, institutes: [], classCount: 0 });
    }
  });

  const uids = [...teacherIndex.keys()].filter(uid => uid && !removedTeacherIds.has(uid));
  const missingMainUids = uids.filter(uid => !discoveredMains.has(uid));
  const targetedMains = await readTeacherMains(missingMainUids);
  const mains = new Map([...discoveredMains, ...targetedMains]);
  const deletedInstituteKeys = new Set(instituteConfig.deletedList.map(summaryKey));

  return {
    removedTeacherIds,
    roles,
    teachers: uids.map(uid => ({ ...(teacherIndex.get(uid) || {}), uid })),
    teachersByUid: teacherIndex,
    mains,
    instituteConfig,
    deletedInstituteKeys,
  };
}

function isActiveTeacher(context, teacher) {
  const uid = normaliseText(teacher?.uid);
  if (!uid || context.removedTeacherIds.has(uid)) return false;
  return (context.roles.get(uid) || "teacher") !== "admin";
}

async function getNoteDocs(noteRefs) {
  if (!noteRefs.length) return [];
  const result = [];
  for (const refsChunk of chunk(noteRefs, 200)) {
    result.push(...await db.getAll(...refsChunk));
  }
  return result;
}

async function rebuildInstituteDateStats(instituteName, dateKey, context = null) {
  const institute = normaliseText(instituteName);
  const key = summaryKey(institute);
  if (!institute || !key || !isDateKey(dateKey)) return null;
  const statsContext = context || await buildStatsContext();
  if (statsContext.deletedInstituteKeys.has(key)) return null;

  let activeTeachers = 0;
  const loggedTeachers = new Set();
  const classKeys = new Set();
  const noteRefs = [];
  const noteMeta = [];

  statsContext.teachers.forEach(teacher => {
    if (!isActiveTeacher(statsContext, teacher)) return;
    const uid = normaliseText(teacher.uid);
    const main = statsContext.mains.get(uid) || {};
    if (!teacherBelongsToInstitute(teacher, main, institute)) return;

    activeTeachers += 1;
    classesForInstitute(main, institute).forEach(cls => {
      const classId = classIdOf(cls);
      const className = classDisplayName(cls);
      const classKey = classId || `${summaryKey(className)}::${summaryKey(classSubject(cls))}`;
      if (classKey) classKeys.add(classKey);
      if (!classId) return;
      noteRefs.push(db.doc(`users/${uid}/appdata/notes_${classId}`));
      noteMeta.push({ uid, classId, className });
    });
  });

  let entriesToday = 0;
  let todayMinutes = 0;
  const noteSnaps = await getNoteDocs(noteRefs);
  noteSnaps.forEach((snap, index) => {
    if (!snap.exists) return;
    const meta = noteMeta[index];
    const entries = entriesForDate(snap.data() || {}, dateKey);
    if (!entries.length) return;
    const validEntries = entries.filter(entry => entry && typeof entry === "object");
    if (!validEntries.length) return;
    loggedTeachers.add(meta.uid);
    entriesToday += validEntries.length;
    todayMinutes += validEntries.reduce((sum, entry) => sum + entryDurationMinutes(entry), 0);
  });

  const loggedToday = loggedTeachers.size;
  const pendingTeachers = Math.max(0, activeTeachers - loggedToday);
  const updatedPct = activeTeachers ? Math.round((loggedToday / activeTeachers) * 100) : 0;
  const generatedAt = Date.now();
  const payload = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    source: "daily-institute-stats-function",
    dateKey,
    institute,
    instituteName: institute,
    instituteKey: key,
    summaryKey: key,
    activeTeachers,
    teachersTotal: activeTeachers,
    totalTeachers: activeTeachers,
    teacherCount: activeTeachers,
    totalTeacherCount: activeTeachers,
    loggedToday,
    updatedToday: loggedToday,
    teachersUpdated: loggedToday,
    updatedTeachers: loggedToday,
    loggedTeachers: loggedToday,
    filledToday: loggedToday,
    pendingTeachers,
    pending: pendingTeachers,
    notUpdatedTeachers: pendingTeachers,
    missingToday: pendingTeachers,
    classCount: classKeys.size,
    classesTotal: classKeys.size,
    totalClasses: classKeys.size,
    todayEntryCount: entriesToday,
    entriesToday,
    entryCount: entriesToday,
    entriesCount: entriesToday,
    todayMinutes,
    minutesToday: todayMinutes,
    totalMinutes: todayMinutes,
    studyMinutes: todayMinutes,
    updatedPct,
    percentUpdated: updatedPct,
    generatedAt,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  const nestedRef = db.doc(`adminDailyInstituteStats/${dateKey}/institutes/${key}`);
  const adminFlatRef = db.doc(`adminDailyInstituteStats/${dateKey}_${key}`);
  const dailyFlatRef = db.doc(`dailyInstituteStats/${dateKey}_${key}`);
  batch.set(db.doc(`adminDailyInstituteStats/${dateKey}`), {
    dateKey,
    source: "daily-institute-stats-function",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(nestedRef, payload);
  batch.set(adminFlatRef, payload);
  batch.set(dailyFlatRef, payload);
  await batch.commit();
  return payload;
}

async function rebuildInstitutesForDate(instituteNames, dateKey, context = null) {
  const labels = uniqueLabels(instituteNames);
  if (!labels.length || !isDateKey(dateKey)) return [];
  const statsContext = context || await buildStatsContext();
  const results = [];
  for (const instituteName of labels) {
    try {
      results.push(await rebuildInstituteDateStats(instituteName, dateKey, statsContext));
    } catch (error) {
      logger.error("daily institute stats rebuild failed", { instituteName, dateKey, error });
    }
  }
  return results.filter(Boolean);
}

async function rebuildAllInstitutesForDate(dateKey) {
  const context = await buildStatsContext();
  const fromConfig = context.instituteConfig.list.filter(name => !context.deletedInstituteKeys.has(summaryKey(name)));
  const fromTeachers = context.teachers.flatMap(teacher => {
    const uid = normaliseText(teacher.uid);
    return instituteNamesFromTeacher(teacher, context.mains.get(uid) || {});
  });
  return rebuildInstitutesForDate([...fromConfig, ...fromTeachers], dateKey, context);
}

exports.refreshDailyInstituteStatsOnNotesWrite = onDocumentWritten(
  "users/{uid}/appdata/{notesDocId}",
  async event => {
    const uid = normaliseText(event.params.uid);
    const notesDocId = normaliseText(event.params.notesDocId);
    const classId = classIdFromNotesDocId(notesDocId);
    if (!uid || !classId) return;

    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    const after = event.data?.after?.exists ? event.data.after.data() || {} : {};
    const dateKeys = changedDateKeys(before, after);
    if (!dateKeys.length) return;

    const context = await buildStatsContext();
    const main = context.mains.get(uid) || {};
    const teacher = context.teachersByUid.get(uid) || { uid };
    const classInstitute = classInstituteFromMain(main, classId);
    const instituteNames = uniqueLabels([
      ...collectEntryInstitutes(before, dateKeys),
      ...collectEntryInstitutes(after, dateKeys),
      classInstitute,
      ...instituteNamesFromTeacher(teacher, main),
    ]);

    for (const dateKey of dateKeys) {
      await rebuildInstitutesForDate(instituteNames, dateKey, context);
    }
  }
);

exports.refreshDailyInstituteStatsOnMainWrite = onDocumentWritten(
  "users/{uid}/appdata/main",
  async event => {
    const uid = normaliseText(event.params.uid);
    if (!uid) return;
    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    const after = event.data?.after?.exists ? event.data.after.data() || {} : {};
    if (mainMembershipDigest(before) === mainMembershipDigest(after)) return;

    const today = dateKeyForTimeZone();
    const context = await buildStatsContext();
    const teacher = context.teachersByUid.get(uid) || { uid };
    const instituteNames = uniqueLabels([
      ...instituteNamesFromMain(before),
      ...instituteNamesFromMain(after),
      ...instituteNamesFromTeacher(teacher, before),
      ...instituteNamesFromTeacher(teacher, after),
    ]);
    await rebuildInstitutesForDate(instituteNames, today, context);
  }
);

exports.refreshDailyInstituteStatsOnTeacherIndexWrite = onDocumentWritten(
  "teachers/{uid}",
  async event => {
    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    const after = event.data?.after?.exists ? event.data.after.data() || {} : {};
    if (teacherIndexDigest(before) === teacherIndexDigest(after)) return;

    const today = dateKeyForTimeZone();
    const context = await buildStatsContext();
    const uid = normaliseText(event.params.uid);
    const main = context.mains.get(uid) || {};
    const instituteNames = uniqueLabels([
      ...instituteNamesFromTeacher(before, main),
      ...instituteNamesFromTeacher(after, main),
    ]);
    await rebuildInstitutesForDate(instituteNames, today, context);
  }
);

exports.refreshDailyInstituteStatsOnRoleWrite = onDocumentWritten(
  "roles/{uid}",
  async event => {
    const beforeRole = normaliseText(event.data?.before?.data()?.role || "teacher") || "teacher";
    const afterRole = normaliseText(event.data?.after?.data()?.role || "teacher") || "teacher";
    if (beforeRole === afterRole) return;

    const today = dateKeyForTimeZone();
    const context = await buildStatsContext();
    const uid = normaliseText(event.params.uid);
    const main = context.mains.get(uid) || {};
    const teacher = context.teachersByUid.get(uid) || { uid };
    await rebuildInstitutesForDate(instituteNamesFromTeacher(teacher, main), today, context);
  }
);

exports.refreshDailyInstituteStatsOnConfigWrite = onDocumentWritten(
  "config/{docId}",
  async event => {
    const docId = normaliseText(event.params.docId);
    if (docId !== "institutes" && docId !== "removedTeachers") return;
    await rebuildAllInstitutesForDate(dateKeyForTimeZone());
  }
);

exports.refreshDailyInstituteStatsDaily = onSchedule(
  { schedule: "5 0 * * *", timeZone: TIME_ZONE },
  async () => {
    const dateKey = dateKeyForTimeZone();
    const results = await rebuildAllInstitutesForDate(dateKey);
    logger.info("daily institute stats rebuilt", { dateKey, count: results.length });
  }
);
