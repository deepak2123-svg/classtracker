import { G } from "../../styles/adminTheme.js";

export function ConfirmDeleteModal({ title, lines, confirmLabel, onConfirm, onClose, busy, options = [] }) {
  const hasOptions = Array.isArray(options) && options.length > 0;
  const modalIntent = /archive|transfer|branch/i.test(`${title || ""} ${confirmLabel || ""}`) ? "archive" : "delete";
  const optionStyle = (tone = "neutral") => ({
    width:"100%",
    border:tone === "danger" ? "none" : `1.5px solid ${tone === "blue" ? "#BFDBFE" : G.border}`,
    borderRadius:10,
    padding:"10px 14px",
    background:tone === "danger" ? "#DC2626" : tone === "blue" ? "#EEF4FF" : "#FFFFFF",
    color:tone === "danger" ? "#FFFFFF" : tone === "blue" ? G.blue : G.text,
    fontSize:14.5,
    cursor:busy ? "not-allowed" : "pointer",
    fontFamily:G.sans,
    fontWeight:750,
    textAlign:"left",
    opacity:busy ? 0.7 : 1,
  });
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(14,31,24,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div style={{background:G.surface,borderRadius:18,padding:"26px 24px",width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{
          width:40,
          height:40,
          borderRadius:12,
          background:modalIntent==="archive" ? "#EAF2FF" : "#FEE2E2",
          color:modalIntent==="archive" ? G.blue : G.red,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          fontSize:20,
          marginBottom:14,
          fontWeight:900,
        }}>
          {modalIntent==="archive" ? "↪" : "🗑"}
        </div>
        <h3 style={{fontSize:18,fontWeight:700,color:G.text,fontFamily:G.display,marginBottom:8}}>{title}</h3>
        {lines.map((l,i)=>(
          <p key={i} style={{fontSize:15,color:i===0?G.textM:G.textL,fontFamily:G.sans,lineHeight:1.55,marginBottom:i<lines.length-1?6:16}}>{l}</p>
        ))}
        {hasOptions ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {options.map(option=>(
              <button key={option.label} onClick={option.onConfirm} disabled={busy} style={optionStyle(option.tone)}>
                <span style={{display:"block"}}>{option.label}</span>
                {option.hint&&<span style={{display:"block",fontSize:12,color:option.tone==="danger"?"rgba(255,255,255,0.82)":G.textM,fontWeight:600,marginTop:3,lineHeight:1.35}}>{option.hint}</span>}
              </button>
            ))}
            <button onClick={onClose} disabled={busy}
              style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:9,padding:"8px 18px",fontSize:15,cursor:"pointer",color:G.textM,fontFamily:G.sans,fontWeight:500,alignSelf:"flex-end"}}>
              Cancel
            </button>
          </div>
        ) : (
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} disabled={busy}
            style={{background:"none",border:`1.5px solid ${G.border}`,borderRadius:9,padding:"8px 18px",fontSize:15,cursor:"pointer",color:G.textM,fontFamily:G.sans,fontWeight:500}}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{background:busy?"#D5D5D5":"#DC2626",color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",fontSize:15,cursor:busy?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:600}}>
            {busy?"Deleting…":confirmLabel}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

export function AdminConfirmModal({ message, confirmLabel, onConfirm, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:650,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:18,padding:"26px 22px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <p style={{fontSize:16,color:"#374151",fontFamily:G.sans,marginBottom:24,lineHeight:1.6}}>{message}</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"none",border:"1.5px solid #E5E7EB",borderRadius:9,padding:"8px 18px",fontSize:14,cursor:"pointer",color:"#6B7280",fontFamily:G.sans}}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{background:"#1A2F5A",color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",fontSize:14,cursor:"pointer",fontFamily:G.sans,fontWeight:600}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
