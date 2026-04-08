import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { COLORS, TAG_STYLES, DAYS, MONTHS, inp, Spinner, Avatar, toDateKey, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

const T = {
  navy:    "#1E2A3A",
  navyS:   "#253547",
  blue:    "#3D7FD4",
  blueL:   "#EEF4FD",
  blueM:   "#7EB8F7",
  bg:      "#F4F6F9",
  surface: "#FFFFFF",
  border:  "#E4E9F0",
  borderM: "#C8D0DC",
  text:    "#1E2A3A",
  textS:   "#374151",
  textM:   "#6B7280",
  textL:   "#9CA3AF",
  red:     "#EF4444",
  redL:    "#FEF2F2",
  mono:    "'JetBrains Mono', monospace",
  sans:    "'DM Sans', sans-serif",
};

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[], institutes:[], sections:[] };

// ── Date window helpers ───────────────────────────────────────────────────────
function getDateWindow() {
  const now = new Date();
  const past = new Date(now); past.setDate(past.getDate() - 7);
  const future = new Date(now); future.setDate(future.getDate() + 7);
  const pad = n => String(n).padStart(2,"0");
  const fmt2 = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return { min: fmt2(past), max: fmt2(future) };
}
function isDateAllowed(dk) {
  const { min, max } = getDateWindow();
  return dk >= min && dk <= max;
}

// ── Ripple helper ─────────────────────────────────────────────────────────────
function rpl(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const s = Math.max(rect.width, rect.height) * 2;
  const x = (e.clientX||e.touches?.[0]?.clientX||rect.left) - rect.left - s/2;
  const y = (e.clientY||e.touches?.[0]?.clientY||rect.top) - rect.top - s/2;
  const w = document.createElement("span");
  const dark = el.dataset.rippleDark === "true";
  w.className = "ripple-wave" + (dark ? " dark" : "");
  w.style.cssText = `width:${s}px;height:${s}px;left:${x}px;top:${y}px`;
  el.appendChild(w);
  w.addEventListener("animationend", () => w.remove());
}

// ── Shared style shortcuts ────────────────────────────────────────────────────
const card = {
  background: T.surface,
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  boxShadow: "0 1px 3px rgba(30,42,58,0.05)",
};
const label = {
  fontSize: 10, color: T.textL, fontFamily: T.mono,
  letterSpacing: 1, display: "block", marginBottom: 5, textTransform: "uppercase",
};
const navBtn = {
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: 7, padding: "5px 13px",
  fontSize: 11, cursor: "pointer",
  color: "rgba(255,255,255,0.75)",
  fontFamily: T.mono, letterSpacing: 0.5,
};

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({ value, onChange, options, onAddOption, placeholder, addPlaceholder }) {
  const [open,setOpen]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null);
  const wrapRef=useRef(null);
  useEffect(()=>{ if(adding&&inputRef.current) inputRef.current.focus(); },[adding]);
  useEffect(()=>{
    const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");} };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const confirmAdd=()=>{
    const t=newVal.trim(); if(!t) return;
    if(!options.includes(t)) onAddOption(t);
    onChange(t); setNewVal(""); setAdding(false); setOpen(false);
  };
  return (
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{width:"100%",padding:"10px 13px",borderRadius:9,border:`1px solid ${T.border}`,
          background:T.surface,cursor:"pointer",textAlign:"left",display:"flex",
          justifyContent:"space-between",alignItems:"center",
          color:value?T.text:T.textL,fontFamily:T.sans,fontSize:14,outline:"none"}}>
        <span>{value||placeholder}</span>
        <span style={{color:T.textL,fontSize:9,fontFamily:T.mono,transition:"transform 0.15s",
          display:"inline-block",transform:open?"rotate(180deg)":"none"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:300,
          background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,
          boxShadow:"0 8px 32px rgba(30,42,58,0.14)",overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:T.textL,fontSize:13,fontFamily:T.sans}}>No saved options yet</div>}
            {options.map(opt=>{
              const sel=opt===value;
              return(<div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,fontFamily:T.sans,
                  color:sel?T.blue:T.text,fontWeight:sel?500:400,
                  background:sel?T.blueL:"transparent",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=T.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:14,color:T.blue,fontSize:11}}>{sel?"✓":""}</span>{opt}
              </div>);
            })}
          </div>
          <div style={{borderTop:`1px solid ${T.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)}
                  style={{padding:"10px 16px",cursor:"pointer",fontSize:12,color:T.blue,fontFamily:T.mono,
                    display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.blueL}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  ＋ Add new option
                </div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}}
                  placeholder={addPlaceholder}
                  style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1.5px solid ${T.blue}`,
                    fontSize:13,fontFamily:T.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:T.blue,color:"#fff",border:"none",borderRadius:7,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:T.mono}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:T.bg,color:T.textM,border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 9px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ notes, onSelectDate, selectedDate }) {
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
  return (
    <div style={{...card,overflow:"hidden",maxWidth:300,borderRadius:10}}>
      {/* Header */}
      <div style={{background:T.navy,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={prev} style={{background:"rgba(255,255,255,0.09)",border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",color:"rgba(255,255,255,0.65)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <span style={{color:"#fff",fontSize:12,fontWeight:500,fontFamily:T.mono}}>{MONTHS[calMonth]} {calYear}</span>
        <button onClick={next} style={{background:"rgba(255,255,255,0.09)",border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",color:"rgba(255,255,255,0.65)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>
      {/* Day labels */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"5px 6px 1px",background:T.bg}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:9,fontFamily:T.mono,padding:"1px 0",
            color:i===0?T.red:T.textL,fontWeight:i===0?500:400}}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"2px 6px 6px",gap:2,background:T.surface}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const dk=toDateKey(calYear,calMonth,day);
          const dow=new Date(calYear,calMonth,day).getDay();
          const isToday=dk===tk, isSel=dk===selectedDate;
          const isSunday=dow===0;
          const allowed=isDateAllowed(dk);
          const count=(notes[dk]||[]).length;
          return (
            <div key={dk} onClick={()=>allowed&&onSelectDate(dk)}
              style={{position:"relative",aspectRatio:"1",display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",borderRadius:5,
                cursor:allowed?"pointer":"default",transition:"background 0.1s",
                background:isSel?T.blue:isToday?T.blueL:"transparent",
                opacity:allowed?1:0.3}}
              onMouseEnter={e=>{if(allowed&&!isSel)e.currentTarget.style.background=T.blueL;}}
              onMouseLeave={e=>{if(allowed&&!isSel)e.currentTarget.style.background=isToday?T.blueL:"transparent";}}>
              <span style={{fontSize:11,fontWeight:isToday||isSel?600:400,lineHeight:1,fontFamily:T.sans,
                color:isSel?"#fff":isToday?T.blue:isSunday?T.red:T.textS}}>{day}</span>
              {count>0&&allowed&&(
                <div style={{position:"absolute",bottom:2,display:"flex",gap:1}}>
                  {count<=3
                    ?Array.from({length:count}).map((_,di)=><div key={di} style={{width:3,height:3,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":T.blue}}/>)
                    :<div style={{fontSize:6,fontFamily:T.mono,color:isSel?"rgba(255,255,255,0.9)":T.blue,fontWeight:600}}>{count}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{padding:"3px 8px 5px",display:"flex",gap:10,background:T.bg,borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:3}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:T.red,opacity:0.7}}/>
          <span style={{fontSize:8,color:T.textL,fontFamily:T.mono}}>sunday</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:3}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:T.blue}}/>
          <span style={{fontSize:8,color:T.textL,fontFamily:T.mono}}>entries</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:3}}>
          <span style={{fontSize:8,color:T.textL,fontFamily:T.mono,opacity:0.5}}>dimmed = outside ±7 days</span>
        </div>
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

  const inpC = {...inp, fontFamily:T.sans, background:T.surface, border:`1px solid ${T.border}`, color:T.text, borderRadius:9, fontSize:14};

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:14,right:18,borderRadius:20,padding:"5px 14px",fontSize:10,
      fontFamily:T.mono,zIndex:999,letterSpacing:0.5,
      background:saveErr?"#FEE2E2":T.navy,color:saveErr?"#991B1B":"rgba(255,255,255,0.9)",
      boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
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

  // ── HOME ──────────────────────────────────────────────────────────────────
  if(view==="home") return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.sans}}>
      <SaveBadge/>
      <div style={{background:T.navy,padding:"16px 24px 18px"}}>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:3,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:3}}>Academic Planner</div>
            <div style={{fontSize:22,fontWeight:600,color:"#fff",letterSpacing:-0.4}}>My Classes</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:3,fontFamily:T.mono}}>
              {data.classes.length} {data.classes.length===1?"class":"classes"} · {totalNotes} entries
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <Avatar user={user} size={36}/>
            <button onClick={logout} style={{background:"none",border:"none",fontSize:10,color:"rgba(255,255,255,0.3)",cursor:"pointer",fontFamily:T.mono,padding:0}}>sign out</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"20px 20px 40px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {data.classes.length===0&&(
            <div style={{...card,textAlign:"center",padding:"48px 20px"}}>
              <div style={{fontSize:38,marginBottom:10}}>📚</div>
              <div style={{fontSize:14,color:T.textM,fontFamily:T.sans}}>No classes yet. Add your first one below.</div>
            </div>
          )}
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const cn=data.notes[cls.id]||{};
            const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
            return(
              <div key={cls.id} style={{...card,display:"flex",alignItems:"center",overflow:"hidden"}}>
                <div style={{width:5,alignSelf:"stretch",background:color.bg,flexShrink:0}}/>
                <div onClick={()=>{setActiveClass(cls);setView("class");setSelectedDate(todayKey());setSearch("");}}
                  data-ripple-dark="true"
                  style={{flex:1,display:"flex",alignItems:"center",gap:12,padding:"13px 14px",cursor:"pointer",minWidth:0,position:"relative",overflow:"hidden"}}
                  onPointerDown={rpl}>
                  <div style={{width:40,height:40,borderRadius:10,background:T.blueL,flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:13,fontWeight:600,color:T.blue,fontFamily:T.mono,letterSpacing:-1}}>
                    {(cls.section||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:14,color:T.text,marginBottom:2}}>{cls.section}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:T.textM}}>🏫 {cls.institute}</span>
                      {cls.subject&&<span style={{fontSize:11,color:T.textL}}>· {cls.subject}</span>}
                      {cls.teacher&&<span style={{fontSize:11,color:T.textL}}>· {cls.teacher}</span>}
                    </div>
                  </div>
                  <div style={{background:T.blueL,color:T.blue,borderRadius:20,padding:"3px 11px",
                    fontSize:10,fontFamily:T.mono,fontWeight:500,flexShrink:0,whiteSpace:"nowrap"}}>
                    {count} {count===1?"entry":"entries"}
                  </div>
                </div>
                <button
                  onClick={()=>{if(window.confirm(`Delete "${cls.section} · ${cls.institute}"?\nAll entries will be lost.`))deleteClass(cls.id);}}
                  style={{padding:"0 16px",alignSelf:"stretch",background:"none",border:"none",
                    borderLeft:`1px solid ${T.border}`,cursor:"pointer",color:T.textL,fontSize:14,flexShrink:0,transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.redL;e.currentTarget.style.color=T.red;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textL;}}>
                  🗑
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Class */}
        <div style={{...card,overflow:"hidden"}}>
          <div style={{padding:"11px 18px",borderBottom:`1px solid ${T.border}`,background:T.bg,
            display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:3,height:14,borderRadius:2,background:T.blue}}/>
            <span style={{fontSize:11,fontWeight:500,color:T.textM,fontFamily:T.mono,letterSpacing:0.5}}>Add a new class</span>
          </div>
          <div style={{padding:"18px 18px 20px"}}>
            <label style={label}>Institute</label>
            <CreatableDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. Genesis Karnal, KIS, GIS" addPlaceholder="Type institute name…"/>
            <label style={{...label,marginTop:8}}>Class / Section</label>
            <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
            <label style={{...label,marginTop:8}}>Subject</label>
            <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
            <label style={{...label,marginTop:8}}>Teacher name</label>
            <input value={newClass.teacher} onChange={e=>setNewClass(c=>({...c,teacher:e.target.value}))} placeholder="e.g. Mr. Johnson" style={inpC}/>
            <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()}
              onPointerDown={rpl}
              style={{marginTop:10,background:(newClass.institute.trim()&&newClass.section.trim())?T.navy:"#D1D9E0",
                color:"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:12,
                cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",
                fontFamily:T.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden",
                transition:"background 0.15s"}}>
              Add Class
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── CLASS VIEW ────────────────────────────────────────────────────────────
  if(view==="class"&&activeClass){
    const classNotes=getClassNotes(activeClass.id);
    const dateNotes=getDateNotes(activeClass.id,selectedDate);
    const filtered=dateNotes.filter(n=>!search||n.title.toLowerCase().includes(search.toLowerCase())||n.body.toLowerCase().includes(search.toLowerCase()));
    const allDates=Object.keys(classNotes).filter(dk=>classNotes[dk]&&classNotes[dk].length>0).sort((a,b)=>b.localeCompare(a));
    const totalEntries=Object.values(classNotes).reduce((s,arr)=>s+arr.length,0);
    const initials=(activeClass.section||"?").slice(0,2).toUpperCase();
    const canAddEntry=isDateAllowed(selectedDate);

    return(
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.sans}}>
        <SaveBadge/>
        {/* Header */}
        <div style={{background:T.navy,paddingBottom:1}}>
          <div style={{maxWidth:1140,margin:"0 auto",padding:"14px 24px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <button onClick={()=>setView("home")} style={navBtn} onPointerDown={rpl}>← Back</button>
              <button onClick={()=>{if(window.confirm(`Delete "${activeClass.section}"?\nAll entries will be lost.`))deleteClass(activeClass.id);}}
                style={{background:"none",border:"none",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.22)",fontFamily:T.mono,padding:"4px 8px",borderRadius:6,transition:"color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.color="rgba(239,68,68,0.8)"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.22)"}>
                Delete class
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:50,height:50,borderRadius:13,background:T.blue,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:16,fontWeight:600,color:"#fff",fontFamily:T.mono,letterSpacing:-1}}>
                {initials}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:22,color:"#fff",letterSpacing:-0.4,lineHeight:1.1}}>{activeClass.section}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:5}}>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>🏫 {activeClass.institute}</span>
                  {activeClass.subject&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>· {activeClass.subject}</span>}
                  {activeClass.teacher&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>· 👤 {activeClass.teacher}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                {[{n:totalEntries,l:"entries"},{n:allDates.length,l:"days"}].map(({n,l})=>(
                  <div key={l} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:10,padding:"6px 14px",textAlign:"center"}}>
                    <div style={{fontSize:17,fontWeight:600,color:"#fff",fontFamily:T.sans}}>{n}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",fontFamily:T.mono,letterSpacing:1}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{maxWidth:1140,margin:"0 auto",padding:"18px 24px",display:"flex",gap:16,alignItems:"flex-start"}}>

          {/* LEFT — Switcher */}
          <div style={{width:160,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:2,color:T.textL,marginBottom:9,textTransform:"uppercase"}}>My Classes</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {data.classes.map(cls=>{
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    data-ripple-dark="true" onPointerDown={rpl}
                    style={{padding:"9px 11px",borderRadius:9,cursor:"pointer",transition:"all 0.12s",
                      position:"relative",overflow:"hidden",
                      background:isActive?T.blueL:T.surface,
                      borderLeft:`3px solid ${isActive?T.blue:T.border}`,
                      border:`1px solid ${isActive?"rgba(61,127,212,0.2)":T.border}`}}>
                    <div style={{fontSize:12,fontWeight:isActive?500:400,color:isActive?T.blue:T.textS,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{fontSize:9,color:T.textL,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",
                      textOverflow:"ellipsis",fontFamily:T.mono}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — Calendar + Entries */}
          <div style={{flex:1,minWidth:0}}>
            <Calendar notes={classNotes} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>

            <div style={{marginTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:500,color:T.text}}>{formatDateLabel(selectedDate)}</div>
                  <div style={{fontSize:10,color:T.textL,fontFamily:T.mono,marginTop:2}}>
                    {dateNotes.length} {dateNotes.length===1?"entry":"entries"}
                  </div>
                </div>
                {canAddEntry
                  ?<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}}
                      onPointerDown={rpl}
                      style={{background:T.blue,color:"#fff",border:"none",borderRadius:9,
                        padding:"9px 18px",fontSize:11,cursor:"pointer",fontFamily:T.mono,
                        fontWeight:500,letterSpacing:0.5,boxShadow:"0 2px 10px rgba(61,127,212,0.35)",
                        position:"relative",overflow:"hidden"}}>
                      + Add Entry
                    </button>
                  :<div style={{fontSize:10,color:T.textL,fontFamily:T.mono,background:T.bg,
                      border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                      Outside ±7 day window
                    </div>
                }
              </div>

              {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inpC,marginBottom:12}}/>}

              {filtered.length===0&&(
                <div style={{...card,textAlign:"center",padding:"36px 20px"}}>
                  <div style={{width:40,height:40,borderRadius:11,background:T.blueL,margin:"0 auto 10px",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✏️</div>
                  <div style={{fontSize:13,color:T.textM}}>
                    {search?"No matching entries."
                      :canAddEntry?'Tap "+ Add Entry" to start.'
                      :"No entries for this date."}
                  </div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {filtered.map(note=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id} style={{...card,overflow:"hidden",transition:"box-shadow 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(30,42,58,0.09)"}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow=card.boxShadow}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"11px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:note.title?4:0}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:9,borderRadius:20,
                                padding:"2px 8px",fontFamily:T.mono,fontWeight:500}}>{tag.label}</span>
                              {note.timeStart&&<span style={{fontSize:9,color:T.textL,fontFamily:T.mono,
                                background:T.bg,borderRadius:10,padding:"2px 7px",border:`1px solid ${T.border}`}}>
                                🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            </div>
                            {note.title&&<div style={{fontWeight:500,fontSize:13,color:T.text}}>{note.title}</div>}
                          </div>
                          <div style={{display:"flex",gap:5,flexShrink:0}}>
                            <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                              style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,
                                padding:"4px 10px",fontSize:10,cursor:"pointer",color:T.textM,
                                fontFamily:T.mono,transition:"all 0.12s"}}
                              onMouseEnter={e=>{e.currentTarget.style.background=T.blueL;e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.color=T.blue;}}
                              onMouseLeave={e=>{e.currentTarget.style.background=T.bg;e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textM;}}>
                              Edit
                            </button>
                            <button onClick={()=>deleteNote(note.id)}
                              style={{background:T.redL,border:"1px solid #FEE2E2",borderRadius:7,
                                padding:"4px 10px",fontSize:10,cursor:"pointer",color:T.red,fontFamily:T.mono}}>✕</button>
                          </div>
                        </div>
                        {note.body&&<p style={{margin:"8px 0 0",fontSize:12,color:T.textM,lineHeight:1.65,
                          whiteSpace:"pre-wrap",borderTop:`1px solid ${T.border}`,paddingTop:8}}>{note.body}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — Timeline */}
          <div style={{width:182,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:T.mono,letterSpacing:2,color:T.textL,marginBottom:10,textTransform:"uppercase"}}>Past Entries</div>
            {allDates.length===0
              ?<div style={{fontSize:11,color:T.textL,fontStyle:"italic",fontFamily:T.sans}}>No entries yet.</div>
              :<div style={{display:"flex",flexDirection:"column"}}>
                {allDates.map((dk,i)=>{
                  const entries=classNotes[dk]||[];
                  const isSel=dk===selectedDate;
                  return(
                    <div key={dk} onClick={()=>setSelectedDate(dk)}
                      data-ripple-dark="true" onPointerDown={rpl}
                      style={{cursor:"pointer",display:"flex",gap:9,paddingBottom:13,
                        position:"relative",overflow:"hidden",borderRadius:6,padding:"2px 4px 13px 0"}}>
                      {i<allDates.length-1&&<div style={{position:"absolute",left:4,top:13,bottom:0,width:1,background:T.border}}/>}
                      <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,marginTop:3,zIndex:1,
                        transition:"all 0.15s",background:isSel?T.blue:T.surface,
                        border:`2px solid ${isSel?T.blue:T.borderM}`,
                        boxShadow:isSel?`0 0 0 3px rgba(61,127,212,0.15)`:"none"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,fontWeight:isSel?500:400,color:isSel?T.blue:T.textM,fontFamily:T.mono}}>{formatDateLabel(dk)}</div>
                        <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:2}}>
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
            }
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
        <div style={{background:T.navy,padding:"14px 24px 16px"}}>
          <div style={{maxWidth:660,margin:"0 auto"}}>
            <button onClick={()=>setView("class")} style={navBtn} onPointerDown={rpl}>← Back</button>
          </div>
        </div>
        <div style={{maxWidth:660,margin:"0 auto",padding:"26px 20px 40px"}}>
          <div style={{fontSize:9,color:T.textL,fontFamily:T.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>
            {isEdit?"Editing Entry":"New Entry For"}
          </div>
          <h2 style={{margin:"0 0 20px",fontSize:20,fontWeight:500,color:T.text,letterSpacing:-0.3}}>
            {isEdit?form.title||"Entry":formatDateLabel(selectedDate)}
          </h2>

          {/* Tag picker */}
          <div style={{marginBottom:4}}>
            <label style={label}>Type</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(TAG_STYLES).map(([key,val])=>(
                <button key={key} onClick={()=>setForm({...form,tag:key})}
                  style={{background:form.tag===key?val.bg:T.surface,color:form.tag===key?val.text:T.textL,
                    border:`1px solid ${form.tag===key?val.bg:T.border}`,borderRadius:20,
                    padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:T.mono,
                    fontWeight:form.tag===key?500:400,transition:"all 0.12s"}}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div style={{marginTop:16,marginBottom:4}}>
            <label style={label}>Class Time (optional)</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inpC,marginBottom:0,flex:1}}/>
              {form.timeStart&&<>
                <span style={{color:T.textL,fontSize:13,flexShrink:0}}>to</span>
                <input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inpC,marginBottom:0,flex:1}}/>
              </>}
            </div>
          </div>

          <div style={{marginTop:14}}>
            <label style={label}>Title</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inpC,fontSize:15,fontWeight:500}}/>
          </div>
          <div style={{marginTop:4}}>
            <label style={label}>Notes</label>
            <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}
              placeholder="Write your notes, tasks, or resources here…" rows={7}
              style={{...inpC,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
          </div>

          <button onClick={save} onPointerDown={rpl}
            style={{marginTop:18,background:T.navy,color:"#fff",border:"none",borderRadius:9,
              padding:"12px 28px",fontSize:12,cursor:"pointer",fontFamily:T.mono,
              letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden",
              boxShadow:"0 2px 10px rgba(30,42,58,0.2)",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=T.navyS}
            onMouseLeave={e=>e.currentTarget.style.background=T.navy}>
            {isEdit?"Save Changes":"Save Entry"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
