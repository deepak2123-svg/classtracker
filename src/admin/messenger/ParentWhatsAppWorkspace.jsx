import React from "react";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconCopy,
  IconFileText,
  IconLink,
  IconMessageCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconQrcode,
  IconRefresh,
  IconSend,
  IconShieldCheck,
  IconUpload,
  IconUserPlus,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { auth } from "../../firebase";

const COLORS = {
  ink: "#102820",
  text: "#29473B",
  muted: "#6B8076",
  line: "#DCE7E1",
  soft: "#F3F7F5",
  green: "#0F766E",
  greenSoft: "#E7F7F1",
  blue: "#2563EB",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  red: "#B42318",
  redSoft: "#FEE4E2",
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const card = {
  border: `1px solid ${COLORS.line}`,
  borderRadius: 18,
  background: "#FFFFFF",
  boxShadow: "0 8px 24px rgba(16,40,32,0.05)",
};

const button = (primary = false, danger = false) => ({
  minHeight: 40,
  borderRadius: 10,
  border: primary ? "1px solid transparent" : `1px solid ${danger ? "#F2B8B5" : COLORS.line}`,
  background: primary ? COLORS.ink : danger ? "#FFFFFF" : "#FFFFFF",
  color: primary ? "#FFFFFF" : danger ? COLORS.red : COLORS.text,
  padding: "0 13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontSize: 12.5,
  fontWeight: 850,
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
});

const input = {
  width: "100%",
  minHeight: 42,
  borderRadius: 10,
  border: `1px solid ${COLORS.line}`,
  background: "#FFFFFF",
  color: COLORS.ink,
  padding: "9px 11px",
  fontSize: 13,
  fontFamily: "Inter, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

function Badge({ tone = "neutral", children }) {
  const tones = {
    good: ["#DCFCE7", "#166534"],
    warn: [COLORS.amberSoft, COLORS.amber],
    bad: [COLORS.redSoft, COLORS.red],
    info: ["#EAF1FF", COLORS.blue],
    neutral: [COLORS.soft, COLORS.muted],
  };
  const [background, color] = tones[tone] || tones.neutral;
  return (
    <span style={{display:"inline-flex",alignItems:"center",minHeight:25,padding:"3px 9px",borderRadius:999,background,color,fontSize:11.5,fontWeight:850,whiteSpace:"nowrap"}}>
      {children}
    </span>
  );
}

function Field({ label, children, hint = "" }) {
  return (
    <label style={{display:"grid",gap:6,minWidth:0}}>
      <span style={{fontSize:11,fontWeight:850,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.7}}>{label}</span>
      {children}
      {hint&&<span style={{fontSize:11.5,color:COLORS.muted,lineHeight:1.45}}>{hint}</span>}
    </label>
  );
}

function formatWhen(value) {
  const number = Number(value || 0);
  return number ? new Date(number).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" }) : "Not yet";
}

function indiaTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Kolkata",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).format(new Date());
}

function nextGlobalRunLabel(enabled, timeKey) {
  if(!enabled) return "Automatic schedule is off";
  const [hour, minute] = String(timeKey || "20:00").split(":").map(Number);
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Kolkata",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
  }).formatToParts(now).reduce((result, part) => ({...result,[part.type]:part.value}), {});
  const localMinutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  const dayOffset = localMinutes < hour * 60 + minute ? 0 : 1;
  const baseUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset);
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone:"UTC",
    day:"numeric",
    month:"short",
  }).format(new Date(baseUtc));
  return `Next coordinator: ${dateLabel}, ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} IST`;
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = String(source || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return { rows: [], error: "Add a header row and at least one parent." };
  const headers = rows[0].map(value => value.trim().toLowerCase());
  const required = ["parent_name", "student_name", "phone"];
  const missing = required.filter(key => !headers.includes(key));
  if (missing.length) return { rows: [], error: `Missing CSV column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` };
  const seen = new Set();
  let duplicateCount = 0;
  const parsed = rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] || ""]));
    const item = {
      rowNumber: index + 2,
      parentName: record.parent_name,
      childName: record.student_name,
      phone: record.phone,
      relationship: record.relationship || "Guardian",
    };
    item.valid = !!item.parentName && !!item.childName && !!item.phone;
    const key = `${String(item.phone).replace(/\D/g, "")}::${item.childName.trim().toLowerCase()}`;
    if (seen.has(key)) {
      item.duplicate = true;
      duplicateCount += 1;
    }
    seen.add(key);
    return item;
  });
  return {
    rows: parsed.filter(item => !item.duplicate),
    error: "",
    duplicateCount,
    invalidCount: parsed.filter(item => !item.valid).length,
  };
}

async function parentApi(action = "", payload = {}, method = "POST") {
  const currentUser = auth.currentUser;
  if(!currentUser) throw new Error("Sign in again to use Parent WhatsApp.");
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/parent-whatsapp-admin", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify({ action, ...payload }) : undefined,
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if(!contentType.includes("application/json")){
    throw new Error("This deployment is not serving the Parent WhatsApp API.");
  }
  const result = await response.json();
  if(!response.ok) {
    const error = new Error(result?.error || "Parent WhatsApp request failed.");
    error.code = result?.code || "";
    error.subscriptionId = result?.subscriptionId || "";
    throw error;
  }
  return result;
}

export function ParentWhatsAppWorkspace({ initialState = null } = {}) {
  const initialSections = (initialState?.dashboard?.institutes || []).flatMap(institute => institute.sections || []);
  const [dashboard, setDashboard] = React.useState(initialState?.dashboard || null);
  const [health, setHealth] = React.useState(initialState?.health || null);
  const [loading, setLoading] = React.useState(!initialState);
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState(null);
  const [selectedSectionId, setSelectedSectionId] = React.useState(initialSections[0]?.id || "");
  const [sectionDraft, setSectionDraft] = React.useState(null);
  const [panel, setPanel] = React.useState("preview");
  const [preview, setPreview] = React.useState(initialState?.report || null);
  const [skipDate, setSkipDate] = React.useState("");
  const [contact, setContact] = React.useState({parentName:"",childName:"",relationship:"Guardian",phone:"",consentConfirmed:false});
  const [csvText, setCsvText] = React.useState("");
  const [csvPrepared, setCsvPrepared] = React.useState(null);
  const [csvConsent, setCsvConsent] = React.useState(false);
  const [testPhone, setTestPhone] = React.useState("");
  const [invite, setInvite] = React.useState(null);
  const [joinEdits, setJoinEdits] = React.useState({});
  const [selectedMoves, setSelectedMoves] = React.useState([]);
  const [moveTarget, setMoveTarget] = React.useState("");
  const [globalDraft, setGlobalDraft] = React.useState({
    enabled:initialState?.dashboard?.config?.enabled === true,
    timeKey:initialState?.dashboard?.config?.timeKey || "20:00",
  });

  const showNotice = React.useCallback((message, tone = "good") => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(current => current?.message === message ? null : current), 5000);
  }, []);

  const loadDashboard = React.useCallback(async (quiet = false) => {
    if(initialState){
      setDashboard(initialState.dashboard);
      setHealth(initialState.health);
      setLoading(false);
      return;
    }
    if(!quiet) setLoading(true);
    try {
      const result = await parentApi("", {}, "GET");
      setDashboard(result.dashboard);
      setHealth(result.health);
      setGlobalDraft({
        enabled: result.dashboard?.config?.enabled === true,
        timeKey: result.dashboard?.config?.timeKey || "20:00",
      });
      const sections = (result.dashboard?.institutes || []).flatMap(institute => institute.sections || []);
      setSelectedSectionId(current => sections.some(section => section.id === current) ? current : sections[0]?.id || "");
    } catch(error) {
      showNotice(error?.message || "Could not load Parent WhatsApp.", "bad");
    } finally {
      setLoading(false);
    }
  }, [initialState, showNotice]);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const sections = React.useMemo(
    () => (dashboard?.institutes || []).flatMap(institute => (institute.sections || []).map(section => ({...section, institute}))),
    [dashboard],
  );
  const selectedSection = sections.find(section => section.id === selectedSectionId) || null;

  React.useEffect(() => {
    if(!selectedSection) {
      setSectionDraft(null);
      return;
    }
    setSectionDraft({
      sectionPlanId: selectedSection.id,
      instituteId: selectedSection.instituteId,
      sectionLabel: selectedSection.sectionLabel,
      sectionKey: selectedSection.sectionKey,
      enabled: selectedSection.enabled === true,
      status: selectedSection.status || "active",
      weekdays: Array.isArray(selectedSection.weekdays) ? selectedSection.weekdays : [1,2,3,4,5,6],
      skipDates: Array.isArray(selectedSection.skipDates) ? selectedSection.skipDates : [],
    });
    setPreview(initialState?.report || null);
    setInvite(null);
    setSelectedMoves([]);
    setMoveTarget("");
  }, [initialState?.report, selectedSectionId, selectedSection?.updatedAt]);

  const sectionSubscriptions = (dashboard?.subscriptions || []).filter(item => item.sectionPlanId === selectedSectionId);
  const contactById = new Map((dashboard?.contacts || []).map(item => [item.id, item]));
  const sectionParents = sectionSubscriptions.map(subscription => ({
    ...subscription,
    contact: contactById.get(subscription.contactId) || {},
  }));
  const pendingJoins = (dashboard?.joinRequests || []).filter(item => item.sectionPlanId === selectedSectionId);
  const history = (dashboard?.deliveries || []).filter(item => item.sectionPlanId === selectedSectionId);

  const runAction = async (key, action, payload = {}, success = "", refresh = true) => {
    if(busy) return null;
    setBusy(key);
    try {
      const result = await parentApi(action, payload);
      if(success) showNotice(success);
      if(refresh) await loadDashboard(true);
      return result;
    } catch(error) {
      showNotice(error?.message || "Parent WhatsApp action failed.", "bad");
      return null;
    } finally {
      setBusy("");
    }
  };

  const saveSection = async enabledOverride => {
    if(!sectionDraft) return null;
    return runAction(
      "save_section",
      "save_section",
      { section: {...sectionDraft, enabled: typeof enabledOverride === "boolean" ? enabledOverride : sectionDraft.enabled} },
      typeof enabledOverride === "boolean"
        ? enabledOverride ? "Parent WhatsApp enabled for this section." : "Parent WhatsApp paused for this section."
        : "Section schedule saved.",
    );
  };

  const loadPreview = async () => {
    if(!selectedSection) return;
    const result = await runAction("preview", "preview", {sectionPlanId:selectedSection.id}, "", false);
    if(result?.report) setPreview(result.report);
  };

  const prepareCsv = () => {
    const parsed = parseCsvRows(csvText);
    setCsvPrepared(parsed);
    if(parsed.error) showNotice(parsed.error, "bad");
  };

  const importCsv = async () => {
    if(!csvPrepared?.rows?.length || !csvConsent) return;
    const result = await runAction("csv_import", "import_contacts", {
      import: {
        sectionPlanId: selectedSectionId,
        rows: csvPrepared.rows.filter(row => row.valid),
        consentConfirmed: true,
      },
    }, "", true);
    if(result) {
      showNotice(`${result.importedCount || 0} parent mapping${result.importedCount === 1 ? "" : "s"} saved${result.failedCount ? `; ${result.failedCount} need review` : ""}.`, result.failedCount ? "warn" : "good");
      if(!result.failedCount) {
        setCsvText("");
        setCsvPrepared(null);
        setCsvConsent(false);
      }
    }
  };

  const rotateInvite = async () => {
    const result = await runAction("invite", "rotate_invite", {sectionPlanId:selectedSectionId}, "A new section join code is active.");
    if(result?.invite) setInvite(result.invite);
  };

  const loadInvite = async () => {
    const result = await runAction("invite", "invite_assets", {sectionPlanId:selectedSectionId}, "", false);
    if(result?.invite) setInvite(result.invite);
  };

  const copyText = async value => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      showNotice("Copied.");
    } catch {
      showNotice("Could not copy on this browser.", "bad");
    }
  };

  const saveContact = async event => {
    event.preventDefault();
    if(busy) return;
    setBusy("contact");
    try {
      const payload = {
        sectionPlanId:selectedSectionId,
        ...contact,
        consentSource:"admin_confirmed",
      };
      let result = null;
      try {
        result = await parentApi("save_contact", {contact:payload});
      } catch(error) {
        if(error?.code!=="confirm_child_move") throw error;
        const confirmed = window.confirm("This child is active in another section. Move the mapping to this section?");
        if(!confirmed) return;
        result = await parentApi("save_contact", {contact:{...payload,confirmMove:true}});
      }
      if(result) {
        showNotice("Parent contact saved.");
        setContact({parentName:"",childName:"",relationship:"Guardian",phone:"",consentConfirmed:false});
        await loadDashboard(true);
      }
    } catch(error) {
      showNotice(error?.message || "Could not save this parent.", "bad");
    } finally {
      setBusy("");
    }
  };

  const decideJoin = async (request, decision) => {
    const edit = joinEdits[request.id] || {};
    await runAction(`join_${request.id}`, "decide_join", {
      requestId:request.id,
      decision,
      parentName:edit.parentName || request.parentName,
      childName:edit.childName || request.childName,
      relationship:edit.relationship || request.relationship,
    }, decision === "approve" ? "Parent join approved." : "Parent join rejected.");
  };

  const editMappingNames = async item => {
    const parentName = window.prompt("Parent or guardian display name", item.contact.parentName || "");
    if(parentName===null) return;
    const childName = window.prompt("Student display name", item.childName || "");
    if(childName===null) return;
    const relationship = window.prompt("Relationship", item.relationship || item.contact.relationship || "Guardian");
    if(relationship===null) return;
    await runAction(`edit_${item.id}`, "edit_subscription_names", {
      subscriptionId:item.id,
      parentName,
      childName,
      relationship,
    }, "Parent and student names updated.");
  };

  const globalSave = async () => {
    await runAction("global", "save_global_schedule", globalDraft, "Automatic Parent WhatsApp schedule saved.");
  };

  const readiness = {
    meta: health?.ready === true,
    templates: health?.templatesReady === true,
    webhook: health?.env?.meta?.appSecret && health?.env?.meta?.webhookVerifyToken,
    scheduler: health?.env?.qstashReady === true,
  };
  const readyToEnable = Object.values(readiness).every(Boolean) && Number(selectedSection?.contactCount || 0) > 0;

  if(loading && !dashboard) {
    return <div style={{...card,padding:40,textAlign:"center",color:COLORS.muted}}>Loading Parent WhatsApp…</div>;
  }

  return (
    <div className="parent-whatsapp-root" style={{maxWidth:1500,margin:"0 auto",display:"grid",gap:16,color:COLORS.text,fontFamily:"Inter, sans-serif"}}>
      <style>{`
        .parent-wa-grid { display:grid; grid-template-columns:340px minmax(0,1fr); gap:16px; align-items:start; }
        .parent-wa-health { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
        .parent-wa-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .parent-wa-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .parent-wa-section-list { max-height:680px; overflow:auto; }
        @media (max-width:1050px) {
          .parent-wa-grid { grid-template-columns:1fr; }
          .parent-wa-health { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .parent-wa-section-list { max-height:none; }
        }
        @media (max-width:620px) {
          .parent-wa-health, .parent-wa-form-grid { grid-template-columns:1fr; }
          .parent-wa-root button { min-height:44px !important; }
        }
      `}</style>

      {notice&&(
        <div style={{
          position:"fixed",right:18,bottom:18,zIndex:12000,maxWidth:380,
          borderRadius:13,padding:"12px 15px",fontSize:13,fontWeight:800,
          background:notice.tone==="bad" ? COLORS.redSoft : notice.tone==="warn" ? COLORS.amberSoft : "#DCFCE7",
          color:notice.tone==="bad" ? COLORS.red : notice.tone==="warn" ? COLORS.amber : "#166534",
          boxShadow:"0 14px 35px rgba(15,23,42,0.18)",
        }}>{notice.message}</div>
      )}

      <section style={{...card,padding:20}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{width:52,height:52,borderRadius:16,background:COLORS.greenSoft,color:COLORS.green,display:"grid",placeItems:"center",flexShrink:0}}>
              <IconMessageCircle size={26} />
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:900,color:COLORS.green,textTransform:"uppercase",letterSpacing:1}}>Parent WhatsApp</div>
              <h1 style={{margin:"5px 0 0",fontSize:27,lineHeight:1.1,color:COLORS.ink}}>Daily class updates</h1>
              <p style={{margin:"7px 0 0",fontSize:13,color:COLORS.muted,lineHeight:1.55,maxWidth:760}}>
                One parent-safe section digest from Ledgr’s central number. Every section remains off until its contacts, consent, and delivery setup are ready.
              </p>
            </div>
          </div>
          <button type="button" onClick={()=>void loadDashboard()} disabled={!!busy} style={button()}>
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
        <div className="parent-wa-health" style={{marginTop:18}}>
          {[
            ["Meta number", readiness.meta, health?.phone?.displayPhoneNumber || "Not connected"],
            ["Templates", readiness.templates, readiness.templates ? "3 approved" : "Approval needed"],
            ["Webhook", readiness.webhook, dashboard?.config?.health?.lastWebhookAt ? `Seen ${formatWhen(dashboard.config.health.lastWebhookAt)}` : readiness.webhook ? "Secrets configured" : "Setup needed"],
            ["Scheduler", readiness.scheduler, readiness.scheduler ? "QStash connected" : "Setup needed"],
            ["Recent delivery", !!dashboard?.config?.execution?.lastRunAt, dashboard?.config?.execution?.lastAttemptStatus || "No run yet"],
          ].map(([label, ok, detail]) => (
            <div key={label} style={{border:`1px solid ${COLORS.line}`,borderRadius:13,padding:12,background:ok ? "#FBFFFD" : "#FFFCF5"}}>
              <div style={{fontSize:11,fontWeight:850,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.6}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:7,marginTop:7}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:ok ? "#16A34A" : "#D97706"}} />
                <span style={{fontSize:12.5,fontWeight:800,color:COLORS.text,overflow:"hidden",textOverflow:"ellipsis"}}>{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{...card,padding:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.8}}>Global schedule</div>
            <div style={{fontSize:17,fontWeight:900,color:COLORS.ink,marginTop:4}}>One time for every enabled section</div>
            <div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>Asia/Kolkata · minute-resolution QStash schedule · Telegram remains unchanged</div>
            <div style={{fontSize:11.5,color:COLORS.green,fontWeight:800,marginTop:5}}>{nextGlobalRunLabel(globalDraft.enabled,globalDraft.timeKey)}</div>
          </div>
          <div className="parent-wa-actions">
            <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:13,fontWeight:850,color:COLORS.text}}>
              <input type="checkbox" checked={globalDraft.enabled} disabled={!dashboard?.actor?.canManageGlobalSchedule || !!busy} onChange={event=>setGlobalDraft(current=>({...current,enabled:event.target.checked}))} />
              Automatic sends
            </label>
            <input type="time" value={globalDraft.timeKey} disabled={!dashboard?.actor?.canManageGlobalSchedule || !!busy} onChange={event=>setGlobalDraft(current=>({...current,timeKey:event.target.value}))} style={{...input,width:125}} />
            {dashboard?.actor?.canManageGlobalSchedule
              ? <button type="button" disabled={!!busy || !readiness.scheduler} onClick={()=>void globalSave()} style={button(true)}><IconClock size={15}/> Save time</button>
              : <Badge tone="neutral">Manager controlled</Badge>}
          </div>
        </div>
      </section>

      <div className="parent-wa-grid">
        <aside style={{...card,overflow:"hidden"}}>
          <div style={{padding:16,borderBottom:`1px solid ${COLORS.line}`}}>
            <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.8}}>Institute → section</div>
            <div style={{fontSize:15,fontWeight:900,color:COLORS.ink,marginTop:4}}>{sections.length} available section{sections.length===1?"":"s"}</div>
          </div>
          <div className="parent-wa-section-list">
            {(dashboard?.institutes || []).map(institute => (
              <div key={institute.id}>
                <div style={{padding:"11px 14px",background:COLORS.soft,fontSize:12,fontWeight:900,color:COLORS.text,borderBottom:`1px solid ${COLORS.line}`}}>
                  {institute.name}
                </div>
                {(institute.sections || []).map(section => {
                  const active = section.id === selectedSectionId;
                  return (
                    <button key={section.id} type="button" onClick={()=>setSelectedSectionId(section.id)} style={{
                      width:"100%",border:"none",borderBottom:`1px solid ${COLORS.line}`,background:active ? COLORS.greenSoft : "#FFFFFF",
                      padding:"13px 14px",textAlign:"left",cursor:"pointer",color:COLORS.text,
                    }}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <span style={{fontSize:14,fontWeight:900,color:active ? COLORS.green : COLORS.ink}}>{section.sectionLabel}</span>
                        <Badge tone={section.enabled ? "good" : "neutral"}>{section.enabled ? "Enabled" : "Off"}</Badge>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                        <Badge>{section.contactCount} parent{section.contactCount===1?"":"s"}</Badge>
                        {section.pendingCount>0&&<Badge tone="warn">{section.pendingCount} pending</Badge>}
                        {section.lastDelivery&&<Badge tone={section.lastDelivery.status==="failed"?"bad":"info"}>{section.lastDelivery.status}</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            {!sections.length&&<div style={{padding:24,textAlign:"center",fontSize:13,color:COLORS.muted}}>No configured institute sections were found.</div>}
          </div>
        </aside>

        <main style={{display:"grid",gap:14,minWidth:0}}>
          {!selectedSection||!sectionDraft ? (
            <div style={{...card,padding:36,textAlign:"center",color:COLORS.muted}}>Choose a section to configure Parent WhatsApp.</div>
          ) : (
            <>
              <section style={{...card,padding:18}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.7}}>{selectedSection.instituteName}</div>
                    <div style={{fontSize:23,fontWeight:950,color:COLORS.ink,marginTop:4}}>{selectedSection.sectionLabel}</div>
                    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:9}}>
                      <Badge tone={selectedSection.enabled?"good":"neutral"}>{selectedSection.enabled?"Automatic delivery active":"Not enabled"}</Badge>
                      <Badge>{selectedSection.childCount} child mapping{selectedSection.childCount===1?"":"s"}</Badge>
                      <Badge>{selectedSection.lastDeliveryDate ? `Last run ${selectedSection.lastDeliveryDate}` : "No run yet"}</Badge>
                    </div>
                  </div>
                  <div className="parent-wa-actions">
                    <button type="button" disabled={!!busy} onClick={()=>void saveSection()} style={button()}><IconCheck size={15}/> Save schedule</button>
                    {selectedSection.enabled
                      ? <button type="button" disabled={!!busy} onClick={()=>void saveSection(false)} style={button(false,true)}><IconPlayerPause size={15}/> Pause</button>
                      : <button type="button" disabled={!!busy || !readyToEnable} onClick={()=>void saveSection(true)} style={button(true)}><IconPlayerPlay size={15}/> Enable</button>}
                  </div>
                </div>

                <div style={{marginTop:17,paddingTop:15,borderTop:`1px solid ${COLORS.line}`,display:"grid",gap:13}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.7}}>Active weekdays</div>
                    <div className="parent-wa-actions" style={{marginTop:8}}>
                      {WEEKDAYS.map(day => {
                        const checked = sectionDraft.weekdays.includes(day.value);
                        return (
                          <label key={day.value} style={{
                            minHeight:36,padding:"0 10px",borderRadius:9,border:`1px solid ${checked?COLORS.green:COLORS.line}`,
                            background:checked?COLORS.greenSoft:"#FFFFFF",color:checked?COLORS.green:COLORS.muted,
                            display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:850,cursor:"pointer",
                          }}>
                            <input type="checkbox" checked={checked} onChange={()=>setSectionDraft(current=>({
                              ...current,
                              weekdays:checked ? current.weekdays.filter(value=>value!==day.value) : [...current.weekdays,day.value],
                            }))} />
                            {day.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase",letterSpacing:0.7}}>Holiday skips</div>
                    <div className="parent-wa-actions" style={{marginTop:8}}>
                      <input type="date" value={skipDate} onChange={event=>setSkipDate(event.target.value)} style={{...input,width:165}} />
                      <button type="button" disabled={!skipDate} onClick={()=>{
                        setSectionDraft(current=>({...current,skipDates:[...new Set([...current.skipDates,skipDate])].sort()}));
                        setSkipDate("");
                      }} style={button()}><IconCalendar size={15}/> Add skip</button>
                      {sectionDraft.skipDates.map(date => (
                        <span key={date} style={{display:"inline-flex",alignItems:"center",gap:5,minHeight:34,padding:"0 8px",borderRadius:999,background:COLORS.amberSoft,color:COLORS.amber,fontSize:11.5,fontWeight:850}}>
                          {date}
                          <button type="button" aria-label={`Remove ${date}`} onClick={()=>setSectionDraft(current=>({...current,skipDates:current.skipDates.filter(value=>value!==date)}))} style={{border:"none",background:"transparent",color:"inherit",padding:0,cursor:"pointer",display:"grid",placeItems:"center"}}><IconX size={13}/></button>
                        </span>
                      ))}
                    </div>
                  </div>
                  {!readyToEnable&&!selectedSection.enabled&&(
                    <div style={{borderRadius:11,background:COLORS.amberSoft,color:COLORS.amber,padding:"10px 12px",fontSize:12.5,fontWeight:750,lineHeight:1.5}}>
                      Enabling needs Meta, all three approved templates, QStash, webhook secrets, and at least one active consented parent.
                    </div>
                  )}
                </div>
              </section>

              <nav className="parent-wa-actions" style={{...card,padding:8}}>
                {[
                  ["preview","Today",IconFileText],
                  ["parents","Parents",IconUsersGroup],
                  ["enrollment","Join & CSV",IconUserPlus],
                  ["history","History",IconClock],
                ].map(([key,label,Icon])=>(
                  <button key={key} type="button" onClick={()=>setPanel(key)} style={{...button(panel===key),flex:"1 1 130px",background:panel===key?COLORS.ink:"#FFFFFF"}}>
                    <Icon size={15}/>{label}
                  </button>
                ))}
              </nav>

              {panel==="preview"&&(
                <section style={{...card,padding:18,display:"grid",gap:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>Today’s parent-safe report</div>
                      <div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>Read-only teacher content. Times, durations, pending records, and internal data stay hidden.</div>
                    </div>
                    <div className="parent-wa-actions">
                      <button type="button" disabled={!!busy} onClick={()=>void loadPreview()} style={button()}><IconRefresh size={15}/> Preview</button>
                      <button type="button" disabled={!!busy || !selectedSection.contactCount} onClick={()=>void runAction("send_now","send_now",{sectionPlanId:selectedSectionId},"Today’s section slot was sent.")} style={button(true)}><IconSend size={15}/> Send now</button>
                      <button type="button" disabled={!!busy || !preview?.changedSinceLastSend} onClick={()=>void runAction("corrected","corrected_resend",{sectionPlanId:selectedSectionId},"Updated report sent.")} style={button()}><IconFileText size={15}/> Send Updated</button>
                    </div>
                  </div>
                  {preview ? (
                    <>
                      <div style={{borderRadius:14,background:COLORS.soft,padding:14}}>
                        <div style={{fontSize:11,fontWeight:900,color:COLORS.muted,textTransform:"uppercase"}}>{preview.dateLabel} · WhatsApp summary</div>
                        <div style={{fontSize:13,color:COLORS.text,lineHeight:1.65,whiteSpace:"pre-wrap",marginTop:7}}>{preview.summary}</div>
                        {preview.changedSinceLastSend&&<div style={{marginTop:9}}><Badge tone="warn">Teacher content changed after the last send</Badge></div>}
                      </div>
                      <div style={{display:"grid",gap:9}}>
                        {preview.entries.map(entry=>(
                          <article key={entry.sourceId} style={{border:`1px solid ${COLORS.line}`,borderRadius:13,padding:14}}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                              <Badge tone="good">{entry.subject}</Badge>
                              <span style={{fontSize:11.5,fontWeight:800,color:COLORS.muted}}>{entry.teacherName}</span>
                            </div>
                            <div style={{fontSize:15,fontWeight:900,color:COLORS.ink,marginTop:10}}>{entry.title}</div>
                            <div style={{fontSize:12.5,color:COLORS.text,lineHeight:1.65,whiteSpace:"pre-wrap",marginTop:5}}>{entry.notes||"No additional teaching notes were recorded."}</div>
                          </article>
                        ))}
                        {!preview.entries.length&&<div style={{border:`1px dashed ${COLORS.line}`,borderRadius:13,padding:28,textAlign:"center",color:COLORS.muted}}>No update today. Parents receive the neutral no-update template without a PDF.</div>}
                      </div>
                    </>
                  ) : <div style={{border:`1px dashed ${COLORS.line}`,borderRadius:13,padding:28,textAlign:"center",color:COLORS.muted}}>Save the section, then load today’s preview.</div>}

                  <div style={{borderTop:`1px solid ${COLORS.line}`,paddingTop:14}}>
                    <div style={{fontSize:14,fontWeight:900,color:COLORS.ink}}>Test delivery</div>
                    <div className="parent-wa-actions" style={{marginTop:8}}>
                      <input value={testPhone} onChange={event=>setTestPhone(event.target.value)} placeholder="+91 98765 43210" style={{...input,maxWidth:230}} />
                      <button type="button" disabled={!!busy || !testPhone} onClick={()=>void runAction("test","test_send",{sectionPlanId:selectedSectionId,phone:testPhone,parentName:"Test parent",childName:"Test student"},"Test message accepted by Meta.",false)} style={button()}><IconSend size={15}/> Test send</button>
                    </div>
                  </div>
                </section>
              )}

              {panel==="parents"&&(
                <section style={{display:"grid",gap:14}}>
                  <form onSubmit={saveContact} style={{...card,padding:18,display:"grid",gap:12}}>
                    <div>
                      <div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>Add a parent</div>
                      <div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>India (+91) is the default; international E.164 numbers are accepted.</div>
                    </div>
                    <div className="parent-wa-form-grid">
                      <Field label="Parent name"><input required value={contact.parentName} onChange={event=>setContact(current=>({...current,parentName:event.target.value}))} style={input}/></Field>
                      <Field label="Student name"><input required value={contact.childName} onChange={event=>setContact(current=>({...current,childName:event.target.value}))} style={input}/></Field>
                      <Field label="Relationship"><input value={contact.relationship} onChange={event=>setContact(current=>({...current,relationship:event.target.value}))} style={input}/></Field>
                      <Field label="WhatsApp phone"><input required value={contact.phone} onChange={event=>setContact(current=>({...current,phone:event.target.value}))} placeholder="+91 98765 43210" style={input}/></Field>
                    </div>
                    <label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12.5,color:COLORS.text,lineHeight:1.5}}>
                      <input type="checkbox" required checked={contact.consentConfirmed} onChange={event=>setContact(current=>({...current,consentConfirmed:event.target.checked}))} style={{marginTop:3}}/>
                      I confirm this parent consented to receive Ledgr class updates on WhatsApp.
                    </label>
                    <div><button type="submit" disabled={!!busy} style={button(true)}><IconUserPlus size={15}/> Save parent</button></div>
                  </form>

                  <div style={{...card,overflow:"hidden"}}>
                    <div style={{padding:16,borderBottom:`1px solid ${COLORS.line}`,display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                      <div><div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>Active child mappings</div><div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>One phone can hold siblings; each mapping can be paused or revoked separately.</div></div>
                      <Badge>{sectionParents.length} mapping{sectionParents.length===1?"":"s"}</Badge>
                    </div>
                    <div style={{display:"grid"}}>
                      {sectionParents.map(item=>(
                        <div key={item.id} style={{padding:14,borderBottom:`1px solid ${COLORS.line}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                          <label style={{display:"flex",gap:10,alignItems:"flex-start",minWidth:0}}>
                            <input type="checkbox" checked={selectedMoves.includes(item.id)} onChange={event=>setSelectedMoves(current=>event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))} style={{marginTop:4}}/>
                            <span>
                              <span style={{display:"block",fontSize:14,fontWeight:900,color:COLORS.ink}}>{item.childName}</span>
                              <span style={{display:"block",fontSize:12.5,color:COLORS.text,marginTop:3}}>{item.contact.parentName||"Parent"} · {item.relationship||item.contact.relationship||"Guardian"}</span>
                              <span style={{display:"block",fontSize:11.5,color:COLORS.muted,marginTop:3}}>{item.contact.phoneE164||item.contact.phoneMasked||"Phone unavailable"} · {item.enrollmentMethod==="self_join"?"Self-enrolled":"Admin added"}</span>
                            </span>
                          </label>
                          <div className="parent-wa-actions">
                            {item.contact.optedOutAt?<Badge tone="bad">STOP opt-out</Badge>:<Badge tone={item.status==="active"&&!item.adminPaused?"good":"warn"}>{item.status==="active"&&!item.adminPaused?"Active":item.status}</Badge>}
                            <button type="button" disabled={!!busy} onClick={()=>void editMappingNames(item)} style={button()}>Edit names</button>
                            <button type="button" disabled={!!busy} onClick={()=>void runAction(`sub_${item.id}`,"set_subscription_state",{subscriptionId:item.id,state:item.adminPaused?"active":"paused"},item.adminPaused?"Mapping resumed.":"Mapping paused.")} style={button()}>{item.adminPaused?"Resume":"Pause"}</button>
                            <button type="button" disabled={!!busy||item.status==="revoked"} onClick={()=>void runAction(`sub_${item.id}`,"set_subscription_state",{subscriptionId:item.id,state:"revoked"},"Mapping revoked.")} style={button(false,true)}>Revoke</button>
                          </div>
                        </div>
                      ))}
                      {!sectionParents.length&&<div style={{padding:26,textAlign:"center",color:COLORS.muted,fontSize:13}}>No parent mappings yet.</div>}
                    </div>
                    {selectedMoves.length>0&&(
                      <div style={{padding:14,background:COLORS.soft}} className="parent-wa-actions">
                        <select value={moveTarget} onChange={event=>setMoveTarget(event.target.value)} style={{...input,maxWidth:330}}>
                          <option value="">Move selected children to…</option>
                          {sections.filter(section=>section.id!==selectedSectionId&&section.instituteId===selectedSection.instituteId).map(section=><option key={section.id} value={section.id}>{section.sectionLabel}</option>)}
                        </select>
                        <button type="button" disabled={!!busy||!moveTarget} onClick={()=>{
                          if(!window.confirm(`Move ${selectedMoves.length} child mapping${selectedMoves.length===1?"":"s"} and pause the old section’s automatic Parent WhatsApp plan?`)) return;
                          void runAction("move","bulk_move",{subscriptionIds:selectedMoves,targetSectionPlanId:moveTarget,pauseSource:true},"Children moved and the old section plan was paused.");
                        }} style={button(true)}>Move & pause old section</button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {panel==="enrollment"&&(
                <section style={{display:"grid",gap:14}}>
                  <div style={{...card,padding:18,display:"grid",gap:13}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                      <div><div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>Parent self-enrollment</div><div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>The parent sends JOIN, supplies names, then waits for institute approval.</div></div>
                      <div className="parent-wa-actions">
                        {selectedSection.inviteCode&&<button type="button" onClick={()=>void loadInvite()} disabled={!!busy} style={button()}><IconQrcode size={15}/> Show QR</button>}
                        <button type="button" onClick={()=>void rotateInvite()} disabled={!!busy} style={button(true)}><IconRefresh size={15}/> {selectedSection.inviteCode?"Rotate":"Create"} link</button>
                        {selectedSection.inviteCode&&<button type="button" onClick={()=>void runAction("invite_close","close_invite",{sectionPlanId:selectedSectionId},"Parent enrollment link closed.")} disabled={!!busy} style={button(false,true)}>Close</button>}
                      </div>
                    </div>
                    {(invite?.code||selectedSection.inviteCode)&&(
                      <div style={{border:`1px solid ${COLORS.line}`,borderRadius:14,padding:14,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                        {invite?.qrDataUrl&&<img src={invite.qrDataUrl} alt="Parent join QR code" style={{width:150,height:150,borderRadius:10,border:`1px solid ${COLORS.line}`}}/>}
                        <div style={{display:"grid",gap:8,minWidth:0}}>
                          <Badge tone="good">Active code</Badge>
                          <div style={{fontFamily:"ui-monospace, monospace",fontSize:22,fontWeight:900,color:COLORS.ink,letterSpacing:1}}>{invite?.code||selectedSection.inviteCode}</div>
                          <div className="parent-wa-actions">
                            <button type="button" onClick={()=>void copyText(invite?.joinText||`JOIN ${selectedSection.inviteCode}`)} style={button()}><IconCopy size={15}/> Copy JOIN text</button>
                            {invite?.link&&<button type="button" onClick={()=>void copyText(invite.link)} style={button()}><IconLink size={15}/> Copy link</button>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{...card,padding:18,display:"grid",gap:12}}>
                    <div><div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>Pending join approvals</div><div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>Verify the family and edit self-declared names before delivery begins.</div></div>
                    {pendingJoins.map(request=>{
                      const edit=joinEdits[request.id]||{};
                      const update=(key,value)=>setJoinEdits(current=>({...current,[request.id]:{...(current[request.id]||{}),[key]:value}}));
                      return (
                        <div key={request.id} style={{border:`1px solid ${COLORS.line}`,borderRadius:13,padding:13,display:"grid",gap:10}}>
                          <div className="parent-wa-form-grid">
                            <Field label="Parent"><input value={edit.parentName??request.parentName} onChange={event=>update("parentName",event.target.value)} style={input}/></Field>
                            <Field label="Student"><input value={edit.childName??request.childName} onChange={event=>update("childName",event.target.value)} style={input}/></Field>
                            <Field label="Relationship"><input value={edit.relationship??request.relationship??"Guardian"} onChange={event=>update("relationship",event.target.value)} style={input}/></Field>
                            <Field label="WhatsApp"><input value={request.phoneE164||""} readOnly style={{...input,background:COLORS.soft}}/></Field>
                          </div>
                          <div className="parent-wa-actions">
                            <button type="button" disabled={!!busy} onClick={()=>void decideJoin(request,"approve")} style={button(true)}><IconShieldCheck size={15}/> Approve</button>
                            <button type="button" disabled={!!busy} onClick={()=>void decideJoin(request,"reject")} style={button(false,true)}>Reject</button>
                          </div>
                        </div>
                      );
                    })}
                    {!pendingJoins.length&&<div style={{border:`1px dashed ${COLORS.line}`,borderRadius:13,padding:24,textAlign:"center",color:COLORS.muted}}>No pending joins for this section.</div>}
                  </div>

                  <div style={{...card,padding:18,display:"grid",gap:12}}>
                    <div><div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>CSV import</div><div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>Required: parent_name, student_name, phone. Optional: relationship.</div></div>
                    <textarea value={csvText} onChange={event=>{setCsvText(event.target.value);setCsvPrepared(null);}} placeholder={"parent_name,student_name,phone,relationship\nAnita Sharma,Riya Sharma,9876543210,Mother"} style={{...input,minHeight:130,resize:"vertical",fontFamily:"ui-monospace, monospace"}}/>
                    <div className="parent-wa-actions">
                      <label style={button()}><IconUpload size={15}/> Choose CSV<input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={event=>{
                        const file=event.target.files?.[0];
                        if(file) file.text().then(text=>{setCsvText(text);setCsvPrepared(null);});
                        event.target.value="";
                      }}/></label>
                      <button type="button" disabled={!csvText||!!busy} onClick={prepareCsv} style={button()}>Validate</button>
                      {csvPrepared&&!csvPrepared.error&&<Badge tone={csvPrepared.invalidCount?"warn":"good"}>{csvPrepared.rows.length} ready · {csvPrepared.duplicateCount||0} duplicate · {csvPrepared.invalidCount||0} invalid</Badge>}
                    </div>
                    {csvPrepared&&!csvPrepared.error&&(
                      <>
                        <div style={{maxHeight:220,overflow:"auto",border:`1px solid ${COLORS.line}`,borderRadius:11}}>
                          {csvPrepared.rows.slice(0,100).map(row=>(
                            <div key={`${row.rowNumber}_${row.phone}`} style={{padding:"9px 11px",borderBottom:`1px solid ${COLORS.line}`,fontSize:12,color:row.valid?COLORS.text:COLORS.red}}>
                              Row {row.rowNumber}: {row.parentName||"Missing parent"} · {row.childName||"Missing student"} · {row.phone||"Missing phone"}
                            </div>
                          ))}
                        </div>
                        <label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12.5,color:COLORS.text,lineHeight:1.5}}>
                          <input type="checkbox" checked={csvConsent} onChange={event=>setCsvConsent(event.target.checked)} style={{marginTop:3}}/>
                          I confirm consent evidence exists for every valid row in this batch.
                        </label>
                        <div><button type="button" disabled={!!busy||!csvConsent||!csvPrepared.rows.some(row=>row.valid)} onClick={()=>void importCsv()} style={button(true)}><IconUpload size={15}/> Import valid rows</button></div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {panel==="history"&&(
                <section style={{...card,overflow:"hidden"}}>
                  <div style={{padding:17,borderBottom:`1px solid ${COLORS.line}`}}>
                    <div style={{fontSize:17,fontWeight:950,color:COLORS.ink}}>90-day delivery history</div>
                    <div style={{fontSize:12.5,color:COLORS.muted,marginTop:4}}>Accepted, sent, delivered, read, and failed metadata only. PDFs and full messages are not retained.</div>
                  </div>
                  <div style={{display:"grid"}}>
                    {history.map(item=>(
                      <div key={item.id} style={{padding:14,borderBottom:`1px solid ${COLORS.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                        <div>
                          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{fontSize:13.5,fontWeight:900,color:COLORS.ink}}>{item.dateKey}</span>
                            <Badge tone={item.status==="failed"?"bad":item.status==="read"||item.status==="delivered"?"good":"info"}>{item.status||"unknown"}</Badge>
                            {item.kind==="corrected"&&<Badge tone="warn">Updated</Badge>}
                          </div>
                          <div style={{fontSize:11.5,color:COLORS.muted,marginTop:5}}>{item.phoneMasked} · {item.childCount||0} child{item.childCount===1?"":"ren"} · attempt {item.attempts||1} · {formatWhen(item.updatedAt)}</div>
                          {item.error&&<div style={{fontSize:12,color:COLORS.red,marginTop:5}}>{item.error}</div>}
                        </div>
                        {(item.status==="failed"||(item.status==="sending"&&Date.now()-Number(item.updatedAt||0)>=15*60*1000))
                          && item.dateKey===indiaTodayKey()
                          && <button type="button" disabled={!!busy} onClick={()=>void runAction(`retry_${item.id}`,"retry",{sectionPlanId:selectedSectionId},"Retryable deliveries processed.")} style={button()}><IconRefresh size={15}/> Retry</button>}
                      </div>
                    ))}
                    {!history.length&&<div style={{padding:28,textAlign:"center",color:COLORS.muted}}>No Parent WhatsApp deliveries yet.</div>}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
