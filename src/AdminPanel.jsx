import React, { useState, useEffect, useMemo, Component } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher, createInviteLink,
  getAllInstituteSections, saveInstituteGradeGroups, deleteInstituteGradeGroup,
  removeTeacherFromSystem, removeInstituteFromIndex,
  deleteEntryFromTeacherData, deleteClassFromTeacherData,
  getGlobalInstitutes, saveGlobalInstitute, deleteGlobalInstitute,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentSession(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
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

function normaliseName(raw){
  if(!raw) return raw;
  const m=raw.match(/(\d+)/);
  if(!m) return raw;
  const num=parseInt(m[1]);
  const rest=raw.replace(/\d+(st|nd|rd|th)?/i,"").trim();
  return rest?`${num}${ordSuffix(num)} ${rest}`:`${num}${ordSuffix(num)}`;
}
function classNum(name){const m=(name||"").match(/(\d+)/);return m?parseInt(m[1]):0;}
function fmt12(t){
  if(!t) return "";
  const[h,m]=t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
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
    Object.values(notes||{}).forEach(byDate=>{
      if(!byDate||typeof byDate!=="object") return;
      Object.values(byDate).forEach(arr=>{
        if(!Array.isArray(arr)) return;
        arr.forEach(n=>{if(n&&n.created>latest)latest=n.created;});
      });
    });
  } catch(e){}
  return latest||null;
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

// ── Panel styles ──────────────────────────────────────────────────────────────
const sidePanel={flexShrink:0,background:G.surface,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",overflow:"hidden"};
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
              Select a teacher or class first to export.
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

// ── Institute Wizard (step-by-step grade group creator) ─────────────────────
function GradeGroupModal({ inst, group, onSave, onClose }) {
  const isEdit = !!group;
  const TOTAL = 4;
  const W = { navy:"#1A2F5A",blue:"#1D4ED8",blueL:"#EEF2FF",blueV:"#3B82F6",
    bg:"#F4F6FA",surface:"#fff",border:"#E2E8F0",borderM:"#CBD5E1",
    text:"#0F172A",textM:"#475569",textL:"#94A3B8",
    green:"#1B8A4C",greenL:"#ECFDF5",
    red:"#DC2626",redL:"#FEF2F2",amber:"#D97706",amberL:"#FFFBEB",
    sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'JetBrains Mono',monospace" };

  const overlayRef = React.useRef(null);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const el = overlayRef.current;
    const vv = window.visualViewport;

    const update = () => {
      if (!el) return;
      if (vv) {
        el.style.top    = vv.offsetTop  + "px";
        el.style.left   = vv.offsetLeft + "px";
        el.style.width  = vv.width      + "px";
        el.style.height = vv.height     + "px";
      } else {
        el.style.top = "0"; el.style.left = "0";
        el.style.width = "100%"; el.style.height = "100%";
      }
    };

    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    update();

    return () => {
      document.body.style.overflow = prevOverflow;
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
    };
  }, []); // runs once — no state, no re-renders

  const [step,       setStep]       = React.useState(1);
  const [gradeNums,  setGradeNums]  = React.useState(group?.gradeNums||[]);
  const [secText,    setSecText]    = React.useState((group?.sections||[]).join("\n"));
  const [durMins,    setDurMins]    = React.useState(group?.durMins||60);
  const [startTimes, setStartTimes] = React.useState(group?.slots?.map(s=>s.start)||[""]);
  const [slotDurs,   setSlotDurs]   = React.useState(group?.slots?.map(s=>s.durMins)||[]);
  const [overrides,  setOverrides]  = React.useState(group?.sectionOverrides||{});
  const [showOv,     setShowOv]     = React.useState(false);
  const [busy,       setBusy]       = React.useState(false);
  const [error,      setError]      = React.useState("");

  const fmtEnd = (t,m)=>{ if(!t) return ""; const[h,mn]=t.split(":").map(Number); const e=new Date(2000,0,1,h,mn+m); return String(e.getHours()).padStart(2,"0")+":"+String(e.getMinutes()).padStart(2,"0"); };
  const fmtDisp = t=>{ if(!t) return "--"; const[h,m]=t.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
  const toMins = t=>{ if(!t) return 0; const[h,m]=t.split(":").map(Number); return h*60+m; };
  const sections = secText.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
  // validSlots: sorted array of {start, dur} — dur falls back to global durMins
  const validSlots = startTimes
    .map((s,i)=>({start:s, dur: slotDurs[i]||durMins}))
    .filter(s=>s.start)
    .sort((a,b)=>toMins(a.start)-toMins(b.start));
  const STEP_LABELS = ["Grades","Sections","Time slots","Review"];

  function quickSelect(type) {
    if(type==="junior") setGradeNums([6,7,8,9,10]);
    else if(type==="senior") setGradeNums([11,12]);
    else setGradeNums([6,7,8,9,10,11,12]);
  }

  function handleSave() {
    if(!gradeNums.length) { setError("Select at least one grade."); setStep(1); return; }
    if(!sections.length)  { setError("Add at least one section."); setStep(2); return; }
    if(!validSlots.length){ setError("Add at least one start time."); setStep(4); return; }
    const slots = validSlots.map(s=>({ start:s.start, end:fmtEnd(s.start,s.dur), durMins:s.dur }));
    const minG=Math.min(...gradeNums), maxG=Math.max(...gradeNums);
    const label = gradeNums.length===1 ? `${gradeNums[0]}th` : `${minG}th–${maxG}th`;
    const saved = { id:group?.id||("grp_"+Date.now()), gradeNums, label, sections, slots, durMins, sectionOverrides:overrides };
    setBusy(true);
    onSave(saved).then(()=>{ setBusy(false); onClose(); }).catch(e=>{ setBusy(false); setError(e.message||"Save failed."); });
  }

  const inp = { width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${W.border}`, fontSize:15, fontFamily:W.sans, outline:"none", background:W.bg, color:W.text, boxSizing:"border-box" };

  // ── Step renderers ──────────────────────────────────────────────────────────
  function Step1() {
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Which grades share this schedule?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>Select one or more. All selected grades will share the same sections and timetable.</div>
      {/* Quick shortcuts */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["⚡ Junior (6–10)","junior"],["⚡ Senior (11–12)","senior"],["All grades","all"]].map(([l,t])=>{
          const isSel=(t==="junior"&&JSON.stringify(gradeNums)==="[6,7,8,9,10]")||(t==="senior"&&JSON.stringify(gradeNums)==="[11,12]")||(t==="all"&&gradeNums.length===7);
          return <button key={t} onClick={()=>quickSelect(t)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${isSel?W.navy:W.border}`,background:isSel?W.navy:"transparent",color:isSel?"#fff":W.textM,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:W.sans,transition:"all 0.15s"}}>{l}</button>;
        })}
      </div>
      {/* Grade chips */}
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
      {gradeNums.length>0&&(
        <div style={{background:W.blueL,border:"1px solid #C7D7F5",borderRadius:10,padding:"10px 14px",fontSize:13,color:W.blue,fontWeight:600}}>
          ✓ {gradeNums.length} grade{gradeNums.length>1?"s":""} selected ({gradeNums.map(g=>g+"th").join(", ")}) — these share the same sections and timetable.
        </div>
      )}
    </>);
  }

  function Step2() {
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>What are the section names?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>One per line. Teachers will see these exact names in their class dropdown — be consistent. Use "11th NDA" not "XI NDA".</div>
      <textarea value={secText} onChange={e=>setSecText(e.target.value)} rows={4}
        placeholder={"11th NDA\n11th IIT Star\n11th IIT Shikhar\n11th MED\n12th NDA\n12th IIT Star"}
        style={{...inp,resize:"vertical",lineHeight:1.9,fontFamily:W.mono,fontSize:14}}/>
      <div style={{fontSize:12,color:W.textL,textAlign:"right",marginTop:5}}>{sections.length} section{sections.length!==1?"s":""}</div>
      {sections.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
          {sections.map(s=><span key={s} style={{background:W.blueL,color:W.blue,borderRadius:20,padding:"4px 11px",fontSize:12,fontWeight:600,fontFamily:W.mono}}>{s}</span>)}
        </div>
      )}
    </>);
  }

  function Step3() {
    const DURS=[[45,"45m",""],[60,"1 hr","hour"],[75,"1h 15m",""],[90,"1h 30m",""],[105,"1h 45m",""],[120,"2 hrs",""]];
    const eg=fmtEnd("09:00",durMins);
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>How long is each class?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>The default duration. End time auto-fills when a teacher picks a start slot. They can still adjust.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {DURS.map(([m,v])=>{
          const sel=durMins===m;
          return (<div key={m} onClick={()=>setDurMins(m)} style={{padding:"14px 8px",borderRadius:12,border:`2px solid ${sel?W.navy:W.border}`,background:sel?W.navy:W.surface,textAlign:"center",cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
            <div style={{fontFamily:W.display,fontWeight:800,fontSize:20,color:sel?"#fff":W.text,lineHeight:1}}>{v}</div>
          </div>);
        })}
      </div>
      <div style={{background:W.blueL,border:"1px solid #C7D7F5",borderRadius:10,padding:"11px 14px",fontSize:13,color:W.blue}}>
        💡 Example: 9:00 AM start → end auto-fills as <strong>{eg?fmtDisp(eg):"--"}</strong>
      </div>
    </>);
  }

  function Step4() {
    const DUR_OPTIONS = [30,45,60,75,90,120];
    // Build sorted preview slots with per-slot dur
    const previewSlots = startTimes
      .map((t,i)=>({t, dur: slotDurs[i]||durMins, i}))
      .filter(s=>s.t)
      .sort((a,b)=>toMins(a.t)-toMins(b.t));
    const showTimeline = previewSlots.length>0;
    const allMins = previewSlots.flatMap(s=>[toMins(s.t), toMins(s.t)+s.dur]);
    const minT = (showTimeline ? Math.min(...allMins) : 0) - 10;
    const maxT = (showTimeline ? Math.max(...allMins) : 60) + 10;
    const range = Math.max(maxT - minT, 1);

    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:4}}>When do classes start?</div>
      <div style={{fontSize:13,color:W.textM,marginBottom:14,lineHeight:1.5}}>Set start time and duration per slot. Breaks are shown automatically.</div>

      {/* Slot rows */}
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {startTimes.map((t,i)=>{
          const slotDur = slotDurs[i]||durMins;
          const isCustomDur = slotDurs[i] && slotDurs[i]!==durMins;
          return (
            <div key={i} style={{borderRadius:12,border:`1.5px solid ${t?W.blueV:W.border}`,background:W.surface,transition:"border-color 0.15s"}}>
              {/* Main row */}
              <div style={{display:"flex",alignItems:"center"}}>
                <input type="time" value={t} onChange={e=>{const n=[...startTimes];n[i]=e.target.value;setStartTimes(n);}}
                  style={{flex:1,border:"none",padding:"12px 14px",fontSize:15,fontFamily:W.mono,fontWeight:600,color:W.text,outline:"none",background:"transparent",cursor:"pointer",minWidth:0}}/>
                <span style={{color:W.textL,fontSize:12,fontFamily:W.mono,padding:"0 2px",flexShrink:0}}>→</span>
                <span style={{fontSize:13,fontFamily:W.mono,fontWeight:600,color:W.green,padding:"0 8px",flexShrink:0,minWidth:80,textAlign:"center"}}>{t?fmtDisp(fmtEnd(t,slotDur)):"--"}</span>
                {startTimes.length>1&&(
                  <button onClick={()=>{
                    setStartTimes(n=>n.filter((_,j)=>j!==i));
                    setSlotDurs(n=>n.filter((_,j)=>j!==i));
                  }} style={{background:"none",borderLeft:`1px solid ${W.border}`,padding:"0 12px",height:46,cursor:"pointer",color:W.textL,fontSize:16,flexShrink:0,display:"flex",alignItems:"center"}}>✕</button>
                )}
              </div>
              {/* Duration row */}
              <div style={{borderTop:`1px solid ${W.border}`,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:W.textL,fontFamily:W.sans,flexShrink:0}}>Duration:</span>
                {DUR_OPTIONS.map(d=>(
                  <button key={d} onClick={()=>{const n=[...slotDurs];n[i]=d;setSlotDurs(n);}}
                    style={{padding:"3px 10px",borderRadius:20,border:`1.5px solid ${slotDur===d?W.navy:W.border}`,background:slotDur===d?W.navy:"transparent",color:slotDur===d?"#fff":W.textM,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:W.sans,transition:"all 0.12s"}}>
                    {d<60?`${d}m`:d===60?"1h":`${Math.floor(d/60)}h${d%60?d%60+"m":""}`}
                  </button>
                ))}
                {isCustomDur&&<span style={{fontSize:11,color:W.blue,fontFamily:W.sans,marginLeft:2}}>✓ custom</span>}
              </div>
            </div>
          );
        })}
        <button onClick={()=>{setStartTimes(n=>[...n,""]);setSlotDurs(n=>[...n,durMins]);}}
          style={{width:"100%",padding:"11px",borderRadius:12,border:`2px dashed ${W.border}`,background:"transparent",color:W.blue,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:W.sans,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          + Add start time
        </button>
      </div>

      {/* Visual timeline with breaks */}
      {showTimeline&&(
        <div style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:W.textL,marginBottom:10}}>📅 Timetable preview</div>
          <div style={{position:"relative",height:40,background:W.bg,borderRadius:8,border:`1px solid ${W.border}`}}>
            {previewSlots.map((s,si)=>{
              const sm=toMins(s.t);
              const left=((sm-minT)/range*100).toFixed(1)+"%";
              const width=(s.dur/range*100).toFixed(1)+"%";
              return (<div key={si} style={{position:"absolute",top:3,bottom:3,left,width,background:W.greenL,border:"1px solid rgba(27,138,76,0.25)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                <span style={{fontSize:9,fontWeight:700,fontFamily:W.mono,color:W.green,padding:"0 3px",whiteSpace:"nowrap",overflow:"hidden"}}>{fmtDisp(s.t)}</span>
              </div>);
            })}
            {/* Break indicators */}
            {previewSlots.slice(0,-1).map((s,si)=>{
              const nextS = previewSlots[si+1];
              const endM = toMins(s.t)+s.dur;
              const breakMins = toMins(nextS.t)-endM;
              if(breakMins<=0) return null;
              const left=((endM-minT)/range*100).toFixed(1)+"%";
              const width=(breakMins/range*100).toFixed(1)+"%";
              return (<div key={"b"+si} style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left,width,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:8,fontFamily:W.mono,color:W.textL,whiteSpace:"nowrap"}}>{breakMins}m</span>
              </div>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:W.textL,fontFamily:W.mono}}>
            <span>{fmtDisp(previewSlots[0].t)}</span>
            <span>{fmtDisp(fmtEnd(previewSlots[previewSlots.length-1].t, previewSlots[previewSlots.length-1].dur))}</span>
          </div>
        </div>
      )}

      {/* Per-section overrides */}
      <div style={{background:W.bg,border:`1px solid ${W.border}`,borderRadius:12,padding:14}}>
        <button onClick={()=>setShowOv(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:W.blue,fontFamily:W.sans,padding:0,display:"flex",alignItems:"center",gap:6,width:"100%"}}>
          <span>{showOv?"▼":"▶"}</span> Custom slots for a specific section <span style={{fontWeight:400,color:W.textL}}>(optional)</span>
        </button>
        {showOv&&(<>
          <div style={{fontSize:13,color:W.textL,margin:"8px 0"}}>Only fill this if one section has different timings from the rest of the group.</div>
          {sections.map(sec=>{
            const secSlots=overrides[sec]||[];
            return(<div key={sec} style={{background:W.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${W.border}`,marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,fontFamily:W.mono,color:W.text,marginBottom:8}}>{sec}</div>
              {secSlots.map((slot,si)=>(
                <div key={si} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                  <input type="time" value={slot.start} onChange={e=>{const s=[...secSlots];s[si]={...s[si],start:e.target.value,end:fmtEnd(e.target.value,durMins)};setOverrides(o=>({...o,[sec]:s}));}}
                    style={{...inp,marginBottom:0,flex:1,fontSize:14}}/>
                  <span style={{fontSize:12,color:W.textL,fontFamily:W.mono,flexShrink:0}}>{slot.end||"--"}</span>
                  <button onClick={()=>setOverrides(o=>({...o,[sec]:secSlots.filter((_,j)=>j!==si)}))} style={{background:"none",border:"none",cursor:"pointer",color:W.textL,fontSize:16}}>✕</button>
                </div>
              ))}
              <button onClick={()=>setOverrides(o=>({...o,[sec]:[...secSlots,{start:"",end:"",durMins}]}))} style={{background:"none",border:"none",cursor:"pointer",color:W.blue,fontSize:12,fontFamily:W.sans,fontWeight:600,padding:0}}>+ Add time for {sec}</button>
            </div>);
          })}
        </>)}
      </div>
    </>);
  }

  function Step5() {
    return (<>
      <div style={{fontSize:19,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:6}}>Looks good?</div>
      <div style={{fontSize:14,color:W.textM,marginBottom:16,lineHeight:1.6}}>Review everything before saving. Tap Edit to go back to any section.</div>
      {[
        {icon:"🎓",bg:"#EEF2FF",label:"Grades",val:<span>{gradeNums.map(g=>g+"th").join(", ")||"None"}</span>,s:1},
        {icon:"📚",bg:W.greenL,label:"Sections",val:<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{sections.map(s=><span key={s} style={{background:W.blueL,color:W.blue,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,fontFamily:W.mono}}>{s}</span>)}</div>,s:2},
        {icon:"🕐",bg:W.greenL,label:"Time slots",val:<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{validSlots.map((s,i)=><span key={i} style={{background:W.greenL,color:W.green,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,fontFamily:W.mono}}>{fmtDisp(s.start)}–{fmtDisp(fmtEnd(s.start,s.dur))}</span>)}</div>,s:3},
      ].map(({icon,bg,label,val,s})=>(
        <div key={label} style={{background:W.surface,border:`1px solid ${W.border}`,borderRadius:12,marginBottom:8,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,color:W.textL,marginBottom:3}}>{label}</div>
            <div style={{fontSize:14,fontWeight:600,color:W.text}}>{val}</div>
          </div>
          <button onClick={()=>setStep(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:W.blue,fontWeight:600,fontFamily:W.sans,flexShrink:0,padding:"2px 0"}}>Edit</button>
        </div>
      ))}
      {isEdit&&<div style={{background:W.amberL,border:"1px solid #FCD34D",borderRadius:10,padding:"10px 14px",fontSize:13,color:W.amber,marginTop:4}}>⚠ Saving will update sections and slots visible to all teachers at this institute.</div>}
    </>);
  }

  const STEPS=[null,Step1,Step2,Step4,Step5];
  const StepComponent=STEPS[step];

  return (
    <div ref={overlayRef} style={{
      position:"fixed",
      /* top/left/width/height intentionally absent — set by visualViewport JS handler */
      background:"rgba(0,0,0,0.6)",zIndex:950,display:"flex",alignItems:"stretch",
      justifyContent:"center",padding:12,backdropFilter:"blur(6px)",boxSizing:"border-box"}}>
      <div style={{background:W.surface,borderRadius:22,width:"100%",maxWidth:520,height:"100%",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>

        {/* Header */}
        <div style={{padding:"12px 16px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:12,color:W.textL,fontFamily:W.mono}}>{inst}</div>
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
          {StepComponent()}
        </div>

        {/* Nav */}
        <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${W.border}`,display:"flex",gap:10,flexShrink:0}}>
          {step>1
            ?<button onClick={()=>{setStep(s=>s-1);setError("");}} style={{padding:"13px 20px",borderRadius:12,border:`1.5px solid ${W.border}`,background:W.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:W.textM,fontFamily:W.sans,flexShrink:0}}>← Back</button>
            :<button onClick={onClose} style={{padding:"13px 20px",borderRadius:12,border:`1.5px solid ${W.border}`,background:W.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:W.textM,fontFamily:W.sans,flexShrink:0}}>Cancel</button>
          }
          {step<TOTAL
            ?<button onClick={()=>{setError("");setStep(s=>s+1);}} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:W.navy,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:W.sans,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                Next <span>→</span>
              </button>
            :<button onClick={handleSave} disabled={busy} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:W.green,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:W.sans,opacity:busy?0.7:1}}>
                {busy?"Saving…":isEdit?"Save Changes":"✓ Save Grade Group"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}


function AdminPanelInner({user}){
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
  const [period,      setPeriod]      = useState("today");
  const [mobileStep,  setMobileStep]  = useState(0);
  const [exportOpen,   setExportOpen]   = useState(false);
  const [panelW,       setPanelW]       = useState({p1:175, p2:205, p3:200}); // resizable
  const [isMobile,     setIsMobile]     = useState(false);
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

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  React.useEffect(()=>{
    if(view==="manage"){
      getAllInstituteSections().then(s=>setInstSectionsAll(s||{})).catch(()=>{});
    }
  },[view]);

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
  const ensureFullData = async (uid) => {
    if (fullData[uid] || loadingUids.has(uid)) return; // already loaded or loading
    setLoadingUids(s=>new Set([...s,uid]));
    const d = await getTeacherFullData(uid);
    if (d) setFullData(prev=>({...prev,[uid]:d}));
    setLoadingUids(s=>{const n=new Set(s);n.delete(uid);return n;});
  };

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
      const { doc, setDoc, getDoc } = await import("firebase/firestore");
      const { db: firebaseDb } = await import("./firebase");
      await setDoc(doc(firebaseDb, "teachers", uid), { name: newName.trim() }, { merge: true });
      const dataRef = doc(firebaseDb, "users", uid, "appdata", "main");
      const snap = await getDoc(dataRef);
      if (snap.exists()) {
        await setDoc(dataRef, { ...snap.data(), profile: { ...snap.data().profile, name: newName.trim() } });
      }
      setTeachers(ts => ts.map(t => t.uid === uid ? { ...t, name: newName.trim() } : t));
      setFullData(fd => {
        if (!fd[uid]) return fd;
        return { ...fd, [uid]: { ...fd[uid], profile: { ...fd[uid].profile, name: newName.trim() } } };
      });
      setRenamingTeacher(null);
    } catch(e) { showAdminToast("Could not rename: " + e.message); }
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

  const resetNav=(newTab)=>{setSelP2(null);setSelP3(null);if(newTab)setTab(newTab);setMobileStep(s=>Math.min(s,1));};

  // When institute is selected, pre-load its teachers in background
  const onSelectInstitute = (inst) => {
    setSelInst(inst); resetNav();
    // Case-insensitive — institute names in the teacher index may differ in casing
    const _norm = s => (s || "").trim().toLowerCase();
    teachers
      .filter(t => {
        const d = fullData[t.uid];
        if (d) return (d.classes || []).some(c => _norm(c.institute) === _norm(inst));
        return (t.institutes || []).some(i => _norm(i) === _norm(inst));
      })
      .forEach(t => ensureFullData(t.uid));
  };

  // ── Export helpers ────────────────────────────────────────────────────────

  // Collect rows for a specific teacher + classId, filtered by date range, sorted ascending
  const rowsForTeacherClass = (teacherUid, teacherName, classId, className, subject, startKey, endKey) => {
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
      teacher: teacherName, institute: selInst,
      class: className, subject: subject,
      type: e.tag||"", title: e.title||"",
      notes: (e.body||"").replace(/\n/g," "),
    }));
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
    const printCSS = `body{font-family:sans-serif;padding:28px;color:#0E1F18}h1{font-size:20px;margin-bottom:3px}.meta{font-size:12px;color:#5C7268;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1A2F5A;color:#fff;padding:7px 9px;text-align:left}td{padding:7px 9px;border-bottom:1px solid #E2E8F0;vertical-align:top}tr:nth-child(even) td{background:#F7F8FC}.tag{background:#DBEAFE;color:#1D4ED8;border-radius:3px;padding:1px 5px;font-size:10px}`;
    const w = window.open("","_blank");
    w.document.write(`<html><head><title>${title}</title><style>${printCSS}</style></head><body>
      <h1>${title}</h1>
      <div class="meta">${meta} · Exported ${new Date().toLocaleDateString()}</div>
      <table><thead><tr><th>Date</th><th>Time</th><th>Teacher</th><th>Class</th><th>Type</th><th>Title</th><th>Notes</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.start_time}${r.end_time?" → "+r.end_time:""}</td><td>${r.teacher}</td><td>${r.class}</td><td><span class="tag">${r.type}</span></td><td>${r.title}</td><td>${r.notes}</td></tr>`).join("")}</tbody>
      </table></body></html>`);
    w.document.close(); w.focus();
    setTimeout(()=>w.print(),400);
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
        getRows: (sk, ek) => rowsForTeacherClass(selP3.teacherUid, selP3.teacherName, selP3.classId, selP3.className, selP3.subject, sk, ek),
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
          .filter(c=>(c.institute||"").trim()===(selInst||"").trim())
          .flatMap(c => rowsForTeacherClass(selP2, tName, c.id, normaliseName(c.section), c.subject, sk, ek))
          .sort((a,b)=>a.date!==b.date?a.date.localeCompare(b.date):(a.start_time||"").localeCompare(b.start_time||"")),
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
            .flatMap(t => rowsForTeacherClass(t.uid, t.name, t.classId, cls.display, t.subject||cls.subjects[0]||"", sk, ek))
            .sort((a,b)=>a.date!==b.date?a.date.localeCompare(b.date):(a.start_time||"").localeCompare(b.start_time||"")),
          triggerCSV: _csv, triggerPDF: _pdf, triggerJSON: _json,
        });
      }
    }

    return actions;
  })();


  // Draggable panel resize handle
  const PanelDivider = ({onDrag}) => {
    const ref = React.useRef(null);
    const drag = React.useRef(false);
    const startX = React.useRef(0);
    return(
      <div ref={ref}
        style={{width:6,flexShrink:0,cursor:"col-resize",background:"transparent",position:"relative",zIndex:10,transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=G.blueL}
        onMouseLeave={e=>{if(!drag.current)e.currentTarget.style.background="transparent";}}
        onMouseDown={e=>{
          drag.current=true; startX.current=e.clientX;
          e.preventDefault();
          const move = ev=>{if(drag.current)onDrag(ev.clientX-startX.current);startX.current=ev.clientX;};
          const up   = ()=>{drag.current=false;document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);ref.current&&(ref.current.style.background="transparent");};
          document.addEventListener("mousemove",move);
          document.addEventListener("mouseup",up);
        }}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:2,height:40,borderRadius:2,background:G.borderM,opacity:0.6}}/>
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
            group={grpModal.mode==="edit"?grpModal.group:null}
            onSave={async(savedGroup)=>{
              const existing=instSectionsAll[grpModal.inst]?.gradeGroups||[];
              const updated=grpModal.mode==="edit"?existing.map(g=>g.id===savedGroup.id?savedGroup:g):[...existing,savedGroup];
              await saveInstituteGradeGroups(grpModal.inst,updated);
              setInstSectionsAll(a=>({...a,[grpModal.inst]:{gradeGroups:updated}}));
            }}
            onClose={()=>setGrpModal(null)}
          />
        )}

        {/* Institute detail drill-down (replaces tab content when active) */}
        {instDetailView?(()=>{
          const groups=instSectionsAll[instDetailView]?.gradeGroups||[];
          const fmtSlotPill=s=>{const[h,m]=s.start.split(":").map(Number);const e=s.end?.split(":").map(Number)||[0,0];const f=(hh,mm)=>`${hh%12||12}:${String(mm).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;return`${f(h,m)}–${f(e[0],e[1])}`;};
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <button onClick={()=>setInstDetailView(null)} style={{...pill(G.bg,G.textS,G.borderM),fontSize:14}}>← Back</button>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{instDetailView}</div>
                  <div style={{fontSize:13,color:G.textM}}>Sections &amp; timetable management</div>
                </div>
              </div>
              {groups.length===0&&(
                <div style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,padding:"36px 20px",textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:32,marginBottom:10}}>📚</div>
                  <div style={{fontSize:16,fontWeight:600,color:G.textM,marginBottom:6}}>No grade groups yet</div>
                  <div style={{fontSize:14,color:G.textL}}>Add a grade group to define sections and timetable slots for this institute.</div>
                </div>
              )}
              {groups.map(grp=>(
                <div key={grp.id} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,marginBottom:12,overflow:"hidden"}}>
                  <div style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
                      <div>
                        <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display}}>{grp.label}</div>
                        <div style={{fontSize:13,color:G.textM,marginTop:2}}>{grp.sections?.length||0} sections · {grp.slots?.length||0} time slots</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>setGrpModal({mode:"edit",inst:instDetailView,group:grp})} style={{...pill(G.bg,G.textS,G.borderM),fontSize:13}}>Edit</button>
                        <button onClick={async()=>{if(!window.confirm(`Delete "${grp.label}"?`))return;await deleteInstituteGradeGroup(instDetailView,grp.id);setInstSectionsAll(a=>({...a,[instDetailView]:{gradeGroups:(a[instDetailView]?.gradeGroups||[]).filter(g=>g.id!==grp.id)}}));}} style={{...pill(G.redL,G.red,"#F5CACA"),fontSize:13}}>Delete</button>
                      </div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Sections</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                      {(grp.sections||[]).map(s=>(<span key={s} style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"3px 11px",fontSize:12,fontFamily:G.mono,fontWeight:600}}>{s}</span>))}
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Time slots</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {(grp.slots||[]).map((s,si)=>(<span key={si} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:20,padding:"3px 11px",fontSize:12,fontFamily:G.mono,color:G.text}}>{fmtSlotPill(s)}</span>))}
                    </div>
                    {Object.keys(grp.sectionOverrides||{}).filter(k=>(grp.sectionOverrides[k]||[]).length>0).length>0&&(
                      <div style={{fontSize:12,color:G.textL,marginTop:8}}>+ Custom slots for: {Object.keys(grp.sectionOverrides).filter(k=>(grp.sectionOverrides[k]||[]).length>0).join(", ")}</div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={()=>setGrpModal({mode:"add",inst:instDetailView})}
                style={{width:"100%",padding:"13px",borderRadius:12,border:`2px dashed ${G.blue}`,background:G.blueL,color:G.blue,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:G.sans}}>
                + Add Grade Group
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
            <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>Tap any institute below to set up grade groups, sections, and timetable slots. Teachers will see your sections in their class dropdown.</div>
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
                const clsCount=Object.values(fullData).reduce((s,d)=>s+(d.classes||[]).filter(c=>(c.institute||"").trim()===inst.trim()).length,0)||instTeacherList.length;
                return(
                  <div key={inst}
                    style={{background:G.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${G.border}`}}>
                    {/* Row 1: Institute name — full width */}
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
          {mobileStep>=1&&selInst&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);}} style={{color:mobileStep===1?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",fontWeight:mobileStep===1?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{selInst}</span></>}
          {mobileStep>=2&&selP2&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span onClick={()=>{setMobileStep(2);setSelP3(null);}} style={{color:mobileStep===2?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",fontWeight:mobileStep===2?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{tab==="teacher"?(fullData[selP2]?.profile?.name||selP2).split(" ")[0]:normaliseName(selP2)}</span></>}
          {mobileStep>=3&&selP3&&<><span style={{color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span><span style={{color:"#fff",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{selP3.className}</span></>}
          <button onClick={()=>setMobileStep(s=>Math.max(0,s-1))} style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:7,padding:"5px 12px",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:12,fontFamily:G.sans,fontWeight:600,flexShrink:0,WebkitTapHighlightColor:"transparent"}}>← Back</button>
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
          {institutes.map((inst,idx)=>{
            const tCount=teachers.filter(t=>(t.institutes||[]).some(i=>i.trim()===inst.trim())||(fullData[t.uid]?.classes||[]).some(c=>(c.institute||"").trim()===inst.trim())).length;
            const clsCount=Object.values(fullData).reduce((s,d)=>s+(d.classes||[]).filter(c=>(c.institute||"").trim()===inst.trim()).length,0)||teachers.filter(t=>(t.institutes||[]).some(i=>i.trim()===inst.trim())).length;
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
                    onSelectInstitute(inst);setMobileStep(1);
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
        </div>
        <MobileFooter/>
      </div>
    );
    if(mobileStep===1) return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
        {binView&&<AdminBinModal/>}
        {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
        <MobileNav/><MobileBreadcrumb/>
        <div style={{padding:"12px 14px 40px"}}>
          <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:14}}>{selInst}</h2>
          <div style={{display:"flex",background:G.surface,border:`1px solid ${G.border}`,borderRadius:10,padding:3,marginBottom:16,gap:3}}>
            {["class","teacher"].map(t=>(
              <button key={t} onClick={()=>resetNav(t)}
                style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:G.sans,background:tab===t?G.navy:"none",color:tab===t?"#fff":G.textM}}>
                {t==="class"?"By Class":"By Teacher"}
              </button>
            ))}
          </div>
          {tab==="class"&&instClasses.map(cls=>(
            <div key={cls.raw} onClick={()=>{setSelP2(cls.raw);setSelP3(null);setMobileStep(2);instClasses.find(c=>c.raw===cls.raw)?.teachers?.forEach(t=>ensureFullData(t.uid));}}
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
          {tab==="teacher"&&instTeachers.map(t=>{
            const d=fullData[t.uid]||{};
            const name=d.profile?.name||t.name||"?";
            const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
            return(
              <div key={t.uid} onClick={()=>{setSelP2(t.uid);setSelP3(null);setMobileStep(2);ensureFullData(t.uid);}}
                style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:G.text}}>{name}</div>
                  {otherInsts.length>0&&<div style={{fontSize:13,color:G.textM,marginTop:2,fontStyle:"italic"}}>also at {otherInsts.join(", ")}</div>}
                </div>
                <span style={{fontSize:20,color:G.textL}}>›</span>
              </div>
            );
          })}
          {instTeachers.length===0&&tab==="teacher"&&loadingUids.size>0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:G.textM}}>Loading teachers…</div>
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
              <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{tab==="teacher"?(fullData[selP2]?.profile?.name||selP2):normaliseName(selP2)}</h2>
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
          {p3Items.map(cls=>(
            <div key={cls.classId||cls.uid}
              style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,marginBottom:8,overflow:"hidden"}}>
              <div onClick={()=>{
                if(tab==="teacher") setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute||selInst});
                else { const clsObj=instClasses.find(c=>c.raw===selP2); setSelP3({teacherUid:cls.uid,classId:cls.classId,teacherName:cls.name,className:normaliseName(selP2),subject:clsObj?.subject}); ensureFullData(cls.uid); }
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
    if(mobileStep===3&&selP3) {
      const days=period==="today"?1:period==="week"?7:period==="month"?30:null;
      const classNotes=(fullData[selP3.teacherUid]?.notes||{})[selP3.classId]||{};
      const entries=groupByDate(getEntriesInRange(classNotes,days));
      return(
        <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
          {binView&&<AdminBinModal/>}
          {deleteModal&&<ConfirmDeleteModal title={deleteModal.title} lines={deleteModal.lines} confirmLabel={deleteModal.confirmLabel} onConfirm={deleteModal.onConfirm} onClose={()=>!deleteBusy&&setDeleteModal(null)} busy={deleteBusy}/>}
          {exportOpen&&<AdminExportModal exportActions={exportActions} onClose={()=>setExportOpen(false)}/>}
          <MobileNav/><MobileBreadcrumb/>
          <div style={{padding:"12px 14px 40px"}}>
            <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:2}}>{selP3.teacherName} — {selP3.className}</h2>
            <div style={{fontSize:14,color:G.textM,marginBottom:16}}>{selP3.institute||selInst} · {selP3.subject}</div>
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
            {entries.length===0?(
              <div style={{textAlign:"center",padding:"48px 20px",color:G.textM,fontSize:15}}>No entries for this period.</div>
            ):entries.map(([dk,dayEntries])=>(
              <div key={dk} style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.sans,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${G.border}`}}>{formatDateLabel(dk)}</div>
                {dayEntries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id||i} style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,marginBottom:8,overflow:"hidden"}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"11px 14px"}}>
                        <div style={{display:"flex",gap:6,marginBottom:note.title?6:0,flexWrap:"wrap"}}>
                          <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"2px 9px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                          {note.timeStart&&<span style={{fontSize:13,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"3px 10px",border:`1px solid ${G.borderM}`,fontWeight:600}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                        </div>
                        {note.title&&<div style={{fontWeight:700,fontSize:16,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                        {note.body&&<p style={{margin:"6px 0 0",fontSize:15,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                        <button onClick={()=>handleDeleteEntry(selP3.teacherUid,selP3.classId,dk,note.id,note.title)}
                          style={{marginTop:10,background:G.redL,border:"1px solid #F5CACA",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans}}>Delete Entry</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

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
      <div style={{background:G.navy,minHeight:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.08)",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:36,height:36,background:G.blueV,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="19" height="19" viewBox="0 0 18 18" fill="none"><path d="M4 3H7V13H14V16H4V3Z" fill="white"/></svg>
          </div>
          <div>
            <div style={{fontFamily:G.display,fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.2,letterSpacing:-0.5}}>Ledgr</div>
            <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.45)",fontFamily:G.mono,textTransform:"uppercase",marginTop:2}}>Admin Panel</div>
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

      {/* Stats strip */}
      <div className="admin-stats" style={{background:G.navyS,padding:"5px 18px",display:"flex",gap:22,alignItems:"center",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        {[
          {n:institutes.length,   l:"institutes"},
          {n:teachers.length,     l:"teachers"},
          {n:totalClasses, l:"classes"},
          {n:totalEntries,        l:"total entries"},
        ].map(({n,l})=>(
          <div key={l} style={{display:"flex",alignItems:"baseline",gap:4}}>
            <span style={{fontSize:18,fontWeight:700,color:G.blueV,fontFamily:G.display}}>{n}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontFamily:G.mono}}>{l}</span>
          </div>
        ))}
        {loadingUids.size>0&&<div style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,0.5)",fontFamily:G.mono}}>syncing {loadingUids.size} teacher{loadingUids.size>1?"s":""}…</div>}
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
            <span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);}}
              style={{fontSize:13,color:mobileStep===1?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===1?700:400,padding:"3px 0"}}>
              {selInst}
            </span>
          </>}
          {mobileStep>=2&&selP2&&<>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>›</span>
            <span onClick={()=>{setMobileStep(2);setSelP3(null);}}
              style={{fontSize:13,color:mobileStep===2?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:G.sans,fontWeight:mobileStep===2?700:400,padding:"3px 0"}}>
              {tab==="teacher"?(fullData[selP2]?.profile?.name||selP2):normaliseName(selP2)}
            </span>
          </>}
          {mobileStep>=3&&selP3&&<>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>›</span>
            <span style={{fontSize:13,color:"#fff",fontFamily:G.sans,fontWeight:700,padding:"3px 0"}}>
              {selP3.className}
            </span>
          </>}
          {/* Back button */}
          <div style={{marginLeft:"auto"}}>
            <span onClick={()=>setMobileStep(s=>Math.max(0,s-1))}
              style={{background:"rgba(255,255,255,0.1)",borderRadius:7,padding:"5px 12px",fontSize:13,color:"rgba(255,255,255,0.7)",cursor:"pointer",fontFamily:G.sans}}>
              ← Back
            </span>
          </div>
        </div>
      )}
      {/* 4-panel body */}
      <div className={`admin-panels admin-mobile-step-${mobileStep}`} style={{display:"flex",flex:1,overflow:"hidden",userSelect:"none"}}
        ref={el=>{
          if(!el) return;
          let isDown=false, startX=0, scrollLeft=0;
          // Only enable drag-scroll on the panels container itself (not inside scrollable lists)
          el.onmousedown = e=>{
            // Only drag if clicking on a panel background, not buttons/text
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
          // Touch support
          let touchStartX=0, touchScrollLeft=0;
          el.ontouchstart=e=>{touchStartX=e.touches[0].pageX;touchScrollLeft=el.scrollLeft;};
          el.ontouchmove=e=>{el.scrollLeft=touchScrollLeft-(e.touches[0].pageX-touchStartX);};
        }}>

        {/* ── P1: Institutes ── */}
        <div className="admin-side-panel admin-p1" style={{...sidePanel,width:panelW.p1,background:G.bg,borderRight:`1px solid ${G.border}`}}>
          <div style={panelLabel}>Institutes</div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {institutes.length===0&&(
              <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>No institutes yet</div>
            )}
            {institutes.map(inst=>{
              const isSel=inst===selInst;
              // Use index data first (available immediately), supplement with fullData
              const tCount=teachers.filter(t=>{
                const idxInsts=t.institutes||[];
                if(idxInsts.includes(inst)) return true;
                return (fullData[t.uid]?.classes||[]).some(c=>c.institute===inst);
              }).length;
              const clsCount=instClasses.length > 0 && inst===selInst
                ? instClasses.length
                : Object.values(fullData).reduce((s,d)=>{
                    return s+(d.classes||[]).filter(c=>c.institute===inst).length;
                  },0) || teachers.filter(t=>(t.institutes||[]).includes(inst)).length;
              return(
                <div key={inst} style={{position:"relative",display:"flex",alignItems:"center",gap:4}}>
                  <div onClick={()=>{onSelectInstitute(inst);setMobileStep(1);}}
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
        </div>
        <PanelDivider onDrag={dx=>setPanelW(w=>({...w,p1:Math.max(120,Math.min(280,w.p1+dx))}))}/>

        {/* ── P2: Toggle + Teacher or Class list ── */}
        <div className="admin-side-panel admin-p2" style={{...sidePanel,width:panelW.p2,background:G.surface,borderRight:`1px solid ${G.border}`}}>
          <div style={{padding:"12px 12px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:17,fontWeight:700,color:G.text,marginBottom:10}}>{selInst||"—"}</div>
            {/* Toggle */}
            <div style={{display:"flex",gap:0,background:G.bg,borderRadius:8,padding:3,border:`1px solid ${G.border}`}}>
              {["class","teacher"].map(t=>(
                <button key={t} onClick={()=>{resetNav(t);}}
                  style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:G.sans,textAlign:"center",transition:"all 0.15s",background:tab===t?G.navy:"none",color:tab===t?"#fff":G.textM}}>
                  {t==="class"?"By Class":"By Teacher"}
                </button>
              ))}
            </div>
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
            {selInst&&tab==="teacher"&&instTeachers.map(t=>{
              const d=fullData[t.uid]||{};
              const name=d.profile?.name||t.name||"?";
              const isLoading=loadingUids.has(t.uid)&&!fullData[t.uid];
              const isSel=selP2===t.uid;
              return(
                <div key={t.uid} onClick={()=>{setSelP2(t.uid);setSelP3(null);setMobileStep(2);ensureFullData(t.uid);}}
                  style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{width:28,height:28,borderRadius:7,background:isSel?G.blue:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:isSel?"#fff":G.blue,fontFamily:G.mono,flexShrink:0}}>
                    {(name[0]||"?").toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>

                    {(()=>{
                      const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
                      if(!otherInsts.length) return null;
                      return <div style={{fontSize:13,color:G.textM,fontFamily:G.sans,marginTop:3,fontStyle:"italic"}}>also at {otherInsts.join(", ")}</div>;
                    })()}
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
            {selInst&&tab==="class"&&instClasses.map(cls=>{
              const isSel=selP2===cls.raw;
              return(
                <div key={cls.raw} onClick={()=>{setSelP2(cls.raw);setSelP3(null);setMobileStep(2);instClasses.find(c=>c.raw===cls.raw)?.teachers?.forEach(t=>ensureFullData(t.uid));}}
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
          </div>
        </div>
        <PanelDivider onDrag={dx=>setPanelW(w=>({...w,p2:Math.max(150,Math.min(320,w.p2+dx))}))}/>

        {/* ── P3: Sub-list ── */}
        <div className="admin-side-panel admin-p3" style={{...sidePanel,width:panelW.p3,background:G.bg,borderRight:`1px solid ${G.border}`}}>
          <div style={{padding:"12px 12px 8px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:15,fontWeight:700,color:G.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {!selP2?"—":tab==="teacher"?(fullData[selP2]?.profile?.name||"Teacher"):normaliseName(selP2)}
            </div>
            <div style={{fontSize:12,color:G.textM,fontFamily:G.mono,marginTop:2}}>
              {tab==="class"?"Teachers in this class":"Their classes at "+selInst}
            </div>
          </div>
          <div style={{fontSize:11,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
            {tab==="teacher"?"Classes":"Teachers"}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selP2&&<div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:14,fontStyle:"italic"}}>Select from left</div>}


            {selP2&&tab==="teacher"&&p3Items.map(cls=>{
              const isSel=selP3?.classId===cls.classId;
              const tName=fullData[selP2]?.profile?.name||"";
              return(
                <div key={cls.classId}
                  style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent",paddingRight:8}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div onClick={()=>{setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute});setMobileStep(3);}}
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
            {selP2&&tab==="teacher"&&archivedP3Items.length>0&&(()=>{
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

            {selP2&&tab==="class"&&(()=>{
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
                        setSelP3({teacherUid:t.uid,classId:clsObj?.classId,teacherName:t.name,className:normaliseName(selP2),subject:cls?.subject});
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
        </div>
        <PanelDivider onDrag={dx=>setPanelW(w=>({...w,p3:Math.max(140,Math.min(300,w.p3+dx))}))}/>

        {/* ── P4: Entries ── */}
        <div className="admin-p4" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:G.bg,minWidth:0}}>
          {/* P4 header */}
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"12px 16px",flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:G.display,fontSize:17,fontWeight:700,color:G.text}}>
                  {selP3?`${selP3.teacherName} — ${selP3.className}`:"—"}
                </div>
                <div style={{fontSize:14,color:G.textM,marginTop:2}}>
                  {selP3?`${selInst} · ${selP3.subject}`:"Select institute → teacher or class → drill down"}
                </div>
              </div>
              {selP3&&(()=>{
                const lastTs = lastEntryTs((fullData[selP3.teacherUid]?.notes||{})[selP3.classId]||{});
                const ago = lastTs ? daysAgo(lastTs) : null;
                return(
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:ago==="Today"?G.blueV:G.borderM}}/>
                    <span style={{fontSize:13,color:ago==="Today"?G.blue:G.textL,fontWeight:600,fontFamily:G.mono}}>
                      {ago ? `Last entry: ${ago}` : "No entries yet"}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          {/* Period filter + Export — stacks cleanly on all screen sizes */}
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"8px 14px",flexShrink:0}}>
            {/* Row 1: period pills + export button side by side, both wrap if needed */}
            <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",rowGap:6}}>
              <span style={{fontSize:13,color:G.textL,fontFamily:G.mono,flexShrink:0}}>Period:</span>
              {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
                <button key={k} onClick={()=>setPeriod(k)}
                  style={{padding:"6px 14px",borderRadius:16,fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:period===k?700:500,transition:"all 0.12s",background:period===k?G.navy:G.surface,color:period===k?"#fff":G.textS,border:`1.5px solid ${period===k?G.navy:G.borderM}`,flexShrink:0,minHeight:36,WebkitTapHighlightColor:"transparent"}}>
                  {l}
                </button>
              ))}
              {/* Spacer pushes Export right on desktop; on mobile it wraps to new line */}
              <div style={{flex:1,minWidth:8}}/>
              {selP3&&(
                <button onClick={()=>setExportOpen(true)}
                  style={{display:"flex",alignItems:"center",gap:6,background:G.navy,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,minHeight:36,WebkitTapHighlightColor:"transparent",flexShrink:0}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>
              )}
            </div>
          </div>
          {/* Entries body */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px 32px"}}>
            {!selP3&&(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:30,marginBottom:10}}>👆</div>
                <div style={{fontSize:16,fontWeight:700,color:G.textM,fontFamily:G.display,marginBottom:3}}>Nothing selected</div>
                <div style={{fontSize:14,color:G.textL}}>Navigate the panels on the left</div>
              </div>
            )}
            {selP3&&p4Entries!==null&&p4Entries.length===0&&(
              <div style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,padding:"16px"}}>
                <div style={{height:3,background:G.border,borderRadius:2,marginBottom:12}}/>
                <div style={{display:"flex",alignItems:"center",gap:10,background:G.bg,borderRadius:10,padding:"12px 16px",border:`1px solid ${G.border}`}}>
                  <span style={{fontSize:19}}>⚠</span>
                  <span style={{fontSize:15,fontWeight:700,color:G.textM,fontFamily:G.sans}}>No Entry Uploaded — {selP3.teacherName} has no entries for this period.</span>
                </div>
              </div>
            )}
            {selP3&&p4Entries&&p4Entries.map(([dk,entries])=>(
              <div key={dk} style={{marginBottom:22}}>
                {/* Date label */}
                <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.mono,marginBottom:9,display:"flex",alignItems:"center",gap:8,textTransform:"uppercase",letterSpacing:0.5}}>
                  {formatDateLabel(dk)}
                  <span style={{fontSize:12,background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontWeight:600,textTransform:"none",letterSpacing:0}}>
                    {entries.length} {entries.length===1?"entry":"entries"}
                  </span>
                  <div style={{flex:1,height:1,background:G.border}}/>
                </div>
                {entries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id||i} style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,marginBottom:7,overflow:"hidden",boxShadow:G.shadowSm}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"10px 12px",display:"grid",gridTemplateColumns:"80px 1fr 90px 28px",alignItems:"center",gap:10}}>
                        <div>
                          <div style={{fontFamily:G.display,fontSize:16,fontWeight:700,color:G.text,lineHeight:1}}>
                            {note.timeStart?fmt12(note.timeStart):"—"}
                          </div>
                          {note.timeEnd&&<div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginTop:3}}>→ {fmt12(note.timeEnd)}</div>}
                        </div>
                        <div>
                          {note.status&&STATUS_STYLES[note.status]&&<span style={{background:STATUS_STYLES[note.status].bg,color:STATUS_STYLES[note.status].text,fontSize:11,borderRadius:8,padding:"2px 8px",fontFamily:"'Inter',sans-serif",fontWeight:600,display:"inline-block",marginBottom:4}}>{STATUS_STYLES[note.status].label}</span>}
                          {note.title&&<div style={{fontSize:15,fontWeight:600,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                          {note.body&&<div style={{fontSize:13,color:G.textM,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.body}</div>}
                        </div>
                        <div style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"4px 11px",fontSize:12,fontWeight:600,fontFamily:G.mono,whiteSpace:"nowrap",background:tag.bg,color:tag.text,justifySelf:"end"}}>
                          {tag.label}
                        </div>
                        <button onClick={()=>handleDeleteEntry(selP3.teacherUid,selP3.classId,dk,note.id,note.title)}
                          style={{width:26,height:26,borderRadius:7,background:G.redL,border:"none",cursor:"pointer",fontSize:13,color:G.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                          title="Delete entry">
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
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
