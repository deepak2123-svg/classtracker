import { initializeApp } from "firebase/app";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, collection,
  getDocs, query, where, deleteDoc, runTransaction, onSnapshot, orderBy, writeBatch, increment,
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

// ── Teacher feedback and admin replies ───────────────────────────────────────
export function subscribeFeedbackThreads(onChange, onError = console.error) {
  let unsubscribe = null;
  let cancelled = false;
  getCurrentRoleDetails()
    .then(actor => {
      if (cancelled) return;
      const source = actor.role === "group_admin" && actor.groupId
        ? query(collection(db, "feedbackThreads"), where("groupId", "==", actor.groupId))
        : actor.role === "institute_admin" && actor.instituteId
          ? query(collection(db, "feedbackThreads"), where("instituteIds", "array-contains", actor.instituteId))
          : query(collection(db, "feedbackThreads"), orderBy("updatedAt", "desc"));
      unsubscribe = onSnapshot(
        source,
        snapshot => {
          const items = snapshot.docs
            .map(item => ({ id: item.id, ...item.data() }))
            .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
          onChange(items);
        },
        onError,
      );
      if (cancelled && unsubscribe) unsubscribe();
    })
    .catch(onError);
  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}

export function subscribeFeedbackMessages(uid, onChange, onError = console.error) {
  const messagesQuery = query(
    collection(db, "feedbackThreads", uid, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    messagesQuery,
    snapshot => {
      onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export async function sendAdminFeedbackReply(uid, admin, body) {
  const message = String(body || "").trim();
  if (!message) throw new Error("Write a reply before sending.");
  if (message.length > 2000) throw new Error("Replies must be 2000 characters or fewer.");

  const now = Date.now();
  const threadRef = doc(db, "feedbackThreads", uid);
  const messageRef = doc(collection(db, "feedbackThreads", uid, "messages"));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    senderUid: admin?.uid || "",
    senderRole: "admin",
    senderName: admin?.displayName || admin?.email || "Admin",
    body: message,
    createdAt: now,
  });
  batch.set(threadRef, {
    status: "open",
    lastMessage: message.slice(0, 160),
    lastSenderRole: "admin",
    updatedAt: now,
    unreadByAdmin: 0,
    unreadByTeacher: increment(1),
  }, { merge: true });
  await batch.commit();
}

export async function markFeedbackThreadRead(uid) {
  await setDoc(
    doc(db, "feedbackThreads", uid),
    { unreadByAdmin: 0 },
    { merge: true },
  );
}

export async function setFeedbackThreadStatus(uid, status) {
  const nextStatus = status === "resolved" ? "resolved" : "open";
  await setDoc(
    doc(db, "feedbackThreads", uid),
    { status: nextStatus, updatedAt: Date.now() },
    { merge: true },
  );
}

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

function normalisePersonKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normaliseEmailKey(value) {
  return String(value || "").trim().toLowerCase();
}

function removedTeacherRecordFromSources(uid, sources = {}, extra = {}) {
  const main = sources.main || {};
  const index = sources.index || {};
  const name = String(main?.profile?.name || index?.name || extra.name || "").trim();
  const email = String(main?.profile?.email || index?.email || extra.email || "").trim();
  const institutes = uniqueTrimmed([
    ...(Array.isArray(index?.institutes) ? index.institutes : []),
    ...(Array.isArray(main?.institutes) ? main.institutes : []),
    ...(Array.isArray(main?.profile?.institutes) ? main.profile.institutes : []),
    ...(Array.isArray(main?.classes) ? main.classes.map(c => c?.institute) : []),
  ]);
  return {
    uid:String(uid || "").trim(),
    name,
    email,
    nameKey:normalisePersonKey(name),
    emailKey:normaliseEmailKey(email),
    instituteKeys:institutes.map(normaliseInstituteKey).filter(Boolean),
    removedAt:Number(extra.removedAt || Date.now()),
    removedBy:String(extra.removedBy || "").trim(),
  };
}

function removedTeacherConfigMeta(raw = {}) {
  const ids = new Set(
    Array.isArray(raw.ids)
      ? raw.ids.map(uid => String(uid || "").trim()).filter(Boolean)
      : []
  );
  const emails = new Set(
    [
      ...(Array.isArray(raw.emails) ? raw.emails : []),
      ...(Array.isArray(raw.profiles) ? raw.profiles.map(item => item?.emailKey || item?.email) : []),
    ].map(normaliseEmailKey).filter(Boolean)
  );
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : [])
    .map(item => ({
      uid:String(item?.uid || "").trim(),
      nameKey:normalisePersonKey(item?.nameKey || item?.name),
      emailKey:normaliseEmailKey(item?.emailKey || item?.email),
      instituteKeys:Array.isArray(item?.instituteKeys)
        ? item.instituteKeys.map(normaliseInstituteKey).filter(Boolean)
        : [],
    }))
    .filter(item => item.uid || item.nameKey || item.emailKey);
  return { ids, emails, profiles };
}

function teacherSummaryIdentity(teacher = {}) {
  const institutes = uniqueTrimmed(teacher.institutes || []);
  return {
    uid:String(teacher.uid || "").trim(),
    nameKey:normalisePersonKey(teacher.name),
    emailKey:normaliseEmailKey(teacher.email),
    instituteKeys:institutes.map(normaliseInstituteKey).filter(Boolean),
  };
}

function isRemovedTeacherSummary(teacher, removedMeta) {
  const identity = teacherSummaryIdentity(teacher);
  if(identity.uid && removedMeta.ids.has(identity.uid)) return true;
  if(identity.emailKey && removedMeta.emails.has(identity.emailKey)) return true;
  if(identity.emailKey || !identity.nameKey) return false;
  return removedMeta.profiles.some(profile => {
    if(profile.emailKey || profile.nameKey !== identity.nameKey) return false;
    if(!profile.instituteKeys.length || !identity.instituteKeys.length) return true;
    return profile.instituteKeys.some(key => identity.instituteKeys.includes(key));
  });
}

function suppressShadowTeacherDuplicates(rows) {
  const withEmailByName = new Map();
  rows.forEach(row => {
    const identity = teacherSummaryIdentity(row);
    if(!identity.nameKey || !identity.emailKey) return;
    const list = withEmailByName.get(identity.nameKey) || [];
    list.push({ row, identity });
    withEmailByName.set(identity.nameKey, list);
  });
  return rows.filter(row => {
    const identity = teacherSummaryIdentity(row);
    if(!identity.nameKey || identity.emailKey) return true;
    const namedEmailRows = withEmailByName.get(identity.nameKey) || [];
    if(!namedEmailRows.length) return true;
    return !namedEmailRows.some(item => {
      if(!identity.instituteKeys.length || !item.identity.instituteKeys.length) return true;
      return identity.instituteKeys.some(key => item.identity.instituteKeys.includes(key));
    });
  });
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

function isActiveTeacherClassRecord(cls) {
  if (!cls || typeof cls !== "object") return false;
  if (cls.left || cls.archived || cls.archivedByAdmin || cls.transferArchive) return false;
  const deletedAt = Number(cls.deletedAt || 0) || 0;
  return deletedAt <= 0;
}

function buildTeacherIndexPayload(uid, data) {
  const classes = Array.isArray(data?.classes) ? data.classes.filter(isActiveTeacherClassRecord) : [];
  const classInstitutes = uniqueTrimmed(classes.map(c => c?.institute));
  const profileInstitutes = uniqueTrimmed(Array.isArray(data?.profile?.institutes) ? data.profile.institutes : []);
  const classSubjects = uniqueTrimmed(classes.map(c => c?.subject));
  const profileSubjects = uniqueTrimmed(Array.isArray(data?.profile?.subjects) ? data.profile.subjects : []);
  const institutes = classInstitutes.length ? classInstitutes : profileInstitutes;
  const subjects = classSubjects.length ? classSubjects : profileSubjects;
  return {
    uid,
    name: data?.profile?.name || "",
    email: data?.profile?.email || "",
    institutes,
    subjects,
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

// ── Tenant and role system ────────────────────────────────────────────────────
// Public roles: manager | group_admin | institute_admin | teacher.
// Legacy "admin" records remain valid during the Genesis migration.
export const ADMIN_ROLE_NAMES = Object.freeze(["admin", "group_admin", "institute_admin"]);
export const PORTAL_ROLE_NAMES = Object.freeze(["manager", ...ADMIN_ROLE_NAMES]);

export function isAdminRole(role) {
  const roleName = String(role || "");
  return roleName === "manager" || ADMIN_ROLE_NAMES.includes(roleName);
}

export function isPortalRole(role) {
  return PORTAL_ROLE_NAMES.includes(String(role || ""));
}

export function roleDocRef(uid) { return doc(db, "roles", uid); }

export async function getUserRoleDetails(uid) {
  try {
    const snap = await getDoc(roleDocRef(uid));
    return snap.exists() ? { uid, ...snap.data() } : { uid, role: "teacher" };
  } catch {
    return { uid, role: "teacher" };
  }
}

export async function getUserRole(uid) {
  const details = await getUserRoleDetails(uid);
  return details.role || "teacher";
}

async function getCurrentRoleDetails() {
  const uid = auth.currentUser?.uid;
  return uid ? getUserRoleDetails(uid) : { uid: "", role: "teacher" };
}

function randomToken(byteLength = 24, maxLength = 40) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes)
    .map(byte => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, maxLength);
}

function normaliseGroupKind(kind) {
  return kind === "single" ? "single" : "group";
}

function normaliseInstituteCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function generateInstituteCode() {
  return `LDG-${randomToken(6, 8).toUpperCase()}`;
}

function membershipDocId(uid, instituteId) {
  return `${String(uid || "").trim()}_${String(instituteId || "").trim()}`;
}

async function assertManagerAccess() {
  const actor = await getCurrentRoleDetails();
  if (!["manager", "admin"].includes(actor.role)) {
    throw new Error("Manager access is required.");
  }
  return actor;
}

async function assertCanManageGroup(groupId) {
  const actor = await getCurrentRoleDetails();
  const allowed = actor.role === "manager"
    || actor.role === "admin"
    || (actor.role === "group_admin" && actor.groupId === groupId);
  if (!allowed) throw new Error("You do not have access to manage this group.");
  return actor;
}

async function assertCanManageInstitute(groupId, instituteId) {
  const actor = await getCurrentRoleDetails();
  const allowed = actor.role === "manager"
    || actor.role === "admin"
    || (actor.role === "group_admin" && actor.groupId === groupId)
    || (
      actor.role === "institute_admin"
      && actor.groupId === groupId
      && actor.instituteId === instituteId
    );
  if (!allowed) throw new Error("You do not have access to manage this institute.");
  return actor;
}

async function ensureUniqueInstituteName(name, excludeInstituteId = "", options = {}) {
  const nameKey = normaliseInstituteKey(name);
  if (!nameKey) throw new Error("Enter an institute name.");
  const actor = options.actor || await getCurrentRoleDetails();
  const canQueryAllInstitutes = actor.role === "manager" || actor.role === "admin";
  const scopeGroupId = String(options.groupId || actor.groupId || "").trim();
  if (!canQueryAllInstitutes && !scopeGroupId) {
    throw new Error("Choose a group before creating an institute.");
  }
  const source = canQueryAllInstitutes
    ? query(collection(db, "institutes"), where("nameKey", "==", nameKey))
    : query(collection(db, "institutes"), where("groupId", "==", scopeGroupId));
  const snap = await getDocs(source);
  const duplicate = snap.docs.find(item => {
    const data = item.data() || {};
    return item.id !== excludeInstituteId
      && data.status !== "deleted"
      && normaliseInstituteKey(data.name || data.legacyName || "") === nameKey;
  });
  if (duplicate) {
    throw new Error("That institute name is already in use. Institute names must remain unique during the legacy transition.");
  }
}

async function createInstituteRecord({
  groupId,
  name,
  createdBy,
  legacyName = "",
  legacyAliases = [],
  sortOrder = null,
  actor = null,
}) {
  const label = String(name || "").trim();
  if (!label) throw new Error("Enter an institute name.");
  await ensureUniqueInstituteName(label, "", { groupId, actor });

  let instituteCode = generateInstituteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codeSnap = await getDoc(doc(db, "instituteCodes", instituteCode));
    if (!codeSnap.exists()) break;
    instituteCode = generateInstituteCode();
  }

  const now = Date.now();
  const instituteRef = doc(collection(db, "institutes"));
  const payload = {
    groupId,
    name: label,
    nameKey: normaliseInstituteKey(label),
    instituteCode,
    status: "active",
    legacyName: String(legacyName || "").trim(),
    legacyNameKey: normaliseInstituteKey(legacyName || label),
    legacyAliases: uniqueTrimmed(legacyAliases),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : null,
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
    schemaVersion: 1,
  };
  const batch = writeBatch(db);
  batch.set(instituteRef, payload);
  batch.set(doc(db, "instituteCodes", instituteCode), {
    groupId,
    instituteId: instituteRef.id,
    instituteName: label,
    status: "active",
    createdAt: now,
  });
  await batch.commit();
  return { id: instituteRef.id, ...payload };
}

export async function createGroupStructure({ name, kind = "group", initialInstituteNames = [] }, managerUid = "") {
  const actor = await assertManagerAccess();
  const label = String(name || "").trim();
  if (!label) throw new Error("Enter a group or institute name.");

  const groupKind = normaliseGroupKind(kind);
  const now = Date.now();
  const groupRef = doc(collection(db, "groups"));
  const creatorUid = managerUid || actor.uid;
  const group = {
    name: label,
    nameKey: normaliseInstituteKey(label),
    kind: groupKind,
    status: "active",
    createdAt: now,
    createdBy: creatorUid,
    updatedAt: now,
    updatedBy: creatorUid,
    schemaVersion: 1,
  };
  await setDoc(groupRef, group);
  await setDoc(doc(db, "config", "tenantArchitecture"), {
    enabled: true,
    schemaVersion: 1,
    updatedAt: now,
    updatedBy: creatorUid,
  }, { merge: true });

  const requestedInstitutes = groupKind === "single"
    ? [label]
    : uniqueTrimmed(initialInstituteNames);
  const institutes = [];
  for (const instituteName of requestedInstitutes) {
    institutes.push(await createInstituteRecord({
      groupId: groupRef.id,
      name: instituteName,
      createdBy: creatorUid,
      actor,
    }));
  }
  return { group: { id: groupRef.id, ...group }, institutes };
}

export async function createTenantInstitute({ groupId, name }, actorUid = "") {
  const actor = await assertCanManageGroup(groupId);
  return createInstituteRecord({
    groupId,
    name,
    createdBy: actorUid || actor.uid,
    actor,
  });
}

export async function getTenantGroups() {
  const snap = await getDocs(collection(db, "groups"));
  return snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.status !== "deleted")
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

export async function getTenantInstitutes(groupId = "") {
  const source = groupId
    ? query(collection(db, "institutes"), where("groupId", "==", groupId))
    : collection(db, "institutes");
  const snap = await getDocs(source);
  return snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.status !== "deleted")
    .sort((a, b) => {
      const aOrder = a.sortOrder !== null && a.sortOrder !== undefined && Number.isFinite(Number(a.sortOrder))
        ? Number(a.sortOrder)
        : Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder !== null && b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))
        ? Number(b.sortOrder)
        : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
}

async function getVisibleTenantInstituteRecords(roleDetails = null) {
  const role = roleDetails || await getCurrentRoleDetails();
  if (role.role === "manager" || role.role === "admin") {
    return getTenantInstitutes();
  }
  if (role.role === "group_admin" && role.groupId) {
    return getTenantInstitutes(role.groupId);
  }
  if (role.role === "institute_admin" && role.instituteId) {
    const snap = await getDoc(doc(db, "institutes", role.instituteId));
    return snap.exists() && snap.data()?.status !== "deleted"
      ? [{ id: snap.id, ...snap.data() }]
      : [];
  }
  return [];
}

export async function getTeacherMemberships(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "memberships"), where("userId", "==", uid)));
  return snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.status === "approved");
}

export async function getTeacherAllowedInstituteRecords(uid) {
  const memberships = await getTeacherMemberships(uid);
  const records = await Promise.all(
    memberships.map(async membership => {
      const snap = await getDoc(doc(db, "institutes", membership.instituteId));
      return snap.exists() && snap.data()?.status !== "deleted"
        ? {
            id: snap.id,
            membershipId: membership.id,
            membershipLegacyOrder: membership.legacyOrder,
            ...snap.data(),
          }
        : null;
    })
  );
  return records
    .filter(Boolean)
    .sort((a, b) => {
      const aMembershipOrder = a.membershipLegacyOrder !== null
        && a.membershipLegacyOrder !== undefined
        && Number.isFinite(Number(a.membershipLegacyOrder))
        ? Number(a.membershipLegacyOrder)
        : Number.MAX_SAFE_INTEGER;
      const bMembershipOrder = b.membershipLegacyOrder !== null
        && b.membershipLegacyOrder !== undefined
        && Number.isFinite(Number(b.membershipLegacyOrder))
        ? Number(b.membershipLegacyOrder)
        : Number.MAX_SAFE_INTEGER;
      if (aMembershipOrder !== bMembershipOrder) return aMembershipOrder - bMembershipOrder;
      const aOrder = a.sortOrder !== null && a.sortOrder !== undefined && Number.isFinite(Number(a.sortOrder))
        ? Number(a.sortOrder)
        : Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder !== null && b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))
        ? Number(b.sortOrder)
        : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
}

export async function getTeacherAllowedInstitutes(uid) {
  const records = await getTeacherAllowedInstituteRecords(uid);
  if (records.length) return uniqueTrimmed(records.map(item => item.name));

  const architectureSnap = await getDoc(doc(db, "config", "tenantArchitecture")).catch(() => null);
  if (architectureSnap?.exists() && architectureSnap.data()?.enabled === true) return [];
  return readLegacyGlobalInstitutes();
}

export async function promoteToAdmin(uid, grantedByUid, adminMode = "admin_only") {
  const mode = adminMode === "admin_teacher" ? "admin_teacher" : "admin_only";
  const actor = await getUserRoleDetails(grantedByUid);
  let nextRole = "admin";
  const scope = {};
  if (actor.role === "group_admin") {
    nextRole = "group_admin";
    scope.groupId = actor.groupId || "";
  } else if (actor.role === "institute_admin") {
    nextRole = "institute_admin";
    scope.groupId = actor.groupId || "";
    scope.instituteId = actor.instituteId || "";
    scope.instituteIds = actor.instituteId ? [actor.instituteId] : [];
  }
  const payload = {
    role: nextRole,
    adminMode: mode,
    teaches: mode === "admin_teacher",
    grantedAt: Date.now(),
    grantedBy: grantedByUid,
    ...scope,
  };
  await setDoc(roleDocRef(uid), payload, { merge: true });
  return { uid, ...payload };
}

export async function demoteToTeacher(uid, demotedByUid = null) {
  const now = Date.now();
  await setDoc(roleDocRef(uid), {
    role: "teacher",
    adminMode: "teacher",
    teaches: true,
    demotedAt: now,
    demotedBy: demotedByUid || null,
    updatedAt: now,
  }, { merge: true });
}

export async function setAdminTeachingMode(uid, adminMode, updatedByUid = null) {
  const mode = adminMode === "admin_teacher" ? "admin_teacher" : "admin_only";
  const now = Date.now();
  const existing = await getUserRoleDetails(uid);
  await setDoc(roleDocRef(uid), {
    role: isAdminRole(existing.role) ? existing.role : "admin",
    adminMode: mode,
    teaches: mode === "admin_teacher",
    updatedAt: now,
    updatedBy: updatedByUid || null,
  }, { merge: true });
}

function removedTeachersConfigRef() {
  return doc(db, "config", "removedTeachers");
}

// ── Teacher index (for admin discovery) ───────────────────────────────────────
// teachers/{uid} = { uid, name, email, photoURL, institutes[], lastActive }
export async function syncTeacherIndex(uid, data) {
  if (!data?.profile?.name) return;
  try {
    const memberships = await getTeacherMemberships(uid).catch(() => []);
    await setDoc(doc(db, "teachers", uid), {
      ...buildTeacherIndexPayload(uid, data),
      name: data.profile.name,
      groupIds: uniqueTrimmed(memberships.map(item => item.groupId)),
      instituteIds: uniqueTrimmed(memberships.map(item => item.instituteId)),
      ...buildTeacherIdentityPatch(uid),
    }, { merge: true });
  } catch { /* silent fail — admin feature optional */ }
}

// ── Admin data reads ──────────────────────────────────────────────────────────
export async function getAllTeachers() {
  try {
    const actor = await getCurrentRoleDetails();
    const teacherSource = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "teachers"), where("groupIds", "array-contains", actor.groupId))
      : actor.role === "institute_admin" && actor.instituteId
        ? query(collection(db, "teachers"), where("instituteIds", "array-contains", actor.instituteId))
        : collection(db, "teachers");
    const rolesSource = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "roles"), where("groupId", "==", actor.groupId))
      : actor.role === "institute_admin" && actor.instituteId
        ? query(collection(db, "roles"), where("instituteIds", "array-contains", actor.instituteId))
        : collection(db, "roles");
    const [removedConfigSnap, teacherIndexSnap, rolesSnap] = await Promise.all([
      getDoc(removedTeachersConfigRef()),
      getDocs(teacherSource),
      getDocs(rolesSource),
    ]);

    const removedMeta = removedTeacherConfigMeta(removedConfigSnap.data() || {});

    // Primary: teacher index (has institute/class summary)
    const indexed = teacherIndexSnap.docs
      .map(d => d.data())
      .filter(teacher => teacher?.uid && !isRemovedTeacherSummary(teacher, removedMeta));
    const merged = new Map(indexed.map(t => [t.uid, t]));

    // Supplement: roles collection catches teachers not yet in index
    rolesSnap.docs.forEach(d => {
      if (removedMeta.ids.has(d.id)) return;
      if (!merged.has(d.id)) {
        merged.set(d.id, { uid: d.id, name: "", institutes: [], classCount: 0 });
      }
    });

    if (!["group_admin", "institute_admin"].includes(actor.role)) try {
      const appdataSnap = await getDocs(query(collectionGroup(db, "appdata"), where(documentId(), "==", "main")));
      appdataSnap.docs.forEach(snap => {
        const uid = snap.ref.parent.parent?.id;
        if (!uid) return;
        if (removedMeta.ids.has(uid)) return;
        const data = snap.data();
        const summary = buildTeacherIndexPayload(uid, data);
        if (!summary.name && summary.classCount === 0) return;
        if (isRemovedTeacherSummary(summary, removedMeta)) return;
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

    return suppressShadowTeacherDuplicates(
      Array.from(merged.values()).filter(teacher => !isRemovedTeacherSummary(teacher, removedMeta))
    );
  } catch { return []; }
}

export async function getTeacherFullData(uid) {
  // Reuse loadUserData which handles the split-doc architecture
  return loadUserData(uid);
}

async function getAllTeacherMainDocUids() {
  const uids = new Set();
  try {
    const teacherIndexSnap = await getDocs(collection(db, "teachers"));
    teacherIndexSnap.docs.forEach(d => { if(d.id) uids.add(d.id); });
  } catch {}
  try {
    const appdataSnap = await getDocs(query(collectionGroup(db, "appdata"), where(documentId(), "==", "main")));
    appdataSnap.docs.forEach(snap => {
      const uid = snap.ref.parent.parent?.id;
      if(uid) uids.add(uid);
    });
  } catch {}
  return Array.from(uids).filter(Boolean);
}

export async function getAllRoles() {
  const details = await getAllRoleDetails();
  return Object.fromEntries(
    Object.entries(details).map(([uid, item]) => [uid, item?.role || "teacher"])
  );
}

export async function getAllRoleDetails() {
  try {
    const actor = await getCurrentRoleDetails();
    const source = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "roles"), where("groupId", "==", actor.groupId))
      : actor.role === "institute_admin" && actor.instituteId
        ? query(collection(db, "roles"), where("instituteIds", "array-contains", actor.instituteId))
        : collection(db, "roles");
    const snap = await getDocs(source);
    const map = {};
    snap.docs.forEach(d => { map[d.id] = { uid:d.id, ...d.data() }; });
    return map;
  } catch { return {}; }
}

// ── Scoped invite links ───────────────────────────────────────────────────────
export async function createScopedInvite({
  inviteType,
  groupId = "",
  instituteId = "",
  createdBy,
  maxUses = 1,
  expiresInDays = 7,
}) {
  const actor = await getUserRoleDetails(createdBy);
  const type = String(inviteType || "").trim();
  if (!["admin", "group_admin", "institute_admin", "teacher"].includes(type)) {
    throw new Error("Choose a valid invite role.");
  }

  if (type === "group_admin") {
    if (!groupId) throw new Error("Choose a group for this invite.");
    await assertCanManageGroup(groupId);
  } else if (type === "institute_admin" || type === "teacher") {
    if (!groupId || !instituteId) throw new Error("Choose an institute for this invite.");
    await assertCanManageInstitute(groupId, instituteId);
  } else if (actor.role !== "admin") {
    throw new Error("Legacy admin invites can only be created by a legacy admin.");
  }

  const token = randomToken(24, 32);
  const now = Date.now();
  await setDoc(doc(db, "invites", token), {
    inviteType: type,
    role: type === "teacher" ? "teacher" : type,
    groupId,
    instituteId,
    createdAt: now,
    createdBy,
    expiresAt: now + Math.max(1, Number(expiresInDays) || 7) * 24 * 60 * 60 * 1000,
    maxUses: Math.max(1, Number(maxUses) || 1),
    useCount: 0,
    used: false,
    status: "active",
  });
  return token;
}

async function findVisibleInstituteByName(actor, instituteName) {
  const visible = await getVisibleTenantInstituteRecords(actor);
  const institute = visible.find(item => sameInstituteLabel(item.name, instituteName));
  if (!institute) throw new Error("Choose an institute inside your access scope.");
  return institute;
}

export async function createInviteLink(adminUid, options = {}) {
  const actor = await getUserRoleDetails(adminUid);
  const requestedType = String(options.inviteType || "").trim();
  if (requestedType === "admin") {
    return createScopedInvite({ inviteType: "admin", createdBy: adminUid });
  }
  if (actor.role === "group_admin") {
    if (requestedType === "institute_admin") {
      const institute = await findVisibleInstituteByName(actor, options.instituteName);
      return createScopedInvite({
        inviteType: "institute_admin",
        groupId: actor.groupId,
        instituteId: institute.id,
        createdBy: adminUid,
      });
    }
    return createScopedInvite({
      inviteType: "group_admin",
      groupId: actor.groupId,
      createdBy: adminUid,
    });
  }
  if (actor.role === "institute_admin") {
    return createScopedInvite({
      inviteType: "institute_admin",
      groupId: actor.groupId,
      instituteId: actor.instituteId,
      createdBy: adminUid,
    });
  }
  if (requestedType === "group_admin") {
    const groupId = String(options.groupId || "").trim();
    if (groupId) {
      return createScopedInvite({
        inviteType: "group_admin",
        groupId,
        createdBy: adminUid,
      });
    }
    const institute = await findVisibleInstituteByName(actor, options.instituteName);
    if (!institute.groupId) throw new Error("This institute is missing its group scope.");
    return createScopedInvite({
      inviteType: "group_admin",
      groupId: institute.groupId,
      createdBy: adminUid,
    });
  }
  if (requestedType === "institute_admin") {
    const institute = await findVisibleInstituteByName(actor, options.instituteName);
    return createScopedInvite({
      inviteType: "institute_admin",
      groupId: institute.groupId,
      instituteId: institute.id,
      createdBy: adminUid,
    });
  }
  return createScopedInvite({ inviteType: "admin", createdBy: adminUid });
}

export async function createTeacherInviteForInstitute({ instituteName, createdBy, maxUses = 1 }) {
  const actor = await getUserRoleDetails(createdBy);
  const institute = await findVisibleInstituteByName(actor, instituteName);
  return createTeacherInviteLink({
    groupId: institute.groupId,
    instituteId: institute.id,
    createdBy,
    maxUses,
  });
}

export async function createTeacherInviteLink({ groupId, instituteId, createdBy, maxUses = 1 }) {
  return createScopedInvite({
    inviteType: "teacher",
    groupId,
    instituteId,
    createdBy,
    maxUses,
  });
}

export async function verifyInviteToken(token) {
  const snap = await getDoc(doc(db, "invites", token));
  if (!snap.exists()) throw new Error("Invalid invite link.");
  const d = snap.data();
  if (d.status === "revoked") throw new Error("This invite link has been revoked.");
  if (d.used || Number(d.useCount || 0) >= Number(d.maxUses || 1)) {
    throw new Error("This invite link has already been used.");
  }
  if (Date.now() > d.expiresAt) throw new Error("This invite link has expired.");
  return { token, ...d };
}

export async function useInviteToken(token, uid) {
  const inviteRef = doc(db, "invites", token);
  const roleRef = doc(db, "roles", uid);
  const result = await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Invalid invite link.");
    const existingRoleSnap = await tx.get(roleRef);

    const invite = inviteSnap.data() || {};
    if (Date.now() > invite.expiresAt) throw new Error("This invite link has expired.");
    if (invite.status === "revoked") throw new Error("This invite link has been revoked.");
    const maxUses = Math.max(1, Number(invite.maxUses || 1));
    const useCount = Math.max(0, Number(invite.useCount || 0));
    if ((invite.used || useCount >= maxUses) && invite.usedBy !== uid && invite.lastUsedBy !== uid) {
      throw new Error("This invite link has already been used.");
    }

    const now = Date.now();
    const nextUseCount = invite.usedBy === uid || invite.lastUsedBy === uid
      ? useCount
      : useCount + 1;
    tx.set(inviteRef, {
      used: nextUseCount >= maxUses,
      usedBy: maxUses === 1 ? uid : (invite.usedBy || ""),
      usedAt: maxUses === 1 ? now : (invite.usedAt || 0),
      useCount: nextUseCount,
      lastUsedBy: uid,
      lastUsedAt: now,
    }, { merge: true });

    const inviteType = String(invite.inviteType || invite.role || "admin");
    if (inviteType === "teacher") {
      if (!invite.groupId || !invite.instituteId) {
        throw new Error("This teacher invite is missing its institute scope.");
      }
      const existingRole = existingRoleSnap.exists() ? (existingRoleSnap.data() || {}) : {};
      if (existingRole.groupId && existingRole.groupId !== invite.groupId) {
        throw new Error("A teacher account cannot belong to institutes in different groups.");
      }
      const instituteIds = uniqueTrimmed([
        ...(Array.isArray(existingRole.instituteIds) ? existingRole.instituteIds : []),
        invite.instituteId,
      ]);
      tx.set(doc(db, "memberships", membershipDocId(uid, invite.instituteId)), {
        userId: uid,
        groupId: invite.groupId,
        instituteId: invite.instituteId,
        role: "teacher",
        status: "approved",
        source: "invite",
        inviteToken: token,
        approvedAt: now,
        approvedBy: invite.createdBy || "",
        createdAt: now,
      }, { merge: true });
      if (!isAdminRole(existingRole.role) && existingRole.role !== "manager") {
        tx.set(roleRef, {
          role: "teacher",
          groupId: invite.groupId,
          instituteIds,
          teaches: true,
          inviteToken: token,
          updatedAt: now,
        }, { merge: true });
      }
      return {
        role: existingRole.role || "teacher",
        inviteType,
        groupId: invite.groupId,
        instituteId: invite.instituteId,
      };
    }

    const role = ["group_admin", "institute_admin"].includes(inviteType) ? inviteType : "admin";
    tx.set(roleRef, {
      role,
      groupId: invite.groupId || "",
      instituteId: invite.instituteId || "",
      instituteIds: invite.instituteId ? [invite.instituteId] : [],
      adminMode: "admin_only",
      teaches: false,
      grantedAt: now,
      grantedBy: invite.createdBy || "invite-link",
      inviteToken: token,
    }, { merge: true });
    return {
      role,
      inviteType,
      groupId: invite.groupId || "",
      instituteId: invite.instituteId || "",
    };
  });
  return result;
}

export async function getInvites(adminUid) {
  try {
    const actor = await getUserRoleDetails(adminUid);
    const source = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "invites"), where("groupId", "==", actor.groupId))
      : actor.role === "institute_admin" && actor.instituteId
        ? query(collection(db, "invites"), where("instituteId", "==", actor.instituteId))
        : collection(db, "invites");
    const snap = await getDocs(source);
    return snap.docs.map(d => ({ token: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch { return []; }
}

// ── Teacher memberships and join requests ────────────────────────────────────
export async function requestTeacherJoinByInstituteCode(uid, code) {
  const instituteCode = normaliseInstituteCode(code);
  if (!instituteCode) throw new Error("Enter the private Institute ID.");

  const codeSnap = await getDoc(doc(db, "instituteCodes", instituteCode));
  if (!codeSnap.exists() || codeSnap.data()?.status === "deleted") {
    throw new Error("That Institute ID is not valid.");
  }
  const codeData = codeSnap.data() || {};
  const institute = {
    id: String(codeData.instituteId || "").trim(),
    groupId: String(codeData.groupId || "").trim(),
    name: String(codeData.instituteName || "").trim(),
    instituteCode,
    status: codeData.status || "active",
  };
  if (!institute.id || !institute.groupId || !institute.name) {
    throw new Error("That Institute ID is incomplete. Ask an admin to create a new invite or code.");
  }
  const existingMembership = await getDoc(doc(db, "memberships", membershipDocId(uid, institute.id)));
  if (existingMembership.exists() && existingMembership.data()?.status === "approved") {
    return { status: "approved", institute };
  }

  const role = await getUserRoleDetails(uid);
  if (role.groupId && role.groupId !== institute.groupId) {
    throw new Error("Your teacher account is already assigned to a different group of institutes.");
  }

  const now = Date.now();
  const requestId = membershipDocId(uid, institute.id);
  const currentUser = auth.currentUser;
  await setDoc(doc(db, "joinRequests", requestId), {
    userId: uid,
    teacherName: currentUser?.displayName || "",
    teacherEmail: currentUser?.email || "",
    groupId: institute.groupId,
    instituteId: institute.id,
    instituteName: institute.name,
    instituteCode,
    requestedRole: "teacher",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  if (!isAdminRole(role.role) && role.role !== "manager") {
    await setDoc(roleDocRef(uid), {
      role: "teacher",
      groupId: role.groupId || institute.groupId,
      instituteIds: Array.isArray(role.instituteIds) ? role.instituteIds : [],
      teaches: true,
      updatedAt: now,
    }, { merge: true });
  }
  return { status: "pending", institute, requestId };
}

export async function getPendingJoinRequests() {
  const actor = await getCurrentRoleDetails();
  let source;
  if (actor.role === "group_admin" && actor.groupId) {
    source = query(collection(db, "joinRequests"), where("groupId", "==", actor.groupId));
  } else if (actor.role === "institute_admin" && actor.groupId && actor.instituteId) {
    source = query(
      collection(db, "joinRequests"),
      where("groupId", "==", actor.groupId),
      where("instituteId", "==", actor.instituteId),
    );
  } else if (["manager", "admin"].includes(actor.role)) {
    source = collection(db, "joinRequests");
  } else {
    return [];
  }
  const snap = await getDocs(source);
  return snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.status === "pending")
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

export async function approveTeacherJoinRequest(requestId, approvedByUid) {
  const requestRef = doc(db, "joinRequests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("This join request no longer exists.");
  const request = requestSnap.data() || {};
  await assertCanManageInstitute(request.groupId, request.instituteId);

  const roleRef = roleDocRef(request.userId);
  const membershipRef = doc(db, "memberships", membershipDocId(request.userId, request.instituteId));
  const now = Date.now();
  await runTransaction(db, async tx => {
    const [latestRequestSnap, roleSnap] = await Promise.all([
      tx.get(requestRef),
      tx.get(roleRef),
    ]);
    if (!latestRequestSnap.exists() || latestRequestSnap.data()?.status !== "pending") {
      throw new Error("This join request has already been resolved.");
    }
    const currentRole = roleSnap.exists() ? (roleSnap.data() || {}) : {};
    if (currentRole.groupId && currentRole.groupId !== request.groupId) {
      throw new Error("This teacher now belongs to a different group.");
    }
    const instituteIds = uniqueTrimmed([
      ...(Array.isArray(currentRole.instituteIds) ? currentRole.instituteIds : []),
      request.instituteId,
    ]);
    tx.set(membershipRef, {
      userId: request.userId,
      groupId: request.groupId,
      instituteId: request.instituteId,
      role: "teacher",
      status: "approved",
      source: "join_request",
      approvedAt: now,
      approvedBy: approvedByUid,
      createdAt: Number(request.createdAt || now),
    }, { merge: true });
    if (!isAdminRole(currentRole.role) && currentRole.role !== "manager") {
      tx.set(roleRef, {
        role: "teacher",
        groupId: request.groupId,
        instituteIds,
        teaches: true,
        updatedAt: now,
      }, { merge: true });
    }
    tx.set(requestRef, {
      status: "approved",
      approvedAt: now,
      approvedBy: approvedByUid,
      updatedAt: now,
    }, { merge: true });
  });
  return { id: requestId, ...request, status: "approved" };
}

export async function rejectTeacherJoinRequest(requestId, rejectedByUid) {
  const requestRef = doc(db, "joinRequests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("This join request no longer exists.");
  const request = requestSnap.data() || {};
  await assertCanManageInstitute(request.groupId, request.instituteId);
  await setDoc(requestRef, {
    status: "rejected",
    rejectedAt: Date.now(),
    rejectedBy: rejectedByUid,
    updatedAt: Date.now(),
  }, { merge: true });
}

// ── Manager dashboard ────────────────────────────────────────────────────────
export async function getManagerDashboard() {
  await assertManagerAccess();
  const [groups, institutes, rolesSnap, membershipsSnap] = await Promise.all([
    getTenantGroups(),
    getTenantInstitutes(),
    getDocs(collection(db, "roles")),
    getDocs(collection(db, "memberships")),
  ]);
  const roles = rolesSnap.docs.map(item => ({ uid: item.id, ...item.data() }));
  const memberships = membershipsSnap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.status === "approved");

  const groupsWithDetails = groups.map(group => {
    const childInstitutes = institutes.filter(item => item.groupId === group.id);
    const groupMemberships = memberships.filter(item => item.groupId === group.id);
    return {
      ...group,
      institutes: childInstitutes,
      instituteCount: childInstitutes.length,
      groupAdminCount: roles.filter(item => item.role === "group_admin" && item.groupId === group.id).length,
      instituteAdminCount: roles.filter(item => item.role === "institute_admin" && item.groupId === group.id).length,
      teacherCount: new Set(groupMemberships.map(item => item.userId)).size,
      membershipCount: groupMemberships.length,
    };
  });

  return {
    groups: groupsWithDetails,
    totals: {
      topLevelInstitutes: groups.length,
      groups: groups.length,
      institutes: institutes.length,
      admins: roles.filter(item => ["group_admin", "institute_admin"].includes(item.role)).length,
      teachers: new Set(memberships.map(item => item.userId)).size,
    },
  };
}

// Retained temporarily for migration-source comparison only. Production
// migration execution lives in scripts/genesis-migration.mjs and is not
// exported to any browser surface.
async function previewGenesisMigration() {
  await assertManagerAccess();
  const [legacyInstitutes, teachers, rolesSnap, architectureSnap] = await Promise.all([
    readLegacyGlobalInstitutes(),
    getAllTeachers(),
    getDocs(collection(db, "roles")),
    getDoc(doc(db, "config", "tenantArchitecture")),
  ]);
  const legacyAdmins = rolesSnap.docs.filter(item => item.data()?.role === "admin");
  return {
    instituteCount: legacyInstitutes.length,
    teacherCount: teachers.length,
    legacyAdminCount: legacyAdmins.length,
    architectureEnabled: architectureSnap.exists() && architectureSnap.data()?.enabled === true,
  };
}

async function commitWriteOperations(operations, batchSize = 400) {
  for (let start = 0; start < operations.length; start += batchSize) {
    const batch = writeBatch(db);
    operations.slice(start, start + batchSize).forEach(operation => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else {
        batch.set(operation.ref, operation.data, operation.options || {});
      }
    });
    await batch.commit();
  }
}

async function runGenesisMigration(managerUid = "") {
  const actor = await assertManagerAccess();
  const ownerUid = managerUid || actor.uid;
  const now = Date.now();

  const existingGenesisSnap = await getDocs(
    query(collection(db, "groups"), where("legacyKey", "==", "genesis"))
  );
  let genesisGroup = existingGenesisSnap.docs[0]
    ? { id: existingGenesisSnap.docs[0].id, ...existingGenesisSnap.docs[0].data() }
    : null;
  if (!genesisGroup) {
    const groupRef = doc(collection(db, "groups"));
    const payload = {
      name: "Genesis Group",
      nameKey: "genesis group",
      kind: "group",
      status: "active",
      legacyKey: "genesis",
      createdAt: now,
      createdBy: ownerUid,
      updatedAt: now,
      updatedBy: ownerUid,
      schemaVersion: 1,
    };
    await setDoc(groupRef, payload);
    genesisGroup = { id: groupRef.id, ...payload };
  }

  const teacherUids = await getAllTeacherMainDocUids();
  const teacherRecords = [];
  const discoveredInstituteNames = new Set(await readLegacyGlobalInstitutes());
  for (const uid of teacherUids) {
    const [mainSnap, indexSnap] = await Promise.all([
      getDoc(userDocRef(uid)),
      getDoc(doc(db, "teachers", uid)),
    ]);
    const main = mainSnap.exists() ? (mainSnap.data() || {}) : {};
    const index = indexSnap.exists() ? (indexSnap.data() || {}) : {};
    const names = uniqueTrimmed([
      ...(Array.isArray(index.institutes) ? index.institutes : []),
      ...(Array.isArray(main.institutes) ? main.institutes : []),
      ...(Array.isArray(main.profile?.institutes) ? main.profile.institutes : []),
      ...(Array.isArray(main.classes) ? main.classes.map(item => item?.institute) : []),
    ]);
    names.forEach(name => discoveredInstituteNames.add(name));
    teacherRecords.push({ uid, main, index, names, hasMain: mainSnap.exists(), hasIndex: indexSnap.exists() });
  }

  const existingInstitutes = await getTenantInstitutes(genesisGroup.id);
  const instituteByName = new Map(
    existingInstitutes.map(item => [normaliseInstituteKey(item.name), item])
  );
  let institutesCreated = 0;
  for (const instituteName of uniqueTrimmed(Array.from(discoveredInstituteNames))) {
    const key = normaliseInstituteKey(instituteName);
    if (!key || instituteByName.has(key)) continue;
    const created = await createInstituteRecord({
      groupId: genesisGroup.id,
      name: instituteName,
      legacyName: instituteName,
      createdBy: ownerUid,
    });
    instituteByName.set(key, created);
    institutesCreated += 1;
  }

  const rolesSnap = await getDocs(collection(db, "roles"));
  const roleMap = new Map(rolesSnap.docs.map(item => [item.id, item.data() || {}]));
  const operations = [];
  const [syllabusSnap, publishedSyllabusSnap, telegramConfigSnap] = await Promise.all([
    getDocs(collection(db, "syllabusTemplates")),
    getDocs(collection(db, "publishedSyllabi")),
    getDoc(doc(db, "config", "ledgrTelegramDelivery")),
  ]);
  const syllabusInstituteNames = source => uniqueTrimmed([
    source?.instituteName,
    source?.draft?.instituteName,
    source?.published?.instituteName,
    ...(Array.isArray(source?.scope) ? source.scope.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.draft?.scope) ? source.draft.scope.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.published?.scope) ? source.published.scope.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.targets) ? source.targets.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.draft?.targets) ? source.draft.targets.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.published?.targets) ? source.published.targets.map(item => item?.instituteName) : []),
  ]);
  [...syllabusSnap.docs, ...publishedSyllabusSnap.docs].forEach(item => {
    const instituteIds = syllabusInstituteNames(item.data() || {})
      .map(name => instituteByName.get(normaliseInstituteKey(name))?.id)
      .filter(Boolean);
    operations.push({
      ref: item.ref,
      data: {
        groupId: genesisGroup.id,
        instituteIds: uniqueTrimmed(instituteIds),
        tenantMigratedAt: now,
      },
      options: { merge: true },
    });
  });
  if (telegramConfigSnap.exists()) {
    const telegramConfig = telegramConfigSnap.data() || {};
    operations.push({
      ref: telegramConfigSnap.ref,
      data: {
        recipients: (Array.isArray(telegramConfig.recipients) ? telegramConfig.recipients : []).map(recipient => {
          const institute = instituteByName.get(normaliseInstituteKey(recipient?.institute));
          return {
            ...recipient,
            groupId: institute?.groupId || genesisGroup.id,
            instituteId: institute?.id || "",
          };
        }),
        fullReportRecipients: (Array.isArray(telegramConfig.fullReportRecipients) ? telegramConfig.fullReportRecipients : []).map(recipient => ({
          ...recipient,
          groupId: genesisGroup.id,
        })),
        tenantMigratedAt: now,
      },
      options: { merge: true },
    });
  }
  let membershipCount = 0;
  let teacherCount = 0;
  let classCount = 0;

  teacherRecords.forEach(record => {
    const memberships = record.names
      .map(name => instituteByName.get(normaliseInstituteKey(name)))
      .filter(Boolean);
    const instituteIds = uniqueTrimmed(memberships.map(item => item.id));
    if (!instituteIds.length) return;
    teacherCount += 1;
    memberships.forEach(institute => {
      membershipCount += 1;
      operations.push({
        ref: doc(db, "memberships", membershipDocId(record.uid, institute.id)),
        data: {
          userId: record.uid,
          groupId: genesisGroup.id,
          instituteId: institute.id,
          role: "teacher",
          status: "approved",
          source: "genesis_migration",
          approvedAt: now,
          approvedBy: ownerUid,
          createdAt: now,
        },
        options: { merge: true },
      });
    });

    const existingRole = roleMap.get(record.uid) || {};
    if (existingRole.role !== "manager" && !isAdminRole(existingRole.role)) {
      operations.push({
        ref: roleDocRef(record.uid),
        data: {
          role: "teacher",
          groupId: genesisGroup.id,
          instituteIds,
          teaches: true,
          migratedAt: now,
        },
        options: { merge: true },
      });
    }

    if (record.hasIndex || record.hasMain) {
      operations.push({
        ref: doc(db, "teachers", record.uid),
        data: {
          ...record.index,
          uid: record.uid,
          groupIds: [genesisGroup.id],
          instituteIds,
          migratedAt: now,
        },
        options: { merge: true },
      });
    }

    if (record.hasMain) {
      const classes = (Array.isArray(record.main.classes) ? record.main.classes : []).map(cls => {
        const institute = instituteByName.get(normaliseInstituteKey(cls?.institute));
        if (!institute) return cls;
        classCount += 1;
        return {
          ...cls,
          groupId: genesisGroup.id,
          instituteId: institute.id,
        };
      });
      operations.push({
        ref: userDocRef(record.uid),
        data: {
          classes,
          groupId: genesisGroup.id,
          groupIds: [genesisGroup.id],
          instituteIds,
          tenantMigratedAt: now,
        },
        options: { merge: true },
      });
    }
  });

  let adminCount = 0;
  rolesSnap.docs.forEach(roleSnap => {
    const role = roleSnap.data() || {};
    if (role.role === "admin") {
      adminCount += 1;
      operations.push({
        ref: roleSnap.ref,
        data: {
          role: "group_admin",
          groupId: genesisGroup.id,
          instituteId: "",
          instituteIds: [],
          migratedFromRole: "admin",
          migratedAt: now,
          migratedBy: ownerUid,
        },
        options: { merge: true },
      });
    } else if (role.role === "group_admin" && role.groupId === genesisGroup.id) {
      adminCount += 1;
    }
  });

  await commitWriteOperations(operations);
  const result = {
    status: "completed",
    genesisGroupId: genesisGroup.id,
    instituteCount: instituteByName.size,
    institutesCreated,
    teacherCount,
    membershipCount,
    classCount,
    adminCount,
    completedAt: now,
    completedBy: ownerUid,
  };
  const finalBatch = writeBatch(db);
  finalBatch.set(doc(db, "config", "tenantArchitecture"), {
    enabled: true,
    schemaVersion: 1,
    genesisGroupId: genesisGroup.id,
    updatedAt: now,
    updatedBy: ownerUid,
  }, { merge: true });
  finalBatch.set(doc(db, "config", "tenantMigrationGenesis"), result, { merge: true });
  await finalBatch.commit();
  return result;
}

// ── Remove teacher from system ────────────────────────────────────────────────
// Deletes the teacher index entry and their role doc.
// Their appdata (classes/notes) is NOT deleted — kept for admin audit trail.
// Firebase Auth account is also kept (can't delete other users from client SDK).
export async function removeTeacherFromSystem(uid, removedByUid = null) {
  const now = Date.now();
  try {
    const [removedSnap, teacherSnap, mainSnap] = await Promise.all([
      getDoc(removedTeachersConfigRef()),
      getDoc(doc(db, "teachers", uid)),
      getDoc(userDocRef(uid)),
    ]);
    const removedConfig = removedSnap.exists() ? (removedSnap.data() || {}) : {};
    const existingIds = Array.isArray(removedConfig.ids)
      ? removedConfig.ids.map(item => String(item || "").trim()).filter(Boolean)
      : [];
    if (!existingIds.includes(uid)) {
      existingIds.push(uid);
    }
    const record = removedTeacherRecordFromSources(uid, {
      index:teacherSnap.exists() ? teacherSnap.data() : {},
      main:mainSnap.exists() ? mainSnap.data() : {},
    }, {
      removedAt:now,
      removedBy:removedByUid || "",
    });
    const existingEmails = Array.isArray(removedConfig.emails)
      ? removedConfig.emails.map(normaliseEmailKey).filter(Boolean)
      : [];
    const nextEmails = record.emailKey && !existingEmails.includes(record.emailKey)
      ? [...existingEmails, record.emailKey]
      : existingEmails;
    const existingProfiles = Array.isArray(removedConfig.profiles) ? removedConfig.profiles : [];
    const nextProfiles = [
      ...existingProfiles.filter(item => String(item?.uid || "").trim() !== uid),
      record,
    ].slice(-500);
    await setDoc(removedTeachersConfigRef(), {
      ids: existingIds,
      emails: nextEmails,
      profiles: nextProfiles,
      updatedAt: now,
      lastRemovedUid: uid,
      lastRemovedBy: removedByUid || null,
    }, { merge: true });
  } catch {}
  try { await deleteDoc(doc(db, "teachers", uid)); } catch {}
  try { await deleteDoc(doc(db, "roles", uid)); } catch {}
}

// ── Trash auto-purge ──────────────────────────────────────────────────────────
// Removes ordinary trash items older than 30 days from the user's local data
// object. Admin transfer archives are kept because they preserve branch history.
// Call this after loadUserData so stale items never reach the UI.
// No Firestore write needed here — the next saveUserData call persists the cleanup.
export function purgeExpiredTrash(data) {
  if (!data) return data;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS;
  const trashedClasses = (data.trash?.classes || []).filter(tc =>
    tc?.transferArchive || tc?.archivedByAdmin || (tc.deletedAt || 0) > cutoff
  );
  const trashedNotes   = (data.trash?.notes   || []).filter(tn => (tn.deletedAt || 0) > cutoff);
  return { ...data, trash: { classes: trashedClasses, notes: trashedNotes } };
}

// ── Save a name to a user's profile (used by admin + teacher name setup) ─────
export async function saveProfileName(uid, name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw new Error("Name is required.");
  try {
    const state = await loadUserDataState(uid);
    const existing = state?.data || null;
    const saved = await saveUserData(uid, {
      ...(existing || {}),
      profile: {
        ...((existing && existing.profile) || {}),
        name: trimmedName,
      },
    }, {
      expectedRevision: safeRevision(existing?._meta?.revision),
      source: "saveProfileName",
    });

    // Force the admin discovery index to reflect the saved name immediately.
    await setDoc(doc(db, "teachers", uid), {
      ...buildTeacherIndexPayload(uid, saved.data),
      name: trimmedName,
      ...buildTeacherIdentityPatch(uid),
    }, { merge: true });
    return saved.data;
  } catch (e) {
    console.error("saveProfileName", e);
    throw e;
  }
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

export async function archiveTeacherInstituteAssignment(uid, instituteName, extra = {}) {
  const teacherUid = String(uid || "").trim();
  const instLabel = String(instituteName || "").trim();
  if (!teacherUid) throw new Error("Teacher id is required.");
  if (!instLabel) throw new Error("Institute name is required.");

  const data = await loadUserData(teacherUid);
  if (!data) throw new Error("Teacher data was not found.");

  const adminName = String(extra.adminName || extra.deletedByName || "Admin").trim() || "Admin";
  const adminUid = String(extra.adminUid || extra.deletedByUid || "").trim();
  const targetLabel = String(extra.targetInstituteName || extra.newInstitute || "").trim();
  const requiresInstituteSelection = !targetLabel;
  const eventAt = Number(extra.eventAt || Date.now());
  const countEntries = (dateMap = {}) => Object.values(dateMap || {}).reduce(
    (sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0),
    0
  );
  const removeInstitute = values => uniqueTrimmed(
    (values || []).filter(value => !sameInstituteLabel(value, instLabel))
  );

  const activeClasses = Array.isArray(data.classes) ? data.classes : [];
  const classesToArchive = activeClasses.filter(cls => sameInstituteLabel(cls?.institute, instLabel));
  const archivedClassIds = new Set(classesToArchive.map(cls => String(cls?.id || "")).filter(Boolean));
  const wasListed =
    (data.institutes || []).some(item => sameInstituteLabel(item, instLabel)) ||
    (data.profile?.institutes || []).some(item => sameInstituteLabel(item, instLabel));

  if (!classesToArchive.length && !wasListed) {
    return {
      changed: false,
      archivedClassCount: 0,
      archivedEntryCount: 0,
      data,
    };
  }

  const archivedClasses = classesToArchive.map(cls => {
    const savedNotes = (data.notes || {})[cls.id] || {};
    return {
      ...cls,
      deletedAt: eventAt,
      savedNotes,
      deletedByAdmin: true,
      deletedBy: adminUid,
      deletedByUid: adminUid,
      deletedByName: adminName,
      archivedByAdmin: true,
      archivedByUid: adminUid,
      archivedByName: adminName,
      transferArchive: true,
      transferReason: "branch_changed",
      archivedFromInstitute: instLabel,
      transferredToInstitute: targetLabel,
      archiveLabel: targetLabel
        ? `Transferred to ${targetLabel}`
        : "Transferred to another branch",
    };
  });
  const archivedEntryCount = archivedClasses.reduce(
    (sum, cls) => sum + countEntries(cls.savedNotes || {}),
    0
  );

  const updatedClasses = activeClasses.filter(cls => !archivedClassIds.has(String(cls?.id || "")));
  const updatedNotes = Object.fromEntries(
    Object.entries(data.notes || {}).filter(([classId]) => !archivedClassIds.has(String(classId || "")))
  );
  const updatedTrash = {
    ...(data.trash || {}),
    classes: [
      ...(data.trash?.classes || []).filter(cls => !archivedClassIds.has(String(cls?.id || ""))),
      ...archivedClasses,
    ],
  };
  const notice = {
    id: `institute_archived_${normaliseInstituteKey(instLabel) || "institute"}_${eventAt}`,
    kind: "institute_archived",
    classId: "",
    section: "",
    institute: instLabel,
    subject: "",
    adminName,
    eventAt,
    promptedAt: null,
    oldInstitute: instLabel,
    newInstitute: targetLabel,
    targetInstitute: targetLabel,
    impactedClassCount: archivedClasses.length,
    entryCount: archivedEntryCount,
    archived: true,
    transferArchive: true,
    requiresInstituteSelection,
    actionRequired: requiresInstituteSelection,
    branchSelectionRequired: requiresInstituteSelection,
    archiveMessage: targetLabel
      ? `Your branch has been changed to ${targetLabel}. ${instLabel} classes were removed from your active list. They remain saved and archived.`
      : `${instLabel} classes were removed from your active list after a branch change. They remain saved and archived. Please choose your current branch when you next add a class.`,
  };
  const updatedMeta = withPendingAdminClassNotice(data, notice);

  const saved = await saveUserData(teacherUid, {
    ...data,
    classes: updatedClasses,
    notes: updatedNotes,
    institutes: removeInstitute(data.institutes),
    profile: {
      ...(data.profile || {}),
      institutes: removeInstitute(data.profile?.institutes),
    },
    trash: updatedTrash,
    _meta: updatedMeta,
  }, { source: "adminArchiveTeacherInstituteAssignment" });

  await Promise.allSettled(
    Array.from(archivedClassIds).map(classId => deleteClassNotes(teacherUid, classId))
  );

  return {
    changed: true,
    archivedClassCount: archivedClasses.length,
    archivedEntryCount,
    data: saved.data,
  };
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
      archivedByAdmin,
      archivedByUid,
      archivedByName,
      transferArchive,
      transferReason,
      archivedFromInstitute,
      transferredToInstitute,
      archiveLabel,
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

async function readLegacyGlobalInstitutes() {
  try {
    const snap = await getDoc(doc(db, "config", "institutes"));
    if (snap.exists()) {
      const data = snap.data() || {};
      const deleted = Array.isArray(data.deletedList) ? data.deletedList : [];
      return (Array.isArray(data.list) ? data.list : [])
        .filter(item => normaliseInstituteKey(item) !== "__noop__")
        .filter(item => !deleted.some(deletedName => sameInstituteLabel(deletedName, item)));
    }
    return [];
  } catch { return []; }
}

export async function getGlobalInstitutes() {
  const role = await getCurrentRoleDetails();
  if (role.role === "teacher") {
    return getTeacherAllowedInstitutes(role.uid);
  }

  if (isPortalRole(role.role)) {
    const visibleInstitutes = await getVisibleTenantInstituteRecords(role);
    if (visibleInstitutes.length) {
      return uniqueTrimmed(visibleInstitutes.map(item => item.name));
    }
    const architectureSnap = await getDoc(doc(db, "config", "tenantArchitecture")).catch(() => null);
    if (architectureSnap?.exists() && architectureSnap.data()?.enabled === true && role.role !== "admin") {
      return [];
    }
  }
  return readLegacyGlobalInstitutes();
}

export async function saveGlobalInstitute(name) {
  const label = String(name || "").trim();
  if(!label) return;
  if(normaliseInstituteKey(label) === "__noop__") return;
  const actor = await getCurrentRoleDetails();
  if (actor.role === "group_admin" && actor.groupId) {
    await createTenantInstitute({ groupId: actor.groupId, name: label }, actor.uid);
    return;
  }
  if (actor.role === "institute_admin") {
    throw new Error("Institute Admins cannot create another institute.");
  }
  if (actor.role === "manager") {
    throw new Error("Choose the parent group in the Manager Portal before creating an institute.");
  }
  const snap = await getDoc(doc(db, "config", "institutes"));
  const data = snap.exists() ? (snap.data() || {}) : {};
  const existing = Array.isArray(data.list) ? data.list : [];
  const lower = existing.map(i => normaliseInstituteKey(i));
  const deletedList = Array.isArray(data.deletedList) ? data.deletedList : [];
  if (lower.includes(normaliseInstituteKey(label))) {
    await setDoc(doc(db, "config", "institutes"), {
      deletedList: deletedList.filter(item => !sameInstituteLabel(item, label)),
    }, { merge: true });
    return; // duplicate restored from deletedList if needed
  }
  await setDoc(doc(db, "config", "institutes"), {
    list: [...existing, label],
    deletedList: deletedList.filter(item => !sameInstituteLabel(item, label)),
  }, { merge: true });
}

// ── Canonical subjects (admin-controlled) ────────────────────────────────────
// Existing class `subject` strings remain untouched for legacy clients.

function subjectIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normaliseSubjectCatalog(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(item => {
      const source = typeof item === "string" ? { name: item } : (item || {});
      const name = String(source.name || "").trim();
      const id = String(source.id || subjectIdFromName(name)).trim();
      if (!id || !name || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name,
        active: source.active !== false,
        createdAt: Number(source.createdAt || 0),
        updatedAt: Number(source.updatedAt || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function getGlobalSubjects() {
  try {
    const snap = await getDoc(doc(db, "config", "subjects"));
    return snap.exists() ? normaliseSubjectCatalog(snap.data().list) : [];
  } catch (error) {
    console.error("getGlobalSubjects", error);
    return [];
  }
}

export async function saveGlobalSubject(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("Enter a subject name.");
  const current = await getGlobalSubjects();
  const duplicate = current.find(item => item.name.toLowerCase() === cleanName.toLowerCase());
  if (duplicate) return duplicate;
  const now = Date.now();
  let id = subjectIdFromName(cleanName);
  if (!id) throw new Error("Enter a valid subject name.");
  if (current.some(item => item.id === id)) id = `${id}-${now.toString(36)}`;
  const created = { id, name: cleanName, active: true, createdAt: now, updatedAt: now };
  await setDoc(doc(db, "config", "subjects"), {
    list: normaliseSubjectCatalog([...current, created]),
    version: increment(1),
    updatedAt: now,
  }, { merge: true });
  return created;
}

export async function setGlobalSubjectActive(subjectId, active) {
  const current = await getGlobalSubjects();
  const now = Date.now();
  const next = current.map(item => item.id === subjectId
    ? { ...item, active: !!active, updatedAt: now }
    : item);
  await setDoc(doc(db, "config", "subjects"), {
    list: normaliseSubjectCatalog(next),
    version: increment(1),
    updatedAt: now,
  }, { merge: true });
  return next;
}

export async function updateTeacherSubjectAssignments(uid, subjects, adminUid = "") {
  const assigned = normaliseSubjectCatalog(subjects).filter(item => item.active !== false);
  const ref = doc(db, "teachers", uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? snap.data() : {};
    tx.set(ref, {
      assignedSubjectIds: assigned.map(item => item.id),
      assignedSubjects: assigned.map(item => ({ id: item.id, name: item.name })),
      subjects: assigned.map(item => item.name),
      subjectAssignmentVersion: Number(current.subjectAssignmentVersion || 0) + 1,
      subjectAssignmentUpdatedAt: Date.now(),
      subjectAssignmentUpdatedBy: adminUid || "admin",
    }, { merge: true });
  });
}

// ── Admin syllabus templates ─────────────────────────────────────────────────
// syllabusTemplates/{templateId} keeps the editable draft and current
// published snapshot. Every publish also writes an immutable version document
// under syllabusTemplates/{templateId}/versions/{version}.

function syllabusNodeId(prefix = "node") {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function normaliseSyllabusTopics(topics) {
  return (Array.isArray(topics) ? topics : [])
    .map((topic, index) => {
      const title = String(topic?.title || "").trim();
      if (!title) return null;
      return {
        id: String(topic?.id || syllabusNodeId("topic")),
        title,
        order: index + 1,
      };
    })
    .filter(Boolean);
}

function normaliseSyllabusChapters(chapters) {
  return (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => {
      const title = String(chapter?.title || "").trim();
      if (!title) return null;
      return {
        id: String(chapter?.id || syllabusNodeId("chapter")),
        title,
        order: index + 1,
        topics: normaliseSyllabusTopics(chapter?.topics),
      };
    })
    .filter(Boolean);
}

function normaliseSyllabusTargets(targets) {
  const seen = new Set();
  return (Array.isArray(targets) ? targets : [])
    .map(target => {
      const teacherUid = String(target?.teacherUid || "").trim();
      const classId = String(target?.classId || "").trim();
      const instituteName = String(target?.instituteName || "").trim();
      const sectionName = String(target?.sectionName || "").trim();
      const subjectName = String(target?.subjectName || "").trim();
      const key = `${teacherUid}::${classId}`;
      if (!teacherUid || !classId || !instituteName || !sectionName || !subjectName || seen.has(key)) return null;
      seen.add(key);
      return {
        teacherUid,
        teacherName: String(target?.teacherName || "").trim(),
        classId,
        className: String(target?.className || sectionName).trim(),
        instituteName,
        sectionName,
        subjectName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const instituteOrder = a.instituteName.localeCompare(b.instituteName, undefined, { sensitivity: "base" });
      if (instituteOrder) return instituteOrder;
      const sectionOrder = a.sectionName.localeCompare(b.sectionName, undefined, { sensitivity: "base" });
      if (sectionOrder) return sectionOrder;
      return a.teacherName.localeCompare(b.teacherName, undefined, { sensitivity: "base" });
    });
}

function normaliseSyllabusScope(scope, fallbackInstitute = "", fallbackSection = "") {
  const grouped = new Map();
  (Array.isArray(scope) ? scope : []).forEach(item => {
    const instituteName = String(item?.instituteName || "").trim();
    if (!instituteName) return;
    const key = instituteName.toLowerCase();
    const current = grouped.get(key) || { instituteName, sectionNames: [] };
    const sections = Array.isArray(item?.sectionNames)
      ? item.sectionNames
      : [item?.sectionName];
    sections.forEach(value => {
      const sectionName = String(value || "").trim();
      if (!sectionName) return;
      if (!current.sectionNames.some(existing => existing.toLowerCase() === sectionName.toLowerCase())) {
        current.sectionNames.push(sectionName);
      }
    });
    grouped.set(key, current);
  });
  const legacyInstitute = String(fallbackInstitute || "").trim();
  const legacySection = String(fallbackSection || "").trim();
  if (!grouped.size && legacyInstitute && legacySection) {
    grouped.set(legacyInstitute.toLowerCase(), {
      instituteName: legacyInstitute,
      sectionNames: [legacySection],
    });
  }
  return [...grouped.values()]
    .map(item => ({
      instituteName: item.instituteName,
      sectionNames: [...item.sectionNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    }))
    .filter(item => item.sectionNames.length)
    .sort((a, b) => a.instituteName.localeCompare(b.instituteName, undefined, { sensitivity: "base" }));
}

function syllabusScopeHash(scope) {
  const value = normaliseSyllabusScope(scope)
    .flatMap(item => item.sectionNames.map(sectionName => `${item.instituteName}::${sectionName}`))
    .join("|")
    .toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `scope-${(hash >>> 0).toString(36)}`;
}

function normaliseSyllabusTemplate(source = {}) {
  const draft = source.draft || {};
  const publishedSource = source.published || {};
  const publishedScope = source.published
    ? normaliseSyllabusScope(
        publishedSource.scope,
        publishedSource.instituteName,
        publishedSource.sectionName,
      )
    : [];
  const draftSourceScope =
    (Array.isArray(draft.scope) && draft.scope.length
      ? draft.scope
      : null)
    || ((Array.isArray(source.scope) && source.scope.length)
      ? source.scope
      : null)
    || publishedSource.scope;
  const draftScope = normaliseSyllabusScope(
    draftSourceScope,
    draft.instituteName || source.instituteName || publishedSource.instituteName,
    draft.sectionName || source.sectionName || publishedSource.sectionName,
  );
  const draftChapters = normaliseSyllabusChapters(draft.chapters);
  const publishedChapters = normaliseSyllabusChapters(publishedSource.chapters);
  const draftTargets = normaliseSyllabusTargets(draft.targets || source.targets);
  const publishedTargets = normaliseSyllabusTargets(publishedSource.targets);
  const firstDraftScope = draftScope[0] || { instituteName: "", sectionNames: [] };
  const firstPublishedScope = publishedScope[0] || { instituteName: "", sectionNames: [] };
  return {
    id: String(source.id || ""),
    groupId: String(source.groupId || draft.groupId || publishedSource.groupId || ""),
    instituteIds: uniqueTrimmed([
      ...(Array.isArray(source.instituteIds) ? source.instituteIds : []),
      ...(Array.isArray(draft.instituteIds) ? draft.instituteIds : []),
      ...(Array.isArray(publishedSource.instituteIds) ? publishedSource.instituteIds : []),
    ]),
    subjectId: String(source.subjectId || ""),
    subjectName: String(source.subjectName || ""),
    name: String(source.name || draft.name || publishedSource.name || ""),
    instituteName: String(
      source.instituteName
      || draft.instituteName
      || firstDraftScope.instituteName
      || publishedSource.instituteName
      || firstPublishedScope.instituteName
      || ""
    ),
    sectionName: String(
      source.sectionName
      || draft.sectionName
      || firstDraftScope.sectionNames[0]
      || publishedSource.sectionName
      || firstPublishedScope.sectionNames[0]
      || ""
    ),
    scope: draftScope,
    academicYear: String(source.academicYear || draft.academicYear || publishedSource.academicYear || ""),
    curriculum: String(source.curriculum || draft.curriculum || publishedSource.curriculum || ""),
    gradeLabel: String(source.gradeLabel || draft.gradeLabel || publishedSource.gradeLabel || ""),
    status: source.status === "published" ? "published" : "draft",
    currentVersion: Number(source.currentVersion || 0),
    createdAt: Number(source.createdAt || 0),
    createdBy: String(source.createdBy || ""),
    updatedAt: Number(source.updatedAt || 0),
    updatedBy: String(source.updatedBy || ""),
    draft: {
      name: String(draft.name || source.name || publishedSource.name || ""),
      instituteName: String(
        draft.instituteName
        || source.instituteName
        || firstDraftScope.instituteName
        || publishedSource.instituteName
        || firstPublishedScope.instituteName
        || ""
      ),
      sectionName: String(
        draft.sectionName
        || source.sectionName
        || firstDraftScope.sectionNames[0]
        || publishedSource.sectionName
        || firstPublishedScope.sectionNames[0]
        || ""
      ),
      scope: draftScope,
      academicYear: String(draft.academicYear || source.academicYear || publishedSource.academicYear || ""),
      curriculum: String(draft.curriculum || source.curriculum || publishedSource.curriculum || ""),
      gradeLabel: String(draft.gradeLabel || source.gradeLabel || publishedSource.gradeLabel || ""),
      chapters: draftChapters.length ? draftChapters : publishedChapters,
      targets: draftTargets.length ? draftTargets : publishedTargets,
    },
    published: source.published ? {
      ...publishedSource,
      scope: publishedScope,
      version: Number(publishedSource.version || source.currentVersion || 0),
      chapters: publishedChapters,
      targets: publishedTargets,
    } : null,
  };
}

function mergeSyllabusTemplateSource(templateSource = {}, publishedSource = {}) {
  const cleanTemplate = templateSource || {};
  const cleanPublished = publishedSource || {};
  const embeddedPublished = cleanTemplate.published || {};
  const embeddedVersion = Number(embeddedPublished.version || cleanTemplate.currentVersion || 0);
  const publishedDocVersion = Number(cleanPublished.version || 0);
  const embeddedChapterCount = Array.isArray(embeddedPublished.chapters) ? embeddedPublished.chapters.length : 0;
  const publishedDocChapterCount = Array.isArray(cleanPublished.chapters) ? cleanPublished.chapters.length : 0;
  const usePublishedDoc = (
    !cleanTemplate.published
    || publishedDocVersion > embeddedVersion
    || publishedDocChapterCount > embeddedChapterCount
  );
  const mergedPublished = usePublishedDoc
    ? { ...embeddedPublished, ...cleanPublished }
    : { ...cleanPublished, ...embeddedPublished };
  const mergedVersion = Math.max(
    Number(cleanTemplate.currentVersion || 0),
    Number(mergedPublished.version || 0),
  );
  return {
    ...cleanTemplate,
    id: String(cleanTemplate.id || cleanPublished.templateId || cleanPublished.id || ""),
    subjectId: String(
      cleanTemplate.subjectId
      || mergedPublished.subjectId
      || subjectIdFromName(mergedPublished.subjectName || cleanTemplate.subjectName || "")
    ),
    subjectName: String(cleanTemplate.subjectName || mergedPublished.subjectName || ""),
    name: String(cleanTemplate.name || mergedPublished.name || ""),
    instituteName: String(cleanTemplate.instituteName || mergedPublished.instituteName || ""),
    sectionName: String(cleanTemplate.sectionName || mergedPublished.sectionName || ""),
    scope: cleanTemplate.scope || mergedPublished.scope || [],
    academicYear: String(cleanTemplate.academicYear || mergedPublished.academicYear || ""),
    curriculum: String(cleanTemplate.curriculum || mergedPublished.curriculum || ""),
    gradeLabel: String(cleanTemplate.gradeLabel || mergedPublished.gradeLabel || ""),
    status: mergedVersion > 0 ? "published" : (cleanTemplate.status || "draft"),
    currentVersion: mergedVersion,
    updatedAt: Math.max(
      Number(cleanTemplate.updatedAt || 0),
      Number(mergedPublished.updatedAt || 0),
      Number(mergedPublished.publishedAt || 0),
    ),
    updatedBy: String(cleanTemplate.updatedBy || mergedPublished.publishedBy || ""),
    published: mergedVersion > 0 ? mergedPublished : (cleanTemplate.published || null),
  };
}

function syllabusTemplateId({ subjectId, name, scope, academicYear, curriculum, gradeLabel }) {
  const scopeKey = syllabusScopeHash(scope);
  const idParts = [subjectId, name, scopeKey, academicYear, curriculum, gradeLabel]
    .map(subjectIdFromName)
    .filter(Boolean)
    .join("--");
  return idParts || syllabusNodeId("syllabus");
}

export async function getSyllabusTemplates() {
  try {
    const actor = await getCurrentRoleDetails();
    const templateSource = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "syllabusTemplates"), where("groupId", "==", actor.groupId))
      : actor.role === "institute_admin" && actor.instituteId
        ? query(collection(db, "syllabusTemplates"), where("instituteIds", "array-contains", actor.instituteId))
        : collection(db, "syllabusTemplates");
    const publishedSource = actor.role === "group_admin" && actor.groupId
      ? query(collection(db, "publishedSyllabi"), where("groupId", "==", actor.groupId))
      : actor.role === "institute_admin" && actor.groupId
        ? query(collection(db, "publishedSyllabi"), where("groupId", "==", actor.groupId))
        : collection(db, "publishedSyllabi");
    const [templateSnap, publishedSnap] = await Promise.all([
      getDocs(templateSource),
      getDocs(publishedSource),
    ]);
    const merged = new Map();

    templateSnap.docs.forEach(item => {
      merged.set(item.id, { id: item.id, ...item.data() });
    });

    publishedSnap.docs.forEach(item => {
      const current = merged.get(item.id) || { id: item.id };
      merged.set(item.id, mergeSyllabusTemplateSource(current, { id: item.id, ...item.data() }));
    });

    let templates = [...merged.values()].map(item => normaliseSyllabusTemplate(item));
    if (["group_admin", "institute_admin"].includes(actor.role)) {
      const visibleInstitutes = await getVisibleTenantInstituteRecords(actor);
      const visibleIds = new Set(visibleInstitutes.map(item => item.id));
      const visibleNames = visibleInstitutes.map(item => item.name);
      templates = templates.filter(template => {
        if (template.groupId && template.groupId !== actor.groupId) return false;
        if (actor.role === "institute_admin" && template.instituteIds.length) {
          return template.instituteIds.includes(actor.instituteId);
        }
        const scopeNames = uniqueTrimmed([
          template.instituteName,
          ...(template.scope || []).map(item => item?.instituteName),
          ...(template.draft?.scope || []).map(item => item?.instituteName),
          ...(template.published?.scope || []).map(item => item?.instituteName),
        ]);
        return template.instituteIds.some(id => visibleIds.has(id))
          || scopeNames.some(name => visibleNames.some(visibleName => sameInstituteLabel(name, visibleName)));
      });
    }
    return templates
      .sort((a, b) => {
        const subjectOrder = a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: "base" });
        if (subjectOrder) return subjectOrder;
        return b.updatedAt - a.updatedAt;
      });
  } catch (error) {
    console.error("getSyllabusTemplates", error);
    return [];
  }
}

export async function saveSyllabusDraft(template, adminUid = "") {
  const clean = normaliseSyllabusTemplate(template);
  if (!clean.subjectId || !clean.subjectName) throw new Error("Choose a subject already used by a class.");
  if (!clean.draft.name.trim()) clean.draft.name = `${clean.subjectName} syllabus`;
  if (!clean.draft.scope.length) throw new Error("Select at least one institute and section.");
  if (!clean.draft.targets.length) throw new Error("No matching teacher classes were found for this subject.");
  if (!clean.draft.academicYear.trim()) throw new Error("Enter the academic year.");
  if (!clean.draft.curriculum.trim()) throw new Error("Enter the curriculum or board.");
  if (!clean.draft.gradeLabel.trim()) throw new Error("Enter the grade, course, or programme.");

  const id = clean.id || syllabusTemplateId({
    subjectId: clean.subjectId,
    name: clean.draft.name,
    scope: clean.draft.scope,
    academicYear: clean.draft.academicYear,
    curriculum: clean.draft.curriculum,
    gradeLabel: clean.draft.gradeLabel,
  });
  const ref = doc(db, "syllabusTemplates", id);
  const now = Date.now();
  const actor = await getCurrentRoleDetails();
  const scopeNames = uniqueTrimmed(clean.draft.scope.map(item => item?.instituteName));
  const visibleInstitutes = await getVisibleTenantInstituteRecords(actor);
  const matchedInstitutes = scopeNames.map(name =>
    visibleInstitutes.find(item => sameInstituteLabel(item.name, name))
  ).filter(Boolean);
  if (
    ["group_admin", "institute_admin"].includes(actor.role)
    && matchedInstitutes.length !== scopeNames.length
  ) {
    throw new Error("The syllabus scope includes an institute outside your access.");
  }
  const tenantFields = matchedInstitutes.length
    ? {
        groupId: actor.groupId || matchedInstitutes[0].groupId || "",
        instituteIds: uniqueTrimmed(matchedInstitutes.map(item => item.id)),
      }
    : {};

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? snap.data() : {};
    tx.set(ref, {
      subjectId: clean.subjectId,
      subjectName: clean.subjectName,
      name: clean.draft.name,
      instituteName: clean.draft.instituteName,
      sectionName: clean.draft.sectionName,
      scope: clean.draft.scope,
      academicYear: clean.draft.academicYear,
      curriculum: clean.draft.curriculum,
      gradeLabel: clean.draft.gradeLabel,
      status: current.status === "published" ? "published" : "draft",
      currentVersion: Number(current.currentVersion || 0),
      createdAt: Number(current.createdAt || now),
      createdBy: String(current.createdBy || adminUid || "admin"),
      updatedAt: now,
      updatedBy: adminUid || "admin",
      ...tenantFields,
      draft: clean.draft,
      published: current.published || null,
    }, { merge: true });
  });

  const saved = await getDoc(ref);
  return normaliseSyllabusTemplate({ id, ...saved.data() });
}

export async function publishSyllabusTemplate(templateId, adminUid = "") {
  if (!templateId) throw new Error("Save the syllabus draft before publishing.");
  const ref = doc(db, "syllabusTemplates", templateId);
  const actor = await getCurrentRoleDetails();
  let publishedResult = null;

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Syllabus draft was not found.");
    const current = normaliseSyllabusTemplate({ id: snap.id, ...snap.data() });
    if (
      ["group_admin", "institute_admin"].includes(actor.role)
      && current.groupId
      && current.groupId !== actor.groupId
    ) {
      throw new Error("This syllabus is outside your group.");
    }
    if (
      actor.role === "institute_admin"
      && current.instituteIds.length
      && !current.instituteIds.includes(actor.instituteId)
    ) {
      throw new Error("This syllabus is outside your institute.");
    }
    if (!current.draft.chapters.length) throw new Error("Add at least one chapter before publishing.");
    const nextVersion = current.currentVersion + 1;
    const now = Date.now();
    const published = {
      ...current.draft,
      subjectId: current.subjectId,
      subjectName: current.subjectName,
      version: nextVersion,
      publishedAt: now,
      publishedBy: adminUid || "admin",
      groupId: current.groupId || "",
      instituteIds: current.instituteIds || [],
    };
    tx.set(doc(db, "syllabusTemplates", templateId, "versions", String(nextVersion)), published);
    tx.set(doc(db, "publishedSyllabi", templateId), {
      ...published,
      templateId,
      updatedAt: now,
      groupId: current.groupId || "",
      instituteIds: current.instituteIds || [],
    });
    tx.set(ref, {
      status: "published",
      currentVersion: nextVersion,
      published,
      updatedAt: now,
      updatedBy: adminUid || "admin",
    }, { merge: true });
    publishedResult = { ...current, status: "published", currentVersion: nextVersion, published, updatedAt: now };
  });

  return publishedResult;
}

export async function deleteSyllabusTemplate(templateId) {
  const cleanId = String(templateId || "").trim();
  if (!cleanId) throw new Error("Choose a syllabus to delete.");
  const [actor, templateSnap] = await Promise.all([
    getCurrentRoleDetails(),
    getDoc(doc(db, "syllabusTemplates", cleanId)),
  ]);
  if (templateSnap.exists() && ["group_admin", "institute_admin"].includes(actor.role)) {
    const template = normaliseSyllabusTemplate({ id: cleanId, ...templateSnap.data() });
    if (template.groupId && template.groupId !== actor.groupId) {
      throw new Error("This syllabus is outside your group.");
    }
    if (
      actor.role === "institute_admin"
      && template.instituteIds.length
      && !template.instituteIds.includes(actor.instituteId)
    ) {
      throw new Error("This syllabus is outside your institute.");
    }
  }
  const versionsRef = collection(db, "syllabusTemplates", cleanId, "versions");
  const versions = await getDocs(versionsRef);
  const batch = writeBatch(db);
  versions.docs.forEach(item => batch.delete(item.ref));
  batch.delete(doc(db, "publishedSyllabi", cleanId));
  batch.delete(doc(db, "syllabusTemplates", cleanId));
  await batch.commit();
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

const LEDGR_HOBBY_BATCH_TIME = "20:00";
const LEDGR_HOBBY_BATCH_TIMEZONE = "Asia/Kolkata";

function normaliseTelegramChatId(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function normaliseTelegramUsername(value) {
  const clean = String(value || "").trim().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function hasTelegramRecipientData(item = {}) {
  return !!(
    String(item?.institute || "").trim() ||
    String(item?.label || "").trim() ||
    normaliseTelegramUsername(item?.username) ||
    normaliseTelegramChatId(item?.chatId) ||
    String(item?.notes || "").trim()
  );
}

function normaliseLedgrTelegramRecipients(list) {
  const seen = new Set();
  return (list || [])
    .map((item, index) => {
      const institute = String(item?.institute || "").trim().replace(/\s+/g, " ");
      const label = String(item?.label || "").trim();
      const username = normaliseTelegramUsername(item?.username);
      const chatId = normaliseTelegramChatId(item?.chatId);
      const notes = String(item?.notes || "").trim();
      const destinationType = ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "channel";
      const enabled = item?.enabled !== false;
      const touched = institute || label || username || chatId || notes;
      if (!touched) return null;
      if (!institute) {
        throw new Error(`Telegram destination ${index + 1} is missing an institute.`);
      }
      if (!chatId) {
        throw new Error(`Telegram destination for ${institute} is missing a chat id.`);
      }
      if (!/^-?\d{5,}$/.test(chatId)) {
        throw new Error(`Telegram chat id for ${institute} looks invalid.`);
      }
      if (username && !/^@?[A-Za-z0-9_]{5,}$/.test(username)) {
        throw new Error(`Telegram username for ${institute} looks invalid.`);
      }
      const dedupeKey = `${institute.toLowerCase()}__${chatId}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        id: String(item?.id || `${institute}_${chatId}_${index + 1}`)
          .trim()
          .replace(/\s+/g, "_"),
        institute,
        groupId: String(item?.groupId || "").trim(),
        instituteId: String(item?.instituteId || "").trim(),
        label,
        username,
        chatId,
        notes,
        destinationType,
        enabled,
      };
    })
    .filter(Boolean);
}

function normaliseLedgrTelegramFullReportRecipients(list) {
  const seen = new Set();
  return (list || [])
    .map((item, index) => {
      const label = String(item?.label || "").trim();
      const username = normaliseTelegramUsername(item?.username);
      const chatId = normaliseTelegramChatId(item?.chatId);
      const notes = String(item?.notes || "").trim();
      const destinationType = ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "private";
      const enabled = item?.enabled !== false;
      const touched = label || username || chatId || notes;
      if (!touched) return null;
      if (!chatId) {
        throw new Error(`Complete report recipient ${index + 1} is missing a chat id.`);
      }
      if (!/^-?\d{5,}$/.test(chatId)) {
        throw new Error(`Complete report chat id ${index + 1} looks invalid.`);
      }
      if (username && !/^@?[A-Za-z0-9_]{5,}$/.test(username)) {
        throw new Error(`Complete report username ${index + 1} looks invalid.`);
      }
      if (seen.has(chatId)) return null;
      seen.add(chatId);
      return {
        id: String(item?.id || `telegram_full_${chatId}_${index + 1}`)
          .trim()
          .replace(/\s+/g, "_"),
        groupId: String(item?.groupId || "").trim(),
        label,
        username,
        chatId,
        notes,
        destinationType,
        enabled,
      };
    })
    .filter(Boolean);
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
  const times = [LEDGR_HOBBY_BATCH_TIME];
  const enabled = !!schedule.enabled;

  const scopeType = schedule.scope?.type === "selected" ? "selected" : "all";
  const selectedInstitutes = scopeType === "selected"
    ? uniqueTrimmed(schedule.scope?.institutes || [])
    : [];
  if (enabled && scopeType === "selected" && !selectedInstitutes.length) {
    throw new Error("Select at least one institute for this schedule.");
  }

  const payload = {
    schemaVersion: 1,
    mode: "daily_batch",
    enabled,
    times,
    timezone: LEDGR_HOBBY_BATCH_TIMEZONE,
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

export async function getLedgrTelegramConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "ledgrTelegramDelivery"));
    if (!snap.exists()) return null;
    const config = snap.data() || {};
    const actor = await getCurrentRoleDetails();
    if (!["group_admin", "institute_admin"].includes(actor.role)) return config;
    const visible = await getVisibleTenantInstituteRecords(actor);
    const visibleIds = new Set(visible.map(item => item.id));
    const visibleNames = visible.map(item => item.name);
    const recipients = (Array.isArray(config.recipients) ? config.recipients : []).filter(item =>
      (item?.instituteId && visibleIds.has(item.instituteId))
      || visibleNames.some(name => sameInstituteLabel(name, item?.institute))
    );
    const fullReportRecipients = actor.role === "group_admin"
      ? (Array.isArray(config.fullReportRecipients) ? config.fullReportRecipients : [])
          .filter(item => item?.groupId === actor.groupId)
      : [];
    return { ...config, recipients, fullReportRecipients };
  } catch (error) {
    console.error("getLedgrTelegramConfig", error);
    return null;
  }
}

export async function saveLedgrTelegramConfig(config = {}, updatedBy = "") {
  const actor = await getCurrentRoleDetails();
  const botUsernameRaw = String(config.botUsername || "").trim();
  if (botUsernameRaw && !/^@?[A-Za-z0-9_]{5,}$/.test(botUsernameRaw)) {
    throw new Error("Enter a valid Telegram bot username.");
  }
  const botUsername = botUsernameRaw
    ? (botUsernameRaw.startsWith("@") ? botUsernameRaw : `@${botUsernameRaw}`)
    : "";
  const rawRecipients = Array.isArray(config.recipients) ? config.recipients : [];
  const legacyFullReportRecipients = rawRecipients.filter(item =>
    !String(item?.institute || "").trim() && hasTelegramRecipientData(item)
  );
  let recipients = normaliseLedgrTelegramRecipients(
    rawRecipients.filter(item => String(item?.institute || "").trim())
  );
  let fullReportRecipients = normaliseLedgrTelegramFullReportRecipients([
    ...(Array.isArray(config.fullReportRecipients) ? config.fullReportRecipients : []),
    ...legacyFullReportRecipients,
  ]);
  const existingSnap = await getDoc(doc(db, "config", "ledgrTelegramDelivery"));
  const existing = existingSnap.exists() ? (existingSnap.data() || {}) : {};
  if (["group_admin", "institute_admin"].includes(actor.role)) {
    const visible = await getVisibleTenantInstituteRecords(actor);
    const visibleNames = visible.map(item => item.name);
    const visibleIds = new Set(visible.map(item => item.id));
    const matchInstitute = item => visible.find(institute =>
      (item?.instituteId && item.instituteId === institute.id)
      || sameInstituteLabel(item?.institute, institute.name)
    );
    const outsideRecipients = (Array.isArray(existing.recipients) ? existing.recipients : []).filter(item =>
      !visibleIds.has(item?.instituteId)
      && !visibleNames.some(name => sameInstituteLabel(name, item?.institute))
    );
    recipients = recipients.map(item => {
      const institute = matchInstitute(item);
      if (!institute) throw new Error("A Telegram route is outside your institute access.");
      return {
        ...item,
        groupId: institute.groupId,
        instituteId: institute.id,
      };
    });
    recipients = [...outsideRecipients, ...recipients];

    if (actor.role === "group_admin") {
      const outsideFullRecipients = (Array.isArray(existing.fullReportRecipients) ? existing.fullReportRecipients : [])
        .filter(item => item?.groupId !== actor.groupId);
      fullReportRecipients = [
        ...outsideFullRecipients,
        ...fullReportRecipients.map(item => ({ ...item, groupId: actor.groupId })),
      ];
    } else {
      fullReportRecipients = Array.isArray(existing.fullReportRecipients)
        ? existing.fullReportRecipients
        : [];
    }
  }

  const payload = {
    schemaVersion: 2,
    transport: "telegram",
    tokenMode: "server_env",
    enabled: config.enabled !== false,
    botUsername,
    delivery: {
      scheduledEnabled: config.delivery?.scheduledEnabled !== false,
      onDemandEnabled: config.delivery?.onDemandEnabled !== false,
      reportFormat: "pdf",
    },
    recipients,
    fullReportRecipients,
    updatedAt: Date.now(),
    updatedBy: String(updatedBy || "").trim(),
  };

  await setDoc(doc(db, "config", "ledgrTelegramDelivery"), payload, { merge: true });
  return getLedgrTelegramConfig();
}

export async function deleteGlobalInstitute(name) {
  const actor = await getCurrentRoleDetails();
  if (["group_admin", "institute_admin"].includes(actor.role)) {
    const visible = await getVisibleTenantInstituteRecords(actor);
    const institute = visible.find(item => sameInstituteLabel(item.name, name));
    if (!institute) throw new Error("That institute is outside your access scope.");
    await assertCanManageInstitute(institute.groupId, institute.id);
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(db, "institutes", institute.id), {
      status: "deleted",
      deletedAt: now,
      deletedBy: actor.uid,
      updatedAt: now,
      updatedBy: actor.uid,
    }, { merge: true });
    if (institute.instituteCode) {
      batch.set(doc(db, "instituteCodes", institute.instituteCode), {
        status: "deleted",
        deletedAt: now,
      }, { merge: true });
    }
    await batch.commit();
    return;
  }
  const snap = await getDoc(doc(db, "config", "institutes"));
  const data = snap.exists() ? (snap.data() || {}) : {};
  const existing = Array.isArray(data.list) ? data.list : [];
  const label = String(name || "").trim();
  const filtered = existing.filter(i => !sameInstituteLabel(i, label));
  const currentDeletedList = Array.isArray(data.deletedList) ? data.deletedList : [];
  const nextDeletedList = currentDeletedList.some(item => sameInstituteLabel(item, label))
    ? currentDeletedList
    : [...currentDeletedList, label].filter(Boolean);
  await setDoc(doc(db, "config", "institutes"), { list: filtered, deletedList: nextDeletedList });
}

// ── Deleted institutes list (persisted so UI survives page refresh) ────────────
export async function getDeletedInstitutesList() {
  try {
    const role = await getCurrentRoleDetails();
    if (role.role !== "admin") return [];
    const snap = await getDoc(doc(db, "config", "institutes"));
    if (snap.exists()) return snap.data().deletedList || [];
    return [];
  } catch { return []; }
}

export async function addToDeletedInstitutesList(name) {
  try {
    const role = await getCurrentRoleDetails();
    if (role.role !== "admin") return;
    const snap = await getDoc(doc(db, "config", "institutes"));
    const existing = snap.exists() ? (snap.data().deletedList || []) : [];
    const norm = name.trim().toLowerCase();
    if (existing.some(i => i.toLowerCase() === norm)) return;
    await setDoc(doc(db, "config", "institutes"), { deletedList: [...existing, name.trim()] }, { merge: true });
  } catch (e) { console.error("addToDeletedInstitutesList", e); }
}

export async function removeFromDeletedInstitutesList(name) {
  try {
    const role = await getCurrentRoleDetails();
    if (role.role !== "admin") return;
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

  // Walk all teacher main docs, including legacy appdata-only accounts.
  const renameUids = await getAllTeacherMainDocUids();
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
    if (!snap.exists()) return {};
    const sections = snap.data() || {};
    const role = await getCurrentRoleDetails();
    if (["manager", "admin"].includes(role.role)) return sections;
    const visibleNames = await getGlobalInstitutes();
    return Object.fromEntries(
      Object.entries(sections).filter(([name]) =>
        visibleNames.some(visibleName => sameInstituteLabel(visibleName, name))
      )
    );
  } catch { return {}; }
}

async function assertCanManageInstituteName(instituteName) {
  const actor = await getCurrentRoleDetails();
  if (["manager", "admin"].includes(actor.role)) return actor;
  const visible = await getVisibleTenantInstituteRecords(actor);
  const institute = visible.find(item => sameInstituteLabel(item.name, instituteName));
  if (!institute) throw new Error("That institute is outside your access scope.");
  await assertCanManageInstitute(institute.groupId, institute.id);
  return actor;
}

export async function saveInstituteGradeGroups(instituteName, gradeGroups, extraPatch = {}) {
  await assertCanManageInstituteName(instituteName);
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    [instituteName]: { ...(existing[instituteName]||{}), ...extraPatch, gradeGroups }
  }, { merge: true });
}

export async function saveInstituteType(instituteName, type) {
  await assertCanManageInstituteName(instituteName);
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    [instituteName]: { ...(existing[instituteName]||{}), type }
  }, { merge: true });
}

export async function saveInstituteExtraSections(instituteName, extraSections) {
  await assertCanManageInstituteName(instituteName);
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, "config", "sections"), {
    [instituteName]: {
      ...(existing[instituteName] || {}),
      extraSections: uniqueTrimmed(extraSections),
    }
  }, { merge: true });
}

export async function deleteInstituteGradeGroup(instituteName, groupId) {
  await assertCanManageInstituteName(instituteName);
  const snap = await getDoc(doc(db, "config", "sections"));
  const existing = snap.exists() ? snap.data() : {};
  const current = existing[instituteName]?.gradeGroups || [];
  const updated = current.filter(g => g.id !== groupId);
  await setDoc(doc(db, "config", "sections"), {
    [instituteName]: { ...(existing[instituteName] || {}), gradeGroups: updated }
  }, { merge: true });
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

  const allUids = await getAllTeacherMainDocUids();

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

  // Step 2: Rename all teacher data from -> to, including legacy appdata-only accounts.
  const allUids2 = await getAllTeacherMainDocUids();
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
