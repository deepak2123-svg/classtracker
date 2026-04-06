import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const COLORS = [
  { bg: "#FF6B6B", light: "#FFE5E5", text: "#8B0000" },
  { bg: "#4ECDC4", light: "#E0F7F6", text: "#00574B" },
  { bg: "#FFD93D", light: "#FFF8DC", text: "#7A5C00" },
  { bg: "#6BCB77", light: "#E4F7E6", text: "#1A5C27" },
  { bg: "#845EC2", light: "#EFE6FF", text: "#3D007A" },
  { bg: "#FF9671", light: "#FFF0E8", text: "#7A3000" },
  { bg: "#0089BA", light: "#E0F2FA", text: "#004A6E" },
  { bg: "#F9A8D4", light: "#FDE8F5", text: "#7C1A50" },
];

const TAG_STYLES = {
  note:      { bg: "#E8EDFF", text: "#3730A3", label: "📝 Note" },
  todo:      { bg: "#FEF3C7", text: "#92400E", label: "✅ To-Do" },
  important: { bg: "#FEE2E2", text: "#991B1B", label: "🔥 Important" },
  resource:  { bg: "#D1FAE5", text: "#065F46", label: "🔗 Resource" },
};

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOC_REF = doc(db, "classtracker", "data");
const DEFAULT_DATA = { classes: [], notes: {}, classNames: [], subjects: [] };

async function loadData() {
  try { const s = await getDoc(DOC_REF); if (s.exists()) return s.data(); } catch {}
  return DEFAULT_DATA;
}
async function saveData(d) {
  try { await setDoc(DOC_REF, d); } catch (e) { console.error(e); }
}

function toDateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function todayKey() { const n = new Date(); return toDateKey(n.getFullYear(), n.getMonth(), n.getDate()); }
function formatDateLabel(dk) {
  if (!dk) return "";
  const [y,m,d] = dk.split("-").map(Number);
  if (dk === todayKey()) return "Today";
  return new Date(y,m-1,d).toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" });
}
function formatTime(t) {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}

const inp = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E5E5E5", fontSize:15, fontFamily:"Georgia,serif", outline:"none", background:"#fff", boxSizing:"border-box", marginBottom:10 };

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({ value, onChange, options, onAddOption, placeholder, addPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);
  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setAdding(false); setNewVal(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const confirmAdd = () => {
    const t = newVal.trim(); if (!t) return;
    if (!options.includes(t)) onAddOption(t);
    onChange(t); setNewVal(""); setAdding(false); setOpen(false);
  };
  return (
    <div ref={wrapRef} style={{ position:"relative", marginBottom:10 }}>
      <button type="button" onClick={() => { setOpen(o=>!o); setAdding(false); setNewVal(""); }}
        style={{ ...inp, marginBottom:0, cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", color:value?"#1A1A1A":"#aaa" }}>
        <span>{value||placeholder}</span>
        <span style={{ color:"#bbb", fontSize:11 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#fff", borderRadius:12, border:"1.5px solid #E0E0E0", boxShadow:"0 8px 28px rgba(0,0,0,0.12)", zIndex:200, overflow:"hidden" }}>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {options.length===0 && <div style={{ padding:"12px 14px", color:"#ccc", fontSize:13 }}>No saved options — add one below</div>}
            {options.map(opt => {
              const sel = opt===value;
              return (
                <div key={opt} onClick={()=>{ onChange(opt); setOpen(false); }}
                  style={{ padding:"10px 16px", cursor:"pointer", fontSize:14, color:sel?"#6D28D9":"#1A1A1A", fontWeight:sel?600:400, background:sel?"#F3EEFF":"transparent", display:"flex", alignItems:"center", gap:10 }}
                  onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background="#F9F9F9"; }}
                  onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background="transparent"; }}>
                  <span style={{ width:16, color:"#6D28D9", fontSize:13 }}>{sel?"✓":""}</span>{opt}
                </div>
              );
            })}
          </div>
          <div style={{ borderTop:"1px solid #F0F0F0" }}>
            {!adding
              ? <div onClick={()=>setAdding(true)} style={{ padding:"11px 16px", cursor:"pointer", fontSize:13, color:"#7C3AED", fontFamily:"monospace", display:"flex", alignItems:"center", gap:7 }} onMouseEnter={e=>e.currentTarget.style.background="#F5F0FF"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              : <div style={{ padding:"8px 10px", display:"flex", gap:6, alignItems:"center" }}>
                  <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") confirmAdd(); if(e.key==="Escape"){setAdding(false);setNewVal("");} }} placeholder={addPlaceholder} style={{ flex:1, padding:"8px 11px", borderRadius:8, border:"1.5px solid #C4B5FD", fontSize:13, fontFamily:"Georgia,serif", outline:"none" }} />
                  <button onClick={confirmAdd} style={{ background:"#7C3AED", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, cursor:"pointer" }}>Add</button>
                  <button onClick={()=>{setAdding(false);setNewVal("");}} style={{ background:"#F5F5F5", color:"#888", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ color, notes, onSelectDate, selectedDate }) {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));
  while (cells.length%7!==0) cells.push(null);
  const tk = todayKey();
  const prevMonth = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.07)", border:"1.5px solid #F0F0F0" }}>
      <div style={{ background:color.bg, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={prevMonth} style={{ background:"rgba(255,255,255,0.25)", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#fff", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#fff", fontSize:18, fontWeight:700 }}>{MONTHS[calMonth]}</div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:12, fontFamily:"monospace" }}>{calYear}</div>
        </div>
        <button onClick={nextMonth} style={{ background:"rgba(255,255,255,0.25)", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#fff", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"12px 12px 4px" }}>
        {DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, color:"#bbb", fontFamily:"monospace", padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 12px 14px", gap:3 }}>
        {cells.map((day,i) => {
          if (!day) return <div key={`e${i}`} />;
          const dk         = toDateKey(calYear, calMonth, day);
          const isToday    = dk===tk;
          const isSelected = dk===selectedDate;
          const dayNotes   = notes[dk]||[];
          const count      = dayNotes.length;
          const firstTime  = dayNotes.filter(n=>n.time).sort((a,b)=>a.time.localeCompare(b.time))[0]?.time;
          return (
            <div key={dk} onClick={()=>onSelectDate(dk)}
              style={{ position:"relative", aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:10, cursor:"pointer", background:isSelected?color.bg:isToday?color.light:"transparent", border:isSelected||isToday?`2px solid ${color.bg}`:"2px solid transparent", transition:"all 0.12s" }}
              onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=color.light; }}
              onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background=isToday?color.light:"transparent"; }}>
              <span style={{ fontSize:13, fontWeight:isToday||isSelected?700:400, color:isSelected?"#fff":isToday?color.text:"#333", lineHeight:1 }}>{day}</span>
              {firstTime && <span style={{ fontSize:8, color:isSelected?"rgba(255,255,255,0.85)":color.text, fontFamily:"monospace", lineHeight:1.2 }}>{formatTime(firstTime)}</span>}
              {count>0 && (
                <div style={{ position:"absolute", bottom:3, display:"flex", gap:2 }}>
                  {count<=3 ? Array.from({length:count}).map((_,di)=><div key={di} style={{ width:4, height:4, borderRadius:"50%", background:isSelected?"rgba(255,255,255,0.8)":color.bg }} />) : <div style={{ fontSize:9, fontFamily:"monospace", color:isSelected?"rgba(255,255,255,0.9)":color.text, fontWeight:700 }}>{count}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding:"0 18px 14px", display:"flex", gap:14, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:10, height:10, borderRadius:"50%", background:color.bg }} /><span style={{ fontSize:11, color:"#aaa", fontFamily:"monospace" }}>has entries</span></div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:10, height:10, borderRadius:3, background:color.light, border:`1.5px solid ${color.bg}` }} /><span style={{ fontSize:11, color:"#aaa", fontFamily:"monospace" }}>today</span></div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight:"100vh", background:"#F7F5F0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid #E5E5E5", borderTopColor:"#4ECDC4", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color:"#aaa", fontSize:14, fontFamily:"monospace" }}>Loading your classes…</div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function ClassTracker() {
  const [data, setData]         = useState(DEFAULT_DATA);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeClass, setActiveClass] = useState(null);
  const [view, setView]         = useState("home");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [newNote, setNewNote]   = useState({ title:"", body:"", tag:"note", time:"" });
  const [newClass, setNewClass] = useState({ name:"", subject:"", teacher:"", time:"" });
  const [search, setSearch]     = useState("");
  const [editNote, setEditNote] = useState(null);
  const noteRef = useRef(null);

  useEffect(() => { loadData().then(d=>{ setData(d); setLoading(false); }); }, []);
  useEffect(() => {
    if (loading) return;
    setSaving(true);
    const t = setTimeout(() => { saveData(data).then(()=>setSaving(false)); }, 800);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => { if ((view==="addNote"||view==="editNote") && noteRef.current) noteRef.current.focus(); }, [view]);

  if (loading) return <Spinner />;

  const SaveBadge = () => saving ? <div style={{ position:"fixed", top:12, right:16, background:"#1A1A1A", color:"#fff", borderRadius:20, padding:"4px 14px", fontSize:12, fontFamily:"monospace", zIndex:999, opacity:0.85 }}>☁ Saving…</div> : null;

  const addClassName   = (n) => setData(d=>({...d, classNames:[...(d.classNames||[]),n]}));
  const addSubjectName = (s) => setData(d=>({...d, subjects:[...(d.subjects||[]),s]}));

  const addClass = () => {
    if (!newClass.name.trim()) return;
    const id = Date.now().toString();
    setData(d=>({ ...d, classes:[...d.classes,{ id, name:newClass.name.trim(), subject:newClass.subject.trim(), teacher:newClass.teacher.trim(), time:newClass.time, colorIdx:d.classes.length%COLORS.length, created:Date.now() }], notes:{...d.notes,[id]:{}}}));
    setNewClass({ name:"", subject:"", teacher:"", time:"" });
  };

  const deleteClass = (id) => {
    setData(d=>({...d, classes:d.classes.filter(c=>c.id!==id), notes:Object.fromEntries(Object.entries(d.notes).filter(([k])=>k!==id))}));
    setView("home"); setActiveClass(null);
  };

  const getClassNotes = (cid) => data.notes[cid]||{};
  const getDateNotes  = (cid, dk) => (data.notes[cid]||{})[dk]||[];

  const addNote = () => {
    if (!newNote.title.trim() && !newNote.body.trim()) return;
    const note = { id:Date.now().toString(), ...newNote, created:Date.now() };
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d, notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:[note,...dn]}}}; });
    setNewNote({ title:"", body:"", tag:"note", time:"" }); setView("class");
  };

  const saveEdit = () => {
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d, notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.map(n=>n.id===editNote.id?{...n,...editNote}:n)}}}; });
    setEditNote(null); setView("class");
  };

  const deleteNote = (noteId) => {
    setData(d=>{ const cn=d.notes[activeClass.id]||{}; const dn=cn[selectedDate]||[]; return {...d, notes:{...d.notes,[activeClass.id]:{...cn,[selectedDate]:dn.filter(n=>n.id!==noteId)}}}; });
  };

  const totalNotes = data.classes.reduce((s,c)=>{ const cn=data.notes[c.id]||{}; return s+Object.values(cn).reduce((a,arr)=>a+arr.length,0); },0);

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (view==="home") return (
    <div style={{ minHeight:"100vh", background:"#F7F5F0", fontFamily:"Georgia,serif" }}>
      <SaveBadge />
      <div style={{ maxWidth:640, margin:"0 auto", padding:"32px 20px" }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, fontFamily:"monospace", letterSpacing:4, color:"#999", textTransform:"uppercase", marginBottom:6 }}>Academic Planner</div>
          <h1 style={{ margin:0, fontSize:38, fontWeight:400, color:"#1A1A1A", letterSpacing:-1 }}>My Classes</h1>
          <p style={{ margin:"8px 0 0", color:"#888", fontSize:14 }}>{data.classes.length} class{data.classes.length!==1?"es":""} · {totalNotes} entries</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {data.classes.length===0 && (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#bbb" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📚</div>
              <div style={{ fontSize:15 }}>No classes yet. Add your first one below.</div>
            </div>
          )}
          {data.classes.map(cls => {
            const color = COLORS[cls.colorIdx%COLORS.length];
            const cn    = data.notes[cls.id]||{};
            const count = Object.values(cn).reduce((a,arr)=>a+arr.length,0);
            return (
              <div key={cls.id} onClick={()=>{ setActiveClass(cls); setView("class"); setSelectedDate(todayKey()); setSearch(""); }}
                style={{ background:"#fff", borderRadius:16, padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", border:"1.5px solid #EFEFEF", transition:"box-shadow 0.15s,transform 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none"; }}>
                <div style={{ width:44, height:44, borderRadius:12, background:color.bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎓</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:16, color:"#1A1A1A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cls.name}</div>
                  <div style={{ display:"flex", gap:10, marginTop:3, flexWrap:"wrap" }}>
                    {cls.subject && <span style={{ fontSize:12, color:"#888" }}>{cls.subject}</span>}
                    {cls.teacher && <span style={{ fontSize:12, color:"#888" }}>👤 {cls.teacher}</span>}
                    {cls.time    && <span style={{ fontSize:12, color:"#888" }}>🕐 {formatTime(cls.time)}</span>}
                  </div>
                </div>
                <div style={{ background:color.light, color:color.text, borderRadius:20, padding:"4px 12px", fontSize:12, fontFamily:"monospace", fontWeight:600, flexShrink:0 }}>{count} {count===1?"entry":"entries"}</div>
                <div style={{ color:"#CCC", fontSize:18 }}>›</div>
              </div>
            );
          })}
        </div>

        {/* Add Class */}
        <div style={{ marginTop:24, background:"#fff", borderRadius:16, padding:20, border:"1.5px dashed #D0D0D0" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#555", marginBottom:16, fontFamily:"monospace", letterSpacing:1 }}>+ ADD CLASS</div>

          <label style={{ fontSize:11, color:"#aaa", fontFamily:"monospace", letterSpacing:1, display:"block", marginBottom:5 }}>CLASS NAME</label>
          <CreatableDropdown value={newClass.name} onChange={n=>setNewClass(c=>({...c,name:n}))} options={data.classNames||[]} onAddOption={addClassName} placeholder="e.g. Calculus II" addPlaceholder="Type class name…" />

          <label style={{ fontSize:11, color:"#aaa", fontFamily:"monospace", letterSpacing:1, display:"block", marginBottom:5, marginTop:4 }}>SUBJECT</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={data.subjects||[]} onAddOption={addSubjectName} placeholder="e.g. Mathematics" addPlaceholder="Type subject…" />

          <label style={{ fontSize:11, color:"#aaa", fontFamily:"monospace", letterSpacing:1, display:"block", marginBottom:5, marginTop:4 }}>TEACHER NAME</label>
          <input value={newClass.teacher} onChange={e=>setNewClass(c=>({...c,teacher:e.target.value}))} placeholder="e.g. Mr. Johnson" style={inp} />

          <label style={{ fontSize:11, color:"#aaa", fontFamily:"monospace", letterSpacing:1, display:"block", marginBottom:5, marginTop:4 }}>CLASS TIME</label>
          <input type="time" value={newClass.time} onChange={e=>setNewClass(c=>({...c,time:e.target.value}))} style={inp} />

          <button onClick={addClass} disabled={!newClass.name.trim()}
            style={{ marginTop:6, background:newClass.name.trim()?"#1A1A1A":"#D5D5D5", color:"#fff", border:"none", borderRadius:10, padding:"11px 24px", fontSize:14, cursor:newClass.name.trim()?"pointer":"not-allowed", fontFamily:"monospace", letterSpacing:1 }}>
            ADD CLASS
          </button>
        </div>
      </div>
    </div>
  );

  // ── CLASS VIEW ─────────────────────────────────────────────────────────────
  if (view==="class" && activeClass) {
    const color      = COLORS[activeClass.colorIdx%COLORS.length];
    const classNotes = getClassNotes(activeClass.id);
    const dateNotes  = getDateNotes(activeClass.id, selectedDate);
    const filtered   = dateNotes.filter(n=>!search||n.title.toLowerCase().includes(search.toLowerCase())||n.body.toLowerCase().includes(search.toLowerCase()));

    return (
      <div style={{ minHeight:"100vh", background:"#F7F5F0", fontFamily:"Georgia,serif" }}>
        <SaveBadge />
        <div style={{ background:color.bg, padding:"28px 20px 24px" }}>
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <button onClick={()=>setView("home")} style={{ background:"rgba(255,255,255,0.25)", border:"none", borderRadius:8, padding:"6px 14px", fontSize:13, cursor:"pointer", color:"#fff", fontFamily:"monospace", marginBottom:16 }}>← Back</button>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <h2 style={{ margin:0, fontSize:30, fontWeight:700, color:"#fff", letterSpacing:-0.5 }}>{activeClass.name}</h2>
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginTop:5 }}>
                  {activeClass.subject && <span style={{ color:"rgba(255,255,255,0.85)", fontSize:13 }}>{activeClass.subject}</span>}
                  {activeClass.teacher && <span style={{ color:"rgba(255,255,255,0.85)", fontSize:13 }}>👤 {activeClass.teacher}</span>}
                  {activeClass.time    && <span style={{ color:"rgba(255,255,255,0.85)", fontSize:13 }}>🕐 {formatTime(activeClass.time)}</span>}
                </div>
              </div>
              <button onClick={()=>deleteClass(activeClass.id)} style={{ background:"rgba(0,0,0,0.15)", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, cursor:"pointer", color:"#fff", fontFamily:"monospace" }}>🗑 Delete</button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px" }}>
          <Calendar color={color} notes={classNotes} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div style={{ marginTop:28 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:600, color:"#1A1A1A" }}>{formatDateLabel(selectedDate)}</div>
                <div style={{ fontSize:12, color:"#aaa", fontFamily:"monospace", marginTop:2 }}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
              </div>
              <button onClick={()=>{ setNewNote({title:"",body:"",tag:"note",time:""}); setView("addNote"); }} style={{ background:color.bg, color:"#fff", border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"monospace", fontWeight:600 }}>+ Add Entry</button>
            </div>
            {dateNotes.length>2 && <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{ ...inp, marginBottom:14 }} />}
            {filtered.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:"#ccc", background:"#fff", borderRadius:16, border:"1.5px dashed #E5E5E5" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✏️</div>
                <div style={{ fontSize:14 }}>{search?"No matching entries.":'No entries for this date. Click "+ Add Entry" to start.'}</div>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {filtered.map(note => {
                const tag = TAG_STYLES[note.tag]||TAG_STYLES.note;
                return (
                  <div key={note.id} style={{ background:"#fff", borderRadius:14, padding:"16px 18px", border:"1.5px solid #EFEFEF", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:note.body?10:0 }}>
                      <div style={{ flex:1 }}>
                        <span style={{ background:tag.bg, color:tag.text, fontSize:11, borderRadius:20, padding:"2px 10px", fontFamily:"monospace", marginRight:8 }}>{tag.label}</span>
                        {note.time && <span style={{ fontSize:11, color:"#888", fontFamily:"monospace", marginRight:8 }}>🕐 {formatTime(note.time)}</span>}
                        {note.title && <span style={{ fontWeight:600, fontSize:15, color:"#1A1A1A" }}>{note.title}</span>}
                      </div>
                      <div style={{ display:"flex", gap:6, marginLeft:8 }}>
                        <button onClick={()=>{ setEditNote({...note}); setView("editNote"); }} style={{ background:"#F5F5F5", border:"none", borderRadius:7, padding:"4px 10px", fontSize:12, cursor:"pointer", color:"#555" }}>Edit</button>
                        <button onClick={()=>deleteNote(note.id)} style={{ background:"#FEE2E2", border:"none", borderRadius:7, padding:"4px 10px", fontSize:12, cursor:"pointer", color:"#991B1B" }}>✕</button>
                      </div>
                    </div>
                    {note.body && <p style={{ margin:0, fontSize:14, color:"#555", lineHeight:1.65, whiteSpace:"pre-wrap" }}>{note.body}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ADD / EDIT NOTE ────────────────────────────────────────────────────────
  if (view==="addNote"||view==="editNote") {
    const isEdit  = view==="editNote";
    const form    = isEdit ? editNote : newNote;
    const setForm = isEdit ? setEditNote : setNewNote;
    const save    = isEdit ? saveEdit : addNote;
    const color   = activeClass ? COLORS[activeClass.colorIdx%COLORS.length] : COLORS[0];

    return (
      <div style={{ minHeight:"100vh", background:"#F7F5F0", fontFamily:"Georgia,serif" }}>
        <div style={{ background:color.bg, padding:"20px 20px 18px" }}>
          <div style={{ maxWidth:640, margin:"0 auto" }}>
            <button onClick={()=>setView("class")} style={{ background:"rgba(255,255,255,0.25)", border:"none", borderRadius:8, padding:"6px 14px", fontSize:13, cursor:"pointer", color:"#fff", fontFamily:"monospace" }}>← Back</button>
          </div>
        </div>
        <div style={{ maxWidth:640, margin:"0 auto", padding:"28px 20px" }}>
          <div style={{ fontSize:12, color:"#aaa", fontFamily:"monospace", marginBottom:4 }}>{isEdit?"EDITING ENTRY":"NEW ENTRY FOR"}</div>
          <h2 style={{ margin:"0 0 22px", fontSize:22, fontWeight:600, color:"#1A1A1A" }}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>

          <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
            {Object.entries(TAG_STYLES).map(([key,val]) => (
              <button key={key} onClick={()=>setForm({...form,tag:key})}
                style={{ background:form.tag===key?val.bg:"#fff", color:form.tag===key?val.text:"#999", border:`1.5px solid ${form.tag===key?val.bg:"#E5E5E5"}`, borderRadius:20, padding:"6px 15px", fontSize:12, cursor:"pointer", fontFamily:"monospace" }}>
                {val.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize:11, color:"#aaa", fontFamily:"monospace", letterSpacing:1, display:"block", marginBottom:5 }}>TIME OF CLASS (optional)</label>
          <input type="time" value={form.time||""} onChange={e=>setForm({...form,time:e.target.value})} style={inp} />

          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title" style={{ ...inp, fontSize:17, fontWeight:600 }} />
          <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={8} style={{ ...inp, resize:"vertical", lineHeight:1.7, marginBottom:0 }} />

          <button onClick={save} style={{ marginTop:16, background:color.bg, color:"#fff", border:"none", borderRadius:10, padding:"12px 28px", fontSize:14, cursor:"pointer", fontFamily:"monospace", letterSpacing:1 }}>
            {isEdit?"SAVE CHANGES":"SAVE ENTRY"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
