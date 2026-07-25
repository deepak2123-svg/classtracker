"use strict";

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("node:crypto");
const {
  normaliseText: normaliseParentText,
  parentAccessDocId,
  parentKey,
  planParentFeedMutations,
  projectParentFeedEntries,
} = require("./parentGateway");

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
    jointClass: Boolean(entry.jointClass),
    jointSessionId: normaliseText(entry.jointSessionId || entry.jointClassSessionId),
    jointPrimaryClassId: normaliseText(entry.jointPrimaryClassId || entry.primaryClassId),
    jointClassIds: Array.isArray(entry.jointClassIds) ? entry.jointClassIds.map(normaliseText) : [],
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

function isActiveClassRecord(cls) {
  if (!cls || typeof cls !== "object") return false;
  if (cls.left || cls.archived || cls.archivedByAdmin || cls.transferArchive) return false;
  const deletedAt = Number(cls.deletedAt || 0) || 0;
  return deletedAt <= 0;
}

function activeClassesFromMain(main) {
  return classesFromMain(main).filter(isActiveClassRecord);
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

function activeInstituteNamesFromTeacher(teacher, main) {
  const classes = classesFromMain(main);
  const activeClassInstitutes = uniqueLabels(activeClassesFromMain(main).map(cls => cls?.institute));
  if (classes.length) return activeClassInstitutes;
  return uniqueLabels([
    ...(Array.isArray(teacher?.institutes) ? teacher.institutes : []),
    ...(Array.isArray(main?.institutes) ? main.institutes : []),
    ...(Array.isArray(main?.profile?.institutes) ? main.profile.institutes : []),
  ]);
}

function teacherActivelyBelongsToInstitute(teacher, main, instituteName) {
  return activeInstituteNamesFromTeacher(teacher, main).some(item => sameInstituteName(item, instituteName));
}

function classesForInstitute(main, instituteName) {
  return activeClassesFromMain(main).filter(cls => {
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

async function readRoleDetails() {
  const snap = await db.collection("roles").get();
  const roles = new Map();
  snap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const role = normaliseText(data.role || "teacher") || "teacher";
    roles.set(docSnap.id, {
      ...data,
      role,
      adminMode: normaliseText(data.adminMode || data.mode || ""),
      teaches: data.teaches === true || data.isTeacher === true,
    });
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
  const classes = activeClassesFromMain(main);
  const classInstitutes = uniqueLabels(classes.map(cls => cls?.institute));
  const profileInstitutes = uniqueLabels([
    ...(Array.isArray(main?.institutes) ? main.institutes : []),
    ...(Array.isArray(main?.profile?.institutes) ? main.profile.institutes : []),
  ]);
  const classSubjects = uniqueLabels(classes.map(classSubject));
  const profileSubjects = uniqueLabels(Array.isArray(main?.profile?.subjects) ? main.profile.subjects : []);
  return {
    uid,
    name: normaliseText(main?.profile?.name),
    institutes: classInstitutes.length ? classInstitutes : profileInstitutes,
    subjects: classSubjects.length ? classSubjects : profileSubjects,
    classCount: classes.length,
  };
}

async function buildStatsContext() {
  const [removedTeacherIds, roleDetails, teacherIndex, instituteConfig] = await Promise.all([
    readRemovedTeacherIds(),
    readRoleDetails(),
    readTeacherIndex(),
    readInstituteConfig(),
  ]);
  const roles = new Map([...roleDetails.entries()].map(([uid, roleData]) => [uid, roleData.role || "teacher"]));

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
      const hasActiveClasses = (Number(summary.classCount || 0) || 0) > 0;
      teacherIndex.set(uid, {
        ...existing,
        name: existing.name || summary.name,
        institutes: hasActiveClasses ? summary.institutes : (existingInstitutes.length ? existingInstitutes : summary.institutes),
        subjects: hasActiveClasses ? summary.subjects : (existingSubjects.length ? existingSubjects : summary.subjects),
        classCount: hasActiveClasses ? summary.classCount : Math.max(Number(existing.classCount || 0) || 0, summary.classCount || 0),
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
    roleDetails,
    teachers: uids.map(uid => ({ ...(teacherIndex.get(uid) || {}), uid })),
    teachersByUid: teacherIndex,
    mains,
    instituteConfig,
    deletedInstituteKeys,
  };
}

function isAdminTeacherStatsAccount(context, uid) {
  const roleData = context.roleDetails?.get?.(normaliseText(uid));
  if (!roleData || roleData.role !== "admin") return false;
  return roleData.teaches === true || roleData.adminMode === "admin_teacher" || roleData.adminMode === "admin+teacher";
}

function isCountedTeacherStatsAccount(context, uid) {
  const safeUid = normaliseText(uid);
  if (!safeUid || context.removedTeacherIds.has(safeUid)) return false;
  const role = context.roles.get(safeUid) || "teacher";
  if (role !== "admin") return true;
  return isAdminTeacherStatsAccount(context, safeUid);
}

function isActiveTeacher(context, teacher) {
  const uid = normaliseText(teacher?.uid);
  return isCountedTeacherStatsAccount(context, uid);
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
    const uid = normaliseText(teacher.uid);
    if (!isCountedTeacherStatsAccount(statsContext, uid)) return;
    const main = statsContext.mains.get(uid) || {};
    if (!teacherActivelyBelongsToInstitute(teacher, main, institute)) return;

    activeTeachers += 1;
    classesForInstitute(main, institute).forEach(cls => {
      const classId = classIdOf(cls);
      const className = classDisplayName(cls);
      const classKey = classId || `${summaryKey(className)}::${summaryKey(classSubject(cls))}`;
      if (classKey) classKeys.add(classKey);
      if (!classId) return;
      noteRefs.push(db.doc(`users/${uid}/appdata/notes_${classId}`));
      noteMeta.push({ uid, classId, className, classKey });
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
    const roleDigest = data => {
      const roleData = data || {};
      return JSON.stringify({
        role: normaliseText(roleData.role || "teacher") || "teacher",
        adminMode: normaliseText(roleData.adminMode || roleData.mode || ""),
        teaches: roleData.teaches === true || roleData.isTeacher === true,
      });
    };
    const beforeDigest = roleDigest(event.data?.before?.data() || {});
    const afterDigest = roleDigest(event.data?.after?.data() || {});
    if (beforeDigest === afterDigest) return;

    const today = dateKeyForTimeZone();
    const context = await buildStatsContext();
    const uid = normaliseText(event.params.uid);
    const main = context.mains.get(uid) || {};
    const teacher = context.teachersByUid.get(uid) || { uid };
    await rebuildInstitutesForDate(activeInstituteNamesFromTeacher(teacher, main), today, context);
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

// ── Parent gateway ───────────────────────────────────────────────────────────
const PARENT_CALLABLE_OPTIONS = { timeoutSeconds: 120, memory: "512MiB" };

function requireParentCallableUser(request) {
  const uid = normaliseParentText(request.auth?.uid);
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return {
    uid,
    email:normaliseParentText(request.auth?.token?.email),
    displayName:normaliseParentText(request.auth?.token?.name),
  };
}

async function parentActorRole(uid) {
  const snap = await db.doc(`roles/${uid}`).get();
  return snap.exists ? snap.data() || {} : { role:"teacher" };
}

function parentActorCanManageInstitute(role, institute) {
  if (!role || !institute) return false;
  if (role.role === "manager" || role.role === "admin") return true;
  if (role.role === "group_admin") return role.groupId && role.groupId === institute.groupId;
  return role.role === "institute_admin"
    && role.groupId === institute.groupId
    && role.instituteId === institute.id;
}

async function requireParentInstituteAdmin(uid, institute) {
  const role = await parentActorRole(uid);
  if (!parentActorCanManageInstitute(role, institute)) {
    throw new HttpsError("permission-denied", "You cannot manage Parent View for this institute.");
  }
  return role;
}

async function findParentInstituteByName(instituteName) {
  const name = normaliseParentText(instituteName);
  if (!name) throw new HttpsError("invalid-argument", "Choose an institute.");
  let snap = await db.collection("institutes").where("nameKey", "==", parentKey(name)).limit(10).get();
  if (snap.empty) {
    snap = await db.collection("institutes").get();
  }
  const candidates = snap.docs
    .map(item => ({ id:item.id, ...item.data() }))
    .filter(item => sameInstituteName(item.name, name));
  if (!candidates.length) {
    throw new HttpsError("failed-precondition", "This institute is not mapped to the tenant architecture yet.");
  }
  return candidates;
}

async function resolveManagedParentInstitute(uid, instituteName) {
  const candidates = await findParentInstituteByName(instituteName);
  const role = await parentActorRole(uid);
  const institute = candidates.find(item => parentActorCanManageInstitute(role, item));
  if (!institute) {
    throw new HttpsError("permission-denied", "You cannot manage Parent View for this institute.");
  }
  return { institute, role };
}

async function getParentPortalSection(sectionId) {
  const id = normaliseParentText(sectionId);
  if (!id) throw new HttpsError("invalid-argument", "Choose a section.");
  const snap = await db.doc(`parentPortalSections/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "This Parent View section no longer exists.");
  return { id:snap.id, ...snap.data() };
}

async function findParentPortalSection(instituteId, sectionName) {
  const key = parentKey(sectionName);
  if (!instituteId || !key) return null;
  const snap = await db.collection("parentPortalSections")
    .where("instituteId", "==", instituteId)
    .get();
  const match = snap.docs.find(item => {
    const data = item.data() || {};
    return data.status !== "archived"
      && (parentKey(data.sectionName) === key || data.sectionKey === key);
  });
  return match ? { id:match.id, ...match.data() } : null;
}

async function ensureParentPortalSection(institute, sectionName, actorUid) {
  const label = normaliseParentText(sectionName);
  if (!label) throw new HttpsError("invalid-argument", "Choose a section.");
  const existing = await findParentPortalSection(institute.id, label);
  if (existing) {
    await db.doc(`parentPortalSections/${existing.id}`).set({
      sectionName:label,
      sectionKey:parentKey(label),
      instituteName:institute.name,
      groupId:institute.groupId,
      updatedAt:FieldValue.serverTimestamp(),
    }, { merge:true });
    return { ...existing, sectionName:label, sectionKey:parentKey(label), instituteName:institute.name };
  }
  const ref = db.collection("parentPortalSections").doc();
  const payload = {
    groupId:institute.groupId,
    instituteId:institute.id,
    instituteName:institute.name,
    sectionName:label,
    sectionKey:parentKey(label),
    status:"active",
    enrollmentStatus:"closed",
    activeInviteToken:"",
    inviteGeneration:0,
    createdBy:actorUid,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  const created = await ref.get();
  return { id:created.id, ...created.data() };
}

function cleanParentName(value, label) {
  const clean = normaliseParentText(value);
  if (clean.length < 2 || clean.length > 80) {
    throw new HttpsError("invalid-argument", `${label} must be between 2 and 80 characters.`);
  }
  return clean;
}

function cleanParentChildren(children) {
  if (!Array.isArray(children) || !children.length || children.length > 12) {
    throw new HttpsError("invalid-argument", "Keep at least one student name on this access.");
  }
  const seen = new Set();
  return children.map((item, index) => {
    const name = cleanParentName(item?.name, "Student name");
    const key = parentKey(name);
    if (seen.has(key)) throw new HttpsError("invalid-argument", "Student names must be unique in a section.");
    seen.add(key);
    return {
      id:normaliseParentText(item?.id) || crypto.randomBytes(8).toString("hex"),
      name,
      joinedAt:Number(item?.joinedAt || 0) || Date.now(),
    };
  });
}

async function parentSectionInvitePayload(section, actorUid) {
  const token = crypto.randomBytes(24).toString("base64url");
  const generation = Math.max(0, Number(section.inviteGeneration || 0)) + 1;
  const invite = {
    sectionId:section.id,
    groupId:section.groupId,
    instituteId:section.instituteId,
    instituteName:section.instituteName,
    sectionName:section.sectionName,
    status:"active",
    generation,
    createdBy:actorUid,
    createdAt:FieldValue.serverTimestamp(),
    redemptionCount:0,
  };
  const batch = db.batch();
  if (section.activeInviteToken) {
    batch.set(db.doc(`parentSectionInvites/${section.activeInviteToken}`), {
      status:"revoked",
      revokedBy:actorUid,
      revokedAt:FieldValue.serverTimestamp(),
    }, { merge:true });
  }
  batch.set(db.doc(`parentSectionInvites/${token}`), invite);
  batch.set(db.doc(`parentPortalSections/${section.id}`), {
    status:"active",
    enrollmentStatus:"open",
    activeInviteToken:token,
    inviteGeneration:generation,
    updatedAt:FieldValue.serverTimestamp(),
  }, { merge:true });
  await batch.commit();
  return { token, generation };
}

function parentTeacherName(teacher, main, entry = null) {
  return normaliseParentText(
    teacher?.name ||
    main?.profile?.name ||
    entry?.teacherName ||
    teacher?.email
  ) || "Teacher";
}

function parentClassSubject(teacher, main, cls) {
  const explicit = normaliseParentText(cls?.subject);
  const names = uniqueLabels([
    ...(Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects.map(item => item?.name) : []),
    ...(Array.isArray(teacher?.subjects) ? teacher.subjects : []),
    ...(Array.isArray(main?.profile?.subjects) ? main.profile.subjects : []),
  ]);
  if (explicit) {
    return names.find(name => parentKey(name) === parentKey(explicit)) || explicit;
  }
  return names.length === 1 ? names[0] : "Class update";
}

function parentSafeFeedPayload(data = {}) {
  return {
    dateKey:normaliseParentText(data.dateKey),
    title:normaliseParentText(data.title),
    body:normaliseParentText(data.body),
    subject:normaliseParentText(data.subject) || "Class update",
    teacherDisplayName:normaliseParentText(data.teacherDisplayName) || "Teacher",
    sortAt:Number(data.sortAt || 0) || 0,
    updatedAt:FieldValue.serverTimestamp(),
  };
}

async function commitParentFeedOperations(operations) {
  for (const operationChunk of chunk(operations, 400)) {
    const batch = db.batch();
    operationChunk.forEach(operation => {
      if (operation.kind === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, { merge:true });
    });
    await batch.commit();
  }
}

async function fanoutParentFeedEntries(section, entryIds) {
  const ids = [...new Set(entryIds || [])].filter(Boolean);
  if (!ids.length) return;
  const sharedRefs = ids.map(id => db.doc(`parentSectionFeeds/${section.id}/entries/${id}`));
  const [sharedSnaps, accessSnap] = await Promise.all([
    db.getAll(...sharedRefs),
    db.collection("parentSectionAccess").where("sectionId", "==", section.id).get(),
  ]);
  const activeAccesses = accessSnap.docs
    .map(item => ({ id:item.id, ...item.data() }))
    .filter(item => item.status === "active");
  if (!activeAccesses.length) return;

  const operations = [];
  sharedSnaps.forEach((sharedSnap, index) => {
    const entryId = ids[index];
    const shared = sharedSnap.exists ? sharedSnap.data() || {} : null;
    activeAccesses.forEach(access => {
      const targetRef = db.doc(`parentAccessFeeds/${access.id}/entries/${entryId}`);
      if (!shared || normaliseParentText(shared.dateKey) < normaliseParentText(access.joinedDateKey)) {
        operations.push({ kind:"delete", ref:targetRef });
      } else {
        operations.push({ kind:"set", ref:targetRef, data:parentSafeFeedPayload(shared) });
      }
    });
  });
  await commitParentFeedOperations(operations);
}

async function copyParentAccessFeedFromDate({ accessId, sectionId, joinedDateKey }) {
  const sharedSnap = await db.collection(`parentSectionFeeds/${sectionId}/entries`)
    .where("dateKey", ">=", joinedDateKey)
    .get();
  const operations = sharedSnap.docs.map(item => ({
    kind:"set",
    ref:db.doc(`parentAccessFeeds/${accessId}/entries/${item.id}`),
    data:parentSafeFeedPayload(item.data() || {}),
  }));
  await commitParentFeedOperations(operations);
}

async function syncParentFeedSource({ section, uid, cls, teacher, main, dateKey, beforeEntries = [], afterEntries = [] }) {
  const base = {
    sectionId:section.id,
    teacherUid:uid,
    classId:classIdOf(cls),
    dateKey,
    subject:parentClassSubject(teacher, main, cls),
    teacherDisplayName:parentTeacherName(teacher, main, afterEntries[0] || beforeEntries[0]),
  };
  const beforeMap = projectParentFeedEntries({ ...base, entries:beforeEntries });
  const afterMap = projectParentFeedEntries({ ...base, entries:afterEntries });
  const mutationPlan = planParentFeedMutations(beforeMap, afterMap);
  const entriesRef = db.collection(`parentSectionFeeds/${section.id}/entries`);

  for (const id of mutationPlan.remove) {
    const previous = beforeMap.get(id);
    const ref = entriesRef.doc(id);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const sourceHashes = Array.isArray(snap.data()?.sourceHashes) ? snap.data().sourceHashes : [];
      const remaining = sourceHashes.filter(value => value !== previous.sourceHash);
      if (!remaining.length) tx.delete(ref);
      else tx.update(ref, { sourceHashes:remaining, updatedAt:FieldValue.serverTimestamp() });
    });
  }

  for (const id of mutationPlan.upsert) {
    const projected = afterMap.get(id);
    const ref = entriesRef.doc(id);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const existingSources = Array.isArray(snap.data()?.sourceHashes) ? snap.data().sourceHashes : [];
      tx.set(ref, {
        dateKey:projected.dateKey,
        title:projected.title,
        body:projected.body,
        subject:projected.subject,
        teacherDisplayName:projected.teacherDisplayName,
        sortAt:projected.sortAt,
        sourceHash:projected.sourceHash,
        sourceHashes:uniqueLabels([...existingSources, projected.sourceHash]),
        jointSessionKey:projected.jointSessionKey,
        updatedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
    });
  }
  await fanoutParentFeedEntries(section, [...beforeMap.keys(), ...afterMap.keys()]);
}

async function parentInstituteForTeacherClass(uid, cls) {
  const explicitId = normaliseParentText(cls?.instituteId);
  if (explicitId) {
    const snap = await db.doc(`institutes/${explicitId}`).get();
    if (snap.exists) return { id:snap.id, ...snap.data() };
  }
  const name = normaliseParentText(cls?.institute);
  if (!name) return null;
  const candidates = await findParentInstituteByName(name).catch(() => []);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const role = await parentActorRole(uid);
  const instituteIds = new Set(Array.isArray(role.instituteIds) ? role.instituteIds : []);
  return candidates.find(item => instituteIds.has(item.id))
    || candidates.find(item => role.groupId && role.groupId === item.groupId)
    || null;
}

async function activeParentSectionForClass(uid, cls) {
  const institute = await parentInstituteForTeacherClass(uid, cls);
  if (!institute) return null;
  const section = await findParentPortalSection(institute.id, classDisplayName(cls));
  return section?.status === "active" ? section : null;
}

async function backfillParentSectionToday(section) {
  const dateKey = dateKeyForTimeZone();
  const teachersSnap = await db.collection("teachers").get();
  let sourceCount = 0;
  for (const teacherSnap of teachersSnap.docs) {
    const uid = teacherSnap.id;
    const teacher = { uid, ...teacherSnap.data() };
    const belongs = (Array.isArray(teacher.instituteIds) && teacher.instituteIds.includes(section.instituteId))
      || (Array.isArray(teacher.institutes) && teacher.institutes.some(name => sameInstituteName(name, section.instituteName)));
    if (!belongs) continue;
    const mainSnap = await db.doc(`users/${uid}/appdata/main`).get();
    if (!mainSnap.exists) continue;
    const main = mainSnap.data() || {};
    const classes = activeClassesFromMain(main).filter(cls =>
      sameInstituteName(cls.institute, section.instituteName)
      && parentKey(classDisplayName(cls)) === section.sectionKey
    );
    for (const cls of classes) {
      const classId = classIdOf(cls);
      if (!classId) continue;
      const notesSnap = await db.doc(`users/${uid}/appdata/notes_${classId}`).get();
      const entries = entriesForDate(notesSnap.data() || {}, dateKey);
      await syncParentFeedSource({ section, uid, cls, teacher, main, dateKey, afterEntries:entries });
      sourceCount += 1;
    }
  }
  logger.info("parent section current-day backfill complete", {
    sectionId:section.id,
    dateKey,
    sourceCount,
  });
  return sourceCount;
}

async function serialiseParentSectionAdminState(section) {
  if (!section) return { enabled:false, section:null, inviteToken:"", accesses:[] };
  const accessSnap = await db.collection("parentSectionAccess").where("sectionId", "==", section.id).get();
  let inviteToken = "";
  if (section.activeInviteToken) {
    const inviteSnap = await db.doc(`parentSectionInvites/${section.activeInviteToken}`).get();
    if (inviteSnap.exists && inviteSnap.data()?.status === "active") inviteToken = inviteSnap.id;
  }
  const accesses = accessSnap.docs
    .map(item => ({ id:item.id, ...item.data() }))
    .sort((a, b) => normaliseParentText(a.parentName).localeCompare(normaliseParentText(b.parentName)));
  return {
    enabled:true,
    section,
    inviteToken,
    enrollmentStatus:inviteToken && section.enrollmentStatus === "open" ? "open" : "closed",
    accesses,
  };
}

exports.enableParentSectionPortal = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  const instituteName = normaliseParentText(request.data?.instituteName);
  const sectionName = normaliseParentText(request.data?.sectionName);
  const { institute } = await resolveManagedParentInstitute(actor.uid, instituteName);
  let section = await ensureParentPortalSection(institute, sectionName, actor.uid);
  let token = "";
  if (section.activeInviteToken && section.enrollmentStatus === "open") {
    const inviteSnap = await db.doc(`parentSectionInvites/${section.activeInviteToken}`).get();
    if (inviteSnap.exists && inviteSnap.data()?.status === "active") token = inviteSnap.id;
  }
  if (!token) {
    const created = await parentSectionInvitePayload(section, actor.uid);
    token = created.token;
    section = { ...section, activeInviteToken:token, enrollmentStatus:"open", inviteGeneration:created.generation };
  }
  await backfillParentSectionToday(section);
  return { ...(await serialiseParentSectionAdminState(section)), inviteToken:token };
});

exports.getParentSectionAdminState = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  let section = null;
  if (normaliseParentText(request.data?.sectionId)) {
    section = await getParentPortalSection(request.data.sectionId);
    const instituteSnap = await db.doc(`institutes/${section.instituteId}`).get();
    if (!instituteSnap.exists) throw new HttpsError("failed-precondition", "The section institute no longer exists.");
    await requireParentInstituteAdmin(actor.uid, { id:instituteSnap.id, ...instituteSnap.data() });
  } else {
    const { institute } = await resolveManagedParentInstitute(actor.uid, request.data?.instituteName);
    await requireParentInstituteAdmin(actor.uid, institute);
    section = await findParentPortalSection(institute.id, request.data?.sectionName);
  }
  return serialiseParentSectionAdminState(section);
});

exports.rotateParentSectionInvite = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  const section = await getParentPortalSection(request.data?.sectionId);
  const instituteSnap = await db.doc(`institutes/${section.instituteId}`).get();
  if (!instituteSnap.exists) throw new HttpsError("failed-precondition", "The section institute no longer exists.");
  await requireParentInstituteAdmin(actor.uid, { id:instituteSnap.id, ...instituteSnap.data() });
  const created = await parentSectionInvitePayload(section, actor.uid);
  return { ...(await serialiseParentSectionAdminState({
    ...section,
    activeInviteToken:created.token,
    enrollmentStatus:"open",
    inviteGeneration:created.generation,
  })), inviteToken:created.token };
});

exports.closeParentSectionEnrollment = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  const section = await getParentPortalSection(request.data?.sectionId);
  const instituteSnap = await db.doc(`institutes/${section.instituteId}`).get();
  if (!instituteSnap.exists) throw new HttpsError("failed-precondition", "The section institute no longer exists.");
  await requireParentInstituteAdmin(actor.uid, { id:instituteSnap.id, ...instituteSnap.data() });
  const batch = db.batch();
  if (section.activeInviteToken) {
    batch.set(db.doc(`parentSectionInvites/${section.activeInviteToken}`), {
      status:"revoked",
      revokedBy:actor.uid,
      revokedAt:FieldValue.serverTimestamp(),
    }, { merge:true });
  }
  batch.set(db.doc(`parentPortalSections/${section.id}`), {
    enrollmentStatus:"closed",
    activeInviteToken:"",
    updatedAt:FieldValue.serverTimestamp(),
  }, { merge:true });
  await batch.commit();
  return serialiseParentSectionAdminState({ ...section, enrollmentStatus:"closed", activeInviteToken:"" });
});

exports.archiveParentSectionPortal = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  const section = await getParentPortalSection(request.data?.sectionId);
  const instituteSnap = await db.doc(`institutes/${section.instituteId}`).get();
  if (!instituteSnap.exists) throw new HttpsError("failed-precondition", "The section institute no longer exists.");
  await requireParentInstituteAdmin(actor.uid, { id:instituteSnap.id, ...instituteSnap.data() });
  const accessSnap = await db.collection("parentSectionAccess").where("sectionId", "==", section.id).get();
  const operations = [
    {
      kind:"set",
      ref:db.doc(`parentPortalSections/${section.id}`),
      data:{
        status:"archived",
        enrollmentStatus:"closed",
        activeInviteToken:"",
        archivedBy:actor.uid,
        archivedAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp(),
      },
    },
    ...accessSnap.docs.map(item => ({
      kind:"set",
      ref:item.ref,
      data:{
        status:"revoked",
        revokedReason:"academic_year_closed",
        revokedBy:actor.uid,
        revokedAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp(),
      },
    })),
  ];
  if (section.activeInviteToken) {
    operations.push({
      kind:"set",
      ref:db.doc(`parentSectionInvites/${section.activeInviteToken}`),
      data:{
        status:"revoked",
        revokedBy:actor.uid,
        revokedAt:FieldValue.serverTimestamp(),
      },
    });
  }
  await commitParentFeedOperations(operations);
  return { enabled:false, section:null, inviteToken:"", enrollmentStatus:"closed", accesses:[], archived:true };
});

exports.redeemParentSectionInvite = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const parent = requireParentCallableUser(request);
  const token = normaliseParentText(request.data?.token);
  if (!token) throw new HttpsError("invalid-argument", "This invitation link is incomplete.");
  const parentName = cleanParentName(request.data?.parentName || parent.displayName, "Parent name");
  const studentName = cleanParentName(request.data?.studentName, "Student name");
  const inviteRef = db.doc(`parentSectionInvites/${token}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists || inviteSnap.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "This invitation has been closed or replaced.");
  }
  const invite = inviteSnap.data() || {};
  const section = await getParentPortalSection(invite.sectionId);
  if (section.status !== "active" || section.enrollmentStatus !== "open" || section.activeInviteToken !== token) {
    throw new HttpsError("failed-precondition", "This invitation has been closed or replaced.");
  }
  const sectionRef = db.doc(`parentPortalSections/${section.id}`);
  const accessId = parentAccessDocId(section.id, parent.uid);
  const accessRef = db.doc(`parentSectionAccess/${accessId}`);
  const profileRef = db.doc(`parentProfiles/${parent.uid}`);
  const now = Date.now();
  const joinedDateKey = dateKeyForTimeZone();
  let resultChildren = [];
  let resultJoinedDateKey = joinedDateKey;
  let redeemedSection = section;
  await db.runTransaction(async tx => {
    const currentInviteSnap = await tx.get(inviteRef);
    const currentSectionSnap = await tx.get(sectionRef);
    const accessSnap = await tx.get(accessRef);
    const profileSnap = await tx.get(profileRef);
    const currentInvite = currentInviteSnap.exists ? currentInviteSnap.data() || {} : {};
    const currentSection = currentSectionSnap.exists ? currentSectionSnap.data() || {} : {};
    if (
      !currentInviteSnap.exists
      || currentInvite.status !== "active"
      || !currentSectionSnap.exists
      || currentSection.status !== "active"
      || currentSection.enrollmentStatus !== "open"
      || currentSection.activeInviteToken !== token
      || currentInvite.sectionId !== section.id
    ) {
      throw new HttpsError("failed-precondition", "This invitation has been closed or replaced.");
    }
    redeemedSection = { id:section.id, ...currentSection };
    const existing = accessSnap.exists ? accessSnap.data() || {} : {};
    resultJoinedDateKey = existing.joinedDateKey || joinedDateKey;
    if (accessSnap.exists && existing.status === "revoked") {
      throw new HttpsError("permission-denied", "This account’s class access was revoked. Contact the institute administrator.");
    }
    const children = Array.isArray(existing.children) ? existing.children : [];
    const alreadyExists = children.some(item => parentKey(item?.name) === parentKey(studentName));
    resultChildren = alreadyExists ? children : [...children, {
      id:crypto.randomBytes(8).toString("hex"),
      name:studentName,
      joinedAt:now,
    }];
    tx.set(accessRef, {
      parentUid:parent.uid,
      parentEmail:parent.email,
      parentName,
      children:resultChildren,
      groupId:redeemedSection.groupId,
      instituteId:redeemedSection.instituteId,
      instituteName:redeemedSection.instituteName,
      sectionId:redeemedSection.id,
      sectionName:redeemedSection.sectionName,
      status:"active",
      joinedDateKey:resultJoinedDateKey,
      joinedAt:existing.joinedAt || now,
      updatedAt:FieldValue.serverTimestamp(),
      sourceInviteGeneration:invite.generation || 1,
    }, { merge:true });
    const profilePayload = {
      parentUid:parent.uid,
      parentEmail:parent.email,
      parentName,
      updatedAt:FieldValue.serverTimestamp(),
    };
    if (!profileSnap.exists) profilePayload.createdAt = FieldValue.serverTimestamp();
    tx.set(profileRef, profilePayload, { merge:true });
    if (!accessSnap.exists) {
      tx.set(inviteRef, {
        redemptionCount:FieldValue.increment(1),
        lastRedeemedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
    }
  });
  await copyParentAccessFeedFromDate({
    accessId,
    sectionId:redeemedSection.id,
    joinedDateKey:resultJoinedDateKey,
  });
  return {
    accessId,
    sectionId:redeemedSection.id,
    sectionName:redeemedSection.sectionName,
    instituteName:redeemedSection.instituteName,
    studentName,
    children:resultChildren,
  };
});

exports.updateOwnParentSectionMember = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const parent = requireParentCallableUser(request);
  const accessId = normaliseParentText(request.data?.accessId);
  const accessRef = db.doc(`parentSectionAccess/${accessId}`);
  const accessSnap = await accessRef.get();
  if (!accessSnap.exists || accessSnap.data()?.parentUid !== parent.uid) {
    throw new HttpsError("permission-denied", "You can edit only your own family names.");
  }
  if (accessSnap.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "This class access has been revoked.");
  }
  const parentName = cleanParentName(request.data?.parentName, "Parent name");
  const children = cleanParentChildren(request.data?.children);
  const accessSnapForParent = await db.collection("parentSectionAccess").where("parentUid", "==", parent.uid).get();
  const batch = db.batch();
  accessSnapForParent.docs.forEach(item => batch.set(item.ref, {
    parentName,
    updatedAt:FieldValue.serverTimestamp(),
  }, { merge:true }));
  batch.set(accessRef, { children, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
  batch.set(db.doc(`parentProfiles/${parent.uid}`), {
    parentName,
    parentEmail:parent.email,
    updatedAt:FieldValue.serverTimestamp(),
  }, { merge:true });
  await batch.commit();
  return { parentName, children };
});

exports.updateParentSectionMember = onCall(PARENT_CALLABLE_OPTIONS, async request => {
  const actor = requireParentCallableUser(request);
  const accessId = normaliseParentText(request.data?.accessId);
  const accessRef = db.doc(`parentSectionAccess/${accessId}`);
  const accessSnap = await accessRef.get();
  if (!accessSnap.exists) throw new HttpsError("not-found", "This parent access no longer exists.");
  const access = { id:accessSnap.id, ...accessSnap.data() };
  const instituteSnap = await db.doc(`institutes/${access.instituteId}`).get();
  if (!instituteSnap.exists) throw new HttpsError("failed-precondition", "The access institute no longer exists.");
  await requireParentInstituteAdmin(actor.uid, { id:instituteSnap.id, ...instituteSnap.data() });

  const action = normaliseParentText(request.data?.action || "edit");
  if (action === "revoke") {
    await accessRef.set({
      status:"revoked",
      revokedBy:actor.uid,
      revokedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(),
    }, { merge:true });
    return { ...access, status:"revoked" };
  }

  const parentName = cleanParentName(request.data?.parentName || access.parentName, "Parent name");
  const children = cleanParentChildren(request.data?.children || access.children);
  if (action === "move") {
    const targetSectionName = cleanParentName(request.data?.targetSectionName, "Target section");
    const institute = { id:instituteSnap.id, ...instituteSnap.data() };
    const targetSection = await ensureParentPortalSection(institute, targetSectionName, actor.uid);
    if (targetSection.id === access.sectionId) {
      throw new HttpsError("invalid-argument", "Choose a different section.");
    }
    const targetId = parentAccessDocId(targetSection.id, access.parentUid);
    const targetRef = db.doc(`parentSectionAccess/${targetId}`);
    const { id:discardedAccessId, ...accessData } = access;
    await db.runTransaction(async tx => {
      const targetSnap = await tx.get(targetRef);
      const target = targetSnap.exists ? targetSnap.data() || {} : {};
      const combinedChildren = cleanParentChildren([...(target.children || []), ...children].filter((item, index, all) =>
        all.findIndex(candidate => parentKey(candidate?.name) === parentKey(item?.name)) === index
      ));
      tx.set(targetRef, {
        ...accessData,
        parentName,
        children:combinedChildren,
        sectionId:targetSection.id,
        sectionName:targetSection.sectionName,
        status:"active",
        joinedDateKey:target.joinedDateKey || dateKeyForTimeZone(),
        joinedAt:target.joinedAt || Date.now(),
        movedBy:actor.uid,
        movedAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
      tx.set(accessRef, {
        status:"revoked",
        movedToSectionId:targetSection.id,
        movedBy:actor.uid,
        movedAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
    });
    await backfillParentSectionToday(targetSection);
    return { moved:true, targetSectionId:targetSection.id, targetSectionName:targetSection.sectionName };
  }

  await accessRef.set({ parentName, children, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
  await db.doc(`parentProfiles/${access.parentUid}`).set({ parentName, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
  return { ...access, parentName, children };
});

exports.syncParentSectionFeedOnNotesWrite = onDocumentWritten(
  "users/{uid}/appdata/{notesDocId}",
  async event => {
    const uid = normaliseParentText(event.params.uid);
    const classId = classIdFromNotesDocId(event.params.notesDocId);
    if (!uid || !classId) return;
    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    const after = event.data?.after?.exists ? event.data.after.data() || {} : {};
    const dates = changedDateKeys(before, after);
    if (!dates.length) return;
    const [mainSnap, teacherSnap] = await Promise.all([
      db.doc(`users/${uid}/appdata/main`).get(),
      db.doc(`teachers/${uid}`).get(),
    ]);
    if (!mainSnap.exists) return;
    const main = mainSnap.data() || {};
    const cls = classFromMain(main, classId);
    if (!cls || !isActiveClassRecord(cls)) return;
    const section = await activeParentSectionForClass(uid, cls);
    if (!section) return;
    const teacher = teacherSnap.exists ? { uid, ...teacherSnap.data() } : { uid };
    for (const dateKey of dates) {
      await syncParentFeedSource({
        section,
        uid,
        cls,
        teacher,
        main,
        dateKey,
        beforeEntries:entriesForDate(before, dateKey),
        afterEntries:entriesForDate(after, dateKey),
      });
    }
  }
);

async function updateParentSectionMetadata(section, patch) {
  const accessSnap = await db.collection("parentSectionAccess").where("sectionId", "==", section.id).get();
  const operations = [
    {
      kind:"set",
      ref:db.doc(`parentPortalSections/${section.id}`),
      data:{ ...patch, updatedAt:FieldValue.serverTimestamp() },
    },
    ...accessSnap.docs.map(item => ({
      kind:"set",
      ref:item.ref,
      data:{ ...patch, updatedAt:FieldValue.serverTimestamp() },
    })),
  ];
  if (section.activeInviteToken) {
    operations.push({
      kind:"set",
      ref:db.doc(`parentSectionInvites/${section.activeInviteToken}`),
      data:{ ...patch, updatedAt:FieldValue.serverTimestamp() },
    });
  }
  await commitParentFeedOperations(operations);
}

exports.syncParentPortalSectionRenames = onDocumentWritten(
  "config/sections",
  async event => {
    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    const after = event.data?.after?.exists ? event.data.after.data() || {} : {};
    for (const [instituteName, config] of Object.entries(after)) {
      const previousConfigEntry = Object.entries(before)
        .find(([name]) => sameInstituteName(name, instituteName));
      const previousEvents = Array.isArray(previousConfigEntry?.[1]?.sectionChangeEvents)
        ? previousConfigEntry[1].sectionChangeEvents
        : [];
      const previousIds = new Set(previousEvents.map(item => normaliseParentText(item?.id)).filter(Boolean));
      const newEvents = (Array.isArray(config?.sectionChangeEvents) ? config.sectionChangeEvents : [])
        .filter(item => !previousIds.has(normaliseParentText(item?.id)));
      if (!newEvents.length) continue;
      const instituteCandidates = await findParentInstituteByName(instituteName).catch(() => []);
      for (const institute of instituteCandidates) {
        for (const renameEvent of newEvents) {
          for (const change of Array.isArray(renameEvent?.changes) ? renameEvent.changes : []) {
            const oldSection = normaliseParentText(change?.oldSection);
            const newSection = normaliseParentText(change?.newSection);
            if (!oldSection || !newSection || parentKey(oldSection) === parentKey(newSection)) continue;
            const section = await findParentPortalSection(institute.id, oldSection);
            if (!section) continue;
            const conflict = await findParentPortalSection(institute.id, newSection);
            if (conflict && conflict.id !== section.id) {
              logger.warn("parent section rename skipped because target already exists", {
                instituteId:institute.id,
                oldSection,
                newSection,
                sourceSectionId:section.id,
                targetSectionId:conflict.id,
              });
              continue;
            }
            await updateParentSectionMetadata(section, {
              sectionName:newSection,
              sectionKey:parentKey(newSection),
            });
          }
        }
      }
    }
  }
);

exports.syncParentPortalInstituteMetadata = onDocumentWritten(
  "institutes/{instituteId}",
  async event => {
    const instituteId = normaliseParentText(event.params.instituteId);
    if (!instituteId) return;
    const afterExists = event.data?.after?.exists;
    const after = afterExists ? event.data.after.data() || {} : {};
    const before = event.data?.before?.exists ? event.data.before.data() || {} : {};
    if (
      afterExists
      && normaliseParentText(after.name) === normaliseParentText(before.name)
      && normaliseParentText(after.groupId) === normaliseParentText(before.groupId)
      && normaliseParentText(after.status) === normaliseParentText(before.status)
    ) return;
    const sectionsSnap = await db.collection("parentPortalSections").where("instituteId", "==", instituteId).get();
    for (const item of sectionsSnap.docs) {
      const section = { id:item.id, ...item.data() };
      if (!afterExists || after.status === "deleted") {
        const accessSnap = await db.collection("parentSectionAccess").where("sectionId", "==", section.id).get();
        const operations = [
          {
            kind:"set",
            ref:item.ref,
            data:{
              status:"archived",
              enrollmentStatus:"closed",
              activeInviteToken:"",
              updatedAt:FieldValue.serverTimestamp(),
            },
          },
          ...accessSnap.docs.map(accessDoc => ({
            kind:"set",
            ref:accessDoc.ref,
            data:{
              status:"revoked",
              revokedReason:"institute_removed",
              revokedAt:FieldValue.serverTimestamp(),
              updatedAt:FieldValue.serverTimestamp(),
            },
          })),
        ];
        if (section.activeInviteToken) {
          operations.push({
            kind:"set",
            ref:db.doc(`parentSectionInvites/${section.activeInviteToken}`),
            data:{ status:"revoked", revokedAt:FieldValue.serverTimestamp() },
          });
        }
        await commitParentFeedOperations(operations);
      } else {
        await updateParentSectionMetadata(section, {
          instituteName:normaliseParentText(after.name),
          groupId:normaliseParentText(after.groupId || section.groupId),
          instituteId,
        });
      }
    }
  }
);
