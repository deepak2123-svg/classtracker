import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { COLORS, TAG_STYLES, DAYS, MONTHS, inp, Spinner, Avatar, toDateKey, todayKey, formatDateLabel, fmt, formatPeriod, ripple } from "./shared.jsx";

// Theme C palette
const T = {
  navy:    "#1E2A3A",
  blue:    "#3D7FD4",
  blueL:   "#EEF4FD",
  blueM:   "#7EB8F7",
  bg:      "#F8FAFB",
  surface: "#FFFFFF",
  sidebar: "#FAFBFC",
  border:  "#EEF1F5",
  borderM: "#D1D9E0",
  text:    "#1E2A3A",
  textS:   "#4A5568",
  textM:   "#6B7280",
  textL:   "#9AA3AF",
  mono:    "'JetBrains Mono', monospace",
  sans:    "'DM Sans', sans-serif",
};

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[], institutes:[], sections:[] };

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({ value, onChange, options, onAddOption, placeholder, addPlaceholder }) {
  const [open,setOpen]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null);
  const wrapRef=useRef(null);
  useEffect(()=>{ if(adding&&inputRef.current) inputRef.current.focus(); },[adding]);
  useEffect(()=>{
    const h=(e)=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");} };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const confirmAdd=()=>{
    const t=newVal.trim(); if(!t) return;
    if(!options.includes(t)) onAddOption(t);
    onChange(t); setNewVal(""); setAdding(false); setOpen(false);
  };
  const dropStyle = {
    position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
    background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,
    boxShadow:"0 8px 24px rgba(30,42,58,0.12)",zIndex:200,overflow:"hidden"
  };
  return (
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",
          color:value?T.text:"#aaa",fontFamily:T.sans,background:T.surface,border:`1px solid ${T.border}`}}>
        <span>{value||placeholder}</span>
        <span style={{color:T.textL,fontSize:10,fontFamily:T.mono}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={dropStyle}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:T.textL,fontSize:13,fontFamily:T.sans}}>No saved options — add one below</div>}
            {options.map(opt=>{
              const sel=opt===value;
              return(<div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,fontFamily:T.sans,
                  color:sel?T.blue:T.text,fontWeight:sel?500:400,
                  background:sel?T.blueL:"transparent",display:"flex",alignItems:"center",gap:10}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=T.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:14,color:T.blue,fontSize:12}}>{sel?"✓":""}</span>{opt}
              </div>);
            })}
          </div>
          <div style={{borderTop:`1px solid ${T.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)}
                  style={{padding:"10px 16px",cursor:"pointer",fontSize:12,color:T.blue,fontFamily:T.mono,display:"flex",alignItems:"center",gap:6}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.blueL}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  ＋ Add new option
                </div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}}
                  placeholder={addPlaceholder}
                  style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1.5px solid ${T.blue}`,fontSize:13,fontFamily:T.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:T.blue,color:"#fff",border:"none",borderRadius:7,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:T.mono}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:T.bg,color:T.textM,border:"none",borderRadius:7,padding:"7px 9px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Indian public holidays (YYYY-MM-DD) ───────────────────────────────────────
const HOLIDAYS = new Set([
  // 2025
  "2025-01-26","2025-03-17","2025-04-14","2025-04-18","2025-05-12",
  "2025-06-07","2025-08-15","2025-08-27","2025-10-02","2025-10-02",
  "2025-10-20","2025-10-21","2025-11-05","2025-12-25",
  // 2026
  "2026-01-26","2026-03-20","2026-03-27","2026-04-03","2026-04-06",
  "2026-04-14","2026-05-01","2026-06-27","2026-08-15","2026-08-24",
  "2026-10-02","2026-10-08","2026-10-09","2026-10-19","2026-11-25",
  "2026-12-25",
]);

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ accentColor, notes, onSelectDate, selectedDate }) {
  const today=new Date();
  const [calYear,setCalYear]=useState(today.getFullYear());
  const [calMonth,setCalMonth]=useState(today.getMonth());
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const cells=Array(firstDay).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));
  while(cells.length%7!==0) cells.push(null);
  const tk=todayKey();
  const prev=()=>{ if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const next=()=>{ if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };
  const accent = accentColor || T.blue;

  // Compact size — 28px per cell max
  return (
    <div style={{background:T.surface,borderRadius:9,overflow:"hidden",border:`1px solid ${T.border}`,maxWidth:300}}>
      <div style={{background:T.navy,padding:"7px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={prev} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <span style={{color:"#fff",fontSize:12,fontWeight:500,fontFamily:T.mono}}>{MONTHS[calMonth]} {calYear}</span>
        <button onClick={next} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"5px 5px 1px"}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:7,fontFamily:T.mono,padding:"2px 0",
            color:i===0?"#EF4444":T.textL}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 5px 5px",gap:2}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const dk=toDateKey(calYear,calMonth,day);
          const dow=new Date(calYear,calMonth,day).getDay();
          const isToday=dk===tk, isSel=dk===selectedDate;
          const isSunday=dow===0;
          const isHoliday=HOLIDAYS.has(dk);
          const isOff=isSunday||isHoliday;
          const count=(notes[dk]||[]).length;
          return (
            <div key={dk} onClick={()=>onSelectDate(dk)}
              style={{position:"relative",aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:4,cursor:"pointer",
                background:isSel?accent:isToday?T.blueL:"transparent",transition:"all 0.1s"}}
              onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=T.blueL;}}
              onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isToday?T.blueL:"transparent";}}>
              <span style={{fontWeight:isToday||isSel?600:400,lineHeight:1,fontFamily:T.sans,fontSize:11,
                color:isSel?"#fff":isToday?accent:isOff?"#EF4444":T.textS}}>{day}</span>
              {count>0&&(
                <div style={{position:"absolute",bottom:1,display:"flex",gap:1}}>
                  {count<=3?Array.from({length:count}).map((_,di)=><div key={di} style={{width:2.5,height:2.5,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":accent}}/>)
                    :<div style={{fontSize:6,fontFamily:T.mono,color:isSel?"rgba(255,255,255,0.9)":accent,fontWeight:600}}>{count}</div>}
                </div>
              )}
              {isHoliday&&!isSel&&<div style={{position:"absolute",top:1,right:1,width:3,height:3,borderRadius:"50%",background:"#EF4444",opacity:0.5}}/>}
            </div>
          );
        })}
      </div>
      <div style={{padding:"2px 4px 4px",display:"flex",gap:8,alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:5,height:5,borderRadius:"50%",background:"#EF4444",opacity:0.6}}/><span style={{fontSize:7,color:T.textL,fontFamily:T.mono}}>sun/holiday</span></div>
        <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:5,height:5,borderRadius:"50%",background:accent}}/><span style={{fontSize:7,color:T.textL,fontFamily:T.mono}}>entries</span></div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClassTracker({ user }) {
  const [data,setData]         = useState(DEFAULT_DATA);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState(false);
  const [activeClass,setActiveClass] = useState(null);
  const [view,setView]         = useState("home");
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [newNote,setNewNote]   = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:"",teacher:""});
  const [search,setSearch]     = useState("");
  const [editNote,setEditNote] = useState(null);
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);

  useEffect(()=>{ loadUserData(user.uid).then(d=>{ if(d) setData(d); setLoading(false); }); },[user.uid]);
  useEffect(()=>{
    if(loading) return;
    setSaving(true); setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{ saveUserData(user.uid,data).then(()=>setSaving(false)).catch(()=>{setSaving(false);setSaveErr(true);}); },1000);
    return ()=>clearTimeout(saveTimer.current);
  },[data]);
  useEffect(()=>{ if((view==="addNote"||view==="editNote")&&noteRef.current) noteRef.current.focus(); },[view]);

  if(loading) return <Spinner text="Loading your classes…"/>;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:12,right:16,borderRadius:20,padding:"4px 14px",fontSize:11,fontFamily:T.mono,zIndex:999,
      background:saveErr?"#FEE2E2":T.navy,color:saveErr?"#991B1B":"#fff"}}>
      {saveErr?"⚠ Save failed":"saving…"}
    </div>
  ):null;

  const sortedByUsage=(options,field)=>{
    const counts={};
    (data.classes||[]).forEach(c=>{ if(c[field]) counts[c[field]]=(counts[c[field]]||0)+1; });
    return [...(options||[])].sort((a,b)=>(counts[b]||0)-(counts[a]||0));
  };

  const addSubjectName  =(s)=>setData(d=>({...d,subjects:[...(d.subjects||[]),s]}));
  const addInstituteName=(s)=>setData(d=>({...d,institutes:[...(d.institutes||[]),s]}));
  const addSectionName  =(s)=>setData(d=>({...d,sections:[...(d.sections||[]),s]}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim()) return;
    const id=Date.now().toString();
    setData(d=>{
      const inst=newClass.institute.trim(), sec=newClass.section.trim(), subj=newClass.subject.trim();
      return {...d,
        classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,teacher:newClass.teacher.trim(),colorIdx:d.classes.length%COLORS.length,created:Date.now()}],
        notes:{...d.notes,[id]:{}},
        institutes:(d.institutes||[]).includes(inst)?d.institutes||[]:[...(d.institutes||[]),inst],
        sections:(d.sections||[]).includes(sec)?d.sections||[]:[...(d.sections||[]),sec],
        subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[],
      };
    });
    setNewClass({institute:"",section:"",subject:"",teacher:""});
  };

  const deleteClass=(id)=>{ setData(d=>({...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id))})); setView("home"); setActiveClass(null); };
  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>(data.notes[cid]||{})[dk]||[];

  const addNote=()=>{
    if(!newNote.title.trim()&&!newNote.body.trim()) return;
    const note={id:Date.now().toString(),...newNote,created:Date.now()};
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}}; });
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""}); setView("class");
  };
  const saveEdit=()=>{
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}}; });
    setEditNote(null); setView("class");
  };
  const deleteNote=(noteId)=>{ setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}}}; }); };
  const totalNotes=data.classes.reduce((s,c)=>{ const cn=data.notes[c.id]||{}; return s+Object.values(cn).reduce((a,arr)=>a+arr.length,0); },0);

  // ── INPUT STYLE ───────────────────────────────────────────────────────────
  const inpC = {...inp, fontFamily:T.sans, background:T.surface, border:`1px solid ${T.border}`, color:T.text};

  // ── HOME ──────────────────────────────────────────────────────────────────
  if(view==="home") return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.sans}}>
      <SaveBadge/>
      {/* Top nav */}
      <div style={{background:T.navy,padding:"14px 24px"}}>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:3,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:2}}>Academic Planner</div>
            <div style={{fontSize:20,fontWeight:600,color:"#fff",letterSpacing:-0.3}}>My Classes</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2,fontFamily:T.mono}}>{data.classes.length} classes · {totalNotes} entries</div>
          </div>
          <div style={{textAlign:"right"}}>
            <Avatar user={user} size={34}/>
            <button onClick={logout} style={{display:"block",background:"none",border:"none",fontSize:10,color:"rgba(255,255,255,0.3)",cursor:"pointer",fontFamily:T.mono,marginTop:4,marginLeft:"auto"}}>sign out</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px"}}>
        {/* Class list */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {data.classes.length===0&&(
            <div style={{textAlign:"center",padding:"44px 20px",color:T.textL,background:T.surface,borderRadius:12,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:36,marginBottom:8}}>📚</div>
              <div style={{fontSize:14,color:T.textM}}>No classes yet. Add your first one below.</div>
            </div>
          )}
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const cn=data.notes[cls.id]||{};
            const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
            return(
              <div key={cls.id} style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",overflow:"hidden",boxShadow:"0 1px 3px rgba(30,42,58,0.05)"}}>
                {/* Color accent bar */}
                <div style={{width:4,alignSelf:"stretch",background:color.bg,flexShrink:0}}/>
                <div onClick={()=>{setActiveClass(cls);setView("class");setSelectedDate(todayKey());setSearch("");}}
                  style={{flex:1,display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer",minWidth:0,position:"relative",overflow:"hidden"}}
                  onPointerDown={e=>{const r=e.currentTarget;const rect=r.getBoundingClientRect();const s=Math.max(rect.width,rect.height)*2;const x=e.clientX-rect.left-s/2;const y=e.clientY-rect.top-s/2;const w=document.createElement("span");w.className="ripple-wave dark";w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px`;r.appendChild(w);w.addEventListener("animationend",()=>w.remove());}}>
                  <div style={{width:38,height:38,borderRadius:9,background:T.blueL,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:T.blue,fontFamily:T.mono,letterSpacing:-1}}>
                    {(cls.section||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:14,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:T.textM}}>🏫 {cls.institute}</span>
                      {cls.subject&&<span style={{fontSize:11,color:T.textL}}>· {cls.subject}</span>}
                      {cls.teacher&&<span style={{fontSize:11,color:T.textL}}>· 👤 {cls.teacher}</span>}
                    </div>
                  </div>
                  <div style={{background:T.blueL,color:T.blue,borderRadius:20,padding:"3px 10px",fontSize:10,fontFamily:T.mono,fontWeight:500,flexShrink:0}}>{count} {count===1?"entry":"entries"}</div>
                </div>
                <button onClick={()=>{if(window.confirm(`Delete "${cls.section} · ${cls.institute}"? All entries will be lost.`))deleteClass(cls.id);}}
                  style={{padding:"0 14px",alignSelf:"stretch",background:"none",border:"none",borderLeft:`1px solid ${T.border}`,cursor:"pointer",color:T.textL,fontSize:13,fontFamily:T.mono,flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color="#DC2626";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textL;}}>
                  🗑
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Class form */}
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
          <div style={{background:T.bg,padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,fontWeight:500,color:T.textL,fontFamily:T.mono,letterSpacing:1}}>+ ADD CLASS</div>
          </div>
          <div style={{padding:"16px"}}>
            <label style={{fontSize:10,color:T.textL,fontFamily:T.mono,letterSpacing:1,display:"block",marginBottom:4}}>INSTITUTE</label>
            <CreatableDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. Genesis Karnal, KIS, GIS" addPlaceholder="Type institute name…"/>

            <label style={{fontSize:10,color:T.textL,fontFamily:T.mono,letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>CLASS / SECTION</label>
            <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B, Section C" addPlaceholder="Type class or section…"/>

            <label style={{fontSize:10,color:T.textL,fontFamily:T.mono,letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>SUBJECT</label>
            <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>

            <label style={{fontSize:10,color:T.textL,fontFamily:T.mono,letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>TEACHER NAME</label>
            <input value={newClass.teacher} onChange={e=>setNewClass(c=>({...c,teacher:e.target.value}))} placeholder="e.g. Mr. Johnson" style={inpC}/>

            <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()}
              style={{marginTop:4,background:(newClass.institute.trim()&&newClass.section.trim())?T.navy:"#D1D9E0",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:12,cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",fontFamily:T.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden"}}
              onPointerDown={e=>{const r=e.currentTarget;const rect=r.getBoundingClientRect();const s=Math.max(rect.width,rect.height)*2;const x=e.clientX-rect.left-s/2;const y=e.clientY-rect.top-s/2;const w=document.createElement("span");w.className="ripple-wave";w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px`;r.appendChild(w);w.addEventListener("animationend",()=>w.remove());}}>ADD CLASS
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── CLASS VIEW ────────────────────────────────────────────────────────────
  if(view==="class"&&activeClass){
    const color=COLORS[activeClass.colorIdx%COLORS.length];
    const classNotes=getClassNotes(activeClass.id);
    const dateNotes=getDateNotes(activeClass.id,selectedDate);
    const filtered=dateNotes.filter(n=>!search||n.title.toLowerCase().includes(search.toLowerCase())||n.body.toLowerCase().includes(search.toLowerCase()));
    const allDates=Object.keys(classNotes).filter(dk=>classNotes[dk]&&classNotes[dk].length>0).sort((a,b)=>b.localeCompare(a));
    const totalEntries=Object.values(classNotes).reduce((s,arr)=>s+arr.length,0);
    const initials=(activeClass.section||"?").slice(0,2).toUpperCase();

    return(
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.sans}}>
        <SaveBadge/>

        {/* ── HEADER ── */}
        <div style={{background:T.navy}}>
          <div style={{maxWidth:1100,margin:"0 auto",padding:"14px 24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <button onClick={()=>setView("home")}
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontFamily:T.mono,letterSpacing:0.5}}>
                ← Back
              </button>
              <button onClick={()=>{if(window.confirm(`Delete "${activeClass.section}"? All entries will be lost.`))deleteClass(activeClass.id);}}
                style={{background:"none",border:"none",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.25)",fontFamily:T.mono}}
                onMouseEnter={e=>e.currentTarget.style.color="rgba(255,100,100,0.7)"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}>
                Delete class
              </button>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:14}}>
              <div style={{width:48,height:48,borderRadius:12,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:600,color:"#fff",letterSpacing:-1,fontFamily:T.mono,flexShrink:0}}>
                {initials}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:22,color:"#fff",letterSpacing:-0.3}}>{activeClass.section}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:4}}>
                  <span style={{color:"rgba(255,255,255,0.6)",fontSize:12,fontFamily:T.sans}}>🏫 {activeClass.institute}</span>
                  {activeClass.subject&&<span style={{color:"rgba(255,255,255,0.45)",fontSize:12}}>· {activeClass.subject}</span>}
                  {activeClass.teacher&&<span style={{color:"rgba(255,255,255,0.45)",fontSize:12}}>· 👤 {activeClass.teacher}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <div style={{background:"rgba(61,127,212,0.25)",border:"1px solid rgba(61,127,212,0.35)",borderRadius:9,padding:"5px 12px",textAlign:"center"}}>
                  <div style={{fontSize:16,fontWeight:600,color:T.blueM,fontFamily:T.sans}}>{totalEntries}</div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:T.mono,letterSpacing:1}}>ENTRIES</div>
                </div>
                <div style={{background:"rgba(61,127,212,0.25)",border:"1px solid rgba(61,127,212,0.35)",borderRadius:9,padding:"5px 12px",textAlign:"center"}}>
                  <div style={{fontSize:16,fontWeight:600,color:T.blueM,fontFamily:T.sans}}>{allDates.length}</div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:T.mono,letterSpacing:1}}>DAYS</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:"18px 24px",display:"flex",gap:16,alignItems:"flex-start"}}>

          {/* LEFT — Class Switcher */}
          <div style={{width:162,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:2,color:T.textL,marginBottom:8,textTransform:"uppercase"}}>My Classes</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {data.classes.map(cls=>{
                const c=COLORS[cls.colorIdx%COLORS.length];
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    className="ct-card" style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",
                      background:isActive?T.blueL:T.surface,
                      borderLeft:`3px solid ${isActive?T.blue:"#D1D9E0"}`,
                      border:`1px solid ${isActive?T.blue+"33":T.border}`}}>
                    <div style={{fontSize:12,fontWeight:isActive?500:400,color:isActive?T.blue:T.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{fontSize:9,color:T.textL,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:T.mono}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — Calendar + Entries */}
          <div style={{flex:1,minWidth:0}}>
            <Calendar accentColor={T.blue} notes={classNotes} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>

            <div style={{marginTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:500,color:T.text}}>{formatDateLabel(selectedDate)}</div>
                  <div style={{fontSize:10,color:T.textL,fontFamily:T.mono,marginTop:1}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
                </div>
                <button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}}
                  style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:11,cursor:"pointer",fontFamily:T.mono,fontWeight:500,letterSpacing:0.5,boxShadow:"0 2px 8px rgba(61,127,212,0.3)",position:"relative",overflow:"hidden"}}
                  onPointerDown={e=>{const r=e.currentTarget;const rect=r.getBoundingClientRect();const s=Math.max(rect.width,rect.height)*2;const x=e.clientX-rect.left-s/2;const y=e.clientY-rect.top-s/2;const w=document.createElement("span");w.className="ripple-wave";w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px`;r.appendChild(w);w.addEventListener("animationend",()=>w.remove());}}>+ Add Entry
                </button>
              </div>

              {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inpC,marginBottom:10}}/>}

              {filtered.length===0&&(
                <div style={{textAlign:"center",padding:"32px 20px",background:T.surface,borderRadius:10,border:`1px dashed ${T.borderM}`}}>
                  <div style={{width:36,height:36,borderRadius:9,background:T.blueL,margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✏️</div>
                  <div style={{fontSize:13,color:T.textM}}>{search?"No matching entries.":'Tap "+ Add Entry" to start.'}</div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {filtered.map(note=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id} className="ct-card" style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(30,42,58,0.04)"}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"10px 13px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:note.title?3:0}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:9,borderRadius:20,padding:"2px 7px",fontFamily:T.mono,fontWeight:500,letterSpacing:0.3}}>{tag.label}</span>
                              {note.timeStart&&<span style={{fontSize:9,color:T.textL,fontFamily:T.mono,background:T.bg,borderRadius:10,padding:"2px 7px"}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            </div>
                            {note.title&&<div style={{fontWeight:500,fontSize:13,color:T.text,marginTop:1}}>{note.title}</div>}
                          </div>
                          <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
                            <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                              style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 9px",fontSize:10,cursor:"pointer",color:T.textM,fontFamily:T.mono}}>Edit</button>
                            <button onClick={()=>deleteNote(note.id)}
                              style={{background:"#FEF2F2",border:"1px solid #FEE2E2",borderRadius:6,padding:"3px 9px",fontSize:10,cursor:"pointer",color:"#DC2626",fontFamily:T.mono}}>✕</button>
                          </div>
                        </div>
                        {note.body&&<p style={{margin:"7px 0 0",fontSize:12,color:T.textM,lineHeight:1.6,whiteSpace:"pre-wrap",borderTop:`1px solid ${T.border}`,paddingTop:7}}>{note.body}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — Timeline */}
          <div style={{width:180,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:2,color:T.textL,marginBottom:10,textTransform:"uppercase"}}>Past Entries</div>
            {allDates.length===0?(
              <div style={{fontSize:11,color:T.textL,fontStyle:"italic"}}>No entries yet.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column"}}>
                {allDates.map((dk,i)=>{
                  const entries=classNotes[dk]||[];
                  const isSel=dk===selectedDate;
                  return(
                    <div key={dk} onClick={()=>setSelectedDate(dk)} style={{cursor:"pointer",display:"flex",gap:8,paddingBottom:12,position:"relative",overflow:"hidden",borderRadius:6}}
                    onPointerDown={e=>{const r=e.currentTarget;const rect=r.getBoundingClientRect();const s=Math.max(rect.width,rect.height)*2;const x=e.clientX-rect.left-s/2;const y=e.clientY-rect.top-s/2;const w=document.createElement("span");w.className="ripple-wave dark";w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px`;r.appendChild(w);w.addEventListener("animationend",()=>w.remove());}}>
                      {i<allDates.length-1&&<div style={{position:"absolute",left:4,top:12,bottom:0,width:1,background:T.border}}/>}
                      <div style={{width:9,height:9,borderRadius:"50%",background:isSel?T.blue:T.surface,border:`2px solid ${isSel?T.blue:T.borderM}`,flexShrink:0,marginTop:3,zIndex:1,transition:"all 0.12s",boxShadow:isSel?`0 0 0 3px rgba(61,127,212,0.15)`:"none"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,fontWeight:isSel?500:400,color:isSel?T.blue:T.textM,fontFamily:T.mono}}>{formatDateLabel(dk)}</div>
                        <div style={{marginTop:2,display:"flex",flexDirection:"column",gap:2}}>
                          {entries.slice(0,2).map(n=>{
                            const tag=TAG_STYLES[n.tag]||TAG_STYLES.note;
                            return(
                              <div key={n.id} style={{fontSize:10,color:T.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:tag.bg,flexShrink:0}}/>
                                {n.title||n.body||"—"}
                              </div>
                            );
                          })}
                          {entries.length>2&&<div style={{fontSize:9,color:T.textL,fontFamily:T.mono}}>+{entries.length-2} more</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── ADD / EDIT NOTE ───────────────────────────────────────────────────────
  if(view==="addNote"||view==="editNote"){
    const isEdit=view==="editNote";
    const form=isEdit?editNote:newNote;
    const setForm=isEdit?setEditNote:setNewNote;
    const save=isEdit?saveEdit:addNote;
    return(
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.sans}}>
        <div style={{background:T.navy,padding:"14px 24px"}}>
          <div style={{maxWidth:640,margin:"0 auto"}}>
            <button onClick={()=>setView("class")}
              style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontFamily:T.mono}}>
              ← Back
            </button>
          </div>
        </div>
        <div style={{maxWidth:640,margin:"0 auto",padding:"24px 20px"}}>
          <div style={{fontSize:9,color:T.textL,fontFamily:T.mono,letterSpacing:1,marginBottom:3,textTransform:"uppercase"}}>{isEdit?"Editing Entry":"New Entry For"}</div>
          <h2 style={{margin:"0 0 18px",fontSize:18,fontWeight:500,color:T.text}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>

          {/* Tag picker */}
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {Object.entries(TAG_STYLES).map(([key,val])=>(
              <button key={key} onClick={()=>setForm({...form,tag:key})}
                style={{background:form.tag===key?val.bg:T.surface,color:form.tag===key?val.text:T.textL,
                  border:`1px solid ${form.tag===key?val.bg:T.border}`,borderRadius:20,padding:"5px 13px",fontSize:11,cursor:"pointer",fontFamily:T.mono,fontWeight:form.tag===key?500:400,transition:"all 0.1s"}}>
                {val.label}
              </button>
            ))}
          </div>

          {/* Time */}
          <label style={{fontSize:10,color:T.textL,fontFamily:T.mono,letterSpacing:1,display:"block",marginBottom:4,textTransform:"uppercase"}}>Class Time (optional)</label>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
            <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inpC,marginBottom:0,flex:1}}/>
            {form.timeStart&&<>
              <span style={{color:T.textL,fontSize:13,flexShrink:0}}>to</span>
              <input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inpC,marginBottom:0,flex:1}}/>
            </>}
          </div>

          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title" style={{...inpC,fontSize:15,fontWeight:500}}/>
          <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={7} style={{...inpC,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>

          <button onClick={save}
            style={{marginTop:14,background:T.navy,color:"#fff",border:"none",borderRadius:8,padding:"11px 26px",fontSize:12,cursor:"pointer",fontFamily:T.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden"}}
          onPointerDown={e=>{const r=e.currentTarget;const rect=r.getBoundingClientRect();const s=Math.max(rect.width,rect.height)*2;const x=e.clientX-rect.left-s/2;const y=e.clientY-rect.top-s/2;const w=document.createElement("span");w.className="ripple-wave";w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px`;r.appendChild(w);w.addEventListener("animationend",()=>w.remove());}}>
            {isEdit?"SAVE CHANGES":"SAVE ENTRY"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
