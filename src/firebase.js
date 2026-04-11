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

// ── User data ─────────────────────────────────────────────────────────────────
export function userDocRef(uid) { return doc(db, "users", uid, "appdata", "main"); }
export async function loadUserData(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
export async function saveUserData(uid, data) {
  await setDoc(userDocRef(uid), data);
  // Keep teacher index in sync so admin can discover all teachers
  await syncTeacherIndex(uid, data);
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
    (data.classes || []).map(c => c.institute).filter(Boolean)
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
  try {
    const snap = await getDoc(userDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function getAllRoles() {
  try {
    const snap = await getDocs(collection(db, "roles"));
    const map = {};
    snap.docs.forEach(d => { map[d.id] = d.data().role; });
    return map;
  } catch { return {}; }
}
