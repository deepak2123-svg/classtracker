import { useState, useEffect } from "react";
import { getInstitution, getInstitutionMembers, loadUserData, createInvite, logout } from "./firebase";
import { COLORS, TAG_STYLES, DAYS, MONTHS, inp, Spinner, Avatar, toDateKey, todayKey, formatDateLabel, fmt, formatPeriod } from "./shared";

// ── Mini calendar for admin view ──────────────────────────────────────────────
function MiniCalendar({ color, notes, selectedDate, onSelectDate }) {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));
  while(cells.length%7!==0) cells.push(null);
  const tk = todayKey();
  const prev=()=>{ if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const next=()=>{ if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };

  return (
    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"1.5px solid #F0F0F0",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
      <div style={{background:color.bg,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={prev} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:7,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{color:"#fff",fontSize:13,fontWeight:700}}>{MONTHS[calMonth]}</div>
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
          const count=(notes[dk]||[]).length;
          return (
            <div key={dk} onClick={()=>onSelectDate(dk)}
              style={{position:"relative",aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:7,cursor:"pointer",
                background:isSel?color.bg:isToday?color.light:"transparent",
                border:isSel||isToday?`2px solid ${color.bg}`:"2px solid transparent"}}>
              <span style={{fontSize:11,fontWeight:isToday||isSel?700:400,color:isSel?"#fff":isToday?color.text:"#333",lineHeight:1}}>{day}</span>
              {count>0&&<div style={{position:"absolute",bottom:2,width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":color.bg}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard({ user, profile }) {
  const [institution, setInstitution] = useState(null);
  const [members, setMembers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState("home"); // home | teacher
  const [activeTeacher, setActiveTeacher] = useState(null);
  const [teacherData, setTeacherData] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [inviteLink, setInviteLink]   = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    if (!profile?.institutionId) { setLoading(false); return; }
    Promise.all([
      getInstitution(profile.institutionId),
      getInstitutionMembers(profile.institutionId),
    ]).then(([inst, mems]) => {
      setInstitution(inst);
      setMembers(mems.filter(m => m.role === "teacher"));
      setLoading(false);
    });
  }, [profile]);

  const openTeacher = async (teacher) => {
    setActiveTeacher(teacher);
    setTeacherLoading(true);
    setView("teacher");
    setSelectedDate(todayKey());
    const data = await loadUserData(teacher.uid);
    setTeacherData(data);
    setTeacherLoading(false);
  };

  const generateInvite = async () => {
    setInviteLoading(true);
    const token = await createInvite(profile.institutionId, institution?.name||"", profile.name||user.displayName||"");
    const link  = `${window.location.origin}?token=${token}`;
    setInviteLink(link);
    setInviteLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  };

  if (loading) return <Spinner text="Loading dashboard…"/>;

  const COLOR = { bg:"#4ECDC4", light:"#E0F7F6", text:"#00574B" };

  // ── TEACHER DETAIL VIEW ──────────────────────────────────────────────────
  if (view==="teacher" && activeTeacher) {
    const classes = teacherData?.classes || [];
    const allNotes = teacherData?.notes || {};

    return (
      <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
        <div style={{background:COLOR.bg,padding:"18px 20px 16px"}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <button onClick={()=>setView("home")} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",color:"#fff",fontFamily:"monospace",marginBottom:10}}>← Back</button>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:700}}>
                {(activeTeacher.name||"?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{activeTeacher.name}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.8)"}}>{activeTeacher.email} · {classes.length} class{classes.length!==1?"es":""}</div>
              </div>
              <div style={{marginLeft:"auto",background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 10px"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontFamily:"monospace",textAlign:"center"}}>READ ONLY</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{maxWidth:700,margin:"0 auto",padding:"20px"}}>
          {teacherLoading ? (
            <div style={{textAlign:"center",padding:40,color:"#aaa",fontSize:14}}>Loading teacher's data…</div>
          ) : classes.length===0 ? (
            <div style={{textAlign:"center",padding:40,color:"#bbb",background:"#fff",borderRadius:14,border:"1.5px dashed #E5E5E5"}}>
              <div style={{fontSize:32,marginBottom:8}}>📚</div>
              <div style={{fontSize:14}}>This teacher hasn't added any classes yet.</div>
            </div>
          ) : (
            <>
              {/* Date selector */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:600,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>SELECT DATE</div>
                <MiniCalendar
                  color={COLOR}
                  notes={classes.reduce((acc,cls)=>{
                    const cn=allNotes[cls.id]||{};
                    Object.entries(cn).forEach(([dk,entries])=>{ if(entries.length>0) acc[dk]=(acc[dk]||[]); acc[dk].push(...entries); });
                    return acc;
                  },{})}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>

              {/* Classes on selected date */}
              <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:12}}>{formatDateLabel(selectedDate)}</div>
              {classes.map(cls=>{
                const color=COLORS[cls.colorIdx%COLORS.length];
                const notes=(allNotes[cls.id]||{})[selectedDate]||[];
                return(
                  <div key={cls.id} style={{background:"#fff",borderRadius:14,marginBottom:12,border:"1.5px solid #EFEFEF",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                    {/* Class header */}
                    <div style={{background:color.bg,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>🎓</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{cls.name}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:2}}>
                          {cls.batch     && <span style={{fontSize:11,color:"rgba(255,255,255,0.85)"}}>📋 {cls.batch}</span>}
                          {cls.teacher   && <span style={{fontSize:11,color:"rgba(255,255,255,0.85)"}}>👤 {cls.teacher}</span>}
                          {cls.institute && <span style={{fontSize:11,color:"rgba(255,255,255,0.85)"}}>🏫 {cls.institute}</span>}
                          {cls.timeStart && <span style={{fontSize:11,color:"rgba(255,255,255,0.85)"}}>🕐 {formatPeriod(cls.timeStart,cls.timeEnd)}</span>}
                        </div>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.25)",borderRadius:20,padding:"2px 10px",fontSize:11,color:"#fff",fontFamily:"monospace",flexShrink:0}}>
                        {notes.length} entr{notes.length===1?"y":"ies"}
                      </div>
                    </div>
                    {/* Entries */}
                    {notes.length===0 ? (
                      <div style={{padding:"14px 16px",fontSize:13,color:"#ccc",textAlign:"center"}}>No entries for this date</div>
                    ) : (
                      <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                        {notes.map(note=>{
                          const tag=TAG_STYLES[note.tag]||TAG_STYLES.note;
                          return(
                            <div key={note.id} style={{borderLeft:`3px solid ${color.bg}`,paddingLeft:12}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:note.body?4:0}}>
                                <span style={{background:tag.bg,color:tag.text,fontSize:10,borderRadius:20,padding:"2px 8px",fontFamily:"monospace"}}>{tag.label}</span>
                                {note.timeStart&&<span style={{fontSize:10,color:"#888",fontFamily:"monospace"}}>🕐 {formatPeriod(note.timeStart,note.timeEnd)}</span>}
                                {note.title&&<span style={{fontWeight:600,fontSize:13,color:"#1A1A1A"}}>{note.title}</span>}
                              </div>
                              {note.body&&<p style={{margin:0,fontSize:12,color:"#666",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{note.body}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── HOME ─────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
      <div style={{background:COLOR.bg,padding:"20px 20px 18px"}}>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:4,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",marginBottom:4}}>Administrator</div>
            <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#fff"}}>{institution?.name||"Your Institution"}</h1>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginTop:3}}>{members.length} teacher{members.length!==1?"s":""} enrolled</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Avatar user={user}/>
            <button onClick={logout} style={{background:"none",border:"none",fontSize:11,color:"rgba(255,255,255,0.7)",cursor:"pointer",fontFamily:"monospace"}}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"22px 20px"}}>

        {/* Invite section */}
        <div style={{background:"#fff",borderRadius:14,padding:"16px 18px",marginBottom:18,border:"1.5px solid #EFEFEF"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1A1A1A",marginBottom:4}}>Invite a Teacher</div>
          <div style={{fontSize:12,color:"#888",marginBottom:12}}>Generate a link and share it via WhatsApp, email, or any messenger. Link expires in 48 hours.</div>
          <button onClick={generateInvite} disabled={inviteLoading}
            style={{background:COLOR.bg,color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:"monospace",letterSpacing:0.5,marginBottom:inviteLink?12:0}}>
            {inviteLoading?"Generating…":"Generate Invite Link"}
          </button>
          {inviteLink&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1,background:"#F5F5F5",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#555",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {inviteLink}
              </div>
              <button onClick={copyLink}
                style={{background:copied?"#6BCB77":COLOR.bg,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:"monospace",flexShrink:0,transition:"background 0.2s"}}>
                {copied?"Copied!":"Copy"}
              </button>
            </div>
          )}
        </div>

        {/* Teachers */}
        <div style={{fontSize:12,fontWeight:600,color:"#999",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>TEACHERS</div>
        {members.length===0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#bbb",background:"#fff",borderRadius:14,border:"1.5px dashed #E5E5E5"}}>
            <div style={{fontSize:32,marginBottom:8}}>👩‍🏫</div>
            <div style={{fontSize:14}}>No teachers yet. Share an invite link to get started.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {members.map((teacher,i)=>(
              <div key={teacher.uid}
                onClick={()=>openTeacher(teacher)}
                style={{background:"#fff",borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,border:"1.5px solid #EFEFEF",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.09)";e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.transform="none";}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:["#FF6B6B","#4ECDC4","#FFD93D","#6BCB77","#845EC2","#FF9671"][i%6],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700,flexShrink:0}}>
                  {(teacher.name||"?")[0].toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:15,color:"#1A1A1A"}}>{teacher.name}</div>
                  <div style={{fontSize:12,color:"#888",marginTop:1}}>{teacher.email}</div>
                </div>
                <div style={{color:"#ccc",fontSize:18}}>›</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
