import React, { useState, useEffect, useMemo, Component } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import {
  IconBuilding,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDeviceFloppy,
  IconDownload,
  IconFileText,
  IconLogout,
  IconMessageCircle,
  IconBooks,
  IconPhoto,
  IconPlus,
  IconSchool,
  IconSettings,
  IconSend,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher, createInviteLink,
  getAllInstituteSections, saveInstituteGradeGroups, deleteInstituteGradeGroup,
  removeTeacherFromSystem, removeInstituteFromIndex,
  deleteEntryFromTeacherData, deleteClassFromTeacherData, deleteClassNotes,
  trashClassInTeacherData, restoreClassFromTeacherTrash,
  getGlobalInstitutes, saveGlobalInstitute, deleteGlobalInstitute, renameGlobalInstitute, saveInstituteExtraSections,
  getGlobalSubjects, saveGlobalSubject, setGlobalSubjectActive, updateTeacherSubjectAssignments,
  getSyllabusTemplates, saveSyllabusDraft, publishSyllabusTemplate, deleteSyllabusTemplate,
  getDeletedInstitutesList, addToDeletedInstitutesList, removeFromDeletedInstitutesList,
  repairTeacherIndex, saveProfileName, saveUserData,
  deleteInstituteCompletely, deleteInstituteAndMigrate,
  getAdminBin, saveAdminBin,
  getLedgrReportSchedule, saveLedgrReportSchedule,
  getLedgrTelegramConfig, saveLedgrTelegramConfig,
  subscribeFeedbackThreads, subscribeFeedbackMessages,
  sendAdminFeedbackReply, markFeedbackThreadRead, setFeedbackThreadStatus,
  auth,
} from "./firebase";
import { Avatar, todayKey, formatPeriod, TAG_STYLES, STATUS_STYLES, getSectionTone } from "./shared.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  navy:  "#1A2F5A",   navyS: "#243D72",
  blue:  "#1D4ED8",   blueV: "#3B82F6",  blueL: "#DBEAFE",
  bg:     "#F5F7FA",  surface:"#FFFFFF",
  border: "#DDE3ED",  borderM:"#BCC8DC",
  // Text — high contrast for mobile readability
  text:  "#111827",   // near-black — all primary text
  textS: "#1F2937",   // dark secondary
  textM: "#4B5563",   // medium — was #64748B (too light), now darker
  textL: "#6B7280",   // labels — was #94A3B8 (too faint), now visible
  red:"#C93030",  redL:"#FDF1F1",
  amber:"#B45309",amberL:"#FEF3C7",
  mono:"'Inter',sans-serif",
  sans:"'Inter',sans-serif",
  display:"'Poppins',sans-serif",
  shadowSm:"0 1px 4px rgba(15,23,42,0.08),0 1px 2px rgba(15,23,42,0.05)",
  shadowMd:"0 4px 14px rgba(15,23,42,0.10),0 2px 4px rgba(15,23,42,0.05)",
};

const PANEL_RAIL_THEMES = {
  p1: {
    bg: "#E4EEFF",
    edge: "#B8CCF7",
    tab: "#CFE0FF",
    accent: "#1D4ED8",
    text: "#1E3A6D",
  },
  p2: {
    bg: "#FFF1D9",
    edge: "#EBC886",
    tab: "#F9DDAB",
    accent: "#B9770E",
    text: "#6A4708",
  },
  p3: {
    bg: "#E3F7EC",
    edge: "#AFDCC1",
    tab: "#C9EDD9",
    accent: "#198754",
    text: "#1A5A3E",
  },
};

const APP_ICON_STROKE = 2.05;
let instituteGlanceExportRuntimePromise = null;

function AppIcon({ icon, size = 18, color = "currentColor", stroke = APP_ICON_STROKE, style = {} }){
  if(!icon) return null;
  if(typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)){
    const Icon = icon;
    return <Icon size={size} color={color} stroke={stroke} style={{display:"block",flexShrink:0,...style}} />;
  }
  return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",lineHeight:1,...style}}>{icon}</span>;
}

async function loadInstituteGlanceExportRuntime(){
  if(!instituteGlanceExportRuntimePromise){
    instituteGlanceExportRuntimePromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("jszip"),
    ]).then(([jspdfModule, autoTableModule, jszipModule]) => ({
      jsPDF: jspdfModule.jsPDF,
      autoTable: autoTableModule.default,
      JSZip: jszipModule.default,
    }));
  }
  return instituteGlanceExportRuntimePromise;
}

function normaliseTelegramBotUsername(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function normaliseTelegramChatId(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function normaliseTelegramUsername(value) {
  const clean = String(value || "").trim().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function telegramUsernameKey(value) {
  return normaliseTelegramUsername(value).toLowerCase();
}

function buildTelegramRecipientDraft(institute = "", seed = {}) {
  const cleanInstitute = String(institute || "").trim();
  return {
    id: String(seed?.id || `telegram_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    institute: cleanInstitute,
    destinationType: ["channel", "group", "private"].includes(seed?.destinationType)
      ? seed.destinationType
      : "private",
    chatId: normaliseTelegramChatId(seed?.chatId),
    username: normaliseTelegramUsername(seed?.username),
    label: String(seed?.label || (cleanInstitute ? `${cleanInstitute} reports` : "")).trim(),
    enabled: seed?.enabled !== false,
    notes: String(seed?.notes || "").trim(),
  };
}

function normaliseTelegramRecipientsForUi(list = []) {
  return (list || []).map(item => ({
    id: String(item?.id || buildTelegramRecipientDraft(item?.institute).id),
    institute: String(item?.institute || "").trim(),
    destinationType: ["channel", "group", "private"].includes(item?.destinationType)
      ? item.destinationType
      : "private",
    chatId: normaliseTelegramChatId(item?.chatId),
    username: normaliseTelegramUsername(item?.username),
    label: String(item?.label || "").trim(),
    enabled: item?.enabled !== false,
    notes: String(item?.notes || "").trim(),
  }));
}

function normaliseTelegramFullReportRecipientsForUi(list = []) {
  return (list || []).map(item => ({
    id: String(item?.id || buildTelegramRecipientDraft("").id),
    destinationType: ["channel", "group", "private"].includes(item?.destinationType)
      ? item.destinationType
      : "private",
    chatId: normaliseTelegramChatId(item?.chatId),
    username: normaliseTelegramUsername(item?.username),
    label: String(item?.label || "").trim(),
    enabled: item?.enabled !== false,
    notes: String(item?.notes || "").trim(),
  }));
}

function buildTelegramRecipientTouchSummary(item = {}) {
  return {
    institute: String(item?.institute || "").trim(),
    label: String(item?.label || "").trim(),
    username: normaliseTelegramUsername(item?.username),
    chatId: normaliseTelegramChatId(item?.chatId),
    notes: String(item?.notes || "").trim(),
  };
}

function recipientHasAnyTelegramData(item = {}) {
  const summary = buildTelegramRecipientTouchSummary(item);
  return !!(summary.institute || summary.label || summary.username || summary.chatId || summary.notes);
}

function mergeTelegramFullReportRecipientsForUi(...lists) {
  const merged = [];
  const seen = new Set();
  lists.flat().forEach(item => {
    const summary = buildTelegramRecipientTouchSummary(item);
    if (!recipientHasAnyTelegramData(summary)) return;
    const key = summary.chatId
      ? `chat:${summary.chatId}`
      : summary.username
        ? `user:${telegramUsernameKey(summary.username)}`
        : `id:${String(item?.id || "").trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      id: String(item?.id || buildTelegramRecipientDraft("").id),
      destinationType: ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "private",
      chatId: summary.chatId,
      username: summary.username,
      label: summary.label,
      enabled: item?.enabled !== false,
      notes: summary.notes,
    });
  });
  return merged;
}

function partitionTelegramRecipientsForUi(config = null) {
  const routeRecipients = [];
  const legacyFullReportRecipients = [];
  normaliseTelegramRecipientsForUi(config?.recipients || []).forEach(item => {
    if (String(item?.institute || "").trim()) {
      routeRecipients.push(item);
    } else if (recipientHasAnyTelegramData(item)) {
      legacyFullReportRecipients.push(item);
    }
  });
  return {
    recipients: routeRecipients,
    fullReportRecipients: mergeTelegramFullReportRecipientsForUi(
      normaliseTelegramFullReportRecipientsForUi(config?.fullReportRecipients || []),
      legacyFullReportRecipients,
    ),
  };
}

function getTelegramRecipientDisplayName(item = {}) {
  const username = normaliseTelegramUsername(item?.username);
  if (username) return username;
  const label = String(item?.label || "").trim();
  if (label) return label;
  const chatId = normaliseTelegramChatId(item?.chatId);
  return chatId ? `Chat ${chatId}` : "Telegram user";
}

function buildTelegramDashboardDraft(config = null) {
  const partitioned = partitionTelegramRecipientsForUi(config);
  return {
    enabled: config?.enabled !== false,
    botUsername: normaliseTelegramBotUsername(config?.botUsername || "@ledgrapp_bot"),
    scheduledEnabled: config?.delivery?.scheduledEnabled !== false,
    onDemandEnabled: config?.delivery?.onDemandEnabled !== false,
    recipients: partitioned.recipients,
    fullReportRecipients: partitioned.fullReportRecipients,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentSession(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
}
function readClientProfile(){
  if(typeof window==="undefined"){
    return { isMobile:false, reduceMotion:false, weakDevice:false, mobileLite:false, coarsePointer:false };
  }
  const nav = window.navigator || {};
  const ua = String(nav.userAgent || "").toLowerCase();
  const width = window.innerWidth || 1024;
  const isMobile = width < 768;
  const isAndroid = /android/.test(ua);
  const deviceMemory = Number(nav.deviceMemory || 0);
  const hardwareConcurrency = Number(nav.hardwareConcurrency || 0);
  const reduceMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const coarsePointer = !!window.matchMedia?.("(pointer: coarse)")?.matches || !!window.matchMedia?.("(any-pointer: coarse)")?.matches || "ontouchstart" in window;
  const weakMemory = deviceMemory > 0 && deviceMemory <= 4;
  const weakCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 4;
  const weakDevice = reduceMotion || (isAndroid && (weakMemory || weakCpu || width <= 412)) || (isMobile && weakMemory && weakCpu);
  return {
    isMobile,
    reduceMotion,
    weakDevice,
    mobileLite:isMobile && (weakDevice || width <= 430),
    coarsePointer,
  };
}
function ordSuffix(n){const s=["th","st","nd","rd"];const v=n%100;return s[(v-20)%10]||s[v]||s[0];}
const LEAVE_REASON_MAP = {
  completed:  { icon:"✅", label:"Completed",  desc:"Syllabus is done, this class has ended" },
  reassigned: { icon:"🔄", label:"Reassigned", desc:"Another teacher has taken over this class" },
  merged:     { icon:"🔀", label:"Merged",     desc:"This batch was combined with another batch" },
  onhold:     { icon:"⏸",  label:"On Hold",   desc:"Class is paused for now, may continue later" },
};

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ title, lines, confirmLabel, onConfirm, onClose, busy }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div style={{background:G.surface,borderRadius:18,padding:"26px 24px",width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{width:40,height:40,borderRadius:12,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:14}}>🗑</div>
        <h3 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>{title}</h3>
        {lines.map((l,i)=>(
          <p key={i} style={{fontSize:15,color:i===0?G.textM:G.textL,fontFamily:G.sans,lineHeight:1.55,marginBottom:i<lines.length-1?6:16}}>{l}</p>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} disabled={busy}
            style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:9,padding:"8px 18px",fontSize:15,cursor:"pointer",color:G.textM,fontFamily:G.sans,fontWeight:500}}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:busy?"#D5D5D5":"#DC2626",color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",fontSize:15,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:600}}>
            {busy?"Deleting…":confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionRenameReviewModal({
  draft,
  selections,
  onChange,
  onBack,
  onConfirm,
  busy,
  entityLabels,
}){
  const removedCount = draft?.removedSections?.length || 0;
  const addedCount = draft?.addedSections?.length || 0;
  const singular = entityLabels?.singular || "section";
  const plural = entityLabels?.plural || "sections";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.48)",zIndex:710,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:620,maxHeight:"88vh",overflowY:"auto",background:G.surface,border:`1px solid ${G.border}`,borderRadius:24,boxShadow:"0 30px 80px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Rename review
          </div>
          <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            Tell teachers what changed
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.7}}>
            {`If a ${singular} was renamed, map the old name to the new one here. Teachers will get a one-time prompt, and their class history will stay intact.`}
          </div>
        </div>

        <div style={{padding:"18px 24px 10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:18}}>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Removed names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{removedCount}</div>
            </div>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Current names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{draft?.currentSections?.length || 0}</div>
            </div>
            <div style={{background:draft?.timetableChanged ? "#FFF7ED" : "#ECFDF5",border:`1px solid ${draft?.timetableChanged ? "#FED7AA" : "#BBF7D0"}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:draft?.timetableChanged ? G.amber : "#166534",marginBottom:5}}>Timetable</div>
              <div style={{fontSize:16,fontWeight:800,color:draft?.timetableChanged ? G.amber : "#166534",fontFamily:G.display}}>
                {draft?.timetableChanged ? "Updated for future logs" : "No slot change"}
              </div>
            </div>
          </div>

          {removedCount === 0 ? (
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"18px 16px",fontSize:14,color:G.textM,lineHeight:1.65}}>
              {`This edit changes the ${singular} list, but there are no removed names to map. Saving will treat any extra names as brand-new ${plural}.`}
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {draft.removedSections.map(oldSection=>{
                const selected = selections?.[oldSection] || "";
                return (
                  <div key={oldSection} style={{background:"#FBFCFE",border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 16px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:4}}>{`Old ${singular}`}</div>
                        <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display}}>{oldSection}</div>
                      </div>
                      <div style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>
                        Teachers will see this once
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>{`New ${singular} name`}</div>
                        <select
                          value={selected}
                          onChange={e=>onChange(oldSection, e.target.value)}
                          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
                        >
                          <option value="">Treat as removed / don't notify</option>
                          {(draft.currentSections || []).map(section=>(
                            <option key={`${oldSection}_${section}`} value={section}>{section}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                        {selected
                          ? <>Teachers using <strong>{oldSection}</strong> will be remapped to <strong>{selected}</strong>. {draft.timetableChanged ? "They'll also be told that future timetable slots changed." : "Their existing timetable pattern stays the same."}</>
                          : <>{`No automatic rename will be sent for this ${singular}. Teachers can still relink manually later if needed.`}</>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {addedCount > 0 && (
            <div style={{marginTop:16,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:16,padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.blue,marginBottom:6}}>{`Current ${plural} names`}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {draft.addedSections.map(section=>(
                  <span key={section} style={{background:"#fff",border:"1px solid #C7D7F5",borderRadius:999,padding:"6px 12px",fontSize:12,fontWeight:700,color:G.blue,fontFamily:G.mono}}>
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{padding:"18px 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",borderTop:`1px solid ${G.border}`}}>
          <button onClick={onBack} disabled={busy}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans}}>
            ← Back
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            {busy ? "Saving…" : `Save ${singular} update`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionQuickRenameModal({
  term,
  originalValue,
  value,
  error,
  onChange,
  onClose,
  onSave,
}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.42)",zIndex:720,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:460,background:G.surface,border:`1px solid ${G.border}`,borderRadius:22,boxShadow:"0 24px 64px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Quick rename
          </div>
          <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            {`Rename this ${term}`}
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.65}}>
            {`Teachers using "${originalValue}" will see the new name after you save.`}
          </div>
        </div>
        <div style={{padding:"18px 24px 22px"}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>{`New ${term} name`}</div>
          <input
            value={value}
            onChange={e=>onChange(e.target.value)}
            autoFocus
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${error ? G.red : G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
          />
          {error && (
            <div style={{marginTop:10,fontSize:13,color:G.red,lineHeight:1.5}}>{error}</div>
          )}
        </div>
        <div style={{padding:"0 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <button onClick={onClose}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:"pointer",fontFamily:G.sans}}>
            Cancel
          </button>
          <button onClick={onSave}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            Save rename
          </button>
        </div>
      </div>
    </div>
  );
}

function LegacySectionRepairModal({
  scopeLabel,
  items,
  selections,
  busy,
  error,
  onChange,
  onClose,
  onConfirm,
}){
  const instituteCount = new Set((items || []).map(item => String(item?.institute || "").trim()).filter(Boolean)).size;
  const optionCount = new Set((items || []).flatMap(item => item?.options || []).map(normaliseSectionKey).filter(Boolean)).size;
  const scopeText = scopeLabel || "all institutes";
  const scopeDescription = instituteCount > 1
    ? "the current section lists across all institutes"
    : `${scopeText}'s current section list`;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.48)",zIndex:730,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:720,maxHeight:"88vh",overflowY:"auto",background:G.surface,border:`1px solid ${G.border}`,borderRadius:24,boxShadow:"0 30px 80px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Legacy repair
          </div>
          <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            Repair old section names
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.7}}>
            {`These classes still use names that are no longer present in ${scopeDescription}. Map each old section to the right current section, or choose delete to remove that section and all its entries.`}
          </div>
        </div>

        <div style={{padding:"18px 24px 10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:18}}>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Legacy names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{items.length}</div>
            </div>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>
                {instituteCount > 1 ? "Institutes" : "Current sections"}
              </div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>
                {instituteCount > 1 ? instituteCount : optionCount}
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {items.map(item=>{
              const selectionKey = item.selectionKey || item.oldSection;
              const selected = selections?.[selectionKey] || "";
              const options = item.options || [];
              return (
                <div key={selectionKey} style={{background:"#FBFCFE",border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 16px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                    <div>
                      {item.institute && (
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.blue,marginBottom:4}}>{item.institute}</div>
                      )}
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:4}}>Old section name</div>
                      <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display}}>{item.oldSection}</div>
                    </div>
                    <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textAlign:"right"}}>
                      <div>{item.affectedClassCount} class record{item.affectedClassCount!==1?"s":""}</div>
                      <div>{item.affectedTeacherCount} teacher{item.affectedTeacherCount!==1?"s":""}</div>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>Map or delete</div>
                      <select
                        value={selected}
                        onChange={e=>onChange(selectionKey, e.target.value)}
                        style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
                      >
                        <option value="">Select the action…</option>
                        <option value={DELETE_SECTION_ACTION}>Delete this section and its entries</option>
                        {options.map(section=>(
                          <option key={`${item.oldSection}_${section}`} value={section}>{section}</option>
                        ))}
                      </select>
                    </div>
                    {selected===DELETE_SECTION_ACTION&&(
                      <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#B91C1C",fontWeight:600,lineHeight:1.5}}>
                        This will permanently delete every matching class record and all entries under this section.
                      </div>
                    )}
                    {item.subjects.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {item.subjects.map(subject=>(
                          <span key={`${item.oldSection}_${subject}`} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textM,fontFamily:G.sans}}>
                            {subject}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.teacherNames.length>0&&(
                      <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                        {`Teachers affected: ${item.teacherNames.join(", ")}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error&&(
            <div style={{marginTop:16,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:"12px 14px",fontSize:13,color:"#B91C1C",fontWeight:600}}>
              {error}
            </div>
          )}
        </div>

        <div style={{padding:"18px 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",borderTop:`1px solid ${G.border}`}}>
          <button onClick={onClose} disabled={busy}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans}}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            {busy ? "Applying changes…" : "Apply section changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminToastBanner({ message }) {
  if(!message) return null;
  return (
    <div style={{position:"fixed",right:18,bottom:18,zIndex:760,background:"#0F1E3D",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"12px 16px",boxShadow:"0 18px 48px rgba(15,23,42,0.28)",fontSize:14,fontWeight:700,fontFamily:G.sans,maxWidth:320}}>
      {message}
    </div>
  );
}

function normaliseName(raw){
  if(!raw) return raw;
  return String(raw).trim().replace(/\s+/g, " ");
}
function classNum(name){const m=(name||"").match(/(\d+)/);return m?parseInt(m[1]):0;}
const ALL_CLASSES_KEY = "__all_classes__";
const ALL_TEACHERS_KEY = "__all_teachers__";
const DELETE_SECTION_ACTION = "__delete_section__";
const KEEP_SECTION_ACTION = "__keep_section__";
const exportTextSorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
function exportClassMeta(name){
  const clean = (name || "").trim();
  const grade = classNum(clean);
  const gradeOrder = grade >= 6 && grade <= 12 ? grade : 99;
  return { gradeOrder, clean };
}
function sameInstituteName(a,b){
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}
function replaceInstituteNameLocal(value, oldName, newName) {
  const label = String(value || "").trim();
  if (!label) return "";
  return sameInstituteName(label, oldName) ? String(newName || "").trim() : label;
}
function replaceInstituteListLocal(values, oldName, newName) {
  const seen = new Set();
  const next = [];
  (values || []).forEach(value => {
    const label = replaceInstituteNameLocal(value, oldName, newName);
    const key = label.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    next.push(label);
  });
  return next;
}
function renameInstituteInsideLocalNotices(notices, oldName, newName) {
  return (Array.isArray(notices) ? notices : []).map(item => {
    if (!item) return item;
    const institute = replaceInstituteNameLocal(item.institute, oldName, newName);
    const preserveHistoricalRename = item.kind === "institute_renamed";
    const oldInstitute = preserveHistoricalRename
      ? String(item.oldInstitute || "").trim()
      : replaceInstituteNameLocal(item.oldInstitute, oldName, newName);
    const newInstitute = preserveHistoricalRename
      ? String(item.newInstitute || "").trim()
      : replaceInstituteNameLocal(item.newInstitute, oldName, newName);
    if (
      institute === String(item.institute || "").trim() &&
      oldInstitute === String(item.oldInstitute || "").trim() &&
      newInstitute === String(item.newInstitute || "").trim()
    ) {
      return item;
    }
    return {
      ...item,
      institute,
      oldInstitute,
      newInstitute,
    };
  });
}
function renameInstituteInsideLocalTeacherData(data, oldName, newName) {
  if (!data) return data;
  const nextClasses = (data.classes || []).map(cls =>
    sameInstituteName(cls?.institute, oldName)
      ? { ...cls, institute: String(newName || "").trim() }
      : cls
  );
  const nextInstitutes = replaceInstituteListLocal(data.institutes, oldName, newName);
  const nextProfileInstitutes = replaceInstituteListLocal(data.profile?.institutes, oldName, newName);
  const nextTrashClasses = (data.trash?.classes || []).map(cls =>
    sameInstituteName(cls?.institute, oldName)
      ? { ...cls, institute: String(newName || "").trim() }
      : cls
  );
  const nextTrashNotes = (data.trash?.notes || []).map(note =>
    sameInstituteName(note?.institute, oldName)
      ? { ...note, institute: String(newName || "").trim() }
      : note
  );
  const nextPendingNotices = renameInstituteInsideLocalNotices(data?._meta?.pendingAdminClassNotices, oldName, newName);
  const legacyNotice = data?._meta?.pendingSectionChangeNotice;
  const nextLegacyItems = renameInstituteInsideLocalNotices(legacyNotice?.items, oldName, newName);

  return {
    ...data,
    classes: nextClasses,
    institutes: nextInstitutes,
    profile: {
      ...(data.profile || {}),
      institutes: nextProfileInstitutes,
    },
    trash: {
      ...(data.trash || {}),
      classes: nextTrashClasses,
      notes: nextTrashNotes,
    },
    _meta: {
      ...(data._meta || {}),
      pendingAdminClassNotices: nextPendingNotices,
      ...(legacyNotice ? {
        pendingSectionChangeNotice: {
          ...legacyNotice,
          items: nextLegacyItems,
        },
      } : {}),
    },
  };
}
function renameInstituteInsideLocalSectionsMap(instituteSections, oldName, newName) {
  if (!instituteSections) return instituteSections;
  const currentKey = Object.keys(instituteSections).find(name => sameInstituteName(name, oldName));
  const nextKey = String(newName || "").trim();
  if (!currentKey || !nextKey) return instituteSections;
  const nextSections = { ...instituteSections };
  const payload = nextSections[currentKey];
  delete nextSections[currentKey];
  nextSections[nextKey] = payload;
  return nextSections;
}
function updateInstituteExtraSectionsLocal(instituteSections, instituteName, updater) {
  if (!instituteSections || !instituteName || typeof updater !== "function") return instituteSections;
  const currentKey = getInstituteSectionConfigKey(instituteSections, instituteName) || String(instituteName || "").trim();
  const currentData = instituteSections[currentKey] || {};
  const nextExtraSections = uniqueSectionNames(updater(currentData.extraSections || []));
  return {
    ...instituteSections,
    [currentKey]: {
      ...currentData,
      extraSections: nextExtraSections,
    },
  };
}
function getInstituteSectionConfigKey(instituteSections, instituteName){
  if(!instituteSections || !instituteName) return instituteName || "";
  if(Object.prototype.hasOwnProperty.call(instituteSections, instituteName)) return instituteName;
  const match = Object.keys(instituteSections).find(name => sameInstituteName(name, instituteName));
  return match || instituteName;
}
function getInstituteSectionConfig(instituteSections, instituteName){
  const key = getInstituteSectionConfigKey(instituteSections, instituteName);
  return key ? instituteSections?.[key] || null : null;
}
function compareExportRows(a,b){
  const aClass = exportClassMeta(a.class);
  const bClass = exportClassMeta(b.class);
  if (aClass.gradeOrder !== bClass.gradeOrder) return aClass.gradeOrder - bClass.gradeOrder;
  const classCmp = exportTextSorter.compare(aClass.clean, bClass.clean);
  if (classCmp !== 0) return classCmp;
  if ((a.date || "") !== (b.date || "")) return (a.date || "").localeCompare(b.date || "");
  if ((a.start_time || "") !== (b.start_time || "")) return (a.start_time || "").localeCompare(b.start_time || "");
  if ((a.end_time || "") !== (b.end_time || "")) return (a.end_time || "").localeCompare(b.end_time || "");
  const teacherCmp = exportTextSorter.compare(a.teacher || "", b.teacher || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}
function compareChronologicalRows(a,b){
  if ((a.date || "") !== (b.date || "")) return (a.date || "").localeCompare(b.date || "");
  if ((a.start_time || "") !== (b.start_time || "")) return (a.start_time || "").localeCompare(b.start_time || "");
  if ((a.end_time || "") !== (b.end_time || "")) return (a.end_time || "").localeCompare(b.end_time || "");
  const teacherCmp = exportTextSorter.compare(a.teacher || "", b.teacher || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}
function compareAdminPanelEntries(a,b){
  if ((a.dateKey || "") !== (b.dateKey || "")) return (a.dateKey || "").localeCompare(b.dateKey || "");
  if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
  if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
  const teacherCmp = exportTextSorter.compare(a.teacherName || "", b.teacherName || "");
  if (teacherCmp !== 0) return teacherCmp;
  const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
  if (subjectCmp !== 0) return subjectCmp;
  return exportTextSorter.compare(a.title || "", b.title || "");
}
function escapeExportHtml(v){
  return String(v || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
function exportHtmlWithBreaks(v){
  return escapeExportHtml(v).replace(/\n/g,"<br/>");
}
function formatExportPdfDate(dk){
  if(!dk) return "";
  const [y,m,d] = dk.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function formatExportPdfTime(start,end){
  if(!start && !end) return "";
  if(start && end) return `${fmt12(start)} - ${fmt12(end)}`;
  return fmt12(start || end || "");
}
function normaliseSectionKey(value){
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}
function getInstituteSectionNames(instData){
  return [...new Set(
    [
      ...(instData?.gradeGroups || []).flatMap(group => group.sections || []),
      ...(instData?.extraSections || []),
    ]
      .map(section => String(section || "").trim())
      .filter(Boolean)
  )];
}
function uniqueSectionNames(values){
  return [...new Set((values || []).map(v => String(v || "").trim()).filter(Boolean))];
}
function splitSectionTokens(value){
  return normaliseSectionKey(value).split(/[^a-z0-9]+/).filter(Boolean);
}
function scoreSectionRenameTarget(oldSection, candidate){
  const oldTokens = splitSectionTokens(oldSection);
  const nextTokens = splitSectionTokens(candidate);
  if(!oldTokens.length || !nextTokens.length) return 0;
  let score = 0;
  if(oldTokens[0] && nextTokens[0] && oldTokens[0] === nextTokens[0]) score += 4;
  const shared = oldTokens.filter(token => nextTokens.includes(token));
  score += shared.length * 2;
  if(normaliseSectionKey(candidate).startsWith(normaliseSectionKey(oldSection)) || normaliseSectionKey(oldSection).startsWith(normaliseSectionKey(candidate))) {
    score += 1;
  }
  return score;
}
function guessSectionRenameTarget(oldSection, preferredSections, fallbackSections = []){
  const pool = [...(preferredSections || []), ...(fallbackSections || []).filter(item => !(preferredSections || []).includes(item))];
  if((preferredSections || []).length === 1) return preferredSections[0];
  const ranked = pool
    .map((value, index) => ({ value, index, score:scoreSectionRenameTarget(oldSection, value) }))
    .sort((a,b)=>b.score-a.score || a.index-b.index);
  return ranked[0]?.score > 0 ? ranked[0].value : "";
}
function findStrongSectionRenameTarget(oldSection, candidateSections){
  const oldKey = normaliseSectionKey(oldSection);
  const pool = uniqueSectionNames(candidateSections).filter(section => normaliseSectionKey(section) !== oldKey);
  if(!oldKey || !pool.length) return "";
  if(pool.length === 1) return pool[0];
  const ranked = pool
    .map((value, index) => ({ value, index, score:scoreSectionRenameTarget(oldSection, value) }))
    .sort((a,b)=>b.score-a.score || a.index-b.index);
  const top = ranked[0];
  const second = ranked[1];
  if(!top || top.score < 4) return "";
  if(second && second.score >= top.score - 1 && top.score < 7) return "";
  return top.value || "";
}
function buildGroupScheduleFingerprint(group){
  const slots = (group?.slots || []).map(slot => ({
    start:String(slot?.start || ""),
    end:String(slot?.end || ""),
    durMins:Number(slot?.durMins || 0),
  }));
  const overrides = Object.fromEntries(
    Object.entries(group?.sectionOverrides || {})
      .sort((a,b)=>exportTextSorter.compare(a[0], b[0]))
      .map(([section, rows])=>[
        section,
        (rows || []).map(slot => ({
          start:String(slot?.start || ""),
          end:String(slot?.end || ""),
          durMins:Number(slot?.durMins || 0),
        })),
      ])
  );
  return JSON.stringify({ slots, overrides });
}
function buildSectionChangeDraft(previousGroup, nextGroup){
  const previousSections = uniqueSectionNames(previousGroup?.sections || []);
  const nextSections = uniqueSectionNames(nextGroup?.sections || []);
  const nextLookup = new Set(nextSections.map(normaliseSectionKey));
  const previousLookup = new Set(previousSections.map(normaliseSectionKey));
  const removedSections = previousSections.filter(section => !nextLookup.has(normaliseSectionKey(section)));
  const addedSections = nextSections.filter(section => !previousLookup.has(normaliseSectionKey(section)));
  return {
    removedSections,
    addedSections,
    currentSections: nextSections,
    timetableChanged: buildGroupScheduleFingerprint(previousGroup) !== buildGroupScheduleFingerprint(nextGroup),
  };
}
function buildInitialSectionRenameSelections(draft){
  const selections = {};
  (draft?.removedSections || []).forEach((oldSection, index) => {
    const preferred = draft?.addedSections || [];
    const fallback = draft?.currentSections || [];
    const guessed = preferred[index] || guessSectionRenameTarget(oldSection, preferred, fallback) || "";
    selections[oldSection] = guessed;
  });
  return selections;
}
function mergeExplicitSectionRenames(records, oldSection, newSection){
  const oldLabel = String(oldSection || "").trim();
  const nextLabel = String(newSection || "").trim();
  const oldKey = normaliseSectionKey(oldLabel);
  const nextKey = normaliseSectionKey(nextLabel);
  if(!oldKey || !nextKey || oldKey === nextKey) return records || [];
  const nextRecords = [];
  let linked = false;
  (records || []).forEach(record => {
    const recordOld = String(record?.oldSection || "").trim();
    const recordNew = String(record?.newSection || "").trim();
    const recordOldKey = normaliseSectionKey(recordOld);
    const recordNewKey = normaliseSectionKey(recordNew);
    if(!recordOldKey || !recordNewKey) return;
    if(recordNewKey === oldKey || recordOldKey === oldKey){
      nextRecords.push({ oldSection: recordOld, newSection: nextLabel });
      linked = true;
      return;
    }
    nextRecords.push({ oldSection: recordOld, newSection: recordNew });
  });
  if(!linked){
    nextRecords.push({ oldSection: oldLabel, newSection: nextLabel });
  }
  const byOld = new Map();
  nextRecords.forEach(record => {
    const recordOld = String(record?.oldSection || "").trim();
    const recordNew = String(record?.newSection || "").trim();
    const recordOldKey = normaliseSectionKey(recordOld);
    const recordNewKey = normaliseSectionKey(recordNew);
    if(!recordOldKey || !recordNewKey || recordOldKey === recordNewKey) return;
    byOld.set(recordOldKey, { oldSection: recordOld, newSection: recordNew });
  });
  return [...byOld.values()];
}
function pruneExplicitSectionRenames(records, removedSection){
  const removedKey = normaliseSectionKey(removedSection);
  return (records || []).filter(record => {
    const oldKey = normaliseSectionKey(record?.oldSection);
    const newKey = normaliseSectionKey(record?.newSection);
    return oldKey && newKey && oldKey !== removedKey && newKey !== removedKey;
  });
}
function buildExplicitSectionRenameSelections(previousGroup, nextGroup, records){
  const previousSections = uniqueSectionNames(previousGroup?.sections || []);
  const nextSections = uniqueSectionNames(nextGroup?.sections || []);
  const previousLookup = new Set(previousSections.map(normaliseSectionKey));
  const nextLookup = new Set(nextSections.map(normaliseSectionKey));
  const selections = {};
  (records || []).forEach(record => {
    const oldSection = String(record?.oldSection || "").trim();
    const newSection = String(record?.newSection || "").trim();
    const oldKey = normaliseSectionKey(oldSection);
    const newKey = normaliseSectionKey(newSection);
    if(!oldKey || !newKey || oldKey === newKey) return;
    if(!previousLookup.has(oldKey)) return;
    if(nextLookup.has(oldKey)) return;
    if(!nextLookup.has(newKey)) return;
    selections[oldSection] = newSection;
  });
  return selections;
}
function applySectionRenameSelections(group, selections){
  const currentSections = new Set(uniqueSectionNames(group?.sections || []));
  const nextOverrides = { ...(group?.sectionOverrides || {}) };
  Object.entries(selections || {}).forEach(([oldSection, newSection])=>{
    const fromKey = String(oldSection || "").trim();
    const toKey = String(newSection || "").trim();
    if(!fromKey) return;
    if(toKey && currentSections.has(toKey) && !nextOverrides[toKey] && (nextOverrides[fromKey] || []).length){
      nextOverrides[toKey] = nextOverrides[fromKey];
    }
    delete nextOverrides[fromKey];
  });
  const filteredOverrides = Object.fromEntries(
    Object.entries(nextOverrides).filter(([section]) => currentSections.has(section))
  );
  return { ...group, sectionOverrides: filteredOverrides };
}
function buildSectionChangeEvents(inst, previousGroup, nextGroup, selections, timetableChanged){
  const changes = Object.entries(selections || {})
    .map(([oldSection, newSection]) => ({
      oldSection:String(oldSection || "").trim(),
      newSection:String(newSection || "").trim(),
    }))
    .filter(change => change.oldSection && change.newSection && normaliseSectionKey(change.oldSection) !== normaliseSectionKey(change.newSection));
  if(!changes.length) return [];
  return [{
    id:`secchg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    institute: inst,
    groupId: nextGroup?.id || previousGroup?.id || "",
    groupLabel: nextGroup?.label || previousGroup?.label || "",
    createdAt: Date.now(),
    timetableChanged: !!timetableChanged,
    changes,
  }];
}
function getInstituteEntityLabels(instType){
  const coaching = instType === "coaching_12" || instType === "coaching_grad";
  return coaching
    ? { singular:"batch", plural:"batches" }
    : { singular:"section", plural:"sections" };
}
function mergeInstituteSectionChangeEvents(existingEvents, nextEvents){
  const merged = [...(existingEvents || []), ...(nextEvents || [])];
  return merged
    .sort((a,b)=>(a?.createdAt || 0) - (b?.createdAt || 0))
    .slice(-60);
}
function getAdminInstituteSectionChangeEvents(instData){
  return [...(instData?.sectionChangeEvents || [])]
    .filter(event => Array.isArray(event?.changes) && event.changes.length > 0)
    .sort((a,b)=>(a?.createdAt || 0) - (b?.createdAt || 0));
}
function resolveAdminSectionName(section, instituteName, instituteSections){
  const original = String(section || "").trim();
  if(!original) return "";
  const instData = getInstituteSectionConfig(instituteSections, instituteName);
  if(!instData) return original;
  let current = original;
  getAdminInstituteSectionChangeEvents(instData).forEach(event => {
    const match = (event.changes || []).find(change =>
      normaliseSectionKey(change?.oldSection) === normaliseSectionKey(current) &&
      String(change?.newSection || "").trim()
    );
    if(match){
      current = String(match.newSection || "").trim();
    }
  });
  const currentSections = getInstituteSectionNames(instData);
  const currentKey = normaliseSectionKey(current);
  const inCurrentList = currentSections.some(section => normaliseSectionKey(section) === currentKey);
  if(!inCurrentList){
    const guessed = findStrongSectionRenameTarget(current, currentSections);
    if(guessed) return guessed;
  }
  return current || original;
}
function dedupeSectionLabels(values){
  const seen = new Set();
  const result = [];
  (values || []).forEach(value => {
    const label = String(value || "").trim();
    const key = normaliseSectionKey(label);
    if(!key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
}
function applyAdminSectionChangeEventsToTeacherData(data, instituteName, sectionChangeEvents){
  const changes = (sectionChangeEvents || [])
    .flatMap(event => Array.isArray(event?.changes) ? event.changes : [])
    .map(change => ({
      oldSection:String(change?.oldSection || "").trim(),
      newSection:String(change?.newSection || "").trim(),
    }))
    .filter(change => change.oldSection && change.newSection && normaliseSectionKey(change.oldSection) !== normaliseSectionKey(change.newSection));
  if(!data || !changes.length) return data;

  let changed = false;
  const resolveSectionLabel = (section, targetInstitute) => {
    if(!sameInstituteName(targetInstitute, instituteName)) return String(section || "").trim();
    let nextSection = String(section || "").trim();
    changes.forEach(change => {
      if(normaliseSectionKey(change.oldSection) === normaliseSectionKey(nextSection)){
        nextSection = change.newSection;
      }
    });
    return nextSection;
  };
  const updateClassLike = (item, sectionField = "section", instituteField = "institute") => {
    if(!item) return item;
    const currentSection = String(item?.[sectionField] || "").trim();
    const nextSection = resolveSectionLabel(currentSection, item?.[instituteField]);
    if(normaliseSectionKey(nextSection) === normaliseSectionKey(currentSection)) return item;
    changed = true;
    return { ...item, [sectionField]: nextSection };
  };
  const nextClasses = (data.classes || []).map(cls => updateClassLike(cls));
  const nextSections = dedupeSectionLabels((data.sections || []).map(section => resolveSectionLabel(section, instituteName)));
  const existingSections = data.sections || [];
  if(
    nextSections.length !== existingSections.length ||
    nextSections.some((section, index) => normaliseSectionKey(section) !== normaliseSectionKey(existingSections[index]))
  ){
    changed = true;
  }
  const nextTrashClasses = (data.trash?.classes || []).map(cls => updateClassLike(cls));
  const nextTrashNotes = (data.trash?.notes || []).map(note => {
    if(!note) return note;
    const currentClassName = String(note.className || "").trim();
    const nextClassName = resolveSectionLabel(currentClassName, note.institute);
    if(normaliseSectionKey(nextClassName) === normaliseSectionKey(currentClassName)) return note;
    changed = true;
    return { ...note, className: nextClassName };
  });
  if(!changed) return data;
  return {
    ...data,
    classes: nextClasses,
    sections: nextSections,
    trash: {
      ...(data.trash || {}),
      classes: nextTrashClasses,
      notes: nextTrashNotes,
    },
  };
}
function collectLegacySectionRepairItems(fullDataByUid, teachers, instituteName, instituteSections){
  const currentSections = getInstituteSectionNames(getInstituteSectionConfig(instituteSections, instituteName));
  const currentLookup = new Set(currentSections.map(normaliseSectionKey));
  const byLegacySection = new Map();

  (teachers || []).forEach(teacher => {
    const data = fullDataByUid?.[teacher.uid];
    if(!data) return;
    const teacherName = data.profile?.name || teacher.name || "Teacher";
    (data.classes || []).forEach(cls => {
      if(!cls || cls.left || !sameInstituteName(cls.institute, instituteName)) return;
      const rawSection = String(cls.section || "").trim();
      if(!rawSection) return;
      const rawKey = normaliseSectionKey(rawSection);
      const resolvedSection = String(resolveAdminSectionName(rawSection, cls.institute, instituteSections) || rawSection).trim();
      const resolvedKey = normaliseSectionKey(resolvedSection);
      const suggested =
        resolvedKey && resolvedKey !== rawKey && currentLookup.has(resolvedKey)
          ? resolvedSection
          : findStrongSectionRenameTarget(rawSection, currentSections);
      const shouldInclude = !currentLookup.has(rawKey) || (suggested && normaliseSectionKey(suggested) !== rawKey);
      if(!shouldInclude) return;

      const key = rawKey;
      if(!byLegacySection.has(key)){
        byLegacySection.set(key, {
          oldSection: rawSection,
          teacherNames: new Set(),
          subjects: new Set(),
          classRefs: [],
          suggested: suggested || guessSectionRenameTarget(rawSection, currentSections, currentSections) || "",
        });
      }
      const bucket = byLegacySection.get(key);
      if(!bucket.suggested && suggested){
        bucket.suggested = suggested;
      }
      bucket.teacherNames.add(teacherName);
      if(cls.subject) bucket.subjects.add(String(cls.subject).trim());
      bucket.classRefs.push({
        uid: teacher.uid,
        classId: cls.id,
        rawSection,
        teacherName,
        subject: String(cls.subject || "").trim(),
        institute: cls.institute || instituteName,
      });
    });
  });

  return {
    currentSections,
    items: Array.from(byLegacySection.values())
      .map(item => {
        const teacherNames = Array.from(item.teacherNames).sort(exportTextSorter.compare);
        const subjects = Array.from(item.subjects).sort(exportTextSorter.compare);
        return {
          oldSection: item.oldSection,
          suggested: item.suggested,
          classRefs: item.classRefs,
          teacherNames,
          subjects,
          affectedClassCount: item.classRefs.length,
          affectedTeacherCount: teacherNames.length,
        };
      })
      .sort((a,b)=>exportTextSorter.compare(a.oldSection, b.oldSection)),
  };
}
function collectAllLegacySectionRepairItems(fullDataByUid, teachers, instituteNames, instituteSections){
  return (instituteNames || []).flatMap(instituteName => {
    const repair = collectLegacySectionRepairItems(fullDataByUid, teachers, instituteName, instituteSections);
    return repair.items.map(item => ({
      ...item,
      institute: instituteName,
      options: repair.currentSections,
      selectionKey: `${instituteName}::${item.oldSection}`,
    }));
  }).sort((a,b)=>
    exportTextSorter.compare(a.institute || "", b.institute || "") ||
    exportTextSorter.compare(a.oldSection || "", b.oldSection || "")
  );
}
function collectPendingInstituteSections(fullDataByUid, teachers, instituteName, instituteSections){
  const currentSections = getInstituteSectionNames(getInstituteSectionConfig(instituteSections, instituteName));
  const currentLookup = new Set(currentSections.map(normaliseSectionKey));
  const bySection = new Map();

  (teachers || []).forEach(teacher => {
    const data = fullDataByUid?.[teacher.uid];
    if(!data) return;
    const teacherName = data.profile?.name || teacher.name || "Teacher";
    (data.classes || []).forEach(cls => {
      if(!cls || cls.left || !sameInstituteName(cls.institute, instituteName)) return;
      const rawSection = String(cls.section || "").trim();
      const rawKey = normaliseSectionKey(rawSection);
      if(!rawKey || currentLookup.has(rawKey)) return;
      if(!bySection.has(rawKey)){
        bySection.set(rawKey, {
          section: rawSection,
          teacherNames: new Set(),
          subjects: new Set(),
          classRefs: [],
        });
      }
      const bucket = bySection.get(rawKey);
      bucket.teacherNames.add(teacherName);
      if(cls.subject) bucket.subjects.add(String(cls.subject || "").trim());
      bucket.classRefs.push({
        uid: teacher.uid,
        classId: cls.id,
        section: rawSection,
        teacherName,
        subject: String(cls.subject || "").trim(),
        institute: cls.institute || instituteName,
      });
    });
  });

  return Array.from(bySection.values())
    .map(item => {
      const teacherNames = Array.from(item.teacherNames).sort(exportTextSorter.compare);
      const subjects = Array.from(item.subjects).sort(exportTextSorter.compare);
      return {
        section: item.section,
        teacherNames,
        subjects,
        classRefs: item.classRefs,
        affectedClassCount: item.classRefs.length,
        affectedTeacherCount: teacherNames.length,
      };
    })
    .sort((a,b)=>exportTextSorter.compare(a.section || "", b.section || ""));
}
function mergeEntryDateMaps(existingMap, incomingMap){
  const next = {};
  const keys = new Set([
    ...Object.keys(existingMap || {}),
    ...Object.keys(incomingMap || {}),
  ]);
  keys.forEach(dateKey => {
    const existing = Array.isArray(existingMap?.[dateKey]) ? existingMap[dateKey] : [];
    const incoming = Array.isArray(incomingMap?.[dateKey]) ? incomingMap[dateKey] : [];
    if(!existing.length && !incoming.length) return;
    next[dateKey] = [...existing, ...incoming].sort((a,b)=>
      String(a?.timeStart || "").localeCompare(String(b?.timeStart || "")) ||
      String(a?.timeEnd || "").localeCompare(String(b?.timeEnd || "")) ||
      String(a?.id || "").localeCompare(String(b?.id || ""))
    );
  });
  return next;
}
function applyInstituteSectionActionsToTeacherData(data, instituteName, actionMap){
  if(!data) return { data, changed:false, removedClassIds:[] };
  const actions = Object.fromEntries(
    Object.entries(actionMap || {})
      .map(([section, action])=>[normaliseSectionKey(section), String(action || "").trim()])
      .filter(([sectionKey, action])=>sectionKey && action)
  );
  if(!Object.keys(actions).length) return { data, changed:false, removedClassIds:[] };

  let changed = false;
  let classes = [...(data.classes || [])];
  const notes = { ...(data.notes || {}) };
  const removedClassIds = [];

  Object.entries(actions).forEach(([oldSectionKey, action]) => {
    const matchingClasses = classes.filter(cls =>
      cls &&
      !cls.left &&
      sameInstituteName(cls.institute, instituteName) &&
      normaliseSectionKey(cls.section) === oldSectionKey
    );
    if(!matchingClasses.length) return;

    if(action === DELETE_SECTION_ACTION){
      matchingClasses.forEach(cls => {
        classes = classes.filter(item => item.id !== cls.id);
        delete notes[cls.id];
        removedClassIds.push(cls.id);
        changed = true;
      });
      return;
    }

    matchingClasses.forEach(cls => {
      const targetSection = action;
      const targetKey = normaliseSectionKey(targetSection);
      const existingTarget = classes.find(other =>
        other &&
        other.id !== cls.id &&
        !other.left &&
        sameInstituteName(other.institute, cls.institute) &&
        normaliseSectionKey(other.section) === targetKey &&
        normaliseSectionKey(other.subject) === normaliseSectionKey(cls.subject)
      );

      if(existingTarget){
        notes[existingTarget.id] = mergeEntryDateMaps(notes[existingTarget.id] || {}, notes[cls.id] || {});
        delete notes[cls.id];
        classes = classes.filter(item => item.id !== cls.id);
        removedClassIds.push(cls.id);
        changed = true;
        return;
      }

      classes = classes.map(item => item.id === cls.id ? { ...item, section: targetSection } : item);
      changed = true;
    });
  });

  if(!changed) return { data, changed:false, removedClassIds:[] };

  const transformedSections = (data.sections || []).map(section => {
    const action = actions[normaliseSectionKey(section)];
    if(!action) return section;
    if(action === DELETE_SECTION_ACTION) return "";
    return action;
  }).filter(Boolean);
  const derivedSections = classes
    .filter(cls => !cls?.left && sameInstituteName(cls?.institute, instituteName))
    .map(cls => String(cls.section || "").trim())
    .filter(Boolean);

  return {
    data: {
      ...data,
      classes,
      notes,
      sections: uniqueSectionNames([...transformedSections, ...derivedSections]),
    },
    changed:true,
    removedClassIds:[...new Set(removedClassIds)],
  };
}
function compareClassCardsByActivity(a,b){
  const aTs = Number(a?.lastActivityTs || 0);
  const bTs = Number(b?.lastActivityTs || 0);
  if(bTs !== aTs) return bTs - aTs;
  return exportTextSorter.compare(a?.display || "", b?.display || "");
}
const ADMIN_PROGRAM_GROUPS = [
  { key:"jee", label:"JEE", accent:"#1D4ED8", bg:"#EEF4FF", border:"#BFDBFE" },
  { key:"neet", label:"NEET", accent:"#059669", bg:"#ECFDF5", border:"#A7F3D0" },
  { key:"foundation", label:"Foundation", accent:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
];
const ADMIN_JEE_SECTION_HINTS = ["virat", "madhav", "parth", "iit", "jee"];
const ADMIN_NEET_SECTION_HINTS = ["sankalp", "keshav", "govind", "medical", "neet"];
const ADMIN_FOUNDATION_SECTION_HINTS = ["lakshay", "aarambh", "foundation"];
function extractExplicitClassGrade(value){
  const match = String(value || "").match(/(?:^|\b)(6|7|8|9|10|11|12)(?:st|nd|rd|th)\b/i);
  return match ? Number(match[1]) : 0;
}
function includesAnyProgramHint(haystack, hints){
  return (hints || []).some(hint => haystack.includes(hint));
}
function detectAdminClassProgramGroup(cls){
  const label = `${cls?.display || ""} ${cls?.raw || ""}`;
  const normalisedLabel = normaliseSectionKey(label);
  const grade = extractExplicitClassGrade(label);
  if(grade >= 6 && grade <= 10) return "foundation";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_FOUNDATION_SECTION_HINTS)) return "foundation";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_NEET_SECTION_HINTS)) return "neet";
  if(includesAnyProgramHint(normalisedLabel, ADMIN_JEE_SECTION_HINTS)) return "jee";

  const subjectKeys = (cls?.subjects || []).map(normaliseSectionKey);
  const hasBiology = subjectKeys.some(subject => subject.includes("biology"));
  const hasMathematics = subjectKeys.some(subject => subject.includes("mathematics"));
  const hasPhysics = subjectKeys.some(subject => subject.includes("physics"));
  const hasChemistry = subjectKeys.some(subject => subject.includes("chemistry"));

  if(hasBiology && !hasMathematics) return "neet";
  if(grade >= 11) return "jee";
  if(hasMathematics || hasPhysics || hasChemistry) return "jee";
  return "jee";
}
function buildAdminProgramClassGroups(classes){
  const grouped = {
    jee:[],
    neet:[],
    foundation:[],
  };
  (classes || []).forEach(cls => {
    const groupKey = detectAdminClassProgramGroup(cls);
    if(!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(cls);
  });
  return ADMIN_PROGRAM_GROUPS
    .map(group => ({ ...group, items: grouped[group.key] || [] }))
    .filter(group => group.items.length > 0);
}
function groupAdminPdfRows(rows){
  const byInstitute = new Map();
  rows.forEach(row=>{
    const instName = (row.institute || "No Institute").trim() || "No Institute";
    const className = (row.class || "Untitled Class").trim() || "Untitled Class";
    if(!byInstitute.has(instName)){
      byInstitute.set(instName, { name:instName, classMap:new Map(), entryCount:0 });
    }
    const inst = byInstitute.get(instName);
    if(!inst.classMap.has(className)){
      inst.classMap.set(className, { className, entries:[], teachers:new Set(), subjects:new Set() });
    }
    const group = inst.classMap.get(className);
    group.entries.push(row);
    if(row.teacher) group.teachers.add(row.teacher);
    if(row.subject) group.subjects.add(row.subject);
    inst.entryCount += 1;
  });

  return Array.from(byInstitute.values())
    .sort((a,b)=>exportTextSorter.compare(a.name, b.name))
    .map(inst=>{
      const classes = Array.from(inst.classMap.values())
        .sort((a,b)=>{
          const aMeta = exportClassMeta(a.className);
          const bMeta = exportClassMeta(b.className);
          if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
          return exportTextSorter.compare(aMeta.clean, bMeta.clean);
        })
        .map(group=>({
          ...group,
          teacherList:Array.from(group.teachers).sort(exportTextSorter.compare),
          subjectList:Array.from(group.subjects).sort(exportTextSorter.compare),
          entries:[...group.entries].sort(compareChronologicalRows),
        }));
      return {
        name:inst.name,
        classes,
        classCount:classes.length,
        entryCount:inst.entryCount,
      };
    });
}
function groupAdminPanelEntries(entries){
  const classMap = new Map();
  entries.forEach(entry=>{
    const className = (entry.className || "Untitled Class").trim() || "Untitled Class";
    if(!classMap.has(className)){
      classMap.set(className, { className, entries:[], teachers:new Set(), subjects:new Set() });
    }
    const group = classMap.get(className);
    group.entries.push(entry);
    if(entry.teacherName) group.teachers.add(entry.teacherName);
    if(entry.subject) group.subjects.add(entry.subject);
  });

  return Array.from(classMap.values())
    .sort((a,b)=>{
      const aMeta = exportClassMeta(a.className);
      const bMeta = exportClassMeta(b.className);
      if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
      return exportTextSorter.compare(aMeta.clean, bMeta.clean);
    })
    .map(group=>({
      ...group,
      teacherList:Array.from(group.teachers).sort(exportTextSorter.compare),
      subjectList:Array.from(group.subjects).sort(exportTextSorter.compare),
      entries:[...group.entries].sort(compareAdminPanelEntries),
    }));
}
function fmt12(t){
  if(!t) return "";
  const[h,m]=t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}
function parseClockMins(t){
  if(!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h,m] = t.split(":").map(Number);
  if(Number.isNaN(h) || Number.isNaN(m)) return null;
  return h*60 + m;
}
function entryDurationMinutes(entry){
  const start = parseClockMins(entry?.timeStart);
  const end = parseClockMins(entry?.timeEnd);
  if(start===null || end===null || end<=start) return 0;
  return end - start;
}
function formatDurationShort(totalMins){
  const mins = Math.max(0, Math.round(totalMins || 0));
  const h = Math.floor(mins/60);
  const m = mins%60;
  if(h && m) return `${h}h ${m}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}
const MONTH_NAMES_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatAdminDateKey(dateKey, options = { month:"short", day:"numeric" }){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||""))) return "";
  const [y,m,d]=String(dateKey).split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US", options);
}
function adminPeriodLabel(period, rangeStart = null, rangeEnd = null){
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
function getPeriodFilter(period, rangeStart = null, rangeEnd = null){
  if(period==="today") return {days:1,startKey:null,endKey:null};
  if(period==="yesterday"){
    const yesterday = addDaysToDateKey(todayKey(), -1);
    return {days:null,startKey:yesterday,endKey:yesterday};
  }
  if(period==="week") return {days:7,startKey:null,endKey:null};
  if(period==="month") return {days:30,startKey:null,endKey:null};
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
const SUBJECT_COLOR_PALETTE = ["#1D4ED8","#16A34A","#EA580C","#7C3AED","#0891B2","#DC2626","#CA8A04","#4F46E5"];
function subjectColor(name){
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash) + text.charCodeAt(i);
  return SUBJECT_COLOR_PALETTE[Math.abs(hash) % SUBJECT_COLOR_PALETTE.length];
}
function hexToRgb(hex){
  const clean = String(hex || "").replace("#","").trim();
  if(clean.length !== 6) return { r:29, g:78, b:216 };
  return {
    r: parseInt(clean.slice(0,2), 16),
    g: parseInt(clean.slice(2,4), 16),
    b: parseInt(clean.slice(4,6), 16),
  };
}
function mixHex(baseHex, mixHexValue = "#FFFFFF", weight = 0.5){
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHexValue);
  const ratio = Math.max(0, Math.min(1, weight));
  const toHex = value => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(base.r + (mix.r - base.r) * ratio)}${toHex(base.g + (mix.g - base.g) * ratio)}${toHex(base.b + (mix.b - base.b) * ratio)}`;
}
function alphaHex(baseHex, alpha = 1){
  const { r, g, b } = hexToRgb(baseHex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}
const COACHING_CATEGORY_ORDER = {
  coaching_12: ["JEE","NEET","NDA","CLAT","CUET","Foundation","Dropper","Other"],
  coaching_grad: ["Banking","SSC","UPSC","CAT","GATE","RRB","Defence","Other"],
};
function coachingClassificationLabel(instType, sectionName = "", groupLabel = "") {
  const text = `${sectionName} ${groupLabel}`.toLowerCase();
  const fallback = (groupLabel || "").trim() || "Other";
  if (instType === "coaching_12") {
    if (text.includes("jee")) return "JEE";
    if (text.includes("neet") || text.includes("medical") || /\bmed\b/.test(text)) return "NEET";
    if (text.includes("nda")) return "NDA";
    if (text.includes("clat")) return "CLAT";
    if (text.includes("cuet")) return "CUET";
    if (text.includes("foundation")) return "Foundation";
    if (text.includes("dropper")) return "Dropper";
    return fallback;
  }
  if (instType === "coaching_grad") {
    if (text.includes("bank")) return "Banking";
    if (text.includes("ssc")) return "SSC";
    if (text.includes("upsc")) return "UPSC";
    if (text.includes("cat")) return "CAT";
    if (text.includes("gate")) return "GATE";
    if (text.includes("rrb") || text.includes("rail")) return "RRB";
    if (text.includes("defence") || text.includes("defense")) return "Defence";
    return fallback;
  }
  return fallback;
}
function buildInstituteClassification(instType, groups) {
  const bucketMap = new Map();
  const addToBucket = ({ key, title, sectionLabel, sections, slots, overrideSections, group, sortOrder }) => {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        title,
        sectionLabel,
        sortOrder,
        sections: new Set(),
        slotMap: new Map(),
        overrideSections: new Set(),
        sourceGroups: [],
      });
    }
    const bucket = bucketMap.get(key);
    (sections || []).forEach(section => section && bucket.sections.add(section));
    (slots || []).forEach(slot => {
      const slotKey = `${slot?.start || ""}|${slot?.end || ""}|${slot?.durMins || ""}`;
      if (slot?.start) bucket.slotMap.set(slotKey, slot);
    });
    (overrideSections || []).forEach(section => section && bucket.overrideSections.add(section));
    if (!bucket.sourceGroups.some(item => item.id === group.id)) {
      bucket.sourceGroups.push(group);
    }
  };

  (groups || []).forEach(group => {
    const sections = Array.isArray(group?.sections) ? group.sections.filter(Boolean) : [];
    const slots = Array.isArray(group?.slots) ? group.slots : [];
    const overrides = Object.keys(group?.sectionOverrides || {}).filter(key => (group.sectionOverrides?.[key] || []).length > 0);

    if (instType === "school") {
      const grades = Array.isArray(group?.gradeNums) && group.gradeNums.length
        ? [...group.gradeNums].sort((a, b) => b - a)
        : [...new Set(sections.map(section => classNum(section)).filter(Boolean))].sort((a, b) => b - a);
      if (!grades.length) {
        addToBucket({
          key: `group_${group.id}`,
          title: group?.label || "Ungrouped",
          sectionLabel: "sections",
          sections,
          slots,
          overrideSections: overrides,
          group,
          sortOrder: 0,
        });
        return;
      }
      grades.forEach(grade => {
        let gradeSections = sections.filter(section => classNum(section) === grade);
        if (!gradeSections.length && grades.length === 1) {
          gradeSections = sections;
        }
        const gradeOverrides = overrides.filter(section => classNum(section) === grade || (!classNum(section) && grades.length === 1));
        addToBucket({
          key: `grade_${grade}`,
          title: `${grade}th`,
          sectionLabel: "sections",
          sections: gradeSections,
          slots,
          overrideSections: gradeOverrides,
          group,
          sortOrder: grade,
        });
      });
      return;
    }

    const categoryMap = new Map();
    if (sections.length) {
      sections.forEach(section => {
        const category = coachingClassificationLabel(instType, section, group?.label || "");
        if (!categoryMap.has(category)) categoryMap.set(category, []);
        categoryMap.get(category).push(section);
      });
    } else {
      categoryMap.set(coachingClassificationLabel(instType, "", group?.label || ""), []);
    }

    categoryMap.forEach((categorySections, category) => {
      const categoryOverrides = overrides.filter(section => coachingClassificationLabel(instType, section, group?.label || "") === category);
      const order = COACHING_CATEGORY_ORDER[instType] || [];
      const idx = order.indexOf(category);
      addToBucket({
        key: `${instType}_${category}`,
        title: category,
        sectionLabel: "batches",
        sections: categorySections,
        slots,
        overrideSections: categoryOverrides,
        group,
        sortOrder: idx === -1 ? 999 : idx,
      });
    });
  });

  return Array.from(bucketMap.values())
    .map(bucket => ({
      ...bucket,
      sections: [...bucket.sections].sort(exportTextSorter.compare),
      slots: [...bucket.slotMap.values()].sort((a, b) => (a?.start || "").localeCompare(b?.start || "")),
      overrideSections: [...bucket.overrideSections].sort(exportTextSorter.compare),
      sourceGroups: [...bucket.sourceGroups].sort((a, b) => exportTextSorter.compare(a?.label || "", b?.label || "")),
    }))
    .sort((a, b) => {
      if (instType === "school" && a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return exportTextSorter.compare(a.title, b.title);
    });
}
function SubjectSplitDonut({ segments, totalMinutes, size = 120, strokeWidth = 18 }) {
  const safeTotal = Math.max(0, totalMinutes || 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const chartId = React.useId ? React.useId().replace(/[:]/g,"") : `chart_${size}_${strokeWidth}`;
  const sortedSegments = [...(segments || [])].sort((a,b)=>(b.minutes || 0) - (a.minutes || 0));
  const primaryColor = sortedSegments[0]?.color || "#1D4ED8";
  const ringGap = sortedSegments.length > 1 ? Math.min(5, circumference * 0.014) : 0;
  const innerRadius = Math.max(radius - strokeWidth / 2 - 5, 18);
  const totalLabel = safeTotal > 0 ? formatDurationShort(safeTotal) : "Untimed";
  const totalFontSize = totalLabel.length >= 7 ? 13 : totalLabel.length >= 5 ? 15 : 17;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{overflow:"visible"}}>
      <defs>
        {sortedSegments.map((seg, index)=>(
          <linearGradient key={`${seg.subject}_${index}_grad`} id={`${chartId}_grad_${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={mixHex(seg.color, "#FFFFFF", 0.2)} />
            <stop offset="100%" stopColor={mixHex(seg.color, "#0F172A", 0.08)} />
          </linearGradient>
        ))}
        <filter id={`${chartId}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={alphaHex(primaryColor, 0.16)} />
        </filter>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius + 5}
        fill={alphaHex(primaryColor, 0.06)}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E7EDF6"
        strokeWidth={strokeWidth}
      />
      {safeTotal > 0 && sortedSegments.map((seg, index) => {
        const rawLength = (seg.minutes / safeTotal) * circumference;
        const segmentLength = Math.max(rawLength - ringGap, 0);
        const segmentOffset = offset + ringGap / 2;
        const circle = (
          <circle
            key={`${seg.subject}_${seg.minutes}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${chartId}_grad_${index})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${Math.max(circumference - segmentLength, 0)}`}
            strokeDashoffset={-segmentOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter={`url(#${chartId}_shadow)`}
          />
        );
        offset += rawLength;
        return circle;
      })}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={innerRadius}
        fill="#FFFFFF"
        stroke="#EEF2F7"
        strokeWidth="1.5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={Math.max(innerRadius - 4, 10)}
        fill={safeTotal > 0 ? alphaHex(primaryColor, 0.06) : "#F8FAFC"}
      />
      <text
        x="50%"
        y={safeTotal > 0 ? "47%" : "44%"}
        textAnchor="middle"
        style={{ fill: "#111827", fontSize: safeTotal > 0 ? totalFontSize : 12, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}
      >
        {totalLabel}
      </text>
      <text
        x="50%"
        y={safeTotal > 0 ? "61%" : "60%"}
        textAnchor="middle"
        style={{ fill: "#6B7280", fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: 0.9 }}
      >
        {safeTotal > 0 ? `${sortedSegments.length} ${sortedSegments.length===1?"subject":"subjects"}` : "logs only"}
      </text>
    </svg>
  );
}
function daysAgo(ts){
  if(!ts) return null;
  const d=Math.floor((Date.now()-ts)/(1000*60*60*24));
  if(d===0) return "Today";
  if(d===1) return "Yesterday";
  if(d<=7)  return `${d}d ago`;
  if(d<=30) return `${Math.floor(d/7)}w ago`;
  return `${Math.floor(d/30)}mo ago`;
}
function lastEntryTs(notes={}){
  let latest=0;
  try {
    const scan = (value) => {
      if (Array.isArray(value)) {
        value.forEach(n=>{ if(n && n.created>latest) latest=n.created; });
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.values(value).forEach(scan);
    };
    scan(notes || {});
  } catch(e){}
  return latest||null;
}
function shortDateLabel(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}
function longDateLabel(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
}
function currentMonthKey(now = new Date()){
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function localDateKey(value = new Date()){
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return todayKey();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDaysToDateKey(dateKey, days){
  const [y, m, d] = String(dateKey || todayKey()).split("-").map(Number);
  const date = new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
function currentMonthStartKey(now = new Date()){
  return `${currentMonthKey(now)}-01`;
}
function monthBoundsFromKey(monthKey = currentMonthKey()){
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
function countEntriesForMonth(classNotes = {}, monthKey = currentMonthKey()){
  return Object.entries(classNotes || {}).reduce((sum, [dk, entries]) => {
    if(!dk.startsWith(monthKey) || !Array.isArray(entries)) return sum;
    return sum + entries.length;
  }, 0);
}
function getSyllabusProgressChapterTitle(entry){
  const explicit = String(entry?.syllabusChapterTitle || entry?.chapterTitle || "").trim();
  if(explicit) return explicit;
  const title = String(entry?.title || "").trim();
  if(/^completed\s+/i.test(title)) return title.replace(/^completed\s+/i, "").trim();
  return title;
}
function isSyllabusProgressEntry(entry){
  if(!entry || typeof entry !== "object") return false;
  const title = String(entry?.title || "").trim();
  const notes = String(entry?.body || entry?.notes || "").trim();
  const hasSyllabusMarker = Boolean(
    entry?.syllabusTemplateId ||
    entry?.syllabusId ||
    entry?.syllabusChapterId ||
    entry?.syllabusChapterTitle ||
    entry?.chapterTitle ||
    entry?.syllabusChapterCompleted ||
    (Array.isArray(entry?.completedSyllabusChapterIds) && entry.completedSyllabusChapterIds.length) ||
    (Array.isArray(entry?.coveredSyllabusChapterIds) && entry.coveredSyllabusChapterIds.length) ||
    (Array.isArray(entry?.completedSyllabusTopicIds) && entry.completedSyllabusTopicIds.length)
  );
  if(!hasSyllabusMarker) return false;
  return (
    entry?.syllabusChapterCompleted === true ||
    /^completed\s+/i.test(title) ||
    /syllabus progress update/i.test(title) ||
    /^gs syllabus$/i.test(notes) ||
    /syllabus/i.test(notes)
  );
}
function syllabusReportArray(value){
  if(Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  if(typeof value === "string"){
    const trimmed = value.trim();
    if(!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if(Array.isArray(parsed)) return parsed.map(item => String(item || "").trim()).filter(Boolean);
    } catch {}
    return trimmed.split(",").map(item => item.trim()).filter(Boolean);
  }
  return [];
}
function syllabusReportChapterMarker(chapterId){
  const id = String(chapterId || "").trim();
  return id ? `chapter:${id}` : "";
}
function syllabusReportNameKey(value){
  return normaliseName(String(value || "").trim()).toLowerCase();
}
function getPublishedSyllabusPayload(template){
  if(!template?.published || Number(template?.currentVersion || template?.published?.version || 0) <= 0) return null;
  const published = template.published || {};
  const chapters = (Array.isArray(published.chapters) ? published.chapters : [])
    .map((chapter, index) => ({
      id:String(chapter?.id || "").trim(),
      title:String(chapter?.title || "").trim(),
      topics:Array.isArray(chapter?.topics) ? chapter.topics : [],
      order:index,
    }))
    .filter(chapter => chapter.title);
  if(!chapters.length) return null;
  return {
    templateId:String(template.id || published.templateId || "").trim(),
    version:Number(published.version || template.currentVersion || 0),
    subjectName:String(published.subjectName || template.subjectName || "").trim(),
    name:String(published.name || template.name || "").trim(),
    scope:normaliseSyllabusScope(published.scope, published.instituteName, published.sectionName),
    targets:Array.isArray(published.targets) ? published.targets : [],
    chapters,
  };
}
function publishedSyllabusMatchesClass(published, { teacherUid = "", classId = "", instituteName = "", sectionLabel = "", classSection = "", subject = "" } = {}){
  if(!published) return false;
  const cleanTeacherUid = String(teacherUid || "").trim();
  const cleanClassId = String(classId || "").trim();
  if(published.targets.some(target =>
    String(target?.teacherUid || "").trim() === cleanTeacherUid
    && String(target?.classId || "").trim() === cleanClassId
  )) return true;

  const classSubject = syllabusReportNameKey(subject);
  const syllabusSubject = syllabusReportNameKey(published.subjectName);
  if(!classSubject || !syllabusSubject || classSubject !== syllabusSubject) return false;

  const sectionKeys = new Set([
    syllabusReportNameKey(sectionLabel),
    syllabusReportNameKey(classSection),
  ].filter(Boolean));
  return syllabusScopePairs(published.scope).some(pair =>
    sameInstituteName(pair.instituteName, instituteName)
    && sectionKeys.has(syllabusReportNameKey(pair.sectionName))
  );
}
function collectSyllabusProgressForClass(classNotes = {}, templateId = "", endKey = ""){
  const cleanTemplateId = String(templateId || "").trim();
  let latestSnapshot = null;
  const unitIds = new Set();
  const chapterIds = new Set();
  const chapterTitles = new Set();

  Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
    if(!Array.isArray(entries)) return;
    if(endKey && dateKey > endKey) return;
    entries.forEach(entry => {
      if(!isSyllabusProgressEntry(entry)) return;
      const entryTemplateId = String(entry?.syllabusTemplateId || entry?.syllabusId || "").trim();
      if(cleanTemplateId && entryTemplateId && entryTemplateId !== cleanTemplateId) return;

      const ids = syllabusReportArray(entry?.completedSyllabusTopicIds);
      const directChapterIds = [
        ...syllabusReportArray(entry?.completedSyllabusChapterIds),
        ...syllabusReportArray(entry?.coveredSyllabusChapterIds),
      ];
      const title = getSyllabusProgressChapterTitle(entry);
      const created = Number(entry?.created || entry?.createdAt || 0) || 0;
      const snapshotTimeKey = `${dateKey || ""}:${String(created).padStart(16, "0")}`;
      const isSnapshot = String(entry?.tag || "").trim() === "syllabus"
        || /syllabus progress update/i.test(String(entry?.title || ""));

      if(isSnapshot && (ids.length || directChapterIds.length)){
        if(!latestSnapshot || snapshotTimeKey >= latestSnapshot.sortKey){
          latestSnapshot = {
            sortKey:snapshotTimeKey,
            ids:[
              ...ids,
              ...directChapterIds.map(syllabusReportChapterMarker).filter(Boolean),
            ],
          };
        }
        return;
      }

      ids.forEach(id => unitIds.add(id));
      directChapterIds.forEach(id => {
        const marker = syllabusReportChapterMarker(id);
        if(marker) unitIds.add(marker);
        chapterIds.add(id);
      });
      if(entry?.syllabusChapterCompleted === true){
        const marker = syllabusReportChapterMarker(entry?.syllabusChapterId);
        if(marker) unitIds.add(marker);
      }
      if(entry?.syllabusChapterId) chapterIds.add(String(entry.syllabusChapterId).trim());
      if(title && !/syllabus progress update/i.test(title)) chapterTitles.add(syllabusReportNameKey(title));
    });
  });

  if(latestSnapshot){
    return {
      unitIds:new Set(latestSnapshot.ids),
      chapterIds:new Set(),
      chapterTitles:new Set(),
    };
  }
  return { unitIds, chapterIds, chapterTitles };
}
function buildSyllabusReportRowsForClass({ publishedSyllabi = [], teacherUid = "", cls = {}, classNotes = {}, instituteName = "", sectionLabel = "", periodEndKey = "" } = {}){
  return publishedSyllabi
    .filter(published => publishedSyllabusMatchesClass(published, {
      teacherUid,
      classId:cls?.id,
      instituteName,
      sectionLabel,
      classSection:cls?.section,
      subject:cls?.subject,
    }))
    .map(published => {
      const progress = collectSyllabusProgressForClass(classNotes, published.templateId, periodEndKey);
      const completed = published.chapters.filter(chapter => {
        const marker = syllabusReportChapterMarker(chapter.id);
        if(marker && progress.unitIds.has(marker)) return true;
        if(chapter.id && progress.chapterIds.has(chapter.id)) return true;
        if(progress.chapterTitles.has(syllabusReportNameKey(chapter.title))) return true;
        const topicIds = (chapter.topics || []).map(topic => String(topic?.id || "").trim()).filter(Boolean);
        return topicIds.length > 0 && topicIds.every(id => progress.unitIds.has(id));
      });
      const chapterTitles = published.chapters
        .map(chapter => String(chapter?.title || "").trim())
        .filter(Boolean);
      const coveredChapterTitles = completed
        .map(chapter => String(chapter?.title || "").trim())
        .filter(Boolean);
      const coveredKeys = new Set(coveredChapterTitles.map(syllabusReportNameKey));
      const pendingChapterTitles = chapterTitles.filter(title => !coveredKeys.has(syllabusReportNameKey(title)));
      const totalCount = published.chapters.length;
      const coveredCount = completed.length;
      const status = coveredCount <= 0 ? "Not started" : coveredCount >= totalCount ? "Complete" : "In progress";
      return {
        key:`${published.templateId || published.name}::${sectionLabel}::${published.subjectName}`,
        section:sectionLabel,
        subject:published.subjectName || cls?.subject || "",
        syllabusName:published.name || `${published.subjectName || cls?.subject || "Subject"} syllabus`,
        coveredCount,
        totalCount,
        status,
        chapterTitles,
        coveredChapterTitles,
        pendingChapterTitles,
      };
    });
}
function countTeachingEntriesForMonth(classNotes = {}, monthKey = currentMonthKey()){
  return Object.entries(classNotes || {}).reduce((sum, [dk, entries]) => {
    if(!dk.startsWith(monthKey) || !Array.isArray(entries)) return sum;
    return sum + entries.filter(entry => !isSyllabusProgressEntry(entry)).length;
  }, 0);
}
function firstClassCreatedTs(classes = []){
  return (classes || []).reduce((earliest, cls) => {
    const created = Number(cls?.created || 0) || 0;
    if(!created) return earliest;
    if(!earliest) return created;
    return Math.min(earliest, created);
  }, 0) || null;
}
function instituteGlanceLastActivityLabel(teacherRow){
  if(teacherRow?.lastEntryTs){
    return longDateLabel(teacherRow.lastEntryTs);
  }
  if(teacherRow?.joinedAtTs){
    return `Signed up ${longDateLabel(teacherRow.joinedAtTs)}`;
  }
  return "No logs yet";
}
function instituteGlanceTodayStatusLabel(teacherRow){
  return teacherRow?.updatedToday ? "Filled today" : "Pending today";
}
function instituteGlanceTeacherHoursLabel(teacherRow){
  return teacherRow?.totalMinutes > 0
    ? formatDurationShort(teacherRow.totalMinutes)
    : teacherRow?.untimedEntries > 0
      ? "Untimed"
      : "0m";
}
function instituteGlanceTeacherSectionCaption(teacherRow){
  return teacherRow?.sectionNames?.length
    ? teacherRow.sectionNames.join(", ")
    : teacherRow?.updatedToday
      ? "Uploaded without a section name"
      : "No section was taught today";
}
function lastEntryCaption(ts){
  if(!ts) return "Last entry: no logs yet";
  const relative = daysAgo(ts);
  return `Last entry: ${relative || shortDateLabel(ts)}`;
}
function buildTeacherEntryStatusItem(teacher, data, instituteName, fallbackLastEntryTs = null){
  const teacherName = data?.profile?.name || teacher?.name || "Teacher";
  if(!data){
    return {
      uid:teacher?.uid || teacherName,
      name:teacherName,
      loaded:false,
      classCount:null,
      todayEntries:0,
      weekEntries:0,
      monthEntries:0,
      todayUpdated:false,
      lastEntryTs:fallbackLastEntryTs || null,
    };
  }
  const classes = (data.classes||[]).filter(c=>sameInstituteName(c.institute, instituteName));
  const stats = classes.reduce((acc,c)=>{
    const classNotes = (data.notes||{})[c.id]||{};
    acc.todayEntries += getEntriesInRange(classNotes, 1).length;
    acc.weekEntries += getEntriesInRange(classNotes, 7).length;
    acc.monthEntries += getEntriesInRange(classNotes, 30).length;
    acc.lastEntryTs = Math.max(acc.lastEntryTs, lastEntryTs(classNotes) || 0);
    return acc;
  },{todayEntries:0,weekEntries:0,monthEntries:0,lastEntryTs:fallbackLastEntryTs || 0});
  return {
    uid:teacher?.uid || teacherName,
    name:teacherName,
    loaded:true,
    classCount:classes.length,
    todayEntries:stats.todayEntries,
    weekEntries:stats.weekEntries,
    monthEntries:stats.monthEntries,
    todayUpdated:stats.todayEntries>0,
    lastEntryTs:stats.lastEntryTs || fallbackLastEntryTs || null,
  };
}
function sortTeacherStatusForShare(items=[]){
  return [...items].sort((a,b)=>{
    if(!!a.todayUpdated !== !!b.todayUpdated) return a.todayUpdated ? 1 : -1;
    if(!a.todayUpdated && !b.todayUpdated){
      if((a.lastEntryTs||0) !== (b.lastEntryTs||0)) return (a.lastEntryTs||0) - (b.lastEntryTs||0);
    } else {
      if((b.todayEntries||0) !== (a.todayEntries||0)) return (b.todayEntries||0) - (a.todayEntries||0);
      if((b.lastEntryTs||0) !== (a.lastEntryTs||0)) return (b.lastEntryTs||0) - (a.lastEntryTs||0);
    }
    if((b.weekEntries||0) !== (a.weekEntries||0)) return (b.weekEntries||0) - (a.weekEntries||0);
    if((b.monthEntries||0) !== (a.monthEntries||0)) return (b.monthEntries||0) - (a.monthEntries||0);
    return exportTextSorter.compare(a.name || "", b.name || "");
  });
}
function slugifyDownloadPart(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "report";
}
async function waitForCanvasFonts(){
  try {
    if(document?.fonts?.ready) await document.fonts.ready;
  } catch {}
}
function drawRoundedRect(ctx, x, y, width, height, radius){
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
function fitCanvasText(ctx, value, maxWidth){
  const text = String(value || "");
  if(!text) return "";
  if(ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  let best = ellipsis;
  while(low <= high){
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`;
    if(ctx.measureText(candidate).width <= maxWidth){
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}
function wrapCanvasText(ctx, value, maxWidth){
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if(!words.length) return [];
  const lines = [];
  let current = "";
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if(ctx.measureText(next).width <= maxWidth){
      current = next;
      return;
    }
    if(current){
      lines.push(current);
      current = word;
      return;
    }
    lines.push(fitCanvasText(ctx, word, maxWidth));
    current = "";
  });
  if(current) lines.push(current);
  return lines;
}
function drawCanvasPill(ctx, { x, y, label, bg, border, color, font = "700 20px 'Inter',sans-serif", padX = 16, height = 46 }){
  ctx.save();
  ctx.font = font;
  const textWidth = ctx.measureText(label).width;
  const width = Math.ceil(textWidth + padX * 2);
  drawRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX, y + height / 2 + 1);
  ctx.restore();
  return width;
}
function triggerBlobDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href:url, download:filename });
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(()=>{
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}
function getTeacherInstituteListFromMap(teacher, fullDataMap){
  const list = [];
  const add = (value) => {
    const next = String(value || "").trim();
    if(!next) return;
    if(list.some(existing => sameInstituteName(existing, next))) return;
    list.push(next);
  };
  (teacher?.institutes || []).forEach(add);
  const data = fullDataMap?.[teacher?.uid];
  (data?.profile?.institutes || []).forEach(add);
  (data?.classes || []).forEach(cls => add(cls?.institute));
  return list;
}
function teacherBelongsToInstituteFromMap(teacher, instituteName, fullDataMap){
  if(!teacher || !instituteName) return false;
  return getTeacherInstituteListFromMap(teacher, fullDataMap).some(inst => sameInstituteName(inst, instituteName));
}
function getTeacherDisplayNameFromMap(teacher, fullDataMap){
  return fullDataMap?.[teacher?.uid]?.profile?.name || teacher?.name || "Teacher";
}
const EMPTY_INSTITUTE_GLANCE_SUMMARY = {
  totalInstitutes:0,
  totalTeachers:0,
  filledToday:0,
  missingToday:0,
  loadedTeachers:0,
  sectionsTaught:0,
  totalStudyMinutes:0,
  totalTodayEntries:0,
};
function getInstituteGlancePeriodMeta(period = "daily", rangeStartKey = "", rangeEndKey = ""){
  const today = todayKey();
  const rangeStart = String(rangeStartKey || today).trim();
  const rangeEnd = String(rangeEndKey || rangeStart || today).trim();
  const safeRangeStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const safeRangeEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  if(period === "range"){
    return {
      key:"range",
      days:null,
      startKey:safeRangeStart,
      endKey:safeRangeEnd,
      filePart:`range_${safeRangeStart}_to_${safeRangeEnd}`,
      label:"Range",
      periodValue:`${safeRangeStart} to ${safeRangeEnd}`,
      updatedLabel:"Updated in range",
      pendingLabel:"Pending in range",
      activeLabel:"Teachers active in range",
      submissionLabel:"Submission rate in range",
      sectionsSubLabel:"in range",
      hoursSubLabel:"logged in range",
      title:"Ledgr Report",
    };
  }
  if(period === "monthly"){
    const monthBounds = monthBoundsFromKey(String(rangeStartKey || "").slice(0, 7) || currentMonthKey());
    return {
      key:"monthly",
      days:null,
      startKey:monthBounds.startKey,
      endKey:monthBounds.endKey,
      filePart:monthBounds.monthKey,
      label:"Monthly",
      periodValue:new Date(`${monthBounds.startKey}T00:00:00`).toLocaleDateString("en-IN", { month:"long", year:"numeric" }),
      updatedLabel:"Updated this month",
      pendingLabel:"Pending this month",
      activeLabel:"Teachers active this month",
      submissionLabel:"Submission rate this month",
      sectionsSubLabel:"this month",
      hoursSubLabel:"logged this month",
      title:"Ledgr Report",
    };
  }
  if(period === "weekly"){
    return {
      key:"weekly",
      days:7,
      startKey:addDaysToDateKey(today, -6),
      endKey:today,
      filePart:"weekly",
      label:"Weekly",
      periodValue:"Last 7 days",
      updatedLabel:"Updated this week",
      pendingLabel:"Pending this week",
      activeLabel:"Teachers active this week",
      submissionLabel:"Submission rate this week",
      sectionsSubLabel:"this week",
      hoursSubLabel:"logged this week",
      title:"Ledgr Report",
    };
  }
  if(period === "yesterday"){
    const yesterday = addDaysToDateKey(today, -1);
    return {
      key:"yesterday",
      days:null,
      startKey:yesterday,
      endKey:yesterday,
      filePart:"yesterday",
      label:"Yesterday",
      periodValue:"Yesterday",
      updatedLabel:"Updated yesterday",
      pendingLabel:"Pending yesterday",
      activeLabel:"Teachers active yesterday",
      submissionLabel:"Submission rate yesterday",
      sectionsSubLabel:"yesterday",
      hoursSubLabel:"logged yesterday",
      title:"Ledgr Report",
    };
  }
  return {
    key:"daily",
    days:1,
    startKey:today,
    endKey:today,
    filePart:"daily",
    label:"Daily",
    periodValue:"Today",
    updatedLabel:"Updated today",
    pendingLabel:"Pending today",
    activeLabel:"Teachers active today",
    submissionLabel:"Submission rate today",
    sectionsSubLabel:"today",
    hoursSubLabel:"logged today",
    title:"Ledgr Report",
  };
}
function buildInstituteGlanceTeacherActivity({ teacher, instituteName, fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const data = fullDataMap?.[teacher?.uid];
  const classesHere = data
    ? (data.classes || []).filter(cls => sameInstituteName(cls?.institute, instituteName))
    : [];
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const monthKey = currentMonthKey();
  const sectionMap = new Map();
  const syllabusCoverageMap = new Map();
  const syllabusDeclaredMap = new Map();
  const publishedSyllabi = (Array.isArray(syllabusTemplates) ? syllabusTemplates : [])
    .map(getPublishedSyllabusPayload)
    .filter(Boolean);
  const todayDetails = [];
  let todayEntries = 0;
  let monthEntries = 0;
  let totalMinutes = 0;
  let untimedEntries = 0;

  classesHere.forEach(cls => {
    const classNotes = (data.notes || {})[cls.id] || {};
    const notesToday = getEntriesInRange(classNotes, periodMeta.days, periodMeta.startKey, periodMeta.endKey);
    monthEntries += countTeachingEntriesForMonth(classNotes, monthKey);

    const resolvedSection = typeof resolveSectionName === "function"
      ? resolveSectionName(cls?.section, cls?.institute || instituteName)
      : cls?.section;
    const sectionLabel = normaliseName(String(resolvedSection || cls?.section || "Untitled section").trim() || "Untitled section");
    const currentSection = sectionMap.get(sectionLabel) || {
      name: sectionLabel,
      entryCount:0,
      totalMinutes:0,
    };

    buildSyllabusReportRowsForClass({
      publishedSyllabi,
      teacherUid:teacher?.uid,
      cls,
      classNotes,
      instituteName,
      sectionLabel,
      periodEndKey:periodMeta.endKey,
    }).forEach(item => {
      const key = item.key || `${item.section}::${item.subject}::${item.syllabusName}`;
      syllabusDeclaredMap.set(key, item);
    });

    Object.entries(classNotes || {}).forEach(([dateKey, entries]) => {
      if(!Array.isArray(entries)) return;
      if(periodMeta.endKey && dateKey > periodMeta.endKey) return;
      entries.forEach(entry => {
        if(!isSyllabusProgressEntry(entry)) return;
        const title = getSyllabusProgressChapterTitle(entry);
        if(!title || /syllabus progress update/i.test(title)) return;
        const key = `${sectionLabel}::${cls?.subject || ""}::${entry?.syllabusChapterId || title}`;
        const current = syllabusCoverageMap.get(key);
        if(current && String(current.dateKey || "") >= String(dateKey || "")) return;
        syllabusCoverageMap.set(key, {
          dateKey,
          section:sectionLabel,
          subject:cls?.subject || "",
          chapterTitle:title,
          status:"Covered",
        });
      });
    });

    if(!notesToday.length) {
      if(currentSection.entryCount > 0) sectionMap.set(sectionLabel, currentSection);
      return;
    }

    notesToday.forEach(({ dateKey, entry }) => {
      if(isSyllabusProgressEntry(entry)) return;
      const mins = entryDurationMinutes(entry);
      todayEntries += 1;
      totalMinutes += mins;
      currentSection.entryCount += 1;
      currentSection.totalMinutes += mins;
      if(mins <= 0) untimedEntries += 1;
      todayDetails.push({
        teacherName:getTeacherDisplayNameFromMap(teacher, fullDataMap),
        dateKey,
        section:sectionLabel,
        subject:cls?.subject || "",
        timeStart:entry?.timeStart || "",
        timeEnd:entry?.timeEnd || "",
        type:entry?.tag || "note",
        typeLabel:TAG_STYLES[entry?.tag]?.label || entry?.tag || "note",
        status:entry?.status || "",
        statusLabel:STATUS_STYLES[entry?.status]?.label || entry?.status || "",
        title:entry?.title || "",
        notes:entry?.body || "",
        minutes:mins,
      });
    });

    sectionMap.set(sectionLabel, currentSection);
  });

  const lastEntry = data
    ? classesHere.reduce((latest, cls) => Math.max(latest, lastEntryTs((data.notes || {})[cls.id] || {}) || 0), 0)
    : Number(teacher?.lastActive || 0) || 0;
  const joinedAtTs = classesHere.length
    ? firstClassCreatedTs(classesHere)
    : firstClassCreatedTs(data?.classes || []);
  const sections = Array.from(sectionMap.values()).sort((a, b) => {
    if((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
    if((b.entryCount || 0) !== (a.entryCount || 0)) return (b.entryCount || 0) - (a.entryCount || 0);
    return exportTextSorter.compare(a.name || "", b.name || "");
  });

  return {
    uid: teacher?.uid,
    name: getTeacherDisplayNameFromMap(teacher, fullDataMap),
    loaded: !!data,
    todayEntries,
    monthEntries,
    updatedToday: todayEntries > 0,
    lastEntryTs: lastEntry || null,
    joinedAtTs: joinedAtTs || null,
    lastActivityLabel: instituteGlanceLastActivityLabel({
      lastEntryTs:lastEntry || null,
      joinedAtTs:joinedAtTs || null,
    }),
    todayStatusLabel: periodMeta.key !== "daily"
      ? (todayEntries > 0 ? periodMeta.updatedLabel : periodMeta.pendingLabel)
      : instituteGlanceTodayStatusLabel({ updatedToday:todayEntries > 0 }),
    sectionCount: sections.length,
    sectionNames: sections.map(section => section.name),
    sections,
    todayDetails: todayDetails.sort((a, b) => {
      if((a.dateKey || "") !== (b.dateKey || "")) return (a.dateKey || "").localeCompare(b.dateKey || "");
      if((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if(sectionCmp !== 0) return sectionCmp;
      return exportTextSorter.compare(a.title || "", b.title || "");
    }),
    syllabusCoveredRows: Array.from(syllabusCoverageMap.values()).sort((a, b) => {
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if(sectionCmp !== 0) return sectionCmp;
      const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
      if(subjectCmp !== 0) return subjectCmp;
      return exportTextSorter.compare(a.chapterTitle || "", b.chapterTitle || "");
    }),
    syllabusDeclaredRows: Array.from(syllabusDeclaredMap.values()).sort((a, b) => {
      const sectionCmp = exportTextSorter.compare(a.section || "", b.section || "");
      if(sectionCmp !== 0) return sectionCmp;
      const subjectCmp = exportTextSorter.compare(a.subject || "", b.subject || "");
      if(subjectCmp !== 0) return subjectCmp;
      return exportTextSorter.compare(a.syllabusName || "", b.syllabusName || "");
    }),
    totalMinutes,
    untimedEntries,
  };
}
function buildInstituteGlanceRows({ institutes = [], teachers = [], fullDataMap = {}, resolveSectionName = null, syllabusTemplates = [], roles = {}, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  return institutes.map(inst => {
    const teacherRows = teachers
      .filter(teacher => teacherBelongsToInstituteFromMap(teacher, inst, fullDataMap))
      .map(teacher => buildInstituteGlanceTeacherActivity({
        teacher,
        instituteName: inst,
        fullDataMap,
        resolveSectionName,
        syllabusTemplates,
        period,
        rangeStartKey,
        rangeEndKey,
      }))
      .filter(item => roles[item.uid] !== "admin" || item.todayEntries > 0);
    const filledTeachers = teacherRows
      .filter(item => item.updatedToday)
      .sort((a, b) => {
        if((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
        if((b.todayEntries || 0) !== (a.todayEntries || 0)) return (b.todayEntries || 0) - (a.todayEntries || 0);
        if((b.sectionCount || 0) !== (a.sectionCount || 0)) return (b.sectionCount || 0) - (a.sectionCount || 0);
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const missingTeachers = teacherRows
      .filter(item => !item.updatedToday)
      .sort((a, b) => {
        const aSortTs = a.lastEntryTs || a.joinedAtTs || 0;
        const bSortTs = b.lastEntryTs || b.joinedAtTs || 0;
        if(aSortTs !== bSortTs) return aSortTs - bSortTs;
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const orderedTeachers = [...filledTeachers, ...missingTeachers];
    const loadedTeachers = orderedTeachers.filter(item => item.loaded).length;
    const totalTeachers = orderedTeachers.length;
    const taughtSectionMap = new Map();

    filledTeachers.forEach(teacher => {
      (teacher.sections || []).forEach(section => {
        const current = taughtSectionMap.get(section.name) || {
          name: section.name,
          entryCount:0,
          totalMinutes:0,
          teachers:new Set(),
        };
        current.entryCount += section.entryCount || 0;
        current.totalMinutes += section.totalMinutes || 0;
        current.teachers.add(teacher.name);
        taughtSectionMap.set(section.name, current);
      });
    });

    const sectionRows = Array.from(taughtSectionMap.values())
      .map(section => ({
        ...section,
        teacherNames:Array.from(section.teachers).sort((a, b) => exportTextSorter.compare(a || "", b || "")),
      }))
      .sort((a, b) => {
        if((b.totalMinutes || 0) !== (a.totalMinutes || 0)) return (b.totalMinutes || 0) - (a.totalMinutes || 0);
        if((b.entryCount || 0) !== (a.entryCount || 0)) return (b.entryCount || 0) - (a.entryCount || 0);
        return exportTextSorter.compare(a.name || "", b.name || "");
      });
    const totalStudyMinutes = filledTeachers.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
    const totalTodayEntries = filledTeachers.reduce((sum, item) => sum + (item.todayEntries || 0), 0);

    return {
      institute: inst,
      teacherUids: orderedTeachers.map(item => item.uid),
      teacherRows: orderedTeachers,
      filledTeacherRows: filledTeachers,
      pendingTeacherRows: missingTeachers,
      totalTeachers,
      filledToday: filledTeachers.length,
      missingToday: missingTeachers.length,
      missingNames: missingTeachers.map(item => item.name),
      filledNames: filledTeachers.map(item => item.name),
      loadedTeachers,
      period: periodMeta.key,
      periodLabel: periodMeta.label,
      sectionsTaught: sectionRows.length,
      sectionRows,
      totalStudyMinutes,
      totalTodayEntries,
      untimedEntries: filledTeachers.reduce((sum, item) => sum + (item.untimedEntries || 0), 0),
      noTeachersSignedUp: totalTeachers === 0,
      ready: loadedTeachers >= totalTeachers,
      loadedPct: totalTeachers ? Math.round((loadedTeachers / totalTeachers) * 100) : 100,
      completionPct: totalTeachers ? Math.round((filledTeachers.length / totalTeachers) * 100) : 0,
    };
  });
}
function summariseInstituteGlanceRows(rows = []){
  return rows.reduce((acc, row) => {
    acc.totalInstitutes += 1;
    acc.totalTeachers += row.totalTeachers || 0;
    acc.filledToday += row.filledToday || 0;
    acc.missingToday += row.missingToday || 0;
    acc.loadedTeachers += row.loadedTeachers || 0;
    acc.sectionsTaught += row.sectionsTaught || 0;
    acc.totalStudyMinutes += row.totalStudyMinutes || 0;
    acc.totalTodayEntries += row.totalTodayEntries || 0;
    return acc;
  }, {
    totalInstitutes:0,
    totalTeachers:0,
    filledToday:0,
    missingToday:0,
    loadedTeachers:0,
    sectionsTaught:0,
    totalStudyMinutes:0,
    totalTodayEntries:0,
  });
}
async function downloadTeacherStatusShareImage({ instituteName, rows, summary, generatedOnLabel }){
  await waitForCanvasFonts();
  const width = 1080;
  const cardX = 36;
  const cardY = 36;
  const cardWidth = width - cardX * 2;
  const headerHeight = 290;
  const rowHeight = 118;
  const cardHeight = headerHeight + Math.max(1, rows.length) * rowHeight + 28;
  const height = cardY * 2 + cardHeight;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#F4F7FB";
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#DDE3ED";
  ctx.lineWidth = 2;
  ctx.stroke();

  const contentX = cardX + 28;
  const contentWidth = cardWidth - 56;
  let cursorY = cardY + 30;

  ctx.fillStyle = "#111827";
  ctx.font = "800 34px 'Poppins',sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Teacher entry status", contentX, cursorY);

  cursorY += 50;
  ctx.fillStyle = "#1A2F5A";
  ctx.font = "800 30px 'Poppins',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, instituteName, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 40;
  ctx.fillStyle = "#4B5563";
  ctx.font = "600 18px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, `Generated ${generatedOnLabel}`, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 32;
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 20px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, "Who has updated class logs today, plus week and month entry counts.", contentWidth),
    contentX,
    cursorY
  );

  cursorY += 44;
  let chipX = contentX;
  chipX += drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.updatedToday}/${summary.totalTeachers} updated today`,
    bg: "#DCFCE7",
    border: "#BBF7D0",
    color: "#166534",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  }) + 12;
  chipX += drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.weekEntries} this week`,
    bg: "#F8FAFC",
    border: "#DDE3ED",
    color: "#1F2937",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  }) + 12;
  drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.monthEntries} this month`,
    bg: "#F8FAFC",
    border: "#DDE3ED",
    color: "#1F2937",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  });

  cursorY += 74;
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, cursorY);
  ctx.lineTo(contentX + contentWidth, cursorY);
  ctx.stroke();
  cursorY += 16;

  const rowsToDraw = rows.length ? rows : [{
    uid:"empty",
    name:"No teacher activity yet",
    classCount:0,
    todayEntries:0,
    weekEntries:0,
    monthEntries:0,
    todayUpdated:false,
  }];

  rowsToDraw.forEach((item, index)=>{
    const rowTop = cursorY + index * rowHeight;
    const rowBottom = rowTop + rowHeight - 12;
    const leftWidth = contentWidth - 240;
    const pillLabel = item.todayUpdated ? "Updated today" : "No update today";
    const safeClassCount = Number.isFinite(item.classCount) ? item.classCount : 0;

    ctx.fillStyle = "#111827";
    ctx.font = "800 30px 'Poppins',sans-serif";
    ctx.fillText(fitCanvasText(ctx, item.name, leftWidth), contentX, rowTop);

    ctx.fillStyle = "#6B7280";
    ctx.font = "600 18px 'Inter',sans-serif";
    const classCountLabel = safeClassCount === 1 ? "1 class in this institute" : `${safeClassCount} classes in this institute`;
    ctx.fillText(fitCanvasText(ctx, classCountLabel, leftWidth), contentX, rowTop + 38);

    ctx.fillStyle = "#6B7280";
    ctx.font = "700 19px 'Inter',sans-serif";
    ctx.fillText(`Today ${item.todayEntries} • Week ${item.weekEntries} • Month ${item.monthEntries}`, contentX, rowTop + 74);

    ctx.font = "700 20px 'Inter',sans-serif";
    const pillWidth = ctx.measureText(pillLabel).width + 36;
    drawCanvasPill(ctx, {
      x: contentX + contentWidth - pillWidth,
      y: rowTop + 4,
      label:pillLabel,
      bg:item.todayUpdated ? "#DCFCE7" : "#F8FAFC",
      border:item.todayUpdated ? "#BBF7D0" : "#DDE3ED",
      color:item.todayUpdated ? "#166534" : "#1F2937",
      font:"700 20px 'Inter',sans-serif",
      padX:18,
      height:46,
    });

    if(index < rowsToDraw.length - 1){
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentX, rowBottom);
      ctx.lineTo(contentX + contentWidth, rowBottom);
      ctx.stroke();
    }
  });

  const blob = await new Promise(resolve=>canvas.toBlob(resolve, "image/png"));
  if(blob){
    triggerBlobDownload(blob, `${slugifyDownloadPart(instituteName)}_teacher_entry_status_${todayKey()}.png`);
    return;
  }
  const fallbackUrl = canvas.toDataURL("image/png");
  const anchor = Object.assign(document.createElement("a"), {
    href:fallbackUrl,
    download:`${slugifyDownloadPart(instituteName)}_teacher_entry_status_${todayKey()}.png`,
  });
  anchor.click();
}
async function renderInstituteGlanceCanvas({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes" }){
  await waitForCanvasFonts();
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const width = 1280;
  const cardX = 28;
  const cardY = 28;
  const cardWidth = width - cardX * 2;
  const contentX = cardX + 28;
  const contentWidth = cardWidth - 56;
  const innerWidth = contentWidth - 40;
  const statsGap = 10;
  const statWidth = (innerWidth - statsGap * 3) / 4;
  const teacherColWidth = 210;
  const logColWidth = 82;
  const hoursColWidth = 108;
  const sectionsColWidth = innerWidth - teacherColWidth - logColWidth - hoursColWidth - 36;
  const rowsToRender = rows.length ? rows : [{
    institute:"No institutes available",
    totalTeachers:0,
    filledToday:0,
    missingToday:0,
    missingNames:[],
    filledTeacherRows:[],
    noTeachersSignedUp:true,
    sectionsTaught:0,
    totalStudyMinutes:0,
  }];

  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = width;
  measureCanvas.height = 400;
  const measureCtx = measureCanvas.getContext("2d");
  if(!measureCtx) throw new Error("Canvas is not available.");

  const rowMeta = rowsToRender.map(row => {
    const teacherRows = (row.filledTeacherRows || []).map(teacher => {
      measureCtx.font = "600 15px 'Inter',sans-serif";
      const sectionText = teacher.sectionNames?.length
        ? teacher.sectionNames.join(", ")
        : "Uploaded without a section name";
      const sectionLines = wrapCanvasText(measureCtx, sectionText, sectionsColWidth - 8);
      return {
        teacher,
        sectionLines,
        height: Math.max(46, 18 + sectionLines.length * 18 + 12),
      };
    });

    measureCtx.font = "600 17px 'Inter',sans-serif";
    const summaryText = row.noTeachersSignedUp
      ? "0 teachers linked. No one has signed up in this centre yet."
      : `${row.totalTeachers} teacher${row.totalTeachers===1?"":"s"} · ${row.filledToday} updated · ${row.missingToday} pending · ${row.sectionsTaught} sections taught · ${formatDurationShort(row.totalStudyMinutes || 0)} study hours`;
    const summaryLines = wrapCanvasText(measureCtx, summaryText, contentWidth - 240);

    const pendingText = row.noTeachersSignedUp
      ? "No sign-ups yet. Add teachers to this centre and their daily status will appear here."
      : row.missingNames.length
        ? `Pending: ${row.missingNames.join(", ")}`
        : "Everyone linked to this centre is updated.";
    const pendingLines = wrapCanvasText(measureCtx, pendingText, innerWidth);

    const signupNoteLines = row.noTeachersSignedUp
      ? wrapCanvasText(measureCtx, "No one has signed up in this centre yet, so this is not an \"everyone filled\" case.", innerWidth)
      : [];

    const statsHeight = 78;
    const tableHeight = teacherRows.length
      ? 42 + teacherRows.reduce((sum, item) => sum + item.height, 0) + 12
      : 58;
    const bodyHeight = row.noTeachersSignedUp
      ? 24 + signupNoteLines.length * 20 + 18
      : 32 + tableHeight + 28 + pendingLines.length * 20 + 18;
    return {
      teacherRows,
      summaryLines,
      pendingLines,
      signupNoteLines,
      height: 90 + summaryLines.length * 20 + statsHeight + bodyHeight,
    };
  });

  const headerHeight = 300;
  const rowsHeight = rowMeta.reduce((sum, item) => sum + item.height + 16, 0);
  const cardHeight = headerHeight + rowsHeight + 18;
  const height = cardY * 2 + cardHeight;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#F4F7FB";
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#DDE3ED";
  ctx.lineWidth = 2;
  ctx.stroke();

  let cursorY = cardY + 28;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111827";
  ctx.font = "800 36px 'Poppins',sans-serif";
  ctx.fillText("Ledgr Report", contentX, cursorY);

  cursorY += 50;
  ctx.fillStyle = "#4B5563";
  ctx.font = "600 18px 'Inter',sans-serif";
  ctx.fillText(fitCanvasText(ctx, generatedOnLabel, contentWidth), contentX, cursorY);

  cursorY += 34;
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 20px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, `${scopeLabel} · ${periodMeta.label} summary: submissions, pending follow-up, sections, and hours.`, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 46;
  const summaryChips = [
    { label:`${summary.filledToday}/${summary.totalTeachers} teachers updated`, bg:"#DCFCE7", border:"#BBF7D0", color:"#166534" },
    { label:`${summary.missingToday} pending`, bg:"#FEF3C7", border:"#FCD34D", color:"#B45309" },
    { label:`${summary.totalInstitutes} institutes`, bg:"#EEF4FF", border:"#C7D7F5", color:"#1D4ED8" },
    { label:`${summary.sectionsTaught || 0} sections taught`, bg:"#FFF7ED", border:"#FED7AA", color:"#B45309" },
    { label:`${formatDurationShort(summary.totalStudyMinutes || 0)} study hours`, bg:"#F3E8FF", border:"#D8B4FE", color:"#7C3AED" },
  ];
  let chipX = contentX;
  let chipY = cursorY;
  ctx.font = "700 19px 'Inter',sans-serif";
  summaryChips.forEach(chip => {
    const chipWidth = ctx.measureText(chip.label).width + 36;
    if(chipX !== contentX && chipX + chipWidth > contentX + contentWidth){
      chipX = contentX;
      chipY += 58;
    }
    chipX += drawCanvasPill(ctx, {
      x: chipX,
      y: chipY,
      label:chip.label,
      bg:chip.bg,
      border:chip.border,
      color:chip.color,
      font:"700 19px 'Inter',sans-serif",
      padX:18,
      height:46,
    }) + 12;
  });

  cursorY = chipY + 68;

  rowsToRender.forEach((row, index) => {
    const meta = rowMeta[index];
    const rowTop = cursorY;
    const tone = row.noTeachersSignedUp
      ? { bg:"#F8FAFC", border:"#DDE3ED", badgeBg:"#EEF2F7", badgeBorder:"#DDE3ED", badgeColor:"#475569", accent:"#475569" }
      : row.missingToday === 0
        ? { bg:"#ECFDF3", border:"#BBF7D0", badgeBg:"#DCFCE7", badgeBorder:"#BBF7D0", badgeColor:"#166534", accent:"#166534" }
        : { bg:"#EEF4FF", border:"#C7D7F5", badgeBg:"#EEF4FF", badgeBorder:"#C7D7F5", badgeColor:"#1D4ED8", accent:"#1E3A8A" };

    drawRoundedRect(ctx, contentX, rowTop, contentWidth, meta.height, 24);
    ctx.fillStyle = tone.bg;
    ctx.fill();
    ctx.strokeStyle = tone.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const innerX = contentX + 20;
    ctx.fillStyle = "#111827";
    ctx.font = "800 28px 'Poppins',sans-serif";
    ctx.fillText(fitCanvasText(ctx, row.institute, contentWidth - 300), innerX, rowTop + 18);

    const badgeLabel = row.noTeachersSignedUp ? "No sign-ups" : `${row.filledToday}/${row.totalTeachers} updated`;
    ctx.font = "700 18px 'Inter',sans-serif";
    const badgeWidth = ctx.measureText(badgeLabel).width + 36;
    drawCanvasPill(ctx, {
      x: contentX + contentWidth - badgeWidth - 18,
      y: rowTop + 16,
      label:badgeLabel,
      bg:tone.badgeBg,
      border:tone.badgeBorder,
      color:tone.badgeColor,
      font:"700 18px 'Inter',sans-serif",
      padX:18,
      height:40,
    });

    ctx.fillStyle = "#4B5563";
    ctx.font = "600 17px 'Inter',sans-serif";
    meta.summaryLines.forEach((line, lineIndex) => {
      ctx.fillText(line, innerX, rowTop + 56 + lineIndex * 20);
    });

    const statTop = rowTop + 56 + meta.summaryLines.length * 20 + 18;
    [
      { label:"Updated", value:`${row.filledToday}/${row.totalTeachers}` },
      { label:"Pending", value:String(row.missingToday || 0) },
      { label:"Sections taught", value:String(row.sectionsTaught || 0) },
      { label:"Study hours", value:formatDurationShort(row.totalStudyMinutes || 0) },
    ].forEach((item, statIndex) => {
      const x = innerX + statIndex * (statWidth + statsGap);
      drawRoundedRect(ctx, x, statTop, statWidth, 72, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#DDE3ED";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#6B7280";
      ctx.font = "700 10px 'Inter',sans-serif";
      ctx.fillText(item.label.toUpperCase(), x + 12, statTop + 10);

      ctx.fillStyle = "#111827";
      ctx.font = "800 20px 'Poppins',sans-serif";
      ctx.fillText(fitCanvasText(ctx, item.value, statWidth - 24), x + 12, statTop + 30);
    });

    let bodyY = statTop + 92;
    if(row.noTeachersSignedUp){
      ctx.fillStyle = "#475569";
      ctx.font = "600 17px 'Inter',sans-serif";
      meta.signupNoteLines.forEach((line, lineIndex) => {
        ctx.fillText(line, innerX, bodyY + lineIndex * 20);
      });
    } else {
      ctx.fillStyle = "#475569";
      ctx.font = "700 11px 'Inter',sans-serif";
      ctx.fillText(periodMeta.activeLabel.toUpperCase(), innerX, bodyY);
      bodyY += 26;

      if(!meta.teacherRows.length){
        ctx.fillStyle = "#9A3412";
        ctx.font = "600 16px 'Inter',sans-serif";
        ctx.fillText(`No teacher uploaded during this ${periodMeta.label.toLowerCase()} period.`, innerX, bodyY);
        bodyY += 34;
      } else {
        const tableX = innerX;
        const tableWidth = innerWidth;
        const tableTop = bodyY;
        const tableHeight = 42 + meta.teacherRows.reduce((sum, item) => sum + item.height, 0) + 12;
        drawRoundedRect(ctx, tableX, tableTop, tableWidth, tableHeight, 16);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#DDE3ED";
        ctx.lineWidth = 1;
        ctx.stroke();

        drawRoundedRect(ctx, tableX, tableTop, tableWidth, 42, 16);
        ctx.fillStyle = "#F8FAFC";
        ctx.fill();

        const colTeacherX = tableX + 12;
        const colSectionsX = colTeacherX + teacherColWidth + 12;
        const colLogsX = colSectionsX + sectionsColWidth + 12;
        const colHoursX = colLogsX + logColWidth + 12;

        ctx.fillStyle = "#6B7280";
        ctx.font = "800 10px 'Inter',sans-serif";
        ctx.fillText("TEACHER", colTeacherX, tableTop + 12);
        ctx.fillText("SECTIONS", colSectionsX, tableTop + 12);
        ctx.fillText("LOGS", colLogsX, tableTop + 12);
        ctx.fillText("STUDY HOURS", colHoursX, tableTop + 12);

        let tableRowY = tableTop + 42;
        meta.teacherRows.forEach((item, rowIndex) => {
          if(rowIndex > 0){
            ctx.strokeStyle = "#E5E7EB";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tableX + 12, tableRowY);
            ctx.lineTo(tableX + tableWidth - 12, tableRowY);
            ctx.stroke();
          }

          ctx.fillStyle = "#111827";
          ctx.font = "800 15px 'Inter',sans-serif";
          ctx.fillText(fitCanvasText(ctx, item.teacher.name, teacherColWidth - 8), colTeacherX, tableRowY + 10);

          ctx.fillStyle = "#475569";
          ctx.font = "600 15px 'Inter',sans-serif";
          item.sectionLines.forEach((line, lineIndex) => {
            ctx.fillText(line, colSectionsX, tableRowY + 10 + lineIndex * 18);
          });

          ctx.textBaseline = "middle";
          ctx.fillStyle = "#111827";
          ctx.font = "700 15px 'Inter',sans-serif";
          ctx.fillText(String(item.teacher.todayEntries || 0), colLogsX, tableRowY + item.height / 2);

          ctx.fillStyle = item.teacher.totalMinutes > 0 ? "#166534" : "#475569";
          ctx.fillText(
            item.teacher.totalMinutes > 0
              ? formatDurationShort(item.teacher.totalMinutes)
              : item.teacher.untimedEntries > 0
                ? "Untimed"
                : "0m",
            colHoursX,
            tableRowY + item.height / 2
          );
          ctx.textBaseline = "top";
          tableRowY += item.height;
        });

        bodyY += tableHeight + 18;
      }

      ctx.fillStyle = "#475569";
      ctx.font = "700 11px 'Inter',sans-serif";
      ctx.fillText(periodMeta.pendingLabel.toUpperCase(), innerX, bodyY);
      bodyY += 26;

      ctx.fillStyle = row.missingNames.length ? "#334155" : "#166534";
      ctx.font = "600 17px 'Inter',sans-serif";
      meta.pendingLines.forEach((line, lineIndex) => {
        ctx.fillText(line, innerX, bodyY + lineIndex * 20);
      });
    }

    cursorY += meta.height + 16;
  });

  return canvas;
}
async function downloadInstituteGlanceSummaryPng({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes", scopeFilePart = "all_institutes" }){
  const canvas = await renderInstituteGlanceCanvas({ rows, summary, generatedOnLabel, period, rangeStartKey, rangeEndKey, scopeLabel });
  const filePart = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).filePart;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if(blob){
    triggerBlobDownload(blob, `${scopeFilePart}_${filePart}_ledgr_report_${todayKey()}.png`);
    return;
  }
  const anchor = Object.assign(document.createElement("a"), {
    href:canvas.toDataURL("image/png"),
    download:`${scopeFilePart}_${filePart}_ledgr_report_${todayKey()}.png`,
  });
  anchor.click();
}
function instituteGlancePdfFilename(instituteName, period = "daily", rangeStartKey = "", rangeEndKey = ""){
  return `${slugifyDownloadPart(instituteName)}_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).filePart}_ledgr_report_${todayKey()}.pdf`;
}

function allInstitutesGlancePdfFilename(period = "daily", rangeStartKey = "", rangeEndKey = ""){
  return `all_institutes_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).filePart}_ledgr_report_${todayKey()}.pdf`;
}
function instituteGlanceZipFilename(period = "daily", rangeStartKey = "", rangeEndKey = "", count = 0){
  const countPart = Number(count) > 0 ? `${count}_centres` : "centres";
  return `${countPart}_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).filePart}_ledgr_report_pdfs_${todayKey()}.zip`;
}

// ── HTML-based centre summary export ─────────────────────────────────────────
// Builds a rich HTML template (DM Sans, scorecards, teacher blocks, pending
// table with priority badges). The browser's native print engine handles
// page breaks cleanly via CSS break-inside/break-after rules. @page CSS
// suppresses all browser chrome (URL, date, page numbers).

const CENTRE_SUMMARY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #111827; --ink-2: #374151; --ink-3: #667085; --ink-4: #98a2b3;
    --rule: #e5e7eb; --rule-strong: #cbd5e1;
    --surface: #ffffff; --surface-2: #f8fafc; --surface-3: #eef2f7;
    --green: #16a34a; --green-bg: #f0fdf4; --green-border: #bbf7d0;
    --amber: #b45309; --amber-bg: #fffbeb; --amber-border: #fde68a;
    --red: #dc2626; --red-bg: #fef2f2; --red-border: #fecaca;
    --blue: #1d4ed8; --blue-bg: #eff6ff; --blue-border: #bfdbfe;
    --teal: #0d9488; --teal-bg: #f0fdfa; --teal-border: #99f6e4;
    --navy: #172554; --navy-2: #1e3a8a;
  }
  body {
    font-family: 'DM Sans', sans-serif; background: var(--surface-2);
    color: var(--ink); font-size: 13.5px; line-height: 1.5;
    padding: 30px 24px 56px; max-width: 980px; margin: 0 auto;
  }
  .report-page { page-break-after: always; min-height: 980px; }
  .report-page:last-child { page-break-after: auto; }
  .cover {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff; border-radius: 20px; padding: 42px 44px; min-height: 650px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .brand-row { display: flex; align-items: center; gap: 14px; }
  .brand-mark { width: 54px; height: 54px; border-radius: 16px; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; }
  .brand-title { font-size: 28px; font-weight: 800; letter-spacing: -0.4px; }
  .brand-sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.68); margin-top: 3px; }
  .cover h1 { font-size: 46px; line-height: 1.02; letter-spacing: -1.2px; margin: 80px 0 12px; max-width: 680px; }
  .cover-copy { font-size: 18px; color: rgba(255,255,255,0.78); max-width: 690px; line-height: 1.55; }
  .cover-meta-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 42px; }
  .cover-meta { background: rgba(255,255,255,0.11); border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 14px 16px; }
  .cover-meta .label { color: rgba(255,255,255,0.64); font-size: 10px; letter-spacing: 1.3px; text-transform: uppercase; margin-bottom: 6px; }
  .cover-meta .value { color: #fff; font-size: 18px; font-weight: 700; }
  .executive-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid var(--ink); margin-bottom: 18px; }
  .eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--blue); margin-bottom: 6px; }
  .executive-header h1, .page-header h1 { font-size: 28px; line-height: 1.08; letter-spacing: -0.6px; font-weight: 800; color: var(--ink); }
  .date-card { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 12px 14px; min-width: 190px; text-align: right; }
  .date-card .label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-4); font-weight: 700; }
  .date-card .date { font-size: 16px; color: var(--ink); font-weight: 800; margin-top: 5px; }
  .date-card .time { font-size: 13px; color: var(--ink-3); font-weight: 600; margin-top: 2px; }
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
    margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--ink);
  }
  .page-header .meta { font-size: 11.5px; color: var(--ink-3); text-align: right; line-height: 1.7; }
  .centre-hero {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff; border-radius: 20px; padding: 28px 34px; margin-bottom: 20px;
    text-align: center; border: 1px solid rgba(255,255,255,0.16);
  }
  .centre-hero .brand-row { justify-content: center; margin-bottom: 22px; }
  .centre-hero .eyebrow { color: #93c5fd; margin-bottom: 9px; }
  .centre-hero .institute-title { color: #fff; max-width: 820px; margin: 0 auto; font-size: 34px; }
  .centre-hero .institute-subtitle { color: rgba(255,255,255,0.72); font-size: 14px; margin-top: 10px; }
  .centre-hero-meta { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  .centre-hero-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 7px 12px; font-size: 12px; color: rgba(255,255,255,0.82); }
  .centre-hero-pill strong { color: #fff; font-weight: 800; margin-left: 5px; }
  .institute-title { font-size: 30px; line-height: 1.08; letter-spacing: -0.7px; font-weight: 800; color: var(--ink); max-width: 660px; }
  .institute-subtitle { font-size: 13px; color: var(--ink-3); margin-top: 7px; }
  .scorecard { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .scorecard.five { grid-template-columns: repeat(5, 1fr); }
  .card { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 10px; padding: 13px 14px; }
  .card .label { font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink-3); margin-bottom: 4px; }
  .card .value { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: var(--ink); line-height: 1.1; }
  .card .sub { font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .card.alert .value { color: var(--red); }
  .card.ok .value { color: var(--green); }
  .executive-summary { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 18px 20px; margin: 16px 0; }
  .executive-summary h2 { font-size: 17px; margin-bottom: 8px; }
  .executive-summary p { color: var(--ink-2); font-size: 13px; line-height: 1.65; }
  .centre-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
  .centre-card { background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; padding: 14px 15px; page-break-inside: avoid; }
  .centre-card.warn { border-color: var(--amber-border); background: #fffaf2; }
  .centre-card.good { border-color: var(--green-border); background: #f7fef9; }
  .centre-card.empty { background: #f8fafc; }
  .centre-card h3 { font-size: 15px; line-height: 1.25; margin-bottom: 7px; color: var(--ink); }
  .centre-card .metric-line { display: flex; justify-content: space-between; gap: 10px; color: var(--ink-3); font-size: 12px; margin-top: 5px; }
  .centre-card .metric-line strong { color: var(--ink); }
  .centre-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 10.5px; font-weight: 800; margin-bottom: 8px; }
  .centre-pill.good { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
  .centre-pill.warn { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
  .centre-pill.empty { background: var(--surface-3); color: var(--ink-3); border: 1px solid var(--rule); }
  .pending-breakdown {
    background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 12px;
    padding: 11px 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .pb-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-3); margin-right: 6px; white-space: nowrap; }
  .pb-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
  .pb-chip.red { background: var(--red-bg); color: var(--red); border: 0.5px solid var(--red-border); }
  .pb-chip.amber { background: var(--amber-bg); color: var(--amber); border: 0.5px solid var(--amber-border); }
  .pb-chip.green { background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); }
  .pb-sep { color: var(--rule-strong); font-size: 14px; }
  .progress-wrap {
    background: var(--surface); border: 0.5px solid var(--rule-strong); border-radius: 8px;
    padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 14px;
  }
  .progress-label { font-size: 12px; font-weight: 500; color: var(--ink-2); white-space: nowrap; }
  .progress-bar { flex: 1; height: 6px; background: var(--surface-3); border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 99px; background: var(--green); }
  .progress-pct { font-size: 12px; font-weight: 600; color: var(--green); white-space: nowrap; }
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--ink-3); margin-bottom: 8px; margin-top: 24px;
    padding-bottom: 5px; border-bottom: 0.5px solid var(--rule);
  }
  .teacher-block { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
  .teacher-name-row { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: var(--surface-3); border-bottom: 0.5px solid var(--rule); }
  .avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--blue-bg); border: 0.5px solid var(--blue-border); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: var(--blue); flex-shrink: 0; }
  .tname { font-weight: 600; font-size: 12.5px; color: var(--ink); }
  .subject-tag { margin-left: auto; font-size: 10.5px; padding: 2px 8px; border-radius: 99px; background: var(--blue-bg); color: var(--blue); border: 0.5px solid var(--blue-border); font-weight: 500; }
  .col-head { display: grid; grid-template-columns: 90px 130px 1fr 1fr; gap: 0; padding: 5px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-4); border-bottom: 0.5px solid var(--rule); background: var(--surface); }
  .session-row { display: grid; grid-template-columns: 90px 130px 1fr 1fr; gap: 0; padding: 7px 14px; border-bottom: 0.5px solid var(--rule); align-items: center; font-size: 12px; }
  .col-head.multi-day, .session-row.multi-day { grid-template-columns: 86px 82px 112px minmax(150px, 1fr) minmax(100px, 0.8fr); }
  .session-row:last-child { border-bottom: none; }
  .date-str { color: var(--ink); font-size: 11px; font-weight: 600; white-space: nowrap; }
  .section-name { font-weight: 500; color: var(--ink); }
  .time-str { color: var(--ink-3); font-size: 11.5px; }
  .topic { color: var(--ink-2); }
  .notes-str { color: var(--ink-4); font-size: 11px; text-align: right; }
  .syllabus-mini { border-top: 0.5px solid var(--rule); background: #fbfefa; padding: 10px 14px 12px; }
  .syllabus-mini-title { color: var(--green); font-size: 10px; font-weight: 800; letter-spacing: 0.65px; text-transform: uppercase; margin-bottom: 6px; }
  .syllabus-mini-headline {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-bottom: 8px;
  }
  .syllabus-mini-summary {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    color: var(--ink-3); font-size: 10px; font-weight: 700;
  }
  .syllabus-mini-summary strong { color: var(--ink); font-size: 11.5px; font-weight: 800; }
  .syllabus-mini-grid {
    display: grid; grid-template-columns: minmax(210px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px; align-items: stretch;
  }
  .syllabus-mini-table {
    border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: #fff;
  }
  .syllabus-mini-head, .syllabus-mini-row { display: grid; grid-template-columns: 86px minmax(108px, 1fr) 88px; gap: 8px; align-items: center; }
  .syllabus-mini-head { color: var(--ink-4); font-size: 9px; font-weight: 700; letter-spacing: 0.45px; text-transform: uppercase; padding: 7px 10px; background: #f8fbff; }
  .syllabus-mini-row { color: var(--ink-2); font-size: 10.5px; padding: 8px 10px; border-top: 0.5px solid #e8eef8; background: #fff; }
  .syllabus-mini-row .chapter { color: var(--ink); font-weight: 700; }
  .syllabus-mini-row .muted { color: var(--ink-3); }
  .syllabus-chapter-panel {
    border: 1px solid var(--rule); border-radius: 10px; background: #fff; padding: 9px 10px 10px;
  }
  .syllabus-chapter-panel h4 {
    margin: 0 0 8px; font-size: 9.75px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .syllabus-chapter-panel.covered h4 { color: var(--green); }
  .syllabus-chapter-panel.pending h4 { color: #7c889b; }
  .syllabus-chapter-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .syllabus-chapter-chip {
    display: inline-flex; align-items: center; gap: 5px; min-height: 24px;
    padding: 5px 8px; border-radius: 999px; font-size: 9.75px; font-weight: 700; line-height: 1.2;
    border: 1px solid transparent;
  }
  .syllabus-chapter-chip.covered { color: #166534; background: #e9faf3; border-color: #c7eddc; }
  .syllabus-chapter-chip.pending { color: #64748b; background: #f6f8fc; border-color: #e2e8f0; }
  .syllabus-chapter-mark {
    width: 14px; height: 14px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 900; line-height: 1; flex: 0 0 14px;
  }
  .syllabus-chapter-chip.covered .syllabus-chapter-mark { background: #059669; color: #fff; }
  .syllabus-chapter-chip.pending .syllabus-chapter-mark { background: #e2e8f0; color: #94a3b8; }
  .syllabus-chapter-empty { color: var(--ink-3); font-size: 10px; }
  .syllabus-status { display: inline-block; border-radius: 99px; background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); padding: 2px 8px; font-size: 10px; font-weight: 700; }
  .syllabus-status.progress { background: var(--teal-bg); color: var(--teal); border-color: var(--teal-border); }
  .syllabus-status.pending { background: var(--surface-3); color: var(--ink-3); border-color: var(--rule); }
  .empty-notice { background: var(--blue-bg); border: 0.5px solid var(--blue-border); border-radius: 8px; padding: 16px 18px; color: var(--blue); font-size: 12.5px; margin-bottom: 8px; }
  .empty-notice.green { background: var(--green-bg); border-color: var(--green-border); color: var(--green); }
  .pending-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 0.5px solid var(--rule-strong); border-radius: 8px; overflow: hidden; font-size: 12px; }
  .pending-table thead tr { background: var(--surface-3); }
  .pending-table th { padding: 7px 12px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-4); border-bottom: 0.5px solid var(--rule-strong); white-space: nowrap; }
  .pending-table td { padding: 7px 12px; border-bottom: 0.5px solid var(--rule); color: var(--ink-2); vertical-align: middle; }
  .pending-table tr:last-child td { border-bottom: none; }
  .pending-table .num { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-4); }
  .pending-table .name { font-weight: 500; color: var(--ink); }
  .pending-table .days-col { font-family: 'DM Mono', monospace; font-size: 11.5px; font-weight: 600; }
  .days-urgent { color: var(--red); }
  .days-warn   { color: var(--amber); }
  .days-ok     { color: var(--ink-3); }
  .td-right { text-align: right; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; letter-spacing: 0.2px; }
  .badge-red   { background: var(--red-bg);   color: var(--red);   border: 0.5px solid var(--red-border); }
  .badge-amber { background: var(--amber-bg); color: var(--amber); border: 0.5px solid var(--amber-border); }
  .badge-green { background: var(--green-bg); color: var(--green); border: 0.5px solid var(--green-border); }
  .teacher-activity-page { background: #f3f6fc; color: var(--ink); }
  .activity-topbar {
    background: var(--navy); color: #fff; margin: -30px -24px 26px; padding: 40px 66px;
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .activity-brand { display: flex; align-items: center; gap: 18px; }
  .activity-mark {
    width: 58px; height: 58px; border-radius: 16px; background: #3478f6;
    display: flex; align-items: center; justify-content: center; color: #fff;
    font-size: 30px; font-weight: 800; letter-spacing: -0.4px;
  }
  .activity-brand-title { color: #fff; font-size: 30px; line-height: 1.05; font-weight: 800; letter-spacing: -0.6px; }
  .activity-brand-sub { color: rgba(255,255,255,0.78); font-size: 13px; margin-top: 7px; }
  .activity-period-pill {
    background: rgba(59,130,246,0.22); color: #fff; border-radius: 999px; padding: 13px 34px;
    min-width: 210px; text-align: center; font-size: 12.5px; font-weight: 800;
  }
  .activity-heading { margin: 0 0 26px; }
  .activity-heading h1 { font-size: 30px; line-height: 1.05; font-weight: 800; letter-spacing: -0.65px; color: var(--ink); }
  .activity-heading p { color: var(--ink-3); font-size: 13px; margin-top: 12px; max-width: 780px; }
  .activity-centre-meta { color: var(--blue); font-weight: 800; margin-top: 9px; font-size: 12px; }
  .activity-card-list { display: grid; gap: 18px; }
  .activity-card {
    background: #fff; border: 1px solid var(--rule-strong); border-radius: 14px; overflow: hidden;
    page-break-inside: avoid; break-inside: avoid;
  }
  .activity-card-head {
    background: #eaf0f7; display: flex; align-items: center; gap: 12px; padding: 9px 18px;
  }
  .activity-avatar {
    width: 32px; height: 32px; border-radius: 50%; background: var(--blue-bg);
    border: 1px solid #9cc3ff; color: var(--blue); display: flex; align-items: center;
    justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;
  }
  .activity-teacher-name { font-size: 14.5px; font-weight: 800; color: var(--ink); }
  .activity-subject-pill {
    margin-left: auto; background: var(--blue-bg); color: var(--blue); border: 1px solid #bfdbfe;
    border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: 800; max-width: 210px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .activity-table-wrap { padding: 12px 18px 14px; }
  .activity-table {
    width: 100%; max-width: 100%; box-sizing: border-box; table-layout: fixed;
    border-collapse: separate; border-spacing: 0; border: 1px solid var(--rule-strong);
    border-radius: 10px; overflow: hidden; background: #fff; font-size: 11.5px;
  }
  .activity-table th {
    background: #f8fafc; color: var(--ink-3); font-size: 10.5px; font-weight: 800; text-align: left;
    padding: 9px 12px; border-bottom: 1px solid var(--rule);
  }
  .activity-table td {
    padding: 11px 12px; border-bottom: 1px solid var(--rule); color: var(--ink-2); vertical-align: middle;
    min-width: 0; overflow-wrap: anywhere; word-break: normal;
  }
  .activity-table tr:last-child td { border-bottom: none; }
  .activity-table .class-cell { font-weight: 800; color: var(--ink); white-space: nowrap; }
  .activity-table .time-cell { color: var(--ink-3); white-space: nowrap; }
  .activity-table .notes-cell { color: var(--ink-3); max-width: 210px; }
  .activity-status { font-weight: 800; white-space: nowrap; }
  .activity-status.completed { color: #059669; }
  .activity-status.progress { color: #a16207; }
  .activity-status.started { color: var(--blue); }
  .activity-status.other { color: var(--ink-3); }
  .activity-syllabus {
    margin: 0 18px 14px; padding-top: 2px; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-syllabus-title { color: #059669; font-size: 11px; font-weight: 900; margin-bottom: 8px; }
  .activity-syllabus .activity-table th { background: #fbfefa; }
  .activity-syllabus-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .activity-syllabus-summary {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    color: var(--ink-3); font-size: 10px; font-weight: 700;
  }
  .activity-syllabus-summary strong { color: var(--ink); font-size: 11.5px; font-weight: 800; }
  .activity-syllabus-grid {
    display: grid; grid-template-columns: minmax(210px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px; align-items: stretch;
  }
  .activity-covered {
    margin-top: 0; padding: 9px 11px; background: #f8fafc; border: 1px solid var(--rule);
    border-radius: 9px; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-covered-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    color: var(--ink-2); font-size: 10.5px; font-weight: 900;
    padding-bottom: 7px; border-bottom: 1px solid var(--rule);
  }
  .activity-covered-count {
    color: #059669; font-size: 9.5px; white-space: nowrap;
  }
  .activity-covered-list {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 18px; row-gap: 6px; margin-top: 7px;
  }
  .activity-chapter-chip {
    display: inline-flex; align-items: center; gap: 6px; min-width: 0;
    color: #166534; padding: 1px 0; font-size: 10px; font-weight: 750;
  }
  .activity-chapter-chip.pending { color: #64748b; }
  .activity-chapter-check {
    width: 13px; height: 13px; border-radius: 4px; background: #059669; color: #fff;
    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 13px;
    font-size: 8px; font-weight: 900; line-height: 1;
  }
  .activity-chapter-mark {
    width: 13px; height: 13px; border-radius: 999px; background: #e2e8f0; color: #94a3b8;
    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 13px;
    font-size: 8px; font-weight: 900; line-height: 1;
  }
  .activity-covered-empty { color: var(--ink-3); font-size: 10.5px; margin-top: 6px; }
  .activity-pending-note {
    background: #fffbeb; border: 1px solid var(--amber-border); color: #92400e; border-radius: 12px;
    padding: 12px 15px; font-size: 12px; font-weight: 700; page-break-inside: avoid; break-inside: avoid;
  }
  .activity-footer {
    margin-top: 54px; color: var(--ink-3); display: flex; justify-content: space-between; gap: 18px;
    font-size: 10.5px; border-top: 1px solid var(--rule); padding-top: 10px;
  }
  .page-footer { margin-top: 36px; padding-top: 12px; border-top: 0.5px solid var(--rule); display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-4); }
  .institute-divider { border: none; margin: 0; page-break-before: always; }
  @media print {
    @page {
      margin: 0;
      size: A4 portrait;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      background: white !important;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    .report-page {
      min-height: 0;
      padding: 1.1cm 1.2cm;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    body > .page-footer { margin: 0 1.2cm 1.1cm; }
    .teacher-block, .syllabus-mini { page-break-inside: avoid; break-inside: avoid; }
    .teacher-activity-page { background: #f3f6fc !important; }
    .teacher-activity-page .activity-topbar { margin: -1.1cm -1.2cm 26px; padding: 0.95cm 1.2cm; }
    .teacher-activity-page .activity-card,
    .teacher-activity-page .activity-syllabus,
    .teacher-activity-page .activity-pending-note { page-break-inside: avoid; break-inside: avoid; }
    .pending-table tr { page-break-inside: avoid; break-inside: avoid; }
    .scorecard, .pending-breakdown, .progress-wrap, .centre-card, .executive-summary { page-break-inside: avoid; break-inside: avoid; }
    .section-title { page-break-after: avoid; break-after: avoid; }
    .followup-actions { display: none !important; }
  }
`;

function _avatarInitials(name){
  const parts = String(name || "").trim().split(/\s+/);
  if(parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "?").slice(0, 2).toUpperCase();
}

function _pendingDaysLabel(teacher){
  const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
  // Try to parse a days-ago number from strings like "28 May 2026" or "Signed up 28 May 2026"
  const dateMatch = last.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if(!dateMatch) return { label: "—", cls: "days-urgent" };
  const d = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
  if(isNaN(d)) return { label: "—", cls: "days-urgent" };
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if(days <= 1) return { label: days === 1 ? "1 day" : "today", cls: "days-ok" };
  if(days <= 8) return { label: `${days} days`, cls: "days-warn" };
  return { label: `${days} days`, cls: "days-urgent" };
}

function _pendingBadge(teacher){
  const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
  const isNeverLogged = /no logs yet/i.test(last);
  const isSignedUpOnly = /signed up/i.test(last) && teacher.monthEntries === 0;
  const { cls } = _pendingDaysLabel(teacher);
  if(isNeverLogged) return { label: "Never logged", cls: "badge-red" };
  if(isSignedUpOnly) return { label: "New · no logs", cls: "badge-amber" };
  if(cls === "days-urgent") return { label: "Inactive", cls: "badge-red" };
  if(cls === "days-warn") return { label: "Missed today", cls: "badge-amber" };
  return { label: "Active · missed today", cls: "badge-green" };
}

function getInstituteGlanceGeneratedParts(generatedOnLabel){
  const raw = String(generatedOnLabel || "").replace(/^Generated\s+/i, "").trim();
  const [datePart, timePart] = raw.split(",").map(part => part.trim());
  return {
    raw,
    date: datePart || raw || "Today",
    time: timePart || "",
  };
}

function buildInstituteGlanceDateCard(generatedOnLabel, label = "Generated"){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  return `
    <div class="date-card">
      <div class="label">${e(label)}</div>
      <div class="date">${e(parts.date)}</div>
      ${parts.time ? `<div class="time">${e(parts.time)}</div>` : ""}
    </div>`;
}

function formatInstituteReportEntryDate(dateKey){
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if(!year || !month || !day) return String(dateKey || "—");
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day:"numeric",
    month:"short",
    year:"numeric",
  });
}

function buildInstituteGlanceCentreCard(row, period = "daily", rangeStartKey = "", rangeEndKey = ""){
  const e = escapeExportHtml;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const tone = row.noTeachersSignedUp ? "empty" : row.missingToday === 0 ? "good" : "warn";
  const status = row.noTeachersSignedUp
    ? "No sign-ups yet"
    : row.missingToday === 0
      ? "All teachers updated"
      : `${row.missingToday || 0} pending`;
  const submission = row.noTeachersSignedUp
    ? "No linked teachers"
    : `${row.filledToday || 0}/${row.totalTeachers || 0} teachers updated`;
  return `
    <div class="centre-card ${tone}">
      <span class="centre-pill ${tone}">${e(status)}</span>
      <h3>${e(row.institute || "Institute")}</h3>
      <div class="metric-line"><span>Submission</span><strong>${e(submission)}</strong></div>
      <div class="metric-line"><span>Sections taught</span><strong>${row.sectionsTaught || 0}</strong></div>
      <div class="metric-line"><span>Study hours</span><strong>${e(formatDurationShort(row.totalStudyMinutes || 0))}</strong></div>
      <div class="metric-line"><span>Period</span><strong>${e(periodMeta.label)}</strong></div>
    </div>`;
}

function reportValueMatches(a, b){
  const left = normaliseName(String(a || "").trim());
  const right = normaliseName(String(b || "").trim());
  if(!left || !right) return true;
  return left === right;
}

function activityStatusMeta(detail = {}, fallbackLabel = ""){
  const label = String(detail.statusLabel || fallbackLabel || detail.status || "Started").trim() || "Started";
  const raw = String(detail.status || label).toLowerCase();
  const labelLower = label.toLowerCase();
  if(raw.includes("complete") || labelLower.includes("complete")) return { label, cls:"completed" };
  if(raw.includes("progress") || labelLower.includes("progress")) return { label, cls:"progress" };
  if(raw.includes("start") || labelLower.includes("start")) return { label, cls:"started" };
  return { label, cls:"other" };
}

function syllabusCoveredTitlesForReport(teacher = {}, syllabusRow = {}){
  const rows = Array.isArray(teacher.syllabusCoveredRows) ? teacher.syllabusCoveredRows : [];
  const seen = new Set();
  return rows
    .filter(row => reportValueMatches(row.section, syllabusRow.section) && reportValueMatches(row.subject, syllabusRow.subject))
    .map(row => String(row.chapterTitle || "").trim())
    .filter(title => {
      if(!title) return false;
      const key = syllabusReportNameKey(title);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function syllabusUpdatedLabelForReport(teacher = {}, syllabusRow = {}){
  const rows = (Array.isArray(teacher.syllabusCoveredRows) ? teacher.syllabusCoveredRows : [])
    .filter(row => reportValueMatches(row.section, syllabusRow.section) && reportValueMatches(row.subject, syllabusRow.subject))
    .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
  return rows[0]?.dateKey ? formatInstituteReportEntryDate(rows[0].dateKey) : "-";
}

function buildInstituteGlanceActivityHtmlPage(row, generatedOnLabel, options = {}){
  const e = escapeExportHtml;
  const { standalone = true, period = "daily", rangeStartKey = "", rangeEndKey = "" } = options;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const generatedParts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const filled = row.filledTeacherRows || [];
  const pending = row.pendingTeacherRows || [];
  const total = row.totalTeachers || 0;
  const filledCount = row.filledToday || 0;
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const showEntryDates = periodMeta.key !== "daily";

  const teacherCards = filled.length ? filled.map(teacher => {
    const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
    const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
    const subjectSet = [...new Set([
      ...details.map(d => d.subject).filter(Boolean),
      ...syllabusRows.map(d => d.subject).filter(Boolean),
    ])];
    const subjectLabel = subjectSet.join(", ") || "-";
    const headCells = showEntryDates
      ? ["Date", "Class", "Time", "Status", "Daily entry", "Notes"]
      : ["Class", "Time", "Status", "Daily entry", "Notes"];
    const bodyRows = details.length ? details.map(detail => {
      const status = activityStatusMeta(detail);
      return `<tr>
        ${showEntryDates ? `<td class="time-cell">${e(formatInstituteReportEntryDate(detail.dateKey))}</td>` : ""}
        <td class="class-cell">${e(detail.section || "-")}</td>
        <td class="time-cell">${e(formatExportPdfTime(detail.timeStart, detail.timeEnd) || "-")}</td>
        <td><span class="activity-status ${status.cls}">${e(status.label)}</span></td>
        <td>${e(detail.title || detail.subject || "-")}</td>
        <td class="notes-cell">${e(detail.notes || "-")}</td>
      </tr>`;
    }).join("") : (() => {
      const status = activityStatusMeta({}, teacher.todayStatusLabel || periodMeta.updatedLabel);
      return `<tr>
        ${showEntryDates ? `<td class="time-cell">-</td>` : ""}
        <td class="class-cell">${e(instituteGlanceTeacherSectionCaption(teacher))}</td>
        <td class="time-cell">-</td>
        <td><span class="activity-status ${status.cls}">${e(status.label)}</span></td>
        <td>${e(`${teacher.todayEntries || 0} entr${teacher.todayEntries === 1 ? "y" : "ies"} uploaded`)}</td>
        <td class="notes-cell">${e(instituteGlanceTeacherHoursLabel(teacher))}</td>
      </tr>`;
    })();
    const syllabusHtml = syllabusRows.length ? `
      <div class="activity-syllabus">
        ${syllabusRows.map(item => {
          const totalChapters = Math.max(0, Number(item.totalCount || 0));
          const coveredChapters = Math.max(0, Number(item.coveredCount || 0));
          const progressPct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0;
          const statusClass = item.status === "Complete" ? "completed" : item.status === "In progress" ? "progress" : "other";
          const coveredTitles = Array.isArray(item.coveredChapterTitles) ? item.coveredChapterTitles : [];
          const pendingTitles = Array.isArray(item.pendingChapterTitles) ? item.pendingChapterTitles : [];
          return `
            <div class="activity-syllabus-head">
              <div class="activity-syllabus-title">Syllabus tracker</div>
              <div class="activity-syllabus-summary">
                <span><strong>${e(`${coveredChapters} of ${totalChapters}`)}</strong> chapters covered</span>
                <span>${progressPct}%</span>
                <span><span class="activity-status ${statusClass}">${e(item.status || "Not started")}</span></span>
              </div>
            </div>
            <div class="activity-syllabus-grid">
              <table class="activity-table">
                <thead><tr><th>Section</th><th>Syllabus</th><th>Updated</th></tr></thead>
                <tbody>
                  <tr>
                    <td class="class-cell">${e(item.section || "-")}</td>
                    <td>${e(item.syllabusName || item.subject || subjectLabel || "-")}</td>
                    <td class="time-cell">${e(syllabusUpdatedLabelForReport(teacher, item))}</td>
                  </tr>
                </tbody>
              </table>
              <div class="activity-covered">
                <div class="activity-covered-head">
                  <span>Covered chapters</span>
                  <span class="activity-covered-count">${e(`${coveredTitles.length} completed`)}</span>
                </div>
                ${coveredTitles.length
                  ? `<div class="activity-covered-list">${coveredTitles.map(title => `<span class="activity-chapter-chip"><span class="activity-chapter-check">&#10003;</span><span>${e(title)}</span></span>`).join("")}</div>`
                  : `<div class="activity-covered-empty">No chapters marked covered yet.</div>`}
              </div>
              <div class="activity-covered">
                <div class="activity-covered-head">
                  <span>Not covered yet</span>
                  <span class="activity-covered-count">${e(`${pendingTitles.length} pending`)}</span>
                </div>
                ${pendingTitles.length
                  ? `<div class="activity-covered-list">${pendingTitles.map(title => `<span class="activity-chapter-chip pending"><span class="activity-chapter-mark">&bull;</span><span>${e(title)}</span></span>`).join("")}</div>`
                  : `<div class="activity-covered-empty">Every chapter is marked covered.</div>`}
              </div>
            </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="activity-card">
        <div class="activity-card-head">
          <div class="activity-avatar">${e(_avatarInitials(teacher.name))}</div>
          <div class="activity-teacher-name">${e(teacher.name || "Teacher")}</div>
          <div class="activity-subject-pill">${e(subjectLabel)}</div>
        </div>
        <div class="activity-table-wrap">
          <table class="activity-table">
            <thead><tr>${headCells.map(label => `<th>${e(label)}</th>`).join("")}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        ${syllabusHtml}
      </div>`;
  }).join("") : `<div class="empty-notice">No teacher has uploaded during this ${e(periodMeta.label.toLowerCase())} period.</div>`;

  const pendingHtml = pending.length
    ? `<div class="activity-pending-note">${pending.length} teacher${pending.length === 1 ? "" : "s"} pending for this period: ${e(pending.slice(0, 8).map(item => item.name || "Teacher").join(", "))}${pending.length > 8 ? "..." : ""}</div>`
    : "";

  return `
    ${standalone ? `<section class="report-page teacher-activity-page">` : `<div class="teacher-activity-page">`}
      <div class="activity-topbar">
        <div class="activity-brand">
          <div class="activity-mark">L</div>
          <div>
            <div class="activity-brand-title">Ledgr Report</div>
            <div class="activity-brand-sub">Teacher activity with syllabus tracker</div>
          </div>
        </div>
        <div class="activity-period-pill">${e(periodMeta.label)} - ${e(generatedParts.date)}</div>
      </div>
      <div class="activity-heading">
        <h1>Teacher activity</h1>
        <p>Normal daily entries come first. Syllabus appears only for teachers where admin has published it.</p>
        <div class="activity-centre-meta">${e(row.institute || "Institute")} - ${filledCount}/${total} teachers updated - ${pct}% submission rate</div>
      </div>
      <div class="activity-card-list">
        ${teacherCards}
        ${pendingHtml}
      </div>
      <div class="activity-footer">
        <span>Rule: no published syllabus = daily entry table only. Published syllabus = compact tracker immediately below that teacher.</span>
        <span>${e(generatedOnLabel)}</span>
      </div>
    ${standalone ? `</section>` : `</div>`}`;
}

function buildInstituteGlanceHtmlPage(row, generatedOnLabel, options = {}){
  const e = escapeExportHtml;
  const { standalone = true, period = "daily", rangeStartKey = "", rangeEndKey = "" } = options;
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const filled = row.filledTeacherRows || [];
  const pending = row.pendingTeacherRows || [];
  const total = row.totalTeachers || 0;
  const filledCount = row.filledToday || 0;
  const pendingCount = row.missingToday || 0;
  const sections = row.sectionsTaught || 0;
  const hours = formatDurationShort(row.totalStudyMinutes || 0);
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const showEntryDates = periodMeta.key !== "daily";

  // Pending breakdown counts
  let nInactive = 0, nMissed = 0, nActive = 0;
  pending.forEach(t => {
    const { cls } = _pendingBadge(t);
    if(cls === "badge-red") nInactive++;
    else if(cls === "badge-amber") nMissed++;
    else nActive++;
  });

  // Filled teachers HTML
  let filledHtml = "";
  if(!filled.length){
    filledHtml = `<div class="empty-notice">No teacher has uploaded during this ${e(periodMeta.label.toLowerCase())} period.</div>`;
  } else {
    filledHtml = showEntryDates
      ? `<div class="col-head multi-day"><span>Date</span><span>Section</span><span>Time</span><span>Topic / Title</span><span style="text-align:right">Notes</span></div>`
      : `<div class="col-head"><span>Section</span><span>Time</span><span>Topic / Title</span><span style="text-align:right">Notes</span></div>`;
    filled.forEach(teacher => {
      const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
      const initials = _avatarInitials(teacher.name);
      const declaredSyllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      const subjectSet = [...new Set([
        ...details.map(d => d.subject).filter(Boolean),
        ...declaredSyllabusRows.map(d => d.subject).filter(Boolean),
      ])];
      const subjectLabel = subjectSet.join(", ") || "—";
      let rows = "";
      if(!details.length){
        rows = showEntryDates
          ? `<div class="session-row multi-day"><span class="date-str">—</span><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries===1?"y":"ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`
          : `<div class="session-row"><span class="section-name">${e(instituteGlanceTeacherSectionCaption(teacher))}</span><span class="time-str">—</span><span class="topic">${e(teacher.todayEntries || 0)} entr${teacher.todayEntries===1?"y":"ies"} uploaded</span><span class="notes-str">${e(instituteGlanceTeacherHoursLabel(teacher))}</span></div>`;
      } else {
        rows = details.map(d =>
          `<div class="session-row${showEntryDates ? " multi-day" : ""}">
            ${showEntryDates ? `<span class="date-str">${e(formatInstituteReportEntryDate(d.dateKey))}</span>` : ""}
            <span class="section-name">${e(d.section || "—")}</span>
            <span class="time-str">${e(formatExportPdfTime(d.timeStart, d.timeEnd) || "—")}</span>
            <span class="topic">${e(d.title || d.subject || "—")}</span>
            <span class="notes-str">${e(d.notes || "—")}</span>
          </div>`
        ).join("");
      }
      const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      if(syllabusRows.length){
        rows += `
          <div class="syllabus-mini">
            ${syllabusRows.map(item => {
              const totalChapters = Math.max(0, Number(item.totalCount || 0));
              const coveredChapters = Math.max(0, Number(item.coveredCount || 0));
              const progressPct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0;
              const statusClass = item.status === "Complete" ? "" : item.status === "In progress" ? " progress" : " pending";
              const coveredTitles = Array.isArray(item.coveredChapterTitles) ? item.coveredChapterTitles : [];
              const pendingTitles = Array.isArray(item.pendingChapterTitles) ? item.pendingChapterTitles : [];
              return `
                <div class="syllabus-mini-headline">
                  <div class="syllabus-mini-title">Syllabus tracker</div>
                  <div class="syllabus-mini-summary">
                    <span><strong>${e(`${coveredChapters} of ${totalChapters}`)}</strong> chapters covered</span>
                    <span>${progressPct}%</span>
                    <span><span class="syllabus-status${statusClass}">${e(item.status || "Not started")}</span></span>
                  </div>
                </div>
                <div class="syllabus-mini-grid">
                  <div class="syllabus-mini-table">
                    <div class="syllabus-mini-head">
                      <span>Section</span><span>Syllabus</span><span>Updated</span>
                    </div>
                    <div class="syllabus-mini-row">
                      <span class="muted">${e(item.section || "—")}</span>
                      <span class="chapter">${e(item.syllabusName || item.subject || subjectLabel || "—")}</span>
                      <span class="muted">${e(syllabusUpdatedLabelForReport(teacher, item))}</span>
                    </div>
                  </div>
                  <div class="syllabus-chapter-panel covered">
                    <h4>Covered chapters</h4>
                    ${coveredTitles.length
                      ? `<div class="syllabus-chapter-list">${coveredTitles.map(title => `<span class="syllabus-chapter-chip covered"><span class="syllabus-chapter-mark">&#10003;</span><span>${e(title)}</span></span>`).join("")}</div>`
                      : `<div class="syllabus-chapter-empty">No chapters marked covered yet.</div>`}
                  </div>
                  <div class="syllabus-chapter-panel pending">
                    <h4>Not covered yet</h4>
                    ${pendingTitles.length
                      ? `<div class="syllabus-chapter-list">${pendingTitles.map(title => `<span class="syllabus-chapter-chip pending"><span class="syllabus-chapter-mark">&bull;</span><span>${e(title)}</span></span>`).join("")}</div>`
                      : `<div class="syllabus-chapter-empty">Every chapter is marked covered.</div>`}
                  </div>
                </div>`;
            }).join("")}
          </div>`;
      }
      filledHtml += `
        <div class="teacher-block">
          <div class="teacher-name-row">
            <div class="avatar">${e(initials)}</div>
            <span class="tname">${e(teacher.name || "Teacher")}</span>
            <span class="subject-tag">${e(subjectLabel)}</span>
          </div>
          ${rows}
        </div>`;
    });
  }

  // Pending teachers HTML
  let pendingHtml = "";
  if(!pending.length){
    pendingHtml = `<div class="empty-notice green">All linked teachers in this centre have already uploaded their entries today.</div>`;
  } else {
    const rows = pending.map((teacher, i) => {
      const last = teacher.lastActivityLabel || instituteGlanceLastActivityLabel(teacher);
      const { label: daysLabel, cls: daysCls } = _pendingDaysLabel(teacher);
      const badge = _pendingBadge(teacher);
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="name">${e(teacher.name || "Teacher")}</td>
        <td>${e(last)}</td>
        <td class="td-right days-col ${daysCls}">${e(daysLabel)}</td>
        <td class="td-right num">${teacher.monthEntries || 0}</td>
        <td class="td-right"><span class="badge ${badge.cls}">${e(badge.label)}</span></td>
      </tr>`;
    }).join("");
    pendingHtml = `
      <table class="pending-table">
        <thead><tr>
          <th>#</th><th>Teacher</th><th>Last entry</th>
          <th class="td-right">Days inactive</th>
          <th class="td-right">Sections this month</th>
          <th class="td-right">Priority</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  return `
    ${standalone ? `<section class="report-page">` : ""}
      <div class="centre-hero">
        <div class="institute-title">${e(row.institute || "Centre Summary")}</div>
        <div class="institute-subtitle">${e(periodMeta.title)} · Submissions, pending teachers, sections, and hours.</div>
        <div class="centre-hero-meta">
          <span class="centre-hero-pill">Period <strong>${e(periodMeta.label)}</strong></span>
          <span class="centre-hero-pill">Date <strong>${e(getInstituteGlanceGeneratedParts(generatedOnLabel).date)}</strong></span>
          ${getInstituteGlanceGeneratedParts(generatedOnLabel).time ? `<span class="centre-hero-pill">Generated <strong>${e(getInstituteGlanceGeneratedParts(generatedOnLabel).time)}</strong></span>` : ""}
        </div>
      </div>

      <div class="scorecard">
        <div class="card ok">
          <div class="label">${e(periodMeta.updatedLabel)}</div>
          <div class="value">${filledCount}/${total}</div>
          <div class="sub">${pct}% submission rate</div>
        </div>
        <div class="card alert">
          <div class="label">${e(periodMeta.pendingLabel)}</div>
          <div class="value">${pendingCount}</div>
          <div class="sub">not filled yet</div>
        </div>
        <div class="card">
          <div class="label">Sections taught</div>
          <div class="value">${sections}</div>
          <div class="sub">${e(periodMeta.sectionsSubLabel)}</div>
        </div>
        <div class="card">
          <div class="label">Study hours</div>
          <div class="value">${e(hours)}</div>
          <div class="sub">${e(periodMeta.hoursSubLabel)}</div>
        </div>
      </div>

      ${pending.length ? `
      <div class="pending-breakdown">
        <span class="pb-label">Pending breakdown</span>
        ${nInactive > 0 ? `<span class="pb-chip red"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>${nInactive} inactive / never logged</span><span class="pb-sep">·</span>` : ""}
        ${nMissed > 0 ? `<span class="pb-chip amber"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>${nMissed} missed several days</span><span class="pb-sep">·</span>` : ""}
        ${nActive > 0 ? `<span class="pb-chip green"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>${nActive} active · missed today</span>` : ""}
      </div>
      <div class="progress-wrap">
        <span class="progress-label">${e(periodMeta.submissionLabel)}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span class="progress-pct">${filledCount} / ${total} · ${pct}%</span>
      </div>` : ""}

      <div class="section-title">${e(periodMeta.activeLabel)} (${filled.length})</div>
      ${filledHtml}

      <div class="section-title">Pending follow-up (${pending.length})${pending.length ? " - sorted by urgency" : ""}</div>
      ${pendingHtml}

      <div class="page-footer">
        <span>${e(row.institute || "Centre")} · Ledgr</span>
        <span>${e(generatedOnLabel)}</span>
      </div>
    ${standalone ? `</section>` : ""}`;
}

function buildInstituteGlanceSummaryHtml({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes" }){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const completionPct = summary.totalTeachers > 0 ? Math.round(((summary.filledToday || 0) / summary.totalTeachers) * 100) : 0;
  const sortedRows = [...(rows || [])].sort((a, b) => {
    if((b.missingToday || 0) !== (a.missingToday || 0)) return (b.missingToday || 0) - (a.missingToday || 0);
    return exportTextSorter.compare(a.institute || "", b.institute || "");
  });
  const coverScorecard = `
    <div class="scorecard five">
      <div class="card"><div class="label">Institutes</div><div class="value">${summary.totalInstitutes || 0}</div></div>
      <div class="card ok"><div class="label">${e(periodMeta.updatedLabel)}</div><div class="value">${summary.filledToday || 0}/${summary.totalTeachers || 0}</div></div>
      <div class="card alert"><div class="label">${e(periodMeta.pendingLabel)}</div><div class="value">${summary.missingToday || 0}</div></div>
      <div class="card"><div class="label">Sections taught</div><div class="value">${summary.sectionsTaught || 0}</div></div>
      <div class="card"><div class="label">Study hours</div><div class="value">${e(formatDurationShort(summary.totalStudyMinutes || 0))}</div></div>
    </div>`;

  const centreCards = sortedRows.map(row => buildInstituteGlanceCentreCard(row, period, rangeStartKey, rangeEndKey)).join("");
  const institutePages = (rows || []).map(row => buildInstituteGlanceHtmlPage(row, generatedOnLabel, { standalone:true, period, rangeStartKey, rangeEndKey })).join("");

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${e(periodMeta.title)} - ${e(parts.date)}${parts.time ? ` ${e(parts.time)}` : ""}</title>
    <style>${CENTRE_SUMMARY_CSS}</style>
  </head><body>
    <section class="report-page">
      <div class="cover">
        <div>
          <div class="brand-row">
            <div class="brand-mark">L</div>
            <div>
              <div class="brand-title">Ledgr</div>
              <div class="brand-sub">${e(periodMeta.label)} Report</div>
            </div>
          </div>
          <h1>${e(periodMeta.title)}</h1>
          <div class="cover-copy">Teacher submissions and pending follow-up for ${e(scopeLabel === "All institutes" ? "all institutes" : scopeLabel)}.</div>
          <div class="cover-meta-grid">
            <div class="cover-meta"><div class="label">Report period</div><div class="value">${e(periodMeta.periodValue || periodMeta.label)}</div></div>
            <div class="cover-meta"><div class="label">Scope</div><div class="value">${e(scopeLabel)}</div></div>
            <div class="cover-meta"><div class="label">Generated</div><div class="value">${e(`${parts.date}${parts.time ? ` · ${parts.time}` : ""}`)}</div></div>
          </div>
        </div>
        <div class="cover-copy">Pending institutes appear first.</div>
      </div>
    </section>

    <section class="report-page">
      <div class="executive-header">
        <div>
          <div class="eyebrow">Overview</div>
          <h1>${e(periodMeta.title)}</h1>
        </div>
        ${buildInstituteGlanceDateCard(generatedOnLabel, "Report generated")}
      </div>
      ${coverScorecard}
      <div class="executive-summary">
        <h2>Summary</h2>
        <p>${summary.filledToday || 0} of ${summary.totalTeachers || 0} teachers updated (${completionPct}%). ${summary.missingToday || 0} teachers are pending follow-up. The network logged ${summary.sectionsTaught || 0} sections and ${e(formatDurationShort(summary.totalStudyMinutes || 0))} of study time.</p>
      </div>
      <div class="section-title">Institutes - pending first</div>
      <div class="centre-grid">${centreCards}</div>
    </section>

    ${institutePages}
    <div class="page-footer">
      <span>Ledgr · ${e(scopeLabel)} summary</span>
      <span>${e(generatedOnLabel)}</span>
    </div>
  </body></html>`;
}

function buildInstituteGlanceInstituteHtml(row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = ""){
  const e = escapeExportHtml;
  const parts = getInstituteGlanceGeneratedParts(generatedOnLabel);
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${e(row.institute || "Centre")} - ${e(periodMeta.title)} - ${e(parts.date)}${parts.time ? ` ${e(parts.time)}` : ""}</title>
    <style>${CENTRE_SUMMARY_CSS}</style>
  </head><body>
    ${buildInstituteGlanceHtmlPage(row, generatedOnLabel, { period, rangeStartKey, rangeEndKey })}
  </body></html>`;
}

// ── PDF export: window.print() with clean @page CSS ─────────────────────────
// Using the browser's native print engine gives perfect text rendering,
// proper page breaks (via CSS break-inside/break-after), and zero canvas
// artefacts. The HTML template's @media print block suppresses all browser
// chrome (URL, date, page numbers) and forces background colours to print.

function _printHtml(html, filename){
  const win = window.open("", "_blank", "width=900,height=700");
  if(!win){
    window.alert("Pop-ups are blocked. Please allow pop-ups for this site, then try again.");
    return;
  }
  // Inject a print-and-close script so Save as PDF works with one click
  const htmlWithPrint = html.replace(
    "</body>",
    `<script>
      window.onload = function(){
        // Small delay so fonts finish loading before the dialog opens
        setTimeout(function(){ window.print(); }, 380);
      };
    <\/script></body>`
  );
  win.document.open();
  win.document.write(htmlWithPrint);
  win.document.close();
}

async function downloadInstituteGlanceSummaryPdf({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes", scopeFilePart = "all_institutes" }){
  const html = buildInstituteGlanceSummaryHtml({ rows, summary, generatedOnLabel, period, rangeStartKey, rangeEndKey, scopeLabel });
  _printHtml(html, `${scopeFilePart}_${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).filePart}_ledgr_report_${todayKey()}.pdf`);
}
async function downloadInstituteGlanceInstitutePdf({ row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const rows = row ? [row] : [];
  const html = buildInstituteGlanceSummaryHtml({
    rows,
    summary:summariseInstituteGlanceRows(rows),
    generatedOnLabel,
    period,
    rangeStartKey,
    rangeEndKey,
    scopeLabel:row?.institute || "Institute",
  });
  _printHtml(html, instituteGlancePdfFilename(row?.institute || "institute", period, rangeStartKey, rangeEndKey));
}
async function renderInstituteGlanceHtmlPdfBlob({ html, filename }){
  let response;
  try{
    response = await fetch("/api/render-ledgr-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename }),
    });
  } catch(error){
    const localHint = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? " Centre PDFs ZIP needs the Admin app with the `/api/render-ledgr-pdf` endpoint enabled, such as deployed Admin or `vercel dev`."
      : "";
    throw new Error(`Could not reach the PDF renderer.${localHint}`);
  }
  if(!response.ok){
    let message = "Could not render institute PDF.";
    if(response.status === 404){
      message = "The PDF renderer route `/api/render-ledgr-pdf` is unavailable. Centre PDFs ZIP works from deployed Admin or `vercel dev`, not plain Vite preview.";
    }
    try{
      const payload = await response.json();
      if(payload?.error) message = payload.error;
    } catch(_error){
      // Keep the concise fallback above when the server returned a non-JSON error.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  if(!blob || blob.size === 0){
    throw new Error("The PDF renderer returned an empty file.");
  }
  return new Blob([blob], { type: "application/pdf" });
}
async function verifyInstituteZipRenderer(){
  const probeHtml = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>probe</title></head><body>Ledgr ZIP probe</body></html>";
  await renderInstituteGlanceHtmlPdfBlob({ html:probeHtml, filename:"ledgr-zip-probe.pdf" });
}
async function buildInstituteGlanceInstitutePdfBlob({ row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const { jsPDF, autoTable } = await loadInstituteGlanceExportRuntime();
  const doc = new jsPDF({ orientation:"portrait", unit:"pt", format:"a4" });
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const navy = [26, 47, 90];
  const blue = [29, 78, 216];
  const green = [22, 101, 52];
  const amber = [180, 83, 9];
  const muted = [100, 116, 139];
  const teachers = row?.teacherRows || [];
  const filled = row?.filledToday || 0;
  const total = row?.totalTeachers || 0;
  const pending = row?.missingToday || 0;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 142, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(row?.institute || "Institute", margin, 55, { maxWidth: pageWidth - margin * 2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${periodMeta.title} · ${generatedOnLabel}`, margin, 78, { maxWidth: pageWidth - margin * 2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${filled}/${total} teachers updated · ${pending} pending · ${pct}%`, margin, 112);

  const cardY = 166;
  const cardGap = 10;
  const cardW = (pageWidth - margin * 2 - cardGap * 3) / 4;
  const metrics = [
    ["Teachers", String(total || 0)],
    [periodMeta.updatedLabel, String(filled || 0)],
    [periodMeta.pendingLabel, String(pending || 0)],
    ["Study hours", formatDurationShort(row?.totalStudyMinutes || 0)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(221, 227, 237);
    doc.roundedRect(x, cardY, cardW, 62, 10, 10, "FD");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(String(label).toUpperCase(), x + 12, cardY + 22, { maxWidth: cardW - 24 });
    doc.setTextColor(...navy);
    doc.setFontSize(18);
    doc.text(String(value), x + 12, cardY + 47, { maxWidth: cardW - 24 });
  });

  let cursorY = 260;
  const pageBottom = 780;
  const showEntryDates = periodMeta.key !== "daily";
  const filledTeachers = row?.filledTeacherRows || [];
  const ensurePageSpace = (height = 90) => {
    if(cursorY + height <= pageBottom) return;
    doc.addPage();
    cursorY = 50;
  };

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${periodMeta.activeLabel} (${filledTeachers.length})`, margin, cursorY);
  cursorY += 16;

  if(!filledTeachers.length){
    ensurePageSpace(54);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 42, 8, 8, "FD");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`No teacher has uploaded during this ${periodMeta.label.toLowerCase()} period.`, margin + 12, cursorY + 25);
    cursorY += 60;
  } else {
    filledTeachers.forEach(teacher => {
      const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
      const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      const subjectSet = [...new Set([
        ...details.map(d => d.subject).filter(Boolean),
        ...syllabusRows.map(d => d.subject).filter(Boolean),
      ])];
      const subjectLabel = subjectSet.join(", ") || "-";
      const initials = _avatarInitials(teacher?.name || "Teacher");
      ensurePageSpace(98);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 34, 8, 8, "FD");
      doc.setFillColor(219, 234, 254);
      doc.setDrawColor(147, 197, 253);
      doc.circle(margin + 17, cursorY + 17, 11, "FD");
      doc.setTextColor(...blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(initials, margin + 17, cursorY + 20, { align:"center" });
      doc.setTextColor(...navy);
      doc.setFontSize(11);
      doc.text(teacher?.name || "Teacher", margin + 36, cursorY + 21, { maxWidth: pageWidth - margin * 2 - 150 });
      doc.setDrawColor(147, 197, 253);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(pageWidth - margin - 72, cursorY + 8, 72, 18, 9, 9, "FD");
      doc.setTextColor(...blue);
      doc.setFontSize(8);
      doc.text(subjectLabel.slice(0, 22), pageWidth - margin - 36, cursorY + 20, { align:"center" });
      cursorY += 34;

      const entryRows = [];
      details.forEach(d => {
        const base = [
          d.section || "-",
          formatExportPdfTime(d.timeStart, d.timeEnd) || "-",
          d.title || d.subject || "-",
          d.notes || "-",
        ];
        entryRows.push(showEntryDates ? [formatInstituteReportEntryDate(d.dateKey), ...base] : base);
      });
      if(!entryRows.length){
        const base = [
          instituteGlanceTeacherSectionCaption(teacher),
          "-",
          `${teacher.todayEntries || 0} entries uploaded`,
          instituteGlanceTeacherHoursLabel(teacher),
        ];
        entryRows.push(showEntryDates ? ["-", ...base] : base);
      }

      autoTable(doc, {
        startY: cursorY,
        head: [showEntryDates ? ["Date", "Section", "Time", "Topic / Title", "Notes"] : ["Section", "Time", "Topic / Title", "Notes"]],
        body: entryRows,
        margin:{ left:margin, right:margin },
        theme:"grid",
        styles:{ font:"helvetica", fontSize:8.8, cellPadding:6, lineColor:[226,232,240], lineWidth:0.5, textColor:[31,41,55], overflow:"linebreak" },
        headStyles:{ fillColor:[248,250,252], textColor:[100,116,139], fontStyle:"bold" },
        alternateRowStyles:{ fillColor:[255,255,255] },
        columnStyles: showEntryDates
          ? {
              0:{ cellWidth:54, textColor:[31,41,55], fontStyle:"bold" },
              1:{ cellWidth:58, fontStyle:"bold" },
              2:{ cellWidth:76, textColor:muted },
              3:{ cellWidth:160 },
              4:{ cellWidth:pageWidth - margin * 2 - 54 - 58 - 76 - 160 },
            }
          : {
              0:{ cellWidth:72, fontStyle:"bold" },
              1:{ cellWidth:94, textColor:muted },
              2:{ cellWidth:176 },
              3:{ cellWidth:pageWidth - margin * 2 - 72 - 94 - 176, halign:"right", textColor:muted },
            },
        didParseCell:(hookData) => {
          if(hookData.section !== "body") return;
          const rowData = entryRows[hookData.row.index] || [];
          const isSyllabus = rowData.includes("Syllabus");
          if(!isSyllabus) return;
          hookData.cell.styles.fillColor = [251, 254, 250];
          if(String(hookData.cell.raw || "") === "Covered"){
            hookData.cell.styles.textColor = green;
            hookData.cell.styles.fontStyle = "bold";
          }
        },
      });
      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 13;

      if(syllabusRows.length){
        ensurePageSpace(68);
        doc.setTextColor(...green);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Syllabus tracker", margin, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          head: [["Section", "Subject", "Covered", "Status"]],
          body: syllabusRows.map(item => [
            item.section || "-",
            item.subject || subjectLabel || "-",
            `${item.coveredCount || 0} of ${item.totalCount || 0} chapters`,
            item.status || "Not started",
          ]),
          margin:{ left:margin, right:margin },
          theme:"grid",
          styles:{ font:"helvetica", fontSize:8.4, cellPadding:5, lineColor:[232,244,233], lineWidth:0.5, textColor:[31,41,55], overflow:"linebreak" },
          headStyles:{ fillColor:[251,254,250], textColor:green, fontStyle:"bold" },
          alternateRowStyles:{ fillColor:[255,255,255] },
          columnStyles:{
            0:{ cellWidth:70 },
            1:{ cellWidth:88 },
            2:{ cellWidth:118, fontStyle:"bold" },
            3:{ cellWidth:pageWidth - margin * 2 - 70 - 88 - 118, textColor:green, fontStyle:"bold" },
          },
        });
        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 13;
      }
    });
  }

  cursorY += 10;
  const pendingTeachers = row?.pendingTeacherRows || [];
  if(pendingTeachers.length){
    doc.setTextColor(...amber);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Pending follow-up", margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 12,
      head: [["Teacher", "Last activity", "Classes"]],
      body: pendingTeachers.map(teacher => [
        teacher?.name || "Teacher",
        teacher?.lastActivityLabel || instituteGlanceLastActivityLabel(teacher),
        (teacher?.classNames || teacher?.sectionNames || []).join(", ") || "-",
      ]),
      margin:{ left:margin, right:margin },
      styles:{ font:"helvetica", fontSize:8.7, cellPadding:6, lineColor:[253,230,138], lineWidth:0.5, textColor:[55,65,81], overflow:"linebreak" },
      headStyles:{ fillColor:amber, textColor:[255,255,255], fontStyle:"bold" },
      alternateRowStyles:{ fillColor:[255,251,235] },
    });
  } else {
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(total ? "All linked teachers are updated for this period." : "No teacher records are linked to this centre yet.", margin, cursorY);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for(let page = 1; page <= pageCount; page += 1){
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Ledgr · ${periodMeta.label} centre PDF`, margin, 820);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 820, { align:"right" });
    doc.setTextColor(...blue);
  }

  return new Blob([doc.output("arraybuffer")], { type:"application/pdf" });
}
async function downloadInstituteGlanceInstituteZip({ rows, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const { JSZip } = await loadInstituteGlanceExportRuntime();
  const safeRows = Array.isArray(rows) ? rows : [];
  await verifyInstituteZipRenderer();
  const zip = new JSZip();
  const folder = zip.folder("Ledgr centre PDFs") || zip;
  for(const row of safeRows){
    const filename = instituteGlancePdfFilename(row?.institute || "institute", period, rangeStartKey, rangeEndKey);
    const rows = [row];
    const html = buildInstituteGlanceSummaryHtml({
      rows,
      summary:summariseInstituteGlanceRows(rows),
      generatedOnLabel,
      period,
      rangeStartKey,
      rangeEndKey,
      scopeLabel:row?.institute || "Institute",
    });
    const blob = await renderInstituteGlanceHtmlPdfBlob({ html, filename });
    folder.file(filename, await blob.arrayBuffer());
  }
  const readme = [
    "Ledgr Centre PDFs",
    "",
    "This ZIP contains one separate PDF report for each selected institute.",
    "Every institute PDF is rendered from the same print template as the combined PDF report.",
    "",
    `Generated: ${generatedOnLabel}`,
    `Period: ${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).title}`,
    `Centres: ${safeRows.length}`,
  ].join("\n");
  zip.file("README.txt", readme);
  const zipBlob = await zip.generateAsync({
    type:"blob",
    mimeType:"application/zip",
    compression:"DEFLATE",
    compressionOptions:{ level:6 },
  });
  if(!zipBlob || zipBlob.size === 0){
    throw new Error("The Centre PDFs ZIP was empty. Please try again.");
  }
  triggerBlobDownload(
    new Blob([zipBlob], { type:"application/zip" }),
    instituteGlanceZipFilename(period, rangeStartKey, rangeEndKey, safeRows.length),
  );
}
function getEntriesInRange(classNotes={}, days=null, startKey=null, endKey=null){
  // returns flat array of {dateKey, entry} sorted by date desc, time asc
  const cutoff=days?Date.now()-days*24*60*60*1000:0;
  const result=[];
  Object.entries(classNotes||{}).forEach(([dk,arr])=>{
    if(days && new Date(dk).getTime()<cutoff) return;
    if(!days && startKey && dk<startKey) return;
    if(!days && endKey && dk>endKey) return;
    if(!Array.isArray(arr)) return;
    arr.forEach(e=>{ if(e) result.push({dateKey:dk,entry:e}); });
  });
  // sort by date desc, within date by timeStart asc
  result.sort((a,b)=>{
    if(b.dateKey!==a.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return (a.entry.timeStart||"").localeCompare(b.entry.timeStart||"");
  });
  return result;
}
function groupByDate(flatEntries){
  const map={};
  flatEntries.forEach(({dateKey,entry})=>{
    if(!map[dateKey]) map[dateKey]=[];
    map[dateKey].push(entry);
  });
  return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
}
function formatDateLabel(dk){
  if(!dk) return "";
  const[y,m,d]=dk.split("-").map(Number);
  if(dk===todayKey()) return "Today";
  return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
}

const pill=(bg,color,border)=>({background:bg,color,border:`1px solid ${border||bg}`,borderRadius:8,padding:"6px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:500,transition:"all 0.15s"});

function AlsoAtInstitutes({ institutes = [], maxVisible = 2 }){
  const cleaned = [...new Set((institutes || []).map(inst => String(inst || "").trim()).filter(Boolean))];
  if(!cleaned.length) return null;
  const visible = cleaned.slice(0, maxVisible);
  const remaining = cleaned.length - visible.length;
  const hiddenLabel = cleaned.slice(maxVisible).join(", ");
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8,alignItems:"center"}}>
      <span style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.8}}>
        Also at
      </span>
      {visible.map(inst=>(
        <span
          key={inst}
          title={inst}
          style={{
            display:"inline-flex",
            alignItems:"center",
            maxWidth:"100%",
            background:G.bg,
            border:`1px solid ${G.border}`,
            borderRadius:999,
            padding:"4px 10px",
            fontSize:12,
            lineHeight:1.35,
            color:G.textM,
            fontFamily:G.sans,
            fontWeight:600,
          }}>
          {inst}
        </span>
      ))}
      {remaining>0&&(
        <span
          title={hiddenLabel}
          style={{
            display:"inline-flex",
            alignItems:"center",
            background:"#EEF4FF",
            border:"1px solid #C7D7F5",
            borderRadius:999,
            padding:"4px 10px",
            fontSize:12,
            lineHeight:1.35,
            color:G.blue,
            fontFamily:G.sans,
            fontWeight:700,
          }}>
          +{remaining} more
        </span>
      )}
    </div>
  );
}

// ── Panel styles ──────────────────────────────────────────────────────────────
const sidePanel={flexShrink:0,background:G.surface,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",overflow:"hidden",boxSizing:"border-box"};
const panelLabel={fontSize:11,letterSpacing:1.5,color:G.textM,fontFamily:G.sans,fontWeight:600,textTransform:"uppercase",padding:"12px 14px 7px",flexShrink:0};
const siBase={padding:"12px 13px",borderRadius:9,cursor:"pointer",marginBottom:3,borderLeft:"3px solid transparent",transition:"background 0.1s"};

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(e){ return {error:e}; }
  render(){
    if(this.state.error) return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:"#F7F8F6",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:24}}>
        <div style={{textAlign:"center",maxWidth:400}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <h2 style={{color:"#0E1F18",fontFamily:"'Poppins',sans-serif",marginBottom:8}}>Something went wrong</h2>
          <p style={{color:"#5C7268",fontSize:15,marginBottom:20,lineHeight:1.6}}>
            There was an error loading this data. This may be caused by unexpected data format in Firestore.
          </p>
          <p style={{color:"#94ADA5",fontSize:13,fontFamily:"'Inter',sans-serif",background:"#F7F8F6",padding:"8px 12px",borderRadius:8,marginBottom:20,wordBreak:"break-all"}}>
            {this.state.error?.message}
          </p>
          <button onClick={()=>window.location.reload()} style={{background:"#1B8A4C",color:"#fff",border:"none",borderRadius:9,padding:"10px 22px",fontSize:15,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
            Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── Period Selector ────────────────────────────────────────────────────────────
function PeriodSelector({
  period,
  onChangePeriod,
  compact = false,
  accentColor = null,
  rangeStart = "",
  rangeEnd = "",
  onChangeRangeStart = ()=>{},
  onChangeRangeEnd = ()=>{},
}) {
  const accent = accentColor || G.navy;
  const quickPills=[["today","Today"],["yesterday","Yesterday"],["week","This Week"],["month","This Month"],["range","Range"]];
  const rangeActive=period==="range";
  const dateInputStyle={
    width:"100%",
    padding:compact?"8px 10px":"9px 11px",
    borderRadius:10,
    border:`1.5px solid ${rangeActive?accent:G.borderM}`,
    background:"#FFFFFF",
    color:G.textS,
    fontSize:compact?12.5:13,
    fontFamily:G.sans,
    boxSizing:"border-box",
    outline:"none",
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:compact?8:10}}>
      <div style={{display:"flex",gap:compact?4:6,flexWrap:"wrap"}}>
        {quickPills.map(([k,l])=>{
          const sel=period===k;
          return(
            <button key={k} onClick={()=>onChangePeriod(k)}
              style={{
                padding:compact?"6px 10px":"7px 14px",
                borderRadius:12,
                fontSize:compact?12:13,
                cursor:"pointer",
                fontFamily:G.sans,
                fontWeight:sel?700:600,
                background:sel?accent:"transparent",
                color:sel?"#fff":G.textS,
                border:`1.5px solid ${sel?accent:G.borderM}`,
                whiteSpace:"nowrap",
                transition:"all 0.14s",
                WebkitTapHighlightColor:"transparent",
              }}>
              {l}
            </button>
          );
        })}
      </div>
      {rangeActive&&(
        <div style={{display:"grid",gridTemplateColumns:compact?"1fr":"repeat(2,minmax(0,1fr))",gap:compact?8:10}}>
          <div>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginBottom:6,textTransform:"uppercase",letterSpacing:0.45}}>From</div>
            <input type="date" value={rangeStart||""} max={rangeEnd||undefined} onChange={e=>onChangeRangeStart(e.target.value)} style={dateInputStyle}/>
          </div>
          <div>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginBottom:6,textTransform:"uppercase",letterSpacing:0.45}}>To</div>
            <input type="date" value={rangeEnd||""} min={rangeStart||undefined} onChange={e=>onChangeRangeEnd(e.target.value)} style={dateInputStyle}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
// ── Admin Export Modal — bottom sheet, works on all devices ──────────────────
function AdminExportModal({ exportActions, onClose }) {
  const [period,   setPeriod]   = React.useState("month");
  const [format,   setFormat]   = React.useState("csv");
  const [selActionIdx, setSelActionIdx] = React.useState(0);
  const [selMonth, setSelMonth] = React.useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  const [selWeek,  setSelWeek]  = React.useState(()=>{const n=new Date(),p=n=>String(n).padStart(2,"0");return`${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;});
  const [selDay,   setSelDay]   = React.useState(()=>{const n=new Date(),p=n=>String(n).padStart(2,"0");return`${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;});
  const [busy,     setBusy]     = React.useState(false);

  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

  function periodLabel(){
    if(period==="day") return selDay;
    if(period==="week"){
      const d=new Date(selWeek),day=d.getDay();
      const sun=new Date(d); sun.setDate(d.getDate()-day);
      const sat=new Date(sun); sat.setDate(sun.getDate()+6);
      const f=x=>`${x.getDate()} ${MONTHS[x.getMonth()].slice(0,3)}`;
      return `${f(sun)} – ${f(sat)} ${sat.getFullYear()}`;
    }
    const [y,m]=selMonth.split("-").map(Number);
    return `${MONTHS[m-1]} ${y}`;
  }

  // Compute exact startKey and endKey (YYYY-MM-DD) from modal's own date pickers
  function getDateRange(){
    if(period==="all") return {startKey:null, endKey:null};
    if(period==="day") return {startKey:selDay, endKey:selDay};
    if(period==="month"){
      const [y,m]=selMonth.split("-").map(Number);
      const start=`${y}-${String(m).padStart(2,"0")}-01`;
      const lastDay=new Date(y,m,0).getDate();
      const end=`${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      return {startKey:start, endKey:end};
    }
    if(period==="week"){
      const d=new Date(selWeek), day=d.getDay();
      const sun=new Date(d); sun.setDate(d.getDate()-day);
      const sat=new Date(sun); sat.setDate(sun.getDate()+6);
      const fmt=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
      return {startKey:fmt(sun), endKey:fmt(sat)};
    }
    return {startKey:null, endKey:null};
  }

  function doExport(){
    if(!exportActions.length) return;
    setBusy(true);
    setTimeout(()=>{
      const action = exportActions[selActionIdx] || exportActions[0];
      const {startKey, endKey} = getDateRange();
      // getRows filters by exact date range and sorts ascending (oldest first)
      const rows = action.getRows(startKey, endKey);
      if(!rows.length){ setBusy(false); onClose(); alert("No entries found for the selected period."); return; }
      const label = period==="all"?"All Time":periodLabel();
      const filename = `${action.filename}_${label.replace(/[^a-zA-Z0-9]/g,"_")}`;
      if(format==="csv") action.triggerCSV(rows, filename);
      else if(format==="pdf") action.triggerPDF(rows, action.title, `${action.meta} · ${label}`);
      else action.triggerJSON(rows, filename, label);
      setBusy(false);
      onClose();
    },100);
  }

  const inp2={width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #DDE3ED",fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",background:"#F5F7FA",color:"#111827",boxSizing:"border-box"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,width:"100%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Scrollable content */}
        <div style={{overflowY:"auto",flex:1,padding:"26px 22px 8px"}}>

          {/* Header */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{width:46,height:46,borderRadius:13,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📤</div>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif"}}>Export Entries</div>
              <div style={{fontSize:13,color:"#6B7280"}}>
                {exportActions.length>0 ? exportActions[selActionIdx]?.sub || exportActions[0].sub : "Select a view first"}
              </div>
            </div>
            <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9CA3AF",lineHeight:1,padding:4}}>✕</button>
          </div>

          {exportActions.length===0 ? (
            <div style={{textAlign:"center",padding:"20px 0",color:"#9CA3AF",fontSize:14,fontFamily:"'Inter',sans-serif"}}>
              Select an institute, teacher, or class first to export.
            </div>
          ) : (<>

            {/* Scope — fully working selection */}
            {exportActions.length>1&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Scope</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {exportActions.map((a,i)=>{
                    const isSel=selActionIdx===i;
                    return(
                      <div key={i} onClick={()=>setSelActionIdx(i)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${isSel?"#1A2F5A":"#DDE3ED"}`,background:isSel?"#EEF2FF":"transparent",cursor:"pointer",transition:"all 0.15s"}}>
                        <span style={{fontSize:18}}>{a.icon}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:"#111827",fontFamily:"'Inter',sans-serif"}}>{a.label}</div>
                          <div style={{fontSize:12,color:"#6B7280",fontFamily:"'Inter',sans-serif"}}>{a.sub}</div>
                        </div>
                        {isSel&&<span style={{marginLeft:"auto",fontSize:11,background:"#1A2F5A",color:"#fff",borderRadius:20,padding:"2px 8px",fontFamily:"'Inter',sans-serif",fontWeight:600}}>Selected</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Period */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Period</div>
              <div style={{display:"flex",gap:6}}>
                {[["day","Daily"],["week","Weekly"],["month","Monthly"],["all","All Time"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setPeriod(k)}
                    style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:period===k?700:500,
                      background:period===k?"#1A2F5A":"rgba(0,0,0,0.06)",color:period===k?"#fff":"#374151",transition:"all 0.15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Date picker */}
            {period!=="all"&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                  {period==="day"?"Date":period==="week"?"Any day in the week":"Month"}
                </div>
                {period==="month"&&<input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={inp2}/>}
                {period==="week"&&<input type="date" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={inp2}/>}
                {period==="day"&&<input type="date" value={selDay} onChange={e=>setSelDay(e.target.value)} style={inp2}/>}
              </div>
            )}

            {/* Format */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Format</div>
              <div style={{display:"flex",gap:8}}>
                {[["csv","📊 CSV / Excel"],["pdf","📄 PDF"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setFormat(k)}
                    style={{flex:1,padding:"12px 0",borderRadius:12,border:`2px solid ${format===k?"#1A2F5A":"#DDE3ED"}`,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:format===k?700:500,
                      background:format===k?"#EEF2FF":"transparent",color:format===k?"#1A2F5A":"#374151",transition:"all 0.15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div style={{background:"#F5F7FA",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#374151",fontFamily:"'Inter',sans-serif"}}>
              📅 <strong>{period==="all"?"All time":periodLabel()}</strong> · {format==="pdf"?"Opens print dialog":"Downloads .csv file"}
            </div>

          </>)}
        </div>

        {/* Fixed footer buttons — never clipped */}
        <div style={{flexShrink:0,padding:"12px 22px 20px",borderTop:"1px solid #F3F4F6",display:"flex",gap:10,background:"#fff"}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif"}}>
            Cancel
          </button>
          <button onClick={doExport} disabled={busy||exportActions.length===0}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:(busy||exportActions.length===0)?"#D5D5D5":"#1A2F5A",fontSize:15,fontWeight:700,cursor:(busy||exportActions.length===0)?"not-allowed":"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",opacity:busy?0.7:1}}>
            {busy?"Preparing…":"Export"}
          </button>
        </div>

      </div>
    </div>
  );
}

function LedgrReportOptionsModal({
  institutes,
  period,
  month,
  rangeStart,
  rangeEnd,
  schedule,
  scheduleLoading,
  scheduleSaving,
  exportDisabled,
  busyFormat,
  initialMode = "export",
  context = "report",
  onClose,
  onApply,
  onSaveSchedule,
}) {
  const hobbyBatchTime = "20:00";
  const hobbyBatchTimezone = "Asia/Kolkata";
  const isMessengerSchedule = context === "messenger";
  const [actionMode, setActionMode] = React.useState(isMessengerSchedule || initialMode === "schedule" ? "schedule" : "export");
  const [draftPeriod, setDraftPeriod] = React.useState(period || "daily");
  const [draftMonth, setDraftMonth] = React.useState(month || currentMonthKey());
  const [draftRangeStart, setDraftRangeStart] = React.useState(rangeStart || addDaysToDateKey(todayKey(), -6));
  const [draftRangeEnd, setDraftRangeEnd] = React.useState(rangeEnd || todayKey());
  const [scope, setScope] = React.useState("all");
  const [selectedInstitutes, setSelectedInstitutes] = React.useState(() => [...(institutes || [])]);
  const [format, setFormat] = React.useState("pdf");
  const [scheduleEnabled, setScheduleEnabled] = React.useState(schedule?.enabled !== false);
  const [scheduleTimes, setScheduleTimes] = React.useState(() => schedule?.times?.length ? [...schedule.times] : [hobbyBatchTime]);
  const [scheduleTimezone, setScheduleTimezone] = React.useState(schedule?.timezone || hobbyBatchTimezone);
  const busy = actionMode === "schedule" ? !!scheduleSaving : !!busyFormat;
  const allInstitutes = institutes || [];

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  React.useEffect(() => {
    if(!schedule) return;
    setScheduleEnabled(schedule.enabled !== false);
    setScheduleTimes(schedule.times?.length ? [...schedule.times] : [hobbyBatchTime]);
    setScheduleTimezone(schedule.timezone || hobbyBatchTimezone);
  }, [hobbyBatchTime, hobbyBatchTimezone, schedule?.updatedAt]);

  React.useEffect(() => {
    setActionMode(isMessengerSchedule || initialMode === "schedule" ? "schedule" : "export");
  }, [initialMode, isMessengerSchedule]);

  const inputStyle = {
    width:"100%",
    height:46,
    borderRadius:12,
    border:"1px solid #DDE3ED",
    background:"#F8FAFC",
    color:"#111827",
    fontSize:15,
    fontWeight:700,
    fontFamily:G.sans,
    padding:"0 12px",
    boxSizing:"border-box",
    outline:"none",
  };
  const sectionLabel = {
    fontSize:12,
    fontWeight:800,
    color:"#374151",
    textTransform:"uppercase",
    letterSpacing:0.7,
    marginBottom:9,
    fontFamily:G.mono,
  };
  const periodOptions = [
    ["daily", "Daily"],
    ["yesterday", "Yesterday"],
    ["weekly", "Weekly"],
    ["monthly", "Monthly"],
    ["range", "Range"],
  ];
  const formatOptions = [
    { key:"pdf", label:"PDF report", icon:IconFileText, help:"Opens executive PDF" },
    { key:"png", label:"PNG summary", icon:IconPhoto, help:"Downloads summary image" },
    { key:"zip", label:"Centre PDFs ZIP", icon:IconDownload, help:"Downloads one ZIP of pixel-matched institute PDFs" },
  ];
  const modalTitle = isMessengerSchedule ? "Messenger batch" : "Ledgr Report";
  const modalSubtitle = actionMode === "schedule"
    ? isMessengerSchedule
      ? "Review the once-daily 8 PM Telegram batch"
      : "Review the once-daily 8 PM batch"
    : "Choose period and output";
  const effectiveInstitutes = scope === "all" ? allInstitutes : selectedInstitutes;
  const scopeLabel = scope === "all"
    ? "All institutes"
    : `${selectedInstitutes.length} institute${selectedInstitutes.length === 1 ? "" : "s"} selected`;
  const rangeLabel = draftPeriod === "monthly"
    ? actionMode === "schedule"
      ? "Current month"
      : new Date(`${monthBoundsFromKey(draftMonth).startKey}T00:00:00`).toLocaleDateString("en-IN", { month:"long", year:"numeric" })
    : draftPeriod === "range"
      ? `${draftRangeStart || "Start"} to ${draftRangeEnd || "End"}`
      : draftPeriod === "yesterday"
        ? "Yesterday"
      : draftPeriod === "weekly"
        ? "Last 7 days"
        : "Today";
  const scheduleLastRunAt = Number(schedule?.execution?.lastRunAt || schedule?.lastRunAt || 0);
  const actionDisabled = busy
    || effectiveInstitutes.length === 0
    || (actionMode === "export" && exportDisabled);

  React.useEffect(() => {
    if(actionMode !== "schedule") return;
    setFormat("pdf");
    if(!schedule) return;
    const savedReport = schedule.report || {};
    setDraftPeriod(savedReport.period || "daily");
    setDraftMonth(savedReport.month || currentMonthKey());
    setDraftRangeStart(savedReport.rangeStart || addDaysToDateKey(todayKey(), -6));
    setDraftRangeEnd(savedReport.rangeEnd || todayKey());
    const savedScope = schedule.scope?.type === "selected" ? "selected" : "all";
    setScope(savedScope);
    setSelectedInstitutes(savedScope === "selected"
      ? (schedule.scope?.institutes || []).filter(saved => allInstitutes.some(institute => sameInstituteName(saved, institute)))
      : [...allInstitutes]);
  }, [actionMode, allInstitutes, schedule]);

  const selectActionMode = (nextMode) => {
    if(busy || nextMode === actionMode) return;
    setActionMode(nextMode);
  };

  const apply = () => {
    const safeStart = draftRangeStart && draftRangeEnd && draftRangeStart > draftRangeEnd ? draftRangeEnd : draftRangeStart;
    const safeEnd = draftRangeStart && draftRangeEnd && draftRangeStart > draftRangeEnd ? draftRangeStart : draftRangeEnd;
    const reportConfig = {
      period:draftPeriod,
      month:draftMonth || currentMonthKey(),
      rangeStart:safeStart || todayKey(),
      rangeEnd:safeEnd || todayKey(),
    };
    if(actionMode === "schedule"){
      onSaveSchedule({
        enabled:scheduleEnabled,
        times:[hobbyBatchTime],
        timezone:hobbyBatchTimezone,
        report:reportConfig,
        scope:{
          type:scope,
          institutes:scope === "selected" ? effectiveInstitutes : [],
        },
        output:{ format:"pdf" },
      });
      return;
    }
    onApply({ ...reportConfig, format, selectedInstitutes:effectiveInstitutes });
  };

  const modal = (
    <div className="ledgr-report-modal-overlay" style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.58)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",overflow:"hidden"}}>
      <style>{`
        .ledgr-report-modal-overlay {
          height: 100vh;
          height: 100dvh;
          box-sizing: border-box;
        }
        .ledgr-report-modal {
          max-height: calc(100dvh - 32px);
        }
        .ledgr-report-modal-scroll {
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 600px) {
          .ledgr-report-modal-overlay {
            padding: max(8px, env(safe-area-inset-top, 0px)) 8px max(8px, env(safe-area-inset-bottom, 0px)) !important;
          }
          .ledgr-report-modal {
            max-height: calc(100dvh - 16px) !important;
            border-radius: 20px !important;
          }
          .ledgr-report-modal-scroll {
            padding: 20px 16px 10px !important;
          }
          .ledgr-report-modal-footer {
            padding: 12px 16px max(14px, env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
      <div className="ledgr-report-modal" style={{background:"#FFFFFF",borderRadius:24,width:"100%",maxWidth:520,boxShadow:"0 28px 80px rgba(15,23,42,0.28)",maxHeight:"calc(100dvh - 32px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div className="ledgr-report-modal-scroll" style={{overflowY:"auto",minHeight:0,flex:1,padding:"26px 24px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:52,height:52,borderRadius:16,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <AppIcon icon={actionMode === "schedule" ? IconClock : IconCalendar} size={26} color={G.blue} />
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:22,fontWeight:800,color:"#111827",fontFamily:G.display,lineHeight:1.1}}>{modalTitle}</div>
              <div style={{fontSize:15,color:"#6B7280",fontFamily:G.sans,lineHeight:1.45,marginTop:4}}>{modalSubtitle}</div>
              <div style={{fontSize:12.5,color:G.blue,fontFamily:G.sans,fontWeight:800,lineHeight:1.4,marginTop:5}}>Institutes: {scopeLabel}</div>
            </div>
            <button type="button" onClick={onClose} disabled={busy} style={{marginLeft:"auto",border:"none",background:"transparent",color:"#9CA3AF",fontSize:28,lineHeight:1,cursor:busy?"not-allowed":"pointer",padding:2}}>×</button>
          </div>

          {!isMessengerSchedule && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:20,padding:5,borderRadius:15,background:"#F1F5F9"}}>
              {[
                ["export", "Export now", IconDownload],
                ["schedule", "Schedule", IconClock],
              ].map(([key, label, icon]) => {
                const active = actionMode === key;
                return (
                  <button key={key} type="button" onClick={()=>selectActionMode(key)} disabled={busy} style={{
                    height:42,
                    border:"none",
                    borderRadius:11,
                    background:active ? "#FFFFFF" : "transparent",
                    boxShadow:active ? G.shadowSm : "none",
                    color:active ? G.navy : G.textM,
                    display:"inline-flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:7,
                    fontSize:13.5,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    <AppIcon icon={icon} size={17} color={active ? G.blue : G.textL} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Period</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(96px,1fr))",gap:8}}>
              {periodOptions.map(([key, label]) => {
                const active = draftPeriod === key;
                return (
                  <button key={key} type="button" onClick={()=>setDraftPeriod(key)} disabled={busy} style={{
                    minHeight:42,
                    border:"none",
                    borderRadius:13,
                    background:active ? G.navy : "rgba(15,23,42,0.07)",
                    color:active ? "#FFFFFF" : "#374151",
                    fontSize:14,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Institutes</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              {[
                ["all", "All institutes"],
                ["selected", "Select institutes"],
              ].map(([key, label]) => {
                const active = scope === key;
                return (
                  <button key={key} type="button" onClick={()=>setScope(key)} disabled={busy} style={{
                    minHeight:42,
                    border:`2px solid ${active ? G.navy : "#DDE3ED"}`,
                    borderRadius:13,
                    background:active ? "#EEF2FF" : "#FFFFFF",
                    color:active ? G.navy : "#374151",
                    fontSize:13.5,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {scope === "selected" && (
              <div style={{marginTop:10,border:"1px solid #DDE3ED",borderRadius:14,background:"#F8FAFC",padding:"6px",maxHeight:190,overflowY:"auto"}}>
                <div style={{display:"flex",justifyContent:"flex-end",gap:6,padding:"3px 4px 7px"}}>
                  <button type="button" onClick={()=>setSelectedInstitutes([...allInstitutes])} disabled={busy} style={{border:"none",background:"transparent",color:G.blue,fontSize:11.5,fontWeight:800,fontFamily:G.sans,cursor:"pointer",padding:"3px 5px"}}>Select all</button>
                  <button type="button" onClick={()=>setSelectedInstitutes([])} disabled={busy} style={{border:"none",background:"transparent",color:G.textM,fontSize:11.5,fontWeight:800,fontFamily:G.sans,cursor:"pointer",padding:"3px 5px"}}>Clear</button>
                </div>
                {allInstitutes.map(institute => {
                  const checked = selectedInstitutes.some(item => sameInstituteName(item, institute));
                  return (
                    <label key={institute} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 10px",borderRadius:10,cursor:busy?"not-allowed":"pointer",background:checked?"#EEF4FF":"transparent",fontFamily:G.sans}}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => setSelectedInstitutes(current => checked
                          ? current.filter(item => !sameInstituteName(item, institute))
                          : [...current, institute])}
                        style={{width:17,height:17,marginTop:1,accentColor:G.navy,flexShrink:0}}
                      />
                      <span style={{fontSize:13,fontWeight:checked?800:600,color:G.text,lineHeight:1.35}}>{institute}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {draftPeriod === "monthly" && actionMode === "export" && (
            <div style={{marginBottom:20}}>
              <div style={sectionLabel}>Month</div>
              <input type="month" value={draftMonth} onChange={event=>setDraftMonth(event.target.value || currentMonthKey())} disabled={busy} style={inputStyle} />
            </div>
          )}
          {draftPeriod === "monthly" && actionMode === "schedule" && (
            <div style={{marginBottom:20,background:"#F8FAFC",border:"1px solid #DDE3ED",borderRadius:13,padding:"11px 13px",fontSize:12.5,color:G.textM,lineHeight:1.5}}>
              Each scheduled run uses the current calendar month.
            </div>
          )}

          {draftPeriod === "range" && (
            <div style={{marginBottom:20}}>
              <div style={sectionLabel}>Date Range</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                <input type="date" value={draftRangeStart} max={draftRangeEnd || undefined} onChange={event=>setDraftRangeStart(event.target.value || todayKey())} disabled={busy} style={inputStyle} />
                <input type="date" value={draftRangeEnd} min={draftRangeStart || undefined} onChange={event=>setDraftRangeEnd(event.target.value || todayKey())} disabled={busy} style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Format</div>
            <div style={{display:"grid",gridTemplateColumns:actionMode === "schedule" ? "1fr" : "repeat(2,minmax(0,1fr))",gap:10}}>
              {formatOptions.filter(item => actionMode === "export" || item.key === "pdf").map(item => {
                const active = format === item.key;
                const disabled = busy || (actionMode === "export" && exportDisabled);
                return (
                  <button key={item.key} type="button" onClick={()=>setFormat(item.key)} disabled={disabled} style={{
                    minHeight:72,
                    border:`2px solid ${active ? G.navy : "#DDE3ED"}`,
                    borderRadius:16,
                    background:active ? "#EEF2FF" : "#FFFFFF",
                    color:disabled ? "#9CA3AF" : active ? G.navy : "#374151",
                    cursor:disabled ? "not-allowed" : "pointer",
                    padding:"12px 12px",
                    display:"flex",
                    alignItems:"center",
                    gap:10,
                    textAlign:"left",
                    fontFamily:G.sans,
                  }}>
                    <AppIcon icon={item.icon} size={22} color={disabled ? "#9CA3AF" : active ? G.navy : "#6B7280"} />
                    <span style={{minWidth:0}}>
                      <span style={{display:"block",fontSize:15,fontWeight:800,lineHeight:1.2}}>{item.label}</span>
                      <span style={{display:"block",fontSize:11.5,fontWeight:600,color:disabled ? "#A1A1AA" : "#6B7280",lineHeight:1.3,marginTop:3}}>{item.help}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {actionMode === "schedule" && (
              <div style={{fontSize:11.5,color:G.textL,lineHeight:1.45,marginTop:8}}>
                {isMessengerSchedule
                  ? "The messenger batch sends one exact PDF per active Telegram mapping at 8 PM."
                  : "The scheduler sends one PDF batch per day for the selected institutes."}
              </div>
            )}
          </div>

          {actionMode === "schedule" && (
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10}}>
                <div style={{...sectionLabel,marginBottom:0}}>Daily Batch</div>
                <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:800,color:scheduleEnabled?G.blue:G.textM,fontFamily:G.sans,cursor:busy?"not-allowed":"pointer"}}>
                  <input type="checkbox" checked={scheduleEnabled} onChange={event=>setScheduleEnabled(event.target.checked)} disabled={busy} style={{width:17,height:17,accentColor:G.blue}} />
                  {scheduleEnabled ? "Active" : "Paused"}
                </label>
              </div>
              <div style={{border:"1px solid #DDE3ED",borderRadius:14,background:"#F8FAFC",padding:"12px 13px"}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,borderRadius:999,background:"#EEF2FF",color:G.blue,padding:"7px 12px",fontSize:12.5,fontWeight:800,fontFamily:G.sans}}>
                  <AppIcon icon={IconClock} size={15} color={G.blue} />
                  Around 8:00 PM daily
                </div>
                <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:10}}>
                  {isMessengerSchedule
                    ? "The saved 8 PM batch sends one exact Ledgr PDF to every active Telegram recipient that matches the schedule scope."
                    : "Vercel Hobby runs this once during the 8 PM hour, then the batch sends one exact Ledgr PDF per active institute route."}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:7,fontSize:11.5,color:G.textL,lineHeight:1.45,marginTop:9}}>
                <AppIcon icon={IconClock} size={15} color={G.textL} />
                Timezone: <strong style={{color:G.textM}}>{scheduleTimezone}</strong>
              </div>
              <div style={{marginTop:10,border:`1px solid ${scheduleLastRunAt ? "#BBF7D0" : "#FDE68A"}`,borderRadius:12,background:scheduleLastRunAt ? "#F0FDF4" : "#FFFBEB",padding:"10px 12px",fontSize:11.5,color:scheduleLastRunAt ? "#166534" : "#92400E",lineHeight:1.5}}>
                {scheduleLoading
                  ? "Loading the saved schedule..."
                  : scheduleLastRunAt
                    ? `Background runner connected. Last generated ${new Date(scheduleLastRunAt).toLocaleString("en-IN")}.`
                    : isMessengerSchedule
                      ? "This saves the once-daily 8 PM Telegram batch. Background sending begins after the scheduler runner is connected."
                      : "This saves the once-daily 8 PM batch. Background generation begins after the admin deployment is live."}
              </div>
            </div>
          )}

          <div style={{background:"#F8FAFC",borderRadius:14,padding:"12px 14px",fontSize:14,color:"#374151",fontFamily:G.sans,lineHeight:1.35}}>
            <AppIcon icon={actionMode === "schedule" ? IconClock : IconCalendar} size={16} color={G.blue} style={{display:"inline-flex",verticalAlign:"-3px",marginRight:7}} />
            <strong>{scopeLabel}</strong> · {rangeLabel} · {actionMode === "schedule"
              ? (scheduleEnabled
                ? (isMessengerSchedule ? "Telegram batch around 8 PM" : "Daily batch around 8 PM")
                : "Schedule paused")
              : format === "pdf" ? "opens print dialog" : format === "png" ? "downloads image" : "downloads centre ZIP"}
          </div>
        </div>

        <div className="ledgr-report-modal-footer" style={{flexShrink:0,padding:"14px 24px 22px",borderTop:"1px solid #F1F5F9",display:"flex",gap:12,background:"#FFFFFF"}}>
          <button type="button" onClick={onClose} disabled={busy} style={{flex:1,height:50,borderRadius:14,border:"1.5px solid #E5E7EB",background:"#FFFFFF",color:"#374151",fontSize:15,fontWeight:800,fontFamily:G.sans,cursor:busy?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={actionDisabled} style={{flex:1,height:50,borderRadius:14,border:"none",background:actionDisabled ? "#CBD5E1" : G.navy,color:"#FFFFFF",fontSize:15,fontWeight:900,fontFamily:G.sans,cursor:actionDisabled ? "not-allowed" : "pointer"}}>
            {busy ? (actionMode === "schedule" ? "Saving..." : "Preparing...") : actionMode === "schedule" ? "Save schedule" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : modal;
}

function LedgrTelegramDashboardModal({
  institutes,
  schedule,
  config,
  loading,
  saving,
  sendBusy,
  onClose,
  onSave,
  onOpenSchedule,
  onSendNow,
  embedded = false,
}) {
  const [enabled, setEnabled] = React.useState(true);
  const [botUsername, setBotUsername] = React.useState("@ledgrapp_bot");
  const [scheduledEnabled, setScheduledEnabled] = React.useState(true);
  const [onDemandEnabled, setOnDemandEnabled] = React.useState(true);
  const [recipients, setRecipients] = React.useState([]);
  const [fullReportRecipients, setFullReportRecipients] = React.useState([]);
  const [draftError, setDraftError] = React.useState("");
  const [expandedRow, setExpandedRow] = React.useState("");
  const [knownUsers, setKnownUsers] = React.useState([]);
  const [knownUsersBusy, setKnownUsersBusy] = React.useState(false);
  const [knownUsersError, setKnownUsersError] = React.useState("");
  const [deliveryProbe, setDeliveryProbe] = React.useState({
    checking: true,
    routeReachable: false,
    manualReady: false,
    scheduledReady: false,
    tokenPresent: null,
    error: "",
  });

  React.useEffect(() => {
    if(embedded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [embedded]);

  React.useEffect(() => {
    const draft = buildTelegramDashboardDraft(config);
    setEnabled(draft.enabled);
    setBotUsername(draft.botUsername);
    setScheduledEnabled(draft.scheduledEnabled);
    setOnDemandEnabled(draft.onDemandEnabled);
    setRecipients(draft.recipients);
    setFullReportRecipients(draft.fullReportRecipients);
    setDraftError("");
  }, [config?.updatedAt, config?.schemaVersion, institutes.length]);

  React.useEffect(() => {
    let cancelled = false;
    async function probeMessengerDelivery() {
      setDeliveryProbe({
        checking: true,
        routeReachable: false,
        manualReady: false,
        scheduledReady: false,
        tokenPresent: null,
        error: "",
      });
      try {
        const currentUser = auth.currentUser;
        if(!currentUser){
          throw new Error("Sign in again to verify messenger delivery.");
        }
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/send-ledgr-telegram", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if(!contentType.includes("application/json")){
          throw new Error("This deployment is not serving `/api/send-ledgr-telegram` as an API route.");
        }
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if(cancelled) return;
        if(!response.ok){
          setDeliveryProbe({
            checking: false,
            routeReachable: true,
            manualReady: false,
            scheduledReady: false,
            tokenPresent: false,
            error: payload?.error || "Could not verify messenger delivery.",
          });
          return;
        }
        const health = payload?.health || {};
        setDeliveryProbe({
          checking: false,
          routeReachable: true,
          manualReady: !!health?.manualEndpointReady,
          scheduledReady: !!health?.scheduledEndpointReady,
          tokenPresent: health?.tokenPresent !== false,
          error: payload?.warning || "",
        });
      } catch (error) {
        if(cancelled) return;
        setDeliveryProbe({
          checking: false,
          routeReachable: false,
          manualReady: false,
          scheduledReady: false,
          tokenPresent: null,
          error: error?.message || "Could not reach the messenger delivery route.",
        });
      }
    }
    probeMessengerDelivery();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadKnownUsers = React.useCallback(async () => {
    try {
      const currentUser = auth.currentUser;
      if(!currentUser){
        throw new Error("Sign in again to load Telegram users.");
      }
      setKnownUsersBusy(true);
      setKnownUsersError("");
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/list-ledgr-telegram-users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if(!response.ok){
        throw new Error(payload?.error || "Could not load Telegram users.");
      }
      setKnownUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (error) {
      setKnownUsersError(error?.message || "Could not load Telegram users.");
    } finally {
      setKnownUsersBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void loadKnownUsers();
  }, [loadKnownUsers]);

  const actionBusy = !!loading || !!saving;
  const manualRouteReady = deliveryProbe.routeReachable
    ? deliveryProbe.manualReady
    : !!config?.health?.manualEndpointReady;
  const scheduleRouteReady = deliveryProbe.routeReachable
    ? deliveryProbe.scheduledReady
    : !!config?.health?.scheduledEndpointReady;
  const routeIssue = !deliveryProbe.checking && !deliveryProbe.routeReachable && !!deliveryProbe.error;
  const tokenMissingOnServer = deliveryProbe.routeReachable && deliveryProbe.tokenPresent === false;
  const backgroundRunnerReady = !!(scheduleRouteReady || schedule?.execution?.lastRunAt || schedule?.lastRunAt);
  const scheduleSaved = !!schedule?.enabled && !!scheduledEnabled;
  const lastSuccessAt = Number(config?.execution?.lastSuccessAt || 0);
  const lastAttemptAt = Number(config?.execution?.lastAttemptAt || 0);
  const lastErrorMessage = String(config?.execution?.lastErrorMessage || config?.execution?.lastError || "").trim();

  const uniqueInstituteNames = (values = []) => {
    const ordered = [];
    (values || []).forEach(value => {
      const clean = String(value || "").trim();
      if(!clean) return;
      if(ordered.some(existing => sameInstituteName(existing, clean))) return;
      ordered.push(clean);
    });
    return ordered;
  };

  const knownUserMap = React.useMemo(() => new Map(
    (knownUsers || []).map(item => [normaliseTelegramChatId(item?.chatId), item])
  ), [knownUsers]);
  const knownUserByUsername = React.useMemo(() => new Map(
    (knownUsers || [])
      .map(item => [telegramUsernameKey(item?.username), item])
      .filter(([key]) => !!key)
  ), [knownUsers]);

  const resolveRecipientIdentity = React.useCallback((recipient = {}) => {
    const explicitChatId = normaliseTelegramChatId(recipient?.chatId);
    const explicitUsername = normaliseTelegramUsername(recipient?.username);
    const matchedUser = explicitUsername
      ? knownUserByUsername.get(telegramUsernameKey(explicitUsername))
      : null;
    const resolvedChatId = explicitChatId || normaliseTelegramChatId(matchedUser?.chatId);
    const resolvedUsername = explicitUsername || normaliseTelegramUsername(matchedUser?.username);
    const resolvedLabel = String(recipient?.label || matchedUser?.label || "").trim();
    const destinationType = ["channel", "group", "private"].includes(recipient?.destinationType)
      ? recipient.destinationType
      : (matchedUser?.destinationType || "private");
    return {
      ...recipient,
      chatId: resolvedChatId,
      username: resolvedUsername,
      label: resolvedLabel,
      destinationType,
      matchedUser,
    };
  }, [knownUserByUsername]);

  const configuredRecipients = React.useMemo(() => (
    recipients.filter(item => item?.institute && normaliseTelegramChatId(item?.chatId))
  ), [recipients]);
  const activeRecipients = React.useMemo(() => (
    configuredRecipients.filter(item => item?.enabled !== false)
  ), [configuredRecipients]);
  const activeFullReportRecipients = React.useMemo(() => (
    fullReportRecipients.filter(item => item?.enabled !== false && normaliseTelegramChatId(item?.chatId))
  ), [fullReportRecipients]);
  const instituteRows = React.useMemo(() => (
    uniqueInstituteNames([...(institutes || []), ...recipients.map(item => item?.institute)]).map((instituteName, index) => {
      const rowRecipients = recipients.filter(item => sameInstituteName(item?.institute, instituteName));
      return {
        id:`route_${index}_${instituteName}`,
        institute: instituteName,
        recipients: rowRecipients,
        activeRecipients: rowRecipients.filter(item => item?.enabled !== false && normaliseTelegramChatId(item?.chatId)),
      };
    })
  ), [institutes, recipients]);
  const missingCoverageCount = Math.max(
    uniqueInstituteNames(institutes || []).length
      - uniqueInstituteNames(activeRecipients.map(item => item?.institute)).length,
    0
  );
  const sendAllDisabled = actionBusy
    || !!sendBusy
    || !enabled
    || !onDemandEnabled
    || routeIssue
    || tokenMissingOnServer
    || !manualRouteReady
    || (!activeRecipients.length && !activeFullReportRecipients.length);
  const headerStatus = deliveryProbe.checking
    ? { label:"Checking route", bg:"#DBEAFE", color:G.blue }
    : routeIssue
      ? { label:"Route issue", bg:"#FEE2E2", color:"#B91C1C" }
      : tokenMissingOnServer
        ? { label:"Token missing", bg:"#FEF3C7", color:"#B45309" }
        : manualRouteReady && backgroundRunnerReady
          ? { label:"Ready", bg:"#DCFCE7", color:"#166534" }
          : manualRouteReady
            ? { label:"Manual live", bg:"#DBEAFE", color:G.blue }
            : { label:"Needs setup", bg:"#F3F4F6", color:G.textM };

  const shellCardStyle = {
    border:"1px solid #E2E8F0",
    borderRadius:24,
    background:"#FFFFFF",
    boxShadow:"0 12px 28px rgba(15,23,42,0.06)",
  };
  const labelStyle = {
    fontSize:11,
    fontWeight:800,
    color:G.textL,
    textTransform:"uppercase",
    letterSpacing:0.9,
    fontFamily:G.mono,
  };
  const inputStyle = {
    width:"100%",
    height:42,
    borderRadius:12,
    border:"1px solid #DDE3ED",
    background:"#FFFFFF",
    color:G.text,
    fontSize:14,
    fontWeight:700,
    fontFamily:G.sans,
    padding:"0 12px",
    boxSizing:"border-box",
    outline:"none",
  };
  const actionButtonStyle = (primary = false, disabled = false) => ({
    height:36,
    minWidth:36,
    padding:"0 12px",
    borderRadius:11,
    border:primary ? "none" : `1px solid ${G.border}`,
    background:primary ? G.navy : "#FFFFFF",
    color:primary ? "#FFFFFF" : G.text,
    fontSize:12.5,
    fontWeight:800,
    fontFamily:G.sans,
    cursor:disabled ? "not-allowed" : "pointer",
    opacity:disabled ? 0.55 : 1,
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    gap:6,
  });
  const pillStyle = (background, color) => ({
    display:"inline-flex",
    alignItems:"center",
    gap:6,
    borderRadius:999,
    padding:"6px 10px",
    background,
    color,
    fontSize:11.5,
    fontWeight:800,
    fontFamily:G.sans,
    whiteSpace:"nowrap",
  });

  const updateRecipient = (id, patch) => {
    setRecipients(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };
  const updateFullReportRecipient = (id, patch) => {
    setFullReportRecipients(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };
  const addRecipient = (instituteName = "", seed = {}) => {
    setRecipients(current => [...current, buildTelegramRecipientDraft(instituteName, seed)]);
  };
  const addFullReportRecipient = (seed = {}) => {
    setFullReportRecipients(current => [...current, buildTelegramRecipientDraft("", seed)]);
  };
  const removeRecipient = (id) => {
    setRecipients(current => current.filter(item => item.id !== id));
  };
  const removeFullReportRecipient = (id) => {
    setFullReportRecipients(current => current.filter(item => item.id !== id));
  };
  const addKnownUserToInstitute = (instituteName, user) => {
    const chatId = normaliseTelegramChatId(user?.chatId);
    if(!chatId) return;
    const exists = recipients.some(item => sameInstituteName(item?.institute, instituteName) && normaliseTelegramChatId(item?.chatId) === chatId);
    if(exists) return;
    addRecipient(instituteName, {
      username: normaliseTelegramUsername(user?.username),
      chatId,
      label: String(user?.label || "").trim(),
      destinationType: user?.destinationType || "private",
    });
  };
  const addKnownUserToFullReport = (user) => {
    const chatId = normaliseTelegramChatId(user?.chatId);
    if(!chatId) return;
    const exists = fullReportRecipients.some(item => normaliseTelegramChatId(item?.chatId) === chatId);
    if(exists) return;
    addFullReportRecipient({
      username: normaliseTelegramUsername(user?.username),
      chatId,
      label: String(user?.label || "").trim(),
      destinationType: user?.destinationType || "private",
    });
  };
  const removeKnownUserFromInstitute = (instituteName, user) => {
    const chatId = normaliseTelegramChatId(user?.chatId);
    const usernameKey = telegramUsernameKey(user?.username);
    if(!chatId && !usernameKey) return;
    setRecipients(current => current.filter(item => {
      if(!sameInstituteName(item?.institute, instituteName)) return true;
      const itemChatId = normaliseTelegramChatId(item?.chatId);
      const itemUsernameKey = telegramUsernameKey(item?.username);
      const sameChatId = chatId && itemChatId === chatId;
      const sameUsername = usernameKey && itemUsernameKey && itemUsernameKey === usernameKey;
      return !(sameChatId || (!itemChatId && sameUsername));
    }));
  };
  const removeKnownUserFromFullReport = (user) => {
    const chatId = normaliseTelegramChatId(user?.chatId);
    const usernameKey = telegramUsernameKey(user?.username);
    if(!chatId && !usernameKey) return;
    setFullReportRecipients(current => current.filter(item => {
      const itemChatId = normaliseTelegramChatId(item?.chatId);
      const itemUsernameKey = telegramUsernameKey(item?.username);
      const sameChatId = chatId && itemChatId === chatId;
      const sameUsername = usernameKey && itemUsernameKey && itemUsernameKey === usernameKey;
      return !(sameChatId || (!itemChatId && sameUsername));
    }));
  };

  const buildDraftPayload = () => {
    const cleanedRouteCandidates = recipients.map(item => {
      const resolved = resolveRecipientIdentity(item);
      return {
        ...resolved,
        institute:String(resolved?.institute || "").trim(),
        label:String(resolved?.label || "").trim(),
        username:normaliseTelegramUsername(resolved?.username),
        chatId:normaliseTelegramChatId(resolved?.chatId),
        notes:String(resolved?.notes || "").trim(),
      };
    });
    const promotedFullReportRecipients = cleanedRouteCandidates
      .filter(item => !item.institute && recipientHasAnyTelegramData(item))
      .map(item => ({
        id:item.id,
        destinationType:item.destinationType || "private",
        chatId:item.chatId,
        username:item.username,
        label:item.label,
        enabled:item.enabled !== false,
        notes:item.notes,
      }));
    const cleanedRecipients = cleanedRouteCandidates.filter(item => item.institute);
    const cleanedFullReportRecipients = mergeTelegramFullReportRecipientsForUi(
      fullReportRecipients.map(item => {
        const resolved = resolveRecipientIdentity(item);
        return {
          ...resolved,
          label:String(resolved?.label || "").trim(),
          username:normaliseTelegramUsername(resolved?.username),
          chatId:normaliseTelegramChatId(resolved?.chatId),
          notes:String(resolved?.notes || "").trim(),
        };
      }),
      promotedFullReportRecipients,
    ).map(item => ({
      ...item,
      label:String(item?.label || "").trim(),
      username:normaliseTelegramUsername(item?.username),
      chatId:normaliseTelegramChatId(item?.chatId),
      notes:String(item?.notes || "").trim(),
    }));
    const incompleteRoute = cleanedRecipients.find(item => {
      const touched = item.label || item.username || item.chatId || item.notes;
      if(!touched) return false;
      return !item.institute || !item.chatId;
    });
    if(incompleteRoute){
      setDraftError(incompleteRoute.username
        ? `Ask ${incompleteRoute.username} to start the bot, then refresh started users so Ledgr can resolve their chat ID.`
        : "Complete both institute and chat ID for each mapped Telegram user.");
      return null;
    }
    const incompleteFull = cleanedFullReportRecipients.find(item => {
      const touched = item.label || item.username || item.chatId || item.notes;
      if(!touched) return false;
      return !item.chatId;
    });
    if(incompleteFull){
      setDraftError(incompleteFull.username
        ? `Ask ${incompleteFull.username} to start the bot, then refresh started users so Ledgr can resolve their chat ID.`
        : "Complete the chat ID for each full-report Telegram user.");
      return null;
    }
    const invalidRouteChat = cleanedRecipients.find(item => item.chatId && !/^-?\d{5,}$/.test(item.chatId));
    if(invalidRouteChat){
      setDraftError(`Telegram chat ID for ${invalidRouteChat.institute || "the selected route"} looks invalid.`);
      return null;
    }
    const invalidFullChat = cleanedFullReportRecipients.find(item => item.chatId && !/^-?\d{5,}$/.test(item.chatId));
    if(invalidFullChat){
      setDraftError("A full-report Telegram chat ID looks invalid.");
      return null;
    }
    const invalidRouteUsername = cleanedRecipients.find(item => item.username && !/^@?[A-Za-z0-9_]{5,}$/.test(item.username));
    if(invalidRouteUsername){
      setDraftError(`Telegram username for ${invalidRouteUsername.institute || "the selected route"} looks invalid.`);
      return null;
    }
    const invalidFullUsername = cleanedFullReportRecipients.find(item => item.username && !/^@?[A-Za-z0-9_]{5,}$/.test(item.username));
    if(invalidFullUsername){
      setDraftError("A full-report Telegram username looks invalid.");
      return null;
    }
    const seenRoutes = new Set();
    for(const item of cleanedRecipients){
      if(!item.institute || !item.chatId) continue;
      const key = `${item.institute.toLowerCase()}__${item.chatId}`;
      if(seenRoutes.has(key)){
        setDraftError(`Duplicate Telegram user found for ${item.institute}.`);
        return null;
      }
      seenRoutes.add(key);
    }
    const seenFull = new Set();
    for(const item of cleanedFullReportRecipients){
      if(!item.chatId) continue;
      if(seenFull.has(item.chatId)){
        setDraftError("Duplicate full-report Telegram user found.");
        return null;
      }
      seenFull.add(item.chatId);
    }
    setDraftError("");
    return {
      enabled,
      botUsername: normaliseTelegramBotUsername(botUsername),
      delivery: {
        scheduledEnabled,
        onDemandEnabled,
      },
      recipients: cleanedRecipients.filter(item =>
        item.label || item.username || item.chatId || item.notes
      ),
      fullReportRecipients: cleanedFullReportRecipients.filter(item =>
        item.label || item.username || item.chatId || item.notes
      ),
    };
  };

  const save = async () => {
    const nextConfig = buildDraftPayload();
    if(!nextConfig) return null;
    try {
      await onSave(nextConfig);
      return nextConfig;
    } catch {
      return null;
    }
  };
  const saveAndSendAll = async () => {
    const nextConfig = await save();
    if(!nextConfig) return;
    await onSendNow(nextConfig, { mode:"all" });
  };
  const saveAndSendInstitute = async (instituteName) => {
    const nextConfig = await save();
    if(!nextConfig) return;
    await onSendNow(nextConfig, { mode:"institutes", institutes:[instituteName] });
  };
  const saveAndSendFullReport = async () => {
    const nextConfig = await save();
    if(!nextConfig) return;
    await onSendNow(nextConfig, { mode:"full_report" });
  };
  const openScheduleFor = (instituteName = "") => {
    if(typeof onOpenSchedule === "function"){
      onOpenSchedule(instituteName ? [instituteName] : []);
    }
  };

  const renderRecipientChip = (recipient) => {
    const resolvedRecipient = resolveRecipientIdentity(recipient);
    const chatId = normaliseTelegramChatId(resolvedRecipient?.chatId);
    const knownUser = knownUserMap.get(chatId);
    const displayName = getTelegramRecipientDisplayName({
      ...resolvedRecipient,
      username: resolvedRecipient?.username || knownUser?.username,
      label: resolvedRecipient?.label || knownUser?.label,
    });
    return (
      <span key={recipient.id} style={{display:"inline-flex",alignItems:"center",gap:6,borderRadius:999,padding:"6px 10px",background:"#EEF2FF",color:G.blue,fontSize:11.5,fontWeight:800,fontFamily:G.sans,whiteSpace:"nowrap"}}>
        <span>{displayName}</span>
        <span style={{fontSize:10,color:G.textL,fontFamily:G.mono}}>
          {chatId ? `...${chatId.slice(-4)}` : ""}
        </span>
      </span>
    );
  };

  const renderRowEditor = (row) => {
    const isFullReport = row.kind === "full_report";
    const rowRecipients = row.recipients || [];
    const resolvedRowRecipients = rowRecipients.map(resolveRecipientIdentity);
    const updateCurrentRecipient = isFullReport ? updateFullReportRecipient : updateRecipient;
    const removeCurrentRecipient = isFullReport ? removeFullReportRecipient : removeRecipient;
    const addManualRecipient = () => {
      if(isFullReport){
        addFullReportRecipient({ destinationType:"private" });
      } else {
        addRecipient(row.institute, { destinationType:"private" });
      }
    };
    const addKnownUser = (user) => {
      if(isFullReport){
        addKnownUserToFullReport(user);
      } else {
        addKnownUserToInstitute(row.institute, user);
      }
    };
    const removeKnownUser = (user) => {
      if(isFullReport){
        removeKnownUserFromFullReport(user);
      } else {
        removeKnownUserFromInstitute(row.institute, user);
      }
    };
    const mappedKnownUserChatIds = new Set(
      resolvedRowRecipients
        .filter(item => item?.destinationType === "private")
        .map(item => normaliseTelegramChatId(item?.chatId))
        .filter(chatId => !!chatId && knownUserMap.has(chatId))
    );
    const toggleKnownUser = (user) => {
      const chatId = normaliseTelegramChatId(user?.chatId);
      if(!chatId) return;
      if(mappedKnownUserChatIds.has(chatId)){
        removeKnownUser(user);
      } else {
        addKnownUser(user);
      }
    };
    const mappedKnownRecipients = resolvedRowRecipients.filter(item => {
      const chatId = normaliseTelegramChatId(item?.chatId);
      return item?.destinationType === "private" && !!chatId && knownUserMap.has(chatId);
    });
    const manualRecipients = resolvedRowRecipients.filter(item => {
      const chatId = normaliseTelegramChatId(item?.chatId);
      return !(item?.destinationType === "private" && !!chatId && knownUserMap.has(chatId));
    });
    return (
      <div style={{display:"grid",gap:14,padding:"16px 18px 18px",background:"#F8FAFC"}}>
        <div className="ledgr-telegram-editor-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,0.95fr) minmax(0,1.05fr)",gap:14}}>
          <div style={{border:`1px solid ${G.border}`,borderRadius:16,background:"#FFFFFF",padding:"13px 14px"}}>
            <div style={{...labelStyle,marginBottom:8}}>Started bot users</div>
            <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginBottom:10}}>
              Ask the user to start <strong style={{color:G.text}}>{normaliseTelegramBotUsername(botUsername) || "@ledgrapp_bot"}</strong>, then refresh here and tick their name.
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <button type="button" onClick={()=>{ void loadKnownUsers(); }} disabled={knownUsersBusy} style={actionButtonStyle(false, knownUsersBusy)}>
                <AppIcon icon={IconArrowDown} size={14} color={G.text} />
                {knownUsersBusy ? "Refreshing..." : "Refresh started users"}
              </button>
              {knownUsers.length > 0 && (
                <span style={{fontSize:11.5,color:G.textL,fontFamily:G.mono}}>{knownUsers.length} found</span>
              )}
            </div>
            {knownUsersError ? (
              <div style={{fontSize:12,color:"#991B1B",lineHeight:1.55}}>{knownUsersError}</div>
            ) : knownUsers.length ? (
              <div style={{display:"grid",gap:8}}>
                {knownUsers.map(user => {
                  const chatId = normaliseTelegramChatId(user?.chatId);
                  const isMapped = !!chatId && mappedKnownUserChatIds.has(chatId);
                  const displayName = getTelegramRecipientDisplayName(user);
                  const username = normaliseTelegramUsername(user?.username);
                  const label = String(user?.label || "").trim();
                  const metaParts = [];
                  if(label && label !== displayName) metaParts.push(label);
                  metaParts.push(username ? "Username available" : "No username needed");
                  if(chatId) metaParts.push(`...${chatId.slice(-4)}`);
                  return (
                    <label
                      key={`known_${user.chatId}`}
                      style={{
                        display:"grid",
                        gridTemplateColumns:"auto minmax(0,1fr) auto",
                        alignItems:"center",
                        gap:10,
                        padding:"11px 12px",
                        borderRadius:14,
                        border:`1px solid ${isMapped ? "#BFDBFE" : G.border}`,
                        background:isMapped ? "#EFF6FF" : "#FFFFFF",
                        cursor:actionBusy ? "not-allowed" : "pointer",
                      }}>
                      <input
                        type="checkbox"
                        checked={isMapped}
                        disabled={actionBusy}
                        onChange={()=>toggleKnownUser(user)}
                        style={{width:18,height:18,accentColor:G.blue}}
                      />
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:800,color:G.text,lineHeight:1.25,wordBreak:"break-word"}}>
                          {displayName}
                        </div>
                        <div style={{fontSize:12,color:G.textM,lineHeight:1.5,marginTop:3,wordBreak:"break-word"}}>
                          {metaParts.join(" · ")}
                        </div>
                      </div>
                      <span style={pillStyle(isMapped ? "#DCFCE7" : "#F3F4F6", isMapped ? "#166534" : G.textM)}>
                        {isMapped ? "Mapped" : "Select"}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div style={{fontSize:12,color:G.textM,lineHeight:1.55}}>
                No private users have been discovered yet. Once someone starts the bot, refresh this list.
              </div>
            )}
          </div>

          <div style={{border:`1px solid ${G.border}`,borderRadius:16,background:"#FFFFFF",padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={labelStyle}>{isFullReport ? "Mapped users" : "Selected for this institute"}</div>
              <span style={pillStyle(rowRecipients.length ? "#EEF2FF" : "#F3F4F6", rowRecipients.length ? G.blue : G.textM)}>
                {rowRecipients.length} selected
              </span>
            </div>
            <div style={{display:"grid",gap:10}}>
              {resolvedRowRecipients.length ? resolvedRowRecipients.map(recipient => {
                const resolvedChatId = normaliseTelegramChatId(recipient?.chatId);
                const matchedKnownUser = knownUserMap.get(resolvedChatId) || recipient?.matchedUser || null;
                const displayName = getTelegramRecipientDisplayName({
                  ...recipient,
                  username: recipient?.username || matchedKnownUser?.username,
                  label: recipient?.label || matchedKnownUser?.label,
                });
                const isKnownRecipient = recipient?.destinationType === "private" && !!matchedKnownUser;
                return (
                  <div key={recipient.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:10,alignItems:"center",padding:"11px 12px",borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:G.text,lineHeight:1.25,wordBreak:"break-word"}}>
                        {displayName}
                      </div>
                      <div style={{fontSize:12,color:G.textM,lineHeight:1.5,marginTop:3,wordBreak:"break-word"}}>
                        {[
                          isKnownRecipient ? "Started bot user" : "Manual destination",
                          recipient?.destinationType === "channel"
                            ? "Channel"
                            : recipient?.destinationType === "group"
                              ? "Group"
                              : "Private",
                          resolvedChatId ? `...${resolvedChatId.slice(-4)}` : "Needs chat ID",
                        ].join(" · ")}
                      </div>
                    </div>
                    <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:800,color:recipient.enabled !== false ? G.blue : G.textM,fontFamily:G.sans,cursor:actionBusy ? "not-allowed" : "pointer"}}>
                      <input
                        type="checkbox"
                        checked={recipient.enabled !== false}
                        disabled={actionBusy}
                        onChange={event=>updateCurrentRecipient(recipient.id,{ enabled:event.target.checked })}
                        style={{width:16,height:16,accentColor:G.blue}}
                      />
                      Active
                    </label>
                    <button type="button" onClick={()=>removeCurrentRecipient(recipient.id)} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                      <AppIcon icon={IconTrash} size={14} color="#DC2626" />
                    </button>
                  </div>
                );
              }) : (
                <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55}}>
                  Tick one or more started users on the left to map them here.
                </div>
              )}
            </div>

            <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${G.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
                <div>
                  <div style={labelStyle}>Other destinations</div>
                  <div style={{fontSize:12,color:G.textM,lineHeight:1.5,marginTop:4}}>
                    Use this only for channels, groups, or a raw chat ID.
                  </div>
                </div>
                <button type="button" onClick={addManualRecipient} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                  <AppIcon icon={IconPlus} size={14} color={G.blue} />
                  Add manual
                </button>
              </div>
              {manualRecipients.length ? (
                <div style={{display:"grid",gap:10}}>
                  {manualRecipients.map(recipient => {
                    const resolvedRecipient = resolveRecipientIdentity(recipient);
                    const resolvedChatId = normaliseTelegramChatId(resolvedRecipient?.chatId);
                    const matchedUser = resolvedRecipient?.matchedUser;
                    return (
                      <div key={recipient.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) 130px auto auto",gap:8,alignItems:"center"}}>
                        <input
                          value={recipient.username || ""}
                          onChange={event=>updateCurrentRecipient(recipient.id,{ username:event.target.value, label:String(recipient.label || "").trim() || event.target.value })}
                          disabled={actionBusy}
                          placeholder="@username"
                          style={inputStyle}
                        />
                        <div style={{display:"grid",gap:6}}>
                          <input
                            value={recipient.chatId || resolvedChatId || ""}
                            onChange={event=>updateCurrentRecipient(recipient.id,{ chatId:event.target.value })}
                            disabled={actionBusy}
                            placeholder="Chat ID"
                            style={inputStyle}
                          />
                          <div style={{fontSize:11.5,color:resolvedChatId ? "#166534" : G.textL,lineHeight:1.45}}>
                            {matchedUser
                              ? `Resolved from ${getTelegramRecipientDisplayName(matchedUser)}`
                              : resolvedChatId
                                ? "Chat ID ready"
                                : "Add the chat ID directly."}
                          </div>
                        </div>
                        <select
                          value={recipient.destinationType || "private"}
                          onChange={event=>updateCurrentRecipient(recipient.id,{ destinationType:event.target.value })}
                          disabled={actionBusy}
                          style={inputStyle}>
                          <option value="private">Private</option>
                          <option value="channel">Channel</option>
                          <option value="group">Group</option>
                        </select>
                        <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:800,color:recipient.enabled !== false ? G.blue : G.textM,fontFamily:G.sans,cursor:actionBusy ? "not-allowed" : "pointer"}}>
                          <input
                            type="checkbox"
                            checked={recipient.enabled !== false}
                            disabled={actionBusy}
                            onChange={event=>updateCurrentRecipient(recipient.id,{ enabled:event.target.checked })}
                            style={{width:16,height:16,accentColor:G.blue}}
                          />
                          Active
                        </label>
                        <button type="button" onClick={()=>removeCurrentRecipient(recipient.id)} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                          <AppIcon icon={IconTrash} size={14} color="#DC2626" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55}}>
                  No manual destinations added. Most teams can leave this empty and just tick started users.
                </div>
              )}
              {!!mappedKnownRecipients.length && (
                <div style={{fontSize:11.5,color:G.textL,lineHeight:1.5,marginTop:10}}>
                  Known users can be removed anytime by unticking them on the left.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={embedded
      ? {width:"100%"}
      : {position:"fixed",inset:0,background:"rgba(15,23,42,0.62)",zIndex:10020,display:"flex",alignItems:"stretch",justifyContent:"stretch",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <style>{`
        @media (max-width: 1180px) {
          .ledgr-telegram-header,
          .ledgr-telegram-footer-inner,
          .ledgr-telegram-settings-row,
          .ledgr-telegram-editor-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 760px) {
          .ledgr-telegram-row-actions {
            flex-wrap: wrap;
          }
        }
      `}</style>
      <div style={embedded
        ? {width:"100%",background:"transparent",display:"flex",flexDirection:"column"}
        : {width:"100vw",height:"100dvh",background:"#F8FAFC",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={embedded ? {padding:0} : {padding:"24px 24px 12px",overflowY:"auto",flex:1}}>
          <div style={{maxWidth:1500,margin:"0 auto",display:"grid",gap:16}}>
            <div style={{...shellCardStyle,padding:"18px 20px 20px"}}>
              <div className="ledgr-telegram-header" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:14,alignItems:"start"}}>
                <div style={{display:"flex",gap:14,minWidth:0}}>
                  <div style={{width:56,height:56,borderRadius:18,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <AppIcon icon={IconSend} size={26} color={G.blue} />
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Messenger feature</div>
                    <div style={{fontSize:28,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.04,marginTop:6}}>Messenger delivery</div>
                    <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:8,maxWidth:760}}>
                      Map each institute to one or more Telegram users, send the exact Ledgr PDF, and keep one daily batch ready at 8 PM.
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,flexWrap:"wrap"}}>
                  <span style={pillStyle(headerStatus.bg, headerStatus.color)}>{headerStatus.label}</span>
                  {!embedded && (
                    <button type="button" onClick={onClose} disabled={!!saving} style={actionButtonStyle(false, !!saving)}>
                      <AppIcon icon={IconX} size={14} color={G.text} />
                      Close
                    </button>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>
                <span style={pillStyle("#EEF2FF", G.blue)}>{activeRecipients.length} mapped send{activeRecipients.length === 1 ? "" : "s"}</span>
                <span style={pillStyle("#F1F5F9", G.textM)}>{missingCoverageCount} institute{missingCoverageCount === 1 ? "" : "s"} still missing</span>
                <span style={pillStyle(scheduleSaved ? "#DCFCE7" : "#FEF3C7", scheduleSaved ? "#166534" : "#B45309")}>
                  {scheduledEnabled ? "Daily 8 PM batch" : "Schedule off"}
                </span>
              </div>
            </div>

            <div style={{...shellCardStyle,overflow:"hidden"}}>
              <div style={{padding:"18px 20px 16px",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div>
                  <div style={labelStyle}>Routing</div>
                  <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.08,marginTop:6}}>Telegram recipients</div>
                  <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:6}}>
                    One row per institute. Map one or more users, send the exact centre PDF, and keep the daily batch ready.
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{height:40,padding:"0 14px",borderRadius:999,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:13,fontWeight:800,fontFamily:G.sans,display:"inline-flex",alignItems:"center",gap:7}}>
                    Bot {normaliseTelegramBotUsername(botUsername) || "@ledgrapp_bot"}
                  </span>
                  <button type="button" onClick={()=>{ void loadKnownUsers(); }} disabled={knownUsersBusy} style={actionButtonStyle(false, knownUsersBusy)}>
                    <AppIcon icon={IconArrowDown} size={14} color={G.blue} />
                    {knownUsersBusy ? "Refreshing..." : "Refresh users"}
                  </button>
                  <button type="button" onClick={()=>openScheduleFor("")} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                    <AppIcon icon={IconClock} size={14} color={G.text} />
                    Batch schedule
                  </button>
                </div>
              </div>

              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:1120}}>
                  <thead>
                    <tr style={{background:"#F8FAFC"}}>
                      {["Institute", "Telegram users", "Status", "Batch", "Actions"].map(label => (
                        <th key={label} style={{textAlign:"left",padding:"14px 18px",fontSize:11,fontWeight:800,color:G.textL,textTransform:"uppercase",letterSpacing:0.8,fontFamily:G.mono,borderBottom:"1px solid #E2E8F0"}}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {instituteRows.map(row => {
                      const rowExpanded = expandedRow === row.institute;
                      const rowReady = row.activeRecipients.length > 0;
                      const rowSendDisabled = actionBusy
                        || !!sendBusy
                        || !enabled
                        || !onDemandEnabled
                        || routeIssue
                        || tokenMissingOnServer
                        || !manualRouteReady
                        || !rowReady;
                      return (
                        <React.Fragment key={row.institute}>
                          <tr>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                                <span style={{width:10,height:10,borderRadius:"50%",background:rowReady ? "#16A34A" : "#D97706",marginTop:5,flexShrink:0}} />
                                <div style={{minWidth:0}}>
                                  <div style={{fontSize:16,fontWeight:800,color:G.text,lineHeight:1.3}}>{row.institute}</div>
                                  <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:5}}>
                                    {row.activeRecipients.length
                                      ? `${row.activeRecipients.length} active Telegram user${row.activeRecipients.length === 1 ? "" : "s"}`
                                      : "Waiting for first Telegram user"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              {row.recipients.length ? (
                                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                  {row.recipients.filter(item => normaliseTelegramChatId(item?.chatId)).map(renderRecipientChip)}
                                </div>
                              ) : (
                                <span style={{fontSize:13,color:G.textM}}>Connect one or more users</span>
                              )}
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <span style={pillStyle(rowReady ? "#DCFCE7" : "#F3F4F6", rowReady ? "#166534" : G.textM)}>
                                {rowReady ? "Ready to send" : "Needs users"}
                              </span>
                              <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:8}}>
                                {rowReady ? "Exact centre PDF" : "Add a bot-started Telegram user"}
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <span style={pillStyle(scheduleSaved && rowReady ? "#DCFCE7" : "#FEF3C7", scheduleSaved && rowReady ? "#166534" : "#B45309")}>
                                {scheduleSaved && rowReady ? "Daily, 8 PM" : "Manual only"}
                              </span>
                              <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:8}}>
                                {scheduledEnabled ? "Global batch setting" : "Batch paused"}
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <div className="ledgr-telegram-row-actions" style={{display:"flex",gap:8}}>
                                <button type="button" onClick={()=>{ void saveAndSendInstitute(row.institute); }} disabled={rowSendDisabled} style={actionButtonStyle(true, rowSendDisabled)}>
                                  <AppIcon icon={IconSend} size={14} color="#FFFFFF" />
                                  Send
                                </button>
                                <button type="button" onClick={()=>setExpandedRow(current => current === row.institute ? "" : row.institute)} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                                  <AppIcon icon={rowExpanded ? IconArrowUp : IconChevronRight} size={14} color={G.blue} />
                                  {rowExpanded ? "Done" : row.recipients.length ? "Edit" : "Connect"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rowExpanded && (
                            <tr>
                              <td colSpan={5} style={{padding:0,borderBottom:"1px solid #E2E8F0"}}>
                                {renderRowEditor({ ...row, kind:"route" })}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {(() => {
                      const fullRowExpanded = expandedRow === "__full_report__";
                      const fullSendDisabled = actionBusy
                        || !!sendBusy
                        || !enabled
                        || !onDemandEnabled
                        || routeIssue
                        || tokenMissingOnServer
                        || !manualRouteReady
                        || !activeFullReportRecipients.length;
                      return (
                        <React.Fragment key="__full_report__">
                          <tr style={{background:"#FCFDFF"}}>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <div style={{fontSize:16,fontWeight:800,color:G.text,lineHeight:1.3}}>Complete Ledgr report</div>
                              <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:5}}>
                                Sends the full daily report PDF, not centre-wise PDFs.
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              {fullReportRecipients.length ? (
                                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                  {fullReportRecipients.filter(item => normaliseTelegramChatId(item?.chatId)).map(renderRecipientChip)}
                                </div>
                              ) : (
                                <span style={{fontSize:13,color:G.textM}}>No users mapped</span>
                              )}
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <span style={pillStyle(activeFullReportRecipients.length ? "#DCFCE7" : "#F3F4F6", activeFullReportRecipients.length ? "#166534" : G.textM)}>
                                {activeFullReportRecipients.length ? "Ready to send" : "Needs users"}
                              </span>
                              <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:8}}>
                                One whole-report PDF per mapped Telegram user.
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <span style={pillStyle(scheduleSaved && activeFullReportRecipients.length ? "#DCFCE7" : "#FEF3C7", scheduleSaved && activeFullReportRecipients.length ? "#166534" : "#B45309")}>
                                {scheduleSaved && activeFullReportRecipients.length ? "Daily, 8 PM" : "Manual only"}
                              </span>
                              <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:8}}>
                                {scheduledEnabled ? "Global batch setting" : "Batch paused"}
                              </div>
                            </td>
                            <td style={{padding:"16px 18px",borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                              <div className="ledgr-telegram-row-actions" style={{display:"flex",gap:8}}>
                                <button type="button" onClick={()=>{ void saveAndSendFullReport(); }} disabled={fullSendDisabled} style={actionButtonStyle(true, fullSendDisabled)}>
                                  <AppIcon icon={IconSend} size={14} color="#FFFFFF" />
                                  Send
                                </button>
                                <button type="button" onClick={()=>setExpandedRow(current => current === "__full_report__" ? "" : "__full_report__")} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                                  <AppIcon icon={fullRowExpanded ? IconArrowUp : IconChevronRight} size={14} color={G.blue} />
                                  {fullRowExpanded ? "Done" : fullReportRecipients.length ? "Edit" : "Connect"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {fullRowExpanded && (
                            <tr>
                              <td colSpan={5} style={{padding:0}}>
                                {renderRowEditor({ kind:"full_report", recipients:fullReportRecipients })}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{...shellCardStyle,padding:"16px 20px 18px"}}>
              <div className="ledgr-telegram-settings-row" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",gap:14,alignItems:"start"}}>
                <div>
                  <div style={labelStyle}>Bot username</div>
                  <input value={botUsername} onChange={event=>setBotUsername(event.target.value)} disabled={actionBusy} placeholder="@ledgrapp_bot" style={inputStyle} />
                  <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:8}}>
                    The bot token stays on the server. This screen only stores routing.
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Delivery switches</div>
                  <div style={{display:"grid",gap:8}}>
                    {[
                      { key:"enabled", label:"Delivery active", value:enabled, onChange:setEnabled },
                      { key:"scheduled", label:"Use daily 8 PM batch", value:scheduledEnabled, onChange:setScheduledEnabled },
                      { key:"manual", label:"Allow send now", value:onDemandEnabled, onChange:setOnDemandEnabled },
                    ].map(item => (
                      <label key={item.key} style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:13,fontWeight:800,color:item.value ? G.blue : G.textM,fontFamily:G.sans,cursor:actionBusy ? "not-allowed" : "pointer"}}>
                        <input type="checkbox" checked={item.value} disabled={actionBusy} onChange={event=>item.onChange(event.target.checked)} style={{width:17,height:17,accentColor:G.blue}} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Status</div>
                  <div style={{display:"grid",gap:8}}>
                    <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55}}>
                      {routeIssue
                        ? deliveryProbe.error
                        : tokenMissingOnServer
                          ? "TELEGRAM_BOT_TOKEN is still missing on the deployed server."
                          : manualRouteReady
                            ? "Manual send route is live."
                            : "Messenger delivery route has not been verified yet."}
                    </div>
                    <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55}}>
                      {scheduleSaved
                        ? backgroundRunnerReady
                          ? "Daily batch is saved and has reported a background run."
                          : "Daily batch is saved, but no runner activity has been recorded yet."
                        : "No daily batch is saved yet."}
                    </div>
                    <button type="button" onClick={()=>openScheduleFor("")} disabled={actionBusy} style={actionButtonStyle(false, actionBusy)}>
                      <AppIcon icon={IconClock} size={14} color={G.text} />
                      Open report schedule
                    </button>
                    {(lastErrorMessage || lastSuccessAt || lastAttemptAt) && (
                      <div style={{fontSize:12,color:lastErrorMessage ? "#991B1B" : G.textM,lineHeight:1.55}}>
                        {lastErrorMessage
                          ? lastErrorMessage
                          : lastSuccessAt
                            ? `Last success: ${new Date(lastSuccessAt).toLocaleString("en-IN")}`
                            : `Last attempt: ${new Date(lastAttemptAt).toLocaleString("en-IN")}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={embedded
          ? {padding:"14px 0 0"}
          : {padding:"14px 24px 22px",borderTop:"1px solid #E5E7EB",background:"#FFFFFF"}}>
          <div className="ledgr-telegram-footer-inner" style={{maxWidth:1500,margin:"0 auto",display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,alignItems:"center"}}>
            <div>
              {draftError ? (
                <div style={{fontSize:12.5,color:"#991B1B",fontWeight:700,lineHeight:1.5}}>{draftError}</div>
              ) : (
                <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55}}>
                  {loading
                    ? "Loading messenger dashboard..."
                    : `${activeRecipients.length} institute send${activeRecipients.length === 1 ? "" : "s"} and ${activeFullReportRecipients.length} full-report send${activeFullReportRecipients.length === 1 ? "" : "s"} are ready.`}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
              {!embedded && (
                <button type="button" onClick={onClose} disabled={!!saving} style={actionButtonStyle(false, !!saving)}>
                  Cancel
                </button>
              )}
              <button type="button" onClick={()=>{ void saveAndSendAll(); }} disabled={sendAllDisabled} style={{...actionButtonStyle(true, sendAllDisabled),height:44,padding:"0 16px"}}>
                <AppIcon icon={IconSend} size={15} color="#FFFFFF" />
                {sendBusy ? "Sending..." : "Send all active"}
              </button>
              <button type="button" onClick={()=>{ void save(); }} disabled={actionBusy} style={{...actionButtonStyle(true, actionBusy),height:44,padding:"0 16px",background:actionBusy ? "#CBD5E1" : G.navy}}>
                {saving ? "Saving..." : "Save messenger dashboard"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgrTelegramDashboardModalLegacy({
  institutes,
  schedule,
  config,
  loading,
  saving,
  sendBusy,
  onClose,
  onSave,
  onOpenSchedule,
  onSendNow,
  embedded = false,
}) {
  const [enabled, setEnabled] = React.useState(true);
  const [botUsername, setBotUsername] = React.useState("@ledgrapp_bot");
  const [scheduledEnabled, setScheduledEnabled] = React.useState(true);
  const [onDemandEnabled, setOnDemandEnabled] = React.useState(true);
  const [recipients, setRecipients] = React.useState([]);
  const [draftError, setDraftError] = React.useState("");
  const [deliveryProbe, setDeliveryProbe] = React.useState({
    checking: true,
    routeReachable: false,
    manualReady: false,
    scheduledReady: false,
    tokenPresent: null,
    error: "",
  });

  React.useEffect(() => {
    if(embedded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [embedded]);

  React.useEffect(() => {
    const draft = buildTelegramDashboardDraft(config);
    setEnabled(draft.enabled);
    setBotUsername(draft.botUsername);
    setScheduledEnabled(draft.scheduledEnabled);
    setOnDemandEnabled(draft.onDemandEnabled);
    setRecipients(draft.recipients);
    setDraftError("");
  }, [config?.updatedAt, config?.schemaVersion, institutes.length]);

  React.useEffect(() => {
    let cancelled = false;
    async function probeMessengerDelivery() {
      setDeliveryProbe({
        checking: true,
        routeReachable: false,
        manualReady: false,
        scheduledReady: false,
        tokenPresent: null,
        error: "",
      });
      try {
        const currentUser = auth.currentUser;
        if(!currentUser){
          throw new Error("Sign in again to verify messenger delivery.");
        }
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/send-ledgr-telegram", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if(!contentType.includes("application/json")){
          throw new Error("This deployment is not serving `/api/send-ledgr-telegram` as an API route.");
        }
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if(cancelled) return;
        if(!response.ok){
          setDeliveryProbe({
            checking: false,
            routeReachable: true,
            manualReady: false,
            scheduledReady: false,
            tokenPresent: false,
            error: payload?.error || "Could not verify messenger delivery.",
          });
          return;
        }
        const health = payload?.health || {};
        setDeliveryProbe({
          checking: false,
          routeReachable: true,
          manualReady: !!health?.manualEndpointReady,
          scheduledReady: !!health?.scheduledEndpointReady,
          tokenPresent: health?.tokenPresent !== false,
          error: payload?.warning || "",
        });
      } catch (error) {
        if(cancelled) return;
        setDeliveryProbe({
          checking: false,
          routeReachable: false,
          manualReady: false,
          scheduledReady: false,
          tokenPresent: null,
          error: error?.message || "Could not reach the messenger delivery route.",
        });
      }
    }
    probeMessengerDelivery();
    return () => {
      cancelled = true;
    };
  }, []);

  const actionBusy = !!loading || !!saving;
  const recipientOptions = React.useMemo(() => {
    const ordered = [];
    const pushInstitute = (value) => {
      const clean = String(value || "").trim();
      if(!clean) return;
      if(ordered.some(item => sameInstituteName(item, clean))) return;
      ordered.push(clean);
    };
    (institutes || []).forEach(pushInstitute);
    recipients.forEach(item => pushInstitute(item.institute));
    return ordered;
  }, [institutes, recipients]);

  const configuredRecipients = recipients.filter(item => item.institute && normaliseTelegramChatId(item.chatId));
  const activeRecipients = configuredRecipients.filter(item => item.enabled);
  const manualRouteReady = deliveryProbe.routeReachable
    ? deliveryProbe.manualReady
    : !!config?.health?.manualEndpointReady;
  const scheduleRouteReady = deliveryProbe.routeReachable
    ? deliveryProbe.scheduledReady
    : !!config?.health?.scheduledEndpointReady;
  const routeIssue = !deliveryProbe.checking && !deliveryProbe.routeReachable && !!deliveryProbe.error;
  const tokenMissingOnServer = deliveryProbe.routeReachable && deliveryProbe.tokenPresent === false;
  const backgroundRunnerReady = !!(scheduleRouteReady || schedule?.execution?.lastRunAt || schedule?.lastRunAt);
  const sendNowDisabled = actionBusy
    || !!sendBusy
    || !!deliveryProbe.checking
    || !enabled
    || !onDemandEnabled
    || routeIssue
    || tokenMissingOnServer
    || !manualRouteReady
    || activeRecipients.length === 0;
  const coveredInstitutes = activeRecipients.reduce((acc, item) => {
    if(!acc.some(existing => sameInstituteName(existing, item.institute))) acc.push(item.institute);
    return acc;
  }, []);
  const lastSuccessAt = Number(config?.execution?.lastSuccessAt || 0);
  const lastAttemptAt = Number(config?.execution?.lastAttemptAt || 0);
  const lastErrorMessage = String(config?.execution?.lastErrorMessage || config?.execution?.lastError || "").trim();
  const scheduleTimes = Array.isArray(schedule?.times) ? schedule.times.filter(Boolean) : [];
  const backendStatus = deliveryProbe.checking
    ? { label:"Checking", background:"#DBEAFE", color:G.blue }
    : routeIssue
      ? { label:"Route issue", background:"#FEE2E2", color:"#B91C1C" }
      : tokenMissingOnServer
        ? { label:"Token missing", background:"#FEF3C7", color:"#B45309" }
        : manualRouteReady && backgroundRunnerReady
          ? { label:"Ready", background:"#DCFCE7", color:"#166534" }
          : manualRouteReady
            ? { label:"Manual live", background:"#DBEAFE", color:G.blue }
            : { label:"Pending", background:"#F3F4F6", color:G.textM };
  const endpointMessage = deliveryProbe.checking
    ? "Checking the deployed messenger delivery route now."
    : routeIssue
      ? `${deliveryProbe.error} This usually means the deployed app is not exposing the serverless API route.`
      : tokenMissingOnServer
        ? "The manual route is reachable, but TELEGRAM_BOT_TOKEN is missing on the deployed server."
        : manualRouteReady && backgroundRunnerReady
          ? "Manual send and background automation are both reporting readiness."
        : manualRouteReady
            ? "Manual send route is live. Scheduled automation still needs a background runner deployment."
            : "The messenger delivery route has not been verified yet.";

  const sectionCardStyle = {
    border:"1px solid #E2E8F0",
    borderRadius:22,
    background:"#FFFFFF",
    padding:"18px 18px 19px",
    boxShadow:"0 10px 26px rgba(15,23,42,0.06)",
  };
  const labelStyle = {
    fontSize:11,
    fontWeight:800,
    color:G.textL,
    textTransform:"uppercase",
    letterSpacing:0.9,
    fontFamily:G.mono,
    marginBottom:8,
  };
  const inputStyle = {
    width:"100%",
    height:44,
    borderRadius:12,
    border:"1px solid #DDE3ED",
    background:"#FFFFFF",
    color:G.text,
    fontSize:14,
    fontWeight:700,
    fontFamily:G.sans,
    padding:"0 12px",
    boxSizing:"border-box",
    outline:"none",
  };
  const secondaryButtonStyle = {
    height:42,
    padding:"0 14px",
    borderRadius:12,
    border:`1px solid ${G.border}`,
    background:"#FFFFFF",
    color:G.text,
    fontSize:12.5,
    fontWeight:800,
    fontFamily:G.sans,
    cursor:actionBusy ? "not-allowed" : "pointer",
    display:"inline-flex",
    alignItems:"center",
    gap:7,
  };
  const primaryButtonStyle = {
    height:46,
    padding:"0 16px",
    borderRadius:14,
    border:"none",
    background:G.navy,
    color:"#FFFFFF",
    fontSize:14,
    fontWeight:900,
    fontFamily:G.sans,
    cursor:actionBusy ? "not-allowed" : "pointer",
    display:"inline-flex",
    alignItems:"center",
    gap:8,
  };

  const updateRecipient = (id, patch) => {
    setRecipients(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addRecipient = (instituteName = "") => {
    setRecipients(current => [...current, buildTelegramRecipientDraft(instituteName)]);
  };

  const addMissingInstitutes = () => {
    const missing = (institutes || []).filter(inst => !recipients.some(item => sameInstituteName(item.institute, inst)));
    if(!missing.length) return;
    setRecipients(current => [...current, ...missing.map(inst => buildTelegramRecipientDraft(inst))]);
  };

  const removeRecipient = (id) => {
    setRecipients(current => current.filter(item => item.id !== id));
  };

  const buildDraftPayload = () => {
    const cleanedRecipients = recipients.map(item => ({
      ...item,
      institute:String(item.institute || "").trim(),
      label:String(item.label || "").trim(),
      chatId:normaliseTelegramChatId(item.chatId),
      notes:String(item.notes || "").trim(),
    }));
    const incomplete = cleanedRecipients.find(item => {
      const touched = item.institute || item.label || item.chatId || item.notes;
      if(!touched) return false;
      return !item.institute || !item.chatId;
    });
    if(incomplete){
      setDraftError("Complete both institute and chat id for every Telegram destination before saving.");
      return;
    }
    const invalidChat = cleanedRecipients.find(item => item.chatId && !/^-?\d{5,}$/.test(item.chatId));
    if(invalidChat){
      setDraftError(`Telegram chat id for ${invalidChat.institute || "the selected route"} looks invalid.`);
      return;
    }
    const seen = new Set();
    for(const item of cleanedRecipients){
      if(!item.institute || !item.chatId) continue;
      const key = `${item.institute.toLowerCase()}__${item.chatId}`;
      if(seen.has(key)){
        setDraftError(`Duplicate Telegram route found for ${item.institute}.`);
        return;
      }
      seen.add(key);
    }
    setDraftError("");
    return {
      enabled,
      botUsername: normaliseTelegramBotUsername(botUsername),
      delivery: {
        scheduledEnabled,
        onDemandEnabled,
      },
      recipients: cleanedRecipients.filter(item =>
        item.institute || item.label || item.chatId || item.notes
      ),
    };
  };

  const save = async () => {
    const nextConfig = buildDraftPayload();
    if(!nextConfig) return null;
    try {
      await onSave(nextConfig);
      return nextConfig;
    } catch {
      return null;
    }
  };

  const saveAndSendNow = async () => {
    const nextConfig = await save();
    if(!nextConfig) return;
    await onSendNow(nextConfig);
  };

  const saveAndSendSingle = async (recipientId) => {
    const nextConfig = await save();
    if(!nextConfig) return;
    await onSendNow({
      ...nextConfig,
      recipients: (nextConfig.recipients || []).map(item => ({
        ...item,
        enabled: item.id === recipientId,
      })),
    });
  };

  const routeCount = configuredRecipients.length;
  const missingInstitutes = (institutes || []).filter(inst =>
    !recipients.some(item => sameInstituteName(item.institute, inst))
  );
  const missingCoverageCount = Math.max((institutes || []).length - coveredInstitutes.length, 0);
  const manualSendReady = !deliveryProbe.checking && !routeIssue && !tokenMissingOnServer && manualRouteReady;
  const scheduleSaved = !!schedule?.enabled && scheduleTimes.length > 0;
  const missingInstituteCount = missingInstitutes.length;
  const scheduleSummary = !scheduledEnabled
    ? "Schedule off"
    : "Daily 8 PM batch";
  const headerStatus = deliveryProbe.checking
    ? { label:"Checking route", background:"#DBEAFE", color:G.blue }
    : routeIssue
      ? { label:"Route issue", background:"#FEE2E2", color:"#B91C1C" }
      : tokenMissingOnServer
        ? { label:"Token missing", background:"#FEF3C7", color:"#B45309" }
        : manualSendReady
          ? { label:"Manual send ready", background:"#DCFCE7", color:"#166534" }
          : { label:"Needs setup", background:"#F3F4F6", color:G.textM };
  const tableHeaderStyle = {
    textAlign:"left",
    padding:"13px 14px",
    fontSize:11,
    fontWeight:800,
    color:G.textL,
    textTransform:"uppercase",
    letterSpacing:0.8,
    fontFamily:G.mono,
    borderBottom:"1px solid #E2E8F0",
    background:"#F8FAFC",
    whiteSpace:"nowrap",
  };
  const tableCellStyle = {
    padding:"14px",
    borderBottom:"1px solid #E2E8F0",
    verticalAlign:"top",
    background:"#FFFFFF",
  };
  const compactInputStyle = {
    ...inputStyle,
    height:40,
    fontSize:13.5,
    fontWeight:700,
    borderRadius:10,
  };
  const compactSecondaryButton = (disabled = false) => ({
    ...secondaryButtonStyle,
    height:36,
    padding:"0 12px",
    borderRadius:10,
    fontSize:12.5,
    opacity:disabled ? 0.55 : 1,
    cursor:disabled ? "not-allowed" : "pointer",
  });
  const compactPrimaryButton = (disabled = false) => ({
    ...primaryButtonStyle,
    height:36,
    padding:"0 12px",
    borderRadius:10,
    fontSize:12.5,
    opacity:disabled ? 0.55 : 1,
    cursor:disabled ? "not-allowed" : "pointer",
  });
  const summaryPillStyle = (background, color) => ({
    display:"inline-flex",
    alignItems:"center",
    gap:6,
    borderRadius:999,
    padding:"7px 11px",
    background,
    color,
    fontSize:12,
    fontWeight:800,
    fontFamily:G.sans,
    whiteSpace:"nowrap",
  });

  return (
    <div style={embedded
      ? {width:"100%"}
      : {position:"fixed",inset:0,background:"rgba(15,23,42,0.64)",zIndex:10020,display:"flex",alignItems:"stretch",justifyContent:"stretch",padding:0,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <style>{`
        @media (max-width: 1120px) {
          .ledgr-telegram-settings-grid {
            grid-template-columns: 1fr !important;
          }
          .ledgr-telegram-topbar {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .ledgr-telegram-toolbar {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
        @media (max-width: 640px) {
          .ledgr-telegram-scroll {
            padding: 20px 16px 10px !important;
          }
          .ledgr-telegram-footer {
            padding: 12px 16px max(14px, env(safe-area-inset-bottom, 0px)) !important;
            flex-direction: column !important;
          }
          .ledgr-telegram-footer-actions {
            width: 100% !important;
            flex-direction: column !important;
          }
        }
      `}</style>
      <div className="ledgr-telegram-modal" style={embedded
        ? {width:"100%",background:"transparent",borderRadius:0,boxShadow:"none",display:"flex",flexDirection:"column",overflow:"visible"}
        : {width:"100vw",height:"100dvh",maxWidth:"100vw",background:"#F8FAFC",borderRadius:0,boxShadow:"none",maxHeight:"100dvh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div className="ledgr-telegram-scroll" style={embedded
          ? {overflow:"visible",minHeight:0,flex:1,padding:0}
          : {overflowY:"auto",minHeight:0,flex:1,padding:"24px 24px 14px"}}>
          <div style={{width:"100%",maxWidth:1480,margin:"0 auto"}}>
            <div className="ledgr-telegram-topbar" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:16}}>
              <div style={{display:"flex",gap:14,minWidth:0,flex:1}}>
                <div style={{width:56,height:56,borderRadius:18,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <AppIcon icon={IconSend} size={26} color={G.blue} />
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,letterSpacing:1.1,textTransform:"uppercase"}}>Messenger feature</div>
                  <div style={{fontSize:28,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.04,marginTop:6}}>Messenger delivery</div>
                  <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:8,maxWidth:760}}>
                    Keep this simple: one row per institute, one place to send the exact Ledgr report, and one place to open the schedule.
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{background:headerStatus.background,color:headerStatus.color,borderRadius:999,padding:"10px 14px",fontSize:12,fontWeight:800,fontFamily:G.sans}}>
                  {headerStatus.label}
                </span>
                {!embedded&&(
                  <button type="button" onClick={onClose} disabled={!!saving} style={{height:42,padding:"0 14px",borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:13,fontWeight:800,fontFamily:G.sans,cursor:saving?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:7}}>
                    <AppIcon icon={IconX} size={16} color={G.text} />
                    Close
                  </button>
                )}
              </div>
            </div>

            <div style={{...sectionCardStyle,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={summaryPillStyle("#EEF2FF", G.blue)}>{routeCount} saved route{routeCount === 1 ? "" : "s"}</span>
                  <span style={summaryPillStyle("#F1F5F9", G.textM)}>{missingCoverageCount} institute{missingCoverageCount === 1 ? "" : "s"} still missing</span>
                  <span style={summaryPillStyle(scheduleSaved ? "#DCFCE7" : "#FEF3C7", scheduleSaved ? "#166534" : "#B45309")}>{scheduleSummary}</span>
                </div>
                <div style={{fontSize:12.5,color:lastErrorMessage ? "#991B1B" : G.textM,lineHeight:1.55}}>
                  {lastErrorMessage
                    ? lastErrorMessage
                    : lastSuccessAt
                      ? `Last delivery: ${new Date(lastSuccessAt).toLocaleString("en-IN")}`
                      : endpointMessage}
                </div>
              </div>
            </div>

            <div style={{...sectionCardStyle,marginBottom:14}}>
              <div className="ledgr-telegram-toolbar" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
                <div>
                  <div style={labelStyle}>Routing</div>
                  <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.08}}>Telegram routes</div>
                  <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:8,maxWidth:760}}>
                    The table is the whole workflow: set the channel details, send the exact Ledgr PDF, or jump to the schedule.
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{...summaryPillStyle("#FFFFFF", G.text),border:`1px solid ${G.border}`}}>
                    Bot {normaliseTelegramBotUsername(botUsername) || "@ledgrapp_bot"}
                  </span>
                  <button type="button" onClick={addMissingInstitutes} disabled={actionBusy || missingInstituteCount === 0} style={secondaryButtonStyle}>
                    <AppIcon icon={IconPlus} size={15} color={G.text} />
                    {missingInstituteCount > 0 ? `Add ${missingInstituteCount} missing institute${missingInstituteCount === 1 ? "" : "s"}` : "All institutes added"}
                  </button>
                  <button type="button" onClick={()=>addRecipient()} disabled={actionBusy} style={primaryButtonStyle}>
                    <AppIcon icon={IconPlus} size={16} color="#FFFFFF" />
                    Add destination
                  </button>
                </div>
              </div>

              <div style={{overflowX:"auto",border:"1px solid #E2E8F0",borderRadius:18,background:"#FFFFFF"}}>
                <table style={{width:"100%",minWidth:1120,borderCollapse:"separate",borderSpacing:0}}>
                  <thead>
                    <tr>
                      <th style={{...tableHeaderStyle,borderTopLeftRadius:18}}>Institute</th>
                      <th style={tableHeaderStyle}>Telegram channel name</th>
                      <th style={tableHeaderStyle}>Chat id</th>
                      <th style={tableHeaderStyle}>Ledgr report</th>
                      <th style={{...tableHeaderStyle,borderTopRightRadius:18}}>Other important columns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((item, index) => {
                      const currentInstituteValue = item.institute && !recipientOptions.some(option => sameInstituteName(option, item.institute))
                        ? [item.institute, ...recipientOptions]
                        : recipientOptions;
                      const rowChatId = normaliseTelegramChatId(item.chatId);
                      const rowSendDisabled = actionBusy
                        || !!sendBusy
                        || !!deliveryProbe.checking
                        || !enabled
                        || !onDemandEnabled
                        || routeIssue
                        || tokenMissingOnServer
                        || !manualRouteReady
                        || !item.institute
                        || !rowChatId;
                      return (
                        <tr key={item.id}>
                          <td style={tableCellStyle}>
                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                              <span style={{width:28,height:28,borderRadius:10,background:item.enabled ? "#DBEAFE" : "#E5E7EB",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11.5,fontWeight:900,color:item.enabled ? G.blue : G.textM,fontFamily:G.mono,flexShrink:0}}>
                                {index + 1}
                              </span>
                              <div style={{fontSize:12.5,color:G.textM,lineHeight:1.45}}>
                                {item.enabled ? "Active route" : "Paused route"}
                              </div>
                            </div>
                            <select value={item.institute} disabled={actionBusy} onChange={event=>updateRecipient(item.id, { institute:event.target.value })} style={compactInputStyle}>
                              <option value="">Select institute</option>
                              {currentInstituteValue.map(option => (
                                <option key={`${item.id}_${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tableCellStyle}>
                            <input value={item.label} onChange={event=>updateRecipient(item.id, { label:event.target.value })} disabled={actionBusy} placeholder="KIS SIP Ledgr Report" style={compactInputStyle} />
                          </td>
                          <td style={tableCellStyle}>
                            <input value={item.chatId} onChange={event=>updateRecipient(item.id, { chatId:event.target.value })} disabled={actionBusy} placeholder="-1004343564758" style={compactInputStyle} />
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{display:"grid",gap:8}}>
                              <button type="button" onClick={()=>{ void saveAndSendSingle(item.id); }} disabled={rowSendDisabled} style={compactPrimaryButton(rowSendDisabled)}>
                                <AppIcon icon={IconSend} size={14} color="#FFFFFF" />
                                {sendBusy ? "Sending..." : "Send now"}
                              </button>
                              <button type="button" onClick={onOpenSchedule} disabled={actionBusy} style={compactSecondaryButton(actionBusy)}>
                                <AppIcon icon={IconClock} size={14} color={G.text} />
                                Schedule
                              </button>
                              <div style={{fontSize:11.5,color:G.textM,lineHeight:1.45}}>
                                {manualSendReady
                                  ? "Sends the exact Ledgr PDF."
                                  : routeIssue
                                    ? "Route blocked"
                                    : tokenMissingOnServer
                                      ? "Token missing"
                                      : "Not ready yet"}
                              </div>
                            </div>
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{display:"grid",gap:8}}>
                              <select value={item.destinationType} disabled={actionBusy} onChange={event=>updateRecipient(item.id, { destinationType:event.target.value })} style={compactInputStyle}>
                                <option value="channel">Channel</option>
                                <option value="group">Group</option>
                                <option value="private">Private chat</option>
                              </select>
                              <input value={item.notes} onChange={event=>updateRecipient(item.id, { notes:event.target.value })} disabled={actionBusy} placeholder="Notes (optional)" style={compactInputStyle} />
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                                <label style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12.5,fontWeight:800,color:item.enabled ? G.blue : G.textM,fontFamily:G.sans}}>
                                  <input type="checkbox" checked={item.enabled} disabled={actionBusy} onChange={event=>updateRecipient(item.id, { enabled:event.target.checked })} style={{width:16,height:16,accentColor:G.blue}} />
                                  Active
                                </label>
                                <button type="button" onClick={()=>removeRecipient(item.id)} disabled={actionBusy} style={{...compactSecondaryButton(actionBusy),height:34,padding:"0 10px",color:G.red,borderColor:"#FECACA"}}>
                                  <AppIcon icon={IconTrash} size={14} color={G.red} />
                                  Remove
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {missingInstitutes.map(inst => (
                      <tr key={`missing_${inst}`}>
                        <td style={{...tableCellStyle,color:G.text,fontWeight:700}}>{inst}</td>
                        <td style={{...tableCellStyle,color:G.textM}}>Not connected</td>
                        <td style={{...tableCellStyle,color:G.textM}}>—</td>
                        <td style={{...tableCellStyle,color:G.textM}}>—</td>
                        <td style={tableCellStyle}>
                          <button type="button" onClick={()=>addRecipient(inst)} disabled={actionBusy} style={compactSecondaryButton(actionBusy)}>
                            <AppIcon icon={IconPlus} size={14} color={G.text} />
                            Connect
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} style={{padding:0,background:"#FFFFFF",borderBottom:"none"}}>
                        <button type="button" onClick={()=>addRecipient()} disabled={actionBusy} style={{width:"100%",padding:"14px 16px",border:"none",background:"transparent",borderTop:"1px solid #E2E8F0",textAlign:"left",fontSize:13.5,fontWeight:800,color:G.blue,cursor:actionBusy ? "not-allowed" : "pointer",display:"inline-flex",alignItems:"center",gap:8}}>
                          <AppIcon icon={IconPlus} size={15} color={G.blue} />
                          Add institute row
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ledgr-telegram-settings-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(0,0.95fr)",gap:14}}>
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Defaults</div>
                <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.08}}>Bot and sending settings</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.6,marginTop:8}}>
                  Keep the bot username here. The token itself should stay on the server.
                </div>
                <div style={{display:"grid",gap:12,marginTop:14}}>
                  <div>
                    <div style={labelStyle}>Bot username</div>
                    <input value={botUsername} onChange={event=>setBotUsername(event.target.value)} disabled={actionBusy} placeholder="@ledgrapp_bot" style={inputStyle} />
                  </div>
                  {[
                    {
                      key:"enabled",
                      title:"Delivery active",
                      value:enabled,
                      onChange:setEnabled,
                      help:"Master switch for Telegram sends.",
                    },
                    {
                      key:"scheduled",
                      title:"Use daily 8 PM batch",
                      value:scheduledEnabled,
                      onChange:setScheduledEnabled,
                      help:"Sends one daily Telegram batch for all active institute routes.",
                    },
                    {
                      key:"manual",
                      title:"Allow send now",
                      value:onDemandEnabled,
                      onChange:setOnDemandEnabled,
                      help:"Keeps the Send now buttons available.",
                    },
                  ].map(item => (
                    <label key={item.key} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #E2E8F0",borderRadius:16,background:"#F8FAFC",padding:"13px 13px 12px",cursor:actionBusy?"not-allowed":"pointer"}}>
                      <input type="checkbox" checked={item.value} disabled={actionBusy} onChange={event=>item.onChange(event.target.checked)} style={{width:18,height:18,marginTop:2,accentColor:G.blue,flexShrink:0}} />
                      <span style={{minWidth:0}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:800,color:G.text,fontFamily:G.sans,lineHeight:1.25}}>{item.title}</span>
                        <span style={{display:"block",fontSize:11.5,color:G.textM,lineHeight:1.45,marginTop:5}}>{item.help}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={sectionCardStyle}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:14}}>
                  <div>
                    <div style={labelStyle}>Status</div>
                    <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.08}}>Current state</div>
                  </div>
                  <span style={{background:backendStatus.background,color:backendStatus.color,borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:800,fontFamily:G.mono}}>
                    {backendStatus.label}
                  </span>
                </div>
                <div style={{marginTop:14,display:"grid",gap:10}}>
                  <div style={{border:"1px solid #E2E8F0",borderRadius:16,background:"#F8FAFC",padding:"13px 14px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:G.text,fontFamily:G.sans}}>Manual send</div>
                    <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:6}}>
                      {onDemandEnabled
                        ? deliveryProbe.checking
                          ? "Checking the send route."
                          : routeIssue
                            ? "The API route is not live on this deployment."
                            : tokenMissingOnServer
                              ? "The server token is still missing."
                              : manualRouteReady
                                ? "Ready. Use Send now from any completed row."
                                : "Not verified yet."
                        : "Manual send is paused."}
                    </div>
                  </div>
                  <div style={{border:"1px solid #E2E8F0",borderRadius:16,background:"#F8FAFC",padding:"13px 14px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:G.text,fontFamily:G.sans}}>Daily batch</div>
                    <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:6}}>
                      {scheduleSaved
                        ? backgroundRunnerReady
                          ? "Saved and linked to the 8 PM daily batch."
                          : "Saved, but the once-daily batch runner is not connected yet."
                        : "No daily batch saved yet."}
                    </div>
                  </div>
                  <div style={{border:`1px solid ${lastErrorMessage ? "#FECACA" : "#E2E8F0"}`,borderRadius:16,background:lastErrorMessage ? "#FEF2F2" : "#F8FAFC",padding:"13px 14px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:lastErrorMessage ? "#991B1B" : G.text,fontFamily:G.sans}}>Latest delivery</div>
                    <div style={{fontSize:12,color:lastErrorMessage ? "#991B1B" : G.textM,lineHeight:1.55,marginTop:6}}>
                      {lastErrorMessage
                        ? lastErrorMessage
                        : lastSuccessAt
                          ? `Sent successfully on ${new Date(lastSuccessAt).toLocaleString("en-IN")}.`
                          : lastAttemptAt
                            ? `Last attempt was on ${new Date(lastAttemptAt).toLocaleString("en-IN")}.`
                            : "No delivery attempts yet."}
                    </div>
                  </div>
                  <div style={{border:"1px solid #E2E8F0",borderRadius:16,background:"#FFFFFF",padding:"13px 14px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:G.text,fontFamily:G.sans}}>Open report schedule</div>
                    <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:6,marginBottom:10}}>
                      Review the once-daily 8 PM batch that drives Telegram delivery.
                    </div>
                    <button type="button" onClick={onOpenSchedule} disabled={actionBusy} style={secondaryButtonStyle}>
                      <AppIcon icon={IconClock} size={15} color={G.text} />
                      Open report schedule
                    </button>
                  </div>
                  <div style={{border:"1px solid #E2E8F0",borderRadius:16,background:"#F8FAFC",padding:"13px 14px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:G.text,fontFamily:G.sans}}>Server requirement</div>
                    <div style={{fontSize:12,color:G.textM,lineHeight:1.6,marginTop:6}}>
                      <code style={{fontFamily:G.mono,color:G.text}}>TELEGRAM_BOT_TOKEN</code> and a working <code style={{fontFamily:G.mono,color:G.text}}>/api/send-ledgr-telegram</code> route.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ledgr-telegram-footer" style={embedded
          ? {flexShrink:0,padding:"14px 0 0",background:"transparent",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}
          : {flexShrink:0,padding:"14px 24px 22px",borderTop:"1px solid #E5E7EB",background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{width:"100%",maxWidth:1480,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{minWidth:0,flex:1}}>
              {draftError ? (
                <div style={{fontSize:12.5,color:"#991B1B",fontWeight:700,lineHeight:1.5}}>{draftError}</div>
              ) : (
                <div style={{fontSize:12,color:G.textM,lineHeight:1.5}}>
                  {loading
                    ? "Loading messenger dashboard..."
                    : `${configuredRecipients.length} saved route${configuredRecipients.length === 1 ? "" : "s"} ready for manual and scheduled Ledgr delivery.`}
                </div>
              )}
            </div>
            <div className="ledgr-telegram-footer-actions" style={{display:"flex",gap:10,flexShrink:0}}>
              {!embedded&&(
                <button type="button" onClick={onClose} disabled={!!saving} style={{height:48,padding:"0 16px",borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:14,fontWeight:800,fontFamily:G.sans,cursor:saving?"not-allowed":"pointer"}}>
                  Cancel
                </button>
              )}
              <button type="button" onClick={()=>{ void saveAndSendNow(); }} disabled={sendNowDisabled} style={{height:48,padding:"0 18px",borderRadius:14,border:`1px solid ${G.blue}`,background:"#EFF6FF",color:G.blue,fontSize:14,fontWeight:900,fontFamily:G.sans,cursor:sendNowDisabled?"not-allowed":"pointer",opacity:sendNowDisabled ? 0.55 : 1,display:"inline-flex",alignItems:"center",gap:8}}>
                <AppIcon icon={IconSend} size={15} color={G.blue} />
                {sendBusy ? "Sending..." : "Send all active"}
              </button>
              <button type="button" onClick={()=>{ void save(); }} disabled={actionBusy} style={{height:48,padding:"0 18px",borderRadius:14,border:"none",background:actionBusy ? "#CBD5E1" : G.navy,color:"#FFFFFF",fontSize:14,fontWeight:900,fontFamily:G.sans,cursor:actionBusy?"not-allowed":"pointer"}}>
                {saving ? "Saving..." : "Save messenger dashboard"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Institute Type Picker ─────────────────────────────────────────────────────
function InstTypePicker({ inst, onSelect, onClose }) {
  const W = { navy:"#1A2F5A",blue:"#1D4ED8",blueL:"#EEF2FF",surface:"#fff",border:"#E2E8F0",text:"#0F172A",textM:"#475569",textL:"#94A3B8",bg:"#F4F6FA",green:"#1B8A4C",greenL:"#ECFDF5",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif" };
  const types = [
    { id:"school",       icon:"🏫", title:"School",                  sub:"Classes 6th–12th, sections A/B/C etc.",                          color:"#EEF2FF", border:"#C7D7F5" },
    { id:"coaching_12",  icon:"📐", title:"Coaching — After 12th",   sub:"JEE, NEET, CLAT, CUET and similar entrance prep batches.",      color:"#ECFDF5", border:"#A7F3D0" },
    { id:"coaching_grad",icon:"🏛", title:"Coaching — After Graduation", sub:"Banking, SSC, UPSC, CAT and similar competitive exam batches.", color:"#FFFBEB", border:"#FDE68A" },
  ];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:960,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
      <div style={{background:W.surface,borderRadius:22,width:"100%",maxWidth:480,boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        <div style={{padding:"22px 20px 16px",borderBottom:`1px solid ${W.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:12,color:W.textL,fontFamily:"'Inter',sans-serif"}}>{inst}</div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:W.textL}}>✕</button>
          </div>
          <div style={{fontSize:20,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:4}}>What kind of institute is this?</div>
          <div style={{fontSize:14,color:W.textM,lineHeight:1.5}}>This shapes how you create batches and time slots.</div>
        </div>
        <div style={{padding:"16px 20px 22px",display:"flex",flexDirection:"column",gap:10}}>
          {types.map(t=>(
            <div key={t.id} onClick={()=>onSelect(t.id)}
              style={{background:t.color,border:`1.5px solid ${t.border}`,borderRadius:14,padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"transform 0.1s,box-shadow 0.1s",WebkitTapHighlightColor:"transparent"}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
              <div style={{fontSize:28,flexShrink:0}}>{t.icon}</div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:2}}>{t.title}</div>
                <div style={{fontSize:13,color:W.textM,lineHeight:1.4}}>{t.sub}</div>
              </div>
              <div style={{marginLeft:"auto",fontSize:18,color:W.textL,flexShrink:0}}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Duration Stepper (replaces pill grid) ─────────────────────────────────────
function DurStepper({ value, onChange, compact = false }) {
  const W = { navy:"#1A2F5A",border:"#E2E8F0",text:"#0F172A",textM:"#475569",textL:"#94A3B8",surface:"#fff",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'Inter',sans-serif" };
  const fmt = m => m < 60 ? `${m} min` : m === 60 ? "1 hour" : m % 60 === 0 ? `${m/60} hours` : `${Math.floor(m/60)}h ${m%60}m`;
  const dec = () => onChange(Math.max(30, value - 5));
  const inc = () => onChange(Math.min(180, value + 5));
  const buttonSize = compact ? 42 : 52;
  const labelWidth = compact ? 96 : 110;
  const valueSize = compact ? 16 : 20;
  const metaSize = compact ? 9 : 10;
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,background:W.surface,border:`2px solid ${W.navy}`,borderRadius:compact?12:14,overflow:"hidden",width:"fit-content",boxShadow:compact?"none":"0 4px 10px rgba(15,23,42,0.04)"}}>
      <button onClick={dec} style={{width:buttonSize,height:buttonSize,border:"none",background:"transparent",fontSize:compact?20:22,fontWeight:700,cursor:"pointer",color:W.navy,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}>−</button>
      <div style={{width:labelWidth,textAlign:"center",padding:"0 4px",borderLeft:`1px solid ${W.border}`,borderRight:`1px solid ${W.border}`}}>
        <div style={{fontFamily:W.display,fontWeight:800,fontSize:valueSize,color:W.navy,lineHeight:1.2}}>{fmt(value)}</div>
        <div style={{fontSize:metaSize,color:W.textL,fontFamily:W.mono}}>{value} min</div>
      </div>
      <button onClick={inc} style={{width:buttonSize,height:buttonSize,border:"none",background:"transparent",fontSize:compact?20:22,fontWeight:700,cursor:"pointer",color:W.navy,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}>+</button>
    </div>
  );
}

// ── Copy Group to Other Institutes Modal ──────────────────────────────────────
function CopyGroupToInstitutesModal({ sourceInst, group, allInstitutes, instSectionsAll, getInstituteSectionConfig, getInstituteSectionConfigKey, onCopy, onClose }) {
  const otherInstitutes = allInstitutes.filter(i => i !== sourceInst);
  const [selected, setSelected] = React.useState({});
  const [conflicts, setConflicts] = React.useState(null); // null | [{inst, conflictingGroup}]
  const [resolutions, setResolutions] = React.useState({}); // {inst: "replace"|"rename"|"skip"}
  const [renames, setRenames] = React.useState({}); // {inst: string}
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState("select"); // "select" | "conflicts" | "done"

  const toggleInst = inst => setSelected(prev => ({ ...prev, [inst]: !prev[inst] }));
  const selectedInsts = otherInstitutes.filter(i => selected[i]);
  const fmtSlot = s => {
    const [h,m] = s.start.split(":").map(Number);
    const [eh,em] = (s.end||"").split(":").map(Number);
    const f=(hh,mm)=>`${hh%12||12}:${String(mm).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;
    return `${f(h,m)}–${f(eh||0,em||0)}`;
  };

  function checkConflicts() {
    if (!selectedInsts.length) return;
    const found = [];
    for (const inst of selectedInsts) {
      const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
      const existingGroups = instData.gradeGroups || [];
      const clash = existingGroups.find(g => g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase());
      if (clash) found.push({ inst, conflictingGroup: clash });
    }
    if (found.length > 0) {
      const initRes = {};
      const initRen = {};
      found.forEach(({ inst }) => {
        initRes[inst] = "rename";
        initRen[inst] = `${group.label} (Copy)`;
      });
      setConflicts(found);
      setResolutions(initRes);
      setRenames(initRen);
      setStep("conflicts");
    } else {
      setConflicts([]);
      doCopy([]);
    }
  }

  async function doCopy(resolvedConflicts) {
    setBusy(true);
    try {
      for (const inst of selectedInsts) {
        const instKey = getInstituteSectionConfigKey(instSectionsAll, inst);
        const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
        const existingGroups = instData.gradeGroups || [];
        const conflict = (resolvedConflicts || []).find(c => c.inst === inst);
        const resolution = conflict ? resolutions[inst] : null;
        if (resolution === "skip") continue;
        // Build a clean copy, brand new id, stripped of source-institute info
        const newGroup = {
          ...group,
          id: "grp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          label: resolution === "rename" ? (renames[inst] || `${group.label} (Copy)`) : group.label,
          // Strip any teacher-source fields (none exist structurally, but be explicit)
        };
        let updatedGroups;
        if (resolution === "replace") {
          updatedGroups = existingGroups.map(g =>
            g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase() ? newGroup : g
          );
        } else {
          updatedGroups = [...existingGroups, newGroup];
        }
        await onCopy(instKey, inst, updatedGroups);
      }
      setStep("done");
    } catch(e) {
      alert("Copy failed: " + (e?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }

  const conflictInsts = new Set((conflicts || []).map(c => c.inst));

  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",background:"rgba(0,0,0,0.45)"}}>
      <div style={{background:G.surface,borderRadius:18,boxShadow:G.shadowLg,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",padding:"24px"}}>
        {step === "select" && (<>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontSize:19,fontWeight:800,color:G.text,fontFamily:G.display}}>Copy Group to Institutes</div>
              <div style={{fontSize:13,color:G.textM,marginTop:4}}>
                Copying <strong style={{color:G.text}}>{group.label}</strong> — sections and time slots will be duplicated as a fresh independent group.
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:G.textL,flexShrink:0,lineHeight:1}}>✕</button>
          </div>
          {/* Group preview */}
          <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"12px 14px",marginBottom:18}}>
            <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>What will be copied</div>
            <div style={{fontSize:13,color:G.textS,marginBottom:4}}>
              <strong>{(group.sections||[]).length}</strong> sections: {(group.sections||[]).slice(0,6).join(", ")}{(group.sections||[]).length>6?" …":""}
            </div>
            <div style={{fontSize:13,color:G.textS}}>
              <strong>{(group.slots||[]).length}</strong> time slot{(group.slots||[]).length!==1?"s":""}: {(group.slots||[]).map(fmtSlot).join(", ")}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Select target institutes</div>
          {otherInstitutes.length === 0 && (
            <div style={{fontSize:14,color:G.textM,padding:"18px 0",textAlign:"center"}}>No other institutes found. Create more institutes first.</div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {otherInstitutes.map(inst => {
              const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
              const groupCount = (instData.gradeGroups||[]).length;
              const hasConflict = (instData.gradeGroups||[]).some(g => g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase());
              return (
                <label key={inst} style={{display:"flex",alignItems:"center",gap:12,background:selected[inst]?G.blueL:G.bg,border:`1.5px solid ${selected[inst]?G.blue:G.border}`,borderRadius:10,padding:"11px 14px",cursor:"pointer",transition:"all 0.13s"}}>
                  <input type="checkbox" checked={!!selected[inst]} onChange={()=>toggleInst(inst)}
                    style={{width:16,height:16,accentColor:G.blue,flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:G.text,fontFamily:G.display}}>{inst}</div>
                    <div style={{fontSize:12,color:G.textM,marginTop:2}}>{groupCount} group{groupCount!==1?"s":""}{hasConflict ? <span style={{color:G.amber,fontWeight:700}}> · name conflict</span> : ""}</div>
                  </div>
                  {hasConflict && <span style={{fontSize:18}}>⚠️</span>}
                </label>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{...pill(G.bg,G.textS,G.borderM),padding:"10px 18px",fontSize:14}}>Cancel</button>
            <button disabled={selectedInsts.length===0} onClick={checkConflicts}
              style={{...pill(G.navy,"#fff","transparent"),padding:"10px 20px",fontSize:14,opacity:selectedInsts.length===0?0.5:1,cursor:selectedInsts.length===0?"not-allowed":"pointer"}}>
              Continue →
            </button>
          </div>
        </>)}

        {step === "conflicts" && (<>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontSize:19,fontWeight:800,color:G.text,fontFamily:G.display}}>Resolve Name Conflicts</div>
              <div style={{fontSize:13,color:G.textM,marginTop:4}}>
                {conflicts.length} institute{conflicts.length!==1?"s":""} already {conflicts.length!==1?"have":"has"} a group named <strong style={{color:G.text}}>&ldquo;{group.label}&rdquo;</strong>. Choose what to do for each.
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:G.textL,flexShrink:0,lineHeight:1}}>✕</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            {conflicts.map(({inst, conflictingGroup})=>(
              <div key={inst} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>{inst}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    ["rename", "Add as new group (with a different name)"],
                    ["replace", `Replace existing "${conflictingGroup.label}" group`],
                    ["skip", "Skip this institute"],
                  ].map(([val, label])=>(
                    <label key={val} style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer"}}>
                      <input type="radio" name={`res_${inst}`} value={val} checked={resolutions[inst]===val}
                        onChange={()=>setResolutions(prev=>({...prev,[inst]:val}))}
                        style={{marginTop:2,accentColor:G.blue}} />
                      <span style={{fontSize:14,color:G.textS,lineHeight:1.4}}>{label}</span>
                    </label>
                  ))}
                </div>
                {resolutions[inst]==="rename" && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:G.textM,marginBottom:4}}>New group name for <strong>{inst}</strong>:</div>
                    <input value={renames[inst]||""} onChange={e=>setRenames(prev=>({...prev,[inst]:e.target.value}))}
                      style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:14,fontFamily:G.sans,outline:"none",color:G.text}} />
                  </div>
                )}
              </div>
            ))}
            {/* Non-conflicting targets summary */}
            {selectedInsts.filter(i=>!conflictInsts.has(i)).length > 0 && (
              <div style={{background:"#ECFDF5",border:"1px solid #BBF7D0",borderRadius:10,padding:"11px 14px"}}>
                <div style={{fontSize:13,color:"#166534",fontWeight:600}}>
                  ✓ No conflicts at: {selectedInsts.filter(i=>!conflictInsts.has(i)).join(", ")}
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setStep("select")} style={{...pill(G.bg,G.textS,G.borderM),padding:"10px 18px",fontSize:14}}>← Back</button>
            <button disabled={busy} onClick={()=>doCopy(conflicts)}
              style={{...pill(G.navy,"#fff","transparent"),padding:"10px 20px",fontSize:14,opacity:busy?0.6:1,cursor:busy?"not-allowed":"pointer"}}>
              {busy ? "Copying…" : `Copy to ${selectedInsts.filter(i=>resolutions[i]!=="skip"||!conflictInsts.has(i)).length} institute${selectedInsts.length!==1?"s":""}`}
            </button>
          </div>
        </>)}

        {step === "done" && (<>
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:14}}>✅</div>
            <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:8}}>Group copied!</div>
            <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginBottom:24}}>
              <strong>{group.label}</strong> has been added to the selected institutes as an independent group. Teachers there can now use it just like any locally created group.
            </div>
            <button onClick={onClose} style={{...pill(G.navy,"#fff","transparent"),padding:"10px 28px",fontSize:15}}>Done</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Institute Wizard (school + coaching modes) ────────────────────────────────
function GradeGroupModal({ inst, instType, group, onSave, onClose }) {
  const isEdit    = !!group;
  const isCoaching = instType === "coaching_12" || instType === "coaching_grad";
  // coaching_12 suggestions, coaching_grad suggestions
  const BATCH_SUGGESTIONS = {
    coaching_12:   ["JEE Main","JEE Advanced","NEET","CLAT","CUET","Foundation","NDA","MED","Dropper"],
    coaching_grad: ["Banking","SSC CGL","SSC CHSL","UPSC","CAT","GATE","RRB","Defence"],
  };
  const suggestions = BATCH_SUGGESTIONS[instType] || [];

  const W = { navy:"#1A2F5A",blue:"#1D4ED8",blueL:"#EEF2FF",blueV:"#3B82F6",
    bg:"#F4F6FA",surface:"#fff",border:"#E2E8F0",borderM:"#CBD5E1",
    text:"#0F172A",textM:"#475569",textL:"#94A3B8",
    green:"#1B8A4C",greenL:"#ECFDF5",
    red:"#DC2626",redL:"#FEF2F2",amber:"#D97706",amberL:"#FFFBEB",
    sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'Inter',sans-serif" };

  const TOTAL = 3;
  const STEP_LABELS = ["Group","Time slots","Review"];

  // Lock body scroll while modal is open
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [step,       setStep]       = React.useState(1);
  // School-only state
  const [gradeNums,  setGradeNums]  = React.useState(group?.gradeNums||[]);
  const [secText,    setSecText]    = React.useState((group?.sections||[]).join("\n"));
  // Coaching-only state
  const [batchText,  setBatchText]  = React.useState((group?.sections||[]).join("\n"));
  const [groupLabel, setGroupLabel] = React.useState(group?.label||"");
  // Shared state
  const [durMins,    setDurMins]    = React.useState(group?.durMins||60);
  const [startTimes, setStartTimes] = React.useState(group?.slots?.map(s=>s.start)||[""]);
  const [slotDurs,   setSlotDurs]   = React.useState(group?.slots?.map(s=>s.durMins)||[]);
  const [overrides,  setOverrides]  = React.useState(group?.sectionOverrides||{});
  const [showOv,     setShowOv]     = React.useState(false);
  const [busy,       setBusy]       = React.useState(false);
  const [error,      setError]      = React.useState("");
  const [renameReview, setRenameReview] = React.useState(null);
  const [quickRename, setQuickRename] = React.useState(null);
  const [quickRenameError, setQuickRenameError] = React.useState("");
  const [pendingRenames, setPendingRenames] = React.useState([]);

  const fmtEnd  = (t,m)=>{ if(!t) return ""; const[h,mn]=t.split(":").map(Number); const e=new Date(2000,0,1,h,mn+m); return String(e.getHours()).padStart(2,"0")+":"+String(e.getMinutes()).padStart(2,"0"); };
  const fmtDisp = t=>{ if(!t) return "--"; const[h,m]=t.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
  const toMins  = t=>{ if(!t) return 0; const[h,m]=t.split(":").map(Number); return h*60+m; };
  const sectionTerm = "section";
  const sectionText = secText;

  const sections    = uniqueSectionNames(sectionText.split(/[\n,]/).map(s=>s.trim()).filter(Boolean));
  const validSlots  = startTimes.map((s,i)=>({start:s,dur:slotDurs[i]||durMins})).filter(s=>s.start).sort((a,b)=>toMins(a.start)-toMins(b.start));
  const inp = { width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${W.border}`,fontSize:15,fontFamily:W.sans,outline:"none",background:W.bg,color:W.text,boxSizing:"border-box" };

  function quickSelectGrades(type) {
    if(type==="junior") setGradeNums([6,7,8,9,10]);
    else if(type==="senior") setGradeNums([11,12]);
    else setGradeNums([6,7,8,9,10,11,12]);
  }

  function addSuggestion(s) {
    const lines = batchText.split("\n").map(l=>l.trim()).filter(Boolean);
    if (!lines.includes(s)) setBatchText([...lines, s].join("\n"));
  }
  function setSectionLines(nextSections) {
    const nextText = uniqueSectionNames(nextSections).join("\n");
    setSecText(nextText);
  }
  function updateSectionName(oldName, newName) {
    const oldKey = normaliseSectionKey(oldName);
    setSectionLines(sections.map(section => normaliseSectionKey(section) === oldKey ? newName : section));
  }
  function removeSectionName(sectionName) {
    const removeKey = normaliseSectionKey(sectionName);
    setSectionLines(sections.filter(section => normaliseSectionKey(section) !== removeKey));
    setOverrides(curr => {
      const next = { ...curr };
      delete next[sectionName];
      return next;
    });
    setPendingRenames(curr => pruneExplicitSectionRenames(curr, sectionName));
  }
  function openQuickRename(sectionName) {
    setQuickRename({ oldName: sectionName, nextValue: sectionName });
    setQuickRenameError("");
    setError("");
  }
  function confirmQuickRename() {
    const oldName = String(quickRename?.oldName || "").trim();
    const nextName = String(quickRename?.nextValue || "").trim();
    if (!oldName) {
      setQuickRename(null);
      return;
    }
    if (!nextName) {
      setQuickRenameError(`Enter a ${sectionTerm} name.`);
      return;
    }
    const duplicate = sections.some(section => (
      normaliseSectionKey(section) === normaliseSectionKey(nextName) &&
      normaliseSectionKey(section) !== normaliseSectionKey(oldName)
    ));
    if (duplicate) {
      setQuickRenameError(`That ${sectionTerm} name already exists.`);
      return;
    }
    updateSectionName(oldName, nextName);
    setOverrides(curr => {
      const next = { ...curr };
      if (oldName !== nextName && (next[oldName] || []).length) {
        next[nextName] = next[nextName] || next[oldName];
      }
      delete next[oldName];
      return next;
    });
    if (normaliseSectionKey(oldName) !== normaliseSectionKey(nextName)) {
      setPendingRenames(curr => mergeExplicitSectionRenames(curr, oldName, nextName));
    }
    setQuickRename(null);
    setQuickRenameError("");
  }
  function renderSectionActionList() {
    if (!sections.length) return null;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
        {sections.map(section => (
          <div key={section} style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div style={{minWidth:0,flex:"1 1 220px"}}>
              <div style={{fontSize:14,fontWeight:700,color:W.text,fontFamily:W.display,wordBreak:"break-word"}}>{section}</div>
              <div style={{fontSize:12,color:W.textL,marginTop:4}}>{`Teachers will see this exact ${sectionTerm} name.`}</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
              <button onClick={()=>openQuickRename(section)}
                style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${W.blue}`,background:W.blueL,color:W.blue,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:W.sans}}>
                Rename
              </button>
              <button onClick={()=>removeSectionName(section)}
                style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${W.border}`,background:"#fff",color:W.textM,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:W.sans}}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function buildSavedGroup() {
    const slots = validSlots.map(s=>({ start:s.start, end:fmtEnd(s.start,s.dur), durMins:s.dur }));
    const label = groupLabel.trim();
    const savedGradeNums = Array.isArray(group?.gradeNums) ? group.gradeNums : [];
    return { id:group?.id||("grp_"+Date.now()), gradeNums:savedGradeNums, label, sections, slots, durMins, sectionOverrides:overrides, instType };
  }

  function finaliseSave(savedGroup, changeMeta = null) {
    setBusy(true);
    onSave(savedGroup, changeMeta).then(()=>{ setBusy(false); onClose(); }).catch(e=>{ setBusy(false); setError(e.message||"Save failed."); });
  }

  function handleSave() {
    if (!groupLabel.trim()) { setError("Enter a group name."); setStep(1); return; }
    if (!sections.length) { setError("Add at least one section."); setStep(1); return; }
    if (!validSlots.length) { setError("Add at least one start time."); setStep(2); return; }
    const saved = buildSavedGroup();
    if(isEdit){
      const draft = buildSectionChangeDraft(group, saved);
      const explicitSelections = buildExplicitSectionRenameSelections(group, saved, pendingRenames);
      const explicitKeys = new Set(Object.keys(explicitSelections).map(normaliseSectionKey));
      const unresolvedRemoved = draft.removedSections.filter(section => !explicitKeys.has(normaliseSectionKey(section)));
      if(unresolvedRemoved.length){
        setRenameReview({
          draft: { ...draft, removedSections: unresolvedRemoved },
          selections: buildInitialSectionRenameSelections({ ...draft, removedSections: unresolvedRemoved }),
          savedGroup: saved,
          explicitSelections,
        });
        return;
      }
      const nextGroup = applySectionRenameSelections(saved, explicitSelections);
      const events = buildSectionChangeEvents(inst, group, nextGroup, explicitSelections, draft.timetableChanged);
      finaliseSave(nextGroup, events.length ? {
        sectionChangeEvents: events,
      } : null);
      return;
    }
    finaliseSave(saved, null);
  }

  function confirmRenameReview() {
    if(!renameReview?.savedGroup) return;
    const finalSelections = {
      ...(renameReview.explicitSelections || {}),
      ...(renameReview.selections || {}),
    };
    const nextGroup = applySectionRenameSelections(renameReview.savedGroup, finalSelections);
    const events = buildSectionChangeEvents(inst, group, nextGroup, finalSelections, renameReview.draft?.timetableChanged);
    finaliseSave(nextGroup, {
      sectionChangeEvents: events,
    });
  }

  // ── STEP: School grades ───────────────────────────────────────────────────
  function StepSchoolGrades() {
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Which grades share this schedule?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>Select one or more. All selected grades share the same sections and timetable.</div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["⚡ Junior (6–10)","junior"],["⚡ Senior (11–12)","senior"],["All grades","all"]].map(([l,t])=>{
          const sel=(t==="junior"&&JSON.stringify(gradeNums)==="[6,7,8,9,10]")||(t==="senior"&&JSON.stringify(gradeNums)==="[11,12]")||(t==="all"&&gradeNums.length===7);
          return <button key={t} onClick={()=>quickSelectGrades(t)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${sel?W.navy:W.border}`,background:sel?W.navy:"transparent",color:sel?"#fff":W.textM,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:W.sans}}>{l}</button>;
        })}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {[6,7,8,9,10,11,12].map(g=>{
          const sel=gradeNums.includes(g);
          return (<div key={g} onClick={()=>setGradeNums(n=>sel?n.filter(x=>x!==g):[...n,g].sort((a,b)=>a-b))}
            style={{width:58,height:64,borderRadius:12,border:`2px solid ${sel?W.navy:W.border}`,background:sel?W.navy:W.surface,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.15s",position:"relative",userSelect:"none",WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontFamily:W.display,fontWeight:700,fontSize:16,color:sel?"#fff":W.textM}}>{g}<sup style={{fontSize:8}}>th</sup></span>
            <span style={{fontSize:9,color:sel?"rgba(255,255,255,0.5)":W.textL,fontWeight:600,marginTop:2}}>{g<=10?"Junior":"Senior"}</span>
            {sel&&<div style={{position:"absolute",top:-6,right:-6,width:18,height:18,background:W.green,borderRadius:"50%",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:900}}>✓</div>}
          </div>);
        })}
      </div>
      {gradeNums.length>0&&<div style={{background:W.blueL,border:"1px solid #C7D7F5",borderRadius:10,padding:"10px 14px",fontSize:13,color:W.blue,fontWeight:600}}>✓ {gradeNums.length} grade{gradeNums.length>1?"s":""} selected ({gradeNums.map(g=>g+"th").join(", ")}) — same sections &amp; timetable.</div>}
    </>);
  }

  // ── STEP: School sections ─────────────────────────────────────────────────
  function StepSchoolSections() {
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Create a timetable group</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>Give this group a name, then add all sections that should share the same time slots.</div>
      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:6}}>Group name</div>
      <input
        value={groupLabel}
        onChange={e=>setGroupLabel(e.target.value)}
        placeholder="e.g. Senior Science Morning"
        style={{...inp,marginBottom:14}}
      />
      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:6}}>Sections in this group</div>
      <textarea value={secText} onChange={e=>setSecText(e.target.value)} rows={5}
        placeholder={"11th NDA\n11th IIT Star\n11th MED\n12th NDA"}
        style={{...inp,resize:"vertical",lineHeight:1.9,fontFamily:W.mono,fontSize:14}}/>
      <div style={{fontSize:12,color:W.textL,textAlign:"right",marginTop:5}}>{sections.length} section{sections.length!==1?"s":""}</div>
      {sections.length>0&&<div style={{fontSize:12,color:W.textM,marginTop:10,lineHeight:1.55}}>These sections will all inherit the same time-slot setup in the next step. Use Rename for simple name changes so teachers get the right update automatically after you save.</div>}
      {renderSectionActionList()}
    </>);
  }

  // ── STEP: Coaching batches ────────────────────────────────────────────────
  function StepCoachingBatches() {
    const usedSuggestions = suggestions.filter(s => sections.includes(s));
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Name your batches</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:14,lineHeight:1.6}}>These are the batch names teachers will see. Tap a suggestion or type your own below.</div>

      {/* Quick suggestion chips */}
      {suggestions.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:8}}>Quick add</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {suggestions.map(s=>{
              const used=sections.includes(s);
              return (<button key={s} onClick={()=>used ? setBatchText(batchText.split("\n").filter(l=>l.trim()!==s).join("\n")) : addSuggestion(s)}
                style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${used?W.navy:W.border}`,background:used?W.navy:"transparent",color:used?"#fff":W.textM,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:W.sans,transition:"all 0.15s",display:"flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent"}}>
                {used&&<span style={{fontSize:11}}>✓</span>} {s}
              </button>);
            })}
          </div>
        </div>
      )}

      {/* Free text */}
      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:6}}>All batch names (one per line)</div>
      <textarea value={batchText} onChange={e=>setBatchText(e.target.value)} rows={5}
        placeholder={"Dronacharya\nLakshya\nArjun\nMorning Batch"}
        style={{...inp,resize:"vertical",lineHeight:1.9,fontFamily:W.mono,fontSize:14}}/>
      <div style={{fontSize:12,color:W.textL,textAlign:"right",marginTop:5}}>{sections.length} batch{sections.length!==1?"es":""}</div>
      {sections.length>0&&<div style={{fontSize:12,color:W.textM,marginTop:10,lineHeight:1.55}}>Use Rename for a direct batch-name change. If you also adjust time slots before saving, teachers will be told about that too.</div>}
      {renderSectionActionList()}

      {/* Optional group label */}
      <div style={{marginTop:16}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:6}}>Group label <span style={{fontWeight:400,color:W.textL,textTransform:"none"}}>(optional — e.g. "JEE Batches")</span></div>
        <input value={groupLabel} onChange={e=>setGroupLabel(e.target.value)} placeholder="Auto-generated if left empty"
          style={{...inp}}/>
      </div>
    </>);
  }

  // ── STEP: Time slots (shared) ─────────────────────────────────────────────
  function StepTimeSlots() {
    const previewSlots = startTimes.map((t,i)=>({t,dur:slotDurs[i]||durMins,i})).filter(s=>s.t).sort((a,b)=>toMins(a.t)-toMins(b.t));
    const showTL = previewSlots.length>0;
    const allMins = previewSlots.flatMap(s=>[toMins(s.t),toMins(s.t)+s.dur]);
    const minT=(showTL?Math.min(...allMins):0)-10, maxT=(showTL?Math.max(...allMins):60)+10;
    const range = Math.max(maxT-minT,1);
    const slotCount = validSlots.length;
    const customCount = startTimes.reduce((count, t, i) => (
      t && (slotDurs[i] || durMins) !== durMins ? count + 1 : count
    ), 0);
    const firstStart = showTL ? fmtDisp(previewSlots[0].t) : "Not set";
    const lastEnd = showTL ? fmtDisp(fmtEnd(previewSlots[previewSlots.length-1].t, previewSlots[previewSlots.length-1].dur)) : "--";
    const summaryCard = (label, value, tone="default") => (
      <div style={{
        flex:"1 1 140px",
        minWidth:130,
        background:tone==="accent"?"linear-gradient(135deg, #EEF2FF 0%, #F8FAFF 100%)":W.surface,
        border:`1px solid ${tone==="accent"?"#C7D7F5":W.border}`,
        borderRadius:14,
        padding:"12px 14px"
      }}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.textL,marginBottom:6}}>{label}</div>
        <div style={{fontSize:16,fontWeight:700,color:tone==="accent"?W.navy:W.text,fontFamily:W.display,lineHeight:1.25}}>{value}</div>
      </div>
    );
    return (<>
      <div style={{fontSize:20,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:4}}>Shared timetable setup</div>
      <div style={{fontSize:13,color:W.textM,marginBottom:16,lineHeight:1.6}}>This is the shared time-slot editor used across the admin flow for all institutes. Set the base duration once, then organise the daily slot pattern below.</div>

      <div style={{background:"linear-gradient(135deg, #F8FBFF 0%, #EEF4FF 100%)",border:"1px solid #D8E4FA",borderRadius:16,padding:"16px 16px 14px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.blue,marginBottom:6}}>Quick overview</div>
            <div style={{fontSize:16,fontWeight:700,color:W.text,fontFamily:W.display}}>Keep the common schedule clean, then only override exceptions.</div>
          </div>
          <div style={{fontSize:12,color:W.textM,background:"#fff",border:"1px solid #D8E4FA",borderRadius:999,padding:"7px 12px",fontWeight:600}}>9:00 AM starts → {fmtDisp(fmtEnd("09:00",durMins))}</div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {summaryCard("Default duration", `${durMins} min`, "accent")}
          {summaryCard("Active slots", slotCount ? `${slotCount} configured` : "None yet")}
          {summaryCard("Day span", showTL ? `${firstStart} - ${lastEnd}` : "Add a slot to preview")}
          {summaryCard("Custom durations", customCount ? `${customCount} custom` : "Using default")}
        </div>
      </div>

      <div style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:16,padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.textL,marginBottom:6}}>Base duration</div>
            <div style={{fontSize:14,color:W.textM,lineHeight:1.5}}>New slots inherit this length automatically. You can still fine-tune any individual slot below.</div>
          </div>
          <span style={{fontSize:12,color:W.navy,background:"#F8FAFF",border:"1px solid #D8E4FA",borderRadius:999,padding:"7px 12px",fontWeight:700}}>Shared default</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <DurStepper value={durMins} onChange={m=>{setDurMins(m);setSlotDurs(sd=>sd.map((d,i)=>d&&d!==durMins?d:m));}} />
          <div style={{flex:"1 1 220px",minWidth:220,background:W.bg,border:`1px solid ${W.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.7,color:W.textL,marginBottom:5}}>How it works</div>
            <div style={{fontSize:13,color:W.textM,lineHeight:1.55}}>Change this when most classes share the same length. Only slots that already have a custom duration will stay untouched.</div>
          </div>
        </div>
      </div>

      <div style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:16,padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.textL,marginBottom:6}}>Daily start times</div>
            <div style={{fontSize:14,color:W.textM,lineHeight:1.5}}>{slotCount ? `${slotCount} slot${slotCount!==1?"s":""} configured. Review each row and adjust only what needs to differ.` : "Add the first slot to build the common timetable pattern."}</div>
          </div>
          <button onClick={()=>{setStartTimes(n=>[...n,""]);setSlotDurs(n=>[...n,durMins]);}}
            style={{padding:"10px 14px",borderRadius:12,border:`1.5px solid ${W.blue}`,background:W.blueL,color:W.blue,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:W.sans,whiteSpace:"nowrap"}}>
            + Add slot
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {startTimes.map((t,i)=>{
          const slotDur=slotDurs[i]||durMins;
          const isCustom = slotDur !== durMins;
          const endTime = t ? fmtDisp(fmtEnd(t,slotDur)) : "Choose a start time";
          return (
            <div key={i} style={{borderRadius:14,border:`1.5px solid ${t?W.blueV:W.border}`,background:t?"#FBFDFF":W.surface,transition:"border-color 0.15s, box-shadow 0.15s",overflow:"hidden"}}>
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:`1px solid ${W.border}`}}>
                <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:t?W.blue:W.textL,background:t?W.blueL:W.bg,borderRadius:999,padding:"5px 10px"}}>Slot {i+1}</span>
                <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 260px",minWidth:240,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:W.textL,fontWeight:600}}>Start</span>
                  <input type="time" value={t} onChange={e=>{const n=[...startTimes];n[i]=e.target.value;setStartTimes(n);}}
                    style={{border:`1px solid ${W.border}`,borderRadius:10,padding:"9px 12px",fontSize:15,fontFamily:W.mono,fontWeight:600,color:W.text,outline:"none",background:"#fff",cursor:"pointer",minWidth:126}}/>
                  <span style={{color:W.textL,fontSize:13,fontFamily:W.mono}}>→</span>
                  <span style={{fontSize:13,fontFamily:W.mono,fontWeight:700,color:t?W.green:W.textL,background:t?W.greenL:W.bg,borderRadius:999,padding:"7px 12px"}}>{endTime}</span>
                </div>
                {startTimes.length>1&&<button onClick={()=>{setStartTimes(n=>n.filter((_,j)=>j!==i));setSlotDurs(n=>n.filter((_,j)=>j!==i));}} style={{background:"none",border:"none",padding:"6px 0",cursor:"pointer",color:W.textL,fontSize:14,flexShrink:0,fontWeight:700}}>Remove</button>}
              </div>
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{minWidth:88}}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL,marginBottom:4}}>Duration</div>
                  <div style={{fontSize:12,color:W.textM}}>{isCustom ? "Custom for this slot" : "Using default"}</div>
                </div>
                <DurStepper compact value={slotDur} onChange={m=>{const n=[...slotDurs];n[i]=m;setSlotDurs(n);}} />
                <span style={{fontSize:11,color:isCustom?W.blue:W.textL,fontFamily:W.sans,fontWeight:700,background:isCustom?W.blueL:W.bg,border:`1px solid ${isCustom?"#C7D7F5":W.border}`,borderRadius:999,padding:"6px 10px"}}>
                  {isCustom ? "Custom duration" : "Matches default"}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Timeline preview */}
      {showTL&&(
        <div style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:16,padding:16,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.textL,marginBottom:6}}>Preview</div>
          <div style={{fontSize:14,color:W.textM,lineHeight:1.5,marginBottom:12}}>Use this quick visual check to make sure the day flows in the right order and the gaps look intentional.</div>
          <div style={{position:"relative",height:40,background:W.bg,borderRadius:8,border:`1px solid ${W.border}`}}>
            {previewSlots.map((s,si)=>{
              const sm=toMins(s.t),left=((sm-minT)/range*100).toFixed(1)+"%",width=(s.dur/range*100).toFixed(1)+"%";
              return (<div key={si} style={{position:"absolute",top:3,bottom:3,left,width,background:W.greenL,border:"1px solid rgba(27,138,76,0.25)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                <span style={{fontSize:9,fontWeight:700,fontFamily:W.mono,color:W.green,padding:"0 3px",whiteSpace:"nowrap",overflow:"hidden"}}>{fmtDisp(s.t)}</span>
              </div>);
            })}
            {previewSlots.slice(0,-1).map((s,si)=>{
              const nxt=previewSlots[si+1],endM=toMins(s.t)+s.dur,brk=toMins(nxt.t)-endM;
              if(brk<=0) return null;
              return (<div key={"b"+si} style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:((endM-minT)/range*100).toFixed(1)+"%",width:(brk/range*100).toFixed(1)+"%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:8,fontFamily:W.mono,color:W.textL,whiteSpace:"nowrap"}}>{brk}m</span>
              </div>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:W.textL,fontFamily:W.mono}}>
            <span>{fmtDisp(previewSlots[0].t)}</span>
            <span>{fmtDisp(fmtEnd(previewSlots[previewSlots.length-1].t,previewSlots[previewSlots.length-1].dur))}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:12}}>
            {previewSlots.map((slot,si)=>(
              <span key={si} style={{background:W.greenL,color:W.green,border:"1px solid rgba(27,138,76,0.16)",borderRadius:999,padding:"6px 10px",fontSize:11,fontFamily:W.mono,fontWeight:700}}>
                {fmtDisp(slot.t)} - {fmtDisp(fmtEnd(slot.t,slot.dur))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-section overrides */}
      <div style={{background:W.bg,border:`1px solid ${W.border}`,borderRadius:16,padding:16}}>
        <button onClick={()=>setShowOv(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:700,color:W.blue,fontFamily:W.sans,padding:0,display:"flex",alignItems:"center",gap:8,width:"100%",justifyContent:"space-between"}}>
          <span style={{display:"flex",alignItems:"center",gap:8}}>
            <span>{showOv?"▼":"▶"}</span>
            Optional exceptions for a specific {sectionTerm}
          </span>
          <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:W.textL}}>Advanced</span>
        </button>
        {showOv&&(<>
          <div style={{fontSize:13,color:W.textL,margin:"10px 0 12px",lineHeight:1.55}}>Only use this when one {sectionTerm} should break away from the shared pattern above. If not, leave everything blank here.</div>
          {sections.map(sec=>{
            const ss=overrides[sec]||[];
            return(<div key={sec} style={{background:W.surface,borderRadius:12,padding:"12px 14px",border:`1px solid ${W.border}`,marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                <div style={{fontSize:13,fontWeight:700,fontFamily:W.mono,color:W.text}}>{sec}</div>
                <span style={{fontSize:11,color:ss.length?W.blue:W.textL,fontWeight:700,background:ss.length?W.blueL:W.bg,border:`1px solid ${ss.length?"#C7D7F5":W.border}`,borderRadius:999,padding:"5px 10px"}}>{ss.length||0} override{ss.length!==1?"s":""}</span>
              </div>
              {ss.map((slot,si)=>(
                <div key={si} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="time" value={slot.start} onChange={e=>{const s=[...ss];s[si]={...s[si],start:e.target.value,end:fmtEnd(e.target.value,durMins)};setOverrides(o=>({...o,[sec]:s}));}}
                    style={{...inp,marginBottom:0,flex:"1 1 150px",fontSize:14}}/>
                  <span style={{fontSize:12,color:slot.end?W.green:W.textL,fontFamily:W.mono,flexShrink:0,background:slot.end?W.greenL:W.bg,border:`1px solid ${slot.end?"rgba(27,138,76,0.16)":W.border}`,borderRadius:999,padding:"8px 10px"}}>{slot.end?fmtDisp(slot.end):"--"}</span>
                  <button onClick={()=>setOverrides(o=>({...o,[sec]:ss.filter((_,j)=>j!==si)}))} style={{background:"none",border:"none",cursor:"pointer",color:W.textL,fontSize:13,fontWeight:700,padding:0}}>Remove</button>
                </div>
              ))}
              <button onClick={()=>setOverrides(o=>({...o,[sec]:[...ss,{start:"",end:"",durMins}]}))} style={{background:"none",border:"none",cursor:"pointer",color:W.blue,fontSize:12,fontFamily:W.sans,fontWeight:700,padding:0}}>+ Add override for {sec}</button>
            </div>);
          })}
        </>)}
      </div>
    </>);
  }

  // ── STEP: Review (shared) ─────────────────────────────────────────────────
  function StepReview() {
    const rows = [
      {icon:"🗂",bg:"#EEF2FF",label:"Group name",val:<span>{groupLabel.trim()||"Not set"}</span>,s:1},
      {icon:"📚",bg:W.greenL,label:"Sections",val:<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{sections.map(s=><span key={s} style={{background:W.blueL,color:W.blue,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,fontFamily:W.mono}}>{s}</span>)}</div>,s:1},
      {icon:"🕐",bg:W.greenL,label:"Time slots",val:<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{validSlots.map((s,i)=><span key={i} style={{background:W.greenL,color:W.green,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,fontFamily:W.mono}}>{fmtDisp(s.start)}–{fmtDisp(fmtEnd(s.start,s.dur))}</span>)}</div>,s:2},
    ];
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Looks good?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>Review the group before saving. Every section here will share the timetable below.</div>
      {rows.map(({icon,bg,label,val,s})=>(
        <div key={label} style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:12,marginBottom:8,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,color:W.textL,marginBottom:3}}>{label}</div>
            <div style={{fontSize:14,fontWeight:600,color:W.text}}>{val}</div>
          </div>
          <button onClick={()=>setStep(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:W.blue,fontWeight:600,fontFamily:W.sans,flexShrink:0,padding:"2px 0"}}>Edit</button>
        </div>
      ))}
      {isEdit&&<div style={{background:W.amberL,border:"1px solid #FCD34D",borderRadius:10,padding:"10px 14px",fontSize:13,color:W.amber,marginTop:4}}>⚠ Saving updates this group for all linked teachers. If any section name was changed, you'll review the rename before it goes live.</div>}
    </>);
  }

  // Map step number → component
  const STEPS = [null, StepSchoolSections, StepTimeSlots, StepReview];
  const renderStep = STEPS[step];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:950,display:"flex",alignItems:"stretch",justifyContent:"center",padding:12,backdropFilter:"blur(6px)",boxSizing:"border-box"}}>
      {quickRename && (
        <SectionQuickRenameModal
          term={sectionTerm}
          originalValue={quickRename.oldName}
          value={quickRename.nextValue}
          error={quickRenameError}
          onChange={nextValue=>{
            setQuickRenameError("");
            setQuickRename(curr=>curr ? { ...curr, nextValue } : curr);
          }}
          onClose={()=>{
            setQuickRename(null);
            setQuickRenameError("");
          }}
          onSave={confirmQuickRename}
        />
      )}
      {renameReview && (
        <SectionRenameReviewModal
          draft={renameReview.draft}
          selections={renameReview.selections}
          entityLabels={getInstituteEntityLabels(instType)}
          onChange={(oldSection, nextValue)=>setRenameReview(curr=>curr ? {
            ...curr,
            selections:{ ...curr.selections, [oldSection]: nextValue },
          } : curr)}
          onBack={()=>setRenameReview(null)}
          onConfirm={confirmRenameReview}
          busy={busy}
        />
      )}
      <div style={{background:W.surface,borderRadius:22,width:"100%",maxWidth:520,height:"100%",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>

        {/* Header */}
        <div style={{padding:"12px 16px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:12,color:W.textL,fontFamily:W.mono}}>{inst} · Timetable group</div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:W.textL,lineHeight:1}}>✕</button>
          </div>
          {/* Progress dots */}
          <div style={{display:"flex",alignItems:"center",marginBottom:10}}>
            {STEP_LABELS.map((label,i)=>{
              const n=i+1,state=n<step?"done":n===step?"active":"inactive";
              return (<React.Fragment key={n}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div onClick={()=>state!=="inactive"&&setStep(n)}
                    style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,fontFamily:"'Poppins',sans-serif",cursor:state!=="inactive"?"pointer":"default",transition:"all 0.2s",
                      background:state==="done"?"#1B8A4C":state==="active"?W.navy:W.border,
                      color:state==="inactive"?W.textL:"#fff",
                      boxShadow:state==="active"?"0 0 0 4px rgba(26,47,90,0.15)":"none"}}>
                    {state==="done"?"✓":n}
                  </div>
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,color:state==="active"?W.navy:W.textL,whiteSpace:"nowrap"}}>{label}</div>
                </div>
                {i<STEP_LABELS.length-1&&<div style={{flex:1,height:2,background:n<step?"#1B8A4C":W.border,margin:"0 4px 14px",transition:"background 0.3s"}}/>}
              </React.Fragment>);
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"0 16px 12px",minHeight:0}}>
          {error&&<div style={{background:W.redL,color:W.red,borderRadius:9,padding:"8px 12px",fontSize:13,marginBottom:14}}>{error}</div>}
          {/* Keep the current step mounted inline so mobile inputs do not lose focus on each keystroke. */}
          {renderStep&&renderStep()}
        </div>

        {/* Nav */}
        <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${W.border}`,display:"flex",gap:10,flexShrink:0}}>
          {step>1
            ?<button onClick={()=>{setStep(s=>s-1);setError("");}} style={{padding:"13px 20px",borderRadius:12,border:`1.5px solid ${W.border}`,background:W.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:W.textM,fontFamily:W.sans,flexShrink:0}}>← Back</button>
            :<button onClick={onClose} style={{padding:"13px 20px",borderRadius:12,border:`1.5px solid ${W.border}`,background:W.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:W.textM,fontFamily:W.sans,flexShrink:0}}>Cancel</button>
          }
          {step<TOTAL
            ?<button onClick={()=>{setError("");setStep(s=>s+1);}} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:W.navy,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:W.sans,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>Next →</button>
            :<button onClick={handleSave} disabled={busy} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:W.green,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:W.sans,opacity:busy?0.7:1}}>
              {busy?"Saving…":isEdit?"Save Changes":"✓ Save"}
            </button>
          }
        </div>
      </div>
    </div>
  );
}



// ── Daily Centre Summary ──────────────────────────────────────────────────────
function DailyCentreSummary({ institutes, teachers, fullData, instituteStats, onSelectInstitute }) {
  const [filter, setFilter] = React.useState("all");
  const [copied, setCopied] = React.useState(false);

  const rows = React.useMemo(() => {
    return institutes.map(inst => {
      const stats = instituteStats[inst] || { teacherCount: 0, classCount: 0 };
      // Use the same teacher-membership logic as instituteStats for consistency
      const instTeachers = teachers.filter(t => {
        const d = fullData[t.uid];
        const hasClassHere = d && (d.classes || []).some(c => sameInstituteName(c?.institute, inst));
        const listedHere = (t.institutes || []).some(i => sameInstituteName(i, inst));
        return hasClassHere || listedHere;
      });
      // Use instituteStats.teacherCount as the authoritative registered count
      const registered = stats.teacherCount || instTeachers.length;
      let weekEntries = 0;
      const todayUpdatedTeachers = instTeachers.filter(t => {
        const d = fullData[t.uid];
        if (!d) return false;
        return (d.classes || [])
          .filter(c => sameInstituteName(c?.institute, inst))
          .some(c => getEntriesInRange((d.notes || {})[c.id] || {}, 1).length > 0);
      }).length;
      instTeachers.forEach(t => {
        const d = fullData[t.uid];
        if (!d) return;
        const classesHere = (d.classes || []).filter(c => sameInstituteName(c?.institute, inst));
        classesHere.forEach(c => {
          const notes = (d.notes || {})[c.id] || {};
          weekEntries += getEntriesInRange(notes, 7).length;
        });
      });
      // Teachers who haven't filled any entry this week
      const notFilledThisWeek = instTeachers.filter(t => {
        const d = fullData[t.uid];
        if (!d) return true;
        const classesHere = (d.classes || []).filter(c => sameInstituteName(c?.institute, inst));
        return classesHere.every(c => getEntriesInRange((d.notes || {})[c.id] || {}, 7).length === 0);
      }).length;
      return { inst, registered, todayFilled: todayUpdatedTeachers, weekEntries, notFilledThisWeek };
    });
  }, [institutes, teachers, fullData, instituteStats]);

  const getStatus = row => {
    if (row.registered === 0) return "none";
    const p = row.todayFilled / row.registered;
    if (p >= 0.7) return "green";
    if (p >= 0.3) return "amber";
    return "red";
  };

  const visible = rows.filter(row => {
    const s = getStatus(row);
    if (filter === "all") return true;
    if (filter === "red") return s === "red" || s === "none";
    if (filter === "green") return s === "green";
    if (filter === "low") return row.registered === 0;
    return true;
  });

  const totalReg = rows.reduce((s, r) => s + r.registered, 0);
  const totalFilled = rows.reduce((s, r) => s + r.todayFilled, 0);
  const compPct = totalReg > 0 ? Math.round(totalFilled / totalReg * 100) : 0;
  const onTrackCount = rows.filter(r => getStatus(r) === "green").length;

  const dotColor = row => {
    const s = getStatus(row);
    return s === "green" ? "#16a34a" : s === "amber" ? "#b45309" : s === "red" ? "#C93030" : "#9ca3af";
  };
  const barColor = pct => pct >= 0.7 ? "#16a34a" : pct >= 0.3 ? "#b45309" : "#C93030";

  const handleCopy = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const lines = [`*Daily centre summary — ${dateStr}*\n`];
    const behind = rows.filter(r => { const s = getStatus(r); return s === "red" || s === "none"; });
    const good = rows.filter(r => getStatus(r) === "green");
    if (good.length) lines.push(`*Doing well:*\n${good.map(r => `✅ ${r.inst} — ${r.todayFilled}/${r.registered} teachers filled`).join("\n")}`);
    if (behind.length) lines.push(`\n*Needs follow-up:*\n${behind.map(r => `${r.registered === 0 ? "⭕" : "🔴"} ${r.inst} — ${r.registered === 0 ? "0 registered" : `${r.todayFilled}/${r.registered} filled today, ${r.notFilledThisWeek} not filled this week`}`).join("\n")}`);
    lines.push(`\n_Overall: ${totalFilled}/${totalReg} teachers updated today (${compPct}%)_`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const chipStyle = (active) => ({
    fontSize: 12, padding: "4px 12px", borderRadius: 999,
    border: `1px solid ${active ? G.borderM : G.border}`,
    background: active ? G.surface : "transparent",
    color: active ? G.text : G.textM,
    cursor: "pointer", fontFamily: G.sans, fontWeight: active ? 600 : 400,
    display: "inline-flex", alignItems: "center", gap: 5,
  });

  const filterBtns = [
    { key: "all", label: "All centres" },
    { key: "red", label: "Needs attention" },
    { key: "green", label: "On track" },
    { key: "low", label: "Not registered" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: G.text, fontFamily: G.display }}>Daily centre summary</div>
          <div style={{ fontSize: 14, color: G.textM, marginTop: 4 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <button
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: copied ? "#ECFDF5" : G.navy,
            color: copied ? "#166534" : "#fff",
            border: "none", borderRadius: 10, padding: "9px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: G.sans,
            transition: "all 0.2s",
          }}>
          {copied ? "✓ Copied!" : "Copy WhatsApp report"}
        </button>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        {[
          { label: "Total centres", value: institutes.length, sub: "across all regions" },
          { label: "Teachers on app", value: totalReg, sub: `of ${teachers.length} total` },
          { label: "Updated today", value: totalFilled, sub: `${compPct}% compliance` },
          { label: "Centres on track", value: onTrackCount, sub: "≥70% filled today" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: "12px 14px", boxShadow: G.shadowSm }}>
            <div style={{ fontSize: 11, color: G.textL, fontFamily: G.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: G.blue, fontFamily: G.display, marginTop: 4, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 12, color: G.textM, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {filterBtns.map(({ key, label }) => (
          <button key={key} style={chipStyle(filter === key)} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, overflow: "hidden", boxShadow: G.shadowSm }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              {["", "Centre", "Registered", "Today's entries", "This week", "Not filled (wk)", "Status"].map((h, i) => (
                <th key={i} style={{
                  fontSize: 11, fontWeight: 700, color: G.textM, padding: "8px 10px",
                  textAlign: i >= 2 && i !== 3 ? "right" : "left",
                  fontFamily: G.mono, textTransform: "uppercase", letterSpacing: 0.5,
                  background: G.bg, whiteSpace: "nowrap",
                  width: i === 0 ? 36 : "auto",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: G.textM, fontSize: 14 }}>No centres match this filter</td></tr>
            ) : visible.map(row => {
              const pct = row.registered > 0 ? row.todayFilled / row.registered : 0;
              const barW = Math.round(pct * 100);
              const filledPct = row.registered > 0 ? Math.round(pct * 100) : 0;
              const s = getStatus(row);
              return (
                <tr key={row.inst}
                  onClick={() => onSelectInstitute(row.inst)}
                  style={{ borderBottom: `1px solid ${G.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = G.bg)}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                >
                  <td style={{ paddingLeft: 14, width: 36 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(row) }} />
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{row.inst}</div>
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{row.registered}</div>
                  </td>
                  <td style={{ padding: "12px 10px", minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: G.bg, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ height: "100%", width: `${barW}%`, borderRadius: 999, background: barColor(pct) }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: "right", color: G.text }}>
                        {row.todayFilled}/{row.registered}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: G.textL, marginTop: 3, paddingLeft: 2 }}>{filledPct}% filled today</div>
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right", fontSize: 14, fontWeight: 600, color: G.text }}>{row.weekEntries}</td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    {row.notFilledThisWeek > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: G.red }}>{row.notFilledThisWeek}</span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    {s === "none" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.bg, color: G.textM, fontWeight: 700, border: `1px solid ${G.border}` }}>No activity</span>}
                    {s === "green" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#DCFCE7", color: "#166534", fontWeight: 700 }}>✓ On track</span>}
                    {s === "amber" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.amberL, color: G.amber, fontWeight: 700 }}>Partial</span>}
                    {s === "red" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.redL, color: G.red, fontWeight: 700 }}>Behind</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${G.border}`, fontSize: 12, color: G.textL, fontFamily: G.mono }}>
          Click any row to drill into that institute
        </div>
      </div>
    </div>
  );
}

function FeedbackInboxModal({
  threads,
  selectedUid,
  messages,
  reply,
  busy,
  onSelect,
  onReplyChange,
  onSend,
  onToggleResolved,
  onClose,
}){
  const selected = threads.find(item=>item.id===selectedUid) || null;
  const fmt = value => value
    ? new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(value))
    : "";
  return (
    <div style={{position:"fixed",inset:0,zIndex:750,background:"rgba(5,12,27,0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(5px)"}}>
      <style>{`
        @media (max-width: 700px) {
          .feedback-inbox-grid { grid-template-columns: 1fr !important; grid-template-rows: minmax(150px, 34%) minmax(0, 66%); }
          .feedback-thread-list { border-right: 0 !important; border-bottom: 1px solid ${G.border}; }
        }
      `}</style>
      <div style={{width:"min(980px,100%)",height:"min(720px,calc(100vh - 32px))",background:G.surface,borderRadius:20,border:`1px solid ${G.border}`,boxShadow:"0 28px 80px rgba(0,0,0,0.34)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"16px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div>
            <div style={{fontFamily:G.display,fontSize:20,fontWeight:800,color:G.text}}>Teacher feedback</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Issues, feedback, and replies in one conversation per teacher.</div>
          </div>
          <button onClick={onClose} aria-label="Close feedback inbox" style={{width:38,height:38,borderRadius:12,border:`1px solid ${G.border}`,background:G.bg,color:G.text,fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div className="feedback-inbox-grid" style={{display:"grid",gridTemplateColumns:"minmax(240px,34%) minmax(0,1fr)",flex:1,minHeight:0}}>
          <div className="feedback-thread-list" style={{borderRight:`1px solid ${G.border}`,overflowY:"auto",background:G.bg,padding:10}}>
            {threads.length===0&&(
              <div style={{padding:"38px 18px",textAlign:"center",color:G.textM,fontSize:13,lineHeight:1.6}}>No teacher feedback has arrived yet.</div>
            )}
            {threads.map(thread=>{
              const active=thread.id===selectedUid;
              const unread=Number(thread.unreadByAdmin||0);
              return (
                <button key={thread.id} onClick={()=>onSelect(thread.id)} style={{width:"100%",border:active?`1px solid ${G.blueV}`:`1px solid ${G.border}`,background:active?G.blueL:G.surface,borderRadius:14,padding:"12px 13px",marginBottom:8,textAlign:"left",cursor:"pointer",fontFamily:G.sans}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontWeight:800,fontSize:13.5,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{thread.teacherName||"Teacher"}</div>
                    {unread>0&&<span style={{minWidth:22,height:22,borderRadius:999,background:G.blue,color:"#fff",fontSize:10.5,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 6px"}}>{unread>9?"9+":unread}</span>}
                  </div>
                  <div style={{fontSize:11.5,color:G.textM,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thread.teacherEmail||thread.institutes?.join(", ")||"Teacher account"}</div>
                  <div style={{fontSize:12,color:G.textS,marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thread.lastMessage||"Conversation started"}</div>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:8,fontSize:10.5,color:G.textL}}>
                    <span>{fmt(thread.updatedAt)}</span>
                    <span style={{fontWeight:700,color:thread.status==="resolved"?"#15803D":G.amber}}>{thread.status==="resolved"?"Resolved":"Open"}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",flexDirection:"column",minWidth:0,minHeight:0}}>
            {!selected?(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:30,textAlign:"center",color:G.textM}}>
                Select a teacher conversation.
              </div>
            ):(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"13px 16px",borderBottom:`1px solid ${G.border}`}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,color:G.text,fontSize:14.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.teacherName||"Teacher"}</div>
                    <div style={{fontSize:11.5,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.institutes?.join(", ")||selected.teacherEmail||""}</div>
                  </div>
                  <button disabled={busy} onClick={()=>onToggleResolved(selected)} style={{border:`1px solid ${selected.status==="resolved"?"#86EFAC":G.border}`,background:selected.status==="resolved"?"#F0FDF4":G.bg,color:selected.status==="resolved"?"#15803D":G.textS,borderRadius:10,padding:"7px 10px",fontSize:11.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {selected.status==="resolved"?"Reopen":"Mark resolved"}
                  </button>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:16,background:"#F8FAFC"}}>
                  {messages.length===0&&<div style={{textAlign:"center",color:G.textM,fontSize:13,padding:30}}>Loading conversation…</div>}
                  {messages.map(message=>{
                    const admin=message.senderRole==="admin";
                    return (
                      <div key={message.id} style={{display:"flex",justifyContent:admin?"flex-end":"flex-start",marginBottom:10}}>
                        <div style={{maxWidth:"78%",background:admin?G.navy:"#FFFFFF",color:admin?"#FFFFFF":G.text,border:admin?"none":`1px solid ${G.border}`,borderRadius:admin?"17px 17px 5px 17px":"17px 17px 17px 5px",padding:"10px 12px"}}>
                          <div style={{fontSize:10.5,fontWeight:700,opacity:0.68,marginBottom:4}}>{admin?"You":message.senderName||selected.teacherName||"Teacher"}</div>
                          <div style={{fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</div>
                          <div style={{fontSize:10,opacity:0.58,marginTop:6}}>{fmt(message.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={event=>{event.preventDefault();onSend();}} style={{padding:13,borderTop:`1px solid ${G.border}`,background:G.surface}}>
                  <textarea value={reply} onChange={event=>onReplyChange(event.target.value.slice(0,2000))} rows={3} placeholder="Reply to this teacher…" style={{width:"100%",resize:"none",border:`1px solid ${G.borderM}`,borderRadius:12,padding:"10px 12px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none",boxSizing:"border-box"}}/>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:8}}>
                    <span style={{fontSize:10.5,color:G.textL}}>{reply.length}/2000</span>
                    <button type="submit" disabled={busy||!reply.trim()} style={{display:"inline-flex",alignItems:"center",gap:7,border:0,borderRadius:10,padding:"9px 14px",background:busy||!reply.trim()?G.borderM:G.blue,color:"#fff",fontWeight:800,fontSize:12.5,cursor:busy?"wait":"pointer"}}>
                      <AppIcon icon={IconSend} size={15} color="#fff"/>{busy?"Sending…":"Send reply"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function makeSyllabusLocalId(prefix){
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  return `${prefix}-${random}`;
}

function currentAcademicYearLabel(){
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function normaliseSyllabusScope(scope, fallbackInstitute = "", fallbackSection = ""){
  const grouped = new Map();
  (Array.isArray(scope)?scope:[]).forEach(item=>{
    const instituteName=String(item?.instituteName||"").trim();
    if(!instituteName) return;
    const key=instituteName.toLowerCase();
    const current=grouped.get(key)||{instituteName,sectionNames:[]};
    const values=Array.isArray(item?.sectionNames)?item.sectionNames:[item?.sectionName];
    values.forEach(value=>{
      const sectionName=String(value||"").trim();
      if(sectionName&&!current.sectionNames.some(existing=>existing.toLowerCase()===sectionName.toLowerCase())){
        current.sectionNames.push(sectionName);
      }
    });
    grouped.set(key,current);
  });
  const instituteName=String(fallbackInstitute||"").trim();
  const sectionName=String(fallbackSection||"").trim();
  if(!grouped.size&&instituteName&&sectionName){
    grouped.set(instituteName.toLowerCase(),{instituteName,sectionNames:[sectionName]});
  }
  return [...grouped.values()]
    .map(item=>({...item,sectionNames:[...item.sectionNames].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base"}))}))
    .filter(item=>item.sectionNames.length)
    .sort((a,b)=>a.instituteName.localeCompare(b.instituteName,undefined,{sensitivity:"base"}));
}

function syllabusScopePairs(scope){
  return normaliseSyllabusScope(scope).flatMap(item=>
    item.sectionNames.map(sectionName=>({instituteName:item.instituteName,sectionName}))
  );
}

function syllabusScopeKey(scope){
  return syllabusScopePairs(scope)
    .map(item=>`${item.instituteName.trim().toLowerCase()}::${item.sectionName.trim().toLowerCase()}`)
    .sort()
    .join("|");
}

function syllabusTemplateScope(template){
  const draft=template?.draft||template||{};
  return normaliseSyllabusScope(draft.scope,draft.instituteName, draft.sectionName);
}

function emptySyllabusDraft(subject){
  return {
    id:"",
    subjectId:subject.id,
    subjectName:subject.name,
    status:"draft",
    currentVersion:0,
    draft:{
      name:"",
      instituteName:"",
      sectionName:"",
      scope:[],
      academicYear:currentAcademicYearLabel(),
      curriculum:"",
      gradeLabel:"",
      chapters:[],
      targets:[],
    },
    published:null,
  };
}

function SyllabusBuilder({
  subject,
  templates,
  institutes,
  instituteSections,
  initialInstitute = "",
  initialSection = "",
  initialScope = [],
  initialTargets = [],
  simpleScope = false,
  getAffectedSummary,
  busy,
  isMobile,
  onClose,
  onSave,
  onPublish,
  onDelete,
}){
  const resolvedInitialScope = useMemo(
    ()=>normaliseSyllabusScope(initialScope,initialInstitute,initialSection),
    [initialScope,initialInstitute,initialSection],
  );
  const resolvedInitialScopeKey = useMemo(()=>syllabusScopeKey(resolvedInitialScope),[resolvedInitialScope]);
  const subjectTemplates = useMemo(
    ()=>templates
      .filter(item=>
        item.subjectId===subject.id
        && (
          !simpleScope
          || syllabusScopeKey(syllabusTemplateScope(item))===resolvedInitialScopeKey
        )
      )
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)),
    [templates,subject.id,simpleScope,resolvedInitialScopeKey],
  );
  const scopedTemplate = subjectTemplates.find(item=>syllabusScopeKey(syllabusTemplateScope(item))===resolvedInitialScopeKey);
  const firstInitialScope=resolvedInitialScope[0]||{instituteName:initialInstitute,sectionNames:[initialSection].filter(Boolean)};
  const newScopedTemplate = {
    ...emptySyllabusDraft(subject),
    draft:{
      ...emptySyllabusDraft(subject).draft,
      instituteName:firstInitialScope.instituteName||"",
      sectionName:firstInitialScope.sectionNames?.[0]||"",
      scope:resolvedInitialScope,
      name:`${subject.name} syllabus`,
      curriculum:"General",
      gradeLabel:firstInitialScope.sectionNames?.[0]||"",
      targets:initialTargets,
    },
  };
  const initialTemplate = scopedTemplate
    ? {
        ...scopedTemplate,
        draft:{
          ...scopedTemplate.draft,
          scope:resolvedInitialScope,
          targets:initialTargets,
        },
      }
    : ((initialInstitute&&initialSection ? newScopedTemplate : subjectTemplates[0]) || newScopedTemplate);
  const [working,setWorking] = useState(initialTemplate);
  const [selectedId,setSelectedId] = useState(initialTemplate.id || "__new");
  const [chapterInput,setChapterInput] = useState("");
  const [topicInputs,setTopicInputs] = useState({});
  const [showBulkChapterInput,setShowBulkChapterInput] = useState(false);
  const [bulkChapterInput,setBulkChapterInput] = useState("");

  const draft = working.draft || emptySyllabusDraft(subject).draft;
  const draftScope=normaliseSyllabusScope(draft.scope,draft.instituteName,draft.sectionName);
  const selectedInstituteConfig = getInstituteSectionConfig(instituteSections,draft.instituteName) || {};
  const sectionOptions = uniqueSectionNames([
    ...(selectedInstituteConfig.gradeGroups||[]).flatMap(group=>group.sections||[]),
    ...(selectedInstituteConfig.extraSections||[]),
  ]);
  const scopeReady = draftScope.length>0;
  const affectedSummary = getAffectedSummary(draftScope,subject);
  const fieldStyle = {
    width:"100%",boxSizing:"border-box",border:`1.5px solid ${G.borderM}`,borderRadius:10,
    padding:"11px 13px",fontSize:14,fontFamily:G.sans,fontWeight:650,color:G.text,
    background:"#FFFFFF",outline:"none",
  };
  const labelStyle = {fontSize:11.5,fontWeight:800,color:G.textM,textTransform:"uppercase",letterSpacing:0.7,marginBottom:6};
  const updateDraft = patch => setWorking(current=>({
    ...current,
    subjectId:subject.id,
    subjectName:subject.name,
    draft:{...current.draft,...patch},
  }));
  const chooseInstitute = instituteName => updateDraft({
    instituteName,
    sectionName:"",
  });
  const updateChapter = (chapterId,patch) => updateDraft({
    chapters:draft.chapters.map(chapter=>chapter.id===chapterId?{...chapter,...patch}:chapter),
  });
  const chooseTemplate = value => {
    setSelectedId(value);
    const selectedTemplate = subjectTemplates.find(item=>item.id===value);
    const next = value==="__new"
      ? {
          ...emptySyllabusDraft(subject),
          draft:{
            ...emptySyllabusDraft(subject).draft,
            instituteName:firstInitialScope.instituteName||"",
            sectionName:firstInitialScope.sectionNames?.[0]||"",
            scope:resolvedInitialScope,
            name:`${subject.name} syllabus`,
            curriculum:"General",
            gradeLabel:firstInitialScope.sectionNames?.[0]||"",
            targets:initialTargets,
          },
        }
      : selectedTemplate
        ? {
            ...selectedTemplate,
            draft:{
              ...selectedTemplate.draft,
              scope:resolvedInitialScope,
              targets:initialTargets,
            },
          }
        : emptySyllabusDraft(subject);
    setWorking(next);
    setChapterInput("");
    setTopicInputs({});
    setShowBulkChapterInput(false);
    setBulkChapterInput("");
  };
  const addChapter = () => {
    const title = chapterInput.trim();
    if(!title) return;
    const chapter = {
      id:makeSyllabusLocalId("chapter"),
      title,
      topics:[],
    };
    updateDraft({chapters:[...draft.chapters,chapter]});
    setChapterInput("");
  };
  const addBulkChapters = () => {
    const titles = bulkChapterInput
      .split(/\r?\n|;/)
      .map(item=>item.trim())
      .filter(Boolean);
    if(!titles.length) return;
    const knownTitles = new Set(
      draft.chapters
        .map(chapter=>String(chapter?.title || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const nextChapters = [...draft.chapters];
    titles.forEach(title => {
      const key = title.toLowerCase();
      if(knownTitles.has(key)) return;
      knownTitles.add(key);
      nextChapters.push({
        id:makeSyllabusLocalId("chapter"),
        title,
        topics:[],
      });
    });
    updateDraft({ chapters:nextChapters });
    setBulkChapterInput("");
    setShowBulkChapterInput(false);
  };
  const moveChapter = (index,direction) => {
    const nextIndex = index + direction;
    if(nextIndex<0 || nextIndex>=draft.chapters.length) return;
    const next=[...draft.chapters];
    [next[index],next[nextIndex]]=[next[nextIndex],next[index]];
    updateDraft({chapters:next});
  };
  const removeChapter = chapterId => {
    if(!window.confirm("Remove this chapter from the draft?")) return;
    updateDraft({chapters:draft.chapters.filter(chapter=>chapter.id!==chapterId)});
  };
  const addTopic = chapter => {
    const title = String(topicInputs[chapter.id]||"").trim();
    if(!title) return;
    updateChapter(chapter.id,{
      topics:[...(chapter.topics||[]),{id:makeSyllabusLocalId("topic"),title}],
    });
    setTopicInputs(current=>({...current,[chapter.id]:""}));
  };
  const totalTopics = draft.chapters.reduce((sum,chapter)=>sum+(chapter.topics||[]).filter(topic=>topic.title.trim()).length,0);
  const save = async () => {
    const saved = await onSave(working);
    if(saved){
      setWorking(saved);
      setSelectedId(saved.id);
    }
    return saved;
  };
  const publish = async () => {
    if(!window.confirm("Publish this syllabus version? The published history will remain permanent.")) return;
    const saved = await save();
    if(!saved) return;
    const published = await onPublish(saved.id);
    if(published) setWorking(published);
  };
  const removeSyllabus = async () => {
    if(!working.id || !onDelete) return;
    if(!window.confirm("Delete this syllabus, its published copy, and all saved versions permanently?")) return;
    const removed = await onDelete(working.id);
    if(!removed) return;
    setWorking(newScopedTemplate);
    setSelectedId("__new");
    setChapterInput("");
    setTopicInputs({});
    setShowBulkChapterInput(false);
    setBulkChapterInput("");
  };

  return (
    <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",marginBottom:24}}>
      <div style={{padding:isMobile?"16px":"20px 22px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
          <div style={{minWidth:0}}>
            <button onClick={onClose} style={{...pill("#FFFFFF",G.textS,G.border),padding:"7px 11px",marginBottom:13}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconChevronLeft} size={15}/> Subjects</span>
            </button>
            <div style={{fontSize:isMobile?23:28,fontWeight:850,color:G.text,fontFamily:G.display,lineHeight:1.15}}>Syllabus builder</div>
            <div style={{fontSize:16,fontWeight:750,color:G.blue,marginTop:5}}>{subject.name}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{...pill(working.currentVersion?"#E8F7EF":"#FFF7E6",working.currentVersion?"#137A45":"#9A5A00",working.currentVersion?"#B9E5CA":"#F1D49A"),cursor:"default",fontWeight:750}}>
              {working.currentVersion?`Published v${working.currentVersion}`:"Draft only"}
            </span>
            <span style={{...pill("#EEF4FF",G.navy,"#C7D7F5"),cursor:"default",fontWeight:750}}>
              {draft.chapters.length} chapters · {totalTopics} topics
            </span>
          </div>
        </div>
      </div>

      <div style={{padding:isMobile?"16px":"22px"}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
          {subjectTemplates.length>0&&(
            <div style={{flex:"1 1 320px"}}>
              <div style={labelStyle}>Saved syllabus</div>
              <select value={selectedId} onChange={event=>chooseTemplate(event.target.value)} style={fieldStyle}>
                <option value="__new">Create a fresh syllabus</option>
                {subjectTemplates.map(item=>(
                  <option key={item.id} value={item.id}>
                    {item.draft.name || item.name || `${subject.name} syllabus`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{flex:"1 1 260px",padding:"11px 13px",border:`1px solid ${G.border}`,borderRadius:10,background:"#F8FAFD"}}>
            <div style={labelStyle}>Syllabus</div>
            <div style={{fontSize:14,fontWeight:850,color:G.text}}>{draft.name||`${subject.name} syllabus`}</div>
          </div>
          {working.id&&(
            <button onClick={removeSyllabus} disabled={busy} style={{...pill(G.redL,G.red,"#F5CACA"),padding:"10px 13px",fontWeight:800}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:7}}><AppIcon icon={IconTrash} size={16}/> Delete syllabus</span>
            </button>
          )}
        </div>

        {!simpleScope&&<div style={{marginTop:16,padding:isMobile?"14px":"16px",background:"#F3F7FD",border:`1px solid ${G.border}`,borderRadius:12}}>
          <div style={{fontSize:17,fontWeight:850,color:G.text,fontFamily:G.display}}>Choose where this syllabus applies</div>
          <div style={{fontSize:13,color:G.textM,lineHeight:1.5,marginTop:3,marginBottom:13}}>
            Select an existing institute first, then one of its admin-defined sections.
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(220px,1fr))",gap:12}}>
            <div>
              <div style={labelStyle}>Institute</div>
              <select value={draft.instituteName||""} onChange={event=>chooseInstitute(event.target.value)} style={fieldStyle}>
                <option value="">Select institute</option>
                {institutes.map(institute=><option key={institute} value={institute}>{institute}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Section</div>
              <select value={draft.sectionName||""} onChange={event=>updateDraft({sectionName:event.target.value})} disabled={!draft.instituteName||sectionOptions.length===0} style={{...fieldStyle,opacity:!draft.instituteName||sectionOptions.length===0?0.55:1}}>
                <option value="">{!draft.instituteName?"Select institute first":sectionOptions.length?"Select section":"No configured sections"}</option>
                {sectionOptions.map(section=><option key={section} value={section}>{section}</option>)}
              </select>
              {draft.instituteName&&sectionOptions.length===0&&(
                <div style={{fontSize:12,color:G.red,marginTop:6}}>Create sections for this institute in Control Centre → Sections first.</div>
              )}
            </div>
          </div>
        </div>}

        {simpleScope&&(
          <div style={{marginTop:16,padding:"12px 14px",background:"#F3F7FD",border:`1px solid ${G.border}`,borderRadius:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:850,color:G.textM,textTransform:"uppercase",letterSpacing:0.7}}>Applies to</span>
              <span style={{...pill(G.blueL,G.blue,"#B8CCF7"),cursor:"default",fontWeight:800}}>{subject.name}</span>
              <span style={{fontSize:12.5,fontWeight:750,color:G.textM}}>
                {draftScope.length} institute{draftScope.length===1?"":"s"} · {syllabusScopePairs(draftScope).length} section{syllabusScopePairs(draftScope).length===1?"":"s"}
              </span>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:9}}>
              {draftScope.map(item=>(
                <span key={item.instituteName} title={item.sectionNames.join(", ")} style={{...pill("#FFFFFF",G.navy,G.borderM),cursor:"default",fontWeight:750}}>
                  {item.instituteName} · {item.sectionNames.join(", ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {simpleScope&&initialTargets.length>0&&(
          <div style={{marginTop:12,padding:"12px 14px",background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:14,fontWeight:850,color:G.text}}>Matching teachers and classes</div>
                <div style={{fontSize:12,color:G.textM,marginTop:3}}>Publishing binds this syllabus to these existing class records.</div>
              </div>
              <span style={{...pill("#E8F7EF","#137A45","#B9E5CA"),cursor:"default",fontWeight:800}}>{initialTargets.length} class{initialTargets.length===1?"":"es"}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8,marginTop:11}}>
              {initialTargets.map(target=>(
                <div key={`${target.teacherUid}::${target.classId}`} style={{padding:"10px 11px",border:`1px solid ${G.border}`,borderRadius:10,background:"#F8FAFD",minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:850,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{target.teacherName||"Teacher"}</div>
                  <div style={{fontSize:11.5,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{target.instituteName} · {target.sectionName}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!scopeReady ? (
          <div style={{marginTop:16,border:`2px dashed ${G.borderM}`,borderRadius:12,padding:"28px 18px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:G.text}}>Select at least one institute and section.</div>
            <div style={{fontSize:13,color:G.textM,marginTop:5}}>The chapter builder will appear after the syllabus scope is selected.</div>
          </div>
        ) : (<>
        {!simpleScope&&<>
        <div style={{fontSize:17,fontWeight:850,color:G.text,fontFamily:G.display,marginTop:18,marginBottom:10}}>Add syllabus details</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(150px,1fr))",gap:12,alignItems:"end",marginTop:16}}>
          <div>
            <div style={labelStyle}>Academic year</div>
            <input value={draft.academicYear} onChange={event=>updateDraft({academicYear:event.target.value})} placeholder="2026-27" style={fieldStyle}/>
          </div>
          <div>
            <div style={labelStyle}>Curriculum / board</div>
            <input value={draft.curriculum} onChange={event=>updateDraft({curriculum:event.target.value})} placeholder="CBSE, UPSC, State Board" style={fieldStyle}/>
          </div>
          <div>
            <div style={labelStyle}>Grade / course / programme</div>
            <input value={draft.gradeLabel} onChange={event=>updateDraft({gradeLabel:event.target.value})} placeholder="Class 11, NDA, Foundation" style={fieldStyle}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10,marginTop:16,padding:"13px 15px",background:"#F8FAFD",border:`1px solid ${G.border}`,borderRadius:11}}>
          <div><div style={labelStyle}>Affected classes</div><div style={{fontSize:20,fontWeight:850,color:G.text}}>{affectedSummary.classCount}</div></div>
          <div><div style={labelStyle}>Institutes</div><div style={{fontSize:20,fontWeight:850,color:G.text}}>{affectedSummary.instituteCount}</div></div>
          <div><div style={labelStyle}>Teachers</div><div style={{fontSize:20,fontWeight:850,color:G.text}}>{affectedSummary.teacherCount}</div></div>
        </div>
        {affectedSummary.classes.length>0&&(
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:9}}>
            {affectedSummary.classes.slice(0,8).map(item=>(
              <span key={item} title={item} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:700,color:G.textS}}>
                {item}
              </span>
            ))}
            {affectedSummary.classes.length>8&&(
              <span style={{background:"#EEF4FF",border:"1px solid #C7D7F5",borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:800,color:G.blue}}>
                +{affectedSummary.classes.length-8} more
              </span>
            )}
          </div>
        )}
        </>}

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:24,marginBottom:12}}>
          <div>
            <div style={{fontSize:19,fontWeight:850,color:G.text,fontFamily:G.display}}>Chapters</div>
            <div style={{fontSize:13,color:G.textM,marginTop:3}}>Add one chapter quickly, or paste the full chapter list at once.</div>
          </div>
          <button
            onClick={()=>setShowBulkChapterInput(current=>!current)}
            style={{...pill(showBulkChapterInput?G.navy:"#FFFFFF",showBulkChapterInput?"#FFFFFF":G.textS,showBulkChapterInput?G.navy:G.borderM),padding:"8px 12px",fontSize:12.5,fontWeight:800}}
          >
            {showBulkChapterInput ? "Hide paste list" : "Paste chapter list"}
          </button>
        </div>

        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:9,alignItems:"stretch",marginBottom:12}}>
          <input
            value={chapterInput}
            onChange={event=>setChapterInput(event.target.value)}
            onKeyDown={event=>{
              if(event.key==="Enter"){
                event.preventDefault();
                addChapter();
              }
            }}
            placeholder="Write a chapter name"
            style={{...fieldStyle,flex:1}}
          />
          <button onClick={addChapter} disabled={!chapterInput.trim()} style={{...pill(chapterInput.trim()?G.navy:G.bg,"#FFFFFF",chapterInput.trim()?G.navy:G.border),padding:"10px 13px",fontWeight:750,whiteSpace:"nowrap",minHeight:isMobile?44:undefined}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:7}}><AppIcon icon={IconPlus} size={16}/> Add</span>
          </button>
        </div>

        {showBulkChapterInput&&(
          <div style={{marginBottom:12,padding:"12px 13px",border:`1px solid ${G.border}`,borderRadius:12,background:"#F8FAFD"}}>
            <div style={{fontSize:12,fontWeight:800,color:G.text,fontFamily:G.sans,marginBottom:6}}>Paste one chapter per line</div>
            <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginBottom:10}}>
              Useful when you already have the chapter list. Duplicate titles are skipped automatically.
            </div>
            <textarea
              value={bulkChapterInput}
              onChange={event=>setBulkChapterInput(event.target.value)}
              placeholder={"Chapter 1\nChapter 2\nChapter 3"}
              style={{...fieldStyle,minHeight:118,resize:"vertical",lineHeight:1.5}}
            />
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>{setBulkChapterInput("");setShowBulkChapterInput(false);}} style={{...pill("#FFFFFF",G.textS,G.borderM),padding:"9px 12px",fontWeight:750}}>
                Cancel
              </button>
              <button onClick={addBulkChapters} disabled={!bulkChapterInput.trim()} style={{...pill(bulkChapterInput.trim()?G.navy:G.bg,"#FFFFFF",bulkChapterInput.trim()?G.navy:G.border),padding:"9px 12px",fontWeight:800}}>
                Add all chapters
              </button>
            </div>
          </div>
        )}

        {draft.chapters.length===0 ? (
          <div style={{border:`2px dashed ${G.borderM}`,borderRadius:12,padding:"30px 18px",textAlign:"center",color:G.textM}}>
            Add the first chapter to begin this syllabus.
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {draft.chapters.map((chapter,index)=>{
              return (
                <div key={chapter.id} style={{border:`1.5px solid ${G.border}`,borderRadius:12,background:"#FFFFFF",padding:"12px 13px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:isMobile?"wrap":"nowrap"}}>
                    <div style={{width:34,height:34,borderRadius:10,background:G.navy,color:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:850,flexShrink:0}}>{index+1}</div>
                    <input value={chapter.title} onChange={event=>updateChapter(chapter.id,{title:event.target.value})} aria-label={`Chapter ${index+1} title`} style={{...fieldStyle,flex:1,minWidth:isMobile?"calc(100% - 44px)":0,padding:"9px 11px"}}/>
                    <div style={{display:"flex",gap:7,marginLeft:isMobile?44:0}}>
                      <button title="Move up" onClick={()=>moveChapter(index,-1)} disabled={index===0} style={{...pill("#FFFFFF",G.textM,G.border),padding:7,opacity:index===0?0.4:1}}><AppIcon icon={IconArrowUp} size={15}/></button>
                      <button title="Move down" onClick={()=>moveChapter(index,1)} disabled={index===draft.chapters.length-1} style={{...pill("#FFFFFF",G.textM,G.border),padding:7,opacity:index===draft.chapters.length-1?0.4:1}}><AppIcon icon={IconArrowDown} size={15}/></button>
                      <button title="Delete chapter" onClick={()=>removeChapter(chapter.id)} style={{...pill(G.redL,G.red,"#F5CACA"),padding:7}}><AppIcon icon={IconTrash} size={15}/></button>
                    </div>
                  </div>
                  <div style={{marginLeft:isMobile?0:44,marginTop:10,paddingTop:10,borderTop:`1px solid ${G.border}`}}>
                    {(chapter.topics||[]).length>0&&(
                      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:9}}>
                        {chapter.topics.map((topic,topicIndex)=>(
                          <span key={topic.id} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#F3F7FD",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 7px 5px 10px",fontSize:12.5,fontWeight:700,color:G.textS}}>
                            {topicIndex+1}. {topic.title}
                            <button title="Remove topic" onClick={()=>updateChapter(chapter.id,{topics:chapter.topics.filter(item=>item.id!==topic.id)})} style={{border:"none",background:"transparent",color:G.red,cursor:"pointer",padding:1,display:"inline-flex"}}><AppIcon icon={IconX} size={13}/></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:8}}>
                      <input
                        value={topicInputs[chapter.id]||""}
                        onChange={event=>setTopicInputs(current=>({...current,[chapter.id]:event.target.value}))}
                        onKeyDown={event=>{
                          if(event.key==="Enter"){
                            event.preventDefault();
                            addTopic(chapter);
                          }
                        }}
                        placeholder="Add a topic (optional)"
                        style={{...fieldStyle,flex:1,padding:"8px 10px",fontSize:13}}
                      />
                      <button onClick={()=>addTopic(chapter)} disabled={!String(topicInputs[chapter.id]||"").trim()} style={{...pill("#EEF4FF",G.blue,"#C7D7F5"),padding:"9px 10px",fontSize:12,fontWeight:750,minHeight:isMobile?42:undefined}}>Add topic</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:12,flexWrap:"wrap",marginTop:20,paddingTop:18,borderTop:`1px solid ${G.border}`}}>
          <div style={{fontSize:12.5,color:G.textM,maxWidth:520,lineHeight:1.5}}>
            Saving updates the private draft. Publishing creates a permanent version and makes it available for future teacher syllabus views.
          </div>
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:9,flexWrap:"wrap",width:isMobile?"100%":"auto"}}>
            <button onClick={save} disabled={busy} style={{...pill("#FFFFFF",G.navy,G.borderM),padding:"11px 15px",fontWeight:800,minHeight:isMobile?46:undefined,width:isMobile?"100%":"auto",justifyContent:"center"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:7}}><AppIcon icon={IconDeviceFloppy} size={16}/>{busy?"Saving...":"Save draft"}</span>
            </button>
            <button onClick={publish} disabled={busy||!draft.chapters.length} style={{...pill(draft.chapters.length?"#16845B":G.bg,"#FFFFFF",draft.chapters.length?"#16845B":G.border),padding:"11px 15px",fontWeight:800,minHeight:isMobile?46:undefined,width:isMobile?"100%":"auto",justifyContent:"center"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:7}}><AppIcon icon={IconCheck} size={16}/> Publish version</span>
            </button>
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}

function SimpleSyllabusFlow({
  institutes,
  instituteSections,
  subjects,
  templates,
  defaultInstitute = "",
  getAffectedSummary,
  busy,
  isMobile,
  onSelectSubject,
  onSave,
  onPublish,
}){
  const [instituteSearch,setInstituteSearch] = useState("");
  const [selectedInstitute,setSelectedInstitute] = useState(defaultInstitute);
  const [selectedSection,setSelectedSection] = useState("");
  const [selectedSubject,setSelectedSubject] = useState(null);
  const visibleInstitutes = institutes.filter(item=>
    !instituteSearch.trim() || item.toLowerCase().includes(instituteSearch.trim().toLowerCase())
  );
  const config = getInstituteSectionConfig(instituteSections,selectedInstitute) || {};
  const groups = config.gradeGroups || [];
  const groupedSections = groups.flatMap(group=>uniqueSectionNames(group.sections||[]));
  const standaloneSections = uniqueSectionNames(config.extraSections||[]);
  const allSections = uniqueSectionNames([...groupedSections,...standaloneSections]);
  const activeSubjects = subjects.filter(item=>item.active);
  const stepCard = active => ({
    background:"#FFFFFF",
    border:`1px solid ${active?"#AFC5F0":G.border}`,
    borderRadius:14,
    boxShadow:active?G.shadowSm:"none",
    overflow:"hidden",
  });
  const stepHeader = (number,title,detail,active) => (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",background:active?"#EEF4FF":"#F8FAFD",borderBottom:`1px solid ${G.border}`}}>
      <div style={{width:28,height:28,borderRadius:9,background:active?G.navy:"#E8EDF5",color:active?"#FFFFFF":G.textM,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:850,flexShrink:0}}>{number}</div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:14,fontWeight:850,color:G.text}}>{title}</div>
        <div style={{fontSize:11.5,color:G.textM,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{detail}</div>
      </div>
    </div>
  );
  const chooseInstitute = institute => {
    setSelectedInstitute(institute);
    setSelectedSection("");
    setSelectedSubject(null);
  };
  const chooseSection = section => {
    setSelectedSection(section);
    setSelectedSubject(null);
  };

  if(selectedSubject){
    return (
      <div>
        <button onClick={()=>setSelectedSubject(null)} style={{...pill("#FFFFFF",G.textS,G.border),padding:"8px 12px",marginBottom:12}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><AppIcon icon={IconChevronLeft} size={15}/> Change subject</span>
        </button>
        <SyllabusBuilder
          key={`${selectedInstitute}::${selectedSection}::${selectedSubject.id}`}
          subject={selectedSubject}
          templates={templates}
          institutes={institutes}
          instituteSections={instituteSections}
          initialInstitute={selectedInstitute}
          initialSection={selectedSection}
          simpleScope
          getAffectedSummary={getAffectedSummary}
          busy={busy}
          isMobile={isMobile}
          onClose={()=>setSelectedSubject(null)}
          onSave={onSave}
          onPublish={onPublish}
        />
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:isMobile?23:28,fontWeight:850,color:G.text,fontFamily:G.display,lineHeight:1.15}}>Syllabus</div>
        <div style={{fontSize:14,color:G.textM,lineHeight:1.55,marginTop:5}}>Choose where the syllabus applies, select its subject, then add chapters and topics.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${defaultInstitute?2:3},minmax(0,1fr))`,gap:12,alignItems:"start"}}>
        {!defaultInstitute&&<div style={stepCard(true)}>
          {stepHeader(1,"Institute",selectedInstitute||"Choose an institute",true)}
          <div style={{padding:12}}>
            <input value={instituteSearch} onChange={event=>setInstituteSearch(event.target.value)} placeholder="Filter institutes" style={{width:"100%",boxSizing:"border-box",border:`1px solid ${G.borderM}`,borderRadius:10,padding:"9px 11px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none",marginBottom:9}}/>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:isMobile?250:330,overflowY:"auto"}}>
              {visibleInstitutes.map(institute=>(
                <button key={institute} onClick={()=>chooseInstitute(institute)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,border:`1px solid ${selectedInstitute===institute?"#B8CCF7":G.border}`,background:selectedInstitute===institute?"#E8F0FF":"#FFFFFF",color:G.text,borderRadius:10,padding:"9px 10px",fontFamily:G.sans,fontSize:12.5,fontWeight:750,textAlign:"left",cursor:"pointer"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{institute}</span>
                  {selectedInstitute===institute&&<AppIcon icon={IconCheck} size={15} color={G.blue}/>}
                </button>
              ))}
            </div>
          </div>
        </div>}

        <div style={stepCard(!!selectedInstitute)}>
          {stepHeader(defaultInstitute?1:2,"Section",selectedSection||"Choose a section",!!selectedInstitute)}
          <div style={{padding:12}}>
            {!selectedInstitute ? (
              <div style={{fontSize:13,color:G.textM,lineHeight:1.5,padding:"12px 2px"}}>Select an institute first.</div>
            ) : allSections.length===0 ? (
              <div style={{fontSize:13,color:G.textM,lineHeight:1.5,padding:"12px 2px"}}>No sections are configured for this institute.</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:isMobile?280:360,overflowY:"auto"}}>
                {groups.map(group=>{
                  const sectionNames=uniqueSectionNames(group.sections||[]);
                  if(!sectionNames.length) return null;
                  return (
                    <div key={group.id||group.label}>
                      <div style={{fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.7,margin:"0 2px 6px"}}>{group.label||"Section group"}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {sectionNames.map(section=>(
                          <button key={section} onClick={()=>chooseSection(section)} style={{...pill(selectedSection===section?G.navy:"#FFFFFF",selectedSection===section?"#FFFFFF":G.textS,selectedSection===section?G.navy:G.borderM),fontSize:12,fontWeight:800,padding:"7px 10px"}}>{section}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {standaloneSections.length>0&&(
                  <div>
                    <div style={{fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.7,margin:"0 2px 6px"}}>Other sections</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {standaloneSections.map(section=>(
                        <button key={section} onClick={()=>chooseSection(section)} style={{...pill(selectedSection===section?G.navy:"#FFFFFF",selectedSection===section?"#FFFFFF":G.textS,selectedSection===section?G.navy:G.borderM),fontSize:12,fontWeight:800,padding:"7px 10px"}}>{section}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={stepCard(!!selectedSection)}>
          {stepHeader(defaultInstitute?2:3,"Subject","Select the syllabus subject",!!selectedSection)}
          <div style={{padding:12}}>
            {!selectedSection ? (
              <div style={{fontSize:13,color:G.textM,lineHeight:1.5,padding:"12px 2px"}}>Select a section first.</div>
            ) : activeSubjects.length===0 ? (
              <div style={{fontSize:13,color:G.textM,lineHeight:1.5,padding:"12px 2px"}}>Add an official subject before creating a syllabus.</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:7,maxHeight:isMobile?280:360,overflowY:"auto"}}>
                {activeSubjects.map(subject=>{
                  const matching=templates.filter(item=>item.subjectId===subject.id&&sameInstituteName(item.draft?.instituteName,selectedInstitute)&&String(item.draft?.sectionName||"").trim().toLowerCase()===selectedSection.trim().toLowerCase());
                  const published=matching.some(item=>item.currentVersion>0);
                  return (
                    <button key={subject.id} onClick={()=>{onSelectSubject?.(subject);setSelectedSubject(subject);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:9,border:`1px solid ${G.border}`,background:"#FFFFFF",borderRadius:11,padding:"10px 11px",fontFamily:G.sans,textAlign:"left",cursor:"pointer"}}>
                      <span style={{minWidth:0}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:850,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{subject.name}</span>
                        <span style={{display:"block",fontSize:10.5,color:published?"#137A45":G.textL,fontWeight:750,marginTop:3}}>{published?"Published syllabus":"Create syllabus"}</span>
                      </span>
                      <AppIcon icon={IconChevronRight} size={16} color={G.textL}/>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedSyllabusFlow({
  institutes,
  instituteSections,
  subjects,
  templates,
  defaultInstitute = "",
  classData,
  getAffectedSummary,
  busy,
  isMobile,
  onSelectSubject,
  onSave,
  onPublish,
}){
  const [selectedInstitutes,setSelectedInstitutes] = useState(()=>defaultInstitute?[defaultInstitute]:[]);
  const [selectedSections,setSelectedSections] = useState({});
  const [selectedSubject,setSelectedSubject] = useState(null);
  const [instituteSearch,setInstituteSearch] = useState("");
  const visibleInstitutes=institutes.filter(institute=>
    !instituteSearch.trim()||institute.toLowerCase().includes(instituteSearch.trim().toLowerCase())
  );
  const activeSubjects=subjects.filter(item=>item.active);
  const selectedScope=useMemo(
    ()=>normaliseSyllabusScope(selectedInstitutes.map(instituteName=>({
      instituteName,
      sectionNames:selectedSections[instituteName]||[],
    }))),
    [selectedInstitutes,selectedSections],
  );
  const selectedPairs=useMemo(()=>syllabusScopePairs(selectedScope),[selectedScope]);
  const sectionOptionsByInstitute=useMemo(()=>Object.fromEntries(selectedInstitutes.map(instituteName=>{
    const config=getInstituteSectionConfig(instituteSections,instituteName)||{};
    return [instituteName,uniqueSectionNames([
      ...(config.gradeGroups||[]).flatMap(group=>group.sections||[]),
      ...(config.extraSections||[]),
    ])];
  })),[selectedInstitutes,instituteSections]);
  const subjectAvailability=useMemo(()=>{
    const pairSubjects=selectedPairs.map(pair=>{
      const values=new Set();
      Object.values(classData||{}).forEach(data=>{
        (data?.classes||[]).forEach(cls=>{
          if(!sameInstituteName(cls?.institute,pair.instituteName)) return;
          if(normaliseSectionKey(cls?.section||cls?.name)!==normaliseSectionKey(pair.sectionName)) return;
          const name=String(cls?.subject||"").trim().toLowerCase();
          if(name) values.add(name);
        });
      });
      return values;
    });
    const hasCompleteMapping=pairSubjects.length>0&&pairSubjects.every(values=>values.size>0);
    const common=hasCompleteMapping
      ? activeSubjects.filter(subject=>pairSubjects.every(values=>values.has(subject.name.trim().toLowerCase())))
      : [];
    return {
      items:common.length?common:activeSubjects,
      usingCatalogFallback:hasCompleteMapping&&common.length===0,
    };
  },[activeSubjects,classData,selectedPairs]);
  const toggleInstitute=instituteName=>{
    setSelectedSubject(null);
    setSelectedInstitutes(current=>{
      if(current.includes(instituteName)){
        setSelectedSections(sections=>{
          const next={...sections};
          delete next[instituteName];
          return next;
        });
        return current.filter(item=>item!==instituteName);
      }
      return [...current,instituteName];
    });
  };
  const toggleSection=(instituteName,sectionName)=>{
    setSelectedSubject(null);
    setSelectedSections(current=>{
      const sections=current[instituteName]||[];
      return {
        ...current,
        [instituteName]:sections.includes(sectionName)
          ? sections.filter(item=>item!==sectionName)
          : [...sections,sectionName],
      };
    });
  };
  const selectSubject=subject=>{
    onSelectSubject?.(subject);
    setSelectedSubject(subject);
  };
  const selectionCard=(selected)=>({
    width:"100%",
    minHeight:isMobile?56:68,
    boxSizing:"border-box",
    display:"flex",
    alignItems:"center",
    gap:11,
    border:`1px solid ${selected?"#8FB1F3":G.border}`,
    borderLeft:`4px solid ${selected?G.blue:G.border}`,
    borderRadius:11,
    background:selected?"#EEF4FF":"#FFFFFF",
    padding:isMobile?"9px 10px":"11px 12px",
    color:G.text,
    fontFamily:G.sans,
    cursor:"pointer",
    textAlign:"left",
    boxShadow:selected?G.shadowSm:"none",
  });
  const checkBox=(selected)=>(
    <span style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${selected?G.blue:G.borderM}`,background:selected?G.blue:"#FFFFFF",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {selected&&<AppIcon icon={IconCheck} size={15} color="#FFFFFF"/>}
    </span>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:isMobile?23:28,fontWeight:850,color:G.text,fontFamily:G.display,lineHeight:1.15}}>Syllabus</div>
        <div style={{fontSize:14,color:G.textM,lineHeight:1.55,marginTop:5}}>
          Select institutes and sections, choose a common subject, then define one syllabus shared by that scope.
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>1. Select institutes</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Choose one or several institutes that will share this syllabus.</div>
          </div>
          <span style={{...pill("#FFFFFF",G.navy,G.borderM),cursor:"default",fontWeight:800}}>{selectedInstitutes.length} selected</span>
        </div>
        <div style={{padding:isMobile?14:18}}>
          <input value={instituteSearch} onChange={event=>setInstituteSearch(event.target.value)} placeholder="Filter institutes" style={{width:"100%",boxSizing:"border-box",border:`1px solid ${G.borderM}`,borderRadius:10,padding:"10px 12px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none",marginBottom:12}}/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:9}}>
            {visibleInstitutes.map(institute=>{
              const selected=selectedInstitutes.includes(institute);
              const instituteConfig=getInstituteSectionConfig(instituteSections,institute)||{};
              const sectionCount=uniqueSectionNames([
                ...(instituteConfig.gradeGroups||[]).flatMap(group=>group.sections||[]),
                ...(instituteConfig.extraSections||[]),
              ]).length;
              return (
                <button key={institute} onClick={()=>toggleInstitute(institute)} style={selectionCard(selected)}>
                  {checkBox(selected)}
                  <span style={{minWidth:0,flex:1}}>
                    <span style={{display:"block",fontSize:13.5,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{institute}</span>
                    <span style={{display:"block",fontSize:11.5,color:G.textM,marginTop:3}}>{sectionCount} configured section{sectionCount===1?"":"s"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",opacity:selectedInstitutes.length?1:0.65}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>2. Select sections</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Only sections from the selected institutes are shown.</div>
          </div>
          <span style={{...pill("#FFFFFF",G.navy,G.borderM),cursor:"default",fontWeight:800}}>{selectedPairs.length} selected</span>
        </div>
        <div style={{padding:isMobile?14:18,display:"flex",flexDirection:"column",gap:15}}>
          {!selectedInstitutes.length&&<div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM}}>Select an institute first.</div>}
          {selectedInstitutes.map(instituteName=>{
            const sections=sectionOptionsByInstitute[instituteName]||[];
            return (
              <div key={instituteName}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:850,color:G.textM,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{instituteName}</div>
                  {!!sections.length&&(
                    <button
                      onClick={()=>{
                        setSelectedSubject(null);
                        setSelectedSections(current=>{
                          const currentSections=current[instituteName]||[];
                          const allSelected=sections.every(section=>currentSections.includes(section));
                          return {...current,[instituteName]:allSelected?[]:[...sections]};
                        });
                      }}
                      style={{border:"none",background:"transparent",padding:"4px 2px",fontSize:11.5,fontWeight:850,color:G.blue,fontFamily:G.sans,cursor:"pointer",whiteSpace:"nowrap"}}
                    >
                      {sections.every(section=>(selectedSections[instituteName]||[]).includes(section))?"Clear all":"Select all"}
                    </button>
                  )}
                </div>
                {sections.length?(
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:9}}>
                    {sections.map(sectionName=>{
                      const selected=(selectedSections[instituteName]||[]).includes(sectionName);
                      return (
                        <button key={sectionName} onClick={()=>toggleSection(instituteName,sectionName)} style={selectionCard(selected)}>
                          {checkBox(selected)}
                          <span style={{fontSize:13.5,fontWeight:850,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sectionName}</span>
                        </button>
                      );
                    })}
                  </div>
                ):(
                  <div style={{padding:"12px 14px",border:`1px dashed ${G.borderM}`,borderRadius:10,fontSize:12.5,color:G.textM}}>No configured sections. Add them from this institute's Sections area.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",opacity:selectedPairs.length?1:0.65}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD"}}>
          <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>3. Select subject</div>
          <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>
            Subjects common to the selected sections are shown from the Subject Catalog.
          </div>
        </div>
        <div style={{padding:isMobile?14:18}}>
          {!selectedPairs.length?(
            <div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM}}>Select at least one section first.</div>
          ):subjectAvailability.items.length===0?(
            <div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM}}>Add an active subject to the Subject Catalog first.</div>
          ):(
            <>
              {subjectAvailability.usingCatalogFallback&&(
                <div style={{background:"#FFF7E6",border:"1px solid #F1D49A",borderRadius:10,padding:"10px 12px",fontSize:12.5,color:"#7A4A00",marginBottom:11}}>
                  No single subject is currently mapped across every selected section, so the active Subject Catalog is shown.
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:9}}>
                {subjectAvailability.items.map(subject=>{
                  const selected=selectedSubject?.id===subject.id;
                  const matching=templates.filter(item=>item.subjectId===subject.id&&syllabusScopeKey(syllabusTemplateScope(item))===syllabusScopeKey(selectedScope));
                  const published=matching.some(item=>item.currentVersion>0);
                  return (
                    <button key={subject.id} onClick={()=>selectSubject(subject)} style={selectionCard(selected)}>
                      <span style={{width:34,height:34,borderRadius:10,background:selected?G.navy:G.blueL,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <AppIcon icon={IconBooks} size={17} color={selected?"#FFFFFF":G.blue}/>
                      </span>
                      <span style={{minWidth:0,flex:1}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{subject.name}</span>
                        <span style={{display:"block",fontSize:11.5,color:published?"#137A45":G.textM,fontWeight:700,marginTop:3}}>{published?"Published syllabus":"Define syllabus"}</span>
                      </span>
                      <AppIcon icon={selected?IconCheck:IconChevronRight} size={16} color={selected?G.blue:G.textL}/>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedSubject&&selectedPairs.length>0&&(
        <SyllabusBuilder
          key={`${selectedSubject.id}::${syllabusScopeKey(selectedScope)}`}
          subject={selectedSubject}
          templates={templates}
          institutes={institutes}
          instituteSections={instituteSections}
          initialScope={selectedScope}
          simpleScope
          getAffectedSummary={getAffectedSummary}
          busy={busy}
          isMobile={isMobile}
          onClose={()=>setSelectedSubject(null)}
          onSave={onSave}
          onPublish={onPublish}
        />
      )}
    </div>
  );
}

function ClassBoundSyllabusFlow({
  institutes,
  instituteSections,
  templates,
  defaultInstitute = "",
  classData,
  teachers,
  getAffectedSummary,
  busy,
  isMobile,
  onScopeChange,
  onSave,
  onPublish,
  onDelete,
}){
  const [selectedInstitutes,setSelectedInstitutes] = useState(()=>defaultInstitute?[defaultInstitute]:[]);
  const [selectedSections,setSelectedSections] = useState({});
  const [selectedSubject,setSelectedSubject] = useState(null);
  const [instituteSearch,setInstituteSearch] = useState("");
  const visibleInstitutes=institutes.filter(institute=>
    !instituteSearch.trim()||institute.toLowerCase().includes(instituteSearch.trim().toLowerCase())
  );
  const sectionCountsByInstitute = useMemo(()=>Object.fromEntries((institutes||[]).map(instituteName=>{
    const config = getInstituteSectionConfig(instituteSections, instituteName) || {};
    const count = uniqueSectionNames([
      ...(config.gradeGroups || []).flatMap(group => group.sections || []),
      ...(config.extraSections || []),
    ]).length;
    return [instituteName, count];
  })), [institutes, instituteSections]);
  const selectedScope=useMemo(
    ()=>normaliseSyllabusScope(selectedInstitutes.map(instituteName=>({
      instituteName,
      sectionNames:selectedSections[instituteName]||[],
    }))),
    [selectedInstitutes,selectedSections],
  );
  const selectedPairs=useMemo(()=>syllabusScopePairs(selectedScope),[selectedScope]);
  const sectionOptionsByInstitute=useMemo(()=>Object.fromEntries(selectedInstitutes.map(instituteName=>{
    const config=getInstituteSectionConfig(instituteSections,instituteName)||{};
    return [instituteName,uniqueSectionNames([
      ...(config.gradeGroups||[]).flatMap(group=>group.sections||[]),
      ...(config.extraSections||[]),
    ])];
  })),[selectedInstitutes,instituteSections]);
  const teacherNames=useMemo(()=>Object.fromEntries((teachers||[]).map(teacher=>[
    teacher.uid,
    classData?.[teacher.uid]?.profile?.name || teacher.name || teacher.email || "Teacher",
  ])),[teachers,classData]);
  const availableSubjects=useMemo(()=>{
    const groups=new Map();
    Object.entries(classData||{}).forEach(([teacherUid,data])=>{
      (data?.classes||[]).forEach(cls=>{
        const pair=selectedPairs.find(item=>
          sameInstituteName(cls?.institute,item.instituteName)
          && normaliseSectionKey(cls?.section||cls?.name)===normaliseSectionKey(item.sectionName)
        );
        if(!pair) return;
        const subjectName=String(cls?.subject||"").trim();
        if(!subjectName) return;
        const subjectKey=subjectName.toLowerCase().replace(/[^a-z0-9]+/g,"");
        if(!subjectKey) return;
        const current=groups.get(subjectKey)||{
          id:`class-subject-${subjectKey}`,
          name:subjectName,
          targets:[],
          teacherUids:new Set(),
          sections:new Set(),
        };
        current.targets.push({
          teacherUid,
          teacherName:teacherNames[teacherUid]||data?.profile?.name||"Teacher",
          classId:String(cls?.id||"").trim(),
          className:String(cls?.name||cls?.section||pair.sectionName).trim(),
          instituteName:String(cls?.institute||pair.instituteName).trim(),
          sectionName:String(cls?.section||cls?.name||pair.sectionName).trim(),
          subjectName,
        });
        current.teacherUids.add(teacherUid);
        current.sections.add(`${pair.instituteName}::${pair.sectionName}`);
        groups.set(subjectKey,current);
      });
    });
    return [...groups.values()]
      .map(item=>({
        id:item.id,
        name:item.name,
        targets:item.targets,
        teacherCount:item.teacherUids.size,
        sectionCount:item.sections.size,
      }))
      .sort((a,b)=>exportTextSorter.compare(a.name,b.name));
  },[classData,selectedPairs,teacherNames]);

  useEffect(()=>{
    onScopeChange?.(selectedInstitutes);
  },[selectedInstitutes,onScopeChange]);

  useEffect(()=>{
    if(!selectedSubject) return;
    const current=availableSubjects.find(item=>item.id===selectedSubject.id);
    if(!current) setSelectedSubject(null);
    else if(current.targets.length!==selectedSubject.targets.length) setSelectedSubject(current);
  },[availableSubjects,selectedSubject]);

  const toggleInstitute=instituteName=>{
    setSelectedSubject(null);
    setSelectedInstitutes(current=>{
      if(current.includes(instituteName)){
        setSelectedSections(sections=>{
          const next={...sections};
          delete next[instituteName];
          return next;
        });
        return current.filter(item=>item!==instituteName);
      }
      return [...current,instituteName];
    });
  };
  const toggleSection=(instituteName,sectionName)=>{
    setSelectedSubject(null);
    setSelectedSections(current=>{
      const sections=current[instituteName]||[];
      return {
        ...current,
        [instituteName]:sections.includes(sectionName)
          ? sections.filter(item=>item!==sectionName)
          : [...sections,sectionName],
      };
    });
  };
  const selectionCard=selected=>({
    width:"100%",
    minHeight:isMobile?56:66,
    boxSizing:"border-box",
    display:"flex",
    alignItems:"center",
    gap:11,
    border:`1px solid ${selected?"#8FB1F3":G.border}`,
    borderLeft:`4px solid ${selected?G.blue:G.border}`,
    borderRadius:11,
    background:selected?"#EEF4FF":"#FFFFFF",
    padding:isMobile?"9px 10px":"11px 12px",
    color:G.text,
    fontFamily:G.sans,
    cursor:"pointer",
    textAlign:"left",
    boxShadow:selected?G.shadowSm:"none",
  });
  const checkBox=selected=>(
    <span style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${selected?G.blue:G.borderM}`,background:selected?G.blue:"#FFFFFF",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {selected&&<AppIcon icon={IconCheck} size={15} color="#FFFFFF"/>}
    </span>
  );
  const compactTableWrapStyle = {
    border:`1px solid ${G.border}`,
    borderRadius:12,
    overflow:"hidden",
    background:"#FFFFFF",
  };
  const compactTableHeadStyle = {
    display:"grid",
    gridTemplateColumns:isMobile?"minmax(0,1fr) auto":"minmax(0,2.1fr) 112px 104px",
    gap:12,
    alignItems:"center",
    padding:isMobile?"10px 12px":"10px 14px",
    background:"#F8FAFD",
    borderBottom:`1px solid ${G.border}`,
    fontSize:11,
    fontWeight:800,
    color:G.textL,
    letterSpacing:0.7,
    textTransform:"uppercase",
  };
  const compactRowStyle = selected => ({
    display:"grid",
    gridTemplateColumns:isMobile?"minmax(0,1fr) auto":"minmax(0,2.1fr) 112px 104px",
    gap:12,
    alignItems:"center",
    padding:isMobile?"12px":"12px 14px",
    borderTop:`1px solid ${G.border}`,
    background:selected?"#F8FBFF":"#FFFFFF",
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:isMobile?23:28,fontWeight:850,color:G.text,fontFamily:G.display,lineHeight:1.15}}>Syllabus</div>
        <div style={{fontSize:14,color:G.textM,lineHeight:1.55,marginTop:5}}>
          Choose existing classes first. Their subject and teacher records determine exactly who receives the published syllabus.
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>1. Select institutes</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Start with the institutes that should share this syllabus.</div>
          </div>
          <span style={{...pill("#FFFFFF",G.navy,G.borderM),cursor:"default",fontWeight:800}}>{selectedInstitutes.length} selected</span>
        </div>
        <div style={{padding:isMobile?14:18}}>
          <input value={instituteSearch} onChange={event=>setInstituteSearch(event.target.value)} placeholder="Filter institutes" style={{width:"100%",boxSizing:"border-box",border:`1px solid ${G.borderM}`,borderRadius:10,padding:"10px 12px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none",marginBottom:12}}/>
          <div style={compactTableWrapStyle}>
            <div style={compactTableHeadStyle}>
              <span>Institute</span>
              {!isMobile&&<span>Sections</span>}
              <span style={{textAlign:"right"}}>Select</span>
            </div>
            {visibleInstitutes.map(institute=>{
              const selected=selectedInstitutes.includes(institute);
              const sectionCount = sectionCountsByInstitute[institute] || 0;
              return (
                <div key={institute} style={compactRowStyle(selected)}>
                  <button onClick={()=>toggleInstitute(institute)} style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:11,minWidth:0,cursor:"pointer",textAlign:"left"}}>
                    {checkBox(selected)}
                    <span style={{minWidth:0,flex:1}}>
                      <span style={{display:"block",fontSize:14,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:G.text}}>{institute}</span>
                      <span style={{display:"block",fontSize:11.5,color:G.textM,marginTop:3}}>{sectionCount} configured section{sectionCount===1?"":"s"}</span>
                    </span>
                  </button>
                  {!isMobile&&<div style={{fontSize:13.5,fontWeight:800,color:G.text}}>{sectionCount}</div>}
                  <div style={{display:"flex",justifyContent:"flex-end"}}>
                    <button onClick={()=>toggleInstitute(institute)} style={{...pill(selected?G.blue:"#FFFFFF",selected?"#FFFFFF":G.textS,selected?G.blue:G.borderM),padding:"7px 11px",fontSize:12,fontWeight:800,minWidth:82,justifyContent:"center"}}>
                      {selected ? "Selected" : "Pick"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",opacity:selectedInstitutes.length?1:0.65}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>2. Select sections</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Pick only the sections that should receive the same syllabus.</div>
          </div>
          <span style={{...pill("#FFFFFF",G.navy,G.borderM),cursor:"default",fontWeight:800}}>{selectedSectionsCount} selected</span>
        </div>
        <div style={{padding:isMobile?14:18,display:"flex",flexDirection:"column",gap:15}}>
          {!selectedInstitutes.length&&<div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM}}>Select an institute first.</div>}
          {selectedInstitutes.map(instituteName=>{
            const sections=sectionOptionsByInstitute[instituteName]||[];
            return (
              <div key={instituteName}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:850,color:G.text,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{instituteName}</div>
                    <div style={{fontSize:11.5,color:G.textM,marginTop:2}}>{(selectedSections[instituteName]||[]).length}/{sections.length} selected</div>
                  </div>
                  {!!sections.length&&(
                    <button onClick={()=>{
                      setSelectedSubject(null);
                      setSelectedSections(current=>{
                        const currentSections=current[instituteName]||[];
                        const allSelected=sections.every(section=>currentSections.includes(section));
                        return {...current,[instituteName]:allSelected?[]:[...sections]};
                      });
                    }} style={{border:"none",background:"transparent",padding:"4px 2px",fontSize:11.5,fontWeight:850,color:G.blue,fontFamily:G.sans,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {sections.every(section=>(selectedSections[instituteName]||[]).includes(section))?"Clear all":"Select all"}
                    </button>
                  )}
                </div>
                {sections.length?(
                  <div style={compactTableWrapStyle}>
                    {!isMobile&&(
                      <div style={{...compactTableHeadStyle,gridTemplateColumns:"minmax(0,2.2fr) 104px"}}>
                        <span>Section</span>
                        <span style={{textAlign:"right"}}>Select</span>
                      </div>
                    )}
                    {sections.map(sectionName=>{
                      const selected=(selectedSections[instituteName]||[]).includes(sectionName);
                      return (
                        <div key={sectionName} style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr) auto":"minmax(0,2.2fr) 104px",gap:12,alignItems:"center",padding:isMobile?"11px 12px":"11px 14px",borderTop:`1px solid ${G.border}`,background:selected?"#F8FBFF":"#FFFFFF"}}>
                          <button onClick={()=>toggleSection(instituteName,sectionName)} style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:11,cursor:"pointer",textAlign:"left",minWidth:0}}>
                            {checkBox(selected)}
                            <span style={{fontSize:13.5,fontWeight:850,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:G.text}}>{sectionName}</span>
                          </button>
                          <div style={{display:"flex",justifyContent:"flex-end"}}>
                            <button onClick={()=>toggleSection(instituteName,sectionName)} style={{...pill(selected?G.blue:"#FFFFFF",selected?"#FFFFFF":G.textS,selected?G.blue:G.borderM),padding:"7px 11px",fontSize:12,fontWeight:800,minWidth:82,justifyContent:"center"}}>
                              {selected ? "Added" : "Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{padding:"12px 14px",border:`1px dashed ${G.borderM}`,borderRadius:10,fontSize:12.5,color:G.textM}}>No configured sections. Add them from this institute's Sections area.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",opacity:selectedPairs.length?1:0.65}}>
        <div style={{padding:isMobile?"15px":"18px 20px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD"}}>
          <div style={{fontSize:18,fontWeight:850,color:G.text,fontFamily:G.display}}>3. Select an existing subject</div>
          <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>These names come directly from teacher-created classes, so you do not need to type the subject again.</div>
        </div>
        <div style={{padding:isMobile?14:18}}>
          {!selectedPairs.length?(
            <div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM}}>Select at least one section first.</div>
          ):availableSubjects.length===0?(
            <div style={{padding:"20px 10px",textAlign:"center",fontSize:13,color:G.textM,lineHeight:1.55}}>No teacher class with a subject was found in the selected sections.</div>
          ):(
            <div style={compactTableWrapStyle}>
              <div style={{...compactTableHeadStyle,gridTemplateColumns:isMobile?"minmax(0,1fr) auto":"minmax(0,2fr) 108px 108px 104px"}}>
                <span>Subject</span>
                {!isMobile&&<span>Teachers</span>}
                {!isMobile&&<span>Classes</span>}
                <span style={{textAlign:"right"}}>Use</span>
              </div>
              {availableSubjects.map(subject=>{
                const selected=selectedSubject?.id===subject.id;
                const matching=templates.filter(item=>item.subjectId===subject.id&&syllabusScopeKey(syllabusTemplateScope(item))===syllabusScopeKey(selectedScope));
                const published=matching.some(item=>item.currentVersion>0);
                return (
                  <div key={subject.id} style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr) auto":"minmax(0,2fr) 108px 108px 104px",gap:12,alignItems:"center",padding:isMobile?"12px":"12px 14px",borderTop:`1px solid ${G.border}`,background:selected?"#F8FBFF":"#FFFFFF"}}>
                    <button onClick={()=>setSelectedSubject(subject)} style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:11,cursor:"pointer",textAlign:"left",minWidth:0}}>
                      <span style={{width:34,height:34,borderRadius:10,background:selected?G.navy:G.blueL,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <AppIcon icon={IconBooks} size={17} color={selected?"#FFFFFF":G.blue}/>
                      </span>
                      <span style={{minWidth:0,flex:1}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:G.text}}>{subject.name}</span>
                        <span style={{display:"block",fontSize:11.5,color:published?"#137A45":G.textM,fontWeight:700,marginTop:3}}>
                          {published ? "Published syllabus ready" : "Ready to build"}
                        </span>
                      </span>
                    </button>
                    {!isMobile&&<div style={{fontSize:13.5,fontWeight:800,color:G.text}}>{subject.teacherCount}</div>}
                    {!isMobile&&<div style={{fontSize:13.5,fontWeight:800,color:G.text}}>{subject.targets.length}</div>}
                    <div style={{display:"flex",justifyContent:"flex-end"}}>
                      <button onClick={()=>setSelectedSubject(subject)} style={{...pill(selected?G.blue:"#FFFFFF",selected?"#FFFFFF":G.textS,selected?G.blue:G.borderM),padding:"7px 11px",fontSize:12,fontWeight:800,minWidth:82,justifyContent:"center"}}>
                        {selected ? "Chosen" : "Use"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedSubject&&selectedPairs.length>0&&(
        <SyllabusBuilder
          key={`${selectedSubject.id}::${syllabusScopeKey(selectedScope)}`}
          subject={selectedSubject}
          templates={templates}
          institutes={institutes}
          instituteSections={instituteSections}
          initialScope={selectedScope}
          initialTargets={selectedSubject.targets}
          simpleScope
          getAffectedSummary={getAffectedSummary}
          busy={busy}
          isMobile={isMobile}
          onClose={()=>setSelectedSubject(null)}
          onSave={onSave}
          onPublish={onPublish}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function AdminPanelInner({user}){
  const PANEL_LIMITS = React.useMemo(()=>({
    p1:{ min:112, max:340, collapsed:76, default:175 },
    p2:{ min:160, max:380, collapsed:82, default:205 },
    p3:{ min:112, max:360, collapsed:76, default:200 },
  }),[]);
  const [teachers,    setTeachers]    = useState([]);
  const [fullData,    setFullData]    = useState({});
  const [roles,       setRoles]       = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingUids, setLoadingUids] = useState(new Set());
  const [view,        setView]        = useState("main"); // main | manage
  const [inviteLink,  setInviteLink]  = useState(null);
  const [inviteLoading,setInviteLoading]=useState(false);
  // navigation state
  const [selInst,     setSelInst]     = useState(null);
  const [tab,         setTab]         = useState("class"); // class | teacher
  const [selP2,       setSelP2]       = useState(null); // { type, key } teacher uid OR class raw name
  const [selP3,       setSelP3]       = useState(null); // { teacherUid, classRaw }
  const [fullView,    setFullView]    = useState(null); // null | {kind:"teacher"|"class", ...}
  const [period,      setPeriod]      = useState("today");
  const [customRange, setCustomRange] = useState(()=>{
    const today=todayKey();
    return { start:`${today.slice(0,7)}-01`, end:today };
  });
  const [mobileStep,  setMobileStep]  = useState(0);
  const [mobileSurface, setMobileSurface] = useState("workspace"); // workspace | profile | centreSummary
  const [exportOpen,   setExportOpen]   = useState(false);
  const [statusImageBusy, setStatusImageBusy] = useState(false);
  const [instituteGlanceOpen, setInstituteGlanceOpen] = useState(false);
  const [instituteGlanceOptionsOpen, setInstituteGlanceOptionsOpen] = useState(false);
  const [instituteGlanceOptionsMode, setInstituteGlanceOptionsMode] = useState("export");
  const [instituteGlanceOptionsContext, setInstituteGlanceOptionsContext] = useState("report");
  const [instituteGlancePeriod, setInstituteGlancePeriod] = useState("daily");
  const [instituteGlanceMonth, setInstituteGlanceMonth] = useState(() => currentMonthKey());
  const [instituteGlanceRangeStart, setInstituteGlanceRangeStart] = useState(() => addDaysToDateKey(todayKey(), -6));
  const [instituteGlanceRangeEnd, setInstituteGlanceRangeEnd] = useState(() => todayKey());
  const [instituteGlanceExportBusy, setInstituteGlanceExportBusy] = useState("");
  const [instituteGlanceRowExportBusy, setInstituteGlanceRowExportBusy] = useState("");
  const [ledgrReportSchedule, setLedgrReportSchedule] = useState(null);
  const [ledgrReportScheduleLoading, setLedgrReportScheduleLoading] = useState(true);
  const [ledgrReportScheduleSaving, setLedgrReportScheduleSaving] = useState(false);
  const [telegramDashboardOpen, setTelegramDashboardOpen] = useState(false);
  const [ledgrTelegramConfig, setLedgrTelegramConfig] = useState(null);
  const [ledgrTelegramLoading, setLedgrTelegramLoading] = useState(true);
  const [ledgrTelegramSaving, setLedgrTelegramSaving] = useState(false);
  const [ledgrTelegramSending, setLedgrTelegramSending] = useState(false);
  const [instituteGlanceReport, setInstituteGlanceReport] = useState(() => ({
    configKey: "",
    rows: [],
    summary: EMPTY_INSTITUTE_GLANCE_SUMMARY,
    loading: false,
    loaded: 0,
    total: 0,
    loadedInstitutes: 0,
    totalInstitutes: 0,
    ready: false,
    error: "",
  }));
  const [panelW,       setPanelW]       = useState({p1:175, p2:205, p3:200}); // resizable
  const [panelCollapsed, setPanelCollapsed] = useState({p1:false, p2:false, p3:false});
  const [panelDragging, setPanelDragging] = useState(false);
  const [isMobile,     setIsMobile]     = useState(false);
  const [isWeakDevice, setIsWeakDevice] = useState(false);
  const [reduceEffects,setReduceEffects]= useState(false);
  const [mobileLiteMode,setMobileLiteMode] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [manageTab,    setManageTab]    = useState("teachers"); // teachers | subjects | admins | institutes | sections | report | messenger
  const [manageTeacherSearch, setManageTeacherSearch] = useState("");
  const [manageTeacherSort, setManageTeacherSort] = useState("count");
  const [manageAdminSearch, setManageAdminSearch] = useState("");
  const [manageSectionSearch, setManageSectionSearch] = useState("");
  const [manageInstituteFilter, setManageInstituteFilter] = useState("");
  const [manageScopeInstitute, setManageScopeInstitute] = useState("");
  const [openTeacherInstitute, setOpenTeacherInstitute] = useState(null);
  const [openAdminInstitute, setOpenAdminInstitute] = useState(null);
  const [adminBin,     setAdminBin]     = useState([]); // [{type:"class"|"institute"|"section", ...data, deletedAt}]
  const [binView,      setBinView]      = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackThreads, setFeedbackThreads] = useState([]);
  const [feedbackSelectedUid, setFeedbackSelectedUid] = useState(null);
  const [feedbackMessages, setFeedbackMessages] = useState([]);
  const [feedbackReply, setFeedbackReply] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [selTeacher,   setSelTeacher]   = useState(null); // uid of teacher in detail modal
  const [newInstName,  setNewInstName]  = useState(""); // new institute input
  const [renamingInst,  setRenamingInst]  = useState(null);
  const [renameInstVal, setRenameInstVal] = useState("");
  const [dragInst,      setDragInst]      = useState(null);
  const [dragOverInst,  setDragOverInst]  = useState(null);
  const dragInstRef                        = React.useRef(null);
  const [renamingTeacher, setRenamingTeacher] = useState(null);
  const [adminToast,   setAdminToast]   = useState(null);
  const [adminConfirm, setAdminConfirm] = useState(null); // {msg, confirmLabel, onConfirm}
  const adminToastTimer = React.useRef(null);
  const [renameVal,    setRenameVal]    = useState("");
  const [deleteModal, setDeleteModal] = useState(null); // {type,label,lines,onConfirm}
  const [deleteBusy,  setDeleteBusy]  = useState(false);
  const [instDeleteModal, setInstDeleteModal] = useState(null); // null | {inst, step, migrateTarget, busy, error}
  const [deletedInstitutes, setDeletedInstitutes] = useState(new Set());
  const [globalInstList, setGlobalInstList] = useState([]); // from config/institutes
  const [globalSubjects, setGlobalSubjects] = useState([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectAssignmentBusy, setSubjectAssignmentBusy] = useState(null);
  const [syllabusTemplates, setSyllabusTemplates] = useState([]);
  const [syllabusBusy, setSyllabusBusy] = useState(false);
  const [instSectionsAll, setInstSectionsAll] = useState({}); // from config/sections
  const [instDetailView, setInstDetailView] = useState(null); // null | instituteName
  const [grpModal, setGrpModal]             = useState(null); // null | {mode,inst,group?}
  const [copyGroupModal, setCopyGroupModal] = useState(null); // null | {sourceInst, group}
  const [legacySectionRepair, setLegacySectionRepair] = useState(null); // null | {scopeLabel,items,selections,busy,error}
  const [instMenuOpen, setInstMenuOpen]     = useState(null); // inst name whose ⋯ menu is open
  const [instSearch, setInstSearch]         = useState("");
  const [p2Search, setP2Search]             = useState("");
  const [p3Search, setP3Search]             = useState("");
  const [activeProgramFilter, setActiveProgramFilter] = useState(null);
  const [repairingTeacherUid, setRepairingTeacherUid] = useState(null);
  const [instClassificationOpen, setInstClassificationOpen] = useState({});
  const [pendingSectionRename, setPendingSectionRename] = useState(null); // null | { institute, oldSection, nextValue }
  const [pendingSectionBusy, setPendingSectionBusy] = useState(false);
  const [pendingSectionError, setPendingSectionError] = useState("");
  const [instWarmup, setInstWarmup] = useState({ inst:null, total:0, loaded:0 });
  const fullDataRequestRef = React.useRef({});
  const fullDataRef = React.useRef(fullData);
  const warmupJobRef = React.useRef(0);
  const instituteGlanceJobRef = React.useRef(0);
  const instituteGlanceDataRef = React.useRef({});
  const instituteGlanceReportRef = React.useRef(instituteGlanceReport);
  const instituteGlanceAutoLoadKeyRef = React.useRef("");
  const instituteGlanceOptionsFrameRef = React.useRef(null);
  const historyReadyRef = React.useRef(false);
  const historyRestoreRef = React.useRef(false);
  const lastHistoryKeyRef = React.useRef("");
  const rootHistoryKeyRef = React.useRef("");
  const adminHistoryTokenRef = React.useRef(1);
  const expandedPanelWidthsRef = React.useRef({ p1:PANEL_LIMITS.p1.default, p2:PANEL_LIMITS.p2.default, p3:PANEL_LIMITS.p3.default });
  const panelWRef = React.useRef({ p1:PANEL_LIMITS.p1.default, p2:PANEL_LIMITS.p2.default, p3:PANEL_LIMITS.p3.default });
  const panelResizeFrameRef = React.useRef(null);
  const panelsBodyRef = React.useRef(null);
  const instituteTouchStateRef = React.useRef({
    activeInst:null,
    startX:0,
    startY:0,
    moved:false,
    target:null,
    longPressTimer:null,
    skipClickInst:null,
    skipClickUntil:0,
  });

  React.useEffect(() => {
    fullDataRef.current = fullData;
  }, [fullData]);

  React.useEffect(() => () => {
    if(instituteGlanceOptionsFrameRef.current && typeof window !== "undefined"){
      window.cancelAnimationFrame(instituteGlanceOptionsFrameRef.current);
      instituteGlanceOptionsFrameRef.current = null;
    }
  }, []);

  const handlePeriodChange = React.useCallback((nextPeriod)=>{
    if(nextPeriod==="range"){
      setCustomRange(current=>{
        const today=todayKey();
        return {
          start:current.start||`${today.slice(0,7)}-01`,
          end:current.end||today,
        };
      });
    }
    setPeriod(nextPeriod);
  },[]);
  const handleRangeStartChange = React.useCallback((nextStart)=>{
    const start=String(nextStart||"");
    setCustomRange(current=>{
      const end=String(current.end||"");
      if(start && end && start>end) return { start, end:start };
      return { ...current, start };
    });
    setPeriod("range");
  },[]);
  const handleRangeEndChange = React.useCallback((nextEnd)=>{
    const end=String(nextEnd||"");
    setCustomRange(current=>{
      const start=String(current.start||"");
      if(start && end && end<start) return { start:end, end };
      return { ...current, end };
    });
    setPeriod("range");
  },[]);

  useEffect(()=>{
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const check=()=>{
      const profile = readClientProfile();
      setIsMobile(profile.isMobile);
      setIsWeakDevice(profile.weakDevice);
      setReduceEffects(profile.reduceMotion);
      setMobileLiteMode(profile.mobileLite);
      setCoarsePointer(profile.coarsePointer);
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

  React.useEffect(()=>{
    if(view==="manage"){
      getAllInstituteSections().then(s=>setInstSectionsAll(s||{})).catch(()=>{});
    }
  },[view]);

  React.useEffect(()=>{
    return subscribeFeedbackThreads(
      items=>{
        setFeedbackThreads(items);
        setFeedbackSelectedUid(current=>current && items.some(item=>item.id===current)
          ? current
          : items[0]?.id || null);
      },
      error=>console.error("feedback threads",error),
    );
  },[]);

  React.useEffect(()=>{
    if(!feedbackSelectedUid){
      setFeedbackMessages([]);
      return undefined;
    }
    markFeedbackThreadRead(feedbackSelectedUid).catch(()=>{});
    return subscribeFeedbackMessages(
      feedbackSelectedUid,
      setFeedbackMessages,
      error=>console.error("feedback messages",error),
    );
  },[feedbackSelectedUid]);

  const feedbackUnreadCount = useMemo(
    ()=>feedbackThreads.reduce((sum,item)=>sum+Number(item.unreadByAdmin||0),0),
    [feedbackThreads],
  );
  const openFeedbackInbox = React.useCallback(()=>{
    setProfileOpen(false);
    setFeedbackOpen(true);
  },[]);
  const sendFeedbackReply = React.useCallback(async()=>{
    if(!feedbackSelectedUid || !feedbackReply.trim() || feedbackBusy) return;
    setFeedbackBusy(true);
    try{
      await sendAdminFeedbackReply(feedbackSelectedUid,user,feedbackReply);
      setFeedbackReply("");
    }catch(error){
      showAdminToast(error?.message||"Reply could not be sent.");
    }finally{
      setFeedbackBusy(false);
    }
  },[feedbackSelectedUid,feedbackReply,feedbackBusy,user]);
  const toggleFeedbackResolved = React.useCallback(async thread=>{
    if(!thread || feedbackBusy) return;
    setFeedbackBusy(true);
    try{
      await setFeedbackThreadStatus(thread.id,thread.status==="resolved"?"open":"resolved");
    }catch(error){
      showAdminToast(error?.message||"Conversation status could not be changed.");
    }finally{
      setFeedbackBusy(false);
    }
  },[feedbackBusy]);

  React.useEffect(()=>{
    panelWRef.current = panelW;
  },[panelW]);

  React.useEffect(()=>{
    return ()=>{
      if(panelResizeFrameRef.current!==null){
        window.cancelAnimationFrame(panelResizeFrameRef.current);
      }
    };
  },[]);

  useEffect(()=>{
    (async()=>{
      // Load index + roles + global institutes list in parallel
      const [t,r,gInst,gSubjects,gSyllabi,gDeleted,savedBin,savedLedgrSchedule,savedTelegramConfig]=await Promise.all([
        getAllTeachers(),
        getAllRoles(),
        getGlobalInstitutes(),
        getGlobalSubjects(),
        getSyllabusTemplates(),
        getDeletedInstitutesList(),
        getAdminBin(),
        getLedgrReportSchedule(),
        getLedgrTelegramConfig(),
      ]);
      setTeachers(t); setRoles(r);
      setGlobalSubjects(gSubjects);
      setSyllabusTemplates(gSyllabi);
      setLedgrReportSchedule(savedLedgrSchedule);
      setLedgrReportScheduleLoading(false);
      setLedgrTelegramConfig(savedTelegramConfig);
      setLedgrTelegramLoading(false);
      // Restore persisted deleted-institutes set so page refresh doesn't un-hide them
      if(gDeleted.length>0) setDeletedInstitutes(new Set(gDeleted.map(i=>i.trim())));
      // Restore persisted admin recycle bin
      if(savedBin.length>0) setAdminBin(savedBin);

      if(gInst.length>0){
        // Config doc exists and has institutes — use it
        setGlobalInstList(gInst);
      } else {
        // Config doc empty or missing — seed from teacher index (all known institutes)
        const fromIndex=[...new Set(t.flatMap(teacher=>(teacher.institutes||[]).map(i=>i.trim()).filter(Boolean)))].sort();
        setGlobalInstList(fromIndex);
        // Save to config so next load is fast and authoritative
        if(fromIndex.length>0){
          try{
            const{doc:d,setDoc:s}=await import("firebase/firestore");
            const{db:fdb}=await import("./firebase");
            await s(d(fdb,"config","institutes"),{list:fromIndex});
          }catch(e){console.warn("Could not seed institutes config",e);}
        }
      }
      setLoading(false);
    })();
  },[]);

  // Persist bin to Firestore whenever it changes
  const persistAdminBin = React.useCallback(async (updater) => {
    setAdminBin(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveAdminBin(next).catch(()=>{});
      return next;
    });
  }, []);

  const showAdminToast = React.useCallback((message) => {
    if(!message) return;
    setAdminToast(String(message));
    if(adminToastTimer.current){
      window.clearTimeout(adminToastTimer.current);
    }
    adminToastTimer.current = window.setTimeout(() => {
      setAdminToast(null);
      adminToastTimer.current = null;
    }, 3200);
  }, []);

  useEffect(()=>()=>{
    if(adminToastTimer.current){
      window.clearTimeout(adminToastTimer.current);
      adminToastTimer.current = null;
    }
  },[]);

  // ── Browser history — Android back gesture ───────────────────────────────────
  // Keep the browser stack aligned with the visible mobile drill-down state,
  // but skip synthetic pushes while we are restoring a prior entry.
  const currentNavState = useMemo(() => ({
    view,
    mobileSurface,
    mobileStep,
    instDetailView: instDetailView || null,
    selInst: selInst || null,
    tab,
    selP2: selP2 || null,
    selP3: selP3 || null,
    fullView: fullView || null,
  }), [view, mobileSurface, mobileStep, instDetailView, selInst, tab, selP2, selP3, fullView]);
  const currentNavKey = useMemo(() => JSON.stringify(currentNavState), [currentNavState]);
  const buildAdminHistoryUrl = React.useCallback((state, navToken = 0) => {
    if(typeof window === "undefined") return "";
    const base = `${window.location.pathname}${window.location.search}`;
    const scope = state.view === "manage"
      ? `manage-${state.mobileStep || 0}`
      : `${state.view || "main"}-${state.mobileSurface || "workspace"}-${state.mobileStep || 0}-${state.tab || "class"}`;
    return `${base}#admin-${scope}-${navToken}`;
  }, []);

  useEffect(() => {
    adminHistoryTokenRef.current = 1;
    rootHistoryKeyRef.current = currentNavKey;
    window.history.replaceState({ ...currentNavState, navToken:0 }, "", buildAdminHistoryUrl(currentNavState, 0));
    window.history.pushState({ ...currentNavState, navToken:1 }, "", buildAdminHistoryUrl(currentNavState, 1));
    lastHistoryKeyRef.current = currentNavKey;
    historyReadyRef.current = true;
  }, [buildAdminHistoryUrl]);

  useEffect(() => {
    if(!historyReadyRef.current) return;
    if(historyRestoreRef.current){
      historyRestoreRef.current = false;
      lastHistoryKeyRef.current = currentNavKey;
      return;
    }
    if(currentNavKey === lastHistoryKeyRef.current) return;
    const nextToken = adminHistoryTokenRef.current + 1;
    adminHistoryTokenRef.current = nextToken;
    window.history.pushState({ ...currentNavState, navToken:nextToken }, "", buildAdminHistoryUrl(currentNavState, nextToken));
    lastHistoryKeyRef.current = currentNavKey;
  }, [buildAdminHistoryUrl, currentNavKey, currentNavState]);

  useEffect(() => {
    const onPop = (e) => {
      const s = e.state;
      if (!s) return;
      const { navToken, ...restoredNavState } = s;
      historyRestoreRef.current = true;
      lastHistoryKeyRef.current = JSON.stringify(restoredNavState);
      setProfileOpen(false);
      setExportOpen(false);
      setInstituteGlanceOptionsOpen(false);
      setInstituteGlanceOpen(false);
      setView(restoredNavState.view ?? "main");
      setMobileSurface(
        restoredNavState.mobileSurface === "profile"
          ? "profile"
          : restoredNavState.mobileSurface === "centreSummary"
            ? "centreSummary"
            : "workspace"
      );
      setMobileStep(typeof restoredNavState.mobileStep === "number" ? restoredNavState.mobileStep : 0);
      setInstDetailView(restoredNavState.instDetailView ?? null);
      setSelInst(restoredNavState.selInst ?? null);
      setTab(restoredNavState.tab === "teacher" ? "teacher" : "class");
      setSelP2(restoredNavState.selP2 ?? null);
      setSelP3(restoredNavState.selP3 ?? null);
      setFullView(restoredNavState.fullView ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const closeAdminOverlay = React.useCallback(() => {
    if(exportOpen){ setExportOpen(false); return true; }
    if(instituteGlanceOptionsOpen){ setInstituteGlanceOptionsOpen(false); return true; }
    if(telegramDashboardOpen){ setTelegramDashboardOpen(false); return true; }
    if(instituteGlanceOpen){ setInstituteGlanceOpen(false); return true; }
    if(profileOpen){ setProfileOpen(false); return true; }
    if(adminConfirm){ setAdminConfirm(null); return true; }
    if(deleteModal){ setDeleteModal(null); return true; }
    if(instDeleteModal){ setInstDeleteModal(null); return true; }
    if(grpModal){ setGrpModal(null); return true; }
    if(copyGroupModal){ setCopyGroupModal(null); return true; }
    if(legacySectionRepair){ setLegacySectionRepair(null); return true; }
    return false;
  }, [adminConfirm, copyGroupModal, deleteModal, exportOpen, grpModal, instDeleteModal, instituteGlanceOpen, instituteGlanceOptionsOpen, legacySectionRepair, profileOpen, telegramDashboardOpen]);
  useEffect(() => {
    if(!Capacitor.isNativePlatform()) return undefined;
    const listenerPromise = CapacitorApp.addListener("backButton", () => {
      if(closeAdminOverlay()) return;
      if(currentNavKey !== rootHistoryKeyRef.current){
        window.history.back();
        return;
      }
      CapacitorApp.exitApp();
    });
    return () => {
      Promise.resolve(listenerPromise).then(handle => handle?.remove?.()).catch(()=>{});
    };
  }, [closeAdminOverlay, currentNavKey]);

  // Lazy-load full data for a teacher only when needed
  const ensureFullData = React.useCallback(async (uid) => {
    if(!uid) return null;
    if (fullDataRef.current[uid]) return fullDataRef.current[uid];
    if (fullDataRequestRef.current[uid]) return fullDataRequestRef.current[uid];
    setLoadingUids(s=>s.has(uid)?s:new Set([...s,uid]));
    const pending = getTeacherFullData(uid)
      .then(d=>{
        if (d){
          if(!fullDataRef.current[uid]){
            fullDataRef.current = { ...fullDataRef.current, [uid]: d };
          }
          setFullData(prev=>prev[uid]?prev:{...prev,[uid]:d});
        }
        return d || null;
      })
      .finally(()=>{
        delete fullDataRequestRef.current[uid];
        setLoadingUids(s=>{
          if(!s.has(uid)) return s;
          const n=new Set(s);
          n.delete(uid);
          return n;
        });
      });
    fullDataRequestRef.current[uid] = pending;
    return pending;
  },[]);

  const getTeacherInstituteList = React.useCallback((teacher) => {
    const list = [];
    const add = (value) => {
      const next = String(value || "").trim();
      if(!next) return;
      if(list.some(existing => sameInstituteName(existing, next))) return;
      list.push(next);
    };
    (teacher?.institutes || []).forEach(add);
    const data = fullData[teacher?.uid];
    (data?.profile?.institutes || []).forEach(add);
    (data?.classes || []).forEach(cls => add(cls?.institute));
    return list;
  }, [fullData]);

  const teacherBelongsToInstitute = React.useCallback((teacher, instituteName) => {
    if(!teacher || !instituteName) return false;
    return getTeacherInstituteList(teacher).some(inst => sameInstituteName(inst, instituteName));
  }, [getTeacherInstituteList]);

  const getTeacherDisplayName = React.useCallback((teacher) => {
    const data = fullData[teacher?.uid];
    return data?.profile?.name || teacher?.name || "Unknown";
  }, [fullData]);

  const getTeacherEmail = React.useCallback((teacher) => {
    const data = fullData[teacher?.uid];
    return String(data?.profile?.email || teacher?.email || "").trim();
  }, [fullData]);

  // Keep the canonical institute list defined before any derived summaries use it.
  const institutes=useMemo(()=>{
    const set=new Set();
    // Primary: admin-created global list from config/institutes (accurate, mobile-safe)
    globalInstList.forEach(i=>{ if(i) set.add(i.trim()); });
    // Supplement: teacher index catches institutes not yet in admin list (legacy data)
    teachers.forEach(t=>{
      (t.institutes||[]).forEach(i=>{ if(i) set.add(i.trim()); });
    });
    // Supplement: fullData for any institute added after last index sync
    Object.values(fullData).forEach(d=>{
      (d.classes||[]).forEach(c=>{ if(c.institute) set.add(c.institute.trim()); });
      (d.profile?.institutes||[]).forEach(i=>{ if(i) set.add(String(i).trim()); });
    });
    // Remove locally deleted institutes
    deletedInstitutes.forEach(i=>set.delete(i));
    // Preserve admin-defined order from globalInstList, append any extras at end
    const ordered = globalInstList.filter(i=>set.has(i));
    const extras   = Array.from(set).filter(i=>!globalInstList.includes(i)).sort();
    return [...ordered, ...extras];
  },[globalInstList,teachers,fullData,deletedInstitutes]);

  const teacherOnlyList = useMemo(
    () => teachers.filter(t => roles[t.uid] !== "admin"),
    [teachers, roles]
  );

  const instituteGlanceTeacherList = useMemo(
    () => teachers.filter(teacher => !!teacher?.uid),
    [teachers]
  );

  const getInstituteTeacherUids = React.useCallback((inst) => {
    const snapshot = fullDataRef.current || {};
    return teachers
      .filter(t => teacherBelongsToInstituteFromMap(t, inst, snapshot))
      .map(t => t.uid);
  }, [teachers]);

  const warmTeacherUids = React.useCallback(async (uids, instLabel = null) => {
    const tracksInstituteProgress = !!instLabel;
    const requestId = tracksInstituteProgress ? ++warmupJobRef.current : warmupJobRef.current;
    const unique = [...new Set((uids || []).filter(Boolean))];
    const missing = unique.filter(uid => !fullDataRef.current[uid]);

    if(instLabel){
      setInstWarmup({ inst:instLabel, total:missing.length, loaded:0 });
    }
    if(!missing.length){
      if(instLabel) setInstWarmup({ inst:instLabel, total:0, loaded:0 });
      return;
    }

    for(let i=0;i<missing.length;i+=1){
      if(tracksInstituteProgress && requestId!==warmupJobRef.current) return;
      await ensureFullData(missing[i]);
      if(tracksInstituteProgress && requestId!==warmupJobRef.current) return;
      if(instLabel){
        const loaded = i + 1;
        setInstWarmup(prev=>prev.inst===instLabel?{...prev,loaded}:prev);
      }
      if((isWeakDevice || mobileLiteMode) && i < missing.length - 1){
        await new Promise(resolve=>window.setTimeout(resolve, 40));
      }
    }
  }, [ensureFullData, isWeakDevice, mobileLiteMode]);

  const warmInstitute = React.useCallback((inst) => {
    warmTeacherUids(getInstituteTeacherUids(inst), inst);
  }, [getInstituteTeacherUids, warmTeacherUids]);

  React.useEffect(()=>{
    if(instDetailView){
      warmInstitute(instDetailView);
    }
  },[instDetailView, warmInstitute]);

  React.useEffect(() => {
    instituteGlanceReportRef.current = instituteGlanceReport;
  }, [instituteGlanceReport]);

  const getInstituteGlanceConfig = React.useCallback((overrides = {}) => ({
    period:overrides.period || instituteGlancePeriod,
    month:overrides.month || instituteGlanceMonth,
    rangeStart:overrides.rangeStart || instituteGlanceRangeStart,
    rangeEnd:overrides.rangeEnd || instituteGlanceRangeEnd,
  }), [instituteGlanceMonth, instituteGlancePeriod, instituteGlanceRangeEnd, instituteGlanceRangeStart]);

  const getInstituteGlanceConfigKey = React.useCallback((config) => {
    const resolved = getInstituteGlanceConfig(config);
    return JSON.stringify({
      period:resolved.period,
      month:resolved.period === "monthly" ? resolved.month : "",
      rangeStart:resolved.period === "range" ? resolved.rangeStart : "",
      rangeEnd:resolved.period === "range" ? resolved.rangeEnd : "",
    });
  }, [getInstituteGlanceConfig]);

  const getInstituteGlancePeriodRange = React.useCallback((config = {}) => {
    const resolved = getInstituteGlanceConfig(config);
    if(resolved.period === "monthly"){
      const bounds = monthBoundsFromKey(resolved.month);
      return { rangeStartKey:bounds.startKey, rangeEndKey:bounds.endKey };
    }
    if(resolved.period === "range"){
      return { rangeStartKey:resolved.rangeStart, rangeEndKey:resolved.rangeEnd };
    }
    if(resolved.period === "yesterday"){
      const yesterday = addDaysToDateKey(todayKey(), -1);
      return { rangeStartKey:yesterday, rangeEndKey:yesterday };
    }
    return { rangeStartKey:"", rangeEndKey:"" };
  }, [getInstituteGlanceConfig]);

  const buildInstituteGlanceSnapshot = React.useCallback((fullDataMap = {}, config = {}) => {
    const resolved = getInstituteGlanceConfig(config);
    const { rangeStartKey, rangeEndKey } = getInstituteGlancePeriodRange(resolved);
    const rows = buildInstituteGlanceRows({
      institutes,
      teachers: instituteGlanceTeacherList,
      fullDataMap,
      resolveSectionName:(section, instituteName) => resolveAdminSectionName(section, instituteName, instSectionsAll),
      syllabusTemplates,
      roles,
      period:resolved.period,
      rangeStartKey,
      rangeEndKey,
    });
    return {
      rows,
      summary: summariseInstituteGlanceRows(rows),
      loadedInstitutes: rows.filter(row => row.ready).length,
      totalInstitutes: rows.length,
    };
  }, [getInstituteGlanceConfig, getInstituteGlancePeriodRange, instSectionsAll, instituteGlanceTeacherList, institutes, roles, syllabusTemplates]);

  const buildTargetedInstituteGlanceReport = React.useCallback(async (instituteNames = [], config = {}) => {
    const requestedInstitutes = [...new Set((instituteNames || []).map(name => String(name || "").trim()).filter(Boolean))];
    if(!requestedInstitutes.length){
      return {
        rows: [],
        summary: EMPTY_INSTITUTE_GLANCE_SUMMARY,
        loadedInstitutes: 0,
        totalInstitutes: 0,
        ready: false,
      };
    }

    const resolved = getInstituteGlanceConfig(config);
    const { rangeStartKey, rangeEndKey } = getInstituteGlancePeriodRange(resolved);
    const hydratedFullData = {
      ...(fullDataRef.current || {}),
      ...instituteGlanceDataRef.current,
      ...fullData,
    };

    let relevantTeachers = instituteGlanceTeacherList.filter(teacher =>
      requestedInstitutes.some(inst => teacherBelongsToInstituteFromMap(teacher, inst, hydratedFullData))
    );

    const pendingUids = relevantTeachers
      .map(teacher => teacher?.uid)
      .filter(Boolean)
      .filter(uid => !hydratedFullData[uid]);

    if(pendingUids.length){
      let nextPendingIndex = 0;
      const maxConcurrentLoads = Math.max(
        1,
        Math.min(
          pendingUids.length,
          isMobile
            ? (isWeakDevice || mobileLiteMode ? 3 : 4)
            : (isWeakDevice ? 5 : 8)
        )
      );

      const worker = async () => {
        while(true){
          const pendingIndex = nextPendingIndex;
          nextPendingIndex += 1;
          if(pendingIndex >= pendingUids.length) return;

          const uid = pendingUids[pendingIndex];
          const data = await ensureFullData(uid);
          if(data){
            hydratedFullData[uid] = data;
            instituteGlanceDataRef.current[uid] = data;
          }
        }
      };

      await Promise.all(
        Array.from({ length:maxConcurrentLoads }, () => worker())
      );

      relevantTeachers = instituteGlanceTeacherList.filter(teacher =>
        requestedInstitutes.some(inst => teacherBelongsToInstituteFromMap(teacher, inst, hydratedFullData))
      );
    }

    const rows = buildInstituteGlanceRows({
      institutes: requestedInstitutes,
      teachers: relevantTeachers,
      fullDataMap: hydratedFullData,
      resolveSectionName:(section, instituteName) => resolveAdminSectionName(section, instituteName, instSectionsAll),
      syllabusTemplates,
      roles,
      period:resolved.period,
      rangeStartKey,
      rangeEndKey,
    });

    return {
      rows,
      summary: summariseInstituteGlanceRows(rows),
      loadedInstitutes: rows.filter(row => row.ready).length,
      totalInstitutes: rows.length,
      ready: rows.every(row => row.ready),
    };
  }, [ensureFullData, fullData, getInstituteGlanceConfig, getInstituteGlancePeriodRange, instSectionsAll, instituteGlanceTeacherList, isMobile, isWeakDevice, mobileLiteMode, roles, syllabusTemplates]);

  const scheduleInstituteGlanceReport = React.useCallback((nextReport) => {
    instituteGlanceReportRef.current = nextReport;
    if(typeof React.startTransition === "function"){
      React.startTransition(() => setInstituteGlanceReport(nextReport));
      return;
    }
    setInstituteGlanceReport(nextReport);
  }, []);

  const handleInstituteGlanceLoadFailure = React.useCallback((error) => {
    console.error("institute glance load failed", error);
    setInstituteGlanceReport(prev => {
      const next = {
        ...prev,
        loading: false,
        error: error?.message || "Could not load the centre summary.",
      };
      instituteGlanceReportRef.current = next;
      return next;
    });
  }, []);

  const loadInstituteGlanceReport = React.useCallback(async ({ force = false, config = {} } = {}) => {
    const resolvedConfig = getInstituteGlanceConfig(config);
    const configKey = getInstituteGlanceConfigKey(resolvedConfig);
    const currentReport = instituteGlanceReportRef.current;
    const currentMatches = currentReport.configKey === configKey;
    if(!force && currentMatches && currentReport.loading) return currentReport;
    if(!force && currentMatches && currentReport.ready && !currentReport.error) return currentReport;

    const jobId = ++instituteGlanceJobRef.current;
    const teacherUids = instituteGlanceTeacherList.map(t => t.uid).filter(Boolean);
    const total = teacherUids.length;
    const cachedMap = force ? {} : instituteGlanceDataRef.current;
    const hydratedFullData = { ...fullData, ...cachedMap };
    const pendingUids = force
      ? teacherUids
      : teacherUids.filter(uid => !hydratedFullData[uid]);
    let loaded = force ? 0 : teacherUids.filter(uid => !!hydratedFullData[uid]).length;

    if(!pendingUids.length){
      const snapshot = buildInstituteGlanceSnapshot(hydratedFullData, resolvedConfig);
      const readyReport = {
        ...snapshot,
        configKey,
        loading:false,
        loaded:total,
        total,
        ready:snapshot.loadedInstitutes >= snapshot.totalInstitutes,
        error:"",
      };
      scheduleInstituteGlanceReport(readyReport);
      return readyReport;
    }

    const preserveReadyReport = currentMatches && currentReport.ready && !currentReport.error;
    const loadingReport = preserveReadyReport
      ? {
          ...currentReport,
          loading:true,
          loaded,
          total,
          error:"",
        }
      : {
          configKey,
          rows:[],
          summary:EMPTY_INSTITUTE_GLANCE_SUMMARY,
          loading:true,
          loaded,
          total,
          loadedInstitutes:0,
          totalInstitutes:institutes.length,
          ready:false,
          error:"",
        };
    scheduleInstituteGlanceReport(loadingReport);

    let firstError = null;
    let nextPendingIndex = 0;
    const maxConcurrentLoads = Math.max(
      1,
      Math.min(
        pendingUids.length,
        isMobile
          ? (isWeakDevice || mobileLiteMode ? 3 : 4)
          : (isWeakDevice ? 5 : 8)
      )
    );

    const worker = async () => {
      while(true){
        const pendingIndex = nextPendingIndex;
        nextPendingIndex += 1;
        if(pendingIndex >= pendingUids.length) return;

        const uid = pendingUids[pendingIndex];
        try {
          const data = await getTeacherFullData(uid);
          if(jobId !== instituteGlanceJobRef.current) return;
          if(data){
            hydratedFullData[uid] = data;
            instituteGlanceDataRef.current[uid] = data;
          }
        } catch (error) {
          if(jobId !== instituteGlanceJobRef.current) return;
          if(!firstError) firstError = error;
        }

        loaded += 1;
      }
    };

    await Promise.all(
      Array.from({ length:maxConcurrentLoads }, () => worker())
    );

    if(jobId !== instituteGlanceJobRef.current) return null;

    const finalSnapshot = buildInstituteGlanceSnapshot(hydratedFullData, resolvedConfig);
    const finalReport = {
      ...finalSnapshot,
      configKey,
      loading: false,
      loaded: total,
      total,
      ready: finalSnapshot.loadedInstitutes >= finalSnapshot.totalInstitutes && !firstError,
      error: firstError?.message || "",
    };
    scheduleInstituteGlanceReport(finalReport);
    return finalReport;
  }, [buildInstituteGlanceSnapshot, fullData, getInstituteGlanceConfig, getInstituteGlanceConfigKey, instituteGlanceTeacherList, institutes.length, isMobile, isWeakDevice, mobileLiteMode, scheduleInstituteGlanceReport]);

  React.useEffect(() => {
    const visible = instituteGlanceOpen || mobileSurface === "centreSummary";
    if(!visible){
      instituteGlanceAutoLoadKeyRef.current = "";
      return;
    }
    const activeConfig = {
      period:instituteGlancePeriod,
      month:instituteGlanceMonth,
      rangeStart:instituteGlanceRangeStart,
      rangeEnd:instituteGlanceRangeEnd,
    };
    const autoLoadKey = JSON.stringify({
      surface:instituteGlanceOpen ? "desktop" : "mobile",
      config:getInstituteGlanceConfigKey(activeConfig),
      institutes:institutes.length,
      teachers:instituteGlanceTeacherList.length,
    });
    if(instituteGlanceAutoLoadKeyRef.current === autoLoadKey) return;
    instituteGlanceAutoLoadKeyRef.current = autoLoadKey;
    loadInstituteGlanceReport({
      config:activeConfig,
    }).catch(handleInstituteGlanceLoadFailure);
  }, [getInstituteGlanceConfigKey, handleInstituteGlanceLoadFailure, instituteGlanceMonth, instituteGlanceOpen, instituteGlancePeriod, instituteGlanceRangeEnd, instituteGlanceRangeStart, instituteGlanceTeacherList.length, institutes.length, loadInstituteGlanceReport, mobileSurface]);

  const openMobileCentreSummary = React.useCallback(() => {
    setProfileOpen(false);
    setInstituteGlanceOpen(false);
    setView("main");
    setMobileSurface("centreSummary");
    setSelInst(null);
    setSelP2(null);
    setSelP3(null);
    setFullView(null);
    setP2Search("");
    setP3Search("");
    setActiveProgramFilter(null);
    setMobileStep(0);
    loadInstituteGlanceReport().catch(handleInstituteGlanceLoadFailure);
  }, [handleInstituteGlanceLoadFailure, loadInstituteGlanceReport]);

  const openInstituteGlancePanel = React.useCallback(() => {
    if(isMobile){
      openMobileCentreSummary();
      return;
    }
    setProfileOpen(false);
    setInstituteGlanceOptionsOpen(false);
    setTelegramDashboardOpen(false);
    setInstituteGlanceOpen(false);
    setManageScopeInstitute("");
    setOpenTeacherInstitute(null);
    setOpenAdminInstitute(null);
    setInstDetailView(null);
    setManageTab("report");
    setView("manage");
    loadInstituteGlanceReport().catch(handleInstituteGlanceLoadFailure);
  }, [handleInstituteGlanceLoadFailure, isMobile, loadInstituteGlanceReport, openMobileCentreSummary]);

  const closeInstituteGlancePanel = React.useCallback(() => {
    setInstituteGlanceOpen(false);
  }, []);

  const openDailyLedgrReport = React.useCallback(() => {
    setInstituteGlancePeriod("daily");
    setInstituteGlanceMonth(currentMonthKey());
    setInstituteGlanceRangeStart(addDaysToDateKey(todayKey(), -6));
    setInstituteGlanceRangeEnd(todayKey());
    setProfileOpen(false);
    if(isMobile){
      setInstituteGlanceOpen(false);
      setView("main");
      setMobileSurface("centreSummary");
      setSelInst(null);
      setSelP2(null);
      setSelP3(null);
      setFullView(null);
      setP2Search("");
      setP3Search("");
      setActiveProgramFilter(null);
      setMobileStep(0);
      return;
    }
    setInstituteGlanceOptionsOpen(false);
    setTelegramDashboardOpen(false);
    setInstituteGlanceOpen(false);
    setManageScopeInstitute("");
    setOpenTeacherInstitute(null);
    setOpenAdminInstitute(null);
    setInstDetailView(null);
    setManageTab("report");
    setView("manage");
  }, [isMobile]);

  const openInstituteFromGlance = React.useCallback((row) => {
    if(!row?.institute || !row.ready) return;
    const nextEntries = {};
    (row.teacherUids || []).forEach(uid => {
      const data = instituteGlanceDataRef.current[uid];
      if(data) nextEntries[uid] = data;
    });
    if(Object.keys(nextEntries).length){
      setFullData(prev => ({ ...prev, ...nextEntries }));
    }
    setInstituteGlanceOpen(false);
    setProfileOpen(false);
    setView("main");
    setMobileSurface("workspace");
    setSelInst(row.institute);
    setTab("class");
    setSelP2(null);
    setSelP3(null);
    setFullView(null);
    setP2Search("");
    setP3Search("");
    setActiveProgramFilter(null);
    setMobileStep(1);
  }, []);

  const getInstituteGlanceGeneratedOnLabel = React.useCallback(() => `Generated ${new Date().toLocaleString("en-IN",{
    day:"numeric",
    month:"short",
    year:"numeric",
    hour:"numeric",
    minute:"2-digit",
  })}`, []);

  const exportInstituteGlance = React.useCallback(async (format, { config = {}, selectedInstitutes = [] } = {}) => {
    if(instituteGlanceExportBusy) return;
    setInstituteGlanceExportBusy(format);
    try {
      const resolvedConfig = getInstituteGlanceConfig(config);
      const report = await loadInstituteGlanceReport({ config:resolvedConfig });
      if(!report?.ready){
        throw new Error("The report is still loading. Please try again when all centres are ready.");
      }
      const reportRows = report.rows || [];
      const rows = selectedInstitutes.length
        ? reportRows.filter(row => selectedInstitutes.some(institute => sameInstituteName(institute, row.institute)))
        : reportRows;
      if(!rows.length){
        throw new Error("Select at least one institute to export.");
      }
      const summary = summariseInstituteGlanceRows(rows);
      const allSelected = rows.length === reportRows.length;
      const scopeLabel = allSelected
        ? "All institutes"
        : rows.length === 1
          ? rows[0].institute
          : `${rows.length} selected institutes`;
      const scopeFilePart = allSelected
        ? "all_institutes"
        : rows.length === 1
          ? slugifyDownloadPart(rows[0].institute)
          : `selected_${rows.length}_institutes`;
      const generatedOnLabel = getInstituteGlanceGeneratedOnLabel();
      const { rangeStartKey, rangeEndKey } = getInstituteGlancePeriodRange(resolvedConfig);
      if(format === "png"){
        await downloadInstituteGlanceSummaryPng({ rows, summary, generatedOnLabel, period:resolvedConfig.period, rangeStartKey, rangeEndKey, scopeLabel, scopeFilePart });
      } else if(format === "zip"){
        await downloadInstituteGlanceInstituteZip({ rows, generatedOnLabel, period:resolvedConfig.period, rangeStartKey, rangeEndKey });
      } else {
        await downloadInstituteGlanceSummaryPdf({ rows, summary, generatedOnLabel, period:resolvedConfig.period, rangeStartKey, rangeEndKey, scopeLabel, scopeFilePart });
      }
    } catch (error) {
      console.error("institute glance export failed", error);
      window.alert(error?.message || "Could not export the institute glance summary. Please try again.");
    } finally {
      setInstituteGlanceExportBusy("");
    }
  }, [getInstituteGlanceConfig, getInstituteGlanceGeneratedOnLabel, getInstituteGlancePeriodRange, instituteGlanceExportBusy, loadInstituteGlanceReport]);

  const exportInstituteGlanceRowPdf = React.useCallback(async (row) => {
    if(!row?.institute || !row.ready || instituteGlanceRowExportBusy) return;
    const busyKey = row.institute;
    setInstituteGlanceRowExportBusy(busyKey);
    try {
      const report = await loadInstituteGlanceReport();
      const freshRow = (report?.rows || []).find(item => sameInstituteName(item?.institute, row.institute));
      if(!freshRow){
        throw new Error("Could not rebuild the latest centre summary for this institute.");
      }
      const { rangeStartKey, rangeEndKey } = getInstituteGlancePeriodRange();
      await downloadInstituteGlanceInstitutePdf({
        row:freshRow,
        generatedOnLabel:getInstituteGlanceGeneratedOnLabel(),
        period:instituteGlancePeriod,
        rangeStartKey,
        rangeEndKey,
      });
    } catch (error) {
      console.error("institute glance row export failed", error);
      window.alert("Could not export this centre PDF. Please try again.");
    } finally {
      setInstituteGlanceRowExportBusy("");
    }
  }, [getInstituteGlanceGeneratedOnLabel, getInstituteGlancePeriodRange, instituteGlancePeriod, instituteGlanceRowExportBusy, loadInstituteGlanceReport]);

  const applyInstituteGlanceOptions = React.useCallback(({ period:nextPeriod, month:nextMonth, rangeStart, rangeEnd, format, selectedInstitutes }) => {
    const nextConfig = {
      period:nextPeriod || "daily",
      month:nextMonth || currentMonthKey(),
      rangeStart:rangeStart || todayKey(),
      rangeEnd:rangeEnd || todayKey(),
    };
    setInstituteGlancePeriod(nextConfig.period);
    setInstituteGlanceMonth(nextConfig.month);
    setInstituteGlanceRangeStart(nextConfig.rangeStart);
    setInstituteGlanceRangeEnd(nextConfig.rangeEnd);
    setInstituteGlanceOptionsOpen(false);
    exportInstituteGlance(format, { config:nextConfig, selectedInstitutes });
  }, [exportInstituteGlance]);

  const saveInstituteGlanceSchedule = React.useCallback(async (nextSchedule) => {
    if(ledgrReportScheduleSaving) return;
    setLedgrReportScheduleSaving(true);
    try {
      const saved = await saveLedgrReportSchedule(nextSchedule, user?.uid || "");
      setLedgrReportSchedule(current => ({ ...(current || {}), ...saved }));
      setInstituteGlanceOptionsOpen(false);
      showAdminToast(saved.enabled
        ? "Ledgr schedule saved for the daily 8 PM batch."
        : "Ledgr report schedule paused.");
    } catch(error) {
      console.error("save Ledgr report schedule failed", error);
      showAdminToast(error?.message || "Could not save the Ledgr report schedule.");
    } finally {
      setLedgrReportScheduleSaving(false);
    }
  }, [ledgrReportScheduleSaving, showAdminToast, user?.uid]);

  const openInstituteGlanceOptions = React.useCallback((mode = "export", context = "report") => {
    setProfileOpen(false);
    setInstituteGlanceOptionsContext(context === "messenger" ? "messenger" : "report");
    setInstituteGlanceOptionsMode(mode === "schedule" ? "schedule" : "export");
    setInstituteGlanceOptionsOpen(false);
    if(typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"){
      if(instituteGlanceOptionsFrameRef.current){
        window.cancelAnimationFrame(instituteGlanceOptionsFrameRef.current);
      }
      instituteGlanceOptionsFrameRef.current = window.requestAnimationFrame(() => {
        instituteGlanceOptionsFrameRef.current = null;
        setInstituteGlanceOptionsOpen(true);
      });
      return;
    }
    setInstituteGlanceOptionsOpen(true);
  }, []);

  const openLedgrTelegramDashboard = React.useCallback(() => {
    setProfileOpen(false);
    setInstituteGlanceOptionsOpen(false);
    if(isMobile){
      setTelegramDashboardOpen(true);
      return;
    }
    setInstituteGlanceOpen(false);
    setTelegramDashboardOpen(false);
    setManageScopeInstitute("");
    setOpenTeacherInstitute(null);
    setOpenAdminInstitute(null);
    setInstDetailView(null);
    setManageTab("messenger");
    setView("manage");
  }, [isMobile]);

  const openLedgrTelegramSchedule = React.useCallback(() => {
    setProfileOpen(false);
    setTelegramDashboardOpen(false);
    openInstituteGlanceOptions("schedule", "messenger");
  }, [openInstituteGlanceOptions]);

  const saveLedgrTelegramDashboard = React.useCallback(async (nextConfig) => {
    if(ledgrTelegramSaving) return null;
    setLedgrTelegramSaving(true);
    try {
      const saved = await saveLedgrTelegramConfig(nextConfig, user?.uid || "");
      setLedgrTelegramConfig(current => ({ ...(current || {}), ...saved }));
      showAdminToast("Messenger dashboard saved.");
      return saved;
    } catch (error) {
      console.error("save Telegram dashboard failed", error);
      showAdminToast(error?.message || "Messenger dashboard could not be saved.");
      throw error;
    } finally {
      setLedgrTelegramSaving(false);
    }
  }, [ledgrTelegramSaving, showAdminToast, user?.uid]);

  const ledgrTelegramRecipientStats = React.useMemo(() => {
    const recipients = Array.isArray(ledgrTelegramConfig?.recipients) ? ledgrTelegramConfig.recipients : [];
    const fullReportRecipients = Array.isArray(ledgrTelegramConfig?.fullReportRecipients) ? ledgrTelegramConfig.fullReportRecipients : [];
    const configured = [...recipients, ...fullReportRecipients].filter(item => normaliseTelegramChatId(item?.chatId)).length;
    const active = [...recipients, ...fullReportRecipients].filter(item => item?.enabled !== false && normaliseTelegramChatId(item?.chatId)).length;
    return { configured, active };
  }, [ledgrTelegramConfig]);

  const sendLedgrTelegramNow = React.useCallback(async (configOverride = null, options = {}) => {
    if(ledgrTelegramSending) return;
    try {
      const effectiveConfig = configOverride || ledgrTelegramConfig || {};
      const currentUser = auth.currentUser;
      if(!currentUser){
        showAdminToast("Sign in again before sending Telegram reports.");
        return;
      }
      if(effectiveConfig?.enabled === false){
        showAdminToast("Messenger delivery is paused in the dashboard.");
        return;
      }
      if(effectiveConfig?.delivery?.onDemandEnabled === false){
        showAdminToast("On-demand messenger sends are paused.");
        return;
      }

      const mode = String(options?.mode || "all").trim() || "all";
      const uniqueInstituteNames = (values = []) => {
        const ordered = [];
        (values || []).forEach(value => {
          const clean = String(value || "").trim();
          if(!clean) return;
          if(ordered.some(existing => sameInstituteName(existing, clean))) return;
          ordered.push(clean);
        });
        return ordered;
      };
      const routeRecipients = (effectiveConfig?.recipients || [])
        .filter(item => item?.enabled !== false && item?.institute && normaliseTelegramChatId(item?.chatId));
      const fullReportRecipients = (effectiveConfig?.fullReportRecipients || [])
        .filter(item => item?.enabled !== false && normaliseTelegramChatId(item?.chatId));
      const selectedInstitutes = uniqueInstituteNames(options?.institutes || []);
      const activeRecipients = mode === "full_report"
        ? []
        : selectedInstitutes.length
          ? routeRecipients.filter(item => selectedInstitutes.some(institute => sameInstituteName(institute, item?.institute)))
          : routeRecipients;
      const activeFullReportRecipients = mode === "institutes"
        ? []
        : fullReportRecipients;
      if(!activeRecipients.length && !activeFullReportRecipients.length){
        showAdminToast(mode === "full_report"
          ? "Add at least one active full-report Telegram user before sending."
          : "Add at least one active Telegram mapping before sending.");
        return;
      }

      setLedgrTelegramSending(true);
      const config = {
        period: instituteGlancePeriod,
        month: instituteGlanceMonth,
        rangeStart: instituteGlanceRangeStart,
        rangeEnd: instituteGlanceRangeEnd,
      };
      const { rangeStartKey, rangeEndKey } = getInstituteGlancePeriodRange(config);
      const generatedOnLabel = getInstituteGlanceGeneratedOnLabel();
      const jobs = [];

      if(activeRecipients.length){
        const requestedInstitutes = uniqueInstituteNames(activeRecipients.map(recipient => recipient.institute));
        const report = await buildTargetedInstituteGlanceReport(requestedInstitutes, config);
        if(!report?.ready){
          throw new Error("The selected Ledgr report is still preparing. Please try again in a moment.");
        }
        activeRecipients.forEach(recipient => {
          const row = (report.rows || []).find(item => sameInstituteName(item?.institute, recipient.institute));
          if(!row){
            throw new Error(`Could not find the current report row for ${recipient.institute}.`);
          }
          const rows = [row];
          const html = buildInstituteGlanceSummaryHtml({
            rows,
            summary: summariseInstituteGlanceRows(rows),
            generatedOnLabel,
            period: config.period,
            rangeStartKey,
            rangeEndKey,
            scopeLabel: row.institute || recipient.institute,
          });
          jobs.push({
            recipientId: recipient.id,
            html,
            filename: instituteGlancePdfFilename(row.institute || recipient.institute, config.period, rangeStartKey, rangeEndKey),
            caption: `Ledgr Report | ${row.institute || recipient.institute}`,
          });
        });
      }

      if(activeFullReportRecipients.length){
        const fullReportInstitutes = uniqueInstituteNames(
          selectedInstitutes.length
            ? selectedInstitutes
            : (institutes || [])
        );
        const report = await buildTargetedInstituteGlanceReport(fullReportInstitutes, config);
        if(!report?.ready){
          throw new Error("The complete Ledgr report is still preparing. Please try again in a moment.");
        }
        const html = buildInstituteGlanceSummaryHtml({
          rows: report.rows || [],
          summary: report.summary || summariseInstituteGlanceRows(report.rows || []),
          generatedOnLabel,
          period: config.period,
          rangeStartKey,
          rangeEndKey,
          scopeLabel: selectedInstitutes.length
            ? `${selectedInstitutes.length} institute${selectedInstitutes.length === 1 ? "" : "s"} selected`
            : "All institutes",
        });
        activeFullReportRecipients.forEach(recipient => {
          jobs.push({
            recipientId: recipient.id,
            html,
            filename: allInstitutesGlancePdfFilename(config.period, rangeStartKey, rangeEndKey),
            caption: `Ledgr Report | ${selectedInstitutes.length ? "Selected institutes" : "All institutes"}`,
          });
        });
      }

      const idToken = await currentUser.getIdToken();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 90000);
      let response;
      try {
        response = await fetch("/api/send-ledgr-telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            jobs,
            recipients: [...activeRecipients, ...activeFullReportRecipients].map(recipient => ({
              id: recipient.id,
              institute: recipient.institute,
              label: recipient.label,
              username: recipient.username || "",
              chatId: normaliseTelegramChatId(recipient.chatId),
              notes: recipient.notes || "",
              destinationType: recipient.destinationType || "private",
              enabled: recipient.enabled !== false,
            })),
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if(error?.name === "AbortError"){
          throw new Error("Telegram send timed out. Please try again.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if(payload?.execution || payload?.health){
        setLedgrTelegramConfig(current => ({
          ...(current || {}),
          ...(configOverride ? {
            enabled: effectiveConfig?.enabled !== false,
            botUsername: effectiveConfig?.botUsername || current?.botUsername || "",
            delivery: {
              ...(current?.delivery || {}),
              ...(effectiveConfig?.delivery || {}),
            },
            recipients: Array.isArray(effectiveConfig?.recipients) ? effectiveConfig.recipients : (current?.recipients || []),
            fullReportRecipients: Array.isArray(effectiveConfig?.fullReportRecipients) ? effectiveConfig.fullReportRecipients : (current?.fullReportRecipients || []),
          } : {}),
          execution: payload?.execution || current?.execution,
          health: payload?.health || current?.health,
        }));
      }
      if(!response.ok){
        throw new Error(
          payload?.error
          || payload?.execution?.lastErrorMessage
          || payload?.results?.find(item => item && item.ok === false)?.error
          || "Telegram delivery failed."
        );
      }

      const delivered = Number(payload?.execution?.lastDeliveredCount || 0);
      const failed = Number(payload?.execution?.lastFailureCount || 0);
      showAdminToast(
        failed > 0
          ? `Telegram sent ${delivered} report${delivered === 1 ? "" : "s"}; ${failed} failed.`
          : `Telegram sent ${delivered} report${delivered === 1 ? "" : "s"} successfully.`
      );
    } catch (error) {
      console.error("send Telegram reports failed", error);
      showAdminToast(error?.message || "Telegram reports could not be sent.");
    } finally {
      setLedgrTelegramSending(false);
    }
  }, [
    getInstituteGlanceGeneratedOnLabel,
    getInstituteGlancePeriodRange,
    instituteGlanceMonth,
    instituteGlancePeriod,
    instituteGlanceRangeEnd,
    instituteGlanceRangeStart,
    buildTargetedInstituteGlanceReport,
    institutes,
    ledgrTelegramConfig,
    ledgrTelegramSending,
    showAdminToast,
  ]);

  const openLegacySectionRepairForInstitute = React.useCallback(async (instituteName, { silent = false } = {}) => {
    try {
      if(!instituteName) return false;
      const instData = getInstituteSectionConfig(instSectionsAll, instituteName);
      const currentSections = getInstituteSectionNames(instData);
      if(!currentSections.length){
        if(!silent) showAdminToast("No current section list found for this institute.");
        return false;
      }

      const uids = getInstituteTeacherUids(instituteName);
      const loadedEntries = await Promise.allSettled(
        uids.map(async uid => [uid, await ensureFullData(uid)])
      );
      const fullSnapshot = {
        ...fullData,
        ...Object.fromEntries(
          loadedEntries
            .filter(result => result.status === "fulfilled" && result.value?.[1])
            .map(result => result.value)
        ),
      };
      const repair = collectLegacySectionRepairItems(fullSnapshot, teachers, instituteName, instSectionsAll);
      if(!repair.items.length){
        if(!silent) showAdminToast("No old section names were found for this institute.");
        return false;
      }

      setLegacySectionRepair({
        scopeLabel: instituteName,
        items: repair.items.map(item => ({
          ...item,
          institute: instituteName,
          options: repair.currentSections,
          selectionKey: `${instituteName}::${item.oldSection}`,
        })),
        selections: Object.fromEntries(repair.items.map(item => [`${instituteName}::${item.oldSection}`, item.suggested || ""])),
        busy: false,
        error: "",
      });
      return true;
    } catch (e) {
      console.error("openLegacySectionRepairForInstitute", e);
      if(!silent) showAdminToast("Could not open section mapping: " + (e?.message || "Unknown error"));
      return false;
    }
  }, [instSectionsAll, getInstituteTeacherUids, ensureFullData, fullData, teachers, showAdminToast]);

  const openLegacySectionRepair = React.useCallback(async () => {
    if(!selInst) return;
    await openLegacySectionRepairForInstitute(selInst);
  }, [selInst, openLegacySectionRepairForInstitute]);

  const openAllLegacySectionRepair = React.useCallback(async () => {
    try {
      const instituteSet = new Set();
      globalInstList.forEach(inst => { if(inst) instituteSet.add(String(inst).trim()); });
      teachers.forEach(teacher => {
        (teacher.institutes || []).forEach(inst => { if(inst) instituteSet.add(String(inst).trim()); });
      });
      Object.values(fullData).forEach(data => {
        (data.classes || []).forEach(cls => { if(cls?.institute) instituteSet.add(String(cls.institute).trim()); });
        (data.profile?.institutes || []).forEach(inst => { if(inst) instituteSet.add(String(inst).trim()); });
      });
      deletedInstitutes.forEach(inst => instituteSet.delete(inst));
      const instituteNames = [
        ...globalInstList.filter(inst => instituteSet.has(inst)),
        ...Array.from(instituteSet).filter(inst => !globalInstList.includes(inst)).sort(exportTextSorter.compare),
      ];
      const institutesWithSections = instituteNames.filter(inst => getInstituteSectionNames(getInstituteSectionConfig(instSectionsAll, inst)).length > 0);
      if(!institutesWithSections.length){
        showAdminToast("No institutes with section lists found.");
        return;
      }

      const allUids = [...new Set(institutesWithSections.flatMap(inst => getInstituteTeacherUids(inst)).filter(Boolean))];
      const loadedEntries = await Promise.allSettled(
        allUids.map(async uid => [uid, await ensureFullData(uid)])
      );
      const fullSnapshot = {
        ...fullData,
        ...Object.fromEntries(
          loadedEntries
            .filter(result => result.status === "fulfilled" && result.value?.[1])
            .map(result => result.value)
        ),
      };
      const items = collectAllLegacySectionRepairItems(fullSnapshot, teachers, institutesWithSections, instSectionsAll);
      if(!items.length){
        showAdminToast("No old section names were found across institutes.");
        return;
      }

      setLegacySectionRepair({
        scopeLabel: "all institutes",
        items,
        selections: Object.fromEntries(items.map(item => [item.selectionKey, item.suggested || ""])),
        busy: false,
        error: "",
      });
    } catch (e) {
      console.error("openAllLegacySectionRepair", e);
      showAdminToast("Could not open institute repair: " + (e?.message || "Unknown error"));
    }
  }, [globalInstList, teachers, fullData, deletedInstitutes, instSectionsAll, getInstituteTeacherUids, ensureFullData, showAdminToast]);

  const applyLegacySectionRepair = React.useCallback(async () => {
    if(!legacySectionRepair) return;
    const selections = legacySectionRepair.selections || {};
    const missing = legacySectionRepair.items.filter(item => !String(selections[item.selectionKey || item.oldSection] || "").trim());
    if(missing.length){
      setLegacySectionRepair(prev => prev ? { ...prev, error: "Choose a current section or delete each old section." } : prev);
      return;
    }

    setLegacySectionRepair(prev => prev ? { ...prev, busy: true, error: "" } : prev);
    try {
      const actionsByInstitute = {};
      legacySectionRepair.items.forEach(item => {
        const instituteName = item.institute || legacySectionRepair.scopeLabel || "";
        const action = String(selections[item.selectionKey || item.oldSection] || "").trim();
        if(!instituteName || !action) return;
        if(!actionsByInstitute[instituteName]) actionsByInstitute[instituteName] = {};
        actionsByInstitute[instituteName][item.oldSection] = action;
      });

      const affectedUids = [...new Set(
        legacySectionRepair.items
          .flatMap(item => (item.classRefs || []).map(ref => ref.uid))
          .filter(Boolean)
      )];
      const updatedEntries = [];
      let changedTeachers = 0;
      let deletedClasses = 0;

      for (const uid of affectedUids) {
        const latest = await getTeacherFullData(uid);
        if(!latest) continue;

        let nextData = latest;
        let changed = false;
        let removedClassIds = [];
        Object.entries(actionsByInstitute).forEach(([instituteName, actionMap]) => {
          const result = applyInstituteSectionActionsToTeacherData(nextData, instituteName, actionMap);
          nextData = result.data;
          if(result.changed){
            changed = true;
            removedClassIds.push(...(result.removedClassIds || []));
          }
        });

        if(!changed) continue;

        await saveUserData(uid, nextData, {
          expectedRevision: Number(latest?._meta?.revision || 0),
          source: "adminLegacySectionRepair",
        });

        const uniqueRemovedClassIds = [...new Set(removedClassIds.filter(Boolean))];
        if(uniqueRemovedClassIds.length){
          await Promise.all(
            uniqueRemovedClassIds.map(classId => deleteClassNotes(uid, classId).catch(() => {}))
          );
        }

        const fresh = await getTeacherFullData(uid);
        if(fresh) updatedEntries.push([uid, fresh]);
        changedTeachers += 1;
        deletedClasses += uniqueRemovedClassIds.length;
      }

      setFullData(prev => ({
        ...prev,
        ...Object.fromEntries(updatedEntries.filter(([, data]) => !!data)),
      }));
      setLegacySectionRepair(null);
      showAdminToast(
        changedTeachers
          ? `Applied section changes for ${changedTeachers} teacher${changedTeachers!==1?"s":""}${deletedClasses ? ` and removed ${deletedClasses} old class record${deletedClasses!==1?"s":""}` : ""}.`
          : "No matching class records needed changes."
      );
    } catch (e) {
      setLegacySectionRepair(prev => prev ? { ...prev, busy: false, error: e.message || "Repair failed." } : prev);
    }
  }, [legacySectionRepair, showAdminToast]);

  const setLegacySectionRepairSelection = React.useCallback((oldSection, nextSection) => {
    setLegacySectionRepair(prev => prev ? {
      ...prev,
      selections: { ...(prev.selections || {}), [oldSection]: nextSection },
      error: "",
    } : prev);
  }, []);

  const saveInstituteExtraSectionsForReview = React.useCallback(async (instituteName, nextSections) => {
    const instKey = getInstituteSectionConfigKey(instSectionsAll, instituteName);
    const instData = getInstituteSectionConfig(instSectionsAll, instKey) || {};
    const groupedLookup = new Set(
      (instData.gradeGroups || [])
        .flatMap(group => group.sections || [])
        .map(normaliseSectionKey)
        .filter(Boolean)
    );
    const sanitisedSections = uniqueSectionNames(nextSections).filter(section => !groupedLookup.has(normaliseSectionKey(section)));
    await saveInstituteExtraSections(instKey, sanitisedSections);
    setInstSectionsAll(prev => updateInstituteExtraSectionsLocal(prev, instKey, () => sanitisedSections));
    return instKey;
  }, [instSectionsAll]);

  const refreshTeacherIndexState = React.useCallback(async () => {
    const latestTeachers = await getAllTeachers();
    setTeachers(latestTeachers);
  }, []);

  const applyPendingInstituteSectionAction = React.useCallback(async ({ instituteName, oldSection, nextSection = "", action }) => {
    const targetInstitute = String(instituteName || "").trim();
    const sourceSection = String(oldSection || "").trim();
    if(!targetInstitute || !sourceSection) return;

    if(action === KEEP_SECTION_ACTION){
      const instData = getInstituteSectionConfig(instSectionsAll, targetInstitute) || {};
      const nextExtraSections = uniqueSectionNames([...(instData.extraSections || []), sourceSection]);
      await saveInstituteExtraSectionsForReview(targetInstitute, nextExtraSections);
      showAdminToast(`Kept "${sourceSection}" as an accepted section in ${targetInstitute}.`);
      return;
    }

    const actionValue = action === DELETE_SECTION_ACTION ? DELETE_SECTION_ACTION : String(nextSection || "").trim();
    if(!actionValue) return;

    const targetUids = [...new Set(
      teachers
        .filter(teacher => teacherBelongsToInstitute(teacher, targetInstitute))
        .map(teacher => teacher.uid)
        .filter(Boolean)
    )];
    const loadedEntries = await Promise.allSettled(
      targetUids.map(async uid => [uid, await ensureFullData(uid)])
    );
    const snapshot = {
      ...fullData,
      ...Object.fromEntries(
        loadedEntries
          .filter(result => result.status === "fulfilled" && result.value?.[1])
          .map(result => result.value)
      ),
    };

    const updatedEntries = [];
    const removedClasses = [];
    let changedTeachers = 0;

    for (const uid of targetUids) {
      const latest = snapshot[uid] || await getTeacherFullData(uid);
      if(!latest) continue;
      const result = applyInstituteSectionActionsToTeacherData(latest, targetInstitute, {
        [sourceSection]: actionValue,
      });
      if(!result.changed) continue;

      const saved = await saveUserData(uid, result.data, {
        expectedRevision: Number(latest?._meta?.revision || 0),
        source: "adminPendingSectionReview",
      });
      updatedEntries.push([uid, saved.data]);
      (result.removedClassIds || []).forEach(classId => {
        if(classId) removedClasses.push({ uid, classId });
      });
      changedTeachers += 1;
    }

    const uniqueRemovedClasses = Array.from(
      new Map(removedClasses.map(item => [`${item.uid}::${item.classId}`, item])).values()
    );
    if(uniqueRemovedClasses.length){
      await Promise.all(
        uniqueRemovedClasses.map(item => deleteClassNotes(item.uid, item.classId).catch(()=>{}))
      );
    }

    setFullData(prev => ({
      ...prev,
      ...Object.fromEntries(updatedEntries.filter(([, data]) => !!data)),
    }));

    const instData = getInstituteSectionConfig(instSectionsAll, targetInstitute) || {};
    const nextExtraSections = action === DELETE_SECTION_ACTION
      ? (instData.extraSections || []).filter(section => normaliseSectionKey(section) !== normaliseSectionKey(sourceSection))
      : uniqueSectionNames([
          ...(instData.extraSections || []).filter(section => normaliseSectionKey(section) !== normaliseSectionKey(sourceSection)),
          actionValue,
        ]);
    await saveInstituteExtraSectionsForReview(targetInstitute, nextExtraSections);
    await refreshTeacherIndexState();

    if(action === DELETE_SECTION_ACTION){
      persistAdminBin(bin => [
        ...bin,
        {
          type: "section",
          name: sourceSection,
          institute: targetInstitute,
          teacherCount: changedTeachers,
          classCount: uniqueRemovedClasses.length,
          deletedAt: Date.now(),
          deletedBy: user.uid,
        },
      ]);
      showAdminToast(
        changedTeachers
          ? `Deleted "${sourceSection}" from ${changedTeachers} teacher${changedTeachers!==1?"s":""}.`
          : `Removed "${sourceSection}" from the section list.`
      );
      return;
    }

    showAdminToast(
      changedTeachers
        ? `Renamed "${sourceSection}" to "${actionValue}" for ${changedTeachers} teacher${changedTeachers!==1?"s":""}.`
        : `Saved "${actionValue}" in ${targetInstitute}.`
    );
  }, [
    ensureFullData,
    fullData,
    instSectionsAll,
    refreshTeacherIndexState,
    saveInstituteExtraSectionsForReview,
    showAdminToast,
    teacherBelongsToInstitute,
    teachers,
    user.uid,
  ]);

  const handleKeepPendingInstituteSection = React.useCallback(async (instituteName, sectionName) => {
    setPendingSectionBusy(true);
    try {
      await applyPendingInstituteSectionAction({
        instituteName,
        oldSection: sectionName,
        action: KEEP_SECTION_ACTION,
      });
    } catch (e) {
      showAdminToast("Could not keep section: " + (e?.message || "Unknown error"));
    } finally {
      setPendingSectionBusy(false);
    }
  }, [applyPendingInstituteSectionAction, showAdminToast]);

  const handleDeletePendingInstituteSection = React.useCallback((instituteName, item) => {
    if(!item?.section) return;
    confirmDelete({
      title: `Delete section "${item.section}"?`,
      lines: [
        `This will permanently delete ${item.affectedClassCount || 0} class record${item.affectedClassCount===1?"":"s"} across ${item.affectedTeacherCount || 0} teacher${item.affectedTeacherCount===1?"":"s"}.`,
        "All entries under this section will also be removed.",
        "This cannot be undone.",
      ],
      confirmLabel: "Delete Section",
      onConfirm: async () => {
        setDeleteBusy(true);
        setPendingSectionBusy(true);
        try {
          await applyPendingInstituteSectionAction({
            instituteName,
            oldSection: item.section,
            action: DELETE_SECTION_ACTION,
          });
        } catch (e) {
          showAdminToast("Could not delete section: " + (e?.message || "Unknown error"));
        }
        setPendingSectionBusy(false);
        setDeleteBusy(false);
        setDeleteModal(null);
      },
    });
  }, [applyPendingInstituteSectionAction, showAdminToast]);

  const openPendingInstituteSectionRename = React.useCallback((instituteName, sectionName) => {
    setPendingSectionRename({
      institute: instituteName,
      oldSection: sectionName,
      nextValue: sectionName,
    });
    setPendingSectionError("");
  }, []);

  const confirmPendingInstituteSectionRename = React.useCallback(async () => {
    if(pendingSectionBusy) return;
    const instituteName = String(pendingSectionRename?.institute || "").trim();
    const oldSection = String(pendingSectionRename?.oldSection || "").trim();
    const nextValue = String(pendingSectionRename?.nextValue || "").trim();
    if(!instituteName || !oldSection){
      setPendingSectionRename(null);
      return;
    }
    if(!nextValue){
      setPendingSectionError("Enter a section name.");
      return;
    }
    if(normaliseSectionKey(nextValue) === normaliseSectionKey(oldSection)){
      setPendingSectionBusy(true);
      setPendingSectionError("");
      try {
        await applyPendingInstituteSectionAction({
          instituteName,
          oldSection,
          action: KEEP_SECTION_ACTION,
        });
        setPendingSectionRename(null);
      } catch (e) {
        setPendingSectionError(e?.message || "Save failed.");
      } finally {
        setPendingSectionBusy(false);
      }
      return;
    }

    setPendingSectionBusy(true);
    setPendingSectionError("");
    try {
      await applyPendingInstituteSectionAction({
        instituteName,
        oldSection,
        nextSection: nextValue,
        action: "rename",
      });
      setPendingSectionRename(null);
    } catch (e) {
      setPendingSectionError(e?.message || "Rename failed.");
    } finally {
      setPendingSectionBusy(false);
    }
  }, [applyPendingInstituteSectionAction, pendingSectionBusy, pendingSectionRename]);

  const pendingSectionRenameTerm = pendingSectionRename
    ? getInstituteEntityLabels(getInstituteSectionConfig(instSectionsAll, pendingSectionRename.institute)?.type).singular
    : "section";
  const pendingSectionRenameModal = pendingSectionRename ? (
    <SectionQuickRenameModal
      term={pendingSectionRenameTerm}
      originalValue={pendingSectionRename.oldSection}
      value={pendingSectionRename.nextValue}
      error={pendingSectionError}
      onChange={nextValue => {
        setPendingSectionError("");
        setPendingSectionRename(curr => curr ? { ...curr, nextValue } : curr);
      }}
      onClose={() => {
        if(pendingSectionBusy) return;
        setPendingSectionRename(null);
        setPendingSectionError("");
      }}
      onSave={confirmPendingInstituteSectionRename}
    />
  ) : null;

  const clampPanelWidth = React.useCallback((key, nextWidth) => {
    const limits = PANEL_LIMITS[key];
    if(!limits) return nextWidth;
    return Math.max(limits.collapsed, Math.min(limits.max, nextWidth));
  }, [PANEL_LIMITS]);

  const setDesktopPanelWidth = React.useCallback((key, nextWidth) => {
    const limits = PANEL_LIMITS[key];
    if(!limits) return;
    const clamped = clampPanelWidth(key, nextWidth);
    panelWRef.current = { ...panelWRef.current, [key]:clamped };
    if(panelResizeFrameRef.current===null){
      panelResizeFrameRef.current = window.requestAnimationFrame(()=>{
        panelResizeFrameRef.current = null;
        const next = panelWRef.current;
        setPanelW(prev=>(prev.p1===next.p1 && prev.p2===next.p2 && prev.p3===next.p3)?prev:next);
      });
    }
    if(clamped <= limits.collapsed + 6){
      setPanelCollapsed(prev=>prev[key]?prev:{...prev,[key]:true});
      return;
    }
    expandedPanelWidthsRef.current[key] = Math.max(limits.min, clamped);
    setPanelCollapsed(prev=>prev[key]?{...prev,[key]:false}:prev);
  }, [PANEL_LIMITS, clampPanelWidth]);

  const nudgeDesktopPanelWidth = React.useCallback((key, delta) => {
    if(!delta) return;
    const currentWidth = panelWRef.current[key];
    if(typeof currentWidth!=="number") return;
    setDesktopPanelWidth(key, currentWidth + delta);
  }, [setDesktopPanelWidth]);

  const panelWidthTransition = panelDragging || reduceEffects
    ? "width 0s linear"
    : "width 0.2s cubic-bezier(0.22, 1, 0.36, 1)";

  const togglePanelCollapse = React.useCallback((key) => {
    const limits = PANEL_LIMITS[key];
    if(!limits) return;
    const willCollapse = !panelCollapsed[key];
    if(willCollapse){
      expandedPanelWidthsRef.current[key] = Math.max(limits.min, panelW[key]);
      panelWRef.current = { ...panelWRef.current, [key]:limits.collapsed };
      setPanelW(widths=>({...widths,[key]:limits.collapsed}));
    } else {
      const restored = clampPanelWidth(key, expandedPanelWidthsRef.current[key] || limits.default);
      panelWRef.current = { ...panelWRef.current, [key]:restored };
      setPanelW(widths=>({...widths,[key]:restored}));
    }
    setPanelCollapsed(prev=>({...prev,[key]:willCollapse}));
  }, [PANEL_LIMITS, panelCollapsed, panelW, clampPanelWidth]);

  const instituteGlanceReadyCount = Math.max(0, instituteGlanceReport.loadedInstitutes || 0);
  const instituteGlanceEffectiveRange = getInstituteGlancePeriodRange();
  const instituteGlancePeriodMeta = getInstituteGlancePeriodMeta(instituteGlancePeriod, instituteGlanceEffectiveRange.rangeStartKey, instituteGlanceEffectiveRange.rangeEndKey);
  const instituteGlanceProgressPct = instituteGlanceReport.total
    ? Math.max(0, Math.min(100, Math.round((instituteGlanceReport.loaded / instituteGlanceReport.total) * 100)))
    : 0;
  const instituteGlanceAnyExportBusy = !!instituteGlanceExportBusy || !!instituteGlanceRowExportBusy;
  const instituteGlanceExportDisabled = instituteGlanceAnyExportBusy || !instituteGlanceReport.ready || !!instituteGlanceReport.error;
  const instituteGlanceHoldListOnMobile = isMobile && instituteGlanceReport.loading && !instituteGlanceReport.ready;

  const renderInstituteGlanceStatGrid = (compact = false) => (
    <div style={{display:"grid",gridTemplateColumns:compact ? "repeat(2,minmax(0,1fr))" : "repeat(5,minmax(0,1fr))",gap:8,marginTop:12}}>
      {[
        { label:"Institutes", value:instituteGlanceReport.summary.totalInstitutes },
        { label:instituteGlancePeriodMeta.updatedLabel, value:`${instituteGlanceReport.summary.filledToday}/${instituteGlanceReport.summary.totalTeachers}` },
        { label:instituteGlancePeriodMeta.pendingLabel, value:instituteGlanceReport.summary.missingToday },
        { label:"Sections taught", value:instituteGlanceReport.summary.sectionsTaught },
        { label:"Study hours", value:formatDurationShort(instituteGlanceReport.summary.totalStudyMinutes || 0) },
      ].map(item=>(
        <div key={item.label} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:14,padding:"10px 11px"}}>
          <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.6,textTransform:"uppercase"}}>{item.label}</div>
          <div style={{fontSize:compact ? 18 : 20,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1,marginTop:8}}>{item.value}</div>
        </div>
      ))}
    </div>
  );

  const renderInstituteGlanceActions = (compact = false) => {
    const baseButtonStyle = {
      minWidth:compact ? 84 : 92,
      height:compact ? 36 : 38,
      padding:"0 12px",
      borderRadius:12,
      border:`1px solid ${G.border}`,
      background:"#FFFFFF",
      color:G.text,
      fontSize:12,
      fontWeight:700,
      fontFamily:G.sans,
      cursor:"pointer",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      gap:6,
      WebkitTapHighlightColor:"transparent",
    };
    const scheduleButtonBusy = !!ledgrReportScheduleSaving;
    return (
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        <button
          type="button"
          className="admin-mobile-touch"
          onPointerDown={event=>event.stopPropagation()}
          onClick={event=>{
            event.preventDefault();
            event.stopPropagation();
            openInstituteGlanceOptions("schedule", "report");
          }}
          disabled={scheduleButtonBusy}
          style={{
            ...baseButtonStyle,
            minWidth:compact ? 170 : 210,
            justifyContent:"space-between",
            background:G.blueL,
            border:`1px solid #BFDBFE`,
            color:G.blue,
            cursor:scheduleButtonBusy ? "not-allowed" : "pointer",
            opacity:scheduleButtonBusy ? 0.65 : 1,
          }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:7,minWidth:0}}>
            <AppIcon icon={IconCalendar} size={15} color={G.blue} />
            <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{instituteGlancePeriodMeta.label}</span>
          </span>
          <span style={{fontSize:11,fontWeight:800,color:G.textM,whiteSpace:"nowrap"}}>
            {ledgrReportSchedule?.enabled
              ? `${ledgrReportSchedule.times?.length || 0} ${ledgrReportSchedule?.execution?.lastRunAt || ledgrReportSchedule?.lastRunAt ? "scheduled" : "saved"}`
              : "Options"}
          </span>
        </button>
        <button
          type="button"
          className="admin-mobile-touch"
          onPointerDown={event=>event.stopPropagation()}
          onClick={event=>{
            event.preventDefault();
            event.stopPropagation();
            openInstituteGlanceOptions("export", "report");
          }}
          disabled={!!instituteGlanceAnyExportBusy}
          style={{
            ...baseButtonStyle,
            minWidth:compact ? 96 : 108,
            cursor:instituteGlanceAnyExportBusy ? "not-allowed" : "pointer",
            opacity:instituteGlanceAnyExportBusy ? 0.65 : 1,
          }}>
          <AppIcon icon={IconDownload} size={15} color={G.text} />
          Export
        </button>
        <button
          type="button"
          className="admin-mobile-touch"
          onClick={()=>loadInstituteGlanceReport({ force:true }).catch(handleInstituteGlanceLoadFailure)}
          style={baseButtonStyle}>
          Refresh
        </button>
      </div>
    );
  };

  const renderInstituteGlanceProgressBlock = (compact = false) => (
    <div style={{marginTop:14,background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:16,padding:compact ? "12px 12px 13px" : "15px 16px 16px"}}>
      <style>{`
        @keyframes ledgrReportPulse{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
        @keyframes ledgrReportSkeletonShift{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:G.text,fontFamily:G.sans}}>
            {instituteGlanceReport.loading
              ? instituteGlanceReport.ready ? "Updating the Ledgr report" : "Building the Ledgr report"
              : "Centres ready"}
          </div>
          <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:4}}>
            {instituteGlanceReport.loading
              ? instituteGlanceReport.ready
                ? "The current report stays available while fresh data is synced."
                : "Teacher records are syncing first. Centre cards appear as soon as the first pass completes."
              : "All institute data is ready."}
          </div>
        </div>
        <div style={{display:"grid",gap:6,justifyItems:"end"}}>
          <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"5px 9px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,whiteSpace:"nowrap"}}>
            {instituteGlanceReport.loading
              ? "Background sync"
              : `${instituteGlanceReadyCount}/${Math.max(instituteGlanceReport.totalInstitutes || 0, instituteGlanceReport.summary.totalInstitutes || 0)} centres ready`}
          </span>
          <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"4px 9px",fontSize:11,color:G.textL,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
            {instituteGlanceReport.loading
              ? `${instituteGlanceReport.total} teacher records`
              : `${Math.min(instituteGlanceReport.loaded, instituteGlanceReport.total)}/${instituteGlanceReport.total} teachers synced`}
          </span>
        </div>
      </div>
      <div style={{height:8,background:"#E5ECF6",borderRadius:999,overflow:"hidden",marginTop:12}}>
        <div style={instituteGlanceReport.loading
          ? {height:"100%",width:"38%",borderRadius:999,background:"linear-gradient(90deg,#93C5FD 0%,#2563EB 100%)",animation:"ledgrReportPulse 1.3s ease-in-out infinite"}
          : {height:"100%",width:`${Math.max(instituteGlanceProgressPct, instituteGlanceReport.loaded>0 ? 5 : 0)}%`,borderRadius:999,background:"linear-gradient(90deg,#3B82F6 0%,#1D4ED8 100%)",transition:"width 0.2s ease"}} />
      </div>
      {!instituteGlanceReport.ready&&(
        <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:10}}>
          Report options unlock when the first background sync finishes.
        </div>
      )}
    </div>
  );

  const renderInstituteGlanceLoadingDeck = (compact = false) => {
    if(!instituteGlanceReport.loading || instituteGlanceReport.rows.length) return null;
    const queuedCentres = Math.max(
      instituteGlanceReport.totalInstitutes || 0,
      instituteGlanceReport.summary.totalInstitutes || 0,
      institutes.length || 0
    );
    const shimmer = (width, height = 12, borderRadius = 999) => ({
      width,
      height,
      borderRadius,
      background:"linear-gradient(90deg,#E2E8F0 0%,#F8FAFC 50%,#E2E8F0 100%)",
      backgroundSize:"220% 100%",
      animation:"ledgrReportSkeletonShift 1.35s linear infinite",
    });
    const loadingStats = [
      {
        label:"Teacher records",
        value:`${Math.min(instituteGlanceReport.loaded, instituteGlanceReport.total)}/${Math.max(instituteGlanceReport.total, instituteGlanceReport.loaded)}`,
        help:"Synced into the report",
      },
      {
        label:"Centres ready",
        value:`${instituteGlanceReadyCount}/${queuedCentres || 0}`,
        help:"Visible once the first pass lands",
      },
      {
        label:"Next up",
        value:"Centre cards",
        help:"Then PDF export and drill-in stay stable",
      },
    ];
    const skeletonCount = compact ? 3 : 4;
    return (
      <div style={{marginTop:14,border:`1px solid ${G.border}`,borderRadius:18,background:"linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)",padding:compact ? "14px 14px 15px" : "18px 18px 20px",boxShadow:"0 14px 32px rgba(15,23,42,0.05)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:0.9,textTransform:"uppercase"}}>Loading state</div>
            <div style={{fontSize:compact ? 18 : 20,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.08,marginTop:7}}>Preparing the Ledgr report</div>
            <div style={{fontSize:12.5,color:G.textM,lineHeight:1.6,marginTop:8,maxWidth:680}}>
              We keep the workspace usable while the report assembles in the background. Once the first pass finishes, the centre grid and exports appear in place.
            </div>
          </div>
          <span style={{background:"#EEF2FF",color:G.blue,borderRadius:999,padding:"7px 11px",fontSize:11,fontWeight:800,fontFamily:G.mono,whiteSpace:"nowrap"}}>
            {queuedCentres} centre{queuedCentres === 1 ? "" : "s"} in queue
          </span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:compact ? "1fr" : "repeat(3,minmax(0,1fr))",gap:10,marginTop:14}}>
          {loadingStats.map(item => (
            <div key={item.label} style={{border:`1px solid ${G.border}`,borderRadius:14,background:"#FFFFFF",padding:"12px 13px"}}>
              <div style={{fontSize:10.5,color:G.textL,fontFamily:G.mono,letterSpacing:0.6,textTransform:"uppercase"}}>{item.label}</div>
              <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.05,marginTop:8}}>{item.value}</div>
              <div style={{fontSize:11.5,color:G.textM,lineHeight:1.5,marginTop:6}}>{item.help}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:compact ? "1fr" : "repeat(2,minmax(0,1fr))",gap:12,marginTop:14}}>
          {Array.from({ length:skeletonCount }).map((_, index) => (
            <div key={`skeleton_${index}`} style={{border:`1px solid ${G.border}`,borderRadius:16,background:"#FFFFFF",padding:"14px 14px 15px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <div style={shimmer(index % 2 === 0 ? "58%" : "64%", 14)} />
                <div style={shimmer("74px", 26)} />
              </div>
              <div style={{display:"grid",gap:8,marginTop:14}}>
                <div style={shimmer("100%", 11)} />
                <div style={shimmer("86%", 11)} />
                <div style={shimmer("70%", 11)} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:14}}>
                <div style={{borderRadius:12,background:"#F8FAFC",padding:"10px 10px 11px"}}>
                  <div style={shimmer("56px", 9)} />
                  <div style={{marginTop:8,...shimmer("42px", 16, 8)}} />
                </div>
                <div style={{borderRadius:12,background:"#F8FAFC",padding:"10px 10px 11px"}}>
                  <div style={shimmer("48px", 9)} />
                  <div style={{marginTop:8,...shimmer("38px", 16, 8)}} />
                </div>
                <div style={{borderRadius:12,background:"#F8FAFC",padding:"10px 10px 11px"}}>
                  <div style={shimmer("44px", 9)} />
                  <div style={{marginTop:8,...shimmer("36px", 16, 8)}} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getInstituteGlanceTeacherHoursLabel = (teacher) => (
    teacher?.totalMinutes > 0
      ? formatDurationShort(teacher.totalMinutes)
      : teacher?.untimedEntries > 0
        ? "Untimed"
        : "0m"
  );

  const getInstituteGlanceTeacherSectionCaption = (teacher) => (
    teacher?.sectionNames?.length
      ? teacher.sectionNames.join(", ")
      : teacher?.updatedToday
        ? "Uploaded without a section name"
        : "No section was taught today"
  );

  const getInstituteGlanceStatusTone = (teacher) => (
    teacher?.updatedToday
      ? { bg:"#DCFCE7", border:"#BBF7D0", color:"#166534" }
      : { bg:"#FFF7ED", border:"#FED7AA", color:"#B45309" }
  );

  const renderInstituteGlanceAllTeacherTable = (row, compact = false) => {
    const teacherRows = row?.teacherRows || [];
    if(!teacherRows.length){
      return (
        <div style={{marginTop:10,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:14,padding:"12px 13px",fontSize:12.5,color:"#9A3412",lineHeight:1.55}}>
          No teacher records are linked to this centre yet.
        </div>
      );
    }
    if(compact){
      return (
        <div style={{display:"grid",gap:9,marginTop:10}}>
          {teacherRows.map(teacher => {
            const tone = getInstituteGlanceStatusTone(teacher);
            return (
              <div
                key={`${row.institute}_${teacher.uid}`}
                style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:14,padding:"12px 12px 13px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div style={{fontSize:14,fontWeight:800,color:G.text,lineHeight:1.35,flex:1,minWidth:0}}>{teacher.name}</div>
                  <span style={{display:"inline-flex",alignItems:"center",background:tone.bg,border:`1px solid ${tone.border}`,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:800,color:tone.color,fontFamily:G.mono,whiteSpace:"nowrap"}}>
                    {teacher.todayStatusLabel}
                  </span>
                </div>
                <div style={{fontSize:12,color:G.textM,lineHeight:1.5,marginTop:5}}>{getInstituteGlanceTeacherSectionCaption(teacher)}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:10}}>
                  {[
                    { label:instituteGlancePeriodMeta.key==="daily" ? "Today logs" : `${instituteGlancePeriodMeta.label} logs`, value:teacher.todayEntries },
                    { label:"This month", value:teacher.monthEntries },
                    { label:"Last entry", value:teacher.lastActivityLabel },
                    { label:"Study hours", value:getInstituteGlanceTeacherHoursLabel(teacher) },
                  ].map(item=>(
                    <div key={`${teacher.uid}_${item.label}`} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:12,padding:"9px 10px"}}>
                      <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,textTransform:"uppercase"}}>{item.label}</div>
                      <div style={{fontSize:item.label==="Last entry" ? 12.5 : 16,fontWeight:800,color:G.text,lineHeight:1.25,marginTop:6}}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div style={{marginTop:10,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{minWidth:980,border:`1px solid ${G.border}`,borderRadius:16,overflow:"hidden",background:"#FFFFFF"}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(170px,1.6fr) minmax(120px,0.85fr) minmax(250px,1.95fr) minmax(74px,0.55fr) minmax(92px,0.7fr) minmax(130px,0.9fr) minmax(92px,0.72fr)",gap:0,background:"#F8FAFC",borderBottom:`1px solid ${G.border}`}}>
            {["Teacher", "Status", "Sections", instituteGlancePeriodMeta.key==="daily" ? "Today" : instituteGlancePeriodMeta.label, "This month", "Last entry", "Study hours"].map(label=>(
              <div key={label} style={{padding:"10px 12px",fontSize:10.5,fontWeight:800,color:G.textL,fontFamily:G.mono,letterSpacing:0.7,textTransform:"uppercase"}}>
                {label}
              </div>
            ))}
          </div>
          {teacherRows.map((teacher, index) => {
            const tone = getInstituteGlanceStatusTone(teacher);
            return (
              <div
                key={`${row.institute}_${teacher.uid}`}
                style={{
                  display:"grid",
                  gridTemplateColumns:"minmax(170px,1.6fr) minmax(120px,0.85fr) minmax(250px,1.95fr) minmax(74px,0.55fr) minmax(92px,0.7fr) minmax(130px,0.9fr) minmax(92px,0.72fr)",
                  gap:0,
                  borderBottom:index < teacherRows.length - 1 ? `1px solid ${G.border}` : "none",
                }}>
                <div style={{padding:"11px 12px"}}>
                  <div style={{fontSize:13.5,fontWeight:800,color:G.text,lineHeight:1.35}}>{teacher.name}</div>
                </div>
                <div style={{padding:"11px 12px",display:"flex",alignItems:"center"}}>
                  <span style={{display:"inline-flex",alignItems:"center",background:tone.bg,border:`1px solid ${tone.border}`,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:800,color:tone.color,fontFamily:G.mono,whiteSpace:"nowrap"}}>
                    {teacher.todayStatusLabel}
                  </span>
                </div>
                <div style={{padding:"11px 12px",fontSize:12.5,color:G.textM,lineHeight:1.5}}>{getInstituteGlanceTeacherSectionCaption(teacher)}</div>
                <div style={{padding:"11px 12px",fontSize:13,fontWeight:800,color:G.text,lineHeight:1.35,display:"flex",alignItems:"center"}}>{teacher.todayEntries}</div>
                <div style={{padding:"11px 12px",fontSize:13,fontWeight:800,color:G.text,lineHeight:1.35,display:"flex",alignItems:"center"}}>{teacher.monthEntries}</div>
                <div style={{padding:"11px 12px",fontSize:12.5,fontWeight:700,color:G.textS,lineHeight:1.45,display:"flex",alignItems:"center"}}>{teacher.lastActivityLabel}</div>
                <div style={{padding:"11px 12px",fontSize:13,fontWeight:800,color:teacher.totalMinutes > 0 ? "#166534" : G.textM,lineHeight:1.35,display:"flex",alignItems:"center"}}>{getInstituteGlanceTeacherHoursLabel(teacher)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInstituteGlancePendingTeacherTable = (row, compact = false) => {
    const pendingRows = row?.pendingTeacherRows || [];
    if(!pendingRows.length){
      return (
        <div style={{fontSize:12.5,color:"#166534",lineHeight:1.55}}>
          Everyone linked to this centre is updated.
        </div>
      );
    }
    if(compact){
      return (
        <div style={{display:"grid",gap:8,marginTop:10}}>
          {pendingRows.map(teacher => (
            <div key={`${row.institute}_${teacher.uid}_pending`} style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:14,padding:"11px 12px"}}>
              <div style={{fontSize:13.5,fontWeight:800,color:G.text,lineHeight:1.35}}>{teacher.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:9}}>
                <div style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:12,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,textTransform:"uppercase"}}>This month</div>
                  <div style={{fontSize:15,fontWeight:800,color:G.text,lineHeight:1.15,marginTop:5}}>{teacher.monthEntries}</div>
                </div>
                <div style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:12,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,textTransform:"uppercase"}}>Last entry</div>
                  <div style={{fontSize:12.5,fontWeight:700,color:G.textS,lineHeight:1.3,marginTop:5}}>{teacher.lastActivityLabel}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{marginTop:10,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{minWidth:520,border:`1px solid ${G.border}`,borderRadius:16,overflow:"hidden",background:"#FFFFFF"}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(190px,1.5fr) minmax(90px,0.7fr) minmax(180px,1fr)",gap:0,background:"#F8FAFC",borderBottom:`1px solid ${G.border}`}}>
            {["Teacher", "This month", "Last entry"].map(label=>(
              <div key={label} style={{padding:"10px 12px",fontSize:10.5,fontWeight:800,color:G.textL,fontFamily:G.mono,letterSpacing:0.7,textTransform:"uppercase"}}>
                {label}
              </div>
            ))}
          </div>
          {pendingRows.map((teacher, index) => (
            <div
              key={`${row.institute}_${teacher.uid}_pending`}
              style={{
                display:"grid",
                gridTemplateColumns:"minmax(190px,1.5fr) minmax(90px,0.7fr) minmax(180px,1fr)",
                gap:0,
                borderBottom:index < pendingRows.length - 1 ? `1px solid ${G.border}` : "none",
              }}>
              <div style={{padding:"11px 12px",fontSize:13.5,fontWeight:800,color:G.text,lineHeight:1.35}}>{teacher.name}</div>
              <div style={{padding:"11px 12px",fontSize:13,fontWeight:800,color:G.text,lineHeight:1.35,display:"flex",alignItems:"center"}}>{teacher.monthEntries}</div>
              <div style={{padding:"11px 12px",fontSize:12.5,fontWeight:700,color:G.textS,lineHeight:1.45,display:"flex",alignItems:"center"}}>{teacher.lastActivityLabel}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInstituteGlanceMobileLoadingNotice = () => renderInstituteGlanceLoadingDeck(true);

  const renderSharedInstituteGlanceTable = ({ maxRows = null, interactive = false } = {}) => {
    const rows = maxRows ? instituteGlanceReport.rows.slice(0, maxRows) : instituteGlanceReport.rows;
    if(!rows.length){
      return (
        <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
          No institutes are available yet.
        </div>
      );
    }
    return (
      <div style={{overflowX:"auto",border:`1px solid ${G.border}`,borderRadius:18,background:"#FFFFFF"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:1080}}>
          <thead>
            <tr style={{background:"#F8FAFC"}}>
              {["Institute", "Updated", "Pending", "Sections", "Study hours", "Follow-up", "Actions"].map(label => (
                <th key={label} style={{textAlign:"left",padding:"14px 16px",fontSize:11,fontWeight:800,color:G.textL,textTransform:"uppercase",letterSpacing:0.8,fontFamily:G.mono,borderBottom:`1px solid ${G.border}`}}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const statusTone = !row.ready
                ? G.blue
                : row.noTeachersSignedUp
                  ? "#94A3B8"
                  : row.missingToday === 0
                    ? "#16A34A"
                    : row.completionPct >= 50
                      ? G.blue
                      : "#B45309";
              const updatedText = !row.ready
                ? `${row.loadedTeachers}/${row.totalTeachers}`
                : `${row.filledToday}/${row.totalTeachers}`;
              const pendingText = !row.ready
                ? `Loading ${row.loadedTeachers}/${row.totalTeachers}`
                : row.noTeachersSignedUp
                  ? "No sign-ups"
                  : row.missingToday === 0
                    ? "All updated"
                    : `${row.missingToday} pending`;
              const followUpText = !row.ready
                ? "Teacher records are still syncing."
                : row.noTeachersSignedUp
                  ? "No linked teachers yet."
                  : row.missingToday > 0
                    ? `${row.missingToday} teacher${row.missingToday === 1 ? "" : "s"} need follow-up.`
                    : "All linked teachers are updated.";
              const actionDisabled = !interactive || !row.ready || !!instituteGlanceRowExportBusy;
              return (
                <tr key={row.institute}>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <span style={{width:10,height:10,borderRadius:"50%",background:statusTone,marginTop:6,flexShrink:0}} />
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:800,color:G.text,lineHeight:1.25}}>{row.institute}</div>
                        <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,marginTop:4}}>
                          {!row.ready
                            ? `${row.loadedTeachers} of ${row.totalTeachers} teacher records ready`
                            : row.noTeachersSignedUp
                              ? "Waiting for teacher sign-ups"
                              : `${row.filledToday} of ${row.totalTeachers} teachers updated`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{updatedText}</div>
                    <div style={{fontSize:12,color:G.textM,lineHeight:1.5,marginTop:5}}>
                      {row.ready ? instituteGlancePeriodMeta.updatedLabel : "Loaded"}
                    </div>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <span style={{
                      display:"inline-flex",
                      alignItems:"center",
                      borderRadius:999,
                      padding:"6px 10px",
                      background:!row.ready ? "#DBEAFE" : row.missingToday === 0 ? "#DCFCE7" : "#FFEDD5",
                      color:!row.ready ? G.blue : row.missingToday === 0 ? "#166534" : "#B45309",
                      fontSize:11.5,
                      fontWeight:800,
                      fontFamily:G.sans,
                      whiteSpace:"nowrap",
                    }}>
                      {pendingText}
                    </span>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>
                      {row.ready ? row.sectionsTaught : "--"}
                    </div>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <div style={{fontSize:16,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>
                      {row.ready ? formatDurationShort(row.totalStudyMinutes || 0) : "--"}
                    </div>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    <div style={{fontSize:12.5,color:G.textM,lineHeight:1.55,maxWidth:260}}>
                      {followUpText}
                    </div>
                  </td>
                  <td style={{padding:"15px 16px",borderBottom:`1px solid ${G.border}`,verticalAlign:"top"}}>
                    {interactive ? (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button
                          type="button"
                          className="admin-mobile-touch"
                          onClick={()=>exportInstituteGlanceRowPdf(row)}
                          disabled={actionDisabled}
                          style={{
                            minHeight:34,
                            padding:"0 11px",
                            borderRadius:11,
                            border:`1px solid ${G.border}`,
                            background:"#FFFFFF",
                            color:G.text,
                            fontSize:12,
                            fontWeight:800,
                            fontFamily:G.sans,
                            cursor:actionDisabled ? "not-allowed" : "pointer",
                            opacity:actionDisabled && instituteGlanceRowExportBusy !== row.institute ? 0.65 : 1,
                            display:"inline-flex",
                            alignItems:"center",
                            gap:6,
                          }}>
                          <AppIcon icon={IconDownload} size={14} color={G.text} />
                          <span>{instituteGlanceRowExportBusy === row.institute ? "PDF..." : "Centre PDF"}</span>
                        </button>
                        <button
                          type="button"
                          className="admin-mobile-touch"
                          onClick={()=>openInstituteFromGlance(row)}
                          disabled={!row.ready || !!instituteGlanceRowExportBusy}
                          style={{
                            minHeight:34,
                            padding:"0 11px",
                            borderRadius:11,
                            border:`1px solid ${G.border}`,
                            background:"#FFFFFF",
                            color:G.blue,
                            fontSize:12,
                            fontWeight:800,
                            fontFamily:G.sans,
                            cursor:!row.ready || instituteGlanceRowExportBusy ? "not-allowed" : "pointer",
                            opacity:!row.ready || instituteGlanceRowExportBusy ? 0.7 : 1,
                            display:"inline-flex",
                            alignItems:"center",
                            gap:6,
                          }}>
                          <span>Open centre</span>
                          <AppIcon icon={IconChevronRight} size={14} color={G.blue} />
                        </button>
                      </div>
                    ) : (
                      <span style={{fontSize:12.5,color:G.textM}}>View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSharedInstituteGlanceList = ({ maxRows = null, interactive = false } = {}) => {
    const rows = maxRows ? instituteGlanceReport.rows.slice(0, maxRows) : instituteGlanceReport.rows;
    if(!rows.length){
      return (
        <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
          No institutes are available yet.
        </div>
      );
    }
    return (
      <div style={{
        display:"grid",
        gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))",
        gap:12,
        alignItems:"stretch",
      }}>
        {rows.map(row => {
          const tone = !row.ready
            ? { bg:"#F8FAFC", border:"#DDE3ED", pillBg:"#EEF4FF", pillColor:G.blue, meta:G.textM, softBg:"#FFFFFF" }
            : row.noTeachersSignedUp
              ? { bg:"#F8FAFC", border:"#DDE3ED", pillBg:"#EEF2F7", pillColor:G.textM, meta:G.textM, softBg:"#FFFFFF" }
              : row.missingToday === 0
              ? { bg:"#ECFDF3", border:"#BBF7D0", pillBg:"#DCFCE7", pillColor:"#166534", meta:"#1B5E20" }
              : row.completionPct >= 50
                ? { bg:"#EEF4FF", border:"#C7D7F5", pillBg:"#DBEAFE", pillColor:G.blue, meta:"#1E3A8A" }
                : { bg:"#FFF7ED", border:"#FED7AA", pillBg:"#FFEDD5", pillColor:"#B45309", meta:"#9A3412" };
          const canOpen = interactive && row.ready;
          const pendingText = !row.ready
            ? `Loading ${row.loadedTeachers}/${row.totalTeachers}`
            : row.noTeachersSignedUp
              ? "No sign-ups"
              : row.missingToday === 0
                ? "All updated"
                : `${row.missingToday} pending`;
          const metaText = row.noTeachersSignedUp
            ? "No teachers have signed up for this centre yet."
            : row.ready
              ? `${row.filledToday} of ${row.totalTeachers} teachers updated`
              : `${row.loadedTeachers} of ${row.totalTeachers} teacher records are ready`;
          const helperText = !row.ready
            ? "Syncing teacher data."
            : row.noTeachersSignedUp
              ? "Once teachers sign up, this card will show uploaded names, sections taught, and study hours."
              : row.filledToday > 0
                ? `${row.sectionsTaught} sections taught across ${row.filledToday} updated teacher${row.filledToday===1?"":"s"}.`
                : `No teacher has uploaded during this ${instituteGlancePeriodMeta.label.toLowerCase()} period.`;
          const cardStyle = {
            width:"100%",
            height:"100%",
            background:tone.bg,
            border:`1px solid ${tone.border}`,
            borderRadius:18,
            padding:"13px 14px",
            textAlign:"left",
            boxShadow:!reduceEffects ? "0 12px 24px rgba(15,23,42,0.06)" : "none",
            WebkitTapHighlightColor:"transparent",
            display:"flex",
            flexDirection:"column",
          };
          return (
            <div key={row.institute} style={cardStyle}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:15,fontWeight:800,color:G.text,fontFamily:G.sans,lineHeight:1.35}}>
                    {row.institute}
                  </div>
                  <div style={{fontSize:12,color:tone.meta,marginTop:4,lineHeight:1.5}}>
                    {metaText}
                  </div>
                </div>
                <span style={{background:tone.pillBg,color:tone.pillColor,borderRadius:999,padding:"5px 9px",fontSize:10.5,fontWeight:800,fontFamily:G.mono,whiteSpace:"nowrap",flexShrink:0}}>
                  {pendingText}
                </span>
              </div>

              <div style={{fontSize:12,color:G.textM,lineHeight:1.6,marginTop:8}}>
                {helperText}
              </div>

              {!row.ready&&row.totalTeachers>0&&(
                <div style={{height:8,background:"#E6EDF6",borderRadius:999,overflow:"hidden",marginTop:10}}>
                  <div style={{height:"100%",width:`${Math.max(row.loadedPct || 0, row.loadedTeachers>0 ? 8 : 0)}%`,borderRadius:999,background:"linear-gradient(90deg,#93C5FD 0%,#3B82F6 100%)",transition:"width 0.2s ease"}} />
                </div>
              )}

              {row.ready&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
                    {[
                      { label:"Updated", value:`${row.filledToday}/${row.totalTeachers}` },
                      { label:"Pending", value:row.missingToday },
                      { label:"Sections taught", value:row.sectionsTaught },
                      { label:"Study hours", value:formatDurationShort(row.totalStudyMinutes || 0) },
                    ].map(item=>(
                      <div key={`${row.institute}_${item.label}`} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:14,padding:"10px 11px"}}>
                        <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.6,textTransform:"uppercase"}}>{item.label}</div>
                        <div style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.05,marginTop:7}}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:10,background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:14,padding:"10px 11px",fontSize:12,color:G.textM,lineHeight:1.55}}>
                    {row.noTeachersSignedUp
                      ? "No linked teachers yet. Open the centre once sign-ups begin."
                      : row.missingToday > 0
                        ? `${row.missingToday} teacher${row.missingToday===1?"":"s"} need follow-up. Use Centre PDF for details.`
                        : "All linked teachers are updated. Use Centre PDF for details."}
                  </div>
                </>
              )}

              {canOpen&&(
                <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginTop:"auto",paddingTop:12}}>
                  <button
                    type="button"
                    className="admin-mobile-touch"
                    onClick={()=>exportInstituteGlanceRowPdf(row)}
                    disabled={!!instituteGlanceRowExportBusy}
                    style={{
                      minHeight:36,
                      padding:"0 12px",
                      borderRadius:12,
                      border:`1px solid ${G.border}`,
                      background:"#FFFFFF",
                      color:G.text,
                      fontSize:12.5,
                      fontWeight:800,
                      fontFamily:G.sans,
                      cursor:instituteGlanceRowExportBusy ? "not-allowed" : "pointer",
                      opacity:instituteGlanceRowExportBusy && instituteGlanceRowExportBusy !== row.institute ? 0.65 : 1,
                      display:"inline-flex",
                      alignItems:"center",
                      gap:6,
                    }}>
                    <AppIcon icon={IconDownload} size={14} color={G.text} />
                    <span>{instituteGlanceRowExportBusy===row.institute ? "PDF..." : "Centre PDF"}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-mobile-touch"
                    onClick={()=>openInstituteFromGlance(row)}
                    disabled={!!instituteGlanceRowExportBusy}
                    style={{
                      minHeight:36,
                      padding:"0 12px",
                      borderRadius:12,
                      border:`1px solid ${G.border}`,
                      background:"#FFFFFF",
                      color:G.blue,
                      fontSize:12.5,
                      fontWeight:800,
                      fontFamily:G.sans,
                      cursor:instituteGlanceRowExportBusy ? "not-allowed" : "pointer",
                      opacity:instituteGlanceRowExportBusy ? 0.7 : 1,
                      display:"inline-flex",
                      alignItems:"center",
                      gap:6,
                    }}>
                    <span>Open centre</span>
                    <AppIcon icon={IconChevronRight} size={14} color={G.blue} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDesktopCentreSummaryPage = ({ embedded = false } = {}) => {
    if(isMobile || (!embedded && !instituteGlanceOpen)) return null;
    return (
      <div style={embedded
        ? {display:"flex",flexDirection:"column",gap:16}
        : {flex:1,overflowY:"auto",background:"linear-gradient(180deg,#F2F6FC 0%,#F8FAFC 100%)",padding:"22px 24px 28px"}}>
        <div style={{maxWidth:embedded ? "none" : 1500,margin:embedded ? 0 : "0 auto"}}>
          {!embedded&&(
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:16}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1.1,textTransform:"uppercase"}}>All institutes</div>
                <h1 style={{fontSize:34,fontWeight:800,color:G.text,fontFamily:G.display,margin:"8px 0 0",lineHeight:1.02}}>Ledgr Report</h1>
                <div style={{fontSize:14,color:G.textM,lineHeight:1.65,marginTop:10,maxWidth:980}}>
                  Submissions, pending teachers, sections, and hours.
                </div>
              </div>
              <button
                type="button"
                onClick={closeInstituteGlancePanel}
                style={{height:42,padding:"0 16px",borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:13,fontWeight:800,fontFamily:G.sans,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8,boxShadow:G.shadowSm,flexShrink:0}}>
                <AppIcon icon={IconChevronLeft} size={15} color={G.text} />
                Back to admin
              </button>
            </div>
          )}

          <div style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:26,padding:"18px 18px 20px",boxShadow:"0 18px 48px rgba(15,23,42,0.08)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>{embedded ? "Ledgr Report" : "Workspace"}</div>
                <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,marginTop:7,lineHeight:1.08}}>{embedded ? "All institutes report" : "All institutes"}</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.65,marginTop:8,maxWidth:920}}>
                  {embedded ? "Submissions, pending teachers, sections, hours, and export actions without leaving the control panel." : "Compact centre boxes with export actions."}
                </div>
              </div>
              {instituteGlanceReport.loading&&(
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,whiteSpace:"nowrap"}}>
                  {instituteGlanceReadyCount}/{Math.max(instituteGlanceReport.totalInstitutes || 0, instituteGlanceReport.summary.totalInstitutes || 0)} ready
                </span>
              )}
            </div>

            {renderInstituteGlanceProgressBlock(false)}

            {!!instituteGlanceReport.error&&(
              <div style={{marginTop:14,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:16,padding:"14px 15px"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#9A3412",fontFamily:G.sans}}>Could not load the report</div>
                <div style={{fontSize:12.5,color:"#9A3412",lineHeight:1.55,marginTop:6}}>
                  {instituteGlanceReport.error}
                </div>
                <button className="admin-mobile-touch" onClick={()=>loadInstituteGlanceReport({ force:true }).catch(handleInstituteGlanceLoadFailure)} style={{marginTop:12,padding:"9px 12px",borderRadius:10,border:"1px solid #FDBA74",background:"#FFFFFF",color:"#9A3412",fontSize:12.5,fontWeight:700,fontFamily:G.sans,cursor:"pointer"}}>
                  Retry
                </button>
              </div>
            )}

            {!!instituteGlanceReport.rows.length&&renderInstituteGlanceStatGrid(false)}
            {renderInstituteGlanceActions(false)}

            {instituteGlanceReport.loading && !instituteGlanceReport.rows.length ? (
              renderInstituteGlanceLoadingDeck(false)
            ) : (
              <div style={{marginTop:16}}>
                {isMobile
                  ? renderSharedInstituteGlanceList({ interactive:true })
                  : renderSharedInstituteGlanceTable({ interactive:true })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalEntries=useMemo(()=>{
    let t=0;
    Object.values(fullData).forEach(d=>{
      Object.values(d.notes||{}).forEach(byDate=>{
        if(!byDate||typeof byDate!=="object") return;
        Object.values(byDate).forEach(arr=>{if(Array.isArray(arr))t+=arr.length;});
      });
    });
    return t;
  },[fullData]);

  // Class count from index (available immediately without fullData)
  const totalClasses=useMemo(()=>{
    const fromIndex=teachers.reduce((s,t)=>s+(t.classCount||0),0);
    const fromFull=Object.values(fullData).reduce((s,d)=>s+(d.classes||[]).length,0);
    return Math.max(fromIndex,fromFull);
  },[teachers,fullData]);

  const adminWorkspaceStats = useMemo(() => ([
    { key:"institutes", value:institutes.length, label:"Institutes", icon:IconBuilding, tone:"#DBEAFE", color:G.blue },
    { key:"teachers", value:teachers.length, label:"Teachers", icon:IconUsersGroup, tone:"#E8F8EF", color:"#198754" },
    { key:"classes", value:totalClasses, label:"Classes", icon:IconSchool, tone:"#FEF3C7", color:G.amber },
    { key:"entries", value:totalEntries, label:"Entries", icon:IconChartBar, tone:"#F3E8FF", color:"#7C3AED" },
  ]), [institutes.length, teachers.length, totalClasses, totalEntries]);

  const instituteStats = useMemo(()=>{
    return institutes.reduce((acc, inst)=>{
      const teacherUids = new Set();
      const classKeys = new Set();
      teachers.forEach(t=>{
        const d = fullData[t.uid];
        if(d){
          const classesHere = (d.classes||[]).filter(c=>sameInstituteName(c.institute, inst));
          if(classesHere.length){
            teacherUids.add(t.uid);
            classesHere.forEach(c=>{
              const key = normaliseSectionKey(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section);
              if(key) classKeys.add(key);
            });
          }
        }
        if(getTeacherInstituteList(t).some(i=>sameInstituteName(i, inst))){
          teacherUids.add(t.uid);
        }
      });
      acc[inst] = {
        teacherCount: teacherUids.size,
        classCount: classKeys.size || teacherUids.size,
      };
      return acc;
    }, {});
  },[getTeacherInstituteList, institutes,teachers,fullData,instSectionsAll]);

  // ── Teachers at selected institute ────────────────────────────────────────
  const instTeachers=useMemo(()=>{
    if(!selInst) return [];
    return teachers.filter(t=>teacherBelongsToInstitute(t, selInst));
  },[selInst, teacherBelongsToInstitute, teachers]);

  // ── Classes at selected institute ─────────────────────────────────────────
  const instClasses=useMemo(()=>{
    if(!selInst) return [];
    const map={};
    // Use teachers that belong to this institute (from profile, index, or class data)
    const relevantTeachers=teachers.filter(t=>teacherBelongsToInstitute(t, selInst));
    const norm = s => (s||"").trim().toLowerCase();
    relevantTeachers.forEach(t=>{
      const d=fullData[t.uid];
      if(!d) return; // fullData not loaded yet for this teacher
      (d.classes||[]).filter(c=>norm(c.institute)===norm(selInst)).forEach(c=>{
        const resolvedSection = resolveAdminSectionName(c.section, c.institute, instSectionsAll) || String(c.section || "").trim();
        const key = normaliseSectionKey(resolvedSection);
        if(!key) return;
        if(!map[key]) map[key]={raw:resolvedSection,display:normaliseName(resolvedSection),subjects:new Set(),teachers:[],lastActivityTs:0};
        if(c.subject) map[key].subjects.add(c.subject.trim());
        const entryCount=Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
        const lastActive=lastEntryTs((d.notes||{})[c.id]||{});
        const activityTs=Math.max(lastActive || 0, Number(c.created || 0) || 0);
        map[key].lastActivityTs=Math.max(map[key].lastActivityTs || 0, activityTs);
        map[key].teachers.push({uid:t.uid,name:d.profile?.name||t.name,entryCount,lastActive,classId:c.id,subject:c.subject,lastActivityTs:activityTs});
      });
    });
    return Object.values(map)
      .map(c=>({...c,subjects:[...c.subjects].sort((a,b)=>exportTextSorter.compare(a,b))}))
      .sort(compareClassCardsByActivity);
  },[selInst,teachers,fullData,instSectionsAll]);

  const instSearchKey = instSearch.trim().toLowerCase();
  const suppressMobileCurrentViewSearch = isMobile && mobileSurface !== "profile" && mobileStep === 1;
  const p2SearchKey = suppressMobileCurrentViewSearch ? "" : p2Search.trim().toLowerCase();

  const visibleInstitutes = useMemo(()=>{
    if(!instSearchKey) return institutes;
    return institutes.filter(inst=>(inst||"").toLowerCase().includes(instSearchKey));
  },[institutes,instSearchKey]);

  const instTeacherMeta = useMemo(()=>{
    const meta = {};
    if(!selInst) return meta;
    instTeachers.forEach(t=>{
      const d = fullData[t.uid];
      let ts = 0;
      if(d){
        ts = (d.classes||[])
          .filter(c=>sameInstituteName(c.institute, selInst))
          .reduce((latest,c)=>Math.max(latest, lastEntryTs((d.notes||{})[c.id]||{}) || 0), 0);
      } else {
        ts = Number(t.lastActive || 0);
      }
      meta[t.uid] = {
        lastEntryTs: ts || null,
        label: lastEntryCaption(ts || null),
      };
    });
    return meta;
  },[selInst,instTeachers,fullData]);

  const visibleInstTeachers = useMemo(()=>{
    const filtered = !p2SearchKey ? instTeachers : instTeachers.filter(t=>{
      const name = (fullData[t.uid]?.profile?.name || t.name || "").toLowerCase();
      const otherInsts = (t.institutes||[]).join(" ").toLowerCase();
      return name.includes(p2SearchKey) || otherInsts.includes(p2SearchKey);
    });
    return [...filtered].sort((a,b)=>{
      const aTs = instTeacherMeta[a.uid]?.lastEntryTs || 0;
      const bTs = instTeacherMeta[b.uid]?.lastEntryTs || 0;
      if(bTs !== aTs) return bTs - aTs;
      const aName = fullData[a.uid]?.profile?.name || a.name || "";
      const bName = fullData[b.uid]?.profile?.name || b.name || "";
      return exportTextSorter.compare(aName, bName);
    });
  },[instTeachers,fullData,p2SearchKey,instTeacherMeta]);

  const visibleInstClasses = useMemo(()=>{
    if(!p2SearchKey) return instClasses;
    return instClasses.filter(cls=>{
      const haystack = [
        cls.display,
        ...(cls.subjects||[]),
        ...((cls.teachers||[]).map(t=>t.name||"")),
      ].join(" ").toLowerCase();
      return haystack.includes(p2SearchKey);
    });
  },[instClasses,p2SearchKey]);

  const groupedVisibleInstClasses = useMemo(
    ()=>buildAdminProgramClassGroups(visibleInstClasses),
    [visibleInstClasses]
  );
  const displayedProgramGroups = useMemo(
    ()=>activeProgramFilter
      ? groupedVisibleInstClasses.filter(group => group.key === activeProgramFilter)
      : groupedVisibleInstClasses,
    [groupedVisibleInstClasses, activeProgramFilter]
  );
  const displayedVisibleClassCount = useMemo(
    ()=>displayedProgramGroups.reduce((sum, group) => sum + (group.items?.length || 0), 0),
    [displayedProgramGroups]
  );
  const visibleInstClassCountLabel = activeProgramFilter
    ? `${displayedVisibleClassCount} of ${visibleInstClasses.length} classes`
    : `${visibleInstClasses.length} of ${instClasses.length} classes`;

  React.useEffect(()=>{
    if(activeProgramFilter && !groupedVisibleInstClasses.some(group => group.key === activeProgramFilter)){
      setActiveProgramFilter(null);
    }
  }, [activeProgramFilter, groupedVisibleInstClasses]);

  React.useEffect(()=>{
    if(tab !== "class" || !activeProgramFilter || !selP2) return;
    const visibleRawSet = new Set(
      displayedProgramGroups.flatMap(group => (group.items || []).map(item => item.raw))
    );
    if(!visibleRawSet.has(selP2)){
      setSelP2(null);
      setSelP3(null);
      setFullView(null);
    }
  }, [tab, activeProgramFilter, selP2, displayedProgramGroups]);

  const renderProgramFilterBar = (compact = false) => {
    if(tab !== "class" || groupedVisibleInstClasses.length === 0) return null;
    const gap = compact ? 6 : 8;
    const paddingY = compact ? "6px 10px" : "7px 12px";
    const fontSize = compact ? 11 : 12;
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap,marginBottom:compact?10:12}}>
        <button onClick={()=>setActiveProgramFilter(null)}
          style={{
            display:"inline-flex",
            alignItems:"center",
            gap:8,
            background:activeProgramFilter ? "#fff" : G.navy,
            color:activeProgramFilter ? G.textM : "#fff",
            border:activeProgramFilter ? `1px solid ${G.border}` : "1px solid transparent",
            borderRadius:999,
            padding:paddingY,
            fontSize,
            fontWeight:800,
            cursor:"pointer",
            fontFamily:G.sans,
          }}>
          All
          <span style={{fontFamily:G.mono,fontWeight:700,opacity:0.9}}>{visibleInstClasses.length}</span>
        </button>
        {groupedVisibleInstClasses.map(group=>{
          const active = activeProgramFilter === group.key;
          return (
            <button key={group.key} onClick={()=>setActiveProgramFilter(current => current === group.key ? null : group.key)}
              style={{
                display:"inline-flex",
                alignItems:"center",
                gap:8,
                background:active ? group.accent : group.bg,
                color:active ? "#fff" : group.accent,
                border:`1px solid ${active ? group.accent : group.border}`,
                borderRadius:999,
                padding:paddingY,
                fontSize,
                fontWeight:800,
                cursor:"pointer",
                fontFamily:G.sans,
                boxShadow:active ? G.shadowSm : "none",
              }}>
              {group.label}
              <span style={{fontFamily:G.mono,fontWeight:700,opacity:0.9}}>{group.items.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const instWarmupActive = !!(selInst && instWarmup.inst===selInst && instWarmup.total>0 && instWarmup.loaded<instWarmup.total);
  const instWarmupLabel = instWarmupActive
    ? `${Math.min(instWarmup.loaded, instWarmup.total)}/${instWarmup.total} teacher${instWarmup.total===1?"":"s"} loaded`
    : "";

  // ── P3 content based on tab + P2 selection ────────────────────────────────
  const p3Items=useMemo(()=>{
    if(!selP2) return [];
    if(tab==="teacher"){
      // P2 = teacher → P3 = their classes at this institute only
      const d=fullData[selP2];
      if(!d) return [];
      return (d.classes||[])
        .filter(c=>(c.institute||"").trim().toLowerCase()===(selInst||"").trim().toLowerCase())
        .map(c=>{
          const resolvedSection = resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section;
          const activityTs = Math.max(lastEntryTs((d.notes||{})[c.id]||{}) || 0, Number(c.created || 0) || 0);
          return ({
          display:normaliseName(resolvedSection),
          raw:resolvedSection,
          subject:c.subject,
          institute:c.institute||"",
          classId:c.id,
          entryCount:Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0),
          lastActivityTs:activityTs,
        });
        })
        .sort((a,b)=>(b.lastActivityTs||0)-(a.lastActivityTs||0) || exportTextSorter.compare(a.display,b.display));
    } else {
      // P2 = class raw → P3 = teachers who teach that class
      const cls=instClasses.find(c=>c.raw===selP2);
      if(!cls) return [];
      return [...cls.teachers].sort((a,b)=>b.entryCount-a.entryCount);
    }
  },[selP2,tab,selInst,fullData,instClasses,instSectionsAll]);

  const p3SearchKey = p3Search.trim().toLowerCase();
  const visibleP3Items = useMemo(()=>{
    if(!p3SearchKey) return p3Items;
    return p3Items.filter(item=>{
      if(tab==="teacher"){
        const haystack = [item.display, item.subject, item.institute].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(p3SearchKey);
      }
      const teacherName = fullData[item.uid]?.profile?.name || item.name || "";
      const haystack = [teacherName, item.subject].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(p3SearchKey);
    });
  },[p3Items, p3SearchKey, tab, fullData]);

  // ── Archived (left) classes for teacher tab ───────────────────────────────
  const archivedP3Items=useMemo(()=>{
    if(!selP2||tab!=="teacher") return [];
    const d=fullData[selP2];
    if(!d) return [];
    return (d.trash?.classes||[])
      .filter(tc=>(tc.institute||"").trim().toLowerCase()===(selInst||"").trim().toLowerCase())
      .map(tc=>({
        display:normaliseName(resolveAdminSectionName(tc.section, tc.institute, instSectionsAll) || tc.section),
        raw:resolveAdminSectionName(tc.section, tc.institute, instSectionsAll) || tc.section,
        subject:tc.subject,
        institute:tc.institute||"",
        classId:tc.id,
        leaveReason:tc.leaveReason||"",
        leaveReasonLabel:tc.leaveReasonLabel||"Archived",
        deletedAt:tc.deletedAt||null,
        entryCount:Object.values(tc.savedNotes||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0),
      }))
      .sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0));
  },[selP2,tab,selInst,fullData,instSectionsAll]);

  // ── Entries for P4 ────────────────────────────────────────────────────────
  const selectedTeacherName = (uid) => {
    if(!uid) return "";
    return fullData[uid]?.profile?.name || teachers.find(t=>t.uid===uid)?.name || uid;
  };
  const p2Label = (value = selP2) => {
    if(!value) return "";
    if(value===ALL_CLASSES_KEY) return "All Classes";
    if(value===ALL_TEACHERS_KEY) return "All Teachers";
    return tab==="teacher" ? selectedTeacherName(value) : normaliseName(value);
  };
  const isAllClassesSelected = tab==="class" && selP2===ALL_CLASSES_KEY;
  const isAllTeachersSelected = tab==="teacher" && selP2===ALL_TEACHERS_KEY;
  const isAggregateSelection = isAllClassesSelected || isAllTeachersSelected;
  const aggregateTitle = isAllClassesSelected ? "All Classes" : isAllTeachersSelected ? "All Teachers" : "";
  const isScopedFullView = !!fullView;
  const isInstituteOverviewStep = mobileStep===3 && !!selInst && !selP2 && !selP3 && !isScopedFullView;
  const mobileStep3Label = isInstituteOverviewStep
    ? "Overview"
    : isScopedFullView
      ? "View Full"
      : isAggregateSelection
        ? aggregateTitle
        : selP3
          ? selP3.className
          : "All entries";
  const periodFilter = useMemo(()=>getPeriodFilter(period, customRange.start, customRange.end),[period,customRange.start,customRange.end]);
  const periodDays = periodFilter.days;
  const periodStartKey = periodFilter.startKey;
  const periodEndKey = periodFilter.endKey;

  const p4Entries=useMemo(()=>{
    if(!selP3) return null;
    const {teacherUid, classId}=selP3;
    const d=fullData[teacherUid];
    if(!d) return null;
    const classNotes=(d.notes||{})[classId]||{};
    const flat=getEntriesInRange(classNotes,periodDays,periodStartKey,periodEndKey);
    return groupByDate(flat);
  },[selP3,fullData,period,periodDays,periodStartKey,periodEndKey]);
  const selectedClassMeta = useMemo(()=>{
    if(!selP3) return null;
    const d = fullData[selP3.teacherUid];
    if(!d) return null;
    return (d.classes||[]).find(c=>c.id===selP3.classId) || null;
  },[selP3,fullData]);
  const selectedSubjectLabel = useMemo(()=>{
    const text = selectedClassMeta?.subject || selP3?.subject || "";
    return text && text !== "undefined" ? text : "";
  },[selectedClassMeta,selP3]);
  const selectedTimelineSummary = useMemo(()=>{
    if(!selP3) return null;
    const d = fullData[selP3.teacherUid];
    const classNotes = (d?.notes||{})[selP3.classId] || {};
    const flat = getEntriesInRange(classNotes, periodDays, periodStartKey, periodEndKey);
    const statusMap = {};
    const daySet = new Set();
    let totalMinutes = 0;
    let timedEntries = 0;
    let untimedEntries = 0;
    flat.forEach(({dateKey, entry})=>{
      daySet.add(dateKey);
      const statusKey = String(entry?.status || "").toLowerCase();
      if(statusKey) statusMap[statusKey] = (statusMap[statusKey] || 0) + 1;
      const mins = entryDurationMinutes(entry);
      if(mins>0){
        totalMinutes += mins;
        timedEntries += 1;
      } else {
        untimedEntries += 1;
      }
    });
    const lastTs = lastEntryTs(classNotes);
    return {
      entryCount: flat.length,
      totalMinutes,
      timedEntries,
      untimedEntries,
      activeDays: daySet.size,
      lastTs,
      lastAgo: daysAgo(lastTs),
      statusBreakdown: Object.entries(statusMap)
        .sort((a,b)=>b[1]-a[1])
        .map(([key,count])=>({
          key,
          count,
          ...(STATUS_STYLES[key] || { bg:G.bg, text:G.textS, label:key }),
        })),
    };
  },[selP3,fullData,periodDays,periodStartKey,periodEndKey]);

  const collectEntriesForTeacherClass = (teacherUid, teacherName, classId, className, subject, instituteName = selInst, days = periodDays, sk = periodStartKey, ek = periodEndKey) => {
    const d = fullData[teacherUid];
    if(!d) return [];
    return getEntriesInRange((d.notes||{})[classId]||{}, days, sk, ek).map(({dateKey, entry})=>({
      id: entry.id,
      dateKey,
      timeStart: entry.timeStart || "",
      timeEnd: entry.timeEnd || "",
      status: entry.status || "",
      tag: entry.tag || "note",
      title: entry.title || "",
      body: entry.body || "",
      teacherUid,
      teacherName,
      classId,
      className,
      subject: subject || "",
      institute: instituteName || selInst,
    }));
  };

  const fullViewEntries = useMemo(()=>{
    if(!fullView || !selInst) return [];
    if(fullView.kind==="teacher"){
      const d = fullData[fullView.teacherUid];
      const teacherName = fullView.teacherName || selectedTeacherName(fullView.teacherUid);
      if(!d) return [];
      return (d.classes||[])
        .filter(c=>sameInstituteName(c.institute, selInst))
        .flatMap(c=>collectEntriesForTeacherClass(
          fullView.teacherUid,
          teacherName,
          c.id,
          normaliseName(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section),
          c.subject,
          c.institute || selInst,
          periodDays, periodStartKey, periodEndKey
        ))
        .sort(compareAdminPanelEntries);
    }
    if(fullView.kind==="class"){
      const cls = instClasses.find(c=>c.raw===fullView.classRaw);
      if(!cls) return [];
      return (cls.teachers||[])
        .flatMap(t=>collectEntriesForTeacherClass(
          t.uid,
          t.name,
          t.classId,
          cls.display,
          t.subject || cls.subjects?.[0] || "",
          selInst,
          periodDays, periodStartKey, periodEndKey
        ))
        .sort(compareAdminPanelEntries);
    }
    return [];
  },[fullView,selInst,fullData,instClasses,periodDays,periodStartKey,periodEndKey,instSectionsAll]);

  const fullViewGroups = useMemo(()=>{
    if(!fullView) return [];
    return groupAdminPanelEntries(fullViewEntries);
  },[fullView,fullViewEntries]);

  const fullViewLoading = useMemo(()=>{
    if(!fullView) return false;
    if(fullView.kind==="teacher"){
      return !fullData[fullView.teacherUid];
    }
    if(fullView.kind==="class"){
      const cls = instClasses.find(c=>c.raw===fullView.classRaw);
      if(!cls) return false;
      return (cls.teachers||[]).some(t=>!fullData[t.uid]);
    }
    return false;
  },[fullView,fullData,instClasses]);

  const fullViewTitle = useMemo(()=>{
    if(!fullView) return "";
    if(fullView.kind==="teacher") return `${fullView.teacherName || selectedTeacherName(fullView.teacherUid)} — All Classes`;
    if(fullView.kind==="class"){
      const cls = instClasses.find(c=>c.raw===fullView.classRaw);
      return `${cls?.display || normaliseName(fullView.classRaw)} — All Teachers`;
    }
    return "";
  },[fullView,instClasses,fullData,teachers]);

  const fullViewSubtitle = useMemo(()=>{
    if(!fullView) return "";
    if(fullView.kind==="teacher") return `${selInst} · grouped by class, chronological inside each class`;
    if(fullView.kind==="class") return `${selInst} · all teachers merged into one class timeline`;
    return "";
  },[fullView,selInst]);

  const aggregateEntries=useMemo(()=>{
    if(!isAggregateSelection || !selInst) return [];
    return teachers
      .flatMap(t=>{
        const d = fullData[t.uid];
        if(!d) return [];
        const teacherName = d.profile?.name || t.name || "Teacher";
        return (d.classes||[])
          .filter(c=>sameInstituteName(c.institute, selInst))
          .flatMap(c=>collectEntriesForTeacherClass(
            t.uid,
            teacherName,
            c.id,
            normaliseName(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section),
            c.subject,
            c.institute || selInst,
            periodDays, periodStartKey, periodEndKey
          ));
      })
      .sort(compareAdminPanelEntries);
  },[isAggregateSelection,selInst,teachers,fullData,periodDays,periodStartKey,periodEndKey,instSectionsAll]);

  const aggregateGroups=useMemo(()=>{
    if(!isAggregateSelection) return [];
    return groupAdminPanelEntries(aggregateEntries);
  },[isAggregateSelection,aggregateEntries]);

  const aggregateLoadedTeacherCount = useMemo(()=>{
    if(!selInst) return 0;
    return instTeachers.filter(t=>!!fullData[t.uid]).length;
  },[selInst,instTeachers,fullData]);
  const aggregateLoading = isAggregateSelection && selInst && aggregateLoadedTeacherCount < instTeachers.length;
  const overviewPeriodText = adminPeriodLabel(period, customRange.start, customRange.end);

  const selectedInstituteEntryCount = useMemo(()=>{
    if(!selInst) return 0;
    return teachers.reduce((sum,t)=>{
      const d = fullData[t.uid];
      if(!d) return sum;
      return sum + (d.classes||[])
        .filter(c=>sameInstituteName(c.institute, selInst))
        .reduce((classSum,c)=>classSum + Object.values((d.notes||{})[c.id]||{}).reduce((daySum,arr)=>daySum + (Array.isArray(arr)?arr.length:0),0),0);
    },0);
  },[selInst,teacherBelongsToInstitute,teachers,fullData]);

  const selectedInstitutePeriodCount = useMemo(()=>{
    if(!selInst) return 0;
    return teachers.reduce((sum,t)=>{
      const d = fullData[t.uid];
      if(!d) return sum;
      return sum + (d.classes||[])
        .filter(c=>sameInstituteName(c.institute, selInst))
        .reduce((classSum,c)=>classSum + getEntriesInRange((d.notes||{})[c.id]||{}, periodDays, periodStartKey, periodEndKey).length,0);
    },0);
  },[selInst,teachers,fullData,periodDays,periodStartKey,periodEndKey]);

  const teacherEntryStatus = useMemo(()=>{
    if(!selInst) return [];
    return instTeachers
      .map(t=>{
        const d = fullData[t.uid];
        const fallbackLastEntryTs = instTeacherMeta[t.uid]?.lastEntryTs || null;
        return buildTeacherEntryStatusItem(t, d, selInst, fallbackLastEntryTs);
      })
      .sort((a,b)=>{
        if(a.loaded !== b.loaded) return a.loaded ? -1 : 1;
        if((b.lastEntryTs||0) !== (a.lastEntryTs||0)) return (b.lastEntryTs||0) - (a.lastEntryTs||0);
        if(a.todayUpdated !== b.todayUpdated) return a.todayUpdated ? -1 : 1;
        if(b.weekEntries !== a.weekEntries) return b.weekEntries - a.weekEntries;
        if(b.monthEntries !== a.monthEntries) return b.monthEntries - a.monthEntries;
        return exportTextSorter.compare(a.name,b.name);
      });
  },[selInst,instTeachers,fullData,instTeacherMeta]);

  const teacherEntrySummary = useMemo(()=>{
    const loaded = teacherEntryStatus.filter(item=>item.loaded);
    return {
      updatedToday: loaded.filter(item=>item.todayUpdated).length,
      todayEntries: loaded.reduce((sum,item)=>sum + item.todayEntries,0),
      weekEntries: loaded.reduce((sum,item)=>sum + item.weekEntries,0),
      monthEntries: loaded.reduce((sum,item)=>sum + item.monthEntries,0),
      loadedCount: loaded.length,
    };
  },[teacherEntryStatus]);

  const handleDownloadTeacherStatusImage = React.useCallback(async ()=>{
    if(!selInst || statusImageBusy) return;
    setStatusImageBusy(true);
    try {
      const exportItems = [];
      for(const teacher of instTeachers){
        const data = fullData[teacher.uid] || await ensureFullData(teacher.uid);
        const fallbackLastEntryTs = instTeacherMeta[teacher.uid]?.lastEntryTs || Number(teacher.lastActive || 0) || null;
        const item = buildTeacherEntryStatusItem(teacher, data, selInst, fallbackLastEntryTs);
        exportItems.push(item.loaded ? item : { ...item, loaded:true, classCount:0 });
      }
      const rows = sortTeacherStatusForShare(exportItems);
      await downloadTeacherStatusShareImage({
        instituteName: selInst,
        rows,
        summary: {
          updatedToday: rows.filter(item=>item.todayUpdated).length,
          weekEntries: rows.reduce((sum,item)=>sum + (item.weekEntries || 0), 0),
          monthEntries: rows.reduce((sum,item)=>sum + (item.monthEntries || 0), 0),
          totalTeachers: rows.length,
        },
        generatedOnLabel: `Generated ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`,
      });
    } catch (error) {
      console.error("teacher status image export failed", error);
      window.alert("Could not generate the teacher status image. Please try again.");
    } finally {
      setStatusImageBusy(false);
    }
  },[selInst,statusImageBusy,instTeachers,fullData,ensureFullData,instTeacherMeta]);

  const classSubjectTime = useMemo(()=>{
    if(!selInst) return [];
    return instClasses
      .map(cls=>{
        const activeTeachers = new Set();
        const subjectTotals = new Map();
        let entryCount = 0;
        let totalMinutes = 0;
        let untimedEntries = 0;
        (cls.teachers||[]).forEach(t=>{
          const d = fullData[t.uid];
          if(!d) return;
          const entries = getEntriesInRange((d.notes||{})[t.classId]||{}, periodDays, periodStartKey, periodEndKey);
          if(entries.length) activeTeachers.add(t.uid);
          entries.forEach(({entry})=>{
            entryCount += 1;
            const duration = entryDurationMinutes(entry);
            const subject = (t.subject || cls.subjects?.[0] || "No subject").trim() || "No subject";
            if(duration>0){
              totalMinutes += duration;
              subjectTotals.set(subject, (subjectTotals.get(subject) || 0) + duration);
            } else {
              untimedEntries += 1;
            }
          });
        });
        return {
          raw:cls.raw,
          display:cls.display,
          entryCount,
          totalMinutes,
          untimedEntries,
          teacherCount:cls.teachers.length,
          activeTeacherCount:activeTeachers.size,
          lastActivityTs:cls.lastActivityTs || 0,
          subjects:Array.from(subjectTotals.entries())
            .sort((a,b)=>b[1]-a[1] || exportTextSorter.compare(a[0],b[0]))
            .map(([subject, minutes])=>({subject, minutes, color:subjectColor(subject)})),
        };
      })
      .filter(item=>item.entryCount>0)
      .sort(compareClassCardsByActivity);
  },[selInst,instClasses,fullData,periodDays,periodStartKey,periodEndKey]);

  const classSubjectSummary = useMemo(()=>{
    return classSubjectTime.reduce((acc,item)=>{
      acc.classCount += 1;
      acc.entryCount += item.entryCount;
      acc.totalMinutes += item.totalMinutes;
      acc.untimedEntries += item.untimedEntries;
      return acc;
    },{classCount:0,entryCount:0,totalMinutes:0,untimedEntries:0});
  },[classSubjectTime]);

  const overviewRecentEntries = useMemo(()=>{
    const items = [];
    teachers.forEach(t=>{
      const d = fullData[t.uid];
      if(!d) return;
      const teacherName = d.profile?.name || t.name || "Teacher";
      (d.classes||[])
        .filter(c=>!selInst || sameInstituteName(c.institute, selInst))
        .forEach(c=>{
          const className = normaliseName(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section);
          Object.entries((d.notes||{})[c.id]||{}).forEach(([dk, arr])=>{
            if(!Array.isArray(arr)) return;
            arr.forEach(entry=>{
              if(!entry) return;
              items.push({
                id: entry.id || `${t.uid}_${c.id}_${dk}`,
                dateKey: dk,
                timeStart: entry.timeStart || "",
                title: entry.title || "Untitled entry",
                teacherName,
                className,
                subject: c.subject || "",
                institute: c.institute || "",
                status: entry.status || "",
              });
            });
          });
        });
    });
    return items
      .sort((a,b)=>{
        if((b.dateKey||"") !== (a.dateKey||"")) return (b.dateKey||"").localeCompare(a.dateKey||"");
        return (b.timeStart||"").localeCompare(a.timeStart||"");
      })
      .slice(0,6);
  },[teachers,fullData,selInst,instSectionsAll]);

  const globalInstituteHighlights = useMemo(()=>{
    return institutes
      .map(inst=>{
        const stats = instituteStats[inst] || { teacherCount:0, classCount:0 };
        const entryCount = teachers.reduce((sum,t)=>{
          const d = fullData[t.uid];
          if(!d) return sum;
          return sum + (d.classes||[])
            .filter(c=>sameInstituteName(c.institute,inst))
            .reduce((classSum,c)=>classSum + Object.values((d.notes||{})[c.id]||{}).reduce((daySum,arr)=>daySum + (Array.isArray(arr)?arr.length:0),0),0);
        },0);
        return { inst, teacherCount:stats.teacherCount, classCount:stats.classCount, entryCount };
      })
      .sort((a,b)=>b.entryCount-a.entryCount || b.classCount-a.classCount || exportTextSorter.compare(a.inst,b.inst))
      .slice(0,5);
  },[institutes,teachers,fullData,instituteStats]);

  // ── Role actions ──────────────────────────────────────────────────────────
  // Save a new global institute to Firestore config
  // Save reordered institute list
  const saveInstOrder = async (newList) => {
    try {
      await saveGlobalInstitute("__noop__"); // ensure doc exists
      const {doc: d, setDoc: s} = await import("firebase/firestore");
      const {db: fdb} = await import("./firebase");
      await s(d(fdb, "config", "institutes"), {list: newList});
      setGlobalInstList(newList);
    } catch(e) { console.warn("reorder failed", e); }
  };

  const handleRenameInstitute = async (oldName, newName) => {
    const nextName = String(newName || "").trim();
    if (!nextName) { setRenamingInst(null); return; }
    if (sameInstituteName(nextName, oldName) && nextName === String(oldName || "").trim()) {
      setRenamingInst(null);
      return;
    }
    try {
      const result = await renameGlobalInstitute(oldName, nextName, {
        adminName: user.displayName || user.email || "Admin",
      });
      setGlobalInstList(result.list || []);
      setInstSectionsAll(prev => renameInstituteInsideLocalSectionsMap(prev, oldName, result.newLabel));
      setTeachers(prev => prev.map(teacher => ({
        ...teacher,
        institutes: replaceInstituteListLocal(teacher.institutes, oldName, result.newLabel),
      })));
      setFullData(prev => Object.fromEntries(
        Object.entries(prev).map(([uid, teacherData]) => [
          uid,
          renameInstituteInsideLocalTeacherData(teacherData, oldName, result.newLabel),
        ])
      ));
      setDeletedInstitutes(s => {
        if (!s.has(oldName)) return s;
        const n = new Set(s);
        n.delete(oldName);
        n.add(result.newLabel);
        return n;
      });
      setSelInst(curr => sameInstituteName(curr, oldName) ? result.newLabel : curr);
      setInstDetailView(curr => sameInstituteName(curr, oldName) ? result.newLabel : curr);
      setOpenTeacherInstitute(curr => sameInstituteName(curr, oldName) ? result.newLabel : curr);
      setOpenAdminInstitute(curr => sameInstituteName(curr, oldName) ? result.newLabel : curr);
      setRenameInstVal("");
      setRenamingInst(null);
      const teacherCount = result.affectedTeacherCount || 0;
      showAdminToast(
        teacherCount
          ? `Renamed "${result.oldLabel}" to "${result.newLabel}" and updated ${teacherCount} teacher${teacherCount !== 1 ? "s" : ""}.`
          : `Renamed "${result.oldLabel}" to "${result.newLabel}".`
      );
    } catch(e) { showAdminToast("Failed: " + e.message); }
  };

  const handleCreateInstitute = async () => {
    const name = newInstName.trim();
    if (!name) return;
    try {
      await saveGlobalInstitute(name);
      setNewInstName("");
      // Reload global institutes list so P1 updates immediately
      const updated = await getGlobalInstitutes();
      setGlobalInstList(updated);
      showAdminToast(`Institute "${name}" created successfully`);
    } catch(e) { showAdminToast("Failed: " + e.message); }
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name || subjectBusy) return;
    setSubjectBusy(true);
    try {
      await saveGlobalSubject(name);
      setGlobalSubjects(await getGlobalSubjects());
      setNewSubjectName("");
      showAdminToast(`Subject "${name}" added.`);
    } catch (error) {
      showAdminToast(error?.message || "Subject could not be added.");
    } finally {
      setSubjectBusy(false);
    }
  };

  const handleImportTeacherSubjects = async () => {
    if (subjectBusy) return;
    const names = [...new Set(teachers
      .flatMap(teacher => teacher.subjects || [])
      .map(value => String(value || "").trim())
      .filter(Boolean))];
    if (!names.length) {
      showAdminToast("No existing teacher subjects were found.");
      return;
    }
    setSubjectBusy(true);
    try {
      for (const name of names) await saveGlobalSubject(name);
      setGlobalSubjects(await getGlobalSubjects());
      showAdminToast(`Imported ${names.length} existing subject${names.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showAdminToast(error?.message || "Existing subjects could not be imported.");
    } finally {
      setSubjectBusy(false);
    }
  };

  const handleToggleSubjectActive = async subject => {
    if (subjectBusy) return;
    setSubjectBusy(true);
    try {
      setGlobalSubjects(await setGlobalSubjectActive(subject.id, !subject.active));
    } catch (error) {
      showAdminToast(error?.message || "Subject could not be updated.");
    } finally {
      setSubjectBusy(false);
    }
  };

  const prepareSyllabusSubject = subject => {
    const subjectKey = subject.name.trim().toLowerCase();
    teachers
      .filter(teacher => {
        const assignedIds = teacher.assignedSubjectIds || [];
        const names = (teacher.subjects || []).map(value=>String(value).trim().toLowerCase());
        return assignedIds.includes(subject.id) || names.includes(subjectKey);
      })
      .forEach(teacher=>ensureFullData(teacher.uid).catch(()=>{}));
  };

  const prepareSyllabusInstitutes = React.useCallback(instituteNames => {
    const selected=Array.isArray(instituteNames)?instituteNames:[];
    if(!selected.length) return;
    teachers
      .filter(teacher=>selected.some(instituteName=>teacherBelongsToInstitute(teacher,instituteName)))
      .forEach(teacher=>ensureFullData(teacher.uid).catch(()=>{}));
  },[teachers,teacherBelongsToInstitute,ensureFullData]);

  const handleSaveSyllabusDraft = async template => {
    if(syllabusBusy) return null;
    setSyllabusBusy(true);
    try{
      const saved=await saveSyllabusDraft(template,user.uid);
      setSyllabusTemplates(current=>[
        ...current.filter(item=>item.id!==saved.id),
        saved,
      ]);
      showAdminToast("Syllabus draft saved.");
      return saved;
    }catch(error){
      showAdminToast(error?.message||"Syllabus draft could not be saved.");
      return null;
    }finally{
      setSyllabusBusy(false);
    }
  };

  const handlePublishSyllabus = async templateId => {
    if(syllabusBusy) return null;
    setSyllabusBusy(true);
    try{
      const published=await publishSyllabusTemplate(templateId,user.uid);
      setSyllabusTemplates(current=>[
        ...current.filter(item=>item.id!==published.id),
        published,
      ]);
      showAdminToast(`Syllabus version ${published.currentVersion} published.`);
      return published;
    }catch(error){
      showAdminToast(error?.message||"Syllabus could not be published.");
      return null;
    }finally{
      setSyllabusBusy(false);
    }
  };

  const handleDeleteSyllabus = async templateId => {
    if(syllabusBusy) return false;
    setSyllabusBusy(true);
    try{
      await deleteSyllabusTemplate(templateId);
      setSyllabusTemplates(current=>current.filter(item=>item.id!==templateId));
      showAdminToast("Syllabus deleted.");
      return true;
    }catch(error){
      showAdminToast(error?.message||"Syllabus could not be deleted.");
      return false;
    }finally{
      setSyllabusBusy(false);
    }
  };

  const teacherAssignedSubjectIds = teacher => {
    const explicit = Array.isArray(teacher.assignedSubjectIds) ? teacher.assignedSubjectIds : [];
    if (explicit.length || Number(teacher.subjectAssignmentVersion || 0) > 0) return explicit;
    const legacyNames = new Set((teacher.subjects || []).map(value => String(value).trim().toLowerCase()));
    return globalSubjects
      .filter(subject => legacyNames.has(subject.name.toLowerCase()))
      .map(subject => subject.id);
  };

  const handleToggleTeacherSubject = async (teacher, subject) => {
    if (subjectAssignmentBusy) return;
    const currentIds = teacherAssignedSubjectIds(teacher);
    const nextIds = currentIds.includes(subject.id)
      ? currentIds.filter(id => id !== subject.id)
      : [...currentIds, subject.id];
    const nextSubjects = globalSubjects.filter(item => nextIds.includes(item.id) && item.active);
    setSubjectAssignmentBusy(teacher.uid);
    try {
      await updateTeacherSubjectAssignments(teacher.uid, nextSubjects, user.uid);
      setTeachers(current => current.map(item => item.uid === teacher.uid ? {
        ...item,
        assignedSubjectIds: nextSubjects.map(value => value.id),
        assignedSubjects: nextSubjects.map(value => ({ id:value.id, name:value.name })),
        subjects: nextSubjects.map(value => value.name),
        subjectAssignmentVersion: Number(item.subjectAssignmentVersion || 0) + 1,
        subjectAssignmentUpdatedAt: Date.now(),
      } : item));
      showAdminToast(`${getTeacherDisplayName(teacher)} subject assignment updated.`);
    } catch (error) {
      showAdminToast(error?.message || "Teacher subjects could not be updated.");
    } finally {
      setSubjectAssignmentBusy(null);
    }
  };

  // Rename a teacher (admin only)
  const handleRenameTeacher = async (uid, newName) => {
    if (!newName.trim()) return;
    try {
      await saveProfileName(uid, newName.trim());
      setTeachers(ts => ts.map(t => t.uid === uid ? { ...t, name: newName.trim() } : t));
      setFullData(fd => {
        if (!fd[uid]) return fd;
        return { ...fd, [uid]: { ...fd[uid], profile: { ...fd[uid].profile, name: newName.trim() } } };
      });
      setRenamingTeacher(null);
    } catch(e) { showAdminToast("Could not rename: " + e.message); }
  };

  const handleRepairTeacherIndex = async (uid) => {
    setRepairingTeacherUid(uid);
    try {
      const repaired = await repairTeacherIndex(uid);
      if (!repaired?.ok) {
        showAdminToast(repaired?.reason==="missing-profile"
          ? "Repair blocked: teacher profile name is missing."
          : "Repair could not find recoverable teacher data.");
        return;
      }
      const fresh = await getTeacherFullData(uid);
      if (fresh) {
        setFullData(prev => ({ ...prev, [uid]: fresh }));
      }
      setTeachers(prev => {
        const next = repaired.summary;
        const found = prev.some(t => t.uid === uid);
        return found
          ? prev.map(t => t.uid === uid ? { ...t, ...next } : t)
          : [{ ...next }, ...prev];
      });
      showAdminToast(`Teacher index repaired for ${repaired.summary.name || uid}.`);
    } catch (e) {
      showAdminToast("Repair failed: " + e.message);
    } finally {
      setRepairingTeacherUid(null);
    }
  };

  // Fully remove a teacher from the system
  const handleRemoveTeacher = async (uid, name) => {
    confirmDelete({
      title: `Remove "${name}" from system?`,
      lines: [
        "This will remove them from the teachers list and revoke their access.",
        "Their class entries in Firestore are NOT deleted — only their account access is removed.",
        "They will need an invite link to rejoin.",
      ],
      confirmLabel: "Remove Teacher",
      onConfirm: async () => {
        setDeleteBusy(true);
        try {
          await removeTeacherFromSystem(uid);
          setTeachers(ts => ts.filter(t => t.uid !== uid));
          setRoles(r => { const n={...r}; delete n[uid]; return n; });
          setFullData(fd => { const n={...fd}; delete n[uid]; return n; });
          setSelTeacher(null);
        } catch(e) { showAdminToast("Failed: " + e.message); }
        setDeleteBusy(false); setDeleteModal(null);
      }
    });
  };

  // Remove teacher from a specific class
  const handleRemoveFromClass = async (uid, classId, className) => {
    // confirm handled below
    try {
      await deleteClassFromTeacherData(uid, classId);
      setFullData(fd => {
        if (!fd[uid]) return fd;
        const d = { ...fd[uid] };
        d.classes = (d.classes || []).filter(c => c.id !== classId);
        return { ...fd, [uid]: d };
      });
    } catch(e) { showAdminToast("Failed: " + e.message); }
  };

  const handleGenerateInvite=async()=>{
    setInviteLoading(true); setInviteLink(null);
    try {
      const token = await createInviteLink(user.uid);
      const link = `${window.location.origin}?invite=${token}`;
      setInviteLink(link);
    } catch(e) { showAdminToast("Failed to generate link: "+e.message); }
    finally { setInviteLoading(false); }
  };

  const handlePromote=async(uid)=>{
    adminConfirmDialog("Promote to Admin? They will see all data.","Promote",async()=>{
      await promoteToAdmin(uid,user.uid);
      setRoles(r=>({...r,[uid]:"admin"}));
    });
  };
  const handleDemote=async(uid)=>{
    if(uid===user.uid){
      showAdminToast("You cannot remove your own admin access.");
      return;
    }
    const target = teachers.find(t=>t.uid===uid);
    const targetName = target ? getTeacherDisplayName(target) : "this admin";
    adminConfirmDialog(`Remove admin access for ${targetName}? They will remain a teacher account.`,"Remove Admin",async()=>{
      try {
        await demoteToTeacher(uid,user.uid);
        setRoles(r=>({...r,[uid]:"teacher"}));
        showAdminToast(`${targetName} is no longer an admin.`);
      } catch(e) {
        showAdminToast("Could not remove admin access: " + (e?.message || "Unknown error"));
      }
    });
  };

  // ── Delete handlers ───────────────────────────────────────────────────────
  const confirmDelete = (modal) => setDeleteModal(modal);

  // Simple confirm wrapper used by promote/demote/restore actions
  const adminConfirmDialog = (msg, confirmLabel, onConfirm) => {
    setAdminConfirm({ msg, confirmLabel, onConfirm });
  };

  const handleDeleteInstitute = (inst) => {
    setInstDeleteModal({ inst, step: "choose", migrateTarget: "", busy: false, error: "" });
  };

  const handleDeleteClass = (teacherUid, classId, className, teacherName) => {
    confirmDelete({
      title: `Delete class "${className}"?`,
      lines: [
        `This moves the class and all its entries from ${teacherName}'s account into the recycle bin.`,
        "You can restore it later from the admin recycle bin.",
      ],
      confirmLabel: "Move to Recycle Bin",
      onConfirm: async () => {
        setDeleteBusy(true);
        try {
          const trashedClass = await trashClassInTeacherData(teacherUid, classId, {
            deletedByAdmin: true,
            deletedBy: user.uid,
            deletedByName: user.displayName || user.email || "Admin",
          });
          if (!trashedClass) {
            throw new Error("Class snapshot could not be moved to trash.");
          }

          const fresh = await getTeacherFullData(teacherUid);
          if (fresh) setFullData(prev => ({ ...prev, [teacherUid]: fresh }));
          persistAdminBin(b=>[
            ...b,
            {
              type:"class",
              name:className,
              teacherName,
              teacherUid,
              classId,
              institute:trashedClass.institute || selInst,
              deletedAt:trashedClass.deletedAt || Date.now(),
              deletedBy:user.uid,
            },
          ]);
          if (selP3?.classId === classId) setSelP3(null);
          showAdminToast(`Moved "${className}" to the recycle bin.`);
        } catch (e) {
          showAdminToast("Failed to delete class: " + e.message);
        }
        setDeleteBusy(false); setDeleteModal(null);
      },
    });
  };

  const handleDeleteSectionGroup = React.useCallback((sectionGroup) => {
    if(!sectionGroup) return;
    const records = Array.isArray(sectionGroup.teachers) ? sectionGroup.teachers.filter(item => item?.uid && item?.classId) : [];
    if(!records.length){
      showAdminToast("No class records found for this section.");
      return;
    }
    const teacherCount = new Set(records.map(item => item.uid)).size;
    const entryCount = records.reduce((sum, item) => sum + Number(item.entryCount || 0), 0);
    confirmDelete({
      title: `Delete section "${sectionGroup.display}"?`,
      lines: [
        `This will permanently delete ${records.length} class record${records.length!==1?"s":""} across ${teacherCount} teacher${teacherCount!==1?"s":""}.`,
        entryCount ? `${entryCount} existing entr${entryCount===1?"y":"ies"} under this section will also be removed.` : "Any entries under this section will also be removed.",
        "This cannot be undone.",
      ],
      confirmLabel: "Delete Section",
      onConfirm: async () => {
        setDeleteBusy(true);
        try {
          const byTeacher = {};
          records.forEach(item => {
            if(!byTeacher[item.uid]) byTeacher[item.uid] = [];
            byTeacher[item.uid].push(item.classId);
          });

          for (const [uid, classIds] of Object.entries(byTeacher)) {
            const uniqueClassIds = [...new Set(classIds.filter(Boolean))];
            for (const classId of uniqueClassIds) {
              await deleteClassFromTeacherData(uid, classId);
            }
          }

          const refreshedEntries = await Promise.all(
            Object.keys(byTeacher).map(async uid => [uid, await getTeacherFullData(uid)])
          );
          setFullData(prev => ({
            ...prev,
            ...Object.fromEntries(refreshedEntries.filter(([, data]) => !!data)),
          }));
          persistAdminBin(bin => [
            ...bin,
            {
              type: "section",
              name: sectionGroup.display,
              institute: selInst,
              teacherCount,
              classCount: records.length,
              deletedAt: Date.now(),
              deletedBy: user.uid,
            },
          ]);
          setSelP2(current => current === sectionGroup.raw ? null : current);
          setSelP3(current => current?.className === sectionGroup.display ? null : current);
          setFullView(current => current?.kind === "class" && current?.classRaw === sectionGroup.raw ? null : current);
          showAdminToast(`Deleted section "${sectionGroup.display}".`);
        } catch (e) {
          showAdminToast("Failed to delete section: " + e.message);
        }
        setDeleteBusy(false);
        setDeleteModal(null);
      },
    });
  }, [confirmDelete, selInst, setFullView, setSelP2, setSelP3, showAdminToast, user.uid]);

  const handleDeleteEntry = (teacherUid, classId, dateKey, entryId, entryTitle) => {
    confirmDelete({
      title: "Delete this entry?",
      lines: [
        `"${entryTitle||"(no title)"}" will be permanently deleted from ${dateKey}.`,
        "This cannot be undone.",
      ],
      confirmLabel: "Delete Entry",
      onConfirm: async () => {
        setDeleteBusy(true);
        await deleteEntryFromTeacherData(teacherUid, classId, dateKey, entryId);
        // Update local fullData to reflect deletion instantly
        setFullData(prev => {
          const d = prev[teacherUid];
          if (!d) return prev;
          const cn = (d.notes||{})[classId] || {};
          const updated = { ...cn, [dateKey]: (cn[dateKey]||[]).filter(e => e.id !== entryId) };
          return { ...prev, [teacherUid]: { ...d, notes: { ...d.notes, [classId]: updated } } };
        });
        setDeleteBusy(false); setDeleteModal(null);
      },
    });
  };

  const clearDrilldown = () => { setSelP2(null); setSelP3(null); setFullView(null); };
  const resetNav=(newTab)=>{
    setMobileSurface("workspace");
    setProfileOpen(false);
    clearDrilldown();
    setP2Search("");
    setP3Search("");
    setActiveProgramFilter(null);
    if(newTab)setTab(newTab);
    setMobileStep(s=>Math.min(s,1));
  };

  // When institute is selected, warm its teachers sequentially in the background.
  // This avoids the old "fan out dozens of reads at once" behavior that hurts
  // older Android devices.
  const onSelectInstitute = (inst) => {
    setMobileSurface("workspace");
    setProfileOpen(false);
    setSelInst(inst);
    setTab("class");
    clearDrilldown();
    setP2Search("");
    setP3Search("");
    setActiveProgramFilter(null);
    setMobileStep(1);
    warmInstitute(inst);
  };

  const openMobileProfile = () => {
    setProfileOpen(false);
    setMobileSurface("profile");
  };

  const openMobileInstituteHome = () => {
    setProfileOpen(false);
    setMobileSurface("workspace");
    setSelInst(null);
    clearDrilldown();
    setP2Search("");
    setP3Search("");
    setActiveProgramFilter(null);
    setMobileStep(0);
  };

  const openMobileWorkspaceTab = (nextTab = "class") => {
    setProfileOpen(false);
    setMobileSurface("workspace");
    if(!selInst){
      setTab("class");
      setMobileStep(0);
      return;
    }
    resetNav(nextTab === "teacher" ? "teacher" : "class");
  };

  const openMobileManageArea = React.useCallback((target) => {
    setProfileOpen(false);
    setMobileSurface("workspace");
    if(target === "teachers"){
      setManageTab("teachers");
      setInstDetailView(null);
    } else if(target === "admins"){
      setManageTab("admins");
      setInstDetailView(null);
    } else if(target === "institutes"){
      setManageTab("institutes");
      setInstDetailView(null);
    } else if(target === "sections"){
      setManageTab("sections");
      setInstDetailView(selInst || null);
    } else if(target === "subjects"){
      setManageTab("subjects");
      setInstDetailView(null);
    } else if(target === "catalog"){
      setManageTab("catalog");
      setInstDetailView(null);
    }
    setView("manage");
  }, [selInst]);

  const openManageTab = React.useCallback((target, options = {}) => {
    const { detailInstitute = null, scopeInstitute = "" } = options;
    setProfileOpen(false);
    setInstituteGlanceOpen(false);
    setInstituteGlanceOptionsOpen(false);
    setTelegramDashboardOpen(false);
    setManageScopeInstitute(scopeInstitute);
    setOpenTeacherInstitute(target === "teachers" && scopeInstitute ? scopeInstitute : null);
    setOpenAdminInstitute(target === "admins" && scopeInstitute ? scopeInstitute : null);
    setManageTab(target);
    if(target === "sections"){
      setInstDetailView(detailInstitute);
    } else {
      setInstDetailView(null);
    }
    setView("manage");
    if(target === "report"){
      loadInstituteGlanceReport().catch(handleInstituteGlanceLoadFailure);
    }
  }, [handleInstituteGlanceLoadFailure, loadInstituteGlanceReport]);

  // Keep touch/scroll institute selection logic below the values it depends on.
  // These callbacks read institutes, saveInstOrder, and onSelectInstitute in
  // their dependency arrays, so declaring them earlier can trip a TDZ error in
  // production builds.
  const clearInstituteLongPress = React.useCallback(() => {
    const state = instituteTouchStateRef.current;
    if(state.longPressTimer){
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  }, []);
  const resetInstituteTouchVisuals = React.useCallback((target) => {
    if(!target) return;
    target.style.boxShadow = "";
    target.style.transform = "";
  }, []);
  const resetInstituteTouchState = React.useCallback((target = instituteTouchStateRef.current.target) => {
    clearInstituteLongPress();
    resetInstituteTouchVisuals(target);
    const state = instituteTouchStateRef.current;
    state.activeInst = null;
    state.startX = 0;
    state.startY = 0;
    state.moved = false;
    state.target = null;
  }, [clearInstituteLongPress, resetInstituteTouchVisuals]);
  const suppressInstituteGhostClick = React.useCallback((inst) => {
    const state = instituteTouchStateRef.current;
    state.skipClickInst = inst;
    state.skipClickUntil = Date.now() + 360;
  }, []);
  const shouldSkipInstituteClick = React.useCallback((inst) => {
    const state = instituteTouchStateRef.current;
    return state.skipClickInst === inst && state.skipClickUntil > Date.now();
  }, []);
  const handleInstituteSelect = React.useCallback((inst) => {
    if(shouldSkipInstituteClick(inst)) return;
    onSelectInstitute(inst);
  }, [onSelectInstitute, shouldSkipInstituteClick]);
  const beginInstituteTouch = React.useCallback((event, inst, { longPressDrag = false } = {}) => {
    const touch = event.touches?.[0];
    const target = event.currentTarget;
    if(!touch || !target) return;
    const state = instituteTouchStateRef.current;
    clearInstituteLongPress();
    state.activeInst = inst;
    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.moved = false;
    state.target = target;
    if(longPressDrag){
      state.longPressTimer = window.setTimeout(() => {
        const currentState = instituteTouchStateRef.current;
        if(currentState.activeInst !== inst || currentState.target !== target || currentState.moved) return;
        dragInstRef.current = inst;
        setDragInst(inst);
        target.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
        target.style.transform = "scale(1.02)";
      }, 400);
    }
  }, [clearInstituteLongPress]);
  const moveInstituteTouch = React.useCallback((event, { longPressDrag = false } = {}) => {
    const state = instituteTouchStateRef.current;
    const touch = event.touches?.[0];
    if(!touch) return;
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    if(!state.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 4)){
      state.moved = true;
      clearInstituteLongPress();
    }
    if(!longPressDrag || !dragInstRef.current) return;
    event.preventDefault();
    const hovered = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = hovered?.closest?.("[data-inst]");
    if(card && card.dataset.inst !== dragInstRef.current) setDragOverInst(card.dataset.inst);
  }, [clearInstituteLongPress]);
  const endInstituteTouch = React.useCallback((event, inst, { longPressDrag = false } = {}) => {
    const state = instituteTouchStateRef.current;
    const target = state.target || event.currentTarget;
    const didMove = state.moved;
    const draggingInst = dragInstRef.current;
    suppressInstituteGhostClick(inst);
    clearInstituteLongPress();
    if(longPressDrag && draggingInst && dragOverInst && dragOverInst !== draggingInst){
      const from = institutes.indexOf(draggingInst);
      const to = institutes.indexOf(dragOverInst);
      if(from >= 0 && to >= 0){
        const reordered = [...institutes];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        saveInstOrder(reordered);
      }
    } else if(!didMove && !draggingInst){
      onSelectInstitute(inst);
    }
    setDragInst(null);
    setDragOverInst(null);
    dragInstRef.current = null;
    resetInstituteTouchState(target);
  }, [clearInstituteLongPress, dragOverInst, institutes, onSelectInstitute, resetInstituteTouchState, saveInstOrder, suppressInstituteGhostClick]);
  const cancelInstituteTouch = React.useCallback((inst) => {
    suppressInstituteGhostClick(inst);
    setDragInst(null);
    setDragOverInst(null);
    dragInstRef.current = null;
    resetInstituteTouchState();
  }, [resetInstituteTouchState, suppressInstituteGhostClick]);

  const openMobileInstituteOverview = () => {
    setSelP2(null);
    setSelP3(null);
    setFullView(null);
    setMobileStep(3);
  };

  const renderSectionDeleteButton = (sectionGroup, { compact = false } = {}) => (
    <button
      onClick={e=>{e.stopPropagation();handleDeleteSectionGroup(sectionGroup);}}
      style={{
        display:"inline-flex",
        alignItems:"center",
        gap:6,
        background:"linear-gradient(180deg,#FFF6F6 0%,#FFEDED 100%)",
        border:"1px solid #F4C7CD",
        borderRadius:compact ? 11 : 12,
        padding:compact ? "6px 10px" : "7px 11px",
        fontSize:compact ? 11 : 12,
        fontWeight:700,
        color:"#B42318",
        cursor:"pointer",
        fontFamily:G.sans,
        flexShrink:0,
        boxShadow:"inset 0 1px 0 rgba(255,255,255,0.86)",
        WebkitTapHighlightColor:"transparent",
      }}
      title={`Delete ${sectionGroup?.display || "section"}`}
    >
      <svg width={compact ? 12 : 13} height={compact ? 12 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18"/>
        <path d="M8 6V4h8v2"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
      </svg>
      <span>Delete</span>
    </button>
  );

  const goMobileBack = () => {
    if(mobileStep===3){
      if(isAggregateSelection){
        setSelP3(null);
        setMobileStep(1);
        return;
      }
      if(isScopedFullView){
        const cameDirectlyFromList = fullView?.source === "mobile-list";
        setFullView(null);
        setSelP3(null);
        if(cameDirectlyFromList){
          setSelP2(null);
          setMobileStep(1);
          return;
        }
        setMobileStep(2);
        return;
      }
      if(isInstituteOverviewStep){
        setMobileStep(1);
        return;
      }
      setSelP3(null);
      setMobileStep(2);
      return;
    }
    if(mobileStep===2){
      setSelP2(null);
      setSelP3(null);
      setFullView(null);
      setMobileStep(1);
      return;
    }
    if(mobileStep===1){
      setSelInst(null);
      clearDrilldown();
      setMobileStep(0);
      return;
    }
    setMobileStep(0);
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  // Collect rows for a specific teacher + classId, filtered by date range, sorted ascending
  const rowsForTeacherClass = (teacherUid, teacherName, classId, className, subject, startKey, endKey, instituteName = selInst) => {
    const d = fullData[teacherUid];
    if (!d) return [];
    const classNotes = (d.notes || {})[classId] || {};
    const result = [];
    Object.entries(classNotes || {}).forEach(([dk, arr]) => {
      if (startKey && dk < startKey) return;
      if (endKey && dk > endKey) return;
      if (!Array.isArray(arr)) return;
      arr.forEach(e => { if (e) result.push({dateKey: dk, entry: e}); });
    });
    // sort ascending: oldest first, within same date by timeStart asc
    result.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      return (a.entry.timeStart || "").localeCompare(b.entry.timeStart || "");
    });
    return result.map(({dateKey: dk, entry: e}) => ({
      date: dk, start_time: e.timeStart||"", end_time: e.timeEnd||"",
      teacher: teacherName, institute: instituteName || selInst,
      class: className, subject: subject,
      type: e.tag||"", title: e.title||"",
      notes: (e.body||"").replace(/\n/g," "),
    })).sort(compareExportRows);
  };

  const rowsForInstitute = (startKey, endKey) => {
    if (!selInst) return [];
    return teachers
      .flatMap(t => {
        const d = fullData[t.uid];
        if (!d) return [];
        const teacherName = d.profile?.name || t.name || "Teacher";
        return (d.classes || [])
          .filter(c => sameInstituteName(c.institute, selInst))
          .flatMap(c =>
            rowsForTeacherClass(
              t.uid,
              teacherName,
              c.id,
              normaliseName(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section),
              c.subject,
              startKey,
              endKey,
              c.institute || selInst
            )
          );
      })
      .sort(compareExportRows);
  };

  const doExport = (rows, filename, title, meta) => {
    if (!rows.length) { showAdminToast("No entries found for the selected period"); return; }
    return { rows, filename, title, meta };
  };

  const triggerCSV = (rows, filename) => {
    const headers = ["Date","Start Time","End Time","Teacher","Institute","Class","Subject","Type","Title","Notes"];
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h=>{
        const key=h.toLowerCase().replace(/ /g,"_");
        const val=String(r[key]||"").replace(/"/g,'""');
        return `"${val}"`;
      }).join(","))
    ].join("\n");
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})),download:filename.replace(/\s+/g,"_")+".csv"});
    a.click(); setExportOpen(false);
  };

  const triggerJSON = (rows, filename, meta) => {
    const blob = new Blob([JSON.stringify({export:meta,entries:rows},null,2)],{type:"application/json"});
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:filename.replace(/\s+/g,"_")+".json"});
    a.click(); setExportOpen(false);
  };

  const triggerPDF = (rows, title, meta) => {
    if (!rows.length) { showAdminToast("No entries to export"); return; }
    const groups = groupAdminPdfRows(rows);
    const totalClasses = groups.reduce((sum,inst)=>sum+inst.classCount,0);
    const printCSS = `
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:28px;color:#0E1F18;background:#fff}
      h1{font-size:20px;margin:0 0 4px}
      .meta{font-size:12px;color:#5C7268;margin-bottom:16px}
      .summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
      .summary-card{border:1px solid #DDE3ED;border-radius:12px;padding:10px 12px;min-width:120px;background:#F7F9FD}
      .summary-label{font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:#6B7280;font-weight:700;margin-bottom:4px}
      .summary-value{font-size:16px;font-weight:700;color:#1A2F5A}
      .inst-block{margin-top:24px}
      .inst-block:first-of-type{margin-top:0}
      .inst-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #1A2F5A;padding-bottom:10px;margin-bottom:16px}
      .inst-title{font-size:17px;font-weight:700;color:#1A2F5A;margin:0}
      .inst-meta{font-size:11px;color:#5C7268;font-weight:700;white-space:nowrap}
      .class-block{border:1px solid #DDE3ED;border-radius:14px;overflow:hidden;margin-bottom:14px;page-break-inside:avoid}
      .class-head{padding:12px 14px;background:#F5F7FA;border-bottom:1px solid #DDE3ED}
      .class-title{font-size:15px;font-weight:700;color:#111827}
      .class-sub{font-size:12px;color:#4B5563;margin-top:3px;line-height:1.45}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1A2F5A;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
      td{padding:8px 10px;border-bottom:1px solid #E2E8F0;vertical-align:top}
      tr:nth-child(even) td{background:#F7F8FC}
      tr:last-child td{border-bottom:none}
      .tag{background:#DBEAFE;color:#1D4ED8;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block}
      .title{font-weight:700;color:#111827}
      .notes{color:#374151;line-height:1.45}
      .empty{text-align:center;padding:40px;color:#94A3B8;border:1px dashed #DDE3ED;border-radius:16px}
      @media print{body{padding:0}}
    `;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${escapeExportHtml(title)}</title><style>${printCSS}</style></head><body>
      <h1>${escapeExportHtml(title)}</h1>
      <div class="meta">${escapeExportHtml(meta)} · Exported ${escapeExportHtml(new Date().toLocaleDateString())}</div>
      ${rows.length===0
        ? '<div class="empty">No entries found for this export.</div>'
        : `<div class="summary">
            <div class="summary-card"><div class="summary-label">Institutes</div><div class="summary-value">${groups.length}</div></div>
            <div class="summary-card"><div class="summary-label">Classes</div><div class="summary-value">${totalClasses}</div></div>
            <div class="summary-card"><div class="summary-label">Entries</div><div class="summary-value">${rows.length}</div></div>
          </div>
          ${groups.map(inst=>`<section class="inst-block">
            <div class="inst-head">
              <h2 class="inst-title">${escapeExportHtml(inst.name)}</h2>
              <div class="inst-meta">${inst.classCount} class${inst.classCount!==1?"es":""} · ${inst.entryCount} entr${inst.entryCount!==1?"ies":"y"}</div>
            </div>
            ${inst.classes.map(group=>`<div class="class-block">
              <div class="class-head">
                <div class="class-title">${escapeExportHtml(group.className)}</div>
                <div class="class-sub">
                  ${group.subjectList.length?`Subjects: ${escapeExportHtml(group.subjectList.join(", "))} · `:""}Teachers: ${escapeExportHtml(group.teacherList.join(", ") || "—")} · ${group.entries.length} entr${group.entries.length!==1?"ies":"y"}
                </div>
              </div>
              <table>
                <thead><tr><th>Date</th><th>Time</th><th>Teacher</th><th>Subject</th><th>Type</th><th>Title</th><th>Notes</th></tr></thead>
                <tbody>
                  ${group.entries.map(r=>`<tr>
                    <td style="white-space:nowrap">${escapeExportHtml(formatExportPdfDate(r.date))}</td>
                    <td style="white-space:nowrap">${escapeExportHtml(formatExportPdfTime(r.start_time, r.end_time))}</td>
                    <td>${escapeExportHtml(r.teacher || "")}</td>
                    <td>${escapeExportHtml(r.subject || "")}</td>
                    <td><span class="tag">${escapeExportHtml(r.type || "")}</span></td>
                    <td class="title">${escapeExportHtml(r.title || "—")}</td>
                    <td class="notes">${exportHtmlWithBreaks(r.notes || "—")}</td>
                  </tr>`).join("")}
                </tbody>
              </table>
            </div>`).join("")}
          </section>`).join("")}`
      }
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`;
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
    setExportOpen(false);
  };

  // ── Export action builders ─────────────────────────────────────────────────
  // getRows(startKey, endKey) — called by modal at export time with exact date range
  const exportActions = (() => {
    const actions = [];

    // Shared trigger helpers (standalone, not closures over stale days)
    const _csv = (rows, filename) => triggerCSV(rows, filename);
    const _pdf = (rows, title, meta) => triggerPDF(rows, title, meta);
    const _json = (rows, filename, label) => triggerJSON(rows, filename, {institute:selInst,period:label});

    // Current view (teacher + class)
    if (selP3) {
      actions.push({
        label: "This view",
        sub: `${selP3.teacherName} · ${selP3.className}`,
        icon: "📋",
        filename: `${selP3.teacherName}_${selP3.className}`,
        title: `${selP3.teacherName} — ${selP3.className}`,
        meta: `${selInst} · ${selP3.subject||""}`,
        getRows: (sk, ek) => rowsForTeacherClass(selP3.teacherUid, selP3.teacherName, selP3.classId, selP3.className, selP3.subject, sk, ek, selP3.institute || selInst),
        triggerCSV: _csv, triggerPDF: _pdf, triggerJSON: _json,
      });
    }

    // By teacher — all their classes at this institute
    if (tab==="teacher" && selP2 && fullData[selP2]) {
      const d = fullData[selP2];
      const tName = d.profile?.name || "Teacher";
      actions.push({
        label: "All classes",
        sub: `${tName} across ${selInst}`,
        icon: "👤",
        filename: `${tName}_All_Classes`,
        title: `${tName} — All Classes`,
        meta: `${selInst}`,
        getRows: (sk, ek) => (d.classes||[])
          .filter(c=>sameInstituteName(c.institute, selInst))
          .flatMap(c => rowsForTeacherClass(selP2, tName, c.id, normaliseName(resolveAdminSectionName(c.section, c.institute, instSectionsAll) || c.section), c.subject, sk, ek, c.institute || selInst))
          .sort(compareExportRows),
        triggerCSV: _csv, triggerPDF: _pdf, triggerJSON: _json,
      });
    }

    // By class — all teachers in that class
    if (tab==="class" && selP2) {
      const cls = instClasses.find(c=>c.raw===selP2);
      if (cls) {
        actions.push({
          label: "All teachers",
          sub: `${cls.display} · ${cls.teachers.length} teacher${cls.teachers.length!==1?"s":""}`,
          icon: "🏫",
          filename: `${cls.display}_All_Teachers`,
          title: `${cls.display} — All Teachers`,
          meta: `${selInst} · ${cls.subjects.join(", ")||"—"}`,
          getRows: (sk, ek) => (cls.teachers||[])
            .flatMap(t => rowsForTeacherClass(t.uid, t.name, t.classId, cls.display, t.subject||cls.subjects[0]||"", sk, ek, selInst))
            .sort(compareExportRows),
          triggerCSV: _csv, triggerPDF: _pdf, triggerJSON: _json,
        });
      }
    }

    if (selInst) {
      actions.push({
        label: "Entire institute",
        sub: `${selInst} · all classes and sections`,
        icon: "🏫",
        filename: `${selInst}_All_Classes_All_Sections`,
        title: `${selInst} — All Classes & Sections`,
        meta: `${selInst} · all teachers`,
        getRows: (sk, ek) => rowsForInstitute(sk, ek),
        triggerCSV: _csv, triggerPDF: _pdf, triggerJSON: _json,
      });
    }

    return actions;
  })();

  const openTeacherSelection = (uid) => {
    setMobileSurface("workspace");
    setSelP2(uid);
    setSelP3(null);
    setFullView(null);
    setP3Search("");
    if(isMobile){
      setFullView({ kind:"teacher", teacherUid:uid, teacherName:selectedTeacherName(uid), source:"mobile-list" });
      ensureFullData(uid);
      setMobileStep(3);
      return;
    }
    setMobileStep(2);
    ensureFullData(uid);
  };

  const openClassSelection = (raw) => {
    setMobileSurface("workspace");
    setSelP2(raw);
    setSelP3(null);
    setFullView(null);
    setP3Search("");
    if(isMobile){
      setFullView({ kind:"class", classRaw:raw, source:"mobile-list" });
      warmTeacherUids(instClasses.find(c=>c.raw===raw)?.teachers?.map(t=>t.uid) || []);
      setMobileStep(3);
      return;
    }
    setMobileStep(2);
    warmTeacherUids(instClasses.find(c=>c.raw===raw)?.teachers?.map(t=>t.uid) || []);
  };

  const openScopedFullView = () => {
    if(!selP2) return;
    setMobileSurface("workspace");
    setP3Search("");
    if(tab==="teacher"){
      setFullView({ kind:"teacher", teacherUid:selP2, teacherName:selectedTeacherName(selP2), source:"step2" });
      ensureFullData(selP2);
    } else {
      setFullView({ kind:"class", classRaw:selP2, source:"step2" });
      warmTeacherUids(instClasses.find(c=>c.raw===selP2)?.teachers?.map(t=>t.uid) || []);
    }
    setSelP3(null);
    setMobileStep(3);
  };

  const openAggregateView = (kind) => {
    setMobileSurface("workspace");
    setSelP2(kind==="class" ? ALL_CLASSES_KEY : ALL_TEACHERS_KEY);
    setSelP3(null);
    setFullView(null);
    setMobileStep(3);
    if(selInst) warmInstitute(selInst);
  };

  const renderSearchInput = (value, onChange, placeholder, compact = false) => (
    <div style={{position:"relative",marginTop:compact?0:10}}>
      <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:12,color:G.textL,pointerEvents:"none"}}>⌕</span>
      <input
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:"100%",
          height:compact?36:38,
          borderRadius:10,
          border:`1px solid ${G.border}`,
          background:G.bg,
          padding:"0 12px 0 32px",
          fontSize:13,
          color:G.text,
          outline:"none",
          fontFamily:G.sans,
        }}
      />
    </div>
  );

  const renderWarmupBanner = (mobile = false) => {
    if(!instWarmupActive) return null;
    return (
      <div style={{
        background:mobile ? "#EEF2FF" : G.bg,
        border:`1px solid ${mobile ? "#C7D2FE" : G.border}`,
        borderRadius:10,
        padding:mobile ? "10px 12px" : "9px 11px",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:10,
        flexWrap:"wrap",
        marginTop:mobile ? 0 : 10,
      }}>
        <div style={{fontSize:13,color:G.textS,fontFamily:G.sans,fontWeight:600}}>
          Loading institute data progressively for a smoother phone experience.
        </div>
        <span style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:999,padding:"4px 9px",fontSize:12,color:G.blue,fontFamily:G.mono,fontWeight:700}}>
          {instWarmupLabel}
        </span>
      </div>
    );
  };

  const renderAggregateEntries = (mobile = false) => {
    if (aggregateLoading && aggregateEntries.length===0) {
      return (
        <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:mobile?"18px 16px":"20px 18px",textAlign:"center"}}>
          <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${G.blueL}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.display}}>Loading institute entries…</div>
          <div style={{fontSize:13,color:G.textL,fontFamily:G.sans,marginTop:4}}>
            Loaded {aggregateLoadedTeacherCount} of {instTeachers.length} teachers for {selInst}
          </div>
        </div>
      );
    }

    if (!aggregateLoading && aggregateEntries.length===0) {
      return (
        <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:mobile?"18px 16px":"20px 18px",textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.display}}>No entries for this period</div>
          <div style={{fontSize:13,color:G.textL,fontFamily:G.sans,marginTop:4}}>
            {aggregateTitle} is ready, but nothing was uploaded in {selInst} for the selected range.
          </div>
        </div>
      );
    }

    return (
      <>
        {aggregateLoading&&(
          <div style={{background:G.blueL,border:`1px solid ${G.border}`,borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:13,color:G.textS,fontFamily:G.sans}}>
            Loading remaining teachers… showing {aggregateLoadedTeacherCount} of {instTeachers.length} so far.
          </div>
        )}
        {aggregateGroups.map(group=>(
          <div key={group.className} style={{background:G.surface,borderRadius:mobile?14:12,border:`1px solid ${G.border}`,marginBottom:mobile?12:16,overflow:"hidden",boxShadow:G.shadowSm}}>
            <div style={{padding:mobile?"11px 12px":"14px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:mobile?16:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.className}</div>
                  <div style={{fontSize:mobile?12.5:13,color:G.textM,marginTop:3,lineHeight:1.45}}>
                    {group.subjectList.length>0 ? `Subjects: ${group.subjectList.join(", ")}` : "Subjects: —"}
                  </div>
                  <div style={{fontSize:mobile?12.5:13,color:G.textL,marginTop:2,lineHeight:1.45}}>
                    Teachers: {group.teacherList.join(", ") || "—"}
                  </div>
                </div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                  {group.entries.length} {group.entries.length===1?"entry":"entries"}
                </span>
              </div>
            </div>
            <div style={{padding:mobile?"8px 8px 1px":"10px 12px 4px"}}>
              {group.entries.map((entry, idx)=>{
                const tag = TAG_STYLES[entry.tag] || TAG_STYLES.note;
                const status = STATUS_STYLES[entry.status] || null;
                const title = entry.title || "Untitled entry";
                return(
                  <div key={entry.id || `${entry.teacherUid}_${entry.classId}_${entry.dateKey}_${idx}`} style={{border:`1px solid ${G.border}`,borderRadius:mobile?11:10,marginBottom:mobile?8:10,overflow:"hidden"}}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:mobile?"10px 11px":"11px 13px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>
                            <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"3px 9px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:600}}>
                              {formatExportPdfDate(entry.dateKey)}
                            </span>
                            {(entry.timeStart || entry.timeEnd)&&(
                              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"3px 9px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:600}}>
                                {formatExportPdfTime(entry.timeStart, entry.timeEnd)}
                              </span>
                            )}
                            {status&&<span style={{background:status.bg,color:status.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontWeight:700}}>{status.label}</span>}
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{tag.label}</span>
                          </div>
                          <div style={{fontSize:mobile?14:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{title}</div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:3}}>
                            {entry.teacherName} · {entry.subject || "No subject"}
                          </div>
                          {entry.body&&<div style={{fontSize:mobile?13:14,color:G.textM,lineHeight:1.55,marginTop:6,whiteSpace:"pre-wrap"}}>{entry.body}</div>}
                        </div>
                        <button onClick={()=>handleDeleteEntry(entry.teacherUid, entry.classId, entry.dateKey, entry.id, entry.title)}
                          style={{width:28,height:28,borderRadius:8,background:G.redL,border:"none",cursor:"pointer",fontSize:13,color:G.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                          title="Delete entry">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </>
    );
  };

  const renderFullViewEntries = (mobile = false) => {
    if (fullViewLoading && fullViewEntries.length===0) {
      return (
        <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:mobile?"18px 16px":"20px 18px",textAlign:"center"}}>
          <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${G.blueL}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.display}}>Loading full view…</div>
          <div style={{fontSize:13,color:G.textL,fontFamily:G.sans,marginTop:4}}>
            Pulling the latest entries for {fullView?.kind==="teacher" ? selectedTeacherName(fullView.teacherUid) : fullViewTitle.replace(" — All Teachers","")}
          </div>
        </div>
      );
    }

    if (!fullViewLoading && fullViewEntries.length===0) {
      return (
        <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:mobile?"18px 16px":"20px 18px",textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.display}}>No entries for this period</div>
          <div style={{fontSize:13,color:G.textL,fontFamily:G.sans,marginTop:4}}>
            {fullViewTitle} is ready, but nothing was uploaded in the selected range.
          </div>
        </div>
      );
    }

    return (
      <>
        {fullViewGroups.map(group=>(
          <div key={group.className} style={{background:G.surface,borderRadius:mobile?14:12,border:`1px solid ${G.border}`,marginBottom:mobile?12:16,overflow:"hidden",boxShadow:G.shadowSm}}>
            <div style={{padding:mobile?"11px 12px":"14px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:mobile?16:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.className}</div>
                  <div style={{fontSize:mobile?12.5:13,color:G.textM,marginTop:3,lineHeight:1.45}}>
                    {group.subjectList.length?`Subjects: ${group.subjectList.join(", ")}`:"Subjects: —"}
                  </div>
                  <div style={{fontSize:mobile?12.5:13,color:G.textL,marginTop:2,lineHeight:1.45}}>
                    Teachers: {group.teacherList.join(", ") || "—"}
                  </div>
                </div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                  {group.entries.length} {group.entries.length===1?"entry":"entries"}
                </span>
              </div>
            </div>
            <div style={{padding:mobile?"8px 8px 1px":"10px 12px 4px"}}>
              {group.entries.map((entry, idx)=>{
                const tag = TAG_STYLES[entry.tag] || TAG_STYLES.note;
                const status = STATUS_STYLES[entry.status] || null;
                return(
                  <div key={entry.id || `${entry.teacherUid}_${entry.classId}_${entry.dateKey}_${idx}`} style={{border:`1px solid ${G.border}`,borderRadius:mobile?11:10,marginBottom:mobile?8:10,overflow:"hidden"}}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:mobile?"10px 11px":"11px 13px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>
                            <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"3px 9px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:600}}>
                              {formatExportPdfDate(entry.dateKey)}
                            </span>
                            {(entry.timeStart || entry.timeEnd)&&(
                              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"3px 9px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:600}}>
                                {formatExportPdfTime(entry.timeStart, entry.timeEnd)}
                              </span>
                            )}
                            {status&&<span style={{background:status.bg,color:status.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontWeight:700}}>{status.label}</span>}
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{tag.label}</span>
                          </div>
                          <div style={{fontSize:mobile?14:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{entry.title || "Untitled entry"}</div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:3}}>
                            {entry.teacherName} · {entry.subject || "No subject"}
                          </div>
                          {entry.body&&<div style={{fontSize:mobile?13:14,color:G.textM,lineHeight:1.55,marginTop:6,whiteSpace:"pre-wrap"}}>{entry.body}</div>}
                        </div>
                        <button onClick={()=>handleDeleteEntry(entry.teacherUid, entry.classId, entry.dateKey, entry.id, entry.title)}
                          style={{width:28,height:28,borderRadius:8,background:G.redL,border:"none",cursor:"pointer",fontSize:13,color:G.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                          title="Delete entry">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </>
    );
  };

  const renderSelectedTimelineEntries = (mobile = false) => {
    if(!selP3) return null;

    const summary = selectedTimelineSummary || {
      entryCount: 0,
      totalMinutes: 0,
      timedEntries: 0,
      untimedEntries: 0,
      activeDays: 0,
      lastAgo: null,
      statusBreakdown: [],
    };
    const instituteText = selectedClassMeta?.institute || selP3.institute || selInst || "";
    const statCard = (label, value, accent = G.blue) => (
      <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:mobile?"10px 12px":"11px 13px"}}>
        <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.8}}>{label}</div>
        <div style={{fontSize:mobile?18:20,fontWeight:800,color:accent,fontFamily:G.display,marginTop:4,lineHeight:1.1}}>{value}</div>
      </div>
    );

    return (
      <>
      <div style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:mobile?14:16,padding:mobile?"10px 11px 10px":"16px 18px",boxShadow:reduceEffects?"none":G.shadowSm,marginBottom:mobile?10:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>Selection summary</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"5px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>
                  {selP3.teacherName}
                </span>
                <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                  {selP3.className}
                </span>
                {selectedSubjectLabel&&(
                  <span style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:999,padding:"5px 10px",fontSize:12,color:G.blue,fontFamily:G.mono,fontWeight:700}}>
                    {selectedSubjectLabel}
                  </span>
                )}
                {instituteText&&(
                  <span style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textM,fontFamily:G.mono,fontWeight:700}}>
                    {instituteText}
                  </span>
                )}
              </div>
            </div>
            <span style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
              {overviewPeriodText}
            </span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:8,marginTop:10}}>
            {statCard("Entries", summary.entryCount)}
            {statCard("Taught time", summary.totalMinutes>0 ? formatDurationShort(summary.totalMinutes) : "—", summary.totalMinutes>0 ? "#1B8A4C" : G.textM)}
            {statCard("Active days", summary.activeDays || "—")}
            {statCard("Last update", summary.lastAgo || "No uploads", summary.lastAgo ? G.blue : G.textM)}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            {summary.statusBreakdown.length>0 ? summary.statusBreakdown.map(status=>(
              <span key={status.key} style={{background:status.bg,color:status.text,borderRadius:999,padding:"5px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>
                {status.count} {status.label.replace(/^[^\s]+\s/,"")}
              </span>
            )) : (
              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                No status updates in this period
              </span>
            )}
            {summary.untimedEntries>0&&(
              <span style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:999,padding:"5px 10px",fontSize:12,color:G.amber,fontFamily:G.mono,fontWeight:700}}>
                {summary.untimedEntries} untimed {summary.untimedEntries===1?"entry":"entries"}
              </span>
            )}
          </div>
        </div>

        {p4Entries!==null&&p4Entries.length===0&&(
          <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:mobile?"18px 16px":"20px 18px",textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.display}}>No entries for this period</div>
            <div style={{fontSize:13,color:G.textL,fontFamily:G.sans,marginTop:5}}>
              {selP3.teacherName} has not uploaded anything for {selP3.className} in {overviewPeriodText.toLowerCase()}.
            </div>
          </div>
        )}

        {p4Entries&&p4Entries.map(([dk,entries])=>{
          const dayMinutes = entries.reduce((sum,note)=>sum + entryDurationMinutes(note),0);
          return(
            <div key={dk} style={{background:G.surface,borderRadius:mobile?14:14,border:`1px solid ${G.border}`,marginBottom:mobile?10:16,overflow:"hidden",boxShadow:reduceEffects?"none":G.shadowSm}}>
              <div style={{padding:mobile?"9px 11px":"13px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.5}}>
                  {formatDateLabel(dk)}
                </div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 9px",fontWeight:700,fontFamily:G.mono}}>
                    {entries.length} {entries.length===1?"entry":"entries"}
                  </span>
                  <span style={{fontSize:12,background:G.surface,border:`1px solid ${G.border}`,color:G.textS,borderRadius:999,padding:"4px 9px",fontWeight:700,fontFamily:G.mono}}>
                    {dayMinutes>0 ? formatDurationShort(dayMinutes) : "Untimed"}
                  </span>
                </div>
              </div>
              <div style={{padding:mobile?"4px 7px":"6px 12px"}}>
                {entries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  const status=note.status&&STATUS_STYLES[note.status]?STATUS_STYLES[note.status]:null;
                  return(
                    <div key={note.id||i} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:mobile?11:12,margin:mobile?"5px 0":"8px 0",overflow:"hidden"}}>
                      <div style={{height:3,background:status?.dot || tag.bg}}/>
                      <div style={{padding:mobile?"9px 10px":"12px 14px",display:"grid",gridTemplateColumns:mobile?"1fr":"120px minmax(0,1fr) auto",gap:mobile?8:12,alignItems:"center"}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:G.display,fontSize:mobile?15:17,fontWeight:700,color:G.text,lineHeight:1}}>
                            {note.timeStart?fmt12(note.timeStart):"No time"}
                          </div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:4}}>
                            {note.timeEnd ? `→ ${fmt12(note.timeEnd)}` : "No end time"}
                          </div>
                        </div>
                        <div style={{minWidth:0}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>
                            {status&&<span style={{background:status.bg,color:status.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{status.label}</span>}
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{tag.label}</span>
                          </div>
                          <div style={{fontSize:mobile?14:15,fontWeight:700,color:G.text,fontFamily:G.display}}>
                            {note.title || "Untitled entry"}
                          </div>
                          {note.body&&(
                            <div style={{fontSize:13,color:G.textM,marginTop:4,lineHeight:1.55,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                              {note.body}
                            </div>
                          )}
                        </div>
                        <button onClick={()=>handleDeleteEntry(selP3.teacherUid,selP3.classId,dk,note.id,note.title)}
                          style={{width:30,height:30,borderRadius:9,background:G.redL,border:"1px solid #F5CACA",cursor:"pointer",fontSize:13,color:G.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                          title="Delete entry">
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const renderOverviewPanel = () => {
    const summaryCard = (label, value, accent = G.blue) => (
      <div key={label} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,padding:"12px 14px",boxShadow:reduceEffects?"none":G.shadowSm}}>
        <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1.1}}>{label}</div>
        <div style={{fontSize:24,fontWeight:800,color:accent,fontFamily:G.display,marginTop:4,lineHeight:1}}>{value}</div>
      </div>
    );

    if(!selInst){
      return (
        <DailyCentreSummary
          institutes={institutes}
          teachers={teachers}
          fullData={fullData}
          instituteStats={instituteStats}
          onSelectInstitute={onSelectInstitute}
        />
      );
    }

    if(!selP2){
      return (
        <div style={{display:"grid",gap:14}}>
          <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:20,padding:"18px 20px",boxShadow:G.shadowSm,display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",overflow:"hidden"}}>
            <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1.1}}>
              Institute overview
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"6px 11px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>
                {overviewPeriodText}
              </span>
              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 11px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                {selectedInstitutePeriodCount} logs
              </span>
              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"6px 11px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                {formatDurationShort(classSubjectSummary.totalMinutes)} taught
              </span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:12}}>
            {[
              summaryCard("Classes", instClasses.length),
              summaryCard("Teachers", instTeachers.length),
              summaryCard("Entries", selectedInstituteEntryCount),
              summaryCard(overviewPeriodText, selectedInstitutePeriodCount, "#1B8A4C"),
            ]}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(0,1.45fr) minmax(320px,0.95fr)",gap:14,alignItems:"start"}}>
            <div style={{background:"linear-gradient(180deg,#FFFFFF 0%,#F9FBFF 100%)",border:`1px solid ${G.border}`,borderRadius:20,padding:"18px",boxShadow:G.shadowSm,overflow:"hidden"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display}}>Class teaching time</div>
                  <div style={{fontSize:12,color:G.textL,marginTop:4,lineHeight:1.55}}>
                    Subject-wise split of logged teaching time in {overviewPeriodText.toLowerCase()}.
                  </div>
                </div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>
                  {overviewPeriodText}
                </span>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                  {classSubjectSummary.classCount} active {classSubjectSummary.classCount===1?"class":"classes"}
                </span>
                <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                  {formatDurationShort(classSubjectSummary.totalMinutes)} logged
                </span>
                {classSubjectSummary.untimedEntries>0&&(
                  <span style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:999,padding:"5px 10px",fontSize:12,color:G.amber,fontFamily:G.mono,fontWeight:700}}>
                    {classSubjectSummary.untimedEntries} untimed {classSubjectSummary.untimedEntries===1?"log":"logs"}
                  </span>
                )}
              </div>
              {aggregateLoadedTeacherCount < instTeachers.length&&(
                <div style={{fontSize:12,color:G.textL,marginTop:10,fontFamily:G.mono}}>
                  Loading {aggregateLoadedTeacherCount}/{instTeachers.length} teacher profiles for the latest time split.
                </div>
              )}
              {classSubjectTime.length===0 ? (
                <div style={{fontSize:14,color:G.textL,marginTop:14}}>
                  {aggregateLoadedTeacherCount < instTeachers.length
                    ? "Loading logged time for this institute…"
                    : `No class logs found for ${overviewPeriodText.toLowerCase()}.`}
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fit,minmax(270px,1fr))",gap:12,marginTop:14}}>
                  {classSubjectTime.map(item=>(
                    <div key={item.raw} style={{background:"linear-gradient(180deg,#FFFFFF 0%,#F8FBFF 100%)",border:`1px solid ${G.border}`,borderRadius:18,padding:"15px 15px 14px",boxShadow:reduceEffects?"none":"0 8px 22px rgba(15,23,42,0.06)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{item.display}</div>
                          <div style={{fontSize:12,color:G.textL,marginTop:4,lineHeight:1.55}}>
                            {item.entryCount} {item.entryCount===1?"log":"logs"} · {item.activeTeacherCount}/{item.teacherCount} teachers active
                          </div>
                        </div>
                        <span style={{background:item.totalMinutes>0?"#DCFCE7":"#FFF7ED",color:item.totalMinutes>0?"#166534":G.amber,borderRadius:999,padding:"5px 11px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.55)"}}>
                          {item.totalMinutes>0 ? formatDurationShort(item.totalMinutes) : "Untimed only"}
                        </span>
                      </div>
                      <div style={{display:"flex",gap:16,alignItems:"stretch",marginTop:16,flexWrap:"wrap"}}>
                        <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#FDFEFF 0%,#F4F8FD 100%)",border:`1px solid ${G.border}`,borderRadius:18,padding:"12px 10px",minWidth:160}}>
                          <SubjectSplitDonut segments={item.subjects} totalMinutes={item.totalMinutes} />
                        </div>
                        <div style={{flex:1,minWidth:180,background:"linear-gradient(180deg,#FFFFFF 0%,#F9FBFD 100%)",border:`1px solid ${G.border}`,borderRadius:18,padding:"14px 14px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                            <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>
                              Subject split
                            </div>
                            {item.subjects.length>0&&(
                              <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"4px 9px",fontSize:11,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                                {item.subjects.length} tracked
                              </span>
                            )}
                          </div>
                          <div style={{display:"grid",gap:10}}>
                            {item.subjects.length>0 ? item.subjects.map(seg=>{
                              const pct = item.totalMinutes>0 ? Math.round((seg.minutes / item.totalMinutes) * 100) : 0;
                              return(
                                <div key={`${item.raw}_${seg.subject}_legend`} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:14,padding:"10px 11px"}}>
                                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                                      <span style={{width:10,height:10,borderRadius:"50%",background:`linear-gradient(135deg, ${mixHex(seg.color, "#FFFFFF", 0.18)} 0%, ${mixHex(seg.color, "#0F172A", 0.08)} 100%)`,boxShadow:`0 0 0 3px ${alphaHex(seg.color, 0.12)}`,flexShrink:0}}/>
                                      <span style={{fontSize:13,color:G.text,fontWeight:700,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{seg.subject}</span>
                                    </div>
                                    <span style={{fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>{formatDurationShort(seg.minutes)}</span>
                                  </div>
                                  <div style={{marginTop:8,height:8,borderRadius:999,background:alphaHex(seg.color, 0.14),overflow:"hidden"}}>
                                    <div style={{width:`${Math.max(pct, seg.minutes>0 ? 6 : 0)}%`,height:"100%",borderRadius:999,background:`linear-gradient(90deg, ${mixHex(seg.color, "#FFFFFF", 0.18)} 0%, ${mixHex(seg.color, "#0F172A", 0.05)} 100%)`}}/>
                                  </div>
                                  <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:7,fontSize:11,color:G.textL,fontFamily:G.mono}}>
                                    <span>{pct}% of timed logs</span>
                                    <span>{seg.minutes>0 ? `${seg.minutes} min` : "0 min"}</span>
                                  </div>
                                </div>
                              );
                            }) : (
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:`1px solid ${G.border}`,borderRadius:999,padding:"7px 10px",fontSize:12,color:G.textS,fontWeight:600}}>
                                No timed subject split yet
                              </span>
                            )}
                            {item.untimedEntries>0&&(
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:999,padding:"7px 10px",fontSize:12,color:G.amber,fontWeight:600}}>
                                {item.untimedEntries} untimed {item.untimedEntries===1?"log":"logs"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:"grid",gap:14}}>
              <div style={{background:"linear-gradient(180deg,#FFFFFF 0%,#F9FBFF 100%)",border:`1px solid ${G.border}`,borderRadius:20,padding:"18px",boxShadow:G.shadowSm,overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display}}>Teacher entry status</div>
                    <div style={{fontSize:12,color:G.textL,marginTop:4,lineHeight:1.55}}>
                      Who has updated class logs today, plus week and month entry counts.
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadTeacherStatusImage}
                    disabled={statusImageBusy || !selInst}
                    style={{
                      display:"inline-flex",
                      alignItems:"center",
                      gap:8,
                      background:(statusImageBusy || !selInst) ? "#D5DDEB" : G.navy,
                      color:"#fff",
                      border:"none",
                      borderRadius:10,
                      padding:"9px 13px",
                      fontSize:13,
                      fontWeight:700,
                      cursor:(statusImageBusy || !selInst) ? "not-allowed" : "pointer",
                      fontFamily:G.sans,
                      whiteSpace:"nowrap",
                      opacity:statusImageBusy ? 0.85 : 1,
                    }}>
                    <span style={{fontSize:14}}>⬇</span>
                    <span>{statusImageBusy ? "Preparing image…" : "Download image"}</span>
                  </button>
                </div>
                <div style={{fontSize:11,color:G.textL,marginTop:8,fontFamily:G.mono}}>
                  Creates a shareable PNG for your teachers&apos; group.
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                  <span style={{background:"#DCFCE7",border:"1px solid #BBF7D0",borderRadius:999,padding:"5px 10px",fontSize:12,color:"#166534",fontFamily:G.mono,fontWeight:700}}>
                    {teacherEntrySummary.updatedToday}/{instTeachers.length} updated today
                  </span>
                  <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                    {teacherEntrySummary.weekEntries} this week
                  </span>
                  <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
                    {teacherEntrySummary.monthEntries} this month
                  </span>
                </div>
                {teacherEntrySummary.loadedCount < instTeachers.length&&(
                  <div style={{fontSize:12,color:G.textL,marginTop:10,fontFamily:G.mono}}>
                    Loading {teacherEntrySummary.loadedCount}/{instTeachers.length} teachers for status details.
                  </div>
                )}
                {teacherEntryStatus.length===0 ? <div style={{fontSize:14,color:G.textL,marginTop:14}}>No teacher activity yet.</div> : teacherEntryStatus.map(item=>(
                  <div key={item.uid} style={{padding:"12px 0",borderTop:`1px solid ${G.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:G.text}}>{item.name}</div>
                        <div style={{fontSize:12,color:G.textL,marginTop:3}}>
                          {item.loaded
                            ? `${item.classCount} ${item.classCount===1?"class":"classes"} in this institute`
                            : "Loading classes in this institute…"}
                        </div>
                      </div>
                      <span style={{background:item.loaded && item.todayUpdated ? "#DCFCE7" : item.loaded ? G.bg : "#EFF6FF",color:item.loaded && item.todayUpdated ? "#166534" : item.loaded ? G.textS : G.blue,border:`1px solid ${item.loaded && item.todayUpdated ? "#BBF7D0" : item.loaded ? G.border : "#BFDBFE"}`,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                        {item.loaded ? (item.todayUpdated ? "Updated today" : "No update today") : "Loading"}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:G.textL,marginTop:7,fontFamily:G.mono}}>
                      {item.loaded
                        ? `Today ${item.todayEntries} · Week ${item.weekEntries} · Month ${item.monthEntries}`
                        : "Status details will appear once this teacher profile finishes loading."}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:"linear-gradient(180deg,#FFFFFF 0%,#F9FBFF 100%)",border:`1px solid ${G.border}`,borderRadius:20,padding:"18px",boxShadow:G.shadowSm,overflow:"hidden"}}>
                <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:10}}>Recent log activity</div>
                {overviewRecentEntries.length===0 ? <div style={{fontSize:14,color:G.textL}}>No recent entries inside this institute yet.</div> : overviewRecentEntries.map(item=>(
                  <div key={item.id} style={{padding:"10px 0",borderTop:`1px solid ${G.border}`}}>
                    <div style={{fontSize:13,fontWeight:700,color:G.text}}>{item.title}</div>
                    <div style={{fontSize:12,color:G.textL,marginTop:3}}>{item.className} · {item.teacherName}</div>
                    <div style={{fontSize:12,color:G.textL,marginTop:2,fontFamily:G.mono}}>{formatExportPdfDate(item.dateKey)}{item.timeStart?` · ${fmt12(item.timeStart)}`:""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const selectionStats = tab==="teacher"
      ? { label1:"Classes", value1:p3Items.length, label2:"Entries", value2:p3Items.reduce((sum,item)=>sum + (item.entryCount||0),0) }
      : (()=>{ const cls = instClasses.find(c=>c.raw===selP2); return { label1:"Teachers", value1:cls?.teachers?.length || 0, label2:"Entries", value2:p3Items.reduce((sum,item)=>sum + (item.entryCount||0),0) }; })();

    return (
      <div style={{display:"grid",gap:14}}>
        <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:16,padding:"18px",boxShadow:G.shadowSm}}>
          <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display}}>{p2Label(selP2)}</div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:6,maxWidth:680}}>
            Use panel 3 to either open the full grouped view for this {tab==="teacher"?"teacher":"class"} or pick one specific {tab==="teacher"?"class":"teacher"} from the list below it.
          </div>
          <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
            <button onClick={openScopedFullView} style={{background:G.navy,color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>View Full</button>
            <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"8px 12px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>{selectionStats.value1} {selectionStats.label1.toLowerCase()}</span>
            <span style={{background:G.bg,color:G.textS,border:`1px solid ${G.border}`,borderRadius:999,padding:"8px 12px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>{selectionStats.value2} entries</span>
          </div>
        </div>
      </div>
    );
  };


  // Draggable panel resize handle
  const CollapseButton = ({collapsed, direction="left", onClick, title, tone}) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width:30,
        height:30,
        borderRadius:11,
        border:`1px solid ${tone?.edge || G.border}`,
        background:collapsed && tone ? tone.tab : G.surface,
        color:collapsed && tone ? tone.accent : G.textM,
        cursor:"pointer",
        fontSize:16,
        fontWeight:800,
        flexShrink:0,
        boxShadow:collapsed && tone ? "0 6px 14px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.38)" : "none",
        WebkitTapHighlightColor:"transparent",
      }}>
      {collapsed ? (direction==="right" ? "›" : "‹") : (direction==="right" ? "‹" : "›")}
    </button>
  );

  const CollapsedPanelRail = ({ step, label, onExpand, badge, direction="right", themeKey="p1" }) => {
    const tone = PANEL_RAIL_THEMES[themeKey] || PANEL_RAIL_THEMES.p1;
    const touchRail = coarsePointer || isWeakDevice;
    const stepNumber = String(step || "").match(/\d+/)?.[0] || step;
    const folderIcon = label === "Teachers"
      ? "👥"
      : label === "Classes"
        ? "📚"
        : label === "Institutes"
        ? "🏫"
        : "🗂";
    return (
      <div style={{display:"flex",justifyContent:"center",padding:touchRail?"8px 3px 12px":"8px 3px 12px",flex:1,minHeight:0}}>
        <div style={{
          width:"100%",
          height:"100%",
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          padding:touchRail?"10px 4px 12px":"10px 4px 12px",
          borderRadius:24,
          background:`linear-gradient(180deg, rgba(255,255,255,0.94) 0%, ${tone.bg} 100%)`,
          border:`1px solid ${tone.edge}`,
          boxShadow:"inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 22px rgba(15,23,42,0.06)",
          position:"relative",
          overflow:"hidden",
        }}>
          <div style={{position:"absolute",top:10,bottom:10,left:6,width:2,borderRadius:999,background:`linear-gradient(180deg, ${tone.accent}22 0%, ${tone.accent}80 45%, ${tone.accent}22 100%)`}}/>
          <CollapseButton collapsed direction={direction} tone={tone} onClick={onExpand} title={`Expand ${label}`} />
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:touchRail?12:10,marginTop:10,flex:1,minHeight:0}}>
            <span style={{
              width:touchRail?28:26,
              height:touchRail?28:26,
              borderRadius:10,
              background:"rgba(255,255,255,0.86)",
              border:`1px solid ${tone.edge}`,
              color:tone.accent,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              fontSize:12,
              fontWeight:900,
              fontFamily:G.mono,
              boxShadow:"inset 0 1px 0 rgba(255,255,255,0.65)",
              flexShrink:0,
            }}>
              {stepNumber}
            </span>
            <div style={{width:touchRail?36:34,height:touchRail?36:34,borderRadius:13,background:"rgba(255,255,255,0.92)",border:`1px solid ${tone.edge}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.55)",flexShrink:0}}>
              {folderIcon}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,flex:1,minHeight:0}}>
              <div style={{
                writingMode:"vertical-rl",
                transform:"rotate(180deg)",
                color:tone.text,
                fontFamily:G.display,
                fontSize:touchRail?13.5:13,
                fontWeight:800,
                letterSpacing:0.35,
                lineHeight:1,
                textTransform:"uppercase",
                textShadow:"0 1px 0 rgba(255,255,255,0.72)",
                whiteSpace:"nowrap",
                flex:1,
              }}>
                {label}
              </div>
              <span style={{
                fontSize:9,
                letterSpacing:1.2,
                color:tone.accent,
                fontFamily:G.mono,
                fontWeight:800,
                textTransform:"uppercase",
                transform:"rotate(180deg)",
                writingMode:"vertical-rl",
                opacity:0.8,
              }}>
                {`Step ${stepNumber}`}
              </span>
            </div>
          </div>
          {badge!==undefined && (
            <span style={{
              minWidth:touchRail?34:32,
              minHeight:touchRail?28:26,
              background:"rgba(255,255,255,0.92)",
              color:tone.accent,
              border:`1px solid ${tone.edge}`,
              borderRadius:999,
              padding:"5px 8px",
              fontSize:11,
              fontFamily:G.mono,
              fontWeight:800,
              boxShadow:"inset 0 1px 0 rgba(255,255,255,0.55)",
              textAlign:"center",
              flexShrink:0,
              marginTop:10,
            }}>
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  };

  const getCollapsedPanelShellStyle = React.useCallback((themeKey) => {
    const tone = PANEL_RAIL_THEMES[themeKey] || PANEL_RAIL_THEMES.p1;
    return {
      background:`linear-gradient(180deg, #FFFFFF 0%, ${tone.bg} 100%)`,
      borderRight:`1px solid ${tone.edge}`,
      padding:coarsePointer ? "4px 2px 8px" : "4px 2px 8px",
      boxShadow:"inset -1px 0 0 rgba(255,255,255,0.5)",
    };
  }, [coarsePointer]);

  const PanelDivider = ({onDrag, onToggleCollapse, onDragStart, onDragEnd}) => {
    const ref = React.useRef(null);
    const drag = React.useRef(false);
    const startX = React.useRef(0);
    const pointerIdRef = React.useRef(null);
    const touchFriendly = coarsePointer || isWeakDevice;
    const hitWidth = touchFriendly ? 28 : 18;
    const railWidth = touchFriendly ? 14 : 10;
    const railHeight = touchFriendly ? 64 : 52;
    const barHeight = touchFriendly ? 54 : 46;
    const handleHeight = touchFriendly ? 32 : 26;
    const cleanupRef = React.useRef(() => {});
    const beginDrag = clientX => {
      if(drag.current) return;
      drag.current = true;
      startX.current = clientX;
      onDragStart?.();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      if(ref.current) ref.current.style.background = G.blueL;
    };
    const continueDrag = clientX => {
      if(!drag.current) return;
      onDrag(clientX - startX.current);
      startX.current = clientX;
    };
    const endDrag = () => {
      drag.current = false;
      pointerIdRef.current = null;
      onDragEnd?.();
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if(ref.current) ref.current.style.background = "transparent";
      cleanupRef.current();
      cleanupRef.current = () => {};
    };
    return(
      <div ref={ref}
        style={{width:hitWidth,flexShrink:0,cursor:"col-resize",background:"transparent",position:"relative",zIndex:10,transition:"background 0.15s",touchAction:"none",display:"flex",alignItems:"center",justifyContent:"center"}}
        onMouseEnter={e=>e.currentTarget.style.background=G.blueL}
        onMouseLeave={e=>{if(!drag.current)e.currentTarget.style.background="transparent";}}
        onDoubleClick={() => onToggleCollapse?.()}
        onPointerDown={e=>{
          beginDrag(e.clientX);
          pointerIdRef.current = e.pointerId;
          ref.current?.setPointerCapture?.(e.pointerId);
          e.preventDefault();
          const move = ev=>{
            continueDrag(ev.clientX);
          };
          const up = ()=>{
            if(pointerIdRef.current!==null){
              ref.current?.releasePointerCapture?.(pointerIdRef.current);
            }
            endDrag();
          };
          cleanupRef.current = () => {
            window.removeEventListener("pointermove",move);
            window.removeEventListener("pointerup",up);
            window.removeEventListener("pointercancel",up);
          };
          window.addEventListener("pointermove",move);
          window.addEventListener("pointerup",up);
          window.addEventListener("pointercancel",up);
        }}
        onTouchStart={e=>{
          if(window.PointerEvent || !e.touches?.length) return;
          beginDrag(e.touches[0].clientX);
          e.preventDefault();
          const move = ev=>{
            if(!ev.touches?.length) return;
            continueDrag(ev.touches[0].clientX);
            ev.preventDefault();
          };
          const up = () => endDrag();
          cleanupRef.current = () => {
            window.removeEventListener("touchmove",move);
            window.removeEventListener("touchend",up);
            window.removeEventListener("touchcancel",up);
          };
          window.addEventListener("touchmove",move,{ passive:false });
          window.addEventListener("touchend",up);
          window.addEventListener("touchcancel",up);
        }}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:2,height:barHeight,borderRadius:2,background:G.borderM,opacity:0.6}}/>
        <div style={{position:"relative",width:railWidth,height:railHeight,borderRadius:999,background:"rgba(255,255,255,0.82)",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:touchFriendly?G.shadowSm:"none"}}>
          <div style={{width:4,height:handleHeight,borderRadius:999,background:G.borderM}}/>
        </div>
      </div>
    );
  };

  if(loading) return(
    <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.sans}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${G.border}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:15,color:G.textM,fontFamily:G.mono}}>Loading data…</div>
      </div>
    </div>
  );

  // ── ADMIN RECYCLE BIN MODAL ────────────────────────────────────────────────
  const AdminBinModal = () => {
    const byClass = adminBin.filter(x=>x.type==="class");
    const byInst  = adminBin.filter(x=>x.type==="institute");
    const bySection = adminBin.filter(x=>x.type==="section");
    const daysLeft = ts => Math.max(0, 30-Math.floor((Date.now()-ts)/(1000*60*60*24)));
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
        <div style={{background:G.surface,borderRadius:20,width:"100%",maxWidth:560,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
          {/* header */}
          <div style={{padding:"18px 22px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display}}>🗑 Admin Recycle Bin</div>
              <div style={{fontSize:13,color:G.textM,marginTop:2}}>Items deleted by admins. Restore within 30 days.</div>
            </div>
            <button onClick={()=>setBinView(false)} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:14,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>Close</button>
          </div>
          <div style={{overflowY:"auto",padding:"16px 22px 24px",flex:1}}>
            {adminBin.length===0&&(
              <div style={{textAlign:"center",padding:"48px 20px"}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display,marginBottom:6}}>Bin is empty</div>
                <div style={{fontSize:14,color:G.textM}}>Deleted classes, sections, and institutes will appear here.</div>
              </div>
            )}

            {/* Classes section */}
            {byClass.length>0&&(
              <div style={{marginBottom:24}}>
                <div style={{fontSize:13,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${G.border}`}}>
                  Deleted Classes ({byClass.length})
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {byClass.map((item,i)=>{
                    const dl=daysLeft(item.deletedAt);
                    const binIdx=adminBin.findIndex(x=>x.type==="class"&&x.teacherUid===item.teacherUid&&x.classId===item.classId&&x.deletedAt===item.deletedAt);
                    return(
                      <div key={i} style={{background:G.bg,borderRadius:12,padding:"13px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{fontSize:22,flexShrink:0}}>📚</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{item.name}</div>
                          <div style={{fontSize:13,color:G.textM,marginTop:2}}>
                            Teacher: <strong>{item.teacherName}</strong> · {item.institute||"No institute"}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.mono}}>⏳ {dl}d left</span>
                            <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>Deleted {new Date(item.deletedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
                          </div>
                        </div>
                        <button
                          onClick={()=>adminConfirmDialog(`Restore class "${item.name}" for ${item.teacherName}? This will re-add the class to their account.`,"Restore",async()=>{
                            try {
                              const restored = await restoreClassFromTeacherTrash(item.teacherUid, item.classId, {
                                restoredByName: user.displayName || user.email || "Admin",
                              });
                              if (!restored) {
                                throw new Error("The class snapshot is no longer available in trash.");
                              }
                              const fresh = await getTeacherFullData(item.teacherUid);
                              if (fresh) setFullData(prev => ({ ...prev, [item.teacherUid]: fresh }));
                              if (binIdx >= 0) persistAdminBin(b=>b.filter((_,j)=>j!==binIdx));
                              showAdminToast(`Restored class "${item.name}".`);
                            } catch (e) {
                              showAdminToast("Failed to restore class: " + e.message);
                            }
                          })}
                          style={{background:G.blueL,border:"1px solid #BFDBFE",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>
                          ↩ Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sections section */}
            {bySection.length>0&&(
              <div style={{marginBottom:24}}>
                <div style={{fontSize:13,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${G.border}`}}>
                  Deleted Sections ({bySection.length})
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {bySection.map((item,i)=>{
                    const dl=daysLeft(item.deletedAt);
                    const binIdx=adminBin.findIndex(x=>x.type==="section"&&x.name===item.name&&x.institute===item.institute&&x.deletedAt===item.deletedAt);
                    return(
                      <div key={i} style={{background:G.bg,borderRadius:12,padding:"13px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{fontSize:22,flexShrink:0}}>🧩</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{item.name}</div>
                          <div style={{fontSize:13,color:G.textM,marginTop:2}}>
                            Institute: <strong>{item.institute || "No institute"}</strong>
                          </div>
                          <div style={{fontSize:12,color:G.textL,marginTop:5,lineHeight:1.55}}>
                            {item.classCount || 0} class record{item.classCount===1?"":"s"} removed across {item.teacherCount || 0} teacher{item.teacherCount===1?"":"s"}.
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.mono}}>⏳ {dl}d left</span>
                            <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>Deleted {new Date(item.deletedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
                          </div>
                        </div>
                        <button
                          onClick={()=>persistAdminBin(b=>b.filter((_,j)=>j!==binIdx))}
                          style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",color:G.textM,fontFamily:G.sans,fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>
                          Dismiss
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Institutes section */}
            {byInst.length>0&&(
              <div>
                <div style={{fontSize:13,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${G.border}`}}>
                  Deleted Institutes ({byInst.length})
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {byInst.map((item,i)=>{
                    const dl=daysLeft(item.deletedAt);
                    const binIdx=adminBin.findIndex(x=>x.type==="institute"&&x.name===item.name);
                    const isMigrated = item.action==="migrated";
                    const isDeletedCompletely = item.action==="deleted_completely";
                    const actionLabel = isMigrated
                      ? `Classes moved to "${item.migratedTo||"another institute"}"`
                      : isDeletedCompletely
                        ? "All data permanently deleted"
                        : "Institute removed from directory";
                    return(
                      <div key={i} style={{background:G.bg,borderRadius:12,padding:"13px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{fontSize:22,flexShrink:0}}>{isDeletedCompletely?"🗑️":"🏫"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{item.name}</div>
                          <div style={{fontSize:13,color:G.textM,marginTop:2}}>{actionLabel}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.mono}}>⏳ {dl}d left</span>
                            <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>Deleted {new Date(item.deletedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                          {/* Restore is only useful if institute was soft-deleted (not fully wiped) */}
                          {!isDeletedCompletely && (
                            <button
                              onClick={async()=>{
                                try{
                                  await saveGlobalInstitute(item.name);
                                  await removeFromDeletedInstitutesList(item.name);
                                  setGlobalInstList(prev=>{
                                    const lower=prev.map(i=>i.toLowerCase());
                                    if(lower.includes(item.name.trim().toLowerCase())) return prev;
                                    return [...prev,item.name.trim()];
                                  });
                                  setDeletedInstitutes(s=>{const n=new Set(s);n.delete(item.name.trim());return n;});
                                  persistAdminBin(b=>b.filter((_,j)=>j!==binIdx));
                                  showAdminToast(`Restored "${item.name}".`);
                                }catch(e){showAdminToast("Restore failed: "+e.message);}
                              }}
                              style={{background:G.blueL,border:"1px solid #BFDBFE",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:600,whiteSpace:"nowrap"}}>
                              ↩ Restore
                            </button>
                          )}
                          <button
                            onClick={async()=>{
                              if(!window.confirm(`Remove "${item.name}" from the recycle bin? ${isDeletedCompletely?"":"The institute data has already been deleted — this just clears this log entry."}`)) return;
                              try{
                                await removeFromDeletedInstitutesList(item.name);
                                persistAdminBin(b=>b.filter((_,j)=>j!==binIdx));
                                showAdminToast(`"${item.name}" removed from bin.`);
                              }catch(e){showAdminToast("Failed: "+e.message);}
                            }}
                            style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:600,whiteSpace:"nowrap"}}>
                            {isDeletedCompletely ? "✕ Clear log" : "🗑 Delete Forever"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const manageSearchInput = (value, onChange, placeholder) => (
    <div style={{position:"relative",marginBottom:16}}>
      <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:13,color:G.textL,pointerEvents:"none"}}>⌕</span>
      <input
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:"100%",
          height:42,
          borderRadius:11,
          border:`1px solid ${G.border}`,
          background:G.surface,
          padding:"0 14px 0 36px",
          fontSize:14,
          color:G.text,
          outline:"none",
          fontFamily:G.sans,
          boxShadow:reduceEffects ? "none" : G.shadowSm,
        }}
      />
    </div>
  );

  const instituteAccordionHeader = ({ icon, title, count, countLabel, isOpen, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width:"100%",
        background:G.surface,
        border:`1px solid ${isOpen ? G.borderM : G.border}`,
        borderRadius:14,
        padding:"14px 16px",
        cursor:"pointer",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:12,
        boxShadow:reduceEffects ? "none" : G.shadowSm,
        textAlign:"left",
      }}>
      <div style={{minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <AppIcon icon={icon} size={18} color={G.textM} style={{flexShrink:0}} />
          <span style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,minWidth:0}}>{title}</span>
        </div>
        <div style={{fontSize:13,color:G.textM,marginTop:5}}>
          {count} {countLabel}{count!==1?"s":""}
        </div>
      </div>
      <span style={{fontSize:18,color:G.textL,transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.18s",flexShrink:0}}>›</span>
    </button>
  );

  // ── INSTITUTE DELETE MODAL ────────────────────────────────────────────────
  const InstDeleteModal = () => {
    if (!instDeleteModal) return null;
    const { inst, step, migrateTarget, busy, error } = instDeleteModal;
    const update = (patch) => setInstDeleteModal(prev => prev ? { ...prev, ...patch } : prev);

    // Build the list of valid target institutes (exclude the one being deleted)
    const availableInstitutes = globalInstList.filter(i => !sameInstituteName(i, inst));

    const overlay = {
      position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:9990,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16,
    };
    const box = {
      background:G.surface,borderRadius:20,boxShadow:"0 24px 80px rgba(15,23,42,0.22)",
      padding:"28px 28px 24px",maxWidth:480,width:"100%",position:"relative",
    };
    const btn = (bg,color,border="transparent") => ({
      background:bg,color,border:`1.5px solid ${border}`,borderRadius:10,
      padding:"11px 20px",fontSize:14,fontWeight:700,cursor:busy?"not-allowed":"pointer",
      fontFamily:G.sans,opacity:busy?0.6:1,transition:"opacity 0.15s",
    });

    // ── Step 1: choose action ──────────────────────────────────────────────
    if (step === "choose") {
      return (
        <div style={overlay} onClick={e => { if(e.target===e.currentTarget && !busy) setInstDeleteModal(null); }}>
          <div style={box}>
            <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:6}}>
              Delete institute
            </div>
            <div style={{fontSize:14,color:G.textM,marginBottom:22,lineHeight:1.6}}>
              You are deleting <strong style={{color:G.text}}>"{inst}"</strong>. What should happen to the classes and entries belonging to this institute?
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:22}}>
              {/* Option A: migrate */}
              <button
                onClick={() => !busy && update({ step: "migrate" })}
                style={{
                  background:G.blueL,border:`2px solid #BFDBFE`,borderRadius:12,
                  padding:"14px 16px",cursor:"pointer",textAlign:"left",
                }}
              >
                <div style={{fontSize:14,fontWeight:700,color:G.blue,marginBottom:3}}>↗ Move classes to another institute</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.5}}>
                  All classes under <strong>"{inst}"</strong> will be migrated to a target institute you choose.
                  Sections with the same name will be merged. Teachers will be notified.
                </div>
              </button>
              {/* Option B: delete completely */}
              <button
                onClick={() => !busy && update({ step: "confirm_delete" })}
                style={{
                  background:"#FEF2F2",border:"2px solid #FECACA",borderRadius:12,
                  padding:"14px 16px",cursor:"pointer",textAlign:"left",
                }}
              >
                <div style={{fontSize:14,fontWeight:700,color:G.red,marginBottom:3}}>🗑 Delete everything permanently</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.5}}>
                  All classes, entries, and notes under <strong>"{inst}"</strong> will be permanently wiped from every teacher's account.
                  This cannot be undone. Teachers will be notified.
                </div>
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={() => !busy && setInstDeleteModal(null)} style={btn(G.surface,G.textM,G.border)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step 2a: pick migration target ────────────────────────────────────
    if (step === "migrate") {
      const [newInstName, setNewInstName] = React.useState("");
      const [creatingNew, setCreatingNew] = React.useState(false);

      const handleMigrateConfirm = async () => {
        const target = (migrateTarget || "").trim();
        if (!target) { update({ error: "Please select or create a target institute." }); return; }
        update({ busy: true, error: "" });
        try {
          const result = await deleteInstituteAndMigrate(inst, target, {
            adminName: user.displayName || user.email || "Admin",
            eventAt: Date.now(),
          });
          // Reflect changes locally
          setGlobalInstList(prev => {
            const withoutOld = prev.filter(i => !sameInstituteName(i, inst));
            const hasTarget = withoutOld.some(i => sameInstituteName(i, target));
            return hasTarget ? withoutOld : [...withoutOld, target];
          });
          setInstSectionsAll(prev => renameInstituteInsideLocalSectionsMap(prev, inst, target));
          setTeachers(prev => prev.map(t => ({
            ...t,
            institutes: replaceInstituteListLocal(t.institutes, inst, target),
          })));
          setFullData(prev => Object.fromEntries(
            Object.entries(prev).map(([uid, td]) => [uid, renameInstituteInsideLocalTeacherData(td, inst, target)])
          ));
          setDeletedInstitutes(s => { const n = new Set(s); n.add(inst.trim()); return n; });
          if (selInst === inst) { setSelInst(target); }
          persistAdminBin(b => [...b, { type:"institute", name:inst, deletedAt:Date.now(), deletedBy:user.uid, action:"migrated", migratedTo:target }]);
          setInstDeleteModal(null);
          showAdminToast(
            result.affectedTeacherCount
              ? `Deleted "${inst}" — moved classes to "${target}". ${result.affectedTeacherCount} teacher${result.affectedTeacherCount!==1?"s":""} notified.`
              : `Deleted "${inst}" and moved classes to "${target}".`
          );
        } catch(e) {
          update({ busy: false, error: e.message || "Something went wrong." });
        }
      };

      return (
        <div style={overlay} onClick={e => { if(e.target===e.currentTarget && !busy) setInstDeleteModal(null); }}>
          <div style={box}>
            <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:6}}>
              Move classes to another institute
            </div>
            <div style={{fontSize:14,color:G.textM,marginBottom:20,lineHeight:1.6}}>
              Choose where to move all classes from <strong style={{color:G.text}}>"{inst}"</strong>.
            </div>

            {/* Existing institutes */}
            {availableInstitutes.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,marginBottom:8}}>Existing institutes</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {availableInstitutes.map(i => (
                    <button
                      key={i}
                      onClick={() => !busy && update({ migrateTarget: i })}
                      style={{
                        border:`2px solid ${migrateTarget===i ? G.blue : G.border}`,
                        background: migrateTarget===i ? G.blueL : G.bg,
                        color: migrateTarget===i ? G.blue : G.text,
                        borderRadius:999,padding:"7px 16px",fontSize:13,fontWeight:600,
                        cursor:"pointer",transition:"all 0.15s",
                      }}
                    >
                      {migrateTarget===i ? "✓ " : ""}{i}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,marginBottom:8}}>Or create a new institute</div>
              <div style={{display:"flex",gap:8}}>
                <input
                  value={newInstName}
                  onChange={e => setNewInstName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key==="Enter" && newInstName.trim()) {
                      update({ migrateTarget: newInstName.trim() });
                      setNewInstName("");
                      setCreatingNew(false);
                    }
                  }}
                  placeholder="New institute name…"
                  style={{
                    flex:1,height:38,borderRadius:9,border:`1.5px solid ${G.border}`,
                    background:G.bg,padding:"0 12px",fontSize:14,color:G.text,
                    outline:"none",fontFamily:G.sans,
                  }}
                />
                <button
                  onClick={() => {
                    if (newInstName.trim()) {
                      update({ migrateTarget: newInstName.trim() });
                      setNewInstName("");
                    }
                  }}
                  style={btn(G.blue,"#fff")}
                >
                  Use
                </button>
              </div>
              {migrateTarget && !availableInstitutes.includes(migrateTarget) && (
                <div style={{fontSize:13,color:G.blue,marginTop:6,fontWeight:600}}>
                  ✦ Will create new institute: "{migrateTarget}"
                </div>
              )}
            </div>

            {error && <div style={{fontSize:13,color:G.red,marginBottom:14,fontWeight:600}}>{error}</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
              <button onClick={() => !busy && update({ step:"choose", error:"" })} style={btn(G.surface,G.textM,G.border)} disabled={busy}>
                ← Back
              </button>
              <button
                onClick={handleMigrateConfirm}
                disabled={busy || !migrateTarget.trim()}
                style={btn(G.blue,"#fff")}
              >
                {busy ? "Moving…" : `Move to "${migrateTarget || "…"}"`}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step 2b: confirm complete delete ─────────────────────────────────
    if (step === "confirm_delete") {
      const handleDeleteConfirm = async () => {
        update({ busy: true, error: "" });
        try {
          const result = await deleteInstituteCompletely(inst, {
            adminName: user.displayName || user.email || "Admin",
            eventAt: Date.now(),
          });
          setGlobalInstList(prev => prev.filter(i => !sameInstituteName(i, inst)));
          setDeletedInstitutes(s => { const n = new Set(s); n.add(inst.trim()); return n; });
          setTeachers(prev => prev.map(t => ({
            ...t,
            institutes: (t.institutes||[]).filter(i => !sameInstituteName(i, inst)),
          })));
          setFullData(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(uid => {
              const td = next[uid];
              if (!td) return;
              next[uid] = {
                ...td,
                classes: (td.classes||[]).filter(c => !sameInstituteName(c?.institute, inst)),
                institutes: (td.institutes||[]).filter(i => !sameInstituteName(i, inst)),
              };
            });
            return next;
          });
          if (selInst === inst) { setSelInst(null); resetNav(); }
          persistAdminBin(b => [...b, { type:"institute", name:inst, deletedAt:Date.now(), deletedBy:user.uid, action:"deleted_completely" }]);
          setInstDeleteModal(null);
          showAdminToast(
            result.affectedTeacherCount
              ? `"${inst}" permanently deleted. ${result.affectedTeacherCount} teacher${result.affectedTeacherCount!==1?"s":""} notified.`
              : `"${inst}" permanently deleted.`
          );
        } catch(e) {
          update({ busy: false, error: e.message || "Something went wrong." });
        }
      };

      return (
        <div style={overlay} onClick={e => { if(e.target===e.currentTarget && !busy) setInstDeleteModal(null); }}>
          <div style={box}>
            <div style={{fontSize:20,fontWeight:800,color:G.red,fontFamily:G.display,marginBottom:6}}>
              Permanently delete "{inst}"?
            </div>
            <div style={{
              background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,
              padding:"14px 16px",marginBottom:20,
            }}>
              <div style={{fontSize:13,color:"#7F1D1D",lineHeight:1.7}}>
                ⚠️ <strong>This cannot be undone.</strong> All classes, attendance entries, and notes under "{inst}" will be <strong>permanently wiped</strong> from every teacher's account.
                Teachers who have classes in this institute will receive a deletion notification.
              </div>
            </div>
            {error && <div style={{fontSize:13,color:G.red,marginBottom:14,fontWeight:600}}>{error}</div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
              <button onClick={() => !busy && update({ step:"choose", error:"" })} style={btn(G.surface,G.textM,G.border)} disabled={busy}>
                ← Back
              </button>
              <button onClick={handleDeleteConfirm} disabled={busy} style={btn(G.red,"#fff")}>
                {busy ? "Deleting…" : "Yes, delete permanently"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ── MANAGE ACCESS VIEW ────────────────────────────────────────────────────
  if(view==="manage"){
    if(instituteGlanceOpen && !isMobile){
      return (
        <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:G.bg,overflow:"hidden"}}>
          {renderDesktopCentreSummaryPage()}
          {instituteGlanceOptionsOpen&&(
            <LedgrReportOptionsModal
              institutes={institutes}
              period={instituteGlancePeriod}
              month={instituteGlanceMonth}
              rangeStart={instituteGlanceRangeStart}
              rangeEnd={instituteGlanceRangeEnd}
              schedule={ledgrReportSchedule}
              scheduleLoading={ledgrReportScheduleLoading}
              scheduleSaving={ledgrReportScheduleSaving}
              exportDisabled={instituteGlanceExportDisabled}
              busyFormat={instituteGlanceExportBusy}
              initialMode={instituteGlanceOptionsMode}
              context={instituteGlanceOptionsContext}
              onClose={()=>!instituteGlanceExportBusy&&!ledgrReportScheduleSaving&&setInstituteGlanceOptionsOpen(false)}
              onApply={applyInstituteGlanceOptions}
              onSaveSchedule={saveInstituteGlanceSchedule}
            />
          )}
          {telegramDashboardOpen&&(
            <LedgrTelegramDashboardModal
              institutes={institutes}
              schedule={ledgrReportSchedule}
              config={ledgrTelegramConfig}
              loading={ledgrTelegramLoading}
              saving={ledgrTelegramSaving}
              sendBusy={ledgrTelegramSending}
              onClose={()=>!ledgrTelegramSaving&&setTelegramDashboardOpen(false)}
              onSave={saveLedgrTelegramDashboard}
              onOpenSchedule={openLedgrTelegramSchedule}
              onSendNow={sendLedgrTelegramNow}
            />
          )}
          <AdminToastBanner message={adminToast} />
        </div>
      );
    }

    const adminOnlyList = teachers.filter(t=>roles[t.uid]==="admin");
    const teacherOnlyList = teachers.filter(t=>roles[t.uid]!=="admin");
    const manageTabItems = [
      { key:"teachers", label:"Teachers", icon:IconUsersGroup, count:teacherOnlyList.length, hint:"Accounts & classes" },
      { key:"institutes", label:"Institutes", icon:IconBuilding, count:institutes.length, hint:"Names & structure" },
      { key:"subjects", label:"Syllabus", icon:IconBooks, count:syllabusTemplates.length, hint:"Chapters & topics" },
      { key:"sections", label:"Sections", icon:IconSchool, count:institutes.length, hint:"Groups & timetables" },
      { key:"admins", label:"Admins", icon:IconSettings, count:adminOnlyList.length, hint:"Access & roles" },
    ];
    const manageTitle = manageTabItems.find(item=>item.key===manageTab)?.label
      || (manageTab === "report" ? "Ledgr Report" : manageTab === "messenger" ? "Messenger" : "Control Centre");
    const getSyllabusAffectedSummary = (scope,subjectOverride) => {
      const activeSubject=subjectOverride;
      const scopePairs=syllabusScopePairs(scope);
      if(!activeSubject||!scopePairs.length) return {classCount:0,instituteCount:0,teacherCount:0,classes:[]};
      const subjectKey=activeSubject.name.trim().toLowerCase();
      let classCount=0;
      const instituteNames=new Set();
      const teacherUids=new Set();
      const classLabels=new Set();
      Object.entries(fullData).forEach(([uid,data])=>{
        (data?.classes||[]).forEach(cls=>{
          if(String(cls?.subject||"").trim().toLowerCase()!==subjectKey) return;
          const matchesScope=scopePairs.some(item=>
            sameInstituteName(cls?.institute,item.instituteName)
            && normaliseSectionKey(cls?.section||cls?.name)===normaliseSectionKey(item.sectionName)
          );
          if(!matchesScope) return;
          classCount+=1;
          teacherUids.add(uid);
          if(cls.institute) instituteNames.add(String(cls.institute).trim());
          classLabels.add([cls.institute,cls.section||cls.name].filter(Boolean).join(" · "));
        });
      });
      return {classCount,instituteCount:instituteNames.size,teacherCount:teacherUids.size,classes:[...classLabels].filter(Boolean).sort()};
    };
    const mobileManageBack = () => {
      if(instDetailView){
        setInstDetailView(null);
        return;
      }
      setView("main");
      setMobileSurface("profile");
      setProfileOpen(false);
    };
    const mobileManageOuterPad = "10px 12px calc(92px + env(safe-area-inset-bottom, 0px))";
    const mobileManageSections = (() => {
      const searchKey = manageSectionSearch.trim().toLowerCase();
      return institutes
        .filter(inst=>!searchKey || inst.toLowerCase().includes(searchKey))
        .map(inst=>{
          const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
          const groups = instData.gradeGroups || [];
          const standaloneSections = uniqueSectionNames(instData.extraSections || []);
          const pendingSections = collectPendingInstituteSections(fullData, teachers, inst, instSectionsAll);
          const groupedSections = groups.flatMap(group=>uniqueSectionNames(group.sections || []));
          const totalSections = [...new Set([...groupedSections, ...standaloneSections, ...pendingSections.map(item=>item.section)].filter(Boolean))];
          return {
            inst,
            groups,
            pendingSections,
            standaloneSections,
            totalSections,
          };
        });
    })();
    const sidebarInstitutes = institutes.filter(institute=>
      !manageInstituteFilter.trim()
      || institute.toLowerCase().includes(manageInstituteFilter.trim().toLowerCase())
    );
    const openInstituteArea = (institute, area) => {
      setManageScopeInstitute(institute);
      setInstDetailView(null);
      if(area==="sections"){
        setManageTab("sections");
        setInstDetailView(institute);
      } else if(area==="teachers"){
        setManageTab("teachers");
        setOpenTeacherInstitute(institute);
      } else if(area==="institutes"){
        setManageTab("institutes");
      } else {
        setManageTab("subjects");
      }
    };
    return(
    <div style={{minHeight:"100svh",background:G.bg,fontFamily:G.sans,overflowX:"hidden"}}>
      {feedbackOpen&&(
        <FeedbackInboxModal
          threads={feedbackThreads}
          selectedUid={feedbackSelectedUid}
          messages={feedbackMessages}
          reply={feedbackReply}
          busy={feedbackBusy}
          onSelect={uid=>{setFeedbackSelectedUid(uid);markFeedbackThreadRead(uid).catch(()=>{});}}
          onReplyChange={setFeedbackReply}
          onSend={sendFeedbackReply}
          onToggleResolved={toggleFeedbackResolved}
          onClose={()=>setFeedbackOpen(false)}
        />
      )}
      {binView&&<AdminBinModal/>}
      {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
      <AdminToastBanner message={adminToast} />
      {/* nav */}
      <div style={isMobile
        ? {background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 12px 10px",borderBottom:`1px solid ${G.border}`,position:"sticky",top:0,zIndex:80}
        : {background:G.navy,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        {isMobile ? (
          <>
            <button onClick={mobileManageBack} className="admin-mobile-touch" style={{display:"inline-flex",alignItems:"center",gap:6,height:38,borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF",padding:"0 12px",cursor:"pointer",color:G.textS,fontFamily:G.sans,fontSize:12.5,fontWeight:700,boxShadow:reduceEffects ? "none" : G.shadowSm}}>
              <AppIcon icon={IconChevronLeft} size={16} color={G.textS} />
              {instDetailView ? "All sections" : "Back"}
            </button>
            <div style={{minWidth:0,flex:1,textAlign:"center"}}>
              <div style={{fontSize:10.5,fontWeight:700,color:G.textL,fontFamily:G.mono,letterSpacing:1.05,textTransform:"uppercase"}}>
                {instDetailView ? "Section setup" : "Control centre"}
              </div>
              <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.35,lineHeight:1.1,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {instDetailView ? instDetailView : manageTitle}
              </div>
            </div>
            <button onClick={logout} className="admin-mobile-touch" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",height:38,minWidth:38,borderRadius:14,border:`1px solid ${G.border}`,background:"#FFFFFF",padding:"0 10px",cursor:"pointer",color:G.textS,fontFamily:G.sans,fontSize:12,fontWeight:700,boxShadow:reduceEffects ? "none" : G.shadowSm}}>
              <AppIcon icon={IconLogout} size={16} color={G.textS} />
            </button>
          </>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:28,height:28,background:G.blueV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M4 3H7V13H14V16H4V3Z" fill="white"/></svg>
              </div>
              <span style={{fontFamily:G.display,fontSize:18,fontWeight:800,color:"#fff",letterSpacing:-0.4}}>Ledgr</span>
              <span style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setView("main")} style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.6)","rgba(255,255,255,0.1)")}}>← Back</button>
              <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)")}}>Sign Out</button>
            </div>
          </>
        )}
      </div>
      <div style={isMobile
        ? {maxWidth:860,margin:"0 auto",padding:mobileManageOuterPad}
        : {width:"100%",boxSizing:"border-box",padding:"0 24px 72px 0",display:"grid",gridTemplateColumns:"300px minmax(0,1fr)",gap:24,alignItems:"start"}}>

        {/* Copy group to institutes modal */}
        {copyGroupModal&&(
          <CopyGroupToInstitutesModal
            sourceInst={copyGroupModal.sourceInst}
            group={copyGroupModal.group}
            allInstitutes={institutes}
            instSectionsAll={instSectionsAll}
            getInstituteSectionConfig={getInstituteSectionConfig}
            getInstituteSectionConfigKey={getInstituteSectionConfigKey}
            onCopy={async(instKey, instName, updatedGroups)=>{
              await saveInstituteGradeGroups(instKey, updatedGroups);
              setInstSectionsAll(a=>({
                ...a,
                [instKey]:{ ...(a[instKey]||{}), gradeGroups: updatedGroups }
              }));
            }}
            onClose={()=>setCopyGroupModal(null)}
          />
        )}

        {/* Grade group modal (add/edit) */}
        {grpModal&&(
          <GradeGroupModal
            inst={grpModal.inst}
            instType={getInstituteSectionConfig(instSectionsAll, grpModal.inst)?.type||""}
            group={grpModal.mode==="edit"?grpModal.group:null}
            onSave={async(savedGroup, changeMeta)=>{
              const instKey = getInstituteSectionConfigKey(instSectionsAll, grpModal.inst);
              const instData = getInstituteSectionConfig(instSectionsAll, grpModal.inst) || {};
              const existing=instData.gradeGroups||[];
              const updated=grpModal.mode==="edit"?existing.map(g=>g.id===savedGroup.id?savedGroup:g):[...existing,savedGroup];
              const nextEvents = mergeInstituteSectionChangeEvents(instData.sectionChangeEvents, changeMeta?.sectionChangeEvents);
              await saveInstituteGradeGroups(instKey,updated,{
                sectionChangeEvents: nextEvents,
              });
              if(changeMeta?.sectionChangeEvents?.length){
                setFullData(prev => Object.fromEntries(
                  Object.entries(prev).map(([uid, teacherData]) => [
                    uid,
                    applyAdminSectionChangeEventsToTeacherData(teacherData, grpModal.inst, changeMeta.sectionChangeEvents),
                  ])
                ));
              }
              setInstSectionsAll(a=>({
                ...a,
                [instKey]:{
                  ...(a[instKey] || {}),
                  gradeGroups:updated,
                  sectionChangeEvents: nextEvents,
                }
              }));
            }}
            onClose={()=>setGrpModal(null)}
          />
        )}

        {!isMobile&&(
          <aside style={{position:"sticky",top:0,alignSelf:"start",height:"calc(100vh - 54px)",maxHeight:"calc(100vh - 54px)",display:"flex",flexDirection:"column",background:"#F8FAFD",borderRight:`1px solid ${G.border}`,borderBottom:`1px solid ${G.border}`,borderRadius:"0 0 16px 0",overflow:"hidden"}}>
            <div style={{padding:"15px 15px 12px",borderBottom:`1px solid ${G.border}`,background:"#FFFFFF"}}>
              <input value={manageInstituteFilter} onChange={event=>setManageInstituteFilter(event.target.value)} placeholder="Filter institutes" style={{width:"100%",boxSizing:"border-box",border:`1px solid ${G.borderM}`,borderRadius:11,padding:"10px 12px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none"}}/>
            </div>
            <div style={{padding:"12px 10px",overflowY:"auto",minHeight:0}}>
              <button onClick={()=>setView("main")} style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:"transparent",color:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                <AppIcon icon={IconChartBar} size={15} color={G.textL}/> Dashboard
              </button>
              <div style={{height:1,background:G.border,margin:"8px 8px 10px"}}/>

              {manageInstituteFilter.trim()&&(
                <div style={{padding:"0 2px 10px"}}>
                  <div style={{fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.9,padding:"0 8px 7px"}}>Institute matches</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {sidebarInstitutes.slice(0,8).map((institute,index)=>{
                      const teacherCount=instituteStats[institute]?.teacherCount||teachers.filter(teacher=>teacherBelongsToInstitute(teacher,institute)).length;
                      const tones=["#2563EB","#0F9F78","#7C3AED","#DB2777","#C45A07"];
                      const tone=tones[index%tones.length];
                      return (
                        <button key={institute} onClick={()=>openInstituteArea(institute,"teachers")} style={{width:"100%",display:"grid",gridTemplateColumns:"12px minmax(0,1fr) auto",alignItems:"center",gap:8,border:"none",borderRadius:9,padding:"8px 8px",background:manageScopeInstitute===institute?"#EEF4FF":"transparent",color:manageScopeInstitute===institute?G.navy:G.text,fontFamily:G.sans,cursor:"pointer",textAlign:"left"}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:tone}}/>
                          <span style={{fontSize:12.25,fontWeight:manageScopeInstitute===institute?850:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{institute}</span>
                          <span style={{fontSize:11,fontWeight:800,color:G.textL}}>{teacherCount}</span>
                        </button>
                      );
                    })}
                    {sidebarInstitutes.length===0&&<div style={{padding:"10px 8px",fontSize:12,color:G.textM,textAlign:"center"}}>No institutes match.</div>}
                  </div>
                  <div style={{height:1,background:G.border,margin:"10px 6px 0"}}/>
                </div>
              )}

              <div style={{fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.9,padding:"0 8px 7px"}}>Workspace</div>
              {manageTabItems.map(item=>(
                <button key={item.key} onClick={()=>openManageTab(item.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:!manageScopeInstitute&&manageTab===item.key?"#EEF4FF":"transparent",color:!manageScopeInstitute&&manageTab===item.key?G.navy:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                  <AppIcon icon={item.icon} size={15} color={!manageScopeInstitute&&manageTab===item.key?G.blue:G.textL}/>{item.label}
                </button>
              ))}
              <button
                onClick={()=>openManageTab("report")}
                style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:manageTab==="report"?"#EEF4FF":"transparent",color:manageTab==="report"?G.navy:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                <AppIcon icon={IconFileText} size={15} color={manageTab==="report"?G.blue:G.textL}/>
                Ledgr Report
              </button>
              <button
                onClick={()=>openManageTab("messenger")}
                style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:manageTab==="messenger"?"#EEF4FF":"transparent",color:manageTab==="messenger"?G.navy:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                <AppIcon icon={IconSend} size={15} color={manageTab==="messenger"?G.blue:G.textL}/>
                Messenger
                <span style={{marginLeft:"auto",background:ledgrTelegramRecipientStats.active?G.blueL:"#F3F4F6",color:ledgrTelegramRecipientStats.active?G.blue:G.textL,borderRadius:999,padding:"2px 7px",fontSize:10.5,fontWeight:850,fontFamily:G.mono}}>
                  {ledgrTelegramLoading ? "..." : ledgrTelegramRecipientStats.active || "setup"}
                </span>
              </button>

              <div style={{fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.9,padding:"10px 8px 7px",borderTop:`1px solid ${G.border}`}}>Support & recovery</div>
              <button onClick={openFeedbackInbox} style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:"transparent",color:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                <AppIcon icon={IconMessageCircle} size={15} color={G.textL}/> Teacher Feedback
                {feedbackUnreadCount>0&&<span style={{marginLeft:"auto",background:G.blue,color:"#FFFFFF",borderRadius:999,padding:"2px 7px",fontSize:10.5,fontWeight:850}}>{feedbackUnreadCount}</span>}
              </button>
              <button onClick={()=>setBinView(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,border:"none",borderRadius:9,padding:"9px 10px",background:"transparent",color:G.textM,fontFamily:G.sans,fontSize:12.5,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                <AppIcon icon={IconTrash} size={15} color={G.textL}/> Recycle Bin
                {adminBin.length>0&&<span style={{marginLeft:"auto",background:G.redL,color:G.red,borderRadius:999,padding:"2px 7px",fontSize:10.5,fontWeight:850}}>{adminBin.length}</span>}
              </button>
            </div>
          </aside>
        )}

        <main style={{minWidth:0,paddingTop:isMobile?0:22}}>

        {/* Institute detail drill-down (replaces tab content when active) */}
        {instDetailView?(()=>{
          const instKey = getInstituteSectionConfigKey(instSectionsAll, instDetailView);
          const instData=getInstituteSectionConfig(instSectionsAll, instDetailView)||{};
          const groups=instData.gradeGroups||[];
          const sectionLabels = getInstituteEntityLabels(instData.type);
          const standaloneSections = uniqueSectionNames(instData.extraSections || []);
          const pendingSections = collectPendingInstituteSections(fullData, teachers, instDetailView, instSectionsAll);
          const sortedGroups = [...groups].sort((a,b)=>exportTextSorter.compare(a?.label || "", b?.label || ""));
          const addButtonLabel = "+ Add Timetable Group";
          const fmtSlotPill=s=>{const[h,m]=s.start.split(":").map(Number);const e=s.end?.split(":").map(Number)||[0,0];const f=(hh,mm)=>`${hh%12||12}:${String(mm).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;return`${f(h,m)}–${f(e[0],e[1])}`;};
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isMobile?14:20,flexWrap:"wrap"}}>
                {!isMobile&&<button onClick={()=>setInstDetailView(null)} style={{...pill(G.bg,G.textS,G.borderM),fontSize:14}}>← Back</button>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:isMobile?18:20,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.15}}>{instDetailView}</div>
                  <div style={{fontSize:isMobile?12.5:13,color:G.textM,marginTop:4,lineHeight:1.6}}>Create named timetable groups. Every section inside one group will share the same slots.</div>
                </div>
                <button onClick={()=>openLegacySectionRepairForInstitute(instDetailView)} style={{...pill("#EEF4FF",G.blue,"#C7D7F5"),fontSize:13,fontWeight:700}}>Legacy repair</button>
              </div>
              {(pendingSections.length>0 || standaloneSections.length>0)&&(
                <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:18}}>
                  {pendingSections.length>0&&(
                    <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:16,padding:"18px"}}>
                      {/* Header */}
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
                        <div>
                          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:999,padding:"4px 11px",fontSize:11,fontWeight:700,color:"#92400E",fontFamily:G.mono,letterSpacing:0.4,marginBottom:8}}>
                            Teacher Submissions
                          </div>
                          <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>
                            {sectionLabels.plural.charAt(0).toUpperCase()+sectionLabels.plural.slice(1)} submitted by teachers
                          </div>
                          <div style={{fontSize:13,color:G.textM,lineHeight:1.6,maxWidth:700}}>
                            Teachers added these {sectionLabels.plural} directly. Keep them to move to a group, rename them, or delete them.
                          </div>
                        </div>
                        {pendingSectionBusy&&(
                          <div style={{fontSize:12,fontWeight:700,color:"#9A3412",fontFamily:G.mono}}>Saving…</div>
                        )}
                      </div>
                      {/* Section rows */}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {pendingSections.map(item=>(
                          <div key={item.section} style={{background:"#FFFFFF",border:"1px solid #FED7AA",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                            <div style={{flex:"1 1 260px",minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              {(()=>{
                                const tone = getSectionTone(item.section);
                                return (
                                  <span style={{background:tone.surface,color:tone.ink,border:`1px solid ${tone.border}`,borderRadius:20,padding:"4px 11px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>{item.section}</span>
                                );
                              })()}
                                <span style={{fontSize:12,color:G.textL}}>{item.affectedClassCount} class{item.affectedClassCount!==1?"es":""}</span>
                              </div>
                              <div style={{fontSize:12,color:G.textL,marginTop:6,lineHeight:1.5}}>
                                {item.teacherNames.length>0&&(
                                  <span>By: {item.teacherNames.join(", ")}</span>
                                )}
                                {item.subjects.length>0&&(
                                  <span style={{marginLeft:item.teacherNames.length>0?10:0}}>· {item.subjects.join(", ")}</span>
                                )}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0,alignItems:"center"}}>
                              <button disabled={pendingSectionBusy} onClick={()=>handleKeepPendingInstituteSection(instDetailView, item.section)} style={{...pill("#ECFDF3","#047857","#A7F3D0"),fontSize:13,...(pendingSectionBusy?{opacity:0.6,cursor:"not-allowed"}:{})}}>Keep</button>
                              <button disabled={pendingSectionBusy} onClick={()=>openPendingInstituteSectionRename(instDetailView, item.section)} style={{...pill(G.blueL,G.blue,G.borderM),fontSize:13,...(pendingSectionBusy?{opacity:0.6,cursor:"not-allowed"}:{})}}>Rename</button>
                              <button disabled={pendingSectionBusy} onClick={()=>handleDeletePendingInstituteSection(instDetailView, item)} style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13,...(pendingSectionBusy?{opacity:0.6,cursor:"not-allowed"}:{})}}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {standaloneSections.length>0&&(
                    <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:16,padding:"18px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.6,fontFamily:G.mono,marginBottom:6}}>
                        Accepted standalone {sectionLabels.plural}
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>
                        Saved outside timetable groups
                      </div>
                      <div style={{fontSize:13,color:G.textL,lineHeight:1.6,marginBottom:12}}>
                        These {sectionLabels.plural} are now official, but they are not attached to any timetable group yet. Add them to a group whenever you want shared slots.
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {standaloneSections.map(section=>{
                          const affectedTeachers = teachers.filter(t=>teacherBelongsToInstitute(t,instDetailView)&&(()=>{const d=fullData[t.uid];return d&&(d.classes||[]).some(c=>normaliseSectionKey(c.section)===normaliseSectionKey(section)&&sameInstituteName(c.institute,instDetailView));})());
                          const affectedClassCount = affectedTeachers.reduce((sum,t)=>{const d=fullData[t.uid];return sum+(d?(d.classes||[]).filter(c=>normaliseSectionKey(c.section)===normaliseSectionKey(section)&&sameInstituteName(c.institute,instDetailView)).length:0);},0);
                          const standaloneItem = {section, affectedClassCount, affectedTeacherCount:affectedTeachers.length, subjects:[], teacherNames:affectedTeachers.map(t=>t.displayName||t.email||"").filter(Boolean)};
                          return(
                            <div key={section} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                              <div style={{flex:"1 1 200px",minWidth:0}}>
                                {(()=>{
                                  const tone = getSectionTone(section);
                                  return (
                                    <span style={{background:tone.surface,color:tone.ink,border:`1px solid ${tone.border}`,borderRadius:20,padding:"4px 11px",fontSize:12,fontFamily:G.mono,fontWeight:700}}>{section}</span>
                                  );
                                })()}
                                {affectedClassCount>0&&(
                                  <div style={{fontSize:12,color:G.textL,marginTop:6}}>
                                    {affectedClassCount} class{affectedClassCount!==1?"es":""} across {affectedTeachers.length} teacher{affectedTeachers.length!==1?"s":""}
                                  </div>
                                )}
                              </div>
                              <div style={{display:"flex",gap:8,flexShrink:0}}>
                                <button
                                  disabled={pendingSectionBusy}
                                  onClick={()=>openPendingInstituteSectionRename(instDetailView,section)}
                                  style={{...pill(G.blueL,G.blue,G.borderM),fontSize:13,...(pendingSectionBusy?{opacity:0.6,cursor:"not-allowed"}:{})}}
                                >Rename</button>
                                <button
                                  disabled={pendingSectionBusy}
                                  onClick={()=>handleDeletePendingInstituteSection(instDetailView,standaloneItem)}
                                  style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13,...(pendingSectionBusy?{opacity:0.6,cursor:"not-allowed"}:{})}}
                                >Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {groups.length===0&&(
                <div style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,padding:"36px 20px",textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:32,marginBottom:10}}>🗂</div>
                  <div style={{fontSize:16,fontWeight:600,color:G.textM,marginBottom:6}}>No timetable groups yet</div>
                  <div style={{fontSize:14,color:G.textL}}>Add a timetable group, choose its sections, and define the shared time slots for those sections.</div>
                </div>
              )}
              {sortedGroups.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.7,marginBottom:8,fontFamily:G.mono}}>Timetable groups</div>
                  <div style={{fontSize:13,color:G.textL,marginBottom:12}}>Open any group to review its sections and shared time slots.</div>
                </div>
              )}
              {sortedGroups.map(group=>{
                const cardStateKey = `${instDetailView}::${group.id}`;
                const isOpen = !!instClassificationOpen[cardStateKey];
                const groupSections = uniqueSectionNames(group.sections || []);
                const groupSlots = [...(group.slots || [])].sort((a,b)=>(a?.start || "").localeCompare(b?.start || ""));
                const overrideSections = Object.keys(group.sectionOverrides || {}).filter(key => (group.sectionOverrides?.[key] || []).length > 0);
                return(
                  <div key={group.id} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,marginBottom:12,overflow:"hidden"}}>
                    <button
                      onClick={()=>setInstClassificationOpen(prev=>({...prev,[cardStateKey]:!prev[cardStateKey]}))}
                      style={{width:"100%",padding:"16px 18px",background:"transparent",border:"none",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}
                    >
                      <div>
                        <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.label || "Untitled group"}</div>
                        <div style={{fontSize:13,color:G.textM,marginTop:2}}>
                          {groupSections.length} sections · {groupSlots.length} time slots
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                        {overrideSections.length>0&&(
                          <span style={{background:"#FFF7ED",color:G.amber,border:`1px solid #FED7AA`,borderRadius:999,padding:"4px 9px",fontSize:11,fontFamily:G.mono,fontWeight:700}}>
                            {overrideSections.length} custom
                          </span>
                        )}
                        <span style={{fontSize:18,color:G.textL,transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.18s"}}>›</span>
                      </div>
                    </button>
                    {isOpen&&(
                      <div style={{padding:"0 18px 16px",borderTop:`1px solid ${G.border}`}}>
                        <div style={{paddingTop:14}}>
                          <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Sections</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                            {groupSections.map(section=>{
                              const tone = getSectionTone(section);
                              return (
                                <span key={section} style={{background:tone.surface,color:tone.ink,border:`1px solid ${tone.border}`,borderRadius:20,padding:"3px 11px",fontSize:12,fontFamily:G.mono,fontWeight:600}}>{section}</span>
                              );
                            })}
                          </div>
                          <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Time slots</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {groupSlots.map((slot, idx)=>(
                              <span key={`${group.id}_${idx}`} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:20,padding:"3px 11px",fontSize:12,fontFamily:G.mono,color:G.text}}>{fmtSlotPill(slot)}</span>
                            ))}
                          </div>
                          {overrideSections.length>0&&(
                            <div style={{fontSize:12,color:G.textL,marginTop:8}}>+ Custom slots for: {overrideSections.join(", ")}</div>
                          )}
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:14}}>
                          <button onClick={()=>setGrpModal({mode:"edit",inst:instDetailView,group})} style={{...pill(G.bg,G.textS,G.borderM),fontSize:13}}>Edit</button>
                          <button onClick={()=>setCopyGroupModal({sourceInst:instDetailView,group})} style={{...pill(G.blueL,G.blue,G.borderM),fontSize:13}}>📋 Copy to Institutes</button>
                          <button onClick={async()=>{if(!window.confirm(`Delete "${group.label}"?`))return;await deleteInstituteGradeGroup(instKey,group.id);setInstSectionsAll(a=>({...a,[instKey]:{...(a[instKey]||{}),gradeGroups:(a[instKey]?.gradeGroups||[]).filter(g=>g.id!==group.id)}}));}} style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13}}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={()=>setGrpModal({mode:"add",inst:instDetailView})}
                style={{width:"100%",padding:"13px",borderRadius:12,border:`2px dashed ${G.blue}`,background:G.blueL,color:G.blue,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                {addButtonLabel}
              </button>
            </div>
          );
        })():(<>

        {!["report","messenger"].includes(manageTab)&&<div style={{marginBottom:isMobile?8:20,display:isMobile?"none":"block"}}>
          <div style={{fontSize:11,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:1}}>Control centre</div>
          <h2 style={{fontSize:isMobile?22:28,fontWeight:850,color:G.text,fontFamily:G.display,margin:"5px 0 0",lineHeight:1.15}}>
            {manageScopeInstitute||manageTitle}
          </h2>
          {!isMobile&&manageScopeInstitute&&(
            <div style={{fontSize:13.5,color:G.textM,marginTop:6}}>
              Manage this institute's {manageTab==="subjects"?"syllabus":manageTab}.
            </div>
          )}
        </div>}

        {/* Tab switcher */}
        {isMobile&&<div style={{position:"sticky",top:61,zIndex:65,margin:"-10px -12px 14px",padding:"9px 12px 10px",background:"rgba(245,247,250,0.96)",borderBottom:`1px solid ${G.border}`,backdropFilter:"blur(12px)",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
          <div style={{display:"flex",gap:8,width:"max-content",minWidth:"100%"}}>
          {manageTabItems.map(item=>(
            <button key={item.key} onClick={()=>{setManageTab(item.key); if(item.key!=="sections") setInstDetailView(null);}}
              className={isMobile?"admin-mobile-touch":undefined}
              style={isMobile
                ? {
                    minHeight:44,
                    background:manageTab===item.key ? G.navy : "#FFFFFF",
                    border:`1px solid ${manageTab===item.key ? G.navy : G.border}`,
                    borderRadius:13,
                    padding:"0 11px",
                    cursor:"pointer",
                    boxShadow:reduceEffects ? "none" : G.shadowSm,
                    WebkitTapHighlightColor:"transparent",
                    display:"inline-flex",
                    alignItems:"center",
                    gap:7,
                    whiteSpace:"nowrap",
                  }
                : {
                    flex:1,padding:"10px 0",borderRadius:9,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:G.sans,transition:"all 0.15s",
                    background:manageTab===item.key?G.navy:"none",color:manageTab===item.key?"#fff":G.textM
                  }}>
              {isMobile ? (
                <>
                  <AppIcon icon={item.icon} size={16} color={manageTab===item.key ? "#FFFFFF" : G.blue} />
                  <span style={{fontSize:12.5,fontWeight:800,color:manageTab===item.key ? "#FFFFFF" : G.text,fontFamily:G.sans}}>{item.label}</span>
                  <span style={{minWidth:21,height:21,borderRadius:999,background:manageTab===item.key?"rgba(255,255,255,0.16)":G.bg,border:`1px solid ${manageTab===item.key?"rgba(255,255,255,0.16)":G.border}`,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",fontSize:9.5,fontFamily:G.mono,fontWeight:800,color:manageTab===item.key?"#FFFFFF":G.textL}}>
                    {item.count}
                  </span>
                </>
              ) : (
                item.label
              )}
            </button>
          ))}
          </div>
        </div>}

        {manageTab==="report"&&renderDesktopCentreSummaryPage({ embedded:true })}

        {manageTab==="messenger"&&(
          <LedgrTelegramDashboardModal
            embedded
            institutes={institutes}
            schedule={ledgrReportSchedule}
            config={ledgrTelegramConfig}
            loading={ledgrTelegramLoading}
            saving={ledgrTelegramSaving}
            sendBusy={ledgrTelegramSending}
            onClose={()=>openManageTab("teachers")}
            onSave={saveLedgrTelegramDashboard}
            onOpenSchedule={openLedgrTelegramSchedule}
            onSendNow={sendLedgrTelegramNow}
          />
        )}

        {!isMobile&&instituteGlanceOptionsOpen&&(
          <LedgrReportOptionsModal
            institutes={institutes}
            period={instituteGlancePeriod}
            month={instituteGlanceMonth}
            rangeStart={instituteGlanceRangeStart}
            rangeEnd={instituteGlanceRangeEnd}
            schedule={ledgrReportSchedule}
            scheduleLoading={ledgrReportScheduleLoading}
            scheduleSaving={ledgrReportScheduleSaving}
            exportDisabled={instituteGlanceExportDisabled}
            busyFormat={instituteGlanceExportBusy}
            initialMode={instituteGlanceOptionsMode}
            context={instituteGlanceOptionsContext}
            onClose={()=>!instituteGlanceExportBusy&&!ledgrReportScheduleSaving&&setInstituteGlanceOptionsOpen(false)}
            onApply={applyInstituteGlanceOptions}
            onSaveSchedule={saveInstituteGlanceSchedule}
          />
        )}

        {manageTab==="subjects"&&(
          <ClassBoundSyllabusFlow
            key={manageScopeInstitute||"all-institutes"}
            institutes={institutes}
            defaultInstitute={manageScopeInstitute}
            instituteSections={instSectionsAll}
            templates={syllabusTemplates}
            classData={fullData}
            teachers={teachers}
            getAffectedSummary={getSyllabusAffectedSummary}
            busy={syllabusBusy}
            isMobile={isMobile}
            onScopeChange={prepareSyllabusInstitutes}
            onSave={handleSaveSyllabusDraft}
            onPublish={handlePublishSyllabus}
            onDelete={handleDeleteSyllabus}
          />
        )}

        {manageTab==="catalog"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px"}}>
              <div style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display}}>Subject catalog</div>
              <div style={{fontSize:14,color:G.textM,lineHeight:1.55,marginTop:4,marginBottom:14}}>
                Official subjects used for teacher assignments and published syllabus templates.
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <input
                  value={newSubjectName}
                  onChange={event=>setNewSubjectName(event.target.value)}
                  onKeyDown={event=>event.key==="Enter"&&handleCreateSubject()}
                  placeholder="e.g. Chemistry"
                  style={{flex:"1 1 220px",minWidth:0,padding:"11px 14px",borderRadius:10,border:`1.5px solid ${G.border}`,fontSize:15,fontFamily:G.sans,outline:"none",color:G.text}}
                />
                <button onClick={handleCreateSubject} disabled={!newSubjectName.trim()||subjectBusy}
                  style={{...pill(newSubjectName.trim()?G.navy:G.bg,newSubjectName.trim()?"#fff":G.textL,G.border),padding:"10px 16px",fontSize:13.5}}>
                  Add subject
                </button>
                <button onClick={handleImportTeacherSubjects} disabled={subjectBusy}
                  style={{...pill("#EEF4FF",G.blue,"#C7D7F5"),padding:"10px 16px",fontSize:13.5}}>
                  Import existing
                </button>
              </div>
            </div>
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px"}}>
              {globalSubjects.length===0 ? (
                <div style={{padding:"28px 12px",textAlign:"center",color:G.textM}}>No canonical subjects yet.</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
                  {globalSubjects.map(subject=>{
                    const subjectSyllabi=syllabusTemplates.filter(item=>item.subjectId===subject.id);
                    const publishedCount=subjectSyllabi.filter(item=>item.currentVersion>0).length;
                    return (
                    <div key={subject.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:12,border:`1px solid ${subject.active?G.border:"#F5CACA"}`,background:subject.active?G.bg:G.redL,flexWrap:"wrap"}}>
                      <div style={{width:38,height:38,borderRadius:11,background:subject.active?G.blueL:"#FDE2E2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <AppIcon icon={IconBooks} size={18} color={subject.active?G.blue:G.red}/>
                      </div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:15,fontWeight:800,color:G.text}}>{subject.name}</div>
                        <div style={{fontSize:11.5,color:G.textL,fontFamily:G.mono,marginTop:2}}>{subject.id}</div>
                        <div style={{fontSize:11.5,color:G.textM,marginTop:4}}>
                          {subjectSyllabi.length} template{subjectSyllabi.length===1?"":"s"} · {publishedCount} published
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                        {subject.active&&(
                          <button onClick={()=>{setManageScopeInstitute("");setManageTab("subjects");}}
                            style={{...pill(G.navy,"#FFFFFF",G.navy),fontSize:12,fontWeight:800}}>
                            Open syllabus
                          </button>
                        )}
                        <button onClick={()=>handleToggleSubjectActive(subject)} disabled={subjectBusy}
                          style={{...pill(subject.active?G.surface:G.blueL,subject.active?G.red:G.blue,subject.active?"#F5CACA":"#C7D7F5"),fontSize:12}}>
                          {subject.active?"Archive":"Restore"}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        )}

        {manageTab==="sections"&&(
          <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:isMobile?"14px 14px 12px":"16px 18px",marginBottom:24}}>
            <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>Section groups by institute</div>
            <div style={{fontSize:14,color:G.textM,marginBottom:10,lineHeight:1.6}}>Open an institute to rename sections, repair legacy names, and manage shared timetable groups in one place.</div>
            {manageSearchInput(manageSectionSearch,setManageSectionSearch,"Search institutes for section setup")}
            {mobileManageSections.length===0
              ? <div style={{fontSize:15,color:G.textM,padding:"14px 0 6px",textAlign:"center"}}>No institutes match your search.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {mobileManageSections.map(item=>{
                    const hasPending = item.pendingSections.length > 0;
                    const hasStandalone = item.standaloneSections.length > 0;
                    return (
                      <div key={`sections_${item.inst}`} style={{background:G.bg,borderRadius:14,padding:isMobile?"13px 13px 12px":"15px 16px",border:`1px solid ${G.border}`}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:isMobile?16:17,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15}}>{item.inst}</div>
                            <div style={{fontSize:12.5,color:G.textM,marginTop:5,lineHeight:1.55}}>
                              {item.groups.length} timetable group{item.groups.length!==1?"s":""} · {item.totalSections.length} section{item.totalSections.length!==1?"s":""}
                            </div>
                          </div>
                          <button onClick={()=>setInstDetailView(item.inst)} className={isMobile?"admin-mobile-touch":undefined} style={{...pill("#EEF4FF",G.blue,"#C7D7F5"),fontSize:12.5,fontWeight:800,flexShrink:0,WebkitTapHighlightColor:"transparent"}}>
                            Open
                          </button>
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                          <span style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontFamily:G.mono,fontWeight:700,color:G.textS}}>
                            {item.groups.length} groups
                          </span>
                          {hasPending&&(
                            <span style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:999,padding:"5px 10px",fontSize:11.5,fontFamily:G.mono,fontWeight:700,color:"#B45309"}}>
                              {item.pendingSections.length} pending
                            </span>
                          )}
                          {hasStandalone&&(
                            <span style={{background:"#EEF4FF",border:"1px solid #C7D7F5",borderRadius:999,padding:"5px 10px",fontSize:11.5,fontFamily:G.mono,fontWeight:700,color:G.blue}}>
                              {item.standaloneSections.length} standalone
                            </span>
                          )}
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                          <button onClick={()=>openLegacySectionRepairForInstitute(item.inst)} className={isMobile?"admin-mobile-touch":undefined} style={{...pill("#FFFFFF",G.textS,G.borderM),fontSize:12.5,WebkitTapHighlightColor:"transparent"}}>
                            Legacy repair
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {/* ── INSTITUTES TAB ── */}
        {manageTab==="institutes"&&<>

        {/* Class Manager callout */}
        {!isMobile&&<div style={{background:`linear-gradient(135deg,${G.navy},${G.navyS})`,borderRadius:14,padding:"20px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📚</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:3}}>{manageScopeInstitute ? "Institute settings" : "Institutes"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>
              {manageScopeInstitute
                ? `Manage the identity, structure, and lifecycle of ${manageScopeInstitute}.`
                : "Create institutes and maintain the workspace-wide institute list."}
            </div>
          </div>
        </div>}

        {/* Create Institute */}
        {!manageScopeInstitute&&(
        <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>Create Institute</div>
          <div style={{fontSize:14,color:G.textM,marginBottom:14}}>Only admins can create institutes. Teachers will see the full list when adding a class.</div>
          <div style={{display:"flex",gap:10}}>
            <input
              value={newInstName}
              onChange={e=>setNewInstName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleCreateInstitute()}
              placeholder="e.g. Kendriya Vidyalaya, KIS, GIS"
              style={{flex:1,padding:"11px 14px",borderRadius:10,border:`1.5px solid ${G.border}`,fontSize:16,fontFamily:G.sans,outline:"none",color:G.text}}
              onFocus={e=>e.target.style.borderColor=G.blue}
              onBlur={e=>e.target.style.borderColor=G.border}
            />
            <button onClick={handleCreateInstitute} disabled={!newInstName.trim()}
              style={{background:newInstName.trim()?G.navy:G.bg,color:newInstName.trim()?"#fff":G.textL,border:`1px solid ${G.border}`,borderRadius:10,padding:"11px 20px",fontSize:15,cursor:newInstName.trim()?"pointer":"not-allowed",fontFamily:G.sans,fontWeight:600,flexShrink:0}}>
              + Create
            </button>
          </div>
        </div>
        )}

        {/* Institute list */}
        <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px",marginBottom:24}}>
          <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{manageScopeInstitute ? manageScopeInstitute : "All Institutes"}</div>
          <div style={{fontSize:14,color:G.textM,marginBottom:14}}>
            {manageScopeInstitute
              ? "Rename this institute, open its sections, or manage its lifecycle."
              : "Delete removes from the list only. Teacher data is not affected."}
          </div>
          {institutes.length===0
            ?<div style={{fontSize:15,color:G.textM,padding:"20px 0",textAlign:"center"}}>No institutes yet. Create one above.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(manageScopeInstitute ? institutes.filter(inst=>sameInstituteName(inst,manageScopeInstitute)) : institutes).map((inst)=>{
                const instIdx=institutes.indexOf(inst);
                const instTeacherList=teachers.filter(t=>teacherBelongsToInstitute(t, inst));
                const clsCount=instituteStats[inst]?.classCount || instTeacherList.length;
                return(
                  <div key={inst}
                    style={{background:G.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${G.border}`}}>
                    {renamingInst===inst?(
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
                        <input value={renameInstVal} onChange={e=>setRenameInstVal(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")handleRenameInstitute(inst,renameInstVal);if(e.key==="Escape")setRenamingInst(null);}}
                          autoFocus style={{flex:1,minWidth:120,padding:"7px 11px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                        <button onClick={()=>handleRenameInstitute(inst,renameInstVal)} style={{...pill(G.navy,"#fff","transparent"),fontSize:13,padding:"6px 14px"}}>Save</button>
                        <button onClick={()=>setRenamingInst(null)} style={{...pill("none",G.textM,G.border),fontSize:13,padding:"6px 10px"}}>✕</button>
                      </div>
                    ):(
                      <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:3}}>{inst}</div>
                    )}
                    {/* Row 2: stats + buttons on same line */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:14,color:G.textM}}>{clsCount} class{clsCount!==1?"es":""} · {instTeacherList.length} teacher{instTeacherList.length!==1?"s":""}</div>
                        {instTeacherList.length>0&&(
                          <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                            <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"3px 12px",fontSize:13,fontFamily:G.sans,fontWeight:600}}>
                              {instTeacherList.length} teacher{instTeacherList.length!==1?"s":""}
                            </span>
                            <button onClick={()=>{
                              setManageTab("teachers");
                              setOpenTeacherInstitute(inst);
                              setManageTeacherSearch("");
                            }}
                              style={{background:"none",border:"none",fontSize:12,color:G.textM,cursor:"pointer",fontFamily:G.sans,textDecoration:"underline",padding:0}}>
                              View in Teachers →
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center",position:"relative"}}>
                        <button onClick={()=>openManageTab("sections",{ detailInstitute: inst })}
                          style={{background:G.blueL,border:`1px solid ${G.borderM}`,borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:700,whiteSpace:"nowrap"}}>
                          📚 Manage Sections →
                        </button>
                        <button
                          onClick={e=>{e.stopPropagation();setInstMenuOpen(instMenuOpen===inst?null:inst);}}
                          style={{width:34,height:34,background:G.surface,border:`1px solid ${G.borderM}`,borderRadius:8,fontSize:20,cursor:"pointer",color:G.textM,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,letterSpacing:1}}>
                          ⋯
                        </button>
                        {instMenuOpen===inst&&(<>
                          <div onClick={()=>setInstMenuOpen(null)} style={{position:"fixed",inset:0,zIndex:199}}/>
                          <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,boxShadow:G.shadowMd,overflow:"hidden",minWidth:165}}>
                            {instIdx>0&&(
                              <button onClick={()=>{
                                const reordered=[...institutes];
                                const [moved]=reordered.splice(instIdx,1);
                                reordered.unshift(moved);
                                saveInstOrder(reordered);
                                setInstMenuOpen(null);
                              }} style={{width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${G.border}`,textAlign:"left",fontSize:14,cursor:"pointer",color:G.textS,fontFamily:G.sans,fontWeight:500,display:"flex",alignItems:"center",gap:10}}>
                                <span>↑</span> Move to Top
                              </button>
                            )}
                            <button onClick={()=>{setRenamingInst(inst);setRenameInstVal(inst);setInstMenuOpen(null);}}
                              style={{width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${G.border}`,textAlign:"left",fontSize:14,cursor:"pointer",color:G.textS,fontFamily:G.sans,fontWeight:500,display:"flex",alignItems:"center",gap:10}}>
                              <span>✏</span> Rename
                            </button>
                            <button onClick={()=>{handleDeleteInstitute(inst);setInstMenuOpen(null);}}
                              style={{width:"100%",padding:"11px 16px",background:"none",border:"none",textAlign:"left",fontSize:14,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500,display:"flex",alignItems:"center",gap:10}}>
                              <span>🗑</span> Delete
                            </button>
                          </div>
        </>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>

        </>}

        {manageTab==="admins"&&(()=>{
          const adminList = teachers.filter(t=>roles[t.uid]==="admin");
          const adminSearchKey = manageAdminSearch.trim().toLowerCase();
          const matchesAdmin = (teacher) => {
            if(!adminSearchKey) return true;
            const name = getTeacherDisplayName(teacher).toLowerCase();
            const email = String(teacher?.email || "").toLowerCase();
            const instituteText = getTeacherInstituteList(teacher).join(" ").toLowerCase();
            return name.includes(adminSearchKey) || email.includes(adminSearchKey) || instituteText.includes(adminSearchKey);
          };
          const adminInstitutes = [...new Set([
            ...institutes,
            ...adminList.flatMap(t=>getTeacherInstituteList(t)),
          ])]
            .filter(Boolean)
            .sort(exportTextSorter.compare);
          const adminsWithoutInstitute = adminList.filter(t=>!getTeacherInstituteList(t).length && matchesAdmin(t));
          const AdminCard = ({ t, currentInstitute = null }) => {
            const name=getTeacherDisplayName(t);
            const isMe=t.uid===user.uid;
            const instituteList = getTeacherInstituteList(t);
            const otherInstitutes = currentInstitute
              ? instituteList.filter(value=>!sameInstituteName(value, currentInstitute))
              : instituteList;
            return(
              <div style={{background:G.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:11,background:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:G.blue,fontFamily:G.mono,flexShrink:0}}>
                  {(name[0]||"?").toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {renamingTeacher?.uid===t.uid?(
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <input value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&handleRenameTeacher(t.uid,renameVal)}
                        placeholder="Admin name" autoFocus
                        style={{flex:"1 1 220px",minWidth:0,padding:"7px 12px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                      <button onClick={()=>handleRenameTeacher(t.uid,renameVal)} style={{...pill(G.navy,"#fff","transparent"),fontSize:13,padding:"7px 14px"}}>Save</button>
                      <button onClick={()=>setRenamingTeacher(null)} style={{...pill("none",G.textM,G.border),fontSize:13,padding:"7px 10px"}}>Cancel</button>
                    </div>
                  ):(
                    <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {name}
                      {isMe&&<span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>(you)</span>}
                    </div>
                  )}
                  <div style={{fontSize:13,color:G.textM,marginTop:3,fontFamily:G.mono}}>
                    {getTeacherEmail(t) || "Email not available"}
                  </div>
                  {otherInstitutes.length>0&&<AlsoAtInstitutes institutes={otherInstitutes} />}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                  <span style={{background:G.blueL,color:G.blue,fontSize:12,fontWeight:800,borderRadius:20,padding:"3px 10px",fontFamily:G.sans}}>
                    Admin
                  </span>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button onClick={()=>{setRenamingTeacher({uid:t.uid,currentName:name});setRenameVal(name);}}
                      style={{...pill(G.surface,G.textS,G.borderM),fontSize:13,flexShrink:0}}>
                      Rename
                    </button>
                    {!isMe&&(
                      <button onClick={()=>handleDemote(t.uid)}
                        style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13,flexShrink:0}}>
                        Remove Admin
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          };
          return(
            <>
              {/* Invite link */}
              <div style={{background:G.blueL,border:"1px solid #BFDBFE",borderRadius:13,padding:"14px 16px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:G.navy,fontFamily:G.display}}>Generate Admin Invite Link</div>
                    <div style={{fontSize:14,color:"#1D4ED8",marginTop:3}}>Single-use · expires in 7 days</div>
                  </div>
                  <button onClick={handleGenerateInvite} disabled={inviteLoading}
                    style={{...pill(G.navy,"#fff","transparent"),padding:"8px 18px",fontSize:15,flexShrink:0}}>
                    {inviteLoading?"Generating…":"🔗 Generate Link"}
                  </button>
                </div>
                {inviteLink&&(
                  <div style={{marginTop:14}}>
                    <div style={{background:"#fff",border:"1px solid #BFDBFE",borderRadius:9,padding:"10px 14px",fontSize:14,fontFamily:G.mono,color:"#1A2F5A",wordBreak:"break-all",marginBottom:10}}>{inviteLink}</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>navigator.clipboard.writeText(inviteLink).then(()=>showAdminToast("Link copied!"))} style={{...pill("#1D4ED8","#fff","transparent"),fontSize:14,padding:"6px 16px"}}>Copy Link</button>
                      <button onClick={()=>setInviteLink(null)} style={{...pill("none",G.textM,G.border),fontSize:14,padding:"6px 16px"}}>Dismiss</button>
                    </div>
                    <div style={{fontSize:13,color:"#1D4ED8",marginTop:10}}>⚠ Share privately. Grants full admin access, single-use.</div>
                  </div>
                )}
              </div>

              {/* Admin list */}
              <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px"}}>
                <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>
                  Admins ({adminList.length})
                </div>
                <div style={{fontSize:14,color:G.textM,marginBottom:10}}>These accounts have full access to the admin panel. Open an institute to view its admins.</div>
                {manageSearchInput(manageAdminSearch,setManageAdminSearch,"Search admins by name, email, or institute")}
                {adminList.length===0
                  ?<div style={{fontSize:15,color:G.textM,padding:"20px 0",textAlign:"center"}}>No admins yet. Generate an invite link above.</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {adminInstitutes.map(inst=>{
                      const instAdmins = adminList.filter(t=>teacherBelongsToInstitute(t, inst) && matchesAdmin(t));
                      if(!instAdmins.length) return null;
                      const isOpen = openAdminInstitute===inst;
                      return(
                        <div key={inst}>
                          {instituteAccordionHeader({
                            icon:IconSettings,
                            title:inst,
                            count:instAdmins.length,
                            countLabel:"admin",
                            isOpen,
                            onClick:()=>setOpenAdminInstitute(curr=>curr===inst?null:inst),
                          })}
                          {isOpen&&(
                            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                              {instAdmins.map(t=>(
                                <AdminCard key={`${inst}_${t.uid}`} t={t} currentInstitute={inst} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {adminsWithoutInstitute.length>0&&(
                      <div>
                        {instituteAccordionHeader({
                          icon:IconSettings,
                          title:"No Institute Assigned",
                          count:adminsWithoutInstitute.length,
                          countLabel:"admin",
                          isOpen:openAdminInstitute==="__no_inst__",
                          onClick:()=>setOpenAdminInstitute(curr=>curr==="__no_inst__"?null:"__no_inst__"),
                        })}
                        {openAdminInstitute==="__no_inst__"&&(
                          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                            {adminsWithoutInstitute.map(t=>(
                              <AdminCard key={`noinst_${t.uid}`} t={t} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {adminList.length>0 && adminInstitutes.every(inst=>!adminList.some(t=>teacherBelongsToInstitute(t, inst) && matchesAdmin(t))) && adminsWithoutInstitute.length===0 && (
                      <div style={{fontSize:15,color:G.textM,padding:"10px 0",textAlign:"center"}}>No admins match your search.</div>
                    )}
                  </div>
                }
              </div>
            </>
          );
        })()}

        {/* ── TEACHERS TAB ── */}
        {manageTab==="teachers"&&(()=>{
          const teacherOnlyList = teachers.filter(t=>roles[t.uid]!=="admin");
          const scopedTeacherOnlyList = manageScopeInstitute
            ? teacherOnlyList.filter(t=>teacherBelongsToInstitute(t, manageScopeInstitute))
            : teacherOnlyList;
          const teacherSearchKey = manageTeacherSearch.trim().toLowerCase();
          const matchesTeacher = (teacher) => {
            if(!teacherSearchKey) return true;
            const name = getTeacherDisplayName(teacher).toLowerCase();
            const email = getTeacherEmail(teacher).toLowerCase();
            const instituteText = getTeacherInstituteList(teacher).join(" ").toLowerCase();
            return name.includes(teacherSearchKey) || email.includes(teacherSearchKey) || instituteText.includes(teacherSearchKey);
          };
          const teacherInstitutes = [...new Set([
            ...(manageScopeInstitute ? [manageScopeInstitute] : institutes),
            ...scopedTeacherOnlyList.flatMap(t=>getTeacherInstituteList(t)),
          ])]
            .filter(Boolean);
          const teacherInstituteGroups = teacherInstitutes
            .map(inst=>({
              inst,
              teachers:scopedTeacherOnlyList.filter(t=>teacherBelongsToInstitute(t, inst) && matchesTeacher(t)),
            }))
            .filter(group=>group.teachers.length>0)
            .sort((a,b)=>{
              if(manageTeacherSort==="count"){
                return (b.teachers.length-a.teachers.length) || exportTextSorter.compare(a.inst, b.inst);
              }
              return exportTextSorter.compare(a.inst, b.inst);
            });
          const teachersWithoutInstitute = manageScopeInstitute
            ? []
            : scopedTeacherOnlyList.filter(t=>!getTeacherInstituteList(t).length && matchesTeacher(t));
          const hasInstituteMatches = teacherInstituteGroups.length>0;
          const maxTeacherCount = Math.max(1, ...teacherInstituteGroups.map(group=>group.teachers.length));

          const TeacherCard = ({ t, currentInstitute = null }) => {
            const d = fullData[t.uid] || {};
            const name = getTeacherDisplayName(t);
            const email = getTeacherEmail(t);
            const isMe = t.uid===user.uid;
            const isSel = selTeacher===t.uid;
            const allTeacherInstitutes = getTeacherInstituteList(t);
            const otherInstitutes = currentInstitute
              ? allTeacherInstitutes.filter(value=>!sameInstituteName(value, currentInstitute))
              : allTeacherInstitutes;
            const classCount = fullData[t.uid] ? (d.classes||[]).length : (t.classCount||0);
            const hasLeftWorkspace = t.accountStatus === "departed" || t.active === false;
            const departedLabel = t.departedAt
              ? `Left ${new Date(Number(t.departedAt)).toLocaleDateString()}`
              : "Left workspace";

            return(
              <div style={{background:G.surface,borderRadius:12,border:`2px solid ${isSel?G.blue:hasLeftWorkspace?"#F5CACA":G.border}`,overflow:"hidden",boxShadow:isSel?`0 0 0 3px ${G.blueL}`:G.shadowSm,transition:"all 0.15s"}}>
                <div onClick={()=>{ensureFullData(t.uid);setSelTeacher(isSel?null:t.uid);}}
                  style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:42,height:42,borderRadius:11,background:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:G.blue,fontFamily:G.mono,flexShrink:0}}>
                    {(name[0]||"?").toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {name}
                      {isMe&&<span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>(you)</span>}
                      {hasLeftWorkspace&&<span style={{fontSize:11,color:G.red,background:G.redL,border:"1px solid #F5CACA",borderRadius:999,padding:"2px 7px",fontFamily:G.sans,fontWeight:800}}>Left workspace</span>}
                    </div>
                    <div style={{fontSize:13,color:G.textM,marginTop:3,fontFamily:G.mono}}>
                      {email || "Email not available"}
                    </div>
                    {otherInstitutes.length>0&&<AlsoAtInstitutes institutes={otherInstitutes} />}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                    <span style={{background:hasLeftWorkspace?G.redL:G.blueL,color:hasLeftWorkspace?G.red:G.blue,fontSize:12,fontWeight:700,borderRadius:20,padding:"3px 10px",fontFamily:G.sans}}>
                      {hasLeftWorkspace ? "Departed" : "👤 Teacher"}
                    </span>
                    <span style={{fontSize:11,color:hasLeftWorkspace?G.red:G.textL,fontFamily:G.mono}}>{hasLeftWorkspace ? departedLabel : `${classCount} classes · tap to manage`}</span>
                  </div>
                </div>

                {isSel&&(
                  <div style={{borderTop:`1px solid ${G.border}`,background:G.bg,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,fontFamily:G.sans}}>Assigned subjects</div>
                      {globalSubjects.filter(subject=>subject.active).length===0 ? (
                        <div style={{fontSize:13,color:G.textM,lineHeight:1.5}}>Create subjects in the Subject catalog before assigning them.</div>
                      ) : (
                        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                          {globalSubjects.filter(subject=>subject.active).map(subject=>{
                            const selected = teacherAssignedSubjectIds(t).includes(subject.id);
                            return (
                              <button key={`${t.uid}_${subject.id}`} onClick={()=>handleToggleTeacherSubject(t,subject)}
                                disabled={subjectAssignmentBusy===t.uid}
                                style={{...pill(selected?G.navy:G.surface,selected?"#fff":G.textS,selected?G.navy:G.borderM),fontSize:12.5,opacity:subjectAssignmentBusy===t.uid?0.65:1}}>
                                {selected?"✓ ":""}{subject.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {(d.classes||[]).length>0&&(
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,fontFamily:G.sans}}>Classes</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {(d.classes||[]).map(cls=>(
                            <div key={cls.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:G.surface,borderRadius:8,padding:"9px 12px",border:`1px solid ${G.border}`,gap:8}}>
                              <div>
                                <div style={{fontSize:14,fontWeight:600,color:G.text}}>{normaliseName(resolveAdminSectionName(cls.section, cls.institute, instSectionsAll) || cls.section)}</div>
                                <div style={{fontSize:12,color:G.textM}}>{cls.institute} · {cls.subject}</div>
                              </div>
                              <button onClick={()=>handleRemoveFromClass(t.uid,cls.id,normaliseName(resolveAdminSectionName(cls.section, cls.institute, instSectionsAll) || cls.section))}
                                style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:7,padding:"5px 11px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500,flexShrink:0}}>
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{display:"flex",flexWrap:"wrap",gap:8,paddingTop:4}}>
                      {renamingTeacher?.uid===t.uid?(
                        <div style={{display:"flex",gap:6,flex:1,minWidth:200}}>
                          <input value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&handleRenameTeacher(t.uid,renameVal)}
                            placeholder="New name…" autoFocus
                            style={{flex:1,padding:"7px 12px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                          <button onClick={()=>handleRenameTeacher(t.uid,renameVal)} style={{...pill(G.navy,"#fff","transparent"),fontSize:13,padding:"7px 14px"}}>Save</button>
                          <button onClick={()=>setRenamingTeacher(null)} style={{...pill("none",G.textM,G.border),fontSize:13,padding:"7px 10px"}}>✕</button>
                        </div>
                      ):(
                        <button onClick={()=>{setRenamingTeacher({uid:t.uid,currentName:name});setRenameVal(name);}}
                          style={{...pill(G.bg,G.textS,G.borderM),fontSize:13}}>✏ Rename</button>
                      )}

                      {!isMe&&(
                        <button onClick={()=>handlePromote(t.uid)} style={{...pill(G.blueL,G.blue,G.borderM),fontSize:13}}>Make Admin</button>
                      )}

                      <button onClick={()=>{setView("main");setSelP2(t.uid);setTab("teacher");setMobileStep(2);}}
                        style={{...pill(G.bg,G.textS,G.borderM),fontSize:13}}>📋 View Entries</button>

                      <button onClick={()=>handleRepairTeacherIndex(t.uid)}
                        disabled={repairingTeacherUid===t.uid}
                        style={{...pill("#EEF2FF",G.blue,"#BFDBFE"),fontSize:13,opacity:repairingTeacherUid===t.uid?0.7:1,cursor:repairingTeacherUid===t.uid?"not-allowed":"pointer"}}>
                        {repairingTeacherUid===t.uid ? "🛠 Repairing…" : "🛠 Repair Index"}
                      </button>

                      {!isMe&&(
                        <button onClick={()=>handleRemoveTeacher(t.uid,name)}
                          style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13}}>🚫 Remove Teacher</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return(
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px"}}>
              <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>
                {manageScopeInstitute ? `Teachers at ${manageScopeInstitute}` : "All teachers"} ({scopedTeacherOnlyList.length})
              </div>
              <div style={{fontSize:14,color:G.textM,marginBottom:10}}>
                {manageScopeInstitute
                  ? "Manage the teacher accounts, assigned subjects, and classes connected to this institute."
                  : `${teacherInstituteGroups.length} institutes${teacherInstituteGroups.length ? ` · ${manageTeacherSort==="count" ? "sorted by teacher count" : "sorted A-Z"}` : ""}`}
              </div>
              {manageSearchInput(manageTeacherSearch,setManageTeacherSearch,"Search teachers by name, email, or institute")}
              {!manageScopeInstitute&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                  {[
                    {key:"count",label:"Most teachers"},
                    {key:"name",label:"Name A-Z"},
                  ].map(item=>(
                    <button key={item.key} onClick={()=>setManageTeacherSort(item.key)} style={{border:`1px solid ${manageTeacherSort===item.key?G.navy:G.border}`,borderRadius:999,padding:"6px 12px",background:manageTeacherSort===item.key?G.navy:"#FFFFFF",color:manageTeacherSort===item.key?"#FFFFFF":G.textM,fontFamily:G.sans,fontSize:11.5,fontWeight:850,cursor:"pointer"}}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {scopedTeacherOnlyList.length===0
                ?<div style={{fontSize:15,color:G.textM,padding:"20px 0",textAlign:"center"}}>{manageScopeInstitute ? "No teachers are connected to this institute yet." : "No teachers found yet."}</div>
                :<div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {!manageScopeInstitute&&teacherInstituteGroups.length>0&&(
                    <div style={{border:`1px solid ${G.border}`,borderRadius:12,overflow:"hidden",background:"#FFFFFF"}}>
                      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.9fr) 80px 140px 90px",gap:12,padding:"0 10px 8px",borderBottom:`1px solid ${G.border}`,fontSize:10.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:0.6,fontFamily:G.mono}}>
                        <div>Institute</div>
                        <div>Teachers</div>
                        <div></div>
                        <div></div>
                      </div>
                      {teacherInstituteGroups.map(({ inst, teachers: instTeachers }, index)=>{
                        const fillWidth = Math.max(3, Math.round((instTeachers.length / maxTeacherCount) * 100));
                        return (
                          <button key={inst} onClick={()=>{
                            warmTeacherUids(instTeachers.map(t=>t.uid), inst);
                            openInstituteArea(inst, "teachers");
                          }} style={{width:"100%",display:"grid",gridTemplateColumns:"minmax(0,1.9fr) 80px 140px 90px",alignItems:"center",gap:12,border:"none",borderTop:index===0?"none":`1px solid #EEF1F6`,padding:"12px 10px",background:"#FFFFFF",fontFamily:G.sans,cursor:"pointer",textAlign:"left"}}>
                            <span style={{fontSize:13.5,fontWeight:700,color:G.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inst}</span>
                            <span style={{fontSize:13,fontWeight:800,color:G.text}}>{instTeachers.length}</span>
                            <span style={{display:"inline-flex",alignItems:"center"}}>
                              <span style={{width:"100%",maxWidth:120,height:6,background:G.border,borderRadius:999,overflow:"hidden"}}>
                                <span style={{display:"block",width:`${fillWidth}%`,height:"100%",background:G.blueV,borderRadius:999}}/>
                              </span>
                            </span>
                            <span style={{justifySelf:"end",fontSize:12.5,fontWeight:800,color:G.textL}}>Open &#8250;</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {manageScopeInstitute&&teacherInstituteGroups.map(({ inst, teachers: instTeachers })=>(
                    <div key={inst}>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {instTeachers.map(t=>(
                          <TeacherCard key={`${inst}_${t.uid}`} t={t} currentInstitute={inst} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {teachersWithoutInstitute.length>0&&(
                    <div>
                      {instituteAccordionHeader({
                        icon:IconBuilding,
                        title:"No Institute Assigned",
                        count:teachersWithoutInstitute.length,
                        countLabel:"teacher",
                        isOpen:openTeacherInstitute==="__no_inst__",
                        onClick:()=>{
                          setOpenTeacherInstitute(curr=>curr==="__no_inst__"?null:"__no_inst__");
                        },
                      })}
                      {openTeacherInstitute==="__no_inst__"&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                          {teachersWithoutInstitute.map(t=>(
                            <TeacherCard key={`noinst_${t.uid}`} t={t} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {scopedTeacherOnlyList.length>0 && !hasInstituteMatches && teachersWithoutInstitute.length===0 && (
                    <div style={{fontSize:15,color:G.textM,padding:"10px 0",textAlign:"center"}}>No teachers match your search.</div>
                  )}
                </div>
              }
            </div>
          );
        })()}
      </>)}
      </main>
      </div>
    </div>
  );
  }

  // ── MAIN PANEL VIEW ───────────────────────────────────────────────────────
  // ── MOBILE: renders each step as a standalone full-page view ────────────────
  // This avoids all flex-height issues that cause list clipping
  if(isMobile) {
    const mobilePageShellStyle = {
      minHeight:"100svh",
      width:"100%",
      overflowX:"hidden",
      background:G.bg,
      fontFamily:G.sans,
      paddingBottom:"calc(112px + env(safe-area-inset-bottom, 0px))",
    };
    const mobilePageInnerStyle = { padding:"10px 12px 18px" };
    const mobileBottomKey = mobileSurface==="profile"
      ? "profile"
      : mobileSurface==="centreSummary"
        ? "report"
      : !selInst
        ? "institutes"
        : tab==="teacher"
          ? "teachers"
          : "classes";

    const MobileMotionStyles = () => (
      <style>{`
        .admin-mobile-touch{
          -webkit-tap-highlight-color: transparent;
          transition: transform 120ms cubic-bezier(.22,.8,.24,1), box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease;
          will-change: transform, opacity;
        }
        .admin-mobile-touch:active{
          transform: translateY(1px) scale(0.989);
        }
        .admin-mobile-card-press:active{
          transform: translateY(1px) scale(0.993);
        }
      `}</style>
    );

    const MobileNav = ()=>(
      <div style={{padding:"10px 12px 0"}}>
        <div style={{
          background:"#FFFFFF",
          border:`1px solid ${G.border}`,
          borderRadius:22,
          padding:"12px 15px",
          boxShadow:reduceEffects ? "none" : "0 12px 28px rgba(15,23,42,0.07)",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <div style={{width:42,height:42,background:G.blueV,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.18)"}}>
              <svg width="24" height="24" viewBox="0 0 18 18" fill="none"><path d="M4 3H7V13H14V16H4V3Z" fill="white"/></svg>
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:G.display,fontSize:24,fontWeight:800,color:G.text,lineHeight:1,letterSpacing:-0.6}}>Ledgr</div>
            </div>
          </div>
        </div>
      </div>
    );

    const renderAdminProfileStatGrid = (compact = false) => (
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:compact ? 8 : 10}}>
        {adminWorkspaceStats.map(item=>(
          <div key={item.key} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:compact ? 14 : 16,padding:compact ? "10px 12px" : "12px 14px",boxShadow:reduceEffects ? "none" : "0 10px 24px rgba(15,23,42,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{width:30,height:30,borderRadius:10,background:item.tone,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <AppIcon icon={item.icon} size={16} color={item.color} />
              </div>
              <div style={{fontSize:10,fontWeight:700,fontFamily:G.mono,letterSpacing:0.5,textTransform:"uppercase",color:G.textL}}>{item.label}</div>
            </div>
            <div style={{fontSize:compact ? 24 : 28,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1,marginTop:10}}>{item.value}</div>
          </div>
        ))}
      </div>
    );

    const mobileProfileActionStyle = (danger = false) => ({
      width:"100%",
      background:danger ? "#FFF4F4" : "#FFFFFF",
      border:danger ? "1px solid #F4CACA" : `1px solid ${G.border}`,
      borderRadius:15,
      padding:"11px 13px",
      display:"flex",
      alignItems:"center",
      gap:12,
      cursor:"pointer",
      textAlign:"left",
      boxShadow:reduceEffects ? "none" : "0 10px 22px rgba(15,23,42,0.05)",
      WebkitTapHighlightColor:"transparent",
    });

    const MobileProfileAction = ({ icon, title, subtitle, onClick, danger = false, badge = null }) => (
      <button className="admin-mobile-touch" onClick={onClick} style={mobileProfileActionStyle(danger)}>
        <div style={{width:38,height:38,borderRadius:12,background:danger ? "#FDE6E6" : "#EEF4FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AppIcon icon={icon} size={18} color={danger ? G.red : G.blue} />
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:13.5,fontWeight:700,color:danger ? G.red : G.text,fontFamily:G.sans}}>{title}</div>
          <div style={{fontSize:11.5,color:G.textM,marginTop:2,lineHeight:1.45}}>{subtitle}</div>
        </div>
        {badge!=null && badge!==0 && (
          <span style={{background:danger ? "#FCA5A5" : G.blueL,color:danger ? "#7F1D1D" : G.blue,borderRadius:999,padding:"4px 9px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,flexShrink:0}}>
            {badge}
          </span>
        )}
        <AppIcon icon={IconChevronRight} size={18} color={danger ? G.red : G.textL} />
      </button>
    );

    const MobileManageTile = ({ icon, title, subtitle, count, onClick }) => (
      <button
        className="admin-mobile-touch"
        onClick={onClick}
        style={{
          width:"100%",
          background:"#FFFFFF",
          border:`1px solid ${G.border}`,
          borderRadius:16,
          padding:"12px 12px 11px",
          display:"flex",
          alignItems:"flex-start",
          gap:10,
          cursor:"pointer",
          textAlign:"left",
          boxShadow:reduceEffects ? "none" : "0 10px 22px rgba(15,23,42,0.05)",
          WebkitTapHighlightColor:"transparent",
        }}>
        <div style={{width:36,height:36,borderRadius:12,background:"#EEF4FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AppIcon icon={icon} size={17} color={G.blue} />
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <div style={{fontSize:13.5,fontWeight:800,color:G.text,fontFamily:G.sans}}>{title}</div>
            <span style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,color:G.textL,flexShrink:0}}>
              {count}
            </span>
          </div>
          <div style={{fontSize:11.5,color:G.textM,marginTop:4,lineHeight:1.45}}>{subtitle}</div>
        </div>
      </button>
    );

    const MobileCentreSummaryScreen = () => (
      <div style={mobilePageShellStyle}>
        <MobileMotionStyles />
        {instituteGlanceOptionsOpen&&(
          <LedgrReportOptionsModal
            institutes={institutes}
            period={instituteGlancePeriod}
            month={instituteGlanceMonth}
            rangeStart={instituteGlanceRangeStart}
            rangeEnd={instituteGlanceRangeEnd}
            schedule={ledgrReportSchedule}
            scheduleLoading={ledgrReportScheduleLoading}
            scheduleSaving={ledgrReportScheduleSaving}
            exportDisabled={instituteGlanceExportDisabled}
            busyFormat={instituteGlanceExportBusy}
            initialMode={instituteGlanceOptionsMode}
            context={instituteGlanceOptionsContext}
            onClose={()=>!instituteGlanceExportBusy&&!ledgrReportScheduleSaving&&setInstituteGlanceOptionsOpen(false)}
            onApply={applyInstituteGlanceOptions}
            onSaveSchedule={saveInstituteGlanceSchedule}
          />
        )}
        {telegramDashboardOpen&&(
          <LedgrTelegramDashboardModal
            institutes={institutes}
            schedule={ledgrReportSchedule}
            config={ledgrTelegramConfig}
            loading={ledgrTelegramLoading}
            saving={ledgrTelegramSaving}
            sendBusy={ledgrTelegramSending}
            onClose={()=>!ledgrTelegramSaving&&setTelegramDashboardOpen(false)}
            onSave={saveLedgrTelegramDashboard}
            onOpenSchedule={openLedgrTelegramSchedule}
            onSendNow={sendLedgrTelegramNow}
          />
        )}
        <AdminToastBanner message={adminToast} />
        <MobileNav/>
        <div style={mobilePageInnerStyle}>
          <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>All institutes</div>
                <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.05,marginTop:7}}>Ledgr Report</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:8}}>
                  Submissions, pending teachers, sections, and hours.
                </div>
              </div>
              <button
                className="admin-mobile-touch"
                onClick={openMobileProfile}
                style={{height:36,padding:"0 12px",borderRadius:12,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:12,fontWeight:700,fontFamily:G.sans,cursor:"pointer",flexShrink:0}}>
                Profile
              </button>
            </div>
            {renderInstituteGlanceProgressBlock(true)}
            {!!instituteGlanceReport.rows.length&&renderInstituteGlanceStatGrid(true)}
            {renderInstituteGlanceActions(true)}
            {!!instituteGlanceReport.error&&(
              <div style={{marginTop:12,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:15,padding:"13px 14px"}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"#9A3412",fontFamily:G.sans}}>Some data could not be loaded</div>
                <div style={{fontSize:12,color:"#9A3412",lineHeight:1.55,marginTop:6}}>
                  {instituteGlanceReport.error}
                </div>
              </div>
            )}
          </div>

          {instituteGlanceHoldListOnMobile ? (
            renderInstituteGlanceMobileLoadingNotice()
          ) : (
            <div style={{display:"grid",gap:10}}>
              {renderSharedInstituteGlanceList({ interactive:true })}
            </div>
          )}
        </div>
        <MobileBottomNav/>
      </div>
    );

    const MobileProfileScreen = () => (
      <div style={mobilePageShellStyle}>
        <MobileMotionStyles />
        {feedbackOpen&&(
          <FeedbackInboxModal
            threads={feedbackThreads}
            selectedUid={feedbackSelectedUid}
            messages={feedbackMessages}
            reply={feedbackReply}
            busy={feedbackBusy}
            onSelect={uid=>{setFeedbackSelectedUid(uid);markFeedbackThreadRead(uid).catch(()=>{});}}
            onReplyChange={setFeedbackReply}
            onSend={sendFeedbackReply}
            onToggleResolved={toggleFeedbackResolved}
            onClose={()=>setFeedbackOpen(false)}
          />
        )}
        {binView&&<AdminBinModal/>}
        {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        <AdminToastBanner message={adminToast} />
        <MobileNav/>
        <div style={mobilePageInnerStyle}>
          <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14}}>
              <div style={{display:"flex",gap:12,minWidth:0,flex:1}}>
                <div style={{width:48,height:48,borderRadius:17,background:"#EEF4FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:800,color:G.blue,fontFamily:G.display,flexShrink:0}}>
                  {(user?.email||"A").charAt(0).toUpperCase()}
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Admin settings</div>
                  <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.05,marginTop:7}}>Administrator</div>
                  <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:8,wordBreak:"break-word"}}>{user?.email || "—"}</div>
                </div>
              </div>
              <span style={{...mobileTonePillStyle("blue"),borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,whiteSpace:"nowrap"}}>
                {currentSession()}
              </span>
            </div>
            <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:14}}>
              Workspace totals, recovery tools, and sign-out live here so the admin flow stays focused on institutes, classes, and teachers.
            </div>
          </div>

          <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Workspace snapshot</div>
                <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginTop:7}}>Everything at a glance</div>
              </div>
              {loadingUids.size>0&&(
                <span style={{...mobileTonePillStyle("blue"),borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:700,fontFamily:G.mono}}>
                  Syncing {loadingUids.size}
                </span>
              )}
            </div>
            {renderAdminProfileStatGrid(true)}
          </div>

          <MobileProfileAction
            icon={IconChartBar}
            title="Ledgr Report"
            subtitle="See who filled, who is pending, sections taught, and study hours."
            onClick={openMobileCentreSummary}
            badge={instituteGlanceReport.loading
              ? `${instituteGlanceReadyCount}/${Math.max(instituteGlanceReport.totalInstitutes || 0, instituteGlanceReport.summary.totalInstitutes || 0)}`
              : instituteGlanceReport.ready
                ? "Ready"
                : null}
          />
          <MobileProfileAction
            icon={IconSend}
            title="Messenger"
            subtitle="Telegram live now, WhatsApp next, plus routing and schedule linkage."
            onClick={openLedgrTelegramDashboard}
            badge={ledgrTelegramLoading
              ? null
              : ledgrTelegramRecipientStats.active
                ? `${ledgrTelegramRecipientStats.active} live`
                : "Setup"}
          />

          <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Control centre</div>
                <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginTop:7}}>Manage the workspace</div>
              </div>
              <span style={{...mobileTonePillStyle("blue"),borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:700,fontFamily:G.mono}}>
                5 tools
              </span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
              <MobileManageTile
                icon={IconUsersGroup}
                title="Teachers"
                subtitle="Accounts, classes, assignments"
                count={teachers.filter(t=>roles[t.uid]!=="admin").length}
                onClick={()=>openMobileManageArea("teachers")}
              />
              <MobileManageTile
                icon={IconBooks}
                title="Syllabus"
                subtitle="Shared chapters and topics"
                count={syllabusTemplates.length}
                onClick={()=>openMobileManageArea("subjects")}
              />
              <MobileManageTile
                icon={IconSchool}
                title="Sections"
                subtitle={selInst ? "Groups for current institute" : "Groups and timetables"}
                count={institutes.length}
                onClick={()=>openMobileManageArea("sections")}
              />
              <MobileManageTile
                icon={IconBuilding}
                title="Institutes"
                subtitle="Names, structure, active list"
                count={institutes.length}
                onClick={()=>openMobileManageArea("institutes")}
              />
              <MobileManageTile
                icon={IconSettings}
                title="Admins"
                subtitle="Roles and permissions"
                count={teachers.filter(t=>roles[t.uid]==="admin").length}
                onClick={()=>openMobileManageArea("admins")}
              />
            </div>
          </div>

          <div style={{display:"grid",gap:10}}>
            <MobileProfileAction
              icon={IconMessageCircle}
              title="Teacher Feedback"
              subtitle="Read issues and reply directly to teachers."
              badge={feedbackUnreadCount>0 ? feedbackUnreadCount : null}
              onClick={openFeedbackInbox}
            />
            <MobileProfileAction
              icon={IconTrash}
              title="Recycle Bin"
              subtitle="Review deleted classes, institutes, and entries."
              badge={adminBin.length>0 ? adminBin.length : null}
              onClick={()=>setBinView(true)}
            />
            <MobileProfileAction
              icon={IconLogout}
              title="Sign Out"
              subtitle="Leave the admin workspace on this device."
              danger
              onClick={()=>logout()}
            />
          </div>
        </div>
        <MobileBottomNav/>
      </div>
    );

    const MobileBreadcrumb = () => {
      if(mobileSurface==="profile" || mobileStep===0) return null;
      const directFullView = fullView?.source === "mobile-list";
      const step2Action = () => {
        if(directFullView){
          setFullView(null);
          setSelP2(null);
          setSelP3(null);
          setMobileStep(1);
          return;
        }
        if(isAggregateSelection){
          setMobileStep(1);
          setSelP3(null);
          return;
        }
        setMobileStep(2);
        setSelP3(null);
        setFullView(null);
      };
      return (
        <div style={{padding:"10px 12px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            <button
              className="admin-mobile-touch"
              onClick={goMobileBack}
              style={{display:"inline-flex",alignItems:"center",gap:6,height:34,borderRadius:13,border:`1px solid ${G.border}`,background:"#FFFFFF",padding:"0 11px",cursor:"pointer",color:G.textS,fontFamily:G.sans,fontSize:12,fontWeight:700,flexShrink:0,boxShadow:reduceEffects ? "none" : G.shadowSm}}>
              <AppIcon icon={IconChevronLeft} size={15} color={G.textS} />
              Back
            </button>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1,overflowX:"auto",scrollbarWidth:"none",padding:"4px 2px"}}>
              <span onClick={openMobileInstituteHome} style={{fontSize:12,color:G.textL,cursor:"pointer",fontFamily:G.sans,whiteSpace:"nowrap"}}>Institutes</span>
              {mobileStep>=1&&selInst&&<><AppIcon icon={IconChevronRight} size={13} color={G.textL} /><span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);setFullView(null);}} style={{fontSize:12,color:mobileStep===1?"#111827":G.textM,cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===1?700:600,whiteSpace:"nowrap"}}>{selInst}</span></>}
              {mobileStep>=2&&selP2&&<><AppIcon icon={IconChevronRight} size={13} color={G.textL} /><span onClick={step2Action} style={{fontSize:12,color:mobileStep===2?"#111827":G.textM,cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===2?700:600,whiteSpace:"nowrap"}}>{p2Label(selP2)}</span></>}
              {mobileStep>=3&&(isInstituteOverviewStep||selP3||isAggregateSelection||isScopedFullView)&&<><AppIcon icon={IconChevronRight} size={13} color={G.textL} /><span style={{fontSize:12,color:G.text,fontFamily:G.sans,fontWeight:700,whiteSpace:"nowrap"}}>{mobileStep3Label}</span></>}
            </div>
            {selInst&&(
              <button
                className="admin-mobile-touch"
                onClick={()=>setExportOpen(true)}
                style={{display:"inline-flex",alignItems:"center",gap:6,height:34,borderRadius:13,border:"1px solid #C7D7F5",background:"#EEF4FF",padding:"0 11px",cursor:"pointer",color:G.blue,fontFamily:G.sans,fontSize:12,fontWeight:800,flexShrink:0,boxShadow:reduceEffects ? "none" : G.shadowSm}}>
                <AppIcon icon={IconDownload} size={15} color={G.blue} />
                Export
              </button>
            )}
          </div>
        </div>
      );
    };

    const mobileBottomItems = !selInst
      ? [
          { key:"institutes", label:"All institutes", icon:IconBuilding, onClick:openMobileInstituteHome },
          { key:"report", label:"Report", icon:IconChartBar, onClick:openDailyLedgrReport },
          { key:"profile", label:"Profile", icon:IconUser, onClick:openMobileProfile },
        ]
      : [
          { key:"institutes", label:"All institutes", icon:IconBuilding, onClick:openMobileInstituteHome },
          { key:"classes", label:"Classes", icon:IconSchool, onClick:()=>openMobileWorkspaceTab("class") },
          { key:"teachers", label:"Teachers", icon:IconUsersGroup, onClick:()=>openMobileWorkspaceTab("teacher") },
          { key:"profile", label:"Profile", icon:IconUser, onClick:openMobileProfile },
        ];

    const MobileBottomNav = () => (
      <div style={{position:"fixed",left:10,right:10,bottom:"max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))",zIndex:150,pointerEvents:"none"}}>
        <div style={{background:"rgba(255,255,255,0.98)",border:`1px solid ${G.border}`,borderRadius:24,padding:"7px 8px",boxShadow:reduceEffects ? "none" : "0 18px 36px rgba(15,23,42,0.12)",display:"grid",gridTemplateColumns:`repeat(${mobileBottomItems.length}, minmax(0, 1fr))`,gap:5,pointerEvents:"auto"}}>
          {mobileBottomItems.map(item=>{
            const active = mobileBottomKey===item.key;
            return (
              <button
                className="admin-mobile-touch"
                key={item.key}
                onClick={item.onClick}
                style={{
                  minHeight:50,
                  borderRadius:17,
                  border:"none",
                  background:active ? "#E8F0FF" : "transparent",
                  color:active ? G.navy : G.textL,
                  display:"flex",
                  flexDirection:"column",
                  alignItems:"center",
                  justifyContent:"center",
                  gap:3,
                  padding:"0 4px",
                  cursor:"pointer",
                  fontFamily:G.sans,
                  fontSize:10.8,
                  fontWeight:active ? 800 : 700,
                  WebkitTapHighlightColor:"transparent",
                  transition:"background 0.18s ease,color 0.18s ease",
                }}>
                <AppIcon icon={item.icon} size={19} color={active ? G.navy : G.textL} />
                <span style={{lineHeight:1.05,whiteSpace:"normal",textAlign:"center"}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    const mobileWorkspaceCardStyle = {
      background:"#FFFFFF",
      border:`1px solid ${G.border}`,
      borderRadius:18,
      padding:"12px 13px 12px",
      boxShadow:reduceEffects ? "none" : "0 12px 24px rgba(15,23,42,0.05)",
    };
    const mobileControlStackStyle = {
      background:"rgba(255,255,255,0.96)",
      border:`1px solid ${G.border}`,
      borderRadius:16,
      padding:"9px",
      boxShadow:reduceEffects ? "none" : G.shadowSm,
      position:"sticky",
      top:8,
      zIndex:12,
      backdropFilter:"blur(10px)",
      WebkitBackdropFilter:"blur(10px)",
    };
    const mobileRowCardStyle = {
      background:G.surface,
      border:`1px solid ${G.border}`,
      borderRadius:16,
      padding:"11px 12px",
      boxShadow:reduceEffects ? "none" : "0 10px 22px rgba(15,23,42,0.05)",
      transition:"transform 0.16s cubic-bezier(.2,.8,.2,1), box-shadow 0.18s ease",
    };
    const mobileTonePillStyle = (tone = "neutral") => {
      if(tone === "primary"){
        return { background:G.navy, color:"#fff", border:"1px solid transparent" };
      }
      if(tone === "good"){
        return { background:"#DCFCE7", color:"#166534", border:"1px solid #BBF7D0" };
      }
      if(tone === "soft"){
        return { background:G.bg, color:G.textS, border:`1px solid ${G.border}` };
      }
      if(tone === "blue"){
        return { background:"#EEF4FF", color:G.blue, border:"1px solid #C7D7F5" };
      }
      return { background:"#FFFFFF", color:G.textS, border:`1px solid ${G.border}` };
    };
    const mobilePill = (label, tone = "neutral", key = null) => (
      <span
        key={key || label}
        style={{
          ...mobileTonePillStyle(tone),
          display:"inline-flex",
          alignItems:"center",
          gap:6,
          borderRadius:999,
          padding:"6px 10px",
          fontSize:11,
          fontFamily:G.mono,
          fontWeight:700,
          lineHeight:1.2,
          maxWidth:"100%",
        }}>
        {label}
      </span>
    );
    const mobileActionButtonStyle = (kind = "primary") => ({
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      gap:8,
      minHeight:38,
      borderRadius:12,
      padding:"0 12px",
      fontSize:12,
      fontWeight:700,
      fontFamily:G.sans,
      cursor:"pointer",
      WebkitTapHighlightColor:"transparent",
      border:kind==="primary" ? "none" : `1px solid ${G.border}`,
      background:kind==="primary" ? G.navy : "#fff",
      color:kind==="primary" ? "#fff" : G.textS,
      boxShadow:kind==="primary" && !reduceEffects ? G.shadowSm : "none",
      transition:"transform 0.16s cubic-bezier(.2,.8,.2,1), background 0.18s ease, color 0.18s ease",
    });
    const mobileCountDot = (filled = false) => ({
      width:14,
      height:14,
      borderRadius:"50%",
      border:`2px solid ${filled ? "#15803D" : G.textL}`,
      background:filled ? "#22C55E" : "transparent",
      boxShadow:filled ? "0 0 0 4px rgba(34,197,94,0.14)" : "none",
      flexShrink:0,
    });

    if(mobileSurface==="profile") return <MobileProfileScreen/>;
    if(mobileSurface==="centreSummary") return <MobileCentreSummaryScreen/>;

    // ── STEP 0: Institute list ────────────────────────────────────────────────
    if(mobileStep===0) return(
      <div style={mobilePageShellStyle}>
        <MobileMotionStyles />
        {binView&&<AdminBinModal/>}
        {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        <MobileNav/>
        <div style={mobilePageInnerStyle}>
          <div style={{fontSize:11,fontWeight:700,color:G.textL,letterSpacing:1.5,fontFamily:G.sans,textTransform:"uppercase",marginBottom:10}}>Institutes</div>
          {renderSearchInput(instSearch,setInstSearch,"Search institutes",true)}
          <div style={{fontSize:12,color:G.textL,margin:"8px 2px 10px"}}>{visibleInstitutes.length} of {institutes.length} institutes</div>
              {visibleInstitutes.map((inst,idx)=>{
            const stats = instituteStats[inst] || { teacherCount:0, classCount:0 };
            const tCount = stats.teacherCount;
            const clsCount = stats.classCount;
            const isDragging=dragInst===inst;
            const isDragOver=dragOverInst===inst&&dragInst!==inst;
            return(
              <div key={inst}
                draggable
                onDragStart={e=>{setDragInst(inst);dragInstRef.current=inst;e.dataTransfer.effectAllowed="move";}}
                onDragOver={e=>{e.preventDefault();if(dragInstRef.current!==inst)setDragOverInst(inst);}}
                onDragLeave={()=>setDragOverInst(null)}
                onDrop={e=>{
                  e.preventDefault();
                  if(!dragInstRef.current||dragInstRef.current===inst)return;
                  const from=institutes.indexOf(dragInstRef.current);
                  const to=institutes.indexOf(inst);
                  if(from<0||to<0)return;
                  const reordered=[...institutes];
                  const [moved]=reordered.splice(from,1);
                  reordered.splice(to,0,moved);
                  saveInstOrder(reordered);
                  setDragInst(null);setDragOverInst(null);dragInstRef.current=null;
                }}
                onDragEnd={()=>{setDragInst(null);setDragOverInst(null);dragInstRef.current=null;}}
                onClick={()=>handleInstituteSelect(inst)}
                onTouchStart={e=>beginInstituteTouch(e, inst, { longPressDrag:true })}
                onTouchMove={e=>moveInstituteTouch(e, { longPressDrag:true })}
                onTouchEnd={e=>endInstituteTouch(e, inst, { longPressDrag:true })}
                onTouchCancel={()=>cancelInstituteTouch(inst)}
                data-inst={inst}
                className="admin-mobile-touch admin-mobile-card-press"
                style={{
                  background:isDragOver?G.blueL:G.surface,
                  borderRadius:16,
                  border:isDragging?`2px dashed ${G.blue}`:`1px solid ${isDragOver?G.blue:G.border}`,
                  padding:"12px",marginBottom:8,
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  boxShadow:isDragging?"0 8px 24px rgba(0,0,0,0.15)":"0 10px 22px rgba(15,23,42,0.05)",
                  cursor:"grab",transition:"all 0.15s",
                  opacity:isDragging?0.5:1,
                  transform:isDragging?"scale(1.01)":"scale(1)",
                  WebkitUserSelect:"none",userSelect:"none",
                  touchAction:dragInst?"none":"pan-y",
                  WebkitTapHighlightColor:"transparent",
                }}>
                {/* Drag handle — pure CSS dots, renders on all platforms */}
                <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:12,height:18,flexShrink:0,marginRight:10,cursor:"grab",padding:"1px 0",userSelect:"none",WebkitUserSelect:"none"}}>
                  {[0,1,2].map(r=>(
                    <div key={r} style={{display:"flex",justifyContent:"space-between",width:12}}>
                      <div style={{width:4,height:4,borderRadius:"50%",background:"#B8CEC2"}}/>
                      <div style={{width:4,height:4,borderRadius:"50%",background:"#B8CEC2"}}/>
                    </div>
                  ))}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15.5,fontWeight:800,color:isDragOver?G.blue:G.text,fontFamily:G.display,lineHeight:1.15}}>{inst}</div>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                    <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 8px",fontSize:11,fontFamily:G.mono,fontWeight:700}}>{clsCount} class{clsCount!==1?"es":""}</span>
                    <span style={{fontSize:12,color:G.textM,fontFamily:G.sans,alignSelf:"center"}}>{tCount} teacher{tCount!==1?"s":""}</span>
                  </div>
                </div>
                <span style={{width:32,height:32,borderRadius:12,background:"#F8FAFC",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:G.textL,flexShrink:0}}>›</span>
              </div>
            );
          })}
          {visibleInstitutes.length===0&&(
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,padding:"18px 16px",textAlign:"center",color:G.textM}}>
              No institutes match your search.
            </div>
          )}
          <button
            className="admin-mobile-touch"
            type="button"
            onClick={openDailyLedgrReport}
            style={{
              width:"100%",
              background:"linear-gradient(180deg,#F8FBFF 0%,#EEF4FF 100%)",
              border:"1px solid #C7D7F5",
              borderRadius:18,
              padding:"13px 13px",
              display:"flex",
              alignItems:"center",
              gap:12,
              cursor:"pointer",
              textAlign:"left",
              boxShadow:reduceEffects ? "none" : "0 12px 24px rgba(29,78,216,0.08)",
              WebkitTapHighlightColor:"transparent",
              marginTop:10,
            }}>
            <div style={{width:40,height:40,borderRadius:14,background:G.blue,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <AppIcon icon={IconChartBar} size={19} color="#FFFFFF" />
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:G.text,fontFamily:G.sans,lineHeight:1.2}}>Ledgr Daily Report</div>
              <div style={{fontSize:12,color:G.textM,fontFamily:G.sans,lineHeight:1.4,marginTop:3}}>All institutes at a glance</div>
            </div>
            <AppIcon icon={IconChevronRight} size={18} color={G.blue} />
          </button>
        </div>
        <MobileBottomNav/>
      </div>
    );
    if(mobileStep===1) return(
      <div style={mobilePageShellStyle}>
        <MobileMotionStyles />
        {binView&&<AdminBinModal/>}
        {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
        {legacySectionRepair&&(
          <LegacySectionRepairModal
            scopeLabel={legacySectionRepair.scopeLabel}
            items={legacySectionRepair.items}
            selections={legacySectionRepair.selections}
            busy={legacySectionRepair.busy}
            error={legacySectionRepair.error}
            onChange={setLegacySectionRepairSelection}
            onClose={()=>!legacySectionRepair.busy&&setLegacySectionRepair(null)}
            onConfirm={applyLegacySectionRepair}
          />
        )}
        {pendingSectionRenameModal}
        <AdminToastBanner message={adminToast} />
        <MobileBreadcrumb/>
        <div style={mobilePageInnerStyle}>
          <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>
                  Institute workspace
                </div>
                <h2 style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display,margin:"7px 0 0",lineHeight:1.05}}>
                  {selInst}
                </h2>
                <div style={{fontSize:12.5,color:G.textM,lineHeight:1.5,marginTop:7}}>
                  {currentSession()} session · {tab==="class" ? visibleInstClassCountLabel : `${visibleInstTeachers.length} of ${instTeachers.length} teachers`}
                </div>
              </div>
              <span style={{...mobileTonePillStyle("blue"),borderRadius:999,padding:"6px 10px",fontSize:11,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                {overviewPeriodText}
              </span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
              {mobilePill(`${instClasses.length} classes`, "soft")}
              {mobilePill(`${selectedInstitutePeriodCount} logs`, "soft")}
              {mobilePill(`${formatDurationShort(classSubjectSummary.totalMinutes)} taught`, "good")}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
              <button className="admin-mobile-touch" onClick={openMobileInstituteOverview} style={mobileActionButtonStyle("primary")}>
                Institute overview
              </button>
            </div>
          </div>

          <div style={{...mobileControlStackStyle,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Current view</div>
                <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginTop:7}}>
                  {tab==="class" ? "Classes" : "Teachers"}
                </div>
              </div>
              <span style={{...mobileTonePillStyle("blue"),borderRadius:999,padding:"6px 10px",fontSize:10.5,fontWeight:700,fontFamily:G.mono}}>
                {tab==="class" ? visibleInstClassCountLabel : `${visibleInstTeachers.length} of ${instTeachers.length} teachers`}
              </span>
            </div>
            <div style={{display:"flex",justifyContent:"flex-start",gap:8,flexWrap:"wrap",marginTop:10}}>
              <button className="admin-mobile-touch" onClick={()=>openAggregateView(tab)} style={mobileActionButtonStyle("ghost")}>
                {tab==="class" ? "Open all classes" : "Open all teachers"}
              </button>
            </div>
            {tab==="class"&&<div style={{marginTop:8}}>{renderProgramFilterBar(true)}</div>}
          </div>

          {tab==="class"&&displayedProgramGroups.map(group=>(
            <div key={group.key} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"0 4px 10px",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <button
                    onClick={()=>setActiveProgramFilter(current => current === group.key ? null : group.key)}
                    style={{
                      display:"inline-flex",
                      alignItems:"center",
                      gap:8,
                      background:activeProgramFilter===group.key ? group.accent : "#fff",
                      color:activeProgramFilter===group.key ? "#fff" : group.accent,
                      border:`1px solid ${activeProgramFilter===group.key ? group.accent : group.border}`,
                      borderRadius:999,
                      padding:"8px 12px",
                      fontSize:11,
                      fontWeight:800,
                      fontFamily:G.sans,
                      letterSpacing:0.3,
                      cursor:"pointer",
                      boxShadow:activeProgramFilter===group.key && !reduceEffects ? G.shadowSm : "none",
                    }}>
                    {group.label}
                    <span style={{fontFamily:G.mono,fontWeight:700,opacity:0.9}}>{group.items.length}</span>
                  </button>
                  <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>
                    {group.items.length} class{group.items.length!==1?"es":""}
                  </span>
                </div>
              </div>
              <div style={{display:"grid",gap:10}}>
                {group.items.map(cls=>{
                  const activityLabel = lastEntryCaption(cls.lastActivityTs || null);
                  const compactSubjects = cls.subjects.slice(0, 2);
                  const extraSubjectCount = Math.max(0, cls.subjects.length - compactSubjects.length);
                  const teacherLoggedToday = cls.teachers.some(t=>t.entryCount>0);
                  const sectionTone = getSectionTone(cls.raw || cls.display);
                  const cardSurface = sectionTone.surface || sectionTone.light || "#EEF4FF";
                  const cardInk = sectionTone.ink || G.text;
                  const cardBorder = sectionTone.border || G.border;
                  return(
                    <div
                      key={cls.raw}
                      onClick={()=>openClassSelection(cls.raw)}
                      className="admin-mobile-touch admin-mobile-card-press"
                      style={{cursor:"pointer",WebkitTapHighlightColor:"transparent",borderRadius:18,overflow:"hidden",background:"#FFFFFF",border:`1.5px solid ${cardBorder}`,boxShadow:G.shadowSm}}>
                      <div style={{background:cardSurface,padding:"12px 12px 11px",borderBottom:`1px solid ${cardBorder}`}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:18,fontWeight:800,color:cardInk,fontFamily:G.display,lineHeight:1.05}}>
                              {cls.display}
                            </div>
                            <div style={{fontSize:12,color:G.textM,marginTop:5,lineHeight:1.45}}>
                              {group.label} cluster · {activityLabel}
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                            <div style={mobileCountDot(teacherLoggedToday)}/>
                            <span style={{width:34,height:34,borderRadius:12,background:"#FFFFFF",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:G.textL}}>
                              ›
                            </span>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:10}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {mobilePill(`${cls.teachers.length} teachers`, "blue", `${cls.raw}_teachers`)}
                            {compactSubjects.map(s=>(
                              <span key={s} style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontFamily:G.sans,color:G.textS}}>
                                {s}
                              </span>
                            ))}
                            {extraSubjectCount>0&&(
                              <span style={{background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:11.5,fontFamily:G.mono,color:G.textL}}>
                                +{extraSubjectCount}
                              </span>
                            )}
                          </div>
                          <span style={{fontSize:11,color:G.textL,fontFamily:G.mono,whiteSpace:"nowrap"}}>
                            {teacherLoggedToday ? "entry today" : "no entry today"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {tab==="teacher"&&visibleInstTeachers.map(t=>{
            const d=fullData[t.uid]||{};
            const name=d.profile?.name||t.name||"?";
            const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
            const activityLabel = instTeacherMeta[t.uid]?.label || lastEntryCaption(null);
            const classCount = (d.classes||[]).filter(c=>sameInstituteName(c.institute, selInst)).length;
            const initial = (name||"A").trim().charAt(0).toUpperCase();
            return(
              <div
                key={t.uid}
                onClick={()=>openTeacherSelection(t.uid)}
                className="admin-mobile-touch admin-mobile-card-press"
                style={{...mobileRowCardStyle,cursor:"pointer",marginBottom:10,WebkitTapHighlightColor:"transparent"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                  <div style={{display:"flex",gap:12,minWidth:0,flex:1}}>
                    <div style={{width:40,height:40,borderRadius:14,background:"#EEF4FF",color:G.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,fontFamily:G.display,flexShrink:0}}>
                      {initial}
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.1}}>
                        {name}
                      </div>
                      <div style={{fontSize:12.5,color:G.textM,marginTop:5,lineHeight:1.5}}>
                        {classCount} class{classCount!==1?"es":""} in this institute · {activityLabel}
                      </div>
                      {otherInsts.length>0&&<AlsoAtInstitutes institutes={otherInsts} />}
                    </div>
                  </div>
                  <span style={{width:36,height:36,borderRadius:12,background:"#F8FAFF",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:G.textL,flexShrink:0}}>
                    ›
                  </span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                  {mobilePill(activityLabel, "soft", `${t.uid}_activity`)}
                  {mobilePill(`${classCount} classes`, "blue", `${t.uid}_classes`)}
                </div>
              </div>
            );
          })}

          {instTeachers.length===0&&tab==="teacher"&&loadingUids.size>0&&(
            <div style={{...mobileRowCardStyle,textAlign:"center",color:G.textM}}>
              Loading teachers…
            </div>
          )}
          {((tab==="class"&&displayedVisibleClassCount===0&&instClasses.length>0)||(tab==="teacher"&&visibleInstTeachers.length===0&&instTeachers.length>0))&&(
            <div style={{...mobileRowCardStyle,textAlign:"center",color:G.textM}}>
              No {tab==="class"?"classes":"teachers"} match your search.
            </div>
          )}
        </div>
        <MobileBottomNav/>
      </div>
    );

    // ── STEP 2: Classes for teacher / Teachers for class ─────────────────────
    if(mobileStep===2) return(
      <div style={mobilePageShellStyle}>
        <MobileMotionStyles />
        {binView&&<AdminBinModal/>}
        {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
        <AdminToastBanner message={adminToast} />
        <MobileBreadcrumb/>
        <div style={mobilePageInnerStyle}>
          {(()=>{
            const selectedClass = tab==="class" ? instClasses.find(c=>c.raw===selP2) : null;
            const selectedTeacher = tab==="teacher" ? fullData[selP2]?.profile?.name || teachers.find(t=>t.uid===selP2)?.name || p2Label(selP2) : null;
            const totalEntries = p3Items.reduce((sum,item)=>sum + (item.entryCount || 0),0);
            const nextLabel = tab==="teacher" ? "class timelines" : "teacher histories";
            return (
              <>
                <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>
                        {selInst} · {tab==="teacher" ? "Teacher workspace" : "Class workspace"}
                      </div>
                      <h2 style={{fontSize:21,fontWeight:800,color:G.text,fontFamily:G.display,margin:"7px 0 0",lineHeight:1.08}}>
                        {p2Label(selP2)}
                      </h2>
                      <div style={{fontSize:12.5,color:G.textM,lineHeight:1.5,marginTop:7}}>
                        {tab==="teacher"
                          ? `${selectedTeacher} · choose a class or open the full grouped view`
                          : `${selInst} · choose a teacher or open the full grouped view`}
                      </div>
                    </div>
                    {mobilePill(overviewPeriodText, "blue", "step2_period")}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                    {mobilePill(`${p3Items.length} ${tab==="teacher" ? "classes" : "teachers"}`, "soft", "step2_count")}
                    {mobilePill(`${totalEntries} entries`, "soft", "step2_entries")}
                    {tab==="class" && selectedClass?.subjects?.length
                      ? mobilePill(`${selectedClass.subjects.length} subjects`, "good", "step2_subjects")
                      : tab==="teacher"
                        ? mobilePill(instTeacherMeta[selP2]?.label || "No recent activity", "good", "step2_activity")
                        : null}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                    <button className="admin-mobile-touch" onClick={openScopedFullView} style={mobileActionButtonStyle("primary")}>
                      Full timeline
                    </button>
                  </div>
                </div>

                <div style={{...mobileControlStackStyle,marginBottom:12}}>
                  {renderSearchInput(
                    p3Search,
                    setP3Search,
                    tab==="teacher" ? "Search classes in this teacher view" : "Search teachers in this class",
                    true
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:10,fontSize:12,color:G.textL,fontFamily:G.sans}}>
                    <span>{visibleP3Items.length} visible {nextLabel}</span>
                    <span>Choose one item for individual history</span>
                  </div>
                </div>

                <div style={{display:"grid",gap:10}}>
                  {!isAggregateSelection&&visibleP3Items.map(item=>(
                    <div
                      key={item.classId||item.uid}
                      style={tab==="teacher" ? (() => {
                        const tone = getSectionTone(item.display);
                        return {
                          ...mobileRowCardStyle,
                          overflow:"hidden",
                          border:`1px solid ${tone.border || G.border}`,
                          background:tone.surface || mobileRowCardStyle.background,
                        };
                      })() : {...mobileRowCardStyle,overflow:"hidden"}}>
                      <div
                        onClick={()=>{
                          setFullView(null);
                          if(tab==="teacher") setSelP3({teacherUid:selP2,classId:item.classId,teacherName:fullData[selP2]?.profile?.name||"",className:item.display,subject:item.subject,institute:item.institute||selInst});
                          else {
                            const clsObj=instClasses.find(c=>c.raw===selP2);
                            const subjectText = item.subject || clsObj?.subjects?.join(", ") || "";
                            setSelP3({teacherUid:item.uid,classId:item.classId,teacherName:item.name,className:normaliseName(selP2),subject:subjectText});
                            ensureFullData(item.uid);
                          }
                          setMobileStep(3);
                        }}
                        className="admin-mobile-touch admin-mobile-card-press"
                        style={{cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                        {tab==="teacher" ? (() => {
                          const tone = getSectionTone(item.display);
                          return (
                            <div style={{height:4,background:tone.bg,margin:"-11px -12px 10px"}}/>
                          );
                        })() : null}
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:19,fontWeight:800,color:tab==="teacher" ? (getSectionTone(item.display).ink || G.text) : G.text,fontFamily:G.display,lineHeight:1.05}}>
                              {tab==="teacher" ? item.display : item.name}
                            </div>
                            <div style={{fontSize:12.5,color:G.textM,marginTop:5,lineHeight:1.5}}>
                              {tab==="teacher"
                                ? [item.subject || "No subject", item.institute || selInst, lastEntryCaption(item.lastActivityTs || null)].filter(Boolean).join(" · ")
                                : [item.subject || "No subject", instTeacherMeta[item.uid]?.label || lastEntryCaption(item.lastActivityTs || item.lastActive || null)].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <span style={{width:36,height:36,borderRadius:12,background:"#F8FAFF",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:G.textL,flexShrink:0}}>
                            ›
                          </span>
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                          {mobilePill(`${item.entryCount || 0} ${(item.entryCount || 0)===1?"entry":"entries"}`, "blue", `${item.classId||item.uid}_entries`)}
                          {tab==="teacher"
                            ? mobilePill(item.subject || "Subject pending", "soft", `${item.classId}_subject`)
                            : mobilePill(item.subject || "Subject pending", "soft", `${item.uid}_subject`)}
                        </div>
                      </div>
                      {tab==="teacher"&&(
                        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.sans}}>
                            Open this class for the teacher timeline or remove the class from this teacher.
                          </div>
                          <button className="admin-mobile-touch" onClick={()=>handleDeleteClass(selP2,item.classId,item.display,fullData[selP2]?.profile?.name||"Teacher")}
                            style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:10,padding:"8px 12px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6,WebkitTapHighlightColor:"transparent"}}>
                            🗑 Delete class
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!isAggregateSelection&&visibleP3Items.length===0&&(
                    <div style={{...mobileRowCardStyle,textAlign:"center",color:G.textM}}>
                      No {tab==="teacher" ? "classes" : "teachers"} match your search.
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
        <MobileBottomNav/>
      </div>
    );

    // ── STEP 3: Entries ───────────────────────────────────────────────────────
    if(mobileStep===3&&(isInstituteOverviewStep||selP3||isAggregateSelection||isScopedFullView)) {
      return(
        <div style={mobilePageShellStyle}>
          <MobileMotionStyles />
          {binView&&<AdminBinModal/>}
          {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
          {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
          <AdminToastBanner message={adminToast} />
          <MobileBreadcrumb/>
          <div style={mobilePageInnerStyle}>
            {(()=>{
              const stepTitle = isInstituteOverviewStep
                ? `${selInst} Overview`
                : isScopedFullView
                  ? fullViewTitle
                  : isAggregateSelection
                    ? aggregateTitle
                    : `${selP3.teacherName} — ${selP3.className}`;
              const stepSubtitle = isInstituteOverviewStep
                ? `${selInst} · charts, teaching time, and recent institute activity`
                : isScopedFullView
                  ? fullViewSubtitle
                  : isAggregateSelection
                    ? `${selInst} · grouped by class, chronological inside each class`
                    : [selectedClassMeta?.institute || selP3.institute || selInst, selectedSubjectLabel].filter(Boolean).join(" · ");
              const timelineSummary = selectedTimelineSummary || null;
              return (
                <>
                  <div style={{...mobileWorkspaceCardStyle,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>
                          {isInstituteOverviewStep ? "Institute detail" : isScopedFullView ? "Grouped timeline" : isAggregateSelection ? "Aggregate timeline" : "Selection timeline"}
                        </div>
                        <h2 style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,margin:"7px 0 0",lineHeight:1.08}}>
                          {stepTitle}
                        </h2>
                        <div style={{fontSize:12.5,color:G.textM,lineHeight:1.5,marginTop:7}}>
                          {stepSubtitle}
                        </div>
                      </div>
                      {mobilePill(overviewPeriodText, "blue", "step3_period")}
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                      {isInstituteOverviewStep&&mobilePill(`${instClasses.length} classes`, "soft", "step3_classes")}
                      {isInstituteOverviewStep&&mobilePill(`${selectedInstitutePeriodCount} logs`, "soft", "step3_logs")}
                      {isInstituteOverviewStep&&mobilePill(`${formatDurationShort(classSubjectSummary.totalMinutes)} taught`, "good", "step3_taught")}
                      {isScopedFullView&&mobilePill(`${fullViewEntries.length} entries`, "soft", "step3_full_entries")}
                      {isAggregateSelection&&mobilePill(`${aggregateEntries.length} entries`, "soft", "step3_agg_entries")}
                      {selP3&&timelineSummary&&mobilePill(`${timelineSummary.entryCount} entries`, "soft", "step3_sel_entries")}
                      {selP3&&timelineSummary&&mobilePill(timelineSummary.totalMinutes>0 ? formatDurationShort(timelineSummary.totalMinutes) : "Untimed logs", "good", "step3_sel_taught")}
                    </div>
                  </div>

                  <div style={{...mobileWorkspaceCardStyle,padding:0,overflow:"hidden"}}>
                    <div style={{position:"sticky",top:10,zIndex:13,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:`1px solid ${G.border}`}}>
                      <div style={{padding:"8px 8px 7px"}}>
                        <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:14,padding:"8px 8px 6px"}}>
                          <PeriodSelector
                            period={period}
                            onChangePeriod={handlePeriodChange}
                            compact
                            rangeStart={customRange.start}
                            rangeEnd={customRange.end}
                            onChangeRangeStart={handleRangeStartChange}
                            onChangeRangeEnd={handleRangeEndChange}
                          />
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                          {isScopedFullView&&mobilePill("Grouped by class", "soft", "step3_grouped")}
                          {isAggregateSelection&&mobilePill("Chronological by class", "soft", "step3_aggregate")}
                          {selP3&&selectedSubjectLabel&&mobilePill(selectedSubjectLabel, "soft", "step3_subject")}
                        </div>
                      </div>
                    </div>
                    <div style={{padding:"10px"}}>
                      {isInstituteOverviewStep
                        ? renderOverviewPanel()
                        : isScopedFullView
                          ? renderFullViewEntries(true)
                          : isAggregateSelection
                            ? renderAggregateEntries(true)
                            : renderSelectedTimelineEntries(true)}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <MobileBottomNav/>
        </div>
      );
    }
  }

  const p4HeaderTitle = isScopedFullView
    ? fullViewTitle
    : isAggregateSelection
      ? aggregateTitle
      : selP3
        ? `${selP3.teacherName} — ${selP3.className}`
        : selP2
          ? `${p2Label(selP2)} Overview`
          : selInst
            ? `${selInst} Overview`
            : "Admin Overview";

  const p4HeaderSubtitle = isScopedFullView
    ? fullViewSubtitle
    : isAggregateSelection
      ? `${selInst} · grouped by class, chronological inside each class`
      : selP3
        ? [selectedClassMeta?.institute || selP3.institute || selInst, selectedSubjectLabel].filter(Boolean).join(" · ")
        : selP2
          ? `Use panel 3 to open the full grouped view or choose one specific ${tab==="teacher"?"class":"teacher"}`
          : selInst
            ? "Choose a class or teacher to drill down, or use the full view action in panel 3"
            : "Select an institute to start navigating";

  const p4HeaderEyebrow = isScopedFullView
    ? "Grouped Full View"
    : isAggregateSelection
      ? "Combined Timeline"
      : selP3
        ? "Teacher Timeline"
        : selP2
          ? "Selection Overview"
          : selInst
            ? "Institute Overview"
            : "Admin Workspace";

  const p4HeaderTone = isScopedFullView
    ? { bg1:"#F7F2FF", bg2:"#FFFFFF", edge:"#DDD6FE", accent:"#6D28D9", chipBg:"#EDE9FE", chipText:"#6D28D9", wash:"rgba(109,40,217,0.10)" }
    : isAggregateSelection
      ? { bg1:"#EFFCF4", bg2:"#FFFFFF", edge:"#BBF7D0", accent:"#198754", chipBg:"#DCFCE7", chipText:"#166534", wash:"rgba(25,135,84,0.10)" }
      : selP3
        ? { bg1:"#EEF4FF", bg2:"#FFFFFF", edge:"#C7D2FE", accent:"#1D4ED8", chipBg:"#DBEAFE", chipText:"#1D4ED8", wash:"rgba(29,78,216,0.10)" }
        : selP2
          ? { bg1:"#FFF8ED", bg2:"#FFFFFF", edge:"#FED7AA", accent:"#C2410C", chipBg:"#FFEDD5", chipText:"#C2410C", wash:"rgba(234,88,12,0.10)" }
          : selInst
            ? { bg1:"#EEF4FF", bg2:"#FFFFFF", edge:"#BFDBFE", accent:"#1D4ED8", chipBg:"#DBEAFE", chipText:"#1D4ED8", wash:"rgba(59,130,246,0.10)" }
            : { bg1:"#F8FAFC", bg2:"#FFFFFF", edge:G.border, accent:G.navy, chipBg:"#E5EDF9", chipText:G.navy, wash:"rgba(26,47,90,0.08)" };

  const p4HeaderStatusNode = isScopedFullView ? (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#FFFFFF",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"8px 12px",boxShadow:reduceEffects?"none":"0 8px 18px rgba(15,23,42,0.05)"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:fullViewLoading?G.borderM:p4HeaderTone.accent}}/>
      <span style={{fontSize:12,color:fullViewLoading?G.textL:p4HeaderTone.accent,fontWeight:700,fontFamily:G.mono}}>
        {fullViewLoading ? "Loading full view" : `${fullViewGroups.length} groups · ${fullViewEntries.length} entries`}
      </span>
    </div>
  ) : isAggregateSelection ? (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#FFFFFF",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"8px 12px",boxShadow:reduceEffects?"none":"0 8px 18px rgba(15,23,42,0.05)"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:aggregateLoading?G.borderM:p4HeaderTone.accent}}/>
      <span style={{fontSize:12,color:aggregateLoading?G.textL:p4HeaderTone.accent,fontWeight:700,fontFamily:G.mono}}>
        {aggregateLoading
          ? `Loading ${aggregateLoadedTeacherCount}/${instTeachers.length} teachers`
          : `${aggregateGroups.length} groups · ${aggregateEntries.length} entries`}
      </span>
    </div>
  ) : selP3 ? (() => {
      const count = selectedTimelineSummary?.entryCount || 0;
      const ago = selectedTimelineSummary?.lastAgo || null;
      return (
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#FFFFFF",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"8px 12px",boxShadow:reduceEffects?"none":"0 8px 18px rgba(15,23,42,0.05)"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:count>0?p4HeaderTone.accent:G.borderM}}/>
          <span style={{fontSize:12,color:count>0?p4HeaderTone.accent:G.textL,fontWeight:700,fontFamily:G.mono}}>
            {count>0 ? `${count} entries${ago?` · last ${ago}`:""}` : `No entries in ${overviewPeriodText.toLowerCase()}`}
          </span>
        </div>
      );
    })() : (
      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#FFFFFF",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"8px 12px",boxShadow:reduceEffects?"none":"0 8px 18px rgba(15,23,42,0.05)"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:p4HeaderTone.accent}}/>
        <span style={{fontSize:12,color:p4HeaderTone.accent,fontWeight:700,fontFamily:G.mono}}>
          {selInst ? "Ready for drilldown" : "Pick an institute"}
        </span>
      </div>
    );

  const renderDesktopProfileMenu = () => {
    const profileAction = ({ icon, title, subtitle = "", onClick, danger = false, badge = null }) => (
      <button
        type="button"
        onClick={onClick}
        style={{
          width:"100%",
          border:"none",
          borderRadius:12,
          background:danger ? "#FFF1F2" : "transparent",
          padding:"10px 11px",
          display:"flex",
          alignItems:"center",
          gap:10,
          textAlign:"left",
          cursor:"pointer",
          fontFamily:G.sans,
        }}>
        <span style={{width:34,height:34,borderRadius:11,background:danger?"#FDE2E2":"#EEF4FF",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AppIcon icon={icon} size={16} color={danger?G.red:G.blue}/>
        </span>
        <span style={{minWidth:0,flex:1}}>
          <span style={{display:"block",fontSize:13.5,fontWeight:800,color:danger?G.red:G.text}}>{title}</span>
          {subtitle&&<span style={{display:"block",fontSize:11.5,color:danger?"#A94444":G.textM,lineHeight:1.4,marginTop:2}}>{subtitle}</span>}
        </span>
        {badge!=null&&badge!==0&&(
          <span style={{background:danger?G.redL:G.blueL,color:danger?G.red:G.blue,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:850,fontFamily:G.mono,flexShrink:0}}>{badge}</span>
        )}
        {!danger&&<AppIcon icon={IconChevronRight} size={15} color={G.textL}/>}
      </button>
    );
    return (
      <div style={{position:"absolute",top:"calc(100% + 10px)",right:0,zIndex:200,background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:18,boxShadow:"0 24px 70px rgba(15,23,42,0.24)",width:360,maxWidth:"calc(100vw - 28px)",overflow:"hidden"}}>
        <div style={{padding:"16px",borderBottom:`1px solid ${G.border}`,background:"#F8FAFD"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:850,color:"#FFFFFF",fontFamily:G.display,flexShrink:0}}>
              {(user?.email||"A").charAt(0).toUpperCase()}
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:15,fontWeight:850,color:G.text,fontFamily:G.display}}>Administrator</div>
              <div style={{fontSize:11.5,color:G.textM,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user?.email||"—"}</div>
            </div>
            <span style={{background:G.blueL,border:"1px solid #C7D7F5",borderRadius:999,padding:"5px 8px",fontSize:10.5,fontWeight:800,color:G.blue,fontFamily:G.mono,whiteSpace:"nowrap"}}>{currentSession()}</span>
          </div>
        </div>
        <div style={{padding:"12px"}}>
          <div style={{fontSize:9.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,padding:"4px 10px 5px"}}>Quick access</div>
          {profileAction({icon:IconSend,title:"Messenger",subtitle:"Routing, test sends, and daily delivery",onClick:openLedgrTelegramDashboard,badge:ledgrTelegramLoading?null:(ledgrTelegramRecipientStats.active?`${ledgrTelegramRecipientStats.active} live`: "Setup")})}
          <div style={{height:1,background:G.border,margin:"8px 0"}}/>
          <div style={{fontSize:9.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,padding:"4px 10px 5px"}}>Control panel</div>
          {profileAction({icon:IconSettings,title:"Open Control Panel",subtitle:"Teachers, institutes, syllabus, sections, admins, and reports",onClick:()=>{setProfileOpen(false);openManageTab("teachers");}})}
          <div style={{height:1,background:G.border,margin:"8px 0"}}/>
          <div style={{fontSize:9.5,fontWeight:850,color:G.textL,textTransform:"uppercase",letterSpacing:1,fontFamily:G.mono,padding:"4px 10px 5px"}}>Support</div>
          {profileAction({icon:IconMessageCircle,title:"Teacher Feedback",subtitle:"Read issues and send replies",onClick:()=>{setProfileOpen(false);openFeedbackInbox();},badge:feedbackUnreadCount})}
          {profileAction({icon:IconTrash,title:"Recycle Bin",subtitle:"Review deleted workspace records",onClick:()=>{setProfileOpen(false);setBinView(true);},badge:adminBin.length})}
          <div style={{height:1,background:G.border,margin:"8px 0"}}/>
          {profileAction({icon:IconLogout,title:"Sign Out",onClick:()=>{setProfileOpen(false);logout();},danger:true})}
        </div>
      </div>
    );
  };

  // ── DESKTOP: original 4-panel layout ─────────────────────────────────────
  return(
    <div style={{minHeight:"100svh",height:"100vh",display:"flex",flexDirection:"column",fontFamily:G.sans,background:G.bg,overflow:"hidden"}}>
      {feedbackOpen&&(
        <FeedbackInboxModal
          threads={feedbackThreads}
          selectedUid={feedbackSelectedUid}
          messages={feedbackMessages}
          reply={feedbackReply}
          busy={feedbackBusy}
          onSelect={uid=>{setFeedbackSelectedUid(uid);markFeedbackThreadRead(uid).catch(()=>{});}}
          onReplyChange={setFeedbackReply}
          onSend={sendFeedbackReply}
          onToggleResolved={toggleFeedbackResolved}
          onClose={()=>setFeedbackOpen(false)}
        />
      )}
      {binView&&<AdminBinModal/>}
      {instDeleteModal&&<InstDeleteModal/>}{deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
      {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
      {adminConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:18,padding:"26px 22px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <p style={{fontSize:16,color:"#374151",fontFamily:"'Inter',sans-serif",marginBottom:24,lineHeight:1.6}}>{adminConfirm.msg}</p>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setAdminConfirm(null)} style={{background:"none",border:"1.5px solid #E5E7EB",borderRadius:9,padding:"8px 18px",fontSize:14,cursor:"pointer",color:"#6B7280",fontFamily:"'Inter',sans-serif"}}>Cancel</button>
              <button onClick={()=>{adminConfirm.onConfirm();setAdminConfirm(null);}} style={{background:"#1A2F5A",color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{adminConfirm.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media (min-width: 768px) { .admin-mobile-back { display: none !important; } }
        .admin-mobile-back { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Nav */}
      <div style={{background:G.navy,minHeight:64,display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",alignItems:"center",padding:"0 18px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.08)",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:36,height:36,background:G.blueV,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="19" height="19" viewBox="0 0 18 18" fill="none"><path d="M4 3H7V13H14V16H4V3Z" fill="white"/></svg>
          </div>
          <div>
            <div style={{fontFamily:G.display,fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.2,letterSpacing:-0.5}}>Ledgr</div>
            <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.45)",fontFamily:G.mono,textTransform:"uppercase",marginTop:2}}>Admin Panel</div>
          </div>
        </div>
        <div style={{minWidth:0,display:"flex",justifyContent:"center",overflow:"hidden"}}>
          {loadingUids.size>0&&(
            <div style={{fontSize:12,color:"rgba(255,255,255,0.72)",fontFamily:G.mono,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:999,padding:"7px 12px",flexShrink:0}}>
              syncing {loadingUids.size} teacher{loadingUids.size>1?"s":""}…
            </div>
          )}
        </div>
        <div className="admin-nav-r" style={{display:"flex",alignItems:"center",gap:8}}>
          {/* ── Admin Profile Pill ─────────────────────────────────── */}
           <div style={{position:"relative"}}>
             <div onClick={()=>{
               setProfileOpen(open=>!open);
             }}
               style={{height:42,display:"flex",alignItems:"center",gap:8,background:profileOpen?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.1)",borderRadius:10,padding:"0 12px",cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"background 0.15s",flexShrink:0}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:G.sans}}>
                {(user?.email||"A").charAt(0).toUpperCase()}
              </div>
              <span style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",whiteSpace:"nowrap",fontFamily:G.sans}}>Admin</span>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginLeft:2}}>{profileOpen?"▲":"▼"}</span>
            </div>
            {profileOpen&&(<>
              <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
              {renderDesktopProfileMenu()}
            </>)}
            {false&&profileOpen&&(<>
              <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
              <div style={{position:"absolute",top:"calc(100% + 10px)",right:0,zIndex:200,background:"#0B1730",border:"1px solid rgba(255,255,255,0.13)",borderRadius:18,boxShadow:"0 22px 60px rgba(0,0,0,0.42)",width:430,maxWidth:"calc(100vw - 32px)",maxHeight:"calc(100vh - 96px)",overflowY:"auto",overflowX:"hidden"}}>
                {/* Profile header */}
                <div style={{padding:"18px 18px 15px",borderBottom:"1px solid rgba(255,255,255,0.09)",background:"linear-gradient(135deg,rgba(59,130,246,0.16),rgba(15,30,61,0))"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                    <div style={{width:48,height:48,borderRadius:16,background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",flexShrink:0,fontFamily:G.display,boxShadow:"0 0 0 4px rgba(59,130,246,0.22)"}}>
                      {(user?.email||"A").charAt(0).toUpperCase()}
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:16,fontWeight:800,color:"rgba(255,255,255,0.96)",fontFamily:G.sans,lineHeight:1.2}}>Administrator</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.48)",marginTop:4,fontFamily:G.sans,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:250}}>{user?.email||"—"}</div>
                    </div>
                    </div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(59,130,246,0.16)",border:"1px solid rgba(59,130,246,0.28)",borderRadius:999,padding:"6px 10px",flexShrink:0}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:"#3B82F6",display:"inline-block"}}/>
                      <span style={{fontSize:11,color:"#BFDBFE",fontFamily:G.mono,fontWeight:700}}>{currentSession()}</span>
                    </div>
                  </div>
                </div>
                {/* Menu items */}
                <div style={{padding:"12px"}}>
                  <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"12px",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",color:"rgba(255,255,255,0.42)",fontFamily:G.mono}}>Workspace snapshot</div>
                      {loadingUids.size>0&&(
                        <span style={{fontSize:10.5,fontWeight:800,color:"#BFDBFE",fontFamily:G.mono,background:"rgba(59,130,246,0.14)",border:"1px solid rgba(59,130,246,0.22)",borderRadius:999,padding:"4px 8px"}}>Syncing {loadingUids.size}</span>
                      )}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
                      {adminWorkspaceStats.map(item=>(
                        <div key={item.key} style={{background:"rgba(255,255,255,0.055)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:13,padding:"9px 9px 10px",minWidth:0}}>
                          <div style={{width:28,height:28,borderRadius:10,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
                              <AppIcon icon={item.icon} size={14} color={item.color} />
                          </div>
                          <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:G.display,lineHeight:1}}>{item.value}</div>
                          <div style={{fontSize:9,fontWeight:800,letterSpacing:0.4,textTransform:"uppercase",color:"rgba(255,255,255,0.42)",fontFamily:G.mono,marginTop:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",color:"rgba(255,255,255,0.36)",fontFamily:G.mono,margin:"4px 4px 8px"}}>Reports</div>
                  <button onClick={()=>{setProfileOpen(false);openInstituteGlancePanel();}}
                    style={{width:"100%",marginBottom:10,padding:"12px 13px",background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.24)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"center",gap:11,color:"rgba(255,255,255,0.88)",fontSize:13,fontFamily:G.sans,fontWeight:700,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,0.18)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(59,130,246,0.1)"}>
                    <div style={{width:34,height:34,borderRadius:11,background:"rgba(59,130,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconChartBar} size={16} color="#93C5FD" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:800,color:"rgba(255,255,255,0.92)"}}>Ledgr Report</div>
                      <div style={{fontSize:11.5,color:"rgba(255,255,255,0.44)",fontWeight:500,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        All-institutes report, PDFs, and centre boxes
                      </div>
                    </div>
                    {instituteGlanceReport.ready&&(
                      <span style={{marginLeft:"auto",background:"rgba(59,130,246,0.16)",border:"1px solid rgba(59,130,246,0.22)",borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,color:"#BFDBFE",flexShrink:0}}>
                        ready
                      </span>
                    )}
                    <AppIcon icon={IconChevronRight} size={13} color="rgba(255,255,255,0.3)" style={{marginLeft:instituteGlanceReport.ready?0:"auto",flexShrink:0}} />
                  </button>
                  <button onClick={openLedgrTelegramDashboard}
                    style={{width:"100%",marginBottom:10,padding:"12px 13px",background:"rgba(37,99,235,0.10)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"center",gap:11,color:"rgba(255,255,255,0.88)",fontSize:13,fontFamily:G.sans,fontWeight:700,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(37,99,235,0.16)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(37,99,235,0.10)"}>
                    <div style={{width:34,height:34,borderRadius:11,background:"rgba(59,130,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconSend} size={16} color="#93C5FD" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:800,color:"rgba(255,255,255,0.92)"}}>Messenger</div>
                      <div style={{fontSize:11.5,color:"rgba(255,255,255,0.44)",fontWeight:500,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        Telegram live now, WhatsApp next, plus routing and schedule linkage
                      </div>
                    </div>
                    <span style={{marginLeft:"auto",background:ledgrTelegramRecipientStats.active?"rgba(59,130,246,0.16)":"rgba(255,255,255,0.06)",border:`1px solid ${ledgrTelegramRecipientStats.active?"rgba(96,165,250,0.22)":"rgba(255,255,255,0.08)"}`,borderRadius:999,padding:"4px 8px",fontSize:10.5,fontWeight:700,fontFamily:G.mono,color:ledgrTelegramRecipientStats.active?"#BFDBFE":"rgba(255,255,255,0.46)",flexShrink:0}}>
                      {ledgrTelegramLoading ? "..." : ledgrTelegramRecipientStats.active ? `${ledgrTelegramRecipientStats.active} live` : "setup"}
                    </span>
                    <AppIcon icon={IconChevronRight} size={13} color="rgba(255,255,255,0.3)" style={{flexShrink:0}} />
                  </button>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",color:"rgba(255,255,255,0.36)",fontFamily:G.mono,margin:"4px 4px 8px"}}>Manage</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:10}}>
                  <button onClick={()=>{setProfileOpen(false);openManageTab("teachers");}}
                    style={{width:"100%",minHeight:82,padding:"11px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.11)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconUsersGroup} size={15} color="rgba(255,255,255,0.7)" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Manage teachers</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Teacher accounts, classes &amp; access</div>
                    </div>
                  </button>
                  <button onClick={()=>{setProfileOpen(false);openManageTab("admins");}}
                    style={{width:"100%",minHeight:82,padding:"11px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.11)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconSettings} size={15} color="rgba(255,255,255,0.7)" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Manage admins</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Workspace roles and admin permissions</div>
                    </div>
                  </button>
                  <button onClick={()=>{setProfileOpen(false);openManageTab("institutes");}}
                    style={{width:"100%",minHeight:82,padding:"11px 12px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,0.18)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(59,130,246,0.1)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(59,130,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconBuilding} size={16} color="#93C5FD" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Manage institutes</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Institute list, names, and structure</div>
                    </div>
                  </button>
                  <button onClick={()=>{setProfileOpen(false);openManageTab("sections",{ detailInstitute: selInst || null });}}
                    style={{width:"100%",minHeight:82,padding:"11px 12px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:13,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,0.18)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(59,130,246,0.1)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(59,130,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconSchool} size={16} color="#93C5FD" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Manage sections</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>{selInst ? `${selInst} groups and timetables` : "Section groups and timetable setup"}</div>
                    </div>
                  </button>
                  </div>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",color:"rgba(255,255,255,0.36)",fontFamily:G.mono,margin:"2px 4px 8px"}}>Communication</div>
                  <button onClick={openFeedbackInbox}
                    style={{width:"100%",marginBottom:10,padding:"10px 12px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left"}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(59,130,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconMessageCircle} size={16} color="#93C5FD" />
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>Teacher Feedback</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>Read issues and send replies</div>
                    </div>
                    {feedbackUnreadCount>0&&<span style={{background:"#3B82F6",color:"#fff",borderRadius:999,padding:"3px 8px",fontSize:10.5,fontWeight:800}}>{feedbackUnreadCount>9?"9+":feedbackUnreadCount}</span>}
                  </button>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",color:"rgba(255,255,255,0.36)",fontFamily:G.mono,margin:"2px 4px 8px"}}>Recovery</div>
                  <button onClick={()=>{setProfileOpen(false);setBinView(true);}}
                    style={{width:"100%",marginBottom:5,padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.75)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconTrash} size={15} color="rgba(255,255,255,0.6)" />
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.8)"}}>Recycle Bin</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Deleted classes &amp; entries</div>
                    </div>
                    {adminBin.length>0&&<span style={{marginLeft:"auto",background:"rgba(201,48,48,0.75)",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700,flexShrink:0}}>{adminBin.length}</span>}
                  </button>
                  <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"6px 0"}}/>
                  <button onClick={()=>{setProfileOpen(false);logout();}}
                    style={{width:"100%",padding:"10px 12px",background:"rgba(220,38,38,0.12)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"#FCA5A5",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(220,38,38,0.2)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(220,38,38,0.12)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(220,38,38,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <AppIcon icon={IconLogout} size={15} color="#FCA5A5" />
                    </div>
                    Sign Out
                  </button>
                </div>
              </div>
            </>)}
          </div>
          {/* ── End Admin Profile Pill ──────────────────────────────── */}
        </div>
      </div>

      {legacySectionRepair&&(
        <LegacySectionRepairModal
          scopeLabel={legacySectionRepair.scopeLabel}
          items={legacySectionRepair.items}
          selections={legacySectionRepair.selections}
          busy={legacySectionRepair.busy}
          error={legacySectionRepair.error}
          onChange={setLegacySectionRepairSelection}
          onClose={()=>!legacySectionRepair.busy&&setLegacySectionRepair(null)}
          onConfirm={applyLegacySectionRepair}
        />
      )}
      {pendingSectionRenameModal}
      <AdminToastBanner message={adminToast} />
      {instituteGlanceOptionsOpen&&(
        <LedgrReportOptionsModal
          institutes={institutes}
          period={instituteGlancePeriod}
          month={instituteGlanceMonth}
          rangeStart={instituteGlanceRangeStart}
          rangeEnd={instituteGlanceRangeEnd}
          schedule={ledgrReportSchedule}
          scheduleLoading={ledgrReportScheduleLoading}
          scheduleSaving={ledgrReportScheduleSaving}
          exportDisabled={instituteGlanceExportDisabled}
          busyFormat={instituteGlanceExportBusy}
          initialMode={instituteGlanceOptionsMode}
          context={instituteGlanceOptionsContext}
          onClose={()=>!instituteGlanceExportBusy&&!ledgrReportScheduleSaving&&setInstituteGlanceOptionsOpen(false)}
          onApply={applyInstituteGlanceOptions}
          onSaveSchedule={saveInstituteGlanceSchedule}
        />
      )}
      {telegramDashboardOpen&&(
        <LedgrTelegramDashboardModal
          institutes={institutes}
          schedule={ledgrReportSchedule}
          config={ledgrTelegramConfig}
          loading={ledgrTelegramLoading}
          saving={ledgrTelegramSaving}
          sendBusy={ledgrTelegramSending}
          onClose={()=>!ledgrTelegramSaving&&setTelegramDashboardOpen(false)}
          onSave={saveLedgrTelegramDashboard}
          onOpenSchedule={openLedgrTelegramSchedule}
          onSendNow={sendLedgrTelegramNow}
        />
      )}
      {instituteGlanceOpen && !isMobile ? (
        renderDesktopCentreSummaryPage()
      ) : (
        <>
      {/* Mobile breadcrumb nav — only shown when navigated past step 0 */}
      {mobileStep>0&&(
        <div className="admin-mobile-back" style={{background:G.navyS,borderBottom:`1px solid rgba(255,255,255,0.08)`,padding:"8px 14px",flexShrink:0,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {/* Breadcrumb trail — tap any crumb to jump there */}
          <span onClick={()=>{setMobileStep(0);setSelInst(null);resetNav();}}
            style={{fontSize:13,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:G.sans,padding:"3px 0"}}>
            Institutes
          </span>
          {mobileStep>=1&&selInst&&<>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>›</span>
            <span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);setFullView(null);}}
              style={{fontSize:13,color:mobileStep===1?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===1?700:400,padding:"3px 0"}}>
              {selInst}
            </span>
          </>}
          {mobileStep>=2&&selP2&&<>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>›</span>
            <span onClick={()=>{if(isAggregateSelection){setMobileStep(1);setSelP3(null);} else {setMobileStep(2);setSelP3(null);setFullView(null);}}}
              style={{fontSize:13,color:mobileStep===2?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===2?700:400,padding:"3px 0"}}>
              {p2Label(selP2)}
            </span>
          </>}
          {mobileStep>=3&&(selP3||isAggregateSelection||isScopedFullView)&&<>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>›</span>
            <span style={{fontSize:13,color:"#fff",fontFamily:G.sans,fontWeight:700,padding:"3px 0"}}>
              {isScopedFullView?"View Full":selP3?selP3.className:"All entries"}
            </span>
          </>}
          {/* Back button */}
          <div style={{marginLeft:"auto"}}>
            <span onClick={()=>setMobileStep(s=>isAggregateSelection&&s===3?1:isScopedFullView&&s===3?2:Math.max(0,s-1))}
              style={{background:"rgba(255,255,255,0.1)",borderRadius:7,padding:"5px 12px",fontSize:13,color:"rgba(255,255,255,0.7)",cursor:"pointer",fontFamily:G.sans}}>
              ← Back
            </span>
          </div>
        </div>
      )}
      {/* 4-panel body */}
      <div className={`admin-panels admin-mobile-step-${mobileStep}`} style={{display:"flex",flex:1,overflow:"hidden",userSelect:"none"}}
        ref={el=>{
          panelsBodyRef.current = el;
          if(!el) return;
          if(!isMobile){
            el.onmousedown = null;
            el.onmouseleave = null;
            el.onmouseup = null;
            el.onmousemove = null;
            el.ontouchstart = null;
            el.ontouchmove = null;
            return;
          }
          let isDown=false, startX=0, scrollLeft=0;
          // Only enable drag-scroll on the panels container itself (not inside scrollable lists)
          el.onmousedown = e=>{
            if(e.target!==el) return;
            isDown=true; startX=e.pageX-el.offsetLeft; scrollLeft=el.scrollLeft;
            el.style.cursor="grabbing";
          };
          el.onmouseleave=()=>{isDown=false;el.style.cursor="default";};
          el.onmouseup=()=>{isDown=false;el.style.cursor="default";};
          el.onmousemove=e=>{
            if(!isDown) return;
            e.preventDefault();
            el.scrollLeft=scrollLeft-(e.pageX-el.offsetLeft-startX)*1.2;
          };
          let touchStartX=0, touchScrollLeft=0;
          el.ontouchstart=e=>{touchStartX=e.touches[0].pageX;touchScrollLeft=el.scrollLeft;};
          el.ontouchmove=e=>{el.scrollLeft=touchScrollLeft-(e.touches[0].pageX-touchStartX);};
        }}>

        {/* ── P1: Institutes ── */}
        <div className="admin-side-panel admin-p1" style={{...sidePanel,width:panelW.p1,...(panelCollapsed.p1?getCollapsedPanelShellStyle("p1"):{background:G.bg,borderRight:`1px solid ${G.border}`}),transition:panelWidthTransition,willChange:panelDragging?"width":"auto"}}>
          {panelCollapsed.p1 ? (
            <CollapsedPanelRail step="Step 1" label="Institutes" badge={institutes.length} direction="right" themeKey="p1" onExpand={()=>togglePanelCollapse("p1")} />
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 10px 4px",flexShrink:0}}>
                <div style={{...panelLabel,padding:0}}>Step 1 · Institutes</div>
                <CollapseButton direction="right" onClick={()=>togglePanelCollapse("p1")} title="Collapse institutes panel" />
              </div>
              <div style={{padding:"0 10px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
                {renderSearchInput(instSearch,setInstSearch,"Search institutes",true)}
                <div style={{fontSize:12,color:G.textL,marginTop:8}}>{visibleInstitutes.length} of {institutes.length} institutes</div>
                <div style={{marginTop:8}}>
                  <button onClick={openAllLegacySectionRepair}
                    style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",color:G.blue,border:"1px solid #C7D7F5",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                    Repair all institutes
                  </button>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
                {visibleInstitutes.length===0&&(
                  <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>
                    {institutes.length===0 ? "No institutes yet" : "No institutes match your search"}
                  </div>
                )}
                {visibleInstitutes.map(inst=>{
                  const isSel=inst===selInst;
                  const stats = instituteStats[inst] || { teacherCount:0, classCount:0 };
                  const tCount = stats.teacherCount;
                  const clsCount = stats.classCount;
                  return(
                    <div key={inst} style={{position:"relative",display:"flex",alignItems:"center",gap:4}}>
                      <div onClick={()=>handleInstituteSelect(inst)}
                        onTouchStart={e=>beginInstituteTouch(e, inst)}
                        onTouchMove={moveInstituteTouch}
                        onTouchEnd={e=>endInstituteTouch(e, inst)}
                        onTouchCancel={()=>cancelInstituteTouch(inst)}
                        style={{...siBase,flex:1,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent",touchAction:"pan-y",WebkitTapHighlightColor:"transparent"}}
                        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                        <div style={{fontSize:16,fontWeight:isSel?700:600,color:isSel?G.blue:G.text}}>{inst}</div>
                        <div style={{display:"flex",gap:5,marginTop:4}}>
                          <span style={{background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontSize:12,fontFamily:G.mono}}>{clsCount} class{clsCount!==1?"es":""}</span>
                          <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>{tCount} teacher{tCount!==1?"s":""}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={openDailyLedgrReport}
                  style={{
                    width:"100%",
                    margin:"8px 0 2px",
                    border:"1px solid #C7D7F5",
                    borderRadius:16,
                    background:"linear-gradient(180deg,#F8FBFF 0%,#EEF4FF 100%)",
                    padding:"13px 12px",
                    display:"flex",
                    alignItems:"center",
                    gap:10,
                    cursor:"pointer",
                    textAlign:"left",
                    boxShadow:reduceEffects ? "none" : "0 10px 22px rgba(29,78,216,0.08)",
                    WebkitTapHighlightColor:"transparent",
                  }}>
                  <div style={{width:34,height:34,borderRadius:12,background:G.blue,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <AppIcon icon={IconChartBar} size={17} color="#FFFFFF" />
                  </div>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:G.text,fontFamily:G.sans,lineHeight:1.2}}>Ledgr Daily Report</div>
                    <div style={{fontSize:11.5,color:G.textM,fontFamily:G.sans,lineHeight:1.35,marginTop:3}}>All institutes at a glance</div>
                  </div>
                  <AppIcon icon={IconChevronRight} size={16} color={G.blue} />
                </button>
              </div>
            </>
          )}
        </div>
        <PanelDivider onDrag={dx=>nudgeDesktopPanelWidth("p1", dx)} onToggleCollapse={()=>togglePanelCollapse("p1")} onDragStart={()=>setPanelDragging(true)} onDragEnd={()=>setPanelDragging(false)} />

        {/* ── P2: Toggle + Teacher or Class list ── */}
        <div className="admin-side-panel admin-p2" style={{...sidePanel,width:panelW.p2,...(panelCollapsed.p2?getCollapsedPanelShellStyle("p2"):{background:G.surface,borderRight:`1px solid ${G.border}`}),transition:panelWidthTransition,willChange:panelDragging?"width":"auto"}}>
          {panelCollapsed.p2 ? (
            <CollapsedPanelRail
              step="Step 2"
              label={tab==="class" ? "Classes" : "Teachers"}
              badge={selInst ? (tab==="class" ? instClasses.length : instTeachers.length) : 0}
              direction="right"
              themeKey="p2"
              onExpand={()=>togglePanelCollapse("p2")}
            />
          ) : (
            <>
              <div style={{padding:"12px 12px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:G.display,fontSize:17,fontWeight:700,color:G.text,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selInst||"—"}</div>
                    {selInst&&<div style={{fontSize:12,color:G.textL,marginTop:3}}>{instClasses.length} classes · {instTeachers.length} teachers</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {selInst&&(
                      <button onClick={()=>setExportOpen(true)}
                        style={{display:"flex",alignItems:"center",gap:6,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"8px 13px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:G.sans,WebkitTapHighlightColor:"transparent"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export
                      </button>
                    )}
                    <CollapseButton direction="right" onClick={()=>togglePanelCollapse("p2")} title="Collapse step 2 panel" />
                  </div>
                </div>
                {/* Toggle */}
                <div style={{display:"flex",gap:0,background:G.bg,borderRadius:8,padding:3,border:`1px solid ${G.border}`}}>
                  {["class","teacher"].map(t=>(
                    <button key={t} onClick={()=>{resetNav(t);}}
                      style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:G.sans,textAlign:"center",transition:"all 0.15s",background:tab===t?G.navy:"none",color:tab===t?"#fff":G.textM}}>
                      {t==="class"?"By Class":"By Teacher"}
                    </button>
                  ))}
                </div>
                {selInst&&renderSearchInput(p2Search,setP2Search,tab==="class"?"Search classes, subjects, teachers":"Search teachers",true)}
                {selInst&&<div style={{fontSize:12,color:G.textL,marginTop:8}}>
                  {tab==="class"
                    ? visibleInstClassCountLabel
                    : `${visibleInstTeachers.length} of ${instTeachers.length} teachers`}
                </div>}
                {selInst&&tab==="class"&&(
                  <div style={{marginTop:8}}>
                    <button onClick={openLegacySectionRepair}
                      style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",color:G.blue,border:"1px solid #C7D7F5",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                      Map or delete old sections
                    </button>
                  </div>
                )}
                {selInst&&renderWarmupBanner(false)}
              </div>
              <div style={{fontSize:11,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
                {tab==="class"?"Classes ↓ (latest activity first)":"Teachers"}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
                {selInst&&tab==="class"&&<div style={{padding:"8px 12px 6px"}}>{renderProgramFilterBar(false)}</div>}
                {!selInst&&<div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>Select an institute</div>}
                {selInst&&tab==="teacher"&&instTeachers.length===0&&loadingUids.size>0&&(
                  <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:13,fontFamily:G.mono}}>
                    <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${G.blueL}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 8px"}}/>
                    loading teachers…
                  </div>
                )}
                {selInst&&tab==="teacher"&&visibleInstTeachers.map(t=>{
                  const d=fullData[t.uid]||{};
                  const name=d.profile?.name||t.name||"?";
                  const isSel=selP2===t.uid;
                  const activityLabel = instTeacherMeta[t.uid]?.label || lastEntryCaption(null);
                  const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
                  return(
                    <div key={t.uid} onClick={()=>openTeacherSelection(t.uid)}
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                      <div style={{width:28,height:28,borderRadius:7,background:isSel?G.blue:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:isSel?"#fff":G.blue,fontFamily:G.mono,flexShrink:0}}>
                        {(name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                        <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:3}}>{activityLabel}</div>
                        {otherInsts.length>0&&<AlsoAtInstitutes institutes={otherInsts} />}
                      </div>
                    </div>
                  );
                })}
                {selInst&&tab==="class"&&instClasses.length===0&&loadingUids.size>0&&(
                  <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:13,fontFamily:G.mono}}>
                    <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${G.blueL}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 8px"}}/>
                    loading classes…
                  </div>
                )}
                {selInst&&tab==="class"&&displayedProgramGroups.map(group=>(
                  <div key={group.key} style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 12px 4px"}}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <button onClick={()=>setActiveProgramFilter(current => current === group.key ? null : group.key)}
                          style={{display:"inline-flex",alignItems:"center",background:activeProgramFilter===group.key?group.accent:group.bg,color:activeProgramFilter===group.key?"#fff":group.accent,border:`1px solid ${activeProgramFilter===group.key?group.accent:group.border}`,borderRadius:999,padding:"5px 11px",fontSize:11,fontWeight:800,fontFamily:G.sans,letterSpacing:0.3,cursor:"pointer",boxShadow:activeProgramFilter===group.key?G.shadowSm:"none"}}>
                          {group.label}
                        </button>
                        <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>
                          {group.items.length} class{group.items.length!==1?"es":""}
                        </span>
                      </div>
                    </div>
                    {group.items.map(cls=>{
                      const isSel=selP2===cls.raw;
                      return(
                        <div key={cls.raw} onClick={()=>openClassSelection(cls.raw)}
                          style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                          onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                          onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                            <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS,flex:1,minWidth:0}}>{cls.display}</div>
                            {renderSectionDeleteButton(cls, { compact:true })}
                          </div>
                          {cls.subjects.length>0&&(
                            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                              {cls.subjects.map(s=><span key={s} style={{background:isSel?G.surface:G.bg,border:`1px solid ${G.border}`,borderRadius:20,padding:"1px 8px",fontSize:11,fontFamily:G.sans,color:G.textS}}>{s}</span>)}
                            </div>
                          )}
                          <div style={{marginTop:4}}>
                            <span style={{background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontSize:12,fontFamily:G.mono}}>
                              {cls.teachers.length} teacher{cls.teachers.length!==1?"s":""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {selInst&&((tab==="class"&&displayedVisibleClassCount===0&&instClasses.length>0)||(tab==="teacher"&&visibleInstTeachers.length===0&&instTeachers.length>0))&&(
                  <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>No {tab==="class"?"classes":"teachers"} match your search</div>
                )}
              </div>
            </>
          )}
        </div>
        <PanelDivider onDrag={dx=>nudgeDesktopPanelWidth("p2", dx)} onToggleCollapse={()=>togglePanelCollapse("p2")} onDragStart={()=>setPanelDragging(true)} onDragEnd={()=>setPanelDragging(false)} />

        {/* ── P3: Sub-list ── */}
        <div className="admin-side-panel admin-p3" style={{...sidePanel,width:panelW.p3,...(panelCollapsed.p3?getCollapsedPanelShellStyle("p3"):{background:G.bg,borderRight:`1px solid ${G.border}`}),transition:panelWidthTransition,willChange:panelDragging?"width":"auto"}}>
          {panelCollapsed.p3 ? (
            <CollapsedPanelRail
              step="Step 3"
              label={tab==="teacher"?"Classes":"Teachers"}
              badge={selP2 ? p3Items.length : 0}
              direction="right"
              themeKey="p3"
              onExpand={()=>togglePanelCollapse("p3")}
            />
          ) : (
            <>
              <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:G.display,fontSize:15,fontWeight:700,color:G.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {!selP2?"—":p2Label(selP2)}
                    </div>
                    <div style={{fontSize:12,color:G.textM,fontFamily:G.mono,marginTop:2}}>
                      {isAggregateSelection?`${selInst} · combined institute view`:tab==="class"?"Teachers in this class":"Their classes at "+selInst}
                    </div>
                  </div>
                  <CollapseButton direction="right" onClick={()=>togglePanelCollapse("p3")} title="Collapse step 3 panel" />
                </div>
              </div>
              <div style={{fontSize:11,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
                {isAggregateSelection?"Overview":"Step 3 · "+(tab==="teacher"?"Classes":"Teachers")}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selP2&&<div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>Select from left</div>}
            {selP2&&!isAggregateSelection&&(
              <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:12,padding:"14px 13px",marginBottom:10,boxShadow:G.shadowSm}}>
                <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display}}>
                  {tab==="teacher"?"Open all classes together":"Open all teachers together"}
                </div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:5}}>
                  {tab==="teacher"
                    ? "See this teacher’s full institute timeline, grouped by class like the export view."
                    : "See every teacher who taught this class in one grouped timeline."}
                </div>
                <button onClick={openScopedFullView}
                  style={{marginTop:12,width:"100%",padding:"9px 10px",background:fullView?G.blueL:G.navy,color:fullView?G.blue:"#fff",border:fullView?`1px solid ${G.blue}`:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                  View Full
                </button>
              </div>
            )}
            {isAggregateSelection&&(
              <div style={{background:G.surface,borderRadius:10,border:`1px solid ${G.border}`,padding:"14px 13px"}}>
                <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display}}>{aggregateTitle}</div>
                <div style={{fontSize:13,color:G.textM,lineHeight:1.55,marginTop:5}}>
                  Right panel now shows the full {selInst} timeline, grouped by class and arranged chronologically within each class.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
                  <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:9,padding:"9px 10px"}}>
                    <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase"}}>Classes</div>
                    <div style={{fontSize:18,fontWeight:700,color:G.blue,fontFamily:G.display,marginTop:2}}>{aggregateGroups.length}</div>
                  </div>
                  <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:9,padding:"9px 10px"}}>
                    <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase"}}>Entries</div>
                    <div style={{fontSize:18,fontWeight:700,color:G.blue,fontFamily:G.display,marginTop:2}}>{aggregateEntries.length}</div>
                  </div>
                </div>
                <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:10}}>
                  Loaded {aggregateLoadedTeacherCount}/{instTeachers.length} teachers
                </div>
              </div>
            )}


            {selP2&&!isAggregateSelection&&tab==="teacher"&&p3Items.map(cls=>{
              const isSel=selP3?.classId===cls.classId;
              return(
                <div key={cls.classId}
                  style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent",paddingRight:8}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div onClick={()=>{setFullView(null);setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute});setMobileStep(3);}}
                    style={{cursor:"pointer"}}>
                    <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS}}>{cls.display}</div>
                    <div style={{fontSize:14,color:G.textM,marginTop:3}}>{cls.subject}</div>
                    <div style={{marginTop:5}}>
                      <span style={{background:isSel?G.navy:G.blueL,color:isSel?"#fff":G.blue,borderRadius:10,padding:"3px 9px",fontSize:12,fontFamily:G.mono,fontWeight:600}}>
                        {cls.entryCount} {cls.entryCount===1?"entry":"entries"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Archived / left classes */}
            {selP2&&!isAggregateSelection&&tab==="teacher"&&archivedP3Items.length>0&&(()=>{
              return(<>
                <div style={{fontSize:11,letterSpacing:1.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"12px 6px 4px",borderTop:`1px solid ${G.border}`,marginTop:4}}>
                  Left / Archived ({archivedP3Items.length})
                </div>
                {archivedP3Items.map(cls=>{
                  const reason=LEAVE_REASON_MAP[cls.leaveReason]||null;
                  const dateStr=cls.deletedAt?new Date(cls.deletedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
                  return(
                    <div key={cls.classId}
                      style={{...siBase,background:"transparent",borderLeftColor:"transparent",opacity:0.65,cursor:"default"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{fontSize:15,fontWeight:600,color:G.textM,textDecoration:"line-through"}}>{cls.display}</div>
                        <span style={{fontSize:12,fontFamily:G.mono,color:G.textL}}>· {cls.entryCount} entries</span>
                      </div>
                      <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:1}}>{cls.subject}</div>
                      {reason&&(
                        <div style={{marginTop:5,background:G.bg,borderRadius:7,padding:"5px 8px",border:`1px solid ${G.border}`}}>
                          <div style={{fontSize:12,fontWeight:600,color:G.textM,fontFamily:G.sans}}>
                            {reason.icon} {reason.label}
                          </div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.sans,marginTop:1,lineHeight:1.4}}>{reason.desc}</div>
                          {dateStr&&<div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:2}}>Left on {dateStr}</div>}
                        </div>
                      )}
                      {!reason&&dateStr&&(
                        <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:3}}>Archived · {dateStr}</div>
                      )}
                    </div>
                  );
                })}
              </>);
            })()}

            {selP2&&!isAggregateSelection&&tab==="class"&&(()=>{
              const withEntries=p3Items.filter(t=>t.entryCount>0).sort((a,b)=>b.entryCount-a.entryCount);
              const noUpload=p3Items.filter(t=>t.entryCount===0);
              return(<>
                {withEntries.map(t=>{
                  const isSel=selP3?.teacherUid===t.uid;
                  const cls=instClasses.find(c=>c.raw===selP2);
                  return(
                    <div key={t.uid} onClick={()=>{
                        const cls=instClasses.find(c=>c.raw===selP2);
                        const clsObj=cls?.teachers.find(tc=>tc.uid===t.uid);
                        setFullView(null);
                        setSelP3({
                          teacherUid:t.uid,
                          classId:clsObj?.classId,
                          teacherName:t.name,
                          className:normaliseName(selP2),
                          subject:clsObj?.subject || cls?.subjects?.join(", ") || "",
                        });
                        setMobileStep(3);
                      }}
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                      <div style={{width:26,height:26,borderRadius:7,background:isSel?G.blue:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isSel?"#fff":G.blue,fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:isSel?G.blue:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:2}}>{t.entryCount} entries · ✓ uploaded</div>
                      </div>
                    </div>
                  );
                })}
                {noUpload.length>0&&<>
                  <div style={{fontSize:11,letterSpacing:1.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"10px 6px 4px"}}>No upload yet</div>
                  {noUpload.map(t=>(
                    <div key={t.uid}
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:G.bg,borderLeftColor:G.border}}>
                      <div style={{width:26,height:26,borderRadius:7,background:G.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:G.textL,fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:500,color:G.textM,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:2,fontWeight:600}}>⚠ No Entry Uploaded</div>
                      </div>
                    </div>
                  ))}
                </>}
              </>);
            })()}
              </div>
            </>
          )}
        </div>
        <PanelDivider onDrag={dx=>nudgeDesktopPanelWidth("p3", dx)} onToggleCollapse={()=>togglePanelCollapse("p3")} onDragStart={()=>setPanelDragging(true)} onDragEnd={()=>setPanelDragging(false)} />

        {/* ── P4: Entries ── */}
        <div className="admin-p4" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:G.bg,minWidth:0}}>
          {/* P4 header */}
          <div style={{background:G.bg,padding:"16px 16px 10px",flexShrink:0}}>
            <div style={{
              background:`linear-gradient(135deg, ${p4HeaderTone.bg1} 0%, ${p4HeaderTone.bg2} 74%)`,
              border:`1px solid ${p4HeaderTone.edge}`,
              borderRadius:26,
              padding:"20px 20px 18px",
              boxShadow:reduceEffects?"none":"0 18px 34px rgba(15,23,42,0.08)",
              position:"relative",
              overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:14,background:p4HeaderTone.wash}} />
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",position:"relative"}}>
                <div style={{minWidth:0,maxWidth:"min(820px,100%)"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:8,background:p4HeaderTone.chipBg,border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"6px 11px",fontSize:12,color:p4HeaderTone.chipText,fontFamily:G.mono,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
                    {p4HeaderEyebrow}
                  </span>
                  <div style={{fontFamily:G.display,fontSize:selInst?18:17,fontWeight:800,color:G.text,marginTop:10,lineHeight:1.2}}>
                    {p4HeaderTitle}
                  </div>
                  <div style={{fontSize:14,color:G.textM,marginTop:7,lineHeight:1.6,maxWidth:760}}>
                    {p4HeaderSubtitle}
                  </div>
                </div>
                {p4HeaderStatusNode}
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginTop:18,position:"relative"}}>
                <div style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.82)",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:20,padding:"12px 14px",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.75)"}}>
                  <PeriodSelector
                    period={period}
                    onChangePeriod={handlePeriodChange}
                    accentColor={p4HeaderTone.accent}
                    rangeStart={customRange.start}
                    rangeEnd={customRange.end}
                    onChangeRangeStart={handleRangeStartChange}
                    onChangeRangeEnd={handleRangeEndChange}
                  />
                </div>
                {(selP3||isAggregateSelection||isScopedFullView)&&(
                  <button onClick={()=>setExportOpen(true)}
                    style={{display:"flex",alignItems:"center",gap:7,background:`linear-gradient(135deg, ${p4HeaderTone.accent} 0%, ${mixHex(p4HeaderTone.accent, "#0F172A", 0.16)} 100%)`,color:"#fff",border:"none",borderRadius:12,padding:"10px 18px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,minHeight:40,WebkitTapHighlightColor:"transparent",flexShrink:0,boxShadow:`0 12px 22px ${alphaHex(p4HeaderTone.accent,0.18)}`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Entries body */}
          <div style={{flex:1,overflowY:"auto",padding:"10px 16px 32px"}}>
            {!selP3&&!isAggregateSelection&&!isScopedFullView&&renderOverviewPanel()}
            {isScopedFullView&&renderFullViewEntries(false)}
            {isAggregateSelection&&renderAggregateEntries(false)}
            {!isAggregateSelection&&selP3&&renderSelectedTimelineEntries(false)}
          </div>
        </div>
      </div>
      {/* Tagline footer — fixed, slim, both desktop and wide screens */}
      <div style={{flexShrink:0,height:26,background:G.navy,borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontFamily:"'Inter',sans-serif",letterSpacing:0.3}}>Every class. Every teacher. One place.</span>
      </div>
        </>
      )}
    </div>
  );
}

export default function AdminPanel(props){
  return <ErrorBoundary><AdminPanelInner {...props}/></ErrorBoundary>;
}
