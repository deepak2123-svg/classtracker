import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function readServiceAccountFromEnv() {
  const rawJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (rawJson.trim()) {
    return JSON.parse(rawJson);
  }

  const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
  if (base64.trim()) {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  }

  const projectId = String(process.env.FIREBASE_ADMIN_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function ensureAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = readServiceAccountFromEnv();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || undefined,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || undefined,
  });
}

export function adminAuth() {
  return getAuth(ensureAdminApp());
}

export function adminDb() {
  return getFirestore(ensureAdminApp());
}

export async function requireAdminUser(req) {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    const error = new Error("Missing Firebase ID token.");
    error.statusCode = 401;
    throw error;
  }

  const decoded = await adminAuth().verifyIdToken(token);
  const roleSnap = await adminDb().doc(`roles/${decoded.uid}`).get();
  const role = roleSnap.exists ? roleSnap.data()?.role : "teacher";
  if (role !== "admin") {
    const error = new Error("Admin access is required.");
    error.statusCode = 403;
    throw error;
  }

  return {
    uid: decoded.uid,
    email: decoded.email || "",
    name: decoded.name || "",
    role,
  };
}
