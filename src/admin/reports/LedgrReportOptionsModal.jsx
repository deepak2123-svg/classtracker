import React from "react";
import { createPortal } from "react-dom";
import {
  IconCalendar,
  IconClock,
  IconDownload,
  IconFileText,
  IconPhoto,
} from "@tabler/icons-react";
import { todayKey } from "../../shared.jsx";
import { AppIcon } from "../components/common/AppIcon.jsx";
import { G } from "../styles/adminTheme.js";
import { addDaysToDateKey, currentMonthKey, monthBoundsFromKey } from "../utils/adminDates.js";
import { sameInstituteName } from "../utils/adminText.js";
export function LedgrReportOptionsModal({
  institutes,
  period,
  month,
  rangeStart,
  rangeEnd,
  schedule,
  scheduleLoading,
  scheduleSaving,
  exportDisabled,
  busyFormat,
  initialMode = "export",
  context = "report",
  onClose,
  onApply,
  onSaveSchedule,
}) {
  const hobbyBatchTime = "20:00";
  const hobbyBatchTimezone = "Asia/Kolkata";
  const isMessengerSchedule = context === "messenger";
  const [actionMode, setActionMode] = React.useState(isMessengerSchedule || initialMode === "schedule" ? "schedule" : "export");
  const [draftPeriod, setDraftPeriod] = React.useState(period || "daily");
  const [draftMonth, setDraftMonth] = React.useState(month || currentMonthKey());
  const [draftRangeStart, setDraftRangeStart] = React.useState(rangeStart || addDaysToDateKey(todayKey(), -6));
  const [draftRangeEnd, setDraftRangeEnd] = React.useState(rangeEnd || todayKey());
  const [scope, setScope] = React.useState("all");
  const [selectedInstitutes, setSelectedInstitutes] = React.useState(() => [...(institutes || [])]);
  const [format, setFormat] = React.useState("pdf");
  const [scheduleEnabled, setScheduleEnabled] = React.useState(schedule?.enabled !== false);
  const [scheduleTimes, setScheduleTimes] = React.useState(() => schedule?.times?.length ? [...schedule.times] : [hobbyBatchTime]);
  const [scheduleTimezone, setScheduleTimezone] = React.useState(schedule?.timezone || hobbyBatchTimezone);
  const busy = actionMode === "schedule" ? !!scheduleSaving : !!busyFormat;
  const allInstitutes = institutes || [];

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  React.useEffect(() => {
    if(!schedule) return;
    setScheduleEnabled(schedule.enabled !== false);
    setScheduleTimes(schedule.times?.length ? [...schedule.times] : [hobbyBatchTime]);
    setScheduleTimezone(schedule.timezone || hobbyBatchTimezone);
  }, [hobbyBatchTime, hobbyBatchTimezone, schedule?.updatedAt]);

  React.useEffect(() => {
    setActionMode(isMessengerSchedule || initialMode === "schedule" ? "schedule" : "export");
  }, [initialMode, isMessengerSchedule]);

  const inputStyle = {
    width:"100%",
    height:46,
    borderRadius:12,
    border:"1px solid #DDE3ED",
    background:"#F8FAFC",
    color:"#111827",
    fontSize:15,
    fontWeight:700,
    fontFamily:G.sans,
    padding:"0 12px",
    boxSizing:"border-box",
    outline:"none",
  };
  const sectionLabel = {
    fontSize:12,
    fontWeight:800,
    color:"#374151",
    textTransform:"uppercase",
    letterSpacing:0.7,
    marginBottom:9,
    fontFamily:G.mono,
  };
  const periodOptions = [
    ["daily", "Daily"],
    ["yesterday", "Yesterday"],
    ["weekly", "Weekly"],
    ["monthly", "Monthly"],
    ["range", "Range"],
  ];
  const formatOptions = [
    { key:"pdf", label:"PDF report", icon:IconFileText, help:"Opens executive PDF" },
    { key:"png", label:"PNG summary", icon:IconPhoto, help:"Downloads summary image" },
    { key:"zip", label:"Centre PDFs ZIP", icon:IconDownload, help:"Downloads one ZIP of pixel-matched institute PDFs" },
  ];
  const modalTitle = isMessengerSchedule ? "Messenger batch" : "Ledgr Report";
  const modalSubtitle = actionMode === "schedule"
    ? isMessengerSchedule
      ? "Review the once-daily 8 PM Telegram batch"
      : "Review the once-daily 8 PM batch"
    : "Choose period and output";
  const effectiveInstitutes = scope === "all" ? allInstitutes : selectedInstitutes;
  const scopeLabel = scope === "all"
    ? "All institutes"
    : `${selectedInstitutes.length} institute${selectedInstitutes.length === 1 ? "" : "s"} selected`;
  const rangeLabel = draftPeriod === "monthly"
    ? actionMode === "schedule"
      ? "Current month"
      : new Date(`${monthBoundsFromKey(draftMonth).startKey}T00:00:00`).toLocaleDateString("en-IN", { month:"long", year:"numeric" })
    : draftPeriod === "range"
      ? `${draftRangeStart || "Start"} to ${draftRangeEnd || "End"}`
      : draftPeriod === "yesterday"
        ? "Yesterday"
      : draftPeriod === "weekly"
        ? "Last 7 days"
        : "Today";
  const scheduleLastRunAt = Number(schedule?.execution?.lastRunAt || schedule?.lastRunAt || 0);
  const actionDisabled = busy
    || effectiveInstitutes.length === 0
    || (actionMode === "export" && exportDisabled);

  React.useEffect(() => {
    if(actionMode !== "schedule") return;
    setFormat("pdf");
    if(!schedule) return;
    const savedReport = schedule.report || {};
    setDraftPeriod(savedReport.period || "daily");
    setDraftMonth(savedReport.month || currentMonthKey());
    setDraftRangeStart(savedReport.rangeStart || addDaysToDateKey(todayKey(), -6));
    setDraftRangeEnd(savedReport.rangeEnd || todayKey());
    const savedScope = schedule.scope?.type === "selected" ? "selected" : "all";
    setScope(savedScope);
    setSelectedInstitutes(savedScope === "selected"
      ? (schedule.scope?.institutes || []).filter(saved => allInstitutes.some(institute => sameInstituteName(saved, institute)))
      : [...allInstitutes]);
  }, [actionMode, allInstitutes, schedule]);

  const selectActionMode = (nextMode) => {
    if(busy || nextMode === actionMode) return;
    setActionMode(nextMode);
  };

  const apply = () => {
    const safeStart = draftRangeStart && draftRangeEnd && draftRangeStart > draftRangeEnd ? draftRangeEnd : draftRangeStart;
    const safeEnd = draftRangeStart && draftRangeEnd && draftRangeStart > draftRangeEnd ? draftRangeStart : draftRangeEnd;
    const reportConfig = {
      period:draftPeriod,
      month:draftMonth || currentMonthKey(),
      rangeStart:safeStart || todayKey(),
      rangeEnd:safeEnd || todayKey(),
    };
    if(actionMode === "schedule"){
      onSaveSchedule({
        enabled:scheduleEnabled,
        times:[hobbyBatchTime],
        timezone:hobbyBatchTimezone,
        report:reportConfig,
        scope:{
          type:scope,
          institutes:scope === "selected" ? effectiveInstitutes : [],
        },
        output:{ format:"pdf" },
      });
      return;
    }
    onApply({ ...reportConfig, format, selectedInstitutes:effectiveInstitutes });
  };

  const modal = (
    <div className="ledgr-report-modal-overlay" style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.58)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",overflow:"hidden"}}>
      <style>{`
        .ledgr-report-modal-overlay {
          height: 100vh;
          height: 100dvh;
          box-sizing: border-box;
        }
        .ledgr-report-modal {
          max-height: calc(100dvh - 32px);
        }
        .ledgr-report-modal-scroll {
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 600px) {
          .ledgr-report-modal-overlay {
            padding: max(8px, env(safe-area-inset-top, 0px)) 8px max(8px, env(safe-area-inset-bottom, 0px)) !important;
          }
          .ledgr-report-modal {
            max-height: calc(100dvh - 16px) !important;
            border-radius: 20px !important;
          }
          .ledgr-report-modal-scroll {
            padding: 20px 16px 10px !important;
          }
          .ledgr-report-modal-footer {
            padding: 12px 16px max(14px, env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
      <div className="ledgr-report-modal" style={{background:"#FFFFFF",borderRadius:24,width:"100%",maxWidth:520,boxShadow:"0 28px 80px rgba(15,23,42,0.28)",maxHeight:"calc(100dvh - 32px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div className="ledgr-report-modal-scroll" style={{overflowY:"auto",minHeight:0,flex:1,padding:"26px 24px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:52,height:52,borderRadius:16,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <AppIcon icon={actionMode === "schedule" ? IconClock : IconCalendar} size={26} color={G.blue} />
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:22,fontWeight:800,color:"#111827",fontFamily:G.display,lineHeight:1.1}}>{modalTitle}</div>
              <div style={{fontSize:15,color:"#6B7280",fontFamily:G.sans,lineHeight:1.45,marginTop:4}}>{modalSubtitle}</div>
              <div style={{fontSize:12.5,color:G.blue,fontFamily:G.sans,fontWeight:800,lineHeight:1.4,marginTop:5}}>Institutes: {scopeLabel}</div>
            </div>
            <button type="button" onClick={onClose} disabled={busy} style={{marginLeft:"auto",border:"none",background:"transparent",color:"#9CA3AF",fontSize:28,lineHeight:1,cursor:busy?"not-allowed":"pointer",padding:2}}>×</button>
          </div>

          {!isMessengerSchedule && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:20,padding:5,borderRadius:15,background:"#F1F5F9"}}>
              {[
                ["export", "Export now", IconDownload],
                ["schedule", "Schedule", IconClock],
              ].map(([key, label, icon]) => {
                const active = actionMode === key;
                return (
                  <button key={key} type="button" onClick={()=>selectActionMode(key)} disabled={busy} style={{
                    height:42,
                    border:"none",
                    borderRadius:11,
                    background:active ? "#FFFFFF" : "transparent",
                    boxShadow:active ? G.shadowSm : "none",
                    color:active ? G.navy : G.textM,
                    display:"inline-flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:7,
                    fontSize:13.5,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    <AppIcon icon={icon} size={17} color={active ? G.blue : G.textL} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Period</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(96px,1fr))",gap:8}}>
              {periodOptions.map(([key, label]) => {
                const active = draftPeriod === key;
                return (
                  <button key={key} type="button" onClick={()=>setDraftPeriod(key)} disabled={busy} style={{
                    minHeight:42,
                    border:"none",
                    borderRadius:13,
                    background:active ? G.navy : "rgba(15,23,42,0.07)",
                    color:active ? "#FFFFFF" : "#374151",
                    fontSize:14,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Institutes</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              {[
                ["all", "All institutes"],
                ["selected", "Select institutes"],
              ].map(([key, label]) => {
                const active = scope === key;
                return (
                  <button key={key} type="button" onClick={()=>setScope(key)} disabled={busy} style={{
                    minHeight:42,
                    border:`2px solid ${active ? G.navy : "#DDE3ED"}`,
                    borderRadius:13,
                    background:active ? "#EEF2FF" : "#FFFFFF",
                    color:active ? G.navy : "#374151",
                    fontSize:13.5,
                    fontWeight:800,
                    fontFamily:G.sans,
                    cursor:busy ? "not-allowed" : "pointer",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {scope === "selected" && (
              <div style={{marginTop:10,border:"1px solid #DDE3ED",borderRadius:14,background:"#F8FAFC",padding:"6px",maxHeight:190,overflowY:"auto"}}>
                <div style={{display:"flex",justifyContent:"flex-end",gap:6,padding:"3px 4px 7px"}}>
                  <button type="button" onClick={()=>setSelectedInstitutes([...allInstitutes])} disabled={busy} style={{border:"none",background:"transparent",color:G.blue,fontSize:11.5,fontWeight:800,fontFamily:G.sans,cursor:"pointer",padding:"3px 5px"}}>Select all</button>
                  <button type="button" onClick={()=>setSelectedInstitutes([])} disabled={busy} style={{border:"none",background:"transparent",color:G.textM,fontSize:11.5,fontWeight:800,fontFamily:G.sans,cursor:"pointer",padding:"3px 5px"}}>Clear</button>
                </div>
                {allInstitutes.map(institute => {
                  const checked = selectedInstitutes.some(item => sameInstituteName(item, institute));
                  return (
                    <label key={institute} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 10px",borderRadius:10,cursor:busy?"not-allowed":"pointer",background:checked?"#EEF4FF":"transparent",fontFamily:G.sans}}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => setSelectedInstitutes(current => checked
                          ? current.filter(item => !sameInstituteName(item, institute))
                          : [...current, institute])}
                        style={{width:17,height:17,marginTop:1,accentColor:G.navy,flexShrink:0}}
                      />
                      <span style={{fontSize:13,fontWeight:checked?800:600,color:G.text,lineHeight:1.35}}>{institute}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {draftPeriod === "monthly" && actionMode === "export" && (
            <div style={{marginBottom:20}}>
              <div style={sectionLabel}>Month</div>
              <input type="month" value={draftMonth} onChange={event=>setDraftMonth(event.target.value || currentMonthKey())} disabled={busy} style={inputStyle} />
            </div>
          )}
          {draftPeriod === "monthly" && actionMode === "schedule" && (
            <div style={{marginBottom:20,background:"#F8FAFC",border:"1px solid #DDE3ED",borderRadius:13,padding:"11px 13px",fontSize:12.5,color:G.textM,lineHeight:1.5}}>
              Each scheduled run uses the current calendar month.
            </div>
          )}

          {draftPeriod === "range" && (
            <div style={{marginBottom:20}}>
              <div style={sectionLabel}>Date Range</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                <input type="date" value={draftRangeStart} max={draftRangeEnd || undefined} onChange={event=>setDraftRangeStart(event.target.value || todayKey())} disabled={busy} style={inputStyle} />
                <input type="date" value={draftRangeEnd} min={draftRangeStart || undefined} onChange={event=>setDraftRangeEnd(event.target.value || todayKey())} disabled={busy} style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={sectionLabel}>Format</div>
            <div style={{display:"grid",gridTemplateColumns:actionMode === "schedule" ? "1fr" : "repeat(2,minmax(0,1fr))",gap:10}}>
              {formatOptions.filter(item => actionMode === "export" || item.key === "pdf").map(item => {
                const active = format === item.key;
                const disabled = busy || (actionMode === "export" && exportDisabled);
                return (
                  <button key={item.key} type="button" onClick={()=>setFormat(item.key)} disabled={disabled} style={{
                    minHeight:72,
                    border:`2px solid ${active ? G.navy : "#DDE3ED"}`,
                    borderRadius:16,
                    background:active ? "#EEF2FF" : "#FFFFFF",
                    color:disabled ? "#9CA3AF" : active ? G.navy : "#374151",
                    cursor:disabled ? "not-allowed" : "pointer",
                    padding:"12px 12px",
                    display:"flex",
                    alignItems:"center",
                    gap:10,
                    textAlign:"left",
                    fontFamily:G.sans,
                  }}>
                    <AppIcon icon={item.icon} size={22} color={disabled ? "#9CA3AF" : active ? G.navy : "#6B7280"} />
                    <span style={{minWidth:0}}>
                      <span style={{display:"block",fontSize:15,fontWeight:800,lineHeight:1.2}}>{item.label}</span>
                      <span style={{display:"block",fontSize:11.5,fontWeight:600,color:disabled ? "#A1A1AA" : "#6B7280",lineHeight:1.3,marginTop:3}}>{item.help}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {actionMode === "schedule" && (
              <div style={{fontSize:11.5,color:G.textL,lineHeight:1.45,marginTop:8}}>
                {isMessengerSchedule
                  ? "The messenger batch sends one exact PDF per active Telegram mapping at 8 PM."
                  : "The scheduler sends one PDF batch per day for the selected institutes."}
              </div>
            )}
          </div>

          {actionMode === "schedule" && (
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10}}>
                <div style={{...sectionLabel,marginBottom:0}}>Daily Batch</div>
                <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:800,color:scheduleEnabled?G.blue:G.textM,fontFamily:G.sans,cursor:busy?"not-allowed":"pointer"}}>
                  <input type="checkbox" checked={scheduleEnabled} onChange={event=>setScheduleEnabled(event.target.checked)} disabled={busy} style={{width:17,height:17,accentColor:G.blue}} />
                  {scheduleEnabled ? "Active" : "Paused"}
                </label>
              </div>
              <div style={{border:"1px solid #DDE3ED",borderRadius:14,background:"#F8FAFC",padding:"12px 13px"}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,borderRadius:999,background:"#EEF2FF",color:G.blue,padding:"7px 12px",fontSize:12.5,fontWeight:800,fontFamily:G.sans}}>
                  <AppIcon icon={IconClock} size={15} color={G.blue} />
                  Around 8:00 PM daily
                </div>
                <div style={{fontSize:12,color:G.textM,lineHeight:1.55,marginTop:10}}>
                  {isMessengerSchedule
                    ? "The saved 8 PM batch sends one exact Ledgr PDF to every active Telegram recipient that matches the schedule scope."
                    : "Vercel Hobby runs this once during the 8 PM hour, then the batch sends one exact Ledgr PDF per active institute route."}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:7,fontSize:11.5,color:G.textL,lineHeight:1.45,marginTop:9}}>
                <AppIcon icon={IconClock} size={15} color={G.textL} />
                Timezone: <strong style={{color:G.textM}}>{scheduleTimezone}</strong>
              </div>
              <div style={{marginTop:10,border:`1px solid ${scheduleLastRunAt ? "#BBF7D0" : "#FDE68A"}`,borderRadius:12,background:scheduleLastRunAt ? "#F0FDF4" : "#FFFBEB",padding:"10px 12px",fontSize:11.5,color:scheduleLastRunAt ? "#166534" : "#92400E",lineHeight:1.5}}>
                {scheduleLoading
                  ? "Loading the saved schedule..."
                  : scheduleLastRunAt
                    ? `Background runner connected. Last generated ${new Date(scheduleLastRunAt).toLocaleString("en-IN")}.`
                    : isMessengerSchedule
                      ? "This saves the once-daily 8 PM Telegram batch. Background sending begins after the scheduler runner is connected."
                      : "This saves the once-daily 8 PM batch. Background generation begins after the admin deployment is live."}
              </div>
            </div>
          )}

          <div style={{background:"#F8FAFC",borderRadius:14,padding:"12px 14px",fontSize:14,color:"#374151",fontFamily:G.sans,lineHeight:1.35}}>
            <AppIcon icon={actionMode === "schedule" ? IconClock : IconCalendar} size={16} color={G.blue} style={{display:"inline-flex",verticalAlign:"-3px",marginRight:7}} />
            <strong>{scopeLabel}</strong> · {rangeLabel} · {actionMode === "schedule"
              ? (scheduleEnabled
                ? (isMessengerSchedule ? "Telegram batch around 8 PM" : "Daily batch around 8 PM")
                : "Schedule paused")
              : format === "pdf" ? "opens print dialog" : format === "png" ? "downloads image" : "downloads centre ZIP"}
          </div>
        </div>

        <div className="ledgr-report-modal-footer" style={{flexShrink:0,padding:"14px 24px 22px",borderTop:"1px solid #F1F5F9",display:"flex",gap:12,background:"#FFFFFF"}}>
          <button type="button" onClick={onClose} disabled={busy} style={{flex:1,height:50,borderRadius:14,border:"1.5px solid #E5E7EB",background:"#FFFFFF",color:"#374151",fontSize:15,fontWeight:800,fontFamily:G.sans,cursor:busy?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={actionDisabled} style={{flex:1,height:50,borderRadius:14,border:"none",background:actionDisabled ? "#CBD5E1" : G.navy,color:"#FFFFFF",fontSize:15,fontWeight:900,fontFamily:G.sans,cursor:actionDisabled ? "not-allowed" : "pointer"}}>
            {busy ? (actionMode === "schedule" ? "Saving..." : "Preparing...") : actionMode === "schedule" ? "Save schedule" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : modal;
}

