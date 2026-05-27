import React, { useState, useEffect, useRef, useMemo, Component } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconArrowRight,
  IconBell,
  IconBook2,
  IconBuilding,
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClockHour4,
  IconDeviceFloppy,
  IconDots,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconHistory,
  IconHome2,
  IconInfoCircle,
  IconLogout,
  IconMail,
  IconMoon,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSchool,
  IconSearch,
  IconSparkles,
  IconSun,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { loadUserDataState, saveUserData, logout, syncTeacherIndex, deleteClassNotes, getGlobalInstitutes, getAllInstituteSections, purgeExpiredTrash } from "./firebase";
import { TAG_STYLES, STATUS_STYLES, Avatar, todayKey, toDateKey, formatDateLabel, fmt, formatPeriod, getSectionTone } from "./shared.jsx";

const TEACHER_THEME_STORAGE_KEY = "classlog_teacher_theme";
const TEACHER_LOCAL_NOTICE_DISMISS_KEY = "classlog_teacher_local_notice_dismissed";
const LOCAL_SANS_FONT = "'Inter',sans-serif";
const LOCAL_DISPLAY_FONT = "'Poppins',sans-serif";
const LOCAL_MONO_FONT = "'Inter',sans-serif";
const TEACHER_THEMES = {
  light: {
    forest:"#16324F",
    forestS:"#1F4568",
    green:"#0F6B78",
    greenV:"#155E75",
    greenL:"#E7F4F6",
    blue:"#2563EB",
    bg:"#F5F7FA",
    surface:"#FFFFFF",
    surfaceAlt:"#EFF3F7",
    surfaceSoft:"#FAFBFC",
    pageBg:"#F5F7FA",
    border:"#DCE3EA",
    borderM:"#CAD4DE",
    text:"#101828",
    textS:"#344054",
    textM:"#667085",
    textL:"#98A2B3",
    red:"#B42318",
    redL:"#FEF3F2",
    navy:"#0F6B78",
    shadowSm:"0 1px 2px rgba(16,24,40,0.05)",
    shadowMd:"0 8px 18px rgba(16,24,40,0.07)",
    shadowLg:"0 14px 30px rgba(16,24,40,0.10)",
    topbarBg:"rgba(255,255,255,0.98)",
    topbarBorder:"rgba(220,227,234,0.96)",
    topbarButtonBg:"#FFFFFF",
    topbarButtonBorder:"#DCE3EA",
    heroBg:"linear-gradient(135deg, #16324F 0%, #0F6B78 100%)",
    classCardBg:"#FFFFFF",
    navBg:"rgba(255,255,255,0.96)",
    navBorder:"rgba(220,227,234,0.98)",
    navActiveBg:"rgba(15,107,120,0.10)",
  },
  dark: {
    forest:"#07111B",
    forestS:"#0C1825",
    green:"#4DB7C8",
    greenV:"#74D0DE",
    greenL:"rgba(77,183,200,0.16)",
    blue:"#60A5FA",
    bg:"#08111B",
    surface:"#101926",
    surfaceAlt:"#162231",
    surfaceSoft:"#0D1622",
    pageBg:"#08111B",
    border:"#243244",
    borderM:"#334155",
    text:"#F8FAFC",
    textS:"#D7E2EE",
    textM:"#94A3B8",
    textL:"#64748B",
    red:"#F87171",
    redL:"rgba(248,113,113,0.18)",
    navy:"#7DD4E4",
    shadowSm:"0 2px 10px rgba(2,6,23,0.32)",
    shadowMd:"0 14px 30px rgba(2,6,23,0.42)",
    shadowLg:"0 28px 56px rgba(2,6,23,0.54)",
    topbarBg:"rgba(7,17,27,0.94)",
    topbarBorder:"rgba(51,65,85,0.78)",
    topbarButtonBg:"rgba(15,23,42,0.72)",
    topbarButtonBorder:"rgba(51,65,85,0.8)",
    heroBg:"linear-gradient(180deg, #101926 0%, #0C1724 100%)",
    classCardBg:"#101926",
    navBg:"rgba(10,17,26,0.98)",
    navBorder:"rgba(36,50,68,0.92)",
    navActiveBg:"rgba(77,183,200,0.16)",
  },
};

function readStoredTeacherTheme(){
  if(typeof window==="undefined") return "light";
  try{
    const stored = localStorage.getItem(TEACHER_THEME_STORAGE_KEY);
    if(stored==="light" || stored==="dark") return stored;
  }catch(e){}
  return "light";
}

function readStoredTeacherLocalNoticeSignature(storageKey){
  if(typeof window==="undefined" || !storageKey) return "";
  try{
    return localStorage.getItem(storageKey) || "";
  }catch(e){}
  return "";
}

function getTeacherLocalNoticeSignature(warning){
  if(warning?.kind !== "orphaned") return "";
  const count = Number(warning?.count || 0);
  return count > 0 ? `orphaned_${count}` : "";
}

function getTeacherThemeVars(themeName){
  const theme = TEACHER_THEMES[themeName] || TEACHER_THEMES.light;
  return {
    "--ledgr-forest":theme.forest,
    "--ledgr-forest-s":theme.forestS,
    "--ledgr-green":theme.green,
    "--ledgr-green-v":theme.greenV,
    "--ledgr-green-l":theme.greenL,
    "--ledgr-blue":theme.blue,
    "--ledgr-bg":theme.bg,
    "--ledgr-surface":theme.surface,
    "--ledgr-surface-alt":theme.surfaceAlt,
    "--ledgr-surface-soft":theme.surfaceSoft,
    "--ledgr-page-bg":theme.pageBg,
    "--ledgr-border":theme.border,
    "--ledgr-border-m":theme.borderM,
    "--ledgr-text":theme.text,
    "--ledgr-text-s":theme.textS,
    "--ledgr-text-m":theme.textM,
    "--ledgr-text-l":theme.textL,
    "--ledgr-red":theme.red,
    "--ledgr-red-l":theme.redL,
    "--ledgr-navy":theme.navy,
    "--ledgr-shadow-sm":theme.shadowSm,
    "--ledgr-shadow-md":theme.shadowMd,
    "--ledgr-shadow-lg":theme.shadowLg,
    "--ledgr-topbar-bg":theme.topbarBg,
    "--ledgr-topbar-border":theme.topbarBorder,
    "--ledgr-topbar-button-bg":theme.topbarButtonBg,
    "--ledgr-topbar-button-border":theme.topbarButtonBorder,
    "--ledgr-hero-bg":theme.heroBg,
    "--ledgr-class-card-bg":theme.classCardBg,
    "--ledgr-nav-bg":theme.navBg,
    "--ledgr-nav-border":theme.navBorder,
    "--ledgr-nav-active-bg":theme.navActiveBg,
  };
}

// ── Design tokens (mirrors CSS vars) ─────────────────────────────────────────
const G = {
  forest:"var(--ledgr-forest)",  forestS:"var(--ledgr-forest-s)",
  green:"var(--ledgr-green)",    greenV:"var(--ledgr-green-v)",  greenL:"var(--ledgr-green-l)",
  blue:"var(--ledgr-blue)",
  bg:"var(--ledgr-bg)",          surface:"var(--ledgr-surface)",
  surfaceAlt:"var(--ledgr-surface-alt)",
  surfaceSoft:"var(--ledgr-surface-soft)",
  pageBg:"var(--ledgr-page-bg)",
  border:"var(--ledgr-border)",  borderM:"var(--ledgr-border-m)",
  text:"var(--ledgr-text)",
  textS:"var(--ledgr-text-s)",
  textM:"var(--ledgr-text-m)",
  textL:"var(--ledgr-text-l)",
  red:"var(--ledgr-red)",        redL:"var(--ledgr-red-l)",
  navy:"var(--ledgr-navy)",
  shadowSm:"var(--ledgr-shadow-sm)",
  shadowMd:"var(--ledgr-shadow-md)",
  shadowLg:"var(--ledgr-shadow-lg)",
  topbarBg:"var(--ledgr-topbar-bg)",
  topbarBorder:"var(--ledgr-topbar-border)",
  topbarButtonBg:"var(--ledgr-topbar-button-bg)",
  topbarButtonBorder:"var(--ledgr-topbar-button-border)",
  heroBg:"var(--ledgr-hero-bg)",
  classCardBg:"var(--ledgr-class-card-bg)",
  navBg:"var(--ledgr-nav-bg)",
  navBorder:"var(--ledgr-nav-border)",
  navActiveBg:"var(--ledgr-nav-active-bg)",
  mono:LOCAL_MONO_FONT,
  sans:LOCAL_SANS_FONT,
  display:LOCAL_DISPLAY_FONT,
};

const APP_ICON_STROKE = 2.05;
let exportPdfRuntimePromise = null;
let nativeExportRuntimePromise = null;

function AppIcon({ icon, size = 18, color = "currentColor", stroke = APP_ICON_STROKE, style = {} }){
  if(!icon) return null;
  if(typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)){
    const Icon = icon;
    return <Icon size={size} color={color} stroke={stroke} style={{display:"block",flexShrink:0,...style}} />;
  }
  return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",lineHeight:1,...style}}>{icon}</span>;
}

async function loadExportPdfRuntime(){
  if(!exportPdfRuntimePromise){
    exportPdfRuntimePromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]).then(([jspdfModule, autoTableModule]) => ({
      jsPDF: jspdfModule.jsPDF,
      autoTable: autoTableModule.default,
    }));
  }
  return exportPdfRuntimePromise;
}

async function loadNativeExportRuntime(){
  if(!nativeExportRuntimePromise){
    nativeExportRuntimePromise = Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]).then(([filesystemModule, shareModule]) => ({
      Filesystem: filesystemModule.Filesystem,
      Directory: filesystemModule.Directory,
      Encoding: filesystemModule.Encoding,
      Share: shareModule.Share,
    }));
  }
  return nativeExportRuntimePromise;
}

function hexToRgba(hex, alpha = 1){
  const value = String(hex || "").replace("#", "").trim();
  if(value.length !== 6) return `rgba(15,23,42,${alpha})`;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  if([r, g, b].some(Number.isNaN)) return `rgba(15,23,42,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getTeacherSectionSurfaceStyles(tone, isDarkTheme = false){
  if(!isDarkTheme){
    return {
      headerBg:tone?.bg || "#1D4ED8",
      headerBorder:"rgba(15,23,42,0.92)",
      titleColor:tone?.text || "#FFFFFF",
      eyebrowColor:"rgba(255,255,255,0.72)",
      chipBg:"#FFFFFF",
      chipBorder:"rgba(15,23,42,0.18)",
      chipText:"#101828",
      statBg:"#FFFFFF",
      statBorder:"#DCE3EA",
      primaryAccent:tone?.bg || "#1D4ED8",
      primaryButtonBg:tone?.bg || "#1D4ED8",
      primaryButtonText:"#FFFFFF",
      emptyBg:"linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
      noteBg:"linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
      noteBorder:"#DCE3EA",
    };
  }
  const accent = tone?.bg || "#4DB7C8";
  return {
    headerBg:`linear-gradient(180deg, rgba(7,14,24,0.98) 0%, ${hexToRgba(accent, 0.24)} 100%)`,
    headerBorder:hexToRgba(accent, 0.28),
    titleColor:"#F8FAFC",
    eyebrowColor:"rgba(226,232,240,0.72)",
    chipBg:"rgba(8,15,25,0.76)",
    chipBorder:hexToRgba(accent, 0.24),
    chipText:"#E8F1FA",
    statBg:"rgba(8,15,25,0.78)",
    statBorder:"rgba(71,85,105,0.56)",
    primaryAccent:accent,
    primaryButtonBg:`linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.82)} 100%)`,
    primaryButtonText:"#FFFFFF",
    emptyBg:`linear-gradient(180deg, rgba(12,20,31,0.98) 0%, ${hexToRgba(accent, 0.12)} 100%)`,
    noteBg:"linear-gradient(180deg, rgba(12,20,31,0.98) 0%, rgba(10,16,26,0.98) 100%)",
    noteBorder:"rgba(71,85,105,0.68)",
  };
}

function getTeacherAnalyticsSurfaceStyles(accent = "#0F6B78", isDarkTheme = false){
  const baseAccent = accent || "#0F6B78";
  if(!isDarkTheme){
    return {
      heroBg:`linear-gradient(135deg, ${hexToRgba(baseAccent, 0.14)} 0%, #FFFFFF 58%, #F8FAFC 100%)`,
      heroBorder:hexToRgba(baseAccent, 0.18),
      heroText:"#0F172A",
      heroMuted:"#475569",
      heroEyebrow:"#64748B",
      heroChipBg:"#FFFFFF",
      heroChipBorder:hexToRgba(baseAccent, 0.16),
      heroChipText:"#0F172A",
      metricBg:"#FFFFFF",
      metricBorder:"#DCE3EA",
      metricSoftBg:"#F8FAFC",
      metricSoftBorder:"#E2E8F0",
      metricMuted:"#64748B",
      sectionBg:"#FFFFFF",
      sectionBorder:"#DCE3EA",
      sectionSoftBg:"#F8FAFC",
      sectionSoftBorder:"#E2E8F0",
      progressTrack:"#E2E8F0",
      progressFill:baseAccent,
      graphBase:"#E2E8F0",
      buttonBg:"#FFFFFF",
      buttonBorder:"#DCE3EA",
      buttonText:"#0F172A",
      accent:baseAccent,
    };
  }
  return {
    heroBg:`linear-gradient(145deg, rgba(7,17,27,0.98) 0%, ${hexToRgba(baseAccent, 0.22)} 100%)`,
    heroBorder:hexToRgba(baseAccent, 0.28),
    heroText:"#F8FAFC",
    heroMuted:"#C7D2E0",
    heroEyebrow:"#94A3B8",
    heroChipBg:"rgba(8,15,25,0.78)",
    heroChipBorder:hexToRgba(baseAccent, 0.22),
    heroChipText:"#E8F1FA",
    metricBg:"rgba(16,25,38,0.96)",
    metricBorder:"rgba(51,65,85,0.78)",
    metricSoftBg:"rgba(10,16,26,0.9)",
    metricSoftBorder:"rgba(51,65,85,0.62)",
    metricMuted:"#94A3B8",
    sectionBg:"rgba(16,25,38,0.98)",
    sectionBorder:"rgba(51,65,85,0.78)",
    sectionSoftBg:"rgba(10,16,26,0.92)",
    sectionSoftBorder:"rgba(51,65,85,0.68)",
    progressTrack:"rgba(51,65,85,0.92)",
    progressFill:baseAccent,
    graphBase:"rgba(51,65,85,0.92)",
    buttonBg:"rgba(15,23,42,0.76)",
    buttonBorder:"rgba(51,65,85,0.82)",
    buttonText:"#E2E8F0",
    accent:baseAccent,
  };
}

function hslToHex(h, s, l){
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s))) / 100;
  const light = Math.max(0, Math.min(100, Number(l))) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if(segment >= 0 && segment < 1){ red = chroma; green = x; }
  else if(segment < 2){ red = x; green = chroma; }
  else if(segment < 3){ green = chroma; blue = x; }
  else if(segment < 4){ green = x; blue = chroma; }
  else if(segment < 5){ red = x; blue = chroma; }
  else { red = chroma; blue = x; }
  const match = light - chroma / 2;
  const toHex = value => Math.round((value + match) * 255).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
}

function tintHex(hex, towardWhite = 0.84){
  const value = String(hex || "").replace("#", "").trim();
  if(value.length !== 6) return "#EEF3F8";
  const mix = Math.max(0, Math.min(1, Number(towardWhite)));
  const toInt = part => Number.parseInt(part, 16);
  const r = toInt(value.slice(0, 2));
  const g = toInt(value.slice(2, 4));
  const b = toInt(value.slice(4, 6));
  if([r, g, b].some(Number.isNaN)) return "#EEF3F8";
  const blend = channel => Math.round(channel + (255 - channel) * mix).toString(16).padStart(2, "0");
  return `#${blend(r)}${blend(g)}${blend(b)}`.toUpperCase();
}

function buildInstituteTone(bg){
  const base = String(bg || "#1F3A5F").toUpperCase();
  return {
    bg:base,
    light:tintHex(base, 0.64),
    surface:tintHex(base, 0.68),
    pill:tintHex(base, 0.76),
    border:tintHex(base, 0.5),
    ink:base,
    text:"#FFFFFF",
  };
}

const INSTITUTE_BASE_COLORS = [
  "#2563EB", "#0F766E", "#7C3AED", "#EA580C",
  "#DC2626", "#0891B2", "#059669", "#4F46E5",
  "#BE185D", "#475569", "#B45309", "#0284C7",
  "#7C2D12", "#166534", "#6D28D9", "#1D4ED8",
  "#C2410C", "#0E7490", "#9333EA", "#15803D",
];

function buildInstituteColorMap(names = []){
  const uniqueNames = [...new Set((names || []).map(name => String(name || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const map = new Map();
  uniqueNames.forEach((name, index) => {
    const bg = INSTITUTE_BASE_COLORS[index] || hslToHex(210 + index * 37, 28, 30);
    map.set(name, buildInstituteTone(bg));
  });
  return map;
}

let ACTIVE_INSTITUTE_COLOR_MAP = new Map();
const DEFAULT_INSTITUTE_TONE = buildInstituteTone(INSTITUTE_BASE_COLORS[0]);

function instColor(name) {
  const key = String(name || "").trim();
  if(!key) return DEFAULT_INSTITUTE_TONE;
  return ACTIVE_INSTITUTE_COLOR_MAP.get(key) || DEFAULT_INSTITUTE_TONE;
}

function normaliseChoiceKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueChoiceValues(values) {
  const seen = new Set();
  const result = [];
  (values || []).forEach(value => {
    const label = String(value || "").trim().replace(/\s+/g, " ");
    const key = normaliseChoiceKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
}

function mergeChoiceValues(...lists) {
  return uniqueChoiceValues(lists.flatMap(list => Array.isArray(list) ? list : []));
}

function normaliseProfile(profile, fallbackName = "") {
  const source = profile || {};
  return {
    name: String(source.name || fallbackName || "").trim(),
    subjects: uniqueChoiceValues(Array.isArray(source.subjects) ? source.subjects : []),
    institutes: uniqueChoiceValues(Array.isArray(source.institutes) ? source.institutes : []),
  };
}

function hasCompleteProfile(profile) {
  const current = normaliseProfile(profile);
  return !!current.name && current.subjects.length > 0;
}

const DEFAULT_DATA = {classes:[],notes:{},subjects:[],institutes:[],sections:[],profile:normaliseProfile(),trash:{classes:[],notes:[]}};
const TEACHER_ALLOWED_VIEWS = new Set([
  "home",
  "profile",
  "notifications",
  "stats",
  "classTimeline",
  "trash",
  "classDetail",
  "addClass",
  "addNote",
  "editNote",
]);

function sanitizeTeacherView(view) {
  const key = String(view || "").trim();
  return TEACHER_ALLOWED_VIEWS.has(key) ? key : "home";
}

function resolveTeacherView(view, { activeClass = null, editNote = null, statsClassId = null } = {}) {
  const safeView = sanitizeTeacherView(view);
  if (safeView === "classTimeline" && !statsClassId) return "stats";
  if ((safeView === "classDetail" || safeView === "addNote") && !activeClass) return "home";
  if (safeView === "editNote") {
    if (activeClass && editNote) return "editNote";
    return activeClass ? "classDetail" : "home";
  }
  return safeView;
}

function readClientProfile(){
  if(typeof window==="undefined"){
    return { isMobile:false, reduceMotion:false, weakDevice:false, mobileLite:false };
  }
  const nav = window.navigator || {};
  const ua = String(nav.userAgent || "").toLowerCase();
  const width = window.innerWidth || 1024;
  const isMobile = width < 768;
  const isAndroid = /android/.test(ua);
  const deviceMemory = Number(nav.deviceMemory || 0);
  const hardwareConcurrency = Number(nav.hardwareConcurrency || 0);
  const reduceMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const weakMemory = deviceMemory > 0 && deviceMemory <= 4;
  const weakCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 4;
  const weakDevice = reduceMotion || (isAndroid && (weakMemory || weakCpu || width <= 412)) || (isMobile && weakMemory && weakCpu);
  return {
    isMobile,
    reduceMotion,
    weakDevice,
    mobileLite:isMobile && (weakDevice || width <= 430),
  };
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class CTErrorBoundary extends Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(e){ return {error:e}; }
  render(){
    if(this.state.error) return(
      <div style={{minHeight:"100vh",background:"#F5F7F5",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:24}}>
        <div style={{textAlign:"center",maxWidth:360}}>
          <div style={{width:56,height:56,borderRadius:18,background:"#FFF7ED",color:"#B45309",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
            <AppIcon icon={IconAlertTriangle} size={30} color="#B45309" />
          </div>
          <h2 style={{fontFamily:"'Poppins',sans-serif",marginBottom:8,color:"#111827"}}>Something went wrong</h2>
          <p style={{color:"#4B5563",fontSize:14,marginBottom:16,lineHeight:1.6}}>{this.state.error?.message}</p>
          <button onClick={()=>window.location.reload()} style={{background:"#1B8A4C",color:"#fff",border:"none",borderRadius:9,padding:"10px 24px",fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
            Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}


// ── Confirm Modal (replaces window.confirm everywhere) ───────────────────────
function ConfirmModal({message, confirmLabel="Delete", onConfirm, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 22px",width:"100%",maxWidth:340,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <div style={{width:54,height:54,borderRadius:16,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"#DC2626"}}>
          <AppIcon icon={IconTrash} size={26} color="#DC2626" />
        </div>
        <p style={{fontSize:15,color:"#374151",marginBottom:24,lineHeight:1.6,fontFamily:"'Inter',sans-serif"}}>{message}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            Cancel
          </button>
          <button onClick={()=>{onConfirm();onClose();}}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#DC2626",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


function hasLiveEntryDraft(form){
  if(!form) return false;
  return Boolean(
    String(form.title || "").trim() ||
    String(form.body || "").trim() ||
    String(form.status || "").trim() ||
    String(form.timeStart || "").trim() ||
    String(form.timeEnd || "").trim()
  );
}

function buildTeacherDraftStorageKey(userId, classId, dateKey, noteId = "new"){
  return `classlog_entry_draft_${userId}_${classId}_${dateKey}_${noteId}`;
}


// ── Sign Out Modal ────────────────────────────────────────────────────────────
function SignOutModal({onConfirm,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"28px 24px",width:"100%",maxWidth:340,textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <AppIcon icon={IconLogout} size={26} color="#DC2626" />
        </div>
        <h3 style={{fontSize:20,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif",marginBottom:8}}>Sign out?</h3>
        <p style={{fontSize:14,color:"#6B7280",marginBottom:24,lineHeight:1.6}}>You will need to sign back in to access your classes.</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",minHeight:48,fontFamily:"'Inter',sans-serif"}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#DC2626",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",minHeight:48,fontFamily:"'Inter',sans-serif"}}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ── Academic session ──────────────────────────────────────────────────────────
function getAcademicSession(dk){const[y,m]=dk.split("-").map(Number);return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;}
function currentSession(){const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;}
function dateFromKey(dk){
  const [y,m,d] = `${dk||""}`.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
function groupDatesByPeriod(dates){
  const now=new Date(),tk=todayKey();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const curS=currentSession();
  const groups={};
  dates.forEach(dk=>{
    const d=new Date(dk);
    let g;
    if(dk===tk)g="Today";
    else if(d>=weekStart)g="This Week";
    else if(d>=monthStart)g="This Month";
    else{const s=getAcademicSession(dk);g=s===curS?`Session ${curS}`:`Session ${s}`;}
    if(!groups[g])groups[g]=[];
    groups[g].push(dk);
  });
  const order=["Today","This Week","This Month",`Session ${curS}`];
  const res=[];
  order.forEach(g=>{if(groups[g])res.push({label:g,dates:groups[g]});});
  Object.keys(groups).forEach(g=>{if(!order.includes(g))res.push({label:g,dates:groups[g]});});
  return res;
}

// ── Date window ───────────────────────────────────────────────────────────────
function buildDateWindow(){
  const now=new Date(),days=[];
  for(let i=-7;i<=0;i++){
    const d=new Date(now);d.setDate(d.getDate()+i);
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const MONTHS_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
    days.push({key:`${y}-${m}-${day}`,num:d.getDate(),dayName:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()],isSun:d.getDay()===0,month:MONTHS[d.getMonth()],monthFull:MONTHS_FULL[d.getMonth()],year:d.getFullYear(),offset:i});
  }
  return days;
}
function isDateAllowed(dk){return buildDateWindow().some(d=>d.key===dk);}

function parseDateKey(dk){
  const [y,m,d] = String(dk || "").split("-").map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysSinceDateKey(dk){
  const date = parseDateKey(dk);
  if(!date) return null;
  const today = parseDateKey(todayKey());
  return Math.max(0, Math.round((today - date) / (1000 * 60 * 60 * 24)));
}

function formatDaysSinceLastLog(dk){
  if(!dk) return { label:"Needs first log", short:"No logs yet", tone:"red", days:null };
  const days = daysSinceDateKey(dk);
  if(days===null) return { label:"Last log unknown", short:"Unknown", tone:"amber", days:null };
  if(days===0) return { label:"Logged today", short:"Today", tone:"green", days:0 };
  if(days===1) return { label:"1 day ago", short:"1d ago", tone:"amber", days:1 };
  return { label:`${days} days ago`, short:`${days}d ago`, tone:days >= 7 ? "red" : "amber", days };
}

function formatHeroDateLabel(now = new Date()){
  return now.toLocaleDateString("en-IN",{
    weekday:"long",
    day:"numeric",
    month:"short",
  });
}

function countWorkingDaysElapsed(now = new Date()){
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  let total = 0;
  while(cursor <= now){
    if(cursor.getDay() !== 0) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(total, 1);
}

function buildTeacherQuickHomeSummary(activeClasses = [], notes = {}){
  const now = new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthLoggedDaySet = new Set();
  const institutes = [...new Set(activeClasses.map(c=>c.institute||""))].filter(Boolean);
  let loggedToday = 0;
  let monthEntries = 0;

  activeClasses.forEach(cls=>{
    const classNotes = notes?.[cls.id] || {};
    const todayEntries = Array.isArray(classNotes[todayKey()]) ? classNotes[todayKey()].length : 0;
    if(todayEntries > 0) loggedToday += 1;
    Object.entries(classNotes).forEach(([dk, arr])=>{
      if(!Array.isArray(arr) || !arr.length || !dk.startsWith(monthKey)) return;
      monthEntries += arr.length;
      monthLoggedDaySet.add(dk);
    });
  });

  const workingDaysElapsed = countWorkingDaysElapsed(now);
  const monthLoggedDays = monthLoggedDaySet.size;
  return {
    active:activeClasses.length,
    loggedToday,
    monthEntries,
    instituteCount:institutes.length || 1,
    monthLoggedDays,
    workingDaysElapsed,
    monthProgressPct:Math.max(0, Math.min(1, monthLoggedDays / workingDaysElapsed)),
    todayLabel:formatHeroDateLabel(now),
    needsAttentionCount:Math.max(0, activeClasses.length - loggedToday),
  };
}

function buildClassEntryMetrics(classNotes = {}, now = new Date()){
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthLabel = now.toLocaleDateString("en-IN", { month:"short", year:"numeric" });
  const noteDates = {};
  let monthEntries = 0;
  let totalCount = 0;

  Object.entries(classNotes || {}).forEach(([dk, arr])=>{
    if(!Array.isArray(arr) || !arr.length) return;
    totalCount += arr.length;
    noteDates[dk] = arr.length;
    if(dk.startsWith(monthKey)) monthEntries += arr.length;
  });

  const todayEntries = Array.isArray(classNotes?.[todayKey()]) ? classNotes[todayKey()].length : 0;
  const activeDays = Object.keys(noteDates).length;
  const lastLoggedKey = Object.keys(noteDates).sort().pop() || null;
  const lastLogMeta = formatDaysSinceLastLog(lastLoggedKey);
  const lastLogTone = getLastLogToneStyles(lastLogMeta);
  const needsLogToday = todayEntries === 0;

  return {
    todayEntries,
    monthEntries,
    monthLabel,
    totalCount,
    noteDates,
    activeDays,
    lastLoggedKey,
    lastLogMeta,
    lastLogTone,
    needsLogToday,
  };
}

function getLastLogToneStyles(meta){
  if(meta?.tone === "green"){
    return {
      background:"rgba(34,197,94,0.10)",
      border:"1px solid rgba(34,197,94,0.18)",
      color:"#15803D",
    };
  }
  if(meta?.tone === "red"){
    return {
      background:"rgba(239,68,68,0.08)",
      border:"1px solid rgba(239,68,68,0.18)",
      color:"#B91C1C",
    };
  }
  return {
    background:"rgba(245,158,11,0.10)",
    border:"1px solid rgba(245,158,11,0.18)",
    color:"#B45309",
  };
}

function getTodayEntryStatusStyles(todayEntries = 0){
  if(todayEntries > 0){
    return {
      label:"Logged today",
      short:"done",
      background:"#ECFDF3",
      border:"#BBF7D0",
      color:"#15803D",
    };
  }
  return {
    label:"Not logged today",
    short:"not logged",
    background:"#FFF7ED",
    border:"#FED7AA",
    color:"#B45309",
  };
}

function getSectionCardTodayDotStyles(todayEntries = 0){
  if(todayEntries > 0){
    return {
      background:"#16A34A",
      borderColor:"#166534",
      boxShadow:"0 0 0 3px rgba(22,163,74,0.12)",
    };
  }
  return {
    background:"transparent",
    borderColor:"rgba(15,23,42,0.78)",
    boxShadow:"none",
  };
}

function timeValueToMinutes(timeValue){
  if(!timeValue || typeof timeValue !== "string") return Number.POSITIVE_INFINITY;
  const parts = timeValue.split(":").map(Number);
  if(parts.length < 2 || parts.some(Number.isNaN)) return Number.POSITIVE_INFINITY;
  return parts[0] * 60 + parts[1];
}

function calcEntryDurationMins(tStart, tEnd){
  if(!tStart || !tEnd || typeof tStart !== "string" || typeof tEnd !== "string") return 0;
  try{
    const [sh, sm] = tStart.split(":").map(Number);
    const [eh, em] = tEnd.split(":").map(Number);
    if([sh, sm, eh, em].some(Number.isNaN)) return 0;
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    return duration > 0 && duration < 480 ? duration : 0;
  }catch(err){
    return 0;
  }
}

function compareTimelineEntriesAsc(a, b){
  if(a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
  if(a.startMins !== b.startMins) return a.startMins - b.startMins;
  return a.createdAt - b.createdAt;
}

function compareTimelineEntriesForDisplay(a, b){
  if(a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
  if(a.startMins !== b.startMins) return a.startMins - b.startMins;
  return a.createdAt - b.createdAt;
}

function normaliseTopicTitle(value){
  return String(value || "").trim().replace(/\s+/g, " ");
}

function formatTimelineMoment(dateKey, timeValue = ""){
  if(!dateKey) return "Not yet";
  const [year, month, day] = String(dateKey).split("-").map(Number);
  if([year, month, day].some(Number.isNaN)) return dateKey;
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day:"numeric",
    month:"short",
    year:"numeric",
  });
  if(!timeValue) return dateLabel;
  return `${dateLabel} · ${fmt(timeValue)}`;
}

function collectClassTimelineEntries(classNotes = {}, { startKey = "", endKey = "" } = {}){
  return Object.entries(classNotes || {})
    .flatMap(([dateKey, entries]) => {
      if(startKey && dateKey < startKey) return [];
      if(endKey && dateKey > endKey) return [];
      if(!Array.isArray(entries)) return [];
      return entries.map((note, index) => ({
        ...note,
        dateKey,
        durationMins:calcEntryDurationMins(note?.timeStart, note?.timeEnd),
        startMins:timeValueToMinutes(note?.timeStart),
        createdAt:Number(note?.created || 0) || 0,
        timelineKey:`${dateKey}-${note?.id || "entry"}-${Number(note?.created || 0) || index}-${index}`,
      }));
    })
    .sort(compareTimelineEntriesAsc);
}

const TIMELINE_WEEKDAY_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function buildTimelineMetrics(entriesAsc = []){
  const orderedAsc = Array.isArray(entriesAsc) ? entriesAsc : [];
  let totalTimelineMinutes = 0;
  let timedSessionCount = 0;
  const activeDays = new Set();
  orderedAsc.forEach(entry => {
    const duration = Number(entry?.durationMins || 0);
    totalTimelineMinutes += duration;
    if(duration > 0) timedSessionCount += 1;
    if(entry?.dateKey) activeDays.add(entry.dateKey);
  });
  return {
    entryCount:orderedAsc.length,
    totalTimelineMinutes,
    timedSessionCount,
    untimedEntryCount:Math.max(0, orderedAsc.length - timedSessionCount),
    activeDayCount:activeDays.size,
    firstEntry:orderedAsc[0] || null,
    latestEntry:orderedAsc[orderedAsc.length - 1] || null,
  };
}

function filterTimelineEntriesByDate(entriesAsc = [], { startKey = "", endKey = "" } = {}){
  return (entriesAsc || []).filter(entry => {
    if(startKey && entry.dateKey < startKey) return false;
    if(endKey && entry.dateKey > endKey) return false;
    return true;
  });
}

function buildTimelineRangeKeys(referenceDate = new Date()){
  const todayDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayDateKey = toDateKey(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay());
  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const weekDays = Array.from({ length:7 }, (_, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);
    const key = toDateKey(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    return {
      key,
      label:TIMELINE_WEEKDAY_SHORT[index],
      fullLabel:dayDate.toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" }),
      isToday:key === todayDateKey,
    };
  });
  return {
    todayKey:todayDateKey,
    weekStartKey:weekDays[0]?.key || todayDateKey,
    monthStartKey:toDateKey(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate()),
    weekDays,
  };
}

function buildTimelineWeekBars(entriesAsc = [], rangeKeys = buildTimelineRangeKeys()){
  const minsByDay = new Map((rangeKeys.weekDays || []).map(day => [day.key, 0]));
  (entriesAsc || []).forEach(entry => {
    if(entry.dateKey < rangeKeys.weekStartKey || entry.dateKey > rangeKeys.todayKey) return;
    minsByDay.set(entry.dateKey, (minsByDay.get(entry.dateKey) || 0) + Number(entry.durationMins || 0));
  });
  return (rangeKeys.weekDays || []).map(day => ({
    ...day,
    minutes:minsByDay.get(day.key) || 0,
  }));
}

function buildTimelineSnapshotFromEntries(entriesAsc = [], rangeKeys = buildTimelineRangeKeys()){
  const orderedAsc = [...(entriesAsc || [])].sort(compareTimelineEntriesAsc);
  return {
    entriesAsc:orderedAsc,
    total:buildClassTimelineSummary(null, { preloadedEntries:orderedAsc }),
    today:buildTimelineMetrics(filterTimelineEntriesByDate(orderedAsc, { startKey:rangeKeys.todayKey, endKey:rangeKeys.todayKey })),
    week:buildTimelineMetrics(filterTimelineEntriesByDate(orderedAsc, { startKey:rangeKeys.weekStartKey, endKey:rangeKeys.todayKey })),
    month:buildTimelineMetrics(filterTimelineEntriesByDate(orderedAsc, { startKey:rangeKeys.monthStartKey, endKey:rangeKeys.todayKey })),
    weekBars:buildTimelineWeekBars(orderedAsc, rangeKeys),
  };
}

function buildTopicJourney(entries = []){
  const topicMap = new Map();

  entries.forEach(entry => {
    const title = normaliseTopicTitle(entry?.title);
    if(!title) return;
    const key = title.toLowerCase();
    const current = topicMap.get(key) || {
      key,
      title,
      sessions:0,
      timedMinutes:0,
      dayKeys:new Set(),
      firstEntry:null,
      lastEntry:null,
      completedEntry:null,
      latestBody:"",
      latestStatus:"",
      latestTag:"",
    };
    current.sessions += 1;
    current.timedMinutes += entry.durationMins || 0;
    current.dayKeys.add(entry.dateKey);
    if(!current.firstEntry || compareTimelineEntriesAsc(entry, current.firstEntry) < 0){
      current.firstEntry = entry;
    }
    if(!current.lastEntry || compareTimelineEntriesAsc(entry, current.lastEntry) > 0){
      current.lastEntry = entry;
      current.latestBody = String(entry?.body || "").trim();
      current.latestStatus = String(entry?.status || "").trim();
      current.latestTag = String(entry?.tag || "").trim();
    }
    if(entry?.status === "completed"){
      if(!current.completedEntry || compareTimelineEntriesAsc(entry, current.completedEntry) > 0){
        current.completedEntry = entry;
      }
    }
    topicMap.set(key, current);
  });

  return [...topicMap.values()]
    .map(topic => {
      const latestReference = topic.completedEntry || topic.lastEntry;
      const isCompleted = !!topic.completedEntry || topic.lastEntry?.status === "completed";
      return {
        ...topic,
        activeDays:topic.dayKeys.size,
        startedAtKey:topic.firstEntry?.dateKey || "",
        startedAtTime:topic.firstEntry?.timeStart || "",
        endedAtKey:latestReference?.dateKey || "",
        endedAtTime:latestReference?.timeEnd || latestReference?.timeStart || "",
        isCompleted,
        isOngoing:!isCompleted,
      };
    })
    .sort((a, b) => {
      if(a.lastEntry && b.lastEntry) return compareTimelineEntriesAsc(b.lastEntry, a.lastEntry);
      if(a.lastEntry) return -1;
      if(b.lastEntry) return 1;
      return a.title.localeCompare(b.title);
    });
}

function buildClassTimelineSummary(classNotes = {}, options = {}){
  const entriesAsc = Array.isArray(options?.preloadedEntries)
    ? [...options.preloadedEntries].sort(compareTimelineEntriesAsc)
    : collectClassTimelineEntries(classNotes, options);
  const metrics = buildTimelineMetrics(entriesAsc);
  const entries = [...entriesAsc].sort(compareTimelineEntriesForDisplay);
  const timelineByDate = entriesAsc.reduce((acc, entry) => {
    if(!acc[entry.dateKey]) acc[entry.dateKey] = [];
    acc[entry.dateKey].push(entry);
    return acc;
  }, {});
  const groupedTimeline = Object.entries(timelineByDate).sort((a, b) => b[0].localeCompare(a[0])).map(([dateKey, groupEntries]) => ({
    dateKey,
    entries:groupEntries,
    timedMinutes:groupEntries.reduce((sum, entry) => sum + (entry.durationMins || 0), 0),
  }));
  const topicSummaries = buildTopicJourney(entriesAsc);
  const latestTitledEntry = [...entriesAsc].reverse().find(entry => normaliseTopicTitle(entry?.title));
  const ongoingTopic = topicSummaries.find(topic => topic.isOngoing) || null;
  return {
    ...metrics,
    entriesAsc,
    entries,
    groupedTimeline,
    maxDayMinutes:Math.max(1, ...groupedTimeline.map(group => group.timedMinutes || 0)),
    latestTitledEntry,
    topicSummaries,
    topicCount:topicSummaries.length,
    completedTopicCount:topicSummaries.filter(topic => topic.isCompleted).length,
    ongoingTopic,
    latestTopic:topicSummaries[0] || null,
  };
}

// ── Ripple ────────────────────────────────────────────────────────────────────
function rpl(e,white=false){
  const el=e.currentTarget,rect=el.getBoundingClientRect();
  const s=Math.max(rect.width,rect.height)*2.8;
  const x=(e.clientX||rect.left+rect.width/2)-rect.left-s/2;
  const y=(e.clientY||rect.top+rect.height/2)-rect.top-s/2;
  const w=document.createElement("span");
  w.className="rw"+(white?" white":" dark");
  w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.overflow="hidden";el.appendChild(w);w.addEventListener("animationend",()=>w.remove());
}

// ── Shared style objects ──────────────────────────────────────────────────────
const card={background:G.surface,borderRadius:16,border:`1px solid ${G.border}`,boxShadow:G.shadowSm};
const lbl={fontSize:14,color:G.textM,fontFamily:G.sans,letterSpacing:0,display:"block",marginBottom:7,textTransform:"uppercase",fontWeight:600};
const inp={width:"100%",padding:"11px 14px",borderRadius:10,border:`1px solid ${G.border}`,fontSize:16,fontFamily:G.sans,outline:"none",background:G.surface,color:G.text,marginBottom:10,transition:"border-color 0.15s, box-shadow 0.15s"};

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryBtn({onClick,children,disabled,style={},onPointerDown}){
  return(
    <button onClick={onClick} disabled={disabled} onPointerDown={onPointerDown}
      style={{background:disabled?"#C8D4CE":G.navy,color:disabled?"#8AAA98":"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:15,fontFamily:G.sans,fontWeight:600,cursor:disabled?"not-allowed":"pointer",position:"relative",overflow:"hidden",letterSpacing:0.1,...style}}>
      {children}
    </button>
  );
}

// ── Ghost button ──────────────────────────────────────────────────────────────
function GhostBtn({onClick,children,style={}}){
  return(
    <button onClick={onClick}
      style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:10,padding:"9px 16px",fontSize:15,fontFamily:G.sans,fontWeight:500,color:G.textM,cursor:"pointer",transition:"all 0.15s",...style}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;e.currentTarget.style.background=G.greenL;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;e.currentTarget.style.background="none";}}>
      {children}
    </button>
  );
}

function OverflowMenu({ items = [], buttonSize = 36 }) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0, origin: "top right" });

  const positionMenu = React.useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || 190;
    const menuHeight = menuRef.current?.offsetHeight || Math.max(56, items.length * 46 + 12);
    const gap = 10;
    const gutter = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;
    let origin = "top right";

    if (left < gutter) left = gutter;
    if (left + menuWidth > viewportWidth - gutter) left = viewportWidth - menuWidth - gutter;

    if (top + menuHeight > viewportHeight - gutter && rect.top - gap - menuHeight >= gutter) {
      top = rect.top - menuHeight - gap;
      origin = "bottom right";
    }
    if (top < gutter) top = gutter;
    if (top + menuHeight > viewportHeight - gutter) top = viewportHeight - menuHeight - gutter;

    setMenuPos({ top, left, origin });
  }, [items.length]);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (buttonRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    positionMenu();
    function handleViewportChange() {
      positionMenu();
    }
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, positionMenu]);

  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        onClick={e => {
          e.stopPropagation();
          if (!open && e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPos({
              top: rect.bottom + 10,
              left: Math.max(12, rect.right - 190),
              origin: "top right",
            });
          }
          setOpen(o => !o);
        }}
        style={{
          width:buttonSize,
          height:buttonSize,
          borderRadius:10,
          border:`1px solid ${G.border}`,
          background:G.bg,
          color:G.textM,
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          fontSize:18,
          fontWeight:700,
          WebkitTapHighlightColor:"transparent"
        }}>
        <AppIcon icon={IconDots} size={18} color={G.textM} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position:"fixed",
            top:menuPos.top,
            left:menuPos.left,
            minWidth:190,
            maxWidth:"min(240px, calc(100vw - 24px))",
            background:"rgba(255,255,255,0.96)",
            backdropFilter:"blur(14px)",
            WebkitBackdropFilter:"blur(14px)",
            border:`1px solid ${G.border}`,
            borderRadius:14,
            boxShadow:G.shadowLg,
            padding:6,
            zIndex:1600,
            transformOrigin:menuPos.origin
          }}>
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={e => {
                e.stopPropagation();
                setOpen(false);
                item.onClick?.();
              }}
              style={{
                width:"100%",
                border:"none",
                background:"transparent",
                borderRadius:10,
                padding:"11px 12px",
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                gap:8,
                textAlign:"left",
                color:item.danger ? G.red : G.textS,
                fontSize:14,
                fontWeight:600,
                fontFamily:G.sans,
                WebkitTapHighlightColor:"transparent"
              }}>
              <AppIcon icon={item.icon} size={15} color={item.danger ? G.red : G.textS} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────────────────
function getPrimaryTeacherTab(view){
  if(view==="stats" || view==="classTimeline") return "stats";
  return ["profile","trash","notifications"].includes(view) ? "profile" : "home";
}

function TopNav({user,teacherName,right,onLogoClick,onSignOut,onViewStats,onViewTrash,onViewNotifications,trashCount,notificationCount=0,data,showProfileMenu=true}){
  const [profileOpen, setProfileOpen] = React.useState(false);

  return(
    <div style={{position:"sticky",top:0,zIndex:100,background:G.topbarBg,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",paddingTop:"env(safe-area-inset-top, 0px)"}}>
      <div style={{minHeight:64,display:"flex",alignItems:"center",padding:"10px 16px 8px",gap:12,overflow:"visible"}}>
        <div
          onClick={onLogoClick}
          style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}
          onPointerDown={e=>{e.currentTarget.style.opacity="0.72";}}
          onPointerUp={e=>{e.currentTarget.style.opacity="1";}}
          onPointerCancel={e=>{e.currentTarget.style.opacity="1";}}>
          <div style={{width:40,height:40,borderRadius:12,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="19" height="19" viewBox="0 0 18 18" fill="none">
              <path d="M4 3H7V13H14V16H4V3Z" fill="white"/>
            </svg>
          </div>
          <div style={{minWidth:0,display:"flex",alignItems:"center"}}>
            <div style={{fontFamily:G.display,fontWeight:700,fontSize:22,color:G.text,letterSpacing:-0.35,lineHeight:1}}>Ledgr</div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,minWidth:0}}>
          {right}

          {onViewNotifications && (
            <button onClick={onViewNotifications}
              style={{width:40,height:40,padding:0,display:"flex",alignItems:"center",justifyContent:"center",background:G.topbarButtonBg,border:`1px solid ${G.topbarButtonBorder}`,borderRadius:14,cursor:"pointer",color:G.textM,position:"relative",WebkitTapHighlightColor:"transparent"}}>
              <AppIcon icon={IconBell} size={17} color={G.textM} />
              {notificationCount > 0 && (
                <span style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:999,background:"#D92D20",color:"#fff",fontSize:10,fontWeight:800,fontFamily:G.mono,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px"}}>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
          )}

          {showProfileMenu && <div style={{position:"relative",flexShrink:0}}>
            <div onClick={()=>setProfileOpen(o=>!o)}
              style={{height:40,display:"flex",alignItems:"center",gap:8,background:profileOpen?G.surfaceAlt:G.topbarButtonBg,border:`1px solid ${profileOpen ? G.borderM : G.topbarButtonBorder}`,borderRadius:14,padding:"0 10px",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"background 0.15s, border-color 0.15s"}}>
              <Avatar user={user} size={22}/>
              <span style={{fontWeight:700,fontSize:13,color:G.text,whiteSpace:"nowrap",fontFamily:G.sans}} className="desktop-only">
                {teacherName}
              </span>
              <AppIcon icon={profileOpen ? IconChevronUp : IconChevronDown} size={14} color={G.textL} style={{marginLeft:2}} />
            </div>

            {profileOpen&&(<>
              <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
              <div style={{position:"absolute",top:"calc(100% + 10px)",right:0,zIndex:200,background:G.surface,border:`1px solid ${G.border}`,borderRadius:20,boxShadow:G.shadowLg,minWidth:240,overflow:"hidden"}}>
                <div style={{padding:"16px 16px 13px",borderBottom:`1px solid ${G.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Avatar user={user} size={36}/>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:G.text,fontFamily:G.sans}}>{teacherName}</div>
                      <div style={{fontSize:12,color:G.textM,marginTop:2,fontFamily:G.sans}}>{user?.email||"—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{padding:"8px"}}>
                  {onViewNotifications && (
                    <button onClick={()=>{setProfileOpen(false);onViewNotifications();}}
                      style={{width:"100%",marginBottom:6,padding:"11px 12px",background:G.surfaceSoft,border:`1px solid ${G.border}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:G.textS,fontSize:14,fontFamily:G.sans,fontWeight:700,WebkitTapHighlightColor:"transparent"}}>
                      <AppIcon icon={IconBell} size={16} color={G.textS} />
                      Notifications
                      {notificationCount>0&&<span style={{marginLeft:"auto",background:"rgba(240,140,0,0.14)",color:"#C2500A",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:800,fontFamily:G.mono}}>{notificationCount}</span>}
                    </button>
                  )}

                  {onViewStats && (
                    <button onClick={()=>{setProfileOpen(false);onViewStats();}}
                      style={{width:"100%",marginBottom:6,padding:"11px 12px",background:G.greenL,border:`1px solid ${G.border}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:G.green,fontSize:14,fontFamily:G.sans,fontWeight:700,WebkitTapHighlightColor:"transparent"}}>
                      <AppIcon icon={IconChartBar} size={16} color={G.green} />
                      View Stats
                    </button>
                  )}

                  {onViewTrash && (
                    <button onClick={()=>{setProfileOpen(false);onViewTrash();}}
                      style={{width:"100%",marginBottom:6,padding:"11px 12px",background:G.surfaceSoft,border:`1px solid ${G.border}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:G.textS,fontSize:14,fontFamily:G.sans,fontWeight:700,WebkitTapHighlightColor:"transparent"}}>
                      <AppIcon icon={IconTrash} size={16} color={G.textS} />
                      Recycle Bin
                      {(trashCount||0)>0&&<span style={{marginLeft:"auto",background:G.redL,color:G.red,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:800,fontFamily:G.mono}}>{trashCount}</span>}
                    </button>
                  )}

                  <button onClick={()=>{setProfileOpen(false);onSignOut();}}
                    style={{width:"100%",padding:"11px 12px",background:G.redL,border:`1px solid ${G.red}33`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:G.red,fontSize:14,fontFamily:G.sans,fontWeight:700,WebkitTapHighlightColor:"transparent"}}>
                    <AppIcon icon={IconLogout} size={16} color={G.red} />
                    Sign Out
                  </button>
                </div>

              </div>
            </>)}
          </div>}

        </div>
      </div>
    </div>
  );
}

function TeacherBottomBar({activeTab,onHome,onStats,onProfile,profileBadge=0}){
  const itemBase = isActive => ({
    flex:1,
    minHeight:56,
    border:"none",
    borderRadius:16,
    background:"transparent",
    color:isActive ? G.green : G.textM,
    cursor:"pointer",
    display:"flex",
    flexDirection:"column",
    alignItems:"center",
    justifyContent:"center",
    gap:4,
    fontFamily:G.sans,
    fontWeight:isActive ? 700 : 600,
    fontSize:11.5,
    position:"relative",
    WebkitTapHighlightColor:"transparent",
  });

  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:170,background:G.navBg,borderTop:`1px solid ${G.navBorder}`,boxShadow:"0 -6px 20px rgba(16,24,40,0.08)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",pointerEvents:"auto"}}>
      <div style={{maxWidth:430,margin:"0 auto",padding:"8px 12px calc(8px + env(safe-area-inset-bottom, 0px))",display:"flex",gap:10}}>
        <button type="button" onClick={onHome} style={itemBase(activeTab==="home")}>
          <span style={{width:64,height:34,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",background:activeTab==="home" ? G.navActiveBg : "transparent",transition:"background 0.18s ease"}}>
            <AppIcon icon={IconHome2} size={22} color={activeTab==="home" ? G.green : G.textM} />
          </span>
          <span>home</span>
        </button>
        <button type="button" onClick={onStats} style={itemBase(activeTab==="stats")}>
          <span style={{width:64,height:34,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",background:activeTab==="stats" ? G.navActiveBg : "transparent",transition:"background 0.18s ease"}}>
            <AppIcon icon={IconChartBar} size={22} color={activeTab==="stats" ? G.green : G.textM} />
          </span>
          <span>stats</span>
        </button>
        <button type="button" onClick={onProfile} style={itemBase(activeTab==="profile")}>
          <span style={{width:64,height:34,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",background:activeTab==="profile" ? G.navActiveBg : "transparent",transition:"background 0.18s ease"}}>
            <AppIcon icon={IconUser} size={22} color={activeTab==="profile" ? G.green : G.textM} />
          </span>
          <span>profile</span>
          {profileBadge > 0 && (
            <span style={{position:"absolute",top:5,right:14,minWidth:18,height:18,borderRadius:999,background:"#DC2626",color:"#fff",fontSize:10,fontWeight:800,fontFamily:G.mono,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px",boxShadow:"0 8px 16px rgba(220,38,38,0.22)"}}>
              {profileBadge > 9 ? "9+" : profileBadge}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function TeacherProfileActionCard({icon,title,subtitle,onClick,badge=null,danger=false,accent="blue"}){
  const accentMap = {
    blue: { bg:"rgba(20,85,179,0.12)", border:"rgba(20,85,179,0.16)", icon:"#1455B3", text:"#1455B3" },
    amber: { bg:"rgba(194,80,10,0.12)", border:"rgba(194,80,10,0.16)", icon:"#C2500A", text:"#C2500A" },
    slate: { bg:"rgba(90,115,119,0.12)", border:"rgba(90,115,119,0.16)", icon:"#5A7377", text:"#5A7377" },
    red: { bg:"rgba(220,38,38,0.12)", border:"rgba(220,38,38,0.18)", icon:"#DC2626", text:"#DC2626" },
    green: { bg:"rgba(26,102,54,0.12)", border:"rgba(26,102,54,0.18)", icon:"#1A6636", text:"#1A6636" },
  };
  const tone = danger ? accentMap.red : (accentMap[accent] || accentMap.blue);

  return(
    <button
      className="ledgr-card ledgr-pressable"
      type="button"
      onClick={onClick}
      style={{
        width:"100%",
        background:G.surface,
        border:`1px solid ${danger ? tone.border : G.border}`,
        borderRadius:24,
        padding:"16px 16px",
        display:"flex",
        alignItems:"center",
        gap:14,
        textAlign:"left",
        cursor:"pointer",
        boxShadow:G.shadowSm,
        WebkitTapHighlightColor:"transparent",
      }}>
      <div style={{width:48,height:48,borderRadius:16,background:tone.bg,border:`1px solid ${tone.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:tone.icon,flexShrink:0}}>
        <AppIcon icon={icon} size={22} color={tone.icon} />
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:18,fontWeight:800,color:danger ? tone.text : G.text,fontFamily:G.display,letterSpacing:-0.25,lineHeight:1.15}}>{title}</div>
        <div style={{fontSize:14,color:danger ? tone.text : G.textM,fontFamily:G.sans,marginTop:4,lineHeight:1.5}}>{subtitle}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        {badge!==null && (
          <span style={{background:danger ? tone.bg : G.greenL,border:`1px solid ${danger ? tone.border : G.border}`,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:800,fontFamily:G.mono,color:danger ? tone.text : G.green}}>
            {badge}
          </span>
        )}
        <AppIcon icon={IconChevronRight} size={18} color={danger ? tone.text : G.textL} />
      </div>
    </button>
  );
}

function TeacherThemeCard({themeMode,onThemeChange}){
  const options = [
    {
      id:"light",
      label:"Light",
      desc:"Bright daylight workspace",
      preview:{
        bg:"#F2F6F7",
        surface:"#FFFFFF",
        accent:"#006874",
        text:"#0E1A1C",
      },
    },
    {
      id:"dark",
      label:"Dark",
      desc:"Low-glare evening workspace",
      preview:{
        bg:"#0A1420",
        surface:"#101926",
        accent:"#4DB7C8",
        text:"#F8FAFC",
      },
    },
  ];

  return(
    <div
      className="ledgr-card"
      style={{
        background:G.surface,
        border:`1px solid ${G.border}`,
        borderRadius:24,
        padding:"16px 16px 14px",
        boxShadow:G.shadowSm,
      }}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <div style={{width:48,height:48,borderRadius:16,background:themeMode==="dark" ? "rgba(77,183,200,0.12)" : "rgba(90,115,119,0.12)",border:`1px solid ${themeMode==="dark" ? "rgba(77,183,200,0.16)" : "rgba(90,115,119,0.16)"}`,display:"flex",alignItems:"center",justifyContent:"center",color:themeMode==="dark" ? "#74D0DE" : "#5A7377",flexShrink:0}}>
          <AppIcon icon={IconPalette} size={21} color={themeMode==="dark" ? "#74D0DE" : "#5A7377"} />
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.25,lineHeight:1.15}}>Choose your theme</div>
          <div style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginTop:4,lineHeight:1.5}}>Pick a bright daytime layout or a softer, layered dark mode with lower glare at night.</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {options.map(option=>{
          const selected = themeMode===option.id;
          const previewShell = option.id==="dark"
            ? "linear-gradient(180deg, #0A1420 0%, #101926 100%)"
            : option.preview.bg;
          const previewCardBg = option.id==="dark" ? "rgba(255,255,255,0.06)" : option.preview.surface;
          const previewCardBorder = option.id==="dark" ? "rgba(148,163,184,0.18)" : "rgba(0,0,0,0.06)";
          const selectedBg = selected
            ? (option.id==="dark" ? "rgba(77,183,200,0.12)" : G.greenL)
            : G.surfaceSoft;
          return(
            <button
              key={option.id}
              type="button"
              className="ledgr-pressable"
              onClick={()=>onThemeChange(option.id)}
              style={{
                border:`1px solid ${selected ? G.green : G.border}`,
                borderRadius:18,
                background:selectedBg,
                padding:"11px 11px 12px",
                textAlign:"left",
                cursor:"pointer",
                boxShadow:selected ? `0 10px 24px ${option.id==="dark" ? "rgba(77,183,200,0.14)" : G.greenL}` : "none",
                WebkitTapHighlightColor:"transparent",
              }}>
              <div style={{height:84,borderRadius:14,background:previewShell,border:`1px solid ${selected ? option.preview.accent : option.id==="dark" ? "rgba(148,163,184,0.18)" : "rgba(0,0,0,0.08)"}`,padding:8,display:"flex",flexDirection:"column",justifyContent:"space-between",marginBottom:10,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{width:24,height:24,borderRadius:8,background:option.preview.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}>
                    <AppIcon icon={option.id==="light" ? IconSun : IconMoon} size={14} color="#fff" stroke={2.2} />
                  </div>
                  <div style={{width:18,height:18,borderRadius:999,border:`2px solid ${option.preview.accent}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {selected && <AppIcon icon={IconCheck} size={12} color={option.preview.accent} stroke={2.5} />}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{height:11,borderRadius:999,background:option.id==="dark" ? "rgba(255,255,255,0.08)" : "#FFFFFF",border:`1px solid ${previewCardBorder}`}} />
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
                    {[0,1].map(i=>(
                      <div key={i} style={{height:24,borderRadius:8,background:previewCardBg,border:`1px solid ${previewCardBorder}`}}/>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:4}}>
                <span style={{fontSize:15,fontWeight:800,color:G.text,fontFamily:G.display}}>{option.label}</span>
                {selected && <span style={{background:G.green,color:"#fff",borderRadius:999,padding:"3px 8px",fontSize:10,fontWeight:800,fontFamily:G.mono,textTransform:"uppercase"}}>Active</span>}
              </div>
              <div style={{fontSize:12.5,color:G.textM,lineHeight:1.45}}>{option.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeacherProfileView({user,teacherName,quickHomeSummary,notificationCount,trashCount,onOpenStats,onOpenNotifications,onOpenTrash,onOpenExport,onSignOut,themeMode,onThemeChange,memberSinceLabel}){
  return(
    <div className="ledgr-page" style={{flex:1,overflowY:"auto",padding:"14px 16px calc(96px + env(safe-area-inset-bottom, 0px))",WebkitOverflowScrolling:"touch"}}>
      <div className="ledgr-card" style={{background:G.heroBg,borderRadius:28,padding:"22px 20px 18px",boxShadow:G.shadowLg,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <div style={{width:62,height:62,borderRadius:20,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Avatar user={user} size={44}/>
          </div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.75,marginBottom:6}}>Workspace</div>
            <div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:G.display,letterSpacing:-0.55,lineHeight:1.05}}>{teacherName}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,0.68)",fontFamily:G.sans,marginTop:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email || "No email available"}</div>
            {memberSinceLabel && <div style={{fontSize:13,color:"rgba(255,255,255,0.68)",fontFamily:G.sans,marginTop:6}}>With Ledgr since {memberSinceLabel}</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
          {[
            { label:"Logged Today", value:quickHomeSummary.loggedToday },
            { label:"This Month", value:quickHomeSummary.monthEntries },
            { label:"Active Classes", value:quickHomeSummary.active },
            { label:"Institutes", value:quickHomeSummary.instituteCount },
          ].map(item=>(
            <div key={item.label} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,padding:"12px 12px 11px"}}>
              <div style={{fontSize:10.5,color:"rgba(255,255,255,0.52)",fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,marginBottom:7}}>{item.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:G.display,letterSpacing:-0.4,lineHeight:1}}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,margin:"2px 4px -2px"}}>Workspace</div>
        <TeacherProfileActionCard icon={IconChartBar} title="View Stats" subtitle="See teaching hours and class breakdowns." onClick={onOpenStats} accent="blue"/>
        <TeacherProfileActionCard icon={IconBell} title="Notifications" subtitle={notificationCount>0 ? `${notificationCount} unread update${notificationCount===1?"":"s"} waiting in your notification panel.` : "No unread updates right now."} onClick={onOpenNotifications} badge={notificationCount>0 ? notificationCount : null} accent="amber"/>
        <TeacherProfileActionCard icon={IconTrash} title="Recycle Bin" subtitle={trashCount>0 ? `${trashCount} item${trashCount===1?"":"s"} waiting before permanent deletion.` : "Nothing in the recycle bin right now."} onClick={onOpenTrash} badge={trashCount>0 ? trashCount : null} accent="slate"/>
        <TeacherProfileActionCard icon={IconDownload} title="Export Data" subtitle="Download your teacher entries from this shared panel." onClick={onOpenExport} accent="green"/>
        <TeacherThemeCard themeMode={themeMode} onThemeChange={onThemeChange}/>
        <TeacherProfileActionCard icon={IconLogout} title="Sign Out" subtitle="Sign out of your teacher workspace." onClick={onSignOut} danger accent="red"/>
      </div>
    </div>
  );
}

// ── Minimal Date Picker (Option C) ───────────────────────────────────────────
// ── Week-in-Month Calendar ────────────────────────────────────────────────────
function DateStrip({ selectedDate, onSelectDate, noteDates = {} }) {
  const [viewYear,  setViewYear]  = useState(() => Number(selectedDate.split('-')[0]));
  const [viewMonth, setViewMonth] = useState(() => Number(selectedDate.split('-')[1]) - 1);
  const [toast,     setToast]     = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const y = Number(selectedDate.split('-')[0]);
    const m = Number(selectedDate.split('-')[1]) - 1;
    setViewYear(y); setViewMonth(m);
  }, [selectedDate]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayStr = todayKey();
  const pad = n => String(n).padStart(2,'0');
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const editableDateKeys = useMemo(() => new Set(buildDateWindow().map(d => d.key)), [todayStr]);

  function changeMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  }

  const firstDay      = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const totalCells    = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    let date, otherMonth = false;
    if (i < firstDay) {
      date = new Date(viewYear, viewMonth - 1, prevMonthDays - firstDay + i + 1);
      otherMonth = true;
    } else if (i >= firstDay + daysInMonth) {
      date = new Date(viewYear, viewMonth + 1, i - firstDay - daysInMonth + 1);
      otherMonth = true;
    } else {
      date = new Date(viewYear, viewMonth, i - firstDay + 1);
    }
    const key      = toKey(date);
    const isSel    = key === selectedDate;
    const isToday  = key === todayStr;
    const hasEntry = (noteDates[key] || 0) > 0;
    const isSun    = date.getDay() === 0;
    const allowed  = editableDateKeys.has(key);
    const isFuture = key > todayStr;
    const canOpen  = !otherMonth && !isFuture && (allowed || hasEntry);
    const isHighlighted = !otherMonth && allowed;
    let stripe = '';
    if (isHighlighted) {
      const prevDate = new Date(date);
      prevDate.setDate(date.getDate() - 1);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const prevHighlighted =
        date.getDay() !== 0 &&
        prevDate.getFullYear() === viewYear &&
        prevDate.getMonth() === viewMonth &&
        editableDateKeys.has(toKey(prevDate));
      const nextHighlighted =
        date.getDay() !== 6 &&
        nextDate.getFullYear() === viewYear &&
        nextDate.getMonth() === viewMonth &&
        editableDateKeys.has(toKey(nextDate));

      stripe = prevHighlighted
        ? (nextHighlighted ? 'mid' : 'end')
        : (nextHighlighted ? 'start' : 'only');
    }
    cells.push({ date, key, otherMonth, isHighlighted, isSel, isToday, hasEntry, isSun, stripe, allowed, canOpen, isFuture });
  }

  const stripeStyle = (stripe) => {
    const base = { position:'absolute', top:2, bottom:2, background:'rgba(27,138,76,0.09)', zIndex:0, pointerEvents:'none' };
    if (stripe==='only')  return {...base, left:3, right:3, borderRadius:8};
    if (stripe==='start') return {...base, left:3, right:0, borderRadius:'8px 0 0 8px'};
    if (stripe==='end')   return {...base, left:0, right:3, borderRadius:'0 8px 8px 0'};
    return {...base, left:0, right:0};
  };

  return (
    <div style={{position:'relative'}}>
      <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,overflow:'hidden'}}>
        {/* Month nav — compact */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px 4px'}}>
          <button onClick={()=>changeMonth(-1)}
            style={{background:'none',border:`1px solid ${G.border}`,borderRadius:7,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:G.textM,WebkitTapHighlightColor:'transparent',flexShrink:0}}>
            ‹
          </button>
          <span style={{fontFamily:G.display,fontSize:13,fontWeight:700,color:G.text}}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={()=>changeMonth(1)}
            style={{background:'none',border:`1px solid ${G.border}`,borderRadius:7,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:G.textM,WebkitTapHighlightColor:'transparent',flexShrink:0}}>
            ›
          </button>
        </div>

        {/* Day labels */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 4px'}}>
          {DAYS.map(d => (
            <div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,color:d==='Su'?G.red:G.textL,textTransform:'uppercase',padding:'2px 0',letterSpacing:0.3}}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — fixed 32px cell height */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 4px 6px',gap:1}}>
          {cells.map(({date,key,otherMonth,isHighlighted,isSel,isToday,hasEntry,isSun,stripe,allowed,canOpen,isFuture},i) => (
            <div key={i}
              onClick={() => {
                if (otherMonth) return;
                if (isFuture) { showToast("Can't log future dates"); return; }
                if (!canOpen) { showToast("Only the past week can be edited. Older dates open only when entries exist."); return; }
                onSelectDate(key);
              }}
              style={{
                position:'relative', height:34,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                borderRadius:8,
                cursor:(otherMonth||!canOpen)?'default':'pointer',
                opacity:otherMonth?0.15:(canOpen?1:0.25),
                WebkitTapHighlightColor:'transparent',
                touchAction:'manipulation', userSelect:'none', WebkitUserSelect:'none',
                background: isSel||isToday ? G.forest : 'transparent',
                boxShadow: isSel||isToday ? '0 2px 8px rgba(21,43,34,0.2)' : 'none',
                transition:'transform 0.1s',
              }}
              onPointerDown={e=>{if(canOpen)e.currentTarget.style.transform='scale(0.85)';}}
              onPointerUp={e=>{e.currentTarget.style.transform='scale(1)';}}
              onPointerCancel={e=>{e.currentTarget.style.transform='scale(1)';}}>

              {isHighlighted && !isSel && !isToday && stripe && (
                <div style={stripeStyle(stripe)}/>
              )}

              <span style={{
                position:'relative', zIndex:1,
                fontSize:12, lineHeight:1,
                fontWeight: isSel||isToday ? 800 : (isHighlighted || hasEntry) ? 700 : 400,
                color: isSel||isToday ? '#fff' : isSun ? G.red : (isHighlighted || hasEntry) ? G.text : G.textL,
                fontFamily: G.display,
              }}>
                {date.getDate()}
              </span>

              {hasEntry && (
                <div style={{
                  position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)',
                  width:3, height:3, borderRadius:'50%',
                  background: isSel||isToday ? '#34D077' : G.green, zIndex:1,
                }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'rgba(21,43,34,0.93)',color:'#fff',borderRadius:20,padding:'8px 18px',fontSize:13,fontWeight:600,whiteSpace:'nowrap',zIndex:9999,pointerEvents:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.25)'}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Read-only Dropdown (for admin-controlled lists) ──────────────────────────
function CreatableDropdown({value,onChange,options,onAddOption,placeholder,addPlaceholder}){
  const [open,setOpen]=useState(false);const [adding,setAdding]=useState(false);const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null);const wrapRef=useRef(null);
  useEffect(()=>{if(adding&&inputRef.current)inputRef.current.focus();},[adding]);
  useEffect(()=>{const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");}};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const confirmAdd=()=>{const t=newVal.trim();if(!t)return;if(!options.includes(t))onAddOption(t);onChange(t);setNewVal("");setAdding(false);setOpen(false);};
  return(
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span style={{fontWeight:value?400:300}}>{value||placeholder}</span>
        <span style={{color:G.textL,display:"inline-flex",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}><AppIcon icon={IconChevronDown} size={14} color={G.textL} /></span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,boxShadow:G.shadowLg,overflow:"hidden"}}>
          <div style={{maxHeight:210,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"14px 16px",color:G.textL,fontSize:15,fontStyle:"italic"}}>No saved options yet</div>}
            {options.map(opt=>{const sel=opt===value;return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"11px 16px",cursor:"pointer",fontSize:15,color:sel?G.green:G.text,fontWeight:sel?600:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:12,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:16,color:G.green,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel?<AppIcon icon={IconCheck} size={14} color={G.green} />:null}</span>{opt}
              </div>);})}
          </div>
          <div style={{borderTop:`1px solid ${G.border}`}}>
            {onAddOption && (!adding
              ?<div onClick={()=>setAdding(true)} style={{padding:"11px 16px",cursor:"pointer",fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=G.greenL} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}} placeholder={addPlaceholder} style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${G.green}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:G.bg,color:G.textM,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><AppIcon icon={IconX} size={16} color={G.textM} /></button>
              </div>)}
          </div>
        </div>
      )}
    </div>
  );
}


function ReadOnlyDropdown({value, onChange, options, placeholder, emptyMsg}){
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(()=>{
    const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span style={{fontWeight:value?500:400}}>{value||placeholder}</span>
        <span style={{color:G.textL,display:"flex",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}><AppIcon icon={IconChevronDown} size={14} color={G.textL} /></span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,boxShadow:G.shadowLg,overflow:"hidden"}}>
          {options.length===0
            ?<div style={{padding:"16px",color:G.textM,fontSize:14,textAlign:"center"}}>
                <div style={{width:40,height:40,borderRadius:14,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px"}}><AppIcon icon={IconBuilding} size={20} color={G.textM} /></div>
                <div style={{fontWeight:600,color:G.text,marginBottom:4}}>No institutes available</div>
                <div style={{color:G.textL,fontSize:13}}>{emptyMsg||"Ask your admin to create institutes first."}</div>
              </div>
            :<div style={{maxHeight:220,overflowY:"auto"}}>
              {options.map(opt=>{
                const sel=opt===value;
                return(
                  <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                    style={{padding:"12px 16px",cursor:"pointer",fontSize:15,color:sel?G.green:G.text,fontWeight:sel?600:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:12,transition:"background 0.1s"}}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                    onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                    <span style={{width:16,color:G.green,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel?<AppIcon icon={IconCheck} size={14} color={G.green} />:null}</span>
                    {opt}
                  </div>
                );
              })}
            </div>
          }
          <div style={{borderTop:`1px solid ${G.border}`,padding:"8px 14px",fontSize:12,color:G.textM,display:"flex",alignItems:"center",gap:6}}>
            <AppIcon icon={IconInfoCircle} size={14} color={G.textM} />
            <span>Institutes are managed by your admin</span>
          </div>
        </div>
      )}
    </div>
  );
}


function MultiValueField({ label, values, onChange, suggestions = [], placeholder, hint, allowCustom = true, lockedHint = "" }) {
  const [draft, setDraft] = useState("");
  const suggestionValues = React.useMemo(() => uniqueChoiceValues(suggestions), [suggestions]);

  const addValue = React.useCallback((rawValue) => {
    const nextValue = String(rawValue || "").trim().replace(/\s+/g, " ");
    if (!nextValue) return;
    if (!allowCustom && !suggestionValues.some(item => normaliseChoiceKey(item) === normaliseChoiceKey(nextValue))) {
      return;
    }
    onChange(mergeChoiceValues(values, [nextValue]));
    setDraft("");
  }, [allowCustom, onChange, suggestionValues, values]);

  const removeValue = React.useCallback((value) => {
    const removeKey = normaliseChoiceKey(value);
    onChange(values.filter(item => normaliseChoiceKey(item) !== removeKey));
  }, [onChange, values]);

  const availableSuggestions = React.useMemo(() => (
    suggestionValues.filter(item => !values.some(value => normaliseChoiceKey(value) === normaliseChoiceKey(item)))
  ), [suggestionValues, values]);

  return (
    <div style={{marginBottom:16}}>
      <label style={{...lbl,color:"rgba(255,255,255,0.6)"}}>{label}</label>
      {values.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {values.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:999,border:"1px solid rgba(59,130,246,0.3)",background:"rgba(59,130,246,0.16)",color:"#DBEAFE",fontSize:13,fontFamily:G.sans,fontWeight:600,cursor:"pointer"}}>
              <span>{value}</span>
              <AppIcon icon={IconX} size={12} color="rgba(255,255,255,0.65)" />
            </button>
          ))}
        </div>
      )}
      {allowCustom ? (
        <div style={{display:"flex",gap:8}}>
          <input
            value={draft}
            onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addValue(draft);
              } else if (e.key === "Backspace" && !draft && values.length) {
                e.preventDefault();
                removeValue(values[values.length - 1]);
              }
            }}
            placeholder={placeholder}
            style={{...inp,marginBottom:0,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff"}}
          />
          <button
            type="button"
            onClick={()=>addValue(draft)}
            style={{padding:"0 16px",borderRadius:11,border:"none",background:"rgba(59,130,246,0.2)",color:"#DBEAFE",fontSize:14,fontFamily:G.sans,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            Add
          </button>
        </div>
      ) : (
        <div style={{padding:"12px 14px",borderRadius:12,border:"1px dashed rgba(255,255,255,0.18)",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.58)",fontSize:13,lineHeight:1.6}}>
          {lockedHint || "Choose from the official institute list below. Only admins can create or rename institutes."}
        </div>
      )}
      {availableSuggestions.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
          {availableSuggestions.map(item => (
            <button
              key={item}
              type="button"
              onClick={()=>addValue(item)}
              style={{padding:"7px 11px",borderRadius:999,border:"1px solid rgba(255,255,255,0.14)",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.72)",fontSize:12,fontFamily:G.sans,fontWeight:600,cursor:"pointer"}}>
              + {item}
            </button>
          ))}
        </div>
      )}
      {!allowCustom && suggestionValues.length === 0 && (
        <div style={{marginTop:10,padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",fontSize:13,lineHeight:1.6}}>
          No institutes have been created yet. Contact your admin to get your institute added — you can select it here once it's available.
        </div>
      )}
      {hint && (
        <div style={{marginTop:8,fontSize:12,color:"rgba(255,255,255,0.44)",lineHeight:1.6}}>
          {hint}
        </div>
      )}
    </div>
  );
}


// ── Profile Setup ─────────────────────────────────────────────────────────────
function ProfileSetup({user, initialProfile, subjectSuggestions = [], instituteSuggestions = [], onSave}){
  const initial = normaliseProfile(initialProfile, user.displayName || "");
  const [name,setName]=useState(initial.name);
  const [subjects,setSubjects]=useState(initial.subjects);
  const officialInstitutes = useMemo(() => uniqueChoiceValues(instituteSuggestions), [instituteSuggestions]);
  const [institutes,setInstitutes]=useState(() => initial.institutes);
  useEffect(() => {
    if (!officialInstitutes.length) return;
    const officialKeys = new Set(officialInstitutes.map(normaliseChoiceKey));
    setInstitutes(curr => curr.filter(value => officialKeys.has(normaliseChoiceKey(value))));
  }, [officialInstitutes]);
  const canContinue = !!name.trim() && subjects.length > 0;
  return(
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:72,height:72,borderRadius:22,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px",boxShadow:`0 8px 24px rgba(59,130,246,0.28)`}}>🎓</div>
          <h1 style={{fontSize:30,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:10,letterSpacing:-0.5}}>Set up your teacher profile</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>We’ll use this once so your entries, subjects, and institutes start in the right place from day one.</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"28px 26px",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
          <label style={{...lbl,color:"rgba(255,255,255,0.6)"}}>Your full name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ramsingh Yadav" autoFocus
            style={{...inp,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:17}}/>
          <MultiValueField
            label="Subjects you teach"
            values={subjects}
            onChange={setSubjects}
            suggestions={subjectSuggestions}
            placeholder="Type a subject, then press Enter"
            hint="Add one or more subjects. You can press Enter or comma after each one."
          />
          <MultiValueField
            label="Institutes where you teach"
            values={institutes}
            onChange={setInstitutes}
            suggestions={officialInstitutes}
            allowCustom={false}
            lockedHint="Select every institute you teach at from the list below. Only admins can create institutes."
            hint={officialInstitutes.length > 0 ? "Can't find your institute? Ask your admin to add it — you can update this later." : undefined}
          />
          <button onClick={()=>canContinue&&onSave({ name:name.trim(), subjects, institutes })} disabled={!canContinue} onPointerDown={e=>rpl(e,true)}
            style={{width:"100%",padding:"13px",background:canContinue?G.greenV:"rgba(255,255,255,0.1)",color:canContinue?G.forest:"rgba(255,255,255,0.3)",border:"none",borderRadius:11,fontSize:16,fontFamily:G.sans,fontWeight:700,cursor:canContinue?"pointer":"not-allowed",position:"relative",overflow:"hidden",letterSpacing:0.2,boxShadow:canContinue?`0 4px 16px rgba(59,130,246,0.26)`:"none"}}>
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtRecoveryStamp(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleString("en-IN",{
    day:"numeric",
    month:"short",
    year:"numeric",
    hour:"numeric",
    minute:"2-digit",
  });
}

function fmtAdminNoticeStamp(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleString("en-IN",{
    day:"numeric",
    month:"short",
    hour:"numeric",
    minute:"2-digit",
  });
}

function buildClassEntrySummary(noteMap = {}) {
  const rows = Object.entries(noteMap || {})
    .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
    .sort(([a], [b]) => b.localeCompare(a));
  const entryCount = rows.reduce((sum, [, arr]) => sum + arr.length, 0);
  const activeDays = rows.length;
  const lastDateKey = rows[0]?.[0] || "";
  let latestEntry = null;
  rows.forEach(([dateKey, arr]) => {
    arr.forEach(note => {
      const stamp = Number(note?.created || 0) || new Date(dateKey).getTime();
      if (!latestEntry || stamp > latestEntry.stamp) {
        latestEntry = { ...note, dateKey, stamp };
      }
    });
  });
  const latestText = String(
    latestEntry?.title ||
    latestEntry?.body ||
    latestEntry?.timeStart ||
    ""
  ).trim();
  return {
    entryCount,
    activeDays,
    lastDateKey,
    latestEntryText: latestText ? (latestText.length > 72 ? `${latestText.slice(0,69)}...` : latestText) : "",
  };
}

function dataFingerprint(payload){
  try{
    const meta = payload?._meta || {};
    return JSON.stringify({
      ...payload,
      _meta: {
        ...meta,
        updatedAt: 0,
        revision: 0,
        previousRevision: 0,
        source: "",
      },
    });
  }catch{
    return "";
  }
}

function DataIntegrityScreen({issue,onRetry,onRestore,onSignOut,restoring}){
  const metaText = issue?.kind==="backup" && issue.backupSavedAt
    ? `Last safe snapshot: ${fmtRecoveryStamp(issue.backupSavedAt)}`
    : issue?.kind==="orphaned"
      ? `${issue.orphanedCount || 0} note files are still present in Firestore`
      : issue?.kind==="conflict" && issue?.updatedAt
        ? `Another device saved newer data on ${fmtRecoveryStamp(issue.updatedAt)}`
      : issue?.hasLocalDraft
        ? "A local browser draft was found, but cloud saving is blocked until the load succeeds"
        : "Cloud saving is disabled right now to protect existing class data";
  const retryLabel = issue?.kind==="conflict" ? "Load latest cloud data" : "Retry cloud load";
  const iconBg = issue?.kind==="backup" ? "#FEF3C7" : issue?.kind==="conflict" ? "#DBEAFE" : "#FEE2E2";
  const icon = issue?.kind==="backup" ? IconDeviceFloppy : issue?.kind==="orphaned" ? IconArchive : issue?.kind==="conflict" ? IconRefresh : IconAlertTriangle;

  return(
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{width:"100%",maxWidth:520}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:72,height:72,borderRadius:22,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",boxShadow:"0 8px 24px rgba(0,0,0,0.22)"}}>
            <AppIcon icon={icon} size={32} color={issue?.kind==="conflict" ? "#2563EB" : issue?.kind==="backup" ? "#B45309" : "#DC2626"} />
          </div>
          <h1 style={{fontSize:30,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:10,letterSpacing:-0.5}}>
            {issue?.kind==="backup"
              ? "We found a safe class list backup"
              : issue?.kind==="conflict"
                ? "A newer class list is already in the cloud"
              : issue?.kind==="orphaned"
                ? "Your class list needs recovery"
                : "We could not safely load your classes"}
          </h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.58)",lineHeight:1.7}}>
            {issue?.kind==="backup"
              ? "The live class metadata is missing or damaged, but your last safe snapshot is ready to restore. Do not create new classes until this is fixed."
              : issue?.kind==="conflict"
                ? "This device tried to save an older class list after a newer cloud update already happened. Sync is paused so nothing gets overwritten."
              : issue?.kind==="orphaned"
                ? "We found class entry files but could not find the class list metadata that links them into the teacher panel. Creating new classes now can make recovery harder."
                : "A Firestore load error happened before the teacher panel could verify your classes. Saving stays blocked so we do not overwrite working data with a blank account."}
          </p>
        </div>

        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"24px 22px",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
          <div style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"14px 16px",marginBottom:18}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>
              Data Protection
            </div>
            <div style={{fontSize:15,color:"#fff",lineHeight:1.6}}>
              {metaText}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <PrimaryBtn onClick={onRetry} onPointerDown={e=>rpl(e,true)} style={{width:"100%",padding:"13px",fontSize:16}}>
              {retryLabel}
            </PrimaryBtn>
            {issue?.kind==="backup"&&(
              <button onClick={onRestore} disabled={restoring} onPointerDown={e=>rpl(e,true)}
                style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:restoring?"rgba(255,255,255,0.1)":G.greenV,color:restoring?"rgba(255,255,255,0.4)":G.forest,fontSize:16,fontFamily:G.sans,fontWeight:700,cursor:restoring?"not-allowed":"pointer",position:"relative",overflow:"hidden"}}>
                {restoring ? "Restoring backup…" : "Restore last safe snapshot"}
              </button>
            )}
            <GhostBtn onClick={onSignOut} style={{width:"100%",padding:"12px 16px",color:"rgba(255,255,255,0.78)",borderColor:"rgba(255,255,255,0.16)"}}>
              Sign out for now
            </GhostBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function Modal({title,subtitle,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.45)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div className="modal-card" style={{background:G.surface,borderRadius:20,padding:"28px 26px",width:"100%",maxWidth:460,boxShadow:G.shadowLg}}>
        <div style={{marginBottom:20}}>
          <h3 style={{fontSize:19,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{title}</h3>
          {subtitle&&<p style={{fontSize:15,color:G.textM,fontFamily:G.sans}}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function EditNameModal({current,onSave,onClose}){
  const [name,setName]=useState(current);
  return(
    <Modal title="Edit your name" subtitle="Appears on all your class entries" onClose={onClose}>
      <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} autoFocus style={{...inp,fontSize:16}}/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>name.trim()&&onSave(name.trim())} onPointerDown={e=>rpl(e,true)}>Save Name</PrimaryBtn>
      </div>
    </Modal>
  );
}

function EditClassModal({cls,data,onSave,onClose,sortedByUsage,globalInstitutes,instituteSections,addSectionName,addSubjectName}){
  const [section,setSection]=useState(cls.section||"");
  const [institute,setInstitute]=useState(cls.institute||"");
  const [subject,setSubject]=useState(cls.subject||"");
  const sectionOptions = sortedByUsage(
    getInstituteSectionOptions(data.classes || [], data.sections || [], instituteSections, institute),
    "section"
  );
  return(
    <Modal title="Edit class" subtitle="Update the details for this class" onClose={onClose}>
      <label style={lbl}>Institute</label>
      <ReadOnlyDropdown value={institute} onChange={setInstitute} options={globalInstitutes} placeholder="Select institute" emptyMsg="No institutes yet — contact your admin."/>
      <label style={{...lbl,marginTop:8}}>Class / Section</label>
      <CreatableDropdown value={section} onChange={setSection} options={sectionOptions} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
      <label style={{...lbl,marginTop:8}}>Subject</label>
      <CreatableDropdown value={subject} onChange={setSubject} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics" addPlaceholder="Type subject…"/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>institute.trim()&&section.trim()&&onSave({section:section.trim(),institute:institute.trim(),subject:subject.trim()})} onPointerDown={e=>rpl(e,true)}>Save Changes</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ── Leave Class Modal ─────────────────────────────────────────────────────────
const LEAVE_REASONS = [
  { id:"completed",  icon:IconCheck,   label:"Completed",  desc:"Syllabus is done, this class has ended" },
  { id:"reassigned", icon:IconRefresh, label:"Reassigned", desc:"Another teacher has taken over this class" },
  { id:"merged",     icon:IconArchive, label:"Merged",     desc:"This batch was combined with another batch" },
  { id:"onhold",     icon:IconClockHour4, label:"On Hold", desc:"Class is paused for now, may continue later" },
  { id:"delete",     icon:IconTrash,   label:"Delete",     desc:"Remove this class from your active list" },
];
function LeaveClassModal({cls,onConfirm,onClose}){
  const [selected,setSelected]=useState(null);
  const primaryLabel=selected==="delete"?"Delete Class":"Archive Class";
  return(
    <Modal title="Manage this class" subtitle={`"${cls.section} · ${cls.institute}" will be updated with this action visible to your admin.`} onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {LEAVE_REASONS.map(r=>(
          <button key={r.id} onClick={()=>setSelected(r.id)} type="button"
            style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 14px",borderRadius:12,
              border:`1.5px solid ${selected===r.id?G.green:"#E5E5E5"}`,
              background:selected===r.id?G.greenL:G.surface,
              cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%"}}>
            <AppIcon icon={r.icon} size={21} color={selected===r.id ? G.green : (r.id==="delete" ? G.red : G.textM)} style={{marginTop:1}} />
            <div>
              <div style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.sans,marginBottom:2}}>{r.label}</div>
              <div style={{fontSize:14,color:G.textM,fontFamily:G.sans,lineHeight:1.4}}>{r.desc}</div>
            </div>
            {selected===r.id&&<span style={{marginLeft:"auto",display:"flex",alignItems:"center",color:G.green,flexShrink:0}}><AppIcon icon={IconCheck} size={17} color={G.green} /></span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={()=>selected&&onConfirm(selected,LEAVE_REASONS.find(r=>r.id===selected)?.label)} disabled={!selected}
          style={{background:selected?G.red:"#D5D5D5",color:"#fff",border:"none",borderRadius:10,
            padding:"9px 20px",fontSize:15,cursor:selected?"pointer":"not-allowed",
            fontFamily:G.sans,fontWeight:600,transition:"background 0.15s"}}>
          {primaryLabel}
        </button>
      </div>
    </Modal>
  );
}

function TeacherClassQuickSheet({cls,entryCount=0,onOpenHistory,onDelete,onClose}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.44)",zIndex:9998,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div className="ledgr-sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,background:"linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",borderRadius:"26px 26px 22px 22px",boxShadow:"0 28px 72px rgba(15,23,42,0.26)",overflow:"hidden",border:`1px solid ${G.border}`}}>
        <div style={{padding:"10px 18px 4px",display:"flex",justifyContent:"center"}}>
          <span style={{width:42,height:5,borderRadius:999,background:"rgba(148,163,184,0.34)"}}/>
        </div>
        <div style={{padding:"8px 20px 18px"}}>
          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,marginBottom:8}}>Class actions</div>
          <div style={{fontSize:23,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.4,lineHeight:1.05}}>{cls.section}</div>
          <div style={{fontSize:14,color:G.textM,marginTop:6,lineHeight:1.5}}>
            {cls.institute}
            {cls.subject ? ` · ${cls.subject}` : ""}
          </div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:10,background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.14)",borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,fontFamily:G.mono,color:"#1D4ED8"}}>
            {entryCount} {entryCount===1 ? "saved entry" : "saved entries"}
          </div>
        </div>
        <div style={{padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <button
            type="button"
            onClick={onOpenHistory}
            disabled={entryCount===0}
            style={{width:"100%",background:entryCount===0?"#F8FAFC":"#FFFFFF",border:`1px solid ${entryCount===0?G.border:"#BFDBFE"}`,borderRadius:18,padding:"15px 16px",display:"flex",alignItems:"center",gap:14,textAlign:"left",cursor:entryCount===0?"not-allowed":"pointer",color:entryCount===0?G.textL:G.text,boxShadow:G.shadowSm,WebkitTapHighlightColor:"transparent"}}>
            <div style={{width:44,height:44,borderRadius:15,background:entryCount===0?"rgba(148,163,184,0.12)":"#EFF6FF",border:`1px solid ${entryCount===0?G.border:"#BFDBFE"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><AppIcon icon={IconHistory} size={21} color={entryCount===0 ? G.textL : "#1D4ED8"} /></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:800,fontFamily:G.display,lineHeight:1.15}}>History</div>
              <div style={{fontSize:13.5,color:entryCount===0?G.textL:G.textM,marginTop:4,lineHeight:1.45}}>
                {entryCount===0 ? "No saved entries yet for this class." : "Open saved dates and jump into older entries."}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{width:"100%",background:"linear-gradient(180deg, #FFFFFF 0%, #FFF7F7 100%)",border:"1px solid #FECACA",borderRadius:18,padding:"15px 16px",display:"flex",alignItems:"center",gap:14,textAlign:"left",cursor:"pointer",color:"#B91C1C",boxShadow:G.shadowSm,WebkitTapHighlightColor:"transparent"}}>
            <div style={{width:44,height:44,borderRadius:15,background:"#FEF2F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><AppIcon icon={IconTrash} size={21} color="#B91C1C" /></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:800,fontFamily:G.display,lineHeight:1.15}}>Delete class</div>
              <div style={{fontSize:13.5,color:"#B91C1C",marginTop:4,lineHeight:1.45}}>
                Move this class into the class recycle flow.
              </div>
            </div>
          </button>
          <GhostBtn onClick={onClose} style={{width:"100%",padding:"13px 16px"}}>Close</GhostBtn>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({cls,classNotes={},selectedDate,onSelectDate,onClose}){
  const [query,setQuery]=useState("");

  const rows=useMemo(()=>{
    return Object.entries(classNotes)
      .filter(([,arr])=>Array.isArray(arr)&&arr.length>0)
      .sort(([a],[b])=>b.localeCompare(a))
      .map(([dk,arr])=>{
        const d=dateFromKey(dk);
        const label=d.toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"});
        const monthLabel=d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
        const previewRaw=arr
          .map(note=>(note?.title||"").trim() || (note?.body||"").trim())
          .find(Boolean) || "";
        const preview=previewRaw.length>88?`${previewRaw.slice(0,85)}...`:previewRaw;
        const searchText=[
          dk,
          label,
          ...arr.map(note=>`${note?.title||""} ${note?.body||""} ${note?.timeStart||""} ${note?.timeEnd||""}`),
        ].join(" ").toLowerCase();
        return {dk,count:arr.length,label,monthLabel,preview,searchText};
      });
  },[classNotes]);

  const filteredRows=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return q ? rows.filter(r=>r.searchText.includes(q)) : rows;
  },[rows,query]);

  const totalEntries=rows.reduce((sum,row)=>sum+row.count,0);
  let currentMonth="";

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.55)",zIndex:9997,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:G.surface,borderRadius:24,width:"100%",maxWidth:560,maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.28)",overflow:"hidden"}}>
        <div style={{padding:"22px 22px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{width:44,height:44,borderRadius:14,background:G.greenL,color:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><AppIcon icon={IconHistory} size={22} color={G.green} /></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.2}}>Entry History</div>
              <div style={{fontSize:14,color:G.textM,marginTop:4,lineHeight:1.5}}>
                {cls.section} · {cls.institute}
                {cls.subject?` · ${cls.subject}`:""}
              </div>
              <div style={{fontSize:13,color:G.textL,marginTop:6,fontFamily:G.mono}}>
                {rows.length} saved date{rows.length===1?"":"s"} · {totalEntries} total entr{totalEntries===1?"y":"ies"}
              </div>
            </div>
            <button onClick={onClose} style={{width:38,height:38,borderRadius:12,border:`1px solid ${G.border}`,background:G.surface,color:G.textM,cursor:"pointer",fontSize:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <AppIcon icon={IconX} size={18} color={G.textM} />
            </button>
          </div>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search by date, title, or notes"
            style={{...inp,marginBottom:0,marginTop:16}}
          />
          <div style={{marginTop:12,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
            Past week stays editable here. Older dates open as view-only.
          </div>
        </div>

        <div style={{padding:"12px 14px 16px",overflowY:"auto"}}>
          {filteredRows.length===0 ? (
            <div style={{padding:"28px 18px",textAlign:"center",color:G.textM}}>
              <div style={{width:56,height:56,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}><AppIcon icon={IconSearch} size={28} color={G.textM} /></div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>No matching dates</div>
              <div style={{fontSize:14,marginTop:4}}>Try a different date, title, or keyword.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredRows.map(row=>{
                const showMonth=row.monthLabel!==currentMonth;
                currentMonth=row.monthLabel;
                const isSelected=row.dk===selectedDate;
                return(
                  <React.Fragment key={row.dk}>
                    {showMonth&&(
                      <div style={{padding:"10px 8px 2px",fontSize:12,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.5}}>
                        {row.monthLabel}
                      </div>
                    )}
                    <button
                      onClick={()=>{onSelectDate(row.dk);onClose();}}
                      style={{
                        width:"100%",
                        textAlign:"left",
                        border:isSelected?`1.5px solid ${G.green}`:`1px solid ${G.border}`,
                        background:isSelected?G.greenL:G.surface,
                        borderRadius:16,
                        padding:"14px 14px",
                        cursor:"pointer",
                        display:"flex",
                        alignItems:"flex-start",
                        justifyContent:"space-between",
                        gap:12,
                      }}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>
                          {row.label}
                        </div>
                        {row.preview&&(
                          <div style={{fontSize:13,color:G.textM,marginTop:5,lineHeight:1.5}}>
                            {row.preview}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                        <span style={{background:isSelected?G.green:"#F3F4F6",color:isSelected?"#fff":G.textM,borderRadius:999,padding:"4px 10px",fontSize:12,fontWeight:700,fontFamily:G.mono}}>
                          {row.count} {row.count===1?"entry":"entries"}
                        </span>
                        {isSelected&&<span style={{fontSize:12,color:G.green,fontWeight:700}}>Viewing</span>}
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Trash badge ───────────────────────────────────────────────────────────────
function TrashBadge({count,onClick}){
  if(count===0)return null;
  return(
    <button onClick={onClick} style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:10,padding:"6px 12px",fontSize:14,cursor:"pointer",color:G.red,fontFamily:G.sans,display:"flex",alignItems:"center",gap:5,fontWeight:500,transition:"all 0.15s",boxShadow:G.shadowSm}}
      onMouseEnter={e=>{e.currentTarget.style.background="#FAD0D0";}}
      onMouseLeave={e=>{e.currentTarget.style.background=G.redL;}}>
      <AppIcon icon={IconTrash} size={15} color={G.red} /> <span>{count} in bin</span>
    </button>
  );
}

// ── Export Modal ──────────────────────────────────────────────────────────────
function ExportModal({data, teacherName, onClose}){
  const [period,  setPeriod]  = React.useState("month"); // day | week | month
  const [format,  setFormat]  = React.useState("pdf");   // pdf | excel
  const [selMonth,setSelMonth]= React.useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  const [selWeek, setSelWeek] = React.useState(()=>todayKey());
  const [selDay,  setSelDay]  = React.useState(()=>todayKey());
  const [busy,    setBusy]    = React.useState(false);
  const [exportError, setExportError] = React.useState("");
  const isNativeExport = Capacitor.isNativePlatform();

  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const textSorter = useMemo(() => new Intl.Collator("en", { numeric: true, sensitivity: "base" }), []);

  function sectionSortMeta(section){
    const clean = (section || "").trim();
    const grade = extractGrade(clean);
    const gradeOrder = grade && grade >= 6 && grade <= 12 ? grade : 99;
    return { gradeOrder, clean };
  }

  function exportRowCompare(a,b){
    const aSection = sectionSortMeta(a.class);
    const bSection = sectionSortMeta(b.class);
    if (aSection.gradeOrder !== bSection.gradeOrder) return aSection.gradeOrder - bSection.gradeOrder;
    const classCmp = textSorter.compare(aSection.clean, bSection.clean);
    if (classCmp !== 0) return classCmp;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
    if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
    const subjectCmp = textSorter.compare(a.subject || "", b.subject || "");
    if (subjectCmp !== 0) return subjectCmp;
    return textSorter.compare(a.title || "", b.title || "");
  }

  function entryChronologicalCompare(a,b){
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
    if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
    const statusCmp = textSorter.compare(a.status || "", b.status || "");
    if (statusCmp !== 0) return statusCmp;
    const titleCmp = textSorter.compare(a.title || "", b.title || "");
    if (titleCmp !== 0) return titleCmp;
    return textSorter.compare(a.notes || "", b.notes || "");
  }

  function groupRowsForPdf(rows){
    const byInstitute = new Map();

    rows.forEach(row=>{
      const instituteName = (row.institute || "No Institute").trim() || "No Institute";
      const className = (row.class || "Untitled Class").trim() || "Untitled Class";
      const subjectName = (row.subject || "").trim();
      const classKey = `${className}__${subjectName}`;

      if(!byInstitute.has(instituteName)){
        byInstitute.set(instituteName, { name: instituteName, classMap: new Map(), entryCount: 0 });
      }
      const inst = byInstitute.get(instituteName);
      if(!inst.classMap.has(classKey)){
        inst.classMap.set(classKey, { className, subject: subjectName, entries: [] });
      }
      inst.classMap.get(classKey).entries.push(row);
      inst.entryCount += 1;
    });

    return Array.from(byInstitute.values())
      .sort((a,b)=>textSorter.compare(a.name, b.name))
      .map(inst=>{
        const classes = Array.from(inst.classMap.values())
          .sort((a,b)=>{
            const aMeta = sectionSortMeta(a.className);
            const bMeta = sectionSortMeta(b.className);
            if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
            const classCmp = textSorter.compare(aMeta.clean, bMeta.clean);
            if (classCmp !== 0) return classCmp;
            return textSorter.compare(a.subject || "", b.subject || "");
          })
          .map(group=>({
            ...group,
            entries:[...group.entries].sort(entryChronologicalCompare),
          }));
        return {
          name: inst.name,
          classes,
          entryCount: inst.entryCount,
          classCount: classes.length,
        };
      });
  }

  function formatPdfDate(dk){
    return dateFromKey(dk).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  }

  // Collect entries within the selected range
  function getEntries(){
    const rows=[];

    let from, to;
    if(period==="day"){
      from=new Date(selDay); to=new Date(selDay);
    } else if(period==="week"){
      const d=new Date(selWeek);
      const day=d.getDay();
      from=new Date(d); from.setDate(d.getDate()-day);
      to=new Date(from); to.setDate(from.getDate()+6);
    } else {
      const [y,m]=selMonth.split("-").map(Number);
      from=new Date(y,m-1,1); to=new Date(y,m,0);
    }

    const pad=n=>String(n).padStart(2,"0");
    const toKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    // Iterate each day in range
    const cur=new Date(from);
    while(cur<=to){
      const dk=toKey(cur);
      (data.classes||[]).filter(c=>!c.left).forEach(cls=>{
        const dayNotes=(data.notes[cls.id]||{})[dk]||[];
        dayNotes.forEach(note=>{
          rows.push({
            date:dk,
            class:cls.section,
            institute:cls.institute,
            subject:cls.subject,
            type:note.tag||"note",
            time:note.timeStart?(note.timeEnd?`${note.timeStart} - ${note.timeEnd}`:note.timeStart):"",
            timeStart:note.timeStart||"",
            timeEnd:note.timeEnd||"",
            status:note.status&&STATUS_STYLES[note.status]?STATUS_STYLES[note.status].label.replace(/[🔵🟡🟢🟠]/g,'').trim():"",
            title:note.title||"",
            notes:note.body||"",
          });
        });
      });
      cur.setDate(cur.getDate()+1);
    }
    return rows.sort(exportRowCompare);
  }

  function periodLabel(){
    if(period==="day") return selDay;
    if(period==="week"){
      const d=new Date(selWeek);
      const day=d.getDay();
      const sun=new Date(d); sun.setDate(d.getDate()-day);
      const sat=new Date(sun); sat.setDate(sun.getDate()+6);
      const f=x=>`${x.getDate()} ${MONTHS[x.getMonth()].slice(0,3)}`;
      return `${f(sun)} – ${f(sat)} ${sat.getFullYear()}`;
    }
    const [y,m]=selMonth.split("-").map(Number);
    return `${MONTHS[m-1]} ${y}`;
  }

  function fileSafePart(value){
    return String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "export";
  }

  function exportFilename(ext){
    return `ClassLog_${fileSafePart(teacherName)}_${fileSafePart(periodLabel())}.${ext}`;
  }

  function csvTextFromRows(rows, label){
    const headers=["Date","Class","Institute","Subject","Time","Status","Title","Notes"];
    const escape=v=>(`"${String(v||"").replace(/"/g,'""')}"`);
    return [
      `ClassLog Export — ${teacherName} — ${label}`,
      "",
      headers.join(","),
      ...rows.map(r=>[r.date,r.class,r.institute,r.subject,r.time,r.status||"",r.title,r.notes].map(escape).join(",")),
    ].join("\r\n");
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 1200);
  }

  async function blobToBase64(blob){
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for(let i=0;i<bytes.length;i+=chunkSize){
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function shareNativeFile({ filename, textContent = "", blob = null }){
    const { Filesystem, Directory, Encoding, Share } = await loadNativeExportRuntime();
    const writeResult = blob
      ? await Filesystem.writeFile({
          path: filename,
          directory: Directory.Cache,
          data: await blobToBase64(blob),
          recursive: true,
        })
      : await Filesystem.writeFile({
          path: filename,
          directory: Directory.Cache,
          data: textContent,
          encoding: Encoding.UTF8,
          recursive: true,
        });

    const fileUri = writeResult?.uri || (await Filesystem.getUri({ path: filename, directory: Directory.Cache })).uri;
    await Share.share({
      title: "ClassLog export",
      text: `${teacherName} · ${periodLabel()}`,
      files: [fileUri],
      dialogTitle: "Export teacher entries",
    });
  }

  async function buildPdfDocument(rows, label){
    const { jsPDF, autoTable } = await loadExportPdfRuntime();
    const doc = new jsPDF({ unit:"pt", format:"a4" });
    const groups = groupRowsForPdf(rows);
    const totalClasses = groups.reduce((sum, inst) => sum + inst.classCount, 0);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const contentWidth = pageWidth - (marginX * 2);
    let cursorY = 44;
    const ensureRoom = heightNeeded => {
      if(cursorY + heightNeeded <= pageHeight - 40) return;
      doc.addPage();
      cursorY = 44;
    };

    doc.setTextColor(16, 24, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ClassLog", marginX, cursorY);
    cursorY += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 84, 103);
    doc.text(`${teacherName} · ${label}`, marginX, cursorY);
    cursorY += 16;
    doc.text(`Exported ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}`, marginX, cursorY);
    cursorY += 20;

    if(rows.length===0){
      doc.setDrawColor(220, 227, 234);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, cursorY, contentWidth, 64, 12, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(16, 24, 40);
      doc.text("No entries found for this period.", marginX + 16, cursorY + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(102, 112, 133);
      doc.text("Try a wider range if you want a larger export.", marginX + 16, cursorY + 46);
      return doc;
    }

    const summaryCards = [
      { label:"Institutes", value:String(groups.length) },
      { label:"Classes", value:String(totalClasses) },
      { label:"Entries", value:String(rows.length) },
    ];
    const gap = 10;
    const cardWidth = (contentWidth - (gap * (summaryCards.length - 1))) / summaryCards.length;
    summaryCards.forEach((card, index) => {
      const left = marginX + (index * (cardWidth + gap));
      doc.setDrawColor(220, 227, 234);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(left, cursorY, cardWidth, 54, 12, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(102, 112, 133);
      doc.text(card.label.toUpperCase(), left + 12, cursorY + 18);
      doc.setFontSize(18);
      doc.setTextColor(16, 24, 40);
      doc.text(card.value, left + 12, cursorY + 40);
    });
    cursorY += 72;

    groups.forEach(inst => {
      ensureRoom(34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(16, 24, 40);
      doc.text(inst.name, marginX, cursorY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(102, 112, 133);
      doc.text(`${inst.classCount} class${inst.classCount===1?"":"es"} · ${inst.entryCount} entr${inst.entryCount===1?"y":"ies"}`, pageWidth - marginX, cursorY, { align:"right" });
      cursorY += 12;
      doc.setDrawColor(220, 227, 234);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 18;

      inst.classes.forEach(group => {
        ensureRoom(42);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(220, 227, 234);
        doc.roundedRect(marginX, cursorY, contentWidth, 30, 10, 10, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(16, 24, 40);
        doc.text(group.className, marginX + 12, cursorY + 18);
        if(group.subject){
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(102, 112, 133);
          doc.text(group.subject, pageWidth - marginX - 12, cursorY + 18, { align:"right" });
        }
        cursorY += 38;
        autoTable(doc, {
          startY: cursorY,
          margin: { left: marginX, right: marginX },
          head: [["Date","Time","Status","Title","Notes"]],
          body: group.entries.map(row => [
            formatPdfDate(row.date),
            row.time || "—",
            row.status || "—",
            row.title || "—",
            row.notes || "—",
          ]),
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 6,
            lineColor: [220, 227, 234],
            lineWidth: 0.4,
            textColor: [16, 24, 40],
            overflow: "linebreak",
            valign: "top",
          },
          headStyles: {
            fillColor: [31, 69, 104],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 72 },
            1: { cellWidth: 82 },
            2: { cellWidth: 76 },
            3: { cellWidth: 110 },
          },
        });
        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 18;
      });
    });

    return doc;
  }

  async function exportPDF(){
    const rows=getEntries();
    const label=periodLabel();
    const doc = await buildPdfDocument(rows, label);
    if(isNativeExport){
      const pdfBlob = new Blob([doc.output("arraybuffer")], { type:"application/pdf" });
      await shareNativeFile({ filename: exportFilename("pdf"), blob: pdfBlob });
      return;
    }
    doc.save(exportFilename("pdf"));
  }

  async function exportExcel(){
    const rows=getEntries();
    const label=periodLabel();
    const csv = csvTextFromRows(rows, label);
    const filename = exportFilename("csv");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    if(isNativeExport){
      await shareNativeFile({ filename, textContent:`\uFEFF${csv}` });
      return;
    }
    downloadBlob(blob, filename);
  }

  async function doExport(){
    if(busy) return;
    setBusy(true);
    setExportError("");
    try{
      if(format==="pdf") await exportPDF();
      else await exportExcel();
      onClose();
    }catch(err){
      console.error("Export failed", err);
      setExportError(isNativeExport
        ? "Couldn't create the export file on this device. Please try again."
        : "Couldn't create the export file. Please try again.");
    }finally{
      setBusy(false);
    }
  }

  const inp2={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid #D9E4DC`,fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",background:"#F5F7F5",color:"#111827"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 22px",width:"100%",maxWidth:380,boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:46,height:46,borderRadius:13,background:"#E8F8EF",display:"flex",alignItems:"center",justifyContent:"center",color:"#1B8A4C"}}><AppIcon icon={IconDownload} size={22} color="#1B8A4C" /></div>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif"}}>Export Entries</div>
            <div style={{fontSize:13,color:"#6B7280"}}>PDF or Excel-friendly CSV</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}><AppIcon icon={IconX} size={20} color="#9CA3AF" /></button>
        </div>

        {/* Period selector */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Period</div>
          <div style={{display:"flex",gap:6}}>
            {[["day","Daily"],["week","Weekly"],["month","Monthly"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)}
                style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:period===k?700:500,
                  background:period===k?"#152B22":"rgba(0,0,0,0.06)",color:period===k?"#fff":"#374151",transition:"all 0.15s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker for period */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
            {period==="day"?"Date":period==="week"?"Any day in the week":"Month"}
          </div>
          {period==="month"&&(
            <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={inp2}/>
          )}
          {period==="week"&&(
            <input type="date" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={inp2}/>
          )}
          {period==="day"&&(
            <input type="date" value={selDay} onChange={e=>setSelDay(e.target.value)} style={inp2}/>
          )}
        </div>

        {/* Format selector */}
        <div style={{marginBottom:22}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Format</div>
          <div style={{display:"flex",gap:8}}>
            {[["pdf","PDF",IconFileTypePdf],["excel","Excel / CSV",IconFileSpreadsheet]].map(([k,l,Icon])=>(
              <button key={k} onClick={()=>setFormat(k)}
                style={{flex:1,padding:"12px 0",borderRadius:12,border:`2px solid ${format===k?"#1B8A4C":"#D9E4DC"}`,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:format===k?700:500,
                  background:format===k?"#E8F8EF":"transparent",color:format===k?"#1B8A4C":"#374151",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <AppIcon icon={Icon} size={17} color={format===k?"#1B8A4C":"#374151"} />
                <span>{l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview summary */}
        <div style={{background:"#F5F7F5",borderRadius:12,padding:"10px 14px",marginBottom:20,fontSize:13,color:"#374151"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconCalendar} size={14} color="#374151" /><strong>{periodLabel()}</strong></span> · {format==="pdf"?"Creates a PDF file":"Creates a CSV file"}{isNativeExport?" and opens Android sharing":""}
        </div>

        {exportError && (
          <div style={{marginBottom:14,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"10px 12px",fontSize:12.5,fontWeight:600,color:"#B42318"}}>
            {exportError}
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif"}}>
            Cancel
          </button>
          <button onClick={doExport} disabled={busy}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#1B8A4C",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",opacity:busy?0.7:1}}>
            {busy?"Preparing…":"Export"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Slot resolution: Firestore sections first, KIS hardcode as fallback ─────────
// getSlotsForSection(cls, instituteSections) → slots array | null
// instituteSections = getAllInstituteSections() result: { [instName]: { gradeGroups } }
function getInstituteSectionConfig(instituteSections, instituteName) {
  if (!instituteSections || !instituteName) return null;
  if (instituteSections[instituteName]) return instituteSections[instituteName];
  const target = String(instituteName || "").trim().toLowerCase();
  if (!target) return null;
  const match = Object.entries(instituteSections).find(([name]) => String(name || "").trim().toLowerCase() === target);
  return match?.[1] || null;
}
function getSlotsForSection(cls, instituteSections) {
  if (!cls) return null;
  // 1. Check Firestore admin-created sections for this institute
  const instData = getInstituteSectionConfig(instituteSections, cls.institute);
  if (instData?.gradeGroups?.length) {
    for (const grp of instData.gradeGroups) {
      if ((grp.sections || []).includes(cls.section)) {
        // Per-section override?
        const ov = (grp.sectionOverrides || {})[cls.section];
        if (ov?.length) return ov;
        if (grp.slots?.length) return grp.slots;
      }
    }
  }
  // 2. Fallback: hardcoded KIS SIP logic
  return getKisSlots(cls);
}
function normaliseSectionKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}
function getInstituteSectionNames(instData) {
  return uniqueChoiceValues([
    ...((instData?.gradeGroups || []).flatMap(group => group.sections || [])),
    ...(instData?.extraSections || []),
  ]);
}
function getInstituteSectionOptions(classes, storedSections, instituteSections, instituteName) {
  const instituteKey = normaliseChoiceKey(instituteName);
  const localSections = (classes || [])
    .filter(cls => {
      if (!cls || cls.left) return false;
      if (!instituteKey) return true;
      return normaliseChoiceKey(cls.institute) === instituteKey;
    })
    .map(cls => cls.section);
  return mergeChoiceValues(
    getInstituteSectionNames(getInstituteSectionConfig(instituteSections, instituteName)),
    localSections,
    storedSections
  );
}
function getInstituteSectionEntityLabels(instData) {
  const type = String(instData?.type || "").trim();
  const coaching = type === "coaching_12" || type === "coaching_grad";
  return coaching
    ? { singular:"batch", plural:"batches" }
    : { singular:"section", plural:"sections" };
}
function getInstituteSectionChangeEvents(instData) {
  return [...(instData?.sectionChangeEvents || [])]
    .filter(event => Array.isArray(event?.changes) && event.changes.length > 0)
    .sort((a,b)=>(a?.createdAt || 0) - (b?.createdAt || 0));
}
function mergePendingAdminNoticeItems(existingItems, nextItems) {
  const merged = new Map();
  [...(existingItems || []), ...(nextItems || [])]
    .filter(Boolean)
    .forEach(item => {
      const key = String(item?.classId || item?.id || "");
      if (!key) return;
      merged.set(key, item);
    });
  return [...merged.values()]
    .sort((a, b) => (a?.eventAt || 0) - (b?.eventAt || 0))
    .slice(-20);
}
function normaliseSectionRenameNotice(item, fallbackEventAt = Date.now()) {
  const classId = String(item?.classId || "");
  const eventId = String(item?.eventId || item?.id || "");
  return {
    id:`section_renamed_${classId || "class"}_${eventId || fallbackEventAt}`,
    kind:"section_renamed",
    classId,
    section:String(item?.newSection || item?.section || "").trim(),
    institute:String(item?.institute || "").trim(),
    subject:String(item?.subject || "").trim(),
    oldSection:String(item?.oldSection || "").trim(),
    newSection:String(item?.newSection || item?.section || "").trim(),
    adminName:String(item?.adminName || "Admin").trim() || "Admin",
    eventAt:Number(item?.eventAt || fallbackEventAt || Date.now()),
    promptedAt:Number(item?.promptedAt || 0) || null,
    timetableChanged:!!item?.timetableChanged,
    entitySingular:String(item?.entitySingular || "").trim(),
    entityPlural:String(item?.entityPlural || "").trim(),
  };
}
function buildSectionChangeApplication(classes, instituteSections, seenEventIds) {
  const seen = new Set((seenEventIds || []).map(id => String(id || "")));
  const notices = [];
  const triggeredEventIds = new Set();
  let appliedAny = false;
  const updatedClasses = (classes || []).map(cls => {
    if (!cls || cls.left) return cls;
    const instData = getInstituteSectionConfig(instituteSections, cls.institute);
    if (!instData) return cls;
    const entityLabels = getInstituteSectionEntityLabels(instData);
    const events = getInstituteSectionChangeEvents(instData);
    let nextSection = cls.section || "";
    let changed = false;
    events.forEach(event => {
      const eventId = String(event?.id || "");
      if (!eventId || seen.has(eventId)) return;
      const match = (event.changes || []).find(change =>
        normaliseSectionKey(change?.oldSection) === normaliseSectionKey(nextSection) &&
        String(change?.newSection || "").trim()
      );
      if (!match) return;
      const mappedSection = String(match.newSection || "").trim();
      notices.push({
        id:`section_renamed_${String(cls.id || "class")}_${eventId}`,
        kind:"section_renamed",
        classId: cls.id,
        section: mappedSection || cls.section || "",
        institute: cls.institute || "",
        subject: cls.subject || "",
        oldSection: String(match.oldSection || nextSection || "").trim(),
        newSection: mappedSection,
        adminName:"Admin",
        eventAt:Number(event?.createdAt || Date.now()),
        promptedAt:null,
        timetableChanged: !!event.timetableChanged,
        entitySingular: entityLabels.singular,
        entityPlural: entityLabels.plural,
      });
      triggeredEventIds.add(eventId);
      if (mappedSection && normaliseSectionKey(mappedSection) !== normaliseSectionKey(nextSection)) {
        nextSection = mappedSection;
        changed = true;
      }
    });
    if (changed) {
      appliedAny = true;
      return { ...cls, section: nextSection };
    }
    return cls;
  });
  return {
    updatedClasses,
    notices,
    eventIds:[...triggeredEventIds],
    appliedAny,
  };
}

// ── KIS SIP Kunjpura preset timetable slots ────────────────────────────────────
// Yellow (break) rows from the timetable are excluded.
// Only applies to KIS SIP Kunjpura — NOT KIS Competition Wing or other KIS branches.
const KIS_SLOTS = {
  senior: [ // 11th and 12th
    { start:"09:00", end:"10:30", durMins:90  },
    { start:"10:45", end:"12:00", durMins:75  },
    { start:"12:00", end:"13:30", durMins:90  },
    { start:"15:00", end:"16:15", durMins:75  },
    { start:"16:15", end:"17:30", durMins:75  },
  ],
  junior: [ // 6th to 10th
    { start:"09:00", end:"10:00", durMins:60  },
    { start:"10:00", end:"11:00", durMins:60  },
    { start:"11:15", end:"12:15", durMins:60  },
    { start:"12:15", end:"13:00", durMins:45  },
    { start:"15:00", end:"16:00", durMins:60  },
    { start:"16:00", end:"17:00", durMins:60  },
  ],
};

// Matches any institute with "KIS SIP" in the name (case-insensitive)
function isKisSip(institute) {
  const s = (institute || "").toLowerCase();
  return s.includes("kis") && s.includes("sip");
}

// Convert Roman numerals (I–XII) to integer, returns null if not Roman
const ROMAN_MAP = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 };
function romanToInt(str) {
  const s = str.toLowerCase().replace(/[^ivxlcdm]/g, "");
  if (!s.length) return null;
  let total = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = ROMAN_MAP[s[i]];
    if (!val) return null;
    total += val < prev ? -val : val;
    prev = val;
  }
  // Sanity check: 1–12 only (class grades)
  return total >= 1 && total <= 12 ? total : null;
}

// Extract grade number from a section name.
// Handles: "11th NDA", "12th A", "XI NDA", "IX B", "9 A", "Class 8"
function extractGrade(section) {
  const s = (section || "").trim();
  // 1. Arabic numerals first: "11th", "12", "9"
  const arabic = s.match(/\b(\d{1,2})(st|nd|rd|th)?\b/i);
  if (arabic) {
    const n = parseInt(arabic[1]);
    if (n >= 1 && n <= 12) return n;
  }
  // 2. Roman numerals: look for standalone Roman word at start
  const romanMatch = s.match(/^([IVXivx]{1,6})\b/);
  if (romanMatch) {
    const n = romanToInt(romanMatch[1]);
    if (n) return n;
  }
  // 3. Roman numeral anywhere in the string (e.g. "NDA XI")
  const words = s.split(/\s+/);
  for (const w of words) {
    const n = romanToInt(w);
    if (n) return n;
  }
  return null;
}

function getKisSlots(cls) {
  if (!cls) return null;
  if (!isKisSip(cls.institute)) return null;
  const grade = extractGrade(cls.section);
  if (!grade) return null;
  if (grade >= 11) return KIS_SLOTS.senior;
  if (grade >= 6)  return KIS_SLOTS.junior;
  return null;
}

// "09:00" → "9:00 AM"
function fmtSlot(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Returns the slot the teacher uses most, skipping any already used today.
// Falls back to the first available slot if no history yet.
function getDefaultKisSlot(notes, classId, kisSlots, usedStartsToday) {
  if (!kisSlots || !kisSlots.length) return null;
  const available = kisSlots.filter(s => !usedStartsToday.has(s.start));
  if (!available.length) return null;
  const freq = {};
  Object.values(notes[classId] || {}).forEach(entries => {
    if (!Array.isArray(entries)) return;
    entries.forEach(e => {
      const slot = kisSlots.find(s => s.start === e.timeStart);
      if (slot) freq[slot.start] = (freq[slot.start] || 0) + 1;
    });
  });
  if (!Object.keys(freq).length) return available[0];
  return [...available].sort((a, b) => (freq[b.start]||0) - (freq[a.start]||0))[0];
}

// ── Time suggestion: same day-of-week first, fall back to most recent if no DOW history ──
function getSuggestedTime(notes, classId, dateKey) {
  const dayOfWeek = new Date(dateKey).getDay();
  const classNotes = notes[classId] || {};

  function buildFreq(filterFn) {
    const freq = {};
    Object.entries(classNotes).forEach(([dk, entries]) => {
      if (!Array.isArray(entries)) return;
      if (!filterFn(dk)) return;
      entries.forEach(e => {
        if (!e.timeStart||typeof e.timeStart!=="string") return;
        let dur = 60;
        if (e.timeEnd&&typeof e.timeEnd==="string") {
          try{
            const [sh,sm]=e.timeStart.split(':').map(Number);
            const [eh,em]=e.timeEnd.split(':').map(Number);
            const d=(eh*60+em)-(sh*60+sm);
            if(d>0&&d<480) dur=d;
          }catch(err){}
        }
        const k = e.timeStart + '|' + dur;
        freq[k] = (freq[k] || 0) + 1;
      });
    });
    return freq;
  }

  function freqToSuggestion(freq) {
    if (!Object.keys(freq).length) return null;
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    const [timeStart, durStr] = best.split('|');
    const dur = parseInt(durStr);
    const [h, m] = timeStart.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + dur);
    const eh = String(end.getHours()).padStart(2, '0');
    const em2 = String(end.getMinutes()).padStart(2, '0');
    return { timeStart, timeEnd: eh + ':' + em2, _dur: dur, _suggested: true };
  }

  // 1st: try same day of week
  const dowFreq = buildFreq(dk => new Date(dk).getDay() === dayOfWeek);
  if (Object.keys(dowFreq).length) return freqToSuggestion(dowFreq);

  // 2nd: fall back to all days (until a week's worth of data is built)
  const allFreq = buildFreq(() => true);
  return freqToSuggestion(allFreq);
}


// ── Section Linking Modal ─────────────────────────────────────────────────────
function SectionLinkingModal({ unlinkedClasses, instituteSections, onConfirm, onLater }) {
  const [selections, setSelections] = React.useState({});
  const G3 = {forest:"#152B22",green:"#1B8A4C",greenV:"#34D077",greenL:"#E8F8EF",bg:"#F5F7F5",surface:"#FFFFFF",border:"#D9E4DC",text:"#111827",textM:"#374151",textL:"#6B7280",red:"#C93030",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'Inter',sans-serif"};

  function getAdminSections(cls) {
    return (getInstituteSectionConfig(instituteSections, cls.institute)?.gradeGroups||[]).flatMap(g=>g.sections||[]);
  }

  function handleConfirm() {
    const renames = {};
    let ok = true;
    unlinkedClasses.forEach(cls => {
      const sel = selections[cls.id];
      if (!sel) { ok = false; return; }
      renames[cls.id] = sel;
    });
    if (!ok) { alert("Please select a section for each class."); return; }
    onConfirm(renames);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
      <div style={{background:G3.surface,borderRadius:22,width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        <div style={{padding:"22px 20px 16px",borderBottom:`1px solid ${G3.border}`}}>
          <div style={{width:44,height:44,borderRadius:14,background:G3.bg,border:`1px solid ${G3.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:G3.textM,marginBottom:8}}><AppIcon icon={IconSchool} size={22} color={G3.textM} /></div>
          <div style={{fontSize:19,fontWeight:700,color:G3.text,fontFamily:G3.display,marginBottom:6}}>Link your classes to the new section list</div>
          <div style={{fontSize:14,color:G3.textM,lineHeight:1.6}}>Your admin has created an official section list. Please match each of your existing classes to the correct section — this keeps your data and logging history intact.</div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {unlinkedClasses.map(cls=>{
            const adminSecs=getAdminSections(cls);
            const sel=selections[cls.id]||"";
            return(
              <div key={cls.id} style={{background:G3.bg,borderRadius:14,padding:"14px 16px",border:`1px solid ${G3.border}`}}>
                <div style={{fontSize:15,fontWeight:700,color:G3.text,marginBottom:4}}>{cls.section}</div>
                <div style={{fontSize:13,color:G3.textM,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconBuilding} size={14} color={G3.textM} />{cls.institute}{cls.subject?" · "+cls.subject:""}</div>
                <div style={{fontSize:12,color:G3.textL,marginBottom:6,fontWeight:600}}>Which section is this?</div>
                <select value={sel} onChange={e=>setSelections(s=>({...s,[cls.id]:e.target.value}))}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${sel?G3.green:G3.border}`,fontSize:15,fontFamily:G3.sans,outline:"none",background:G3.surface,color:G3.text,cursor:"pointer"}}>
                  <option value="">Select the correct section…</option>
                  {adminSecs.map(s=>(<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            );
          })}
        </div>
        <div style={{padding:"12px 20px 22px",display:"flex",gap:10,borderTop:`1px solid ${G3.border}`}}>
          <button onClick={onLater}
            style={{flex:1,padding:"12px",borderRadius:12,border:`1.5px solid ${G3.border}`,background:G3.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:G3.textM,fontFamily:G3.sans}}>
            Remind me later
          </button>
          <button onClick={handleConfirm}
            style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:G3.forest,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:G3.sans}}>
            Confirm & Link
          </button>
        </div>
      </div>
    </div>
  );
}

function capitalizeWord(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function getTeacherNoticeCopy(item) {
  const kind = String(item?.kind || "");
  const entityLabel = capitalizeWord(item?.entitySingular || "class");

  if (kind === "orphaned_notes") {
    const count = Number(item?.count || 0);
    return {
      icon:IconAlertTriangle,
      badge:"Needs review",
      badgeBg:"rgba(245,158,11,0.14)",
      badgeColor:"#B45309",
      title:"Unattached note files found",
      summary:`We found ${count} unattached class note file${count===1?"":"s"} in your teacher account.`,
      detail:"If anything looks missing, do not create duplicate classes. Please contact admin first.",
    };
  }

  if (kind === "institute_renamed") {
    const oldInstitute = item.oldInstitute || "your old institute";
    const newInstitute = item.newInstitute || item.institute || "your updated institute";
    const impactedClassCount = Number(item?.impactedClassCount || 0);
    return {
      icon:IconBuilding,
      badge:"Institute renamed",
      badgeBg:"rgba(245,158,11,0.14)",
      badgeColor:"#B45309",
      title:newInstitute,
      summary:`Your admin renamed ${oldInstitute} to ${newInstitute}.`,
      detail:impactedClassCount > 0
        ? `${impactedClassCount} active ${impactedClassCount === 1 ? "class was" : "classes were"} updated automatically.`
        : "We updated your saved institute list to the new name automatically.",
    };
  }

  if (kind === "institute_deleted") {
    const oldInstitute = item.oldInstitute || "your institute";
    const impactedClassCount = Number(item?.impactedClassCount || 0);
    return {
      icon:IconTrash,
      badge:"Institute deleted",
      badgeBg:"rgba(220,38,38,0.10)",
      badgeColor:"#B91C1C",
      title:oldInstitute,
      summary:`Your admin permanently deleted the institute "${oldInstitute}".`,
      detail:impactedClassCount > 0
        ? `${impactedClassCount} ${impactedClassCount === 1 ? "class" : "classes"} under this institute have been removed from your account.`
        : "No active classes were affected.",
    };
  }

  if (kind === "institute_deleted_migrated") {
    const oldInstitute = item.oldInstitute || "the old institute";
    const newInstitute = item.newInstitute || "a new institute";
    const impactedClassCount = Number(item?.impactedClassCount || 0);
    return {
      icon:IconBuilding,
      badge:"Institute deleted & moved",
      badgeBg:"rgba(124,58,237,0.10)",
      badgeColor:"#6D28D9",
      title:newInstitute,
      summary:`Your admin deleted "${oldInstitute}" and moved your classes to "${newInstitute}".`,
      detail:impactedClassCount > 0
        ? `${impactedClassCount} ${impactedClassCount === 1 ? "class was" : "classes were"} automatically moved to "${newInstitute}".`
        : "Your institute list has been updated to reflect this change.",
    };
  }

  if (kind === "class_deleted") {
    const entryLabel = item?.entryCount === 1 ? "entry remains" : "entries remain";
    return {
      icon:IconTrash,
      badge:"Moved to recycle bin",
      badgeBg:G.redL,
      badgeColor:G.red,
      title:item.section || "Untitled class",
      summary:"Admin moved this class out of your active list.",
      detail:item?.entryCount > 0
        ? `${item.entryCount} saved ${entryLabel} attached to this class in the recycle bin.`
        : "No saved entries were found for this class.",
    };
  }

  if (kind === "class_restored") {
    return {
      icon:IconRestore,
      badge:"Restored to active list",
      badgeBg:G.greenL,
      badgeColor:G.green,
      title:item.section || "Untitled class",
      summary:"Admin restored this class to your active teaching list.",
      detail:item?.entryCount > 0
        ? `${item.entryCount} saved ${item.entryCount === 1 ? "entry is" : "entries are"} ready under this class again.`
        : "This class is back in your list and ready for new entries.",
    };
  }

  if (kind === "section_renamed") {
    return {
      icon:IconSparkles,
      badge:"Class name updated",
      badgeBg:"rgba(59,130,246,0.12)",
      badgeColor:"#1D4ED8",
      title:item.newSection || item.section || "Updated class",
      summary:`${entityLabel} changed from ${item.oldSection || "the old name"} to ${item.newSection || item.section || "the new name"}.`,
      detail:item.timetableChanged
        ? "Future timetable slots were also updated for this class."
        : "Only the displayed class name changed. Your future timetable stays the same.",
    };
  }

  return {
    icon:IconBell,
    badge:"Admin update",
    badgeBg:"rgba(15,23,42,0.06)",
    badgeColor:G.textM,
    title:item.section || "Updated class",
    summary:"Admin made a change to this class.",
    detail:"Open the notification panel to review the latest details.",
  };
}

function TeacherNotificationPromptModal({ items, onClose, onOpenNotifications }) {
  const rows = [...(items || [])]
    .filter(item => item?.id)
    .sort((a, b) => (b.eventAt || 0) - (a.eventAt || 0));
  const hasDeleted = rows.some(item => item.kind === "class_deleted");
  const hasRestored = rows.some(item => item.kind === "class_restored");
  const hasClassRenamed = rows.some(item => item.kind === "section_renamed");
  const hasInstituteRenamed = rows.some(item => item.kind === "institute_renamed");
  const hasInstituteDeleted = rows.some(item => item.kind === "institute_deleted");
  const hasInstituteDeletedMigrated = rows.some(item => item.kind === "institute_deleted_migrated");
  const hasRenamed = hasClassRenamed || hasInstituteRenamed;
  const many = rows.length > 1;
  let title = "Review class changes from admin";
  let subtitle = "These updates are now saved in your Notification Panel. Review them there, then mark each notice read when you are done.";

  if (hasInstituteDeleted && !hasInstituteDeletedMigrated && !hasInstituteRenamed && !hasClassRenamed && !hasDeleted && !hasRestored) {
    title = many ? "Institutes were deleted" : "Institute was deleted";
    subtitle = many
      ? "Your admin deleted some institutes. Classes under those institutes have been permanently removed from your account."
      : "Your admin deleted an institute. Classes under it have been permanently removed from your account.";
  } else if (hasInstituteDeletedMigrated && !hasInstituteDeleted && !hasInstituteRenamed && !hasClassRenamed && !hasDeleted && !hasRestored) {
    title = many ? "Institutes deleted & classes moved" : "Institute deleted & classes moved";
    subtitle = many
      ? "Your admin deleted some institutes and moved your classes to new institutes. Your active classes are unchanged."
      : "Your admin deleted an institute and moved your classes to a new one. Your active classes are unchanged.";
  } else if ((hasInstituteDeleted || hasInstituteDeletedMigrated) && !hasDeleted && !hasRestored && !hasRenamed) {
    title = "Institute changes from admin";
    subtitle = "Your admin made changes to institutes on your account. Check the Notification Panel for full details.";
  } else if (hasInstituteRenamed && !hasDeleted && !hasRestored && !hasClassRenamed) {
    title = many ? "Institutes were updated" : "Institute was updated";
    subtitle = many
      ? "Your admin renamed some institutes. We updated those names automatically across your teacher account."
      : "Your admin renamed one of your institutes. We updated that name automatically across your teacher account.";
  } else if (hasClassRenamed && !hasDeleted && !hasRestored && !hasInstituteRenamed) {
    title = many ? "Class names were updated" : "Class name was updated";
    subtitle = many
      ? "Your admin renamed some classes. We updated the names below so future logging stays aligned."
      : "Your admin renamed a class. We updated the name below so future logging stays aligned.";
  } else if (hasRenamed && !hasDeleted && !hasRestored) {
    title = many ? "Names were updated" : "Name was updated";
    subtitle = many
      ? "Your admin renamed classes or institutes. We updated those names automatically so your future logging stays aligned."
      : "Your admin renamed a class or institute. We updated the name automatically so your future logging stays aligned.";
  } else if (hasDeleted && !hasRestored && !hasRenamed) {
    title = many ? "Classes moved to recycle bin" : "Class moved to recycle bin";
    subtitle = many
      ? "Your admin moved these classes out of your active list. Review the affected classes in Notifications."
      : "Your admin moved this class out of your active list. Review the affected class in Notifications.";
  } else if (hasRestored && !hasDeleted && !hasRenamed) {
    title = many ? "Classes restored to your list" : "Class restored to your list";
    subtitle = many
      ? "Your admin restored these classes back into your active teaching list."
      : "Your admin restored this class back into your active teaching list.";
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.58)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
      <div style={{background:G.surface,borderRadius:24,width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.28)"}}>
        <div style={{padding:"22px 20px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(59,130,246,0.10)",border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 12px",fontSize:12,fontWeight:700,color:"#1D4ED8",fontFamily:G.mono,letterSpacing:0.3,marginBottom:12}}>
            New teacher notifications
          </div>
          <div style={{fontSize:21,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:6}}>
            {title}
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.65}}>
            {subtitle}
          </div>
        </div>

        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
          {rows.map(item => {
            const copy = getTeacherNoticeCopy(item);
            return (
              <div key={item.id} style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                    <AppIcon icon={copy.icon} size={20} color={copy.badgeColor} />
                    <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,minWidth:0}}>
                      {copy.title}
                    </div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,fontFamily:G.mono,borderRadius:999,padding:"5px 10px",background:copy.badgeBg,color:copy.badgeColor}}>
                    {copy.badge}
                  </span>
                </div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                  {copy.summary}
                </div>
                <div style={{fontSize:12,color:G.textL,lineHeight:1.65,marginTop:6}}>
                  {copy.detail}
                </div>
                {item.kind==="institute_renamed" && item.oldInstitute && item.newInstitute && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                    <span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textM}}>From {item.oldInstitute}</span>
                    <span style={{background:"rgba(245,158,11,0.10)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B45309"}}>Now {item.newInstitute}</span>
                  </div>
                )}
                {item.kind==="institute_deleted_migrated" && item.oldInstitute && item.newInstitute && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                    <span style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B91C1C",display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconTrash} size={13} color="#B91C1C" />Deleted: {item.oldInstitute}</span>
                    <span style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#6D28D9"}}>Moved to: {item.newInstitute}</span>
                  </div>
                )}
                {item.kind==="institute_deleted" && item.oldInstitute && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                    <span style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B91C1C",display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconTrash} size={13} color="#B91C1C" />Permanently deleted: {item.oldInstitute}</span>
                  </div>
                )}
                <div style={{fontSize:12,color:G.textL,lineHeight:1.6,marginTop:8}}>
                  {`${item.institute || "No institute"}${item.subject ? ` · ${item.subject}` : ""}`}
                </div>
                <div style={{fontSize:12,color:G.textL,lineHeight:1.6,marginTop:4}}>
                  {`${item.adminName || "Admin"} · ${fmtAdminNoticeStamp(item.eventAt)}`}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{padding:"12px 20px 22px",display:"flex",justifyContent:"flex-end",gap:10,borderTop:`1px solid ${G.border}`,flexWrap:"wrap"}}>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          <PrimaryBtn onClick={onOpenNotifications}>Open notifications</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function TeacherLoadingScreen({text="Loading teacher panel…", themeShell={}}){
  const shimmer = {
    background:"linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
    backgroundSize:"220% 100%",
    animation:"teacherSkeletonWave 1.25s linear infinite",
  };
  const block = (width, height, extra={}) => (
    <div style={{width, height, borderRadius:12, background:G.surfaceAlt, overflow:"hidden", ...extra}}>
      <div style={{width:"100%",height:"100%",...shimmer}}/>
    </div>
  );

  return(
    <div style={{...themeShell,minHeight:"100vh",background:G.pageBg,fontFamily:G.sans,padding:"20px 16px"}}>
      <style>{`
        @keyframes teacherSkeletonWave{
          0%{background-position:200% 0;}
          100%{background-position:-200% 0;}
        }
      `}</style>
      <div style={{maxWidth:430,margin:"0 auto"}}>
        <div style={{background:G.heroBg,borderRadius:26,padding:"20px 18px 18px",boxShadow:G.shadowLg,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>{block("58%","14px",{borderRadius:999,background:"rgba(255,255,255,0.18)"})}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            {block("34%","46px",{borderRadius:18,background:"rgba(255,255,255,0.18)"})}
            {block("24%","24px",{borderRadius:999,background:"rgba(255,255,255,0.15)"})}
          </div>
          {block("100%","8px",{borderRadius:999,background:"rgba(255,255,255,0.16)",marginBottom:10})}
          <div style={{display:"flex",gap:8}}>
            {block("30%","28px",{borderRadius:999,background:"rgba(255,255,255,0.14)"})}
            {block("34%","28px",{borderRadius:999,background:"rgba(255,255,255,0.14)"})}
          </div>
        </div>

        <div style={{display:"flex",gap:8,overflow:"hidden",marginBottom:18}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{flex:i===0?0.7:1,height:38,borderRadius:999,background:G.surface,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{width:"100%",height:"100%",...shimmer}}/>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{background:G.classCardBg,border:`1px solid ${G.border}`,borderRadius:22,padding:"15px 14px 14px",boxShadow:G.shadowSm}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:12}}>
                <div style={{flex:1}}>
                  {block(i===0?"48%":"42%","20px",{marginBottom:8})}
                  {block(i===1?"68%":"74%","14px",{borderRadius:999})}
                </div>
                {block("26%","28px",{borderRadius:999})}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,marginBottom:10}}>
                {[0,1,2].map(idx=>block("100%","48px",{borderRadius:12,background:G.surfaceAlt}))}
              </div>
              {block(i===2?"54%":"62%","12px",{borderRadius:999})}
            </div>
          ))}
        </div>

        <div style={{textAlign:"center",marginTop:18,fontSize:13,color:G.textM}}>{text}</div>
      </div>
    </div>
  );
}

function TeacherStateFallback({ themeShell = {}, view, resolvedView, activeClassId, classCount, notificationCount, onResetHome }){
  return(
    <div style={{...themeShell,minHeight:"100vh",background:G.pageBg,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:420,background:G.surface,border:`1px solid ${G.border}`,borderRadius:24,boxShadow:G.shadowLg,padding:"26px 22px 22px"}}>
        <div style={{width:54,height:54,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <AppIcon icon={IconInfoCircle} size={28} color={G.textM} />
        </div>
        <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.4,marginBottom:8}}>Teacher panel needs a reset</div>
        <div style={{fontSize:14,color:G.textM,lineHeight:1.7,marginBottom:16}}>
          The app reached an unexpected teacher screen state after loading. Resetting to home should recover it immediately.
        </div>
        <button
          type="button"
          onClick={onResetHome}
          style={{width:"100%",border:"none",borderRadius:14,background:G.navy,color:"#fff",padding:"13px 18px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
          Reset teacher home
        </button>
        <div style={{marginTop:16,fontSize:12,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.55}}>Debug state</div>
        <pre style={{margin:"8px 0 0",whiteSpace:"pre-wrap",wordBreak:"break-word",background:G.surfaceSoft,border:`1px solid ${G.border}`,borderRadius:14,padding:"13px 14px",color:G.textS,fontSize:12.5,lineHeight:1.6,fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>
{JSON.stringify({
  view,
  resolvedView,
  activeClassId: activeClassId || null,
  classCount,
  notificationCount,
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ClassTrackerInner({user}){
  const [data,setData]         = useState(DEFAULT_DATA);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState(false);
  const [draftSaving,setDraftSaving] = useState(false);
  const [lastCloudSavedAt,setLastCloudSavedAt] = useState(0);
  const [lastDraftSavedAt,setLastDraftSavedAt] = useState(0);
  const [saveBadgeFlash,setSaveBadgeFlash] = useState(null);
  const [view,_setView]         = useState("home");
  const [activeClass,setActiveClass] = useState(null);
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [newNote,setNewNote]   = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",status:""});
  const [editNote,setEditNote] = useState(null);
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:""});
  const [selectedGroup,setSelectedGroup] = useState(null); // null | gradeGroup object | "other"
  const [showNoteDetails,setShowNoteDetails] = useState(false);
  const [search,setSearch]     = useState("");
  // Name editing removed — name set from Google/signup only
  const [editingClass,setEditingClass] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [instFilter,      setInstFilter]      = useState("all"); // institute filter on home
  const [statsInstituteName,setStatsInstituteName] = useState("");

  // Auto-reset the institute filter if the selected institute no longer has any active classes
  React.useEffect(() => {
    if (instFilter === "all") return;
    const activeInsts = new Set((data.classes || []).filter(c => !c.left && !c.archived).map(c => c.institute || ""));
    if (!activeInsts.has(instFilter)) setInstFilter("all");
  }, [data.classes, instFilter]);
  React.useEffect(() => {
    if (statsInstituteName === "") return;
    const activeInsts = new Set((data.classes || []).filter(c => !c.left && !c.archived).map(c => c.institute || ""));
    if (!activeInsts.has(statsInstituteName)) setStatsInstituteName("");
  }, [data.classes, statsInstituteName]);
  const [leaveModal,setLeaveModal]     = useState(null);
  const [historyClassId,setHistoryClassId] = useState(null);
  const [statsClassId,setStatsClassId] = useState(null);
  const [mobileClassSheetId,setMobileClassSheetId] = useState(null);
  const [signOutPrompt,setSignOutPrompt] = useState(false);
  const [exportOpen,setExportOpen]       = useState(false);
  const [teacherBackView,setTeacherBackView] = useState("home");
  const [isOffline,setIsOffline]         = useState(!navigator.onLine);
  const [inlineToast,setInlineToast]     = useState(null);
  const inlineToastTimer                 = useRef(null);
  const [confirmModal,setConfirmModal]   = useState(null);
  const [isMobile,setIsMobile]           = useState(window.innerWidth < 768);
  const [isWeakDevice,setIsWeakDevice]   = useState(false);
  const [reduceEffects,setReduceEffects] = useState(false);
  const [teacherTheme,setTeacherTheme]   = useState(readStoredTeacherTheme);
  const heroCollapsed = true;
  const [detailSwipeOffset,setDetailSwipeOffset] = useState(0);
  const [detailSwipeTransitionMs,setDetailSwipeTransitionMs] = useState(0);
  const [loadIssue,setLoadIssue]         = useState(null);
  const [dataWarning,setDataWarning]     = useState(null);
  const localTeacherNoticeDismissKey     = `${TEACHER_LOCAL_NOTICE_DISMISS_KEY}_${user.uid}`;
  const [dismissedTeacherLocalNoticeSignature, setDismissedTeacherLocalNoticeSignature] = useState(() => readStoredTeacherLocalNoticeSignature(`${TEACHER_LOCAL_NOTICE_DISMISS_KEY}_${user.uid}`));
  const [allowCloudSync,setAllowCloudSync] = useState(false);
  const [loadAttempt,setLoadAttempt]     = useState(0);
  const [restoringBackup,setRestoringBackup] = useState(false);
  const [cloudRevision,setCloudRevision] = useState(0);
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);
  const noteDraftTimer = useRef(null);
  const saveBadgeHideTimer = useRef(null);
  const lastSyncedFingerprint = useRef("");
  const hydratedDraftKeyRef = useRef("");
  const lastForegroundRefreshAt = useRef(0);
  const classSwipeStartRef = useRef(null);
  const detailSwipeResetTimer = useRef(null);
  const detailSwipeOffsetValueRef = useRef(0);
  const detailSwipeOffsetRaf = useRef(0);
  const teacherHistoryTokenRef = useRef(1);

  const [globalInstitutes,  setGlobalInstitutes]  = useState([]);
  const [instituteSections, setInstituteSections] = useState({}); // {instName:{gradeGroups,extraSections}}
  const [teacherNoticePrompt, setTeacherNoticePrompt] = useState(null);
  const pendingSaveKey = `classlog_pending_${user.uid}`;
  const mobileLiteMode = isMobile && (isWeakDevice || reduceEffects);
  const mobileBatchSize = mobileLiteMode ? 8 : 14;
  const mobileBottomNavPad = "calc(88px + env(safe-area-inset-bottom, 0px))";
  const isEntryComposerView = view==="addNote" || view==="editNote";
  const activeEntryDraftForm = isEntryComposerView ? (view==="editNote" ? editNote : newNote) : null;
  const activeEntryDraftKey = useMemo(() => {
    if(!isEntryComposerView || !activeClass?.id) return "";
    return buildTeacherDraftStorageKey(
      user.uid,
      activeClass.id,
      selectedDate,
      view==="editNote" ? (editNote?.id || "edit") : "new"
    );
  }, [activeClass?.id, editNote?.id, isEntryComposerView, selectedDate, user.uid, view]);
  const hasActiveEntryDraft = useMemo(
    () => hasLiveEntryDraft(activeEntryDraftForm),
    [activeEntryDraftForm]
  );
  const teacherThemeVars = useMemo(() => getTeacherThemeVars(teacherTheme), [teacherTheme]);
  const teacherThemeShell = useMemo(() => ({
    ...teacherThemeVars,
    colorScheme:teacherTheme,
  }), [teacherThemeVars, teacherTheme]);
  const isDarkTeacherTheme = teacherTheme === "dark";
  const [mobileClassLimit, setMobileClassLimit] = useState(mobileBatchSize);
  const sectionChangeSessionSeenRef = useRef(new Set());
  const pendingAdminClassNotices = useMemo(() => (
    Array.isArray(data?._meta?.pendingAdminClassNotices)
      ? data._meta.pendingAdminClassNotices.filter(Boolean)
      : []
  ), [data?._meta?.pendingAdminClassNotices]);
  const currentTeacherLocalNoticeSignature = useMemo(
    () => getTeacherLocalNoticeSignature(dataWarning),
    [dataWarning]
  );
  const localTeacherNotice = useMemo(() => {
    if(dataWarning?.kind !== "orphaned") return null;
    if(!currentTeacherLocalNoticeSignature || currentTeacherLocalNoticeSignature === dismissedTeacherLocalNoticeSignature) return null;
    return {
      id:`local_notice_${currentTeacherLocalNoticeSignature}`,
      kind:"orphaned_notes",
      institute:"Teacher workspace",
      subject:"",
      count:Number(dataWarning?.count || 0),
      eventAt:Number(dataWarning?.eventAt || Date.now()),
      adminName:"System",
      status:"info",
    };
  }, [currentTeacherLocalNoticeSignature, dataWarning, dismissedTeacherLocalNoticeSignature]);
  const notificationCount = pendingAdminClassNotices.length + (localTeacherNotice ? 1 : 0);
  const teacherHomeModel = useMemo(() => {
    const activeClasses = [...(data.classes || []).filter(c => !c.left)].sort((a,b)=>(b.created||0)-(a.created||0));
    const institutes = [...new Set(activeClasses.map(c => c?.institute || ""))].filter(Boolean);
    const visibleClasses = instFilter==="all" ? activeClasses : activeClasses.filter(c=>c.institute===instFilter);
    const classMetricsMap = {};
    (data.classes || []).forEach(cls => {
      if(!cls?.id) return;
      classMetricsMap[cls.id] = buildClassEntryMetrics(data.notes?.[cls.id] || {});
    });
    const quickHomeSummary = buildTeacherQuickHomeSummary(activeClasses, data.notes);
    const knownInstituteNames = [...new Set([
      ...globalInstitutes,
      ...(data.classes || []).map(cls => cls?.institute || ""),
      ...((data.trash?.classes || []).map(cls => cls?.institute || "")),
    ].map(name => String(name || "").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b));
    return {
      activeClasses,
      institutes,
      visibleClasses,
      classMetricsMap,
      quickHomeSummary,
      knownInstituteNames,
    };
  }, [data.classes, data.notes, data.trash?.classes, globalInstitutes, instFilter]);
  const teacherActiveClasses = teacherHomeModel.activeClasses;
  const teacherInstitutes = teacherHomeModel.institutes;
  const teacherFilteredClasses = teacherHomeModel.visibleClasses;
  const deferredTeacherVisibleClasses = React.useDeferredValue(teacherHomeModel.visibleClasses);
  const teacherClassMetricsMap = teacherHomeModel.classMetricsMap;
  const teacherQuickHomeSummary = teacherHomeModel.quickHomeSummary;
  const instituteColorMap = useMemo(
    () => buildInstituteColorMap(teacherHomeModel.knownInstituteNames),
    [teacherHomeModel.knownInstituteNames]
  );
  ACTIVE_INSTITUTE_COLOR_MAP = instituteColorMap;
  const instituteFilterToneMap = useMemo(() => {
    const map = new Map();
    teacherActiveClasses.forEach(cls => {
      const instituteName = String(cls?.institute || "").trim();
      if(!instituteName || map.has(instituteName)) return;
      map.set(instituteName, getSectionTone(cls?.section || instituteName));
    });
    teacherInstitutes.forEach(instituteName => {
      const key = String(instituteName || "").trim();
      if(!key || map.has(key)) return;
      map.set(key, getSectionTone(key));
    });
    return map;
  }, [teacherActiveClasses, teacherInstitutes]);
  const adminNoticeItems = useMemo(() => (
    pendingAdminClassNotices
      .map(item => {
        const isInstituteRename = item?.kind === "institute_renamed";
        const isInstituteDeleted = item?.kind === "institute_deleted" || item?.kind === "institute_deleted_migrated";
        const isInstituteAction = isInstituteRename || isInstituteDeleted;
        const activeClass = (data.classes || []).find(cls => String(cls?.id || "") === String(item?.classId || "")) || null;
        const trashedClass = (data.trash?.classes || []).find(cls => String(cls?.id || "") === String(item?.classId || "")) || null;
        const record = isInstituteAction ? (item || {}) : (activeClass || trashedClass || item || {});
        const noteMap = !isInstituteAction && activeClass
          ? (data.notes?.[record.id] || {})
          : !isInstituteAction && trashedClass
            ? (trashedClass?.savedNotes || {})
            : {};
        return {
          ...item,
          ...buildClassEntrySummary(noteMap),
          section: isInstituteAction ? "" : (record.section || item.section || "Untitled class"),
          institute: record.institute || item.institute || "",
          subject: record.subject || item.subject || "",
          activeClass: isInstituteAction ? null : activeClass,
          trashedClass: isInstituteAction ? null : trashedClass,
          status: isInstituteAction ? "info" : activeClass ? "active" : trashedClass ? "trash" : "missing",
        };
      })
      .sort((a,b)=>(b.eventAt||0)-(a.eventAt||0))
  ), [pendingAdminClassNotices, data.classes, data.trash, data.notes]);
  const teacherNotificationItems = useMemo(() => (
    localTeacherNotice ? [localTeacherNotice, ...adminNoticeItems] : adminNoticeItems
  ), [adminNoticeItems, localTeacherNotice]);
  const adminPromptNoticeItems = useMemo(() => (
    adminNoticeItems.filter(item => !item.promptedAt)
  ), [adminNoticeItems]);
  const mobileBackTarget = isMobile ? "profile" : "home";
  const buildTeacherHistoryUrl = React.useCallback((targetView, navToken = 0) => {
    if(typeof window === "undefined") return "";
    const base = `${window.location.pathname}${window.location.search}`;
    return `${base}#teacher-${targetView}-${navToken}`;
  }, []);
  const getTeacherHashView = React.useCallback(() => {
    if(typeof window === "undefined") return "home";
    const match = (window.location.hash || "").match(/^#teacher-([a-zA-Z]+)-/);
    return sanitizeTeacherView(match?.[1] || "home");
  }, []);
  const renderTeacherBottomBar = currentView => {
    if(!isMobile || ["addClass","addNote","editNote"].includes(currentView)) return null;
    const statsOrigin = ["profile","notifications","trash"].includes(currentView) ? "profile" : "home";
    return (
      <TeacherBottomBar
        activeTab={getPrimaryTeacherTab(currentView)}
        onHome={()=>safeNav("home")}
        onStats={()=>openStatsView(statsOrigin)}
        onProfile={()=>safeNav("profile")}
        profileBadge={notificationCount}
      />
    );
  };
  const markAdminNoticesPrompted = React.useCallback((ids) => {
    const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || "")).filter(Boolean));
    if(!idSet.size) return;
    const promptedAt = Date.now();
    setData(d => ({
      ...d,
      _meta: {
        ...(d._meta || {}),
        pendingAdminClassNotices: (Array.isArray(d?._meta?.pendingAdminClassNotices) ? d._meta.pendingAdminClassNotices : [])
          .map(item => idSet.has(String(item?.id || "")) && !item?.promptedAt
            ? { ...item, promptedAt }
            : item
          ),
      },
    }));
  }, []);

  const normaliseLoadedData = React.useCallback((incoming, { forceProfileBlank = false } = {}) => {
    const fallbackName = forceProfileBlank ? "" : user.displayName;
    const incomingProfile = normaliseProfile(incoming?.profile, fallbackName);
    const base = incoming
      ? {
          ...DEFAULT_DATA,
          ...incoming,
          subjects: mergeChoiceValues(incoming.subjects, incomingProfile.subjects),
          institutes: mergeChoiceValues(incoming.institutes, incomingProfile.institutes),
          profile: incomingProfile,
          trash: incoming.trash || { classes:[], notes:[] },
        }
      : { ...DEFAULT_DATA };
    const purged = purgeExpiredTrash(base);
    if (forceProfileBlank) {
      purged.profile = normaliseProfile();
    } else if (!purged.profile?.name && user.displayName) {
      purged.profile = normaliseProfile(purged.profile, user.displayName.trim());
    }
    purged.subjects = mergeChoiceValues(purged.subjects, purged.profile?.subjects);
    purged.institutes = mergeChoiceValues(purged.institutes, purged.profile?.institutes);
    return purged;
  }, [user.displayName]);

  const storePendingDraft = React.useCallback((payload, reason = "save-failed") => {
    try{
      localStorage.setItem(pendingSaveKey, JSON.stringify({
        data: payload,
        savedAt: Date.now(),
        baseRevision: cloudRevision,
        reason,
      }));
    }catch(e){}
  }, [pendingSaveKey, cloudRevision]);

  const clearEntryDraft = React.useCallback((draftKey = activeEntryDraftKey) => {
    if(!draftKey) return;
    try{ localStorage.removeItem(draftKey); }catch(e){}
    if(hydratedDraftKeyRef.current === draftKey){
      hydratedDraftKeyRef.current = "";
    }
  }, [activeEntryDraftKey]);

  useEffect(()=>{
    // Load admin-created institutes list and section definitions
    getGlobalInstitutes().then(list => setGlobalInstitutes(list)).catch(()=>{});
    getAllInstituteSections().then(secs => setInstituteSections(secs||{})).catch(()=>{});
  },[]);

  useEffect(()=>{
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const check = ()=>{
      const profile = readClientProfile();
      setIsMobile(profile.isMobile);
      setIsWeakDevice(profile.weakDevice);
      setReduceEffects(profile.reduceMotion);
    };
    check();
    window.addEventListener("resize",check);
    if(media?.addEventListener) media.addEventListener("change",check);
    else if(media?.addListener) media.addListener(check);
    return ()=>{
      window.removeEventListener("resize",check);
      if(media?.removeEventListener) media.removeEventListener("change",check);
      else if(media?.removeListener) media.removeListener(check);
    };
  },[]);

  useEffect(()=>{
    try{ localStorage.setItem(TEACHER_THEME_STORAGE_KEY, teacherTheme); }catch(e){}
  },[teacherTheme]);

  useEffect(() => {
    setDismissedTeacherLocalNoticeSignature(readStoredTeacherLocalNoticeSignature(localTeacherNoticeDismissKey));
  }, [localTeacherNoticeDismissKey]);

  useEffect(() => {
    if(isEntryComposerView) return;
    setDraftSaving(false);
  }, [isEntryComposerView]);

  React.useLayoutEffect(() => {
    if(!isEntryComposerView || !activeEntryDraftKey) return;
    if(hydratedDraftKeyRef.current === activeEntryDraftKey) return;
    hydratedDraftKeyRef.current = activeEntryDraftKey;
    try{
      const raw = localStorage.getItem(activeEntryDraftKey);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      if(!parsed?.form) return;
      if(view === "editNote"){
        setEditNote(prev => prev ? ({ ...prev, ...parsed.form }) : prev);
      }else{
        setNewNote(prev => ({ ...prev, ...parsed.form }));
      }
      if(hasLiveEntryDraft(parsed.form)) setShowNoteDetails(true);
    }catch(e){}
  }, [activeEntryDraftKey, isEntryComposerView, view]);

  useEffect(() => {
    if(!isEntryComposerView || !activeEntryDraftKey || hydratedDraftKeyRef.current !== activeEntryDraftKey) return;
    window.clearTimeout(noteDraftTimer.current);
    if(!hasActiveEntryDraft){
      clearEntryDraft(activeEntryDraftKey);
      setDraftSaving(false);
      return;
    }
    setDraftSaving(true);
    noteDraftTimer.current = window.setTimeout(() => {
      const savedAt = Date.now();
      try{
        localStorage.setItem(activeEntryDraftKey, JSON.stringify({
          form: activeEntryDraftForm,
          savedAt,
          classId: activeClass?.id || "",
          dateKey: selectedDate,
          view,
        }));
      }catch(e){}
      setLastDraftSavedAt(savedAt);
      setDraftSaving(false);
    }, 180);
    return () => window.clearTimeout(noteDraftTimer.current);
  }, [activeClass?.id, activeEntryDraftForm, activeEntryDraftKey, clearEntryDraft, hasActiveEntryDraft, isEntryComposerView, selectedDate, view]);

  useEffect(() => () => {
    if(detailSwipeResetTimer.current){
      window.clearTimeout(detailSwipeResetTimer.current);
      detailSwipeResetTimer.current = null;
    }
    if(noteDraftTimer.current){
      window.clearTimeout(noteDraftTimer.current);
      noteDraftTimer.current = null;
    }
    if(saveBadgeHideTimer.current){
      window.clearTimeout(saveBadgeHideTimer.current);
      saveBadgeHideTimer.current = null;
    }
    if(detailSwipeOffsetRaf.current){
      window.cancelAnimationFrame(detailSwipeOffsetRaf.current);
      detailSwipeOffsetRaf.current = 0;
    }
  }, []);

  useEffect(() => {
    if(!lastCloudSavedAt){
      return;
    }
    setSaveBadgeFlash({ key:`cloud_${lastCloudSavedAt}`, label:"Saved", tone:"success" });
    if(saveBadgeHideTimer.current){
      window.clearTimeout(saveBadgeHideTimer.current);
    }
    saveBadgeHideTimer.current = window.setTimeout(() => {
      setSaveBadgeFlash(current => current?.key === `cloud_${lastCloudSavedAt}` ? null : current);
      saveBadgeHideTimer.current = null;
    }, 1400);
  }, [lastCloudSavedAt]);

  useEffect(() => {
    if(!lastDraftSavedAt || saving || saveErr){
      return;
    }
    setSaveBadgeFlash(current => {
      if(current?.tone === "success" && current?.label === "Saved"){
        return current;
      }
      return { key:`draft_${lastDraftSavedAt}`, label:"Draft saved", tone:"draft" };
    });
    if(saveBadgeHideTimer.current){
      window.clearTimeout(saveBadgeHideTimer.current);
    }
    saveBadgeHideTimer.current = window.setTimeout(() => {
      setSaveBadgeFlash(current => current?.key === `draft_${lastDraftSavedAt}` ? null : current);
      saveBadgeHideTimer.current = null;
    }, 1100);
  }, [lastDraftSavedAt, saveErr, saving]);

  useEffect(() => {
    if(!saveBadgeFlash) return;
    if(view !== "stats" && view !== "classTimeline") return;
    if(saveBadgeHideTimer.current){
      window.clearTimeout(saveBadgeHideTimer.current);
      saveBadgeHideTimer.current = null;
    }
    setSaveBadgeFlash(null);
  }, [saveBadgeFlash, view]);

  useEffect(()=>{
    let cancelled = false;
    setLoading(true);
    setSaveErr(false);
    setLoadIssue(null);
    setDataWarning(null);
    setAllowCloudSync(false);
    setCloudRevision(0);

    loadUserDataState(user.uid).then(result=>{
      if(cancelled) return;
      const status = result?.status || "error";

      if(status==="ok"){
        const purged = normaliseLoadedData(result.data);
        const liveRevision = Number(purged?._meta?.revision || 0);
        let nextWarning = result.orphanedNoteDocIds?.length
          ? {kind:"orphaned",count:result.orphanedNoteDocIds.length,eventAt:Date.now()}
          : null;
        try{
          const pending=localStorage.getItem(pendingSaveKey);
          if(pending){
            const {data:localData,savedAt,baseRevision}=JSON.parse(pending);
            const ageHrs=(Date.now()-savedAt)/(1000*60*60);
            if(ageHrs<24 && localData){
              if(Number(baseRevision ?? 0) === liveRevision){
                const mergedProfile = normaliseProfile({
                  ...purged.profile,
                  ...(localData.profile || {}),
                }, purged.profile?.name || "");
                const merged={
                  ...purged,
                  ...localData,
                  subjects: mergeChoiceValues(purged.subjects, localData.subjects, mergedProfile.subjects),
                  institutes: mergeChoiceValues(purged.institutes, localData.institutes, mergedProfile.institutes),
                  profile: mergedProfile,
                  trash:localData.trash||purged.trash,
                };
                lastSyncedFingerprint.current = dataFingerprint(purged);
                setCloudRevision(liveRevision);
                setData(merged);
                setAllowCloudSync(true);
                if(merged.profile?.name) syncTeacherIndex(user.uid,merged).catch(()=>{});
                if(nextWarning) setDataWarning(nextWarning);
                setLoading(false);
                return;
              }
              nextWarning = {
                kind:"staleDraft",
                savedAt:savedAt||0,
                cloudUpdatedAt:purged?._meta?.updatedAt||0,
                eventAt:Date.now(),
              };
            }
            if(ageHrs>=24) localStorage.removeItem(pendingSaveKey);
          }
        }catch(e){}

        lastSyncedFingerprint.current = dataFingerprint(purged);
        setCloudRevision(liveRevision);
        setData(purged);
        setAllowCloudSync(true);
        if(purged.profile?.name) syncTeacherIndex(user.uid,purged).catch(()=>{});
        if(nextWarning) setDataWarning(nextWarning);
        setLoading(false);
        return;
      }

      if(status==="missing"){
        const blank = normaliseLoadedData(null,{forceProfileBlank:true});
        lastSyncedFingerprint.current = dataFingerprint(blank);
        setCloudRevision(0);
        setData(blank);
        setAllowCloudSync(true);
        setLoading(false);
        return;
      }

      if(status==="backup"){
        setCloudRevision(Number(result.data?._meta?.revision || 0));
        setData(normaliseLoadedData(result.data));
        setLoadIssue({
          kind:"backup",
          backupSavedAt:result.backupSavedAt||0,
          orphanedCount:result.orphanedNoteDocIds?.length||result.noteDocIds?.length||0,
        });
        setSaveErr(true);
        setLoading(false);
        return;
      }

      if(status==="orphaned"){
        const blank = normaliseLoadedData(null);
        lastSyncedFingerprint.current = dataFingerprint(blank);
        setData(blank);
        setLoadIssue({kind:"orphaned",orphanedCount:result.noteDocIds?.length||0});
        setSaveErr(true);
        setLoading(false);
        return;
      }

      let hasLocalDraft=false;
      try{
        const pending=localStorage.getItem(pendingSaveKey);
        if(pending){
          const {data:localData}=JSON.parse(pending);
          hasLocalDraft=!!localData;
        }
      }catch(e){}
      const blank = normaliseLoadedData(null);
      lastSyncedFingerprint.current = dataFingerprint(blank);
      setData(blank);
      setLoadIssue({kind:"error",hasLocalDraft});
      setSaveErr(true);
      setLoading(false);
    }).catch(err=>{
      if(cancelled) return;
      console.error("Failed to load data:",err);
      const blank = normaliseLoadedData(null);
      lastSyncedFingerprint.current = dataFingerprint(blank);
      setData(blank);
      setLoadIssue({kind:"error",hasLocalDraft:false});
      setSaveErr(true);
      setLoading(false);
    });

    return ()=>{ cancelled = true; };
  },[user.uid,loadAttempt,normaliseLoadedData,pendingSaveKey]);
  const refreshCloudState = React.useCallback(async () => {
    try {
      const [latestInstitutes, latestSections] = await Promise.all([
        getGlobalInstitutes(),
        getAllInstituteSections(),
      ]);
      const nextInstitutes = latestInstitutes || [];
      const nextSections = latestSections || {};
      setGlobalInstitutes(prev => JSON.stringify(prev) === JSON.stringify(nextInstitutes) ? prev : nextInstitutes);
      setInstituteSections(prev => JSON.stringify(prev) === JSON.stringify(nextSections) ? prev : nextSections);

      if (loading || !allowCloudSync) return;
      if (dataFingerprint(data) !== lastSyncedFingerprint.current) return;

      const result = await loadUserDataState(user.uid);
      if (result?.status !== "ok") return;

      const liveData = normaliseLoadedData(result.data);
      const liveRevision = Number(liveData?._meta?.revision || 0);
      if (liveRevision <= cloudRevision) return;

      lastSyncedFingerprint.current = dataFingerprint(liveData);
      setCloudRevision(liveRevision);
      setData(liveData);
    } catch {}
  }, [allowCloudSync, cloudRevision, data, loading, normaliseLoadedData, user.uid]);
  const requestForegroundRefresh = React.useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastForegroundRefreshAt.current < 120000) return;
    lastForegroundRefreshAt.current = now;
    refreshCloudState();
  }, [refreshCloudState]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        requestForegroundRefresh();
      }
    };
    window.addEventListener("focus", requestForegroundRefresh);
    document.addEventListener("visibilitychange", onVisible);
    let appStateHandle = null;
    if (Capacitor.isNativePlatform()) {
      appStateHandle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) requestForegroundRefresh();
      });
    }
    return () => {
      window.removeEventListener("focus", requestForegroundRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      appStateHandle?.then?.(listener => listener.remove()).catch?.(()=>{});
    };
  }, [requestForegroundRefresh]);
  useEffect(()=>{
    if(loading||!allowCloudSync)return;
    const nextFingerprint = dataFingerprint(data);
    if(nextFingerprint===lastSyncedFingerprint.current) return;
    setSaving(true);setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      saveUserData(user.uid,data,{ expectedRevision: cloudRevision, source:"autosave" })
        .then(result=>{
          setCloudRevision(result?.revision || cloudRevision);
          lastSyncedFingerprint.current = nextFingerprint;
          setSaving(false);
          setSaveErr(false);
          setLastCloudSavedAt(Date.now());
          // Clear any pending offline save since we saved successfully
          try{localStorage.removeItem("classlog_pending_"+user.uid);}catch(e){}
        })
        .catch(err=>{
          setSaving(false);
          setSaveErr(true);
          if(err?.code==="revision-conflict"){
            storePendingDraft(data,"conflict");
            setAllowCloudSync(false);
            setLoadIssue({
              kind:"conflict",
              hasLocalDraft:true,
              updatedAt:err.updatedAt||0,
              actualRevision:err.actualRevision||0,
            });
            return;
          }
          // Store to localStorage so data survives offline
          storePendingDraft(data,isOffline?"offline":"save-failed");
        });
    },650);
    return()=>clearTimeout(saveTimer.current);
  },[data,loading,allowCloudSync,user.uid,pendingSaveKey,cloudRevision,storePendingDraft,isOffline]);
  // Safe navigation — background autosave continues without blocking navigation
  // ── Browser history integration — enables Android back gesture ──────────────
  // On mount: seed the base history entry so back never exits the app accidentally
  useEffect(() => {
    teacherHistoryTokenRef.current = 1;
    window.history.replaceState({ view: "home", navToken: 0 }, "", buildTeacherHistoryUrl("home", 0));
    // Push a sentinel so the first back press lands on "home" state, not empty
    window.history.pushState({ view: "home", navToken: 1 }, "", buildTeacherHistoryUrl("home", 1));
  }, [buildTeacherHistoryUrl]);

  // Wrap raw setter: every navigation pushes a history entry
  const setView = React.useCallback((nextView) => {
    _setView(prev => {
      if (prev === nextView) return prev;
      const nextToken = teacherHistoryTokenRef.current + 1;
      teacherHistoryTokenRef.current = nextToken;
      window.history.pushState({ view: nextView, navToken: nextToken }, "", buildTeacherHistoryUrl(nextView, nextToken));
      return nextView;
    });
  }, [buildTeacherHistoryUrl]);

  // Listen for back gesture — just read the state, no extra pushing
  useEffect(() => {
    const onPop = (e) => {
      const target = sanitizeTeacherView(e.state?.view || getTeacherHashView());
      // addNote/editNote have no meaningful back target in history — go to classDetail
      if (target === "addNote" || target === "editNote") {
        _setView("classDetail");
      } else {
        _setView(target);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [getTeacherHashView]);

  function safeNav(destination, action){
    action ? action() : setView(destination);
  }
  function openStatsView(origin = "home"){
    const backTarget = origin === "profile" ? "profile" : "home";
    safeNav("stats", () => {
      setTeacherBackView(backTarget);
      setStatsClassId(null);
      setStatsInstituteName("");
      setView("stats");
    });
  }
  function openStatsClassTimeline(classId){
    if(!classId) return;
    safeNav("classTimeline", () => {
      setStatsClassId(classId);
      setView("classTimeline");
    });
  }
  const closeTeacherOverlay = React.useCallback(() => {
    if(mobileClassSheetId){ setMobileClassSheetId(null); return true; }
    if(historyClassId){ setHistoryClassId(null); return true; }
    if(exportOpen){ setExportOpen(false); return true; }
    if(signOutPrompt){ setSignOutPrompt(false); return true; }
    if(confirmModal){ setConfirmModal(null); return true; }
    if(leaveModal){ setLeaveModal(null); return true; }
    if(teacherNoticePrompt){ setTeacherNoticePrompt(null); return true; }
    return false;
  }, [confirmModal, exportOpen, historyClassId, leaveModal, mobileClassSheetId, signOutPrompt, teacherNoticePrompt]);
  useEffect(() => {
    if(!Capacitor.isNativePlatform()) return undefined;
    const listenerPromise = CapacitorApp.addListener("backButton", () => {
      if(closeTeacherOverlay()) return;
      if(view !== "home"){
        window.history.back();
        return;
      }
      CapacitorApp.exitApp();
    });
    return () => {
      Promise.resolve(listenerPromise).then(handle => handle?.remove?.()).catch(()=>{});
    };
  }, [closeTeacherOverlay, view]);

  const triggerAppHaptic = React.useCallback(async (kind="light") => {
    try{
      if(Capacitor.isNativePlatform()){
        if(kind === "entry"){
          await Haptics.notification({ type: NotificationType.Success });
          return true;
        }
        const style = kind === "hold" ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
        return true;
      }
      if(!isMobile || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
      const pattern = kind==="entry" ? [14, 24, 18] : kind==="hold" ? [16] : kind==="swipe" ? [10] : [12];
      return navigator.vibrate(pattern);
    }catch{
      return false;
    }
  }, [isMobile]);

  const commitDetailSwipeOffset = React.useCallback((nextOffset, immediate = true) => {
    detailSwipeOffsetValueRef.current = nextOffset;
    if(detailSwipeOffsetRaf.current){
      window.cancelAnimationFrame(detailSwipeOffsetRaf.current);
      detailSwipeOffsetRaf.current = 0;
    }
    if(immediate){
      setDetailSwipeOffset(nextOffset);
      return;
    }
    detailSwipeOffsetRaf.current = window.requestAnimationFrame(() => {
      detailSwipeOffsetRaf.current = 0;
      setDetailSwipeOffset(detailSwipeOffsetValueRef.current);
    });
  }, []);

  function showInlineToast(msg){
    setInlineToast(msg);
    clearTimeout(inlineToastTimer.current);
    inlineToastTimer.current=setTimeout(()=>setInlineToast(null),3000);
  }

  function dismissLocalTeacherNotice(signature = currentTeacherLocalNoticeSignature){
    const nextSignature = String(signature || "");
    if(!nextSignature) return;
    setDismissedTeacherLocalNoticeSignature(nextSignature);
    try{
      localStorage.setItem(localTeacherNoticeDismissKey, nextSignature);
    }catch(e){}
  }

  function dismissAdminNotices(ids){
    const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || "")).filter(Boolean));
    if(!idSet.size) return;
    setData(d=>({
      ...d,
      _meta: {
        ...(d._meta || {}),
        pendingAdminClassNotices: (Array.isArray(d?._meta?.pendingAdminClassNotices) ? d._meta.pendingAdminClassNotices : [])
          .filter(item => !idSet.has(String(item?.id || ""))),
      },
    }));
  }

  function dismissAllAdminNotices(){
    if(localTeacherNotice){
      dismissLocalTeacherNotice(currentTeacherLocalNoticeSignature);
    }
    setData(d=>({
      ...d,
      _meta: {
        ...(d._meta || {}),
        pendingAdminClassNotices: [],
      },
    }));
  }

  function closeTeacherNoticePrompt(){
    const ids = (teacherNoticePrompt?.items || []).map(item => item?.id).filter(Boolean);
    if(ids.length) markAdminNoticesPrompted(ids);
    setTeacherNoticePrompt(null);
  }

  function openTeacherNotificationPanel(){
    const ids = (teacherNoticePrompt?.items || []).map(item => item?.id).filter(Boolean);
    if(ids.length) markAdminNoticesPrompted(ids);
    setTeacherNoticePrompt(null);
    safeNav("notifications");
  }

  function openAdminNoticeClass(item, { history = false } = {}){
    const cls = (data.classes || []).find(entry => String(entry?.id || "") === String(item?.classId || ""));
    if(!cls){
      showInlineToast("This class is not active right now. Check the recycle bin.");
      return;
    }
    setActiveClass(cls);
    setSelectedDate(item?.lastDateKey || todayKey());
    if(history && item?.entryCount > 0){
      setHistoryClassId(cls.id);
      safeNav(isMobile ? "classDetail" : "home");
      return;
    }
    safeNav(isMobile ? "classDetail" : "home");
  }

  const retryCloudLoad = React.useCallback(()=>{
    setRestoringBackup(false);
    setLoadIssue(null);
    setDataWarning(null);
    setAllowCloudSync(false);
    setLoading(true);
    setLoadAttempt(n=>n+1);
  },[]);

  const restoreBackup = async () => {
    if(loadIssue?.kind!=="backup") return;
    setRestoringBackup(true);
    setSaveErr(false);
    try{
      const restored = await saveUserData(user.uid,data,{ expectedRevision: 0, source:"restoreBackup" });
      try{localStorage.removeItem(pendingSaveKey);}catch(e){}
      setCloudRevision(restored?.revision || 0);
      lastSyncedFingerprint.current = dataFingerprint(data);
      setLastCloudSavedAt(Date.now());
      setRestoringBackup(false);
      setLoadIssue(null);
      setDataWarning(null);
      setAllowCloudSync(false);
      setLoading(true);
      setLoadAttempt(n=>n+1);
    }catch(err){
      console.error("Failed to restore class backup:",err);
      setRestoringBackup(false);
      setSaveErr(true);
      showInlineToast("Backup restore failed. Please retry.");
    }
  };

  useEffect(()=>{if((view==="addNote"||view==="editNote")&&noteRef.current)noteRef.current.blur();},[view]);

  useEffect(()=>{
    const goOffline=()=>setIsOffline(true);
    const goOnline=()=>{
      setIsOffline(false);
      if(saveErr&&allowCloudSync){
        const nextFingerprint = dataFingerprint(data);
        if(nextFingerprint===lastSyncedFingerprint.current){
          setSaveErr(false);
          return;
        }
        setSaving(true);
        saveUserData(user.uid,data,{ expectedRevision: cloudRevision, source:"online-retry" })
          .then(result=>{
            setCloudRevision(result?.revision || cloudRevision);
            lastSyncedFingerprint.current = nextFingerprint;
            setSaving(false);
            setSaveErr(false);
            setLastCloudSavedAt(Date.now());
            try{localStorage.removeItem(pendingSaveKey);}catch(e){}
            showInlineToast("Back online — changes saved successfully");
          })
          .catch(err=>{
            setSaving(false);
            setSaveErr(true);
            if(err?.code==="revision-conflict"){
              storePendingDraft(data,"conflict");
              setAllowCloudSync(false);
              setLoadIssue({
                kind:"conflict",
                hasLocalDraft:true,
                updatedAt:err.updatedAt||0,
                actualRevision:err.actualRevision||0,
              });
              return;
            }
            storePendingDraft(data,"online-retry");
          });
      }
    };
    window.addEventListener("offline",goOffline);
    window.addEventListener("online",goOnline);
    return()=>{
      window.removeEventListener("offline",goOffline);
      window.removeEventListener("online",goOnline);
    };
  },[saveErr,data,user.uid,allowCloudSync,pendingSaveKey,cloudRevision,storePendingDraft]);
  useEffect(()=>{
    if(view==="home") setMobileClassLimit(mobileBatchSize);
  },[instFilter, view, data.classes.length, mobileBatchSize]);

  // ── Must be before any conditional returns (Rules of Hooks) ─────────────────
  useEffect(()=>{
    if(loading || !Object.keys(instituteSections).length) return;
    const legacyPrompt = data?._meta?.pendingSectionChangeNotice;
    const legacyPromptItems = Array.isArray(legacyPrompt?.items)
      ? legacyPrompt.items.map(item => normaliseSectionRenameNotice(item))
      : [];
    const legacyEventIds = Array.isArray(legacyPrompt?.eventIds)
      ? legacyPrompt.eventIds.map(id => String(id || "")).filter(Boolean)
      : [];
    const persisted = Array.isArray(data?._meta?.seenSectionChangeEvents) ? data._meta.seenSectionChangeEvents : [];
    const seenIds = [...persisted, ...sectionChangeSessionSeenRef.current];
    const result = buildSectionChangeApplication(data.classes || [], instituteSections, seenIds);
    if(!legacyPromptItems.length && !result.appliedAny && !result.notices.length) return;
    const mergedEventIds = [...new Set([
      ...legacyEventIds,
      ...(result.eventIds || []).map(id => String(id || "")).filter(Boolean),
    ])];
    mergedEventIds.forEach(id=>sectionChangeSessionSeenRef.current.add(String(id || "")));
    setData(d=>{
      const existingSeen = Array.isArray(d?._meta?.seenSectionChangeEvents) ? d._meta.seenSectionChangeEvents : [];
      const existingNotices = Array.isArray(d?._meta?.pendingAdminClassNotices) ? d._meta.pendingAdminClassNotices : [];
      return {
        ...d,
        classes: result.appliedAny ? result.updatedClasses : d.classes,
        _meta: {
          ...(d._meta || {}),
          seenSectionChangeEvents: [...new Set([...existingSeen, ...mergedEventIds])],
          pendingAdminClassNotices: legacyPromptItems.length || result.notices.length
            ? mergePendingAdminNoticeItems(existingNotices, [...legacyPromptItems, ...result.notices])
            : existingNotices,
          pendingSectionChangeNotice: null,
        },
      };
    });
  },[loading, instituteSections, data.classes, data?._meta?.seenSectionChangeEvents, data?._meta?.pendingSectionChangeNotice]);

  useEffect(()=>{
    if(view!=="notifications" || !adminPromptNoticeItems.length) return;
    markAdminNoticesPrompted(adminPromptNoticeItems.map(item => item.id));
    setTeacherNoticePrompt(null);
  },[view, adminPromptNoticeItems, markAdminNoticesPrompted]);

  useEffect(()=>{
    if(loading || view==="notifications" || teacherNoticePrompt || !adminPromptNoticeItems.length) return;
    setTeacherNoticePrompt({ items: adminPromptNoticeItems });
  },[loading, view, teacherNoticePrompt, adminPromptNoticeItems]);

  const allNoteDates = useMemo(()=>{
    const map={};
    try {
      data.classes.forEach(cls=>{
        const cn=data.notes[cls.id]||{};
        Object.entries(cn).forEach(([dk,arr])=>{
          if(Array.isArray(arr)&&arr.length>0) map[dk]=(map[dk]||0)+arr.length;
        });
      });
    } catch(e){}
    return map;
  },[data]);

  const classInsights = useMemo(()=>{
    const map={};
    (data.classes||[]).forEach(cls=>{
      const classNotes=data.notes?.[cls.id]||{};
      const recentEntries=Object.entries(classNotes)
        .sort(([a],[b])=>b.localeCompare(a))
        .flatMap(([,entries])=>Array.isArray(entries)?[...entries].sort((a,b)=>(b.created||0)-(a.created||0)):[]);
      const lastTitled=recentEntries.find(entry=>(entry?.title||"").trim());
      map[cls.id]={
        lastTopic:lastTitled?.title?.trim()||"",
        lastEntryAt:recentEntries[0]?.created||0,
      };
    });
    return map;
  },[data.classes,data.notes]);

  const preferredInstitute = useMemo(()=>{
    const usage={};
    (data.classes||[]).forEach(cls=>{
      const inst=(cls.institute||"").trim();
      if(!inst||cls.left) return;
      if(!usage[inst]) usage[inst]={count:0,lastUsed:0};
      usage[inst].count += 1;
      usage[inst].lastUsed = Math.max(usage[inst].lastUsed, cls.created||0);
    });
    const ranked=Object.entries(usage).sort((a,b)=>b[1].count-a[1].count||b[1].lastUsed-a[1].lastUsed);
    if(ranked[0]?.[0]) return ranked[0][0];
    if((data.institutes||[]).length===1) return data.institutes[0];
    return "";
  },[data.classes,data.institutes]);

  const recentClassCombos = useMemo(()=>{
    const seen=new Set();
    return [...(data.classes||[])]
      .filter(cls=>!cls.left&&(cls.institute||cls.section||cls.subject))
      .sort((a,b)=>(b.created||0)-(a.created||0))
      .filter(cls=>{
        const key=[cls.institute||"",cls.section||"",cls.subject||""].join("|").toLowerCase();
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(cls=>({
        institute:cls.institute||"",
        section:cls.section||"",
        subject:cls.subject||"",
        created:cls.created||0,
      }));
  },[data.classes]);
  const teacherMemberSinceLabel = useMemo(() => {
    const authCreated = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
    const firstClassCreated = [...(data.classes || [])]
      .map(cls => Number(cls?.created || 0))
      .filter(Boolean)
      .sort((a,b)=>a-b)[0];
    const fallbackCreated = firstClassCreated ? new Date(firstClassCreated) : null;
    const source = authCreated && !Number.isNaN(authCreated.getTime()) ? authCreated : fallbackCreated;
    if(!source || Number.isNaN(source.getTime())) return "";
    return source.toLocaleDateString("en-IN", { month:"long", year:"numeric" });
  }, [data.classes, user?.metadata?.creationTime]);
  const resolvedView = useMemo(
    () => resolveTeacherView(view, { activeClass, editNote, statsClassId }),
    [view, activeClass, editNote, statsClassId]
  );

  useEffect(() => {
    if(view === resolvedView || typeof window === "undefined") return;
    _setView(resolvedView);
    const existingState = window.history.state || {};
    const navToken = Number(existingState?.navToken ?? teacherHistoryTokenRef.current ?? 0) || 0;
    teacherHistoryTokenRef.current = Math.max(teacherHistoryTokenRef.current, navToken);
    window.history.replaceState(
      { ...existingState, view: resolvedView, navToken },
      "",
      buildTeacherHistoryUrl(resolvedView, navToken)
    );
  }, [view, resolvedView, buildTeacherHistoryUrl]);

  useEffect(()=>{
    if(view!=="addClass") return;
    setNewClass(curr=>{
      if(curr.institute||curr.section||curr.subject||!preferredInstitute) return curr;
      return {...curr,institute:preferredInstitute};
    });
  },[view,preferredInstitute]);

  useEffect(()=>{
    if(view==="editNote"){ setShowNoteDetails(true); return; }
    if(view==="addNote") setShowNoteDetails(false);
  },[view,activeClass?.id,selectedDate]);

  if(loading)return<TeacherLoadingScreen themeShell={teacherThemeShell} text={restoringBackup?"Restoring class list…":"Loading teacher panel…"} />;
  if(loadIssue){
    return(
      <div style={teacherThemeShell}>
        <DataIntegrityScreen
          issue={loadIssue}
          restoring={restoringBackup}
          onRetry={retryCloudLoad}
          onRestore={restoreBackup}
          onSignOut={()=>logout()}
        />
      </div>
    );
  }
  if(!hasCompleteProfile(data.profile))return(
    <div style={teacherThemeShell}>
      <ProfileSetup
        user={user}
        initialProfile={data.profile}
        subjectSuggestions={data.subjects}
        instituteSuggestions={globalInstitutes}
        onSave={profile=>{
          const nextProfile = normaliseProfile(profile);
          setData(d=>({
            ...d,
            profile: nextProfile,
            subjects: mergeChoiceValues(d.subjects, nextProfile.subjects),
            institutes: mergeChoiceValues((d.classes || []).map(cls => cls.institute), nextProfile.institutes),
          }));
        }}
      />
    </div>
  );
  if(view !== resolvedView)return<TeacherLoadingScreen themeShell={teacherThemeShell} text="Restoring teacher workspace…" />;

  const teacherName=data.profile.name;
  const trashCount=(data.trash?.classes||[]).length+(data.trash?.notes||[]).length;

  const SaveBadge=()=>{
    const isOfflineSave=saveErr&&isOffline;
    let badge = null;
    if(saveErr){
      badge = isOfflineSave
        ? {
            title:"Offline",
            icon:IconDeviceFloppy,
            background:"#FFF7ED",
            border:"#FED7AA",
            color:"#B45309",
          }
        : {
            title:"Sync issue",
            icon:IconAlertTriangle,
            background:"#FEF2F2",
            border:"#FECACA",
            color:G.red,
          };
    } else if(saving || draftSaving){
      badge = {
        title:saving ? "Saving..." : "Saving draft...",
        icon:saving ? IconRefresh : IconDeviceFloppy,
        background:"#EEF4FF",
        border:"#C7D7F5",
        color:G.blue,
      };
    } else if(saveBadgeFlash){
      badge = {
        title:saveBadgeFlash.label,
        icon:saveBadgeFlash.tone === "draft" ? IconDeviceFloppy : IconCheck,
        background:saveBadgeFlash.tone === "draft" ? "#F8FAFC" : "#EFFCF4",
        border:saveBadgeFlash.tone === "draft" ? G.border : "#BBF7D0",
        color:saveBadgeFlash.tone === "draft" ? G.textS : G.green,
      };
    }
    if(!badge) return null;
    return(
      <div style={{
        position:"fixed",
        top:74,
        right:14,
        zIndex:999,
        display:"flex",
        alignItems:"center",
        gap:8,
        background:badge.background,
        border:`1px solid ${badge.border}`,
        borderRadius:999,
        padding:"6px 10px",
        boxShadow:G.shadowMd,
        maxWidth:"calc(100vw - 28px)",
        pointerEvents:"none",
      }}>
        <div style={{width:24,height:24,borderRadius:999,background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AppIcon icon={badge.icon} size={13.5} color={badge.color} />
        </div>
        <div style={{minWidth:0,fontSize:12.5,fontWeight:800,color:badge.color,fontFamily:G.sans,lineHeight:1.1,whiteSpace:"nowrap"}}>
          {badge.title}
        </div>
      </div>
    );
  };

  const sortedByUsage=(opts,field)=>{
    const c={};
    (data.classes||[]).forEach(cl=>{if(cl[field])c[cl[field]]=(c[cl[field]]||0)+1;});
    const base=[...(opts||[])].sort((a,b)=>(c[b]||0)-(c[a]||0));
    if(field==="institute"){
      // Return globalInstitutes if available (admin-controlled), fallback to local
      if(globalInstitutes.length>0) return globalInstitutes;
    }
    return base;
  };
  const addSubjectName  =(s)=>setData(d=>({...d,subjects:mergeChoiceValues(d.subjects || [], [s])}));
  const addInstituteName=(s)=>setData(d=>({...d,institutes:mergeChoiceValues(d.institutes || [], [s])}));
  const addSectionName  =(s)=>setData(d=>({...d,sections:mergeChoiceValues(d.sections || [], [s])}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim())return;
    const id=Date.now().toString();
    const createdAt=Date.now();
    setData(d=>{
      const inst=newClass.institute.trim(),sec=newClass.section.trim(),subj=newClass.subject.trim();
      return{
        ...d,
        classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,created:createdAt}],
        notes:{...d.notes,[id]:{}},
        institutes:mergeChoiceValues(d.institutes || [], [inst]),
        sections:mergeChoiceValues(d.sections || [], [sec]),
        subjects:subj ? mergeChoiceValues(d.subjects || [], [subj]) : (d.subjects || [])
      };
    });
    setNewClass({institute:"",section:"",subject:""});setSelectedGroup(null);setView("home");
  };
  const deleteClass=(id,leaveReason,leaveReasonLabel)=>{setData(d=>{const cls=d.classes.find(c=>c.id===id);if(!cls)return d;const tc={...cls,deletedAt:Date.now(),savedNotes:d.notes[id]||{},leaveReason:leaveReason||"",leaveReasonLabel:leaveReasonLabel||""};const pending=Array.isArray(d?._meta?.pendingAdminClassNotices)?d._meta.pendingAdminClassNotices:[];return{...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id)),trash:{...d.trash,classes:[...(d.trash?.classes||[]),tc]},_meta:{...(d._meta||{}),pendingAdminClassNotices:pending.filter(item=>String(item?.classId||"")!==String(id||""))}};});if(activeClass?.id===id){setActiveClass(null);setView("home");}};
  const updateClass=(id,updates)=>{
    setData(d=>{
      const inst=(updates.institute||"").trim();
      const sec=(updates.section||"").trim();
      const subj=(updates.subject||"").trim();
      return{
        ...d,
        classes:d.classes.map(c=>c.id===id?{...c,...updates}:c),
        institutes:inst ? mergeChoiceValues(d.institutes || [], [inst]) : (d.institutes || []),
        sections:sec ? mergeChoiceValues(d.sections || [], [sec]) : (d.sections || []),
        subjects:subj ? mergeChoiceValues(d.subjects || [], [subj]) : (d.subjects || []),
      };
    });
    if(activeClass?.id===id)setActiveClass(ac=>({...ac,...updates}));
    setEditingClass(null);
  };
  const restoreClass=(tc)=>{
    setData(d=>{
      const { deletedAt, savedNotes, ...cls } = tc;
      const pending = Array.isArray(d?._meta?.pendingAdminClassNotices) ? d._meta.pendingAdminClassNotices : [];
      return {
        ...d,
        classes:[...d.classes,cls],
        notes:{...d.notes,[cls.id]:savedNotes||{}},
        trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==cls.id)},
        _meta:{
          ...(d._meta||{}),
          pendingAdminClassNotices: pending.filter(item => String(item?.classId || "") !== String(cls.id || "")),
        },
      };
    });
  };
  const permDeleteClass=(id)=>{
    deleteClassNotes(user.uid,id).catch(()=>{});
    setData(d=>{
      const pending = Array.isArray(d?._meta?.pendingAdminClassNotices) ? d._meta.pendingAdminClassNotices : [];
      return {
        ...d,
        trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==id)},
        _meta:{
          ...(d._meta||{}),
          pendingAdminClassNotices: pending.filter(item => String(item?.classId || "") !== String(id || "")),
        },
      };
    });
  };

  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>{ const arr=(data.notes[cid]||{})[dk]; return Array.isArray(arr)?arr:[]; };
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));

  const addNote=()=>{
    if(!newNote.timeStart){showInlineToast("Please enter a start time before saving.");return;}

    // Duplicate check — same class, same date, overlapping or identical time
    const existing=(data.notes?.[activeClass.id]||{})[selectedDate]||[];
    if(newNote.timeStart){
      const newStart=newNote.timeStart;
      const clash=existing.find(e=>{
        if(!e.timeStart)return false;
        // Exact same start time = definite duplicate
        if(e.timeStart===newStart)return true;
        // Overlapping times check
        if(newNote.timeEnd&&e.timeEnd){
          const toMins=t=>{const[h,m]=t.split(":").map(Number);return h*60+m;};
          const ns=toMins(newStart),ne=toMins(newNote.timeEnd);
          const es=toMins(e.timeStart),ee=toMins(e.timeEnd);
          return ns<ee&&ne>es; // overlap
        }
        return false;
      });
      if(clash){
        showInlineToast(`Entry at ${clash.timeStart} already exists for this class on this date`);
        return;
      }
    }

    const note={id:Date.now().toString(),...newNote,status:newNote.status||"",teacherName,created:Date.now()};
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}};});
    void triggerAppHaptic("entry");
    clearEntryDraft();
    setDraftSaving(false);
    setShowNoteDetails(false);
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",status:""});setView("classDetail");
  };
  const saveEdit=()=>{
    if(!editNote.timeStart){showInlineToast("Please enter a start time before saving.");return;}
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}};});
    clearEntryDraft();
    setDraftSaving(false);
    setShowNoteDetails(false);
    setEditNote(null);setView("classDetail");
  };
  const deleteNote=(noteId)=>setData(d=>{
    const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];
    const note=dn.find(n=>n.id===noteId);if(!note)return d;
    const tn={...note,classId:activeClass.id,className:activeClass.section,institute:activeClass.institute,dateKey:selectedDate,deletedAt:Date.now()};
    return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}},trash:{...d.trash,notes:[...(d.trash?.notes||[]),tn]}};
  });
  const restoreNote=(tn)=>{setData(d=>{const{classId,dateKey,deletedAt,className,institute,...note}=tn;const cn=d.notes[classId]||{};const dn=cn[dateKey]||[];return{...d,notes:{...d.notes,[classId]:{...cn,[dateKey]:[note,...dn]}},trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==note.id)}};});};
  const permDeleteNote=(id)=>setData(d=>({...d,trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==id)}}));

  const totalNotes=data.classes.reduce((s,c)=>{const cn=data.notes[c.id]||{};return s+Object.values(cn).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);},0);
  const canAdd=isDateAllowed(selectedDate);
  const isReadOnlyDate=!canAdd;
  const dates=buildDateWindow();
  const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];
  const getClassUrgencyMeta = (cls) => classInsights[cls?.id] || { lastTopic:"", lastEntryAt:0 };

  // Build a noteDates map across ALL classes for the date strip dots
  // ── SINGLE SCROLLABLE HOME ───────────────────────────────────────────────
  // ── HOME VIEW — class list with institute filter ────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  // SHARED MODALS — used in both pages
  // ══════════════════════════════════════════════════════════════════════
  const motionStyles = reduceEffects ? `
    .ledgr-page,.ledgr-card,.ledgr-sheet,.ledgr-pressable{animation:none!important;transition:none!important;}
  ` : `
    @keyframes ledgrPageRise{
      0%{opacity:0;transform:translateY(14px) scale(0.992);}
      100%{opacity:1;transform:translateY(0) scale(1);}
    }
    @keyframes ledgrCardRise{
      0%{opacity:0;transform:translateY(10px);}
      100%{opacity:1;transform:translateY(0);}
    }
    @keyframes ledgrSheetRise{
      0%{opacity:0;transform:translateY(24px) scale(0.985);}
      100%{opacity:1;transform:translateY(0) scale(1);}
    }
    @keyframes ledgrStripePulse{
      0%,100%{opacity:0.92;box-shadow:0 0 0 rgba(245,158,11,0);}
      50%{opacity:0.5;box-shadow:0 0 18px rgba(245,158,11,0.18);}
    }
    .ledgr-page{
      animation:ledgrPageRise .30s cubic-bezier(.22,.8,.24,1) both;
    }
    .ledgr-card{
      animation:ledgrCardRise .34s cubic-bezier(.22,.8,.24,1) both;
      transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease, opacity .22s ease;
      will-change:transform, opacity;
    }
    .ledgr-sheet{
      animation:ledgrSheetRise .24s cubic-bezier(.22,.8,.24,1) both;
    }
    .ledgr-pressable{
      transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease, opacity .18s ease;
      will-change:transform;
    }
    .ledgr-pressable:active{
      transform:translateY(1px) scale(0.992);
    }
  `;
  const sharedModals = (
    <>
      <style>{motionStyles}</style>
      <SaveBadge/>
      {/* Offline banner */}
      {isOffline&&(
        <div style={{position:"fixed",top:68,left:"50%",transform:"translateX(-50%)",zIndex:9998,background:"rgba(180,83,9,0.96)",color:"#fff",textAlign:"center",padding:"9px 14px",fontSize:12.5,fontWeight:700,fontFamily:G.sans,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,borderRadius:999,border:"1px solid rgba(255,255,255,0.16)",boxShadow:"0 10px 24px rgba(146,64,14,0.28)",maxWidth:"calc(100vw - 28px)"}}>
          <span style={{fontSize:13}}>📡</span>
          <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Offline now. Changes stay local until you reconnect.</span>
        </div>
      )}
      {dataWarning?.kind==="staleDraft"&&(
        <div style={{position:"fixed",top:isOffline?118:58,left:0,right:0,zIndex:9997,background:dataWarning.kind==="staleDraft"?"#7C2D12":"#92400E",color:"#fff",textAlign:"center",padding:"8px 16px",fontSize:13,fontWeight:600,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {dataWarning.kind==="staleDraft"
            ? <><span>🗂</span> We found an older unsynced browser draft from {fmtRecoveryStamp(dataWarning.savedAt)}. The latest cloud classes are showing so nothing newer gets overwritten.</>
            : <><span>🧩</span> We found {dataWarning.count} unattached class note file{dataWarning.count===1?"":"s"}. If anything looks missing, do not create duplicate classes — contact admin first.</>}
        </div>
      )}
      {teacherNoticePrompt?.items?.length > 0 && (
        <TeacherNotificationPromptModal
          items={teacherNoticePrompt.items}
          onClose={closeTeacherNoticePrompt}
          onOpenNotifications={openTeacherNotificationPanel}
        />
      )}
      {/* In-app toast — replaces alert() */}
      {inlineToast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(21,43,34,0.95)",color:"#fff",borderRadius:20,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:G.sans,whiteSpace:"nowrap",zIndex:9999,pointerEvents:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          {inlineToast}
        </div>
      )}
      {confirmModal && <ConfirmModal message={confirmModal.message} confirmLabel={confirmModal.label||"Delete"} onConfirm={confirmModal.onConfirm} onClose={()=>setConfirmModal(null)}/>}
      {signOutPrompt && <SignOutModal onConfirm={()=>{setSignOutPrompt(false);logout();}} onClose={()=>setSignOutPrompt(false)}/>}
      {exportOpen && <ExportModal data={data} teacherName={teacherName} onClose={()=>setExportOpen(false)}/>}
      {historyClassId && (()=>{const cls=data.classes.find(c=>c.id===historyClassId);return cls?<HistoryModal cls={cls} classNotes={data.notes[historyClassId]||{}} selectedDate={selectedDate} onSelectDate={setSelectedDate} onClose={()=>setHistoryClassId(null)}/>:null;})()}
      {mobileClassSheetId && (()=>{const cls=data.classes.find(c=>c.id===mobileClassSheetId);const entryCount=cls?Object.values(data.notes?.[mobileClassSheetId]||{}).reduce((sum,arr)=>sum+(Array.isArray(arr)?arr.length:0),0):0;return cls?<TeacherClassQuickSheet cls={cls} entryCount={entryCount} onOpenHistory={()=>{setMobileClassSheetId(null);setHistoryClassId(cls.id);}} onDelete={()=>{setMobileClassSheetId(null);setLeaveModal(cls.id);}} onClose={()=>setMobileClassSheetId(null)}/>:null;})()}
      {editingClass && <EditClassModal cls={editingClass} data={data} onSave={u=>updateClass(editingClass.id,u)} onClose={()=>setEditingClass(null)} sortedByUsage={sortedByUsage} globalInstitutes={globalInstitutes} instituteSections={instituteSections} addSectionName={addSectionName} addSubjectName={addSubjectName}/>}
      {leaveModal && (()=>{const cls=data.classes.find(c=>c.id===leaveModal);return cls?<LeaveClassModal cls={cls} onConfirm={(reason,label)=>{deleteClass(leaveModal,reason,label);setLeaveModal(null);setActiveClass(null);setView("home");}} onClose={()=>setLeaveModal(null)}/>:null;})()}
    </>
  );

  if(view==="notifications"){
    const hasTrashLinkedNotice = adminNoticeItems.some(item => item.status === "trash");
    const renamedNoticeCount = adminNoticeItems.filter(item => item.kind === "section_renamed" || item.kind === "institute_renamed").length;
    const instituteActionCount = adminNoticeItems.filter(item => item.kind === "institute_deleted" || item.kind === "institute_deleted_migrated").length;
    const deletedNoticeCount = adminNoticeItems.filter(item => item.kind === "class_deleted").length;
    const restoredNoticeCount = adminNoticeItems.filter(item => item.kind === "class_restored").length;
    return(
      <div className="ledgr-page" style={{...teacherThemeShell,minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.pageBg,fontFamily:G.sans}}>
        {sharedModals}
        <TopNav
          user={user}
          teacherName={teacherName}
          data={data}
          onLogoClick={()=>safeNav("home")}
          onSignOut={()=>setSignOutPrompt(true)}
          onViewStats={()=>openStatsView("profile")}
          onViewTrash={()=>safeNav("trash")}
          onViewNotifications={()=>safeNav("notifications")}
          trashCount={trashCount}
          notificationCount={notificationCount}
          showProfileMenu={!isMobile}
          right={<GhostBtn onClick={()=>safeNav(mobileBackTarget)} style={{display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Back</GhostBtn>}
        />
        <div style={{maxWidth:960,margin:"0 auto",padding:`28px 16px ${isMobile ? mobileBottomNavPad : "72px"}`}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:22}}>
            <div>
              <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,marginBottom:8}}>Teacher notifications</div>
              <h2 style={{fontSize:30,fontFamily:G.display,letterSpacing:-0.6,color:G.text,marginBottom:6}}>Notification Panel</h2>
              <p style={{fontSize:15,color:G.textM,lineHeight:1.65,maxWidth:640}}>Admin changes and important workspace warnings land here. Review what changed, open the related class or recycle bin if needed, then clear the notice when you are done.</p>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {hasTrashLinkedNotice && <GhostBtn onClick={()=>safeNav("trash")}>Open recycle bin</GhostBtn>}
              <PrimaryBtn onClick={dismissAllAdminNotices} disabled={!notificationCount}>Mark all read</PrimaryBtn>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:12,marginBottom:20}}>
            <div style={{...card,padding:"16px 18px"}}>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:7}}>Unread notices</div>
              <div style={{fontSize:30,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{notificationCount}</div>
            </div>
            <div style={{...card,padding:"16px 18px"}}>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:7}}>Renamed updates</div>
              <div style={{fontSize:30,fontWeight:800,color:"#1D4ED8",fontFamily:G.display,lineHeight:1}}>{renamedNoticeCount}</div>
            </div>
            <div style={{...card,padding:"16px 18px"}}>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:7}}>Bin / restored</div>
              <div style={{fontSize:30,fontWeight:800,color:G.green,fontFamily:G.display,lineHeight:1}}>{deletedNoticeCount + restoredNoticeCount}</div>
            </div>
          </div>

          {teacherNotificationItems.length===0 ? (
            <div style={{...card,padding:"68px 24px",textAlign:"center"}}>
              <div style={{width:62,height:62,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><AppIcon icon={IconBell} size={30} color={G.textM} /></div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:8}}>No new notifications</div>
              <div style={{fontSize:15,color:G.textM,lineHeight:1.65}}>When an admin restores, removes, or renames one of your classes or institutes, or when the app needs your attention, the notice will show here with the related details and actions.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {teacherNotificationItems.map(item=>{
                const copy = getTeacherNoticeCopy(item);
                const isLocalWarning = item.kind==="orphaned_notes";
                const isInstituteRename = item.kind==="institute_renamed";
                const isInstituteDeleted = item.kind==="institute_deleted";
                const isInstituteDeletedMigrated = item.kind==="institute_deleted_migrated";
                const isInstituteAction = isInstituteRename || isInstituteDeleted || isInstituteDeletedMigrated;
                const isTrash=item.status==="trash";
                const isActive=item.status==="active";
                const statusLabel=isLocalWarning?"Needs review":isInstituteDeletedMigrated?"Classes moved":isInstituteDeleted?"Institute removed":isInstituteRename?"Institute updated":isTrash?"In recycle bin":isActive?"Active class":"Unavailable";
                const statusBg=isLocalWarning?"rgba(245,158,11,0.14)":isInstituteDeletedMigrated?"rgba(124,58,237,0.10)":isInstituteDeleted?"rgba(220,38,38,0.10)":isInstituteRename?"rgba(245,158,11,0.14)":isTrash?G.redL:isActive?G.greenL:"rgba(15,23,42,0.05)";
                const statusColor=isLocalWarning?"#B45309":isInstituteDeletedMigrated?"#6D28D9":isInstituteDeleted?"#B91C1C":isInstituteRename?"#B45309":isTrash?G.red:isActive?G.green:G.textM;
                const dismissLabel=isLocalWarning||isInstituteAction||isActive||isTrash?"Mark as read":"Remove notice";
                return(
                  <div key={item.id} style={{...card,padding:isMobile?"16px 16px 14px":"18px 18px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap",marginBottom:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                          <AppIcon icon={copy.icon} size={18} color={copy.badgeColor} />
                          <span style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.2}}>{copy.title}</span>
                          <span style={{fontSize:11,fontWeight:800,fontFamily:G.mono,borderRadius:999,padding:"5px 9px",background:copy.badgeBg,color:copy.badgeColor}}>{copy.badge}</span>
                          <span style={{fontSize:11,fontWeight:800,fontFamily:G.mono,borderRadius:999,padding:"5px 9px",background:statusBg,color:statusColor}}>{statusLabel}</span>
                        </div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
                          <span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textS}}>{item.institute||"No institute"}</span>
                          {!isLocalWarning && !isInstituteAction && item.subject&&<span style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.16)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#1D4ED8"}}>{item.subject}</span>}
                          {isLocalWarning && Number(item.count || 0) > 0 && <span style={{background:"rgba(245,158,11,0.10)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B45309",fontFamily:G.mono}}>{item.count} file{item.count===1?"":"s"} found</span>}
                          {!isLocalWarning && !isInstituteAction && <span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textM,fontFamily:G.mono}}>{item.entryCount} {item.entryCount===1?"entry":"entries"}</span>}
                          {!isLocalWarning && !isInstituteAction && item.activeDays>0&&<span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textM,fontFamily:G.mono}}>{item.activeDays} {item.activeDays===1?"day":"days"}</span>}
                          {isInstituteRename && Number(item.impactedClassCount || 0) > 0 && (
                            <span style={{background:"rgba(245,158,11,0.10)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B45309",fontFamily:G.mono}}>
                              {item.impactedClassCount} {item.impactedClassCount===1?"class":"classes"} updated
                            </span>
                          )}
                          {(isInstituteDeleted||isInstituteDeletedMigrated) && Number(item.impactedClassCount || 0) > 0 && (
                            <span style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B91C1C",fontFamily:G.mono}}>
                              {item.impactedClassCount} {item.impactedClassCount===1?"class":"classes"} affected
                            </span>
                          )}
                        </div>
                        <div style={{fontSize:13,color:G.textM,lineHeight:1.7}}>
                          {copy.summary} {copy.detail}
                        </div>
                        {item.kind==="section_renamed" && item.oldSection && item.newSection && (
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,marginBottom:2}}>
                            <span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textM}}>From {item.oldSection}</span>
                            <span style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.16)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#1D4ED8"}}>Now {item.newSection}</span>
                          </div>
                        )}
                        {item.kind==="institute_renamed" && item.oldInstitute && item.newInstitute && (
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,marginBottom:2}}>
                            <span style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:G.textM}}>From {item.oldInstitute}</span>
                            <span style={{background:"rgba(245,158,11,0.10)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B45309"}}>Now {item.newInstitute}</span>
                          </div>
                        )}
                        {!isLocalWarning && !isInstituteAction && (
                          <div style={{fontSize:13,color:G.textM,lineHeight:1.7,marginTop:10}}>
                            {item.lastDateKey ? `Last log ${formatDateLabel(item.lastDateKey)}.` : "No saved entries were found for this class."} {item.latestEntryText ? `Latest note: ${item.latestEntryText}` : ""}
                          </div>
                        )}
                        {item.kind==="institute_deleted_migrated" && item.oldInstitute && item.newInstitute && (
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,marginBottom:2}}>
                            <span style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B91C1C",display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconTrash} size={13} color="#B91C1C" />Deleted: {item.oldInstitute}</span>
                            <span style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#6D28D9"}}>Moved to: {item.newInstitute}</span>
                          </div>
                        )}
                        {item.kind==="institute_deleted" && item.oldInstitute && (
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,marginBottom:2}}>
                            <span style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#B91C1C",display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconTrash} size={13} color="#B91C1C" />Permanently deleted: {item.oldInstitute}</span>
                          </div>
                        )}
                      </div>
                      <div style={{fontSize:12,color:G.textL,lineHeight:1.6,whiteSpace:isMobile?"normal":"nowrap"}}>
                        {`${item.adminName || "Admin"} · ${fmtAdminNoticeStamp(item.eventAt)}`}
                      </div>
                    </div>

                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {!isLocalWarning && !isInstituteRename && isActive && <PrimaryBtn onClick={()=>openAdminNoticeClass(item)} style={{padding:"10px 16px"}}>Open class</PrimaryBtn>}
                      {!isLocalWarning && !isInstituteRename && isActive && item.entryCount>0 && <GhostBtn onClick={()=>openAdminNoticeClass(item,{history:true})} style={{padding:"10px 16px"}}>View history</GhostBtn>}
                      {!isLocalWarning && !isInstituteRename && isTrash && <GhostBtn onClick={()=>safeNav("trash")} style={{padding:"10px 16px"}}>Open recycle bin</GhostBtn>}

                      <GhostBtn onClick={()=>isLocalWarning ? dismissLocalTeacherNotice(currentTeacherLocalNoticeSignature) : dismissAdminNotices(item.id)} style={{padding:"10px 16px"}}>{dismissLabel}</GhostBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {renderTeacherBottomBar("notifications")}
      </div>
    );
  }

  if(view==="profile"){
    const activeClasses=[...(data.classes||[]).filter(c=>!c.left)].sort((a,b)=>(b.created||0)-(a.created||0));
    const institutes=teacherInstitutes;
    const quickHomeSummary=teacherQuickHomeSummary;

    return(
      <div style={{...teacherThemeShell,height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.pageBg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav
          user={user}
          teacherName={teacherName}
          data={data}
          onLogoClick={()=>safeNav("home")}
          onSignOut={()=>setSignOutPrompt(true)}
          onViewNotifications={()=>safeNav("notifications")}
          notificationCount={notificationCount}
          showProfileMenu={!isMobile}
        />
        <TeacherProfileView
          user={user}
          teacherName={teacherName}
          quickHomeSummary={quickHomeSummary}
          notificationCount={notificationCount}
          trashCount={trashCount}
          onOpenStats={()=>openStatsView("profile")}
          onOpenNotifications={()=>safeNav("notifications")}
          onOpenTrash={()=>safeNav("trash")}
          onOpenExport={()=>setExportOpen(true)}
          onSignOut={()=>setSignOutPrompt(true)}
          themeMode={teacherTheme}
          onThemeChange={setTeacherTheme}
          memberSinceLabel={teacherMemberSinceLabel}
        />
        {renderTeacherBottomBar("profile")}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 1 — HOME: class list
  // Mobile:  full-screen scrollable list, tap → go to class page
  // Tablet+: left sidebar + right entries panel (split view)
  // ══════════════════════════════════════════════════════════════════════
  if(view==="home"){
    const activeClasses=teacherActiveClasses;
    // Only show institutes that have at least one active (non-trashed) class.
    // Empty institutes (all classes deleted) are hidden from filter and header count.
    const institutes=teacherInstitutes;
    const filtered=deferredTeacherVisibleClasses;
    const visibleMobileClasses=filtered.slice(0,mobileClassLimit);
    const hasMoreMobileClasses=filtered.length>visibleMobileClasses.length;
    const quickHomeSummary=teacherQuickHomeSummary;

    // For tablet/desktop split view
    const selCls=activeClasses.find(c=>c.id===activeClass?.id)||activeClasses[0]||null;
    const selColor=selCls?getSectionTone(selCls.section):getSectionTone("");
    const selSurfaceTheme = getTeacherSectionSurfaceStyles(selColor, isDarkTeacherTheme);
    const selNotes=selCls?getClassNotes(selCls.id):{};
    const selDateNotes=selCls?getDateNotes(selCls.id,selectedDate):[];
    const selMetrics=selCls?(teacherClassMetricsMap[selCls.id] || buildClassEntryMetrics(selNotes)):null;

    // Nav buttons — same on all screen sizes
    const NavRight = !isMobile ? <>
      <button onClick={()=>setExportOpen(true)}
        style={{background:G.topbarButtonBg,border:`1px solid ${G.topbarButtonBorder}`,borderRadius:999,padding:"0 14px",cursor:"pointer",color:G.textS,display:"flex",alignItems:"center",gap:6,minHeight:44,WebkitTapHighlightColor:"transparent",flexShrink:0,boxShadow:G.shadowSm}}>
        <AppIcon icon={IconDownload} size={16} color={G.textS} />
        <span className="desktop-only" style={{display:"inline",fontSize:13,fontWeight:700}}>Export</span>
      </button>
    </> : null;

    // Shared class card — click goes to class detail page (mobile) or selects (desktop)
    const ClassCard = ({cls, onClick, compact = false, dense = false, onDelete = null, onHold = null}) => {
      const ic=getSectionTone(cls.section);
      const metrics=teacherClassMetricsMap[cls.id] || buildClassEntryMetrics(data.notes?.[cls.id]||{});
      const todayDotStyle=getSectionCardTodayDotStyles(metrics.todayEntries);
      const holdTimerRef = React.useRef(null);
      const holdStartRef = React.useRef(null);
      const holdTriggeredRef = React.useRef(false);
      const clearHold = React.useCallback(() => {
        if(holdTimerRef.current){
          window.clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        holdStartRef.current = null;
      }, []);
      React.useEffect(() => () => clearHold(), [clearHold]);
      // Truncate long institute names with ellipsis
      const instFull=cls.institute||"";
      const instShort=instFull.length>28?instFull.slice(0,26)+"…":instFull;
      const cardBorder = isDarkTeacherTheme ? G.borderM : "rgba(15,23,42,0.92)";
      const sectionSurface = isDarkTeacherTheme ? hexToRgba(ic.bg, 0.16) : (ic.surface || ic.light || "#EEF3F8");
      const sectionTitleColor = isDarkTeacherTheme ? G.text : (ic.ink || G.text);
      const institutePillFill = isDarkTeacherTheme ? "rgba(255,255,255,0.08)" : (ic.pill || "#FFFFFF");
      const institutePillBorder = isDarkTeacherTheme ? "rgba(255,255,255,0.14)" : (ic.border || G.border);
      const institutePillText = isDarkTeacherTheme ? G.textS : G.text;
      const subjectPillFill = isDarkTeacherTheme ? "rgba(255,255,255,0.08)" : "#FFFFFF";
      const subjectPillBorder = isDarkTeacherTheme ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.18)";
      const beginHold = e => {
        if(!compact || !onHold || !e.touches?.length) return;
        const touch = e.touches[0];
        holdTriggeredRef.current = false;
        clearHold();
        holdStartRef.current = { x:touch.clientX, y:touch.clientY };
        holdTimerRef.current = window.setTimeout(() => {
          holdTriggeredRef.current = true;
          void triggerAppHaptic("hold");
          onHold();
        }, 420);
      };
      const moveHold = e => {
        if(!holdStartRef.current || !e.touches?.length) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - holdStartRef.current.x);
        const dy = Math.abs(touch.clientY - holdStartRef.current.y);
        if(dx > 10 || dy > 10) clearHold();
      };
      const handleCardClick = e => {
        if(holdTriggeredRef.current){
          holdTriggeredRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.();
      };

      if(compact){
        return(
          <div className="ledgr-card ledgr-pressable"
            onClick={handleCardClick}
            onTouchStart={beginHold}
            onTouchMove={moveHold}
            onTouchEnd={clearHold}
            onTouchCancel={clearHold}
            style={{background:G.surface,borderRadius:20,border:`1.5px solid ${cardBorder}`,overflow:"hidden",boxShadow:reduceEffects?G.shadowSm:G.shadowMd,cursor:"pointer",WebkitTapHighlightColor:"transparent",position:"relative"}}>
            <div style={{background:sectionSurface,borderBottom:`1px solid ${G.border}`,padding:dense?"12px 14px":"13px 15px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:dense?22:24,fontWeight:800,color:sectionTitleColor,fontFamily:G.display,letterSpacing:-0.4,lineHeight:1.02,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.section}</div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
                    <span title={instFull} style={{display:"inline-flex",alignItems:"center",gap:7,background:institutePillFill,color:institutePillText,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,fontFamily:G.sans,border:`1px solid ${institutePillBorder}`,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <span style={{width:8,height:8,borderRadius:999,background:ic.bg,flexShrink:0}}/>
                      {instShort || "No institute"}
                    </span>
                    {cls.subject && (
                      <span style={{display:"inline-flex",alignItems:"center",background:subjectPillFill,color:G.text,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,fontFamily:G.sans,border:`1px solid ${subjectPillBorder}`,whiteSpace:"nowrap",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {cls.subject}
                      </span>
                    )}
                  </div>
                </div>
                <span title={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} aria-label={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:dense?20:22,height:dense?20:22,borderRadius:999,border:`2px solid ${todayDotStyle.borderColor}`,background:todayDotStyle.background,boxShadow:todayDotStyle.boxShadow,flexShrink:0,marginTop:2}} />
              </div>
            </div>
          </div>
        );
      }

      return(
        <div className="ledgr-card"
          onClick={handleCardClick}
          onTouchStart={beginHold}
          onTouchMove={moveHold}
          onTouchEnd={clearHold}
          onTouchCancel={clearHold}
          style={{background:G.surface,borderRadius:20,border:`1.5px solid ${cardBorder}`,overflow:"hidden",boxShadow:reduceEffects?G.shadowSm:G.shadowMd,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:reduceEffects?"none":"transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease"}}
          onPointerDown={reduceEffects?undefined:(e=>{e.currentTarget.style.transform="translateY(1px) scale(0.99)";e.currentTarget.style.boxShadow="0 6px 16px rgba(14,31,24,0.09)";})}
          onPointerUp={reduceEffects?undefined:(e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowMd;})}
          onPointerCancel={reduceEffects?undefined:(e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowMd;})}>
          <div style={{background:sectionSurface,borderBottom:`1px solid ${G.border}`,padding:"14px 15px 13px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:19,fontWeight:800,color:sectionTitleColor,fontFamily:G.display,letterSpacing:-0.3,lineHeight:1.08,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                  <span title={instFull} style={{display:"inline-flex",alignItems:"center",gap:7,background:institutePillFill,color:institutePillText,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,border:`1px solid ${institutePillBorder}`,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    <span style={{width:8,height:8,borderRadius:999,background:ic.bg,flexShrink:0}}/>
                    {instShort || "No institute"}
                  </span>
                  {cls.subject && <span style={{display:"inline-flex",alignItems:"center",background:subjectPillFill,color:G.text,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,border:`1px solid ${subjectPillBorder}`,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.subject}</span>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-start",gap:8,flexShrink:0}}>
                <span title={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} aria-label={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:999,border:`2px solid ${todayDotStyle.borderColor}`,background:todayDotStyle.background,boxShadow:todayDotStyle.boxShadow,flexShrink:0,marginTop:2}} />
                {onDelete&&<OverflowMenu buttonSize={30} items={[
                  { icon:IconTrash, label:"Delete class", danger:true, onClick:onDelete },
                ]}/>}
              </div>
            </div>
          </div>
        </div>
      );
    };

    // Institute filter pills
    const InstFilter = ({ columns = "1fr", compact = false, scroll = false, stacked = false, allLabel = "All" }) => institutes.length>1?(
      <div style={scroll ? {display:"flex",gap:8,overflowX:"auto",padding:"0 0 4px",scrollbarWidth:"none"} : {display:"grid",gridTemplateColumns:stacked?"repeat(2,minmax(0,1fr))":columns,gap:stacked?10:(compact?6:8),padding:"0 0 2px"}}>
        {["all",...institutes].map(inst=>{
          const isSel=instFilter===inst;
          const ic=inst==="all"
            ? {bg:G.textL,light:G.surfaceAlt,surface:G.surface,pill:G.surface,border:G.borderM,text:G.text,ink:G.text}
            : (instituteFilterToneMap.get(inst) || getSectionTone(inst));
          const label=inst==="all"?allLabel:inst;
          const pillBg=inst==="all"
            ? (isDarkTeacherTheme ? G.surfaceAlt : G.surface)
            : (isSel ? ic.bg : (ic.surface || ic.light || G.surfaceAlt));
          const pillText=inst==="all" ? G.text : (isSel ? "#FFFFFF" : (ic.ink || G.text));
          const pillBorder=inst==="all"
            ? (isSel ? G.borderM : G.border)
            : (isSel ? (ic.bg || G.borderM) : (ic.border || G.borderM));
          return(
            <button key={inst} title={label} onClick={()=>React.startTransition(()=>setInstFilter(inst))}
              style={{
                width:scroll?"auto":"100%",
                minWidth:scroll?0:0,
                flexShrink:scroll?0:1,
                minHeight:stacked?54:(compact?36:44),
                padding:stacked?"12px 15px":(compact?"8px 14px":"10px 14px"),
                borderRadius:stacked?20:999,
                border:`1.5px solid ${pillBorder}`,
                cursor:"pointer",
                fontFamily:G.sans,
                fontSize:stacked?12.5:(compact?12:12.5),
                fontWeight:isSel?800:600,
                WebkitTapHighlightColor:"transparent",
                transition:"all 0.15s",
                background:pillBg,
                color:pillText,
                boxShadow:inst==="all"
                  ? (isSel ? "0 0 0 1px rgba(15,23,42,0.08)" : "none")
                  : (isSel ? "0 10px 24px rgba(15,23,42,0.16)" : "none"),
                opacity:1,
                display:"flex",
                alignItems:"center",
                gap:9,
                textAlign:"left",
                lineHeight:1.15,
                overflow:"hidden",
              }}>
              <span style={{width:stacked?10:8,height:stacked?10:8,borderRadius:999,background:inst==="all" ? (isDarkTeacherTheme ? G.textS : "#FFFFFF") : (isSel ? "rgba(255,255,255,0.96)" : ic.bg),flexShrink:0,border:`1px solid ${inst==="all" ? G.borderM : (isSel ? "rgba(255,255,255,0.46)" : (ic.border || G.borderM))}`}}/>
              <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
            </button>
          );
        })}
      </div>
    ):null;

    // ── MOBILE VIEW: full-page class list ────────────────────────────────────
    const MobileHome = () => {
      return(
      <div className="ledgr-page" style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:mobileLiteMode?`12px 12px ${mobileBottomNavPad}`:`14px 16px ${mobileBottomNavPad}`,WebkitOverflowScrolling:"touch"}}>
          <div className="ledgr-card" style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:22,padding:"14px 16px 13px",boxShadow:G.shadowMd,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10.5,fontWeight:800,color:G.textM,letterSpacing:0.95,textTransform:"uppercase",fontFamily:G.sans}}>Today</div>
                <div style={{fontSize:19,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.25,marginTop:4,lineHeight:1.2}}>{quickHomeSummary.todayLabel}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:10.5,fontWeight:800,color:G.textM,letterSpacing:0.95,textTransform:"uppercase",fontFamily:G.sans}}>Visible</div>
                <div style={{fontSize:30,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-1,lineHeight:1,marginTop:4}}>{filtered.length}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
              <span style={{background:G.surfaceAlt,border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 11px",fontSize:12,fontWeight:700,color:G.textS}}>{quickHomeSummary.loggedToday} logged today</span>
              <span style={{background:G.surfaceAlt,border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 11px",fontSize:12,fontWeight:700,color:G.textS}}>{quickHomeSummary.monthEntries} entries this month</span>
              <span style={{background:quickHomeSummary.needsAttentionCount>0?"rgba(217,119,6,0.10)":G.surfaceAlt,border:quickHomeSummary.needsAttentionCount>0?"1px solid rgba(217,119,6,0.18)":`1px solid ${G.border}`,borderRadius:999,padding:"6px 11px",fontSize:12,fontWeight:800,color:quickHomeSummary.needsAttentionCount>0?"#B45309":G.textS}}>{quickHomeSummary.needsAttentionCount} not logged today</span>
            </div>
          </div>

          {institutes.length>1&&(
            <div className="ledgr-card" style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:22,padding:"14px 14px 12px",boxShadow:G.shadowMd,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:800,color:"#94A3B8",letterSpacing:1.1,textTransform:"uppercase",margin:"0 2px 12px",fontFamily:G.mono}}>Institute Filter</div>
              <InstFilter stacked allLabel="All Classes"/>
            </div>
          )}

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"18px 4px 12px"}}>
            <div>
              <div style={{fontSize:10.5,fontWeight:700,color:G.textM,letterSpacing:1.1,textTransform:"uppercase",fontFamily:G.mono}}>Your Classes</div>
              <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.3,marginTop:4}}>{filtered.length} class{filtered.length===1?"":"es"} ready</div>
            </div>
            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:G.surface,border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,color:G.textS,fontFamily:G.mono}}>
              {Math.min(filtered.length, visibleMobileClasses.length)}/{filtered.length} shown
            </span>
          </div>

          {activeClasses.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{width:72,height:72,borderRadius:22,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AppIcon icon={IconBook2} size={34} color={G.textM} /></div>
              <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>No classes yet</h2>
              <p style={{fontSize:15,color:G.textM,marginBottom:24}}>Add your first class to start tracking.</p>
              <PrimaryBtn onClick={()=>setView("addClass")} style={{padding:"13px 32px",fontSize:16}}>+ Add First Class</PrimaryBtn>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:mobileLiteMode?8:10}}>
              {visibleMobileClasses.map(cls=>(
                <ClassCard key={cls.id} cls={cls} compact dense={mobileLiteMode} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setView("classDetail");}} onDelete={()=>setLeaveModal(cls.id)} onHold={()=>setMobileClassSheetId(cls.id)}/>
              ))}
              {hasMoreMobileClasses&&(
                <button onClick={()=>setMobileClassLimit(limit=>Math.min(filtered.length, limit + mobileBatchSize))}
                  className="ledgr-card ledgr-pressable"
                  style={{background:G.classCardBg,border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 16px",fontSize:14,fontWeight:700,color:G.textS,fontFamily:G.sans,cursor:"pointer",WebkitTapHighlightColor:"transparent",boxShadow:G.shadowSm}}>
                  Load {Math.min(mobileBatchSize, filtered.length - visibleMobileClasses.length)} more classes
                </button>
              )}
              <div className="ledgr-card"
                onClick={()=>setView("addClass")}
                style={{borderRadius:18,border:`2px dashed ${G.border}`,padding:"20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,cursor:"pointer",background:G.classCardBg,WebkitTapHighlightColor:"transparent",boxShadow:G.shadowSm}}
                onPointerDown={e=>{e.currentTarget.style.background=G.greenL;e.currentTarget.style.borderColor=G.green;}}
                onPointerUp={e=>{e.currentTarget.style.background=G.classCardBg;e.currentTarget.style.borderColor=G.border;}}
                onPointerCancel={e=>{e.currentTarget.style.background=G.classCardBg;e.currentTarget.style.borderColor=G.border;}}>
                <span style={{width:34,height:34,borderRadius:12,background:G.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:G.green,flexShrink:0}}>+</span>
                <span style={{fontSize:15,fontWeight:600,color:G.textM,fontFamily:G.display}}>Add New Class</span>
              </div>
              <div style={{textAlign:"center",padding:"20px 0 4px"}}>
                <span style={{fontSize:12,color:G.textL,fontFamily:G.sans,letterSpacing:0.3}}>Every class. Every teacher. One place.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
    };

    // ── TABLET / DESKTOP VIEW: sidebar + detail panel ────────────────────────
    const SplitView = () => {
      const [sidebarWidth, setSidebarWidth] = React.useState(() => {
        if (typeof window === "undefined") return 360;
        if (window.innerWidth >= 1440) return 396;
        if (window.innerWidth >= 1200) return 360;
        return 320;
      });
      const isDragging = React.useRef(false);
      const dragStartX = React.useRef(0);
      const dragStartW = React.useRef(sidebarWidth);
      const containerRef = React.useRef(null);

      function onDividerPointerDown(e) {
        e.preventDefault();
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartW.current = sidebarWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        function onMove(ev) {
          if (!isDragging.current) return;
          const dx = ev.clientX - dragStartX.current;
          const containerW = containerRef.current?.offsetWidth || window.innerWidth;
          const newW = Math.min(Math.max(dragStartW.current + dx, 280), containerW * 0.68);
          setSidebarWidth(newW);
        }
        function onUp() {
          isDragging.current = false;
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      const selStatusTone = selMetrics ? getTodayEntryStatusStyles(selMetrics.todayEntries) : getTodayEntryStatusStyles(0);

      return (
      <div ref={containerRef} style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left sidebar */}
        <div style={{width:sidebarWidth,flexShrink:0,display:"flex",flexDirection:"column",background:G.pageBg,overflow:"hidden"}}>
          <div style={{padding:"14px 12px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:22,padding:"15px 14px 14px",color:G.text,boxShadow:G.shadowMd}}>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,marginBottom:4,textAlign:"center"}}>{quickHomeSummary.todayLabel}</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:G.display,letterSpacing:-0.4,marginBottom:5,lineHeight:1.1}}>{teacherName}</div>
              <div style={{fontSize:13,color:G.textM,lineHeight:1.45}}>{currentSession()} session • {filtered.length} visible classes</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>
                <span style={{background:G.surfaceAlt,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:700,fontFamily:G.mono,color:G.textS}}>{quickHomeSummary.loggedToday} logged today</span>
                <span style={{background:G.surfaceAlt,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:700,fontFamily:G.mono,color:G.textS}}>{quickHomeSummary.monthEntries} this month</span>
                <span style={{background:quickHomeSummary.needsAttentionCount>0?"#FFF7ED":G.surfaceAlt,border:quickHomeSummary.needsAttentionCount>0?"1px solid #FED7AA":`1px solid ${G.border}`,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:700,fontFamily:G.mono,color:quickHomeSummary.needsAttentionCount>0?"#B45309":G.textS}}>{quickHomeSummary.needsAttentionCount} not logged today</span>
              </div>
            </div>
          </div>
          {institutes.length>1&&<div style={{padding:"10px 10px 8px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:8,padding:"0 2px"}}>Institute filter</div>
            <InstFilter columns={sidebarWidth >= 360 ? "repeat(2,minmax(0,1fr))" : "1fr"} compact={sidebarWidth < 360}/>
          </div>}
          <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
            {filtered.map(cls=>{
              const ic=getSectionTone(cls.section);
              const isSel=selCls?.id===cls.id;
              const metrics=teacherClassMetricsMap[cls.id] || buildClassEntryMetrics(data.notes?.[cls.id]||{});
              const todayDotStyle=getSectionCardTodayDotStyles(metrics.todayEntries);
              const instFull=cls.institute||"";
              const sectionSurface=isDarkTeacherTheme ? hexToRgba(ic.bg, 0.16) : (ic.surface || ic.light || "#EEF3F8");
              const institutePillFill = isDarkTeacherTheme ? "rgba(255,255,255,0.08)" : (ic.pill || "#FFFFFF");
              const institutePillBorder = isDarkTeacherTheme ? "rgba(255,255,255,0.14)" : (ic.border || G.border);
              const subjectPillFill = isDarkTeacherTheme ? "rgba(255,255,255,0.08)" : "#FFFFFF";
              const subjectPillBorder = isDarkTeacherTheme ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.18)";
              return(
                <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());}}
                  style={{borderRadius:18,marginBottom:8,cursor:"pointer",background:G.surface,border:`1.5px solid ${isSel ? G.borderM : G.border}`,boxShadow:G.shadowSm,transition:"all 0.14s ease",overflow:"hidden"}}>
                  <div style={{background:sectionSurface,padding:"13px 13px 12px",borderBottom:`1px solid ${G.border}`}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:800,color:isDarkTeacherTheme ? G.text : (ic.ink || G.text),fontFamily:G.display,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-0.25}}>{cls.section}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
                          <span title={instFull} style={{display:"inline-flex",alignItems:"center",gap:6,background:institutePillFill,border:`1px solid ${institutePillBorder}`,borderRadius:999,padding:"4px 9px",fontSize:11,fontWeight:700,color:isDarkTeacherTheme ? G.textS : G.text,maxWidth:190,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            <span style={{width:7,height:7,borderRadius:999,background:ic.bg,flexShrink:0}}/>
                            <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{instFull || "No institute"}</span>
                          </span>
                          {cls.subject && <span style={{display:"inline-flex",alignItems:"center",background:subjectPillFill,border:`1px solid ${subjectPillBorder}`,borderRadius:999,padding:"4px 9px",fontSize:11,fontWeight:700,color:G.text,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.subject}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8,flexShrink:0}}>
                        <span title={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} aria-label={metrics.todayEntries > 0 ? "Today's entry is filled" : "Today's entry is not filled"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:999,border:`2px solid ${todayDotStyle.borderColor}`,background:todayDotStyle.background,boxShadow:todayDotStyle.boxShadow,flexShrink:0,marginTop:3}} />
                        <OverflowMenu buttonSize={30} items={[
                          { icon:IconTrash, label:"Delete class", danger:true, onClick:()=>setLeaveModal(cls.id) },
                        ]}/>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div onClick={()=>setView("addClass")} style={{borderRadius:16,padding:"12px 12px",marginTop:6,cursor:"pointer",border:`2px dashed ${G.border}`,display:"flex",alignItems:"center",gap:10,transition:"all 0.15s",background:isDarkTeacherTheme ? G.classCardBg : "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",boxShadow:G.shadowSm}} onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background=isDarkTeacherTheme ? G.classCardBg : 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)';}}>
              <span style={{width:28,height:28,borderRadius:10,background:G.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:G.green,flexShrink:0}}>+</span><span style={{fontSize:13,color:G.textM,fontWeight:700}}>Add New Class</span>
            </div>
          </div>
        </div>

        {/* ── Draggable divider ── */}
        <div
          onPointerDown={onDividerPointerDown}
          style={{
            width:8, flexShrink:0, cursor:"col-resize",
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"transparent", position:"relative", zIndex:10,
            WebkitTapHighlightColor:"transparent",
          }}
          onMouseEnter={e=>{e.currentTarget.querySelector(".divider-line").style.background=G.green;e.currentTarget.querySelector(".divider-grip").style.opacity="1";}}
          onMouseLeave={e=>{e.currentTarget.querySelector(".divider-line").style.background=G.border;e.currentTarget.querySelector(".divider-grip").style.opacity="0";}}>
          <div className="divider-line" style={{position:"absolute",top:0,bottom:0,left:"50%",transform:"translateX(-50%)",width:1,background:G.border,transition:"background 0.15s"}}/>
          <div className="divider-grip" style={{
            position:"relative", zIndex:1,
            width:20, height:48, borderRadius:10,
            background:G.surface, border:`1.5px solid ${G.border}`,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:3, opacity:0, transition:"opacity 0.15s",
            boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
          }}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:3,height:3,borderRadius:"50%",background:G.textL}}/>
            ))}
          </div>
        </div>

        {/* Right detail panel */}
        {!selCls?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:G.textL,fontSize:15}}>Select a class from the left</div>
        ):(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
            <div style={{padding:"16px 18px 14px",borderBottom:`1px solid ${G.border}`,background:G.pageBg,flexShrink:0}}>
              <div style={{background:G.surface,border:`1px solid ${isDarkTeacherTheme ? G.borderM : "rgba(15,23,42,0.92)"}`,borderRadius:22,overflow:"hidden",boxShadow:G.shadowMd}}>
                <div style={{background:selSurfaceTheme.headerBg,padding:"16px 16px 14px",borderBottom:`1px solid ${selSurfaceTheme.headerBorder}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:selSurfaceTheme.eyebrowColor,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.7,marginBottom:6}}>Class entry</div>
                      <div style={{fontSize:22,fontWeight:800,color:selSurfaceTheme.titleColor,fontFamily:G.display,letterSpacing:-0.4,lineHeight:1.08}}>{selCls.section}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                        <span style={{background:selSurfaceTheme.chipBg,border:`1px solid ${selSurfaceTheme.chipBorder}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:selSurfaceTheme.chipText,fontFamily:G.sans,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selCls.institute}</span>
                        {selCls.subject&&<span style={{background:selSurfaceTheme.chipBg,border:`1px solid ${selSurfaceTheme.chipBorder}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:700,color:selSurfaceTheme.chipText,fontFamily:G.sans}}>{selCls.subject}</span>}
                        <span style={{background:selStatusTone.background,border:`1px solid ${selStatusTone.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:800,color:selStatusTone.color,fontFamily:G.sans}}>{selStatusTone.label}</span>
                      </div>
                    </div>
                    <OverflowMenu buttonSize={34} items={[
                      { icon:IconEdit, label:"Edit class", onClick:()=>setEditingClass(selCls) },
                      { icon:IconTrash, label:"Delete class", danger:true, onClick:()=>setLeaveModal(selCls.id) },
                    ]}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
                    {[
                      { label:"Today", value:selMetrics?.todayEntries ?? 0, color:selSurfaceTheme.primaryAccent },
                      { label:selMetrics?.monthLabel || "This month", value:selMetrics?.monthEntries ?? 0, color:G.textS },
                      { label:"Total", value:selMetrics?.totalCount ?? 0, color:G.text },
                      { label:"Logged days", value:selMetrics?.activeDays ?? 0, color:G.textS },
                    ].map(item=>(
                      <div key={item.label} style={{background:selSurfaceTheme.statBg,border:`1px solid ${selSurfaceTheme.statBorder}`,borderRadius:14,padding:"11px 10px 10px",textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:800,color:item.color,fontFamily:G.display,lineHeight:1}}>{item.value}</div>
                        <div style={{fontSize:10.5,color:G.textL,marginTop:5,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{padding:"14px 16px 16px"}}>
                  <div style={{maxWidth:500,margin:"0 auto"}}><DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={selMetrics?.noteDates || {}}/></div>
                </div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 18px 40px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,background:G.surface,border:`1px solid ${G.border}`,borderRadius:18,padding:"12px 14px",boxShadow:G.shadowSm}}>
                <div>
                  <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>Date focus</div>
                  <span style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.2}}>{formatDateLabel(selectedDate)}</span>
                  <span style={{color:selDateNotes.length>0?G.green:G.textM,marginLeft:8,fontSize:13,fontWeight:700,fontFamily:G.mono}}>{selDateNotes.length} {selDateNotes.length===1?"entry":"entries"}</span>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                    <span style={{...(selMetrics?.lastLogTone || getLastLogToneStyles({tone:"red"})),borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:800,fontFamily:G.mono}}>
                      {selMetrics?.lastLogMeta?.label || "No logs yet"}
                    </span>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button
                    onClick={()=>setHistoryClassId(selCls.id)}
                    disabled={(selMetrics?.totalCount || 0)===0}
                    style={{
                      background:(selMetrics?.totalCount || 0)===0?G.bg:G.surface,
                      color:(selMetrics?.totalCount || 0)===0?G.textL:G.textS,
                      border:`1px solid ${(selMetrics?.totalCount || 0)===0?G.border:G.borderM}`,
                      borderRadius:9,
                      padding:"8px 14px",
                      fontSize:14,
                      cursor:(selMetrics?.totalCount || 0)===0?"not-allowed":"pointer",
                      fontFamily:G.sans,
                      fontWeight:700,
                      display:"flex",
                      alignItems:"center",
                      gap:5,
                      minHeight:40,
                      WebkitTapHighlightColor:"transparent"
                    }}>
                    <AppIcon icon={IconHistory} size={16} color={(selMetrics?.totalCount || 0)===0?G.textL:G.textS} /> History
                  </button>
                  {canAdd&&<button onClick={()=>{
    setActiveClass(selCls);
    const _ks=getSlotsForSection(selCls,instituteSections);
    const _used=new Set(((data.notes?.[selCls.id]||{})[selectedDate]||[]).map(e=>e.timeStart).filter(Boolean));
    const _def=_ks?getDefaultKisSlot(data.notes,selCls.id,_ks,_used):null;
    setNewNote(_def&&!_used.has(_def.start)
      ?{title:"",body:"",tag:"note",status:"",timeStart:_def.start,timeEnd:_def.end,_dur:_def.durMins,_kisSlot:true,_suggestedEnd:_def.end}
      :{title:"",body:"",tag:"note",status:"",...(_ks?{}:(getSuggestedTime(data.notes,selCls.id,selectedDate)||{_dur:selCls?.duration||60}))});
    safeNav("addNote");
  }} onPointerDown={e=>rpl(e,true)} style={{background:selSurfaceTheme.primaryButtonBg,color:selSurfaceTheme.primaryButtonText,border:"none",borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent"}}>+ Add Entry</button>}
                </div>
              </div>
              {selDateNotes.length===0?(
                <div style={{background:selSurfaceTheme.emptyBg,borderRadius:18,border:`2px dashed ${G.border}`,padding:"44px 20px",textAlign:"center",boxShadow:G.shadowSm}}>
                  <div style={{width:60,height:60,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><AppIcon icon={IconEdit} size={28} color={G.textM} /></div>
                  <div style={{fontSize:16,color:G.textM,fontWeight:600}}>{canAdd?"No entries yet — click + Add Entry":"No entries for this date"}</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {isReadOnlyDate&&(
                    <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
                      Viewing past entries only. Dates older than the past week cannot be edited.
                    </div>
                  )}
                  {selDateNotes.map(note=>{const tag=(note?.tag&&TAG_STYLES[note.tag])||TAG_STYLES.note;return(
                    <div key={note.id} style={{background:selSurfaceTheme.noteBg,borderRadius:16,border:`1px solid ${selSurfaceTheme.noteBorder}`,overflow:"hidden",boxShadow:reduceEffects?"none":G.shadowMd}}>
                      <div style={{height:4,background:tag.bg}}/>
                      <div style={{padding:"13px 15px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:note.title?7:0}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                              {note.timeStart&&<span style={{fontSize:12,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"3px 10px",border:`1px solid ${G.borderM}`,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><AppIcon icon={IconClockHour4} size={12} color={G.textS} />{formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            </div>
                            {note.title&&<div style={{fontWeight:700,fontSize:17,color:G.text,fontFamily:G.display,lineHeight:1.3}}>{note.title}</div>}
                            {note.body&&<p style={{margin:"7px 0 0",fontSize:14,color:G.textS,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                          </div>
                          {canAdd&&(
                            <OverflowMenu items={[
                              { icon:IconEdit, label:"Edit entry", onClick:()=>{setEditNote({...note});setView("editNote");} },
                              { icon:IconTrash, label:"Delete entry", danger:true, onClick:()=>deleteNote(note.id) },
                            ]}/>
                          )}
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      );
    };

    return(
      <div style={{...teacherThemeShell,height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.pageBg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} onViewStats={()=>openStatsView("home")} onViewTrash={()=>setView("trash")} onViewNotifications={()=>safeNav("notifications")} trashCount={trashCount} notificationCount={notificationCount} right={NavRight} showProfileMenu={!isMobile}/>
        {isMobile ? <MobileHome/> : <SplitView/>}
        {renderTeacherBottomBar("home")}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2 — CLASS DETAIL (mobile only — tap class → here)
  // ══════════════════════════════════════════════════════════════════════
  if(view==="classDetail" && activeClass){
    const cls=activeClass;
    const swipePool = teacherFilteredClasses.some(entry => String(entry?.id || "") === String(cls.id || ""))
      ? teacherFilteredClasses
      : teacherActiveClasses;
    const currentDetailIndex = swipePool.findIndex(entry => String(entry?.id || "") === String(cls.id || ""));
    const leftSwipeClass = currentDetailIndex >= 0 && swipePool.length > 1
      ? swipePool[(currentDetailIndex + 1) % swipePool.length]
      : cls;
    const rightSwipeClass = currentDetailIndex >= 0 && swipePool.length > 1
      ? swipePool[(currentDetailIndex - 1 + swipePool.length) % swipePool.length]
      : cls;
    const getDetailViewportWidth = () => Math.max(320, Math.round(window.visualViewport?.width || window.innerWidth || 360));
    const bounceDetailCardBack = (duration = 190) => {
      if(detailSwipeResetTimer.current){
        window.clearTimeout(detailSwipeResetTimer.current);
        detailSwipeResetTimer.current = null;
      }
      setDetailSwipeTransitionMs(reduceEffects ? 0 : duration);
      commitDetailSwipeOffset(0);
    };
    const animateSiblingCardChange = (direction, distance = 96, gestureMs = 180) => {
      const targetClass = direction > 0 ? leftSwipeClass : rightSwipeClass;
      if(
        swipePool.length < 2 ||
        !targetClass ||
        String(targetClass?.id || "") === String(cls.id || "")
      ){
        bounceDetailCardBack();
        return false;
      }
      const viewportWidth = getDetailViewportWidth();
      const settleMs = reduceEffects ? 0 : Math.max(150, Math.min(360, Math.round(120 + gestureMs * 0.34)));
      if(detailSwipeResetTimer.current){
        window.clearTimeout(detailSwipeResetTimer.current);
        detailSwipeResetTimer.current = null;
      }
      setDetailSwipeTransitionMs(settleMs);
      commitDetailSwipeOffset(direction > 0 ? viewportWidth : -viewportWidth);
      detailSwipeResetTimer.current = window.setTimeout(() => {
        setActiveClass(targetClass);
        setDetailSwipeTransitionMs(0);
        commitDetailSwipeOffset(0);
        detailSwipeResetTimer.current = null;
      }, settleMs);
      return true;
    };
    const handleDetailTouchStart = e => {
      if(!isMobile || e.touches?.length !== 1) return;
      if(detailSwipeResetTimer.current) return;
      if(e.target?.closest?.("button, input, textarea, select")) return;
      const touch = e.touches[0];
      const viewportWidth = getDetailViewportWidth();
      if(touch.clientX < 24 || (viewportWidth && touch.clientX > viewportWidth - 24)) return;
      setDetailSwipeTransitionMs(0);
      classSwipeStartRef.current = { x:touch.clientX, y:touch.clientY, at:Date.now(), axis:null };
    };
    const handleDetailTouchMove = e => {
      const start = classSwipeStartRef.current;
      if(!start || e.touches?.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if(!start.axis){
        if(Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        start.axis = Math.abs(dx) > Math.abs(dy) * 1.05 ? "x" : "y";
      }
      if(start.axis !== "x") return;
      if(e.cancelable) e.preventDefault();
      const viewportWidth = getDetailViewportWidth();
      const resistedOffset = Math.sign(dx) * Math.min(Math.abs(dx), viewportWidth * 0.88);
      setDetailSwipeTransitionMs(0);
      commitDetailSwipeOffset(resistedOffset, false);
    };
    const handleDetailTouchEnd = e => {
      const start = classSwipeStartRef.current;
      classSwipeStartRef.current = null;
      if(!start || e.changedTouches?.length !== 1) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const dt = Date.now() - start.at;
      if(start.axis !== "x" || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.15){
        bounceDetailCardBack(Math.max(160, Math.min(240, 110 + dt * 0.2)));
        return;
      }
      if(dx > 0){
        if(animateSiblingCardChange(1, dx, dt)) void triggerAppHaptic("swipe");
        else bounceDetailCardBack();
      }else{
        if(animateSiblingCardChange(-1, dx, dt)) void triggerAppHaptic("swipe");
        else bounceDetailCardBack();
      }
    };
    const detailSurfaceTransition = detailSwipeTransitionMs ? `transform ${detailSwipeTransitionMs}ms cubic-bezier(.22,.8,.24,1)` : "none";
    const openAddEntryForClass = surfaceCls => {
      const _ks = getSlotsForSection(surfaceCls, instituteSections);
      const _used = new Set((((data.notes?.[surfaceCls.id] || {})[selectedDate]) || []).map(entry => entry.timeStart).filter(Boolean));
      const _def = _ks ? getDefaultKisSlot(data.notes, surfaceCls.id, _ks, _used) : null;
      setActiveClass(surfaceCls);
      setNewNote(
        _def && !_used.has(_def.start)
          ? {title:"",body:"",tag:"note",status:"",timeStart:_def.start,timeEnd:_def.end,_dur:_def.durMins,_kisSlot:true,_suggestedEnd:_def.end}
          : {title:"",body:"",tag:"note",status:"",...(_ks ? {} : (getSuggestedTime(data.notes, surfaceCls.id, selectedDate) || {_dur:surfaceCls?.duration || 60}))}
      );
      safeNav("addNote");
    };
    const openEditNoteForClass = (surfaceCls, note) => {
      setActiveClass(surfaceCls);
      setEditNote({...note});
      setView("editNote");
    };
    const deleteNoteFromClass = (surfaceCls, noteId) => setData(d => {
      const cn = d.notes[surfaceCls.id] || {};
      const dn = cn[selectedDate] || [];
      const note = dn.find(entry => entry.id === noteId);
      if(!note) return d;
      const tn = {...note,classId:surfaceCls.id,className:surfaceCls.section,institute:surfaceCls.institute,dateKey:selectedDate,deletedAt:Date.now()};
      return {
        ...d,
        notes:{...d.notes,[surfaceCls.id]:{...cn,[selectedDate]:dn.filter(entry => entry.id !== noteId)}},
        trash:{...d.trash,notes:[...(d.trash?.notes || []),tn]}
      };
    });
    const renderDetailSurface = (surfaceCls, panelKey) => {
      const surfaceColor = getSectionTone(surfaceCls.section);
      const surfaceTheme = getTeacherSectionSurfaceStyles(surfaceColor, isDarkTeacherTheme);
      const surfaceClassNotes = getClassNotes(surfaceCls.id);
      const surfaceDateNotes = getDateNotes(surfaceCls.id, selectedDate);
      const surfaceMetrics = teacherClassMetricsMap[surfaceCls.id] || buildClassEntryMetrics(surfaceClassNotes);
      const surfaceStatusTone = getTodayEntryStatusStyles(surfaceMetrics.todayEntries);
      return(
        <div key={`${panelKey}-${surfaceCls.id || "class"}`} style={{flex:"0 0 100%",width:"100%",height:"100%",overflowY:"auto",padding:`12px 14px ${mobileBottomNavPad}`,boxSizing:"border-box",WebkitOverflowScrolling:"touch",overscrollBehaviorY:"contain"}}>
          <div className="ledgr-card" style={{background:G.surface,border:`1px solid ${isDarkTeacherTheme ? G.borderM : "rgba(15,23,42,0.92)"}`,borderRadius:24,overflow:"hidden",boxShadow:G.shadowMd,marginBottom:14}}>
            <div style={{background:surfaceTheme.headerBg,padding:"14px 14px 12px",borderBottom:`1px solid ${surfaceTheme.headerBorder}`}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:28,fontWeight:800,color:surfaceTheme.titleColor,fontFamily:G.display,letterSpacing:-0.6,lineHeight:1.02}}>{surfaceCls.section}</div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:7,background:surfaceTheme.chipBg,border:`1px solid ${surfaceTheme.chipBorder}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,color:surfaceTheme.chipText,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <span style={{width:8,height:8,borderRadius:999,background:surfaceColor.bg,flexShrink:0}}/>
                      {surfaceCls.institute || "No institute"}
                    </span>
                    {surfaceCls.subject&&<span style={{display:"inline-flex",alignItems:"center",background:surfaceTheme.chipBg,border:`1px solid ${surfaceTheme.chipBorder}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:700,color:surfaceTheme.chipText,whiteSpace:"nowrap",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis"}}>{surfaceCls.subject}</span>}
                    <span style={{display:"inline-flex",alignItems:"center",gap:6,background:surfaceStatusTone.background,border:`1px solid ${surfaceStatusTone.border}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontWeight:800,color:surfaceStatusTone.color,whiteSpace:"nowrap"}}>
                      <span style={{width:7,height:7,borderRadius:999,background:"currentColor",flexShrink:0}}/>
                      {surfaceStatusTone.label}
                    </span>
                  </div>
                </div>
                <OverflowMenu items={[
                  { icon:IconEdit, label:"Edit class", onClick:()=>setEditingClass(surfaceCls) },
                  { icon:IconTrash, label:"Delete class", danger:true, onClick:()=>setLeaveModal(surfaceCls.id) },
                ]}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
                {[
                  { label:"Today", value:surfaceMetrics.todayEntries, color:surfaceTheme.primaryAccent },
                  { label:surfaceMetrics.monthLabel, value:surfaceMetrics.monthEntries, color:G.textS },
                  { label:"Total", value:surfaceMetrics.totalCount, color:G.text },
                  { label:"Logged days", value:surfaceMetrics.activeDays, color:G.textS },
                ].map(item=>(
                  <div key={item.label} style={{background:surfaceTheme.statBg,border:`1px solid ${surfaceTheme.statBorder}`,borderRadius:14,padding:"11px 10px 10px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:800,color:item.color,fontFamily:G.display,lineHeight:1}}>{item.value}</div>
                    <div style={{fontSize:10.5,color:G.textL,marginTop:5,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"14px 14px 16px"}}>
              <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={surfaceMetrics.noteDates}/>
            </div>
          </div>

          <div className="ledgr-card" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10,background:G.surface,border:`1px solid ${G.border}`,borderRadius:18,padding:"12px 14px",boxShadow:G.shadowSm}}>
            <div>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>Date focus</div>
              <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>{formatDateLabel(selectedDate)}</div>
              <div style={{fontSize:13,color:surfaceDateNotes.length>0?G.green:G.textM,fontWeight:700,marginTop:3,fontFamily:G.mono}}>{surfaceDateNotes.length} {surfaceDateNotes.length===1?"entry":"entries"}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                <span style={{...surfaceMetrics.lastLogTone,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:800,fontFamily:G.mono}}>{surfaceMetrics.lastLogMeta.label}</span>
                {swipePool.length > 1 && <span style={{fontSize:11.5,color:G.textL,fontWeight:700}}>Swipe left or right to change class</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <button
                onClick={()=>{setActiveClass(surfaceCls);setHistoryClassId(surfaceCls.id);}}
                disabled={surfaceMetrics.totalCount===0}
                style={{
                  background:surfaceMetrics.totalCount===0?G.bg:G.surface,
                  color:surfaceMetrics.totalCount===0?G.textL:G.textS,
                  border:`1px solid ${surfaceMetrics.totalCount===0?G.border:G.borderM}`,
                  borderRadius:12,
                  padding:"11px 18px",
                  fontSize:15,
                  cursor:surfaceMetrics.totalCount===0?"not-allowed":"pointer",
                  fontFamily:G.sans,
                  fontWeight:700,
                  display:"flex",
                  alignItems:"center",
                  gap:6,
                  minHeight:48,
                  WebkitTapHighlightColor:"transparent",
                  flexShrink:0
                }}>
                <AppIcon icon={IconHistory} size={16} color={surfaceMetrics.totalCount===0?G.textL:G.textS} /> History
              </button>
              {canAdd&&<button onClick={()=>openAddEntryForClass(surfaceCls)} onPointerDown={e=>rpl(e,true)}
                style={{background:surfaceTheme.primaryButtonBg,color:surfaceTheme.primaryButtonText,border:"none",borderRadius:12,padding:"11px 22px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:6,minHeight:48,WebkitTapHighlightColor:"transparent",flexShrink:0}}>
                + Add Entry
              </button>}
            </div>
          </div>

          {surfaceDateNotes.length===0?(
            <div style={{background:surfaceTheme.emptyBg,borderRadius:18,border:`2px dashed ${G.border}`,padding:"48px 20px",textAlign:"center",boxShadow:G.shadowSm}}>
              <div style={{width:60,height:60,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><AppIcon icon={IconEdit} size={28} color={G.textM} /></div>
              <div style={{fontSize:16,color:G.textM,fontWeight:600}}>{canAdd?"No entries yet":"No entries for this date"}</div>
              {canAdd&&<div style={{fontSize:14,color:G.textL,marginTop:6}}>Tap + Add Entry to log this class</div>}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {isReadOnlyDate&&(
                <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
                  Viewing past entries only. Dates older than the past week cannot be edited.
                </div>
              )}
              {surfaceDateNotes.map(note=>{
                const tag=(note?.tag&&TAG_STYLES[note.tag])||TAG_STYLES.note;
                return(
                  <div key={note.id} className="ledgr-card" style={{background:surfaceTheme.noteBg,borderRadius:16,border:`1px solid ${surfaceTheme.noteBorder}`,overflow:"hidden",boxShadow:reduceEffects?"none":G.shadowMd}}>
                    <div style={{height:4,background:tag.bg}}/>
                    <div style={{padding:"14px 15px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:note.title?8:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:13,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"3px 10px",border:`1px solid ${G.borderM}`,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><AppIcon icon={IconClockHour4} size={13} color={G.textS} />{formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            {note.status&&STATUS_STYLES[note.status]&&<span style={{background:STATUS_STYLES[note.status].bg,color:STATUS_STYLES[note.status].text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.sans,fontWeight:600}}>{STATUS_STYLES[note.status].label}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:700,fontSize:17,color:G.text,fontFamily:G.display,lineHeight:1.3,marginBottom:4}}>{note.title}</div>}
                          {note.body&&<p style={{margin:0,fontSize:15,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                        </div>
                        {canAdd&&(
                          <OverflowMenu items={[
                            { icon:IconEdit, label:"Edit entry", onClick:()=>openEditNoteForClass(surfaceCls, note) },
                            { icon:IconTrash, label:"Delete entry", danger:true, onClick:()=>deleteNoteFromClass(surfaceCls, note.id) },
                          ]}/>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    };
    return(
      <div key={cls.id} className="ledgr-page" style={{...teacherThemeShell,height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.pageBg,fontFamily:G.sans,overflow:"hidden",touchAction:"pan-y"}} onTouchStart={handleDetailTouchStart} onTouchMove={handleDetailTouchMove} onTouchEnd={handleDetailTouchEnd} onTouchCancel={()=>{classSwipeStartRef.current=null;bounceDetailCardBack(160);}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} onViewNotifications={()=>safeNav("notifications")} notificationCount={notificationCount} showProfileMenu={!isMobile}
          right={<GhostBtn onClick={()=>setView("home")} style={{display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Classes</GhostBtn>}
        />
        <div style={{flex:1,overflow:"hidden"}}>
          <div style={{height:"100%",overflow:"hidden"}}>
            <div style={{display:"flex",height:"100%",transform:`translateX(calc(-100% + ${detailSwipeOffset}px))`,transition:detailSurfaceTransition,willChange:"transform",backfaceVisibility:"hidden"}}>
              {renderDetailSurface(leftSwipeClass,"left")}
              {renderDetailSurface(cls,"center")}
              {renderDetailSurface(rightSwipeClass,"right")}
            </div>
          </div>
        </div>
        {renderTeacherBottomBar("classDetail")}
      </div>
    );
  }
  if(view==="addClass"){
    const selectedInstitute = newClass.institute || preferredInstitute;
    const comboSuggestions = recentClassCombos
      .filter(combo=>!selectedInstitute || combo.institute===selectedInstitute)
      .slice(0,4);

    // ── Group-aware section logic ──────────────────────────────────────────
    const instData = getInstituteSectionConfig(instituteSections, selectedInstitute);
    const gradeGroups = (instData?.gradeGroups || []).filter(g=>(g.sections||[]).length>0);
    const extraSections = instData?.extraSections || [];
    const hasGroups = gradeGroups.length > 0;

    // Sections to show in the dropdown, depending on selected group pill
    let sectionOptions;
    if (!hasGroups) {
      // No groups → flat list (legacy behaviour)
      sectionOptions = sortedByUsage(
        getInstituteSectionOptions(data.classes || [], data.sections || [], instituteSections, selectedInstitute),
        "section"
      );
    } else if (!selectedGroup) {
      // Groups exist but none chosen yet → show nothing (force picking a group first)
      sectionOptions = [];
    } else if (selectedGroup === "other") {
      // "Other" pill → standalone extraSections + locally saved sections
      const localSections = (data.classes||[])
        .filter(c=>c.institute===selectedInstitute)
        .map(c=>c.section)
        .filter(Boolean);
      const allGroupSectionKeys = new Set(gradeGroups.flatMap(g=>g.sections||[]).map(s=>s.trim().toLowerCase()));
      const standalones = [...new Set([...extraSections,...localSections])]
        .filter(s=>!allGroupSectionKeys.has(s.trim().toLowerCase()));
      sectionOptions = standalones;
    } else {
      // Specific group pill chosen → only that group's sections
      sectionOptions = selectedGroup.sections || [];
    }

    const hasOfficialSections = getInstituteSectionNames(instData).length > 0;
    const sectionLabel = getInstituteSectionEntityLabels(instData);

    // Reset section when institute changes
    const handleInstituteChange = s => {
      setNewClass(c=>({...c,institute:s,section:""}));
      setSelectedGroup(null);
    };
    // Reset section when group changes
    const handleGroupChange = grp => {
      setSelectedGroup(grp);
      setNewClass(c=>({...c,section:""}));
    };

    return(
    <div style={{...teacherThemeShell,minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.pageBg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>{setSelectedGroup(null);setView("home");}} onSignOut={()=>setSignOutPrompt(true)} onViewNotifications={()=>safeNav("notifications")} notificationCount={notificationCount} showProfileMenu={!isMobile}
        right={<GhostBtn onClick={()=>{setSelectedGroup(null);setView("home");}} style={{display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Back</GhostBtn>}/>
      <div style={{maxWidth:520,margin:"0 auto",padding:"24px 16px calc(80px + env(safe-area-inset-bottom, 0px))"}}>
        <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:6,textTransform:"uppercase",fontWeight:600}}>New Class</p>
        <h2 style={{marginBottom:28,fontSize:30,letterSpacing:-0.5,fontFamily:G.display}}>Add a class</h2>
        <div className="form-card" style={{...card,padding:"26px"}}>
          <div style={{background:G.greenL,borderRadius:10,padding:"10px 14px",marginBottom:22,fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
            <AppIcon icon={IconUser} size={16} color={G.green} /><span>Logged in as: <strong>{teacherName}</strong></span>
          </div>
          <label style={lbl}>Institute</label>
          <ReadOnlyDropdown value={newClass.institute} onChange={handleInstituteChange} options={globalInstitutes} placeholder="Select your institute" emptyMsg="No institutes yet — contact your admin to get one added."/>
          {globalInstitutes.length === 0 && (
            <div style={{marginTop:8,padding:"10px 14px",borderRadius:10,background:"#FFF7ED",border:"1px solid #FED7AA",fontSize:13,color:"#9A3412",lineHeight:1.6}}>
              Your admin hasn't created any institutes yet. Contact them to get your institute added before you can create a class.
            </div>
          )}
          {preferredInstitute&&newClass.institute===preferredInstitute&&(
            <div style={{fontSize:12,color:G.green,fontWeight:700,marginTop:-3,marginBottom:10}}>Using your most common institute to save time.</div>
          )}

          {/* ── Group pill selector (only when institute has groups) ── */}
          {hasGroups&&selectedInstitute&&(
            <div style={{marginTop:14,marginBottom:2}}>
              <label style={lbl}>Stream / Group</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
                {gradeGroups.map(grp=>{
                  const isActive = selectedGroup && selectedGroup!=="other" && selectedGroup.id===grp.id;
                  return(
                    <button key={grp.id} type="button"
                      onClick={()=>handleGroupChange(isActive?null:grp)}
                      style={{
                        padding:"8px 16px",borderRadius:999,border:`1.5px solid ${isActive?G.blue:G.border}`,
                        background:isActive?G.blue:"#fff",
                        color:isActive?"#fff":G.textM,
                        fontSize:13,fontWeight:isActive?700:500,
                        cursor:"pointer",fontFamily:G.sans,
                        transition:"all 0.15s",
                        WebkitTapHighlightColor:"transparent",
                      }}>
                      {grp.label}
                    </button>
                  );
                })}
                {extraSections.length>0&&(
                  <button type="button"
                    onClick={()=>handleGroupChange(selectedGroup==="other"?null:"other")}
                    style={{
                      padding:"8px 16px",borderRadius:999,border:`1.5px solid ${selectedGroup==="other"?G.textM:G.border}`,
                      background:selectedGroup==="other"?G.textS:"#fff",
                      color:selectedGroup==="other"?"#fff":G.textM,
                      fontSize:13,fontWeight:selectedGroup==="other"?700:500,
                      cursor:"pointer",fontFamily:G.sans,
                      transition:"all 0.15s",
                      WebkitTapHighlightColor:"transparent",
                    }}>
                    Other
                  </button>
                )}
              </div>
              {!selectedGroup&&(
                <div style={{fontSize:12,color:G.textL,marginTop:8,lineHeight:1.5}}>
                  Select a stream above to see its {sectionLabel.plural}.
                </div>
              )}
            </div>
          )}

          {/* ── Section dropdown ── */}
          {(!hasGroups || selectedGroup) && (
            <>
              <label style={{...lbl,marginTop:14}}>{sectionLabel.singular.charAt(0).toUpperCase()+sectionLabel.singular.slice(1)} / Section</label>
              <CreatableDropdown
                value={newClass.section}
                onChange={s=>setNewClass(c=>({...c,section:s}))}
                options={sectionOptions}
                placeholder={`e.g. ${sectionOptions[0]||"9th A, 10th B"}`}
                addPlaceholder="Type class or section…"
              />
              {hasOfficialSections&&(
                <div style={{fontSize:12,color:G.textL,marginTop:8,lineHeight:1.6}}>
                  Only admin-created sections are shown. If your section is missing, contact your admin.
                </div>
              )}
            </>
          )}

          <label style={{...lbl,marginTop:14}}>Subject</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
          {comboSuggestions.length>0&&(
            <div style={{marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:G.textL,marginBottom:8}}>Recent combinations</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {comboSuggestions.map((combo,idx)=>(
                  <button key={`${combo.institute}-${combo.section}-${combo.subject}-${idx}`} type="button"
                    onClick={()=>{
                      // When picking a combo, also auto-select the matching group
                      if(hasGroups){
                        const matchGroup = gradeGroups.find(g=>(g.sections||[]).some(s=>s.trim().toLowerCase()===combo.section.trim().toLowerCase()));
                        setSelectedGroup(matchGroup || (extraSections.some(s=>s.trim().toLowerCase()===combo.section.trim().toLowerCase()) ? "other" : null));
                      }
                      setNewClass(c=>({...c,institute:combo.institute||c.institute,section:combo.section,subject:combo.subject}));
                    }}
                    style={{padding:"8px 12px",borderRadius:20,border:`1px solid ${G.border}`,background:G.surface,color:G.textM,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:G.sans,WebkitTapHighlightColor:"transparent"}}>
                    {combo.section||"Untitled class"}{combo.subject?` · ${combo.subject}`:""}
                  </button>
                ))}
              </div>
            </div>
          )}
          <PrimaryBtn onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()||globalInstitutes.length===0} onPointerDown={e=>rpl(e,true)} style={{marginTop:16,width:"100%",padding:"13px",fontSize:16}}>Add Class</PrimaryBtn>
        </div>
      </div>
    </div>
    );
  }

  // ── TRASH ─────────────────────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════════
  // STATS CLASS TIMELINE
  // ══════════════════════════════════════════════════════════════════════
  if(view==="classTimeline" && statsClassId){
    function fmtMins(m){
      if(!m || m <= 0) return "0m";
      const h = Math.floor(m / 60);
      const min = m % 60;
      return min ? `${h}h ${min}m` : `${h}h`;
    }

    const timelineClass = (data.classes || []).find(cls => String(cls?.id || "") === String(statsClassId || "")) || null;
    if(!timelineClass){
      return(
        <TeacherStateFallback
          themeShell={teacherThemeShell}
          view={view}
          resolvedView="stats"
          activeClassId={statsClassId}
          classCount={(data.classes || []).length}
          notificationCount={notificationCount}
          onResetHome={() => {
            setStatsClassId(null);
            _setView("stats");
          }}
        />
      );
    }

    const timelineColor = getSectionTone(timelineClass.section);
    const timelineNotes = data.notes?.[timelineClass.id] || {};
    const timelineTheme = getTeacherAnalyticsSurfaceStyles(timelineColor.bg, isDarkTeacherTheme);
    const timelineRangeKeys = buildTimelineRangeKeys();
    const timelineSnapshot = buildTimelineSnapshotFromEntries(collectClassTimelineEntries(timelineNotes), timelineRangeKeys);
    const timelineSummary = timelineSnapshot.total;
    const timelineEntries = timelineSummary.entries;
    const groupedTimeline = timelineSummary.groupedTimeline;
    const totalTimelineMinutes = timelineSummary.totalTimelineMinutes;
    const maxDayMinutes = timelineSummary.maxDayMinutes;
    const untimedEntryCount = timelineSummary.untimedEntryCount;
    const topicSummaries = timelineSummary.topicSummaries;
    const latestTopic = timelineSummary.latestTopic;
    const ongoingTopic = timelineSummary.ongoingTopic;
    const firstEntry = timelineSummary.firstEntry;
    const latestEntry = timelineSummary.latestEntry;
    const timelineWeekBars = timelineSnapshot.weekBars;
    const timelineWeekMaxMinutes = Math.max(1, ...timelineWeekBars.map(day => day.minutes || 0));
    const timelineSummaryCards = [
      { label:"Today", value:fmtMins(timelineSnapshot.today.totalTimelineMinutes), note:`${timelineSnapshot.today.entryCount} entr${timelineSnapshot.today.entryCount === 1 ? "y" : "ies"}` },
      { label:"This week", value:fmtMins(timelineSnapshot.week.totalTimelineMinutes), note:`${timelineSnapshot.week.entryCount} entr${timelineSnapshot.week.entryCount === 1 ? "y" : "ies"}` },
      { label:"This month", value:fmtMins(timelineSnapshot.month.totalTimelineMinutes), note:`${timelineSnapshot.month.entryCount} entr${timelineSnapshot.month.entryCount === 1 ? "y" : "ies"}` },
      { label:"Active days", value:String(timelineSummary.activeDayCount), note:`${timelineSummary.timedSessionCount} timed session${timelineSummary.timedSessionCount === 1 ? "" : "s"}` },
    ];
    const timelineBackButtonStyle = {
      background:timelineTheme.buttonBg,
      border:`1px solid ${timelineTheme.buttonBorder}`,
      borderRadius:10,
      padding:"8px 12px",
      cursor:"pointer",
      color:timelineTheme.buttonText,
      fontSize:13,
      fontWeight:700,
      display:"flex",
      alignItems:"center",
      gap:6,
      minHeight:40,
      WebkitTapHighlightColor:"transparent",
      fontFamily:G.sans,
    };

    return(
      <div style={{...teacherThemeShell,minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.pageBg,fontFamily:G.sans,display:"flex",flexDirection:"column"}}>
        {sharedModals}
        <TopNav
          user={user}
          teacherName={teacherName}
          data={data}
          onLogoClick={()=>safeNav("stats")}
          onSignOut={()=>setSignOutPrompt(true)}
          onViewNotifications={()=>safeNav("notifications")}
          notificationCount={notificationCount}
          showProfileMenu={!isMobile}
          right={<button onClick={()=>safeNav("stats")} style={timelineBackButtonStyle}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Stats</button>}
        />
        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:`16px 14px ${isMobile ? mobileBottomNavPad : "48px"}`,maxWidth:760,margin:"0 auto",width:"100%"}}>
          <div style={{background:timelineTheme.heroBg,border:`1px solid ${timelineTheme.heroBorder}`,borderRadius:24,padding:"18px 18px 16px",boxShadow:G.shadowMd,marginBottom:14}}>
            <div style={{fontSize:11,color:timelineTheme.heroEyebrow,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.62,marginBottom:8}}>Class timeline</div>
            <div style={{fontSize:28,fontWeight:800,color:timelineTheme.heroText,fontFamily:G.display,letterSpacing:-0.55,lineHeight:1.02}}>{timelineClass.section}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:7,background:timelineTheme.heroChipBg,color:timelineTheme.heroChipText,borderRadius:999,padding:"6px 11px",fontSize:12,fontWeight:700,border:`1px solid ${timelineTheme.heroChipBorder}`,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                <span style={{width:8,height:8,borderRadius:999,background:timelineColor.bg,flexShrink:0}}/>
                {timelineClass.institute || "No institute"}
              </span>
              {timelineClass.subject && <span style={{display:"inline-flex",alignItems:"center",background:timelineTheme.heroChipBg,color:timelineTheme.heroChipText,borderRadius:999,padding:"6px 11px",fontSize:12,fontWeight:700,border:`1px solid ${timelineTheme.heroChipBorder}`,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{timelineClass.subject}</span>}
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginTop:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 260px",minWidth:0}}>
                <div style={{fontSize:12,color:timelineTheme.heroEyebrow,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.55,marginBottom:6}}>All-time teaching</div>
                <div style={{fontSize:42,fontWeight:800,color:timelineTheme.heroText,fontFamily:G.display,lineHeight:0.98,letterSpacing:-1.2}}>{fmtMins(totalTimelineMinutes)}</div>
                <div style={{fontSize:13.5,color:timelineTheme.heroMuted,lineHeight:1.6,marginTop:8}}>
                  {timelineEntries.length} entr{timelineEntries.length === 1 ? "y" : "ies"} • {timelineSummary.timedSessionCount} timed session{timelineSummary.timedSessionCount === 1 ? "" : "s"} • {topicSummaries.length} tracked topic{topicSummaries.length === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:10,flex:"1 1 320px",minWidth:0}}>
                <div style={{background:timelineTheme.metricSoftBg,border:`1px solid ${timelineTheme.metricSoftBorder}`,borderRadius:16,padding:"12px 13px"}}>
                  <div style={{fontSize:11,color:timelineTheme.heroEyebrow,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.55,marginBottom:6}}>
                    {ongoingTopic ? "Current topic" : "Latest topic"}
                  </div>
                  <div style={{fontSize:17,fontWeight:800,color:timelineTheme.heroText,fontFamily:G.display,letterSpacing:-0.22,lineHeight:1.15}}>
                    {ongoingTopic?.title || latestTopic?.title || "Topic details will appear as entries are added"}
                  </div>
                  {(ongoingTopic || latestTopic) && (
                    <div style={{fontSize:12.5,color:timelineTheme.heroMuted,lineHeight:1.55,marginTop:6}}>
                      Started {formatTimelineMoment((ongoingTopic || latestTopic).startedAtKey, (ongoingTopic || latestTopic).startedAtTime)}
                    </div>
                  )}
                </div>
                <div style={{background:timelineTheme.metricSoftBg,border:`1px solid ${timelineTheme.metricSoftBorder}`,borderRadius:16,padding:"12px 13px"}}>
                  <div style={{fontSize:11,color:timelineTheme.heroEyebrow,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.55,marginBottom:6}}>Latest log</div>
                  <div style={{fontSize:18,fontWeight:800,color:timelineTheme.heroText,fontFamily:G.display,letterSpacing:-0.22,lineHeight:1.15}}>
                    {latestEntry ? formatTimelineMoment(latestEntry.dateKey, latestEntry.timeStart) : "No entries yet"}
                  </div>
                  <div style={{fontSize:12.5,color:timelineTheme.heroMuted,lineHeight:1.55,marginTop:6}}>
                    {latestEntry?.title ? `Topic: ${latestEntry.title}` : "Every class log for this section will stack here in order."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:16}}>
            {timelineSummaryCards.map(item=>(
              <div key={item.label} style={{background:timelineTheme.metricBg,border:`1px solid ${timelineTheme.metricBorder}`,borderRadius:16,padding:"14px 14px 13px",boxShadow:G.shadowSm}}>
                <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.05,letterSpacing:-0.45}}>{item.value}</div>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.55,marginTop:7}}>{item.label}</div>
                <div style={{fontSize:12,color:G.textM,lineHeight:1.45,marginTop:6}}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{background:timelineTheme.sectionBg,border:`1px solid ${timelineTheme.sectionBorder}`,borderRadius:18,padding:"14px 14px 12px",boxShadow:G.shadowSm,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5}}>Current week</div>
                <div style={{fontSize:13.5,color:G.textL,marginTop:3}}>Teaching time by day for this section.</div>
              </div>
              <div style={{fontSize:12.5,color:G.textM,fontWeight:700}}>{fmtMins(timelineSnapshot.week.totalTimelineMinutes)} this week</div>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,height:88,marginBottom:10}}>
              {timelineWeekBars.map(day => (
                <div key={day.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                  <div title={`${day.fullLabel} • ${fmtMins(day.minutes)}`} style={{width:"100%",height:day.minutes > 0 ? `${Math.max(8, Math.round((day.minutes / timelineWeekMaxMinutes) * 78))}px` : "5px",borderRadius:"8px 8px 3px 3px",background:day.minutes > 0 ? timelineTheme.progressFill : timelineTheme.graphBase,transition:"height 0.22s ease-out"}} />
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              {timelineWeekBars.map(day => (
                <div key={day.key} style={{flex:1,textAlign:"center",fontSize:10.5,fontWeight:800,color:day.isToday ? timelineTheme.accent : G.textL,textTransform:"uppercase",letterSpacing:0.2}}>
                  {day.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
            {[
              {
                label:"First taught",
                value:firstEntry ? formatTimelineMoment(firstEntry.dateKey, firstEntry.timeStart) : "No entries yet",
                note:firstEntry?.title ? `Opened with ${firstEntry.title}` : "This becomes the section start point.",
              },
              {
                label:"Latest recorded",
                value:latestEntry ? formatTimelineMoment(latestEntry.dateKey, latestEntry.timeStart) : "No entries yet",
                note:latestEntry?.title ? `Most recent topic: ${latestEntry.title}` : "New activity will appear here.",
              },
              {
                label:"Untimed notes",
                value:String(untimedEntryCount),
                note:untimedEntryCount > 0 ? "These stay in the history even without duration." : "Every current entry here has a teaching time.",
              },
            ].map(item => (
              <div key={item.label} style={{background:timelineTheme.metricBg,border:`1px solid ${timelineTheme.metricBorder}`,borderRadius:18,padding:"15px 15px 14px",boxShadow:G.shadowSm}}>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.55,marginBottom:7}}>{item.label}</div>
                <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.18,lineHeight:1.2}}>{item.value}</div>
                <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:7}}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5}}>Topic journey</div>
                <div style={{fontSize:14,color:G.textL,marginTop:3}}>See when each topic started, when it closed, and how much time it took in this section.</div>
              </div>
              <div style={{fontSize:12.5,color:G.textM,fontWeight:700}}>{topicSummaries.length} tracked topic{topicSummaries.length!==1?"s":""}</div>
            </div>
            {topicSummaries.length === 0 ? (
              <div style={{background:timelineTheme.sectionBg,borderRadius:18,border:`2px dashed ${timelineTheme.sectionBorder}`,padding:"28px 20px",textAlign:"center",boxShadow:G.shadowSm}}>
                <div style={{width:56,height:56,borderRadius:16,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><AppIcon icon={IconBook2} size={26} color={G.textM} /></div>
                <div style={{fontSize:16,color:G.textM,fontWeight:700}}>Topic history will appear here</div>
                <div style={{fontSize:14,color:G.textL,marginTop:6}}>Once titled entries are added, this section will show when each topic started and how it progressed.</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {topicSummaries.map(topic => {
                  const latestStatusTone = topic.latestStatus && STATUS_STYLES[topic.latestStatus] ? STATUS_STYLES[topic.latestStatus] : null;
                  const latestTagTone = topic.latestTag && TAG_STYLES[topic.latestTag] ? TAG_STYLES[topic.latestTag] : null;
                  return(
                    <div key={topic.key} style={{background:timelineTheme.sectionBg,border:`1px solid ${timelineTheme.sectionBorder}`,borderRadius:18,padding:"15px 15px 14px",boxShadow:G.shadowSm}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.22,lineHeight:1.2}}>{topic.title}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:6,background:hexToRgba(timelineColor.bg, 0.12),color:timelineColor.bg,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,border:`1px solid ${hexToRgba(timelineColor.bg, 0.18)}`}}>
                              <AppIcon icon={IconClockHour4} size={13} color="currentColor" />
                              {fmtMins(topic.timedMinutes)}
                            </span>
                            <span style={{display:"inline-flex",alignItems:"center",gap:6,background:G.surfaceSoft,color:G.textM,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,border:`1px solid ${G.border}`}}>
                              <AppIcon icon={IconHistory} size={13} color="currentColor" />
                              {topic.sessions} session{topic.sessions!==1?"s":""}
                            </span>
                            <span style={{display:"inline-flex",alignItems:"center",gap:6,background:G.surfaceSoft,color:G.textM,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,border:`1px solid ${G.border}`}}>
                              <AppIcon icon={IconCalendar} size={13} color="currentColor" />
                              {topic.activeDays} active day{topic.activeDays!==1?"s":""}
                            </span>
                          </div>
                        </div>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6,background:topic.isCompleted ? G.greenL : hexToRgba(timelineColor.bg, 0.12),color:topic.isCompleted ? G.green : timelineColor.bg,borderRadius:999,padding:"6px 10px",fontSize:11.5,fontWeight:800,border:`1px solid ${topic.isCompleted ? "rgba(21,128,61,0.18)" : hexToRgba(timelineColor.bg, 0.18)}`}}>
                          <span style={{width:8,height:8,borderRadius:999,background:topic.isCompleted ? G.green : timelineColor.bg}} />
                          {topic.isCompleted ? "Completed" : "Ongoing"}
                        </span>
                      </div>

                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:10,marginTop:12}}>
                        <div style={{background:timelineTheme.sectionSoftBg,border:`1px solid ${timelineTheme.sectionSoftBorder}`,borderRadius:14,padding:"11px 12px"}}>
                          <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>Started</div>
                          <div style={{fontSize:14,fontWeight:700,color:G.text,lineHeight:1.45}}>{formatTimelineMoment(topic.startedAtKey, topic.startedAtTime)}</div>
                        </div>
                        <div style={{background:timelineTheme.sectionSoftBg,border:`1px solid ${timelineTheme.sectionSoftBorder}`,borderRadius:14,padding:"11px 12px"}}>
                          <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>{topic.isCompleted ? "Ended" : "Last seen"}</div>
                          <div style={{fontSize:14,fontWeight:700,color:G.text,lineHeight:1.45}}>{formatTimelineMoment(topic.endedAtKey, topic.endedAtTime)}</div>
                        </div>
                      </div>

                      {(latestStatusTone || latestTagTone || topic.latestBody) && (
                        <div style={{marginTop:12,background:timelineTheme.sectionSoftBg,border:`1px solid ${timelineTheme.sectionSoftBorder}`,borderRadius:14,padding:"11px 12px"}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:topic.latestBody ? 7 : 0}}>
                            {latestTagTone && <span style={{background:latestTagTone.bg,color:latestTagTone.text,fontSize:11,borderRadius:999,padding:"4px 8px",fontFamily:G.mono,fontWeight:700}}>{latestTagTone.label}</span>}
                            {latestStatusTone && <span style={{background:latestStatusTone.bg,color:latestStatusTone.text,fontSize:11,borderRadius:999,padding:"4px 8px",fontFamily:G.sans,fontWeight:700}}>{latestStatusTone.label}</span>}
                          </div>
                          {topic.latestBody && <div style={{fontSize:13.5,color:G.textS,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{topic.latestBody}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {groupedTimeline.length===0 ? (
            <div style={{background:timelineTheme.sectionBg,borderRadius:18,border:`2px dashed ${timelineTheme.sectionBorder}`,padding:"48px 20px",textAlign:"center",boxShadow:G.shadowSm}}>
              <div style={{width:60,height:60,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><AppIcon icon={IconClockHour4} size={28} color={G.textM} /></div>
              <div style={{fontSize:16,color:G.textM,fontWeight:600}}>No entries for this class yet</div>
              <div style={{fontSize:14,color:G.textL,marginTop:6}}>Once entries are added, this timeline will show every date and time block here.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5}}>Daily timeline</div>
                  <div style={{fontSize:14,color:G.textL,marginTop:3}}>Every saved session, note, and time block for this section in chronological order.</div>
                </div>
                <div style={{fontSize:12.5,color:G.textM,fontWeight:700}}>{timelineEntries.length} entry{timelineEntries.length!==1?"ies":"y"}</div>
              </div>
              {groupedTimeline.map(group=>(
                <div key={group.dateKey} style={{background:timelineTheme.sectionBg,border:`1px solid ${timelineTheme.sectionBorder}`,borderRadius:18,padding:"15px 15px 14px",boxShadow:G.shadowSm}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>{formatDateLabel(group.dateKey)}</div>
                      <div style={{fontSize:12,color:G.textM,marginTop:3}}>{group.entries.length} entry{group.entries.length!==1?"ies":"y"} · {fmtMins(group.timedMinutes)}</div>
                    </div>
                    <div style={{minWidth:isMobile?96:132,flex:isMobile?1:"0 0 132px",maxWidth:isMobile?"100%":"132px"}}>
                      <div style={{height:8,background:timelineTheme.progressTrack,borderRadius:999,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${group.timedMinutes > 0 ? Math.max(8, Math.round((group.timedMinutes / maxDayMinutes) * 100)) : 0}%`,background:timelineColor.bg,borderRadius:999,transition:"width 180ms ease-out"}}/>
                      </div>
                    </div>
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {group.entries.map((entry, entryIndex)=>{
                      const tag = (entry?.tag && TAG_STYLES[entry.tag]) || TAG_STYLES.note;
                      const statusTone = entry?.status && STATUS_STYLES[entry.status] ? STATUS_STYLES[entry.status] : null;
                      const isLast = entryIndex === group.entries.length - 1;
                      const hasTime = entry.durationMins > 0;
                      return(
                        <div key={entry.timelineKey || `${group.dateKey}-${entry.id || entryIndex}`} style={{display:"flex",gap:12,alignItems:"stretch"}}>
                          <div style={{width:isMobile?78:96,flexShrink:0,textAlign:"right",paddingTop:2}}>
                            <div style={{fontSize:12.5,fontWeight:800,color:G.text,fontFamily:G.mono,lineHeight:1.35}}>{entry.timeStart ? formatPeriod(entry.timeStart, entry.timeEnd) : "No time"}</div>
                            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginTop:4}}>{hasTime ? fmtMins(entry.durationMins) : "Untimed"}</div>
                          </div>
                          <div style={{width:18,position:"relative",display:"flex",justifyContent:"center",flexShrink:0}}>
                            {!isLast && <div style={{position:"absolute",top:12,bottom:-14,width:2,borderRadius:999,background:hexToRgba(timelineColor.bg, 0.24)}}/>}
                            <div style={{width:12,height:12,borderRadius:999,background:timelineColor.bg,border:`2px solid ${timelineTheme.sectionBg}`,boxShadow:`0 0 0 1px ${hexToRgba(timelineColor.bg, 0.22)}`,marginTop:6}}/>
                          </div>
                          <div style={{flex:1,minWidth:0,background:timelineTheme.sectionSoftBg,border:`1px solid ${timelineTheme.sectionSoftBorder}`,borderRadius:16,padding:"12px 13px 11px"}}>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:(entry.title || entry.body) ? 8 : 0}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:11.5,borderRadius:999,padding:"4px 9px",fontFamily:G.mono,fontWeight:700}}>{tag.label}</span>
                              {statusTone && <span style={{background:statusTone.bg,color:statusTone.text,fontSize:11.5,borderRadius:999,padding:"4px 9px",fontFamily:G.sans,fontWeight:700}}>{statusTone.label}</span>}
                            </div>
                            <div style={{fontSize:15,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.2,lineHeight:1.2}}>{entry.title || "Class entry"}</div>
                            {entry.body && <div style={{fontSize:14,color:G.textS,lineHeight:1.6,marginTop:6,whiteSpace:"pre-wrap"}}>{entry.body}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {renderTeacherBottomBar("stats")}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STATS VIEW — teaching hours breakdown
  // ══════════════════════════════════════════════════════════════════════
  if(view==="stats"){
    function fmtMins(m){
      if(!m||m<=0)return"0m";
      const h=Math.floor(m/60),min=m%60;
      return min?`${h}h ${min}m`:`${h}h`;
    }

    const statsRangeKeys = buildTimelineRangeKeys();
    const activeClasses = data.classes.filter(c=>!c.left);
    const classStats = activeClasses.map(cls => {
      const tone = getSectionTone(cls.section);
      const snapshot = buildTimelineSnapshotFromEntries(collectClassTimelineEntries(data.notes?.[cls.id] || {}), statsRangeKeys);
      const featuredTopic = snapshot.total.ongoingTopic || snapshot.total.latestTopic || null;
      return {
        cls,
        tone,
        snapshot,
        featuredTopic,
        latestEntry:snapshot.total.latestEntry,
        firstEntry:snapshot.total.firstEntry,
      };
    }).sort((a,b)=>(b.snapshot.total.totalTimelineMinutes-a.snapshot.total.totalTimelineMinutes) || (b.snapshot.total.entryCount-a.snapshot.total.entryCount) || a.cls.section.localeCompare(b.cls.section));

    const teacherSnapshot = buildTimelineSnapshotFromEntries(
      classStats.flatMap(item => item.snapshot.entriesAsc).sort(compareTimelineEntriesAsc),
      statsRangeKeys
    );
    const statsWeekMaxMinutes = Math.max(1, ...teacherSnapshot.weekBars.map(day => day.minutes || 0));
    const instituteCards = [...classStats.reduce((map, item) => {
      const bucketKey = String(item.cls.institute || "No institute").trim() || "No institute";
      const current = map.get(bucketKey) || {
        name:bucketKey,
        tone:instColor(bucketKey),
        classes:[],
        entriesAsc:[],
      };
      current.classes.push(item);
      current.entriesAsc.push(...item.snapshot.entriesAsc);
      map.set(bucketKey, current);
      return map;
    }, new Map()).values()].map(bucket => {
      const orderedEntries = [...bucket.entriesAsc].sort(compareTimelineEntriesAsc);
      const snapshot = buildTimelineSnapshotFromEntries(orderedEntries, statsRangeKeys);
      return {
        ...bucket,
        snapshot,
        latestEntry:snapshot.total.latestEntry,
      };
    }).sort((a,b)=>(b.snapshot.total.totalTimelineMinutes-a.snapshot.total.totalTimelineMinutes) || (b.snapshot.total.entryCount-a.snapshot.total.entryCount) || a.name.localeCompare(b.name));

    const statsBackTarget = teacherBackView === "profile" ? "profile" : "home";
    const statsContextLabel = statsBackTarget === "profile" ? "Profile insight" : "Teaching overview";
    const hasClasses = classStats.length > 0;
    const hasMultipleInstitutes = instituteCards.length > 1;
    const selectedInstituteCard = hasMultipleInstitutes
      ? instituteCards.find(item => item.name === statsInstituteName) || null
      : (instituteCards[0] || null);
    const statsAccent = selectedInstituteCard?.tone?.bg || (hasMultipleInstitutes ? (isDarkTeacherTheme ? "#4DB7C8" : "#0F6B78") : (classStats[0]?.tone?.bg || (isDarkTeacherTheme ? "#4DB7C8" : "#0F6B78")));
    const statsTheme = getTeacherAnalyticsSurfaceStyles(statsAccent, isDarkTeacherTheme);
    const visibleClassStats = hasMultipleInstitutes
      ? (selectedInstituteCard ? classStats.filter(item => (String(item.cls.institute || "No institute").trim() || "No institute") === selectedInstituteCard.name) : [])
      : classStats;
    const statsHeroCards = [
      { label:"Today", value:fmtMins(teacherSnapshot.today.totalTimelineMinutes), note:`${teacherSnapshot.today.entryCount} entr${teacherSnapshot.today.entryCount === 1 ? "y" : "ies"}` },
      { label:"This week", value:fmtMins(teacherSnapshot.week.totalTimelineMinutes), note:`${teacherSnapshot.week.entryCount} entr${teacherSnapshot.week.entryCount === 1 ? "y" : "ies"}` },
      { label:"This month", value:fmtMins(teacherSnapshot.month.totalTimelineMinutes), note:`${teacherSnapshot.month.entryCount} entr${teacherSnapshot.month.entryCount === 1 ? "y" : "ies"}` },
      { label:"Entries", value:String(teacherSnapshot.total.entryCount), note:`${teacherSnapshot.total.activeDayCount} active day${teacherSnapshot.total.activeDayCount === 1 ? "" : "s"}` },
    ];
    const latestLoggedEntry = teacherSnapshot.total.latestEntry;
    const navBtnStyle={background:statsTheme.buttonBg,border:`1px solid ${statsTheme.buttonBorder}`,borderRadius:10,padding:"8px 12px",cursor:"pointer",color:statsTheme.buttonText,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",fontFamily:G.sans};

    return(
      <div style={{...teacherThemeShell,minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.pageBg,fontFamily:G.sans,display:"flex",flexDirection:"column"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>safeNav(statsBackTarget)} onSignOut={()=>setSignOutPrompt(true)} onViewNotifications={()=>safeNav("notifications")} notificationCount={notificationCount} showProfileMenu={!isMobile}
          right={<button onClick={()=>safeNav(statsBackTarget)} style={navBtnStyle}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Back</button>}/>

        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:`16px 14px ${isMobile ? mobileBottomNavPad : "48px"}`,maxWidth:760,margin:"0 auto",width:"100%"}}>
          <div style={{background:statsTheme.metricBg,border:`1px solid ${statsTheme.metricBorder}`,borderRadius:18,padding:"16px 16px 15px",boxShadow:G.shadowSm,marginBottom:14}}>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.65,marginBottom:6}}>{statsContextLabel}</div>
            <div style={{fontSize:23,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.45,lineHeight:1.15,marginBottom:6}}>View stats</div>
            <div style={{fontSize:14,color:G.textM,lineHeight:1.6}}>Teaching time, current progress, and weekly rhythm stay together here so drilling into classes feels much cleaner.</div>
          </div>

          {!hasClasses?(
            <div style={{background:G.surface,borderRadius:16,border:`2px dashed ${G.border}`,padding:"48px 20px",textAlign:"center"}}>
              <div style={{width:62,height:62,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><AppIcon icon={IconChartBar} size={30} color={G.textM} /></div>
              <div style={{fontSize:16,fontWeight:600,color:G.textM}}>No classes yet</div>
              <div style={{fontSize:14,color:G.textL,marginTop:6}}>Once classes are added, their teaching timelines will appear here.</div>
            </div>
          ):(
            <>
              <div style={{background:statsTheme.heroBg,border:`1px solid ${statsTheme.heroBorder}`,borderRadius:24,padding:"20px",marginBottom:14,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{width:52,height:52,borderRadius:14,background:statsTheme.heroChipBg,border:`1px solid ${statsTheme.heroChipBorder}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><AppIcon icon={IconClockHour4} size={26} color={statsTheme.accent} /></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:statsTheme.heroEyebrow,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Total teaching time</div>
                  <div style={{fontSize:38,fontWeight:800,color:statsTheme.heroText,fontFamily:G.display,lineHeight:1,letterSpacing:-1.1}}>{fmtMins(teacherSnapshot.total.totalTimelineMinutes)}</div>
                  <div style={{fontSize:13.5,color:statsTheme.heroMuted,marginTop:5,lineHeight:1.5}}>{classStats.length} {classStats.length===1?"section":"sections"} • {teacherSnapshot.total.entryCount} entries • {teacherSnapshot.total.timedSessionCount} timed sessions</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:6,background:statsTheme.heroChipBg,color:statsTheme.heroChipText,borderRadius:999,padding:"6px 10px",fontSize:11.5,fontWeight:700,border:`1px solid ${statsTheme.heroChipBorder}`}}>
                      <AppIcon icon={IconCalendar} size={13} color="currentColor" />
                      {teacherSnapshot.total.activeDayCount} active day{teacherSnapshot.total.activeDayCount!==1?"s":""}
                    </span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:6,background:statsTheme.heroChipBg,color:statsTheme.heroChipText,borderRadius:999,padding:"6px 10px",fontSize:11.5,fontWeight:700,border:`1px solid ${statsTheme.heroChipBorder}`}}>
                      <AppIcon icon={IconBuilding} size={13} color="currentColor" />
                      {instituteCards.length} institute{instituteCards.length===1?"":"s"}
                    </span>
                    {latestLoggedEntry && <span style={{display:"inline-flex",alignItems:"center",gap:6,background:statsTheme.heroChipBg,color:statsTheme.heroChipText,borderRadius:999,padding:"6px 10px",fontSize:11.5,fontWeight:700,border:`1px solid ${statsTheme.heroChipBorder}`}}>Latest log {formatTimelineMoment(latestLoggedEntry.dateKey, latestLoggedEntry.timeStart)}</span>}
                  </div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
                {statsHeroCards.map(item => (
                  <div key={item.label} style={{background:statsTheme.metricBg,borderRadius:14,border:`1px solid ${statsTheme.metricBorder}`,padding:"14px 14px 13px",boxShadow:G.shadowSm}}>
                    <div style={{fontSize:11,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>{item.label}</div>
                    <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{item.value}</div>
                    <div style={{fontSize:12,color:G.textM,marginTop:6,lineHeight:1.45}}>{item.note}</div>
                  </div>
                ))}
              </div>

              <div style={{background:statsTheme.sectionBg,borderRadius:18,border:`1px solid ${statsTheme.sectionBorder}`,padding:14,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5}}>Current week</div>
                    <div style={{fontSize:13.5,color:G.textL,marginTop:3}}>The bars below always show this week’s teaching rhythm.</div>
                  </div>
                  <div style={{fontSize:12.5,color:G.textM,fontWeight:700}}>{fmtMins(teacherSnapshot.week.totalTimelineMinutes)} this week</div>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,height:88,marginBottom:10}}>
                  {teacherSnapshot.weekBars.map(day=>(
                    <div key={day.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                      <div title={`${day.fullLabel} • ${fmtMins(day.minutes)}`} style={{width:"100%",borderRadius:"8px 8px 3px 3px",background:day.minutes>0?statsTheme.progressFill:statsTheme.graphBase,
                        height:day.minutes>0?Math.max((day.minutes/statsWeekMaxMinutes)*78,8)+"px":"5px",transition:"height 0.5s cubic-bezier(0.22,1,0.36,1)",minHeight:5}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  {teacherSnapshot.weekBars.map(day=>(
                    <div key={day.key} style={{flex:1,textAlign:"center",fontSize:10.5,fontWeight:800,color:day.isToday?statsTheme.accent:G.textL,textTransform:"uppercase"}}>{day.label}</div>
                  ))}
                </div>
              </div>

              {selectedInstituteCard && hasMultipleInstitutes && (
                <div style={{background:statsTheme.sectionBg,borderRadius:18,border:`1px solid ${statsTheme.sectionBorder}`,padding:"14px 14px 12px",boxShadow:G.shadowSm,marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:12}}>
                    <div>
                      <button type="button" onClick={()=>setStatsInstituteName("")} style={{background:"transparent",border:"none",padding:0,fontSize:12,fontWeight:700,color:statsTheme.accent,cursor:"pointer",fontFamily:G.sans,display:"inline-flex",alignItems:"center",gap:5,marginBottom:7}}>
                        <AppIcon icon={IconChevronLeft} size={14} color="currentColor" />
                        All institutes
                      </button>
                      <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.35}}>{selectedInstituteCard.name}</div>
                      <div style={{fontSize:13.5,color:G.textL,marginTop:4}}>Choose a class below to open its full teaching timeline.</div>
                    </div>
                    <span style={{display:"inline-flex",alignItems:"center",gap:6,background:statsTheme.heroChipBg,border:`1px solid ${statsTheme.heroChipBorder}`,borderRadius:999,padding:"6px 10px",fontSize:11.5,fontWeight:800,color:statsTheme.heroChipText}}>
                      <span style={{width:8,height:8,borderRadius:999,background:selectedInstituteCard.tone.bg}} />
                      {selectedInstituteCard.classes.length} class{selectedInstituteCard.classes.length===1?"":"es"}
                    </span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:8}}>
                    {[
                      { label:"Total", value:fmtMins(selectedInstituteCard.snapshot.total.totalTimelineMinutes) },
                      { label:"Today", value:fmtMins(selectedInstituteCard.snapshot.today.totalTimelineMinutes) },
                      { label:"This week", value:fmtMins(selectedInstituteCard.snapshot.week.totalTimelineMinutes) },
                      { label:"This month", value:fmtMins(selectedInstituteCard.snapshot.month.totalTimelineMinutes) },
                    ].map(item => (
                      <div key={item.label} style={{background:statsTheme.sectionSoftBg,border:`1px solid ${statsTheme.sectionSoftBorder}`,borderRadius:14,padding:"11px 11px 10px"}}>
                        <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{item.value}</div>
                        <div style={{fontSize:10.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.45,marginTop:5}}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedInstituteCard && hasMultipleInstitutes ? (
                <>
                  <div style={{background:statsTheme.sectionBg,border:`1px solid ${statsTheme.sectionBorder}`,borderRadius:14,padding:"13px 14px",boxShadow:G.shadowSm,marginBottom:14}}>
                    <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                      Start with an institute so the next screen stays focused. After that, open any class to see its section timeline, topic journey, and weekly rhythm.
                    </div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Institutes</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {instituteCards.map(item => {
                      const cardTheme = getTeacherAnalyticsSurfaceStyles(item.tone.bg, isDarkTeacherTheme);
                      return (
                        <button key={item.name} type="button" onClick={()=>setStatsInstituteName(item.name)} style={{width:"100%",background:cardTheme.sectionBg,borderRadius:18,border:`1px solid ${cardTheme.sectionBorder}`,padding:"15px 15px 14px",cursor:"pointer",textAlign:"left",boxShadow:G.shadowSm,WebkitTapHighlightColor:"transparent"}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{width:12,height:12,borderRadius:999,background:item.tone.bg,flexShrink:0,boxShadow:`0 0 0 3px ${hexToRgba(item.tone.bg, 0.14)}`}} />
                                <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.18,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                              </div>
                              <div style={{fontSize:13.5,color:G.textM,marginTop:6}}>{item.classes.length} class{item.classes.length===1?"":"es"} • {item.snapshot.total.entryCount} entries</div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{fmtMins(item.snapshot.total.totalTimelineMinutes)}</div>
                              <div style={{fontSize:11.5,color:G.textL,marginTop:4}}>all time</div>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,minmax(0,1fr))":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:12}}>
                            {[
                              { label:"Today", value:fmtMins(item.snapshot.today.totalTimelineMinutes) },
                              { label:"Week", value:fmtMins(item.snapshot.week.totalTimelineMinutes) },
                              { label:"Month", value:fmtMins(item.snapshot.month.totalTimelineMinutes) },
                            ].map(metric => (
                              <div key={metric.label} style={{background:cardTheme.sectionSoftBg,border:`1px solid ${cardTheme.sectionSoftBorder}`,borderRadius:12,padding:"10px 10px 9px"}}>
                                <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{metric.value}</div>
                                <div style={{fontSize:10.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.48,marginTop:5}}>{metric.label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                            <div style={{fontSize:12.5,color:G.textM,lineHeight:1.5}}>
                              {item.latestEntry ? `Latest log ${formatTimelineMoment(item.latestEntry.dateKey, item.latestEntry.timeStart)}` : "No logged activity yet"}
                            </div>
                            <span style={{display:"inline-flex",alignItems:"center",gap:6,background:hexToRgba(item.tone.bg, 0.12),color:item.tone.bg,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,border:`1px solid ${hexToRgba(item.tone.bg, 0.18)}`}}>
                              View classes
                              <AppIcon icon={IconChevronRight} size={15} color="currentColor" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div style={{background:statsTheme.sectionBg,border:`1px solid ${statsTheme.sectionBorder}`,borderRadius:14,padding:"13px 14px",boxShadow:G.shadowSm,marginBottom:14}}>
                    <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                      Every class below opens its own full timeline with section-wise teaching hours, today/week/month totals, topic start-end markers, and every saved log in order.
                    </div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>
                    {selectedInstituteCard ? "Classes" : "All classes"}
                  </div>
                  {visibleClassStats.map(item=>{
                    const { cls, tone, snapshot, featuredTopic, latestEntry, firstEntry } = item;
                    const cardTheme = getTeacherAnalyticsSurfaceStyles(tone.bg, isDarkTeacherTheme);
                    const topicJourneyLabel = featuredTopic
                      ? `${featuredTopic.isCompleted ? "Completed" : "Started"} ${formatTimelineMoment(featuredTopic.startedAtKey, featuredTopic.startedAtTime)}`
                      : firstEntry
                        ? `First log ${formatTimelineMoment(firstEntry.dateKey, firstEntry.timeStart)}`
                        : "Open this timeline to start building the section story.";
                    return(
                      <button key={cls.id} type="button" onClick={()=>openStatsClassTimeline(cls.id)} style={{width:"100%",background:cardTheme.sectionBg,borderRadius:18,border:`1px solid ${cardTheme.sectionBorder}`,marginBottom:10,padding:"15px 15px 14px",cursor:"pointer",textAlign:"left",boxShadow:G.shadowSm,WebkitTapHighlightColor:"transparent"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                          <div style={{width:11,height:11,alignSelf:"center",borderRadius:999,background:tone.bg,flexShrink:0,boxShadow:`0 0 0 3px ${hexToRgba(tone.bg, 0.14)}`}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,background:cardTheme.sectionSoftBg,border:`1px solid ${cardTheme.sectionSoftBorder}`,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,color:G.textM,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                <span style={{width:8,height:8,borderRadius:999,background:tone.bg,flexShrink:0}} />
                                {cls.institute || "No institute"}
                              </span>
                              {cls.subject && <span style={{display:"inline-flex",alignItems:"center",background:cardTheme.sectionSoftBg,border:`1px solid ${cardTheme.sectionSoftBorder}`,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,color:G.textM,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.subject}</span>}
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{fmtMins(snapshot.total.totalTimelineMinutes)}</div>
                            <div style={{fontSize:11.5,color:G.textL,marginTop:4}}>all time</div>
                          </div>
                        </div>

                        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:8,marginBottom:12}}>
                          {[
                            { label:"Today", value:fmtMins(snapshot.today.totalTimelineMinutes) },
                            { label:"Week", value:fmtMins(snapshot.week.totalTimelineMinutes) },
                            { label:"Month", value:fmtMins(snapshot.month.totalTimelineMinutes) },
                            { label:"Entries", value:String(snapshot.total.entryCount) },
                          ].map(metric => (
                            <div key={metric.label} style={{background:cardTheme.sectionSoftBg,border:`1px solid ${cardTheme.sectionSoftBorder}`,borderRadius:12,padding:"10px 10px 9px"}}>
                              <div style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{metric.value}</div>
                              <div style={{fontSize:10.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.48,marginTop:5}}>{metric.label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{background:cardTheme.sectionSoftBg,border:`1px solid ${cardTheme.sectionSoftBorder}`,borderRadius:14,padding:"12px 12px 11px",marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.5}}>
                              {featuredTopic ? (featuredTopic.isCompleted ? "Latest completed topic" : "Current topic") : "Topic journey"}
                            </div>
                            <div style={{fontSize:11.5,fontWeight:700,color:G.textM}}>{snapshot.total.completedTopicCount} completed</div>
                          </div>
                          <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.15,lineHeight:1.2,marginTop:7}}>
                            {featuredTopic?.title || latestEntry?.title || "Open full timeline to inspect topic-by-topic teaching history"}
                          </div>
                          <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:7}}>{topicJourneyLabel}</div>
                          {featuredTopic && (
                            <div style={{fontSize:12.5,color:G.textL,lineHeight:1.55,marginTop:5}}>
                              {featuredTopic.isCompleted
                                ? `Ended ${formatTimelineMoment(featuredTopic.endedAtKey, featuredTopic.endedAtTime)}`
                                : `Last seen ${formatTimelineMoment(featuredTopic.endedAtKey, featuredTopic.endedAtTime)}`}
                            </div>
                          )}
                        </div>

                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                          <div style={{fontSize:12.5,color:G.textM,lineHeight:1.5}}>
                            {latestEntry ? `Latest log ${formatTimelineMoment(latestEntry.dateKey, latestEntry.timeStart)}` : "No logged activity yet"}
                          </div>
                          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:hexToRgba(tone.bg, 0.12),color:tone.bg,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,border:`1px solid ${hexToRgba(tone.bg, 0.18)}`}}>
                            Open full timeline
                            <AppIcon icon={IconChevronRight} size={15} color="currentColor" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
        {renderTeacherBottomBar("stats")}
      </div>
    );
  }

  if(view==="trash"){
    const tClasses=(Array.isArray(data.trash?.classes)?data.trash.classes:[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const tNotes=(Array.isArray(data.trash?.notes)?data.trash.notes:[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const daysLeft=ts=>Math.max(0,30-Math.floor((Date.now()-ts)/(1000*60*60*24)));
    return(
      <div style={{...teacherThemeShell,minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.pageBg,fontFamily:G.sans}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>safeNav("home")} onSignOut={()=>setSignOutPrompt(true)} onViewStats={()=>openStatsView("profile")} onViewTrash={()=>setView("trash")} onViewNotifications={()=>safeNav("notifications")} trashCount={trashCount} notificationCount={notificationCount} right={<GhostBtn onClick={()=>safeNav(mobileBackTarget)} style={{display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Back</GhostBtn>} showProfileMenu={!isMobile}/>
        <div className="mobile-pad" style={{maxWidth:880,margin:"0 auto",padding:`32px 32px ${isMobile ? mobileBottomNavPad : "72px"}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <AppIcon icon={IconTrash} size={28} color={G.text} />
            <h2 style={{fontSize:26,letterSpacing:-0.5}}>Recycle Bin</h2>
          </div>
          <p style={{fontSize:15,color:G.textM,fontFamily:G.sans,marginBottom:28}}>Items are permanently deleted after 30 days.</p>

          {tClasses.length===0&&tNotes.length===0&&(
            <div style={{...card,textAlign:"center",padding:"72px 20px"}}>
              <div style={{width:64,height:64,borderRadius:18,background:G.surfaceSoft,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><AppIcon icon={IconCheck} size={30} color={G.green} /></div>
              <h3 style={{fontSize:19,color:G.text,fontFamily:G.display,marginBottom:6}}>Recycle bin is empty</h3>
              <p style={{fontSize:15,color:G.textM}}>Deleted classes and entries will appear here.</p>
            </div>
          )}

          {tClasses.length>0&&(
            <div style={{marginBottom:32}}>
              <p style={{fontSize:14,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Classes ({tClasses.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {tClasses.map(tc=>{
                  const color=getSectionTone(tc.section);
                  const ec=Object.values(tc.savedNotes||{}).reduce((s,arr)=>s+(Array.isArray(arr)?arr.length:0),0);
                  const dl=daysLeft(tc.deletedAt);
                  return(
                    <div key={tc.id} className="trash-row" style={{...card,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
                      <div style={{width:4,alignSelf:"stretch",borderRadius:999,background:color.bg,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{tc.section}</div>
                        <div style={{fontSize:14,color:G.textM,marginTop:2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><AppIcon icon={IconBuilding} size={14} color={G.textM} />{tc.institute}{tc.subject?` · ${tc.subject}`:""} · {ec} entries</div>
                        <div style={{fontSize:14,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:4,display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconClockHour4} size={14} color={dl<=7?G.red:G.textM} />{dl} day{dl!==1?"s":""} until permanent deletion</div>
                      </div>
                      <div className="trash-row-btns" style={{display:"flex",gap:8,flexShrink:0}}>
                        <button onClick={()=>restoreClass(tc)} onPointerDown={e=>rpl(e,false)}
                          style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconRestore} size={15} color={G.green} />Restore</button>
                        <button onClick={()=>setConfirmModal({message:`Permanently delete "${tc.section}"? This cannot be undone.`,label:"Delete Class",onConfirm:()=>permDeleteClass(tc.id)})}
                          style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"8px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans}}>Delete Forever</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tNotes.length>0&&(
            <div>
              <p style={{fontSize:14,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Entries ({tNotes.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tNotes.map(tn=>{
                  const tag=TAG_STYLES[tn.tag]||TAG_STYLES.note;
                  const dl=daysLeft(tn.deletedAt);
                  const classExists=data.classes.some(c=>c.id===tn.classId);
                  return(
                    <div key={tn.id} style={{...card,overflow:"hidden"}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"13px 18px",display:"flex",alignItems:"flex-start",gap:14}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:10,padding:"2px 8px",fontFamily:G.mono}}>{tag.label}</span>
                            <span style={{fontSize:14,color:G.textM,fontFamily:G.sans}}>{formatDateLabel(tn.dateKey)}</span>
                            <span style={{fontSize:12,color:G.textM}}>· {tn.className} · {tn.institute}</span>
                          </div>
                          {tn.title&&<div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{tn.title}</div>}
                          {tn.body&&<div style={{fontSize:14,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tn.body}</div>}
                          <div style={{fontSize:14,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:5,display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconClockHour4} size={14} color={dl<=7?G.red:G.textM} />{dl} day{dl!==1?"s":""} until permanent deletion</div>
                        </div>
                        <div style={{display:"flex",gap:8,flexShrink:0}}>
                          {classExists
                            ?<button onClick={()=>restoreNote(tn)} style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"7px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconRestore} size={15} color={G.green} />Restore</button>
                            :<span style={{fontSize:14,color:G.textL,fontFamily:G.sans,padding:"7px 4px"}}>Class deleted</span>}
                          <button onClick={()=>setConfirmModal({message:"Permanently delete this entry? Cannot be undone.",label:"Delete Entry",onConfirm:()=>permDeleteNote(tn.id)})}
                            style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"7px 12px",fontSize:14,cursor:"pointer",fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center"}}><AppIcon icon={IconX} size={15} color={G.red} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {renderTeacherBottomBar("trash")}
      </div>
    );
  }

  // ── ADD / EDIT NOTE ───────────────────────────────────────────────────────
  if(view==="addNote"||view==="editNote"){
    const isEdit=view==="editNote";
    const form=isEdit?editNote:newNote;
    const setForm=isEdit?setEditNote:setNewNote;
    const save=isEdit?saveEdit:addNote;
    const color=activeClass?getSectionTone(activeClass.section):getSectionTone("");
    const hasExtraDetails=Boolean((form.title||"").trim()||(form.body||"").trim());
    const saveLabel=isEdit?"Save Changes":hasExtraDetails?"Save Entry":"Quick Save";
    const lastTopicSuggestion=form.status==="inprogress" ? (getClassUrgencyMeta(activeClass).lastTopic||"").trim() : "";
    const topicSuggestionApplied=form.status==="inprogress"&&!!lastTopicSuggestion&&String(form.title||"").trim()===lastTopicSuggestion;

    return(
      <div style={{...teacherThemeShell,height:"100dvh",minHeight:"100vh",width:"100%",display:"flex",flexDirection:"column",background:G.pageBg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} onViewNotifications={()=>safeNav("notifications")} notificationCount={notificationCount} showProfileMenu={!isMobile}
          right={<>
            <GhostBtn onClick={()=>setView("classDetail")} style={{color:"rgba(255,255,255,0.8)",borderColor:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:6}}><AppIcon icon={IconArrowLeft} size={16} color="currentColor" />Back</GhostBtn>
          </>}
        />

        {/* Class name bar — static in flow, always visible above scrollable content */}
        {activeClass&&(
          <div style={{flexShrink:0,background:G.forest,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#34D077",flexShrink:0}}/>
            <span style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:G.display,letterSpacing:-0.2}}>{activeClass.section}</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:260}}>· {activeClass.institute}{activeClass.subject?` · ${activeClass.subject}`:""}</span>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch"}}>
          {!isEdit&&(
            <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"12px 16px"}}>
              <div style={{maxWidth:660,margin:"0 auto"}}>
                {isMobile
                  ? <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <AppIcon icon={IconCalendar} size={22} color={G.textM} />
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
                        <button onClick={()=>setView("classDetail")}
                          style={{background:"none",border:"none",padding:0,fontSize:12,color:G.green,fontFamily:G.sans,fontWeight:600,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>
                          Change date
                        </button>
                      </div>
                    </div>
                  : <>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <AppIcon icon={IconCalendar} size={15} color={G.green} />
                        <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
                      </div>
                      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={{}}/>
                    </>
                }
              </div>
            </div>
          )}
          <div className="mobile-pad" style={{maxWidth:660,width:"100%",margin:"0 auto",padding:"16px 16px calc(72px + env(safe-area-inset-bottom, 0px))",boxSizing:"border-box"}}>
            {isEdit?(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{flex:1}}>
                  <p style={{fontSize:12,color:G.textM,fontFamily:G.sans,marginBottom:2,textTransform:"uppercase",fontWeight:600,letterSpacing:0.4}}>Editing Entry</p>
                  <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
                </div>
                <div style={{background:G.greenL,borderRadius:8,padding:"6px 10px",fontSize:13,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:5}}>
                  <AppIcon icon={IconUser} size={14} color={G.green} /><span style={{fontWeight:600}}>{teacherName}</span>
                </div>
              </div>
            ):(
              <>
                <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:5,textTransform:"uppercase",fontWeight:600}}>New Entry For</p>
                <h2 style={{marginBottom:22,fontSize:28,letterSpacing:-0.5,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</h2>
                <div style={{background:G.greenL,borderRadius:10,padding:"9px 14px",marginBottom:20,fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
                  <AppIcon icon={IconUser} size={16} color={G.green} /><span>Logged as: <strong>{teacherName}</strong></span>
                </div>
              </>
            )}
          <div className="form-card" style={{...card,padding:"24px"}}>
            <div style={{marginBottom:18}}>
              <label style={lbl}>Topic Status</label>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {Object.entries(STATUS_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>{
                    const nextStatus=form.status===key?"":key;
                    setForm({...form,status:nextStatus});
                    if(nextStatus==="inprogress") setShowNoteDetails(true);
                  }}
                    style={{background:form.status===key?val.bg:G.surface,color:form.status===key?val.text:G.textM,
                      border:`1.5px solid ${form.status===key?val.dot:G.border}`,
                      borderRadius:20,padding:"8px 18px",fontSize:14,cursor:"pointer",fontFamily:G.sans,
                      fontWeight:form.status===key?700:500,transition:"all 0.15s",
                      WebkitTapHighlightColor:"transparent"}}>
                    {val.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:12,color:G.textL,marginTop:5}}>Tap again to deselect</div>
            </div>
            {form.status==="inprogress"&&lastTopicSuggestion&&(
              <div style={{marginBottom:18,background:"#FFF7E8",border:"1px solid #FCD34D",borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:12,fontWeight:800,color:"#B45309",fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.5}}>Suggested topic heading</div>
                  <div style={{fontSize:14,color:G.text,fontFamily:G.sans,fontWeight:600,marginTop:4,wordBreak:"break-word"}}>{lastTopicSuggestion}</div>
                </div>
                {topicSuggestionApplied
                  ? <span style={{background:"#E8F8EF",border:`1px solid ${G.green}22`,borderRadius:999,padding:"7px 10px",fontSize:12,color:G.green,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>Added below</span>
                  : <button type="button" onClick={()=>{setForm({...form,title:lastTopicSuggestion});setShowNoteDetails(true);}}
                      style={{background:"#FFFFFF",border:"1px solid #F59E0B",borderRadius:10,padding:"9px 14px",fontSize:13,cursor:"pointer",color:"#B45309",fontFamily:G.sans,fontWeight:700,whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>
                      Use this
                    </button>}
              </div>
            )}
            <div style={{marginBottom:16}}>

              {/* ══════════════════════════════════════════════════════
                   TIME ENTRY — two modes:
                   A) KIS class   → slot pills + optional manual expand
                   B) Other class → history suggestion + manual input
                ══════════════════════════════════════════════════════ */}
              {(()=>{
                const kisSlots=getSlotsForSection(activeClass,instituteSections);

                // ── MODE A: KIS timetable ──────────────────────────────────
                if(kisSlots){
                  const dayEntries=(data.notes?.[activeClass?.id]||{})[selectedDate]||[];
                  const usedStarts=new Set(
                    dayEntries.filter(e=>!isEdit||e.id!==form.id).map(e=>e.timeStart).filter(Boolean)
                  );
                  return(
                    <>
                      {/* Slot pills */}
                      <div style={{marginBottom:form._manualTime?12:20}}>
                        <label style={lbl}>Timetable slots</label>
                        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                          {kisSlots.map(slot=>{
                            const isUsed=usedStarts.has(slot.start);
                            const isSel=!form._manualTime&&form.timeStart===slot.start;
                            return(
                              <button key={slot.start} type="button" disabled={isUsed}
                                onClick={()=>{
                                  if(isUsed) return;
                                  setForm({...form,timeStart:slot.start,timeEnd:slot.end,_dur:slot.durMins,_kisSlot:true,_manualTime:false,_suggested:false,_suggestedEnd:slot.end});
                                }}
                                style={{
                                  padding:"10px 16px",borderRadius:22,fontSize:14,fontFamily:G.mono,fontWeight:700,
                                  border:`2px solid ${isSel?G.forest:isUsed?"#E5E7EB":G.border}`,
                                  background:isSel?G.forest:isUsed?"#F9FAFB":G.surface,
                                  color:isSel?"#fff":isUsed?"#9CA3AF":G.text,
                                  cursor:isUsed?"not-allowed":"pointer",
                                  textDecoration:isUsed?"line-through":"none",
                                  WebkitTapHighlightColor:"transparent",transition:"all 0.15s",minHeight:44,
                                }}>
                                {fmtSlot(slot.start)}–{fmtSlot(slot.end)}
                                {isUsed&&<span style={{fontSize:11,marginLeft:6,fontWeight:600,textDecoration:"none",opacity:0.7,display:"inline-flex",alignItems:"center",gap:4}}><AppIcon icon={IconCheck} size={11} color="currentColor" />done</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Off-schedule toggle line */}
                      {!form._manualTime&&(
                        <button type="button"
                          onClick={()=>setForm({...form,_kisSlot:false,_manualTime:true,timeStart:"",timeEnd:"",_suggestedEnd:null})}
                          style={{background:"none",border:"none",padding:"0 0 16px",cursor:"pointer",
                            color:G.textL,fontSize:13,fontFamily:G.sans,textAlign:"left",
                            display:"flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent"}}>
                          <span style={{fontSize:15}}>＋</span>
                          <span style={{textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:3}}>
                            This class isn't in the schedule — log a custom time
                          </span>
                        </button>
                      )}

                      {/* Manual expand (off-schedule) */}
                      {form._manualTime&&(
                        <>
                          <button type="button"
                            onClick={()=>setForm({...form,_manualTime:false,timeStart:"",timeEnd:"",_suggestedEnd:null})}
                            style={{background:"none",border:"none",padding:"0 0 14px",cursor:"pointer",
                              color:G.green,fontSize:13,fontFamily:G.sans,fontWeight:600,
                              display:"flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent"}}>
                            <AppIcon icon={IconArrowLeft} size={14} color="currentColor" /> Back to timetable slots
                          </button>
                          <label style={lbl}>Start Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
                          <input type="time" value={form.timeStart||""}
                            onChange={e=>{
                              const s=e.target.value;
                              const dur=form._dur||(activeClass?.duration)||60;
                              if(s){
                                const [h,m]=s.split(":").map(Number);
                                const end=new Date(2000,0,1,h,m+dur);
                                const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                                setForm({...form,timeStart:s,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                              } else {
                                setForm({...form,timeStart:"",timeEnd:"",_suggestedEnd:null});
                              }
                            }}
                            style={{...inp,fontSize:16}}/>
                          {form.timeStart&&(
                            <div style={{marginBottom:12}}>
                              <label style={{...lbl,marginBottom:8}}>Duration</label>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                {[45,60,75,90,105,120].map(mins=>{
                                  const isSel=(form._dur||(activeClass?.duration)||60)===mins;
                                  const label=mins<60?`${mins}m`:mins===60?"1 hr":`${Math.floor(mins/60)}h${mins%60?" "+mins%60+"m":""}`;
                                  return(
                                    <button key={mins} type="button"
                                      onClick={()=>{
                                        const [h,m]=(form.timeStart||"00:00").split(":").map(Number);
                                        const end=new Date(2000,0,1,h,m+mins);
                                        const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                                        setForm({...form,_dur:mins,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                                      }}
                                      style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${isSel?G.forest:G.border}`,cursor:"pointer",
                                        fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:42,WebkitTapHighlightColor:"transparent",
                                        background:isSel?G.forest:"transparent",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {form.timeStart&&(
                            <div>
                              <label style={{...lbl,marginBottom:6}}>End Time
                                {form._suggestedEnd&&form.timeEnd===form._suggestedEnd&&
                                  <span style={{color:G.green,fontWeight:500,textTransform:"none",fontSize:12,marginLeft:8}}>suggested</span>}
                              </label>
                              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                                <input type="time" value={form.timeEnd||""}
                                  onChange={e=>setForm({...form,timeEnd:e.target.value,_suggestedEnd:null})}
                                  style={{...inp,marginBottom:0,flex:1,fontSize:16,
                                    borderColor:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.green:G.border,
                                    background:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.greenL:G.surface}}/>
                                {form.timeStart&&form.timeEnd&&(()=>{
                                  const[sh,sm]=form.timeStart.split(":").map(Number);
                                  const[eh,em]=form.timeEnd.split(":").map(Number);
                                  const d=(eh*60+em)-(sh*60+sm);
                                  if(d<=0) return null;
                                  return <span style={{fontSize:14,color:G.green,fontWeight:700,fontFamily:G.mono,flexShrink:0,background:G.greenL,borderRadius:8,padding:"6px 10px"}}>{d<60?d+"m":Math.floor(d/60)+"h"+(d%60?d%60+"m":"")}</span>;
                                })()}
                              </div>
                            </div>
                          )}
                          {!form.timeStart&&<div style={{fontSize:13,color:G.red,marginTop:4}}>Start time is required.</div>}
                        </>
                      )}
                    </>
                  );
                }

                // ── MODE B: Non-KIS — history suggestion + manual ──────────
                return(
                  <>
                    {form._suggested&&form.timeStart&&(
                      <div style={{background:G.greenL,border:"1px solid "+G.green,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:18}}>&#128161;</span>
                        <div style={{flex:1,minWidth:120}}>
                          <div style={{fontSize:13,fontWeight:700,color:G.green}}>Suggested from your history</div>
                          <div style={{fontSize:12,color:G.textM,marginTop:1}}>
                            {fmtSlot(form.timeStart)} – {fmtSlot(form.timeEnd)} · same time as your usual {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(selectedDate).getDay()]} class
                          </div>
                        </div>
                        <button onClick={()=>setForm(f=>({...f,_suggested:false,timeStart:"",timeEnd:"",_suggestedEnd:null}))}
                          style={{background:"none",border:"1px solid "+G.borderM,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,flexShrink:0}}>
                          Change
                        </button>
                      </div>
                    )}
                    <label style={lbl}>Start Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
                    {!form._suggested&&<input type="time" value={form.timeStart||""}
                      onChange={e=>{
                        const s=e.target.value;
                        const dur=form._dur||(activeClass?.duration)||60;
                        if(s){
                          const [h,m]=s.split(":").map(Number);
                          const end=new Date(2000,0,1,h,m+dur);
                          const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                          setForm({...form,timeStart:s,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                        } else {
                          setForm({...form,timeStart:"",timeEnd:"",_suggestedEnd:null});
                        }
                      }}
                      style={{...inp,fontSize:16}}/>}
                    {form.timeStart&&(
                      <div style={{marginBottom:12}}>
                        <label style={{...lbl,marginBottom:8}}>Duration</label>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {[45,60,75,90,105,120].map(mins=>{
                            const isSel=(form._dur||(activeClass?.duration)||60)===mins;
                            const label=mins<60?`${mins}m`:mins===60?"1 hr":`${Math.floor(mins/60)}h${mins%60?" "+mins%60+"m":""}`;
                            return(
                              <button key={mins} type="button"
                                onClick={()=>{
                                  const [h,m]=(form.timeStart||"00:00").split(":").map(Number);
                                  const end=new Date(2000,0,1,h,m+mins);
                                  const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                                  setForm({...form,_dur:mins,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                                }}
                                style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${isSel?G.forest:G.border}`,cursor:"pointer",
                                  fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:42,WebkitTapHighlightColor:"transparent",
                                  background:isSel?G.forest:"transparent",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {form.timeStart&&(
                      <div>
                        <label style={{...lbl,marginBottom:6}}>End Time
                          {form._suggestedEnd&&form.timeEnd===form._suggestedEnd&&
                            <span style={{color:G.green,fontWeight:500,textTransform:"none",fontSize:12,marginLeft:8}}>suggested — edit if different</span>}
                        </label>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <input type="time" value={form.timeEnd||""}
                            onChange={e=>setForm({...form,timeEnd:e.target.value,_suggestedEnd:null})}
                            style={{...inp,marginBottom:0,flex:1,fontSize:16,
                              borderColor:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.green:G.border,
                              background:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.greenL:G.surface}}/>
                          {form.timeStart&&form.timeEnd&&(()=>{
                            const[sh,sm]=form.timeStart.split(":").map(Number);
                            const[eh,em]=form.timeEnd.split(":").map(Number);
                            const d=(eh*60+em)-(sh*60+sm);
                            if(d<=0) return null;
                            return <span style={{fontSize:14,color:G.green,fontWeight:700,fontFamily:G.mono,flexShrink:0,background:G.greenL,borderRadius:8,padding:"6px 10px"}}>{d<60?d+"m":Math.floor(d/60)+"h"+(d%60?d%60+"m":"")}</span>;
                          })()}
                        </div>
                      </div>
                    )}
                    {!form.timeStart&&<div style={{fontSize:13,color:G.red,marginTop:4}}>Start time is required.</div>}
                  </>
                );
              })()}
            </div>
            <div style={{marginBottom:18,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",background:G.surface}}>
              <button type="button" onClick={()=>setShowNoteDetails(o=>!o)}
                style={{width:"100%",background:"transparent",border:"none",padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:3}}>Add details</div>
                  <div style={{fontSize:12,color:G.textM,lineHeight:1.5}}>
                    {hasExtraDetails
                      ? "Topic or notes added for this entry."
                      : "Type the topic and notes yourself for richer history."}
                  </div>
                </div>
                <span style={{fontSize:18,color:G.textL,fontWeight:700}}>{showNoteDetails?"−":"+"}</span>
              </button>
              {showNoteDetails&&(
                <div style={{padding:"0 16px 16px"}}>
                  <div style={{marginBottom:14}}>
                    <label style={lbl}>Title</label>
                    <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={form.status==="inprogress"&&lastTopicSuggestion?"Continue the topic heading here":"What was covered?"} style={{...inp,fontSize:16,fontWeight:500,marginBottom:0}}/>
                  </div>
                  <div>
                    <label style={lbl}>Notes</label>
                    <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={6} style={{...inp,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
                  </div>
                </div>
              )}
            </div>
            <PrimaryBtn onClick={save} disabled={!form.timeStart} onPointerDown={e=>rpl(e,true)} style={{marginTop:20,padding:"13px 28px",fontSize:16,opacity:form.timeStart?1:0.45,cursor:form.timeStart?"pointer":"not-allowed",width:"100%"}}>
              {saveLabel}
            </PrimaryBtn>
          </div>
          </div>{/* end mobile-pad */}
        </div>{/* end scrollable */}
      </div>
    );
  }
  return(
    <TeacherStateFallback
      themeShell={teacherThemeShell}
      view={view}
      resolvedView={resolvedView}
      activeClassId={activeClass?.id}
      classCount={(data.classes || []).length}
      notificationCount={notificationCount}
      onResetHome={()=>{
        setActiveClass(null);
        setEditNote(null);
        setTeacherBackView("home");
        setSelectedDate(todayKey());
        _setView("home");
        if(typeof window !== "undefined"){
          const navToken = Number(window.history.state?.navToken ?? teacherHistoryTokenRef.current ?? 0) || 0;
          teacherHistoryTokenRef.current = Math.max(teacherHistoryTokenRef.current, navToken);
          window.history.replaceState(
            { ...(window.history.state || {}), view:"home", navToken },
            "",
            buildTeacherHistoryUrl("home", navToken)
          );
        }
      }}
    />
  );
}

export default function ClassTracker(props){
  return <CTErrorBoundary><ClassTrackerInner {...props}/></CTErrorBoundary>;
}
