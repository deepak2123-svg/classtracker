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


// ── Sign Out Modal ────────────────────────────────────────────────────────────
function SignOutModal({onConfirm,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"28px 24px",width:"100%",maxWidth:340,textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <h3 style={{fontSize:20,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif",marginBottom:8}}>Sign out?</h3>
        <p style={{fontSize:14,color:"#6B7280",marginBottom:24,lineHeight:1.6}}>You will need to sign back in to access your classes.</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",minHeight:48,fontFamily:"'Inter',sans-serif"}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#DC2626",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",minHeight:48,fontFamily:"'Inter',sans-serif"}}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

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
  for(let i=-7;i<=0;i++){
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
      style={{background:disabled?"#C8D4CE":G.navy,color:disabled?"#8AAA98":"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:15,fontFamily:G.sans,fontWeight:600,cursor:disabled?"not-allowed":"pointer",position:"relative",overflow:"hidden",letterSpacing:0.1,...style}}>
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
function TopNav({user,teacherName,right,onLogoClick,onSignOut}){
  const shortName=(teacherName||"").split(" ")[0];
  return(
    <div style={{background:G.forest,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(255,255,255,0.06)"}}>
      {/* All items same height:42, same borderRadius:10, vertically centred */}
      <div style={{height:58,display:"flex",alignItems:"center",padding:"0 12px",gap:8}}>

        {/* Logo pill */}
        <div onClick={onLogoClick}
          style={{width:42,height:42,borderRadius:10,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}
          onPointerDown={e=>{e.currentTarget.style.opacity="0.75";}}
          onPointerUp={e=>{e.currentTarget.style.opacity="1";}}
          onPointerCancel={e=>{e.currentTarget.style.opacity="1";}}>
          🎓
        </div>

        {/* Spacer */}
        <div style={{flex:1}}/>

        {/* Right group — all same height */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>

          {/* Extra right items (Back button etc.) */}
          {right}

          {/* Teacher name pill */}
          <div style={{height:42,display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"0 12px",flexShrink:0}}>
            <Avatar user={user} size={22}/>
            <span style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",whiteSpace:"nowrap",fontFamily:G.sans}}>
              <span className="desktop-only">{teacherName}</span>
              <span className="mobile-inline">{shortName}</span>
            </span>
          </div>

          {/* Sign out pill — same size, clean icon */}
          <button onClick={onSignOut}
            style={{height:42,width:42,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.2)",border:"1.5px solid rgba(220,38,38,0.45)",borderRadius:10,cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>
            {/* Clean power/exit icon using SVG — renders on all platforms */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>

        </div>
      </div>
    </div>
  );
}

// ── Minimal Date Picker (Option C) ───────────────────────────────────────────
// ── Week-in-Month Calendar ────────────────────────────────────────────────────
function DateStrip({ selectedDate, onSelectDate, noteDates = {} }) {
  const [viewYear,  setViewYear]  = useState(() => Number(selectedDate.split('-')[0]));
  const [viewMonth, setViewMonth] = useState(() => Number(selectedDate.split('-')[1]) - 1);
  const [toast,     setToast]     = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const y = Number(selectedDate.split('-')[0]);
    const m = Number(selectedDate.split('-')[1]) - 1;
    setViewYear(y); setViewMonth(m);
  }, [selectedDate]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayStr = todayKey();
  const pad = n => String(n).padStart(2,'0');
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const selDateObj   = new Date(Number(selectedDate.split('-')[0]), Number(selectedDate.split('-')[1])-1, Number(selectedDate.split('-')[2]));
  const weekSunday   = new Date(selDateObj); weekSunday.setDate(selDateObj.getDate() - selDateObj.getDay());
  const weekSaturday = new Date(weekSunday); weekSaturday.setDate(weekSunday.getDate() + 6);

  function changeMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  }

  const firstDay      = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const totalCells    = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    let date, otherMonth = false;
    if (i < firstDay) {
      date = new Date(viewYear, viewMonth - 1, prevMonthDays - firstDay + i + 1);
      otherMonth = true;
    } else if (i >= firstDay + daysInMonth) {
      date = new Date(viewYear, viewMonth + 1, i - firstDay - daysInMonth + 1);
      otherMonth = true;
    } else {
      date = new Date(viewYear, viewMonth, i - firstDay + 1);
    }
    const key      = toKey(date);
    const inWeek   = !otherMonth && date >= weekSunday && date <= weekSaturday;
    const isSel    = key === selectedDate;
    const isToday  = key === todayStr;
    const hasEntry = (noteDates[key] || 0) > 0;
    const isSun    = date.getDay() === 0;
    const allowed  = isDateAllowed(key);
    let stripe = '';
    if (inWeek) {
      const s = date.getDay() === 0 || date.getDate() === 1;
      const e = date.getDay() === 6 || date.getDate() === daysInMonth;
      stripe = s && e ? 'only' : s ? 'start' : e ? 'end' : 'mid';
    }
    cells.push({ date, key, otherMonth, inWeek, isSel, isToday, hasEntry, isSun, stripe, allowed });
  }

  const stripeStyle = (stripe) => {
    const base = { position:'absolute', top:2, bottom:2, background:'rgba(27,138,76,0.09)', zIndex:0, pointerEvents:'none' };
    if (stripe==='only')  return {...base, left:3, right:3, borderRadius:8};
    if (stripe==='start') return {...base, left:3, right:0, borderRadius:'8px 0 0 8px'};
    if (stripe==='end')   return {...base, left:0, right:3, borderRadius:'0 8px 8px 0'};
    return {...base, left:0, right:0};
  };

  return (
    <div style={{position:'relative'}}>
      <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,overflow:'hidden',maxWidth:380}}>
        {/* Month nav — compact */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px 4px'}}>
          <button onClick={()=>changeMonth(-1)}
            style={{background:'none',border:`1px solid ${G.border}`,borderRadius:7,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:G.textM,WebkitTapHighlightColor:'transparent',flexShrink:0}}>
            ‹
          </button>
          <span style={{fontFamily:G.display,fontSize:13,fontWeight:700,color:G.text}}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={()=>changeMonth(1)}
            style={{background:'none',border:`1px solid ${G.border}`,borderRadius:7,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:G.textM,WebkitTapHighlightColor:'transparent',flexShrink:0}}>
            ›
          </button>
        </div>

        {/* Day labels */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 4px'}}>
          {DAYS.map(d => (
            <div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,color:d==='Su'?G.red:G.textL,textTransform:'uppercase',padding:'2px 0',letterSpacing:0.3}}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — fixed 32px cell height */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 4px 6px',gap:1}}>
          {cells.map(({date,key,otherMonth,inWeek,isSel,isToday,hasEntry,isSun,stripe,allowed},i) => (
            <div key={i}
              onClick={() => {
                if (otherMonth) return;
                if (key > todayStr) { showToast("Can't log future dates"); return; }
                if (!allowed) { showToast("Only last 7 days can be edited"); return; }
                onSelectDate(key);
              }}
              style={{
                position:'relative', height:34,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                borderRadius:8,
                cursor:(otherMonth||!allowed||key>todayStr)?'default':'pointer',
                opacity:otherMonth?0.15:(!allowed||key>todayStr)?0.25:1,
                WebkitTapHighlightColor:'transparent',
                touchAction:'manipulation', userSelect:'none', WebkitUserSelect:'none',
                background: isSel||isToday ? G.forest : 'transparent',
                boxShadow: isSel||isToday ? '0 2px 8px rgba(21,43,34,0.2)' : 'none',
                transition:'transform 0.1s',
              }}
              onPointerDown={e=>{if(!otherMonth&&allowed&&key<=todayStr)e.currentTarget.style.transform='scale(0.85)';}}
              onPointerUp={e=>{e.currentTarget.style.transform='scale(1)';}}
              onPointerCancel={e=>{e.currentTarget.style.transform='scale(1)';}}>

              {inWeek && !isSel && !isToday && stripe && (
                <div style={stripeStyle(stripe)}/>
              )}

              <span style={{
                position:'relative', zIndex:1,
                fontSize:12, lineHeight:1,
                fontWeight: isSel||isToday ? 800 : inWeek ? 700 : 400,
                color: isSel||isToday ? '#fff' : isSun ? G.red : inWeek ? G.text : G.textL,
                fontFamily: G.display,
              }}>
                {date.getDate()}
              </span>

              {hasEntry && (
                <div style={{
                  position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)',
                  width:3, height:3, borderRadius:'50%',
                  background: isSel||isToday ? '#34D077' : G.green, zIndex:1,
                }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'rgba(21,43,34,0.93)',color:'#fff',borderRadius:20,padding:'8px 18px',fontSize:13,fontWeight:600,whiteSpace:'nowrap',zIndex:9999,pointerEvents:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.25)'}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Read-only Dropdown (for admin-controlled lists) ──────────────────────────
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

// ── Export Modal ──────────────────────────────────────────────────────────────
function ExportModal({data, teacherName, onClose}){
  const [period,  setPeriod]  = React.useState("month"); // day | week | month
  const [format,  setFormat]  = React.useState("pdf");   // pdf | excel
  const [selMonth,setSelMonth]= React.useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  const [selWeek, setSelWeek] = React.useState(()=>todayKey());
  const [selDay,  setSelDay]  = React.useState(()=>todayKey());
  const [busy,    setBusy]    = React.useState(false);

  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Collect entries within the selected range
  function getEntries(){
    const rows=[];
    const now=new Date();

    let from, to;
    if(period==="day"){
      from=new Date(selDay); to=new Date(selDay);
    } else if(period==="week"){
      const d=new Date(selWeek);
      const day=d.getDay();
      from=new Date(d); from.setDate(d.getDate()-day);
      to=new Date(from); to.setDate(from.getDate()+6);
    } else {
      const [y,m]=selMonth.split("-").map(Number);
      from=new Date(y,m-1,1); to=new Date(y,m,0);
    }

    const pad=n=>String(n).padStart(2,"0");
    const toKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    // Iterate each day in range
    const cur=new Date(from);
    while(cur<=to){
      const dk=toKey(cur);
      data.classes.filter(c=>!c.left).forEach(cls=>{
        const dayNotes=(data.notes[cls.id]||{})[dk]||[];
        dayNotes.forEach(note=>{
          rows.push({
            date:dk,
            class:cls.section,
            institute:cls.institute,
            subject:cls.subject,
            type:note.tag||"note",
            time:note.timeStart?(note.timeEnd?`${note.timeStart} - ${note.timeEnd}`:note.timeStart):"",
            title:note.title||"",
            notes:note.body||"",
          });
        });
      });
      cur.setDate(cur.getDate()+1);
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date));
  }

  function periodLabel(){
    if(period==="day") return selDay;
    if(period==="week"){
      const d=new Date(selWeek);
      const day=d.getDay();
      const sun=new Date(d); sun.setDate(d.getDate()-day);
      const sat=new Date(sun); sat.setDate(sun.getDate()+6);
      const f=x=>`${x.getDate()} ${MONTHS[x.getMonth()].slice(0,3)}`;
      return `${f(sun)} – ${f(sat)} ${sat.getFullYear()}`;
    }
    const [y,m]=selMonth.split("-").map(Number);
    return `${MONTHS[m-1]} ${y}`;
  }

  function exportPDF(){
    const rows=getEntries();
    const label=periodLabel();
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:12px}
  h1{font-size:18px;margin-bottom:4px}
  .sub{color:#666;margin-bottom:20px;font-size:12px}
  table{width:100%;border-collapse:collapse}
  th{background:#152B22;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .empty{text-align:center;padding:40px;color:#999}
</style></head><body>
<h1>ClassLog — ${teacherName}</h1>
<div class="sub">${label} · Exported ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
${rows.length===0
  ? '<div class="empty">No entries found for this period.</div>'
  : `<table><thead><tr><th>Date</th><th>Class</th><th>Institute</th><th>Subject</th><th>Time</th><th>Title</th><th>Notes</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.date}</td><td>${r.class}</td><td>${r.institute}</td><td>${r.subject}</td><td style="white-space:nowrap">${r.time}</td><td><strong>${r.title}</strong></td><td>${r.notes}</td></tr>`).join("")}
</tbody></table>`}
</body></html>`;

    const w=window.open("","_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(),400);
  }

  function exportExcel(){
    const rows=getEntries();
    const label=periodLabel();
    // Build CSV (opens in Excel on all platforms)
    const headers=["Date","Class","Institute","Subject","Time","Title","Notes"];
    const escape=v=>(`"${String(v||"").replace(/"/g,'""')}"`);
    const csv=[
      `ClassLog Export — ${teacherName} — ${label}`,
      "",
      headers.join(","),
      ...rows.map(r=>[r.date,r.class,r.institute,r.subject,r.time,r.title,r.notes].map(escape).join(","))
    ].join("\r\n");

    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`ClassLog_${teacherName.replace(/ /g,"_")}_${label.replace(/ /g,"_").replace(/–/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doExport(){
    setBusy(true);
    setTimeout(()=>{
      if(format==="pdf") exportPDF();
      else exportExcel();
      setBusy(false);
      onClose();
    },100);
  }

  const inp2={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid #D9E4DC`,fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",background:"#F5F7F5",color:"#111827"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 22px",width:"100%",maxWidth:380,boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:46,height:46,borderRadius:13,background:"#E8F8EF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📤</div>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif"}}>Export Entries</div>
            <div style={{fontSize:13,color:"#6B7280"}}>PDF or Excel-friendly CSV</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9CA3AF",lineHeight:1}}>✕</button>
        </div>

        {/* Period selector */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Period</div>
          <div style={{display:"flex",gap:6}}>
            {[["day","Daily"],["week","Weekly"],["month","Monthly"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)}
                style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:period===k?700:500,
                  background:period===k?"#152B22":"rgba(0,0,0,0.06)",color:period===k?"#fff":"#374151",transition:"all 0.15s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker for period */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
            {period==="day"?"Date":period==="week"?"Any day in the week":"Month"}
          </div>
          {period==="month"&&(
            <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={inp2}/>
          )}
          {period==="week"&&(
            <input type="date" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={inp2}/>
          )}
          {period==="day"&&(
            <input type="date" value={selDay} onChange={e=>setSelDay(e.target.value)} style={inp2}/>
          )}
        </div>

        {/* Format selector */}
        <div style={{marginBottom:22}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Format</div>
          <div style={{display:"flex",gap:8}}>
            {[["pdf","📄 PDF"],["excel","📊 Excel / CSV"]].map(([k,l])=>(
              <button key={k} onClick={()=>setFormat(k)}
                style={{flex:1,padding:"12px 0",borderRadius:12,border:`2px solid ${format===k?"#1B8A4C":"#D9E4DC"}`,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:format===k?700:500,
                  background:format===k?"#E8F8EF":"transparent",color:format===k?"#1B8A4C":"#374151",transition:"all 0.15s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Preview summary */}
        <div style={{background:"#F5F7F5",borderRadius:12,padding:"10px 14px",marginBottom:20,fontSize:13,color:"#374151"}}>
          📅 <strong>{periodLabel()}</strong> · {format==="pdf"?"Opens print dialog":"Downloads .csv file"}
        </div>

        {/* Buttons */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif"}}>
            Cancel
          </button>
          <button onClick={doExport} disabled={busy}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#1B8A4C",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",opacity:busy?0.7:1}}>
            {busy?"Preparing…":"Export"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Time suggestion: same day-of-week first, fall back to most recent if no DOW history ──
function getSuggestedTime(notes, classId, dateKey) {
  const dayOfWeek = new Date(dateKey).getDay();
  const classNotes = notes[classId] || {};

  function buildFreq(filterFn) {
    const freq = {};
    Object.entries(classNotes).forEach(([dk, entries]) => {
      if (!Array.isArray(entries)) return;
      if (!filterFn(dk)) return;
      entries.forEach(e => {
        if (!e.timeStart) return;
        let dur = 60;
        if (e.timeEnd) {
          const [sh, sm] = e.timeStart.split(':').map(Number);
          const [eh, em] = e.timeEnd.split(':').map(Number);
          const d = (eh * 60 + em) - (sh * 60 + sm);
          if (d > 0) dur = d;
        }
        const k = e.timeStart + '|' + dur;
        freq[k] = (freq[k] || 0) + 1;
      });
    });
    return freq;
  }

  function freqToSuggestion(freq) {
    if (!Object.keys(freq).length) return null;
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    const [timeStart, durStr] = best.split('|');
    const dur = parseInt(durStr);
    const [h, m] = timeStart.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + dur);
    const eh = String(end.getHours()).padStart(2, '0');
    const em2 = String(end.getMinutes()).padStart(2, '0');
    return { timeStart, timeEnd: eh + ':' + em2, _dur: dur, _suggested: true };
  }

  // 1st: try same day of week
  const dowFreq = buildFreq(dk => new Date(dk).getDay() === dayOfWeek);
  if (Object.keys(dowFreq).length) return freqToSuggestion(dowFreq);

  // 2nd: fall back to all days (until a week's worth of data is built)
  const allFreq = buildFreq(() => true);
  return freqToSuggestion(allFreq);
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
  const [instFilter,      setInstFilter]      = useState("all"); // institute filter on home
  const [leaveModal,setLeaveModal]     = useState(null);
  const [signOutPrompt,setSignOutPrompt] = useState(false);
  const [exportOpen,setExportOpen]       = useState(false);
  const [isMobile,setIsMobile]           = useState(window.innerWidth < 768);
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
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

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
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("classDetail");
  };
  const saveEdit=()=>{
    if(!editNote.timeStart){alert("Please enter the class start time.");return;}
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}};});
    setEditNote(null);setView("classDetail");
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
  // ══════════════════════════════════════════════════════════════════════
  // SHARED MODALS — used in both pages
  // ══════════════════════════════════════════════════════════════════════
  const sharedModals = (
    <>
      <SaveBadge/>
      {signOutPrompt && <SignOutModal onConfirm={()=>{setSignOutPrompt(false);logout();}} onClose={()=>setSignOutPrompt(false)}/>}
      {exportOpen && <ExportModal data={data} teacherName={teacherName} onClose={()=>setExportOpen(false)}/>}
      {editingClass && <EditClassModal cls={editingClass} data={data} onSave={u=>updateClass(editingClass.id,u)} onClose={()=>setEditingClass(null)} sortedByUsage={sortedByUsage} globalInstitutes={globalInstitutes} addSectionName={addSectionName} addSubjectName={addSubjectName}/>}
      {leaveModal && (()=>{const cls=data.classes.find(c=>c.id===leaveModal);return cls?<LeaveClassModal cls={cls} onConfirm={(reason,label)=>{deleteClass(leaveModal,reason,label);setLeaveModal(null);setActiveClass(null);setView("home");}} onClose={()=>setLeaveModal(null)}/>:null;})()}
    </>
  );

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 1 — HOME: class list
  // Mobile:  full-screen scrollable list, tap → go to class page
  // Tablet+: left sidebar + right entries panel (split view)
  // ══════════════════════════════════════════════════════════════════════
  if(view==="home"){
    const activeClasses=[...data.classes.filter(c=>!c.left)].sort((a,b)=>(b.created||0)-(a.created||0));
    const institutes=[...new Set(activeClasses.map(c=>c.institute||""))].filter(Boolean);
    const filtered=instFilter==="all"?activeClasses:activeClasses.filter(c=>c.institute===instFilter);

    // For tablet/desktop split view
    const selCls=activeClasses.find(c=>c.id===activeClass?.id)||activeClasses[0]||null;
    const selColor=selCls?instColor(selCls.institute):instColor("");
    const selNotes=selCls?getClassNotes(selCls.id):{};
    const selDateNotes=selCls?getDateNotes(selCls.id,selectedDate):[];
    const selTotal=Object.values(selNotes).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
    const selNoteDates=Object.fromEntries(Object.entries(selNotes).filter(([,arr])=>Array.isArray(arr)&&arr.length>0).map(([dk,arr])=>[dk,arr.length]));

    // Nav buttons — same on all screen sizes
    const NavRight = <>
      {trashCount>0&&<button onClick={()=>setView("trash")}
        style={{background:G.redL,border:"none",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:G.red,fontFamily:G.sans,fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent"}}>
        🗑 {trashCount}
      </button>}
      <button onClick={()=>setView("stats")}
        style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"7px 10px",cursor:"pointer",color:"rgba(255,255,255,0.85)",display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
        <span className="desktop-only" style={{display:"inline",fontSize:13,fontWeight:600}}>Stats</span>
      </button>
      <button onClick={()=>setExportOpen(true)}
        style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"7px 10px",cursor:"pointer",color:"rgba(255,255,255,0.85)",display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span className="desktop-only" style={{display:"inline",fontSize:13,fontWeight:600}}>Export</span>
      </button>
      <button onClick={()=>setView("addClass")} onPointerDown={e=>rpl(e,true)}
        style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",boxShadow:"0 2px 8px rgba(27,138,76,0.3)"}}>
        + <span style={{display:"none"}} className="desktop-show"> New Class</span>
      </button>
    </>;

    // Shared class card — click goes to class detail page (mobile) or selects (desktop)
    const ClassCard = ({cls, onClick}) => {
      const ic=instColor(cls.institute);
      const total=Object.values(data.notes[cls.id]||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
      const todayArr=(data.notes[cls.id]||{})[todayKey()];
      const todayN=Array.isArray(todayArr)?todayArr.length:0;
      return(
        <div onClick={onClick}
          style={{background:G.surface,borderRadius:16,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"transform 0.1s,box-shadow 0.1s"}}
          onPointerDown={e=>{e.currentTarget.style.transform="scale(0.98)";e.currentTarget.style.boxShadow="none";}}
          onPointerUp={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowSm;}}
          onPointerCancel={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowSm;}}>
          <div style={{height:4,background:ic.bg}}/>
          <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:46,height:46,borderRadius:12,background:ic.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:ic.bg,fontFamily:G.mono}}>
              {(cls.section||"?").slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.2,marginBottom:3}}>{cls.section}</div>
              <div style={{fontSize:14,color:G.textM}}>🏫 {cls.institute}{cls.subject?" · "+cls.subject:""}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{total}</div>
              <div style={{fontSize:11,color:G.textL,fontWeight:600}}>entries</div>
              {todayN>0&&<div style={{background:G.greenL,color:G.green,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700,marginTop:3}}>+{todayN} today</div>}
            </div>
            {/* Arrow hint — tap to open */}
            <div style={{color:G.textL,fontSize:20,flexShrink:0,paddingLeft:4}}>›</div>
          </div>
        </div>
      );
    };

    // Institute filter pills
    const InstFilter = () => institutes.length>1?(
      <div style={{display:"flex",gap:7,overflowX:"auto",WebkitOverflowScrolling:"touch",padding:"0 0 2px"}} className="hide-scrollbar">
        {["all",...institutes].map(inst=>{
          const isSel=instFilter===inst;
          const ic=inst==="all"?null:instColor(inst);
          return(
            <button key={inst} onClick={()=>setInstFilter(inst)}
              style={{flexShrink:0,padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:13,fontWeight:isSel?700:500,minHeight:36,WebkitTapHighlightColor:"transparent",transition:"all 0.15s",
                background:isSel?(inst==="all"?G.forest:ic.bg):"rgba(0,0,0,0.07)",
                color:isSel?"#fff":G.textM}}>
              {inst==="all"?"All Classes":inst}
            </button>
          );
        })}
      </div>
    ):null;

    // ── MOBILE VIEW: full-page class list ────────────────────────────────────
    const MobileHome = () => (
      <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
        {/* Greeting */}
        <div style={{padding:"18px 16px 12px"}}>
          <h1 style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,letterSpacing:-0.5,marginBottom:6}}>{teacherName} 👋</h1>
          <span style={{background:G.greenL,borderRadius:20,padding:"4px 12px",fontSize:13,color:G.green,fontWeight:700}}>📅 {currentSession()}</span>
        </div>
        {/* Filter */}
        {institutes.length>1&&<div style={{padding:"0 16px 14px"}}><InstFilter/></div>}
        {/* Class list */}
        <div style={{flex:1,overflowY:"auto",padding:"0 14px 100px",WebkitOverflowScrolling:"touch"}}>
          {activeClasses.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:52,marginBottom:16}}>📚</div>
              <h2 style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>No classes yet</h2>
              <p style={{fontSize:15,color:G.textM,marginBottom:24}}>Add your first class to start tracking.</p>
              <PrimaryBtn onClick={()=>setView("addClass")} style={{padding:"13px 32px",fontSize:16}}>+ Add First Class</PrimaryBtn>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {filtered.map(cls=>(
                <ClassCard key={cls.id} cls={cls} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setView("classDetail");}}/>
              ))}
              <div onClick={()=>setView("addClass")}
                style={{borderRadius:16,border:`2px dashed ${G.border}`,padding:"20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",background:"transparent",WebkitTapHighlightColor:"transparent"}}
                onPointerDown={e=>{e.currentTarget.style.background=G.greenL;e.currentTarget.style.borderColor=G.green;}}
                onPointerUp={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=G.border;}}
                onPointerCancel={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=G.border;}}>
                <span style={{fontSize:22,color:G.textL}}>+</span>
                <span style={{fontSize:15,fontWeight:600,color:G.textM,fontFamily:G.display}}>Add New Class</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );

    // ── TABLET / DESKTOP VIEW: sidebar + detail panel ────────────────────────
    const SplitView = () => (
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left sidebar */}
        <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",borderRight:`1px solid ${G.border}`,background:G.surface,overflow:"hidden"}}>
          <div style={{padding:"16px 14px 12px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:5}}>{teacherName} 👋</div>
            <span style={{background:G.greenL,borderRadius:20,padding:"3px 10px",fontSize:12,color:G.green,fontWeight:700}}>{currentSession()}</span>
          </div>
          {institutes.length>1&&<div style={{padding:"8px 10px",borderBottom:`1px solid ${G.border}`,display:"flex",gap:5,overflowX:"auto",flexShrink:0}} className="hide-scrollbar">
            {["all",...institutes].map(inst=>{const isSel=instFilter===inst;const ic=inst==="all"?null:instColor(inst);return(
              <button key={inst} onClick={()=>setInstFilter(inst)} style={{flexShrink:0,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:12,fontWeight:isSel?700:500,background:isSel?(inst==="all"?G.forest:ic.bg):"rgba(0,0,0,0.05)",color:isSel?"#fff":G.textM}}>{inst==="all"?"All":inst}</button>
            );})}
          </div>}
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {filtered.map(cls=>{
              const ic=instColor(cls.institute);
              const isSel=selCls?.id===cls.id;
              const total=Object.values(data.notes[cls.id]||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
              const todayN=Array.isArray((data.notes[cls.id]||{})[todayKey()])?(data.notes[cls.id]||{})[todayKey()].length:0;
              return(
                <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());}}
                  style={{borderRadius:12,padding:"10px 12px",marginBottom:4,cursor:"pointer",background:isSel?ic.light:"transparent",borderLeft:`4px solid ${isSel?ic.bg:"transparent"}`,transition:"all 0.12s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:36,height:36,borderRadius:9,background:isSel?ic.bg:ic.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isSel?"#fff":ic.bg,fontFamily:G.mono}}>{(cls.section||"?").slice(0,2).toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:isSel?ic.bg:G.text,fontFamily:G.display,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                      <div style={{fontSize:12,color:G.textL,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.subject||cls.institute}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:isSel?ic.bg:G.textM}}>{total}</div>
                      {todayN>0&&<div style={{fontSize:10,color:G.green,fontWeight:700}}>+{todayN}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div onClick={()=>setView("addClass")} style={{borderRadius:12,padding:"10px 12px",marginTop:4,cursor:"pointer",border:`2px dashed ${G.border}`,display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.background=G.greenL;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:18,color:G.textL}}>+</span><span style={{fontSize:13,color:G.textM,fontWeight:600}}>Add New Class</span>
            </div>
          </div>
        </div>
        {/* Right detail panel */}
        {!selCls?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:G.textL,fontSize:15}}>Select a class from the left</div>
        ):(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${G.border}`,background:G.surface,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:selColor.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:selColor.bg,fontFamily:G.mono,borderLeft:`4px solid ${selColor.bg}`}}>{(selCls.section||"?").slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display}}>{selCls.section}</div>
                  <div style={{fontSize:13,color:G.textM}}>🏫 {selCls.institute}{selCls.subject?" · "+selCls.subject:""} · {selTotal} total entries</div>
                </div>
                <button onClick={()=>setEditingClass(selCls)} style={{background:G.bg,border:`1px solid ${G.border}`,cursor:"pointer",color:G.textS,fontSize:13,width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✏</button>
                <button onClick={()=>setLeaveModal(selCls.id)} style={{background:G.redL,border:"1px solid #F5CACA",cursor:"pointer",color:G.red,fontSize:13,width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🗑</button>
              </div>
              <div style={{maxWidth:420}}><DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={selNoteDates}/></div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 18px 40px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:15,fontWeight:700,color:G.text}}>{formatDateLabel(selectedDate)}<span style={{color:selDateNotes.length>0?G.green:G.textM,marginLeft:8}}>· {selDateNotes.length} {selDateNotes.length===1?"entry":"entries"}</span></span>
                {canAdd&&<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",...(getSuggestedTime(data.notes,activeClass.id,selectedDate)||{_dur:activeClass?.duration||60})});setView("addNote");}} onPointerDown={e=>rpl(e,true)} style={{background:selColor.bg,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>+ Add Entry</button>}
              </div>
              {selDateNotes.length===0?(
                <div style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,padding:"40px 20px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>✏️</div>
                  <div style={{fontSize:15,color:G.textM}}>{canAdd?"No entries yet — click + Add Entry":"No entries for this date"}</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {selDateNotes.map(note=>{const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;return(
                    <div key={note.id} style={{background:G.surface,borderRadius:13,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm}}>
                      <div style={{height:3,background:tag.bg}}/>
                      <div style={{padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:note.title?6:0}}>
                              <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"2px 9px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                              {note.timeStart&&<span style={{fontSize:12,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"2px 9px",border:`1px solid ${G.borderM}`,fontWeight:600}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            </div>
                            {note.title&&<div style={{fontWeight:700,fontSize:16,color:G.text,fontFamily:G.display}}>{note.title}</div>}
                            {note.body&&<p style={{margin:"6px 0 0",fontSize:14,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                              style={{background:G.bg,border:`1px solid ${G.borderM}`,borderRadius:9,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",color:G.textS,fontFamily:G.sans,minHeight:36,WebkitTapHighlightColor:"transparent"}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;e.currentTarget.style.background=G.greenL;}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor=G.borderM;e.currentTarget.style.color=G.textS;e.currentTarget.style.background=G.bg;}}>
                              Edit
                            </button>
                            <button onClick={()=>deleteNote(note.id)}
                              style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:9,padding:"7px 12px",fontSize:13,fontWeight:600,cursor:"pointer",color:G.red,fontFamily:G.sans,minHeight:36,WebkitTapHighlightColor:"transparent"}}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );

    return(
      <div style={{height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} right={NavRight}/>
        {isMobile ? <MobileHome/> : <SplitView/>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2 — CLASS DETAIL (mobile only — tap class → here)
  // ══════════════════════════════════════════════════════════════════════
  if(view==="classDetail" && activeClass){
    const cls=activeClass;
    const color=instColor(cls.institute);
    const classNotes=getClassNotes(cls.id);
    const dateNotes=getDateNotes(cls.id,selectedDate);
    const totalCount=Object.values(classNotes).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
    const noteDates=Object.fromEntries(Object.entries(classNotes).filter(([,arr])=>Array.isArray(arr)&&arr.length>0).map(([dk,arr])=>[dk,arr.length]));
    return(
      <div style={{height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
          right={<GhostBtn onClick={()=>setView("home")} style={{color:"rgba(255,255,255,0.85)",borderColor:"rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.1)"}}>← Classes</GhostBtn>}
        />
        {/* Class header */}
        <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"14px 16px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:46,height:46,borderRadius:12,background:color.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:color.bg,fontFamily:G.mono,borderLeft:`4px solid ${color.bg}`}}>
              {(cls.section||"?").slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:20,fontWeight:700,color:G.text,fontFamily:G.display}}>{cls.section}</div>
              <div style={{fontSize:14,color:G.textM}}>🏫 {cls.institute}{cls.subject?" · "+cls.subject:""} · {totalCount} entries</div>
            </div>
            <button onClick={()=>setEditingClass(cls)} style={{background:G.bg,border:`1px solid ${G.border}`,cursor:"pointer",color:G.textS,fontSize:14,width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>✏</button>
            <button onClick={()=>setLeaveModal(cls.id)} style={{background:G.redL,border:"1px solid #F5CACA",cursor:"pointer",color:G.red,fontSize:14,width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>🗑</button>
          </div>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/>
        </div>
        {/* Entries scroll area */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px 16px",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>{formatDateLabel(selectedDate)}</div>
              <div style={{fontSize:13,color:dateNotes.length>0?G.green:G.textM,fontWeight:600,marginTop:2}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
            </div>
            {canAdd&&<button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",...(getSuggestedTime(data.notes,activeClass.id,selectedDate)||{_dur:activeClass?.duration||60})});setView("addNote");}} onPointerDown={e=>rpl(e,true)}
              style={{background:color.bg,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:6,minHeight:48,WebkitTapHighlightColor:"transparent",boxShadow:`0 4px 14px ${color.bg}55`,flexShrink:0}}>
              + Add Entry
            </button>}
          </div>
          {dateNotes.length===0?(
            <div style={{background:G.surface,borderRadius:16,border:`2px dashed ${G.border}`,padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>✏️</div>
              <div style={{fontSize:16,color:G.textM,fontWeight:500}}>{canAdd?"No entries yet":"No entries for this date"}</div>
              {canAdd&&<div style={{fontSize:14,color:G.textL,marginTop:6}}>Tap + Add Entry to log this class</div>}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {dateNotes.map(note=>{
                const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                return(
                  <div key={note.id} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm}}>
                    <div style={{height:4,background:tag.bg}}/>
                    <div style={{padding:"13px 15px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:note.title?8:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:13,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"3px 10px",border:`1px solid ${G.borderM}`,fontWeight:600}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:700,fontSize:17,color:G.text,fontFamily:G.display,lineHeight:1.3,marginBottom:4}}>{note.title}</div>}
                          {note.body&&<p style={{margin:0,fontSize:15,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>{setEditNote({...note});setView("editNote");}}
                            style={{background:G.bg,border:`1px solid ${G.borderM}`,borderRadius:9,padding:"8px 16px",fontSize:14,fontWeight:600,cursor:"pointer",color:G.textS,fontFamily:G.sans,minHeight:42,WebkitTapHighlightColor:"transparent"}}>Edit</button>
                          <button onClick={()=>deleteNote(note.id)}
                            style={{background:G.redL,border:"1px solid #F5CACA",borderRadius:9,padding:"8px 14px",fontSize:14,fontWeight:600,cursor:"pointer",color:G.red,fontFamily:G.sans,minHeight:42,WebkitTapHighlightColor:"transparent"}}>✕</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  if(view==="addClass"){
    return(
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
        right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}/>
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
          <label style={{...lbl,marginTop:14}}>Default Class Duration</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            {[45,60,75,90,105,120].map(mins=>{
              const isSel=(newClass.duration||60)===mins;
              const label=mins<60?`${mins}m`:mins===60?"1 hr":`${Math.floor(mins/60)}h${mins%60?" "+mins%60+"m":""}`;
              return(
                <button key={mins} type="button" onClick={()=>setNewClass(c=>({...c,duration:mins}))}
                  style={{padding:"8px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:40,WebkitTapHighlightColor:"transparent",
                    background:isSel?G.forest:"rgba(0,0,0,0.07)",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                  {label}
                </button>
              );
            })}
          </div>
          <p style={{fontSize:12,color:G.textL,marginBottom:14,fontFamily:G.sans}}>Suggests end time automatically when logging entries for this class.</p>
          <PrimaryBtn onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()} onPointerDown={e=>rpl(e,true)} style={{marginTop:4,width:"100%",padding:"13px",fontSize:16}}>Add Class</PrimaryBtn>
        </div>
      </div>
    </div>
    );
  }

  // ── TRASH ─────────────────────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════════
  // STATS VIEW — teaching hours breakdown
  // ══════════════════════════════════════════════════════════════════════
  if(view==="stats"){
    function pad2(n){return String(n).padStart(2,"0");}
    function toKey(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
    function fmtMins(m){
      if(!m||m<=0)return"0m";
      const h=Math.floor(m/60),min=m%60;
      return min?`${h}h ${min}m`:`${h}h`;
    }
    function calcDurMins(tStart,tEnd){
      if(!tStart||!tEnd)return 0;
      const [sh,sm]=tStart.split(":").map(Number);
      const [eh,em]=tEnd.split(":").map(Number);
      const d=(eh*60+em)-(sh*60+sm);
      return d>0?d:0;
    }

    // Date range for period
    const now=new Date();
    let rangeStart;
    if(statPeriod==="week"){
      rangeStart=new Date(now);
      rangeStart.setDate(now.getDate()-now.getDay()); // Sunday of current week
    } else if(statPeriod==="month"){
      rangeStart=new Date(now.getFullYear(),now.getMonth(),1);
    } else {
      // session: April 1 of current academic year
      const sesYear=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
      rangeStart=new Date(sesYear,3,1);
    }
    const rangeStartKey=toKey(rangeStart);
    const todayK=todayKey();

    // Compute stats per class
    const DAYS_SHORT=["Su","Mo","Tu","We","Th","Fr","Sa"];
    const dayMins=[0,0,0,0,0,0,0]; // Sun–Sat totals
    let grandTotal=0, grandSessions=0, longestSession=0;

    const classStats=data.classes.filter(c=>!c.left).map(cls=>{
      const ic=instColor(cls.institute);
      let mins=0,sessions=0;
      Object.entries(data.notes[cls.id]||{}).forEach(([dk,entries])=>{
        if(dk<rangeStartKey||dk>todayK)return;
        if(!Array.isArray(entries))return;
        entries.forEach(e=>{
          const d=calcDurMins(e.timeStart,e.timeEnd);
          if(d>0){
            mins+=d; sessions++;
            dayMins[new Date(dk).getDay()]+=d;
            if(d>longestSession)longestSession=d;
          }
        });
      });
      return{cls,ic,mins,sessions};
    }).filter(c=>c.mins>0).sort((a,b)=>b.mins-a.mins);

    grandTotal=classStats.reduce((a,c)=>a+c.mins,0);
    grandSessions=classStats.reduce((a,c)=>a+c.sessions,0);
    const avgSession=grandSessions>0?Math.round(grandTotal/grandSessions):0;
    const maxClassMins=classStats.length>0?classStats[0].mins:1;
    const maxDayMins=Math.max(...dayMins,1);

    const navBtnStyle={background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"7px 12px",cursor:"pointer",color:"rgba(255,255,255,0.85)",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",fontFamily:G.sans};

    return(
      <div style={{minHeight:"100svh",background:G.bg,fontFamily:G.sans,display:"flex",flexDirection:"column"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
          right={<button onClick={()=>setView("home")} style={navBtnStyle}>← Back</button>}/>

        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 14px 48px",maxWidth:680,margin:"0 auto",width:"100%"}}>

          {/* Period tabs */}
          <div style={{display:"flex",background:G.surface,border:`1px solid ${G.border}`,borderRadius:12,padding:3,marginBottom:18,gap:2}}>
            {[["week","This Week"],["month","This Month"],["session","Session"]].map(([k,l])=>(
              <button key={k} onClick={()=>setStatPeriod(k)}
                style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",fontFamily:G.display,fontSize:13,fontWeight:600,transition:"all 0.15s",WebkitTapHighlightColor:"transparent",
                  background:statPeriod===k?G.forest:"transparent",color:statPeriod===k?"#fff":G.textM}}>
                {l}
              </button>
            ))}
          </div>

          {grandTotal===0?(
            <div style={{background:G.surface,borderRadius:16,border:`2px dashed ${G.border}`,padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontSize:16,fontWeight:600,color:G.textM}}>No entries with time data yet</div>
              <div style={{fontSize:14,color:G.textL,marginTop:6}}>Add class time when logging entries to see stats</div>
            </div>
          ):(
            <>
              {/* Hero */}
              <div style={{background:G.forest,borderRadius:20,padding:"20px",marginBottom:14,display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>⏱</div>
                <div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Total Teaching Time</div>
                  <div style={{fontSize:36,fontWeight:800,color:"#fff",fontFamily:G.display,lineHeight:1,letterSpacing:-1}}>{fmtMins(grandTotal)}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4}}>{classStats.length} {classStats.length===1?"class":"classes"} · {grandSessions} sessions</div>
                </div>
              </div>

              {/* Mini stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Sessions</div>
                  <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{grandSessions}</div>
                  <div style={{fontSize:12,color:G.textM,marginTop:3}}>in {statPeriod==="week"?"this week":statPeriod==="month"?"this month":"this session"}</div>
                </div>
                <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Avg / Session</div>
                  <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{fmtMins(avgSession)}</div>
                  <div style={{fontSize:12,color:G.textM,marginTop:3}}>longest: {fmtMins(longestSession)}</div>
                </div>
              </div>

              {/* Day of week chart */}
              <div style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,padding:14,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>Hours by Day</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:72,marginBottom:8}}>
                  {dayMins.map((m,i)=>(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                      <div title={fmtMins(m)} style={{width:"100%",borderRadius:"5px 5px 0 0",background:m>0?G.green:G.border,
                        height:m>0?Math.max((m/maxDayMins)*68,4)+"px":"3px",transition:"height 0.5s cubic-bezier(0.22,1,0.36,1)",minHeight:3}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {DAYS_SHORT.map((d,i)=>(
                    <div key={i} style={{flex:1,textAlign:"center",fontSize:10,fontWeight:600,color:i===0?G.red:G.textL,textTransform:"uppercase"}}>{d}</div>
                  ))}
                </div>
              </div>

              {/* Per-class breakdown */}
              <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>By Class</div>
              {classStats.map(({cls,ic,mins,sessions})=>{
                const pct=Math.round(mins/maxClassMins*100);
                return(
                  <div key={cls.id} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,marginBottom:8,padding:"13px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:38,height:38,borderRadius:9,background:ic.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:ic.bg,fontFamily:G.mono}}>
                        {(cls.section||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                        <div style={{fontSize:12,color:G.textL}}>🏫 {cls.institute}{cls.subject?" · "+cls.subject:""}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:18,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1}}>{fmtMins(mins)}</div>
                        <div style={{fontSize:11,color:G.textL,marginTop:2}}>{sessions} session{sessions!==1?"s":""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:6,background:G.border,borderRadius:20,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:20,background:ic.bg,width:pct+"%",transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)"}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:ic.bg,fontFamily:G.mono,width:32,textAlign:"right"}}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  if(view==="trash"){
    const tClasses=(data.trash?.classes||[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const tNotes=(data.trash?.notes||[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const daysLeft=ts=>Math.max(0,30-Math.floor((Date.now()-ts)/(1000*60*60*24)));
    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>
        <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}/>
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
    const form=isEdit?editNote:newNote;
    const setForm=isEdit?setEditNote:setNewNote;
    const save=isEdit?saveEdit:addNote;
    const color=activeClass?instColor(activeClass.institute):COLORS[0];

    return(
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
          right={<>
            {activeClass&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color.bg}}/>
              <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{activeClass.section}</span>
              <span style={{fontSize:14,color:G.textM}}>· {activeClass.institute}</span>
            </div>}
            <GhostBtn onClick={()=>setView("classDetail")} style={{color:"rgba(255,255,255,0.8)",borderColor:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)"}}>← Back</GhostBtn>
          </>}
        />
        {!isEdit&&(
          <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"16px 32px"}}>
            <div style={{maxWidth:1000,margin:"0 auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:15,color:G.green}}>📅</span>
                <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
              </div>
              <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={{}}/>
            </div>
          </div>
        )}
        <div className="mobile-pad" style={{maxWidth:660,margin:"0 auto",padding:"32px 24px 72px"}}>
          <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:5,textTransform:"uppercase",fontWeight:600}}>{isEdit?"Editing Entry":"New Entry For"}</p>
          <h2 style={{marginBottom:22,fontSize:28,letterSpacing:-0.5,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>
          <div style={{background:G.greenL,borderRadius:10,padding:"9px 14px",marginBottom:20,fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
            <span>👤</span><span>Logged as: <strong>{teacherName}</strong></span>
          </div>
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
              {form._suggested&&form.timeStart&&(
                <div style={{background:G.greenL,border:"1px solid "+G.green,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:18}}>&#128161;</span>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontSize:13,fontWeight:700,color:G.green}}>Suggested from your history</div>
                    <div style={{fontSize:12,color:G.textM,marginTop:1}}>
                      {form.timeStart} &#8211; {form.timeEnd} · same time as your usual {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(selectedDate).getDay()]} class
                    </div>
                  </div>
                  <button onClick={()=>setForm(f=>({...f,_suggested:false,timeStart:"",timeEnd:"",_suggestedEnd:null}))}
                    style={{background:"none",border:"1px solid "+G.borderM,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",color:G.textM,fontFamily:G.sans,flexShrink:0}}>
                    Change
                  </button>
                </div>
              )}
              <label style={lbl}>Start Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
              {!form._suggested&&<input type="time" value={form.timeStart||""}
                onChange={e=>{
                  const s=e.target.value;
                  const dur=form._dur||(activeClass?.duration)||60;
                  if(s){
                    const [h,m]=s.split(":").map(Number);
                    const end=new Date(2000,0,1,h,m+dur);
                    const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                    setForm({...form,timeStart:s,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                  } else {
                    setForm({...form,timeStart:"",timeEnd:"",_suggestedEnd:null});
                  }
                }}
                style={{...inp,fontSize:16}}/>}

              {/* Duration suggestion pills — shown after start time entered */}
              {form.timeStart&&(
                <div style={{marginBottom:12}}>
                  <label style={{...lbl,marginBottom:8}}>Duration</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[45,60,75,90,105,120].map(mins=>{
                      const isSel=(form._dur||(activeClass?.duration)||60)===mins;
                      const label=mins<60?`${mins}m`:mins===60?"1 hr":`${Math.floor(mins/60)}h${mins%60?" "+mins%60+"m":""}`;
                      return(
                        <button key={mins} type="button"
                          onClick={()=>{
                            const [h,m]=(form.timeStart||"00:00").split(":").map(Number);
                            const end=new Date(2000,0,1,h,m+mins);
                            const eh=String(end.getHours()).padStart(2,"0"),em=String(end.getMinutes()).padStart(2,"0");
                            setForm({...form,_dur:mins,timeEnd:`${eh}:${em}`,_suggestedEnd:`${eh}:${em}`});
                          }}
                          style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${isSel?G.forest:G.border}`,cursor:"pointer",fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:42,WebkitTapHighlightColor:"transparent",
                            background:isSel?G.forest:"transparent",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* End time — auto-calculated, still editable */}
              {form.timeStart&&(
                <div>
                  <label style={{...lbl,marginBottom:6}}>
                    End Time
                    {form._suggestedEnd&&form.timeEnd===form._suggestedEnd&&
                      <span style={{color:G.green,fontWeight:500,textTransform:"none",fontSize:12,marginLeft:8}}>suggested — edit if different</span>}
                  </label>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input type="time" value={form.timeEnd||""}
                      onChange={e=>setForm({...form,timeEnd:e.target.value,_suggestedEnd:null})}
                      style={{...inp,marginBottom:0,flex:1,fontSize:16,
                        borderColor:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.green:G.border,
                        background:form._suggestedEnd&&form.timeEnd===form._suggestedEnd?G.greenL:G.surface}}/>
                    {form.timeStart&&form.timeEnd&&(()=>{
                      const[sh,sm]=form.timeStart.split(":").map(Number);
                      const[eh,em]=form.timeEnd.split(":").map(Number);
                      const d=(eh*60+em)-(sh*60+sm);
                      if(d<=0) return null;
                      return <span style={{fontSize:14,color:G.green,fontWeight:700,fontFamily:G.mono,flexShrink:0,background:G.greenL,borderRadius:8,padding:"6px 10px"}}>{d<60?d+"m":Math.floor(d/60)+"h"+(d%60?d%60+"m":"")}</span>;
                    })()}
                  </div>
                </div>
              )}
              {!form.timeStart&&<div style={{fontSize:13,color:G.red,marginTop:4}}>Start time is required.</div>}
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
