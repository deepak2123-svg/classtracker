import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getAppMode() {
  if (isNativeApp()) return "native";
  const configuredMode = String(import.meta.env.VITE_APP_MODE || "").trim().toLowerCase();
  if (configuredMode === "manager") return "manager";
  if (configuredMode === "admin") return "admin";
  return "teacher";
}

export function canUseGooglePopupAuth() {
  return !isNativeApp();
}

export function getGoogleWebClientId() {
  return String(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || "").trim();
}

export function hasNativeGoogleClientId() {
  return !!getGoogleWebClientId();
}

export function getTeacherAppUrl() {
  return import.meta.env.VITE_TEACHER_APP_URL || "https://teacher.ledgrclasses.com/";
}

export function getAdminAppUrl() {
  return import.meta.env.VITE_ADMIN_APP_URL || "https://admin.ledgrclasses.com/";
}

export function getManagerAppUrl() {
  return import.meta.env.VITE_MANAGER_APP_URL || "https://manager.ledgrclasses.com/";
}
