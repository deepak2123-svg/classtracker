import { useState, useEffect, useRef } from "react";
import { loadUserData, saveUserData, logout } from "./firebase";
import { COLORS, TAG_STYLES, DAYS, MONTHS, inp, Spinner, Avatar, toDateKey, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared.jsx";

const DEFAULT_DATA = { classes:[], notes:{}, subjects:[] };

// ── Creatable Dropdown ────────────────────────────────────────────────────────
function CreatableDropdown({ value, onChange, options, onAddOption, placeholder, addPlaceholder }) {
  const [open,setOpen]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newVal,setNewVal]=useState("");
  const inputRef=useRef(null);
  const wrapRef=useRef(null);
  useEffect(()=>{ if(adding&&inputRef.current) inputRef.current.focus(); },[adding]);
  useEffect(()=>{
    const h=(e)=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setAdding(false);setNewVal("");} };
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
        style={{...inp,marginBottom:0,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",color:value?"#1A1A1A":"#aaa"}}>
        <span>{value||placeholder}</span><span style={{color:"#bbb",fontSize:11}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",borderRadius:12,border:"1.5px solid #E0E0E0",boxShadow:"0 8px 28px rgba(0,0,0,0.12)",zIndex:200,overflow:"hidden"}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {options.length===0&&<div style={{padding:"12px 14px",color:"#ccc",fontSize:13}}>No saved options — add one below</div>}
            {options.map(opt=>{
              const sel=opt===value;
              return(<div key={opt} onClick={()=>{onChange(opt);setOpen(false);}}
                style={{padding:"10px 16px",cursor:"pointer",fontSize:14,color:sel?"#6D28D9":"#1A1A1A",fontWeight:sel?600:400,background:sel?"#F3EEFF":"transparent",display:"flex",alignItems:"center",gap:10}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F9F9F9";}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                <span style={{width:16,color:"#6D28D9",fontSize:13}}>{sel?"✓":""}</span>{opt}
              </div>);
            })}
          </div>
          <div style={{borderTop:"1px solid #F0F0F0"}}>
            {!adding
              ?<div onClick={()=>setAdding(true)} style={{padding:"11px 16px",cursor:"pointer",fontSize:13,color:"#7C3AED",fontFamily:"monospace",display:"flex",alignItems:"center",gap:7}} onMouseEnter={e=>e.currentTarget.style.background="#F5F0FF"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>＋ Add new option</div>
              :<div style={{padding:"8px 10px",display:"flex",gap:6,alignItems:"center"}}>
                <input ref={inputRef} value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape"){setAdding(false);setNewVal("");}}} placeholder={addPlaceholder} style={{flex:1,padding:"8px 11px",borderRadius:8,border:"1.5px solid #C4B5FD",fontSize:13,fontFamily:"Georgia,serif",outline:"none"}}/>
                <button onClick={confirmAdd} style={{background:"#7C3AED",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Add</button>
                <button onClick={()=>{setAdding(false);setNewVal("");}} style={{background:"#F5F5F5",color:"#888",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,cursor:"pointer"}}>✕</button>
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
    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1.5px solid #F0F0F0"}}>
      <div style={{background:color.bg,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={prev} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:7,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{color:"#fff",fontSize:14,fontWeight:700}}>{MONTHS[calMonth]}</div>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:10,fontFamily:"monospace"}}>{calYear}</div>
        </div>
        <button onClick={next} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:7,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"6px 6px 2px"}}>
        {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#bbb",fontFamily:"monospace",padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 6px 6px",gap:2}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const dk=toDateKey(calYear,calMonth,day);
          const isToday=dk===tk, isSel=dk===selectedDate;
          const dayNotes=notes[dk]||[];
          const count=dayNotes.length;
          const firstTime=dayNotes.filter(n=>n.timeStart).sort((a,b)=>a.timeStart.localeCompare(b.timeStart))[0]?.timeStart;
          return (
            <div key={dk} onClick={()=>onSelectDate(dk)}
              style={{position:"relative",aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:7,cursor:"pointer",
                background:isSel?color.bg:isToday?color.light:"transparent",
                border:isSel||isToday?`2px solid ${color.bg}`:"2px solid transparent",transition:"all 0.12s"}}
              onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=color.light;}}
              onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isToday?color.light:"transparent";}}>
              <span style={{fontSize:11,fontWeight:isToday||isSel?700:400,color:isSel?"#fff":isToday?color.text:"#333",lineHeight:1}}>{day}</span>
              {firstTime&&<span style={{fontSize:7,color:isSel?"rgba(255,255,255,0.85)":color.text,fontFamily:"monospace",lineHeight:1.2}}>{fmt(firstTime)}</span>}
              {count>0&&(
                <div style={{position:"absolute",bottom:2,display:"flex",gap:1.5}}>
                  {count<=3?Array.from({length:count}).map((_,di)=><div key={di} style={{width:3,height:3,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":color.bg}}/>)
                    :<div style={{fontSize:7,fontFamily:"monospace",color:isSel?"rgba(255,255,255,0.9)":color.text,fontWeight:700}}>{count}</div>}
                </div>
              )}
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

  if(loading) return <Spinner text="Loading your classes…"/>;

  const SaveBadge=()=>saving||saveErr?(
    <div style={{position:"fixed",top:12,right:16,borderRadius:20,padding:"4px 14px",fontSize:12,fontFamily:"monospace",zIndex:999,
      background:saveErr?"#FEE2E2":"#1A1A1A",color:saveErr?"#991B1B":"#fff"}}>
      {saveErr?"⚠ Save failed":"☁ Saving…"}
    </div>
  ):null;

  const addSubjectName=(s)=>setData(d=>({...d,subjects:[...(d.subjects||[]),s]}));

  const addClass=()=>{
    if(!newClass.institute.trim()||!newClass.section.trim()) return;
    const id=Date.now().toString();
    setData(d=>({...d,classes:[...d.classes,{id,
      institute:newClass.institute.trim(),
      section:newClass.section.trim(),
      subject:newClass.subject.trim(),
      teacher:newClass.teacher.trim(),
      colorIdx:d.classes.length%COLORS.length,
      created:Date.now()
    }],notes:{...d.notes,[id]:{}}}));
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
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
      <SaveBadge/>
      <div style={{maxWidth:640,margin:"0 auto",padding:"28px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div>
            <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:4,color:"#999",textTransform:"uppercase",marginBottom:5}}>Academic Planner</div>
            <h1 style={{margin:0,fontSize:32,fontWeight:400,color:"#1A1A1A",letterSpacing:-1}}>My Classes</h1>
            <p style={{margin:"5px 0 0",color:"#888",fontSize:13}}>{data.classes.length} class{data.classes.length!==1?"es":""} · {totalNotes} entries</p>
          </div>
          <div style={{textAlign:"right"}}>
            <Avatar user={user} size={36}/>
            <button onClick={logout} style={{display:"block",background:"none",border:"none",fontSize:11,color:"#bbb",cursor:"pointer",fontFamily:"monospace",marginTop:4,marginLeft:"auto"}}>Sign out</button>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {data.classes.length===0&&(
            <div style={{textAlign:"center",padding:"50px 20px",color:"#bbb"}}>
              <div style={{fontSize:44,marginBottom:10}}>📚</div>
              <div style={{fontSize:15}}>No classes yet. Add your first one below.</div>
            </div>
          )}
          {data.classes.map(cls=>{
            const color=COLORS[cls.colorIdx%COLORS.length];
            const cn=data.notes[cls.id]||{};
            const count=Object.values(cn).reduce((a,arr)=>a+arr.length,0);
            return(
              <div key={cls.id} onClick={()=>{setActiveClass(cls);setView("class");setSelectedDate(todayKey());setSearch("");}}
                style={{background:"#fff",borderRadius:14,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",border:"1.5px solid #EFEFEF",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.10)";e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)";e.currentTarget.style.transform="none";}}>
                <div style={{width:42,height:42,borderRadius:11,background:color.bg,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎓</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:15,color:"#1A1A1A"}}>{cls.section}</div>
                  <div style={{display:"flex",gap:8,marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"#888"}}>🏫 {cls.institute}</span>
                    {cls.subject&&<span style={{fontSize:11,color:"#888"}}>{cls.subject}</span>}
                    {cls.teacher&&<span style={{fontSize:11,color:"#888"}}>👤 {cls.teacher}</span>}
                  </div>
                </div>
                <div style={{background:color.light,color:color.text,borderRadius:20,padding:"3px 10px",fontSize:11,fontFamily:"monospace",fontWeight:600,flexShrink:0}}>{count} {count===1?"entry":"entries"}</div>
                <div style={{color:"#CCC",fontSize:18}}>›</div>
              </div>
            );
          })}
        </div>

        {/* Add Class */}
        <div style={{marginTop:18,background:"#fff",borderRadius:14,padding:"16px 18px",border:"1.5px dashed #D0D0D0"}}>
          <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:16,fontFamily:"monospace",letterSpacing:1}}>+ ADD CLASS</div>

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>INSTITUTE</label>
          <input value={newClass.institute} onChange={e=>setNewClass(c=>({...c,institute:e.target.value}))} placeholder="e.g. Genesis Karnal, KIS, GIS" style={inp}/>

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>CLASS / SECTION</label>
          <input value={newClass.section} onChange={e=>setNewClass(c=>({...c,section:e.target.value}))} placeholder="e.g. 9th A, 10th B, Section C" style={inp}/>

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>SUBJECT</label>
          <CreatableDropdown value={newClass.subject} onChange={s=>setNewClass(c=>({...c,subject:s}))} options={data.subjects||[]} onAddOption={addSubjectName} placeholder="e.g. Mathematics, Geography" addPlaceholder="Type subject…"/>

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4,marginTop:2}}>TEACHER NAME</label>
          <input value={newClass.teacher} onChange={e=>setNewClass(c=>({...c,teacher:e.target.value}))} placeholder="e.g. Mr. Johnson" style={inp}/>

          <button onClick={addClass} disabled={!newClass.institute.trim()||!newClass.section.trim()}
            style={{marginTop:4,background:(newClass.institute.trim()&&newClass.section.trim())?"#1A1A1A":"#D5D5D5",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,cursor:(newClass.institute.trim()&&newClass.section.trim())?"pointer":"not-allowed",fontFamily:"monospace",letterSpacing:1}}>
            ADD CLASS
          </button>
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
    const allDates=Object.keys(classNotes).filter(dk=>classNotes[dk]&&classNotes[dk].length>0).sort((a,b)=>b.localeCompare(a));

    return(
      <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
        <SaveBadge/>
        <div style={{background:color.bg,padding:"16px 20px 14px"}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",gap:16}}>
            <button onClick={()=>setView("home")} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",color:"#fff",fontFamily:"monospace",flexShrink:0}}>← Back</button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:18,color:"#fff"}}>{activeClass.section} <span style={{fontWeight:400,opacity:0.8}}>· {activeClass.institute}</span></div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:2}}>
                {activeClass.subject&&<span style={{color:"rgba(255,255,255,0.85)",fontSize:12}}>{activeClass.subject}</span>}
                {activeClass.teacher&&<span style={{color:"rgba(255,255,255,0.85)",fontSize:12}}>👤 {activeClass.teacher}</span>}
              </div>
            </div>
            <button onClick={()=>deleteClass(activeClass.id)} style={{background:"rgba(0,0,0,0.15)",border:"none",borderRadius:8,padding:"5px 11px",fontSize:11,cursor:"pointer",color:"#fff",fontFamily:"monospace",flexShrink:0}}>🗑</button>
          </div>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:"16px 20px",display:"flex",gap:16,alignItems:"flex-start"}}>

          {/* LEFT — Class Switcher */}
          <div style={{width:170,flexShrink:0}}>
            <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:1,color:"#aaa",marginBottom:8}}>MY CLASSES</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {data.classes.map(cls=>{
                const c=COLORS[cls.colorIdx%COLORS.length];
                const isActive=cls.id===activeClass.id;
                return(
                  <div key={cls.id} onClick={()=>{setActiveClass(cls);setSelectedDate(todayKey());setSearch("");}}
                    style={{padding:"8px 11px",borderRadius:10,cursor:"pointer",
                      border:isActive?`2px solid ${c.bg}`:"1.5px solid #EFEFEF",
                      background:isActive?c.light:"#fff",transition:"all 0.12s"}}>
                    <div style={{fontSize:12,fontWeight:isActive?600:400,color:isActive?c.text:"#333",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.section}</div>
                    <div style={{fontSize:10,color:"#aaa",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cls.institute}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MIDDLE — Calendar + Entries */}
          <div style={{flex:1,minWidth:0}}>
            <Calendar color={color} notes={classNotes} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>
            <div style={{marginTop:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{formatDateLabel(selectedDate)}</div>
                  <div style={{fontSize:11,color:"#aaa",fontFamily:"monospace",marginTop:1}}>{dateNotes.length} {dateNotes.length===1?"entry":"entries"}</div>
                </div>
                <button onClick={()=>{setNewNote({title:"",body:"",tag:"note",timeStart:"",timeEnd:""});setView("addNote");}}
                  style={{background:color.bg,color:"#fff",border:"none",borderRadius:9,padding:"8px 15px",fontSize:12,cursor:"pointer",fontFamily:"monospace",fontWeight:600}}>+ Add Entry</button>
              </div>
              {dateNotes.length>2&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{...inp,marginBottom:10}}/>}
              {filtered.length===0&&(
                <div style={{textAlign:"center",padding:"28px 20px",color:"#ccc",background:"#fff",borderRadius:12,border:"1.5px dashed #E5E5E5"}}>
                  <div style={{fontSize:24,marginBottom:6}}>✏️</div>
                  <div style={{fontSize:13}}>{search?"No matching entries.":'Tap "+ Add Entry" to start.'}</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {filtered.map(note=>{
                  const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                  return(
                    <div key={note.id} style={{background:"#fff",borderRadius:12,padding:"13px 15px",border:"1.5px solid #EFEFEF",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:note.body?6:0}}>
                        <div style={{flex:1,display:"flex",flexWrap:"wrap",alignItems:"center",gap:5}}>
                          <span style={{background:tag.bg,color:tag.text,fontSize:10,borderRadius:20,padding:"2px 8px",fontFamily:"monospace"}}>{tag.label}</span>
                          {note.timeStart&&<span style={{fontSize:10,color:"#888",fontFamily:"monospace"}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                          {note.title&&<span style={{fontWeight:600,fontSize:14,color:"#1A1A1A"}}>{note.title}</span>}
                        </div>
                        <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
                          <button onClick={()=>{setEditNote({...note});setView("editNote");}} style={{background:"#F5F5F5",border:"none",borderRadius:7,padding:"3px 9px",fontSize:11,cursor:"pointer",color:"#555"}}>Edit</button>
                          <button onClick={()=>deleteNote(note.id)} style={{background:"#FEE2E2",border:"none",borderRadius:7,padding:"3px 9px",fontSize:11,cursor:"pointer",color:"#991B1B"}}>✕</button>
                        </div>
                      </div>
                      {note.body&&<p style={{margin:0,fontSize:13,color:"#555",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — Day-wise Timeline */}
          <div style={{width:190,flexShrink:0}}>
            <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:1,color:"#aaa",marginBottom:8}}>PAST ENTRIES</div>
            {allDates.length===0?(
              <div style={{fontSize:12,color:"#ccc",padding:"8px 0"}}>No entries yet.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column"}}>
                {allDates.map((dk,i)=>{
                  const entries=classNotes[dk]||[];
                  const isSel=dk===selectedDate;
                  return(
                    <div key={dk} onClick={()=>setSelectedDate(dk)} style={{cursor:"pointer",display:"flex",gap:10,paddingBottom:14,position:"relative"}}>
                      {i<allDates.length-1&&<div style={{position:"absolute",left:6,top:14,bottom:0,width:1,background:"#E8E8E8"}}/>}
                      <div style={{width:13,height:13,borderRadius:"50%",background:isSel?color.bg:"#D8D8D8",border:`2px solid ${isSel?color.bg:"#C8C8C8"}`,flexShrink:0,marginTop:2,zIndex:1,transition:"all 0.12s"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:isSel?600:400,color:isSel?color.text:"#666",fontFamily:"monospace"}}>{formatDateLabel(dk)}</div>
                        <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:2}}>
                          {entries.slice(0,2).map(n=>{
                            const tag=TAG_STYLES[n.tag]||TAG_STYLES.note;
                            return(
                              <div key={n.id} style={{fontSize:10,color:"#888",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                <span style={{background:tag.bg,color:tag.text,borderRadius:10,padding:"1px 5px",fontSize:9,fontFamily:"monospace",marginRight:3}}>{tag.label}</span>
                                {n.title||n.body||"—"}
                              </div>
                            );
                          })}
                          {entries.length>2&&<div style={{fontSize:10,color:"#bbb",fontFamily:"monospace"}}>+{entries.length-2} more</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
    const color=activeClass?COLORS[activeClass.colorIdx%COLORS.length]:COLORS[0];
    return(
      <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
        <div style={{background:color.bg,padding:"16px 20px 14px"}}>
          <div style={{maxWidth:640,margin:"0 auto"}}>
            <button onClick={()=>setView("class")} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",color:"#fff",fontFamily:"monospace"}}>← Back</button>
          </div>
        </div>
        <div style={{maxWidth:640,margin:"0 auto",padding:"22px 20px"}}>
          <div style={{fontSize:10,color:"#aaa",fontFamily:"monospace",marginBottom:3}}>{isEdit?"EDITING ENTRY":"NEW ENTRY FOR"}</div>
          <h2 style={{margin:"0 0 16px",fontSize:19,fontWeight:600,color:"#1A1A1A"}}>{isEdit?form.title||"Entry":formatDateLabel(selectedDate)}</h2>
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {Object.entries(TAG_STYLES).map(([key,val])=>(
              <button key={key} onClick={()=>setForm({...form,tag:key})}
                style={{background:form.tag===key?val.bg:"#fff",color:form.tag===key?val.text:"#999",border:`1.5px solid ${form.tag===key?val.bg:"#E5E5E5"}`,borderRadius:20,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>
                {val.label}
              </button>
            ))}
          </div>
          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>CLASS TIME (optional)</label>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <input type="time" value={form.timeStart||""} onChange={e=>setForm({...form,timeStart:e.target.value})} style={{...inp,marginBottom:0,flex:1}}/>
            <span style={{color:"#aaa",fontSize:13,flexShrink:0}}>to</span>
            <input type="time" value={form.timeEnd||""} onChange={e=>setForm({...form,timeEnd:e.target.value})} style={{...inp,marginBottom:0,flex:1}}/>
          </div>
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title" style={{...inp,fontSize:15,fontWeight:600}}/>
          <textarea ref={noteRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your notes, tasks, or resources here…" rows={7} style={{...inp,resize:"vertical",lineHeight:1.7,marginBottom:0}}/>
          <button onClick={save} style={{marginTop:12,background:color.bg,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,cursor:"pointer",fontFamily:"monospace",letterSpacing:1}}>
            {isEdit?"SAVE CHANGES":"SAVE ENTRY"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
