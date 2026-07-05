import React from "react";
import { G, pill } from "../styles/adminTheme.js";

export function InstTypePicker({ inst, onSelect, onClose }) {
  const W = { navy:"#1A2F5A",blue:"#1D4ED8",blueL:"#EEF2FF",surface:"#fff",border:"#E2E8F0",text:"#0F172A",textM:"#475569",textL:"#94A3B8",bg:"#F4F6FA",green:"#1B8A4C",greenL:"#ECFDF5",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif" };
  const types = [
    { id:"school",       icon:"🏫", title:"School",                  sub:"Classes 6th–12th, sections A/B/C etc.",                          color:"#EEF2FF", border:"#C7D7F5" },
    { id:"coaching_12",  icon:"📐", title:"Coaching — After 12th",   sub:"JEE, NEET, CLAT, CUET and similar entrance prep batches.",      color:"#ECFDF5", border:"#A7F3D0" },
    { id:"coaching_grad",icon:"🏛", title:"Coaching — After Graduation", sub:"Banking, SSC, UPSC, CAT and similar competitive exam batches.", color:"#FFFBEB", border:"#FDE68A" },
  ];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:960,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
      <div style={{background:W.surface,borderRadius:22,width:"100%",maxWidth:480,boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        <div style={{padding:"22px 20px 16px",borderBottom:`1px solid ${W.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:12,color:W.textL,fontFamily:"'Inter',sans-serif"}}>{inst}</div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:W.textL}}>✕</button>
          </div>
          <div style={{fontSize:20,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:4}}>What kind of institute is this?</div>
          <div style={{fontSize:14,color:W.textM,lineHeight:1.5}}>This shapes how you create batches and time slots.</div>
        </div>
        <div style={{padding:"16px 20px 22px",display:"flex",flexDirection:"column",gap:10}}>
          {types.map(t=>(
            <div key={t.id} onClick={()=>onSelect(t.id)}
              style={{background:t.color,border:`1.5px solid ${t.border}`,borderRadius:14,padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"transform 0.1s,box-shadow 0.1s",WebkitTapHighlightColor:"transparent"}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
              <div style={{fontSize:28,flexShrink:0}}>{t.icon}</div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:W.text,fontFamily:W.display,marginBottom:2}}>{t.title}</div>
                <div style={{fontSize:13,color:W.textM,lineHeight:1.4}}>{t.sub}</div>
              </div>
              <div style={{marginLeft:"auto",fontSize:18,color:W.textL,flexShrink:0}}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DurStepper({ value, onChange, compact = false }) {
  const W = { navy:"#1A2F5A",border:"#E2E8F0",text:"#0F172A",textM:"#475569",textL:"#94A3B8",surface:"#fff",sans:"'Inter',sans-serif",display:"'Poppins',sans-serif",mono:"'Inter',sans-serif" };
  const fmt = m => m < 60 ? `${m} min` : m === 60 ? "1 hour" : m % 60 === 0 ? `${m/60} hours` : `${Math.floor(m/60)}h ${m%60}m`;
  const dec = () => onChange(Math.max(30, value - 5));
  const inc = () => onChange(Math.min(180, value + 5));
  const buttonSize = compact ? 42 : 52;
  const labelWidth = compact ? 96 : 110;
  const valueSize = compact ? 16 : 20;
  const metaSize = compact ? 9 : 10;
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,background:W.surface,border:`2px solid ${W.navy}`,borderRadius:compact?12:14,overflow:"hidden",width:"fit-content",boxShadow:compact?"none":"0 4px 10px rgba(15,23,42,0.04)"}}>
      <button onClick={dec} style={{width:buttonSize,height:buttonSize,border:"none",background:"transparent",fontSize:compact?20:22,fontWeight:700,cursor:"pointer",color:W.navy,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}>−</button>
      <div style={{width:labelWidth,textAlign:"center",padding:"0 4px",borderLeft:`1px solid ${W.border}`,borderRight:`1px solid ${W.border}`}}>
        <div style={{fontFamily:W.display,fontWeight:800,fontSize:valueSize,color:W.navy,lineHeight:1.2}}>{fmt(value)}</div>
        <div style={{fontSize:metaSize,color:W.textL,fontFamily:W.mono}}>{value} min</div>
      </div>
      <button onClick={inc} style={{width:buttonSize,height:buttonSize,border:"none",background:"transparent",fontSize:compact?20:22,fontWeight:700,cursor:"pointer",color:W.navy,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}>+</button>
    </div>
  );
}

export function CopyGroupToInstitutesModal({ sourceInst, group, allInstitutes, instSectionsAll, getInstituteSectionConfig, getInstituteSectionConfigKey, onCopy, onClose }) {
  const otherInstitutes = allInstitutes.filter(i => i !== sourceInst);
  const [selected, setSelected] = React.useState({});
  const [conflicts, setConflicts] = React.useState(null); // null | [{inst, conflictingGroup}]
  const [resolutions, setResolutions] = React.useState({}); // {inst: "replace"|"rename"|"skip"}
  const [renames, setRenames] = React.useState({}); // {inst: string}
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState("select"); // "select" | "conflicts" | "done"

  const toggleInst = inst => setSelected(prev => ({ ...prev, [inst]: !prev[inst] }));
  const selectedInsts = otherInstitutes.filter(i => selected[i]);
  const fmtSlot = s => {
    const [h,m] = s.start.split(":").map(Number);
    const [eh,em] = (s.end||"").split(":").map(Number);
    const f=(hh,mm)=>`${hh%12||12}:${String(mm).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;
    return `${f(h,m)}–${f(eh||0,em||0)}`;
  };

  function checkConflicts() {
    if (!selectedInsts.length) return;
    const found = [];
    for (const inst of selectedInsts) {
      const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
      const existingGroups = instData.gradeGroups || [];
      const clash = existingGroups.find(g => g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase());
      if (clash) found.push({ inst, conflictingGroup: clash });
    }
    if (found.length > 0) {
      const initRes = {};
      const initRen = {};
      found.forEach(({ inst }) => {
        initRes[inst] = "rename";
        initRen[inst] = `${group.label} (Copy)`;
      });
      setConflicts(found);
      setResolutions(initRes);
      setRenames(initRen);
      setStep("conflicts");
    } else {
      setConflicts([]);
      doCopy([]);
    }
  }

  async function doCopy(resolvedConflicts) {
    setBusy(true);
    try {
      for (const inst of selectedInsts) {
        const instKey = getInstituteSectionConfigKey(instSectionsAll, inst);
        const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
        const existingGroups = instData.gradeGroups || [];
        const conflict = (resolvedConflicts || []).find(c => c.inst === inst);
        const resolution = conflict ? resolutions[inst] : null;
        if (resolution === "skip") continue;
        // Build a clean copy, brand new id, stripped of source-institute info
        const newGroup = {
          ...group,
          id: "grp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          label: resolution === "rename" ? (renames[inst] || `${group.label} (Copy)`) : group.label,
          // Strip any teacher-source fields (none exist structurally, but be explicit)
        };
        let updatedGroups;
        if (resolution === "replace") {
          updatedGroups = existingGroups.map(g =>
            g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase() ? newGroup : g
          );
        } else {
          updatedGroups = [...existingGroups, newGroup];
        }
        await onCopy(instKey, inst, updatedGroups);
      }
      setStep("done");
    } catch(e) {
      alert("Copy failed: " + (e?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }

  const conflictInsts = new Set((conflicts || []).map(c => c.inst));

  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",background:"rgba(0,0,0,0.45)"}}>
      <div style={{background:G.surface,borderRadius:18,boxShadow:G.shadowLg,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",padding:"24px"}}>
        {step === "select" && (<>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontSize:19,fontWeight:800,color:G.text,fontFamily:G.display}}>Copy Group to Institutes</div>
              <div style={{fontSize:13,color:G.textM,marginTop:4}}>
                Copying <strong style={{color:G.text}}>{group.label}</strong> — sections and time slots will be duplicated as a fresh independent group.
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:G.textL,flexShrink:0,lineHeight:1}}>✕</button>
          </div>
          {/* Group preview */}
          <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"12px 14px",marginBottom:18}}>
            <div style={{fontSize:12,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>What will be copied</div>
            <div style={{fontSize:13,color:G.textS,marginBottom:4}}>
              <strong>{(group.sections||[]).length}</strong> sections: {(group.sections||[]).slice(0,6).join(", ")}{(group.sections||[]).length>6?" …":""}
            </div>
            <div style={{fontSize:13,color:G.textS}}>
              <strong>{(group.slots||[]).length}</strong> time slot{(group.slots||[]).length!==1?"s":""}: {(group.slots||[]).map(fmtSlot).join(", ")}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:G.textM,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Select target institutes</div>
          {otherInstitutes.length === 0 && (
            <div style={{fontSize:14,color:G.textM,padding:"18px 0",textAlign:"center"}}>No other institutes found. Create more institutes first.</div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {otherInstitutes.map(inst => {
              const instData = getInstituteSectionConfig(instSectionsAll, inst) || {};
              const groupCount = (instData.gradeGroups||[]).length;
              const hasConflict = (instData.gradeGroups||[]).some(g => g.label?.trim().toLowerCase() === group.label?.trim().toLowerCase());
              return (
                <label key={inst} style={{display:"flex",alignItems:"center",gap:12,background:selected[inst]?G.blueL:G.bg,border:`1.5px solid ${selected[inst]?G.blue:G.border}`,borderRadius:10,padding:"11px 14px",cursor:"pointer",transition:"all 0.13s"}}>
                  <input type="checkbox" checked={!!selected[inst]} onChange={()=>toggleInst(inst)}
                    style={{width:16,height:16,accentColor:G.blue,flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:G.text,fontFamily:G.display}}>{inst}</div>
                    <div style={{fontSize:12,color:G.textM,marginTop:2}}>{groupCount} group{groupCount!==1?"s":""}{hasConflict ? <span style={{color:G.amber,fontWeight:700}}> · name conflict</span> : ""}</div>
                  </div>
                  {hasConflict && <span style={{fontSize:18}}>⚠️</span>}
                </label>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{...pill(G.bg,G.textS,G.borderM),padding:"10px 18px",fontSize:14}}>Cancel</button>
            <button disabled={selectedInsts.length===0} onClick={checkConflicts}
              style={{...pill(G.navy,"#fff","transparent"),padding:"10px 20px",fontSize:14,opacity:selectedInsts.length===0?0.5:1,cursor:selectedInsts.length===0?"not-allowed":"pointer"}}>
              Continue →
            </button>
          </div>
        </>)}

        {step === "conflicts" && (<>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontSize:19,fontWeight:800,color:G.text,fontFamily:G.display}}>Resolve Name Conflicts</div>
              <div style={{fontSize:13,color:G.textM,marginTop:4}}>
                {conflicts.length} institute{conflicts.length!==1?"s":""} already {conflicts.length!==1?"have":"has"} a group named <strong style={{color:G.text}}>&ldquo;{group.label}&rdquo;</strong>. Choose what to do for each.
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:G.textL,flexShrink:0,lineHeight:1}}>✕</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            {conflicts.map(({inst, conflictingGroup})=>(
              <div key={inst} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:15,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>{inst}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    ["rename", "Add as new group (with a different name)"],
                    ["replace", `Replace existing "${conflictingGroup.label}" group`],
                    ["skip", "Skip this institute"],
                  ].map(([val, label])=>(
                    <label key={val} style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer"}}>
                      <input type="radio" name={`res_${inst}`} value={val} checked={resolutions[inst]===val}
                        onChange={()=>setResolutions(prev=>({...prev,[inst]:val}))}
                        style={{marginTop:2,accentColor:G.blue}} />
                      <span style={{fontSize:14,color:G.textS,lineHeight:1.4}}>{label}</span>
                    </label>
                  ))}
                </div>
                {resolutions[inst]==="rename" && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:G.textM,marginBottom:4}}>New group name for <strong>{inst}</strong>:</div>
                    <input value={renames[inst]||""} onChange={e=>setRenames(prev=>({...prev,[inst]:e.target.value}))}
                      style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",borderRadius:8,border:`1.5px solid ${G.blue}`,fontSize:14,fontFamily:G.sans,outline:"none",color:G.text}} />
                  </div>
                )}
              </div>
            ))}
            {/* Non-conflicting targets summary */}
            {selectedInsts.filter(i=>!conflictInsts.has(i)).length > 0 && (
              <div style={{background:"#ECFDF5",border:"1px solid #BBF7D0",borderRadius:10,padding:"11px 14px"}}>
                <div style={{fontSize:13,color:"#166534",fontWeight:600}}>
                  ✓ No conflicts at: {selectedInsts.filter(i=>!conflictInsts.has(i)).join(", ")}
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setStep("select")} style={{...pill(G.bg,G.textS,G.borderM),padding:"10px 18px",fontSize:14}}>← Back</button>
            <button disabled={busy} onClick={()=>doCopy(conflicts)}
              style={{...pill(G.navy,"#fff","transparent"),padding:"10px 20px",fontSize:14,opacity:busy?0.6:1,cursor:busy?"not-allowed":"pointer"}}>
              {busy ? "Copying…" : `Copy to ${selectedInsts.filter(i=>resolutions[i]!=="skip"||!conflictInsts.has(i)).length} institute${selectedInsts.length!==1?"s":""}`}
            </button>
          </div>
        </>)}

        {step === "done" && (<>
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:14}}>✅</div>
            <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display,marginBottom:8}}>Group copied!</div>
            <div style={{fontSize:14,color:G.textM,lineHeight:1.6,marginBottom:24}}>
              <strong>{group.label}</strong> has been added to the selected institutes as an independent group. Teachers there can now use it just like any locally created group.
            </div>
            <button onClick={onClose} style={{...pill(G.navy,"#fff","transparent"),padding:"10px 28px",fontSize:15}}>Done</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
