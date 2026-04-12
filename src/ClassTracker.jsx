import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout, syncTeacherIndex, deleteClassNotes } from "./firebase";
import { TAG_STYLES, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

// ── Design tokens (mirrors CSS vars) ─────────────────────────────────────────
const G = {
  forest:"#152B22",  forestS:"#1E3D2F",
  green:"#1B8A4C",   greenV:"#34D077",  greenL:"#E8F8EF",
  bg:"#F7F8F6",      surface:"#FFFFFF",
  border:"#E6EAE8",  borderM:"#C8D4CE",
  text:"#0E1F18",    textS:"#2D4039",  textM:"#5C7268",  textL:"#94ADA5",
  red:"#C93030",     redL:"#FDF1F1",
  navy:"#0E1F18",
  shadowSm:"0 1px 3px rgba(14,31,24,0.06),0 1px 2px rgba(14,31,24,0.04)",
  shadowMd:"0 4px 12px rgba(14,31,24,0.08),0 2px 4px rgba(14,31,24,0.04)",
  shadowLg:"0 12px 32px rgba(14,31,24,0.12),0 4px 8px rgba(14,31,24,0.06)",
  mono:"'JetBrains Mono',monospace",
  sans:"'Plus Jakarta Sans',sans-serif",
  display:"'Syne',sans-serif",
};

const COLORS = [
  {bg:"#1B8A4C",light:"#E8F8EF",text:"#0E4229"},
  {bg:"#0882B3",light:"#E0F4FB",text:"#084A6A"},
  {bg:"#C47D0A",light:"#FDF3E0",text:"#6A4200"},
  {bg:"#7040D0",light:"#EEE8FB",text:"#3C1A80"},
  {bg:"#C02828",light:"#FDEAEA",text:"#6A0E0E"},
  {bg:"#0A8A72",light:"#E0F7F3",text:"#054A3E"},
  {bg:"#C0286A",light:"#FDE8F2",text:"#700038"},
  {bg:"#2050C8",light:"#E6EDFA",text:"#102070"},
];

const DEFAULT_DATA = {classes:[],notes:{},subjects:[],institutes:[],sections:[],profile:{name:""},trash:{classes:[],notes:[]}};

// ── Academic session ──────────────────────────────────────────────────────────
function getAcademicSession(dk){const[y,m]=dk.split("-").map(Number);return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;}
function currentSession(){const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;}
function groupDatesByPeriod(dates){
  const now=new Date(),tk=todayKey();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const curS=currentSession();
  const groups={};
  dates.forEach(dk=>{
    const d=new Date(dk);
    let g;
    if(dk===tk)g="Today";
    else if(d>=weekStart)g="This Week";
    else if(d>=monthStart)g="This Month";
    else{const s=getAcademicSession(dk);g=s===curS?`Session ${curS}`:`Session ${s}`;}
    if(!groups[g])groups[g]=[];
    groups[g].push(dk);
  });
  const order=["Today","This Week","This Month",`Session ${curS}`];
  const res=[];
  order.forEach(g=>{if(groups[g])res.push({label:g,dates:groups[g]});});
  Object.keys(groups).forEach(g=>{if(!order.includes(g))res.push({label:g,dates:groups[g]});});
  return res;
}

// ── Date window ───────────────────────────────────────────────────────────────
function buildDateWindow(){
  const now=new Date(),days=[];
  for(let i=-7;i<=7;i++){
    const d=new Date(now);d.setDate(d.getDate()+i);
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const MONTHS_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
    days.push({key:`${y}-${m}-${day}`,num:d.getDate(),dayName:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()],isSun:d.getDay()===0,month:MONTHS[d.getMonth()],monthFull:MONTHS_FULL[d.getMonth()],year:d.getFullYear(),offset:i});
  }
  return days;
}
function isDateAllowed(dk){return buildDateWindow().some(d=>d.key===dk);}

// ── Ripple ────────────────────────────────────────────────────────────────────
function rpl(e,white=false){
  const el=e.currentTarget,rect=el.getBoundingClientRect();
  const s=Math.max(rect.width,rect.height)*2.8;
  const x=(e.clientX||rect.left+rect.width/2)-rect.left-s/2;
  const y=(e.clientY||rect.top+rect.height/2)-rect.top-s/2;
  const w=document.createElement("span");
  w.className="rw"+(white?" white":" dark");
  w.style.cssText=`width:${s}px;height:${s}px;left:${x}px;top:${y}px;position:absolute`;
  el.style.overflow="hidden";el.appendChild(w);w.addEventListener("animationend",()=>w.remove());
}

// ── Shared style objects ──────────────────────────────────────────────────────
const card={background:G.surface,borderRadius:16,border:`1px solid ${G.border}`,boxShadow:G.shadowSm};
const lbl={fontSize:12,color:G.textM,fontFamily:G.sans,letterSpacing:0,display:"block",marginBottom:7,textTransform:"uppercase",fontWeight:600};
const inp={width:"100%",padding:"11px 14px",borderRadius:10,border:`1px solid ${G.border}`,fontSize:15,fontFamily:G.sans,outline:"none",background:G.surface,color:G.text,marginBottom:10,transition:"border-color 0.15s, box-shadow 0.15s"};

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryBtn({onClick,children,disabled,style={},onPointerDown}){
  return(
    <button onClick={onClick} disabled={disabled} onPointerDown={onPointerDown}
      style={{background:disabled?"#C8D4CE":G.navy,color:disabled?"#8AAA98":"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:13,fontFamily:G.sans,fontWeight:600,cursor:disabled?"not-allowed":"pointer",position:"relative",overflow:"hidden",letterSpacing:0.1,...style}}>
      {children}
    </button>
  );
}

// ── Ghost button ──────────────────────────────────────────────────────────────
function GhostBtn({onClick,children,style={}}){
  return(
    <button onClick={onClick}
      style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:10,padding:"9px 16px",fontSize:13,fontFamily:G.sans,fontWeight:500,color:G.textM,cursor:"pointer",transition:"all 0.15s",...style}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;e.currentTarget.style.background=G.greenL;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;e.currentTarget.style.background="none";}}>
      {children}
    </button>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────────────────
function TopNav({user,teacherName,onEditName,right}){
  return(
    <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 32px",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(8px)"}}>
      <div className="top-nav-inner" style={{maxWidth:1320,margin:"0 auto",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:11,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,boxShadow:`0 2px 8px rgba(27,138,76,0.3)`}}>🎓</div>
          <span style={{fontSize:19,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>Class Tracker</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {right}
          <button onClick={onEditName} className="nav-teacher-name"
            style={{background:G.surface,border:`1.5px solid ${G.border}`,borderRadius:10,padding:"6px 14px",fontSize:13,cursor:"pointer",color:G.textM,fontFamily:G.sans,display:"flex",alignItems:"center",gap:9,transition:"all 0.15s",boxShadow:G.shadowSm}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;}}>
            <Avatar user={user} size={22}/>
            <span style={{fontWeight:500}}>{teacherName}</span>
            <span style={{fontSize:11,opacity:0.5}}>✏</span>
          </button>
          <button onClick={logout} style={{background:"none",border:`1px solid ${G.border}`,borderRadius:9,fontSize:12,color:G.textM,cursor:"pointer",fontFamily:G.sans,padding:"6px 13px",fontWeight:500,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=G.redL;e.currentTarget.style.color=G.red;e.currentTarget.style.borderColor="#F5CACA";}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=G.textM;e.currentTarget.style.borderColor=G.border;}}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ── Date Carousel ─────────────────────────────────────────────────────────────
function DateStrip({ selectedDate, onSelectDate, noteDates = {} }) {
  // noteDates: { "2026-04-09": 3, "2026-04-07": 1, ... }
  const dates = buildDateWindow();
  const trackRef = useRef(null);

  // Scroll selected cell to centre on mount / change
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const idx = dates.findIndex(d => d.key === selectedDate);
    if (idx < 0) return;
    // Each cell is ~82px wide + 2px gap
    const cellW = 82;
    const target = idx * cellW - track.clientWidth / 2 + cellW / 2;
    track.scrollTo({ left: target, behavior: 'smooth' });
  }, [selectedDate]);

  // Drag-to-scroll
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0 });
  const onMouseDown = e => {
    drag.current = { down: true, startX: e.pageX - trackRef.current.offsetLeft, scrollLeft: trackRef.current.scrollLeft };
  };
  const onMouseMove = e => {
    if (!drag.current.down) return;
    e.preventDefault();
    trackRef.current.scrollLeft = drag.current.scrollLeft - (e.pageX - trackRef.current.offsetLeft - drag.current.startX) * 1.1;
  };
  const onMouseUp = () => { drag.current.down = false; };

  return (
    <div className="strip-wrap">
      <div ref={trackRef} className="strip-track"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}>
        {dates.map(d => {
          const isSel   = d.key === selectedDate;
          const isToday = d.key === todayKey();
          const allowed = isDateAllowed(d.key);
          const count   = noteDates[d.key] || 0;

          let cls = "dc";
          if (isSel)    cls += " dc-sel";
          if (d.isSun)  cls += " dc-sun";
          if (!allowed) cls += " dc-dim";

          return (
            <div key={d.key} className={cls} onClick={() => allowed && onSelectDate(d.key)}>
              <div className="dc-day">{d.dayName}</div>
              <div className="dc-num">{d.num}</div>
              {isToday && isSel && <div className="dc-today">Today</div>}
              <div className="dc-area">
                {count > 0
                  ? <div className="dc-badge">{count}</div>
                  : <div className="dc-empty" />}
              </div>
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
  useEffect(()=>{const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");}};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const confirmAdd=()=>{const t=newVal.trim();if(!t)return;if(!options.includes(t))onAddOption(t);onChange(t);setNewVal("");setAdding(false);setOpen(false);};
  return(
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setAdding(false);setNewVal("");}}
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span style={{fontWeight:value?400:300}}>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:9,fontFamily:G.mono,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,boxShadow:G.shadowLg,overflow:"hidden"}}>
          <div style={{maxHeight:210,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"14px 16px",color:G.textL,fontSize:13,fontStyle:"italic"}}>No saved options yet</div>}
            {options.map(opt=>{const sel=opt===value;return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"11px 16px",cursor:"pointer",fontSize:13,color:sel?G.green:G.text,fontWeight:sel?600:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:12,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:16,color:G.green,fontSize:12,fontFamily:G.mono}}>{sel?"✓":""}</span>{opt}
              </div>);})}
          </div>
          <div style={{borderTop:`1px solid ${G.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)} style={{padding:"11px 16px",cursor:"pointer",fontSize:13,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=G.greenL} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}} placeholder={addPlaceholder} style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${G.green}`,fontSize:13,fontFamily:G.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:G.bg,color:G.textM,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 10px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile Setup ─────────────────────────────────────────────────────────────
function ProfileSetup({user,onSave}){
  const [name,setName]=useState(user.displayName||"");
  return(
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:72,height:72,borderRadius:22,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px",boxShadow:`0 8px 24px rgba(52,208,119,0.35)`}}>🎓</div>
          <h1 style={{fontSize:28,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:10,letterSpacing:-0.5}}>Welcome to Class Tracker</h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>Your name is stamped on every entry.<br/>Set it once — no one else can change it.</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"28px 26px",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
          <label style={{...lbl,color:"rgba(255,255,255,0.35)"}}>Your full name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} placeholder="e.g. Ramsingh Yadav" autoFocus
            style={{...inp,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:16}}/>
          <button onClick={()=>name.trim()&&onSave(name.trim())} disabled={!name.trim()} onPointerDown={e=>rpl(e,true)}
            style={{width:"100%",padding:"13px",background:name.trim()?G.greenV:"rgba(255,255,255,0.1)",color:name.trim()?G.forest:"rgba(255,255,255,0.3)",border:"none",borderRadius:11,fontSize:14,fontFamily:G.sans,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",position:"relative",overflow:"hidden",letterSpacing:0.2,boxShadow:name.trim()?`0 4px 16px rgba(52,208,119,0.3)`:"none"}}>
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function Modal({title,subtitle,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.45)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div className="modal-card" style={{background:G.surface,borderRadius:20,padding:"28px 26px",width:"100%",maxWidth:460,boxShadow:G.shadowLg}}>
        <div style={{marginBottom:20}}>
          <h3 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{title}</h3>
          {subtitle&&<p style={{fontSize:13,color:G.textM,fontFamily:G.sans}}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function EditNameModal({current,onSave,onClose}){
  const [name,setName]=useState(current);
  return(
    <Modal title="Edit your name" subtitle="Appears on all your class entries" onClose={onClose}>
      <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} autoFocus style={{...inp,fontSize:15}}/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>name.trim()&&onSave(name.trim())} onPointerDown={e=>rpl(e,true)}>Save Name</PrimaryBtn>
      </div>
    </Modal>
  );
}

function EditClassModal({cls,data,onSave,onClose,sortedByUsage,addInstituteName,addSectionName,addSubjectName}){
  const [section,setSection]=useState(cls.section||"");
  const [institute,setInstitute]=useState(cls.institute||"");
  const [subject,setSubject]=useState(cls.subject||"");
  return(
    <Modal title="Edit class" subtitle="Update the details for this class" onClose={onClose}>
      <label style={lbl}>Institute</label>
      <CreatableDropdown value={institute} onChange={setInstitute} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. KIS, Genesis Karnal" addPlaceholder="Type institute name…"/>
      <label style={{...lbl,marginTop:8}}>Class / Section</label>
      <CreatableDropdown value={section} onChange={setSection} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
      <label style={{...lbl,marginTop:8}}>Subject</label>
      <CreatableDropdown value={subject} onChange={setSubject} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics" addPlaceholder="Type subject…"/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>institute.trim()&&section.trim()&&onSave({section:section.trim(),institute:institute.trim(),subject:subject.trim()})} onPointerDown={e=>rpl(e,true)}>Save Changes</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ── Trash badge ───────────────────────────────────────────────────────────────
function TrashBadge({count,onClick}){
  if(count===0)return null;
  return(
    <button onClick={onClick} style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:10,padding:"6px 12px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,display:"flex",alignItems:"center",gap:5,fontWeight:500,transition:"all 0.15s",boxShadow:G.shadowSm}}
      onMouseEnter={e=>{e.currentTarget.style.background="#FAD0D0";}}
      onMouseLeave={e=>{e.currentTarget.style.background=G.redL;}}>
      🗑 <span>{count} in bin</span>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClassTracker({user}){
  const [data,setData]         = useState(DEFAULT_DATA);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState(false);
  const [view,setView]         = useState("home");
  const [activeClass,setActiveClass] = useState(null);
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [newNote,setNewNote]   = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});
  const [editNote,setEditNote] = useState(null);
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:""});
  const [search,setSearch]     = useState("");
  const [editingName,setEditingName]   = useState(false);
  const [editingClass,setEditingClass] = useState(null);
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);

  useEffect(()=>{loadUserData(user.uid).then(d=>{if(d){const merged={...DEFAULT_DATA,...d,profile:d.profile||{name:""},trash:d.trash||{classes:[],notes:[]}};setData(merged);syncTeacherIndex(user.uid,merged).catch(()=>{});}setLoading(false);});},[user.uid]);
  useEffect(()=>{
    if(loading)return;
    setSaving(true);setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{saveUserData(user.uid,data).then(()=>setSaving(false)).catch(()=>{setSaving(false);setSaveErr(true);});},1000);
    return()=>clearTimeout(saveTimer.current);
  },[data]);
  useEffect(()=>{if((view==="addNote"||view==="editNote")&&noteRef.current)noteRef.current.focus();},[view]);

  if(loading)return<Spinner text="Loading…"/>;
  if(!data.profile?.name)return<ProfileSetup user={user} onSave={name=>setData(d=>({...d,profile:{name}}))} />;

  const teacherName=data.profile.name;
  const trashCount=(data.trash?.classes||[]).length+(data.trash?.notes||[]).length;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:16,right:20,borderRadius:20,padding:"5px 14px",fontSize:11,fontFamily:G.mono,zIndex:999,background:saveErr?G.red:G.navy,color:"#fff",boxShadow:G.shadowMd,letterSpacing:0.3}}>
      {saveErr?"⚠ save failed":"saving…"}
    </div>
  ):null;

  const sortedByUsage=(opts,field)=>{const c={};(data.classes||[]).forEach(cl=>{if(cl[field])c[cl[field]]=(c[cl[field]]||0)+1;});return[...(opts||[])].sort((a,b)=>(c[b]||0)-(c[a]||0));};
  const addSubjectName  =(s)=>setData(d=>({...d,subjects:[...(d.subjects||[]),s]}));
  const addInstituteName=(s)=>setData(d=>({...d,institutes:[...(d.institutes||[]),s]}));
  const addSectionName  =(s)=>setData(d=>({...d,sections:[...(d.sections||[]),s]}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim())return;
    const id=Date.now().toString();
    setData(d=>{const inst=newClass.institute.trim(),sec=newClass.section.trim(),subj=newClass.subject.trim();return{...d,classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,colorIdx:d.classes.length%COLORS.length,created:Date.now()}],notes:{...d.notes,[id]:{}},institutes:(d.institutes||[]).includes(inst)?d.institutes||[]:[...(d.institutes||[]),inst],sections:(d.sections||[]).includes(sec)?d.sections||[]:[...(d.sections||[]),sec],subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[]};});
    setNewClass({institute:"",section:"",subject:""});setView("home");
  };
  const deleteClass=(id)=>{setData(d=>{const cls=d.classes.find(c=>c.id===id);if(!cls)return d;const tc={...cls,deletedAt:Date.now(),savedNotes:d.notes[id]||{}};return{...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id)),trash:{...d.trash,classes:[...(d.trash?.classes||[]),tc]}};});if(activeClass?.id===id){setActiveClass(null);setView("home");}};
  const updateClass=(id,updates)=>{setData(d=>({...d,classes:d.classes.map(c=>c.id===id?{...c,...updates}:c)}));if(activeClass?.id===id)setActiveClass(ac=>({...ac,...updates}));setEditingClass(null);};
  const restoreClass=(tc)=>{setData(d=>{const{deletedAt,savedNotes,...cls}=tc;return{...d,classes:[...d.classes,cls],notes:{...d.notes,[cls.id]:savedNotes||{}},trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==cls.id)}};});};
  const permDeleteClass=(id)=>{deleteClassNotes(user.uid,id).catch(()=>{});setData(d=>({...d,trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==id)}}));};

  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>(data.notes[cid]||{})[dk]||[];
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));

  const addNote=()=>{
    if(!newNote.timeStart){alert("Please enter the class start time.");return;}
    if(!newNote.title.trim()&&!newNote.body.trim())return;
    const note={id:Date.now().toString(),...newNote,teacherName,created:Date.now()};
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}};});
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("class");
  };
  const saveEdit=()=>{
    if(!editNote.timeStart){alert("Please enter the class start time.");return;}
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}};});
    setEditNote(null);setView("class");
  };
  const deleteNote=(noteId)=>setData(d=>{
    const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];
    const note=dn.find(n=>n.id===noteId);if(!note)return d;
    const tn={...note,classId:activeClass.id,className:activeClass.section,institute:activeClass.institute,dateKey:selectedDate,deletedAt:Date.now()};
    return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}},trash:{...d.trash,notes:[...(d.trash?.notes||[]),tn]}};
  });
  const restoreNote=(tn)=>{setData(d=>{const{classId,dateKey,deletedAt,className,institute,...note}=tn;const cn=d.notes[classId]||{};const dn=cn[dateKey]||[];return{...d,notes:{...d.notes,[classId]:{...cn,[dateKey]:[note,...dn]}},trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==note.id)}};});};
  const permDeleteNote=(id)=>setData(d=>({...d,trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==id)}}));

  const totalNotes=data.classes.reduce((s,c)=>{const cn=data.notes[c.id]||{};return s+Object.values(cn).reduce((a,arr)=>a+arr.length,0);},0);
  const canAdd=isDateAllowed(selectedDate);
  const dates=buildDateWindow();
  const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];

  // ── HOME ────────────────────────────────────────────────────────────────
  if(view==="home")return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <SaveBadge/>
      {editingName&&<EditNameModal current={teacherName} onSave={n=>{setData(d=>({...d,profile:{name:n}}));setEditingName(false);}} onClose={()=>setEditingName(false)}/>}
      {editingClass&&<EditClassModal cls={editingClass} data={data} onSave={u=>updateClass(editingClass.id,u)} onClose={()=>setEditingClass(null)} sortedByUsage={sortedByUsage} addInstituteName={addInstituteName} addSectionName={addSectionName} addSubjectName={addSubjectName}/>}
      <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
        right={<>
          <span style={{fontSize:13,color:G.textM,fontFamily:G.sans,fontWeight:500}}>{data.classes.length} {data.classes.length===1?"class":"classes"} · {totalNotes} entries</span>
          <TrashBadge count={trashCount} onClick={()=>setView("trash")}/>
          <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
            style={{background:G.green,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6,position:"relative",overflow:"hidden",boxShadow:`0 2px 10px rgba(27,138,76,0.3)`,transition:"box-shadow 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 16px rgba(27,138,76,0.4)`}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 2px 10px rgba(27,138,76,0.3)`}>
            <span style={{fontSize:18,lineHeight:1}}>+</span> Add Class
          </button>
        </>}
      />

      <div className="mobile-pad" style={{maxWidth:1320,margin:"0 auto",padding:"32px 32px 72px"}}>
        {/* Greeting */}
        <div style={{marginBottom:36}}>
          <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:4,fontWeight:500}}>Good day,</p>
          <h1 className="greeting-name" style={{fontSize:30,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.8,marginBottom:12}}>{teacherName} 👋</h1>
          <span style={{display:"inline-flex",alignItems:"center",gap:7,background:G.greenL,borderRadius:20,padding:"5px 14px",fontSize:13,color:G.green,fontWeight:600}}>📅 Academic Session {currentSession()}</span>
        </div>

        {data.classes.length===0?(
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:52,marginBottom:16}}>📚</div>
            <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>No classes yet</h2>
            <p style={{fontSize:14,color:G.textM,marginBottom:24}}>Add your first class to start tracking entries.</p>
            <PrimaryBtn onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)} style={{padding:"12px 28px",fontSize:14}}>+ Add First Class</PrimaryBtn>
          </div>
        ):(
          <div className="class-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {data.classes.map((cls,idx)=>{
              const color=COLORS[cls.colorIdx%COLORS.length];
              const cn=data.notes[cls.id]||{};
              const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
              const todayCount=(cn[todayKey()]||[]).length;
              return(
                <div key={cls.id} className="card-in" style={{...card,overflow:"hidden",transition:"box-shadow 0.2s,transform 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow=G.shadowMd;e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow=G.shadowSm;e.currentTarget.style.transform="none";}}>
                  {/* Color accent */}
                  <div style={{height:5,background:color.bg}}/>
                  <div style={{padding:"18px 18px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:13}}>
                        <div style={{width:46,height:46,borderRadius:13,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1}}>
                          {(cls.section||"?").slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.1,letterSpacing:-0.3}}>{cls.section}</div>
                          <div style={{fontSize:13,color:G.textM,marginTop:5,display:"flex",alignItems:"center",gap:5,fontWeight:400}}>
                            <span>🏫</span>
                            <span>{cls.institute}{cls.subject?<> <span style={{color:G.textL}}>·</span> {cls.subject}</>:null}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:3}}>
                        <button onClick={e=>{e.stopPropagation();setEditingClass(cls);}}
                          style={{background:G.bg,border:`1px solid ${G.border}`,cursor:"pointer",color:G.textM,fontSize:12,padding:"5px 11px",borderRadius:8,transition:"all 0.15s",fontFamily:G.sans,fontWeight:500}}
                          onMouseEnter={e=>{e.currentTarget.style.background=G.greenL;e.currentTarget.style.color=G.green;e.currentTarget.style.borderColor=G.green;}}
                          onMouseLeave={e=>{e.currentTarget.style.background=G.bg;e.currentTarget.style.color=G.textM;e.currentTarget.style.borderColor=G.border;}}>✏ Edit</button>
                        <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${cls.section} · ${cls.institute}"?\n\nAll ${count} entries will be moved to the Recycle Bin.`))deleteClass(cls.id);}}
                          style={{background:G.redL,border:"1px solid #F5CACA",cursor:"pointer",color:G.red,fontSize:12,padding:"5px 11px",borderRadius:8,transition:"all 0.15s",fontFamily:G.sans,fontWeight:500}}
                          onMouseEnter={e=>{e.currentTarget.style.background="#FAD0D0";e.currentTarget.style.borderColor="#EAA0A0";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=G.redL;e.currentTarget.style.borderColor="#F5CACA";}}>🗑 Delete</button>
                      </div>
                    </div>

                    <div style={{display:"flex",gap:10,marginBottom:16}}>
                      <div style={{flex:1,background:G.bg,borderRadius:10,padding:"11px 14px",border:`1px solid ${G.border}`}}>
                        <div style={{fontSize:12,color:G.textM,fontFamily:G.sans,marginBottom:4,fontWeight:600}}>TOTAL ENTRIES</div>
                        <div style={{fontSize:28,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1}}>{count}</div>
                      </div>
                      {todayCount>0&&<div style={{flex:1,background:G.greenL,borderRadius:10,padding:"11px 14px",border:`1px solid rgba(27,138,76,0.15)`}}>
                        <div style={{fontSize:12,color:G.green,fontFamily:G.sans,marginBottom:4,fontWeight:600}}>TODAY</div>
                        <div style={{fontSize:28,fontWeight:700,color:G.green,fontFamily:G.display,lineHeight:1}}>+{todayCount}</div>
                      </div>}
                    </div>

                    <button onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");setView("class");}} onPointerDown={e=>rpl(e,true)}
                      style={{width:"100%",padding:"12px 0",background:G.navy,color:"#fff",border:"none",borderRadius:10,fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden",letterSpacing:0.1,transition:"background 0.15s"}}
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
              style={{...card,minHeight:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:10,padding:28,border:`2px dashed ${G.border}`,background:"transparent",boxShadow:"none",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background="transparent";}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:G.bg,border:`2px dashed ${G.borderM}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:G.textL,transition:"all 0.2s"}}>+</div>
              <div style={{fontSize:15,fontWeight:600,color:G.textM,fontFamily:G.display}}>Add New Class</div>
              <div style={{fontSize:12,color:G.textL,textAlign:"center"}}>Manage another subject or section</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── CLASS VIEW ───────────────────────────────────────────────────────────
  if(view==="class"&&activeClass){
    const color=COLORS[activeClass.colorIdx%COLORS.length];
    const classNotes=getClassNotes(activeClass.id);
    const dateNotes=getDateNotes(activeClass.id,selectedDate);
    const filtered=dateNotes.filter(n=>!search||n.title.toLowerCase().includes(search.toLowerCase())||n.body.toLowerCase().includes(search.toLowerCase()));
    const allDates=Object.keys(classNotes).filter(dk=>classNotes[dk]?.length>0).sort((a,b)=>b.localeCompare(a));
    const totalEntries=Object.values(classNotes).reduce((s,arr)=>s+arr.length,0);
    const noteDates = Object.fromEntries(
      Object.entries(classNotes)
        .filter(([,arr]) => arr.length > 0)
        .map(([dk, arr]) => [dk, arr.length])
    );

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>
        {editingName&&<EditNameModal current={teacherName} onSave={n=>{setData(d=>({...d,profile:{name:n}}));setEditingName(false);}} onClose={()=>setEditingName(false)}/>}
        {editingClass&&<EditClassModal cls={editingClass} data={data} onSave={u=>updateClass(editingClass.id,u)} onClose={()=>setEditingClass(null)} sortedByUsage={sortedByUsage} addInstituteName={addInstituteName} addSectionName={addSectionName} addSubjectName={addSubjectName}/>}
        <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
          right={<>
            <GhostBtn onClick={()=>setView("home")}>← All Classes</GhostBtn>
            <button onClick={()=>{if(window.confirm(`Delete "${activeClass.section}"?\n\nAll ${totalEntries} entries will be moved to the Recycle Bin.`))deleteClass(activeClass.id);}}
              style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:10,padding:"7px 14px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500}}>Delete Class</button>
          </>}
        />

        {/* Mobile class switcher dropdown */}
        {data.classes.length>1&&(
          <div className="mobile-only" style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"10px 16px",alignItems:"center",gap:8,display:"flex"}}>
            <span style={{fontSize:12,color:G.textM,fontWeight:500,flexShrink:0}}>Class:</span>
            <select
              value={activeClass.id}
              onChange={e=>{const cls=data.classes.find(c=>c.id===e.target.value);if(cls){setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}}
              style={{flex:1,padding:"8px 12px",borderRadius:9,border:`1px solid ${G.border}`,fontSize:14,fontFamily:G.sans,background:G.surface,color:G.text,outline:"none",WebkitAppearance:"none"}}>
              {data.classes.map(cls=><option key={cls.id} value={cls.id}>{cls.section} — {cls.institute}</option>)}
            </select>
          </div>
        )}
        {/* Class header */}
        <div className="mobile-pad-sm" style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"20px 32px 16px"}}>
          <div style={{maxWidth:1320,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
              <div style={{width:54,height:54,borderRadius:15,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:color.bg,fontFamily:G.mono,letterSpacing:-1}}>
                {(activeClass.section||"?").slice(0,2).toUpperCase()}
              </div>
              <div className="entries-col" style={{flex:1,minWidth:0}}>
                <h2 style={{fontSize:24,fontWeight:700,color:G.text,letterSpacing:-0.5,marginBottom:4}}>{activeClass.section}</h2>
                <div style={{fontSize:14,color:G.textM,display:"flex",alignItems:"center",gap:6,marginTop:2,fontWeight:400}}>
                  <span>🏫 {activeClass.institute}</span>
                  {activeClass.subject&&<><span style={{color:G.textL}}>·</span><span>{activeClass.subject}</span></>}
                  <button onClick={()=>setEditingClass(activeClass)} style={{background:"none",border:`1px solid ${G.border}`,cursor:"pointer",color:G.textL,fontSize:12,fontFamily:G.sans,padding:"2px 8px",borderRadius:6,marginLeft:4,transition:"all 0.12s",fontWeight:500}} onMouseEnter={e=>{e.currentTarget.style.color=G.green;e.currentTarget.style.borderColor=G.green;}} onMouseLeave={e=>{e.currentTarget.style.color=G.textL;e.currentTarget.style.borderColor=G.border;}}>✏ edit</button>
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                {[{n:totalEntries,l:"entries"},{n:allDates.length,l:"days"}].map(({n,l})=>(
                  <div key={l} className="stat-box" style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"10px 18px",textAlign:"center",boxShadow:G.shadowSm}}>
                    <div style={{fontSize:24,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1}}>{n}</div>
                    <div style={{fontSize:11,color:G.textM,fontFamily:G.sans,marginTop:4,fontWeight:600}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mobile-pad" style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:13,color:G.green}}>📅</span>
              <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
            </div>
            <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/>
          </div>
        </div>

        {/* 3-column body */}
        <div className="class-view-body" style={{maxWidth:1320,margin:"0 auto",padding:"22px 32px 60px",display:"flex",gap:20,alignItems:"flex-start"}}>

          {/* LEFT — switcher */}
          <div className="class-switcher-sidebar" style={{width:210,flexShrink:0}}>
            <p style={{fontSize:12,fontFamily:G.sans,color:G.textM,marginBottom:10,textTransform:"uppercase",fontWeight:600}}>My Classes</p>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {data.classes.map(cls=>{
                const c=COLORS[cls.colorIdx%COLORS.length];
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    style={{padding:"11px 13px",borderRadius:11,cursor:"pointer",transition:"all 0.15s",background:isActive?G.greenL:G.surface,border:`1px solid ${isActive?"rgba(27,138,76,0.2)":G.border}`,borderLeft:`3px solid ${isActive?G.green:G.border}`,boxShadow:isActive?G.shadowSm:"none"}}>
                    <div style={{fontSize:14,fontWeight:isActive?700:500,color:isActive?G.green:G.textS,fontFamily:isActive?G.display:G.sans,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{fontSize:12,color:isActive?G.green:G.textM,marginTop:3,fontFamily:G.sans,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:400}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — entries */}
          <div style={{flex:1,minWidth:0}}>
            <div className="add-entry-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <h3 style={{fontSize:19,fontWeight:700,color:G.text,letterSpacing:-0.3}}>{formatDateLabel(selectedDate)}</h3>
                <p style={{fontSize:13,color:G.textM,marginTop:3,fontWeight:400}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</p>
              </div>
              {canAdd
                ?<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}} onPointerDown={e=>rpl(e,true)}
                    style={{background:G.navy,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",gap:6,position:"relative",overflow:"hidden",boxShadow:G.shadowSm,transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=G.forest}
                    onMouseLeave={e=>e.currentTarget.style.background=G.navy}>
                    <span style={{fontSize:18,lineHeight:1}}>+</span> Add Entry
                  </button>
                :<div style={{fontSize:13,color:G.textM,fontFamily:G.sans,background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px"}}>Outside ±7 day window</div>}
            </div>

            {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inp,marginBottom:14}}/>}

            {filtered.length===0&&(
              <div style={{...card,textAlign:"center",padding:"48px 20px"}}>
                <div style={{width:48,height:48,borderRadius:14,background:G.greenL,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>✏️</div>
                <p style={{fontSize:14,color:G.textM}}>{search?"No matching entries.":canAdd?'Tap "+ Add Entry" to log this class.':"No entries for this date."}</p>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map(note=>{
                const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                return(
                  <div key={note.id} style={{...card,overflow:"hidden",transition:"box-shadow 0.2s,transform 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=G.shadowMd;e.currentTarget.style.transform="translateY(-1px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow=G.shadowSm;e.currentTarget.style.transform="none";}}>
                    <div style={{height:3,background:tag.bg}}/>
                    <div style={{padding:"13px 16px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:note.title?6:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:10,borderRadius:12,padding:"2px 9px",fontFamily:G.mono,fontWeight:500}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:10,color:G.textL,fontFamily:G.mono,background:G.bg,borderRadius:12,padding:"2px 9px",border:`1px solid ${G.border}`}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:700,fontSize:16,color:G.text,fontFamily:G.display,letterSpacing:-0.2}}>{note.title}</div>}
                        </div>
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                            style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:7,padding:"4px 11px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,fontWeight:500,transition:"all 0.12s"}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;e.currentTarget.style.background=G.greenL;}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;e.currentTarget.style.background=G.bg;}}>Edit</button>
                          <button onClick={()=>deleteNote(note.id)}
                            style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:7,padding:"4px 11px",fontSize:12,cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:500}}>✕</button>
                        </div>
                      </div>
                      {note.body&&<p style={{margin:"9px 0 0",fontSize:14,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap",borderTop:`1px solid ${G.border}`,paddingTop:9}}>{note.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — grouped timeline */}
          <div className="timeline-sidebar" style={{width:215,flexShrink:0}}>
            <p style={{fontSize:12,fontFamily:G.sans,color:G.textM,marginBottom:8,textTransform:"uppercase",fontWeight:700}}>Past Entries</p>
            <span className="badge badge-session" style={{marginBottom:14,display:"inline-block"}}>Session {currentSession()}</span>
            {allDates.length===0
              ?<p style={{fontSize:12,color:G.textL,fontStyle:"italic",fontFamily:G.sans}}>No entries yet.</p>
              :<div style={{display:"flex",flexDirection:"column",gap:0}}>
                {groupDatesByPeriod(allDates).map(({label,dates:gDates})=>(
                  <div key={label} style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${G.border}`,fontWeight:700}}>{label}</div>
                    {gDates.map((dk,i)=>{
                      const entries=classNotes[dk]||[];
                      const isSel=dk===selectedDate;
                      return(
                        <div key={dk} onClick={()=>setSelectedDate(dk)}
                          style={{cursor:"pointer",display:"flex",gap:10,paddingBottom:11,position:"relative",transition:"opacity 0.1s"}}
                          onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
                          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                          {i<gDates.length-1&&<div style={{position:"absolute",left:4,top:12,bottom:0,width:1,background:G.border}}/>}
                          <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,marginTop:3,zIndex:1,transition:"all 0.15s",background:isSel?G.green:G.surface,border:`2px solid ${isSel?G.green:G.borderM}`,boxShadow:isSel?`0 0 0 3px rgba(27,138,76,0.15)`:"none"}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:isSel?600:400,color:isSel?G.green:G.textM,fontFamily:G.sans}}>{formatDateLabel(dk)}</div>
                            <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:2}}>
                              {entries.slice(0,2).map(n=>{const tag=TAG_STYLES[n.tag]||TAG_STYLES.note;return(
                                <div key={n.id} style={{fontSize:10,color:G.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:4}}>
                                  <span style={{width:5,height:5,borderRadius:"50%",background:tag.bg,flexShrink:0}}/>{n.title||n.body||"—"}
                                </div>);})}
                              {entries.length>2&&<div style={{fontSize:11,color:G.textL,fontFamily:G.sans}}>+{entries.length-2} more</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── ADD CLASS ─────────────────────────────────────────────────────────────
  if(view==="addClass")return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
        right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}
      />
      <div style={{maxWidth:520,margin:"40px auto",padding:"0 24px 80px"}}>
        <p style={{fontSize:12,color:G.textM,fontFamily:G.sans,marginBottom:6,textTransform:"uppercase",fontWeight:600}}>New Class</p>
        <h2 style={{marginBottom:28,fontSize:28,letterSpacing:-0.5,fontFamily:G.display}}>Add a class</h2>
        <div className="form-card" style={{...card,padding:"26px"}}>
          <div style={{background:G.greenL,borderRadius:10,padding:"10px 14px",marginBottom:22,fontSize:13,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
            <span>👤</span><span>Logged in as: <strong>{teacherName}</strong></span>
          </div>
          <label style={lbl}>Institute</label>
          <CreatableDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={sortedByUsage(data.institutes||[],"institute")} onAddOption={addInstituteName} placeholder="e.g. Genesis Karnal, KIS, GIS" addPlaceholder="Type institute name…"/>
          <label style={{...lbl,marginTop:10}}>Class / Section</label>
          <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
          <label style={{...lbl,marginTop:10}}>Subject</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
          <PrimaryBtn onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()} onPointerDown={e=>rpl(e,true)} style={{marginTop:12,width:"100%",padding:"13px",fontSize:14}}>Add Class</PrimaryBtn>
        </div>
      </div>
    </div>
  );

  // ── TRASH ─────────────────────────────────────────────────────────────────
  if(view==="trash"){
    const tClasses=(data.trash?.classes||[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const tNotes=(data.trash?.notes||[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const daysLeft=ts=>Math.max(0,30-Math.floor((Date.now()-ts)/(1000*60*60*24)));
    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>
        <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)} right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}/>
        <div className="mobile-pad" style={{maxWidth:880,margin:"0 auto",padding:"32px 32px 72px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <span style={{fontSize:26}}>🗑</span>
            <h2 style={{fontSize:24,letterSpacing:-0.5}}>Recycle Bin</h2>
          </div>
          <p style={{fontSize:13,color:G.textM,fontFamily:G.sans,marginBottom:28}}>Items are permanently deleted after 30 days.</p>

          {tClasses.length===0&&tNotes.length===0&&(
            <div style={{...card,textAlign:"center",padding:"72px 20px"}}>
              <div style={{fontSize:44,marginBottom:12}}>✅</div>
              <h3 style={{fontSize:18,color:G.text,fontFamily:G.display,marginBottom:6}}>Recycle bin is empty</h3>
              <p style={{fontSize:13,color:G.textM}}>Deleted classes and entries will appear here.</p>
            </div>
          )}

          {tClasses.length>0&&(
            <div style={{marginBottom:32}}>
              <p style={{fontSize:12,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Classes ({tClasses.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {tClasses.map(tc=>{
                  const color=COLORS[tc.colorIdx%COLORS.length];
                  const ec=Object.values(tc.savedNotes||{}).reduce((s,arr)=>s+arr.length,0);
                  const dl=daysLeft(tc.deletedAt);
                  return(
                    <div key={tc.id} style={{...card,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
                      <div style={{width:44,height:44,borderRadius:12,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color.bg,fontFamily:G.mono}}>
                        {(tc.section||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{tc.section}</div>
                        <div style={{fontSize:12,color:G.textM,marginTop:2}}>🏫 {tc.institute}{tc.subject?` · ${tc.subject}`:""} · {ec} entries</div>
                        <div style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:4}}>⏳ {dl} day{dl!==1?"s":""} until permanent deletion</div>
                      </div>
                      <div className="trash-row-btns" style={{display:"flex",gap:8,flexShrink:0}}>
                        <button onClick={()=>restoreClass(tc)} onPointerDown={e=>rpl(e,false)}
                          style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"8px 16px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>↩ Restore</button>
                        <button onClick={()=>{if(window.confirm("Permanently delete? Cannot be undone."))permDeleteClass(tc.id);}}
                          style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:G.sans}}>Delete Forever</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tNotes.length>0&&(
            <div>
              <p style={{fontSize:12,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Entries ({tNotes.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tNotes.map(tn=>{
                  const tag=TAG_STYLES[tn.tag]||TAG_STYLES.note;
                  const dl=daysLeft(tn.deletedAt);
                  const classExists=data.classes.some(c=>c.id===tn.classId);
                  return(
                    <div key={tn.id} style={{...card,overflow:"hidden"}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"13px 18px",display:"flex",alignItems:"flex-start",gap:14}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:9,borderRadius:10,padding:"2px 8px",fontFamily:G.mono}}>{tag.label}</span>
                            <span style={{fontSize:12,color:G.textM,fontFamily:G.sans}}>{formatDateLabel(tn.dateKey)}</span>
                            <span style={{fontSize:10,color:G.textM}}>· {tn.className} · {tn.institute}</span>
                          </div>
                          {tn.title&&<div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display}}>{tn.title}</div>}
                          {tn.body&&<div style={{fontSize:12,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tn.body}</div>}
                          <div style={{fontSize:12,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:5}}>⏳ {dl} day{dl!==1?"s":""} until permanent deletion</div>
                        </div>
                        <div style={{display:"flex",gap:8,flexShrink:0}}>
                          {classExists
                            ?<button onClick={()=>restoreNote(tn)} style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>↩ Restore</button>
                            :<span style={{fontSize:12,color:G.textL,fontFamily:G.sans,padding:"7px 4px"}}>Class deleted</span>}
                          <button onClick={()=>{if(window.confirm("Permanently delete this entry?"))permDeleteNote(tn.id);}}
                            style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"7px 12px",fontSize:12,cursor:"pointer",fontFamily:G.sans}}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
    const color=activeClass?COLORS[activeClass.colorIdx%COLORS.length]:COLORS[0];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} onEditName={()=>setEditingName(true)}
          right={<>
            {activeClass&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color.bg}}/>
              <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{activeClass.section}</span>
              <span style={{fontSize:12,color:G.textM}}>· {activeClass.institute}</span>
            </div>}
            <GhostBtn onClick={()=>setView("class")}>← Back</GhostBtn>
          </>}
        />
        {!isEdit&&(
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"16px 32px"}}>
            <div style={{maxWidth:1000,margin:"0 auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:13,color:G.green}}>📅</span>
                <span style={{fontSize:14,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
              </div>
              <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={{}}/>
            </div>
          </div>
        )}
        <div className="mobile-pad" style={{maxWidth:660,margin:"0 auto",padding:"32px 24px 72px"}}>
          <p style={{fontSize:12,color:G.textM,fontFamily:G.sans,marginBottom:5,textTransform:"uppercase",fontWeight:600}}>{isEdit?"Editing Entry":"New Entry For"}</p>
          <h2 style={{marginBottom:22,fontSize:26,letterSpacing:-0.5,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>
          <div style={{background:G.greenL,borderRadius:10,padding:"9px 14px",marginBottom:20,fontSize:13,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
            <span>👤</span><span>Logged as: <strong>{teacherName}</strong></span>
          </div>
          <div className="form-card" style={{...card,padding:"24px"}}>
            <div style={{marginBottom:18}}>
              <label style={lbl}>Type</label>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {Object.entries(TAG_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,tag:key})}
                    style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textM,border:`1.5px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:G.sans,fontWeight:form.tag===key?600:500,transition:"all 0.15s"}}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Class Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input
                  type="time"
                  value={form.timeStart||""}
                  onChange={e=>{
                    setForm({...form,timeStart:e.target.value});
                    // Auto-focus end time after start is picked (mobile clock dismisses and jumps)
                    if(e.target.value) setTimeout(()=>{ const el=document.getElementById("timeEnd"); if(el) el.focus(); },150);
                  }}
                  style={{...inp,marginBottom:0,flex:1}}
                  placeholder="Start"
                />
                <span style={{color:G.textL,fontSize:14,flexShrink:0}}>→</span>
                <input
                  id="timeEnd"
                  type="time"
                  value={form.timeEnd||""}
                  onChange={e=>setForm({...form,timeEnd:e.target.value})}
                  style={{...inp,marginBottom:0,flex:1}}
                  placeholder="End"
                />
              </div>
              {!form.timeStart&&<div style={{fontSize:11,color:G.red,marginTop:5,fontFamily:G.sans}}>Start time is required to save this entry.</div>}
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Title</label>
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inp,fontSize:15,fontWeight:500}}/>
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={6} style={{...inp,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
            </div>
            <PrimaryBtn onClick={save} disabled={!form.timeStart} onPointerDown={e=>rpl(e,true)} style={{marginTop:20,padding:"13px 28px",fontSize:14,opacity:form.timeStart?1:0.45,cursor:form.timeStart?"pointer":"not-allowed"}}>
              {isEdit?"Save Changes":"Save Entry"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
