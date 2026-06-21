import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
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

function getFirebaseProjectId() {
  const serviceAccount = readServiceAccountFromEnv();
  return String(
    serviceAccount?.projectId
    || serviceAccount?.project_id
    || process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || ""
  ).trim();
}

let jwtModulePromise = null;
let secureTokenCertCache = {
  expiresAt: 0,
  certs: null,
};

async function loadJwtModule() {
  jwtModulePromise ||= import("jsonwebtoken");
  const jwtModule = await jwtModulePromise;
  return jwtModule.default || jwtModule;
}

async function getSecureTokenCerts({ forceRefresh = false } = {}) {
  if (!forceRefresh && secureTokenCertCache.certs && Date.now() < secureTokenCertCache.expiresAt) {
    return secureTokenCertCache.certs;
  }

  const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!response.ok) {
    const error = new Error("Could not load Firebase signing certificates.");
    error.statusCode = 500;
    throw error;
  }

  const certs = await response.json();
  const cacheControl = String(response.headers.get("cache-control") || "");
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  secureTokenCertCache = {
    certs,
    expiresAt: Date.now() + Math.max(60_000, maxAgeMs - 5_000),
  };
  return certs;
}

async function verifyFirebaseIdToken(token) {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    const error = new Error("Missing Firebase project id for admin verification.");
    error.statusCode = 500;
    throw error;
  }

  const jwt = await loadJwtModule();
  const decoded = jwt.decode(token, { complete: true });
  const header = decoded?.header || {};
  const kid = String(header.kid || "").trim();
  if (!kid || header.alg !== "RS256") {
    const error = new Error("Invalid Firebase ID token.");
    error.statusCode = 401;
    throw error;
  }

  let certs = await getSecureTokenCerts();
  let cert = certs?.[kid];
  if (!cert) {
    certs = await getSecureTokenCerts({ forceRefresh: true });
    cert = certs?.[kid];
  }
  if (!cert) {
    const error = new Error("Firebase signing key was not found for this ID token.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return jwt.verify(token, cert, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
  } catch (verifyError) {
    const error = new Error(verifyError?.message || "Invalid Firebase ID token.");
    error.statusCode = 401;
    throw error;
  }
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

  const decoded = await verifyFirebaseIdToken(token);
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
