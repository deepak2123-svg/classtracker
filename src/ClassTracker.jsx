import React, { useState, useEffect, useRef, useMemo, Component } from "react";
import { loadUserData, saveUserData, logout, syncTeacherIndex, deleteClassNotes, db, getGlobalInstitutes, getAllInstituteSections, purgeExpiredTrash } from "./firebase";
import { TAG_STYLES, STATUS_STYLES, Spinner, Avatar, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

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


// ── Confirm Modal (replaces window.confirm everywhere) ───────────────────────
function ConfirmModal({message, confirmLabel="Delete", onConfirm, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 22px",width:"100%",maxWidth:340,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <div style={{width:54,height:54,borderRadius:16,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26}}>
          🗑
        </div>
        <p style={{fontSize:15,color:"#374151",marginBottom:24,lineHeight:1.6,fontFamily:"'Inter',sans-serif"}}>{message}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            Cancel
          </button>
          <button onClick={()=>{onConfirm();onClose();}}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#DC2626",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Saving Guard Modal ────────────────────────────────────────────────────────
function SavingGuardModal({onWait, onLeave}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 22px",width:"100%",maxWidth:340,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>
          💾
        </div>
        <h3 style={{fontSize:18,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif",marginBottom:8}}>Still saving…</h3>
        <p style={{fontSize:14,color:"#6B7280",marginBottom:24,lineHeight:1.6,fontFamily:"'Inter',sans-serif"}}>
          Your entry is being saved. Leaving now may lose your last change.
        </p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onWait}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#152B22",fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            Wait for save
          </button>
          <button onClick={onLeave}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#6B7280",fontFamily:"'Inter',sans-serif",minHeight:48,WebkitTapHighlightColor:"transparent"}}>
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
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
function dateFromKey(dk){
  const [y,m,d] = `${dk||""}`.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
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

function OverflowMenu({ items = [], buttonSize = 36 }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position:"relative", flexShrink:0 }}>
      <button
        type="button"
        aria-label="More actions"
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        style={{
          width:buttonSize,
          height:buttonSize,
          borderRadius:10,
          border:`1px solid ${G.border}`,
          background:G.bg,
          color:G.textM,
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          fontSize:18,
          fontWeight:700,
          WebkitTapHighlightColor:"transparent"
        }}>
        ⋯
      </button>
      {open && (
        <div style={{
          position:"absolute",
          top:"calc(100% + 8px)",
          right:0,
          minWidth:170,
          background:G.surface,
          border:`1px solid ${G.border}`,
          borderRadius:12,
          boxShadow:G.shadowMd,
          padding:6,
          zIndex:1200
        }}>
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={e => {
                e.stopPropagation();
                setOpen(false);
                item.onClick?.();
              }}
              style={{
                width:"100%",
                border:"none",
                background:"transparent",
                borderRadius:9,
                padding:"10px 12px",
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                gap:8,
                textAlign:"left",
                color:item.danger ? G.red : G.textS,
                fontSize:14,
                fontWeight:600,
                fontFamily:G.sans,
                WebkitTapHighlightColor:"transparent"
              }}>
              <span style={{ fontSize:15, lineHeight:1 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────────────────
function TopNav({user,teacherName,right,onLogoClick,onSignOut,onViewStats,onViewTrash,trashCount,data}){
  const shortName=(teacherName||"").split(" ")[0];
  const [profileOpen, setProfileOpen] = React.useState(false);

  return(
    <div style={{background:G.forest,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(255,255,255,0.06)"}}>
      <div style={{height:58,display:"flex",alignItems:"center",padding:"0 12px",gap:8}}>

        {/* Ledgr logo */}
        <div onClick={onLogoClick}
          style={{display:"flex",alignItems:"center",gap:7,flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}
          onPointerDown={e=>{e.currentTarget.style.opacity="0.7";}}
          onPointerUp={e=>{e.currentTarget.style.opacity="1";}}
          onPointerCancel={e=>{e.currentTarget.style.opacity="1";}}>
          <div style={{width:34,height:34,borderRadius:9,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 3H7V13H14V16H4V3Z" fill="white"/>
            </svg>
          </div>
          <span style={{fontFamily:G.display,fontWeight:800,fontSize:19,color:"#fff",letterSpacing:-0.5,lineHeight:1}}>Ledgr</span>
        </div>

        <div style={{flex:1}}/>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {right}

          {/* Clickable profile pill */}
          <div style={{position:"relative"}}>
            <div onClick={()=>setProfileOpen(o=>!o)}
              style={{height:42,display:"flex",alignItems:"center",gap:7,background:profileOpen?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.1)",borderRadius:10,padding:"0 12px",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"background 0.15s"}}>
              <Avatar user={user} size={22}/>
              <span style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",whiteSpace:"nowrap",fontFamily:G.sans}}>
                <span className="desktop-only">{teacherName}</span>
                <span className="mobile-inline">{shortName}</span>
              </span>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginLeft:2}}>{profileOpen?"▲":"▼"}</span>
            </div>

            {/* Profile dropdown */}
            {profileOpen&&(<>
              <div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
              <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:200,background:"#1B3A2E",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",minWidth:230,overflow:"hidden"}}>

                {/* Profile header */}
                <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Avatar user={user} size={36}/>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.95)",fontFamily:G.sans}}>{teacherName}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2,fontFamily:G.sans}}>{user?.email||"—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{padding:"8px"}}>
                  {/* Stats */}
                  <button onClick={()=>{setProfileOpen(false);onViewStats();}}
                    style={{width:"100%",marginBottom:6,padding:"10px 12px",background:"rgba(52,208,119,0.12)",border:"1px solid rgba(52,208,119,0.25)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"#34D07A",fontSize:14,fontFamily:G.sans,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
                    View Stats
                  </button>

                  {/* Recycle Bin */}
                  <button onClick={()=>{setProfileOpen(false);onViewTrash&&onViewTrash();}}
                    style={{width:"100%",marginBottom:6,padding:"10px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.75)",fontSize:14,fontFamily:G.sans,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Recycle Bin
                    {(trashCount||0)>0&&<span style={{marginLeft:"auto",background:"rgba(201,48,48,0.7)",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700}}>{trashCount}</span>}
                  </button>

                  {/* Sign out */}
                  <button onClick={()=>{setProfileOpen(false);onSignOut();}}
                    style={{width:"100%",padding:"10px 12px",background:"rgba(220,38,38,0.15)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:"#FCA5A5",fontSize:14,fontFamily:G.sans,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>

              </div>
            </>)}
          </div>

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
  const editableDateKeys = useMemo(() => new Set(buildDateWindow().map(d => d.key)), [todayStr]);

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
    const isSel    = key === selectedDate;
    const isToday  = key === todayStr;
    const hasEntry = (noteDates[key] || 0) > 0;
    const isSun    = date.getDay() === 0;
    const allowed  = editableDateKeys.has(key);
    const isFuture = key > todayStr;
    const canOpen  = !otherMonth && !isFuture && (allowed || hasEntry);
    const isHighlighted = !otherMonth && allowed;
    let stripe = '';
    if (isHighlighted) {
      const prevDate = new Date(date);
      prevDate.setDate(date.getDate() - 1);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const prevHighlighted =
        date.getDay() !== 0 &&
        prevDate.getFullYear() === viewYear &&
        prevDate.getMonth() === viewMonth &&
        editableDateKeys.has(toKey(prevDate));
      const nextHighlighted =
        date.getDay() !== 6 &&
        nextDate.getFullYear() === viewYear &&
        nextDate.getMonth() === viewMonth &&
        editableDateKeys.has(toKey(nextDate));

      stripe = prevHighlighted
        ? (nextHighlighted ? 'mid' : 'end')
        : (nextHighlighted ? 'start' : 'only');
    }
    cells.push({ date, key, otherMonth, isHighlighted, isSel, isToday, hasEntry, isSun, stripe, allowed, canOpen, isFuture });
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
      <div style={{background:G.surface,borderRadius:12,border:`1px solid ${G.border}`,overflow:'hidden'}}>
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
          {cells.map(({date,key,otherMonth,isHighlighted,isSel,isToday,hasEntry,isSun,stripe,allowed,canOpen,isFuture},i) => (
            <div key={i}
              onClick={() => {
                if (otherMonth) return;
                if (isFuture) { showToast("Can't log future dates"); return; }
                if (!canOpen) { showToast("Only the past week can be edited. Older dates open only when entries exist."); return; }
                onSelectDate(key);
              }}
              style={{
                position:'relative', height:34,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                borderRadius:8,
                cursor:(otherMonth||!canOpen)?'default':'pointer',
                opacity:otherMonth?0.15:(canOpen?1:0.25),
                WebkitTapHighlightColor:'transparent',
                touchAction:'manipulation', userSelect:'none', WebkitUserSelect:'none',
                background: isSel||isToday ? G.forest : 'transparent',
                boxShadow: isSel||isToday ? '0 2px 8px rgba(21,43,34,0.2)' : 'none',
                transition:'transform 0.1s',
              }}
              onPointerDown={e=>{if(canOpen)e.currentTarget.style.transform='scale(0.85)';}}
              onPointerUp={e=>{e.currentTarget.style.transform='scale(1)';}}
              onPointerCancel={e=>{e.currentTarget.style.transform='scale(1)';}}>

              {isHighlighted && !isSel && !isToday && stripe && (
                <div style={stripeStyle(stripe)}/>
              )}

              <span style={{
                position:'relative', zIndex:1,
                fontSize:12, lineHeight:1,
                fontWeight: isSel||isToday ? 800 : (isHighlighted || hasEntry) ? 700 : 400,
                color: isSel||isToday ? '#fff' : isSun ? G.red : (isHighlighted || hasEntry) ? G.text : G.textL,
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

function HistoryModal({cls,classNotes={},selectedDate,onSelectDate,onClose}){
  const [query,setQuery]=useState("");

  const rows=useMemo(()=>{
    return Object.entries(classNotes)
      .filter(([,arr])=>Array.isArray(arr)&&arr.length>0)
      .sort(([a],[b])=>b.localeCompare(a))
      .map(([dk,arr])=>{
        const d=dateFromKey(dk);
        const label=d.toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"});
        const monthLabel=d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
        const previewRaw=arr
          .map(note=>(note?.title||"").trim() || (note?.body||"").trim())
          .find(Boolean) || "";
        const preview=previewRaw.length>88?`${previewRaw.slice(0,85)}...`:previewRaw;
        const searchText=[
          dk,
          label,
          ...arr.map(note=>`${note?.title||""} ${note?.body||""} ${note?.timeStart||""} ${note?.timeEnd||""}`),
        ].join(" ").toLowerCase();
        return {dk,count:arr.length,label,monthLabel,preview,searchText};
      });
  },[classNotes]);

  const filteredRows=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return q ? rows.filter(r=>r.searchText.includes(q)) : rows;
  },[rows,query]);

  const totalEntries=rows.reduce((sum,row)=>sum+row.count,0);
  let currentMonth="";

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.55)",zIndex:9997,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:G.surface,borderRadius:24,width:"100%",maxWidth:560,maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.28)",overflow:"hidden"}}>
        <div style={{padding:"22px 22px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{width:44,height:44,borderRadius:14,background:G.greenL,color:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🕘</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:22,fontWeight:700,color:G.text,fontFamily:G.display,lineHeight:1.2}}>Entry History</div>
              <div style={{fontSize:14,color:G.textM,marginTop:4,lineHeight:1.5}}>
                {cls.section} · {cls.institute}
                {cls.subject?` · ${cls.subject}`:""}
              </div>
              <div style={{fontSize:13,color:G.textL,marginTop:6,fontFamily:G.mono}}>
                {rows.length} saved date{rows.length===1?"":"s"} · {totalEntries} total entr{totalEntries===1?"y":"ies"}
              </div>
            </div>
            <button onClick={onClose} style={{width:38,height:38,borderRadius:12,border:`1px solid ${G.border}`,background:G.surface,color:G.textM,cursor:"pointer",fontSize:18,flexShrink:0}}>
              ×
            </button>
          </div>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search by date, title, or notes"
            style={{...inp,marginBottom:0,marginTop:16}}
          />
          <div style={{marginTop:12,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
            Past week stays editable here. Older dates open as view-only.
          </div>
        </div>

        <div style={{padding:"12px 14px 16px",overflowY:"auto"}}>
          {filteredRows.length===0 ? (
            <div style={{padding:"28px 18px",textAlign:"center",color:G.textM}}>
              <div style={{fontSize:34,marginBottom:8}}>🔎</div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>No matching dates</div>
              <div style={{fontSize:14,marginTop:4}}>Try a different date, title, or keyword.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredRows.map(row=>{
                const showMonth=row.monthLabel!==currentMonth;
                currentMonth=row.monthLabel;
                const isSelected=row.dk===selectedDate;
                return(
                  <React.Fragment key={row.dk}>
                    {showMonth&&(
                      <div style={{padding:"10px 8px 2px",fontSize:12,fontWeight:700,color:G.textL,textTransform:"uppercase",letterSpacing:0.5}}>
                        {row.monthLabel}
                      </div>
                    )}
                    <button
                      onClick={()=>{onSelectDate(row.dk);onClose();}}
                      style={{
                        width:"100%",
                        textAlign:"left",
                        border:isSelected?`1.5px solid ${G.green}`:`1px solid ${G.border}`,
                        background:isSelected?G.greenL:G.surface,
                        borderRadius:16,
                        padding:"14px 14px",
                        cursor:"pointer",
                        display:"flex",
                        alignItems:"flex-start",
                        justifyContent:"space-between",
                        gap:12,
                      }}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>
                          {row.label}
                        </div>
                        {row.preview&&(
                          <div style={{fontSize:13,color:G.textM,marginTop:5,lineHeight:1.5}}>
                            {row.preview}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                        <span style={{background:isSelected?G.green:"#F3F4F6",color:isSelected?"#fff":G.textM,borderRadius:999,padding:"4px 10px",fontSize:12,fontWeight:700,fontFamily:G.mono}}>
                          {row.count} {row.count===1?"entry":"entries"}
                        </span>
                        {isSelected&&<span style={{fontSize:12,color:G.green,fontWeight:700}}>Viewing</span>}
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const textSorter = useMemo(() => new Intl.Collator("en", { numeric: true, sensitivity: "base" }), []);

  function sectionSortMeta(section){
    const clean = (section || "").trim();
    const grade = extractGrade(clean);
    const gradeOrder = grade && grade >= 6 && grade <= 12 ? grade : 99;
    return { gradeOrder, clean };
  }

  function exportRowCompare(a,b){
    const aSection = sectionSortMeta(a.class);
    const bSection = sectionSortMeta(b.class);
    if (aSection.gradeOrder !== bSection.gradeOrder) return aSection.gradeOrder - bSection.gradeOrder;
    const classCmp = textSorter.compare(aSection.clean, bSection.clean);
    if (classCmp !== 0) return classCmp;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
    if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
    const subjectCmp = textSorter.compare(a.subject || "", b.subject || "");
    if (subjectCmp !== 0) return subjectCmp;
    return textSorter.compare(a.title || "", b.title || "");
  }

  function entryChronologicalCompare(a,b){
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if ((a.timeStart || "") !== (b.timeStart || "")) return (a.timeStart || "").localeCompare(b.timeStart || "");
    if ((a.timeEnd || "") !== (b.timeEnd || "")) return (a.timeEnd || "").localeCompare(b.timeEnd || "");
    const statusCmp = textSorter.compare(a.status || "", b.status || "");
    if (statusCmp !== 0) return statusCmp;
    const titleCmp = textSorter.compare(a.title || "", b.title || "");
    if (titleCmp !== 0) return titleCmp;
    return textSorter.compare(a.notes || "", b.notes || "");
  }

  function groupRowsForPdf(rows){
    const byInstitute = new Map();

    rows.forEach(row=>{
      const instituteName = (row.institute || "No Institute").trim() || "No Institute";
      const className = (row.class || "Untitled Class").trim() || "Untitled Class";
      const subjectName = (row.subject || "").trim();
      const classKey = `${className}__${subjectName}`;

      if(!byInstitute.has(instituteName)){
        byInstitute.set(instituteName, { name: instituteName, classMap: new Map(), entryCount: 0 });
      }
      const inst = byInstitute.get(instituteName);
      if(!inst.classMap.has(classKey)){
        inst.classMap.set(classKey, { className, subject: subjectName, entries: [] });
      }
      inst.classMap.get(classKey).entries.push(row);
      inst.entryCount += 1;
    });

    return Array.from(byInstitute.values())
      .sort((a,b)=>textSorter.compare(a.name, b.name))
      .map(inst=>{
        const classes = Array.from(inst.classMap.values())
          .sort((a,b)=>{
            const aMeta = sectionSortMeta(a.className);
            const bMeta = sectionSortMeta(b.className);
            if (aMeta.gradeOrder !== bMeta.gradeOrder) return aMeta.gradeOrder - bMeta.gradeOrder;
            const classCmp = textSorter.compare(aMeta.clean, bMeta.clean);
            if (classCmp !== 0) return classCmp;
            return textSorter.compare(a.subject || "", b.subject || "");
          })
          .map(group=>({
            ...group,
            entries:[...group.entries].sort(entryChronologicalCompare),
          }));
        return {
          name: inst.name,
          classes,
          entryCount: inst.entryCount,
          classCount: classes.length,
        };
      });
  }

  function escapeHtml(v){
    return String(v || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  function htmlWithBreaks(v){
    return escapeHtml(v).replace(/\n/g,"<br/>");
  }

  function formatPdfDate(dk){
    return dateFromKey(dk).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  }

  // Collect entries within the selected range
  function getEntries(){
    const rows=[];

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
      (data.classes||[]).filter(c=>!c.left).forEach(cls=>{
        const dayNotes=(data.notes[cls.id]||{})[dk]||[];
        dayNotes.forEach(note=>{
          rows.push({
            date:dk,
            class:cls.section,
            institute:cls.institute,
            subject:cls.subject,
            type:note.tag||"note",
            time:note.timeStart?(note.timeEnd?`${note.timeStart} - ${note.timeEnd}`:note.timeStart):"",
            timeStart:note.timeStart||"",
            timeEnd:note.timeEnd||"",
            status:note.status&&STATUS_STYLES[note.status]?STATUS_STYLES[note.status].label.replace(/[🔵🟡🟢🟠]/g,'').trim():"",
            title:note.title||"",
            notes:note.body||"",
          });
        });
      });
      cur.setDate(cur.getDate()+1);
    }
    return rows.sort(exportRowCompare);
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
    const groups=groupRowsForPdf(rows);
    const totalClasses=groups.reduce((sum,inst)=>sum+inst.classCount,0);
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:12px;background:#fff}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;margin-bottom:16px;font-size:12px}
  .summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
  .summary-card{border:1px solid #D9E4DC;border-radius:12px;padding:10px 12px;min-width:120px;background:#F8FBF8}
  .summary-label{font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:#6B7280;font-weight:700;margin-bottom:4px}
  .summary-value{font-size:16px;font-weight:700;color:#152B22}
  .inst-block{margin-top:24px}
  .inst-block:first-of-type{margin-top:0}
  .inst-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #152B22;padding-bottom:10px;margin-bottom:16px}
  .inst-title{font-size:17px;font-weight:700;color:#152B22;margin:0}
  .inst-meta{font-size:11px;color:#4B5563;font-weight:700;white-space:nowrap}
  .class-block{border:1px solid #D9E4DC;border-radius:14px;overflow:hidden;margin-bottom:14px;page-break-inside:avoid}
  .class-head{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#F5F7F5;border-bottom:1px solid #D9E4DC}
  .class-title{font-size:15px;font-weight:700;color:#111827}
  .class-sub{font-size:12px;color:#4B5563;margin-top:3px}
  table{width:100%;border-collapse:collapse}
  th{background:#152B22;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  tr:last-child td{border-bottom:none}
  .status{font-weight:700;color:#374151}
  .title{font-weight:700;color:#111827}
  .notes{color:#374151;line-height:1.45}
  .empty{text-align:center;padding:40px;color:#999;border:1px dashed #D9E4DC;border-radius:16px}
  @media print{body{padding:0}}
</style></head><body>
<h1>ClassLog — ${escapeHtml(teacherName)}</h1>
<div class="sub">${escapeHtml(label)} · Exported ${escapeHtml(new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}))}</div>
${rows.length===0
  ? '<div class="empty">No entries found for this period.</div>'
  : `<div class="summary">
      <div class="summary-card"><div class="summary-label">Institutes</div><div class="summary-value">${groups.length}</div></div>
      <div class="summary-card"><div class="summary-label">Classes</div><div class="summary-value">${totalClasses}</div></div>
      <div class="summary-card"><div class="summary-label">Entries</div><div class="summary-value">${rows.length}</div></div>
    </div>
${groups.map(inst=>`<section class="inst-block">
  <div class="inst-head">
    <h2 class="inst-title">${escapeHtml(inst.name)}</h2>
    <div class="inst-meta">${inst.classCount} class${inst.classCount!==1?"es":""} · ${inst.entryCount} entr${inst.entryCount!==1?"ies":"y"}</div>
  </div>
  ${inst.classes.map(group=>`<div class="class-block">
    <div class="class-head">
      <div>
        <div class="class-title">${escapeHtml(group.className)}</div>
        <div class="class-sub">${group.subject?`${escapeHtml(group.subject)} · `:""}${group.entries.length} entr${group.entries.length!==1?"ies":"y"}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Date</th><th>Time</th><th>Status</th><th>Title</th><th>Notes</th></tr>
      </thead>
      <tbody>
        ${group.entries.map(r=>`<tr>
          <td style="white-space:nowrap">${escapeHtml(formatPdfDate(r.date))}</td>
          <td style="white-space:nowrap">${escapeHtml(r.time || "")}</td>
          <td class="status">${escapeHtml(r.status || "")}</td>
          <td class="title">${escapeHtml(r.title || "—")}</td>
          <td class="notes">${htmlWithBreaks(r.notes || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`).join("")}
</section>`).join("")}`}
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

    // Use a Blob URL so browsers don't treat it as a popup
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.target   = "_blank";
    a.rel      = "noopener";
    a.click();
    // Revoke after a short delay to allow the tab to load the blob
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
  }

  function exportExcel(){
    const rows=getEntries();
    const label=periodLabel();
    // Build CSV (opens in Excel on all platforms)
    const headers=["Date","Class","Institute","Subject","Time","Status","Title","Notes"];
    const escape=v=>(`"${String(v||"").replace(/"/g,'""')}"`);
    const csv=[
      `ClassLog Export — ${teacherName} — ${label}`,
      "",
      headers.join(","),
      ...rows.map(r=>[r.date,r.class,r.institute,r.subject,r.time,r.status||"",r.title,r.notes].map(escape).join(","))
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


// ── Slot resolution: Firestore sections first, KIS hardcode as fallback ─────────
// getSlotsForSection(cls, instituteSections) → slots array | null
// instituteSections = getAllInstituteSections() result: { [instName]: { gradeGroups } }
function getSlotsForSection(cls, instituteSections) {
  if (!cls) return null;
  // 1. Check Firestore admin-created sections for this institute
  const instData = instituteSections?.[cls.institute];
  if (instData?.gradeGroups?.length) {
    for (const grp of instData.gradeGroups) {
      if ((grp.sections || []).includes(cls.section)) {
        // Per-section override?
        const ov = (grp.sectionOverrides || {})[cls.section];
        if (ov?.length) return ov;
        if (grp.slots?.length) return grp.slots;
      }
    }
  }
  // 2. Fallback: hardcoded KIS SIP logic
  return getKisSlots(cls);
}

// ── KIS SIP Kunjpura preset timetable slots ────────────────────────────────────
// Yellow (break) rows from the timetable are excluded.
// Only applies to KIS SIP Kunjpura — NOT KIS Competition Wing or other KIS branches.
const KIS_SLOTS = {
  senior: [ // 11th and 12th
    { start:"09:00", end:"10:30", durMins:90  },
    { start:"10:45", end:"12:00", durMins:75  },
    { start:"12:00", end:"13:30", durMins:90  },
    { start:"15:00", end:"16:15", durMins:75  },
    { start:"16:15", end:"17:30", durMins:75  },
  ],
  junior: [ // 6th to 10th
    { start:"09:00", end:"10:00", durMins:60  },
    { start:"10:00", end:"11:00", durMins:60  },
    { start:"11:15", end:"12:15", durMins:60  },
    { start:"12:15", end:"13:00", durMins:45  },
    { start:"15:00", end:"16:00", durMins:60  },
    { start:"16:00", end:"17:00", durMins:60  },
  ],
};

// Matches any institute with "KIS SIP" in the name (case-insensitive)
function isKisSip(institute) {
  const s = (institute || "").toLowerCase();
  return s.includes("kis") && s.includes("sip");
}

// Convert Roman numerals (I–XII) to integer, returns null if not Roman
const ROMAN_MAP = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 };
function romanToInt(str) {
  const s = str.toLowerCase().replace(/[^ivxlcdm]/g, "");
  if (!s.length) return null;
  let total = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = ROMAN_MAP[s[i]];
    if (!val) return null;
    total += val < prev ? -val : val;
    prev = val;
  }
  // Sanity check: 1–12 only (class grades)
  return total >= 1 && total <= 12 ? total : null;
}

// Extract grade number from a section name.
// Handles: "11th NDA", "12th A", "XI NDA", "IX B", "9 A", "Class 8"
function extractGrade(section) {
  const s = (section || "").trim();
  // 1. Arabic numerals first: "11th", "12", "9"
  const arabic = s.match(/\b(\d{1,2})(st|nd|rd|th)?\b/i);
  if (arabic) {
    const n = parseInt(arabic[1]);
    if (n >= 1 && n <= 12) return n;
  }
  // 2. Roman numerals: look for standalone Roman word at start
  const romanMatch = s.match(/^([IVXivx]{1,6})\b/);
  if (romanMatch) {
    const n = romanToInt(romanMatch[1]);
    if (n) return n;
  }
  // 3. Roman numeral anywhere in the string (e.g. "NDA XI")
  const words = s.split(/\s+/);
  for (const w of words) {
    const n = romanToInt(w);
    if (n) return n;
  }
  return null;
}

function getKisSlots(cls) {
  if (!cls) return null;
  if (!isKisSip(cls.institute)) return null;
  const grade = extractGrade(cls.section);
  if (!grade) return null;
  if (grade >= 11) return KIS_SLOTS.senior;
  if (grade >= 6)  return KIS_SLOTS.junior;
  return null;
}

// "09:00" → "9:00 AM"
function fmtSlot(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Returns the slot the teacher uses most, skipping any already used today.
// Falls back to the first available slot if no history yet.
function getDefaultKisSlot(notes, classId, kisSlots, usedStartsToday) {
  if (!kisSlots || !kisSlots.length) return null;
  const available = kisSlots.filter(s => !usedStartsToday.has(s.start));
  if (!available.length) return null;
  const freq = {};
  Object.values(notes[classId] || {}).forEach(entries => {
    if (!Array.isArray(entries)) return;
    entries.forEach(e => {
      const slot = kisSlots.find(s => s.start === e.timeStart);
      if (slot) freq[slot.start] = (freq[slot.start] || 0) + 1;
    });
  });
  if (!Object.keys(freq).length) return available[0];
  return [...available].sort((a, b) => (freq[b.start]||0) - (freq[a.start]||0))[0];
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
        if (!e.timeStart||typeof e.timeStart!=="string") return;
        let dur = 60;
        if (e.timeEnd&&typeof e.timeEnd==="string") {
          try{
            const [sh,sm]=e.timeStart.split(':').map(Number);
            const [eh,em]=e.timeEnd.split(':').map(Number);
            const d=(eh*60+em)-(sh*60+sm);
            if(d>0&&d<480) dur=d;
          }catch(err){}
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


// ── Section Linking Modal ─────────────────────────────────────────────────────
function SectionLinkingModal({ unlinkedClasses, instituteSections, onConfirm, onLater }) {
  const [selections, setSelections] = React.useState({});
  const G3 = {forest:"#152B22",green:"#1B8A4C",greenV:"#34D077",greenL:"#E8F8EF",bg:"#F5F7F5",surface:"#FFFFFF",border:"#D9E4DC",text:"#111827",textM:"#374151",textL:"#6B7280",red:"#C93030",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'JetBrains Mono',monospace"};

  function getAdminSections(cls) {
    return (instituteSections[cls.institute]?.gradeGroups||[]).flatMap(g=>g.sections||[]);
  }

  function handleConfirm() {
    const renames = {};
    let ok = true;
    unlinkedClasses.forEach(cls => {
      const sel = selections[cls.id];
      if (!sel) { ok = false; return; }
      renames[cls.id] = sel;
    });
    if (!ok) { alert("Please select a section for each class."); return; }
    onConfirm(renames);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
      <div style={{background:G3.surface,borderRadius:22,width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        <div style={{padding:"22px 20px 16px",borderBottom:`1px solid ${G3.border}`}}>
          <div style={{fontSize:22,marginBottom:8}}>🔗</div>
          <div style={{fontSize:19,fontWeight:700,color:G3.text,fontFamily:G3.display,marginBottom:6}}>Link your classes to the new section list</div>
          <div style={{fontSize:14,color:G3.textM,lineHeight:1.6}}>Your admin has created an official section list. Please match each of your existing classes to the correct section — this keeps your data and logging history intact.</div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {unlinkedClasses.map(cls=>{
            const adminSecs=getAdminSections(cls);
            const sel=selections[cls.id]||"";
            return(
              <div key={cls.id} style={{background:G3.bg,borderRadius:14,padding:"14px 16px",border:`1px solid ${G3.border}`}}>
                <div style={{fontSize:15,fontWeight:700,color:G3.text,marginBottom:4}}>{cls.section}</div>
                <div style={{fontSize:13,color:G3.textM,marginBottom:10}}>🏫 {cls.institute}{cls.subject?" · "+cls.subject:""}</div>
                <div style={{fontSize:12,color:G3.textL,marginBottom:6,fontWeight:600}}>Which section is this?</div>
                <select value={sel} onChange={e=>setSelections(s=>({...s,[cls.id]:e.target.value}))}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${sel?G3.green:G3.border}`,fontSize:15,fontFamily:G3.sans,outline:"none",background:G3.surface,color:G3.text,cursor:"pointer"}}>
                  <option value="">Select the correct section…</option>
                  {adminSecs.map(s=>(<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            );
          })}
        </div>
        <div style={{padding:"12px 20px 22px",display:"flex",gap:10,borderTop:`1px solid ${G3.border}`}}>
          <button onClick={onLater}
            style={{flex:1,padding:"12px",borderRadius:12,border:`1.5px solid ${G3.border}`,background:G3.surface,fontSize:15,fontWeight:600,cursor:"pointer",color:G3.textM,fontFamily:G3.sans}}>
            Remind me later
          </button>
          <button onClick={handleConfirm}
            style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:G3.forest,fontSize:15,fontWeight:700,cursor:"pointer",color:"#fff",fontFamily:G3.sans}}>
            Confirm & Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ClassTrackerInner({user}){
  const [data,setData]         = useState(DEFAULT_DATA);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState(false);
  const [view,_setView]         = useState("home");
  const [activeClass,setActiveClass] = useState(null);
  const [selectedDate,setSelectedDate] = useState(todayKey());
  const [newNote,setNewNote]   = useState({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",status:""});
  const [editNote,setEditNote] = useState(null);
  const [newClass,setNewClass] = useState({institute:"",section:"",subject:""});
  const [showNoteDetails,setShowNoteDetails] = useState(false);
  const [search,setSearch]     = useState("");
  // Name editing removed — name set from Google/signup only
  const [editingClass,setEditingClass] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [instFilter,      setInstFilter]      = useState("all"); // institute filter on home
  const [leaveModal,setLeaveModal]     = useState(null);
  const [historyClassId,setHistoryClassId] = useState(null);
  const [signOutPrompt,setSignOutPrompt] = useState(false);
  const [exportOpen,setExportOpen]       = useState(false);
  const [statPeriod,setStatPeriod]       = useState("month");
  const [isOffline,setIsOffline]         = useState(!navigator.onLine);
  const [inlineToast,setInlineToast]     = useState(null);
  const inlineToastTimer                 = useRef(null);
  const [confirmModal,setConfirmModal]   = useState(null);
  const [savingGuard,setSavingGuard]     = useState(null); // {onLeave} — shown mid-save
  const [isMobile,setIsMobile]           = useState(window.innerWidth < 768);
  const noteRef  = useRef(null);
  const saveTimer= useRef(null);

  const [globalInstitutes,  setGlobalInstitutes]  = useState([]);
  const [instituteSections, setInstituteSections] = useState({}); // {instName:{gradeGroups}}
  const [unlinkedClasses,   setUnlinkedClasses]   = useState([]);  // classes needing link
  // Use sessionStorage so "Remind later" hides for this session only — shows again on next app open
  const [linkingDone,       setLinkingDone]        = useState(()=>sessionStorage.getItem("linkDismissed")==="1");

  useEffect(()=>{
    // Load admin-created institutes list and section definitions
    getGlobalInstitutes().then(list => setGlobalInstitutes(list)).catch(()=>{});
    getAllInstituteSections().then(secs => setInstituteSections(secs||{})).catch(()=>{});
  },[]);

  useEffect(()=>{
    loadUserData(user.uid).then(d=>{
      const base = d ? {...DEFAULT_DATA,...d,profile:d.profile||{name:""},trash:d.trash||{classes:[],notes:[]}} : DEFAULT_DATA;
      // Purge trash items older than 30 days before they reach the UI
      const purged = purgeExpiredTrash(base);
      // For brand-new users (no Firestore doc yet), always ask for name
      // even if Google provided a displayName — let them confirm/correct it
      if (!d) {
        purged.profile = { name: "" }; // force ProfileSetup screen
      } else if (!purged.profile?.name && user.displayName) {
        purged.profile = { name: user.displayName.trim() };
      }

      // Check localStorage for a pending save that may be newer than Firebase
      try{
        const pending=localStorage.getItem("classlog_pending_"+user.uid);
        if(pending){
          const {data:localData,savedAt}=JSON.parse(pending);
          const ageHrs=(Date.now()-savedAt)/(1000*60*60);
          if(ageHrs<24 && localData){
            setData({...purged,...localData,profile:purged.profile});
            saveUserData(user.uid,{...purged,...localData,profile:purged.profile})
              .then(()=>{
                localStorage.removeItem("classlog_pending_"+user.uid);
                setSaveErr(false);
              })
              .catch(()=>setSaveErr(true));
            if(purged.profile?.name) syncTeacherIndex(user.uid,purged).catch(()=>{});
            setLoading(false);
            return;
          } else {
            localStorage.removeItem("classlog_pending_"+user.uid);
          }
        }
      }catch(e){}

      setData(purged);
      if(purged.profile?.name) syncTeacherIndex(user.uid,purged).catch(()=>{});
      setLoading(false);
    }).catch(err=>{
      console.error("Failed to load data:",err);
      // Offline — try to restore from localStorage
      try{
        const pending=localStorage.getItem("classlog_pending_"+user.uid);
        if(pending){
          const {data:localData}=JSON.parse(pending);
          if(localData){
            setData({...DEFAULT_DATA,...localData,profile:{name:user.displayName||""}});
            setLoading(false);
            setSaveErr(true);
            return;
          }
        }
      }catch(e){}
      setData({...DEFAULT_DATA,profile:{name:user.displayName||""}});
      setLoading(false);
      setSaveErr(true);
    });
  },[user.uid]);
  useEffect(()=>{
    if(loading)return;
    setSaving(true);setSaveErr(false);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      saveUserData(user.uid,data)
        .then(()=>{
          setSaving(false);
          setSaveErr(false);
          // Clear any pending offline save since we saved successfully
          try{localStorage.removeItem("classlog_pending_"+user.uid);}catch(e){}
        })
        .catch(()=>{
          setSaving(false);
          setSaveErr(true);
          // Store to localStorage so data survives offline
          try{
            localStorage.setItem("classlog_pending_"+user.uid, JSON.stringify({data,savedAt:Date.now()}));
          }catch(e){}
        });
    },1000);
    return()=>clearTimeout(saveTimer.current);
  },[data]);
  // Safe navigation — shows in-app warning if save is in flight
  // ── Browser history integration — enables Android back gesture ──────────────
  // On mount: seed the base history entry so back never exits the app accidentally
  useEffect(() => {
    window.history.replaceState({ view: "home" }, "", "");
    // Push a sentinel so the first back press lands on "home" state, not empty
    window.history.pushState({ view: "home" }, "", "");
  }, []);

  // Wrap raw setter: every navigation pushes a history entry
  const setView = React.useCallback((nextView) => {
    _setView(prev => {
      if (prev === nextView) return prev;
      window.history.pushState({ view: nextView }, "", "");
      return nextView;
    });
  }, []);

  // Listen for back gesture — just read the state, no extra pushing
  useEffect(() => {
    const onPop = (e) => {
      const target = e.state?.view || "home";
      // addNote/editNote have no meaningful back target in history — go to classDetail
      if (target === "addNote" || target === "editNote") {
        _setView("classDetail");
      } else {
        _setView(target);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function safeNav(destination, action){
    if(saving){
      setSavingGuard({onLeave: action || (()=>setView(destination))});
    } else {
      action ? action() : setView(destination);
    }
  }

  function showInlineToast(msg){
    setInlineToast(msg);
    clearTimeout(inlineToastTimer.current);
    inlineToastTimer.current=setTimeout(()=>setInlineToast(null),3000);
  }

  useEffect(()=>{if((view==="addNote"||view==="editNote")&&noteRef.current)noteRef.current.blur();},[view]);
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);



  useEffect(()=>{
    const goOffline=()=>setIsOffline(true);
    const goOnline=()=>{
      setIsOffline(false);
      if(saveErr){
        setSaving(true);
        saveUserData(user.uid,data)
          .then(()=>{
            setSaving(false);
            setSaveErr(false);
            try{localStorage.removeItem("classlog_pending_"+user.uid);}catch(e){}
            showInlineToast("Back online — changes saved successfully");
          })
          .catch(()=>{setSaving(false);setSaveErr(true);});
      }
    };
    window.addEventListener("offline",goOffline);
    window.addEventListener("online",goOnline);
    return()=>{
      window.removeEventListener("offline",goOffline);
      window.removeEventListener("online",goOnline);
    };
  },[saveErr,data,user.uid]);

  // ── Must be before any conditional returns (Rules of Hooks) ─────────────────
  // After both data and sections load, find classes that don't match admin sections
  useEffect(()=>{
    if(loading || !Object.keys(instituteSections).length || linkingDone) return;
    const unlinked=(data.classes||[]).filter(cls=>{
      if(cls.left) return false;
      const instData=instituteSections[cls.institute];
      if(!instData) return false;
      const allSections=(instData.gradeGroups||[]).flatMap(g=>g.sections||[]);
      if(!allSections.length) return false;
      return !allSections.includes(cls.section);
    });
    setUnlinkedClasses(unlinked);
  },[loading,instituteSections,data.classes,linkingDone]);

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

  const classInsights = useMemo(()=>{
    const map={};
    (data.classes||[]).forEach(cls=>{
      const classNotes=data.notes?.[cls.id]||{};
      const recentEntries=Object.entries(classNotes)
        .sort(([a],[b])=>b.localeCompare(a))
        .flatMap(([,entries])=>Array.isArray(entries)?[...entries].sort((a,b)=>(b.created||0)-(a.created||0)):[]);
      const lastTitled=recentEntries.find(entry=>(entry?.title||"").trim());
      map[cls.id]={
        lastTopic:lastTitled?.title?.trim()||"",
        lastEntryAt:recentEntries[0]?.created||0,
      };
    });
    return map;
  },[data.classes,data.notes]);

  const preferredInstitute = useMemo(()=>{
    const usage={};
    (data.classes||[]).forEach(cls=>{
      const inst=(cls.institute||"").trim();
      if(!inst||cls.left) return;
      if(!usage[inst]) usage[inst]={count:0,lastUsed:0};
      usage[inst].count += 1;
      usage[inst].lastUsed = Math.max(usage[inst].lastUsed, cls.created||0);
    });
    const ranked=Object.entries(usage).sort((a,b)=>b[1].count-a[1].count||b[1].lastUsed-a[1].lastUsed);
    if(ranked[0]?.[0]) return ranked[0][0];
    if((data.institutes||[]).length===1) return data.institutes[0];
    return "";
  },[data.classes,data.institutes]);

  const recentClassCombos = useMemo(()=>{
    const seen=new Set();
    return [...(data.classes||[])]
      .filter(cls=>!cls.left&&(cls.institute||cls.section||cls.subject))
      .sort((a,b)=>(b.created||0)-(a.created||0))
      .filter(cls=>{
        const key=[cls.institute||"",cls.section||"",cls.subject||""].join("|").toLowerCase();
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(cls=>({
        institute:cls.institute||"",
        section:cls.section||"",
        subject:cls.subject||"",
        created:cls.created||0,
      }));
  },[data.classes]);

  useEffect(()=>{
    if(view!=="addClass") return;
    setNewClass(curr=>{
      if(curr.institute||curr.section||curr.subject||!preferredInstitute) return curr;
      return {...curr,institute:preferredInstitute};
    });
  },[view,preferredInstitute]);

  useEffect(()=>{
    if(view==="editNote"){ setShowNoteDetails(true); return; }
    if(view==="addNote") setShowNoteDetails(false);
  },[view,activeClass?.id,selectedDate]);

    if(loading)return<Spinner text="Loading…"/>;
  if(!data.profile?.name)return<ProfileSetup user={user} onSave={name=>setData(d=>({...d,profile:{name}}))} />;

  const teacherName=data.profile.name;
  const trashCount=(data.trash?.classes||[]).length+(data.trash?.notes||[]).length;

  const SaveBadge=()=>{
    if(!saving&&!saveErr) return null;
    const isOfflineSave=saveErr&&isOffline;
    return(
      <div style={{position:"fixed",top:70,right:16,borderRadius:20,padding:"5px 14px",fontSize:13,fontFamily:G.mono,zIndex:999,
        background:isOfflineSave?"#B45309":saveErr?G.red:G.navy,
        color:"#fff",boxShadow:G.shadowMd,letterSpacing:0.3,display:"flex",alignItems:"center",gap:6}}>
        {isOfflineSave?"📱 saved locally":saveErr?"⚠ save failed":"saving…"}
      </div>
    );
  };

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
    const createdAt=Date.now();
    setData(d=>{
      const inst=newClass.institute.trim(),sec=newClass.section.trim(),subj=newClass.subject.trim();
      return{
        ...d,
        classes:[...d.classes,{id,institute:inst,section:sec,subject:subj,colorIdx:d.classes.length%COLORS.length,created:createdAt}],
        notes:{...d.notes,[id]:{}},
        institutes:(d.institutes||[]).includes(inst)?d.institutes||[]:[...(d.institutes||[]),inst],
        sections:(d.sections||[]).includes(sec)?d.sections||[]:[...(d.sections||[]),sec],
        subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[]
      };
    });
    setNewClass({institute:"",section:"",subject:""});setView("home");
  };
  const deleteClass=(id,leaveReason,leaveReasonLabel)=>{setData(d=>{const cls=d.classes.find(c=>c.id===id);if(!cls)return d;const tc={...cls,deletedAt:Date.now(),savedNotes:d.notes[id]||{},leaveReason:leaveReason||"",leaveReasonLabel:leaveReasonLabel||""};return{...d,classes:d.classes.filter(c=>c.id!==id),notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id)),trash:{...d.trash,classes:[...(d.trash?.classes||[]),tc]}};});if(activeClass?.id===id){setActiveClass(null);setView("home");}};
  const updateClass=(id,updates)=>{
    setData(d=>{
      const inst=(updates.institute||"").trim();
      const sec=(updates.section||"").trim();
      const subj=(updates.subject||"").trim();
      return{
        ...d,
        classes:d.classes.map(c=>c.id===id?{...c,...updates}:c),
        institutes:inst&&!(d.institutes||[]).includes(inst)?[...(d.institutes||[]),inst]:d.institutes||[],
        sections:sec&&!(d.sections||[]).includes(sec)?[...(d.sections||[]),sec]:d.sections||[],
        subjects:subj&&!(d.subjects||[]).includes(subj)?[...(d.subjects||[]),subj]:d.subjects||[],
      };
    });
    if(activeClass?.id===id)setActiveClass(ac=>({...ac,...updates}));
    setEditingClass(null);
  };
  const restoreClass=(tc)=>{setData(d=>{const{deletedAt,savedNotes,...cls}=tc;return{...d,classes:[...d.classes,cls],notes:{...d.notes,[cls.id]:savedNotes||{}},trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==cls.id)}};});};
  const permDeleteClass=(id)=>{deleteClassNotes(user.uid,id).catch(()=>{});setData(d=>({...d,trash:{...d.trash,classes:(d.trash?.classes||[]).filter(c=>c.id!==id)}}));};

  const getClassNotes=(cid)=>data.notes[cid]||{};
  const getDateNotes=(cid,dk)=>{ const arr=(data.notes[cid]||{})[dk]; return Array.isArray(arr)?arr:[]; };
  const getAllNoteDates=(cid)=>new Set(Object.keys(data.notes[cid]||{}).filter(dk=>(data.notes[cid][dk]||[]).length>0));

  const addNote=()=>{
    if(!newNote.timeStart){showInlineToast("Please enter a start time before saving.");return;}

    // Duplicate check — same class, same date, overlapping or identical time
    const existing=(data.notes?.[activeClass.id]||{})[selectedDate]||[];
    if(newNote.timeStart){
      const newStart=newNote.timeStart;
      const clash=existing.find(e=>{
        if(!e.timeStart)return false;
        // Exact same start time = definite duplicate
        if(e.timeStart===newStart)return true;
        // Overlapping times check
        if(newNote.timeEnd&&e.timeEnd){
          const toMins=t=>{const[h,m]=t.split(":").map(Number);return h*60+m;};
          const ns=toMins(newStart),ne=toMins(newNote.timeEnd);
          const es=toMins(e.timeStart),ee=toMins(e.timeEnd);
          return ns<ee&&ne>es; // overlap
        }
        return false;
      });
      if(clash){
        showInlineToast(`Entry at ${clash.timeStart} already exists for this class on this date`);
        return;
      }
    }

    const note={id:Date.now().toString(),...newNote,status:newNote.status||"",teacherName,created:Date.now()};
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}};});
    setShowNoteDetails(false);
    setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:"",status:""});setView("classDetail");
  };
  const saveEdit=()=>{
    if(!editNote.timeStart){showInlineToast("Please enter a start time before saving.");return;}
    setData(d=>{const cn=d.notes[activeClass.id]||{};const dn=cn[selectedDate]||[];return{...d,notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}};});
    setShowNoteDetails(false);
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

  const totalNotes=data.classes.reduce((s,c)=>{const cn=data.notes[c.id]||{};return s+Object.values(cn).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);},0);
  const canAdd=isDateAllowed(selectedDate);
  const isReadOnlyDate=!canAdd;
  const dates=buildDateWindow();
  const selDateObj=dates.find(d=>d.key===selectedDate)||dates[7];
  const getClassUrgencyMeta = (cls) => classInsights[cls?.id] || { lastTopic:"", lastEntryAt:0 };

  // Build a noteDates map across ALL classes for the date strip dots
  // ── SINGLE SCROLLABLE HOME ───────────────────────────────────────────────
  // ── HOME VIEW — class list with institute filter ────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  // SHARED MODALS — used in both pages
  // ══════════════════════════════════════════════════════════════════════
  const sharedModals = (
    <>
      <SaveBadge/>
      {/* Offline banner */}
      {isOffline&&(
        <div style={{position:"fixed",top:58,left:0,right:0,zIndex:9998,background:"#B45309",color:"#fff",textAlign:"center",padding:"8px 16px",fontSize:13,fontWeight:600,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>📡</span> No internet connection — changes will save when reconnected
        </div>
      )}
      {/* In-app toast — replaces alert() */}
      {inlineToast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(21,43,34,0.95)",color:"#fff",borderRadius:20,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:G.sans,whiteSpace:"nowrap",zIndex:9999,pointerEvents:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          {inlineToast}
        </div>
      )}
      {savingGuard && <SavingGuardModal onWait={()=>setSavingGuard(null)} onLeave={()=>{setSavingGuard(null);savingGuard.onLeave();}}/>}
      {confirmModal && <ConfirmModal message={confirmModal.message} confirmLabel={confirmModal.label||"Delete"} onConfirm={confirmModal.onConfirm} onClose={()=>setConfirmModal(null)}/>}
      {signOutPrompt && <SignOutModal onConfirm={()=>{setSignOutPrompt(false);logout();}} onClose={()=>setSignOutPrompt(false)}/>}
      {exportOpen && <ExportModal data={data} teacherName={teacherName} onClose={()=>setExportOpen(false)}/>}
      {historyClassId && (()=>{const cls=data.classes.find(c=>c.id===historyClassId);return cls?<HistoryModal cls={cls} classNotes={data.notes[historyClassId]||{}} selectedDate={selectedDate} onSelectDate={setSelectedDate} onClose={()=>setHistoryClassId(null)}/>:null;})()}
      {unlinkedClasses.length>0&&!linkingDone&&(
        <SectionLinkingModal
          unlinkedClasses={unlinkedClasses}
          instituteSections={instituteSections}
          onConfirm={(renames)=>{
            setData(d=>({...d,classes:(d.classes||[]).map(cls=>renames[cls.id]?{...cls,section:renames[cls.id]}:cls)}));
            sessionStorage.removeItem("linkDismissed");
            setLinkingDone(true);
            setUnlinkedClasses([]);
          }}
          onLater={()=>{sessionStorage.setItem("linkDismissed","1");setLinkingDone(true);}}
        />
      )}
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
    const activeClasses=[...(data.classes||[]).filter(c=>!c.left)].sort((a,b)=>(b.created||0)-(a.created||0));
    // Show ALL institutes the teacher is associated with (from all classes — active + archived — and the
    // stored institutes list), so both tabs always appear even if one institute has no active classes yet.
    const institutesFromAllClasses=[...new Set((data.classes||[]).map(c=>c.institute||""))].filter(Boolean);
    const institutesFromStore=(data.institutes||[]).filter(Boolean);
    const institutes=[...new Set([...institutesFromAllClasses,...institutesFromStore])].filter(Boolean);
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
      <button onClick={()=>setExportOpen(true)}
        style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"7px 10px",cursor:"pointer",color:"rgba(255,255,255,0.85)",display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span className="desktop-only" style={{display:"inline",fontSize:13,fontWeight:600}}>Export</span>
      </button>
    </>;

    // Shared class card — click goes to class detail page (mobile) or selects (desktop)
    const ClassCard = ({cls, onClick}) => {
      const ic=instColor(cls.institute);
      const total=Object.values(data.notes?.[cls.id]||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
      // This-month entries
      const now=new Date();
      const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const MONTH_NAMES=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthLabel=`${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
      const monthN=Object.entries(data.notes?.[cls.id]||{}).reduce((s,[dk,arr])=>
        s+(dk.startsWith(monthKey)&&Array.isArray(arr)?arr.length:0),0);
      const todayArr=(data.notes?.[cls.id]||{})[todayKey()];
      const todayN=Array.isArray(todayArr)?todayArr.length:0;
      // Truncate long institute names with ellipsis
      const instFull=cls.institute||"";
      const instShort=instFull.length>22?instFull.slice(0,20)+"…":instFull;
      return(
        <div onClick={onClick}
          style={{background:G.surface,borderRadius:16,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"transform 0.1s,box-shadow 0.1s"}}
          onPointerDown={e=>{e.currentTarget.style.transform="scale(0.98)";e.currentTarget.style.boxShadow="none";}}
          onPointerUp={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowSm;}}
          onPointerCancel={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=G.shadowSm;}}>
          <div style={{height:6,background:ic.bg}}/>
          <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:46,height:46,borderRadius:12,background:ic.light,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:ic.bg,fontFamily:G.mono,borderLeft:`4px solid ${ic.bg}`}}>
              {(cls.section||"?").slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.2,marginBottom:5}}>{cls.section}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span title={instFull} style={{background:ic.light,color:ic.bg,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,fontFamily:G.sans,border:`1px solid ${ic.bg}44`,flexShrink:0,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {instShort}
                </span>
                {cls.subject&&<span style={{fontSize:12,color:G.textL,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>· {cls.subject}</span>}
              </div>
            </div>
            {/* Right: clearly labelled stats */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
              {/* Today */}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:11,color:G.textL,fontFamily:G.sans}}>Today</span>
                <span style={{minWidth:26,height:22,borderRadius:20,background:todayN>0?G.forest:"rgba(0,0,0,0.06)",color:todayN>0?"#fff":G.textL,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 7px",fontFamily:G.mono}}>{todayN}</span>
              </div>
              {/* This month */}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:11,color:G.textL,fontFamily:G.sans}}>{monthLabel}</span>
                <span style={{minWidth:26,height:22,borderRadius:20,background:monthN>0?G.greenL:"rgba(0,0,0,0.06)",color:monthN>0?G.green:G.textL,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 7px",fontFamily:G.mono}}>{monthN}</span>
              </div>
              {/* Total */}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:11,color:G.textL,fontFamily:G.sans}}>Total</span>
                <span style={{minWidth:26,height:22,borderRadius:20,background:"rgba(0,0,0,0.06)",color:G.textM,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 7px",fontFamily:G.mono}}>{total}</span>
              </div>
            </div>
            <div style={{color:G.textL,fontSize:20,flexShrink:0,paddingLeft:2}}>›</div>
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
              {/* Tagline */}
              <div style={{textAlign:"center",padding:"20px 0 4px"}}>
                <span style={{fontSize:12,color:G.textL,fontFamily:G.sans,letterSpacing:0.3}}>Every class. Every teacher. One place.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );

    // ── TABLET / DESKTOP VIEW: sidebar + detail panel ────────────────────────
    const SplitView = () => {
      const [sidebarWidth, setSidebarWidth] = React.useState(280);
      const isDragging = React.useRef(false);
      const dragStartX = React.useRef(0);
      const dragStartW = React.useRef(280);
      const containerRef = React.useRef(null);

      function onDividerPointerDown(e) {
        e.preventDefault();
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartW.current = sidebarWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        function onMove(ev) {
          if (!isDragging.current) return;
          const dx = ev.clientX - dragStartX.current;
          const containerW = containerRef.current?.offsetWidth || window.innerWidth;
          const newW = Math.min(Math.max(dragStartW.current + dx, 180), containerW * 0.6);
          setSidebarWidth(newW);
        }
        function onUp() {
          isDragging.current = false;
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      return (
      <div ref={containerRef} style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left sidebar */}
        <div style={{width:sidebarWidth,flexShrink:0,display:"flex",flexDirection:"column",background:G.surface,overflow:"hidden"}}>
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
              const total=Object.values(data.notes?.[cls.id]||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
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

        {/* ── Draggable divider ── */}
        <div
          onPointerDown={onDividerPointerDown}
          style={{
            width:8, flexShrink:0, cursor:"col-resize",
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"transparent", position:"relative", zIndex:10,
            WebkitTapHighlightColor:"transparent",
          }}
          onMouseEnter={e=>{e.currentTarget.querySelector(".divider-line").style.background=G.green;e.currentTarget.querySelector(".divider-grip").style.opacity="1";}}
          onMouseLeave={e=>{e.currentTarget.querySelector(".divider-line").style.background=G.border;e.currentTarget.querySelector(".divider-grip").style.opacity="0";}}>
          <div className="divider-line" style={{position:"absolute",top:0,bottom:0,left:"50%",transform:"translateX(-50%)",width:1,background:G.border,transition:"background 0.15s"}}/>
          <div className="divider-grip" style={{
            position:"relative", zIndex:1,
            width:20, height:48, borderRadius:10,
            background:G.surface, border:`1.5px solid ${G.border}`,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:3, opacity:0, transition:"opacity 0.15s",
            boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
          }}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:3,height:3,borderRadius:"50%",background:G.textL}}/>
            ))}
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
                <OverflowMenu buttonSize={32} items={[
                  { icon:"✏", label:"Edit class", onClick:()=>setEditingClass(selCls) },
                  { icon:"🗑", label:"Archive class", danger:true, onClick:()=>setLeaveModal(selCls.id) },
                ]}/>
              </div>
              <div style={{maxWidth:420,margin:"0 auto"}}><DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={selNoteDates}/></div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 18px 40px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10}}>
                <span style={{fontSize:15,fontWeight:700,color:G.text}}>{formatDateLabel(selectedDate)}<span style={{color:selDateNotes.length>0?G.green:G.textM,marginLeft:8}}>· {selDateNotes.length} {selDateNotes.length===1?"entry":"entries"}</span></span>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button
                    onClick={()=>setHistoryClassId(selCls.id)}
                    disabled={selTotal===0}
                    style={{
                      background:selTotal===0?G.bg:G.surface,
                      color:selTotal===0?G.textL:G.textS,
                      border:`1px solid ${selTotal===0?G.border:G.borderM}`,
                      borderRadius:9,
                      padding:"8px 14px",
                      fontSize:14,
                      cursor:selTotal===0?"not-allowed":"pointer",
                      fontFamily:G.sans,
                      fontWeight:700,
                      display:"flex",
                      alignItems:"center",
                      gap:5,
                      minHeight:40,
                      WebkitTapHighlightColor:"transparent"
                    }}>
                    🕘 History
                  </button>
                  {canAdd&&<button onClick={()=>{
    setActiveClass(selCls);
    const _ks=getSlotsForSection(selCls,instituteSections);
    const _used=new Set(((data.notes?.[selCls.id]||{})[selectedDate]||[]).map(e=>e.timeStart).filter(Boolean));
    const _def=_ks?getDefaultKisSlot(data.notes,selCls.id,_ks,_used):null;
    setNewNote(_def&&!_used.has(_def.start)
      ?{title:"",body:"",tag:"note",status:"",timeStart:_def.start,timeEnd:_def.end,_dur:_def.durMins,_kisSlot:true,_suggestedEnd:_def.end}
      :{title:"",body:"",tag:"note",status:"",...(_ks?{}:(getSuggestedTime(data.notes,selCls.id,selectedDate)||{_dur:selCls?.duration||60}))});
    safeNav("addNote");
  }} onPointerDown={e=>rpl(e,true)} style={{background:selColor.bg,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:5,minHeight:40,WebkitTapHighlightColor:"transparent"}}>+ Add Entry</button>}
                </div>
              </div>
              {selDateNotes.length===0?(
                <div style={{background:G.surface,borderRadius:14,border:`2px dashed ${G.border}`,padding:"40px 20px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>✏️</div>
                  <div style={{fontSize:15,color:G.textM}}>{canAdd?"No entries yet — click + Add Entry":"No entries for this date"}</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {isReadOnlyDate&&(
                    <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
                      Viewing past entries only. Dates older than the past week cannot be edited.
                    </div>
                  )}
                  {selDateNotes.map(note=>{const tag=(note?.tag&&TAG_STYLES[note.tag])||TAG_STYLES.note;return(
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
                          {canAdd&&(
                            <OverflowMenu items={[
                              { icon:"✏", label:"Edit entry", onClick:()=>{setEditNote({...note});setView("editNote");} },
                              { icon:"🗑", label:"Delete entry", danger:true, onClick:()=>deleteNote(note.id) },
                            ]}/>
                          )}
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
    };

    return(
      <div style={{height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} onViewStats={()=>setView("stats")} onViewTrash={()=>setView("trash")} trashCount={trashCount} right={NavRight}/>
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
    const totalCount=Object.values(classNotes||{}).reduce((a,arr)=>a+(Array.isArray(arr)?arr.length:0),0);
    const noteDates=Object.fromEntries(Object.entries(classNotes).filter(([,arr])=>Array.isArray(arr)&&arr.length>0).map(([dk,arr])=>[dk,arr.length]));
    return(
      <div style={{height:"100svh",minHeight:"-webkit-fill-available",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.sans,overflow:"hidden"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
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
            <OverflowMenu items={[
              { icon:"✏", label:"Edit class", onClick:()=>setEditingClass(cls) },
              { icon:"🗑", label:"Archive class", danger:true, onClick:()=>setLeaveModal(cls.id) },
            ]}/>
          </div>
          <div style={{maxWidth:420}}><DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={noteDates}/></div>
        </div>
        {/* Entries scroll area */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px 16px",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>{formatDateLabel(selectedDate)}</div>
              <div style={{fontSize:13,color:dateNotes.length>0?G.green:G.textM,fontWeight:600,marginTop:2}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <button
                onClick={()=>setHistoryClassId(activeClass.id)}
                disabled={totalCount===0}
                style={{
                  background:totalCount===0?G.bg:G.surface,
                  color:totalCount===0?G.textL:G.textS,
                  border:`1px solid ${totalCount===0?G.border:G.borderM}`,
                  borderRadius:12,
                  padding:"11px 18px",
                  fontSize:15,
                  cursor:totalCount===0?"not-allowed":"pointer",
                  fontFamily:G.sans,
                  fontWeight:700,
                  display:"flex",
                  alignItems:"center",
                  gap:6,
                  minHeight:48,
                  WebkitTapHighlightColor:"transparent",
                  flexShrink:0
                }}>
                🕘 History
              </button>
              {canAdd&&<button onClick={()=>{
    const _ks=getSlotsForSection(activeClass,instituteSections);
    const _used=new Set(((data.notes?.[activeClass.id]||{})[selectedDate]||[]).map(e=>e.timeStart).filter(Boolean));
    const _def=_ks?getDefaultKisSlot(data.notes,activeClass.id,_ks,_used):null;
    setNewNote(_def&&!_used.has(_def.start)
      ?{title:"",body:"",tag:"note",status:"",timeStart:_def.start,timeEnd:_def.end,_dur:_def.durMins,_kisSlot:true,_suggestedEnd:_def.end}
      :{title:"",body:"",tag:"note",status:"",...(_ks?{}:(getSuggestedTime(data.notes,activeClass.id,selectedDate)||{_dur:activeClass?.duration||60}))});
    safeNav("addNote");
  }} onPointerDown={e=>rpl(e,true)}
                style={{background:color.bg,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:15,cursor:"pointer",fontFamily:G.sans,fontWeight:700,display:"flex",alignItems:"center",gap:6,minHeight:48,WebkitTapHighlightColor:"transparent",boxShadow:`0 4px 14px ${color.bg}55`,flexShrink:0}}>
                + Add Entry
              </button>}
            </div>
          </div>
          {dateNotes.length===0?(
            <div style={{background:G.surface,borderRadius:16,border:`2px dashed ${G.border}`,padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>✏️</div>
              <div style={{fontSize:16,color:G.textM,fontWeight:500}}>{canAdd?"No entries yet":"No entries for this date"}</div>
              {canAdd&&<div style={{fontSize:14,color:G.textL,marginTop:6}}>Tap + Add Entry to log this class</div>}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {isReadOnlyDate&&(
                <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#9A3412",fontWeight:600}}>
                  Viewing past entries only. Dates older than the past week cannot be edited.
                </div>
              )}
              {dateNotes.map(note=>{
                const tag=(note?.tag&&TAG_STYLES[note.tag])||TAG_STYLES.note;
                return(
                  <div key={note.id} style={{background:G.surface,borderRadius:14,border:`1px solid ${G.border}`,overflow:"hidden",boxShadow:G.shadowSm}}>
                    <div style={{height:4,background:tag.bg}}/>
                    <div style={{padding:"13px 15px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:note.title?8:0}}>
                            <span style={{background:tag.bg,color:tag.text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.mono,fontWeight:600}}>{tag.label}</span>
                            {note.timeStart&&<span style={{fontSize:13,color:G.textS,fontFamily:G.mono,background:G.bg,borderRadius:10,padding:"3px 10px",border:`1px solid ${G.borderM}`,fontWeight:600}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                            {note.status&&STATUS_STYLES[note.status]&&<span style={{background:STATUS_STYLES[note.status].bg,color:STATUS_STYLES[note.status].text,fontSize:12,borderRadius:10,padding:"3px 10px",fontFamily:G.sans,fontWeight:600}}>{STATUS_STYLES[note.status].label}</span>}
                          </div>
                          {note.title&&<div style={{fontWeight:700,fontSize:17,color:G.text,fontFamily:G.display,lineHeight:1.3,marginBottom:4}}>{note.title}</div>}
                          {note.body&&<p style={{margin:0,fontSize:15,color:G.textS,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                        </div>
                        {canAdd&&(
                          <OverflowMenu items={[
                            { icon:"✏", label:"Edit entry", onClick:()=>{setEditNote({...note});setView("editNote");} },
                            { icon:"🗑", label:"Delete entry", danger:true, onClick:()=>deleteNote(note.id) },
                          ]}/>
                        )}
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
    const selectedInstitute = newClass.institute || preferredInstitute;
    const comboSuggestions = recentClassCombos
      .filter(combo=>!selectedInstitute || combo.institute===selectedInstitute)
      .slice(0,4);
    return(
    <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
      <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
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
          {preferredInstitute&&newClass.institute===preferredInstitute&&(
            <div style={{fontSize:12,color:G.green,fontWeight:700,marginTop:-3,marginBottom:10}}>Using your most common institute to save time.</div>
          )}
          <label style={{...lbl,marginTop:10}}>Class / Section</label>
          {(()=>{
            const adminSecs=(instituteSections[newClass.institute]?.gradeGroups||[]).flatMap(g=>g.sections||[]);
            return adminSecs.length>0
              ? <ReadOnlyDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={adminSecs} placeholder="Select section" emptyMsg="Ask your admin to add sections."/>
              : <CreatableDropdown value={newClass.section} onChange={s=>setNewClass(c=>({...c,section:s}))} options={sortedByUsage(data.sections||[],"section")} onAddOption={addSectionName} placeholder="e.g. 9th A, 10th B" addPlaceholder="Type class or section…"/>;
          })()}
          <label style={{...lbl,marginTop:10}}>Subject</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={sortedByUsage(data.subjects||[],"subject")} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>
          {comboSuggestions.length>0&&(
            <div style={{marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:G.textL,marginBottom:8}}>Recent combinations</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {comboSuggestions.map((combo,idx)=>(
                  <button key={`${combo.institute}-${combo.section}-${combo.subject}-${idx}`} type="button"
                    onClick={()=>setNewClass(c=>({
                      ...c,
                      institute:combo.institute||c.institute,
                      section:combo.section,
                      subject:combo.subject,
                    }))}
                    style={{padding:"8px 12px",borderRadius:20,border:`1px solid ${G.border}`,background:G.surface,color:G.textM,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:G.sans,WebkitTapHighlightColor:"transparent"}}>
                    {combo.section||"Untitled class"}{combo.subject?` · ${combo.subject}`:""}
                  </button>
                ))}
              </div>
            </div>
          )}
          <PrimaryBtn onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()} onPointerDown={e=>rpl(e,true)} style={{marginTop:16,width:"100%",padding:"13px",fontSize:16}}>Add Class</PrimaryBtn>
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
      if(!tStart||!tEnd||typeof tStart!=="string"||typeof tEnd!=="string")return 0;
      try{
        const sp=tStart.split(":");
        const ep=tEnd.split(":");
        if(sp.length<2||ep.length<2)return 0;
        const sh=Number(sp[0]),sm=Number(sp[1]);
        const eh=Number(ep[0]),em=Number(ep[1]);
        if(isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em))return 0;
        const d=(eh*60+em)-(sh*60+sm);
        return d>0&&d<480?d:0; // cap at 8hrs — guards corrupt data
      }catch(e){return 0;}
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
      Object.entries(data.notes?.[cls.id]||{}).forEach(([dk,entries])=>{
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
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans,display:"flex",flexDirection:"column"}}>
        {sharedModals}
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
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
    const tClasses=(Array.isArray(data.trash?.classes)?data.trash.classes:[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const tNotes=(Array.isArray(data.trash?.notes)?data.trash.notes:[]).sort((a,b)=>b.deletedAt-a.deletedAt);
    const daysLeft=ts=>Math.max(0,30-Math.floor((Date.now()-ts)/(1000*60*60*24)));
    return(
      <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.bg,fontFamily:G.sans}}>
        <SaveBadge/>
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)} onViewStats={()=>setView("stats")} onViewTrash={()=>setView("trash")} trashCount={trashCount} right={<GhostBtn onClick={()=>setView("home")}>← Back</GhostBtn>}/>
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
                        <button onClick={()=>setConfirmModal({message:`Permanently delete "${tc.section}"? This cannot be undone.`,label:"Delete Class",onConfirm:()=>permDeleteClass(tc.id)})}
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
                          <button onClick={()=>setConfirmModal({message:"Permanently delete this entry? Cannot be undone.",label:"Delete Entry",onConfirm:()=>permDeleteNote(tn.id)})}
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
    const lastTopicSuggestion=!isEdit&&activeClass?getClassUrgencyMeta(activeClass).lastTopic:"";
    const hasExtraDetails=Boolean((form.title||"").trim()||(form.body||"").trim());
    const showSuggestedTopic=Boolean(lastTopicSuggestion&&lastTopicSuggestion!==(form.title||"").trim());
    const saveLabel=isEdit?"Save Changes":hasExtraDetails?"Save Entry":"Quick Save";

    return(
      <div style={{height:"100dvh",minHeight:"100vh",width:"100%",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.sans}}>
        <TopNav user={user} teacherName={teacherName} data={data} onLogoClick={()=>setView("home")} onSignOut={()=>setSignOutPrompt(true)}
          right={<>
            <GhostBtn onClick={()=>setView("classDetail")} style={{color:"rgba(255,255,255,0.8)",borderColor:"rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)"}}>← Back</GhostBtn>
          </>}
        />

        {/* Class name bar — static in flow, always visible above scrollable content */}
        {activeClass&&(
          <div style={{flexShrink:0,background:G.forest,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#34D077",flexShrink:0}}/>
            <span style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:G.display,letterSpacing:-0.2}}>{activeClass.section}</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:260}}>· {activeClass.institute}{activeClass.subject?` · ${activeClass.subject}`:""}</span>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch"}}>
          {!isEdit&&(
            <div style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"12px 16px"}}>
              <div style={{maxWidth:660,margin:"0 auto"}}>
                {isMobile
                  ? <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:22}}>📅</span>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display}}>{formatDateLabel(selectedDate)}</div>
                        <button onClick={()=>setView("classDetail")}
                          style={{background:"none",border:"none",padding:0,fontSize:12,color:G.green,fontFamily:G.sans,fontWeight:600,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>
                          Change date
                        </button>
                      </div>
                    </div>
                  : <>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <span style={{fontSize:15,color:G.green}}>📅</span>
                        <span style={{fontSize:16,fontWeight:600,color:G.text,fontFamily:G.display}}>{selDateObj.monthFull} {selDateObj.year}</span>
                      </div>
                      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} noteDates={{}}/>
                    </>
                }
              </div>
            </div>
          )}
          <div className="mobile-pad" style={{maxWidth:660,width:"100%",margin:"0 auto",padding:"32px 16px 72px",boxSizing:"border-box"}}>
            <p style={{fontSize:14,color:G.textM,fontFamily:G.sans,marginBottom:5,textTransform:"uppercase",fontWeight:600}}>{isEdit?"Editing Entry":"New Entry For"}</p>
            <h2 style={{marginBottom:22,fontSize:28,letterSpacing:-0.5,fontFamily:G.display}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>
            <div style={{background:G.greenL,borderRadius:10,padding:"9px 14px",marginBottom:20,fontSize:15,color:G.green,fontFamily:G.sans,display:"flex",alignItems:"center",gap:8}}>
              <span>👤</span><span>Logged as: <strong>{teacherName}</strong></span>
            </div>
          <div className="form-card" style={{...card,padding:"24px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:18,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:0.7,color:G.textL,marginBottom:4}}>Quick log</div>
                <div style={{fontSize:14,color:G.textM,lineHeight:1.5}}>Save with status and time first. Topic and notes stay optional.</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:hasExtraDetails?G.green:G.textL,background:hasExtraDetails?G.greenL:G.bg,border:`1px solid ${hasExtraDetails?G.green:G.border}`,borderRadius:999,padding:"6px 10px"}}>
                {hasExtraDetails?"Details added":"Minimal entry"}
              </span>
            </div>
            <div style={{marginBottom:18}}>
              <label style={lbl}>Topic Status</label>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {Object.entries(STATUS_STYLES).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,status:form.status===key?"":key})}
                    style={{background:form.status===key?val.bg:G.surface,color:form.status===key?val.text:G.textM,
                      border:`1.5px solid ${form.status===key?val.dot:G.border}`,
                      borderRadius:20,padding:"8px 18px",fontSize:14,cursor:"pointer",fontFamily:G.sans,
                      fontWeight:form.status===key?700:500,transition:"all 0.15s",
                      WebkitTapHighlightColor:"transparent"}}>
                    {val.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:12,color:G.textL,marginTop:5}}>Tap again to deselect</div>
            </div>
            <div style={{marginBottom:16}}>

              {/* ══════════════════════════════════════════════════════
                   TIME ENTRY — two modes:
                   A) KIS class   → slot pills + optional manual expand
                   B) Other class → history suggestion + manual input
                ══════════════════════════════════════════════════════ */}
              {(()=>{
                const kisSlots=getSlotsForSection(activeClass,instituteSections);

                // ── MODE A: KIS timetable ──────────────────────────────────
                if(kisSlots){
                  const dayEntries=(data.notes?.[activeClass?.id]||{})[selectedDate]||[];
                  const usedStarts=new Set(
                    dayEntries.filter(e=>!isEdit||e.id!==form.id).map(e=>e.timeStart).filter(Boolean)
                  );
                  return(
                    <>
                      {/* Slot pills */}
                      <div style={{marginBottom:form._manualTime?12:20}}>
                        <label style={lbl}>Timetable slots</label>
                        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                          {kisSlots.map(slot=>{
                            const isUsed=usedStarts.has(slot.start);
                            const isSel=!form._manualTime&&form.timeStart===slot.start;
                            return(
                              <button key={slot.start} type="button" disabled={isUsed}
                                onClick={()=>{
                                  if(isUsed) return;
                                  setForm({...form,timeStart:slot.start,timeEnd:slot.end,_dur:slot.durMins,_kisSlot:true,_manualTime:false,_suggested:false,_suggestedEnd:slot.end});
                                }}
                                style={{
                                  padding:"10px 16px",borderRadius:22,fontSize:14,fontFamily:G.mono,fontWeight:700,
                                  border:`2px solid ${isSel?G.forest:isUsed?"#E5E7EB":G.border}`,
                                  background:isSel?G.forest:isUsed?"#F9FAFB":G.surface,
                                  color:isSel?"#fff":isUsed?"#9CA3AF":G.text,
                                  cursor:isUsed?"not-allowed":"pointer",
                                  textDecoration:isUsed?"line-through":"none",
                                  WebkitTapHighlightColor:"transparent",transition:"all 0.15s",minHeight:44,
                                }}>
                                {fmtSlot(slot.start)}–{fmtSlot(slot.end)}
                                {isUsed&&<span style={{fontSize:11,marginLeft:6,fontWeight:600,textDecoration:"none",opacity:0.7}}>✓ done</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Off-schedule toggle line */}
                      {!form._manualTime&&(
                        <button type="button"
                          onClick={()=>setForm({...form,_kisSlot:false,_manualTime:true,timeStart:"",timeEnd:"",_suggestedEnd:null})}
                          style={{background:"none",border:"none",padding:"0 0 16px",cursor:"pointer",
                            color:G.textL,fontSize:13,fontFamily:G.sans,textAlign:"left",
                            display:"flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent"}}>
                          <span style={{fontSize:15}}>＋</span>
                          <span style={{textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:3}}>
                            This class isn't in the schedule — log a custom time
                          </span>
                        </button>
                      )}

                      {/* Manual expand (off-schedule) */}
                      {form._manualTime&&(
                        <>
                          <button type="button"
                            onClick={()=>setForm({...form,_manualTime:false,timeStart:"",timeEnd:"",_suggestedEnd:null})}
                            style={{background:"none",border:"none",padding:"0 0 14px",cursor:"pointer",
                              color:G.green,fontSize:13,fontFamily:G.sans,fontWeight:600,
                              display:"flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent"}}>
                            ← Back to timetable slots
                          </button>
                          <label style={lbl}>Start Time <span style={{color:G.red,marginLeft:3}}>*</span></label>
                          <input type="time" value={form.timeStart||""}
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
                            style={{...inp,fontSize:16}}/>
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
                                      style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${isSel?G.forest:G.border}`,cursor:"pointer",
                                        fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:42,WebkitTapHighlightColor:"transparent",
                                        background:isSel?G.forest:"transparent",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {form.timeStart&&(
                            <div>
                              <label style={{...lbl,marginBottom:6}}>End Time
                                {form._suggestedEnd&&form.timeEnd===form._suggestedEnd&&
                                  <span style={{color:G.green,fontWeight:500,textTransform:"none",fontSize:12,marginLeft:8}}>suggested</span>}
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
                        </>
                      )}
                    </>
                  );
                }

                // ── MODE B: Non-KIS — history suggestion + manual ──────────
                return(
                  <>
                    {form._suggested&&form.timeStart&&(
                      <div style={{background:G.greenL,border:"1px solid "+G.green,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:18}}>&#128161;</span>
                        <div style={{flex:1,minWidth:120}}>
                          <div style={{fontSize:13,fontWeight:700,color:G.green}}>Suggested from your history</div>
                          <div style={{fontSize:12,color:G.textM,marginTop:1}}>
                            {fmtSlot(form.timeStart)} – {fmtSlot(form.timeEnd)} · same time as your usual {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(selectedDate).getDay()]} class
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
                                style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${isSel?G.forest:G.border}`,cursor:"pointer",
                                  fontFamily:G.sans,fontSize:14,fontWeight:isSel?700:500,minHeight:42,WebkitTapHighlightColor:"transparent",
                                  background:isSel?G.forest:"transparent",color:isSel?"#fff":G.textM,transition:"all 0.15s"}}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {form.timeStart&&(
                      <div>
                        <label style={{...lbl,marginBottom:6}}>End Time
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
                  </>
                );
              })()}
            </div>
            <div style={{marginBottom:18,border:`1px solid ${G.border}`,borderRadius:14,overflow:"hidden",background:G.surface}}>
              <button type="button" onClick={()=>setShowNoteDetails(o=>!o)}
                style={{width:"100%",background:"transparent",border:"none",padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:3}}>Add details</div>
                  <div style={{fontSize:12,color:G.textM,lineHeight:1.5}}>
                    {showSuggestedTopic
                      ? `Suggested topic: ${lastTopicSuggestion}`
                      : hasExtraDetails
                        ? "Topic or notes added for this entry."
                        : "Optional topic and notes for richer history."}
                  </div>
                </div>
                <span style={{fontSize:18,color:G.textL,fontWeight:700}}>{showNoteDetails?"−":"+"}</span>
              </button>
              {showNoteDetails&&(
                <div style={{padding:"0 16px 16px"}}>
                  {showSuggestedTopic&&(
                    <button type="button" onClick={()=>setForm({...form,title:lastTopicSuggestion})}
                      style={{background:G.greenL,border:`1px solid ${G.green}`,borderRadius:12,padding:"10px 12px",fontSize:13,color:G.green,fontWeight:700,cursor:"pointer",fontFamily:G.sans,marginBottom:14,display:"flex",alignItems:"center",gap:8,WebkitTapHighlightColor:"transparent"}}>
                      <span>💡</span>
                      <span>Use last topic: {lastTopicSuggestion}</span>
                    </button>
                  )}
                  <div style={{marginBottom:14}}>
                    <label style={lbl}>Title</label>
                    <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What was covered?" style={{...inp,fontSize:16,fontWeight:500,marginBottom:0}}/>
                  </div>
                  <div>
                    <label style={lbl}>Notes</label>
                    <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={6} style={{...inp,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
                  </div>
                </div>
              )}
            </div>
            <PrimaryBtn onClick={save} disabled={!form.timeStart} onPointerDown={e=>rpl(e,true)} style={{marginTop:20,padding:"13px 28px",fontSize:16,opacity:form.timeStart?1:0.45,cursor:form.timeStart?"pointer":"not-allowed",width:"100%"}}>
              {saveLabel}
            </PrimaryBtn>
          </div>
          </div>{/* end mobile-pad */}
        </div>{/* end scrollable */}
      </div>
    );
  }
  return null;
}

export default function ClassTracker(props){
  return <CTErrorBoundary><ClassTrackerInner {...props}/></CTErrorBoundary>;
}
