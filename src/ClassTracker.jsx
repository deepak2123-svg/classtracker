import React, { useState, useEffect, useRef, useMemo, Component } from "react";
import { loadUserData, saveUserData, logout, syncTeacherIndex, deleteClassNotes, db, getGlobalInstitutes } from "./firebase";
import { TAG_STYLES, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

// ── Design tokens (mirrors CSS vars) ─────────────────────────────────────────
const G = {
  forest:"#152B22",  forestS:"#1E3D2F",
  green:"#1B8A4C",   greenV:"#34D077",  greenL:"#E8F8EF",
  bg:"#F5F7F5",      surface:"#FFFFFF",
  border:"#D9E4DC",  borderM:"#B8CEC2",
  // High contrast text — primary reading on mobile
  text:  "#111827",   // near-black
  textS: "#1F2937",
  textM: "#374151",   // was #5C7268 (too light) — now clearly readable
  textL: "#6B7280",   // was #94ADA5 (too faint) — now visible
  red:"#C93030",     redL:"#FDF1F1",
  navy:"#111827",
  shadowSm:"0 1px 4px rgba(14,31,24,0.08)",
  shadowMd:"0 4px 14px rgba(14,31,24,0.10)",
  shadowLg:"0 12px 32px rgba(14,31,24,0.12)",
  mono:"'JetBrains Mono',monospace",
  sans:"'Inter',sans-serif",
  display:"'Poppins',sans-serif",
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

// Stable colour per institute name (same institute always same colour)
function instColor(name) {
  if (!name) return COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return COLORS[Math.abs(h) % COLORS.length];
}

const DEFAULT_DATA = {classes:[],notes:{},subjects:[],institutes:[],sections:[],profile:{name:""},trash:{classes:[],notes:[]}};

// ── Error Boundary ────────────────────────────────────────────────────────────
class CTErrorBoundary extends Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(e){ return {error:e}; }
  render(){
    if(this.state.error) return(
      <div style={{minHeight:"100vh",background:"#F5F7F5",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:24}}>
        <div style={{textAlign:"center",maxWidth:360}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <h2 style={{fontFamily:"'Poppins',sans-serif",marginBottom:8,color:"#111827"}}>Something went wrong</h2>
          <p style={{color:"#4B5563",fontSize:14,marginBottom:16,lineHeight:1.6}}>{this.state.error?.message}</p>
          <button onClick={()=>window.location.reload()} style={{background:"#1B8A4C",color:"#fff",border:"none",borderRadius:9,padding:"10px 24px",fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
            Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}


// ── Sign Out Modal ─────────────────────────────────────────────────────────────
function SignOutModal({onConfirm,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>⏻</div>
        <h3 style={{fontSize:20,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif",marginBottom:8}}>Sign out?</h3>
        <p style={{fontSize:15,color:"#6B7280",marginBottom:24,lineHeight:1.5}}>You'll need to sign back in to access your classes and entries.</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:"12px",borderRadius:11,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif"}}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{flex:1,padding:"12px",borderRadius:11,border:"none",background:"#DC2626",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif"}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Academic session ──────────────────────────────────────────────────────────
function getAcademicSession(dk){const[y,m]=dk.split("-").map(Number);return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;}
function currentSession(){const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;const sy=m>=4?y:y-1;return `${sy}-${String(sy+1).slice(2)}`;}
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
const lbl={fontSize:14,color:G.textM,fontFamily:G.sans,letterSpacing:0,display:"block",marginBottom:7,textTransform:"uppercase",fontWeight:600};
const inp={width:"100%",padding:"11px 14px",borderRadius:10,border:`1px solid ${G.border}`,fontSize:16,fontFamily:G.sans,outline:"none",background:G.surface,color:G.text,marginBottom:10,transition:"border-color 0.15s, box-shadow 0.15s"};

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryBtn({onClick,children,disabled,style={},onPointerDown}){
  return(
    <button onClick={onClick} disabled={disabled} onPointerDown={onPointerDown}
      style={{background:disabled?"#C8D4CE":G.navy,color:disabled?"#8AAA98":"#fff",border:"none",borderRadius:10,padding:"12px 22px",fontSize:15,fontFamily:G.sans,fontWeight:600,cursor:disabled?"not-allowed":"pointer",position:"relative",overflow:"hidden",letterSpacing:0.1,minHeight:48,WebkitTapHighlightColor:"transparent",...style}}>
      {children}
    </button>
  );
}

// ── Ghost button ──────────────────────────────────────────────────────────────
function GhostBtn({onClick,children,style={}}){
  return(
    <button onClick={onClick}
      style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:10,padding:"9px 16px",fontSize:15,fontFamily:G.sans,fontWeight:500,color:G.textM,cursor:"pointer",transition:"all 0.15s",...style}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;e.currentTarget.style.background=G.greenL;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.textM;e.currentTarget.style.background="none";}}>
      {children}
    </button>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────────────────
function TopNav({user,teacherName,right}){
  const shortName=(teacherName||"").split(" ")[0];
  return(
    <div style={{background:G.forest,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(255,255,255,0.06)"}}>
      <div style={{height:54,display:"flex",alignItems:"center",padding:"0 14px",gap:10}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{width:30,height:30,borderRadius:9,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎓</div>
          <span className="desktop-only" style={{fontSize:15,fontWeight:700,color:"#fff",fontFamily:G.display,whiteSpace:"nowrap"}}>Class Tracker</span>
        </div>
        {/* Right side */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
          {right}
          {/* Teacher name */}
          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.1)",borderRadius:20,padding:"5px 10px",flexShrink:0}}>
            <Avatar user={user} size={20}/>
            <span style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",whiteSpace:"nowrap"}}>
              <span className="desktop-only">{teacherName}</span>
              <span className="mobile-inline">{shortName}</span>
            </span>
          </div>
          {/* Sign out */}
          <button onClick={()=>setSignOutPrompt(true)}
            style={{background:"rgba(220,38,38,0.18)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:8,padding:"7px 12px",cursor:"pointer",color:"#FCA5A5",fontSize:13,fontFamily:G.sans,fontWeight:600,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:15}}>⏻</span>
            <span className="desktop-only">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Minimal Date Picker (Option C) ───────────────────────────────────────────
function DatePicker({ selectedDate, onSelectDate, noteDates = {} }) {
  const [showPicker, setShowPicker] = useState(false);
  const today = todayKey();

  // Parse selectedDate
  const [y, m, d] = selectedDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dateObj.getDay()];
  const monthName = ["January","February","March","April","May","June","July","August","September","October","November","December"][m-1];
  const isToday = selectedDate === today;
  const isYesterday = selectedDate === (()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
  const entryCount = noteDates[selectedDate] || 0;

  function moveDay(delta) {
    const cur = new Date(y, m - 1, d);
    cur.setDate(cur.getDate() + delta);
    const nk = cur.toISOString().slice(0, 10);
    if (isDateAllowed(nk)) onSelectDate(nk);
  }

  const canGoBack  = isDateAllowed((()=>{const x=new Date(y,m-1,d);x.setDate(x.getDate()-1);return x.toISOString().slice(0,10);})());
  const canGoFwd   = isDateAllowed((()=>{const x=new Date(y,m-1,d);x.setDate(x.getDate()+1);return x.toISOString().slice(0,10);})());

  return (
    <div style={{userSelect:"none"}}>
      {/* Main date nav */}
      <div style={{display:"flex",alignItems:"center",gap:8,background:G.bg,borderRadius:14,padding:"10px 12px",border:`1px solid ${G.border}`}}>
        <button onClick={()=>moveDay(-1)} disabled={!canGoBack}
          style={{background:"none",border:`1px solid ${G.border}`,borderRadius:9,width:36,height:36,cursor:canGoBack?"pointer":"not-allowed",fontSize:18,color:canGoBack?G.text:G.textL,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:canGoBack?1:0.35}}>
          ‹
        </button>

        <div style={{flex:1,textAlign:"center",cursor:"pointer"}} onClick={()=>setShowPicker(s=>!s)}>
          <div style={{fontSize:13,fontWeight:700,color:G.textM,fontFamily:G.sans,marginBottom:1}}>
            {isToday?"TODAY":isYesterday?"YESTERDAY":dayName.toUpperCase()}
          </div>
          <div style={{fontSize:22,fontWeight:800,color:isToday?G.green:G.text,fontFamily:G.display,lineHeight:1,letterSpacing:-0.5}}>
            {d} {monthName.slice(0,3)} {y}
          </div>
          {entryCount>0&&(
            <div style={{fontSize:11,color:G.green,fontWeight:700,marginTop:2,fontFamily:G.sans}}>
              {entryCount} {entryCount===1?"entry":"entries"} ✓
            </div>
          )}
        </div>

        <button onClick={()=>moveDay(1)} disabled={!canGoFwd}
          style={{background:"none",border:`1px solid ${G.border}`,borderRadius:9,width:36,height:36,cursor:canGoFwd?"pointer":"not-allowed",fontSize:18,color:canGoFwd?G.text:G.textL,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:canGoFwd?1:0.35}}>
          ›
        </button>
      </div>

      {/* Quick jump pills */}
      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        {[
          {label:"Today",    key:today},
          {label:"Yesterday",key:(()=>{const x=new Date();x.setDate(x.getDate()-1);return x.toISOString().slice(0,10);})()},
          {label:"2 days ago",key:(()=>{const x=new Date();x.setDate(x.getDate()-2);return x.toISOString().slice(0,10);})()},
        ].map(({label,key})=>{
          const isSel=selectedDate===key;
          const hasE=(noteDates[key]||0)>0;
          return(
            <button key={key} onClick={()=>onSelectDate(key)}
              style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:13,fontWeight:isSel?700:500,transition:"all 0.15s",
                background:isSel?G.forest:G.surface,
                color:isSel?"#fff":G.textM,
                boxShadow:isSel?"0 2px 8px rgba(21,43,34,0.2)":"none",
                border:isSel?"none":`1px solid ${G.border}`,
                display:"flex",alignItems:"center",gap:5}}>
              {label}
              {hasE&&<span style={{width:6,height:6,borderRadius:"50%",background:isSel?"#34D077":G.green,flexShrink:0}}/>}
            </button>
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
        <span style={{color:G.textL,fontSize:11,fontFamily:G.mono,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,boxShadow:G.shadowLg,overflow:"hidden"}}>
          <div style={{maxHeight:210,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"14px 16px",color:G.textL,fontSize:15,fontStyle:"italic"}}>No saved options yet</div>}
            {options.map(opt=>{const sel=opt===value;return(
              <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"11px 16px",cursor:"pointer",fontSize:15,color:sel?G.green:G.text,fontWeight:sel?600:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:12,transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:16,color:G.green,fontSize:14,fontFamily:G.mono}}>{sel?"✓":""}</span>{opt}
              </div>);})}
          </div>
          <div style={{borderTop:`1px solid ${G.border}`}}>
            {!adding
              ?<div onClick={()=>setAdding(true)} style={{padding:"11px 16px",cursor:"pointer",fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:6,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=G.greenL} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}} placeholder={addPlaceholder} style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${G.green}`,fontSize:15,fontFamily:G.sans,outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:G.bg,color:G.textM,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,cursor:"pointer"}}>✕</button>
              </div>}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Read-only Dropdown (for admin-controlled lists) ──────────────────────────
function ReadOnlyDropdown({value, onChange, options, placeholder, emptyMsg}){
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(()=>{
    const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={wrapRef} style={{position:"relative",marginBottom:10}}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?G.text:G.textL}}>
        <span style={{fontWeight:value?500:400}}>{value||placeholder}</span>
        <span style={{color:G.textL,fontSize:11,fontFamily:G.mono,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,boxShadow:G.shadowLg,overflow:"hidden"}}>
          {options.length===0
            ?<div style={{padding:"16px",color:G.textM,fontSize:14,textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:6}}>🏫</div>
                <div style={{fontWeight:600,color:G.text,marginBottom:4}}>No institutes available</div>
                <div style={{color:G.textL,fontSize:13}}>{emptyMsg||"Ask your admin to create institutes first."}</div>
              </div>
            :<div style={{maxHeight:220,overflowY:"auto"}}>
              {options.map(opt=>{
                const sel=opt===value;
                return(
                  <div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                    style={{padding:"12px 16px",cursor:"pointer",fontSize:15,color:sel?G.green:G.text,fontWeight:sel?600:400,background:sel?G.greenL:"transparent",display:"flex",alignItems:"center",gap:12,transition:"background 0.1s"}}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=G.bg;}}
                    onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                    <span style={{width:16,color:G.green,fontSize:14,fontFamily:G.mono}}>{sel?"✓":""}</span>
                    {opt}
                  </div>
                );
              })}
            </div>
          }
          <div style={{borderTop:`1px solid ${G.border}`,padding:"8px 14px",fontSize:12,color:G.textM,display:"flex",alignItems:"center",gap:6}}>
            <span>🔒</span>
            <span>Institutes are managed by your admin</span>
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
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:72,height:72,borderRadius:22,background:G.greenV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px",boxShadow:`0 8px 24px rgba(52,208,119,0.35)`}}>🎓</div>
          <h1 style={{fontSize:30,fontWeight:700,color:"#fff",fontFamily:G.display,marginBottom:10,letterSpacing:-0.5}}>Welcome to Class Tracker</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>Your name is stamped on every entry.<br/>Set it once — no one else can change it.</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"28px 26px",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
          <label style={{...lbl,color:"rgba(255,255,255,0.6)"}}>Your full name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} placeholder="e.g. Ramsingh Yadav" autoFocus
            style={{...inp,background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:17}}/>
          <button onClick={()=>name.trim()&&onSave(name.trim())} disabled={!name.trim()} onPointerDown={e=>rpl(e,true)}
            style={{width:"100%",padding:"13px",background:name.trim()?G.greenV:"rgba(255,255,255,0.1)",color:name.trim()?G.forest:"rgba(255,255,255,0.3)",border:"none",borderRadius:11,fontSize:16,fontFamily:G.sans,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",position:"relative",overflow:"hidden",letterSpacing:0.2,boxShadow:name.trim()?`0 4px 16px rgba(52,208,119,0.3)`:"none"}}>
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
          <h3 style={{fontSize:19,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:4}}>{title}</h3>
          {subtitle&&<p style={{fontSize:15,color:G.textM,fontFamily:G.sans}}>{subtitle}</p>}
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
      <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim())} autoFocus style={{...inp,fontSize:16}}/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>name.trim()&&onSave(name.trim())} onPointerDown={e=>rpl(e,true)}>Save Name</PrimaryBtn>
      </div>
    </Modal>
  );
}

function EditClassModal({cls,data,onSave,onClose,sortedByUsage,globalInstitutes,addSectionName,addSubjectName}){
  const [section,setSection]=useState(cls.section||"");
  const [institute,setInstitute]=useState(cls.institute||"");
  const [subject,setSubject]=useState(cls.subject||"");
  return(
    <Modal title="Edit class" subtitle="Update the details for this class" onClose={onClose}>
      <label style={lbl}>Institute</label>
      <ReadOnlyDropdown value={institute} onChange={setInstitute} options={globalInstitutes.length>0?globalInstitutes:sortedByUsage(data.institutes||[],"institute")} placeholder="Select institute"/>
      <label style={{...lbl,marginTop:8}}>Class / Section</label>
      <input value={section} onChange={e=>setSection(e.target.value)}
        placeholder="e.g. 9th A, 10th B, 11th Shikhar"
        style={{...inp,fontSize:16,fontWeight:500,marginBottom:10}}
        onFocus={e=>{e.target.style.borderColor=G.green;e.target.style.boxShadow=`0 0 0 3px ${G.greenL}`;}}
        onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none";}}/>
      <label style={{...lbl,marginTop:8}}>Subject</label>
      <CreatableDropdown value={subject} onChange={setSubject} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics" addPlaceholder="Type subject…"/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={()=>institute.trim()&&section.trim()&&onSave({section:section.trim(),institute:institute.trim(),subject:subject.trim()})} onPointerDown={e=>rpl(e,true)}>Save Changes</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ── Leave Class Modal ─────────────────────────────────────────────────────────
const LEAVE_REASONS = [
  { id:"completed",  icon:"✅", label:"Completed",  desc:"Syllabus is done, this class has ended" },
  { id:"reassigned", icon:"🔄", label:"Reassigned", desc:"Another teacher has taken over this class" },
  { id:"merged",     icon:"🔀", label:"Merged",     desc:"This batch was combined with another batch" },
  { id:"onhold",     icon:"⏸", label:"On Hold",    desc:"Class is paused for now, may continue later" },
];
function LeaveClassModal({cls,onConfirm,onClose}){
  const [selected,setSelected]=useState(null);
  return(
    <Modal title="Why are you leaving this class?" subtitle={`"${cls.section} · ${cls.institute}" will be archived with this reason visible to your admin.`} onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {LEAVE_REASONS.map(r=>(
          <button key={r.id} onClick={()=>setSelected(r.id)} type="button"
            style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 14px",borderRadius:12,
              border:`1.5px solid ${selected===r.id?G.green:"#E5E5E5"}`,
              background:selected===r.id?G.greenL:G.surface,
              cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%"}}>
            <span style={{fontSize:21,lineHeight:1,flexShrink:0,marginTop:1}}>{r.icon}</span>
            <div>
              <div style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.sans,marginBottom:2}}>{r.label}</div>
              <div style={{fontSize:14,color:G.textM,fontFamily:G.sans,lineHeight:1.4}}>{r.desc}</div>
            </div>
            {selected===r.id&&<span style={{marginLeft:"auto",color:G.green,fontSize:17,flexShrink:0}}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={()=>selected&&onConfirm(selected,LEAVE_REASONS.find(r=>r.id===selected)?.label)} disabled={!selected}
          style={{background:selected?G.red:"#D5D5D5",color:"#fff",border:"none",borderRadius:10,
            padding:"9px 20px",fontSize:15,cursor:selected?"pointer":"not-allowed",
            fontFamily:G.sans,fontWeight:600,transition:"background 0.15s"}}>
          Archive Class
        </button>
      </div>
    </Modal>
  );
}

// ── Trash badge ───────────────────────────────────────────────────────────────
function TrashBadge({count,onClick}){
  if(count===0)return null;
  return(
    <button onClick={onClick} style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:10,padding:"6px 12px",fontSize:14,cursor:"pointer",color:G.red,fontFamily:G.sans,display:"flex",alignItems:"center",gap:5,fontWeight:500,transition:"all 0.15s",boxShadow:G.shadowSm}}
      onMouseEnter={e=>{e.currentTarget.style.background="#FAD0D0";}}
      onMouseLeave={e=>{e.currentTarget.style.background=G.redL;}}>
      🗑 <span>{count} in bin</span>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ClassTrackerInner({user}){
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
  // Name editing removed — name set from Google/signup only
  const [editingClass,setEditingClass] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [instFilter,      setInstFilter]      = useState("all");
  const [signOutPrompt,  setSignOutPrompt]  = useState(false);
  const [leaveModal,setLeaveModal]     = useState(null); // classId to leave
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);

  const [globalInstitutes, setGlobalInstitutes] = useState([]);
  useEffect(()=>{
    // Load admin-created institutes list
    getGlobalInstitutes().then(list => setGlobalInstitutes(list)).catch(()=>{});
  },[]);

  useEffect(()=>{
    loadUserData(user.uid).then(d=>{
      const base = d ? {...DEFAULT_DATA,...d,profile:d.profile||{name:""},trash:d.trash||{classes:[],notes:[]}} : DEFAULT_DATA;
      // Auto-apply Google display name if profile name not set
      if(!base.profile?.name && user.displayName) {
        base.profile = { name: user.displayName.trim() };
      }
      setData(base);
      if(base.profile?.name) syncTeacherIndex(user.uid,base).catch(()=>{});
      setLoading(false);
    });
  },[user.uid]);
  useEffect(()=>{
    if(loading)return;
    setSaving(true);setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{saveUserData(user.uid,data).then(()=>setSaving(false)).catch(()=>{setSaving(false);setSaveErr(true);});},1000);
    return()=>clearTimeout(saveTimer.current);
  },[data]);
  useEffect(()=>{if((view==="addNote"||view==="editNote")&&noteRef.current)noteRef.current.focus();},[view]);

  // ── Must be before any conditional returns (Rules of Hooks) ─────────────────
  const allNoteDates = useMemo(()=>{
    const map={};
    try {
      data.classes.forEach(cls=>{
        const cn=data.notes[cls.id]||{};
        Object.entries(cn).forEach(([dk,arr])=>{
          if(Array.isArray(arr)&&arr.length>0) map[dk]=(map[dk]||0)+arr.length;
        });
      });
    } catch(e){}
    return map;
  },[data]);

    if(loading)return<Spinner text="Loading…"/>;
  if(!data.profile?.name)return<ProfileSetup user={user} onSave={name=>setData(d=>({...d,profile:{name}}))} />;

  const teacherName=data.profile.name;
  const trashCount=(data.trash?.classes||[]).length+(data.trash?.notes||[]).length;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:70,right:16,borderRadius:20,padding:"5px 14px",fontSize:13,fontFamily:G.mono,zIndex:999,background:saveErr?G.red:G.navy,color:"#fff",boxShadow:G.shadowMd,letterSpacing:0.3}}>
      {saveErr?"⚠ save failed":"saving…"}
    </div>
  ):null;

  const sortedByUsage=(opts,field)=>{
    const c={};
    (data.classes||[]).forEach(cl=>{if(cl[field])c[cl[field]]=(c[cl[field]]||0)+1;});
    const base=[...(opts||[])].sort((a,b)=>(c[b]||0)-(c[a]||0));
    if(field==="institute"){
      // Return globalInstitutes if available (admin-controlled), fallback to local
      if(globalInstitutes.length>0) return globalInstitutes;
    }
    return base;
  };
  const addSubjectName  =(s)=>setData(d=>({...d,subjects:[...(d.subjects||[]),s]}));
  const addInstituteName=(s)=>setData(d=>({...d,institutes:[...(d.institutes||[]),s]}));
  const addSectionName  =(s)=>setData(d=>({...d,sections:[...(d.sections||[]),s]}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim())return;
    const id=Date.now().toString();
    setData(d=>{const inst=newClass.institute.trim(),sec=newClass.section.trim(),subj=newClass.subject.trim();return{...d,classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,colorIdx:d.classes.length%COLORS.length,created:Date.now()}],notes:{...d.notes,[id]:{}},institutes:(d.institutes||[]).includes(inst)?d.institutes||[]:[...(d.institutes||[]),inst],sections:(d.sections||[]).includes(sec)?d.sections||[]:[...(d.sections||[]),sec],subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[]};});
    setNewClass({institute:"",section:"",subject:""});setView("home");
  };
  const deleteClass=(id,leaveReason,leaveReasonLabel)=>{setData(d=>{const cls=d.classes.find(c=>c.id===id);if(!cls)return d;const tc={...cls,deletedAt:Date.now(),savedNotes:d.notes[id]||{},leaveReason:leaveReason||"",leaveReasonLabel:leaveReasonLabel||""};return{...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id)),trash:{...d.trash,classes:[...(d.trash?.classes||[]),tc]}};});if(activeClass?.id===id){setActiveClass(null);setView("home");}};
  const updateClass=(id,updates)=>{setData(d=>({...d,classes:d.classes.map(c=>c.id===id?{...c,...updates}:c)}));if(activeClass?.id===id)setActiveClass(ac=>({...ac,...updates}));setEditingClass(null);};
  const restoreClass=(tc)=>{setData(d=>{const{deletedAt,savedNotes,...cls}=tc;return{...d,classes:[...d.classes,cls],notes:{...d.notes,[cls.id]:savedNotes||{}},trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==cls.id)}};});};
  const permDeleteClass=(id)=>{deleteClassNotes(user.uid,id).catch(()=>{});setData(d=>({...d,trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==id)}}));};

  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>{ const arr=(data.notes[cid]||{})[dk]; return Array.isArray(arr)?arr:[]; };
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));

  const addNote=()=>{
    if(!newNote.timeStart){alert("Please enter the class start time.");return;}
    if(!newNote.title.trim()&&!newNote.body.trim())return;
    const note={id:Date.now().toString(),...newNote,teacherName,created:Date.now()};
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}};});
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("home");
  };
  const saveEdit=()=>{
    if(!editNote.timeStart){alert("Please enter the class start time.");return;}
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}};});
    setEditNote(null);setView("home");
  };
  const deleteNote=(noteId)=>setData(d=>{
    const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];
    const note=dn.find(n=>n.id===noteId);if(!note)return d;
    const tn={...note,classId:activeClass.id,className:activeClass.section,institute:activeClass.institute,dateKey:selectedDate,deletedAt:Date.now()};
    return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}},trash:{...d.trash,notes:[...(d.trash?.notes||[]),tn]}};
  });
  const restoreNote=(tn)=>{setData(d=>{const{classId,dateKey,deletedAt,className,institute,...note}=tn;const cn=d.notes[classId]||{};const dn=cn[dateKey]||[];return{...d,notes:{...d.notes,[classId]:{...cn,[dateKey]:[note,...dn]}},trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==note.id)}};});};
  const permDeleteNote=(id)=>setData(d=>({...d,trash:{...d.trash,notes:(d.trash?.notes||[]).filter(n=>n.id!==id)}}));

  const totalNotes=data.classes.reduce((s,c)=>{const cn=data.notes[c.id]||{};return s+Object.values(cn).reduce((a,arr)=>s+(Array.isArray(arr)?arr.length:0),0);},0);
  const canAdd=isDateAllowed(selectedDate);
  const dates=buildDateWindow();
  const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];

  // Build a noteDates map across ALL classes for the date strip dots
  // ── SINGLE SCROLLABLE HOME ───────────────────────────────────────────────
  // ── HOME VIEW — class list with institute filter ────────────────────────────
  // ── SPLIT HOME VIEW: left=classes, right=entries ───────────────────────────
  if(view==="home") {
    const activeClasses=[...data.classes.filter(c=>!c.left)].sort((a,b)=>(b.created||0)-(a.created||0));
    const institutes=[...new Set(activeClasses.map(c=>c.institute||""))].filter(Boolean);
    const filtered=instFilter==="all"?activeClasses:activeClasses.filter(c=>c.institute===instFilter);
    const selCls=activeClasses.find(c=>c.id===selectedClassId)||activeClasses[0]||null;

    // Right panel data
    const color=selCls?instColor(selCls.institute):instColor("");
    const classNotes=selCls?getClassNotes(selCls.id):{};
    const dateNotes=selCls?getDateNotes(selCls.id,selectedDate):[];
    const totalCount=Object.values(classNotes).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
    const noteDates=Object.fromEntries(Object.entries(classNotes).filter(([,arr])=>Array.isArray(arr)&&arr.length>0).map(([dk,arr])=>[dk,arr.length]));

    return(
      <div style={{height:"var(--app-height,100vh)",background:G.bg,fontFamily:G.sans,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <SaveBadge/>
        {signOutPrompt&&<SignOutModal onConfirm={()=>{setSignOutPrompt(false);logout();}} onClose={()=>setSignOutPrompt(false)}/>}
        {editingClass&&<EditClassModal cls={editingClass} data={data} onSave={u=>updateClass(editingClass.id,u)} onClose={()=>setEditingClass(null)} sortedByUsage={sortedByUsage} globalInstitutes={globalInstitutes} addSectionName={addSectionName} addSubjectName={addSubjectName}/>}
        {leaveModal&&(()=>{const cls=data.classes.find(c=>c.id===leaveModal);return cls?<LeaveClassModal cls={cls} onConfirm={(reason,label)=>{deleteClass(leaveModal,reason,label);setLeaveModal(null);}} onClose={()=>setLeaveModal(null)}/>:null;})()}

        <TopNav user={user} teacherName={teacherName}
          right={<>
            {trashCount>0&&<button onClick={()=>setView("trash")}
              style={{background:G.redL,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:4}}>
              🗑 {trashCount}
            </button>}
            <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
              style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"7px 13px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:4,boxShadow:"0 2px 8px rgba(27,138,76,0.3)"}}>
              + <span className="desktop-only">New Class</span>
            </button>
          </>}
        />

        {activeClasses.length===0?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:16}}>📚</div>
            <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>No classes yet</h2>
            <p style={{fontSize:15,color:G.textM,marginBottom:24}}>Add your first class to start logging entries.</p>
            <PrimaryBtn onClick={()=>setView("addClass")} style={{padding:"13px 32px",fontSize:16}}>+ Add First Class</PrimaryBtn>
          </div>
        ):(
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>

            {/* ── LEFT PANEL: Desktop sidebar / Mobile top strip ── */}
            <div className="mobile-left-panel"
              style={{width:260,flexShrink:0,display:"flex",flexDirection:"column",borderRight:`1px solid ${G.border}`,background:G.surface,overflow:"hidden"}}>

              {/* Greeting — desktop only */}
              <div className="desktop-only" style={{padding:"14px 14px 10px",borderBottom:`1px solid ${G.border}`,flexShrink:0,flexDirection:"column",alignItems:"flex-start",gap:4}}>
                <div style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.3}}>{teacherName} 👋</div>
                <span style={{background:G.greenL,borderRadius:20,padding:"3px 10px",fontSize:12,color:G.green,fontWeight:700}}>{currentSession()}</span>
              </div>

              {/* Mobile: horizontal pill strip */}
              <div className="mobile-only" style={{padding:"8px 12px",overflowX:"auto",display:"flex",gap:6,alignItems:"center",WebkitOverflowScrolling:"touch",flexWrap:"nowrap"}} >
                <style>{`.mobile-only{scrollbar-width:none}.mobile-only::-webkit-scrollbar{display:none}`}</style>
                {filtered.map(cls=>{
                  const ic=instColor(cls.institute);
                  const isSel=selCls?.id===cls.id;
                  const todayN=Array.isArray((data.notes[cls.id]||{})[todayKey()])?(data.notes[cls.id]||{})[todayKey()].length:0;
                  return(
                    <button key={cls.id} onClick={()=>setSelectedClassId(cls.id)}
                      style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",
                        background:isSel?ic.bg:G.bg,
                        color:isSel?"#fff":G.textS,
                        fontFamily:G.display,fontSize:13,fontWeight:isSel?700:600,
                        display:"flex",alignItems:"center",gap:6,minHeight:36,WebkitTapHighlightColor:"transparent"}}>
                      {cls.section}
                      {todayN>0&&<span style={{background:isSel?"rgba(255,255,255,0.25)":ic.light,color:isSel?"#fff":ic.bg,borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:700}}>+{todayN}</span>}
                    </button>
                  );
                })}
                <button onClick={()=>setView("addClass")}
                  style={{flexShrink:0,padding:"7px 12px",borderRadius:20,border:`2px dashed ${G.border}`,background:"transparent",color:G.textL,fontSize:13,fontWeight:600,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent"}}>
                  + New
                </button>
              </div>

              {/* Desktop: institute filter + full class list */}
              {institutes.length>1&&(
                <div className="desktop-only" style={{padding:"8px 10px",borderBottom:`1px solid ${G.border}`,display:"flex",gap:5,overflowX:"auto",flexShrink:0}}>
                  {["all",...institutes].map(inst=>{
                    const isSel=instFilter===inst;
                    const ic=inst==="all"?null:instColor(inst);
                    return(
                      <button key={inst} onClick={()=>setInstFilter(inst)}
                        style={{flexShrink:0,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:12,fontWeight:isSel?700:500,
                          background:isSel?(inst==="all"?G.forest:ic.bg):"rgba(0,0,0,0.05)",
                          color:isSel?"#fff":G.textM}}>
                        {inst==="all"?"All":inst}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="desktop-only" style={{flex:1,overflowY:"auto",padding:"8px 8px 20px",flexDirection:"column"}}>
                {filtered.map(cls=>{
                  const ic=instColor(cls.institute);
                  const isSel=selCls?.id===cls.id;
                  const tCount=Object.values(data.notes[cls.id]||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
                  const todayN=Array.isArray((data.notes[cls.id]||{})[todayKey()])?(data.notes[cls.id]||{})[todayKey()].length:0;
                  return(
                    <div key={cls.id} onClick={()=>setSelectedClassId(cls.id)}
                      style={{borderRadius:12,padding:"10px 12px",marginBottom:4,cursor:"pointer",
                        background:isSel?ic.light:"transparent",
                        borderLeft:`4px solid ${isSel?ic.bg:"transparent"}`,
                        transition:"all 0.15s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:36,height:36,borderRadius:9,background:isSel?ic.bg:ic.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isSel?"#fff":ic.bg,fontFamily:G.mono}}>
                          {(cls.section||"?").slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:isSel?ic.bg:G.text,fontFamily:G.display,letterSpacing:-0.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                          <div style={{fontSize:12,color:G.textL,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.subject||cls.institute}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:isSel?ic.bg:G.textM}}>{tCount}</div>
                          {todayN>0&&<div style={{fontSize:10,color:G.green,fontWeight:700}}>+{todayN}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div onClick={()=>setView("addClass")}
                  style={{borderRadius:12,padding:"10px 12px",marginTop:4,cursor:"pointer",border:`2px dashed ${G.border}`,display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background="transparent";}}>
                  <span style={{fontSize:18,color:G.textL}}>+</span>
                  <span style={{fontSize:13,color:G.textM,fontWeight:600}}>Add New Class</span>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL: Date picker + entries ── */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
              {!selCls?(
                <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:G.textL,fontSize:15}}>
                  Select a class from the left
                </div>
              ):(
                <>
                  {/* Class header */}
                  <div style={{padding:"14px 16px",borderBottom:`1px solid ${G.border}`,flexShrink:0,background:G.surface}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div style={{width:40,height:40,borderRadius:10,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color.bg,fontFamily:G.mono,borderLeft:`4px solid ${color.bg}`}}>
                        {(selCls.section||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{selCls.section}</div>
                        <div style={{fontSize:13,color:G.textM}}>🏫 {selCls.institute}{selCls.subject?` · ${selCls.subject}`:""} · {totalCount} total entries</div>
                      </div>
                      <button onClick={()=>setEditingClass(selCls)}
                        style={{background:G.bg,border:`1px solid ${G.border}`,cursor:"pointer",color:G.textS,fontSize:13,width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✏</button>
                      <button onClick={()=>setLeaveModal(selCls.id)}
                        style={{background:G.redL,border:"1px solid #F5CACA",cursor:"pointer",color:G.red,fontSize:13,width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🗑</button>
                    </div>
                    {/* Date picker */}
                    <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/>
                  </div>

                  {/* Entries */}
                  <div style={{flex:1,overflowY:"auto",padding:"14px 16px 40px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontSize:15,fontWeight:700,color:G.text}}>
                        {formatDateLabel(selectedDate)}
                        <span style={{color:dateNotes.length>0?G.green:G.textM,marginLeft:8,fontWeight:700}}>
                          · {dateNotes.length} {dateNotes.length===1?"entry":"entries"}
                        </span>
                      </span>
                      {canAdd&&(
                        <button onClick={()=>{setActiveClass(selCls);setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}} onPointerDown={e=>rpl(e,true)}
                          style={{background:color.bg,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                          + Add Entry
                        </button>
                      )}
                    </div>
                    {dateNotes.length===0?(
                      <div style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,padding:"40px 20px",textAlign:"center"}}>
                        <div style={{fontSize:32,marginBottom:8}}>✏️</div>
                        <div style={{fontSize:15,color:G.textM}}>{canAdd?"No entries yet — tap + Add Entry":"No entries for this date"}</div>
                      </div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {dateNotes.map(note=>{
                          const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                          return(
                            <div key={note.id} style={{background:G.surface,borderRadius:13,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm}}>
                              <div style={{height:3,background:tag.bg}}/>
                              <div style={{padding:"12px 14px"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:note.title?6:0}}>
                                      <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"2px 9px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                                      {note.timeStart&&<span style={{fontSize:12,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"2px 9px",border:`1px solid ${G.borderM}`,fontWeight:600}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                                    </div>
                                    {note.title&&<div style={{fontWeight:700,fontSize:16,color:G.text,fontFamily:G.display,lineHeight:1.3}}>{note.title}</div>}
                                    {note.body&&<p style={{margin:"6px 0 0",fontSize:14,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                                  </div>
                                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                                    <button onClick={()=>{setActiveClass(selCls);setEditNote({...note});setView("editNote");}}
                                      style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",color:G.textM}}>Edit</button>
                                    <button onClick={()=>{setActiveClass(selCls);deleteNote(note.id);}}
                                      style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:7,padding:"4px 8px",fontSize:12,cursor:"pointer",color:G.red}}>✕</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }


  if(view==="addClass")return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} 
        right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}
      />
      <div style={{maxWidth:520,margin:"0 auto",padding:"24px 16px 80px"}}>
        <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:6,textTransform:"uppercase",fontWeight:600}}>New Class</p>
        <h2 style={{marginBottom:28,fontSize:30,letterSpacing:-0.5,fontFamily:G.display}}>Add a class</h2>
        <div className="form-card" style={{...card,padding:"26px"}}>
          <div style={{background:G.greenL,borderRadius:10,padding:"10px 14px",marginBottom:22,fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
            <span>👤</span><span>Logged in as: <strong>{teacherName}</strong></span>
          </div>
          <label style={lbl}>Institute</label>
          <ReadOnlyDropdown value={newClass.institute} onChange={s=>setNewClass(c=>({...c,institute:s}))} options={globalInstitutes.length>0?globalInstitutes:sortedByUsage(data.institutes||[],"institute")} placeholder="Select your institute"/>
          <label style={{...lbl,marginTop:10}}>Class / Section</label>
          <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>
          <label style={{...lbl,marginTop:10}}>Subject</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
          <PrimaryBtn onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()} onPointerDown={e=>rpl(e,true)} style={{marginTop:12,width:"100%",padding:"13px",fontSize:16}}>Add Class</PrimaryBtn>
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
        <TopNav user={user} teacherName={teacherName} right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}/>
        <div className="mobile-pad" style={{maxWidth:880,margin:"0 auto",padding:"32px 32px 72px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <span style={{fontSize:28}}>🗑</span>
            <h2 style={{fontSize:26,letterSpacing:-0.5}}>Recycle Bin</h2>
          </div>
          <p style={{fontSize:15,color:G.textM,fontFamily:G.sans,marginBottom:28}}>Items are permanently deleted after 30 days.</p>

          {tClasses.length===0&&tNotes.length===0&&(
            <div style={{...card,textAlign:"center",padding:"72px 20px"}}>
              <div style={{fontSize:44,marginBottom:12}}>✅</div>
              <h3 style={{fontSize:19,color:G.text,fontFamily:G.display,marginBottom:6}}>Recycle bin is empty</h3>
              <p style={{fontSize:15,color:G.textM}}>Deleted classes and entries will appear here.</p>
            </div>
          )}

          {tClasses.length>0&&(
            <div style={{marginBottom:32}}>
              <p style={{fontSize:14,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Classes ({tClasses.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {tClasses.map(tc=>{
                  const color=instColor(tc.institute);
                  const ec=Object.values(tc.savedNotes||{}).reduce((s,arr)=>s+(Array.isArray(arr)?arr.length:0),0);
                  const dl=daysLeft(tc.deletedAt);
                  return(
                    <div key={tc.id} className="trash-row" style={{...card,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
                      <div style={{width:44,height:44,borderRadius:12,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:color.bg,fontFamily:G.mono}}>
                        {(tc.section||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{tc.section}</div>
                        <div style={{fontSize:14,color:G.textM,marginTop:2}}>🏫 {tc.institute}{tc.subject?` · ${tc.subject}`:""} · {ec} entries</div>
                        <div style={{fontSize:14,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:4}}>⏳ {dl} day{dl!==1?"s":""} until permanent deletion</div>
                      </div>
                      <div className="trash-row-btns" style={{display:"flex",gap:8,flexShrink:0}}>
                        <button onClick={()=>restoreClass(tc)} onPointerDown={e=>rpl(e,false)}
                          style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600,position:"relative",overflow:"hidden"}}>↩ Restore</button>
                        <button onClick={()=>{if(window.confirm("Permanently delete? Cannot be undone."))permDeleteClass(tc.id);}}
                          style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"8px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans}}>Delete Forever</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tNotes.length>0&&(
            <div>
              <p style={{fontSize:14,fontFamily:G.sans,color:G.textM,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>Deleted Entries ({tNotes.length})</p>
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
                            <span style={{background:tag.bg,color:tag.text,fontSize:11,borderRadius:10,padding:"2px 8px",fontFamily:G.mono}}>{tag.label}</span>
                            <span style={{fontSize:14,color:G.textM,fontFamily:G.sans}}>{formatDateLabel(tn.dateKey)}</span>
                            <span style={{fontSize:12,color:G.textM}}>· {tn.className} · {tn.institute}</span>
                          </div>
                          {tn.title&&<div style={{fontSize:16,fontWeight:700,color:G.text,fontFamily:G.display}}>{tn.title}</div>}
                          {tn.body&&<div style={{fontSize:14,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tn.body}</div>}
                          <div style={{fontSize:14,color:dl<=7?G.red:G.textM,fontFamily:G.sans,marginTop:5}}>⏳ {dl} day{dl!==1?"s":""} until permanent deletion</div>
                        </div>
                        <div style={{display:"flex",gap:8,flexShrink:0}}>
                          {classExists
                            ?<button onClick={()=>restoreNote(tn)} style={{background:G.greenL,border:`1px solid rgba(27,138,76,0.2)`,color:G.green,borderRadius:9,padding:"7px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>↩ Restore</button>
                            :<span style={{fontSize:14,color:G.textL,fontFamily:G.sans,padding:"7px 4px"}}>Class deleted</span>}
                          <button onClick={()=>{if(window.confirm("Permanently delete this entry?"))permDeleteNote(tn.id);}}
                            style={{background:G.redL,border:"1px solid #F5CACA",color:G.red,borderRadius:9,padding:"7px 12px",fontSize:14,cursor:"pointer",fontFamily:G.sans}}>✕</button>
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
    if(signOutPrompt) return <SignOutModal onConfirm={()=>{setSignOutPrompt(false);logout();}} onClose={()=>setSignOutPrompt(false)}/>;
    const form=isEdit?editNote:newNote;
    const setForm=isEdit?setEditNote:setNewNote;
    const save=isEdit?saveEdit:addNote;
    const color=activeClass?instColor(activeClass.institute):COLORS[0];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} 
          right={<>
            {activeClass&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color.bg}}/>
              <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{activeClass.section}</span>
              <span style={{fontSize:14,color:G.textM}}>· {activeClass.institute}</span>
            </div>}
            <GhostBtn onClick={()=>setView("home")} style={{color:"rgba(255,255,255,0.8)",borderColor:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)"}}>← Classes</GhostBtn>
          </>}
        />
        {!isEdit&&(
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"16px 32px"}}>
            <div style={{maxWidth:1000,margin:"0 auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:15,color:G.green}}>📅</span>
                <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
              </div>
              <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={{}}/>
            </div>
          </div>
        )}
        <div className="mobile-pad" style={{maxWidth:660,margin:"0 auto",padding:"32px 24px 72px"}}>
          {/* Class identity banner */}
          {activeClass&&(()=>{const ac=activeClass;const ic=instColor(ac.institute);return(
            <div style={{background:ic.light,border:`2px solid ${ic.bg}`,borderRadius:14,padding:"12px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:11,background:ic.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",fontFamily:G.mono,flexShrink:0}}>
                {(ac.section||"?").slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:ic.bg,fontFamily:G.display,lineHeight:1.1}}>{ac.section}</div>
                <div style={{fontSize:13,color:G.textM,marginTop:2}}>🏫 {ac.institute}{ac.subject?` · ${ac.subject}`:""}</div>
              </div>
            </div>
          );})()}
          <p style={{fontSize:13,color:G.textM,fontFamily:G.sans,marginBottom:4,textTransform:"uppercase",fontWeight:600,letterSpacing:0.3}}>{isEdit?"Editing Entry":"New Entry —"} {formatDateLabel(selectedDate)}</p>
          <div className="form-card" style={{...card,padding:"24px"}}>
            <div style={{marginBottom:18}}>
              <label style={lbl}>Type</label>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {Object.entries(TAG_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,tag:key})}
                    style={{background:form.tag===key?val.bg:G.surface,color:form.tag===key?val.text:G.textM,border:`1.5px solid ${form.tag===key?val.bg:G.border}`,borderRadius:20,padding:"8px 18px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:form.tag===key?600:500,transition:"all 0.15s"}}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Class Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
              {/* Step 1: Start time */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,color:G.textM,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>Start:</span>
                <input type="time" value={form.timeStart||""}
                  onChange={e=>{const s=e.target.value;const dur=form._dur||60;if(s){const [h,m]=s.split(":").map(Number);const end=new Date(2000,0,1,h,m+dur);const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");setForm({...form,timeStart:s,timeEnd:`${eh}:${em}`});}else setForm({...form,timeStart:""});}}
                  style={{...inp,marginBottom:0,flex:1,fontSize:16}}/>
              </div>
              {/* Step 2: Duration quick-select */}
              {form.timeStart&&(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:600,color:G.textM,marginBottom:6,textTransform:"uppercase",letterSpacing:0.3}}>Duration</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[45,60,75,90,105,120].map(mins=>{
                      const isSel=form._dur===mins;
                      const label=mins<60?`${mins}m`:mins===60?"1 hr":`${Math.floor(mins/60)}h ${mins%60>0?mins%60+"m":""}`;
                      return(
                        <button key={mins} onClick={()=>{
                          const [h,m]=(form.timeStart||"00:00").split(":").map(Number);
                          const end=new Date(2000,0,1,h,m+mins);
                          const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                          setForm({...form,_dur:mins,_suggestedEnd:`${eh}:${em}`,timeEnd:form.timeEnd||`${eh}:${em}`});
                        }}
                          style={{padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:13,fontWeight:isSel?700:500,
                            background:isSel?G.forest:"rgba(0,0,0,0.07)",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Step 3: End time — suggested but fully editable by user */}
              {form.timeStart&&(
                <div style={{marginTop:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:G.textM,fontWeight:600,flexShrink:0}}>Ends:</span>
                    <input type="time" value={form.timeEnd||""}
                      onChange={e=>setForm({...form,timeEnd:e.target.value,_suggestedEnd:null})}
                      style={{...inp,marginBottom:0,flex:1,fontSize:16,
                        borderColor:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.green:G.border,
                        background:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.greenL:"#fff"}}/>
                    {form.timeStart&&form.timeEnd&&(
                      <span style={{fontSize:13,color:G.green,fontWeight:700,fontFamily:G.mono,flexShrink:0,background:G.greenL,borderRadius:8,padding:"4px 8px"}}>
                        {(()=>{const[sh,sm]=(form.timeStart).split(":").map(Number);const[eh,em]=(form.timeEnd).split(":").map(Number);const d=(eh*60+em)-(sh*60+sm);return d>0?d<60?d+"m":Math.floor(d/60)+"h"+(d%60?d%60+"m":""):"";})()}
                      </span>
                    )}
                  </div>
                  {form._suggestedEnd&&form.timeEnd===form._suggestedEnd&&(
                    <div style={{fontSize:12,color:G.green,marginTop:4,fontFamily:G.sans}}>
                      ✓ Suggested — tap the time above to edit if different
                    </div>
                  )}
                </div>
              )}
              {!form.timeStart&&<div style={{fontSize:13,color:G.red,marginTop:5,fontFamily:G.sans}}>Start time is required.</div>}
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Title</label>
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inp,fontSize:16,fontWeight:500}}/>
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={6} style={{...inp,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
            </div>
            <PrimaryBtn onClick={save} disabled={!form.timeStart} onPointerDown={e=>rpl(e,true)} style={{marginTop:20,padding:"13px 28px",fontSize:16,opacity:form.timeStart?1:0.45,cursor:form.timeStart?"pointer":"not-allowed",width:"100%"}}>
              {isEdit?"Save Changes":"Save Entry"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function ClassTracker(props){
  return <CTErrorBoundary><ClassTrackerInner {...props}/></CTErrorBoundary>;
}
