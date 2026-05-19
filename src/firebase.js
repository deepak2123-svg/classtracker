import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  getDocs, query, where, deleteDoc, runTransaction,
  collectionGroup, documentId,
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCCPbJdMU0xQHWCtVLakaFeeRCdY3kMP4s",
  authDomain: "classtracker-84920.firebaseapp.com",
  projectId: "classtracker-84920",
  storageBucket: "classtracker-84920.firebasestorage.app",
  messagingSenderId: "170006710635",
  appId: "1:170006710635:web:cf27aa33008adb93daa42e"
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
const gProvider   = new GoogleAuthProvider();
const MAIN_SCHEMA_VERSION = 3;
const BACKUP_HISTORY_LIMIT = 12;

class RevisionConflictError extends Error {
  constructor(details = {}) {
    super("Newer cloud data exists for this teacher.");
    this.name = "RevisionConflictError";
    this.code = "revision-conflict";
    Object.assign(this, details);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const r = await signInWithPopup(auth, gProvider); return r.user;
}
export async function signupWithEmail(name, email, password) {
  const r = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(r.user, { displayName: name });
  return r.user;
}
export async function loginWithEmail(email, password) {
  const r = await signInWithEmailAndPassword(auth, email, password); return r.user;
}
export function logout() { return signOut(auth); }
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

// ── User data — split architecture ───────────────────────────────────────────
// Main doc  : users/{uid}/appdata/main         → metadata (classes, profile, trash etc.)
// Notes docs: users/{uid}/appdata/notes_{cid}  → { [dateKey]: [...entries] }
// This keeps each document well under Firestore's 1MB limit.

export function userDocRef(uid)         { return doc(db, "users", uid, "appdata", "main"); }
export function notesDocRef(uid, cid)   { return doc(db, "users", uid, "appdata", `notes_${cid}`); }
export function mainBackupDocRef(uid)   { return doc(db, "users", uid, "appdata", "main_backup_latest"); }
export function backupHistoryDocRef(uid, backupId) { return doc(db, "users", uid, "appdata", `main_backup_${backupId}`); }

function safeRevision(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function uniqueTrimmed(values) {
  return [...new Set((values || []).map(v => (v || "").trim()).filter(Boolean))];
}

function normaliseInstituteKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sameInstituteLabel(a, b) {
  return normaliseInstituteKey(a) === normaliseInstituteKey(b);
}

function replaceInstituteLabel(value, oldName, newName) {
  const label = String(value || "").trim().replace(/\s+/g, " ");
  if (!label) return "";
  return sameInstituteLabel(label, oldName) ? String(newName || "").trim() : label;
}

function replaceInstituteList(values, oldName, newName) {
  return uniqueTrimmed((values || []).map(value => replaceInstituteLabel(value, oldName, newName)));
}

function buildInstituteRenameNotice(oldName, newName, extra = {}) {
  const eventAt = Number(extra.eventAt || Date.now());
  const adminName = String(extra.adminName || "Admin").trim() || "Admin";
  const impactedClassCount = Number(extra.impactedClassCount || 0);
  return {
    id: String(
      extra.id ||
      `institute_renamed_${normaliseInstituteKey(oldName) || "institute"}_${eventAt}`
    ),
    kind: "institute_renamed",
    classId: "",
    section: "",
    institute: String(newName || "").trim(),
    subject: "",
    adminName,
    eventAt,
    promptedAt: Number(extra.promptedAt || 0) || null,
    oldInstitute: String(oldName || "").trim(),
    newInstitute: String(newName || "").trim(),
    impactedClassCount,
  };
}

function replaceInstituteInsidePendingNotices(notices, oldName, newName) {
  return (Array.isArray(notices) ? notices : []).map(item => {
    if (!item) return item;
    const nextInstitute = replaceInstituteLabel(item.institute, oldName, newName);
    const preserveHistoricalRename = item.kind === "institute_renamed";
    const nextOldInstitute = preserveHistoricalRename
      ? String(item.oldInstitute || "").trim()
      : replaceInstituteLabel(item.oldInstitute, oldName, newName);
    const nextNewInstitute = preserveHistoricalRename
      ? String(item.newInstitute || "").trim()
      : replaceInstituteLabel(item.newInstitute, oldName, newName);
    const changed =
      nextInstitute !== String(item.institute || "").trim() ||
      nextOldInstitute !== String(item.oldInstitute || "").trim() ||
      nextNewInstitute !== String(item.newInstitute || "").trim();
    return changed
      ? {
          ...item,
          institute: nextInstitute,
          oldInstitute: nextOldInstitute,
          newInstitute: nextNewInstitute,
        }
      : item;
  });
}

function applyInstituteRenameToTeacherData(data, oldName, newName, extra = {}) {
  if (!data) return { data, changed: false, noticeAdded: false };

  const oldLabel = String(oldName || "").trim();
  const nextLabel = String(newName || "").trim();
  if (!oldLabel || !nextLabel) return { data, changed: false, noticeAdded: false };

  let changed = false;
  let impactedClassCount = 0;
  let matchedAssociation = false;

  const nextClasses = (data.classes || []).map(cls => {
    if (!sameInstituteLabel(cls?.institute, oldLabel)) return cls;
    changed = true;
    matchedAssociation = true;
    impactedClassCount += 1;
    return { ...cls, institute: nextLabel };
  });

  const nextTrashClasses = (data.trash?.classes || []).map(cls => {
    if (!sameInstituteLabel(cls?.institute, oldLabel)) return cls;
    changed = true;
    matchedAssociation = true;
    return { ...cls, institute: nextLabel };
  });

  const nextTrashNotes = (data.trash?.notes || []).map(note => {
    if (!sameInstituteLabel(note?.institute, oldLabel)) return note;
    changed = true;
    matchedAssociation = true;
    return { ...note, institute: nextLabel };
  });

  const nextDataInstitutes = replaceInstituteList(data.institutes, oldLabel, nextLabel);
  const nextProfileInstitutes = replaceInstituteList(data.profile?.institutes, oldLabel, nextLabel);
  const currentInstitutes = uniqueTrimmed(data.institutes || []);
  const currentProfileInstitutes = uniqueTrimmed(data.profile?.institutes || []);
  if (
    nextDataInstitutes.length !== currentInstitutes.length ||
    nextDataInstitutes.some((value, index) => value !== currentInstitutes[index])
  ) {
    changed = true;
    matchedAssociation = true;
  }
  if (
    nextProfileInstitutes.length !== currentProfileInstitutes.length ||
    nextProfileInstitutes.some((value, index) => value !== currentProfileInstitutes[index])
  ) {
    changed = true;
    matchedAssociation = true;
  }

  const existingNotices = Array.isArray(data?._meta?.pendingAdminClassNotices)
    ? data._meta.pendingAdminClassNotices
    : [];
  const nextPendingNotices = replaceInstituteInsidePendingNotices(existingNotices, oldLabel, nextLabel);
  if (
    nextPendingNotices.length !== existingNotices.length ||
    nextPendingNotices.some((item, index) => item !== existingNotices[index])
  ) {
    changed = true;
  }

  const legacyNotice = data?._meta?.pendingSectionChangeNotice;
  const currentLegacyItems = Array.isArray(legacyNotice?.items) ? legacyNotice.items : [];
  const nextLegacyItems = replaceInstituteInsidePendingNotices(currentLegacyItems, oldLabel, nextLabel);
  const legacyChanged =
    nextLegacyItems.length !== currentLegacyItems.length ||
    nextLegacyItems.some((item, index) => item !== currentLegacyItems[index]);
  if (legacyChanged) {
    changed = true;
  }

  if (!changed && !matchedAssociation) {
    return { data, changed: false, noticeAdded: false };
  }

  let nextMeta = {
    ...(data._meta || {}),
    pendingAdminClassNotices: nextPendingNotices,
  };

  if (legacyNotice && legacyChanged) {
    nextMeta.pendingSectionChangeNotice = {
      ...legacyNotice,
      items: nextLegacyItems,
    };
  }

  let noticeAdded = false;
  if (matchedAssociation) {
    nextMeta = withPendingAdminClassNotice(
      { _meta: nextMeta },
      buildInstituteRenameNotice(oldLabel, nextLabel, {
        ...extra,
        impactedClassCount,
      })
    );
    noticeAdded = true;
  }

  return {
    changed: true,
    noticeAdded,
    data: {
      ...data,
      classes: nextClasses,
      institutes: nextDataInstitutes,
      profile: {
        ...(data.profile || {}),
        institutes: nextProfileInstitutes,
      },
      trash: {
        ...(data.trash || {}),
        classes: nextTrashClasses,
        notes: nextTrashNotes,
      },
      _meta: nextMeta,
    },
  };
}

function buildPendingAdminClassNotice(kind, cls, extra = {}) {
  const eventAt = Number(extra.eventAt || Date.now());
  const adminName = String(
    extra.adminName ||
    extra.deletedByName ||
    extra.restoredByName ||
    "Admin"
  ).trim() || "Admin";
  return {
    id: String(extra.id || `${kind}_${String(cls?.id || "class")}_${eventAt}`),
    kind,
    classId: String(cls?.id || ""),
    section: String(cls?.section || "").trim(),
    institute: String(cls?.institute || "").trim(),
    subject: String(cls?.subject || "").trim(),
    adminName,
    eventAt,
    promptedAt: Number(extra.promptedAt || 0) || null,
    oldSection: String(extra.oldSection || "").trim(),
    newSection: String(extra.newSection || "").trim(),
    timetableChanged: !!extra.timetableChanged,
    entitySingular: String(extra.entitySingular || "").trim(),
    entityPlural: String(extra.entityPlural || "").trim(),
  };
}

function withPendingAdminClassNotice(data, notice) {
  const pending = Array.isArray(data?._meta?.pendingAdminClassNotices)
    ? data._meta.pendingAdminClassNotices
    : [];
  const nextClassId = String(notice?.classId || "");
  const nextId = String(notice?.id || "");
  const nextPending = [
    ...pending.filter(item => {
      const itemClassId = String(item?.classId || "");
      const itemId = String(item?.id || "");
      if (nextClassId && itemClassId === nextClassId) return false;
      if (nextId && itemId === nextId) return false;
      return true;
    }),
    notice,
  ].slice(-20);
  return {
    ...(data?._meta || {}),
    pendingAdminClassNotices: nextPending,
  };
}

function buildTeacherIdentityPatch(uid) {
  const currentUser = auth.currentUser;
  if (currentUser?.uid !== uid) return {};
  const patch = {};
  if (currentUser.email) patch.email = currentUser.email;
  if (currentUser.photoURL) patch.photoURL = currentUser.photoURL;
  return patch;
}

function buildTeacherIndexPayload(uid, data) {
  const classes = Array.isArray(data?.classes) ? data.classes : [];
  const classInstitutes = uniqueTrimmed(classes.map(c => c?.institute));
  const profileInstitutes = uniqueTrimmed(Array.isArray(data?.profile?.institutes) ? data.profile.institutes : []);
  const classSubjects = uniqueTrimmed(classes.map(c => c?.subject));
  const profileSubjects = uniqueTrimmed(Array.isArray(data?.profile?.subjects) ? data.profile.subjects : []);
  return {
    uid,
    name: data?.profile?.name || "",
    institutes: uniqueTrimmed([...classInstitutes, ...profileInstitutes]),
    subjects: uniqueTrimmed([...classSubjects, ...profileSubjects]),
    classCount: classes.length,
    mainRevision: safeRevision(data?._meta?.revision),
    lastActive: Date.now(),
  };
}

function buildBackupPayload(meta, savedAt, source, backupId) {
  const classes = Array.isArray(meta?.classes) ? meta.classes : [];
  return {
    data: meta,
    savedAt,
    revision: safeRevision(meta?._meta?.revision),
    classCount: classes.length,
    instituteCount: uniqueTrimmed(classes.map(c => c?.institute)).length,
    source,
    backupId,
  };
}

async function listBackupSnapshots(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "appdata"));
    return snap.docs
      .filter(d => d.id === "main_backup_latest" || (d.id.startsWith("main_backup_") && d.id !== "main"))
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(item => item?.data);
  } catch {
    return [];
  }
}

function latestBackupSnapshot(backups) {
  return [...(backups || [])]
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0) || safeRevision(b.revision) - safeRevision(a.revision))[0] || null;
}

async function pruneBackupHistory(uid) {
  const backups = await listBackupSnapshots(uid);
  const stale = backups
    .filter(item => item.id !== "main_backup_latest")
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0) || safeRevision(b.revision) - safeRevision(a.revision))
    .slice(BACKUP_HISTORY_LIMIT);
  await Promise.all(
    stale.map(item => deleteDoc(doc(db, "users", uid, "appdata", item.id)).catch(() => {}))
  );
}

async function hydrateUserDataFromMain(uid, main) {
  const classes = Array.isArray(main?.classes) ? main.classes : [];
  const notesList = await Promise.all(
    classes.map(async cls => {
      try {
        const ns = await getDoc(notesDocRef(uid, cls.id));
        return [cls.id, ns.exists() ? ns.data() : {}];
      } catch {
        return [cls.id, {}];
      }
    })
  );
  const notes = Object.fromEntries(notesList);
  return { ...main, notes: Object.keys(notes).length ? notes : (main?.notes || {}) };
}

async function listAppdataNoteDocIds(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "appdata"));
    return snap.docs
      .map(d => d.id)
      .filter(id => id.startsWith("notes_"))
      .map(id => id.slice(6));
  } catch {
    return [];
  }
}

export async function loadUserData(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return null;
    return hydrateUserDataFromMain(uid, snap.data());
  } catch { return null; }
}

export async function loadUserDataState(uid) {
  const noteDocIds = await listAppdataNoteDocIds(uid);

  let mainSnap;
  try {
    mainSnap = await getDoc(userDocRef(uid));
  } catch (error) {
    return { status: "error", data: null, noteDocIds, orphanedNoteDocIds: [], error };
  }

  const backupMeta = latestBackupSnapshot(await listBackupSnapshots(uid));

  if (!mainSnap.exists()) {
    if (backupMeta?.data) {
      const backupData = await hydrateUserDataFromMain(uid, backupMeta.data);
      const backupClassIds = new Set(
        (backupMeta.data.classes || []).map(cls => String(cls?.id || "")).filter(Boolean)
      );
      return {
        status: "backup",
        data: backupData,
        noteDocIds,
        orphanedNoteDocIds: noteDocIds.filter(id => !backupClassIds.has(String(id))),
        backupSavedAt: backupMeta.savedAt || 0,
      };
    }
    return {
      status: noteDocIds.length ? "orphaned" : "missing",
      data: null,
      noteDocIds,
      orphanedNoteDocIds: [...noteDocIds],
      backupSavedAt: 0,
    };
  }

  const data = await hydrateUserDataFromMain(uid, mainSnap.data());
  const classIds = new Set(
    (data.classes || []).map(cls => String(cls?.id || "")).filter(Boolean)
  );
  return {
    status: "ok",
    data,
    noteDocIds,
    orphanedNoteDocIds: noteDocIds.filter(id => !classIds.has(String(id))),
    backupSavedAt: backupMeta?.savedAt || 0,
  };
}

export async function saveUserData(uid, data, options = {}) {
  const { expectedRevision = safeRevision(data?._meta?.revision), source = "saveUserData" } = options;
  const { notes = {}, ...meta } = data || {};
  const shouldRefreshBackup =
    (meta.classes || []).length > 0 ||
    Object.keys(notes || {}).length > 0 ||
    (meta.trash?.classes || []).length > 0 ||
    (meta.trash?.notes || []).length > 0;

  const result = await runTransaction(db, async tx => {
    const mainRef = userDocRef(uid);
    const currentSnap = await tx.get(mainRef);
    const currentMain = currentSnap.exists() ? currentSnap.data() : null;
    const currentRevision = safeRevision(currentMain?._meta?.revision);

    if (currentSnap.exists()) {
      if (expectedRevision !== currentRevision) {
        throw new RevisionConflictError({
          expectedRevision,
          actualRevision: currentRevision,
          updatedAt: currentMain?._meta?.updatedAt || 0,
        });
      }
    } else if (expectedRevision > 0) {
      throw new RevisionConflictError({
        expectedRevision,
        actualRevision: 0,
        updatedAt: 0,
      });
    }

    const updatedAt = Date.now();
    const nextRevision = currentRevision + 1;
    const safeMeta = {
      ...meta,
      _meta: {
        ...(meta._meta || {}),
        updatedAt,
        schemaVersion: MAIN_SCHEMA_VERSION,
        revision: nextRevision,
        previousRevision: currentRevision,
        source,
      },
    };

    tx.set(mainRef, safeMeta);

    if (shouldRefreshBackup) {
      const backupId = `${String(nextRevision).padStart(6, "0")}_${updatedAt}`;
      tx.set(mainBackupDocRef(uid), buildBackupPayload(safeMeta, updatedAt, source, backupId));
      tx.set(backupHistoryDocRef(uid, backupId), buildBackupPayload(safeMeta, updatedAt, source, backupId));
    }

    Object.entries(notes || {}).forEach(([cid, dateMap]) => {
      tx.set(notesDocRef(uid, cid), dateMap || {});
    });

    return { data: { ...safeMeta, notes }, revision: nextRevision, updatedAt };
  });

  await pruneBackupHistory(uid);
  await syncTeacherIndex(uid, result.data);
  return result;
}

// Delete notes doc when a class is permanently deleted
export async function deleteClassNotes(uid, classId) {
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(notesDocRef(uid, classId));
  } catch {}
}

// ── Role system ───────────────────────────────────────────────────────────────
// roles/{uid} = { role: "teacher" | "admin", grantedAt, grantedBy }
export function roleDocRef(uid) { return doc(db, "roles", uid); }

export async function getUserRole(uid) {
  try {
    const snap = await getDoc(roleDocRef(uid));
    return snap.exists() ? snap.data().role : "teacher";
  } catch { return "teacher"; }
}

export async function promoteToAdmin(uid, grantedByUid) {
  await setDoc(roleDocRef(uid), {
    role: "admin",
    grantedAt: Date.now(),
    grantedBy: grantedByUid,
  });
}

export async function demoteToTeacher(uid) {
  await setDoc(roleDocRef(uid), { role: "teacher", grantedAt: Date.now() });
}

// ── Teacher index (for admin discovery) ───────────────────────────────────────
// teachers/{uid} = { uid, name, email, photoURL, institutes[], lastActive }
export async function syncTeacherIndex(uid, data) {
  if (!data?.profile?.name) return;
  try {
    await setDoc(doc(db, "teachers", uid), {
      ...buildTeacherIndexPayload(uid, data),
      name: data.profile.name,
      ...buildTeacherIdentityPatch(uid),
    }, { merge: true });
  } catch { /* silent fail — admin feature optional */ }
}

// ── Admin data reads ──────────────────────────────────────────────────────────
export async function getAllTeachers() {
  try {
    // Primary: teacher index (has institute/class summary)
    const snap = await getDocs(collection(db, "teachers"));
    const indexed = snap.docs.map(d => d.data());
    const merged = new Map(indexed.map(t => [t.uid, t]));

    // Supplement: roles collection catches teachers not yet in index
    const rolesSnap = await getDocs(collection(db, "roles"));
    rolesSnap.docs.forEach(d => {
      if (!merged.has(d.id)) {
        merged.set(d.id, { uid: d.id, name: "", institutes: [], classCount: 0 });
      }
    });

    try {
      const appdataSnap = await getDocs(query(collectionGroup(db, "appdata"), where(documentId(), "==", "main")));
      appdataSnap.docs.forEach(snap => {
        const uid = snap.ref.parent.parent?.id;
        if (!uid) return;
        const data = snap.data();
        const summary = buildTeacherIndexPayload(uid, data);
        if (!summary.name && summary.classCount === 0) return;
        const existing = merged.get(uid) || { uid, name: "", institutes: [], classCount: 0 };
        merged.set(uid, {
          ...existing,
          ...summary,
          name: summary.name || existing.name,
          institutes: summary.institutes.length ? summary.institutes : (existing.institutes || []),
          classCount: Math.max(summary.classCount || 0, existing.classCount || 0),
        });
      });
    } catch {}

    return Array.from(merged.values());
  } catch { return []; }
}

export async function getTeacherFullData(uid) {
  // Reuse loadUserData which handles the split-doc architecture
  return loadUserData(uid);
}

export async function getAllRoles() {
  try {
    const snap = await getDocs(collection(db, "roles"));
    const map = {};
    snap.docs.forEach(d => { map[d.id] = d.data().role; });
    return map;
  } catch { return {}; }
}

// ── Invite links ──────────────────────────────────────────────────────────────
// invites/{token} = { createdAt, createdBy, expiresAt, used }
export async function createInviteLink(adminUid) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(36)).join("").slice(0, 32);
  await setDoc(doc(db, "invites", token), {
    createdAt: Date.now(),
    createdBy: adminUid,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    used: false,
  });
  return token;
}

export async function verifyInviteToken(token) {
  const snap = await getDoc(doc(db, "invites", token));
  if (!snap.exists()) throw new Error("Invalid invite link.");
  const d = snap.data();
  if (d.used) throw new Error("This invite link has already been used.");
  if (Date.now() > d.expiresAt) throw new Error("This invite link has expired.");
  return true;
}

export async function useInviteToken(token, uid) {
  const inviteRef = doc(db, "invites", token);
  const roleRef = doc(db, "roles", uid);
  await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Invalid invite link.");

    const invite = inviteSnap.data() || {};
    if (Date.now() > invite.expiresAt) throw new Error("This invite link has expired.");
    if (invite.used && invite.usedBy !== uid) {
      throw new Error("This invite link has already been used.");
    }

    const now = Date.now();
    tx.set(inviteRef, {
      used: true,
      usedBy: uid,
      usedAt: now,
    }, { merge: true });
    tx.set(roleRef, {
      role: "admin",
      grantedAt: now,
      grantedBy: "invite-link",
      inviteToken: token,
    }, { merge: true });
  });
}

export async function getInvites(adminUid) {
  try {
    const snap = await getDocs(collection(db, "invites"));
    return snap.docs.map(d => ({ token: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch { return []; }
}

// ── Remove teacher from system ────────────────────────────────────────────────
// Deletes the teacher index entry and their role doc.
// Their appdata (classes/notes) is NOT deleted — kept for admin audit trail.
// Firebase Auth account is also kept (can't delete other users from client SDK).
export async function removeTeacherFromSystem(uid) {
  try { await deleteDoc(doc(db, "teachers", uid)); } catch {}
  try { await deleteDoc(doc(db, "roles", uid)); } catch {}
}

// ── Trash auto-purge ──────────────────────────────────────────────────────────
// Removes trash items older than 30 days from the user's local data object.
// Call this after loadUserData so stale items never reach the UI.
// No Firestore write needed here — the next saveUserData call persists the cleanup.
export function purgeExpiredTrash(data) {
  if (!data) return data;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS;
  const trashedClasses = (data.trash?.classes || []).filter(tc => (tc.deletedAt || 0) > cutoff);
  const trashedNotes   = (data.trash?.notes   || []).filter(tn => (tn.deletedAt || 0) > cutoff);
  return { ...data, trash: { classes: trashedClasses, notes: trashedNotes } };
}

// ── Save a name to a user's profile (used by admin + teacher name setup) ─────
export async function saveProfileName(uid, name) {
  try {
    const ref = userDocRef(uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const currentRevision = safeRevision(existing?._meta?.revision);
    const updatedAt = Date.now();
    await setDoc(ref, {
      ...existing,
      profile: { ...(existing.profile || {}), name: name.trim() },
      _meta: {
        ...(existing._meta || {}),
        updatedAt,
        schemaVersion: MAIN_SCHEMA_VERSION,
        revision: currentRevision + 1,
        previousRevision: currentRevision,
        source: "saveProfileName",
      },
    });
    // Also update the teacher index entry
    await setDoc(doc(db, "teachers", uid), {
      name: name.trim(),
      ...buildTeacherIdentityPatch(uid),
    }, { merge: true });
  } catch (e) { console.error("saveProfileName", e); }
}

export async function repairTeacherIndex(uid) {
  const state = await loadUserDataState(uid);
  if (!state?.data) {
    return { ok: false, reason: state?.status || "missing" };
  }
  if (!state.data.profile?.name) {
    return { ok: false, reason: "missing-profile" };
  }
  await syncTeacherIndex(uid, state.data);
  return {
    ok: true,
    sourceStatus: state.status,
    summary: buildTeacherIndexPayload(uid, state.data),
  };
}

// ── Remove institute ──────────────────────────────────────────────────────────
// Strips this institute from every teacher's index entry.
// Teachers are NOT deleted — they may belong to other institutes.
export async function removeInstituteFromIndex(instituteName) {
  try {
    const snap = await getDocs(collection(db, "teachers"));
    const norm = (s) => (s||"").trim().toLowerCase();
    const updates = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const filtered = (data.institutes||[]).filter(i => norm(i) !== norm(instituteName));
      if (filtered.length !== (data.institutes||[]).length) {
        updates.push(setDoc(doc(db, "teachers", d.id), { ...data, institutes: filtered }));
      }
    });
    await Promise.all(updates);
  } catch (e) { console.error("removeInstituteFromIndex", e); }
}

// ── Delete a class entry from teacher's data ──────────────────────────────────
export async function deleteEntryFromTeacherData(uid, classId, dateKey, entryId) {
  try {
    const data = await loadUserData(uid);
    if (!data) return;
    const classNotes = (data.notes || {})[classId] || {};
    const dayArr = (classNotes[dateKey] || []).filter(e => e.id !== entryId);
    const updatedNotes = {
      ...data.notes,
      [classId]: { ...classNotes, [dateKey]: dayArr },
    };
    await saveUserData(uid, { ...data, notes: updatedNotes });
  } catch (e) { console.error("deleteEntryFromTeacherData", e); }
}

// ── Delete an entire class from teacher's data ────────────────────────────────
export async function deleteClassFromTeacherData(uid, classId) {
  try {
    const data = await loadUserData(uid);
    if (!data) return;
    const updatedClasses = (data.classes || []).filter(c => c.id !== classId);
    const updatedNotes = Object.fromEntries(
      Object.entries(data.notes || {}).filter(([k]) => k !== classId)
    );
    await saveUserData(uid, { ...data, classes: updatedClasses, notes: updatedNotes });
    // Also clean up notes sub-docs if any
    try { await deleteClassNotes(uid, classId); } catch {}
  } catch (e) { console.error("deleteClassFromTeacherData", e); }
}

export async function trashClassInTeacherData(uid, classId, extraTrashFields = {}) {
  try {
    const data = await loadUserData(uid);
    if (!data) return null;
    const cls = (data.classes || []).find(c => c.id === classId);
    if (!cls) {
      return (data.trash?.classes || []).find(c => c.id === classId) || null;
    }

    const trashedClass = {
      ...cls,
      deletedAt: Date.now(),
      savedNotes: (data.notes || {})[classId] || {},
      ...extraTrashFields,
    };

    const updatedClasses = (data.classes || []).filter(c => c.id !== classId);
    const updatedNotes = Object.fromEntries(
      Object.entries(data.notes || {}).filter(([k]) => k !== classId)
    );
    const updatedTrash = {
      ...(data.trash || {}),
      classes: [
        ...(data.trash?.classes || []).filter(c => c.id !== classId),
        trashedClass,
      ],
    };
    const updatedMeta = withPendingAdminClassNotice(
      data,
      buildPendingAdminClassNotice("class_deleted", trashedClass, {
        eventAt: trashedClass.deletedAt,
        deletedByName: extraTrashFields.deletedByName,
      })
    );

    await saveUserData(uid, {
      ...data,
      classes: updatedClasses,
      notes: updatedNotes,
      trash: updatedTrash,
      _meta: updatedMeta,
    });
    try { await deleteClassNotes(uid, classId); } catch {}
    return trashedClass;
  } catch (e) {
    console.error("trashClassInTeacherData", e);
    return null;
  }
}

export async function restoreClassFromTeacherTrash(uid, classId, extraRestoreFields = {}) {
  try {
    const data = await loadUserData(uid);
    if (!data) return null;
    const trashedClass = (data.trash?.classes || []).find(c => c.id === classId);
    if (!trashedClass) return null;

    const {
      deletedAt,
      savedNotes,
      deletedBy,
      deletedByAdmin,
      deletedByUid,
      deletedByName,
      ...restoredClass
    } = trashedClass;

    const updatedClasses = [
      ...(data.classes || []).filter(c => c.id !== classId),
      restoredClass,
    ];
    const updatedTrash = {
      ...(data.trash || {}),
      classes: (data.trash?.classes || []).filter(c => c.id !== classId),
    };
    const updatedNotes = {
      ...(data.notes || {}),
      [classId]: savedNotes || {},
    };
    const updatedMeta = withPendingAdminClassNotice(
      data,
      buildPendingAdminClassNotice("class_restored", restoredClass, {
        eventAt: Date.now(),
        restoredByName: extraRestoreFields.restoredByName,
      })
    );

    await saveUserData(uid, {
      ...data,
      classes: updatedClasses,
      notes: updatedNotes,
      trash: updatedTrash,
      _meta: updatedMeta,
    });

    return { ...restoredClass, savedNotes: savedNotes || {} };
  } catch (e) {
    console.error("restoreClassFromTeacherTrash", e);
    return null;
  }
}

// ── Global institutes (admin-controlled) ──────────────────────────────────────
// config/institutes = { list: ["KIS", "Genesis Karnal", ...] }

export async function getGlobalInstitutes() {
  try {
    const snap = await getDoc(doc(db, "config", "institutes"));
    if (snap.exists()) return snap.data().list || [];
    return [];
  } catch { return []; }
}

export async function saveGlobalInstitute(name) {
  const existing = await getGlobalInstitutes();
  const lower = existing.map(i => i.toLowerCase());
  if (lower.includes(name.trim().toLowerCase())) return; // duplicate
  await setDoc(doc(db, "config", "institutes"), {
    list: [...existing, name.trim()]
  }, { merge: true });
}

export async function deleteGlobalInstitute(name) {
  const existing = await getGlobalInstitutes();
  const filtered = existing.filter(i => i.toLowerCase() !== name.trim().toLowerCase());
  // Keep any existing deletedList when overwriting list
  const snap = await getDoc(doc(db, "config", "institutes"));
  const currentDeletedList = snap.exists() ? (snap.data().deletedList || []) : [];
  await setDoc(doc(db, "config", "institutes"), { list: filtered, deletedList: currentDeletedList });
}

// ── Deleted institutes list (persisted so UI survives page refresh) ────────────
export async function getDeletedInstitutesList() {
  try {
    const snap = await getDoc(doc(db, "config", "institutes"));
    if (snap.exists()) return snap.data().deletedList || [];
    return [];
  } catch { return []; }
}

export async function addToDeletedInstitutesList(name) {
  try {
    const snap = await getDoc(doc(db, "config", "institutes"));
    const existing = snap.exists() ? (snap.data().deletedList || []) : [];
    const norm = name.trim().toLowerCase();
    if (existing.some(i => i.toLowerCase() === norm)) return;
    await setDoc(doc(db, "config", "institutes"), { deletedList: [...existing, name.trim()] }, { merge: true });
  } catch (e) { console.error("addToDeletedInstitutesList", e); }
}

export async function removeFromDeletedInstitutesList(name) {
  try {
    const snap = await getDoc(doc(db, "config", "institutes"));
    const existing = snap.exists() ? (snap.data().deletedList || []) : [];
    const filtered = existing.filter(i => i.toLowerCase() !== name.trim().toLowerCase());
    await setDoc(doc(db, "config", "institutes"), { deletedList: filtered }, { merge: true });
  } catch (e) { console.error("removeFromDeletedInstitutesList", e); }
}

export async function renameGlobalInstitute(oldName, newName, extra = {}) {
  const oldLabel = String(oldName || "").trim();
  const nextLabel = String(newName || "").trim();
  if (!oldLabel || !nextLabel) {
    throw new Error("Enter both the current institute name and the new institute name.");
  }

  const eventAt = Number(extra.eventAt || Date.now());
  const adminName = String(extra.adminName || "Admin").trim() || "Admin";
  const institutesRef = doc(db, "config", "institutes");
  const sectionsRef = doc(db, "config", "sections");

  const configResult = await runTransaction(db, async tx => {
    const [institutesSnap, sectionsSnap] = await Promise.all([
      tx.get(institutesRef),
      tx.get(sectionsRef),
    ]);

    const currentList = institutesSnap.exists() && Array.isArray(institutesSnap.data()?.list)
      ? institutesSnap.data().list
      : [];
    const currentSections = sectionsSnap.exists() ? (sectionsSnap.data() || {}) : {};

    const currentLabel = currentList.find(item => sameInstituteLabel(item, oldLabel));
    if (!currentLabel) {
      throw new Error("That institute no longer exists in the admin directory.");
    }

    const conflictingInstitute = currentList.find(item =>
      sameInstituteLabel(item, nextLabel) && !sameInstituteLabel(item, currentLabel)
    );
    if (conflictingInstitute) {
      throw new Error(`"${nextLabel}" already exists in the institute directory.`);
    }

    const sectionKeys = Object.keys(currentSections || {});
    const oldSectionKey = sectionKeys.find(key => sameInstituteLabel(key, currentLabel)) || null;
    const conflictingSectionKey = sectionKeys.find(key =>
      sameInstituteLabel(key, nextLabel) && !sameInstituteLabel(key, oldSectionKey)
    );
    if (conflictingSectionKey) {
      throw new Error(`Section settings already exist for "${nextLabel}".`);
    }

    const nextList = uniqueTrimmed(
      currentList.map(item => replaceInstituteLabel(item, currentLabel, nextLabel))
    );

    const nextSections = { ...(currentSections || {}) };
    if (oldSectionKey) {
      const payload = nextSections[oldSectionKey];
      delete nextSections[oldSectionKey];
      nextSections[nextLabel] = payload;
    }

    tx.set(institutesRef, { list: nextList });
    if (Object.keys(nextSections).length) {
      tx.set(sectionsRef, nextSections);
    } else {
      tx.delete(sectionsRef);
    }

    return {
      oldLabel: currentLabel,
      newLabel: nextLabel,
      list: nextList,
      renamedSectionConfig: !!oldSectionKey,
    };
  });

  const mainDocsSnap = await getDocs(query(collectionGroup(db, "appdata"), where(documentId(), "==", "main")));
  let affectedTeacherCount = 0;
  let notifiedTeacherCount = 0;
  const updatedMainUids = new Set();

  for (const snap of mainDocsSnap.docs) {
    const uid = snap.ref.parent.parent?.id;
    if (!uid) continue;

    let currentData = snap.data();
    let attempt = 0;
    while (attempt < 2) {
      const transformed = applyInstituteRenameToTeacherData(
        currentData,
        configResult.oldLabel,
        configResult.newLabel,
        { adminName, eventAt }
      );

      if (!transformed.changed) break;

      try {
        await saveUserData(uid, transformed.data, {
          expectedRevision: safeRevision(currentData?._meta?.revision),
          source: "adminRenameInstitute",
        });
        affectedTeacherCount += 1;
        if (transformed.noticeAdded) notifiedTeacherCount += 1;
        updatedMainUids.add(uid);
        break;
      } catch (error) {
        if (error?.code === "revision-conflict" && attempt === 0) {
          const latestSnap = await getDoc(userDocRef(uid));
          if (!latestSnap.exists()) break;
          currentData = latestSnap.data();
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  }

  const teacherIndexSnap = await getDocs(collection(db, "teachers"));
  let indexOnlyCount = 0;
  for (const snap of teacherIndexSnap.docs) {
    if (updatedMainUids.has(snap.id)) continue;
    const currentInstitutes = uniqueTrimmed(snap.data()?.institutes || []);
    const nextInstitutes = replaceInstituteList(currentInstitutes, configResult.oldLabel, configResult.newLabel);
    if (
      nextInstitutes.length === currentInstitutes.length &&
      nextInstitutes.every((value, index) => value === currentInstitutes[index])
    ) {
      continue;
    }
    await setDoc(doc(db, "teachers", snap.id), { institutes: nextInstitutes }, { merge: true });
    indexOnlyCount += 1;
  }

  return {
    ...configResult,
    affectedTeacherCount,
    notifiedTeacherCount,
    indexOnlyCount,
  };
}

// ── Institute sections (admin-managed) ────────────────────────────────────────
// config/sections = { [instituteName]: { gradeGroups: [...], sectionChangeEvents: [...] } }
// gradeGroup: { id, gradeNums, label, sections, slots, sectionOverrides }

export async function getAllInstituteSections() {
  try {
    const snap = await getDoc(doc(db, "config", "sections"));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

export async function saveInstituteGradeGroups(instituteName, gradeGroups, extraPatch = {}) {
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    ...existing,
    [instituteName]: { ...(existing[instituteName]||{}), ...extraPatch, gradeGroups }
  });
}

export async function saveInstituteType(instituteName, type) {
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    ...existing,
    [instituteName]: { ...(existing[instituteName]||{}), type }
  });
}

export async function saveInstituteExtraSections(instituteName, extraSections) {
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    ...existing,
    [instituteName]: {
      ...(existing[instituteName] || {}),
      extraSections: uniqueTrimmed(extraSections),
    }
  });
}

export async function deleteInstituteGradeGroup(instituteName, groupId) {
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  const current = existing[instituteName]?.gradeGroups || [];
  const updated = current.filter(g => g.id !== groupId);
  await setDoc(doc(db, "config", "sections"), {
    ...existing,
    [instituteName]: { ...(existing[instituteName] || {}), gradeGroups: updated }
  });
}
