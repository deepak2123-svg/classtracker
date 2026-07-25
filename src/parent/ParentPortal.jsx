import { useEffect, useMemo, useState } from "react";
import {
  IconBook2,
  IconChevronDown,
  IconEdit,
  IconLogout,
  IconSchool,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  logout,
  redeemParentSectionInvite,
  subscribeParentPortalSection,
  subscribeParentSectionAccess,
  subscribeParentSectionFeed,
  updateOwnParentSectionMember,
} from "../firebase";
import { captureParentInvite, clearParentInvite } from "./parentInvite.js";

const C = {
  ink:"#102A23", muted:"#637B73", faint:"#95A69F", green:"#147A54",
  greenDark:"#0D5C40", mint:"#EAF7F1", border:"#DDE9E3", surface:"#FFFFFF",
  bg:"#F3F8F5", blue:"#2457C5", danger:"#B42318", amber:"#B54708",
};

function cleanError(error, fallback) {
  const message = String(error?.message || fallback || "Something went wrong.");
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[^)]+\)\.?$/i, "");
}

function indiaTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatDate(dateKey) {
  if (dateKey === indiaTodayKey()) return "Today";
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return "Recent";
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long",
  });
}

function initials(value) {
  return String(value || "Parent").trim().split(/\s+/).slice(0, 2).map(part=>part[0]||"").join("").toUpperCase() || "P";
}

function InviteCard({ user, token, onDone, onCancel }) {
  const [parentName, setParentName] = useState(user?.displayName || "");
  const [studentName, setStudentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!parentName.trim() || !studentName.trim()) {
      setError("Enter both the parent and student names.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await redeemParentSectionInvite({
        token,
        parentName:parentName.trim(),
        studentName:studentName.trim(),
      });
      clearParentInvite();
      onDone(result);
    } catch (cause) {
      setError(cleanError(cause, "This invitation could not be used."));
    } finally {
      setBusy(false);
    }
  };

  const input = {width:"100%",height:50,boxSizing:"border-box",border:`1.5px solid ${C.border}`,borderRadius:14,padding:"0 14px",fontSize:16,color:C.ink,background:"#FBFDFC",outline:"none"};
  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(10,31,25,0.48)",backdropFilter:"blur(7px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}} onClick={event=>event.target===event.currentTarget&&onCancel?.()}>
      <section style={{width:"100%",maxWidth:520,background:"#FFF",borderRadius:"26px 26px 0 0",padding:"10px 18px calc(24px + env(safe-area-inset-bottom))",boxSizing:"border-box",boxShadow:"0 -20px 60px rgba(10,31,25,0.18)"}}>
        <div style={{width:42,height:5,borderRadius:999,background:"#D8E2DD",margin:"0 auto 18px"}}/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:900,color:C.green,textTransform:"uppercase",letterSpacing:0.8}}>Join class</div>
            <h2 style={{fontFamily:"Poppins, sans-serif",fontSize:25,lineHeight:1.15,margin:"6px 0 7px",color:C.ink}}>Connect your child</h2>
            <p style={{fontSize:13.5,lineHeight:1.5,color:C.muted,margin:0}}>These names are visible only to you and institute administrators.</p>
          </div>
          {onCancel&&<button aria-label="Close" type="button" onClick={onCancel} style={{width:38,height:38,borderRadius:12,border:`1px solid ${C.border}`,background:"#FFF",color:C.muted,display:"grid",placeItems:"center",cursor:"pointer"}}><IconX size={19}/></button>}
        </div>
        <div style={{display:"grid",gap:11,marginTop:20}}>
          <label style={{fontSize:12.5,fontWeight:800,color:C.muted}}>Parent name</label>
          <input value={parentName} onChange={event=>setParentName(event.target.value)} autoComplete="name" style={input}/>
          <label style={{fontSize:12.5,fontWeight:800,color:C.muted,marginTop:2}}>Student name</label>
          <input value={studentName} onChange={event=>setStudentName(event.target.value)} onKeyDown={event=>event.key==="Enter"&&submit()} autoFocus style={input}/>
        </div>
        {error&&<div role="alert" style={{background:"#FEF3F2",color:C.danger,borderRadius:12,padding:"10px 12px",fontSize:13.5,marginTop:12,lineHeight:1.45}}>{error}</div>}
        <button type="button" onClick={submit} disabled={busy} style={{width:"100%",height:51,border:"none",borderRadius:14,background:busy?"#91B3A4":C.greenDark,color:"#FFF",fontSize:15.5,fontWeight:850,marginTop:16,cursor:busy?"wait":"pointer"}}>
          {busy?"Connecting…":"Open class timeline"}
        </button>
      </section>
    </div>
  );
}

function EditNamesModal({ access, child, onClose }) {
  const [parentName, setParentName] = useState(access.parentName || "");
  const [studentName, setStudentName] = useState(child.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!parentName.trim() || !studentName.trim()) {
      setError("Names cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const children = (access.children || []).map(item =>
        item.id === child.id ? { ...item, name:studentName.trim() } : item
      );
      await updateOwnParentSectionMember({accessId:access.id,parentName:parentName.trim(),children});
      onClose();
    } catch (cause) {
      setError(cleanError(cause, "Could not save names."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:60,background:"rgba(10,31,25,0.42)",display:"grid",placeItems:"center",padding:18}} onClick={event=>event.target===event.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:390,background:"#FFF",borderRadius:22,padding:18,boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{fontFamily:"Poppins, sans-serif",fontSize:20,margin:0}}>Edit names</h2>
          <button aria-label="Close" onClick={onClose} style={{width:36,height:36,borderRadius:11,border:`1px solid ${C.border}`,background:"#FFF",display:"grid",placeItems:"center"}}><IconX size={18}/></button>
        </div>
        <label style={{display:"block",fontSize:12.5,fontWeight:800,color:C.muted,marginTop:17}}>Parent name</label>
        <input value={parentName} onChange={event=>setParentName(event.target.value)} style={{width:"100%",height:48,boxSizing:"border-box",border:`1.5px solid ${C.border}`,borderRadius:13,padding:"0 13px",fontSize:15.5,marginTop:7}}/>
        <label style={{display:"block",fontSize:12.5,fontWeight:800,color:C.muted,marginTop:13}}>Student name</label>
        <input value={studentName} onChange={event=>setStudentName(event.target.value)} style={{width:"100%",height:48,boxSizing:"border-box",border:`1.5px solid ${C.border}`,borderRadius:13,padding:"0 13px",fontSize:15.5,marginTop:7}}/>
        {error&&<div style={{color:C.danger,fontSize:13,marginTop:10}}>{error}</div>}
        <button onClick={save} disabled={busy} style={{width:"100%",height:48,border:"none",borderRadius:13,background:C.greenDark,color:"#FFF",fontWeight:850,fontSize:15,marginTop:16}}>{busy?"Saving…":"Save changes"}</button>
      </div>
    </div>
  );
}

export default function ParentPortal({ user }) {
  const [accesses, setAccesses] = useState([]);
  const [sections, setSections] = useState({});
  const [accessLoading, setAccessLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [selectedChildKey, setSelectedChildKey] = useState(()=>window.localStorage.getItem("ct_parent_selected_child") || "");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => setInviteToken(captureParentInvite()), []);
  useEffect(() => subscribeParentSectionAccess(user.uid, rows => {
    setAccesses(rows.filter(item=>item.status==="active"));
    setAccessLoading(false);
  }, cause => {
    setError(cleanError(cause, "Could not load class access."));
    setAccessLoading(false);
  }), [user.uid]);

  useEffect(() => {
    const sectionIds = [...new Set(accesses.map(item=>item.sectionId).filter(Boolean))];
    if (!sectionIds.length) {
      setSections({});
      return undefined;
    }
    const unsubscribers = sectionIds.map(sectionId =>
      subscribeParentPortalSection(sectionId, section => {
        setSections(current=>({...current,[sectionId]:section}));
      }, cause=>setError(cleanError(cause, "Could not load class details.")))
    );
    return () => unsubscribers.forEach(unsubscribe=>unsubscribe());
  }, [accesses.map(item=>item.sectionId).join("|")]);

  const children = useMemo(() => accesses.flatMap(access =>
    (access.children || []).map((child,index)=>({
      ...child,
      id:child.id || `child_${index}`,
      key:`${access.id}::${child.id || index}`,
      access,
      section:sections[access.sectionId] || null,
    }))
  ), [accesses, sections]);

  const selectedChild = children.find(item=>item.key===selectedChildKey) || children[0] || null;

  useEffect(() => {
    if (!selectedChild) return;
    if (selectedChild.key !== selectedChildKey) setSelectedChildKey(selectedChild.key);
    window.localStorage.setItem("ct_parent_selected_child", selectedChild.key);
  }, [selectedChild?.key]);

  useEffect(() => {
    if (!selectedChild?.access?.id) {
      setFeed([]);
      setFeedLoading(false);
      return undefined;
    }
    setFeedLoading(true);
    return subscribeParentSectionFeed(
      selectedChild.access.id,
      rows=>{setFeed(rows);setFeedLoading(false);},
      cause=>{setError(cleanError(cause, "Could not load the class timeline."));setFeedLoading(false);}
    );
  }, [selectedChild?.access?.id]);

  const groups = useMemo(() => {
    const byDate = new Map();
    feed.forEach(entry => {
      const key = entry.dateKey || "recent";
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(entry);
    });
    return [...byDate.entries()].sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
  }, [feed]);
  const hasToday = groups.some(([dateKey])=>dateKey===indiaTodayKey());

  if (accessLoading) {
    return <main style={{minHeight:"100svh",background:C.bg,display:"grid",placeItems:"center",fontFamily:"Inter, sans-serif",color:C.muted}}>Opening your class…</main>;
  }

  if (!children.length && !inviteToken) {
    return (
      <main style={{minHeight:"100svh",background:C.bg,display:"grid",placeItems:"center",padding:18,fontFamily:"Inter, sans-serif",color:C.ink}}>
        <section style={{width:"100%",maxWidth:420,background:"#FFF",border:`1px solid ${C.border}`,borderRadius:26,padding:"28px 22px",boxSizing:"border-box",textAlign:"center",boxShadow:"0 18px 48px rgba(16,42,35,0.08)"}}>
          <span style={{width:58,height:58,borderRadius:18,background:C.mint,color:C.green,display:"inline-grid",placeItems:"center"}}><IconSchool size={29}/></span>
          <h1 style={{fontFamily:"Poppins, sans-serif",fontSize:25,margin:"18px 0 8px"}}>A class invitation is required</h1>
          <p style={{color:C.muted,fontSize:14.5,lineHeight:1.6,margin:0}}>Open the private link shared by your institute. After joining once, this page will open your child’s class automatically.</p>
          {error&&<div style={{color:C.danger,fontSize:13.5,marginTop:14}}>{error}</div>}
          <button onClick={logout} style={{height:44,border:`1px solid ${C.border}`,borderRadius:13,background:"#FFF",color:C.muted,fontWeight:800,padding:"0 16px",marginTop:20,cursor:"pointer"}}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100svh",background:C.bg,fontFamily:"Inter, sans-serif",color:C.ink,paddingBottom:"calc(28px + env(safe-area-inset-bottom))"}}>
      <div style={{width:"100%",maxWidth:680,margin:"0 auto"}}>
        <header style={{position:"sticky",top:0,zIndex:10,background:"rgba(243,248,245,0.94)",backdropFilter:"blur(16px)",padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:9,fontWeight:900,fontSize:13.5,color:C.greenDark}}>
              <span style={{width:35,height:35,borderRadius:12,background:C.green,color:"#FFF",display:"grid",placeItems:"center"}}><IconBook2 size={19}/></span>
              LEDGR
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              {selectedChild&&<button aria-label="Edit names" onClick={()=>setEditing(selectedChild)} style={{width:38,height:38,border:`1px solid ${C.border}`,borderRadius:12,background:"#FFF",color:C.muted,display:"grid",placeItems:"center",cursor:"pointer"}}><IconEdit size={18}/></button>}
              <button aria-label="Sign out" onClick={logout} style={{width:38,height:38,border:`1px solid ${C.border}`,borderRadius:12,background:"#FFF",color:C.muted,display:"grid",placeItems:"center",cursor:"pointer"}}><IconLogout size={18}/></button>
            </div>
          </div>

          {selectedChild&&(
            <div style={{position:"relative",marginTop:14}}>
              <button type="button" onClick={()=>children.length>1&&setSwitcherOpen(value=>!value)} style={{width:"100%",border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",textAlign:"left",gap:12,cursor:children.length>1?"pointer":"default"}}>
                <span style={{width:46,height:46,borderRadius:16,background:C.mint,color:C.greenDark,display:"grid",placeItems:"center",fontWeight:900,fontSize:14,flexShrink:0}}>{initials(selectedChild.name)}</span>
                <span style={{minWidth:0,flex:1}}>
                  <span style={{display:"block",fontFamily:"Poppins, sans-serif",fontWeight:800,fontSize:20,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selectedChild.name}</span>
                  <span style={{display:"flex",alignItems:"center",gap:5,color:C.muted,fontSize:12.5,marginTop:2}}><IconSchool size={14}/>{selectedChild.section?.sectionName || selectedChild.access.sectionName} · {selectedChild.section?.instituteName || selectedChild.access.instituteName}</span>
                </span>
                {children.length>1&&<IconChevronDown size={20} color={C.muted} style={{transform:switcherOpen?"rotate(180deg)":"none",transition:"transform 160ms"}}/>}
              </button>
              {switcherOpen&&(
                <div style={{position:"absolute",left:0,right:0,top:"calc(100% + 9px)",background:"#FFF",border:`1px solid ${C.border}`,borderRadius:18,padding:7,boxShadow:"0 18px 44px rgba(16,42,35,0.16)"}}>
                  {children.map(item=>(
                    <button key={item.key} onClick={()=>{setSelectedChildKey(item.key);setSwitcherOpen(false);}} style={{width:"100%",border:"none",borderRadius:13,background:item.key===selectedChild.key?C.mint:"transparent",padding:"10px",display:"flex",alignItems:"center",gap:10,textAlign:"left",cursor:"pointer"}}>
                      <span style={{width:36,height:36,borderRadius:12,background:"#FFF",border:`1px solid ${C.border}`,display:"grid",placeItems:"center",fontSize:11,fontWeight:900}}>{initials(item.name)}</span>
                      <span><strong style={{display:"block",fontSize:14}}>{item.name}</strong><small style={{color:C.muted,fontSize:11.5}}>{item.section?.sectionName || item.access.sectionName} · {item.section?.instituteName || item.access.instituteName}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        <div style={{padding:"18px 14px 0"}}>
          {notice&&<div style={{background:C.mint,border:"1px solid #CAE8D8",borderRadius:14,padding:"11px 13px",fontSize:13.5,color:C.greenDark,marginBottom:13}}>{notice}</div>}
          {error&&<div role="alert" style={{background:"#FEF3F2",border:"1px solid #FECDCA",borderRadius:14,padding:"11px 13px",fontSize:13.5,color:C.danger,marginBottom:13}}>{error}</div>}

          {!hasToday&&!feedLoading&&(
            <section style={{background:"linear-gradient(135deg,#0D5C40,#147A54)",color:"#FFF",borderRadius:22,padding:"20px",marginBottom:17,boxShadow:"0 14px 32px rgba(13,92,64,0.18)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:900,letterSpacing:0.8,textTransform:"uppercase",opacity:0.78}}><IconBook2 size={16}/> Today</div>
              <h2 style={{fontFamily:"Poppins, sans-serif",fontSize:23,margin:"12px 0 5px"}}>No update yet</h2>
              <p style={{fontSize:13.5,lineHeight:1.5,opacity:0.76,margin:0}}>Teaching entries will appear here after teachers update Ledgr.</p>
            </section>
          )}

          {feedLoading&&<div style={{padding:"28px 14px",textAlign:"center",color:C.muted,fontSize:14}}>Loading the class timeline…</div>}

          {!feedLoading&&groups.map(([dateKey, entries])=>(
            <section key={dateKey} style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"0 4px 10px"}}>
                <h2 style={{fontSize:13,fontWeight:900,letterSpacing:0.45,textTransform:"uppercase",color:dateKey===indiaTodayKey()?C.greenDark:C.muted,margin:0,whiteSpace:"nowrap"}}>{formatDate(dateKey)}</h2>
                <span style={{height:1,background:C.border,flex:1}}/>
                <span style={{fontSize:11.5,color:C.faint,fontWeight:800}}>{entries.length} update{entries.length===1?"":"s"}</span>
              </div>
              <div style={{display:"grid",gap:10}}>
                {entries.map(entry=>(
                  <article key={entry.id} style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:19,padding:"16px",boxShadow:"0 7px 20px rgba(16,42,35,0.045)"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EDF3FF",color:C.blue,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:900,maxWidth:"64%",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        <IconBook2 size={13}/>{entry.subject || "Class update"}
                      </span>
                      <span style={{fontSize:11.5,color:C.muted,fontWeight:750,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"40%"}}>{entry.teacherDisplayName || "Teacher"}</span>
                    </div>
                    <h3 style={{fontFamily:"Poppins, sans-serif",fontSize:17.5,lineHeight:1.35,color:C.ink,margin:"12px 0 0",fontWeight:750}}>{entry.title || entry.body || "Class update"}</h3>
                    {entry.body&&entry.body!==entry.title&&<p style={{fontSize:14,lineHeight:1.62,color:C.muted,margin:"8px 0 0",whiteSpace:"pre-wrap"}}>{entry.body}</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}

          {!feedLoading&&!groups.length&&hasToday&&<div style={{padding:"24px",textAlign:"center",color:C.muted}}>No class updates are available yet.</div>}

          {selectedChild&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:C.faint,fontSize:11.5,padding:"8px 0 4px"}}><IconUsers size={14}/> Read-only class information from your institute</div>}
        </div>
      </div>

      {inviteToken&&<InviteCard user={user} token={inviteToken} onCancel={()=>{clearParentInvite();setInviteToken("");}} onDone={result=>{setInviteToken("");setNotice(`${result.studentName} is now connected to ${result.sectionName}.`);}}/>}
      {editing&&<EditNamesModal access={editing.access} child={editing} onClose={()=>setEditing(null)}/>}
    </main>
  );
}
