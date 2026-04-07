// ─── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────────
// 1. console.firebase.google.com → your project → Project Settings → Web app
// 2. Authentication → Sign-in method → enable Google + Email/Password
// 3. Firestore → Rules → paste the rules block shown below
//
// FIRESTORE RULES:
// ────────────────
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // System config — readable by all authenticated users, writable only if no superadmin yet
//     match /system/config {
//       allow read: if request.auth != null;
//       allow write: if request.auth != null;
//     }
//     // User profiles — own profile read/write; admins/superadmin can read others
//     match /users/{userId}/profile {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//     }
//     match /users/{userId}/profile {
//       allow read: if request.auth != null;
//     }
//     // Teacher app data — own data only
//     match /users/{userId}/appdata/{doc} {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//     }
//     // Institutions — superadmin full access; admin of that institution can read
//     match /institutions/{instId} {
//       allow read: if request.auth != null;
//       allow write: if request.auth != null;
//     }
//     match /institutions/{instId}/members/{uid} {
//       allow read, write: if request.auth != null;
//     }
//     // Invites
//     match /invites/{token} {
//       allow read, write: if request.auth != null;
//     }
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: The above rules are permissive for development. Once live, tighten them
// based on the role stored in each user's profile document.

import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, where, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId:         "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE",
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

// ── System config (superadmin existence check) ────────────────────────────────
export async function getSuperAdminExists() {
  try {
    const snap = await getDoc(doc(db, "system", "config"));
    return snap.exists() ? snap.data().superAdminExists === true : false;
  } catch { return false; }
}
export async function setSuperAdminExists() {
  await setDoc(doc(db, "system", "config"), { superAdminExists: true });
}

// ── User profiles ─────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid, "profile", "data"));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
export async function setUserProfile(uid, profile) {
  await setDoc(doc(db, "users", uid, "profile", "data"), profile);
}
export async function getUserProfileByEmail(email) {
  // We need to query all profiles — small scale so ok
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    for (const userDoc of usersSnap.docs) {
      const profileSnap = await getDoc(doc(db, "users", userDoc.id, "profile", "data"));
      if (profileSnap.exists() && profileSnap.data().email === email) {
        return { uid: userDoc.id, ...profileSnap.data() };
      }
    }
  } catch {}
  return null;
}

// ── Teacher app data ──────────────────────────────────────────────────────────
export function userDocRef(uid) { return doc(db, "users", uid, "appdata", "main"); }
export async function loadUserData(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
export async function saveUserData(uid, data) {
  await setDoc(userDocRef(uid), data);
}

// ── Institutions ──────────────────────────────────────────────────────────────
export async function createInstitution(name, adminUid, adminName, adminEmail, createdByUid) {
  const ref = await addDoc(collection(db, "institutions"), {
    name, adminUid, adminName, adminEmail,
    createdBy: createdByUid, createdAt: serverTimestamp(),
  });
  // Add admin as member
  await setDoc(doc(db, "institutions", ref.id, "members", adminUid), {
    role: "admin", name: adminName, email: adminEmail, joinedAt: serverTimestamp(),
  });
  // Update admin's profile
  await setUserProfile(adminUid, {
    name: adminName, email: adminEmail,
    role: "admin", institutionId: ref.id,
  });
  return ref.id;
}

export async function getAllInstitutions() {
  try {
    const snap = await getDocs(collection(db, "institutions"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function getInstitution(instId) {
  try {
    const snap = await getDoc(doc(db, "institutions", instId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch { return null; }
}

export async function getInstitutionMembers(instId) {
  try {
    const snap = await getDocs(collection(db, "institutions", instId, "members"));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch { return []; }
}

// ── Invites ───────────────────────────────────────────────────────────────────
function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function createInvite(institutionId, institutionName, invitedByName) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
  await setDoc(doc(db, "invites", token), {
    institutionId, institutionName, invitedByName,
    expiresAt: expiresAt.toISOString(), used: false, createdAt: serverTimestamp(),
  });
  return token;
}

export async function getInvite(token) {
  try {
    const snap = await getDoc(doc(db, "invites", token));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function consumeInvite(token, uid, name, email) {
  const invite = await getInvite(token);
  if (!invite || invite.used) return false;
  if (new Date(invite.expiresAt) < new Date()) return false;

  const { institutionId, institutionName } = invite;

  // Mark invite used
  await updateDoc(doc(db, "invites", token), { used: true, usedBy: uid });

  // Add to institution members
  await setDoc(doc(db, "institutions", institutionId, "members", uid), {
    role: "teacher", name, email, joinedAt: serverTimestamp(),
  });

  // Set user profile
  await setUserProfile(uid, { name, email, role: "teacher", institutionId });

  return { institutionId, institutionName };
}

export async function transferSuperAdmin(currentUid, newUid, newName, newEmail) {
  // Demote current
  const currentProfile = await getUserProfile(currentUid);
  await setUserProfile(currentUid, {
    ...currentProfile,
    role: currentProfile.institutionId ? "admin" : "none",
  });
  // Promote new
  const newProfile = await getUserProfile(newUid);
  await setUserProfile(newUid, {
    ...(newProfile || {}),
    name: newName, email: newEmail,
    role: "superadmin",
  });
}
