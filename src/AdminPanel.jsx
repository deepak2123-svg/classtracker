import { useState, useEffect, useMemo } from "react";
import {
  logout, getAllTeachers, getTeacherFullData,
  getAllRoles, promoteToAdmin, demoteToTeacher,
} from "./firebase";
import { Avatar, todayKey } from "./shared.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  forest:"#152B22", forestS:"#1E3D2F",
  green:"#1B8A4C",  greenV:"#34D077", greenL:"#E8F8EF",
  bg:"#F7F8F6",     surface:"#FFFFFF",
  border:"#E6EAE8", borderM:"#C8D4CE",
  text:"#0E1F18",   textS:"#2D4039", textM:"#5C7268", textL:"#94ADA5",
  red:"#C93030",    redL:"#FDF1F1",
  amber:"#B45309",  amberL:"#FEF3C7",
  blue:"#1D4ED8",   blueL:"#EFF6FF",
  navy:"#0E1F18",
  mono:"'JetBrains Mono',monospace",
  sans:"'Plus Jakarta Sans',sans-serif",
  display:"'Syne',sans-serif",
  shadowSm:"0 1px 3px rgba(14,31,24,0.06),0 1px 2px rgba(14,31,24,0.04)",
  shadowMd:"0 4px 12px rgba(14,31,24,0.08),0 2px 4px rgba(14,31,24,0.04)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentSession() {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth()+1;
  return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
}
function daysAgo(ts) {
  if (!ts) return null;
  const d = Math.floor((Date.now()-ts)/(1000*60*60*24));
  if (d===0) return "Today";
  if (d===1) return "Yesterday";
  if (d<=7)  return `${d}d ago`;
  if (d<=30) return `${Math.floor(d/7)}w ago`;
  return `${Math.floor(d/30)}mo ago`;
}
function countEntriesInRange(notes={}, days=null) {
  const cutoff = days ? Date.now() - days*24*60*60*1000 : 0;
  let total = 0;
  Object.values(notes).forEach(byDate => {
    Object.entries(byDate).forEach(([dk, arr]) => {
      if (!days) { total += arr.length; return; }
      const d = new Date(dk).getTime();
      if (d >= cutoff) total += arr.length;
    });
  });
  return total;
}
function lastEntryTime(notes={}) {
  let latest = 0;
  Object.values(notes).forEach(byDate => {
    Object.values(byDate).forEach(arr => {
      arr.forEach(n => { if (n.created > latest) latest = n.created; });
    });
  });
  return latest || null;
}

// ── Shared button styles ──────────────────────────────────────────────────────
const pill = (bg,color,border) => ({
  background:bg, color, border:`1px solid ${border||bg}`,
  borderRadius:8, padding:"6px 14px", fontSize:12,
  cursor:"pointer", fontFamily:G.sans, fontWeight:500,
  transition:"all 0.15s",
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPanel({ user }) {
  const [teachers,    setTeachers]    = useState([]);
  const [fullData,    setFullData]    = useState({}); // { uid: data }
  const [roles,       setRoles]       = useState({}); // { uid: role }
  const [loading,     setLoading]     = useState(true);
  const [loadingUids, setLoadingUids] = useState(new Set());
  const [selInstitute,setSelInstitute]= useState("__all__");
  const [sortBy,      setSortBy]      = useState("entries"); // entries|name|lastActive
  const [timeFilter,  setTimeFilter]  = useState("all");    // all|week|month
  const [subjFilter,  setSubjFilter]  = useState("all");
  const [selTeacher,  setSelTeacher]  = useState(null);
  const [view,        setView]        = useState("table");  // table|manage

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [t, r] = await Promise.all([getAllTeachers(), getAllRoles()]);
      setTeachers(t);
      setRoles(r);
      setLoading(false);
      // Load full data for all teachers in background
      t.forEach(async teacher => {
        setLoadingUids(s => new Set([...s, teacher.uid]));
        const d = await getTeacherFullData(teacher.uid);
        if (d) setFullData(prev => ({ ...prev, [teacher.uid]: d }));
        setLoadingUids(s => { const n=new Set(s); n.delete(teacher.uid); return n; });
      });
    })();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const institutes = useMemo(() => {
    const set = new Set();
    teachers.forEach(t => (t.institutes||[]).forEach(i => set.add(i)));
    return ["__all__", ...Array.from(set).sort()];
  }, [teachers]);

  const subjects = useMemo(() => {
    const set = new Set();
    Object.values(fullData).forEach(d => {
      (d.subjects||[]).forEach(s => set.add(s));
    });
    return ["all", ...Array.from(set).sort()];
  }, [fullData]);

  const timeDays = { all:null, week:7, month:30 };

  const enrichedTeachers = useMemo(() => {
    return teachers.map(t => {
      const d  = fullData[t.uid] || {};
      const notes = d.notes || {};
      const classes = d.classes || [];
      const days = timeDays[timeFilter];
      // Flatten notes across all classes
      const allNotes = {};
      classes.forEach(cls => { allNotes[cls.id] = notes[cls.id] || {}; });
      const entryCount = countEntriesInRange(allNotes, days);
      const lastActive = lastEntryTime(allNotes);
      const subjectList = [...new Set(classes.map(c=>c.subject).filter(Boolean))];
      const instList    = [...new Set(classes.map(c=>c.institute).filter(Boolean))];
      return {
        ...t,
        name: d.profile?.name || t.name || "Unknown",
        entryCount,
        lastActive,
        subjectList,
        instList,
        classes,
        totalClasses: classes.length,
        loaded: !!fullData[t.uid],
      };
    });
  }, [teachers, fullData, timeFilter]);

  const filtered = useMemo(() => {
    return enrichedTeachers
      .filter(t => selInstitute==="__all__" || t.instList.includes(selInstitute))
      .filter(t => subjFilter==="all" || t.subjectList.includes(subjFilter))
      .sort((a,b) => {
        if (sortBy==="name")       return a.name.localeCompare(b.name);
        if (sortBy==="lastActive") return (b.lastActive||0)-(a.lastActive||0);
        return b.entryCount - a.entryCount;
      });
  }, [enrichedTeachers, selInstitute, subjFilter, sortBy]);

  const instGroups = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const insts = t.instList.length ? t.instList : ["(No institute)"];
      insts.forEach(i => {
        if (!map[i]) map[i] = { name:i, teachers:[], totalEntries:0 };
        map[i].teachers.push(t);
        map[i].totalEntries += t.entryCount;
      });
    });
    return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
  }, [filtered]);

  const totalEntries = filtered.reduce((s,t)=>s+t.entryCount,0);

  // ── Role actions ──────────────────────────────────────────────────────────
  const handlePromote = async (uid) => {
    if (!window.confirm("Promote this teacher to Admin? They will see all data.")) return;
    await promoteToAdmin(uid, user.uid);
    setRoles(r => ({...r, [uid]:"admin"}));
  };
  const handleDemote = async (uid) => {
    if (!window.confirm("Remove admin access from this teacher?")) return;
    await demoteToTeacher(uid);
    setRoles(r => ({...r, [uid]:"teacher"}));
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.sans}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${G.border}`,borderTopColor:G.green,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:13,color:G.textM}}>Loading all teacher data…</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans,display:"flex",flexDirection:"column"}}>

      {/* ── TOP NAV ── */}
      <div style={{background:G.forest,padding:"0 28px",flexShrink:0}}>
        <div style={{height:58,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:34,height:34,borderRadius:9,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎓</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:G.display,letterSpacing:-0.3}}>ClassLog</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:G.mono,letterSpacing:1}}>ADMIN PANEL</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:G.mono}}>Session {currentSession()}</span>
            <button onClick={()=>setView(view==="manage"?"table":"manage")}
              style={{...pill(view==="manage"?G.greenV:"rgba(255,255,255,0.1)",view==="manage"?G.forest:"rgba(255,255,255,0.7)","transparent")}}>
              {view==="manage"?"← Back":"Manage Access"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"5px 12px"}}>
              <Avatar user={user} size={22}/>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500}}>{user.displayName||user.email}</span>
            </div>
            <button onClick={logout} style={{...pill("none","rgba(255,255,255,0.35)","rgba(255,255,255,0.15)")}}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{background:G.forestS,padding:"10px 28px",display:"flex",gap:28,alignItems:"center",flexShrink:0}}>
        {[
          { n:institutes.length-1, l:"institutes" },
          { n:teachers.length,     l:"teachers" },
          { n:filtered.reduce((s,t)=>s+t.totalClasses,0), l:"classes" },
          { n:totalEntries,        l:timeFilter==="all"?"total entries":`entries (${timeFilter})` },
        ].map(({n,l})=>(
          <div key={l} style={{display:"flex",alignItems:"baseline",gap:6}}>
            <span style={{fontSize:22,fontWeight:700,color:G.greenV,fontFamily:G.display}}>{n}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:G.mono}}>{l}</span>
          </div>
        ))}
        {loadingUids.size>0&&<div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:G.mono}}>loading {loadingUids.size} teacher{loadingUids.size>1?"s":""}…</div>}
      </div>

      {/* ── MANAGE ACCESS VIEW ── */}
      {view==="manage"&&(
        <div style={{flex:1,padding:"24px 28px",maxWidth:860,width:"100%",margin:"0 auto"}}>
          <h2 style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:6}}>Manage Access</h2>
          <p style={{fontSize:13,color:G.textM,marginBottom:24}}>Promote teachers to admin so they can view all institutes' data. Admins cannot add or edit entries — view only.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {enrichedTeachers.map(t=>{
              const isAdmin = roles[t.uid]==="admin";
              const isMe = t.uid===user.uid;
              return(
                <div key={t.uid} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,boxShadow:G.shadowSm}}>
                  <div style={{width:40,height:40,borderRadius:10,background:isAdmin?G.amberL:G.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:isAdmin?G.amber:G.green,fontFamily:G.mono,flexShrink:0}}>
                    {(t.name||"?")[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{t.name}{isMe&&<span style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginLeft:6}}>(you)</span>}</div>
                    <div style={{fontSize:12,color:G.textM,marginTop:2}}>{(t.instList||[]).join(" · ")||"No institute yet"}</div>
                  </div>
                  <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{...pill(isAdmin?G.amberL:G.greenL,isAdmin?G.amber:G.green,"transparent"),cursor:"default",fontSize:11}}>
                      {isAdmin?"👑 Admin":"👤 Teacher"}
                    </span>
                    {!isMe&&(
                      isAdmin
                        ?<button onClick={()=>handleDemote(t.uid)} style={{...pill(G.redL,G.red,"#F5CACA")}}>Remove admin</button>
                        :<button onClick={()=>handlePromote(t.uid)} style={{...pill(G.greenL,G.green,G.borderM)}}>Make admin</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN SPLIT PANEL ── */}
      {view==="table"&&(
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* ── LEFT SIDEBAR ── */}
          <div style={{width:240,background:G.forest,flexShrink:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
            <div style={{padding:"16px 14px 10px"}}>
              <div style={{fontSize:9,fontFamily:G.mono,letterSpacing:2,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",marginBottom:10}}>Institutes</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {institutes.map(inst=>{
                  const isAll = inst==="__all__";
                  const isSel = inst===selInstitute;
                  const count = isAll ? teachers.length : (instGroups.find(g=>g.name===inst)?.teachers.length||0);
                  return(
                    <div key={inst} onClick={()=>{setSelInstitute(inst);setSelTeacher(null);}}
                      style={{padding:"9px 12px",borderRadius:9,cursor:"pointer",transition:"background 0.12s",
                        background:isSel?"rgba(52,208,119,0.15)":"transparent",
                        borderLeft:`3px solid ${isSel?G.greenV:"transparent"}`}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:13,fontWeight:isSel?600:400,color:isSel?G.greenV:"rgba(255,255,255,0.7)"}}>
                          {isAll?"All Institutes":inst}
                        </span>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:G.mono}}>{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{padding:"14px",borderTop:"1px solid rgba(255,255,255,0.07)",marginTop:"auto"}}>
              <div style={{fontSize:9,fontFamily:G.mono,letterSpacing:2,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",marginBottom:10}}>Filters</div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,fontFamily:G.mono}}>Time period</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[["all","All time"],["week","This week"],["month","This month"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setTimeFilter(k)}
                      style={{...pill(timeFilter===k?G.greenV:"rgba(255,255,255,0.08)",timeFilter===k?G.forest:"rgba(255,255,255,0.5)","transparent"),padding:"4px 10px",fontSize:10,fontFamily:G.mono}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,fontFamily:G.mono}}>Subject</div>
                <select value={subjFilter} onChange={e=>setSubjFilter(e.target.value)}
                  style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"6px 10px",fontSize:11,color:"rgba(255,255,255,0.7)",fontFamily:G.mono,outline:"none"}}>
                  {subjects.map(s=><option key={s} value={s} style={{background:G.forest}}>{s==="all"?"All subjects":s}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,fontFamily:G.mono}}>Sort by</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[["entries","Entries"],["name","Name"],["lastActive","Active"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setSortBy(k)}
                      style={{...pill(sortBy===k?G.greenV:"rgba(255,255,255,0.08)",sortBy===k?G.forest:"rgba(255,255,255,0.5)","transparent"),padding:"4px 10px",fontSize:10,fontFamily:G.mono}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT MAIN ── */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Sub-header */}
            <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div>
                <h2 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,margin:0}}>
                  {selInstitute==="__all__"?"All Institutes":selInstitute}
                </h2>
                <div style={{fontSize:12,color:G.textM,marginTop:2}}>
                  {filtered.length} teacher{filtered.length!==1?"s":""} · {totalEntries} entries
                  {timeFilter!=="all"?` this ${timeFilter}`:""}
                </div>
              </div>
              <div style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>
                Sorted by {sortBy==="entries"?"entries":sortBy==="name"?"name":"last active"}
              </div>
            </div>

            {/* Table + detail pane */}
            <div style={{flex:1,overflow:"hidden",display:"flex"}}>

              {/* Teacher table */}
              <div style={{flex:1,overflowY:"auto"}}>
                {filtered.length===0?(
                  <div style={{padding:"60px 24px",textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:12}}>🔍</div>
                    <div style={{fontSize:15,color:G.textM}}>No teachers match the current filters.</div>
                  </div>
                ):(
                  /* Group by institute */
                  instGroups.map(group=>(
                    <div key={group.name}>
                      {/* Institute group header */}
                      <div style={{background:G.bg,padding:"9px 24px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:1}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:G.green}}/>
                        <span style={{fontSize:13,fontWeight:700,color:G.text,fontFamily:G.display}}>{group.name}</span>
                        <span style={{fontSize:11,color:G.textL,fontFamily:G.mono}}>{group.teachers.length} teacher{group.teachers.length!==1?"s":""} · {group.totalEntries} entries</span>
                      </div>
                      {/* Column headers */}
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 80px 90px 90px",padding:"8px 24px",background:G.surface,borderBottom:`1px solid ${G.border}`}}>
                        {["Teacher","Classes","Subjects","Entries","Last active","Status"].map(h=>(
                          <div key={h} style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,textTransform:"uppercase"}}>{h}</div>
                        ))}
                      </div>
                      {/* Teacher rows */}
                      {group.teachers.map(t=>{
                        const isSel = selTeacher?.uid===t.uid;
                        const isActive = t.lastActive && (Date.now()-t.lastActive)<7*24*60*60*1000;
                        return(
                          <div key={t.uid}
                            onClick={()=>setSelTeacher(isSel?null:t)}
                            style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 80px 90px 90px",
                              padding:"13px 24px",borderBottom:`1px solid ${G.border}`,
                              cursor:"pointer",transition:"background 0.12s",
                              background:isSel?G.greenL:"transparent"}}
                            onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=G.bg;}}
                            onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                            {/* Teacher name */}
                            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                              <div style={{width:32,height:32,borderRadius:9,background:isSel?G.green:G.greenL,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isSel?"#fff":G.green,fontFamily:G.mono}}>
                                {(t.name||"?")[0].toUpperCase()}
                              </div>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:isSel?G.green:G.text,fontFamily:G.display,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                                {roles[t.uid]==="admin"&&<span style={{fontSize:9,color:G.amber,fontFamily:G.mono}}>👑 admin</span>}
                              </div>
                            </div>
                            {/* Classes */}
                            <div style={{fontSize:13,color:G.textS,display:"flex",alignItems:"center"}}>
                              {t.loaded?t.totalClasses:<span style={{color:G.textL,fontSize:11}}>…</span>}
                            </div>
                            {/* Subjects */}
                            <div style={{fontSize:11,color:G.textM,display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                              {t.loaded
                                ?(t.subjectList.slice(0,2).map(s=>
                                    <span key={s} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:6,padding:"1px 6px",fontSize:10,whiteSpace:"nowrap"}}>{s}</span>
                                  ))
                                :<span style={{color:G.textL,fontSize:11}}>…</span>}
                              {t.subjectList.length>2&&<span style={{fontSize:10,color:G.textL}}>+{t.subjectList.length-2}</span>}
                            </div>
                            {/* Entries */}
                            <div style={{display:"flex",alignItems:"center"}}>
                              <span style={{fontSize:15,fontWeight:700,color:isSel?G.green:G.text,fontFamily:G.display}}>{t.loaded?t.entryCount:"…"}</span>
                            </div>
                            {/* Last active */}
                            <div style={{fontSize:11,color:G.textM,display:"flex",alignItems:"center",fontFamily:G.mono}}>
                              {t.loaded?(daysAgo(t.lastActive)||"Never"):"…"}
                            </div>
                            {/* Status */}
                            <div style={{display:"flex",alignItems:"center"}}>
                              {t.loaded
                                ?<span style={{fontSize:10,fontFamily:G.mono,fontWeight:600,color:isActive?G.green:G.textL}}>
                                    {isActive?"● Active":"○ Idle"}
                                  </span>
                                :<span style={{fontSize:10,color:G.textL}}>…</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* ── Teacher detail pane ── */}
              {selTeacher&&(()=>{
                const d = fullData[selTeacher.uid];
                const classes = d?.classes||[];
                const notes   = d?.notes||{};
                return(
                  <div style={{width:300,flexShrink:0,borderLeft:`1px solid ${G.border}`,background:G.surface,overflowY:"auto",display:"flex",flexDirection:"column"}}>
                    {/* Detail header */}
                    <div style={{padding:"16px 18px",borderBottom:`1px solid ${G.border}`,background:G.greenL}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{selTeacher.name}</div>
                          <div style={{fontSize:11,color:G.textM,marginTop:3}}>{selTeacher.instList.join(" · ")||"No institute"}</div>
                          <div style={{fontSize:11,color:G.textM,marginTop:2,fontFamily:G.mono}}>Last active: {daysAgo(selTeacher.lastActive)||"Never"}</div>
                        </div>
                        <button onClick={()=>setSelTeacher(null)} style={{background:"none",border:"none",cursor:"pointer",color:G.textL,fontSize:16,padding:"0 4px"}}>✕</button>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        {[
                          {n:selTeacher.totalClasses,l:"classes"},
                          {n:selTeacher.entryCount,l:"entries"},
                        ].map(({n,l})=>(
                          <div key={l} style={{flex:1,background:G.surface,borderRadius:9,padding:"9px 12px",border:`1px solid ${G.border}`}}>
                            <div style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{n}</div>
                            <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,textTransform:"uppercase"}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Classes list */}
                    <div style={{padding:"14px 18px",flex:1}}>
                      <div style={{fontSize:10,fontFamily:G.mono,letterSpacing:1,color:G.textL,textTransform:"uppercase",marginBottom:10}}>Classes</div>
                      {classes.length===0
                        ?<div style={{fontSize:12,color:G.textL,fontStyle:"italic"}}>No classes yet.</div>
                        :classes.map(cls=>{
                          const clsNotes = notes[cls.id]||{};
                          const count = Object.values(clsNotes).reduce((s,arr)=>s+arr.length,0);
                          return(
                            <div key={cls.id} style={{marginBottom:8,background:G.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${G.border}`}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                <div>
                                  <div style={{fontSize:13,fontWeight:600,color:G.text,fontFamily:G.display}}>{cls.section}</div>
                                  <div style={{fontSize:11,color:G.textM,marginTop:2}}>🏫 {cls.institute}{cls.subject?` · ${cls.subject}`:""}</div>
                                </div>
                                <div style={{background:G.greenL,color:G.green,borderRadius:12,padding:"2px 9px",fontSize:10,fontFamily:G.mono,fontWeight:600,flexShrink:0}}>
                                  {count}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {/* Role management shortcut */}
                      <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${G.border}`}}>
                        <div style={{fontSize:10,fontFamily:G.mono,letterSpacing:1,color:G.textL,textTransform:"uppercase",marginBottom:8}}>Access</div>
                        {roles[selTeacher.uid]==="admin"
                          ?<button onClick={()=>handleDemote(selTeacher.uid)} style={{...pill(G.redL,G.red,"#F5CACA"),width:"100%",textAlign:"center"}}>Remove admin access</button>
                          :selTeacher.uid!==user.uid
                            ?<button onClick={()=>handlePromote(selTeacher.uid)} style={{...pill(G.amberL,G.amber,"#FCD34D"),width:"100%",textAlign:"center"}}>Promote to admin</button>
                            :<div style={{fontSize:12,color:G.textL,fontStyle:"italic"}}>This is you</div>
                        }
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
