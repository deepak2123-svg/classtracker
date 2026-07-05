import { G } from "../../styles/adminTheme.js";

export function PeriodSelector({
  period,
  onChangePeriod,
  compact = false,
  accentColor = null,
  rangeStart = "",
  rangeEnd = "",
  onChangeRangeStart = ()=>{},
  onChangeRangeEnd = ()=>{},
}) {
  const accent = accentColor || G.navy;
  const quickPills=[["today","Today"],["yesterday","Yesterday"],["week","This Week"],["month","This Month"],["range","Range"]];
  const rangeActive=period==="range";
  const dateInputStyle={
    width:"100%",
    padding:compact?"8px 10px":"9px 11px",
    borderRadius:10,
    border:`1.5px solid ${rangeActive?accent:G.borderM}`,
    background:"#FFFFFF",
    color:G.textS,
    fontSize:compact?12.5:13,
    fontFamily:G.sans,
    boxSizing:"border-box",
    outline:"none",
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:compact?8:10}}>
      <div style={{display:"flex",gap:compact?4:6,flexWrap:"wrap"}}>
        {quickPills.map(([key,label])=>{
          const selected=period===key;
          return(
            <button key={key} onClick={()=>onChangePeriod(key)}
              style={{
                padding:compact?"6px 10px":"7px 14px",
                borderRadius:12,
                fontSize:compact?12:13,
                cursor:"pointer",
                fontFamily:G.sans,
                fontWeight:selected?700:600,
                background:selected?accent:"transparent",
                color:selected?"#fff":G.textS,
                border:`1.5px solid ${selected?accent:G.borderM}`,
                whiteSpace:"nowrap",
                transition:"all 0.14s",
                WebkitTapHighlightColor:"transparent",
              }}>
              {label}
            </button>
          );
        })}
      </div>
      {rangeActive&&(
        <div style={{display:"grid",gridTemplateColumns:compact?"1fr":"repeat(2,minmax(0,1fr))",gap:compact?8:10}}>
          <div>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginBottom:6,textTransform:"uppercase",letterSpacing:0.45}}>From</div>
            <input type="date" value={rangeStart||""} max={rangeEnd||undefined} onChange={event=>onChangeRangeStart(event.target.value)} style={dateInputStyle}/>
          </div>
          <div>
            <div style={{fontSize:11,color:G.textL,fontFamily:G.mono,marginBottom:6,textTransform:"uppercase",letterSpacing:0.45}}>To</div>
            <input type="date" value={rangeEnd||""} min={rangeStart||undefined} onChange={event=>onChangeRangeEnd(event.target.value)} style={dateInputStyle}/>
          </div>
        </div>
      )}
    </div>
  );
}
