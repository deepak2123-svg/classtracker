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
  return {
    uid,
    name: data?.profile?.name || "",
    institutes: uniqueTrimmed(classes.map(c => c?.institute)),
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
  await setDoc(doc(db, "config", "institutes"), { list: filtered });
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
