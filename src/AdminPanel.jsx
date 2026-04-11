import { useState, useEffect, useMemo } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher,
} from "./firebase";
import { Avatar, todayKey, formatPeriod, TAG_STYLES } from "./shared.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  forest:"#152B22", forestS:"#1E3D2F", forestD:"#0D1410",
  green:"#1B8A4C",  greenV:"#34D077",  greenL:"#E8F8EF",
  bg:"#F7F8F6",     surface:"#FFFFFF",
  border:"#E6EAE8", borderM:"#C8D4CE",
  text:"#0E1F18",   textS:"#2D4039",   textM:"#5C7268", textL:"#94ADA5",
  red:"#C93030",    redL:"#FDF1F1",
  amber:"#B45309",  amberL:"#FEF3C7",
  mono:"'JetBrains Mono',monospace",
  sans:"'Plus Jakarta Sans',sans-serif",
  display:"'Syne',sans-serif",
  shadowSm:"0 1px 3px rgba(14,31,24,0.06)",
  shadowMd:"0 4px 12px rgba(14,31,24,0.08)",
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
  Object.values(notes).forEach(byDate=>{
    Object.values(byDate).forEach(arr=>{
      arr.forEach(n=>{if(n.created>latest)latest=n.created;});
    });
  });
  return latest||null;
}
function getEntriesInRange(classNotes={}, days=null){
  // returns flat array of {dateKey, entry} sorted by time asc
  const cutoff=days?Date.now()-days*24*60*60*1000:0;
  const result=[];
  Object.entries(classNotes).forEach(([dk,arr])=>{
    if(days && new Date(dk).getTime()<cutoff) return;
    arr.forEach(e=>result.push({dateKey:dk,entry:e}));
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
const sidePanel={flexShrink:0,background:"#0D160F",borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",overflow:"hidden"};
const panelLabel={fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.18)",fontFamily:G.mono,textTransform:"uppercase",padding:"10px 13px 6px",flexShrink:0};
const siBase={padding:"9px 10px",borderRadius:8,cursor:"pointer",marginBottom:2,borderLeft:"3px solid transparent",transition:"background 0.1s"};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPanel({user}){
  const [teachers,    setTeachers]    = useState([]);
  const [fullData,    setFullData]    = useState({});
  const [roles,       setRoles]       = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingUids, setLoadingUids] = useState(new Set());
  const [view,        setView]        = useState("main"); // main | manage
  // navigation state
  const [selInst,     setSelInst]     = useState(null);
  const [tab,         setTab]         = useState("teacher"); // teacher | class
  const [selP2,       setSelP2]       = useState(null); // { type, key } teacher uid OR class raw name
  const [selP3,       setSelP3]       = useState(null); // { teacherUid, classRaw }
  const [period,      setPeriod]      = useState("today");
  const [mobileStep,  setMobileStep]  = useState(0);

  useEffect(()=>{
    (async()=>{
      const [t,r]=await Promise.all([getAllTeachers(),getAllRoles()]);
      setTeachers(t); setRoles(r); setLoading(false);
      t.forEach(async teacher=>{
        setLoadingUids(s=>new Set([...s,teacher.uid]));
        const d=await getTeacherFullData(teacher.uid);
        if(d) setFullData(prev=>({...prev,[teacher.uid]:d}));
        setLoadingUids(s=>{const n=new Set(s);n.delete(teacher.uid);return n;});
      });
    })();
  },[]);

  // ── Derived: institutes ───────────────────────────────────────────────────
  const institutes=useMemo(()=>{
    const set=new Set();
    Object.values(fullData).forEach(d=>{
      (d.classes||[]).forEach(c=>{if(c.institute)set.add(c.institute);});
    });
    return Array.from(set).sort();
  },[fullData]);

  const totalEntries=useMemo(()=>{
    let t=0;
    Object.values(fullData).forEach(d=>{
      Object.values(d.notes||{}).forEach(byDate=>{
        Object.values(byDate).forEach(arr=>{t+=arr.length;});
      });
    });
    return t;
  },[fullData]);

  // ── Teachers at selected institute ────────────────────────────────────────
  const instTeachers=useMemo(()=>{
    if(!selInst) return [];
    return teachers.filter(t=>{
      const d=fullData[t.uid];
      return d&&(d.classes||[]).some(c=>c.institute===selInst);
    });
  },[selInst,teachers,fullData]);

  // ── Classes at selected institute ─────────────────────────────────────────
  const instClasses=useMemo(()=>{
    if(!selInst) return [];
    const map={};
    teachers.forEach(t=>{
      const d=fullData[t.uid];
      if(!d) return;
      (d.classes||[]).filter(c=>c.institute===selInst).forEach(c=>{
        const key=c.section;
        if(!map[key]) map[key]={raw:c.section,display:normaliseName(c.section),subject:c.subject,teachers:[]};
        const entryCount=Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+a.length,0);
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
      // P2 = teacher → P3 = their classes at this institute
      const d=fullData[selP2];
      if(!d) return [];
      return (d.classes||[])
        .filter(c=>c.institute===selInst)
        .map(c=>({
          display:normaliseName(c.section),
          raw:c.section,
          subject:c.subject,
          classId:c.id,
          entryCount:Object.values((d.notes||{})[c.id]||{}).reduce((s,a)=>s+a.length,0),
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

  if(loading) return(
    <div style={{minHeight:"100vh",background:G.forestD,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.sans}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid rgba(255,255,255,0.1)`,borderTopColor:G.greenV,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontFamily:G.mono}}>Loading data…</div>
      </div>
    </div>
  );

  // ── MANAGE ACCESS VIEW ────────────────────────────────────────────────────
  if(view==="manage") return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      {/* nav */}
      <div style={{background:G.forest,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:G.greenV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🎓</div>
          <span style={{fontFamily:G.display,fontSize:15,fontWeight:700,color:"#fff"}}>ClassLog</span>
          <span style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,textTransform:"uppercase"}}>Admin</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setView("main")} style={{...pill("rgba(255,255,255,0.08)","rgba(255,255,255,0.6)","rgba(255,255,255,0.1)")}}>← Back</button>
          <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)")}}>Sign Out</button>
        </div>
      </div>
      <div style={{maxWidth:860,margin:"0 auto",padding:"28px 28px 72px"}}>
        <h2 style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:6}}>Manage Access</h2>
        <p style={{fontSize:13,color:G.textM,marginBottom:24}}>Promote teachers to admin. Admins can view all data — they cannot add or edit entries.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {teachers.map(t=>{
            const d=fullData[t.uid]||{};
            const name=d.profile?.name||t.name||"Unknown";
            const isAdmin=roles[t.uid]==="admin";
            const isMe=t.uid===user.uid;
            return(
              <div key={t.uid} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,boxShadow:G.shadowSm}}>
                <div style={{width:40,height:40,borderRadius:10,background:isAdmin?G.amberL:G.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:isAdmin?G.amber:G.green,fontFamily:G.mono,flexShrink:0}}>
                  {(name[0]||"?").toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{name}{isMe&&<span style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginLeft:6}}>(you)</span>}</div>
                  <div style={{fontSize:12,color:G.textM,marginTop:2}}>{(t.institutes||[]).join(" · ")||"No institute yet"}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <span style={{...pill(isAdmin?G.amberL:G.greenL,isAdmin?G.amber:G.green,"transparent"),cursor:"default",fontSize:11}}>
                    {isAdmin?"👑 Admin":"👤 Teacher"}
                  </span>
                  {!isMe&&(isAdmin
                    ?<button onClick={()=>handleDemote(t.uid)} style={{...pill(G.redL,G.red,"#F5CACA")}}>Remove admin</button>
                    :<button onClick={()=>handlePromote(t.uid)} style={{...pill(G.greenL,G.green,G.borderM)}}>Make admin</button>
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
    <div style={{height:"100vh",display:"flex",flexDirection:"column",fontFamily:G.sans,background:G.forestD}}>
      <style>{`
        @media (max-width: 767px) {
          .admin-panels { flex-direction: column !important; }
          .admin-side-panel { width: 100% !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
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
      <div style={{background:G.forest,height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:G.greenV,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🎓</div>
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
      <div className="admin-stats" style={{background:"#1A3328",padding:"5px 18px",display:"flex",gap:22,alignItems:"center",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        {[
          {n:institutes.length,   l:"institutes"},
          {n:teachers.length,     l:"teachers"},
          {n:Object.values(fullData).reduce((s,d)=>s+(d.classes||[]).length,0), l:"classes"},
          {n:totalEntries,        l:"total entries"},
        ].map(({n,l})=>(
          <div key={l} style={{display:"flex",alignItems:"baseline",gap:4}}>
            <span style={{fontSize:17,fontWeight:700,color:G.greenV,fontFamily:G.display}}>{n}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.22)",fontFamily:G.mono}}>{l}</span>
          </div>
        ))}
        {loadingUids.size>0&&<div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:G.mono}}>syncing {loadingUids.size} teacher{loadingUids.size>1?"s":""}…</div>}
      </div>

      {/* Mobile back button */}
      <div className="admin-mobile-back" style={{background:"#1A3328",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"8px 16px",flexShrink:0}}
        onClick={()=>setMobileStep(s=>Math.max(0,s-1))}>
        <span style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"6px 14px",fontSize:12,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:G.sans}}>← Back</span>
      </div>
      {/* 4-panel body */}
      <div className={`admin-panels admin-mobile-step-${mobileStep}`} style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── P1: Institutes ── */}
        <div className="admin-side-panel admin-p1" style={{...sidePanel,width:175}}>
          <div style={panelLabel}>Institutes</div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {institutes.length===0&&(
              <div style={{padding:"20px 10px",textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:12,fontStyle:"italic"}}>No institutes yet</div>
            )}
            {institutes.map(inst=>{
              const isSel=inst===selInst;
              const clsCount=Object.values(fullData).reduce((s,d)=>{
                return s+(d.classes||[]).filter(c=>c.institute===inst).length;
              },0);
              const tCount=teachers.filter(t=>(fullData[t.uid]?.classes||[]).some(c=>c.institute===inst)).length;
              return(
                <div key={inst} onClick={()=>{setSelInst(inst);resetNav();setMobileStep(1);}}
                  style={{...siBase,background:isSel?"rgba(52,208,119,0.1)":"transparent",borderLeftColor:isSel?G.greenV:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:13,fontWeight:isSel?700:500,color:isSel?G.greenV:"rgba(255,255,255,0.6)"}}>{inst}</div>
                  <div style={{display:"flex",gap:5,marginTop:4}}>
                    <span style={{background:"rgba(52,208,119,0.12)",color:"rgba(52,208,119,0.8)",borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>{clsCount} class{clsCount!==1?"es":""}</span>
                    <span style={{fontSize:9,color:"rgba(255,255,255,0.18)",fontFamily:G.mono}}>{tCount} teacher{tCount!==1?"s":""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── P2: Toggle + Teacher or Class list ── */}
        <div className="admin-side-panel admin-p2" style={{...sidePanel,width:205,background:"#0A1208"}}>
          <div style={{padding:"12px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:14,fontWeight:700,color:"#fff",marginBottom:10}}>{selInst||"—"}</div>
            {/* Toggle */}
            <div style={{display:"flex",gap:0,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:3}}>
              {["teacher","class"].map(t=>(
                <button key={t} onClick={()=>{resetNav(t);}}
                  style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:G.sans,textAlign:"center",transition:"all 0.15s",background:tab===t?"#1B8A4C":"none",color:tab===t?"#fff":"rgba(255,255,255,0.4)"}}>
                  By {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.15)",fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
            {tab==="teacher"?"Teachers":"Classes ↓ (12th first)"}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selInst&&<div style={{padding:"20px 10px",textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:12,fontStyle:"italic"}}>Select an institute</div>}
            {selInst&&tab==="teacher"&&instTeachers.map(t=>{
              const d=fullData[t.uid]||{};
              const name=d.profile?.name||t.name||"?";
              const totalEnt=Object.values(fullData[t.uid]?.notes||{}).reduce((s,byDate)=>s+Object.values(byDate).reduce((a,arr)=>a+arr.length,0),0);
              const isSel=selP2===t.uid;
              return(
                <div key={t.uid} onClick={()=>{setSelP2(t.uid);setSelP3(null);setMobileStep(2);}}
                  style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?"rgba(52,208,119,0.1)":"transparent",borderLeftColor:isSel?G.greenV:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{width:28,height:28,borderRadius:7,background:isSel?G.green:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",fontFamily:G.mono,flexShrink:0}}>
                    {(name[0]||"?").toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:isSel?G.greenV:"rgba(255,255,255,0.6)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:G.mono,marginTop:2}}>{totalEnt} entries</div>
                  </div>
                </div>
              );
            })}
            {selInst&&tab==="class"&&instClasses.map(cls=>{
              const isSel=selP2===cls.raw;
              return(
                <div key={cls.raw} onClick={()=>{setSelP2(cls.raw);setSelP3(null);setMobileStep(2);}}
                  style={{...siBase,background:isSel?"rgba(52,208,119,0.1)":"transparent",borderLeftColor:isSel?G.greenV:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:13,fontWeight:600,color:isSel?G.greenV:"rgba(255,255,255,0.65)"}}>{cls.display}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:G.mono,marginTop:2}}>{cls.subject}</div>
                  <div style={{marginTop:4}}>
                    <span style={{background:"rgba(52,208,119,0.1)",color:"rgba(52,208,119,0.7)",borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>
                      {cls.teachers.length} teacher{cls.teachers.length!==1?"s":""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── P3: Sub-list ── */}
        <div className="admin-side-panel admin-p3" style={{...sidePanel,width:200,background:"#071009"}}>
          <div style={{padding:"12px 12px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
            <div style={{fontFamily:G.display,fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {!selP2?"—":tab==="teacher"?(fullData[selP2]?.profile?.name||"Teacher"):normaliseName(selP2)}
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:G.mono,marginTop:2}}>
              {tab==="teacher"?"Their classes at "+selInst:"Teachers in this class"}
            </div>
          </div>
          <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.15)",fontFamily:G.mono,textTransform:"uppercase",padding:"8px 13px 4px",flexShrink:0}}>
            {tab==="teacher"?"Classes":"Teachers"}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"0 7px 8px"}}>
            {!selP2&&<div style={{padding:"20px 10px",textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:12,fontStyle:"italic"}}>Select from left</div>}

            {selP2&&tab==="teacher"&&p3Items.map(cls=>{
              const isSel=selP3?.classId===cls.classId;
              return(
                <div key={cls.classId} onClick={()=>{setSelP3({teacherUid:selP2,classId:cls.classId,teacherName:fullData[selP2]?.profile?.name||"",className:cls.display,subject:cls.subject});setMobileStep(3);}}
                  style={{...siBase,background:isSel?"rgba(52,208,119,0.1)":"transparent",borderLeftColor:isSel?G.greenV:"transparent"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                  <div style={{fontSize:13,fontWeight:600,color:isSel?G.greenV:"rgba(255,255,255,0.65)"}}>{cls.display}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:G.mono,marginTop:2}}>{cls.subject}</div>
                  <div style={{marginTop:4}}>
                    <span style={{background:"rgba(52,208,119,0.1)",color:"rgba(52,208,119,0.7)",borderRadius:10,padding:"2px 7px",fontSize:9,fontFamily:G.mono}}>
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
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:isSel?"rgba(52,208,119,0.1)":"transparent",borderLeftColor:isSel?G.greenV:"transparent"}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                      <div style={{width:26,height:26,borderRadius:7,background:isSel?G.green:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:isSel?G.greenV:"rgba(255,255,255,0.6)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:G.mono,marginTop:2}}>{t.entryCount} entries · ✓ uploaded</div>
                      </div>
                    </div>
                  );
                })}
                {noUpload.length>0&&<>
                  <div style={{fontSize:8,letterSpacing:1.5,color:"rgba(255,255,255,0.12)",fontFamily:G.mono,textTransform:"uppercase",padding:"10px 6px 4px"}}>No upload yet</div>
                  {noUpload.map(t=>(
                    <div key={t.uid}
                      style={{...siBase,display:"flex",alignItems:"center",gap:9,background:"rgba(255,255,255,0.02)",borderLeftColor:"rgba(255,255,255,0.06)"}}>
                      <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,flexShrink:0}}>
                        {(t.name[0]||"?").toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.28)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.18)",fontFamily:G.mono,marginTop:2,fontWeight:600}}>⚠ No Entry Uploaded</div>
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
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"13px 20px",flexShrink:0}}>
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
                <div style={{width:7,height:7,borderRadius:"50%",background:G.green}}/>
                <span style={{fontSize:11,color:G.green,fontWeight:600,fontFamily:G.mono}}>Active</span>
              </div>}
            </div>
          </div>
          {/* Period filter */}
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"8px 20px",display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>Period:</span>
            {[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)}
                style={{padding:"5px 12px",borderRadius:16,fontSize:11,cursor:"pointer",border:`1px solid ${G.border}`,fontFamily:G.mono,transition:"all 0.12s",background:period===k?G.forest:"none",color:period===k?G.greenV:G.textM,borderColor:period===k?G.forest:G.border}}>
                {l}
              </button>
            ))}
            <div style={{marginLeft:"auto",fontSize:10,color:G.textL,fontFamily:G.mono}}>Earliest class first</div>
          </div>
          {/* Entries body */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px 32px"}}>
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
                  <span style={{fontSize:9,background:G.greenL,color:G.green,borderRadius:10,padding:"2px 7px",fontWeight:600,textTransform:"none",letterSpacing:0}}>
                    {entries.length} {entries.length===1?"entry":"entries"}
                  </span>
                  <div style={{flex:1,height:1,background:G.border}}/>
                </div>
                {entries.map((note,i)=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id||i} style={{background:G.surface,borderRadius:11,border:`1px solid ${G.border}`,marginBottom:7,overflow:"hidden",boxShadow:G.shadowSm}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"90px 1fr 110px",alignItems:"center",gap:12}}>
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
