import React from "react";

export function AdminExportModal({ exportActions, onClose }) {
  const [period, setPeriod] = React.useState("month");
  const [format, setFormat] = React.useState("csv");
  const [selActionIdx, setSelActionIdx] = React.useState(0);
  const [selMonth, setSelMonth] = React.useState(()=>{const now=new Date();return`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;});
  const [selWeek, setSelWeek] = React.useState(()=>{const now=new Date(),pad=value=>String(value).padStart(2,"0");return`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;});
  const [selDay, setSelDay] = React.useState(()=>{const now=new Date(),pad=value=>String(value).padStart(2,"0");return`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;});
  const [busy, setBusy] = React.useState(false);

  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

  function periodLabel(){
    if(period==="day") return selDay;
    if(period==="week"){
      const dayDate=new Date(selWeek),day=dayDate.getDay();
      const sunday=new Date(dayDate); sunday.setDate(dayDate.getDate()-day);
      const saturday=new Date(sunday); saturday.setDate(sunday.getDate()+6);
      const formatDate=value=>`${value.getDate()} ${MONTHS[value.getMonth()].slice(0,3)}`;
      return `${formatDate(sunday)} – ${formatDate(saturday)} ${saturday.getFullYear()}`;
    }
    const [year,month]=selMonth.split("-").map(Number);
    return `${MONTHS[month-1]} ${year}`;
  }

  function getDateRange(){
    if(period==="all") return {startKey:null, endKey:null};
    if(period==="day") return {startKey:selDay, endKey:selDay};
    if(period==="month"){
      const [year,month]=selMonth.split("-").map(Number);
      const start=`${year}-${String(month).padStart(2,"0")}-01`;
      const lastDay=new Date(year,month,0).getDate();
      const end=`${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      return {startKey:start, endKey:end};
    }
    if(period==="week"){
      const dayDate=new Date(selWeek), day=dayDate.getDay();
      const sunday=new Date(dayDate); sunday.setDate(dayDate.getDate()-day);
      const saturday=new Date(sunday); saturday.setDate(sunday.getDate()+6);
      const formatDate=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
      return {startKey:formatDate(sunday), endKey:formatDate(saturday)};
    }
    return {startKey:null, endKey:null};
  }

  function doExport(){
    if(!exportActions.length) return;
    setBusy(true);
    setTimeout(()=>{
      const action = exportActions[selActionIdx] || exportActions[0];
      const {startKey, endKey} = getDateRange();
      const rows = action.getRows(startKey, endKey);
      if(!rows.length){
        setBusy(false);
        onClose();
        alert("No entries found for the selected period.");
        return;
      }
      const label = period==="all" ? "All Time" : periodLabel();
      const filename = `${action.filename}_${label.replace(/[^a-zA-Z0-9]/g,"_")}`;
      if(format==="csv") action.triggerCSV(rows, filename);
      else if(format==="pdf") action.triggerPDF(rows, action.title, `${action.meta} · ${label}`);
      else action.triggerJSON(rows, filename, label);
      setBusy(false);
      onClose();
    },100);
  }

  const inputStyle={width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #DDE3ED",fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",background:"#F5F7FA",color:"#111827",boxSizing:"border-box"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
      <div style={{background:"#fff",borderRadius:22,width:"100%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{overflowY:"auto",flex:1,padding:"26px 22px 8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{width:46,height:46,borderRadius:13,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📤</div>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:"#111827",fontFamily:"'Poppins',sans-serif"}}>Export Entries</div>
              <div style={{fontSize:13,color:"#6B7280"}}>
                {exportActions.length>0 ? exportActions[selActionIdx]?.sub || exportActions[0].sub : "Select a view first"}
              </div>
            </div>
            <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9CA3AF",lineHeight:1,padding:4}}>✕</button>
          </div>

          {exportActions.length===0 ? (
            <div style={{textAlign:"center",padding:"20px 0",color:"#9CA3AF",fontSize:14,fontFamily:"'Inter',sans-serif"}}>
              Select an institute, teacher, or class first to export.
            </div>
          ) : (<>
            {exportActions.length>1&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Scope</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {exportActions.map((action,index)=>{
                    const selected=selActionIdx===index;
                    return(
                      <div key={index} onClick={()=>setSelActionIdx(index)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${selected?"#1A2F5A":"#DDE3ED"}`,background:selected?"#EEF2FF":"transparent",cursor:"pointer",transition:"all 0.15s"}}>
                        <span style={{fontSize:18}}>{action.icon}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:"#111827",fontFamily:"'Inter',sans-serif"}}>{action.label}</div>
                          <div style={{fontSize:12,color:"#6B7280",fontFamily:"'Inter',sans-serif"}}>{action.sub}</div>
                        </div>
                        {selected&&<span style={{marginLeft:"auto",fontSize:11,background:"#1A2F5A",color:"#fff",borderRadius:20,padding:"2px 8px",fontFamily:"'Inter',sans-serif",fontWeight:600}}>Selected</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Period</div>
              <div style={{display:"flex",gap:6}}>
                {[["day","Daily"],["week","Weekly"],["month","Monthly"],["all","All Time"]].map(([key,label])=>(
                  <button key={key} onClick={()=>setPeriod(key)}
                    style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:period===key?700:500,
                      background:period===key?"#1A2F5A":"rgba(0,0,0,0.06)",color:period===key?"#fff":"#374151",transition:"all 0.15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {period!=="all"&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                  {period==="day"?"Date":period==="week"?"Any day in the week":"Month"}
                </div>
                {period==="month"&&<input type="month" value={selMonth} onChange={event=>setSelMonth(event.target.value)} style={inputStyle}/>}
                {period==="week"&&<input type="date" value={selWeek} onChange={event=>setSelWeek(event.target.value)} style={inputStyle}/>}
                {period==="day"&&<input type="date" value={selDay} onChange={event=>setSelDay(event.target.value)} style={inputStyle}/>}
              </div>
            )}

            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Format</div>
              <div style={{display:"flex",gap:8}}>
                {[["csv","📊 CSV / Excel"],["pdf","📄 PDF"]].map(([key,label])=>(
                  <button key={key} onClick={()=>setFormat(key)}
                    style={{flex:1,padding:"12px 0",borderRadius:12,border:`2px solid ${format===key?"#1A2F5A":"#DDE3ED"}`,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:format===key?700:500,
                      background:format===key?"#EEF2FF":"transparent",color:format===key?"#1A2F5A":"#374151",transition:"all 0.15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{background:"#F5F7FA",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#374151",fontFamily:"'Inter',sans-serif"}}>
              📅 <strong>{period==="all"?"All time":periodLabel()}</strong> · {format==="pdf"?"Opens print dialog":"Downloads .csv file"}
            </div>
          </>)}
        </div>

        <div style={{flexShrink:0,padding:"12px 22px 20px",borderTop:"1px solid #F3F4F6",display:"flex",gap:10,background:"#fff"}}>
          <button onClick={onClose}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E5E7EB",background:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",color:"#374151",fontFamily:"'Inter',sans-serif"}}>
            Cancel
          </button>
          <button onClick={doExport} disabled={busy||exportActions.length===0}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:(busy||exportActions.length===0)?"#D5D5D5":"#1A2F5A",fontSize:15,fontWeight:700,cursor:(busy||exportActions.length===0)?"not-allowed":"pointer",color:"#fff",fontFamily:"'Inter',sans-serif",opacity:busy?0.7:1}}>
            {busy?"Preparing…":"Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
