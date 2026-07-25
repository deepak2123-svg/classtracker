import { useEffect, useMemo, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconLink,
  IconRefresh,
  IconSchool,
  IconUserOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  archiveParentSectionPortal,
  closeParentSectionEnrollment,
  enableParentSectionPortal,
  getParentSectionAdminState,
  rotateParentSectionInvite,
  updateParentSectionMember,
} from "../../firebase";
import { getParentAppUrl } from "../../platform";

const C = {
  ink:"#102A23", muted:"#637B73", faint:"#95A69F", green:"#147A54",
  greenDark:"#0D5C40", mint:"#EAF7F1", border:"#DDE9E3", surface:"#FFFFFF",
  bg:"#F3F8F5", blue:"#2457C5", blueBg:"#EDF3FF", danger:"#B42318",
  dangerBg:"#FEF3F2", amber:"#B54708", amberBg:"#FFF7ED",
};

function messageOf(error, fallback) {
  return String(error?.message || fallback || "Something went wrong.")
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(functions\/[^)]+\)\.?$/i, "");
}

function memberChildren(member) {
  return Array.isArray(member?.children) ? member.children : [];
}

export default function ParentAccessModal({ instituteName, sectionName, sectionOptions = [], onClose }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editParentName, setEditParentName] = useState("");
  const [editStudents, setEditStudents] = useState("");
  const [moveTargets, setMoveTargets] = useState({});
  const parentBaseUrl = getParentAppUrl();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setState(await getParentSectionAdminState({ instituteName, sectionName }));
    } catch (cause) {
      setError(messageOf(cause, "Could not load Parent View."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [instituteName, sectionName]);

  const activeMembers = useMemo(
    () => (state?.accesses || []).filter(item=>item.status==="active"),
    [state]
  );
  const revokedMembers = useMemo(
    () => (state?.accesses || []).filter(item=>item.status!=="active"),
    [state]
  );
  const inviteUrl = state?.inviteToken
    ? `${parentBaseUrl.replace(/\/+$/, "")}/?invite=${encodeURIComponent(state.inviteToken)}`
    : "";

  const run = async (key, action, success) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const next = await action();
      if (next?.enabled !== undefined) setState(next);
      else await load();
      if (success) setNotice(success);
      return true;
    } catch (cause) {
      setError(messageOf(cause, "The Parent View action failed."));
      return false;
    } finally {
      setBusy("");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Parent invitation link copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the link below.");
    }
  };

  const startEdit = member => {
    setEditingId(member.id);
    setEditParentName(member.parentName || "");
    setEditStudents(memberChildren(member).map(item=>item.name).join(", "));
  };

  const saveMember = async member => {
    const names = editStudents.split(",").map(value=>value.trim()).filter(Boolean);
    const current = memberChildren(member);
    const children = names.map((name,index)=>({
      id:current[index]?.id || "",
      name,
      joinedAt:current[index]?.joinedAt || Date.now(),
    }));
    const saved = await run(`save_${member.id}`, () => updateParentSectionMember({
      accessId:member.id,
      action:"edit",
      parentName:editParentName,
      children,
    }), "Family names updated.");
    if (saved) setEditingId("");
  };

  const moveMember = member => {
    const targetSectionName = moveTargets[member.id] || "";
    if (!targetSectionName) {
      setError("Choose the destination section first.");
      return;
    }
    run(`move_${member.id}`, () => updateParentSectionMember({
      accessId:member.id,
      action:"move",
      targetSectionName,
    }), `Moved access to ${targetSectionName}.`);
  };

  const archiveSection = () => {
    const confirmed = window.confirm(
      `End Parent View for ${sectionName}? This revokes every family’s access. Use this only when the section or academic year has ended.`
    );
    if (!confirmed) return;
    run(
      "archive",
      () => archiveParentSectionPortal(state.section.id),
      "Section access ended. Enabling Parent View again will create a fresh cohort link."
    );
  };

  const button = (tone = "light") => ({
    minHeight:38,
    borderRadius:11,
    border:tone==="danger" ? "1px solid #FECDCA" : tone==="primary" ? "1px solid transparent" : `1px solid ${C.border}`,
    background:tone==="danger" ? C.dangerBg : tone==="primary" ? C.greenDark : "#FFF",
    color:tone==="danger" ? C.danger : tone==="primary" ? "#FFF" : C.muted,
    padding:"0 12px",
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    gap:7,
    fontSize:12.5,
    fontWeight:850,
    cursor:busy ? "wait" : "pointer",
  });

  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(10,31,25,0.50)",backdropFilter:"blur(7px)",display:"flex",alignItems:"center",justifyContent:"center",padding:14}} onClick={event=>event.target===event.currentTarget&&!busy&&onClose()}>
      <section role="dialog" aria-modal="true" aria-label={`Parent access for ${sectionName}`} style={{width:"100%",maxWidth:720,maxHeight:"92svh",background:C.bg,borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 28px 80px rgba(10,31,25,0.28)",fontFamily:"Inter, sans-serif",color:C.ink}}>
        <header style={{background:"#FFF",borderBottom:`1px solid ${C.border}`,padding:"17px 18px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",gap:12,minWidth:0}}>
            <span style={{width:44,height:44,borderRadius:15,background:C.mint,color:C.green,display:"grid",placeItems:"center",flexShrink:0}}><IconUsers size={23}/></span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11,fontWeight:900,color:C.green,textTransform:"uppercase",letterSpacing:0.75}}>Parent View</div>
              <h2 style={{fontFamily:"Poppins, sans-serif",fontSize:22,lineHeight:1.2,margin:"4px 0 3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sectionName}</h2>
              <div style={{fontSize:12.5,color:C.muted}}>{instituteName} · read-only teaching timeline</div>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} disabled={!!busy} style={{width:39,height:39,border:`1px solid ${C.border}`,borderRadius:12,background:"#FFF",color:C.muted,display:"grid",placeItems:"center",cursor:"pointer",flexShrink:0}}><IconX size={19}/></button>
        </header>

        <div style={{padding:16,overflowY:"auto"}}>
          {loading&&<div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:18,padding:24,textAlign:"center",color:C.muted}}>Loading Parent View…</div>}
          {error&&<div role="alert" style={{background:C.dangerBg,border:"1px solid #FECDCA",color:C.danger,borderRadius:14,padding:"11px 13px",fontSize:13.5,marginBottom:12}}>{error}</div>}
          {notice&&<div style={{background:C.mint,border:"1px solid #CBE8D9",color:C.greenDark,borderRadius:14,padding:"11px 13px",fontSize:13.5,marginBottom:12,display:"flex",alignItems:"center",gap:7}}><IconCheck size={17}/>{notice}</div>}

          {!loading&&!state?.enabled&&(
            <div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:20,padding:"22px",textAlign:"center"}}>
              <span style={{width:56,height:56,borderRadius:18,background:C.blueBg,color:C.blue,display:"inline-grid",placeItems:"center"}}><IconSchool size={28}/></span>
              <h3 style={{fontFamily:"Poppins, sans-serif",fontSize:20,margin:"16px 0 7px"}}>Enable the parent timeline</h3>
              <p style={{fontSize:13.5,lineHeight:1.6,color:C.muted,maxWidth:500,margin:"0 auto"}}>Ledgr will publish only date, subject, topic, teaching notes, and teacher name. Existing teacher records and Admin controls stay private.</p>
              <button disabled={!!busy} onClick={()=>run("enable",()=>enableParentSectionPortal({instituteName,sectionName}),"Parent View enabled and today’s entries prepared.")} style={{...button("primary"),height:46,padding:"0 18px",fontSize:14,marginTop:18}}>
                <IconLink size={18}/>{busy==="enable"?"Enabling…":"Enable Parent View"}
              </button>
            </div>
          )}

          {!loading&&state?.enabled&&(
            <>
              <div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:20,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:900,textTransform:"uppercase",letterSpacing:0.7,color:C.faint}}>Enrollment</div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginTop:6,fontSize:14,fontWeight:850,color:state.enrollmentStatus==="open"?C.greenDark:C.amber}}>
                      <span style={{width:8,height:8,borderRadius:99,background:state.enrollmentStatus==="open"?C.green:"#F79009"}}/>
                      {state.enrollmentStatus==="open"?"Invitation open":"Invitation closed"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    <button disabled={!!busy} onClick={()=>run("rotate",()=>rotateParentSectionInvite(state.section.id),"A new link is active; the previous link is closed.")} style={button("light")}><IconRefresh size={16}/>{busy==="rotate"?"Rotating…":"Rotate link"}</button>
                    {state.enrollmentStatus==="open"&&<button disabled={!!busy} onClick={()=>run("close",()=>closeParentSectionEnrollment(state.section.id),"New parent enrollment is closed.")} style={button("danger")}><IconUserOff size={16}/>{busy==="close"?"Closing…":"Close enrollment"}</button>}
                  </div>
                </div>

                {inviteUrl&&(
                  <div style={{marginTop:14}}>
                    <label style={{fontSize:11.5,fontWeight:850,color:C.muted}}>Share privately with this section’s parent group</label>
                    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,marginTop:7}}>
                      <input readOnly value={inviteUrl} onFocus={event=>event.target.select()} style={{height:43,minWidth:0,border:`1px solid ${C.border}`,borderRadius:12,padding:"0 12px",fontSize:12.5,color:C.muted,background:C.bg}}/>
                      <button onClick={copyLink} style={{...button("primary"),height:43}}><IconCopy size={16}/>Copy link</button>
                    </div>
                    <a href={inviteUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,color:C.blue,fontSize:12.5,fontWeight:800,textDecoration:"none",marginTop:9}}><IconExternalLink size={14}/>Preview invitation</a>
                  </div>
                )}
                {!inviteUrl&&<div style={{background:C.amberBg,color:C.amber,borderRadius:12,padding:"10px 12px",fontSize:13,marginTop:13}}>Enrollment is closed. Rotate the link to open it again.</div>}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9,margin:"12px 0"}}>
                <div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:16,padding:"13px 14px"}}><div style={{fontSize:11,color:C.faint,fontWeight:900,textTransform:"uppercase"}}>Active families</div><div style={{fontSize:25,fontWeight:900,marginTop:5}}>{activeMembers.length}</div></div>
                <div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:16,padding:"13px 14px"}}><div style={{fontSize:11,color:C.faint,fontWeight:900,textTransform:"uppercase"}}>Revoked</div><div style={{fontSize:25,fontWeight:900,marginTop:5}}>{revokedMembers.length}</div></div>
              </div>

              <div style={{display:"flex",alignItems:"center",gap:9,margin:"18px 2px 9px"}}>
                <h3 style={{fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:0.65,color:C.muted,margin:0}}>Parent access list</h3>
                <span style={{height:1,background:C.border,flex:1}}/>
              </div>

              {!activeMembers.length&&<div style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:17,padding:"20px",textAlign:"center",color:C.muted,fontSize:13.5}}>No parents have redeemed this section link yet.</div>}

              <div style={{display:"grid",gap:9}}>
                {activeMembers.map(member=>{
                  const isEditing = editingId===member.id;
                  const moveOptions = sectionOptions.filter(name=>name&&name!==sectionName);
                  return (
                    <article key={member.id} style={{background:"#FFF",border:`1px solid ${C.border}`,borderRadius:18,padding:14}}>
                      {!isEditing?(
                        <>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:15,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.parentName || "Parent"}</div>
                              <div style={{fontSize:12,color:C.muted,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.parentEmail || "Signed-in parent"}</div>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
                                {memberChildren(member).map(child=><span key={child.id||child.name} style={{background:C.mint,color:C.greenDark,borderRadius:999,padding:"5px 9px",fontSize:11.5,fontWeight:800}}>{child.name}</span>)}
                              </div>
                            </div>
                            <button onClick={()=>startEdit(member)} style={button("light")}>Edit</button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:7,marginTop:13}}>
                            <select value={moveTargets[member.id]||""} onChange={event=>setMoveTargets(current=>({...current,[member.id]:event.target.value}))} style={{height:38,minWidth:0,border:`1px solid ${C.border}`,borderRadius:11,background:"#FFF",color:C.muted,padding:"0 9px",fontSize:12}}>
                              <option value="">Move to section…</option>
                              {moveOptions.map(name=><option key={name} value={name}>{name}</option>)}
                            </select>
                            <button disabled={!!busy||!moveOptions.length} onClick={()=>moveMember(member)} style={button("light")}>{busy===`move_${member.id}`?"Moving…":"Move"}</button>
                            <button disabled={!!busy} onClick={()=>run(`revoke_${member.id}`,()=>updateParentSectionMember({accessId:member.id,action:"revoke"}),"Parent access revoked.")} style={button("danger")}>{busy===`revoke_${member.id}`?"Revoking…":"Revoke"}</button>
                          </div>
                        </>
                      ):(
                        <>
                          <label style={{fontSize:11.5,fontWeight:850,color:C.muted}}>Parent name</label>
                          <input value={editParentName} onChange={event=>setEditParentName(event.target.value)} style={{width:"100%",height:41,boxSizing:"border-box",border:`1px solid ${C.border}`,borderRadius:11,padding:"0 11px",fontSize:13.5,marginTop:6}}/>
                          <label style={{display:"block",fontSize:11.5,fontWeight:850,color:C.muted,marginTop:11}}>Student names <span style={{fontWeight:500}}>(comma separated)</span></label>
                          <input value={editStudents} onChange={event=>setEditStudents(event.target.value)} style={{width:"100%",height:41,boxSizing:"border-box",border:`1px solid ${C.border}`,borderRadius:11,padding:"0 11px",fontSize:13.5,marginTop:6}}/>
                          <div style={{display:"flex",justifyContent:"flex-end",gap:7,marginTop:11}}>
                            <button onClick={()=>setEditingId("")} style={button("light")}>Cancel</button>
                            <button disabled={!!busy} onClick={()=>saveMember(member)} style={button("primary")}>{busy===`save_${member.id}`?"Saving…":"Save"}</button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>

              {!!revokedMembers.length&&(
                <details style={{marginTop:14,background:"#FFF",border:`1px solid ${C.border}`,borderRadius:16,padding:"12px 14px"}}>
                  <summary style={{fontSize:12.5,fontWeight:850,color:C.muted,cursor:"pointer"}}>{revokedMembers.length} revoked access record{revokedMembers.length===1?"":"s"}</summary>
                  <div style={{display:"grid",gap:7,marginTop:10}}>
                    {revokedMembers.map(member=><div key={member.id} style={{fontSize:12.5,color:C.faint,display:"flex",justifyContent:"space-between",gap:10}}><span>{member.parentName || member.parentEmail || "Parent"}</span><span>{member.sectionName || sectionName}</span></div>)}
                  </div>
                </details>
              )}

              <div style={{marginTop:16,background:C.dangerBg,border:"1px solid #FECDCA",borderRadius:17,padding:"14px"}}>
                <div style={{fontSize:12.5,fontWeight:900,color:C.danger}}>Academic-year close</div>
                <div style={{fontSize:12.5,lineHeight:1.5,color:C.muted,marginTop:4}}>Ends this cohort and revokes every family. A later enable creates a fresh section link without restoring old access.</div>
                <button disabled={!!busy} onClick={archiveSection} style={{...button("danger"),marginTop:10}}>
                  <IconUserOff size={16}/>{busy==="archive"?"Ending access…":"End section access"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
