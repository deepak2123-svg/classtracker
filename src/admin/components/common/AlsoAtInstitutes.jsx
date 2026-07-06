import React from "react";
import { G } from "../../styles/adminTheme.js";

export function AlsoAtInstitutes({ institutes = [], maxVisible = 2 }){
  const cleaned = [...new Set((institutes || []).map(inst => String(inst || "").trim()).filter(Boolean))];
  if(!cleaned.length) return null;
  const visible = cleaned.slice(0, maxVisible);
  const remaining = cleaned.length - visible.length;
  const hiddenLabel = cleaned.slice(maxVisible).join(", ");
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8,alignItems:"center"}}>
      <span style={{fontSize:11,color:G.textL,fontFamily:G.mono,textTransform:"uppercase",letterSpacing:0.8}}>
        Also at
      </span>
      {visible.map(inst=>(
        <span
          key={inst}
          title={inst}
          style={{
            display:"inline-flex",
            alignItems:"center",
            maxWidth:"100%",
            background:G.bg,
            border:`1px solid ${G.border}`,
            borderRadius:999,
            padding:"4px 10px",
            fontSize:12,
            lineHeight:1.35,
            color:G.textM,
            fontFamily:G.sans,
            fontWeight:600,
            minWidth:0,
            overflow:"hidden",
            textOverflow:"ellipsis",
            whiteSpace:"nowrap",
          }}>
          {inst}
        </span>
      ))}
      {remaining>0&&(
        <span
          title={hiddenLabel}
          style={{
            display:"inline-flex",
            alignItems:"center",
            background:"#EEF4FF",
            border:"1px solid #C7D7F5",
            borderRadius:999,
            padding:"4px 10px",
            fontSize:12,
            lineHeight:1.35,
            color:G.blue,
            fontFamily:G.sans,
            fontWeight:700,
          }}>
          +{remaining} more
        </span>
      )}
    </div>
  );
}
