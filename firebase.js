import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  getDocs, query, where,
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

    // Back-compat: check if ANY separate notes doc actually had data
    // (not just that the keys exist — they always exist from the classes array)
    const anyNewNotesExist = Object.values(notes).some(
      classNotes => Object.keys(classNotes).length > 0
    );

    if (anyNewNotesExist) {
      // New split format — use separate docs
      return { ...main, notes };
    } else {
      // Old format — notes embedded in main doc, or teacher has no entries yet
      // Merge old notes with any empty new-format entries
      const oldNotes = main.notes || {};
      const merged = { ...notes };
      Object.entries(oldNotes).forEach(([cid, dateMap]) => {
        if (!merged[cid] || Object.keys(merged[cid]).length === 0) {
          merged[cid] = dateMap;
        }
      });
      return { ...main, notes: merged };
    }
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
    if (snap.exists()) return snap.data().role;
    // First-ever login — write default role
    await setDoc(roleDocRef(uid), { role: "teacher", grantedAt: Date.now() });
    return "teacher";
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
