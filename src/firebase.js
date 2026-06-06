import { initializeApp } from "firebase/app";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, collection,
  getDocs, query, where, deleteDoc, runTransaction,
  collectionGroup, documentId,
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithCredential, signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { canUseGooglePopupAuth, getGoogleWebClientId, isNativeApp } from "./platform";

const firebaseConfig = {
  apiKey: "AIzaSyCCPbJdMU0xQHWCtVLakaFeeRCdY3kMP4s",
  authDomain: "classtracker-84920.firebaseapp.com",
  projectId: "classtracker-84920",
  storageBucket: "classtracker-84920.firebasestorage.app",
  messagingSenderId: "170006710635",
  appId: "1:170006710635:web:cf27aa33008adb93daa42e"
};

const app = initializeApp(firebaseConfig);
export const db   = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
})();
export const auth = getAuth(app);
const gProvider   = new GoogleAuthProvider();
const MAIN_SCHEMA_VERSION = 3;
const BACKUP_HISTORY_LIMIT = 12;
let nativeGoogleInitPromise = null;

class RevisionConflictError extends Error {
  constructor(details = {}) {
    super("Newer cloud data exists for this teacher.");
    this.name = "RevisionConflictError";
    this.code = "revision-conflict";
    Object.assign(this, details);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function ensureNativeGoogleSignInReady() {
  const clientId = getGoogleWebClientId();
  if (!clientId) {
    const error = new Error("Missing VITE_GOOGLE_WEB_CLIENT_ID for native Google sign-in.");
    error.code = "auth/native-google-client-id-missing";
    throw error;
  }
  if (!nativeGoogleInitPromise) {
    nativeGoogleInitPromise = GoogleSignIn.initialize({ clientId });
  }
  await nativeGoogleInitPromise;
}

export async function loginWithGoogle() {
  if (canUseGooglePopupAuth()) {
    const r = await signInWithPopup(auth, gProvider);
    return r.user;
  }

  await ensureNativeGoogleSignInReady();
  const result = await GoogleSignIn.signIn();
  if (!result?.idToken) {
    const error = new Error("Google sign-in completed without an ID token.");
    error.code = "auth/native-google-token-missing";
    throw error;
  }

  const credential = GoogleAuthProvider.credential(result.idToken);
  const signedIn = await signInWithCredential(auth, credential);

  if (result.displayName && !signedIn.user.displayName) {
    const profilePatch = { displayName: result.displayName };
    if (result.imageUrl) profilePatch.photoURL = result.imageUrl;
    await updateProfile(signedIn.user, profilePatch).catch(() => {});
  }

  return signedIn.user;
}
export async function signupWithEmail(name, email, password) {
  const r = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(r.user, { displayName: name });
  return r.user;
}
export async function loginWithEmail(email, password) {
  const r = await signInWithEmailAndPassword(auth, email, password); return r.user;
}
export async function logout() {
  await signOut(auth);
  if (isNativeApp()) {
    try {
      await GoogleSignIn.signOut();
    } catch {}
  }
}
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

async function scanAppdataDocs(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "appdata"));
    const noteDocIds = [];
    const backups = [];
    snap.docs.forEach(docSnap => {
      const id = docSnap.id;
      if (id.startsWith("notes_")) {
        noteDocIds.push(id.slice(6));
        return;
      }
      if (id === "main_backup_latest" || (id.startsWith("main_backup_") && id !== "main")) {
        const item = { id, ...docSnap.data() };
        if (item?.data) backups.push(item);
      }
    });
    return { noteDocIds, backups };
  } catch {
    return { noteDocIds: [], backups: [] };
  }
}

async function listBackupSnapshots(uid) {
  const summary = await scanAppdataDocs(uid);
  return summary.backups || [];
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

export async function loadUserData(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return null;
    return hydrateUserDataFromMain(uid, snap.data());
  } catch { return null; }
}

export async function loadUserDataState(uid) {
  const [appdataResult, mainResult] = await Promise.allSettled([
    scanAppdataDocs(uid),
    getDoc(userDocRef(uid)),
  ]);
  const appdataSummary = appdataResult.status === "fulfilled"
    ? appdataResult.value
    : { noteDocIds: [], backups: [] };
  const noteDocIds = appdataSummary.noteDocIds || [];
  const backupMeta = latestBackupSnapshot(appdataSummary.backups || []);

  if (mainResult.status !== "fulfilled") {
    return { status: "error", data: null, noteDocIds, orphanedNoteDocIds: [], error: mainResult.reason };
  }
  const mainSnap = mainResult.value;

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

  pruneBackupHistory(uid).catch(() => {});
  syncTeacherIndex(uid, result.data).catch(() => {});
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

// ── Ledgr report automation ───────────────────────────────────────────────────
// config/ledgrReportSchedule stores the admin's desired schedule. A trusted
// backend runner can read this document and write execution metadata alongside
// it without the web client overwriting those fields.

function normaliseLedgrScheduleTimes(times) {
  return [...new Set((times || [])
    .map(value => String(value || "").trim())
    .filter(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)))]
    .sort((a, b) => a.localeCompare(b));
}

export async function getLedgrReportSchedule() {
  try {
    const snap = await getDoc(doc(db, "config", "ledgrReportSchedule"));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("getLedgrReportSchedule", error);
    return null;
  }
}

export async function saveLedgrReportSchedule(schedule = {}, updatedBy = "") {
  const times = normaliseLedgrScheduleTimes(schedule.times);
  const enabled = !!schedule.enabled;
  if (enabled && !times.length) {
    throw new Error("Add at least one valid report time.");
  }

  const scopeType = schedule.scope?.type === "selected" ? "selected" : "all";
  const selectedInstitutes = scopeType === "selected"
    ? uniqueTrimmed(schedule.scope?.institutes || [])
    : [];
  if (enabled && scopeType === "selected" && !selectedInstitutes.length) {
    throw new Error("Select at least one institute for this schedule.");
  }

  const payload = {
    schemaVersion: 1,
    enabled,
    times,
    timezone: String(schedule.timezone || "Asia/Kolkata").trim() || "Asia/Kolkata",
    report: {
      period: ["daily", "weekly", "monthly", "range"].includes(schedule.report?.period)
        ? schedule.report.period
        : "daily",
      month: String(schedule.report?.month || "").trim(),
      monthMode: schedule.report?.period === "monthly" ? "current" : "",
      rangeStart: String(schedule.report?.rangeStart || "").trim(),
      rangeEnd: String(schedule.report?.rangeEnd || "").trim(),
    },
    scope: {
      type: scopeType,
      institutes: selectedInstitutes,
    },
    output: {
      format: "pdf",
    },
    updatedAt: Date.now(),
    updatedBy: String(updatedBy || "").trim(),
  };

  await setDoc(doc(db, "config", "ledgrReportSchedule"), payload, { merge: true });
  return payload;
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

// ── Admin Recycle Bin persistence ─────────────────────────────────────────────
export async function getAdminBin() {
  try {
    const snap = await getDoc(doc(db, "config", "adminBin"));
    if (!snap.exists()) return [];
    return snap.data().items || [];
  } catch { return []; }
}

export async function saveAdminBin(items) {
  try {
    // Keep only the last 200 items and prune items older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pruned = (items || []).filter(i => (i.deletedAt || 0) > cutoff).slice(-200);
    await setDoc(doc(db, "config", "adminBin"), { items: pruned, updatedAt: Date.now() });
    return pruned;
  } catch (e) { console.error("saveAdminBin", e); return items; }
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

  // Walk all teacher main docs using uid-based fetch (collectionGroup+documentId is invalid in Firestore)
  const teacherIndexForRename = await getDocs(collection(db, "teachers"));
  const renameUids = [...new Set(teacherIndexForRename.docs.map(d => d.id))].filter(Boolean);
  let affectedTeacherCount = 0;
  let notifiedTeacherCount = 0;
  const updatedMainUids = new Set();

  for (const uid of renameUids) {
    const mainSnapR = await getDoc(userDocRef(uid));
    if (!mainSnapR.exists()) continue;

    const currentData = mainSnapR.data();
    const transformed = applyInstituteRenameToTeacherData(
      currentData,
      configResult.oldLabel,
      configResult.newLabel,
      { adminName, eventAt }
    );

    if (!transformed.changed) continue;

    const d = transformed.data;
    try {
      await updateDoc(userDocRef(uid), {
        classes: d.classes,
        institutes: d.institutes,
        "profile.institutes": d.profile?.institutes ?? [],
        "trash.classes": d.trash?.classes ?? [],
        "trash.notes": d.trash?.notes ?? [],
        "_meta.pendingAdminClassNotices": d._meta?.pendingAdminClassNotices ?? [],
        "_meta.pendingSectionChangeNotice": d._meta?.pendingSectionChangeNotice ?? null,
        "_meta.updatedAt": Date.now(),
        "_meta.source": "adminRenameInstitute",
      });
      affectedTeacherCount += 1;
      if (transformed.noticeAdded) notifiedTeacherCount += 1;
      updatedMainUids.add(uid);
    } catch (error) {
      console.error(`renameGlobalInstitute: failed uid=${uid}`, error);
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

// ── Delete institute completely — wipes all classes/notes from every teacher ──
// Steps:
//   1. Remove from config/institutes list
//   2. Remove sections config for this institute
//   3. For every teacher that has classes under this institute:
//      - hard-delete those classes and their notes docs from appdata
//      - strip institute from teacher's profile.institutes / data.institutes
//      - send a pending notice (institute_deleted kind)
//   4. Remove from teacher index entries
//   5. Add to deletedList for recycle-bin tracking

export async function deleteInstituteCompletely(instituteName, extra = {}) {
  const instLabel = String(instituteName || "").trim();
  if (!instLabel) throw new Error("Institute name is required.");

  const adminName = String(extra.adminName || "Admin").trim() || "Admin";
  const eventAt = Number(extra.eventAt || Date.now());

  // 1. Remove from config/institutes and sections
  const institutesRef = doc(db, "config", "institutes");
  const sectionsRef = doc(db, "config", "sections");
  await runTransaction(db, async tx => {
    const [instSnap, sectSnap] = await Promise.all([tx.get(institutesRef), tx.get(sectionsRef)]);
    const currentList = instSnap.exists() ? (instSnap.data().list || []) : [];
    const currentDeleted = instSnap.exists() ? (instSnap.data().deletedList || []) : [];
    const filtered = currentList.filter(i => normaliseInstituteKey(i) !== normaliseInstituteKey(instLabel));
    const normDel = normaliseInstituteKey(instLabel);
    const newDeleted = currentDeleted.some(i => normaliseInstituteKey(i) === normDel)
      ? currentDeleted
      : [...currentDeleted, instLabel];
    tx.set(institutesRef, { list: filtered, deletedList: newDeleted });

    if (sectSnap.exists()) {
      const sectData = sectSnap.data() || {};
      const matchKey = Object.keys(sectData).find(k => sameInstituteLabel(k, instLabel));
      if (matchKey) {
        const next = { ...sectData };
        delete next[matchKey];
        if (Object.keys(next).length) tx.set(sectionsRef, next);
        else tx.delete(sectionsRef);
      }
    }
  });

  // 2. Walk all teacher main docs and strip classes + notify
  // Use direct updateDoc (targeted field patch) — never touches notes sub-docs
  let affectedTeacherCount = 0;
  const classNotesDeleteQueue = []; // [{uid, classId}]

  const teacherIndexSnap2 = await getDocs(collection(db, "teachers"));
  const allUids = [...new Set(teacherIndexSnap2.docs.map(d => d.id))].filter(Boolean);

  for (const uid of allUids) {
    const mainRef = userDocRef(uid);
    const mainSnap2 = await getDoc(mainRef);
    if (!mainSnap2.exists()) continue;

    const currentData = mainSnap2.data();
    const hasMatch =
      (currentData.classes || []).some(c => sameInstituteLabel(c?.institute, instLabel)) ||
      (currentData.trash?.classes || []).some(c => sameInstituteLabel(c?.institute, instLabel)) ||
      (currentData.institutes || []).some(i => sameInstituteLabel(i, instLabel)) ||
      (currentData.profile?.institutes || []).some(i => sameInstituteLabel(i, instLabel));
    if (!hasMatch) continue;

    const classesToDelete = (currentData.classes || []).filter(c => sameInstituteLabel(c?.institute, instLabel));
    classesToDelete.forEach(c => classNotesDeleteQueue.push({ uid, classId: c.id }));

    const deletedClassIds = new Set(classesToDelete.map(c => c.id));
    const nextClasses = (currentData.classes || []).filter(c => !deletedClassIds.has(c.id));
    const nextTrashClasses = (currentData.trash?.classes || []).filter(c => !sameInstituteLabel(c?.institute, instLabel));
    const nextTrashNotes = (currentData.trash?.notes || []).filter(n => !sameInstituteLabel(n?.institute, instLabel));
    const nextInstitutes = uniqueTrimmed((currentData.institutes || []).filter(i => !sameInstituteLabel(i, instLabel)));
    const nextProfileInstitutes = uniqueTrimmed((currentData.profile?.institutes || []).filter(i => !sameInstituteLabel(i, instLabel)));

    const notice = {
      id: `institute_deleted_${normaliseInstituteKey(instLabel)}_${eventAt}`,
      kind: "institute_deleted",
      classId: "", section: "", institute: "", subject: "",
      adminName, eventAt, promptedAt: null,
      oldInstitute: instLabel, newInstitute: "",
      impactedClassCount: deletedClassIds.size,
    };
    const existingNotices = Array.isArray(currentData?._meta?.pendingAdminClassNotices)
      ? currentData._meta.pendingAdminClassNotices : [];
    const nextNotices = [
      ...existingNotices.filter(n => String(n?.id || "") !== notice.id),
      notice,
    ].slice(-20);

    try {
      await updateDoc(mainRef, {
        classes: nextClasses,
        institutes: nextInstitutes,
        "profile.institutes": nextProfileInstitutes,
        "trash.classes": nextTrashClasses,
        "trash.notes": nextTrashNotes,
        "_meta.pendingAdminClassNotices": nextNotices,
        "_meta.updatedAt": Date.now(),
        "_meta.source": "adminDeleteInstituteCompletely",
      });
      affectedTeacherCount += 1;
    } catch (err) {
      console.error(`deleteInstituteCompletely: failed uid=${uid}`, err);
    }
  }

  // 3. Delete orphaned notes sub-docs
  await Promise.allSettled(
    classNotesDeleteQueue.map(({ uid, classId }) =>
      deleteDoc(doc(db, "users", uid, "appdata", `notes_${classId}`)).catch(() => {})
    )
  );

  // 4. Remove from teacher index
  await removeInstituteFromIndex(instLabel);

  return { affectedTeacherCount, classesDeleted: classNotesDeleteQueue.length };
}

// ── Delete institute and migrate its classes/sections to another institute ────
// If targetInstituteName is null/empty this creates a new entry in config.
// Section configs with the same name are merged; unique ones are carried over.
// Teachers are notified via institute_renamed notice (which has full UI support).

export async function deleteInstituteAndMigrate(fromInstituteName, toInstituteName, extra = {}) {
  const fromLabel = String(fromInstituteName || "").trim();
  const toLabel = String(toInstituteName || "").trim();
  if (!fromLabel) throw new Error("Source institute name is required.");
  if (!toLabel) throw new Error("Target institute name is required.");
  if (sameInstituteLabel(fromLabel, toLabel)) throw new Error("Source and target are the same institute.");

  const adminName = String(extra.adminName || "Admin").trim() || "Admin";
  const eventAt = Number(extra.eventAt || Date.now());

  // Step 1: Rename in config/institutes (adds target if missing) + merge sections
  const institutesRef = doc(db, "config", "institutes");
  const sectionsRef = doc(db, "config", "sections");

  await runTransaction(db, async tx => {
    const [instSnap, sectSnap] = await Promise.all([tx.get(institutesRef), tx.get(sectionsRef)]);
    const currentList = instSnap.exists() ? (instSnap.data().list || []) : [];
    const currentDeleted = instSnap.exists() ? (instSnap.data().deletedList || []) : [];

    // Remove fromLabel, ensure toLabel exists
    const withoutFrom = currentList.filter(i => !sameInstituteLabel(i, fromLabel));
    const targetExists = withoutFrom.some(i => sameInstituteLabel(i, toLabel));
    const nextList = targetExists ? withoutFrom : [...withoutFrom, toLabel];

    // Add fromLabel to deletedList
    const normFrom = normaliseInstituteKey(fromLabel);
    const newDeleted = currentDeleted.some(i => normaliseInstituteKey(i) === normFrom)
      ? currentDeleted
      : [...currentDeleted, fromLabel];

    tx.set(institutesRef, { list: nextList, deletedList: newDeleted });

    // Merge sections config
    if (sectSnap.exists()) {
      const sectData = sectSnap.data() || {};
      const fromKey = Object.keys(sectData).find(k => sameInstituteLabel(k, fromLabel));
      const toKey = Object.keys(sectData).find(k => sameInstituteLabel(k, toLabel));

      if (fromKey) {
        const fromConfig = sectData[fromKey] || {};
        const toConfig = sectData[toKey] || {};
        const next = { ...sectData };
        delete next[fromKey];

        // Merge grade groups: keep toLabel's existing ones, add any from fromLabel that don't conflict by label
        const toGroups = toConfig.gradeGroups || [];
        const fromGroups = fromConfig.gradeGroups || [];
        const toGroupLabels = new Set(toGroups.map(g => (g.label || "").toLowerCase()));
        const mergedGroups = [
          ...toGroups,
          ...fromGroups.filter(g => !toGroupLabels.has((g.label || "").toLowerCase())),
        ];

        // Merge extraSections
        const mergedExtra = uniqueTrimmed([
          ...(toConfig.extraSections || []),
          ...(fromConfig.extraSections || []),
        ]);

        next[toLabel] = {
          ...toConfig,
          ...fromConfig,
          ...toConfig, // toLabel wins on overlapping keys
          gradeGroups: mergedGroups,
          extraSections: mergedExtra,
        };

        if (Object.keys(next).length) tx.set(sectionsRef, next);
        else tx.delete(sectionsRef);
      }
    }
  });

  // Step 2: Rename all teacher data from → to using uid-based fetch
  const teacherIndexSnap3 = await getDocs(collection(db, "teachers"));
  const allUids2 = [...new Set(teacherIndexSnap3.docs.map(d => d.id))].filter(Boolean);
  let affectedTeacherCount = 0;
  let notifiedTeacherCount = 0;
  const updatedUids = new Set();

  for (const uid of allUids2) {
    const mainRef = userDocRef(uid);
    const mainSnap3 = await getDoc(mainRef);
    if (!mainSnap3.exists()) continue;

    let currentData = mainSnap3.data();
    const transformed = applyInstituteRenameToTeacherData(currentData, fromLabel, toLabel, { adminName, eventAt });
    if (!transformed.changed) continue;

    // Override notice kind to institute_deleted_migrated
    const nextNotices = (transformed.data?._meta?.pendingAdminClassNotices || []).map(n => {
      if (n?.kind === "institute_renamed" && sameInstituteLabel(n?.oldInstitute, fromLabel)) {
        return { ...n, kind: "institute_deleted_migrated", oldInstitute: fromLabel, newInstitute: toLabel };
      }
      return n;
    });

    const d = transformed.data;
    try {
      await updateDoc(userDocRef(uid), {
        classes: d.classes,
        institutes: d.institutes,
        "profile.institutes": d.profile?.institutes ?? [],
        "trash.classes": d.trash?.classes ?? [],
        "trash.notes": d.trash?.notes ?? [],
        "_meta.pendingAdminClassNotices": nextNotices,
        "_meta.updatedAt": Date.now(),
        "_meta.source": "adminDeleteInstituteAndMigrate",
      });
      affectedTeacherCount += 1;
      if (transformed.noticeAdded) notifiedTeacherCount += 1;
      updatedUids.add(uid);
    } catch (err) {
      console.error(`deleteInstituteAndMigrate: failed uid=${uid}`, err);
    }
  }

  // Step 3: Update teacher index entries that weren't touched above
  const teacherIndexSnap = await getDocs(collection(db, "teachers"));
  for (const snap of teacherIndexSnap.docs) {
    if (updatedUids.has(snap.id)) continue;
    const curr = uniqueTrimmed(snap.data()?.institutes || []);
    const next = replaceInstituteList(curr, fromLabel, toLabel);
    if (next.length === curr.length && next.every((v, i) => v === curr[i])) continue;
    await setDoc(doc(db, "teachers", snap.id), { institutes: next }, { merge: true });
  }

  return { affectedTeacherCount, notifiedTeacherCount };
}
