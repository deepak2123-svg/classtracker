import { useState, useEffect, useRef, useCallback } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { TAG_STYLES, inp, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod, friendlyError } from "./shared.jsx";

// ── Sage Green palette ────────────────────────────────────────────────────────
const G = {
  forest:  "#1A3328",
  forestS: "#243D30",
  green:   "#16A34A",
  greenV:  "#4ADE80",
  greenL:  "#DCFCE7",
  greenM:  "#86EFAC",
  bg:      "#F2F7F3",
  surface: "#FFFFFF",
  border:  "#C8DDD0",
  borderM: "#A0C0AC",
  text:    "#1A3328",
  textS:   "#374940",
  textM:   "#6A8A78",
  textL:   "#9AB4A0",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  amber:   "#D97706",
  amberL:  "#FEF3C7",
  blue:    "#0891B2",
  blueL:   "#CFFAFE",
  violet:  "#7C3AED",
  violetL: "#EDE9FE",
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

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[], institutes:[], sections:[] };

// ── Date window helpers ───────────────────────────────────────────────────────
function buildDateWindow() {
  const now = new Date();
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
    days.push({
      key: `${y}-${m}-${day}`,
      num: d.getDate(),
      dayName: dayNames[d.getDay()],
      isSun: d.getDay() === 0,
      offset: i,
    });
  }
  return days;
}
function isDateAllowed(dk) {
  const window = buildDateWindow();
  return window.some(d => d.key === dk);
}

// ── Ripple ────────────────────────────────────────────────────────────────────
function rpl(e, white = false) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const s = Math.max(rect.width, rect.height) * 2.5;
  const x = (e.clientX || rect.left + rect.width/2) - rect.left - s/2;
  const y = (e.clientY || rect.top + rect.height/2) - rect.top - s/2;
  const w = document.createElement("span");
  w.className = "rw" + (white ? " white" : " dark");
  w.style.cssText = `width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.position = el.style.position || "relative";
  el.style.overflow = "hidden";
  el.appendChild(w);
  w.addEventListener("animationend", () => w.remove());
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card = { background: G.surface, borderRadius: 12, border: `1px solid ${G.border}`, boxShadow: "0 1px 4px rgba(26,51,40,0.06)" };
const lbl = { fontSize: 10, color: G.textL, fontFamily: G.mono, letterSpacing: 1, display: "block", marginBottom: 5, textTransform: "uppercase" };
const inpStyle = { width:"100%", padding:"10px 13px", borderRadius:9, border:`1px solid ${G.border}`, fontSize:14, fontFamily:G.sans, outline:"none", background:G.surface, color:G.text, marginBottom:10 };

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
        style={{...inpStyle,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:9,fontFamily:G.mono,transition:"transform 0.15s",display:"inline-block",transform:open?"rotate(180deg)":"none"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:300,background:G.surface,borderRadius:10,border:`1px solid ${G.border}`,boxShadow:"0 8px 32px rgba(26,51,40,0.14)",overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:G.textL,fontSize:13}}>No saved options yet</div>}
            {options.map(opt=>{
              const sel=opt===value;
              return(<div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,color:sel?G.green:G.text,fontWeight:sel?500:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:14,color:G.green,fontSize:11}}>{sel?"✓":""}</span>{opt}
              </div>);
            })}
          </div>
          <div style={{borderTop:`1px solid ${G.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)}
                  style={{padding:"10px 16px",cursor:"pointer",fontSize:12,color:G.green,fontFamily:G.mono,display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=G.greenL}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  ＋ Add new option
                </div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}}
                  placeholder={addPlaceholder}
                  style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1.5px solid ${G.green}`,fontSize:13,fontFamily:G.sans,outline:"none"}}/>
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
function DateCarousel({ selectedDate, onSelectDate, noteDates = new Set() }) {
  const dates = buildDateWindow();
  const selIdx = dates.findIndex(d => d.key === selectedDate);
  const centerIdx = selIdx >= 0 ? selIdx : 7;

  return (
    <div className="date-carousel-wrap">
      <div className="date-carousel">
        {dates.map((d, i) => {
          const dist = Math.min(Math.abs(i - centerIdx), 7);
          const isSel = i === centerIdx;
          const hasEntries = noteDates.has(d.key);
          return (
            <div key={d.key}
              className="dc"
              data-dist={dist}
              onClick={() => onSelectDate(d.key)}>
              <div className="dn">{d.num}</div>
              {dist <= 1 && <div className="dd">{d.dayName}</div>}
              {isSel && <div className="dt">Today</div>}
              {hasEntries && <div className="de"/>}
            </div>
          );
        })}
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

  if(loading) return <Spinner text="Loading…"/>;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:14,right:18,borderRadius:20,padding:"5px 14px",fontSize:10,
      fontFamily:G.mono,zIndex:999,letterSpacing:0.5,
      background:saveErr?"#FEE2E2":G.forest,color:saveErr?"#991B1B":"rgba(255,255,255,0.9)",
      boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
      {saveErr?"⚠ save failed":"saving…"}
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

  const deleteClass=(id)=>{
    setData(d=>({...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id))}));
    setView("home"); setActiveClass(null);
  };
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
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <SaveBadge/>
      {/* Nav */}
      <div style={{background:G.forest,padding:"16px 24px 20px"}}>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,fontFamily:G.mono,letterSpacing:3,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",marginBottom:3}}>Academic Planner</div>
            <div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:G.display,letterSpacing:-0.5}}>My Classes</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.32)",marginTop:3,fontFamily:G.mono}}>
              {data.classes.length} {data.classes.length===1?"class":"classes"} · {totalNotes} entries
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <Avatar user={user} size={36}/>
            <button onClick={logout} style={{background:"none",border:"none",fontSize:10,color:"rgba(255,255,255,0.28)",cursor:"pointer",fontFamily:G.mono,padding:0}}>sign out</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"22px 20px 48px"}}>
        {/* Class list */}
        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:22}}>
          {data.classes.length===0&&(
            <div style={{...card,textAlign:"center",padding:"48px 20px"}}>
              <div style={{fontSize:38,marginBottom:10}}>📚</div>
              <div style={{fontSize:14,color:G.textM}}>No classes yet. Add your first one below.</div>
            </div>
          )}
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const cn=data.notes[cls.id]||{};
            const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
            const todayCount=(cn[todayKey()]||[]).length;
            return(
              <div key={cls.id} className="ct-card" style={{...card,display:"flex",alignItems:"center",overflow:"hidden"}}>
                <div style={{width:5,alignSelf:"stretch",background:color.bg,flexShrink:0}}/>
                <div onClick={()=>{setActiveClass(cls);setView("class");setSelectedDate(todayKey());setSearch("");}}
                  style={{flex:1,display:"flex",alignItems:"center",gap:13,padding:"13px 15px",cursor:"pointer",minWidth:0,position:"relative",overflow:"hidden"}}
                  onPointerDown={e=>rpl(e,false)}>
                  <div style={{width:42,height:42,borderRadius:11,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1}}>
                    {(cls.section||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:15,color:G.text,marginBottom:2,fontFamily:G.display}}>{cls.section}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:G.textM}}>🏫 {cls.institute}</span>
                      {cls.subject&&<span style={{fontSize:11,color:G.textL}}>· {cls.subject}</span>}
                      {cls.teacher&&<span style={{fontSize:11,color:G.textL}}>· {cls.teacher}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                    <div style={{background:color.light,color:color.text,borderRadius:20,padding:"3px 11px",fontSize:10,fontFamily:G.mono,fontWeight:500,whiteSpace:"nowrap"}}>{count} entries</div>
                    {todayCount>0&&<div style={{background:G.greenL,color:G.green,borderRadius:20,padding:"2px 9px",fontSize:9,fontFamily:G.mono,whiteSpace:"nowrap"}}>+{todayCount} today</div>}
                  </div>
                </div>
                <button
                  onClick={()=>{if(window.confirm(`Delete "${cls.section} · ${cls.institute}"?\n\nThis will permanently delete all ${Object.values(data.notes[cls.id]||{}).reduce((a,arr)=>a+arr.length,0)} entries. Cannot be undone.`))deleteClass(cls.id);}}
                  style={{padding:"0 16px",alignSelf:"stretch",background:"none",border:"none",borderLeft:`1px solid ${G.border}`,cursor:"pointer",color:G.textL,fontSize:16,flexShrink:0,transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=G.redL;e.currentTarget.style.color=G.red;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=G.textL;}}>
                  🗑
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Class */}
        <div style={{...card,overflow:"hidden"}}>
          <div style={{padding:"12px 18px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:3,height:14,borderRadius:2,background:G.green}}/>
            <span style={{fontSize:11,fontWeight:500,color:G.textM,fontFamily:G.mono,letterSpacing:0.5}}>Add a new class</span>
          </div>
          <div style={{padding:"18px 18px 20px"}}>
            <label style={lbl}>Institute</label>
            <CreatableDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. Genesis Karnal, KIS, GIS" addPlaceholder="Type institute name…"/>
            <label style={{...lbl,marginTop:8}}>Class / Section</label>
            <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
            <label style={{...lbl,marginTop:8}}>Subject</label>
            <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
            <label style={{...lbl,marginTop:8}}>Teacher name</label>
            <input value={newClass.teacher} onChange={e=>setNewClass(c=>({...c,teacher:e.target.value}))} placeholder="e.g. Mr. Johnson" style={inpStyle}/>
            <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()}
              onPointerDown={e=>rpl(e,true)}
              style={{marginTop:6,background:(newClass.institute.trim()&&newClass.section.trim())?G.forest:"#B0C4B8",
                color:"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:12,
                cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",
                fontFamily:G.mono,letterSpacing:1,fontWeight:500,position:"relative",overflow:"hidden"}}>
              Add Class
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
    const allDates=Object.keys(classNotes).filter(dk=>classNotes[dk]?.length>0).sort((a,b)=>b.localeCompare(a));
    const totalEntries=Object.values(classNotes).reduce((s,arr)=>s+arr.length,0);
    const initials=(activeClass.section||"?").slice(0,2).toUpperCase();
    const canAdd=isDateAllowed(selectedDate);
    const noteDates=new Set(Object.keys(classNotes).filter(dk=>classNotes[dk]?.length>0));

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>

        {/* Header */}
        <div style={{background:G.forest}}>
          <div style={{maxWidth:1160,margin:"0 auto",padding:"14px 24px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <button onClick={()=>setView("home")}
                style={{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.75)",fontFamily:G.mono,position:"relative",overflow:"hidden"}}
                onPointerDown={e=>rpl(e,true)}>← Back</button>
              <button onClick={()=>{if(window.confirm(`Delete "${activeClass.section}"?\nAll entries will be lost.`))deleteClass(activeClass.id);}}
                style={{background:"none",border:"none",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.22)",fontFamily:G.mono,padding:"4px 8px",borderRadius:6,transition:"color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.color="rgba(239,68,68,0.8)"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.22)"}>
                Delete class
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,paddingBottom:18}}>
              <div style={{width:52,height:52,borderRadius:14,background:color.bg,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",fontFamily:G.mono,letterSpacing:-1}}>
                {initials}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:22,color:"#fff",fontFamily:G.display,letterSpacing:-0.5,lineHeight:1.1}}>{activeClass.section}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:5}}>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>🏫 {activeClass.institute}</span>
                  {activeClass.subject&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>· {activeClass.subject}</span>}
                  {activeClass.teacher&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>· 👤 {activeClass.teacher}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                {[{n:totalEntries,l:"entries"},{n:allDates.length,l:"days"}].map(({n,l})=>(
                  <div key={l} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"6px 14px",textAlign:"center"}}>
                    <div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:G.display}}>{n}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:G.mono,letterSpacing:1}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Date Carousel — inside dark header */}
          <DateCarousel selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/>
        </div>

        <div style={{maxWidth:1160,margin:"0 auto",padding:"18px 24px",display:"flex",gap:18,alignItems:"flex-start"}}>

          {/* LEFT — Class Switcher */}
          <div style={{width:210,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:G.mono,letterSpacing:2,color:G.textL,marginBottom:9,textTransform:"uppercase"}}>My Classes</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {data.classes.map(cls=>{
                const c=COLORS[cls.colorIdx%COLORS.length];
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    className="ct-card"
                    style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",transition:"all 0.12s",position:"relative",overflow:"hidden",
                      background:isActive?G.greenL:G.surface,
                      borderLeft:`3px solid ${isActive?G.green:G.border}`,
                      border:`1px solid ${isActive?"rgba(22,163,74,0.2)":G.border}`}}
                    onPointerDown={e=>rpl(e,false)}>
                    <div style={{fontSize:13,fontWeight:isActive?600:400,color:isActive?G.green:G.textS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:isActive?G.display:G.sans}}>{cls.section}</div>
                    <div style={{fontSize:9,color:G.textL,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:G.mono}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — Entries */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
                <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginTop:2}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
              </div>
              {canAdd
                ?<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}}
                    onPointerDown={e=>rpl(e,true)}
                    style={{background:G.green,color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:11,cursor:"pointer",fontFamily:G.mono,fontWeight:500,letterSpacing:0.5,boxShadow:"0 2px 10px rgba(22,163,74,0.35)",position:"relative",overflow:"hidden"}}>
                    + Add Entry
                  </button>
                :<div style={{fontSize:10,color:G.textL,fontFamily:G.mono,background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px"}}>Outside ±7 day window</div>
              }
            </div>

            {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inpStyle,marginBottom:12}}/>}

            {filtered.length===0&&(
              <div style={{...card,textAlign:"center",padding:"40px 20px"}}>
                <div style={{width:42,height:42,borderRadius:12,background:G.greenL,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✏️</div>
                <div style={{fontSize:13,color:G.textM}}>
                  {search?"No matching entries."
                    :canAdd?'Tap "+ Add Entry" to log this class.'
                    :"No entries for this date."}
                </div>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.map(note=>{
                const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                return(
                  <div key={note.id} className="ct-card" style={{...card,overflow:"hidden"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 18px rgba(26,51,40,0.1)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow=card.boxShadow}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:note.title?4:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:9,borderRadius:20,padding:"2px 8px",fontFamily:G.mono,fontWeight:500}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:9,color:G.textL,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"2px 7px",border:`1px solid ${G.border}`}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:600,fontSize:14,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                        </div>
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                            style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:7,padding:"4px 10px",fontSize:10,cursor:"pointer",color:G.textM,fontFamily:G.mono,transition:"all 0.12s"}}
                            onMouseEnter={e=>{e.currentTarget.style.background=G.greenL;e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
                            onMouseLeave={e=>{e.currentTarget.style.background=G.bg;e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>
                            Edit
                          </button>
                          <button onClick={()=>deleteNote(note.id)}
                            style={{background:G.redL,border:"1px solid #FEE2E2",borderRadius:7,padding:"4px 10px",fontSize:10,cursor:"pointer",color:G.red,fontFamily:G.mono}}>✕</button>
                        </div>
                      </div>
                      {note.body&&<p style={{margin:"8px 0 0",fontSize:12,color:G.textM,lineHeight:1.65,whiteSpace:"pre-wrap",borderTop:`1px solid ${G.border}`,paddingTop:8}}>{note.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — Timeline */}
          <div style={{width:190,flexShrink:0}}>
            <div style={{fontSize:9,fontFamily:G.mono,letterSpacing:2,color:G.textL,marginBottom:10,textTransform:"uppercase"}}>Past Entries</div>
            {allDates.length===0
              ?<div style={{fontSize:11,color:G.textL,fontStyle:"italic"}}>No entries yet.</div>
              :<div style={{display:"flex",flexDirection:"column"}}>
                {allDates.map((dk,i)=>{
                  const entries=classNotes[dk]||[];
                  const isSel=dk===selectedDate;
                  return(
                    <div key={dk} onClick={()=>setSelectedDate(dk)}
                      style={{cursor:"pointer",display:"flex",gap:9,paddingBottom:13,position:"relative",overflow:"hidden",borderRadius:6,padding:"2px 4px 13px 0"}}
                      onPointerDown={e=>rpl(e,false)}>
                      {i<allDates.length-1&&<div style={{position:"absolute",left:4,top:13,bottom:0,width:1,background:G.border}}/>}
                      <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,marginTop:3,zIndex:1,transition:"all 0.15s",
                        background:isSel?G.green:G.surface,border:`2px solid ${isSel?G.green:G.borderM}`,
                        boxShadow:isSel?`0 0 0 3px rgba(22,163,74,0.15)`:"none"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,fontWeight:isSel?600:400,color:isSel?G.green:G.textM,fontFamily:G.mono}}>{formatDateLabel(dk)}</div>
                        <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:2}}>
                          {entries.slice(0,2).map(n=>{
                            const tag=TAG_STYLES[n.tag]||TAG_STYLES.note;
                            return(
                              <div key={n.id} style={{fontSize:10,color:G.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:tag.bg,flexShrink:0}}/>
                                {n.title||n.body||"—"}
                              </div>
                            );
                          })}
                          {entries.length>2&&<div style={{fontSize:9,color:G.textL,fontFamily:G.mono}}>+{entries.length-2} more</div>}
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
    const dates=buildDateWindow();

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <div style={{background:G.forest}}>
          <div style={{maxWidth:680,margin:"0 auto",padding:"14px 24px 0"}}>
            <button onClick={()=>setView("class")}
              style={{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:7,padding:"5px 13px",fontSize:11,cursor:"pointer",color:"rgba(255,255,255,0.75)",fontFamily:G.mono,marginBottom:16,position:"relative",overflow:"hidden"}}
              onPointerDown={e=>rpl(e,true)}>← Back</button>
          </div>
          {/* Date carousel in entry screen too */}
          {!isEdit&&<DateCarousel selectedDate={selectedDate} onSelectDate={setSelectedDate}/>}
        </div>

        <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px 48px"}}>
          <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{isEdit?"Editing Entry":"New Entry For"}</div>
          <h2 style={{margin:"0 0 20px",fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>
            {isEdit?form.title||"Entry":formatDateLabel(selectedDate)}
          </h2>

          {/* Tag */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Type</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(TAG_STYLES).map(([key,val])=>(
                <button key={key} onClick={()=>setForm({...form,tag:key})}
                  style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textL,
                    border:`1px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,
                    padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:G.mono,
                    fontWeight:form.tag===key?500:400,transition:"all 0.12s"}}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Class Time (optional)</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inpStyle,marginBottom:0,flex:1}}/>
              {form.timeStart&&<>
                <span style={{color:G.textL,fontSize:13,flexShrink:0}}>to</span>
                <input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inpStyle,marginBottom:0,flex:1}}/>
              </>}
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={lbl}>Title</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inpStyle,fontSize:15,fontWeight:500}}/>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})
            } placeholder="Write your notes, tasks, or resources here…" rows={7} style={{...inpStyle,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
          </div>

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
