import { todayKey } from "../../shared.jsx";

export function daysAgo(ts){
  if(!ts) return null;
  const days=Math.floor((Date.now()-ts)/(1000*60*60*24));
  if(days===0) return "Today";
  if(days===1) return "Yesterday";
  if(days<=7) return `${days}d ago`;
  if(days<=30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

export function lastEntryTs(notes={}, entryFilter = null){
  let latest=0;
  try {
    const scan = (value) => {
      if (Array.isArray(value)) {
        value.forEach(entry=>{ if(entry && (!entryFilter || entryFilter(entry)) && entry.created>latest) latest=entry.created; });
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.values(value).forEach(scan);
    };
    scan(notes || {});
  } catch {}
  return latest||null;
}

export function shortDateLabel(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

export function longDateLabel(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
}

export function currentMonthKey(now = new Date()){
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function localDateKey(value = new Date()){
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return todayKey();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDaysToDateKey(dateKey, days){
  const [year, month, day] = String(dateKey || todayKey()).split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function currentMonthStartKey(now = new Date()){
  return `${currentMonthKey(now)}-01`;
}

export function monthBoundsFromKey(monthKey = currentMonthKey()){
  const [rawYear, rawMonth] = String(monthKey || currentMonthKey()).split("-").map(Number);
  const year = rawYear || new Date().getFullYear();
  const month = rawMonth || (new Date().getMonth() + 1);
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startKey:`${year}-${paddedMonth}-01`,
    endKey:`${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
    monthKey:`${year}-${paddedMonth}`,
  };
}

export function countEntriesForMonth(classNotes = {}, monthKey = currentMonthKey()){
  return Object.entries(classNotes || {}).reduce((sum, [dateKey, entries]) => {
    if(!dateKey.startsWith(monthKey) || !Array.isArray(entries)) return sum;
    return sum + entries.length;
  }, 0);
}

export function getEntriesInRange(classNotes = {}, days = null, startKey = null, endKey = null){
  const dayCount = Number(days || 0);
  const hasExplicitRange = !!(startKey || endKey);
  const rangeEnd = endKey || (hasExplicitRange ? startKey : (dayCount ? todayKey() : null));
  const rangeStart = startKey || (hasExplicitRange ? endKey : (dayCount ? addDaysToDateKey(rangeEnd, -(Math.max(1, dayCount) - 1)) : null));
  const firstKey = rangeStart && rangeEnd && rangeStart > rangeEnd ? rangeEnd : rangeStart;
  const lastKey = rangeStart && rangeEnd && rangeStart > rangeEnd ? rangeStart : rangeEnd;
  const result = [];
  Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
    if(firstKey && dateKey < firstKey) return;
    if(lastKey && dateKey > lastKey) return;
    if(!Array.isArray(entries)) return;
    entries.forEach(entry => { if(entry) result.push({ dateKey, entry }); });
  });
  result.sort((a, b) => {
    if(b.dateKey !== a.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return (a.entry.timeStart || "").localeCompare(b.entry.timeStart || "");
  });
  return result;
}

export function parseClockMins(t){
  if(!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h,m] = t.split(":").map(Number);
  if(Number.isNaN(h) || Number.isNaN(m)) return null;
  return h*60 + m;
}

export function entryDurationMinutes(entry){
  const start = parseClockMins(entry?.timeStart);
  const end = parseClockMins(entry?.timeEnd);
  if(start===null || end===null || end<=start) return 0;
  return end - start;
}

export function formatDurationShort(totalMins){
  const mins = Math.max(0, Math.round(totalMins || 0));
  const h = Math.floor(mins/60);
  const m = mins%60;
  if(h && m) return `${h}h ${m}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}

const MONTH_NAMES_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatAdminDateKey(dateKey, options = { month:"short", day:"numeric" }){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||""))) return "";
  const [y,m,d]=String(dateKey).split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US", options);
}

export function adminPeriodLabel(period, rangeStart = null, rangeEnd = null){
  if(period==="today") return "Today";
  if(period==="yesterday") return "Yesterday";
  if(period==="week") return "This Week";
  if(period==="month") return "This Month";
  if(period==="range"){
    const start=/^\d{4}-\d{2}-\d{2}$/.test(String(rangeStart||"")) ? String(rangeStart) : "";
    const end=/^\d{4}-\d{2}-\d{2}$/.test(String(rangeEnd||"")) ? String(rangeEnd) : "";
    if(start && end){
      const first=start<=end?start:end;
      const last=start<=end?end:start;
      if(first===last) return formatAdminDateKey(first, { month:"short", day:"numeric", year:"numeric" });
      return `${formatAdminDateKey(first)} - ${formatAdminDateKey(last, { month:"short", day:"numeric", year:"numeric" })}`;
    }
    return "Selected Range";
  }
  if(period==="all") return "All Time";
  if(/^\d{4}-\d{2}$/.test(period)){
    const [y,m]=period.split("-").map(Number);
    return `${MONTH_NAMES_SHORT[m-1]} '${String(y).slice(2)}`;
  }
  return "All Time";
}

export function getPeriodFilter(period, rangeStart = null, rangeEnd = null){
  if(period==="today"){
    const today = todayKey();
    return {days:null,startKey:today,endKey:today};
  }
  if(period==="yesterday"){
    const yesterday = addDaysToDateKey(todayKey(), -1);
    return {days:null,startKey:yesterday,endKey:yesterday};
  }
  if(period==="week"){
    const today = todayKey();
    return {days:null,startKey:addDaysToDateKey(today, -6),endKey:today};
  }
  if(period==="month"){
    const bounds = monthBoundsFromKey(currentMonthKey());
    return {days:null,startKey:bounds.startKey,endKey:bounds.endKey};
  }
  if(period==="range"){
    const fallback=todayKey();
    const start=/^\d{4}-\d{2}-\d{2}$/.test(String(rangeStart||"")) ? String(rangeStart) : (/^\d{4}-\d{2}-\d{2}$/.test(String(rangeEnd||"")) ? String(rangeEnd) : fallback);
    const end=/^\d{4}-\d{2}-\d{2}$/.test(String(rangeEnd||"")) ? String(rangeEnd) : start;
    return start<=end ? {days:null,startKey:start,endKey:end} : {days:null,startKey:end,endKey:start};
  }
  if(period==="all") return {days:null,startKey:null,endKey:null};
  if(/^\d{4}-\d{2}$/.test(period)){
    const [y,m]=period.split("-").map(Number);
    const startKey=`${y}-${String(m).padStart(2,"0")}-01`;
    const lastDay=new Date(y,m,0).getDate();
    const endKey=`${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    return {days:null,startKey,endKey};
  }
  return {days:null,startKey:null,endKey:null};
}
