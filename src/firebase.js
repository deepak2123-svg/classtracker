import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  getDocs, query, where, deleteDoc,
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

export async function loadUserData(uid) {
  try {
    // 1. Load main metadata doc
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return null;
    const main = snap.data();

    // 2. Load notes for each class in parallel
    const classes = main.classes || [];
    const notesList = await Promise.all(
      classes.map(async cls => {
        try {
          const ns = await getDoc(notesDocRef(uid, cls.id));
          return [cls.id, ns.exists() ? ns.data() : {}];
        } catch { return [cls.id, {}]; }
      })
    );

    // 3. Merge into the shape the app expects: { notes: { [cid]: { [dk]: [...] } } }
    const notes = Object.fromEntries(notesList);

    // Back-compat: if notes were stored in the old main doc, use those
    return { ...main, notes: Object.keys(notes).length ? notes : (main.notes || {}) };
  } catch { return null; }
}

export async function saveUserData(uid, data) {
  // Split: save metadata without notes to main doc
  const { notes, ...meta } = data;
  await setDoc(userDocRef(uid), meta);

  // Save each class notes to its own doc (only if changed)
  if (notes) {
    await Promise.all(
      Object.entries(notes).map(([cid, dateMap]) =>
        setDoc(notesDocRef(uid, cid), dateMap || {}).catch(() => {})
      )
    );
  }

  // Keep teacher index fresh
  await syncTeacherIndex(uid, data);
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
  const institutes = [...new Set(
    (data.classes || []).map(c => (c.institute||"").trim()).filter(Boolean)
  )];
  try {
    await setDoc(doc(db, "teachers", uid), {
      uid,
      name: data.profile.name,
      institutes,
      classCount: (data.classes || []).length,
      lastActive: Date.now(),
    }, { merge: true });
  } catch { /* silent fail — admin feature optional */ }
}

// ── Admin data reads ──────────────────────────────────────────────────────────
export async function getAllTeachers() {
  try {
    // Primary: teacher index (has institute/class summary)
    const snap = await getDocs(collection(db, "teachers"));
    const indexed = snap.docs.map(d => d.data());
    const indexedUids = new Set(indexed.map(t => t.uid));

    // Supplement: roles collection catches teachers not yet in index
    const rolesSnap = await getDocs(collection(db, "roles"));
    const extras = [];
    rolesSnap.docs.forEach(d => {
      if (!indexedUids.has(d.id)) {
        extras.push({ uid: d.id, name: "", institutes: [], classCount: 0 });
      }
    });

    return [...indexed, ...extras];
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
  // Mark invite as used
  await setDoc(doc(db, "invites", token), { used: true, usedBy: uid, usedAt: Date.now() }, { merge: true });
  // Promote to admin
  await setDoc(doc(db, "roles", uid), {
    role: "admin",
    grantedAt: Date.now(),
    grantedBy: "invite-link",
    inviteToken: token,
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
