import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { TAG_STYLES, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

const G = {
  forest:"#1A3328", forestS:"#243D30",
  green:"#16A34A", greenV:"#4ADE80", greenL:"#DCFCE7",
  bg:"#F5F6F8", surface:"#FFFFFF",
  border:"#E4E9EE", borderM:"#C8D4D0",
  text:"#111827", textS:"#374151", textM:"#6B7280", textL:"#9CA3AF",
  red:"#DC2626", redL:"#FEF2F2",
  navy:"#111827",
  mono:"'JetBrains Mono', monospace",
  sans:"'Outfit', sans-serif",
  display:"'Syne', sans-serif",
};

const COLORS = [
  {bg:"#16A34A",light:"#DCFCE7",text:"#14532D"},
  {bg:"#0891B2",light:"#CFFAFE",text:"#164E63"},
  {bg:"#D97706",light:"#FEF3C7",text:"#78350F"},
  {bg:"#7C3AED",light:"#EDE9FE",text:"#4C1D95"},
  {bg:"#DC2626",light:"#FEE2E2",text:"#7F1D1D"},
  {bg:"#059669",light:"#D1FAE5",text:"#064E3B"},
  {bg:"#DB2777",light:"#FCE7F3",text:"#831843"},
  {bg:"#2563EB",light:"#DBEAFE",text:"#1E3A8A"},
];

const DEFAULT_DATA = {classes:[],notes:{},subjects:[],institutes:[],sections:[],profile:{name:""}};

// ── Date helpers ──────────────────────────────────────────────────────────────
function buildDateWindow() {
  const now = new Date();
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(now); d.setDate(d.getDate()+i);
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
    days.push({key:`${y}-${m}-${day}`,num:d.getDate(),dayName:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()],month:["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()],monthShort:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()],year:d.getFullYear(),offset:i});
  }
  return days;
}
function isDateAllowed(dk){ return buildDateWindow().some(d=>d.key===dk); }

function rpl(e,light=false){
  const el=e.currentTarget,rect=el.getBoundingClientRect();
  const s=Math.max(rect.width,rect.height)*2.5;
  const x=(e.clientX||rect.left+rect.width/2)-rect.left-s/2;
  const y=(e.clientY||rect.top+rect.height/2)-rect.top-s/2;
  const w=document.createElement("span");
  w.className="rw"+(light?" white":" dark");
  w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.overflow="hidden"; el.appendChild(w); w.addEventListener("animationend",()=>w.remove());
}

const lbl={fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,display:"block",marginBottom:5,textTransform:"uppercase"};
const inpS={width:"100%",padding:"10px 13px",borderRadius:8,border:`1px solid ${G.border}`,fontSize:14,fontFamily:G.sans,outline:"none",background:G.surface,color:G.text,marginBottom:10};

// ── Top Nav ───────────────────────────────────────────────────────────────────
function TopNav({user,teacherName,onEditName,right}) {
  return (
    <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 28px",position:"sticky",top:0,zIndex:100}}>
      <div style={{maxWidth:1280,margin:"0 auto",height:58,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎓</div>
          <span style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>ClassLog</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {right}
          <button onClick={onEditName}
            style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8,transition:"all 0.12s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>
            <Avatar user={user} size={20}/>
            <span>{teacherName}</span>
            <span style={{fontSize:10,color:G.textL}}>✏</span>
          </button>
          <button onClick={logout} style={{background:"none",border:"none",fontSize:11,color:G.textL,cursor:"pointer",fontFamily:G.mono}}>sign out</button>
        </div>
      </div>
    </div>
  );
}

// ── Date Strip ────────────────────────────────────────────────────────────────
function DateStrip({selectedDate,onSelectDate,noteDates=new Set()}) {
  const dates=buildDateWindow();
  const stripRef=useRef(null);
  useEffect(()=>{
    const strip=stripRef.current; if(!strip) return;
    const selIdx=dates.findIndex(d=>d.key===selectedDate);
    strip.scrollLeft=selIdx*80 - strip.clientWidth/2 + 40;
  },[selectedDate]);

  return (
    <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div ref={stripRef}
        style={{display:"flex",gap:4,overflowX:"auto",padding:"8px 12px",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none",cursor:"grab"}}
        onMouseDown={e=>{const el=e.currentTarget;let sl=el.scrollLeft,sx=e.pageX-el.offsetLeft,down=true;const mm=mv=>{if(!down)return;el.scrollLeft=sl-(mv.pageX-el.offsetLeft-sx)*1.2;};const mu=()=>{down=false;document.removeEventListener("mousemove",mm);document.removeEventListener("mouseup",mu);};document.addEventListener("mousemove",mm);document.addEventListener("mouseup",mu);}}>
        {dates.map(d=>{
          const isSel=d.key===selectedDate;
          const isSun=d.dayName==="SUN";
          const hasE=noteDates.has(d.key);
          const allowed=isDateAllowed(d.key);
          return(
            <div key={d.key} onClick={()=>onSelectDate(d.key)}
              style={{flexShrink:0,width:72,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px 8px",borderRadius:10,cursor:"pointer",transition:"all 0.15s",position:"relative",
                background:isSel?G.navy:"transparent",opacity:allowed?1:0.5}}>
              <div style={{fontSize:10,fontWeight:500,fontFamily:G.mono,letterSpacing:0.5,marginBottom:6,color:isSel?"rgba(255,255,255,0.55)":isSun?G.red:G.textM}}>{d.dayName}</div>
              <div style={{fontSize:24,fontWeight:700,fontFamily:G.display,lineHeight:1,color:isSel?"#fff":G.text}}>{d.num}</div>
              {isSel&&<div style={{fontSize:7,fontFamily:G.mono,letterSpacing:1,color:"rgba(255,255,255,0.5)",marginTop:4}}>TODAY</div>}
              {hasE&&!isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:G.green,marginTop:4}}/>}
              {!hasE&&!isSel&&<div style={{height:8}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({value,onChange,options,onAddOption,placeholder,addPlaceholder}){
  const [open,setOpen]=useState(false);const [adding,setAdding]=useState(false);const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null);const wrapRef=useRef(null);
  useEffect(()=>{if(adding&&inputRef.current)inputRef.current.focus();},[adding]);
  useEffect(()=>{const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");}};document.addEventListener("mousedown",h);return ()=>document.removeEventListener("mousedown",h);},[]);
  const confirmAdd=()=>{const t=newVal.trim();if(!t)return;if(!options.includes(t))onAddOption(t);onChange(t);setNewVal("");setAdding(false);setOpen(false);};
  return(
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}} style={{...inpS,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:9,fontFamily:G.mono,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:10,border:`1px solid ${G.border}`,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:G.textL,fontSize:13}}>No saved options yet</div>}
            {options.map(opt=>{const sel=opt===value;return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:13,color:sel?G.green:G.text,fontWeight:sel?500:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:14,color:G.green,fontSize:11}}>{sel?"✓":""}</span>{opt}
              </div>);
            })}
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

// ── Profile Setup (first login) ───────────────────────────────────────────────
function ProfileSetup({user,onSave}){
  const [name,setName]=useState(user.displayName||"");
  return(
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:20,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🎓</div>
          <div style={{fontSize:26,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:8}}>Welcome to ClassLog</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",fontFamily:G.mono,lineHeight:1.7}}>Your name is stamped on every entry.<br/>Set it once — no one else can change it.</div>
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

// ── Edit Name Modal ───────────────────────────────────────────────────────────
function EditNameModal({current,onSave,onClose}){
  const [name,setName]=useState(current);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:G.surface,borderRadius:16,padding:"28px 24px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>Edit your name</div>
        <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,marginBottom:18}}>This appears on all your entries</div>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} autoFocus style={{...inpS,fontSize:15}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"9px 18px",fontSize:13,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>Cancel</button>
          <button onClick={()=>name.trim()&&onSave(name.trim())} onPointerDown={e=>rpl(e,true)} style={{background:G.navy,color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClassTracker({user}){
  const [data,setData]         = useState(DEFAULT_DATA);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState(false);
  const [view,setView]         = useState("home");        // home | class | addClass | addNote | editNote
  const [activeClass,setActiveClass] = useState(null);
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [newNote,setNewNote]   = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});
  const [editNote,setEditNote] = useState(null);
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:""});
  const [search,setSearch]     = useState("");
  const [editingName,setEditingName] = useState(false);
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);

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

  const teacherName=data.profile.name;

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
    setNewClass({institute:"",section:"",subject:""}); setView("home");
  };
  const deleteClass=(id)=>{ setData(d=>({...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id))})); if(activeClass?.id===id){setActiveClass(null);setView("home");} };
  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>(data.notes[cid]||{})[dk]||[];
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));
  const addNote=()=>{
    if(!newNote.title.trim()&&!newNote.body.trim()) return;
    const note={id:Date.now().toString(),...newNote,teacherName,created:Date.now()};
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}}; });
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""}); setView("class");
  };
  const saveEdit=()=>{
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}}; });
    setEditNote(null); setView("class");
  };
  const deleteNote=(noteId)=>setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}}}; });

  const totalNotes=data.classes.reduce((s,c)=>{ const cn=data.notes[c.id]||{}; return s+Object.values(cn).reduce((a,arr)=>a+arr.length,0); },0);
  const canAdd=isDateAllowed(selectedDate);

  // ── HOME ──────────────────────────────────────────────────────────────────
  if(view==="home") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <SaveBadge/>
      {editingName&&<EditNameModal current={teacherName} onSave={name=>{setData(d=>({...d,profile:{name}}));setEditingName(false);}} onClose={()=>setEditingName(false)}/>}
      <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
        right={<>
          <span style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>{data.classes.length} {data.classes.length===1?"class":"classes"} · {totalNotes} entries</span>
          <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
            style={{background:G.green,color:"#fff",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6,position:"relative",overflow:"hidden"}}>
            <span style={{fontSize:17,lineHeight:1}}>+</span> Add Class
          </button>
        </>}
      />

      <div style={{maxWidth:1280,margin:"0 auto",padding:"28px 28px 60px"}}>
        {/* Greeting */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:13,color:G.textL,fontFamily:G.mono,marginBottom:4}}>Good day,</div>
          <div style={{fontSize:28,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.5}}>
            {teacherName} 👋
          </div>
        </div>

        {/* Class grid */}
        {data.classes.length===0?(
          <div style={{textAlign:"center",padding:"64px 20px"}}>
            <div style={{fontSize:44,marginBottom:12}}>📚</div>
            <div style={{fontSize:16,color:G.textM,marginBottom:20,fontFamily:G.sans}}>No classes yet. Add your first one.</div>
            <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
              style={{background:G.green,color:"#fff",border:"none",borderRadius:9,padding:"11px 24px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
              + Add First Class
            </button>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {data.classes.map(cls=>{
              const color=COLORS[cls.colorIdx%COLORS.length];
              const cn=data.notes[cls.id]||{};
              const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
              const todayCount=(cn[todayKey()]||[]).length;
              return(
                <div key={cls.id} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",transition:"box-shadow 0.15s,transform 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}>
                  {/* Color bar */}
                  <div style={{height:4,background:color.bg}}/>
                  <div style={{padding:"16px 16px 14px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:42,height:42,borderRadius:11,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1}}>
                          {(cls.section||"?").slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.1}}>{cls.section}</div>
                          <div style={{fontSize:11,color:G.textM,marginTop:3}}>🏫 {cls.institute}{cls.subject?` · ${cls.subject}`:""}</div>
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${cls.section} · ${cls.institute}"?\n\nAll ${count} entries will be permanently lost.`))deleteClass(cls.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:G.textL,fontSize:14,padding:"4px 6px",borderRadius:6,transition:"all 0.12s",flexShrink:0}}
                        onMouseEnter={e=>{e.currentTarget.style.background=G.redL;e.currentTarget.style.color=G.red;}}
                        onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=G.textL;}}>🗑</button>
                    </div>

                    <div style={{display:"flex",gap:8,marginBottom:14}}>
                      <div style={{flex:1,background:G.bg,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:G.textL,fontFamily:G.mono,marginBottom:2}}>TOTAL</div>
                        <div style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display}}>{count}</div>
                      </div>
                      {todayCount>0&&<div style={{flex:1,background:G.greenL,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:G.green,fontFamily:G.mono,marginBottom:2}}>TODAY</div>
                        <div style={{fontSize:22,fontWeight:700,color:G.green,fontFamily:G.display}}>+{todayCount}</div>
                      </div>}
                    </div>

                    <button onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");setView("class");}} onPointerDown={e=>rpl(e,true)}
                      style={{width:"100%",padding:"10px 0",background:G.navy,color:"#fff",border:"none",borderRadius:9,fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden",transition:"background 0.12s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=G.forest}
                      onMouseLeave={e=>e.currentTarget.style.background=G.navy}>
                      Open Class →
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Ghost add card */}
            <div onClick={()=>setView("addClass")}
              style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,minHeight:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:8,padding:24,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background=G.surface;}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:G.bg,border:`2px dashed ${G.borderM}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:G.textL}}>+</div>
              <div style={{fontSize:15,fontWeight:600,color:G.textM,fontFamily:G.display}}>Add New Class</div>
              <div style={{fontSize:12,color:G.textL,textAlign:"center"}}>Manage another subject or section</div>
            </div>
          </div>
        )}
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
    const noteDates=getAllNoteDates(activeClass.id);
    const dates=buildDateWindow();
    const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>
        {editingName&&<EditNameModal current={teacherName} onSave={name=>{setData(d=>({...d,profile:{name}}));setEditingName(false);}} onClose={()=>setEditingName(false)}/>}
        <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
          right={<>
            <button onClick={()=>setView("home")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,transition:"all 0.12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>← All Classes</button>
            <button onClick={()=>{if(window.confirm(`Delete "${activeClass.section}"?\n\nAll ${totalEntries} entries will be permanently lost.`))deleteClass(activeClass.id);}}
              style={{background:G.redL,border:"1px solid #FEE2E2",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans}}>Delete Class</button>
          </>}
        />

        {/* Class header */}
        <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"16px 28px"}}>
          <div style={{maxWidth:1280,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:50,height:50,borderRadius:13,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1}}>
                {(activeClass.section||"?").slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>{activeClass.section}</div>
                <div style={{fontSize:12,color:G.textM,marginTop:2}}>🏫 {activeClass.institute}{activeClass.subject?` · ${activeClass.subject}`:""}</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                {[{n:totalEntries,l:"entries"},{n:allDates.length,l:"days"}].map(({n,l})=>(
                  <div key={l} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{n}</div>
                    <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Date strip */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <span style={{fontSize:14,color:G.green}}>📅</span>
                <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.month} {selDateObj.year}</span>
              </div>
            </div>
            <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/>
          </div>
        </div>

        {/* Main 3-column layout */}
        <div style={{maxWidth:1280,margin:"0 auto",padding:"20px 28px 48px",display:"flex",gap:18,alignItems:"flex-start"}}>

          {/* LEFT — class switcher */}
          <div style={{width:200,flexShrink:0}}>
            <div style={{fontSize:10,fontFamily:G.mono,letterSpacing:1,color:G.textL,marginBottom:10,textTransform:"uppercase"}}>My Classes</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {data.classes.map(cls=>{
                const c=COLORS[cls.colorIdx%COLORS.length];
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",transition:"all 0.12s",background:isActive?G.greenL:G.surface,border:`1px solid ${isActive?"rgba(22,163,74,0.25)":G.border}`,borderLeft:`3px solid ${isActive?G.green:G.border}`}}>
                    <div style={{fontSize:13,fontWeight:isActive?600:400,color:isActive?G.green:G.textS,fontFamily:isActive?G.display:G.sans,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{fontSize:9,color:G.textL,marginTop:2,fontFamily:G.mono,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — entries */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
                <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginTop:2}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
              </div>
              {canAdd
                ?<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}} onPointerDown={e=>rpl(e,true)}
                    style={{background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6,position:"relative",overflow:"hidden"}}>
                    <span style={{fontSize:17,lineHeight:1}}>+</span> Add Entry
                  </button>
                :<div style={{fontSize:11,color:G.textL,fontFamily:G.mono,background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px"}}>Outside ±7 day window</div>}
            </div>

            {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inpS,marginBottom:14}}/>}

            {filtered.length===0&&(
              <div style={{background:G.surface,borderRadius:12,border:`1px dashed ${G.borderM}`,textAlign:"center",padding:"40px 20px"}}>
                <div style={{width:44,height:44,borderRadius:12,background:G.greenL,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✏️</div>
                <div style={{fontSize:13,color:G.textM}}>
                  {search?"No matching entries.":canAdd?'Tap "+ Add Entry" to log this class.':"No entries for this date."}
                </div>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.map(note=>{
                const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                return(
                  <div key={note.id} style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,overflow:"hidden",transition:"box-shadow 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:"12px 15px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:note.title?5:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:9,borderRadius:10,padding:"2px 8px",fontFamily:G.mono,fontWeight:500}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:9,color:G.textL,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"2px 8px",border:`1px solid ${G.border}`}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:600,fontSize:14,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                        </div>
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                            style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:6,padding:"3px 10px",fontSize:10,cursor:"pointer",color:G.textM,fontFamily:G.mono,transition:"all 0.1s"}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>Edit</button>
                          <button onClick={()=>deleteNote(note.id)} style={{background:G.redL,border:"1px solid #FEE2E2",borderRadius:6,padding:"3px 10px",fontSize:10,cursor:"pointer",color:G.red,fontFamily:G.mono}}>✕</button>
                        </div>
                      </div>
                      {note.body&&<p style={{margin:"8px 0 0",fontSize:12,color:G.textM,lineHeight:1.65,whiteSpace:"pre-wrap",borderTop:`1px solid ${G.border}`,paddingTop:8}}>{note.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — timeline */}
          <div style={{width:200,flexShrink:0}}>
            <div style={{fontSize:10,fontFamily:G.mono,letterSpacing:1,color:G.textL,marginBottom:10,textTransform:"uppercase"}}>Past Entries</div>
            {allDates.length===0
              ?<div style={{fontSize:11,color:G.textL,fontStyle:"italic"}}>No entries yet.</div>
              :<div style={{display:"flex",flexDirection:"column"}}>
                {allDates.map((dk,i)=>{
                  const entries=classNotes[dk]||[];
                  const isSel=dk===selectedDate;
                  return(
                    <div key={dk} onClick={()=>setSelectedDate(dk)}
                      style={{cursor:"pointer",display:"flex",gap:10,paddingBottom:14,position:"relative",borderRadius:6,padding:"2px 4px 14px 0"}}>
                      {i<allDates.length-1&&<div style={{position:"absolute",left:4,top:13,bottom:0,width:1,background:G.border}}/>}
                      <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,marginTop:3,zIndex:1,transition:"all 0.15s",background:isSel?G.green:G.surface,border:`2px solid ${isSel?G.green:G.borderM}`,boxShadow:isSel?`0 0 0 3px rgba(22,163,74,0.15)`:"none"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,fontWeight:isSel?600:400,color:isSel?G.green:G.textM,fontFamily:G.mono}}>{formatDateLabel(dk)}</div>
                        <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:2}}>
                          {entries.slice(0,2).map(n=>{ const tag=TAG_STYLES[n.tag]||TAG_STYLES.note; return(
                            <div key={n.id} style={{fontSize:10,color:G.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:3}}>
                              <span style={{width:5,height:5,borderRadius:"50%",background:tag.bg,flexShrink:0}}/>{n.title||n.body||"—"}
                            </div>); })}
                          {entries.length>2&&<div style={{fontSize:9,color:G.textL,fontFamily:G.mono}}>+{entries.length-2} more</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── ADD CLASS ──────────────────────────────────────────────────────────────
  if(view==="addClass") return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
        right={<button onClick={()=>setView("home")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>← Back</button>}
      />
      <div style={{maxWidth:520,margin:"40px auto",padding:"0 20px 60px"}}>
        <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>New Class</div>
        <h2 style={{margin:"0 0 24px",fontSize:24,fontWeight:700,color:G.text,fontFamily:G.display}}>Add a class</h2>
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
          <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()} onPointerDown={e=>rpl(e,true)}
            style={{marginTop:10,width:"100%",padding:"12px",background:(newClass.institute.trim()&&newClass.section.trim())?G.navy:"#D1D9E0",color:(newClass.institute.trim()&&newClass.section.trim())?"#fff":"#9CA3AF",border:"none",borderRadius:9,fontSize:14,cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
            Add Class
          </button>
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
    const color=activeClass?COLORS[activeClass.colorIdx%COLORS.length]:COLORS[0];
    const dates=buildDateWindow();
    const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
          right={<>
            {activeClass&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color.bg}}/>
              <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{activeClass.section}</span>
              <span style={{fontSize:12,color:G.textM}}>· {activeClass.institute}</span>
            </div>}
            <button onClick={()=>setView("class")} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans}}>← Back</button>
          </>}
        />
        {!isEdit&&(
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"14px 28px"}}>
            <div style={{maxWidth:1280,margin:"0 auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:13,color:G.green}}>📅</span>
                <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.month} {selDateObj.year}</span>
              </div>
              <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={new Set()}/>
            </div>
          </div>
        )}
        <div style={{maxWidth:640,margin:"0 auto",padding:"28px 20px 60px"}}>
          <div style={{fontSize:9,color:G.textL,fontFamily:G.mono,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{isEdit?"Editing Entry":"New Entry For"}</div>
          <h2 style={{margin:"0 0 20px",fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>
          <div style={{background:G.greenL,borderRadius:8,padding:"8px 14px",marginBottom:18,fontSize:12,color:G.green,fontFamily:G.mono}}>👤 Logged as: <strong>{teacherName}</strong></div>
          <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:"22px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Type</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(TAG_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,tag:key})}
                    style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textM,border:`1px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:form.tag===key?600:400,transition:"all 0.12s"}}>
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
              style={{marginTop:18,background:G.navy,color:"#fff",border:"none",borderRadius:9,padding:"12px 28px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>
              {isEdit?"Save Changes":"Save Entry"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
