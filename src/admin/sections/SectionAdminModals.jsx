import { DELETE_SECTION_ACTION } from "../constants/adminKeys.js";
import { G } from "../styles/adminTheme.js";
import { normaliseSectionKey } from "../utils/adminSections.js";

export function SectionRenameReviewModal({
  draft,
  selections,
  onChange,
  onBack,
  onConfirm,
  busy,
  entityLabels,
}){
  const removedCount = draft?.removedSections?.length || 0;
  const addedCount = draft?.addedSections?.length || 0;
  const singular = entityLabels?.singular || "section";
  const plural = entityLabels?.plural || "sections";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.48)",zIndex:710,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:620,maxHeight:"88vh",overflowY:"auto",background:G.surface,border:`1px solid ${G.border}`,borderRadius:24,boxShadow:"0 30px 80px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Rename review
          </div>
          <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            Tell teachers what changed
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.7}}>
            {`If a ${singular} was renamed, map the old name to the new one here. Teachers will get a one-time prompt, and their class history will stay intact.`}
          </div>
        </div>

        <div style={{padding:"18px 24px 10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:18}}>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Removed names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{removedCount}</div>
            </div>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Current names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{draft?.currentSections?.length || 0}</div>
            </div>
            <div style={{background:draft?.timetableChanged ? "#FFF7ED" : "#ECFDF5",border:`1px solid ${draft?.timetableChanged ? "#FED7AA" : "#BBF7D0"}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:draft?.timetableChanged ? G.amber : "#166534",marginBottom:5}}>Timetable</div>
              <div style={{fontSize:16,fontWeight:800,color:draft?.timetableChanged ? G.amber : "#166534",fontFamily:G.display}}>
                {draft?.timetableChanged ? "Updated for future logs" : "No slot change"}
              </div>
            </div>
          </div>

          {removedCount === 0 ? (
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"18px 16px",fontSize:14,color:G.textM,lineHeight:1.65}}>
              {`This edit changes the ${singular} list, but there are no removed names to map. Saving will treat any extra names as brand-new ${plural}.`}
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {draft.removedSections.map(oldSection=>{
                const selected = selections?.[oldSection] || "";
                return (
                  <div key={oldSection} style={{background:"#FBFCFE",border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 16px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:4}}>{`Old ${singular}`}</div>
                        <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display}}>{oldSection}</div>
                      </div>
                      <div style={{fontSize:12,color:G.textL,fontFamily:G.mono}}>
                        Teachers will see this once
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>{`New ${singular} name`}</div>
                        <select
                          value={selected}
                          onChange={e=>onChange(oldSection, e.target.value)}
                          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
                        >
                          <option value="">Treat as removed / don't notify</option>
                          {(draft.currentSections || []).map(section=>(
                            <option key={`${oldSection}_${section}`} value={section}>{section}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                        {selected
                          ? <>Teachers using <strong>{oldSection}</strong> will be remapped to <strong>{selected}</strong>. {draft.timetableChanged ? "They'll also be told that future timetable slots changed." : "Their existing timetable pattern stays the same."}</>
                          : <>{`No automatic rename will be sent for this ${singular}. Teachers can still relink manually later if needed.`}</>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {addedCount > 0 && (
            <div style={{marginTop:16,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:16,padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.blue,marginBottom:6}}>{`Current ${plural} names`}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {draft.addedSections.map(section=>(
                  <span key={section} style={{background:"#fff",border:"1px solid #C7D7F5",borderRadius:999,padding:"6px 12px",fontSize:12,fontWeight:700,color:G.blue,fontFamily:G.mono}}>
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{padding:"18px 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",borderTop:`1px solid ${G.border}`}}>
          <button onClick={onBack} disabled={busy}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans}}>
            ← Back
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            {busy ? "Saving…" : `Save ${singular} update`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionQuickRenameModal({
  term,
  originalValue,
  value,
  error,
  onChange,
  onClose,
  onSave,
}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.42)",zIndex:720,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:460,background:G.surface,border:`1px solid ${G.border}`,borderRadius:22,boxShadow:"0 24px 64px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Quick rename
          </div>
          <div style={{fontSize:24,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            {`Rename this ${term}`}
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.65}}>
            {`Teachers using "${originalValue}" will see the new name after you save.`}
          </div>
        </div>
        <div style={{padding:"18px 24px 22px"}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>{`New ${term} name`}</div>
          <input
            value={value}
            onChange={e=>onChange(e.target.value)}
            autoFocus
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${error ? G.red : G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
          />
          {error && (
            <div style={{marginTop:10,fontSize:13,color:G.red,lineHeight:1.5}}>{error}</div>
          )}
        </div>
        <div style={{padding:"0 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <button onClick={onClose}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:"pointer",fontFamily:G.sans}}>
            Cancel
          </button>
          <button onClick={onSave}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            Save rename
          </button>
        </div>
      </div>
    </div>
  );
}

export function LegacySectionRepairModal({
  scopeLabel,
  items,
  selections,
  busy,
  error,
  onChange,
  onClose,
  onConfirm,
}){
  const instituteCount = new Set((items || []).map(item => String(item?.institute || "").trim()).filter(Boolean)).size;
  const optionCount = new Set((items || []).flatMap(item => item?.options || []).map(normaliseSectionKey).filter(Boolean)).size;
  const scopeText = scopeLabel || "all institutes";
  const scopeDescription = instituteCount > 1
    ? "the current section lists across all institutes"
    : `${scopeText}'s current section list`;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.48)",zIndex:730,display:"flex",alignItems:"center",justifyContent:"center",padding:18,backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:720,maxHeight:"88vh",overflowY:"auto",background:G.surface,border:`1px solid ${G.border}`,borderRadius:24,boxShadow:"0 30px 80px rgba(15,23,42,0.2)"}}>
        <div style={{padding:"24px 24px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EEF4FF",border:"1px solid #D7E3FB",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,color:G.navy,fontFamily:G.mono,letterSpacing:0.3,marginBottom:14}}>
            Legacy repair
          </div>
          <div style={{fontSize:26,fontWeight:800,color:G.text,fontFamily:G.display,lineHeight:1.15,marginBottom:8}}>
            Repair old section names
          </div>
          <div style={{fontSize:14,color:G.textM,lineHeight:1.7}}>
            {`These classes still use names that are no longer present in ${scopeDescription}. Map each old section to the right current section, or choose delete to remove that section and all its entries.`}
          </div>
        </div>

        <div style={{padding:"18px 24px 10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:18}}>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>Legacy names</div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>{items.length}</div>
            </div>
            <div style={{background:"#F8FAFC",border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 15px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:5}}>
                {instituteCount > 1 ? "Institutes" : "Current sections"}
              </div>
              <div style={{fontSize:22,fontWeight:800,color:G.text,fontFamily:G.display}}>
                {instituteCount > 1 ? instituteCount : optionCount}
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {items.map(item=>{
              const selectionKey = item.selectionKey || item.oldSection;
              const selected = selections?.[selectionKey] || "";
              const options = item.options || [];
              return (
                <div key={selectionKey} style={{background:"#FBFCFE",border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 16px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                    <div>
                      {item.institute && (
                        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.blue,marginBottom:4}}>{item.institute}</div>
                      )}
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:4}}>Old section name</div>
                      <div style={{fontSize:20,fontWeight:800,color:G.text,fontFamily:G.display}}>{item.oldSection}</div>
                    </div>
                    <div style={{fontSize:12,color:G.textL,fontFamily:G.mono,textAlign:"right"}}>
                      <div>{item.affectedClassCount} class record{item.affectedClassCount!==1?"s":""}</div>
                      <div>{item.affectedTeacherCount} teacher{item.affectedTeacherCount!==1?"s":""}</div>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:G.textL,marginBottom:6}}>Map or delete</div>
                      <select
                        value={selected}
                        onChange={e=>onChange(selectionKey, e.target.value)}
                        style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${G.borderM}`,fontSize:15,fontFamily:G.sans,color:G.text,background:"#fff",outline:"none"}}
                      >
                        <option value="">Select the action…</option>
                        <option value={DELETE_SECTION_ACTION}>Delete this section and its entries</option>
                        {options.map(section=>(
                          <option key={`${item.oldSection}_${section}`} value={section}>{section}</option>
                        ))}
                      </select>
                    </div>
                    {selected===DELETE_SECTION_ACTION&&(
                      <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#B91C1C",fontWeight:600,lineHeight:1.5}}>
                        This will permanently delete every matching class record and all entries under this section.
                      </div>
                    )}
                    {item.subjects.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {item.subjects.map(subject=>(
                          <span key={`${item.oldSection}_${subject}`} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:999,padding:"5px 10px",fontSize:12,color:G.textM,fontFamily:G.sans}}>
                            {subject}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.teacherNames.length>0&&(
                      <div style={{fontSize:13,color:G.textM,lineHeight:1.6}}>
                        {`Teachers affected: ${item.teacherNames.join(", ")}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error&&(
            <div style={{marginTop:16,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:"12px 14px",fontSize:13,color:"#B91C1C",fontWeight:600}}>
              {error}
            </div>
          )}
        </div>

        <div style={{padding:"18px 24px 24px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",borderTop:`1px solid ${G.border}`}}>
          <button onClick={onClose} disabled={busy}
            style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,color:G.textM,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans}}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:G.navy,color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,boxShadow:G.shadowSm}}>
            {busy ? "Applying changes…" : "Apply section changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
