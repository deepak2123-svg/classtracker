import { todayKey } from "../../shared.jsx";

const ADMIN_TEACHER_DETAILS_CACHE_KEY = "ledgr_admin_teacher_details_v1";
const ADMIN_TEACHER_DETAILS_CACHE_VERSION = 1;

function getAdminTeacherDetailsCacheStorage(){
  if(typeof window === "undefined") return null;
  try{
    const storage = window.localStorage;
    const testKey = "__ledgr_admin_cache_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  }catch{
    try{ return window.sessionStorage || null; }catch{ return null; }
  }
}

export function readAdminTeacherDetailsCache(){
  const storage = getAdminTeacherDetailsCacheStorage();
  if(!storage) return {};
  try{
    const raw = storage.getItem(ADMIN_TEACHER_DETAILS_CACHE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(
      !parsed
      || parsed.version !== ADMIN_TEACHER_DETAILS_CACHE_VERSION
      || parsed.dayKey !== todayKey()
      || !parsed.records
      || typeof parsed.records !== "object"
    ){
      storage.removeItem(ADMIN_TEACHER_DETAILS_CACHE_KEY);
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.records)
        .filter(([uid, data]) => uid && data && typeof data === "object")
    );
  }catch{
    return {};
  }
}

export function writeAdminTeacherDetailsCache(records){
  const storage = getAdminTeacherDetailsCacheStorage();
  if(!storage) return;
  const entries = Object.entries(records || {})
    .filter(([uid, data]) => uid && data && typeof data === "object");
  try{
    if(!entries.length){
      storage.removeItem(ADMIN_TEACHER_DETAILS_CACHE_KEY);
      return;
    }
    const payload = {
      version:ADMIN_TEACHER_DETAILS_CACHE_VERSION,
      dayKey:todayKey(),
      savedAt:Date.now(),
      records:Object.fromEntries(entries),
    };
    storage.setItem(ADMIN_TEACHER_DETAILS_CACHE_KEY, JSON.stringify(payload));
  }catch{
    try{
      const trimmed = entries.slice(Math.max(0, entries.length - 90));
      const payload = {
        version:ADMIN_TEACHER_DETAILS_CACHE_VERSION,
        dayKey:todayKey(),
        savedAt:Date.now(),
        pruned:true,
        records:Object.fromEntries(trimmed),
      };
      storage.setItem(ADMIN_TEACHER_DETAILS_CACHE_KEY, JSON.stringify(payload));
    }catch{}
  }
}
