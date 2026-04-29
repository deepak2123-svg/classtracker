import React, { useState, useEffect, useMemo, Component } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher, createInviteLink,
  getAllInstituteSections, saveInstituteGradeGroups, deleteInstituteGradeGroup,
  removeTeacherFromSystem, removeInstituteFromIndex,
  deleteEntryFromTeacherData, deleteClassFromTeacherData,
  getGlobalInstitutes, saveGlobalInstitute, deleteGlobalInstitute,
  repairTeacherIndex, saveProfileName,
} from "./firebase";
import { Avatar, todayKey, formatPeriod, TAG_STYLES, STATUS_STYLES } from "./shared.jsx";

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
  mono:"'JetBrains Mono',monospace",
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

function normaliseName(raw){
  if(!raw) return raw;
  const m=raw.match(/(\d+)/);
  if(!m) return raw;
  const num=parseInt(m[1]);
  const rest=raw.replace(/\d+(st|nd|rd|th)?/i,"").trim();
  return rest?`${num}${ordSuffix(num)} ${rest}`:`${num}${ordSuffix(num)}`;
}
function classNum(name){const m=(name||"").match(/(\d+)/);return m?parseInt(m[1]):0;}
const ALL_CLASSES_KEY = "__all_classes__";
const ALL_TEACHERS_KEY = "__all_teachers__";
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
function adminPeriodLabel(period){
  if(period==="today") return "Today";
  if(period==="week") return "This Week";
  if(period==="month") return "This Month";
  return "All Time";
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
        style={{ fill: "#6B7280", fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: 0.9 }}
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
function drawCanvasPill(ctx, { x, y, label, bg, border, color, font = "700 20px 'JetBrains Mono',monospace", padX = 16, height = 46 }){
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
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
async function downloadTeacherStatusShareImage({ instituteName, rows, summary, generatedOnLabel }){
  await waitForCanvasFonts();
  const width = 1080;
  const cardX = 36;
  const cardY = 36;
  const cardWidth = width - cardX * 2;
  const headerHeight = 198;
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
  ctx.font = "800 38px 'Poppins',sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Teacher entry status", contentX, cursorY);

  cursorY += 48;
  ctx.fillStyle = "#4B5563";
  ctx.font = "600 18px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, `${instituteName} · ${generatedOnLabel}`, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 34;
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 20px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, "Who has updated class logs today, plus week and month entry counts.", contentWidth),
    contentX,
    cursorY
  );

  cursorY += 46;
  let chipX = contentX;
  chipX += drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.updatedToday}/${summary.totalTeachers} updated today`,
    bg: "#DCFCE7",
    border: "#BBF7D0",
    color: "#166534",
    font: "700 20px 'JetBrains Mono',monospace",
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
    font: "700 20px 'JetBrains Mono',monospace",
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
    font: "700 20px 'JetBrains Mono',monospace",
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
    ctx.font = "700 19px 'JetBrains Mono',monospace";
    ctx.fillText(`Today ${item.todayEntries} • Week ${item.weekEntries} • Month ${item.monthEntries}`, contentX, rowTop + 74);

    ctx.font = "700 20px 'JetBrains Mono',monospace";
    const pillWidth = ctx.measureText(pillLabel).width + 36;
    drawCanvasPill(ctx, {
      x: contentX + contentWidth - pillWidth,
      y: rowTop + 4,
      label:pillLabel,
      bg:item.todayUpdated ? "#DCFCE7" : "#F8FAFC",
      border:item.todayUpdated ? "#BBF7D0" : "#DDE3ED",
      color:item.todayUpdated ? "#166534" : "#1F2937",
      font:"700 20px 'JetBrains Mono',monospace",
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
function getEntriesInRange(classNotes={}, days=null){
  // returns flat array of {dateKey, entry} sorted by time asc
  const cutoff=days?Date.now()-days*24*60*60*1000:0;
  const result=[];
  Object.entries(classNotes||{}).forEach(([dk,arr])=>{
    if(days && new Date(dk).getTime()<cutoff) return;
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
          <p style={{color:"#94ADA5",fontSize:13,fontFamily:"'JetBrains Mono',monospace",background:"#F7F8F6",padding:"8px 12px",borderRadius:8,marginBottom:20,wordBreak:"break-all"}}>
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
                          <div style={{fontSize:12,color:"#6B7280",fontFamily:"'JetBrains Mono',monospace"}}>{a.sub}</div>
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
            <div style={{fontSize:12,color:W.textL,fontFamily:"'JetBrains Mono',monospace"}}>{inst}</div>
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
  const W = { navy:"#1A2F5A",border:"#E2E8F0",text:"#0F172A",textM:"#475569",textL:"#94A3B8",surface:"#fff",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'JetBrains Mono',monospace" };
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
    sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'JetBrains Mono',monospace" };

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



function AdminPanelInner({user}){
  const PANEL_LIMITS = React.useMemo(()=>({
    p1:{ min:96, max:340, collapsed:80, default:175 },
    p2:{ min:160, max:380, collapsed:90, default:205 },
    p3:{ min:110, max:360, collapsed:80, default:200 },
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
  const [mobileStep,  setMobileStep]  = useState(0);
  const [exportOpen,   setExportOpen]   = useState(false);
  const [statusImageBusy, setStatusImageBusy] = useState(false);
  const [panelW,       setPanelW]       = useState({p1:175, p2:205, p3:200}); // resizable
  const [panelCollapsed, setPanelCollapsed] = useState({p1:false, p2:false, p3:false});
  const [panelDragging, setPanelDragging] = useState(false);
  const [isMobile,     setIsMobile]     = useState(false);
  const [isWeakDevice, setIsWeakDevice] = useState(false);
  const [reduceEffects,setReduceEffects]= useState(false);
  const [mobileLiteMode,setMobileLiteMode] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [manageTab,    setManageTab]    = useState("teachers"); // teachers | admins | institutes
  const [adminBin,     setAdminBin]     = useState([]); // [{type:"class"|"institute", ...data, deletedAt}]
  const [binView,      setBinView]      = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
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
  const [deletedInstitutes, setDeletedInstitutes] = useState(new Set());
  const [globalInstList, setGlobalInstList] = useState([]); // from config/institutes
  const [instSectionsAll, setInstSectionsAll] = useState({}); // from config/sections
  const [instDetailView, setInstDetailView] = useState(null); // null | instituteName
  const [grpModal, setGrpModal]             = useState(null); // null | {mode,inst,group?}
  const [instMenuOpen, setInstMenuOpen]     = useState(null); // inst name whose ⋯ menu is open
  const [instSearch, setInstSearch]         = useState("");
  const [p2Search, setP2Search]             = useState("");
  const [repairingTeacherUid, setRepairingTeacherUid] = useState(null);
  const [instClassificationOpen, setInstClassificationOpen] = useState({});
  const [instWarmup, setInstWarmup] = useState({ inst:null, total:0, loaded:0 });
  const fullDataRequestRef = React.useRef({});
  const warmupJobRef = React.useRef(0);
  const expandedPanelWidthsRef = React.useRef({ p1:PANEL_LIMITS.p1.default, p2:PANEL_LIMITS.p2.default, p3:PANEL_LIMITS.p3.default });
  const panelWRef = React.useRef({ p1:PANEL_LIMITS.p1.default, p2:PANEL_LIMITS.p2.default, p3:PANEL_LIMITS.p3.default });
  const panelResizeFrameRef = React.useRef(null);
  const panelsBodyRef = React.useRef(null);

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
      const [t,r,gInst]=await Promise.all([getAllTeachers(),getAllRoles(),getGlobalInstitutes()]);
      setTeachers(t); setRoles(r);

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

  // ── Browser history — Android back gesture ───────────────────────────────────
  // Encode the full nav state so every meaningful screen transition is back-able
  function navState() {
    return { view, mobileStep, instDetailView: instDetailView||null };
  }
  function pushNav(state) {
    window.history.pushState(state, "");
  }

  // Seed base history on mount
  useEffect(() => {
    window.history.replaceState({ view:"main", mobileStep:0, instDetailView:null }, "");
    window.history.pushState({ view:"main", mobileStep:0, instDetailView:null }, "");
  }, []);

  // When key nav state changes, push a new history entry
  useEffect(() => {
    window.history.pushState({ view, mobileStep, instDetailView:instDetailView||null }, "");
  }, [view, mobileStep, instDetailView]);

  // Handle back gesture
  useEffect(() => {
    const onPop = (e) => {
      const s = e.state;
      if (!s) return;
      // Restore nav state from history entry — use raw setters to avoid re-pushing
      if (s.view !== undefined)            setView(s.view);
      if (s.mobileStep !== undefined)      setMobileStep(s.mobileStep);
      if (s.instDetailView !== undefined)  setInstDetailView(s.instDetailView);
      // Reset sub-selections when stepping back
      if (s.mobileStep < 3) setSelP3(null);
      if (s.mobileStep < 2) setSelP2(null);
      if (s.mobileStep < 1) { setSelInst(null); }
      if (s.view === "main") setInstDetailView(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Lazy-load full data for a teacher only when needed
  const ensureFullData = React.useCallback(async (uid) => {
    if(!uid) return null;
    if (fullData[uid]) return fullData[uid];
    if (fullDataRequestRef.current[uid]) return fullDataRequestRef.current[uid];
    setLoadingUids(s=>s.has(uid)?s:new Set([...s,uid]));
    const pending = getTeacherFullData(uid)
      .then(d=>{
        if (d) setFullData(prev=>prev[uid]?prev:{...prev,[uid]:d});
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
  },[fullData]);

  const getInstituteTeacherUids = React.useCallback((inst) => {
    const norm = s => (s || "").trim().toLowerCase();
    return teachers
      .filter(t => {
        const d = fullData[t.uid];
        if (d) return (d.classes || []).some(c => norm(c.institute) === norm(inst));
        return (t.institutes || []).some(i => norm(i) === norm(inst));
      })
      .map(t => t.uid);
  }, [teachers, fullData]);

  const warmTeacherUids = React.useCallback(async (uids, instLabel = null) => {
    const requestId = ++warmupJobRef.current;
    const unique = [...new Set((uids || []).filter(Boolean))];
    const missing = unique.filter(uid => !fullData[uid]);

    if(instLabel){
      setInstWarmup({ inst:instLabel, total:missing.length, loaded:0 });
    }
    if(!missing.length){
      if(instLabel) setInstWarmup({ inst:instLabel, total:0, loaded:0 });
      return;
    }

    for(let i=0;i<missing.length;i+=1){
      if(requestId!==warmupJobRef.current) return;
      await ensureFullData(missing[i]);
      if(requestId!==warmupJobRef.current) return;
      if(instLabel){
        const loaded = i + 1;
        setInstWarmup(prev=>prev.inst===instLabel?{...prev,loaded}:prev);
      }
      if((isWeakDevice || mobileLiteMode) && i < missing.length - 1){
        await new Promise(resolve=>window.setTimeout(resolve, 40));
      }
    }
  }, [ensureFullData, fullData, isWeakDevice, mobileLiteMode]);

  const warmInstitute = React.useCallback((inst) => {
    warmTeacherUids(getInstituteTeacherUids(inst), inst);
  }, [getInstituteTeacherUids, warmTeacherUids]);

  const clampPanelWidth = React.useCallback((key, nextWidth) => {
    const limits = PANEL_LIMITS[key];
    if(!limits) return nextWidth;
    const min = key==="p2" ? limits.min : limits.collapsed;
    return Math.max(min, Math.min(limits.max, nextWidth));
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

  // ── Derived: institutes ───────────────────────────────────────────────────
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
    });
    // Remove locally deleted institutes
    deletedInstitutes.forEach(i=>set.delete(i));
    // Preserve admin-defined order from globalInstList, append any extras at end
    const ordered = globalInstList.filter(i=>set.has(i));
    const extras   = Array.from(set).filter(i=>!globalInstList.includes(i)).sort();
    return [...ordered, ...extras];
  },[globalInstList,teachers,fullData,deletedInstitutes]);

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
              const key = (c.section||"").trim().toLowerCase();
              if(key) classKeys.add(key);
            });
          }
          return;
        }
        if((t.institutes||[]).some(i=>sameInstituteName(i, inst))){
          teacherUids.add(t.uid);
        }
      });
      acc[inst] = {
        teacherCount: teacherUids.size,
        classCount: classKeys.size || teacherUids.size,
      };
      return acc;
    }, {});
  },[institutes,teachers,fullData]);

  // ── Teachers at selected institute ────────────────────────────────────────
  const instTeachers=useMemo(()=>{
    if(!selInst) return [];
    const norm = s => (s||"").trim().toLowerCase();
    return teachers.filter(t=>{
      const d=fullData[t.uid];
      if(d){
        // fullData loaded — use it as ground truth (handles stale index)
        return (d.classes||[]).some(c=>norm(c.institute)===norm(selInst));
      }
      // fullData not yet loaded — use index as approximation
      return (t.institutes||[]).some(i=>norm(i)===norm(selInst));
    });
  },[selInst,teachers,fullData]);

  // ── Classes at selected institute ─────────────────────────────────────────
  const instClasses=useMemo(()=>{
    if(!selInst) return [];
    const map={};
    // Use teachers that belong to this institute (from index or fullData)
    const normI = s => (s||"").trim().toLowerCase();
    const relevantTeachers=teachers.filter(t=>{
      const d=fullData[t.uid];
      if(d) return (d.classes||[]).some(c=>normI(c.institute)===normI(selInst));
      return (t.institutes||[]).some(i=>normI(i)===normI(selInst));
    });
    const norm = s => (s||"").trim().toLowerCase();
    relevantTeachers.forEach(t=>{
      const d=fullData[t.uid];
      if(!d) return; // fullData not loaded yet for this teacher
      (d.classes||[]).filter(c=>norm(c.institute)===norm(selInst)).forEach(c=>{
        const key=c.section;
        if(!map[key]) map[key]={raw:c.section,display:normaliseName(c.section),subjects:new Set(),teachers:[]};
        if(c.subject) map[key].subjects.add(c.subject.trim());
        const entryCount=Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
        const lastActive=lastEntryTs((d.notes||{})[c.id]||{});
        map[key].teachers.push({uid:t.uid,name:d.profile?.name||t.name,entryCount,lastActive,classId:c.id,subject:c.subject});
      });
    });
    return Object.values(map).map(c=>({...c,subjects:[...c.subjects].sort()})).sort((a,b)=>classNum(b.display)-classNum(a.display));
  },[selInst,teachers,fullData]);

  const instSearchKey = instSearch.trim().toLowerCase();
  const p2SearchKey = p2Search.trim().toLowerCase();

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
        .map(c=>({
          display:normaliseName(c.section),
          raw:c.section,
          subject:c.subject,
          institute:c.institute||"",
          classId:c.id,
          entryCount:Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0),
        }))
        .sort((a,b)=>classNum(b.display)-classNum(a.display));
    } else {
      // P2 = class raw → P3 = teachers who teach that class
      const cls=instClasses.find(c=>c.raw===selP2);
      if(!cls) return [];
      return [...cls.teachers].sort((a,b)=>b.entryCount-a.entryCount);
    }
  },[selP2,tab,selInst,fullData,instClasses]);

  // ── Archived (left) classes for teacher tab ───────────────────────────────
  const archivedP3Items=useMemo(()=>{
    if(!selP2||tab!=="teacher") return [];
    const d=fullData[selP2];
    if(!d) return [];
    return (d.trash?.classes||[])
      .filter(tc=>(tc.institute||"").trim().toLowerCase()===(selInst||"").trim().toLowerCase())
      .map(tc=>({
        display:normaliseName(tc.section),
        raw:tc.section,
        subject:tc.subject,
        institute:tc.institute||"",
        classId:tc.id,
        leaveReason:tc.leaveReason||"",
        leaveReasonLabel:tc.leaveReasonLabel||"Archived",
        deletedAt:tc.deletedAt||null,
        entryCount:Object.values(tc.savedNotes||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0),
      }))
      .sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0));
  },[selP2,tab,selInst,fullData]);

  // ── Entries for P4 ────────────────────────────────────────────────────────
  const p4Entries=useMemo(()=>{
    if(!selP3) return null;
    const {teacherUid, classId}=selP3;
    const d=fullData[teacherUid];
    if(!d) return null;
    const classNotes=(d.notes||{})[classId]||{};
    const days=period==="today"?1:period==="week"?7:period==="month"?30:null;
    const flat=getEntriesInRange(classNotes,days);
    return groupByDate(flat);
  },[selP3,fullData,period]);

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
  const periodDays = period==="today"?1:period==="week"?7:period==="month"?30:null;
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
    const flat = getEntriesInRange(classNotes, periodDays);
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
  },[selP3,fullData,periodDays]);

  const collectEntriesForTeacherClass = (teacherUid, teacherName, classId, className, subject, instituteName = selInst, days = periodDays) => {
    const d = fullData[teacherUid];
    if(!d) return [];
    return getEntriesInRange((d.notes||{})[classId]||{}, days).map(({dateKey, entry})=>({
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
          normaliseName(c.section),
          c.subject,
          c.institute || selInst,
          periodDays
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
          periodDays
        ))
        .sort(compareAdminPanelEntries);
    }
    return [];
  },[fullView,selInst,fullData,instClasses,periodDays]);

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
            normaliseName(c.section),
            c.subject,
            c.institute || selInst,
            periodDays
          ));
      })
      .sort(compareAdminPanelEntries);
  },[isAggregateSelection,selInst,teachers,fullData,periodDays]);

  const aggregateGroups=useMemo(()=>{
    if(!isAggregateSelection) return [];
    return groupAdminPanelEntries(aggregateEntries);
  },[isAggregateSelection,aggregateEntries]);

  const aggregateLoadedTeacherCount = useMemo(()=>{
    if(!selInst) return 0;
    return instTeachers.filter(t=>!!fullData[t.uid]).length;
  },[selInst,instTeachers,fullData]);
  const aggregateLoading = isAggregateSelection && selInst && aggregateLoadedTeacherCount < instTeachers.length;
  const overviewPeriodText = adminPeriodLabel(period);

  const selectedInstituteEntryCount = useMemo(()=>{
    if(!selInst) return 0;
    return teachers.reduce((sum,t)=>{
      const d = fullData[t.uid];
      if(!d) return sum;
      return sum + (d.classes||[])
        .filter(c=>sameInstituteName(c.institute, selInst))
        .reduce((classSum,c)=>classSum + Object.values((d.notes||{})[c.id]||{}).reduce((daySum,arr)=>daySum + (Array.isArray(arr)?arr.length:0),0),0);
    },0);
  },[selInst,teachers,fullData]);

  const selectedInstitutePeriodCount = useMemo(()=>{
    if(!selInst) return 0;
    return teachers.reduce((sum,t)=>{
      const d = fullData[t.uid];
      if(!d) return sum;
      return sum + (d.classes||[])
        .filter(c=>sameInstituteName(c.institute, selInst))
        .reduce((classSum,c)=>classSum + getEntriesInRange((d.notes||{})[c.id]||{}, periodDays).length,0);
    },0);
  },[selInst,teachers,fullData,periodDays]);

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
          const entries = getEntriesInRange((d.notes||{})[t.classId]||{}, periodDays);
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
          subjects:Array.from(subjectTotals.entries())
            .sort((a,b)=>b[1]-a[1] || exportTextSorter.compare(a[0],b[0]))
            .map(([subject, minutes])=>({subject, minutes, color:subjectColor(subject)})),
        };
      })
      .filter(item=>item.entryCount>0)
      .sort((a,b)=>classNum(b.display)-classNum(a.display) || exportTextSorter.compare(a.display,b.display));
  },[selInst,instClasses,fullData,periodDays]);

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
          const className = normaliseName(c.section);
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
  },[teachers,fullData,selInst]);

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
    if (!newName.trim() || newName.trim() === oldName) { setRenamingInst(null); return; }
    try {
      // Get current list, replace old with new
      const current = await getGlobalInstitutes();
      const updated = current.map(i => i === oldName ? newName.trim() : i);
      const { doc, setDoc } = await import("firebase/firestore");
      const { db: fdb } = await import("./firebase");
      await setDoc(doc(fdb, "config", "institutes"), { list: updated });
      setGlobalInstList(updated);
      // Also update deletedInstitutes set if it was there
      setDeletedInstitutes(s => {
        if (!s.has(oldName)) return s;
        const n = new Set(s); n.delete(oldName); n.add(newName.trim()); return n;
      });
      setRenamingInst(null);
      // success — UI updates automatically
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
    adminConfirmDialog("Remove admin access?","Remove Admin",async()=>{
      await demoteToTeacher(uid);
      setRoles(r=>({...r,[uid]:"teacher"}));
    });
  };

  // ── Delete handlers ───────────────────────────────────────────────────────
  const confirmDelete = (modal) => setDeleteModal(modal);

  // Simple confirm wrapper used by promote/demote/restore actions
  const adminConfirmDialog = (msg, confirmLabel, onConfirm) => {
    setAdminConfirm({ msg, confirmLabel, onConfirm });
  };

  const handleDeleteInstitute = (inst) => {
    confirmDelete({
      title: `Delete "${inst}"?`,
      lines: [
        "This removes the institute from all teacher records and the admin panel.",
        "Teachers and their entries are NOT deleted — they just won't appear under this institute.",
      ],
      confirmLabel: "Delete Institute",
      onConfirm: async () => {
        setDeleteBusy(true);
        try {
          // 1. Remove from config/institutes (the authoritative global list)
          await deleteGlobalInstitute(inst);
          // 2. Remove from every teacher's index entry
          await removeInstituteFromIndex(inst);
          // 3. Update local state immediately so UI reflects change
          setGlobalInstList(prev => prev.filter(i => i.trim().toLowerCase() !== inst.trim().toLowerCase()));
          setDeletedInstitutes(s => new Set([...s, inst.trim()]));
          setTeachers(ts => ts.map(t => ({
            ...t,
            institutes: (t.institutes||[]).filter(i => i.trim().toLowerCase() !== inst.trim().toLowerCase()),
          })));
          if (selInst === inst) { setSelInst(null); resetNav(); }
          // 4. Save to admin recycle bin
          setAdminBin(b=>[...b,{type:"institute",name:inst,deletedAt:Date.now(),deletedBy:user.uid}]);
        } catch(e) { showAdminToast("Failed to delete: " + e.message); }
        setDeleteBusy(false); setDeleteModal(null);
      },
    });
  };

  const handleDeleteClass = (teacherUid, classId, className, teacherName) => {
    confirmDelete({
      title: `Delete class "${className}"?`,
      lines: [
        `This permanently deletes the class and ALL its entries from ${teacherName}'s account.`,
        "This cannot be undone. The teacher will lose all entries for this class.",
      ],
      confirmLabel: "Delete Class Forever",
      onConfirm: async () => {
        setDeleteBusy(true);
        // Save to admin recycle bin before deleting
        setAdminBin(b=>[...b,{type:"class",name:className,teacherName,teacherUid,classId,institute:selInst,deletedAt:Date.now(),deletedBy:user.uid}]);
        await deleteClassFromTeacherData(teacherUid, classId);
        // Refresh this teacher's full data
        const fresh = await getTeacherFullData(teacherUid);
        if (fresh) setFullData(prev => ({ ...prev, [teacherUid]: fresh }));
        if (selP3?.classId === classId) setSelP3(null);
        setDeleteBusy(false); setDeleteModal(null);
      },
    });
  };

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
    clearDrilldown();
    setP2Search("");
    if(newTab)setTab(newTab);
    setMobileStep(s=>Math.min(s,1));
  };

  // When institute is selected, warm its teachers sequentially in the background.
  // This avoids the old "fan out dozens of reads at once" behavior that hurts
  // older Android devices.
  const onSelectInstitute = (inst) => {
    setSelInst(inst);
    clearDrilldown();
    setP2Search("");
    setMobileStep(1);
    warmInstitute(inst);
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
              normaliseName(c.section),
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
          .flatMap(c => rowsForTeacherClass(selP2, tName, c.id, normaliseName(c.section), c.subject, sk, ek, c.institute || selInst))
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
    setSelP2(uid);
    setSelP3(null);
    setFullView(null);
    setMobileStep(2);
    ensureFullData(uid);
  };

  const openClassSelection = (raw) => {
    setSelP2(raw);
    setSelP3(null);
    setFullView(null);
    setMobileStep(2);
    warmTeacherUids(instClasses.find(c=>c.raw===raw)?.teachers?.map(t=>t.uid) || []);
  };

  const openScopedFullView = () => {
    if(!selP2) return;
    if(tab==="teacher"){
      setFullView({ kind:"teacher", teacherUid:selP2, teacherName:selectedTeacherName(selP2) });
      ensureFullData(selP2);
    } else {
      setFullView({ kind:"class", classRaw:selP2 });
      warmTeacherUids(instClasses.find(c=>c.raw===selP2)?.teachers?.map(t=>t.uid) || []);
    }
    setSelP3(null);
    setMobileStep(3);
  };

  const openAggregateView = (kind) => {
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
          <div key={group.className} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,marginBottom:mobile?14:16,overflow:"hidden",boxShadow:G.shadowSm}}>
            <div style={{padding:mobile?"13px 14px":"14px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:mobile?17:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.className}</div>
                  <div style={{fontSize:13,color:G.textM,marginTop:3,lineHeight:1.5}}>
                    {group.subjectList.length>0 ? `Subjects: ${group.subjectList.join(", ")}` : "Subjects: —"}
                  </div>
                  <div style={{fontSize:13,color:G.textL,marginTop:2,lineHeight:1.5}}>
                    Teachers: {group.teacherList.join(", ") || "—"}
                  </div>
                </div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                  {group.entries.length} {group.entries.length===1?"entry":"entries"}
                </span>
              </div>
            </div>
            <div style={{padding:mobile?"10px 10px 2px":"10px 12px 4px"}}>
              {group.entries.map((entry, idx)=>{
                const tag = TAG_STYLES[entry.tag] || TAG_STYLES.note;
                const status = STATUS_STYLES[entry.status] || null;
                const title = entry.title || "Untitled entry";
                return(
                  <div key={entry.id || `${entry.teacherUid}_${entry.classId}_${entry.dateKey}_${idx}`} style={{border:`1px solid ${G.border}`,borderRadius:10,marginBottom:10,overflow:"hidden"}}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:mobile?"11px 12px":"11px 13px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
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
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{title}</div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:4}}>
                            {entry.teacherName} · {entry.subject || "No subject"}
                          </div>
                          {entry.body&&<div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:7,whiteSpace:"pre-wrap"}}>{entry.body}</div>}
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
          <div key={group.className} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,marginBottom:mobile?14:16,overflow:"hidden",boxShadow:G.shadowSm}}>
            <div style={{padding:mobile?"13px 14px":"14px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:mobile?17:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.className}</div>
                  <div style={{fontSize:13,color:G.textM,marginTop:3,lineHeight:1.5}}>
                    {group.subjectList.length?`Subjects: ${group.subjectList.join(", ")}`:"Subjects: —"}
                  </div>
                  <div style={{fontSize:13,color:G.textL,marginTop:2,lineHeight:1.5}}>
                    Teachers: {group.teacherList.join(", ") || "—"}
                  </div>
                </div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                  {group.entries.length} {group.entries.length===1?"entry":"entries"}
                </span>
              </div>
            </div>
            <div style={{padding:mobile?"10px 10px 2px":"10px 12px 4px"}}>
              {group.entries.map((entry, idx)=>{
                const tag = TAG_STYLES[entry.tag] || TAG_STYLES.note;
                const status = STATUS_STYLES[entry.status] || null;
                return(
                  <div key={entry.id || `${entry.teacherUid}_${entry.classId}_${entry.dateKey}_${idx}`} style={{border:`1px solid ${G.border}`,borderRadius:10,marginBottom:10,overflow:"hidden"}}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:mobile?"11px 12px":"11px 13px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
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
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{entry.title || "Untitled entry"}</div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:4}}>
                            {entry.teacherName} · {entry.subject || "No subject"}
                          </div>
                          {entry.body&&<div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:7,whiteSpace:"pre-wrap"}}>{entry.body}</div>}
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
        <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:16,padding:mobile?"14px 14px 13px":"16px 18px",boxShadow:reduceEffects?"none":G.shadowSm,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:1}}>Selection summary</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
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
            <span style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textS,fontFamily:G.mono,fontWeight:700}}>
              {overviewPeriodText}
            </span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
            {statCard("Entries", summary.entryCount)}
            {statCard("Taught time", summary.totalMinutes>0 ? formatDurationShort(summary.totalMinutes) : "—", summary.totalMinutes>0 ? "#1B8A4C" : G.textM)}
            {statCard("Active days", summary.activeDays || "—")}
            {statCard("Last update", summary.lastAgo || "No uploads", summary.lastAgo ? G.blue : G.textM)}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
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
            <div key={dk} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,marginBottom:16,overflow:"hidden",boxShadow:reduceEffects?"none":G.shadowSm}}>
              <div style={{padding:mobile?"12px 14px":"13px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
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
              <div style={{padding:mobile?"6px 10px":"6px 12px"}}>
                {entries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  const status=note.status&&STATUS_STYLES[note.status]?STATUS_STYLES[note.status]:null;
                  return(
                    <div key={note.id||i} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,margin:"8px 0",overflow:"hidden"}}>
                      <div style={{height:3,background:status?.dot || tag.bg}}/>
                      <div style={{padding:mobile?"11px 12px":"12px 14px",display:"grid",gridTemplateColumns:mobile?"1fr":"120px minmax(0,1fr) auto",gap:12,alignItems:"center"}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:G.display,fontSize:mobile?16:17,fontWeight:700,color:G.text,lineHeight:1}}>
                            {note.timeStart?fmt12(note.timeStart):"No time"}
                          </div>
                          <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:4}}>
                            {note.timeEnd ? `→ ${fmt12(note.timeEnd)}` : "No end time"}
                          </div>
                        </div>
                        <div style={{minWidth:0}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                            {status&&<span style={{background:status.bg,color:status.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{status.label}</span>}
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:999,padding:"3px 8px",fontFamily:G.mono,fontWeight:700}}>{tag.label}</span>
                          </div>
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>
                            {note.title || "Untitled entry"}
                          </div>
                          {note.body&&(
                            <div style={{fontSize:13,color:G.textM,marginTop:5,lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
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
        <div style={{display:"grid",gap:14}}>
          <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:16,padding:"18px 18px 16px",boxShadow:reduceEffects?"none":G.shadowSm}}>
            <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>Admin Overview</div>
            <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:6,maxWidth:620}}>
              Start with an institute on the left. From there, panel 2 narrows by class or teacher, panel 3 lets you either drill down or open a full grouped view, and panel 4 becomes the working space.
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:12}}>
            {[
              summaryCard("Institutes", institutes.length),
              summaryCard("Teachers", teachers.length),
              summaryCard("Classes", totalClasses),
              summaryCard("Entries", totalEntries),
            ]}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(0,1.3fr) minmax(0,1fr)",gap:14}}>
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"16px",boxShadow:reduceEffects?"none":G.shadowSm}}>
              <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:10}}>Most active institutes</div>
              {globalInstituteHighlights.length===0 ? <div style={{fontSize:14,color:G.textL}}>No activity yet.</div> : globalInstituteHighlights.map(item=>(
                <div key={item.inst} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",padding:"10px 0",borderTop:`1px solid ${G.border}`}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:G.text}}>{item.inst}</div>
                    <div style={{fontSize:12,color:G.textL,marginTop:2}}>{item.classCount} classes · {item.teacherCount} teachers</div>
                  </div>
                  <span style={{background:G.blueL,color:G.blue,borderRadius:999,padding:"4px 10px",fontSize:12,fontFamily:G.mono,fontWeight:700,whiteSpace:"nowrap"}}>{item.entryCount} entries</span>
                </div>
              ))}
            </div>
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"16px",boxShadow:reduceEffects?"none":G.shadowSm}}>
              <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:10}}>Recent activity</div>
              {overviewRecentEntries.length===0 ? <div style={{fontSize:14,color:G.textL}}>Recent activity will appear here once entries are uploaded.</div> : overviewRecentEntries.map(item=>(
                <div key={item.id} style={{padding:"10px 0",borderTop:`1px solid ${G.border}`}}>
                  <div style={{fontSize:13,fontWeight:700,color:G.text}}>{item.title}</div>
                  <div style={{fontSize:12,color:G.textL,marginTop:3}}>{item.institute} · {item.className} · {item.teacherName}</div>
                  <div style={{fontSize:12,color:G.textL,marginTop:2,fontFamily:G.mono}}>{formatExportPdfDate(item.dateKey)}{item.timeStart?` · ${fmt12(item.timeStart)}`:""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if(!selP2){
      return (
        <div style={{display:"grid",gap:14}}>
          <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",border:`1px solid ${G.border}`,borderRadius:16,padding:"16px 18px",boxShadow:G.shadowSm,display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
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
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"16px",boxShadow:G.shadowSm}}>
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
              <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"16px",boxShadow:G.shadowSm}}>
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
              <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"16px",boxShadow:G.shadowSm}}>
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
    const folderIcon = label === "Teachers"
      ? "👥"
      : label === "Classes"
        ? "📚"
        : label === "Institutes"
          ? "🏫"
          : "🗂";
    return (
      <div style={{display:"flex",justifyContent:"center",padding:touchRail?"10px 4px 14px":"10px 3px 14px",flex:"0 0 auto"}}>
        <div style={{
          width:"100%",
          maxWidth:78,
          minHeight:touchRail ? 248 : 232,
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          gap:touchRail?12:11,
          padding:touchRail?"12px 8px 14px":"12px 7px 14px",
          borderRadius:28,
          background:`linear-gradient(180deg, ${tone.bg} 0%, #FFFFFF 88%)`,
          border:`1px solid ${tone.edge}`,
          boxShadow:"0 12px 30px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
          position:"relative",
          overflow:"visible",
        }}>
          <CollapseButton collapsed direction={direction} tone={tone} onClick={onExpand} title={`Expand ${label}`} />
          <div style={{width:touchRail?38:36,height:touchRail?38:36,borderRadius:14,background:"rgba(255,255,255,0.88)",border:`1px solid ${tone.edge}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.55)"}}>
            {folderIcon}
          </div>
          <span style={{fontSize:10,letterSpacing:1.05,color:tone.accent,fontFamily:G.mono,fontWeight:800,textTransform:"uppercase",background:"rgba(255,255,255,0.76)",border:`1px solid ${tone.edge}`,borderRadius:999,padding:"4px 8px",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.5)"}}>
            {step}
          </span>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:"4px 0",minHeight:96}}>
            <span style={{
              writingMode:"vertical-rl",
              textOrientation:"upright",
              fontSize:touchRail?10.5:10,
              letterSpacing:1.5,
              color:tone.text,
              fontFamily:G.display,
              fontWeight:800,
              textTransform:"uppercase",
              lineHeight:1.05,
              whiteSpace:"nowrap",
              textShadow:"0 1px 0 rgba(255,255,255,0.68)",
            }}>
              {label}
            </span>
          </div>
          {badge!==undefined && (
            <span style={{background:tone.tab,color:tone.accent,border:`1px solid ${tone.edge}`,borderRadius:999,padding:"5px 10px",fontSize:10,fontFamily:G.mono,fontWeight:800,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.45)"}}>
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
      padding:coarsePointer ? "6px 4px 10px 3px" : "5px 3px 10px 2px",
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
                <div style={{fontSize:14,color:G.textM}}>Deleted classes and institutes will appear here.</div>
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
                            setAdminBin(b=>b.filter((_,j)=>j!==i));
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
                    return(
                      <div key={i} style={{background:G.bg,borderRadius:12,padding:"13px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{fontSize:22,flexShrink:0}}>🏫</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{item.name}</div>
                          <div style={{fontSize:13,color:G.textM,marginTop:2}}>Institute removed from directory</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.mono}}>⏳ {dl}d left</span>
                            <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>Deleted {new Date(item.deletedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
                          </div>
                        </div>
                        <button
                          onClick={()=>{
                            setDeletedInstitutes(s=>{const n=new Set(s);n.delete(item.name.trim());return n;});
                            setAdminBin(b=>b.filter((_,j)=>j!==binIdx));
                          }}
                          style={{background:G.blueL,border:"1px solid #BFDBFE",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>
                          ↩ Restore
                        </button>
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

  // ── MANAGE ACCESS VIEW ────────────────────────────────────────────────────
  if(view==="manage") return(
    <div style={{minHeight:"100svh",background:G.bg,fontFamily:G.sans,overflowX:"hidden"}}>
      {binView&&<AdminBinModal/>}
      {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
      {/* nav */}
      <div style={{background:G.navy,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
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
      </div>
      <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 72px"}}>

        {/* Grade group modal (add/edit) */}
        {grpModal&&(
          <GradeGroupModal
            inst={grpModal.inst}
            instType={instSectionsAll[grpModal.inst]?.type||""}
            group={grpModal.mode==="edit"?grpModal.group:null}
            onSave={async(savedGroup, changeMeta)=>{
              const instData = instSectionsAll[grpModal.inst] || {};
              const existing=instData.gradeGroups||[];
              const updated=grpModal.mode==="edit"?existing.map(g=>g.id===savedGroup.id?savedGroup:g):[...existing,savedGroup];
              const nextEvents = mergeInstituteSectionChangeEvents(instData.sectionChangeEvents, changeMeta?.sectionChangeEvents);
              await saveInstituteGradeGroups(grpModal.inst,updated,{
                sectionChangeEvents: nextEvents,
              });
              setInstSectionsAll(a=>({
                ...a,
                [grpModal.inst]:{
                  ...(a[grpModal.inst] || {}),
                  gradeGroups:updated,
                  sectionChangeEvents: nextEvents,
                }
              }));
            }}
            onClose={()=>setGrpModal(null)}
          />
        )}

        {/* Institute detail drill-down (replaces tab content when active) */}
        {instDetailView?(()=>{
          const instData=instSectionsAll[instDetailView]||{};
          const groups=instData.gradeGroups||[];
          const sortedGroups = [...groups].sort((a,b)=>exportTextSorter.compare(a?.label || "", b?.label || ""));
          const addButtonLabel = "+ Add Timetable Group";
          const fmtSlotPill=s=>{const[h,m]=s.start.split(":").map(Number);const e=s.end?.split(":").map(Number)||[0,0];const f=(hh,mm)=>`${hh%12||12}:${String(mm).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;return`${f(h,m)}–${f(e[0],e[1])}`;};
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                <button onClick={()=>setInstDetailView(null)} style={{...pill(G.bg,G.textS,G.borderM),fontSize:14}}>← Back</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{instDetailView}</div>
                  <div style={{fontSize:13,color:G.textM,marginTop:4}}>Create named timetable groups. Every section inside one group will share the same slots.</div>
                </div>
              </div>
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
                            {groupSections.map(section=>(
                              <span key={section} style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"3px 11px",fontSize:12,fontFamily:G.mono,fontWeight:600}}>{section}</span>
                            ))}
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
                          <button onClick={async()=>{if(!window.confirm(`Delete "${group.label}"?`))return;await deleteInstituteGradeGroup(instDetailView,group.id);setInstSectionsAll(a=>({...a,[instDetailView]:{...(a[instDetailView]||{}),gradeGroups:(a[instDetailView]?.gradeGroups||[]).filter(g=>g.id!==group.id)}}));}} style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13}}>Delete</button>
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

        <h2 style={{fontSize:24,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:16}}>Control Centre</h2>

        {/* Tab switcher */}
        <div style={{display:"flex",background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:4,marginBottom:22,gap:4}}>
          {[["teachers","👤 Teachers"],["admins","👑 Admins"],["institutes","🏫 Institutes"]].map(([key,label])=>(
            <button key={key} onClick={()=>setManageTab(key)}
              style={{flex:1,padding:"10px 0",borderRadius:9,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:G.sans,transition:"all 0.15s",
                background:manageTab===key?G.navy:"none",color:manageTab===key?"#fff":G.textM}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── INSTITUTES TAB ── */}
        {manageTab==="institutes"&&<>

        {/* Class Manager callout */}
        <div style={{background:`linear-gradient(135deg,${G.navy},${G.navyS})`,borderRadius:14,padding:"20px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📚</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:3}}>Class Manager</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>Tap any institute below to create named timetable groups. Each group contains the sections that share one slot pattern.</div>
          </div>
        </div>

        {/* Create Institute */}
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

        {/* Institute list */}
        <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:13,padding:"16px 18px",marginBottom:24}}>
          <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>All Institutes</div>
          <div style={{fontSize:14,color:G.textM,marginBottom:14}}>Delete removes from the list only. Teacher data is not affected.</div>
          {institutes.length===0
            ?<div style={{fontSize:15,color:G.textM,padding:"20px 0",textAlign:"center"}}>No institutes yet. Create one above.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {institutes.map((inst,instIdx)=>{
                const instTeacherList=teachers.filter(t=>{const d=fullData[t.uid];if(d)return(d.classes||[]).some(c=>(c.institute||"").trim()===inst.trim());return(t.institutes||[]).some(i=>i.trim()===inst.trim());});
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
                            <button onClick={()=>setManageTab("teachers")}
                              style={{background:"none",border:"none",fontSize:12,color:G.textM,cursor:"pointer",fontFamily:G.sans,textDecoration:"underline",padding:0}}>
                              View in Teachers →
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center",position:"relative"}}>
                        <button onClick={()=>setInstDetailView(inst)}
                          style={{background:G.blueL,border:`1px solid ${G.borderM}`,borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:700,whiteSpace:"nowrap"}}>
                          📚 Manage Groups →
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
                <div style={{fontSize:14,color:G.textM,marginBottom:14}}>These accounts have full access to the admin panel.</div>
                {adminList.length===0
                  ?<div style={{fontSize:15,color:G.textM,padding:"20px 0",textAlign:"center"}}>No admins yet. Generate an invite link above.</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {adminList.map(t=>{
                      const d=fullData[t.uid]||{};
                      const name=d.profile?.name||t.name||"Unknown";
                      const isMe=t.uid===user.uid;
                      return(
                        <div key={t.uid} style={{background:G.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:42,height:42,borderRadius:11,background:G.amberL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:G.amber,fontFamily:G.mono,flexShrink:0}}>
                            {(name[0]||"?").toUpperCase()}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,display:"flex",alignItems:"center",gap:8}}>
                              {name}
                              {isMe&&<span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>(you)</span>}
                            </div>
                            <div style={{fontSize:13,color:G.textM,marginTop:2}}>{t.email||""}</div>
                          </div>
                          {!isMe&&(
                            <button onClick={()=>handleDemote(t.uid)}
                              style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13,flexShrink:0}}>
                              Remove Admin
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                }
              </div>
            </>
          );
        })()}

        {/* ── TEACHERS TAB ── */}
        {manageTab==="teachers"&&<>

        {/* Teachers grouped by institute */}
        {(()=>{
          // Build groups: institute → teachers
          const allInsts = [...new Set([
            ...institutes,
            ...teachers.flatMap(t=>(t.institutes||[]))
          ])].sort();
          const noInst = teachers.filter(t=>!(t.institutes||[]).length);

          const TeacherCard = ({t, highlight}) => {
            const d = fullData[t.uid]||{};
            const name = d.profile?.name||t.name||"Unknown";
            const isAdmin = roles[t.uid]==="admin";
            const isMe = t.uid===user.uid;
            const isSel = selTeacher===t.uid;
            return(
              <div style={{background:G.surface,borderRadius:12,border:`2px solid ${isSel?G.blue:G.border}`,overflow:"hidden",boxShadow:isSel?`0 0 0 3px ${G.blueL}`:G.shadowSm,transition:"all 0.15s",marginBottom:0}}>
                {/* Card header — clickable */}
                <div onClick={()=>{ensureFullData(t.uid);setSelTeacher(isSel?null:t.uid);}}
                  style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:42,height:42,borderRadius:11,background:isAdmin?G.amberL:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:isAdmin?G.amber:G.blue,fontFamily:G.mono,flexShrink:0}}>
                    {(name[0]||"?").toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {name}
                      {isMe&&<span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>(you)</span>}
                    </div>
                    <div style={{fontSize:13,color:G.textM,marginTop:3}}>
                      {(t.institutes||[]).join(" · ")||"No institute yet"}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                    <span style={{background:isAdmin?G.amberL:G.blueL,color:isAdmin?G.amber:G.blue,fontSize:12,fontWeight:700,borderRadius:20,padding:"3px 10px",fontFamily:G.sans}}>
                      {isAdmin?"👑 Admin":"👤 Teacher"}
                    </span>
                    <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>{fullData[t.uid]?(d.classes||[]).length:(t.classCount||0)} classes · tap to manage</span>
                  </div>
                </div>

                {/* Expanded actions panel */}
                {isSel&&(
                  <div style={{borderTop:`1px solid ${G.border}`,background:G.bg,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>

                    {/* Classes list */}
                    {(d.classes||[]).length>0&&(
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,fontFamily:G.sans}}>Classes</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {(d.classes||[]).map(cls=>(
                            <div key={cls.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:G.surface,borderRadius:8,padding:"9px 12px",border:`1px solid ${G.border}`,gap:8}}>
                              <div>
                                <div style={{fontSize:14,fontWeight:600,color:G.text}}>{normaliseName(cls.section)}</div>
                                <div style={{fontSize:12,color:G.textM}}>{cls.institute} · {cls.subject}</div>
                              </div>
                              <button onClick={()=>handleRemoveFromClass(t.uid,cls.id,normaliseName(cls.section))}
                                style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:7,padding:"5px 11px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500,flexShrink:0}}>
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,paddingTop:4}}>
                      {/* Rename */}
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

                      {/* Role actions */}
                      {!isMe&&(isAdmin
                        ?<button onClick={()=>handleDemote(t.uid)} style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13}}>Remove Admin</button>
                        :<button onClick={()=>handlePromote(t.uid)} style={{...pill(G.blueL,G.blue,G.borderM),fontSize:13}}>Make Admin</button>
                      )}

                      {/* View in main panel */}
                      <button onClick={()=>{setView("main");setSelP2(t.uid);setTab("teacher");setMobileStep(2);}}
                        style={{...pill(G.bg,G.textS,G.borderM),fontSize:13}}>📋 View Entries</button>

                      <button onClick={()=>handleRepairTeacherIndex(t.uid)}
                        disabled={repairingTeacherUid===t.uid}
                        style={{...pill("#EEF2FF",G.blue,"#BFDBFE"),fontSize:13,opacity:repairingTeacherUid===t.uid?0.7:1,cursor:repairingTeacherUid===t.uid?"not-allowed":"pointer"}}>
                        {repairingTeacherUid===t.uid ? "🛠 Repairing…" : "🛠 Repair Index"}
                      </button>

                      {/* Remove teacher from system */}
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
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              {allInsts.map(inst=>{
                const instT=teachers.filter(t=>(t.institutes||[]).some(i=>i.trim()===inst.trim()));
                if(!instT.length) return null;
                return(
                  <div key={inst}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{flex:1,height:1,background:G.border}}/>
                      <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.sans,textTransform:"uppercase",letterSpacing:0.5,background:G.surface,padding:"4px 12px",borderRadius:20,border:`1px solid ${G.border}`}}>
                        🏫 {inst}
                      </div>
                      <div style={{flex:1,height:1,background:G.border}}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {instT.map(t=><TeacherCard key={t.uid} t={t}/>)}
                    </div>
                  </div>
                );
              })}
              {noInst.length>0&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:1,height:1,background:G.border}}/>
                    <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.sans,textTransform:"uppercase",letterSpacing:0.5,background:G.surface,padding:"4px 12px",borderRadius:20,border:`1px solid ${G.border}`}}>
                      No Institute Assigned
                    </div>
                    <div style={{flex:1,height:1,background:G.border}}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {noInst.map(t=><TeacherCard key={t.uid} t={t}/>)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        </>}
      </>)}
      </div>
    </div>
  );

  // ── MAIN PANEL VIEW ───────────────────────────────────────────────────────
  // ── MOBILE: renders each step as a standalone full-page view ────────────────
  // This avoids all flex-height issues that cause list clipping
  if(isMobile) {
    const MobileNav = ()=>(
      <div style={{background:G.navy,minHeight:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",borderBottom:"1px solid rgba(255,255,255,0.08)",gap:8,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,background:G.blueV,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M4 3H7V13H14V16H4V3Z" fill="white"/></svg>
          </div>
          <div>
            <div style={{fontFamily:G.display,fontSize:17,fontWeight:800,color:"#fff",lineHeight:1.1,letterSpacing:-0.4}}>Ledgr</div>
            <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.4)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</div>
          </div>
        </div>
        <div style={{position:"relative"}}>
          <div onClick={()=>setProfileOpen(o=>!o)}
            style={{height:36,display:"flex",alignItems:"center",gap:7,background:profileOpen?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.1)",borderRadius:9,padding:"0 10px",cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"background 0.15s"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:G.sans}}>
              {(user?.email||"A").charAt(0).toUpperCase()}
            </div>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontFamily:G.sans,fontWeight:600}}>Admin</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>{profileOpen?"▲":"▼"}</span>
          </div>
          {profileOpen&&(<>
            <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
            <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200,background:"#0F1E3D",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,boxShadow:"0 12px 40px rgba(0,0,0,0.5)",minWidth:240,overflow:"hidden"}}>
              <div style={{padding:"14px 14px 11px",borderBottom:"1px solid rgba(255,255,255,0.09)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0,boxShadow:"0 0 0 2px rgba(59,130,246,0.35)"}}>
                    {(user?.email||"A").charAt(0).toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.95)",fontFamily:G.sans}}>Administrator</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2,fontFamily:G.mono,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}>{user?.email||"—"}</div>
                  </div>
                </div>
              </div>
              <div style={{padding:"7px"}}>
                <button onClick={()=>{setProfileOpen(false);setView("manage");}}
                  style={{width:"100%",marginBottom:4,padding:"9px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:9,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left"}}>
                  <span style={{fontSize:16}}>⚙️</span>
                  <div><div style={{fontSize:12,fontWeight:600}}>Control Centre</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Manage teachers &amp; access</div></div>
                </button>
                <button onClick={()=>{setProfileOpen(false);setManageTab("institutes");setInstDetailView(null);setView("manage");}}
                  style={{width:"100%",marginBottom:4,padding:"9px 10px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:9,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left"}}>
                  <span style={{fontSize:16}}>📚</span>
                  <div><div style={{fontSize:12,fontWeight:600}}>Section Management</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Institutes &amp; timetables</div></div>
                </button>
                <button onClick={()=>{setProfileOpen(false);setBinView(true);}}
                  style={{width:"100%",marginBottom:4,padding:"9px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:9,color:"rgba(255,255,255,0.75)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left"}}>
                  <span style={{fontSize:16}}>🗑️</span>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>Recycle Bin</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Deleted items</div></div>
                  {adminBin.length>0&&<span style={{background:"rgba(201,48,48,0.75)",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{adminBin.length}</span>}
                </button>
                <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"5px 0"}}/>
                <button onClick={()=>{setProfileOpen(false);logout();}}
                  style={{width:"100%",padding:"9px 10px",background:"rgba(220,38,38,0.12)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:9,color:"#FCA5A5",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left"}}>
                  <span style={{fontSize:16}}>🚪</span>
                  Sign Out
                </button>
              </div>
            </div>
          </>)}
        </div>
      </div>
    );

    const MobileFooter = ()=>(
      <div style={{textAlign:"center",padding:"20px 0 10px",borderTop:`1px solid ${G.border}`,marginTop:8}}>
        <span style={{fontSize:11,color:G.textL,fontFamily:G.sans,letterSpacing:0.2}}>Every class. Every teacher. One place.</span>
      </div>
    );
    const MobileBreadcrumb = ()=>(<>{mobileStep>0&&(
        <div style={{background:G.navyS,padding:"8px 14px",display:"flex",alignItems:"center",gap:5,fontSize:12,fontFamily:G.sans,overflow:"hidden"}}>
          <span onClick={()=>{setMobileStep(0);setSelInst(null);resetNav();}} style={{color:"rgba(255,255,255,0.45)",cursor:"pointer",flexShrink:0}}>Inst.</span>
          {mobileStep>=1&&selInst&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);setFullView(null);}} style={{color:mobileStep===1?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",fontWeight:mobileStep===1?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{selInst}</span></>}
          {mobileStep>=2&&selP2&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span onClick={()=>{if(isAggregateSelection){setMobileStep(1);setSelP3(null);} else {setMobileStep(2);setSelP3(null);setFullView(null);}}} style={{color:mobileStep===2?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",fontWeight:mobileStep===2?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{p2Label(selP2)}</span></>}
          {mobileStep>=3&&(selP3||isAggregateSelection||isScopedFullView)&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span style={{color:"#fff",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{isScopedFullView?"View Full":selP3?selP3.className:"All entries"}</span></>}
          <button onClick={()=>setMobileStep(s=>isAggregateSelection&&s===3?1:isScopedFullView&&s===3?2:Math.max(0,s-1))} style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:7,padding:"5px 12px",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:12,fontFamily:G.sans,fontWeight:600,flexShrink:0,WebkitTapHighlightColor:"transparent"}}>← Back</button>
        </div>
      )}</>
    );

    const MobileStats = ()=>(
      <div style={{background:G.navyS,padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
          {[{n:institutes.length,l:"institutes"},{n:teachers.length,l:"teachers"},{n:totalClasses,l:"classes"},{n:totalEntries,l:"entries"}].map(({n,l})=>(
            <div key={l} style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"9px 12px"}}>
              <div style={{fontSize:22,fontWeight:700,color:G.blueV,fontFamily:G.display,lineHeight:1}}>{n}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:G.sans,marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    );

    // ── STEP 0: Institute list ────────────────────────────────────────────────
    if(mobileStep===0) return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
        {binView&&<AdminBinModal/>}
        {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        <MobileNav/>
        <MobileStats/>
        <div style={{padding:"12px 14px 40px"}}>
          <div style={{fontSize:11,fontWeight:700,color:G.textL,letterSpacing:1.5,fontFamily:G.sans,textTransform:"uppercase",marginBottom:12}}>Institutes</div>
          {renderSearchInput(instSearch,setInstSearch,"Search institutes",true)}
          <div style={{fontSize:12,color:G.textL,margin:"10px 2px 12px"}}>{visibleInstitutes.length} of {institutes.length} institutes</div>
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
                onTouchStart={e=>{
                  // Long press to drag on mobile
                  dragInstRef.current=null;
                  const timer=setTimeout(()=>{
                    dragInstRef.current=inst;
                    setDragInst(inst);
                    e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.18)";
                    e.currentTarget.style.transform="scale(1.02)";
                  },400);
                  e.currentTarget._longPressTimer=timer;
                }}
                onTouchMove={e=>{
                  if(!dragInstRef.current)return;
                  e.preventDefault();
                  const touch=e.touches[0];
                  const el=document.elementFromPoint(touch.clientX,touch.clientY);
                  const card=el?.closest("[data-inst]");
                  if(card&&card.dataset.inst!==dragInstRef.current) setDragOverInst(card.dataset.inst);
                }}
                onTouchEnd={e=>{
                  clearTimeout(e.currentTarget._longPressTimer);
                  if(dragInstRef.current&&dragOverInst&&dragOverInst!==dragInstRef.current){
                    const from=institutes.indexOf(dragInstRef.current);
                    const to=institutes.indexOf(dragOverInst);
                    if(from>=0&&to>=0){
                      const reordered=[...institutes];
                      const [moved]=reordered.splice(from,1);
                      reordered.splice(to,0,moved);
                      saveInstOrder(reordered);
                    }
                  } else if(!dragInstRef.current){
                    onSelectInstitute(inst);
                  }
                  e.currentTarget.style.boxShadow="";
                  e.currentTarget.style.transform="";
                  setDragInst(null);setDragOverInst(null);dragInstRef.current=null;
                }}
                data-inst={inst}
                style={{
                  background:isDragOver?G.blueL:G.surface,
                  borderRadius:14,
                  border:isDragging?`2px dashed ${G.blue}`:`1px solid ${isDragOver?G.blue:G.border}`,
                  padding:"16px",marginBottom:10,
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  boxShadow:isDragging?"0 8px 24px rgba(0,0,0,0.15)":G.shadowSm,
                  cursor:"grab",transition:"all 0.15s",
                  opacity:isDragging?0.5:1,
                  transform:isDragging?"scale(1.01)":"scale(1)",
                  WebkitUserSelect:"none",userSelect:"none",
                  touchAction:dragInst?"none":"auto",
                }}>
                {/* Drag handle — pure CSS dots, renders on all platforms */}
                <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:14,height:20,flexShrink:0,marginRight:12,cursor:"grab",padding:"2px 0",userSelect:"none",WebkitUserSelect:"none"}}>
                  {[0,1,2].map(r=>(
                    <div key={r} style={{display:"flex",justifyContent:"space-between",width:14}}>
                      <div style={{width:4,height:4,borderRadius:"50%",background:"#B8CEC2"}}/>
                      <div style={{width:4,height:4,borderRadius:"50%",background:"#B8CEC2"}}/>
                    </div>
                  ))}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:700,color:isDragOver?G.blue:G.text,fontFamily:G.display}}>{inst}</div>
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"3px 10px",fontSize:13,fontFamily:G.sans,fontWeight:600}}>{clsCount} class{clsCount!==1?"es":""}</span>
                    <span style={{fontSize:13,color:G.textM,fontFamily:G.sans,alignSelf:"center"}}>{tCount} teacher{tCount!==1?"s":""}</span>
                  </div>
                </div>
                <span style={{fontSize:20,color:G.textL}}>›</span>
              </div>
            );
          })}
          {visibleInstitutes.length===0&&(
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,padding:"18px 16px",textAlign:"center",color:G.textM}}>
              No institutes match your search.
            </div>
          )}
        </div>
        <MobileFooter/>
      </div>
    );
    if(mobileStep===1) return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
        {binView&&<AdminBinModal/>}
        {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
        <MobileNav/><MobileBreadcrumb/>
        <div style={{padding:"12px 14px 40px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:14}}>
            <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,margin:0,minWidth:0}}>{selInst}</h2>
            <button onClick={()=>setExportOpen(true)}
              style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"8px 13px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:G.sans,WebkitTapHighlightColor:"transparent"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
          <div style={{display:"flex",background:G.surface,border:`1px solid ${G.border}`,borderRadius:10,padding:3,marginBottom:16,gap:3}}>
            {["class","teacher"].map(t=>(
              <button key={t} onClick={()=>resetNav(t)}
                style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:G.sans,background:tab===t?G.navy:"none",color:tab===t?"#fff":G.textM}}>
                {t==="class"?"By Class":"By Teacher"}
              </button>
            ))}
          </div>
          {renderSearchInput(p2Search,setP2Search,tab==="class"?"Search classes, subjects, teachers":"Search teachers",true)}
          <div style={{fontSize:12,color:G.textL,margin:"10px 2px 12px"}}>
            {tab==="class"
              ? `${visibleInstClasses.length} of ${instClasses.length} classes`
              : `${visibleInstTeachers.length} of ${instTeachers.length} teachers`}
          </div>
          {renderWarmupBanner(true)}
          {tab==="class"&&visibleInstClasses.map(cls=>(
            <div key={cls.raw} onClick={()=>openClassSelection(cls.raw)}
              style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:G.text}}>{cls.display}</div>
                {cls.subjects.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>
                    {cls.subjects.map(s=><span key={s} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:20,padding:"2px 9px",fontSize:12,fontFamily:G.sans,color:G.textS}}>{s}</span>)}
                  </div>
                )}
                <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"2px 10px",fontSize:12,fontFamily:G.mono,marginTop:6,display:"inline-block"}}>{cls.teachers.length} teacher{cls.teachers.length!==1?"s":""}</span>
              </div>
              <span style={{fontSize:20,color:G.textL}}>›</span>
            </div>
          ))}
          {tab==="teacher"&&visibleInstTeachers.map(t=>{
            const d=fullData[t.uid]||{};
            const name=d.profile?.name||t.name||"?";
            const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
            const activityLabel = instTeacherMeta[t.uid]?.label || lastEntryCaption(null);
            return(
              <div key={t.uid} onClick={()=>openTeacherSelection(t.uid)}
                style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:G.text}}>{name}</div>
                  <div style={{fontSize:12,color:G.textL,marginTop:4,fontFamily:G.mono}}>{activityLabel}</div>
                  {otherInsts.length>0&&<AlsoAtInstitutes institutes={otherInsts} />}
                </div>
                <span style={{fontSize:20,color:G.textL}}>›</span>
              </div>
            );
          })}
          {instTeachers.length===0&&tab==="teacher"&&loadingUids.size>0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:G.textM}}>Loading teachers…</div>
          )}
          {((tab==="class"&&visibleInstClasses.length===0&&instClasses.length>0)||(tab==="teacher"&&visibleInstTeachers.length===0&&instTeachers.length>0))&&(
            <div style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,padding:"18px 16px",textAlign:"center",color:G.textM}}>
              No {tab==="class"?"classes":"teachers"} match your search.
            </div>
          )}
        </div>
      </div>
    );

    // ── STEP 2: Classes for teacher / Teachers for class ─────────────────────
    if(mobileStep===2) return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
        {binView&&<AdminBinModal/>}
        {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
        <MobileNav/><MobileBreadcrumb/>
        <div style={{padding:"12px 14px 40px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:16}}>
            <div>
              <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{p2Label(selP2)}</h2>
              <div style={{fontSize:14,color:G.textM}}>{selInst}</div>
            </div>
            {tab==="class"&&selP2&&(()=>{const cls=instClasses.find(c=>c.raw===selP2);return cls?(
              <button onClick={()=>setExportOpen(true)}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"8px 13px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:G.sans,WebkitTapHighlightColor:"transparent",marginTop:2}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            ):null;})()}
          </div>
          {selP2&&!isAggregateSelection&&(
            <div style={{background:"linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 100%)",borderRadius:12,border:`1px solid ${G.border}`,padding:"16px 18px",marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>
                {tab==="teacher"?"View all classes together":"View all teachers together"}
              </div>
              <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginTop:5}}>
                Open the full grouped view first, or continue below for one specific {tab==="teacher"?"class":"teacher"}.
              </div>
              <button onClick={openScopedFullView}
                style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:8,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"10px 14px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                View Full →
              </button>
            </div>
          )}
          {!isAggregateSelection&&p3Items.map(cls=>(
            <div key={cls.classId||cls.uid}
              style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,marginBottom:8,overflow:"hidden"}}>
              <div onClick={()=>{
                setFullView(null);
                if(tab==="teacher") setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute||selInst});
                else {
                  const clsObj=instClasses.find(c=>c.raw===selP2);
                  const subjectText = cls.subject || clsObj?.subjects?.join(", ") || "";
                  setSelP3({teacherUid:cls.uid,classId:cls.classId,teacherName:cls.name,className:normaliseName(selP2),subject:subjectText});
                  ensureFullData(cls.uid);
                }
                setMobileStep(3);
              }}
                style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:G.text}}>{tab==="teacher"?cls.display:cls.name}</div>
                  <div style={{fontSize:14,color:G.textM,marginTop:2}}>{tab==="teacher"?cls.subject:""}</div>
                  <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"2px 10px",fontSize:12,fontFamily:G.mono,marginTop:5,display:"inline-block"}}>{cls.entryCount} {cls.entryCount===1?"entry":"entries"}</span>
                </div>
                <span style={{fontSize:20,color:G.textL}}>›</span>
              </div>
              {tab==="teacher"&&(
                <div style={{borderTop:`1px solid ${G.border}`,background:G.bg,padding:"8px 16px",display:"flex",justifyContent:"flex-end"}}>
                  <button onClick={()=>handleDeleteClass(selP2,cls.classId,cls.display,fullData[selP2]?.profile?.name||"Teacher")}
                    style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500,display:"flex",alignItems:"center",gap:6,WebkitTapHighlightColor:"transparent"}}>
                    🗑 Delete Class
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );

    // ── STEP 3: Entries ───────────────────────────────────────────────────────
    if(mobileStep===3&&(selP3||isAggregateSelection||isScopedFullView)) {
      const days=period==="today"?1:period==="week"?7:period==="month"?30:null;
      const classNotes=selP3?((fullData[selP3.teacherUid]?.notes||{})[selP3.classId]||{}):{};
      const entries=selP3?groupByDate(getEntriesInRange(classNotes,days)):[];
      return(
        <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
          {binView&&<AdminBinModal/>}
          {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
          {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
          <MobileNav/><MobileBreadcrumb/>
          <div style={{padding:"12px 14px 40px"}}>
            <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:2}}>
              {isScopedFullView ? fullViewTitle : isAggregateSelection ? aggregateTitle : `${selP3.teacherName} — ${selP3.className}`}
            </h2>
            <div style={{fontSize:14,color:G.textM,marginBottom:16}}>
              {isScopedFullView ? fullViewSubtitle : isAggregateSelection ? `${selInst} · grouped by class, chronological inside each class` : [selectedClassMeta?.institute || selP3.institute || selInst, selectedSubjectLabel].filter(Boolean).join(" · ")}
            </div>
            {/* Period pills — horizontal scroll, never wraps */}
            <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",paddingBottom:2}}>
              {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
                <button key={k} onClick={()=>setPeriod(k)} style={{padding:"7px 14px",borderRadius:16,fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:period===k?700:500,background:period===k?G.navy:"transparent",color:period===k?"#fff":G.textS,border:`1.5px solid ${period===k?G.navy:G.borderM}`,minHeight:36,WebkitTapHighlightColor:"transparent",flexShrink:0}}>{l}</button>
              ))}
            </div>
            {/* Export — its own row, always visible */}
            <button onClick={()=>setExportOpen(true)}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",background:G.navy,color:"#fff",border:"none",borderRadius:10,padding:"11px 0",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,minHeight:44,WebkitTapHighlightColor:"transparent",marginBottom:20}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            {isScopedFullView ? renderFullViewEntries(true) : isAggregateSelection ? renderAggregateEntries(true) : renderSelectedTimelineEntries(true)}
          </div>
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

  // ── DESKTOP: original 4-panel layout ─────────────────────────────────────
  return(
    <div style={{minHeight:"100svh",height:"100vh",display:"flex",flexDirection:"column",fontFamily:G.sans,background:G.bg,overflow:"hidden"}}>
      {binView&&<AdminBinModal/>}
      {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
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
          <div className="admin-header-metrics" style={{display:"flex",alignItems:"center",gap:8,overflowX:"auto",padding:"4px 0",scrollbarWidth:"none",msOverflowStyle:"none"}}>
            {[
              {n:institutes.length, l:"institutes"},
              {n:teachers.length, l:"teachers"},
              {n:totalClasses, l:"classes"},
              {n:totalEntries, l:"entries"},
            ].map(({n,l})=>(
              <div key={l} style={{display:"flex",alignItems:"baseline",gap:6,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:999,padding:"7px 12px",flexShrink:0}}>
                <span style={{fontSize:18,fontWeight:700,color:G.blueV,fontFamily:G.display,lineHeight:1}}>{n}</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.58)",fontFamily:G.mono}}>{l}</span>
              </div>
            ))}
            {loadingUids.size>0&&(
              <div style={{fontSize:12,color:"rgba(255,255,255,0.72)",fontFamily:G.mono,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:999,padding:"7px 12px",flexShrink:0}}>
                syncing {loadingUids.size} teacher{loadingUids.size>1?"s":""}…
              </div>
            )}
          </div>
        </div>
        <div className="admin-nav-r" style={{display:"flex",alignItems:"center",gap:8}}>
          {/* ── Admin Profile Pill ─────────────────────────────────── */}
          <div style={{position:"relative"}}>
            <div onClick={()=>setProfileOpen(o=>!o)}
              style={{height:42,display:"flex",alignItems:"center",gap:8,background:profileOpen?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.1)",borderRadius:10,padding:"0 12px",cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"background 0.15s",flexShrink:0}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:G.sans}}>
                {(user?.email||"A").charAt(0).toUpperCase()}
              </div>
              <span style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",whiteSpace:"nowrap",fontFamily:G.sans}}>Admin</span>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginLeft:2}}>{profileOpen?"▲":"▼"}</span>
            </div>
            {profileOpen&&(<>
              <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
              <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200,background:"#0F1E3D",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,0.45)",minWidth:252,overflow:"hidden"}}>
                {/* Profile header */}
                <div style={{padding:"16px 16px 13px",borderBottom:"1px solid rgba(255,255,255,0.09)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:G.sans,boxShadow:"0 0 0 3px rgba(59,130,246,0.3)"}}>
                      {(user?.email||"A").charAt(0).toUpperCase()}
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.95)",fontFamily:G.sans,lineHeight:1.2}}>Administrator</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3,fontFamily:G.mono,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:165}}>{user?.email||"—"}</div>
                    </div>
                  </div>
                  <div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:6,padding:"3px 8px"}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:"#3B82F6",display:"inline-block"}}/>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontFamily:G.mono}}>Session {currentSession()}</span>
                  </div>
                </div>
                {/* Menu items */}
                <div style={{padding:"8px"}}>
                  <button onClick={()=>{setProfileOpen(false);setView("manage");}}
                    style={{width:"100%",marginBottom:5,padding:"10px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.11)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 1.41 14.14M4.93 4.93A10 10 0 0 0 3.52 19.07"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Control Centre</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Manage teachers &amp; access</div>
                    </div>
                    <svg style={{marginLeft:"auto",flexShrink:0}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <button onClick={()=>{setProfileOpen(false);setManageTab("institutes");setInstDetailView(null);setView("manage");}}
                    style={{width:"100%",marginBottom:5,padding:"10px 12px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,0.18)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(59,130,246,0.1)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(59,130,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:15}}>📚</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)"}}>Section Management</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:400,marginTop:1}}>Institutes, grades &amp; timetables</div>
                    </div>
                    <svg style={{marginLeft:"auto",flexShrink:0}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <button onClick={()=>{setProfileOpen(false);setBinView(true);}}
                    style={{width:"100%",marginBottom:5,padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.75)",fontSize:13,fontFamily:G.sans,fontWeight:600,textAlign:"left",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
                      <div onClick={()=>onSelectInstitute(inst)}
                        style={{...siBase,flex:1,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
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
                    ? `${visibleInstClasses.length} of ${instClasses.length} classes`
                    : `${visibleInstTeachers.length} of ${instTeachers.length} teachers`}
                </div>}
                {selInst&&renderWarmupBanner(false)}
              </div>
              <div style={{fontSize:11,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
                {tab==="class"?"Classes ↓ (12th first)":"Teachers"}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
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
                {selInst&&tab==="class"&&visibleInstClasses.map(cls=>{
                  const isSel=selP2===cls.raw;
                  return(
                    <div key={cls.raw} onClick={()=>openClassSelection(cls.raw)}
                      style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                      <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS}}>{cls.display}</div>
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
                {selInst&&((tab==="class"&&visibleInstClasses.length===0&&instClasses.length>0)||(tab==="teacher"&&visibleInstTeachers.length===0&&instTeachers.length>0))&&(
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
              const tName=fullData[selP2]?.profile?.name||"";
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
                  <button onClick={e=>{e.stopPropagation();handleDeleteClass(selP2,cls.classId,cls.display,tName);}}
                    title="Delete class"
                    style={{marginTop:6,width:"100%",padding:"5px 0",background:G.redL,border:"1px solid #F5CACA",borderRadius:7,fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                    🗑 Delete
                  </button>
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
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"14px 16px 16px",flexShrink:0}}>
            <div style={{
              background:`linear-gradient(135deg, ${p4HeaderTone.bg1} 0%, ${p4HeaderTone.bg2} 74%)`,
              border:`1px solid ${p4HeaderTone.edge}`,
              borderRadius:22,
              padding:"18px 18px 16px",
              boxShadow:reduceEffects?"none":"0 12px 26px rgba(15,23,42,0.06)",
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

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",marginTop:18,position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{background:"#FFFFFF",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:999,padding:"7px 11px",fontSize:12,color:p4HeaderTone.chipText,fontFamily:G.mono,fontWeight:700,flexShrink:0}}>
                    Period
                  </span>
                  <div style={{display:"flex",gap:6,alignItems:"center",background:"rgba(255,255,255,0.78)",border:`1px solid ${p4HeaderTone.edge}`,borderRadius:18,padding:4,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.75)"}}>
                    {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setPeriod(k)}
                        style={{
                          padding:"7px 15px",
                          borderRadius:14,
                          fontSize:14,
                          cursor:"pointer",
                          fontFamily:G.sans,
                          fontWeight:period===k?700:500,
                          transition:"all 0.14s",
                          background:period===k?p4HeaderTone.accent:"transparent",
                          color:period===k?"#fff":G.textS,
                          border:`1px solid ${period===k?p4HeaderTone.accent:"transparent"}`,
                          boxShadow:period===k?`0 8px 18px ${alphaHex(p4HeaderTone.accent,0.18)}`:"none",
                          flexShrink:0,
                          minHeight:38,
                          WebkitTapHighlightColor:"transparent",
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
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
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px 32px"}}>
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
    </div>
  );
}

export default function AdminPanel(props){
  return <ErrorBoundary><AdminPanelInner {...props}/></ErrorBoundary>;
}
