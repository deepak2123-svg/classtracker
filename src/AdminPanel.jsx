import React, { useState, useEffect, useMemo, Component } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher, createInviteLink,
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
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:800,backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)"}}/>
      {/* Sheet */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:801,background:"#fff",borderRadius:"20px 20px 0 0",maxHeight:"80vh",overflowY:"auto",paddingBottom:"env(safe-area-inset-bottom,16px)"}}>
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"#E2E8F0"}}/>
        </div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 20px 14px"}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#0E1F18",fontFamily:"'Poppins',sans-serif"}}>Export entries</div>
            <div style={{fontSize:13,color:"#6B7280",fontFamily:"'Inter',sans-serif",marginTop:2}}>Choose what to export</div>
          </div>
          <button onClick={onClose}
            style={{background:"#F1F5F9",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#64748B",WebkitTapHighlightColor:"transparent"}}>
            ✕
          </button>
        </div>
        {/* Actions */}
        {exportActions.length === 0 && (
          <div style={{padding:"20px",textAlign:"center",fontSize:14,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace"}}>
            Select a teacher or class first
          </div>
        )}
        {exportActions.map((action, ai) => (
          <div key={ai}>
            {/* Section header */}
            <div style={{padding:"10px 20px 6px",background:"#F8FAFC",borderTop:"1px solid #E2E8F0",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>{action.icon}</span>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#0E1F18",fontFamily:"'Poppins',sans-serif"}}>{action.label}</div>
                <div style={{fontSize:12,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace"}}>{action.sub}</div>
              </div>
            </div>
            {/* Format rows */}
            {[
              {fmt:"CSV",  icon:"📊", sub:"Excel / Google Sheets", fn:action.csv},
              {fmt:"PDF",  icon:"📄", sub:"Print-ready report",    fn:action.pdf},
              {fmt:"JSON", icon:"🗂", sub:"Raw data backup",        fn:action.json},
            ].map(({fmt,icon,sub,fn}, i, arr) => (
              <button key={fmt} onClick={fn}
                style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 20px 14px 36px",background:"none",border:"none",borderBottom:i<arr.length-1||ai<exportActions.length-1?"1px solid #F1F5F9":"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",minHeight:56,textAlign:"left"}}>
                <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:"#0E1F18",fontFamily:"'Inter',sans-serif"}}>{fmt}</div>
                  <div style={{fontSize:12,color:"#94A3B8",fontFamily:"'Inter',sans-serif"}}>{sub}</div>
                </div>
                <span style={{marginLeft:"auto",color:"#CBD5E1",fontSize:18}}>›</span>
              </button>
            ))}
          </div>
        ))}
        <div style={{height:8}}/>
      </div>
    </>
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
  const [manageTab,    setManageTab]    = useState("teachers"); // teachers | institutes
  const [adminBin,     setAdminBin]     = useState([]); // [{type:"class"|"institute", ...data, deletedAt}]
  const [binView,      setBinView]      = useState(false);
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

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
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
        if(!map[key]) map[key]={raw:c.section,display:normaliseName(c.section),subject:c.subject,teachers:[]};
        const entryCount=Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
        const lastActive=lastEntryTs((d.notes||{})[c.id]||{});
        map[key].teachers.push({uid:t.uid,name:d.profile?.name||t.name,entryCount,lastActive,classId:c.id});
      });
    });
    return Object.values(map).sort((a,b)=>classNum(b.display)-classNum(a.display));
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

  // Collect rows for a specific teacher + classId
  const rowsForTeacherClass = (teacherUid, teacherName, classId, className, subject, days) => {
    const d = fullData[teacherUid];
    if (!d) return [];
    const classNotes = (d.notes || {})[classId] || {};
    const flat = getEntriesInRange(classNotes, days);
    return flat.map(({dateKey, entry: e}) => ({
      date: dateKey, start_time: e.timeStart||"", end_time: e.timeEnd||"",
      teacher: teacherName, institute: selInst,
      class: className, subject: subject,
      type: e.tag||"", title: e.title||"",
      notes: (e.body||"").replace(/\n/g," "),
    }));
  };

  const days = period==="today"?1:period==="week"?7:period==="month"?30:null;

  // 1. Current P4 view (specific teacher + class)
  const getViewRows = () => {
    if (!selP3) return [];
    return rowsForTeacherClass(selP3.teacherUid, selP3.teacherName, selP3.classId, selP3.className, selP3.subject, days);
  };

  // 2. By Teacher — all classes for selected teacher at this institute
  const getTeacherRows = () => {
    if (!selP2 || tab!=="teacher") return [];
    const d = fullData[selP2];
    if (!d) return [];
    const teacherName = d.profile?.name || instTeachers.find(t=>t.uid===selP2)?.name || "?";
    return (d.classes||[])
      .filter(c=>(c.institute||"").trim()===(selInst||"").trim())
      .flatMap(c => rowsForTeacherClass(selP2, teacherName, c.id, normaliseName(c.section), c.subject, days));
  };

  // 3. By Class — all teachers for selected class
  const getClassRows = () => {
    if (!selP2 || tab!=="class") return [];
    const cls = instClasses.find(c=>c.raw===selP2);
    if (!cls) return [];
    return (cls.teachers||[]).flatMap(t =>
      rowsForTeacherClass(t.uid, t.name, t.classId, cls.display, cls.subject, days)
    );
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
  const exportActions = (() => {
    const actions = [];
    const periodLabel = {today:"Today",week:"This Week",month:"This Month",all:"All Time"}[period];

    // Current view (teacher + class)
    if (selP3) {
      const name = `${selP3.teacherName} — ${selP3.className}`;
      const meta = `${selInst} · ${selP3.subject} · ${periodLabel}`;
      actions.push({
        label: `This view`,
        sub: `${selP3.teacherName} · ${selP3.className}`,
        icon: "📋",
        csv:  ()=>triggerCSV(getViewRows(),  name),
        json: ()=>triggerJSON(getViewRows(),  name, {teacher:selP3.teacherName,class:selP3.className,institute:selInst,period}),
        pdf:  ()=>triggerPDF(getViewRows(),  name, meta),
      });
    }

    // By teacher — all their classes
    if (tab==="teacher" && selP2 && fullData[selP2]) {
      const d = fullData[selP2];
      const tName = d.profile?.name || "Teacher";
      const name  = `${tName} — All Classes`;
      const meta  = `${selInst} · ${periodLabel}`;
      actions.push({
        label: `All classes`,
        sub: `${tName} across ${selInst}`,
        icon: "👤",
        csv:  ()=>triggerCSV(getTeacherRows(),  name),
        json: ()=>triggerJSON(getTeacherRows(), name, {teacher:tName,institute:selInst,period}),
        pdf:  ()=>triggerPDF(getTeacherRows(),  name, meta),
      });
    }

    // By class — all teachers in that class
    if (tab==="class" && selP2) {
      const cls = instClasses.find(c=>c.raw===selP2);
      if (cls) {
        const name = `${cls.display} — All Teachers`;
        const meta = `${selInst} · ${cls.subject} · ${periodLabel}`;
        actions.push({
          label: `All teachers`,
          sub: `${cls.display} · ${cls.teachers.length} teacher${cls.teachers.length!==1?"s":""}`,
          icon: "🏫",
          csv:  ()=>triggerCSV(getClassRows(),  name),
          json: ()=>triggerJSON(getClassRows(), name, {class:cls.display,institute:selInst,period}),
          pdf:  ()=>triggerPDF(getClassRows(),  name, meta),
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
          <div style={{width:28,height:28,background:G.blueV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🎓</div>
          <span style={{fontFamily:G.display,fontSize:16,fontWeight:700,color:"#fff"}}>ClassLog</span>
          <span style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setView("main")} style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.6)","rgba(255,255,255,0.1)")}}>← Back</button>
          <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)")}}>Sign Out</button>
        </div>
      </div>
      <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 72px"}}>
        <h2 style={{fontSize:24,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:16}}>Control Centre</h2>

        {/* Tab switcher */}
        <div style={{display:"flex",background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:4,marginBottom:22,gap:4}}>
          {[["teachers","👤 Teachers"],["institutes","🏫 Institutes"]].map(([key,label])=>(
            <button key={key} onClick={()=>setManageTab(key)}
              style={{flex:1,padding:"10px 0",borderRadius:9,border:"none",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:G.sans,transition:"all 0.15s",
                background:manageTab===key?G.navy:"none",color:manageTab===key?"#fff":G.textM}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── INSTITUTES TAB ── */}
        {manageTab==="institutes"&&<>

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
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:instTeacherList.length>0?12:0}}>
                      <div style={{flex:1,minWidth:0}}>
                        {renamingInst===inst?(
                          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                            <input value={renameInstVal} onChange={e=>setRenameInstVal(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter")handleRenameInstitute(inst,renameInstVal);if(e.key==="Escape")setRenamingInst(null);}}
                              autoFocus style={{flex:1,minWidth:120,padding:"7px 11px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                            <button onClick={()=>handleRenameInstitute(inst,renameInstVal)} style={{...pill(G.navy,"#fff","transparent"),fontSize:13,padding:"6px 14px"}}>Save</button>
                            <button onClick={()=>setRenamingInst(null)} style={{...pill("none",G.textM,G.border),fontSize:13,padding:"6px 10px"}}>✕</button>
                          </div>
                        ):(
                          <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display}}>{inst}</div>
                        )}
                        <div style={{fontSize:14,color:G.textM,marginTop:3}}>{clsCount} class{clsCount!==1?"es":""} · {instTeacherList.length} teacher{instTeacherList.length!==1?"s":""}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                        {instIdx>0&&(
                          <button onClick={()=>{
                            const reordered=[...institutes];
                            const [moved]=reordered.splice(instIdx,1);
                            reordered.unshift(moved);
                            saveInstOrder(reordered);
                          }} style={{background:G.blueL,border:`1px solid ${G.borderM}`,borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer",color:G.blue,fontFamily:G.sans,fontWeight:600,whiteSpace:"nowrap"}}>
                            ↑ Top
                          </button>
                        )}
                        <button onClick={()=>{setRenamingInst(inst);setRenameInstVal(inst);}}
                          style={{background:G.bg,border:`1px solid ${G.borderM}`,borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer",color:G.textS,fontFamily:G.sans,fontWeight:500}}>
                          Rename
                        </button>
                        <button onClick={()=>handleDeleteInstitute(inst)}
                          style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500}}>
                          Delete
                        </button>
                      </div>
                    </div>
                    {/* Teacher count tag — no names to avoid confusion */}
                    {instTeacherList.length>0&&(
                      <div style={{display:"flex",gap:8,marginTop:4}}>
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
                );
              })}
            </div>
          }
        </div>

        </>}

        {/* ── TEACHERS TAB ── */}
        {manageTab==="teachers"&&<>

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
                <button onClick={()=>navigator.clipboard.writeText(inviteLink).then(()=>alert("Link copied!"))} style={{...pill("#1D4ED8","#fff","transparent"),fontSize:14,padding:"6px 16px"}}>Copy Link</button>
                <button onClick={()=>setInviteLink(null)} style={{...pill("none",G.textM,G.border),fontSize:14,padding:"6px 16px"}}>Dismiss</button>
              </div>
              <div style={{fontSize:13,color:"#1D4ED8",marginTop:10}}>⚠ Share privately. Grants full admin access, single-use.</div>
            </div>
          )}
        </div>

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
                    <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>{(d.classes||[]).length} classes · tap to manage</span>
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
          <div style={{width:32,height:32,background:G.blueV,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎓</div>
          <div>
            <div style={{fontFamily:G.display,fontSize:16,fontWeight:700,color:"#fff",lineHeight:1.1}}>ClassLog</div>
            <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.4)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setBinView(true)} style={{...pill("rgba(255,255,255,0.1)","rgba(255,255,255,0.8)","transparent"),position:"relative",padding:"6px 10px"}}>
            🗑{adminBin.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:G.red,color:"#fff",borderRadius:"50%",width:13,height:13,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>{adminBin.length}</span>}
          </button>
          <button onClick={()=>setView("manage")} style={{...pill("rgba(255,255,255,0.1)","rgba(255,255,255,0.8)","transparent"),padding:"6px 10px",fontSize:12}}>⚙</button>
          <button onClick={logout} style={{...pill("rgba(255,255,255,0.1)","rgba(255,255,255,0.8)","transparent"),padding:"6px 10px",fontSize:12}}>✕</button>
        </div>
      </div>
    );

    const MobileBreadcrumb = ()=>(
      mobileStep>0&&(
        <div style={{background:G.navyS,padding:"8px 14px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:13,fontFamily:G.sans}}>
          <span onClick={()=>{setMobileStep(0);setSelInst(null);resetNav();}} style={{color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>Institutes</span>
          {mobileStep>=1&&selInst&&<><span style={{color:"rgba(255,255,255,0.3)"}}>›</span><span onClick={()=>{setMobileStep(1);setSelP2(null);setSelP3(null);}} style={{color:mobileStep===1?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:mobileStep===1?700:400}}>{selInst}</span></>}
          {mobileStep>=2&&selP2&&<><span style={{color:"rgba(255,255,255,0.3)"}}>›</span><span onClick={()=>{setMobileStep(2);setSelP3(null);}} style={{color:mobileStep===2?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:mobileStep===2?700:400}}>{tab==="teacher"?(fullData[selP2]?.profile?.name||selP2):normaliseName(selP2)}</span></>}
          {mobileStep>=3&&selP3&&<><span style={{color:"rgba(255,255,255,0.3)"}}>›</span><span style={{color:"#fff",fontWeight:700}}>{selP3.className}</span></>}
          <span onClick={()=>setMobileStep(s=>Math.max(0,s-1))} style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",borderRadius:7,padding:"4px 10px",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:12}}>← Back</span>
        </div>
      )
    );

    const MobileStats = ()=>(
      <div style={{background:G.navyS,padding:"10px 16px",display:"flex",gap:16,flexWrap:"wrap",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        {[{n:institutes.length,l:"institutes"},{n:teachers.length,l:"teachers"},{n:totalClasses,l:"classes"},{n:totalEntries,l:"entries"}].map(({n,l})=>(
          <span key={l}><span style={{fontSize:18,fontWeight:800,color:G.blueV,fontFamily:G.display}}>{n}</span>{" "}<span style={{fontSize:13,color:"rgba(255,255,255,0.6)",fontFamily:G.sans}}>{l}</span></span>
        ))}
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
      </div>
    );

    // ── STEP 1: Teachers or Classes for selected institute ────────────────────
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
                <div style={{fontSize:14,color:G.textM,marginTop:2}}>{cls.subject}</div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"2px 10px",fontSize:12,fontFamily:G.mono,marginTop:5,display:"inline-block"}}>{cls.teachers.length} teacher{cls.teachers.length!==1?"s":""}</span>
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
        <MobileNav/><MobileBreadcrumb/>
        <div style={{padding:"12px 14px 40px"}}>
          <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{tab==="teacher"?(fullData[selP2]?.profile?.name||selP2):normaliseName(selP2)}</h2>
          <div style={{fontSize:14,color:G.textM,marginBottom:16}}>{selInst}</div>
          {p3Items.map(cls=>(
            <div key={cls.classId||cls.uid} onClick={()=>{
              if(tab==="teacher") setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute||selInst});
              else { const clsObj=instClasses.find(c=>c.raw===selP2); setSelP3({teacherUid:cls.uid,classId:cls.classId,teacherName:cls.name,className:normaliseName(selP2),subject:clsObj?.subject}); ensureFullData(cls.uid); }
              setMobileStep(3);
            }}
              style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:G.text}}>{tab==="teacher"?cls.display:cls.name}</div>
                <div style={{fontSize:14,color:G.textM,marginTop:2}}>{tab==="teacher"?cls.subject:""}</div>
                <span style={{background:G.blueL,color:G.blue,borderRadius:20,padding:"2px 10px",fontSize:12,fontFamily:G.mono,marginTop:5,display:"inline-block"}}>{cls.entryCount} {cls.entryCount===1?"entry":"entries"}</span>
              </div>
              <span style={{fontSize:20,color:G.textL}}>›</span>
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
            {/* Period pills */}
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
              {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
                <button key={k} onClick={()=>setPeriod(k)} style={{padding:"7px 14px",borderRadius:16,fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:period===k?700:500,background:period===k?G.navy:"transparent",color:period===k?"#fff":G.textS,border:`1.5px solid ${period===k?G.navy:G.borderM}`,minHeight:36,WebkitTapHighlightColor:"transparent"}}>{l}</button>
              ))}
            </div>
            {/* Export — its own row, always visible */}
            <button onClick={()=>setExportOpen(true)}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",background:G.navy,color:"#fff",border:"none",borderRadius:10,padding:"11px 0",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,minHeight:44,WebkitTapHighlightColor:"transparent",marginBottom:20}}>
              ↓ Export entries
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
      <style>{`
        @media (min-width: 768px) { .admin-mobile-back { display: none !important; } }
        .admin-mobile-back { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Nav */}
      <div style={{background:G.navy,minHeight:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.08)",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:36,height:36,background:G.blueV,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎓</div>
          <div>
            <div style={{fontFamily:G.display,fontSize:18,fontWeight:700,color:"#fff",lineHeight:1.2,letterSpacing:-0.3}}>ClassLog</div>
            <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.45)",fontFamily:G.mono,textTransform:"uppercase",marginTop:2}}>Admin Panel</div>
          </div>
        </div>
        <div className="admin-nav-r" style={{display:"flex",alignItems:"center",gap:8}}>
          <span className="desktop-only" style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontFamily:G.sans}}>Session {currentSession()}</span>
          <button onClick={()=>setBinView(true)}
        style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.55)","rgba(255,255,255,0.1)"),fontSize:13,position:"relative"}}>
        🗑{adminBin.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:G.red,color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.mono}}>{adminBin.length}</span>}
      </button>
      <button onClick={()=>setView("manage")} style={{...pill("rgba(255,255,255,0.12)","rgba(255,255,255,0.85)","rgba(255,255,255,0.2)"),fontSize:14,fontWeight:500}}>Control Centre</button>
          <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.65)","rgba(255,255,255,0.2)"),fontSize:14}}>Sign Out</button>
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
                  <div style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginTop:3}}>{cls.subject}</div>
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
                <div key={cls.classId} onClick={()=>{setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute});setMobileStep(3);}}
                  style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:15,fontWeight:600,color:isSel?G.blue:G.textS}}>{cls.display}</div>
                  <div style={{fontSize:14,color:G.textM,marginTop:3}}>{cls.subject}</div>
                  <div style={{marginTop:5}}>
                    <span style={{background:isSel?G.navy:G.blueL,color:isSel?"#fff":G.blue,borderRadius:10,padding:"3px 9px",fontSize:12,fontFamily:G.mono,fontWeight:600}}>
                      {cls.entryCount} {cls.entryCount===1?"entry":"entries"}
                    </span>
                  </div>
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
              {selP3&&<div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:G.blue}}/>
                <span style={{fontSize:13,color:G.blue,fontWeight:600,fontFamily:G.mono}}>Active</span>
              </div>}
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
                  ↓ Export
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
    </div>
  );
}

export default function AdminPanel(props){
  return <ErrorBoundary><AdminPanelInner {...props}/></ErrorBoundary>;
}
