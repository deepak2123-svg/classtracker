import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { TAG_STYLES, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

const G = {
  forest: "#1A3328", forestS: "#243D30",
  green:  "#16A34A", greenV: "#4ADE80", greenL: "#DCFCE7", greenM: "#86EFAC",
  bg:     "#F5F6F8", surface: "#FFFFFF",
  border: "#E4E9EE", borderM: "#C8D4D0",
  text:   "#111827", textS: "#374151", textM: "#6B7280", textL: "#9CA3AF",
  red: "#DC2626", redL: "#FEF2F2",
  navy: "#111827",
  mono: "'JetBrains Mono', monospace",
  sans: "'Outfit', sans-serif",
  display: "'Syne', sans-serif",
};

const COLORS = [
  { bg:"#16A34A", light:"#DCFCE7", text:"#14532D" },
  { bg:"#0891B2", light:"#CFFAFE", text:"#164E63" },
  { bg:"#D97706", light:"#FEF3C7", text:"#78350F" },
  { bg:"#7C3AED", light:"#EDE9FE", text:"#4C1D95" },
  { bg:"#DC2626", light:"#FEE2E2", text:"#7F1D1D" },
  { bg:"#059669", light:"#D1FAE5", text:"#064E3B" },
  { bg:"#DB2777", light:"#FCE7F3", text:"#831843" },
  { bg:"#2563EB", light:"#DBEAFE", text:"#1E3A8A" },
];

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[], institutes:[], sections:[], profile:{name:""} };

function buildDateWindow() {
  const now = new Date();
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
    days.push({ key:`${y}-${m}-${day}`, num:d.getDate(), dayName:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()], month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()], year:d.getFullYear(), offset:i });
  }
  return days;
}
function isDateAllowed(dk) { return buildDateWindow().some(d=>d.key===dk); }

function rpl(e, light=false) {
  const el=e.currentTarget, rect=el.getBoundingClientRect();
  const s=Math.max(rect.width,rect.height)*2.5;
  const x=(e.clientX||rect.left+rect.width/2)-rect.left-s/2;
  const y=(e.clientY||rect.top+rect.height/2)-rect.top-s/2;
  const w=document.createElement("span");
  w.className="rw"+(light?" white":" dark");
  w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.overflow="hidden"; el.appendChild(w); w.addEventListener("animationend",()=>w.remove());
}

const lbl  = { fontSize:11, color:G.textL, fontFamily:G.mono, letterSpacing:0.5, display:"block", marginBottom:5, textTransform:"uppercase" };
const inpS = { width:"100%", padding:"10px 13px", borderRadius:8, border:`1px solid ${G.border}`, fontSize:14, fontFamily:G.sans, outline:"none", background:G.surface, color:G.text, marginBottom:10 };

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({ value, onChange, options, onAddOption, placeholder, addPlaceholder }) {
  const [open,setOpen]=useState(false); const [adding,setAdding]=useState(false); const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null); const wrapRef=useRef(null);
  useEffect(()=>{ if(adding&&inputRef.current) inputRef.current.focus(); },[adding]);
  useEffect(()=>{ const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");} }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  const confirmAdd=()=>{ const t=newVal.trim(); if(!t) return; if(!options.includes(t)) onAddOption(t); onChange(t); setNewVal(""); setAdding(false); setOpen(false); };
  return (
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{...inpS,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:9,fontFamily:G.mono,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:10,border:`1px solid ${G.border}`,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:G.textL,fontSize:13}}>No saved options yet</div>}
            {options.map(opt=>{ const sel=opt===value; return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,color:sel?G.green:G.text,fontWeight:sel?500:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:14,color:G.green,fontSize:11}}>{sel?"✓":""}</span>{opt}
              </div>); })}
          </div>
          <div style={{borderTop:`1px solid ${G.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)} style={{padding:"10px 16px",cursor:"pointer",fontSize:12,color:G.green,fontFamily:G.mono,display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=G.greenL} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}} placeholder={addPlaceholder} style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1.5px solid ${G.green}`,fontSize:13,fontFamily:G.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:G.green,color:"#fff",border:"none",borderRadius:7,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:G.mono}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:G.bg,color:G.textM,border:`1px solid ${G.border}`,borderRadius:7,padding:"7px 9px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Flat Date Strip ───────────────────────────────────────────────────────────
function DateStrip({ selectedDate, onSelectDate, noteDates=new Set() }) {
  const dates = buildDateWindow();
  const stripRef = useRef(null);

  // scroll selected into view on mount
  useEffect(()=>{
    const strip = stripRef.current; if(!strip) return;
    const selIdx = dates.findIndex(d=>d.key===selectedDate);
    const itemW = 72;
    strip.scrollLeft = selIdx * (itemW+8) - strip.clientWidth/2 + itemW/2;
  },[selectedDate]);

  return (
    <div style={{background:G.surface, borderRadius:14, border:`1px solid ${G.border}`, padding:"6px 0", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div ref={stripRef} style={{display:"flex",gap:6,overflowX:"auto",padding:"6px 16px",scrollBehavior:"smooth",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}
        onMouseDown={e=>{ const el=e.currentTarget; let isDown=true, startX=e.pageX-el.offsetLeft, sl=el.scrollLeft; const mm=mv=>{ if(!isDown) return; el.scrollLeft=sl-(mv.pageX-el.offsetLeft-startX)*1.2; }; const mu=()=>{ isDown=false; document.removeEventListener("mousemove",mm); document.removeEventListener("mouseup",mu); }; document.addEventListener("mousemove",mm); document.addEventListener("mouseup",mu); }}>
        {dates.map(d=>{
          const isSel = d.key===selectedDate;
          const isSun = d.dayName==="SUN";
          const hasEntries = noteDates.has(d.key);
          return (
            <div key={d.key} onClick={()=>onSelectDate(d.key)}
              style={{flexShrink:0,width:68,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0 6px",borderRadius:10,cursor:"pointer",transition:"all 0.15s",position:"relative",
                background:isSel?G.forest:"transparent"}}>
              <div style={{fontSize:10,fontWeight:500,fontFamily:G.mono,letterSpacing:0.5,marginBottom:5,
                color:isSel?"rgba(255,255,255,0.6)":isSun?G.red:G.textM}}>
                {d.dayName}
              </div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:G.display,lineHeight:1,
                color:isSel?"#fff":G.text}}>
                {d.num}
              </div>
              {isSel&&<div style={{fontSize:7,fontFamily:G.mono,letterSpacing:1,color:"rgba(255,255,255,0.6)",marginTop:4,textTransform:"uppercase"}}>Today</div>}
              {hasEntries&&!isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:G.green,marginTop:4}}/>}
              {!hasEntries&&!isSel&&<div style={{height:8}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Profile Setup ─────────────────────────────────────────────────────────────
function ProfileSetup({ user, onSave }) {
  const [name, setName] = useState(user.displayName||"");
  return (
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:20,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🌿</div>
          <div style={{fontSize:24,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:6}}>Welcome to ClassLog</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",fontFamily:G.mono,lineHeight:1.6}}>Your name is attached to every entry.<br/>Set it once — it can't be changed by anyone else.</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:14,padding:"24px 22px",border:"1px solid rgba(255,255,255,0.1)"}}>
          <label style={{...lbl,color:"rgba(255,255,255,0.35)"}}>Your full name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} placeholder="e.g. Ramsingh Yadav" autoFocus
            style={{...inpS,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:16}}/>
          <button onClick={()=>name.trim()&&onSave(name.trim())} disabled={!name.trim()} onPointerDown={e=>rpl(e,true)}
            style={{width:"100%",padding:"12px",background:name.trim()?G.greenV:"rgba(255,255,255,0.1)",color:name.trim()?G.forest:"rgba(255,255,255,0.3)",border:"none",borderRadius:9,fontSize:13,fontFamily:G.mono,letterSpacing:1,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",position:"relative",overflow:"hidden"}}>
            Let's Go →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClassTracker({ user }) {
  const [data,setData]       = useState(DEFAULT_DATA);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState(false);
  const [saveErr,setSaveErr] = useState(false);
  const [view,setView]       = useState("kanban");
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [targetClassId,setTargetClassId] = useState(null);
  const [newNote,setNewNote] = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});
  const [editNote,setEditNote] = useState(null);
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:""});
  const noteRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(()=>{ loadUserData(user.uid).then(d=>{ if(d) setData({...DEFAULT_DATA,...d,profile:d.profile||{name:""}}); setLoading(false); }); },[user.uid]);
  useEffect(()=>{
    if(loading) return;
    setSaving(true); setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{ saveUserData(user.uid,data).then(()=>setSaving(false)).catch(()=>{setSaving(false);setSaveErr(true);}); },1000);
    return ()=>clearTimeout(saveTimer.current);
  },[data]);
  useEffect(()=>{ if((view==="addNote"||view==="editNote")&&noteRef.current) noteRef.current.focus(); },[view]);

  if(loading) return <Spinner text="Loading…"/>;
  if(!data.profile?.name) return <ProfileSetup user={user} onSave={name=>setData(d=>({...d,profile:{name}}))} />;

  const teacherName = data.profile.name;
  const dates = buildDateWindow();
  const selDateObj = dates.find(d=>d.key===selectedDate)||dates[7];

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:14,right:18,borderRadius:20,padding:"5px 14px",fontSize:10,fontFamily:G.mono,zIndex:999,background:saveErr?"#FEE2E2":G.navy,color:saveErr?"#991B1B":"rgba(255,255,255,0.9)",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
      {saveErr?"⚠ save failed":"saving…"}
    </div>
  ):null;

  const sortedByUsage=(opts,field)=>{ const c={}; (data.classes||[]).forEach(cl=>{ if(cl[field]) c[cl[field]]=(c[cl[field]]||0)+1; }); return [...(opts||[])].sort((a,b)=>(c[b]||0)-(c[a]||0)); };
  const addSubjectName  =(s)=>setData(d=>({...d,subjects:[...(d.subjects||[]),s]}));
  const addInstituteName=(s)=>setData(d=>({...d,institutes:[...(d.institutes||[]),s]}));
  const addSectionName  =(s)=>setData(d=>({...d,sections:[...(d.sections||[]),s]}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim()) return;
    const id=Date.now().toString();
    setData(d=>{ const inst=newClass.institute.trim(),sec=newClass.section.trim(),subj=newClass.subject.trim(); return {...d,classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,colorIdx:d.classes.length%COLORS.length,created:Date.now()}],notes:{...d.notes,[id]:{}},institutes:(d.institutes||[]).includes(inst)?d.institutes||[]:[...(d.institutes||[]),inst],sections:(d.sections||[]).includes(sec)?d.sections||[]:[...(d.sections||[]),sec],subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[]}; });
    setNewClass({institute:"",section:"",subject:""}); setView("kanban");
  };
  const deleteClass=(id)=>setData(d=>({...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id))}));
  const getDateNotes=(cid,dk)=>(data.notes[cid]||{})[dk]||[];
  const getAllNoteDates=()=>{ const s=new Set(); data.classes.forEach(cls=>Object.keys(data.notes[cls.id]||{}).forEach(dk=>{ if((data.notes[cls.id][dk]||[]).length>0) s.add(dk); })); return s; };
  const addNote=()=>{
    if(!newNote.title.trim()&&!newNote.body.trim()) return;
    const note={id:Date.now().toString(),...newNote,teacherName,created:Date.now()};
    setData(d=>{ const cn=d.notes[targetClassId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[targetClassId]:{...cn,[selectedDate]:[note,...dn]}}}; });
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""}); setView("kanban");
  };
  const saveEdit=()=>{
    setData(d=>{ const cn=d.notes[targetClassId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[targetClassId]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}}; });
    setEditNote(null); setView("kanban");
  };
  const deleteNote=(classId,noteId)=>setData(d=>{ const cn=d.notes[classId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[classId]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}}}; });
  const canAdd = isDateAllowed(selectedDate);

  // ── KANBAN ────────────────────────────────────────────────────────────────
  if(view==="kanban") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <SaveBadge/>

      {/* Top nav */}
      <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 28px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",height:58,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎓</div>
            <span style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>ClassLog</span>
          </div>
          {/* Right */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>{data.classes.length} {data.classes.length===1?"class":"classes"}</span>
            <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
              style={{background:G.green,color:"#fff",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6,position:"relative",overflow:"hidden"}}>
              <span style={{fontSize:16,lineHeight:1}}>+</span> Add Class
            </button>
            <button onClick={()=>setView("profile")}
              style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
              <Avatar user={user} size={22}/>
              <span>{teacherName.split(" ")[0]}</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 28px 48px"}}>

        {/* Month label + Date strip */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16,color:G.green}}>📅</span>
            <span style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{selDateObj.month} {selDateObj.year}</span>
          </div>
        </div>
        <div style={{marginBottom:28}}>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={getAllNoteDates()}/>
        </div>

        {/* Section heading */}
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,margin:0}}>{selectedDate===todayKey()?"Today's Classes":formatDateLabel(selectedDate)}</h2>
          {!canAdd&&<div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginTop:4}}>Outside ±7 day window — entries cannot be added</div>}
        </div>

        {/* Class cards grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const dateNotes=getDateNotes(cls.id,selectedDate);
            const totalEntries=Object.values(data.notes[cls.id]||{}).reduce((s,arr)=>s+arr.length,0);
            return(
              <div key={cls.id} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",transition:"box-shadow 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.09)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"}>

                {/* Card header */}
                <div style={{padding:"16px 16px 12px",borderBottom:`1px solid ${G.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,borderRadius:11,background:color.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1,flexShrink:0}}>
                        {totalEntries}
                      </div>
                      <div>
                        <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.1}}>{cls.section}</div>
                        <div style={{fontSize:11,color:G.textM,marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:10}}>□</span>
                          {cls.subject&&`${cls.subject} • `}{cls.institute}
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>{if(window.confirm(`Delete "${cls.section}"?\nAll ${totalEntries} entries will be lost.`))deleteClass(cls.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:G.textL,fontSize:14,padding:"4px 6px",borderRadius:6,transition:"all 0.12s",flexShrink:0}}
                      onMouseEnter={e=>{e.currentTarget.style.background=G.redL;e.currentTarget.style.color=G.red;}}
                      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=G.textL;}}>🗑</button>
                  </div>
                </div>

                {/* Entry count + status */}
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,marginBottom:2}}>ENTRIES</div>
                      <div style={{fontSize:28,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1}}>{dateNotes.length}</div>
                    </div>
                    <div style={{background:G.greenL,color:G.green,borderRadius:20,padding:"4px 12px",fontSize:11,fontFamily:G.mono,fontWeight:600}}>
                      {canAdd?"Active":"Read-only"}
                    </div>
                  </div>

                  {/* Existing entries for this date */}
                  {dateNotes.length>0&&(
                    <div style={{marginBottom:10,display:"flex",flexDirection:"column",gap:5}}>
                      {dateNotes.map(note=>{
                        const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                        return(
                          <div key={note.id} style={{background:G.bg,borderRadius:8,padding:"7px 10px",border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",gap:4,marginBottom:note.title?3:0,flexWrap:"wrap"}}>
                                <span style={{background:tag.bg,color:tag.text,fontSize:8,borderRadius:10,padding:"1px 6px",fontFamily:G.mono,fontWeight:500}}>{tag.label}</span>
                                {note.timeStart&&<span style={{fontSize:8,color:G.textL,fontFamily:G.mono}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                              </div>
                              {note.title&&<div style={{fontSize:12,fontWeight:600,color:G.text}}>{note.title}</div>}
                              {note.body&&<div style={{fontSize:11,color:G.textM,marginTop:2,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.body}</div>}
                            </div>
                            <div style={{display:"flex",gap:3,flexShrink:0}}>
                              <button onClick={()=>{setTargetClassId(cls.id);setEditNote({...note});setView("editNote");}}
                                style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:5,padding:"2px 7px",fontSize:9,cursor:"pointer",color:G.textM,fontFamily:G.mono,transition:"all 0.1s"}}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
                                onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>Edit</button>
                              <button onClick={()=>deleteNote(cls.id,note.id)} style={{background:G.redL,border:"1px solid #FEE2E2",borderRadius:5,padding:"2px 7px",fontSize:9,cursor:"pointer",color:G.red,fontFamily:G.mono}}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Entry button */}
                  <button
                    onClick={()=>{ if(!canAdd) return; setTargetClassId(cls.id); setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""}); setView("addNote"); }}
                    onPointerDown={e=>canAdd&&rpl(e,true)}
                    style={{width:"100%",padding:"11px 0",background:canAdd?G.navy:"#D1D9E0",color:canAdd?"#fff":"#9CA3AF",border:"none",borderRadius:9,fontSize:13,cursor:canAdd?"pointer":"not-allowed",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,position:"relative",overflow:"hidden"}}>
                    <span style={{fontSize:18,lineHeight:1}}>+</span> Add Entry
                  </button>
                </div>
              </div>
            );
          })}

          {/* Ghost add class card */}
          <div onClick={()=>setView("addClass")}
            style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,overflow:"hidden",minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:10,padding:24,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background=G.surface;}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:G.bg,border:`2px dashed ${G.borderM}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:G.textL}}>+</div>
            <div style={{fontSize:15,fontWeight:600,color:G.textM,fontFamily:G.display}}>Add New Class</div>
            <div style={{fontSize:12,color:G.textL,textAlign:"center"}}>Manage another subject or section</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ADD CLASS ──────────────────────────────────────────────────────────────
  if(view==="addClass") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 28px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",height:58,display:"flex",alignItems:"center",gap:16}}>
          <button onClick={()=>setView("kanban")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>← Back</button>
          <span style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>Add a Class</span>
        </div>
      </div>
      <div style={{maxWidth:520,margin:"0 auto",padding:"32px 20px 48px"}}>
        <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{background:G.greenL,borderRadius:9,padding:"10px 14px",marginBottom:20,fontSize:12,color:G.green,fontFamily:G.mono}}>
            👤 Teacher: <strong>{teacherName}</strong> — auto-attached to all entries
          </div>
          <label style={lbl}>Institute</label>
          <CreatableDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. Genesis Karnal, KIS, GIS" addPlaceholder="Type institute name…"/>
          <label style={{...lbl,marginTop:8}}>Class / Section</label>
          <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
          <label style={{...lbl,marginTop:8}}>Subject</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
          <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()}
            onPointerDown={e=>rpl(e,true)}
            style={{marginTop:10,width:"100%",padding:"12px",background:(newClass.institute.trim()&&newClass.section.trim())?G.navy:"#D1D9E0",color:(newClass.institute.trim()&&newClass.section.trim())?"#fff":"#9CA3AF",border:"none",borderRadius:9,fontSize:13,cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
            Add Class
          </button>
        </div>
      </div>
    </div>
  );

  // ── PROFILE ────────────────────────────────────────────────────────────────
  if(view==="profile") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 28px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",height:58,display:"flex",alignItems:"center",gap:16}}>
          <button onClick={()=>setView("kanban")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>← Back</button>
          <span style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>Profile</span>
        </div>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"32px 20px 48px"}}>
        <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,padding:"14px",background:G.bg,borderRadius:10,border:`1px solid ${G.border}`}}>
            <Avatar user={user} size={46}/>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{teacherName}</div>
              <div style={{fontSize:12,color:G.textL,marginTop:2}}>{user.email}</div>
            </div>
          </div>
          <label style={lbl}>Update your name</label>
          <input defaultValue={teacherName} id="pname" placeholder="Your full name" style={inpS}/>
          <button onClick={()=>{ const v=document.getElementById("pname").value.trim(); if(v) setData(d=>({...d,profile:{name:v}})); setView("kanban"); }}
            onPointerDown={e=>rpl(e,true)}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
            Save Name
          </button>
          <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${G.border}`}}>
            <button onClick={logout} style={{background:G.redL,border:"1px solid #FEE2E2",color:G.red,borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ADD / EDIT NOTE ───────────────────────────────────────────────────────
  if(view==="addNote"||view==="editNote"){
    const isEdit=view==="editNote";
    const form=isEdit?editNote:newNote;
    const setForm=isEdit?setEditNote:setNewNote;
    const save=isEdit?saveEdit:addNote;
    const targetClass=data.classes.find(c=>c.id===targetClassId);
    const color=targetClass?COLORS[targetClass.colorIdx%COLORS.length]:COLORS[0];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 28px"}}>
          <div style={{maxWidth:1280,margin:"0 auto",height:58,display:"flex",alignItems:"center",gap:16}}>
            <button onClick={()=>setView("kanban")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>← Back</button>
            {targetClass&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color.bg}}/>
              <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{targetClass.section}</span>
              <span style={{fontSize:12,color:G.textM}}>· {targetClass.institute}</span>
            </div>}
          </div>
        </div>

        {/* Date strip in white nav style */}
        {!isEdit&&(
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"12px 28px"}}>
            <div style={{maxWidth:900,margin:"0 auto"}}>
              <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={new Set()}/>
            </div>
          </div>
        )}

        <div style={{maxWidth:640,margin:"0 auto",padding:"28px 20px 48px"}}>
          <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{isEdit?"Editing Entry":"New Entry For"}</div>
          <h2 style={{margin:"0 0 20px",fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>

          <div style={{background:G.greenL,borderRadius:8,padding:"8px 12px",marginBottom:18,fontSize:12,color:G.green,fontFamily:G.mono}}>👤 Logged as: <strong>{teacherName}</strong></div>

          <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:"20px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Type</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(TAG_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,tag:key})}
                    style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textM,border:`1px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:form.tag===key?600:400,transition:"all 0.12s"}}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={lbl}>Class Time (optional)</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inpS,marginBottom:0,flex:1}}/>
                {form.timeStart&&<><span style={{color:G.textL,fontSize:13,flexShrink:0}}>to</span><input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inpS,marginBottom:0,flex:1}}/></>}
              </div>
            </div>

            <div style={{marginBottom:12}}><label style={lbl}>Title</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inpS,fontSize:15,fontWeight:500}}/></div>
            <div><label style={lbl}>Notes</label><textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={6} style={{...inpS,resize:"vertical",lineHeight:1.7,marginBottom:0}}/></div>

            <button onClick={save} onPointerDown={e=>rpl(e,true)}
              style={{marginTop:16,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"12px 28px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
              {isEdit?"Save Changes":"Save Entry"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
