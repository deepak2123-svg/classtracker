import React, { useState, useEffect, useMemo, Component } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher, createInviteLink,
} from "./firebase";
import { Avatar, todayKey, formatPeriod, TAG_STYLES } from "./shared.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  // Nav & accents — blue theme (distinct from teacher green)
  navy:  "#1A2F5A",   navyS: "#243D72",
  blue:  "#1D4ED8",   blueV: "#3B82F6",  blueL: "#DBEAFE",
  // Surfaces — same light palette as teacher
  bg:     "#F7F8FC",  surface:"#FFFFFF",
  border: "#E2E8F0",  borderM:"#CBD5E1",
  // Text — same as teacher
  text:"#0E1F18", textS:"#2D3748", textM:"#64748B", textL:"#94A3B8",
  // Status
  red:"#C93030",  redL:"#FDF1F1",
  amber:"#B45309",amberL:"#FEF3C7",
  // Typography
  mono:"'JetBrains Mono',monospace",
  sans:"'Plus Jakarta Sans',sans-serif",
  display:"'Syne',sans-serif",
  shadowSm:"0 1px 3px rgba(15,23,42,0.06),0 1px 2px rgba(15,23,42,0.04)",
  shadowMd:"0 4px 12px rgba(15,23,42,0.08),0 2px 4px rgba(15,23,42,0.04)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentSession(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
}
function ordSuffix(n){const s=["th","st","nd","rd"];const v=n%100;return s[(v-20)%10]||s[v]||s[0];}
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

const pill=(bg,color,border)=>({background:bg,color,border:`1px solid ${border||bg}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:500,transition:"all 0.15s"});

// ── Panel styles ──────────────────────────────────────────────────────────────
const sidePanel={flexShrink:0,background:G.surface,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",overflow:"hidden"};
const panelLabel={fontSize:8,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"10px 13px 6px",flexShrink:0};
const siBase={padding:"9px 10px",borderRadius:8,cursor:"pointer",marginBottom:2,borderLeft:"3px solid transparent",transition:"background 0.1s"};

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(e){ return {error:e}; }
  render(){
    if(this.state.error) return(
      <div style={{minHeight:"100vh",background:"#F7F8F6",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:24}}>
        <div style={{textAlign:"center",maxWidth:400}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <h2 style={{color:"#0E1F18",fontFamily:"'Syne',sans-serif",marginBottom:8}}>Something went wrong</h2>
          <p style={{color:"#5C7268",fontSize:13,marginBottom:20,lineHeight:1.6}}>
            There was an error loading this data. This may be caused by unexpected data format in Firestore.
          </p>
          <p style={{color:"#94ADA5",fontSize:11,fontFamily:"'JetBrains Mono',monospace",background:"#F7F8F6",padding:"8px 12px",borderRadius:8,marginBottom:20,wordBreak:"break-all"}}>
            {this.state.error?.message}
          </p>
          <button onClick={()=>window.location.reload()} style={{background:"#1B8A4C",color:"#fff",border:"none",borderRadius:9,padding:"10px 22px",fontSize:13,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}}>
            Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const [tab,         setTab]         = useState("teacher"); // teacher | class
  const [selP2,       setSelP2]       = useState(null); // { type, key } teacher uid OR class raw name
  const [selP3,       setSelP3]       = useState(null); // { teacherUid, classRaw }
  const [period,      setPeriod]      = useState("today");
  const [mobileStep,  setMobileStep]  = useState(0);
  const [exportOpen,  setExportOpen]  = useState(false);

  useEffect(()=>{
    (async()=>{
      // Load only the index (fast, lightweight) — NOT full teacher data
      const [t,r]=await Promise.all([getAllTeachers(),getAllRoles()]);
      setTeachers(t); setRoles(r); setLoading(false);
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
    // Primary: teacher index (loaded immediately on mount)
    teachers.forEach(t=>{
      (t.institutes||[]).forEach(i=>{ if(i) set.add(i.trim()); });
    });
    // Supplement: fullData catches institutes added after last index sync
    Object.values(fullData).forEach(d=>{
      (d.classes||[]).forEach(c=>{ if(c.institute) set.add(c.institute.trim()); });
    });
    return Array.from(set).sort();
  },[teachers,fullData]);

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
  const handleGenerateInvite=async()=>{
    setInviteLoading(true); setInviteLink(null);
    try {
      const token = await createInviteLink(user.uid);
      const link = `${window.location.origin}?invite=${token}`;
      setInviteLink(link);
    } catch(e) { alert("Failed to generate link: "+e.message); }
    finally { setInviteLoading(false); }
  };

  const handlePromote=async(uid)=>{
    if(!window.confirm("Promote to Admin? They will see all data.")) return;
    await promoteToAdmin(uid,user.uid);
    setRoles(r=>({...r,[uid]:"admin"}));
  };
  const handleDemote=async(uid)=>{
    if(!window.confirm("Remove admin access?")) return;
    await demoteToTeacher(uid);
    setRoles(r=>({...r,[uid]:"teacher"}));
  };

  const resetNav=(newTab)=>{setSelP2(null);setSelP3(null);if(newTab)setTab(newTab);setMobileStep(s=>Math.min(s,1));};

  // When institute is selected, pre-load its teachers in background
  const onSelectInstitute = (inst) => {
    setSelInst(inst); resetNav();
    // Pre-fetch full data for teachers at this institute only
    teachers.filter(t=>{
      const d=fullData[t.uid];
      if(d) return (d.classes||[]).some(c=>(c.institute||"").trim()===inst.trim());
      return (t.institutes||[]).some(i=>i.trim()===inst.trim());
    }).forEach(t=>ensureFullData(t.uid));
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
      notes: (e.body||"").replace(/
/g," "),
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
    if (!rows.length) { alert("No entries to export for the selected period."); return; }
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
    ].join("
");
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})),download:filename.replace(/\s+/g,"_")+".csv"});
    a.click(); setExportOpen(false);
  };

  const triggerJSON = (rows, filename, meta) => {
    const blob = new Blob([JSON.stringify({export:meta,entries:rows},null,2)],{type:"application/json"});
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:filename.replace(/\s+/g,"_")+".json"});
    a.click(); setExportOpen(false);
  };

  const triggerPDF = (rows, title, meta) => {
    if (!rows.length) { alert("No entries to export."); return; }
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


  if(loading) return(
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.sans}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${G.border}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:13,color:G.textM,fontFamily:G.mono}}>Loading data…</div>
      </div>
    </div>
  );

  // ── MANAGE ACCESS VIEW ────────────────────────────────────────────────────
  if(view==="manage") return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      {/* nav */}
      <div style={{background:G.navy,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:G.blueV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🎓</div>
          <span style={{fontFamily:G.display,fontSize:15,fontWeight:700,color:"#fff"}}>ClassLog</span>
          <span style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setView("main")} style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.6)","rgba(255,255,255,0.1)")}}>← Back</button>
          <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)")}}>Sign Out</button>
        </div>
      </div>
      <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 72px"}}>
        <h2 style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:6}}>Manage Access</h2>
        <p style={{fontSize:13,color:G.textM,marginBottom:20}}>Promote teachers to admin, or generate an invite link to give someone direct admin access.</p>

        {/* Invite link generator */}
        <div style={{background:G.blueL||"#DBEAFE",border:"1px solid #BFDBFE",borderRadius:13,padding:"14px 16px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:G.navy||"#1A2F5A",fontFamily:G.display}}>Generate Invite Link</div>
              <div style={{fontSize:12,color:"#3B82F6",marginTop:3}}>Single-use · expires in 7 days · anyone with the link becomes admin</div>
            </div>
            <button onClick={handleGenerateInvite} disabled={inviteLoading}
              style={{...pill(G.navy||"#1A2F5A","#fff","transparent"),padding:"8px 18px",fontSize:13,flexShrink:0}}>
              {inviteLoading?"Generating…":"🔗 Generate Link"}
            </button>
          </div>
          {inviteLink&&(
            <div style={{marginTop:14}}>
              <div style={{background:"#fff",border:"1px solid #BFDBFE",borderRadius:9,padding:"10px 14px",fontSize:12,fontFamily:G.mono,color:"#1A2F5A",wordBreak:"break-all",marginBottom:10}}>
                {inviteLink}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>navigator.clipboard.writeText(inviteLink).then(()=>alert("Link copied!"))}
                  style={{...pill("#1D4ED8","#fff","transparent"),fontSize:12,padding:"6px 16px"}}>
                  Copy Link
                </button>
                <button onClick={()=>setInviteLink(null)}
                  style={{...pill("none",G.textM,G.border),fontSize:12,padding:"6px 16px"}}>
                  Dismiss
                </button>
              </div>
              <div style={{fontSize:11,color:"#3B82F6",marginTop:10}}>
                ⚠ Share this link privately. It grants full admin access and can only be used once.
              </div>
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {teachers.map(t=>{
            const d=fullData[t.uid]||{};
            const name=d.profile?.name||t.name||"Unknown";
            const isAdmin=roles[t.uid]==="admin";
            const isMe=t.uid===user.uid;
            return(
              <div key={t.uid} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,boxShadow:G.shadowSm}}>
                <div style={{width:40,height:40,borderRadius:10,background:isAdmin?G.amberL:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:isAdmin?G.amber:G.blue,fontFamily:G.mono,flexShrink:0}}>
                  {(name[0]||"?").toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{name}{isMe&&<span style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginLeft:6}}>(you)</span>}</div>
                  <div style={{fontSize:12,color:G.textM,marginTop:2}}>{(t.institutes||[]).join(" · ")||"No institute yet"}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <span style={{...pill(isAdmin?G.amberL:G.blueL,isAdmin?G.amber:G.blue,"transparent"),cursor:"default",fontSize:11}}>
                    {isAdmin?"👑 Admin":"👤 Teacher"}
                  </span>
                  {!isMe&&(isAdmin
                    ?<button onClick={()=>handleDemote(t.uid)} style={{...pill(G.redL,G.red,"#F5CACA")}}>Remove admin</button>
                    :<button onClick={()=>handlePromote(t.uid)} style={{...pill(G.blueL,G.blue,G.borderM)}}>Make admin</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── MAIN PANEL VIEW ───────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",height:"100vh",display:"flex",flexDirection:"column",fontFamily:G.sans,background:G.bg,overflow:"hidden"}}>
      <style>{`
        @media (max-width: 767px) {
          .admin-panels { flex-direction: column !important; }
          .admin-side-panel { width: 100% !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
          .admin-mobile-step-0 .admin-p2, .admin-mobile-step-0 .admin-p3, .admin-mobile-step-0 .admin-p4 { display: none !important; }
          .admin-mobile-step-1 .admin-p1 { display: none !important; }
          .admin-mobile-step-1 .admin-p3, .admin-mobile-step-1 .admin-p4 { display: none !important; }
          .admin-mobile-step-2 .admin-p1, .admin-mobile-step-2 .admin-p2 { display: none !important; }
          .admin-mobile-step-2 .admin-p4 { display: none !important; }
          .admin-mobile-step-3 .admin-p1, .admin-mobile-step-3 .admin-p2, .admin-mobile-step-3 .admin-p3 { display: none !important; }
          .admin-mobile-back { display: flex !important; }
          .admin-stats { flex-wrap: wrap; gap: 10px 18px; padding: 8px 16px !important; }
        }
        @media (min-width: 768px) {
          .admin-mobile-back { display: none !important; }
        }
        .admin-mobile-back { display: none; }
      `}</style>

      {/* Nav */}
      <div style={{background:G.navy,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:G.blueV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🎓</div>
          <div>
            <div style={{fontFamily:G.display,fontSize:15,fontWeight:700,color:"#fff",lineHeight:1}}>ClassLog</div>
            <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,textTransform:"uppercase",marginTop:1}}>Admin Panel</div>
          </div>
        </div>
        <div className="admin-nav-r" style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:G.mono}}>Session {currentSession()}</span>
          <button onClick={()=>setView("manage")} style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.55)","rgba(255,255,255,0.1)"),fontSize:11}}>Manage Access</button>
          <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)"),fontSize:11}}>Sign Out</button>
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
            <span style={{fontSize:17,fontWeight:700,color:G.blueV,fontFamily:G.display}}>{n}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.55)",fontFamily:G.mono}}>{l}</span>
          </div>
        ))}
        {loadingUids.size>0&&<div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.5)",fontFamily:G.mono}}>syncing {loadingUids.size} teacher{loadingUids.size>1?"s":""}…</div>}
      </div>

      {/* Mobile back button */}
      <div className="admin-mobile-back" style={{background:G.navyS,borderBottom:`1px solid rgba(255,255,255,0.06)`,padding:"8px 16px",flexShrink:0}}
        onClick={()=>setMobileStep(s=>Math.max(0,s-1))}>
        <span style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"6px 14px",fontSize:12,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:G.sans}}>← Back</span>
      </div>
      {/* 4-panel body */}
      <div className={`admin-panels admin-mobile-step-${mobileStep}`} style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── P1: Institutes ── */}
        <div className="admin-side-panel admin-p1" style={{...sidePanel,width:175,background:G.bg,borderRight:`1px solid ${G.border}`}}>
          <div style={panelLabel}>Institutes</div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {institutes.length===0&&(
              <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:12,fontStyle:"italic"}}>No institutes yet</div>
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
                <div key={inst} onClick={()=>{onSelectInstitute(inst);setMobileStep(1);}}
                  style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:13,fontWeight:isSel?700:500,color:isSel?G.blue:G.textS}}>{inst}</div>
                  <div style={{display:"flex",gap:5,marginTop:4}}>
                    <span style={{background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>{clsCount} class{clsCount!==1?"es":""}</span>
                    <span style={{fontSize:9,color:G.textL,fontFamily:G.mono}}>{tCount} teacher{tCount!==1?"s":""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── P2: Toggle + Teacher or Class list ── */}
        <div className="admin-side-panel admin-p2" style={{...sidePanel,width:205,background:G.surface,borderRight:`1px solid ${G.border}`}}>
          <div style={{padding:"12px 12px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:14,fontWeight:700,color:G.text,marginBottom:10}}>{selInst||"—"}</div>
            {/* Toggle */}
            <div style={{display:"flex",gap:0,background:G.bg,borderRadius:8,padding:3,border:`1px solid ${G.border}`}}>
              {["teacher","class"].map(t=>(
                <button key={t} onClick={()=>{resetNav(t);}}
                  style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:G.sans,textAlign:"center",transition:"all 0.15s",background:tab===t?G.navy:"none",color:tab===t?"#fff":G.textM}}>
                  By {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{fontSize:8,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
            {tab==="teacher"?"Teachers":"Classes ↓ (12th first)"}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selInst&&<div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:12,fontStyle:"italic"}}>Select an institute</div>}
            {selInst&&tab==="teacher"&&instTeachers.length===0&&loadingUids.size>0&&(
              <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:11,fontFamily:G.mono}}>
                <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${G.blueL}`,borderTopColor:G.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 8px"}}/>
                loading teachers…
              </div>
            )}
            {selInst&&tab==="teacher"&&instTeachers.map(t=>{
              const d=fullData[t.uid]||{};
              const name=d.profile?.name||t.name||"?";
              const isLoading=loadingUids.has(t.uid)&&!fullData[t.uid];
              const totalEnt=(()=>{
                let n=0;
                try{Object.values(fullData[t.uid]?.notes||{}).forEach(byDate=>{if(byDate&&typeof byDate==="object")Object.values(byDate).forEach(arr=>{if(Array.isArray(arr))n+=arr.length;});});}catch(e){}
                return n;
              })();
              const isSel=selP2===t.uid;
              return(
                <div key={t.uid} onClick={()=>{setSelP2(t.uid);setSelP3(null);setMobileStep(2);ensureFullData(t.uid);}}
                  style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{width:28,height:28,borderRadius:7,background:isSel?G.blue:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:isSel?"#fff":G.blue,fontFamily:G.mono,flexShrink:0}}>
                    {(name[0]||"?").toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:isSel?G.blue:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                    <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,marginTop:2}}>{totalEnt} entries</div>
                    {(()=>{
                      const otherInsts=(t.institutes||[]).filter(i=>i.trim().toLowerCase()!==(selInst||"").trim().toLowerCase());
                      if(!otherInsts.length) return null;
                      return <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,marginTop:2,fontStyle:"italic"}}>also at {otherInsts.join(", ")}</div>;
                    })()}
                  </div>
                </div>
              );
            })}
            {selInst&&tab==="class"&&instClasses.length===0&&loadingUids.size>0&&(
              <div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:11,fontFamily:G.mono}}>
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
                  <div style={{fontSize:13,fontWeight:600,color:isSel?G.blue:G.textS}}>{cls.display}</div>
                  <div style={{fontSize:10,color:G.textM,fontFamily:G.mono,marginTop:2}}>{cls.subject}</div>
                  <div style={{marginTop:4}}>
                    <span style={{background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>
                      {cls.teachers.length} teacher{cls.teachers.length!==1?"s":""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── P3: Sub-list ── */}
        <div className="admin-side-panel admin-p3" style={{...sidePanel,width:200,background:G.bg,borderRight:`1px solid ${G.border}`}}>
          <div style={{padding:"12px 12px 8px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:13,fontWeight:700,color:G.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {!selP2?"—":tab==="teacher"?(fullData[selP2]?.profile?.name||"Teacher"):normaliseName(selP2)}
            </div>
            <div style={{fontSize:10,color:G.textM,fontFamily:G.mono,marginTop:2}}>
              {tab==="teacher"?"Their classes at "+selInst:"Teachers in this class"}
            </div>
          </div>
          <div style={{fontSize:8,letterSpacing:2,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
            {tab==="teacher"?"Classes":"Teachers"}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selP2&&<div style={{padding:"20px 10px",textAlign:"center",color:G.textL,fontSize:12,fontStyle:"italic"}}>Select from left</div>}

            {selP2&&tab==="teacher"&&p3Items.map(cls=>{
              const isSel=selP3?.classId===cls.classId;
              return(
                <div key={cls.classId} onClick={()=>{setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject,institute:cls.institute});setMobileStep(3);}}
                  style={{...siBase,background:isSel?G.blueL:"transparent",borderLeftColor:isSel?G.blue:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:13,fontWeight:600,color:isSel?G.blue:G.textS}}>{cls.display}</div>
                  <div style={{fontSize:10,color:G.textM,fontFamily:G.mono,marginTop:2}}>{cls.subject}</div>
                  <div style={{marginTop:4}}>
                    <span style={{background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>
                      {cls.entryCount} entries
                    </span>
                  </div>
                </div>
              );
            })}

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
                      <div style={{width:26,height:26,borderRadius:7,background:isSel?G.blue:G.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:isSel?"#fff":G.blue,fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:isSel?G.blue:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,marginTop:2}}>{t.entryCount} entries · ✓ uploaded</div>
                      </div>
                    </div>
                  );
                })}
                {noUpload.length>0&&<>
                  <div style={{fontSize:8,letterSpacing:1.5,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",padding:"10px 6px 4px"}}>No upload yet</div>
                  {noUpload.map(t=>(
                    <div key={t.uid}
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:G.bg,borderLeftColor:G.border}}>
                      <div style={{width:26,height:26,borderRadius:7,background:G.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:G.textL,fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:G.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,marginTop:2,fontWeight:600}}>⚠ No Entry Uploaded</div>
                      </div>
                    </div>
                  ))}
                </>}
              </>);
            })()}
          </div>
        </div>

        {/* ── P4: Entries ── */}
        <div className="admin-p4" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:G.bg,minWidth:0}}>
          {/* P4 header */}
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"12px 16px",flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:G.display,fontSize:16,fontWeight:700,color:G.text}}>
                  {selP3?`${selP3.teacherName} — ${selP3.className}`:"—"}
                </div>
                <div style={{fontSize:12,color:G.textM,marginTop:2}}>
                  {selP3?`${selInst} · ${selP3.subject}`:"Select institute → teacher or class → drill down"}
                </div>
              </div>
              {selP3&&<div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:G.blue}}/>
                <span style={{fontSize:11,color:G.blue,fontWeight:600,fontFamily:G.mono}}>Active</span>
              </div>}
            </div>
          </div>
          {/* Period filter */}
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"8px 14px",display:"flex",gap:5,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>Period:</span>
            {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)}
                style={{padding:"5px 12px",borderRadius:16,fontSize:11,cursor:"pointer",border:`1px solid ${G.border}`,fontFamily:G.mono,transition:"all 0.12s",background:period===k?G.navy:"none",color:period===k?G.blueV:G.textM,borderColor:period===k?G.navy:G.border}}>
                {l}
              </button>
            ))}
            {selP3&&(
              <div style={{marginLeft:"auto",position:"relative"}}>
                <button onClick={()=>setExportOpen(o=>!o)}
                  style={{display:"flex",alignItems:"center",gap:6,background:G.navy,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>
                  ↓ Export
                </button>
                {exportOpen&&(
                  <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,boxShadow:"0 8px 24px rgba(15,23,42,0.12)",zIndex:999,minWidth:240,overflow:"hidden"}}
                    onMouseLeave={()=>setExportOpen(false)}>
                    {exportActions.length===0&&(
                      <div style={{padding:"14px 16px",fontSize:12,color:G.textL,fontFamily:G.mono,textAlign:"center"}}>Select a teacher or class first</div>
                    )}
                    {exportActions.map((action,ai)=>(
                      <div key={ai}>
                        {/* Section header */}
                        <div style={{padding:"9px 16px 5px",background:G.bg,borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:14}}>{action.icon}</span>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:G.textS,fontFamily:G.display}}>{action.label}</div>
                            <div style={{fontSize:10,color:G.textL,fontFamily:G.mono}}>{action.sub}</div>
                          </div>
                        </div>
                        {/* Format options */}
                        {[
                          {fmt:"CSV",  icon:"📊", sub:"Excel / Sheets", fn:action.csv},
                          {fmt:"PDF",  icon:"📄", sub:"Print-ready",    fn:action.pdf},
                          {fmt:"JSON", icon:"🗂", sub:"Raw backup",      fn:action.json},
                        ].map(({fmt,icon,sub,fn},i,arr)=>(
                          <div key={fmt} onClick={fn}
                            style={{padding:"9px 16px 9px 28px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:i<arr.length-1||ai<exportActions.length-1?`1px solid ${G.border}`:"none",transition:"background 0.1s"}}
                            onMouseEnter={e=>e.currentTarget.style.background=G.bg}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <span style={{fontSize:15}}>{icon}</span>
                            <div>
                              <div style={{fontSize:12,fontWeight:600,color:G.text,fontFamily:G.sans}}>{fmt}</div>
                              <div style={{fontSize:10,color:G.textL,fontFamily:G.mono}}>{sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Entries body */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px 32px"}}>
            {!selP3&&(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:30,marginBottom:10}}>👆</div>
                <div style={{fontSize:14,fontWeight:700,color:G.textM,fontFamily:G.display,marginBottom:3}}>Nothing selected</div>
                <div style={{fontSize:12,color:G.textL}}>Navigate the panels on the left</div>
              </div>
            )}
            {selP3&&p4Entries!==null&&p4Entries.length===0&&(
              <div style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,padding:"16px"}}>
                <div style={{height:3,background:G.border,borderRadius:2,marginBottom:12}}/>
                <div style={{display:"flex",alignItems:"center",gap:10,background:G.bg,borderRadius:10,padding:"12px 16px",border:`1px solid ${G.border}`}}>
                  <span style={{fontSize:18}}>⚠</span>
                  <span style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.sans}}>No Entry Uploaded — {selP3.teacherName} has no entries for this period.</span>
                </div>
              </div>
            )}
            {selP3&&p4Entries&&p4Entries.map(([dk,entries])=>(
              <div key={dk} style={{marginBottom:22}}>
                {/* Date label */}
                <div style={{fontSize:11,fontWeight:700,color:G.textM,fontFamily:G.mono,marginBottom:9,display:"flex",alignItems:"center",gap:8,textTransform:"uppercase",letterSpacing:0.5}}>
                  {formatDateLabel(dk)}
                  <span style={{fontSize:9,background:G.blueL,color:G.blue,borderRadius:10,padding:"2px 7px",fontWeight:600,textTransform:"none",letterSpacing:0}}>
                    {entries.length} {entries.length===1?"entry":"entries"}
                  </span>
                  <div style={{flex:1,height:1,background:G.border}}/>
                </div>
                {entries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id||i} style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,marginBottom:7,overflow:"hidden",boxShadow:G.shadowSm}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"10px 12px",display:"grid",gridTemplateColumns:"80px 1fr 90px",alignItems:"center",gap:10}}>
                        <div>
                          <div style={{fontFamily:G.display,fontSize:14,fontWeight:700,color:G.text,lineHeight:1}}>
                            {note.timeStart?fmt12(note.timeStart):"—"}
                          </div>
                          {note.timeEnd&&<div style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginTop:3}}>→ {fmt12(note.timeEnd)}</div>}
                        </div>
                        <div>
                          {note.title&&<div style={{fontSize:13,fontWeight:600,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                          {note.body&&<div style={{fontSize:11,color:G.textM,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.body}</div>}
                        </div>
                        <div style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"4px 11px",fontSize:10,fontWeight:600,fontFamily:G.mono,whiteSpace:"nowrap",background:tag.bg,color:tag.text,justifySelf:"end"}}>
                          {tag.label}
                        </div>
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
