import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getAppMode() {
  if (isNativeApp()) return "native";
  return import.meta.env.VITE_APP_MODE === "admin" ? "admin" : "teacher";
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
  return import.meta.env.VITE_TEACHER_APP_URL || "https://teacherct.vercel.app/";
}

export function getAdminAppUrl() {
  return import.meta.env.VITE_ADMIN_APP_URL || "https://ctadmin.vercel.app/";
}
