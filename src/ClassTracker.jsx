import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { TAG_STYLES, inp, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

// ── Sage Green palette ────────────────────────────────────────────────────────
const G = {
  forest:  "#1A3328", forestS: "#243D30", forestD: "#112219",
  green:   "#16A34A", greenV:  "#4ADE80", greenL:  "#DCFCE7",
  bg:      "#F2F7F3", surface: "#FFFFFF",
  border:  "#C8DDD0", borderM: "#A0C0AC",
  text:    "#1A3328", textS:   "#374940", textM:   "#6A8A78", textL:   "#9AB4A0",
  red:     "#DC2626", redL:    "#FEF2F2",
  mono:    "'JetBrains Mono', monospace",
  sans:    "'Outfit', sans-serif",
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

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[], institutes:[], sections:[], profile:{ name:"" } };

// ── Date helpers ──────────────────────────────────────────────────────────────
function buildDateWindow() {
  const now = new Date();
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
    days.push({ key:`${y}-${m}-${day}`, num:d.getDate(), dayName:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()], offset:i });
  }
  return days;
}
function isDateAllowed(dk) { return buildDateWindow().some(d=>d.key===dk); }

// ── Ripple ────────────────────────────────────────────────────────────────────
function rpl(e, white=false) {
  const el=e.currentTarget, rect=el.getBoundingClientRect();
  const s=Math.max(rect.width,rect.height)*2.5;
  const x=(e.clientX||rect.left+rect.width/2)-rect.left-s/2;
  const y=(e.clientY||rect.top+rect.height/2)-rect.top-s/2;
  const w=document.createElement("span");
  w.className="rw"+(white?" white":" dark");
  w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.position=el.style.position||"relative"; el.style.overflow="hidden";
  el.appendChild(w); w.addEventListener("animationend",()=>w.remove());
}

const card = { background:G.surface, borderRadius:12, border:`1px solid ${G.border}`, boxShadow:"0 1px 4px rgba(26,51,40,0.06)" };
const lbl  = { fontSize:10, color:G.textL, fontFamily:G.mono, letterSpacing:1, display:"block", marginBottom:5, textTransform:"uppercase" };
const inpS = { width:"100%", padding:"10px 13px", borderRadius:9, border:`1px solid ${G.border}`, fontSize:14, fontFamily:G.sans, outline:"none", background:G.surface, color:G.text, marginBottom:10 };

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
  const confirmAdd=()=>{ const t=newVal.trim(); if(!t) return; if(!options.includes(t)) onAddOption(t); onChange(t); setNewVal(""); setAdding(false); setOpen(false); };
  return (
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{...inpS,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:9,fontFamily:G.mono,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:10,border:`1px solid ${G.border}`,boxShadow:"0 8px 32px rgba(26,51,40,0.14)",overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:G.textL,fontSize:13}}>No saved options yet</div>}
            {options.map(opt=>{ const sel=opt===value; return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,color:sel?G.green:G.text,fontWeight:sel?500:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
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

// ── Date Carousel ─────────────────────────────────────────────────────────────
function DateCarousel({ selectedDate, onSelectDate, noteDates=new Set() }) {
  const dates = buildDateWindow();
  const selIdx = dates.findIndex(d=>d.key===selectedDate);
  const centerIdx = selIdx >= 0 ? selIdx : 7;
  const scrollRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    const container = scrollRef.current;
    const item = itemRefs.current[centerIdx];
    if (container && item) {
      const containerWidth = container.offsetWidth;
      const itemLeft = item.offsetLeft;
      const itemWidth = item.offsetWidth;
      container.scrollLeft = itemLeft - containerWidth / 2 + itemWidth / 2;
    }
  }, [centerIdx]);

  return (
    <div className="date-carousel-wrap">
      <div className="date-carousel" ref={scrollRef}>
        {dates.map((d,i)=>{
          const dist=Math.min(Math.abs(i-centerIdx),7);
          const isSel=i===centerIdx;
          return (
            <div key={d.key} className="dc" data-dist={dist} onClick={()=>onSelectDate(d.key)} ref={el=>itemRefs.current[i]=el}>
              <div className="dn">{d.num}</div>
              {dist<=2&&<div className="dd">{d.dayName}</div>}
              {isSel&&<div className="dt">Today</div>}
              {noteDates.has(d.key)&&<div className="de"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Profile Setup Screen ──────────────────────────────────────────────────────
function ProfileSetup({ user, onSave }) {
  const [name, setName] = useState(user.displayName || "");
  const [saving, setSaving] = useState(false);
  return (
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:20,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🌿</div>
          <div style={{fontSize:24,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:6}}>Welcome to ClassLog</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",fontFamily:G.mono}}>Your name appears on every class entry.<br/>Set it once, never again.</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:14,padding:"24px 22px",border:"1px solid rgba(255,255,255,0.1)"}}>
          <label style={{...lbl,color:"rgba(255,255,255,0.4)"}}>Your full name</label>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())}
            placeholder="e.g. Ramsingh Yadav"
            autoFocus
            style={{...inpS,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:16}}/>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",fontFamily:G.mono,marginBottom:16,marginTop:-4}}>This identifies you across all entries — it cannot be spoofed by other teachers.</div>
          <button onClick={()=>name.trim()&&onSave(name.trim())} disabled={!name.trim()}
            onPointerDown={e=>rpl(e,true)}
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
  const [view,setView]       = useState("kanban"); // kanban | addClass | addNote | editNote | profile
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [targetClassId,setTargetClassId] = useState(null); // which class we're adding entry to
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

  // First-time: ask for name
  if(!data.profile?.name) {
    return <ProfileSetup user={user} onSave={name=>setData(d=>({...d,profile:{name}}))} />;
  }

  const teacherName = data.profile.name;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:14,right:18,borderRadius:20,padding:"5px 14px",fontSize:10,fontFamily:G.mono,zIndex:999,letterSpacing:0.5,background:saveErr?"#FEE2E2":G.forest,color:saveErr?"#991B1B":"rgba(255,255,255,0.9)",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
      {saveErr?"⚠ save failed":"saving…"}
    </div>
  ):null;

  const sortedByUsage=(options,field)=>{ const counts={}; (data.classes||[]).forEach(c=>{ if(c[field]) counts[c[field]]=(counts[c[field]]||0)+1; }); return [...(options||[])].sort((a,b)=>(counts[b]||0)-(counts[a]||0)); };
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
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));

  const addNote=()=>{
    if(!newNote.title.trim()&&!newNote.body.trim()) return;
    const note={id:Date.now().toString(),...newNote,teacherName,created:Date.now()};
    setData(d=>{ const cn=d.notes[targetClassId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[targetClassId]:{...cn,[selectedDate]:[note,...dn]}}}; });
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""}); setView("kanban");
  };
  const saveEdit=()=>{
    setData(d=>{ const cls=data.classes.find(c=>c.id===targetClassId); const cn=d.notes[targetClassId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[targetClassId]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}}; });
    setEditNote(null); setView("kanban");
  };
  const deleteNote=(classId,noteId)=>setData(d=>{ const cn=d.notes[classId]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[classId]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}}}; });

  const allNoteDates = data.classes.reduce((acc,cls)=>{ getAllNoteDates(cls.id).forEach(dk=>acc.add(dk)); return acc; }, new Set());
  const canAdd = isDateAllowed(selectedDate);

  // ── KANBAN VIEW ────────────────────────────────────────────────────────────
  if(view==="kanban") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <SaveBadge/>

      {/* Nav */}
      <div style={{background:G.forest}}>
        <div style={{maxWidth:"100%",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:G.display,letterSpacing:-0.3}}>ClassLog</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:G.mono}}>{data.classes.length} classes</div>
            <button onClick={()=>setView("addClass")}
              onPointerDown={e=>rpl(e,true)}
              style={{background:G.greenV,color:G.forest,border:"none",borderRadius:8,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:G.mono,fontWeight:700,letterSpacing:0.5,position:"relative",overflow:"hidden"}}>
              + Add Class
            </button>
            {/* Profile button */}
            <button onClick={()=>setView("profile")}
              style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 11px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontFamily:G.mono,display:"flex",alignItems:"center",gap:6}}>
              <Avatar user={user} size={20}/>
              <span>{teacherName.split(" ")[0]}</span>
            </button>
            <button onClick={logout} style={{background:"none",border:"none",fontSize:10,color:"rgba(255,255,255,0.25)",cursor:"pointer",fontFamily:G.mono}}>out</button>
          </div>
        </div>

        {/* Date Carousel */}
        <DateCarousel selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={allNoteDates}/>
      </div>

      {/* Date label */}
      <div style={{padding:"12px 24px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
        {!canAdd&&<div style={{fontSize:10,color:G.textL,fontFamily:G.mono,background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"4px 10px"}}>Outside ±7 day window</div>}
      </div>

      {/* Kanban columns */}
      {data.classes.length===0?(
        <div style={{padding:"48px 24px",textAlign:"center"}}>
          <div style={{...card,display:"inline-block",padding:"40px 48px"}}>
            <div style={{fontSize:38,marginBottom:10}}>📚</div>
            <div style={{fontSize:14,color:G.textM,marginBottom:16}}>No classes yet.</div>
            <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
              style={{background:G.green,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:12,cursor:"pointer",fontFamily:G.mono,letterSpacing:0.5,position:"relative",overflow:"hidden"}}>
              + Add your first class
            </button>
          </div>
        </div>
      ):(
        <div style={{padding:"8px 16px 40px",display:"flex",gap:14,overflowX:"auto",alignItems:"flex-start"}}>
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const dateNotes=getDateNotes(cls.id,selectedDate);
            const totalEntries=Object.values(data.notes[cls.id]||{}).reduce((s,arr)=>s+arr.length,0);
            return(
              <div key={cls.id} style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
                {/* Column header */}
                <div style={{background:G.forest,borderRadius:12,padding:"12px 14px",border:`1px solid ${G.forestS}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <div style={{width:32,height:32,borderRadius:9,background:color.bg,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",fontFamily:G.mono,letterSpacing:-1}}>
                      {(cls.section||"?").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:G.display,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:G.mono,marginTop:1}}>🏫 {cls.institute}{cls.subject?` · ${cls.subject}`:""}</div>
                    </div>
                    <button onClick={()=>{if(window.confirm(`Delete "${cls.section}"?\nAll ${totalEntries} entries will be lost.`))deleteClass(cls.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.2)",fontSize:13,padding:"2px 4px",borderRadius:5,transition:"color 0.12s",flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.color="rgba(239,68,68,0.7)"}
                      onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.2)"}>🗑</button>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:G.mono}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"} today</span>
                    {canAdd&&<button onClick={()=>{setTargetClassId(cls.id);setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}}
                      onPointerDown={e=>rpl(e,true)}
                      style={{background:color.bg,color:"#fff",border:"none",borderRadius:7,padding:"4px 11px",fontSize:10,cursor:"pointer",fontFamily:G.mono,fontWeight:600,position:"relative",overflow:"hidden"}}>
                      + Add
                    </button>}
                  </div>
                </div>

                {/* Entry cards */}
                {dateNotes.length===0?(
                  <div style={{background:G.surface,borderRadius:10,border:`1px dashed ${G.border}`,padding:"20px 14px",textAlign:"center"}}>
                    <div style={{fontSize:12,color:G.textL}}>{canAdd?"No entries yet.":"No entries this day."}</div>
                  </div>
                ):(
                  dateNotes.map(note=>{
                    const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                    return(
                      <div key={note.id} className="ct-card" style={{...card,overflow:"hidden"}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(26,51,40,0.1)"}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow=card.boxShadow}>
                        <div style={{height:3,background:tag.bg}}/>
                        <div style={{padding:"9px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:note.title?4:0}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:8,borderRadius:20,padding:"2px 7px",fontFamily:G.mono,fontWeight:500}}>{tag.label}</span>
                              {note.timeStart&&<span style={{fontSize:8,color:G.textL,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"1px 6px",border:`1px solid ${G.border}`}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            </div>
                            <div style={{display:"flex",gap:3,flexShrink:0}}>
                              <button onClick={()=>{setTargetClassId(cls.id);setEditNote({...note});setView("editNote");}}
                                style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:5,padding:"2px 7px",fontSize:9,cursor:"pointer",color:G.textM,fontFamily:G.mono,transition:"all 0.1s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background=G.greenL;e.currentTarget.style.color=G.green;e.currentTarget.style.borderColor=G.green;}}
                                onMouseLeave={e=>{e.currentTarget.style.background=G.bg;e.currentTarget.style.color=G.textM;e.currentTarget.style.borderColor=G.border;}}>Edit</button>
                              <button onClick={()=>deleteNote(cls.id,note.id)}
                                style={{background:G.redL,border:"1px solid #FEE2E2",borderRadius:5,padding:"2px 7px",fontSize:9,cursor:"pointer",color:G.red,fontFamily:G.mono}}>✕</button>
                            </div>
                          </div>
                          {note.title&&<div style={{fontWeight:600,fontSize:13,color:G.text,fontFamily:G.display,marginBottom:note.body?4:0}}>{note.title}</div>}
                          {note.body&&<p style={{margin:0,fontSize:11,color:G.textM,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── ADD CLASS ──────────────────────────────────────────────────────────────
  if(view==="addClass") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <div style={{background:G.forest,padding:"14px 24px 16px"}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          <button onClick={()=>setView("kanban")} onPointerDown={e=>rpl(e,true)}
            style={{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.75)",fontFamily:G.mono,position:"relative",overflow:"hidden"}}>← Back</button>
        </div>
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"26px 20px 48px"}}>
        <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>New Class</div>
        <h2 style={{margin:"0 0 22px",fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display}}>Add a class</h2>

        <div style={{...card,padding:"20px"}}>
          <div style={{background:G.greenL,borderRadius:9,padding:"10px 14px",marginBottom:18,fontSize:12,color:G.green,fontFamily:G.mono}}>
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
            style={{marginTop:8,background:(newClass.institute.trim()&&newClass.section.trim())?G.forest:"#B0C4B8",color:"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:12,cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",fontFamily:G.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden"}}>
            Add Class
          </button>
        </div>
      </div>
    </div>
  );

  // ── PROFILE ────────────────────────────────────────────────────────────────
  if(view==="profile") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <div style={{background:G.forest,padding:"14px 24px 16px"}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <button onClick={()=>setView("kanban")} onPointerDown={e=>rpl(e,true)}
            style={{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.75)",fontFamily:G.mono,position:"relative",overflow:"hidden"}}>← Back</button>
        </div>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"26px 20px 48px"}}>
        <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>Profile</div>
        <h2 style={{margin:"0 0 22px",fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display}}>Your details</h2>
        <div style={{...card,padding:"20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,padding:"14px",background:G.bg,borderRadius:10,border:`1px solid ${G.border}`}}>
            <Avatar user={user} size={44}/>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:G.text,fontFamily:G.display}}>{teacherName}</div>
              <div style={{fontSize:11,color:G.textL,marginTop:2}}>{user.email}</div>
            </div>
          </div>
          <label style={lbl}>Update your name</label>
          <input defaultValue={teacherName} id="profile-name-input" placeholder="Your full name" style={inpS}/>
          <button onClick={()=>{ const v=document.getElementById("profile-name-input").value.trim(); if(v) setData(d=>({...d,profile:{name:v}})); setView("kanban"); }}
            onPointerDown={e=>rpl(e,true)}
            style={{background:G.forest,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:12,cursor:"pointer",fontFamily:G.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden"}}>
            Save Name
          </button>
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${G.border}`}}>
            <button onClick={logout} style={{background:G.redL,border:"1px solid #FEE2E2",color:G.red,borderRadius:9,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:G.mono}}>Sign out</button>
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
        <div style={{background:G.forest}}>
          <div style={{maxWidth:680,margin:"0 auto",padding:"14px 24px 0"}}>
            <button onClick={()=>setView("kanban")} onPointerDown={e=>rpl(e,true)}
              style={{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.75)",fontFamily:G.mono,marginBottom:14,position:"relative",overflow:"hidden"}}>← Back</button>
          </div>
          {!isEdit&&<DateCarousel selectedDate={selectedDate} onSelectDate={setSelectedDate}/>}
        </div>

        <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px 48px"}}>
          {targetClass&&(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:color.bg,flexShrink:0}}/>
              <span style={{fontSize:11,color:G.textM,fontFamily:G.mono}}>{targetClass.section} · {targetClass.institute}</span>
            </div>
          )}
          <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{isEdit?"Editing Entry":"New Entry For"}</div>
          <h2 style={{margin:"0 0 20px",fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>

          <div style={{background:G.greenL,borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:11,color:G.green,fontFamily:G.mono}}>
            👤 Logged as: <strong>{teacherName}</strong>
          </div>

          <div style={{marginBottom:16}}>
            <label style={lbl}>Type</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(TAG_STYLES).map(([key,val])=>(
                <button key={key} onClick={()=>setForm({...form,tag:key})}
                  style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textL,border:`1px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:G.mono,fontWeight:form.tag===key?500:400,transition:"all 0.12s"}}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <label style={lbl}>Class Time (optional)</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inpS,marginBottom:0,flex:1}}/>
              {form.timeStart&&<><span style={{color:G.textL,fontSize:13,flexShrink:0}}>to</span><input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inpS,marginBottom:0,flex:1}}/></>}
            </div>
          </div>

          <div style={{marginBottom:12}}><label style={lbl}>Title</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inpS,fontSize:15,fontWeight:500}}/></div>
          <div><label style={lbl}>Notes</label><textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={7} style={{...inpS,resize:"vertical",lineHeight:1.7,marginBottom:0}}/></div>

          <button onClick={save} onPointerDown={e=>rpl(e,true)}
            style={{marginTop:18,background:G.forest,color:"#fff",border:"none",borderRadius:9,padding:"12px 28px",fontSize:12,cursor:"pointer",fontFamily:G.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden",boxShadow:"0 2px 10px rgba(26,51,40,0.25)",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=G.forestS}
            onMouseLeave={e=>e.currentTarget.style.background=G.forest}>
            {isEdit?"Save Changes":"Save Entry"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
