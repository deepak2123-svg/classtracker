import React from "react";
import {
  IconBuilding,
  IconChartBar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDeviceFloppy,
  IconFileText,
  IconRefresh,
  IconSchool,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { STATUS_STYLES, TAG_STYLES } from "../../shared.jsx";
import { AppIcon } from "../components/common/AppIcon.jsx";
import { alphaHex, G, subjectColor } from "../styles/adminTheme.js";
import { daysAgo, formatAdminDateKey, formatDurationShort } from "../utils/adminDates.js";
import { formatExportPdfTime, safeAdminText } from "../utils/adminText.js";
import { SectionSplitDonut } from "./SectionSplitDonut.jsx";
import {
  selectTeacherProfileTimeline,
  TEACHER_PROFILE_ALL_SECTIONS_KEY,
} from "./teacherProfileModel.js";

function toneButtonStyle(tone = "neutral", disabled = false) {
  const palette = {
    primary: { bg: G.navy, border: G.navy, color: "#FFFFFF" },
    blue: { bg: "#EEF4FF", border: "#BFDBFE", color: G.blue },
    neutral: { bg: "#FFFFFF", border: G.border, color: G.textS },
    danger: { bg: "#FFF5F5", border: "#FECACA", color: G.red },
  }[tone] || { bg: "#FFFFFF", border: G.border, color: G.textS };
  return {
    minHeight: 36,
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.color,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: G.sans,
    fontSize: 12.5,
    fontWeight: 850,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.58 : 1,
    boxShadow: "none",
    whiteSpace: "nowrap",
  };
}

function ActionButton({ icon, label, tone = "neutral", disabled = false, onClick, title = "" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title || label} style={toneButtonStyle(tone, disabled)}>
      {icon ? <AppIcon icon={icon} size={15} color="currentColor" /> : null}
      {label}
    </button>
  );
}

function InfoChip({ label, tone = "slate", color = "" }) {
  const tones = {
    slate: { bg: "#F8FAFC", border: G.border, text: G.textM },
    blue: { bg: "#EEF4FF", border: "#BFDBFE", text: G.blue },
    green: { bg: "#ECFDF5", border: "#BBF7D0", text: "#047857" },
    red: { bg: "#FFF5F5", border: "#FECACA", text: G.red },
    amber: { bg: "#FFFBEB", border: "#FED7AA", text: G.amber },
  };
  const picked = tones[tone] || tones.slate;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      minHeight: 25,
      borderRadius: 999,
      padding: "0 9px",
      border: `1px solid ${picked.border}`,
      background: picked.bg,
      color: color || picked.text,
      fontSize: 11,
      fontWeight: 850,
      maxWidth: "100%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}>
      {label}
    </span>
  );
}

function MetricCard({ label, value, caption, icon }) {
  return (
    <div className="teacher-profile-metric">
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10}}>
        <div style={{minWidth: 0}}>
          <div style={{fontSize: 10.5, fontWeight: 900, color: G.textL, textTransform: "uppercase", letterSpacing: 0.7}}>{label}</div>
          <div style={{fontSize: 23, fontWeight: 950, color: G.text, fontFamily: G.display, marginTop: 4, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
            {value}
          </div>
        </div>
        {icon ? (
          <div style={{width: 34, height: 34, borderRadius: 10, background: "#EEF4FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}>
            <AppIcon icon={icon} size={17} color={G.blue} />
          </div>
        ) : null}
      </div>
      {caption ? <div style={{fontSize: 12, color: G.textM, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{caption}</div> : null}
    </div>
  );
}

function statusLabel(status) {
  const key = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  if (key === "inprogress") return "In progress";
  if (key === "completed") return "Completed";
  if (key === "doubts") return "Doubts";
  if (key === "started") return "Started";
  return safeAdminText(status, "");
}

function tagLabel(tag) {
  const key = String(tag || "").toLowerCase().replace(/[\s_-]/g, "");
  if (key === "important") return "Important";
  if (key === "note") return "Note";
  return safeAdminText(tag, "");
}

function entryStatusTone(status) {
  const key = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  return STATUS_STYLES[key] || { bg: "#F8FAFC", text: G.textM, dot: G.borderM };
}

function entryTagTone(tag) {
  const key = String(tag || "").toLowerCase().replace(/[\s_-]/g, "");
  return TAG_STYLES[key] || { bg: "#F8FAFC", text: G.textM };
}

function lastEntryLabel(timestamp) {
  if (!timestamp) return "--";
  return daysAgo(timestamp) || new Date(timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function dateGroupLabel(dateKey) {
  if (!dateKey) return "Undated";
  return formatAdminDateKey(dateKey, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) || dateKey;
}

function SectionCard({ section, selected, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`teacher-profile-section-card${selected ? " is-selected" : ""}`}
      style={{
        border: `1px solid ${selected ? color : G.border}`,
        background: selected ? alphaHex(color, 0.075) : "#FFFFFF",
        borderRadius: 13,
        padding: "12px 13px",
        textAlign: "left",
        cursor: "pointer",
        minWidth: 0,
        boxShadow: selected ? `0 0 0 3px ${alphaHex(color, 0.1)}` : "none",
      }}
    >
      <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10}}>
        <div style={{minWidth: 0}}>
          <div style={{fontSize: 14.5, fontWeight: 950, color: G.text, fontFamily: G.display, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
            {section.label}
          </div>
          <div style={{fontSize: 12, fontWeight: 750, color: G.textM, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
            {section.institute}
          </div>
        </div>
        <span style={{width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0, marginTop: 4}} />
      </div>
      <div style={{display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10}}>
        <InfoChip label={section.subject} color={color} />
        <InfoChip label={formatDurationShort(section.minutes || 0)} tone={section.minutes ? "green" : "amber"} />
        <InfoChip label={`${section.entries || 0} entries`} tone="slate" />
      </div>
    </button>
  );
}

function TimelineEntry({ entry }) {
  const status = statusLabel(entry.status);
  const tag = tagLabel(entry.tag);
  const statusTone = entryStatusTone(entry.status);
  const tagTone = entryTagTone(entry.tag);
  const timeLabel = formatExportPdfTime(entry.timeStart, entry.timeEnd) || "Untimed";
  return (
    <div className="teacher-profile-timeline-entry">
      <span className="teacher-profile-timeline-dot" style={{background: statusTone.dot || subjectColor(entry.subject)}} />
      <div className="teacher-profile-timeline-card">
        <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10}}>
          <div style={{minWidth: 0}}>
            <div style={{fontSize: 12.5, fontWeight: 900, color: G.textS, fontFamily: G.mono}}>{timeLabel}</div>
            <div style={{fontSize: 16, fontWeight: 950, color: G.text, fontFamily: G.display, marginTop: 7, lineHeight: 1.18}}>
              {entry.title}
            </div>
            <div style={{fontSize: 12.5, color: G.textM, marginTop: 5, lineHeight: 1.4}}>
              {entry.sectionLabel} - {entry.subject} - {entry.institute}
            </div>
          </div>
          <div style={{fontSize: 13.5, fontWeight: 950, color: G.text, whiteSpace: "nowrap", flexShrink: 0}}>
            {entry.minutes ? formatDurationShort(entry.minutes) : "Untimed"}
          </div>
        </div>
        {(status || tag) ? (
          <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10}}>
            {status ? <InfoChip label={status} color={statusTone.text} /> : null}
            {tag ? <InfoChip label={tag} color={tagTone.text} /> : null}
          </div>
        ) : null}
        {entry.body ? (
          <div style={{fontSize: 12.5, color: G.textM, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap"}}>
            {entry.body}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TeacherProfilePanel({
  model,
  selectedSectionKey,
  timelineLimit = 30,
  isMobile = false,
  reduceEffects = false,
  renameState = null,
  renameValue = "",
  onRenameValueChange,
  onBack,
  onSelectSection,
  onShowMore,
  onViewEntries,
  onViewInstituteEntries,
  onRenameStart,
  onRenameSave,
  onRenameCancel,
  onRepairIndex,
  onPromote,
  onRemoveTeacher,
  onRemoveClass,
  onMoveBranch,
  repairing = false,
}) {
  if (!model) return null;

  const identity = model.identity || {};
  const summary = model.summary || {};
  const activeTimeline = selectTeacherProfileTimeline(model, selectedSectionKey, timelineLimit);
  const selectedSection = activeTimeline.selectedSection || model.allSectionsOption;
  const activeSectionKey = selectedSection?.key || TEACHER_PROFILE_ALL_SECTIONS_KEY;
  const sectionCards = [model.allSectionsOption, ...(model.sections || [])];
  const segments = (model.sections || []).map(section => ({
    key: section.key,
    label: section.label,
    minutes: section.minutes || 0,
    entries: section.entries || 0,
    color: subjectColor(`${section.label} ${section.institute}`),
  }));
  const detailsReady = !!model.detailsReady;
  const isRenaming = renameState?.uid === identity.uid;
  const statusChip = identity.hasLeftWorkspace
    ? <InfoChip label={identity.departedLabel || "Departed"} tone="red" />
    : identity.isAdminTeacher
      ? <InfoChip label="Admin + teacher" tone="blue" />
      : <InfoChip label="Active" tone="green" />;

  const profileShellStyle = {
    background: G.surface,
    border: `1px solid ${G.border}`,
    borderRadius: 13,
    padding: isMobile ? "13px" : "18px",
    boxShadow: reduceEffects ? "none" : G.shadowSm,
  };
  const panelCardStyle = {
    background: "#FFFFFF",
    border: `1px solid ${G.border}`,
    borderRadius: 14,
    boxShadow: reduceEffects ? "none" : G.shadowSm,
  };

  return (
    <div className="teacher-profile-panel" style={profileShellStyle}>
      <style>{`
        .teacher-profile-metric {
          background: #FFFFFF;
          border: 1px solid ${G.border};
          border-radius: 14px;
          padding: 13px 14px;
          min-width: 0;
        }
        .teacher-profile-section-card {
          transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
        }
        .teacher-profile-section-card:hover {
          border-color: ${G.borderM} !important;
          transform: translateY(-1px);
        }
        .teacher-profile-timeline-group {
          position: relative;
          padding-left: 28px;
        }
        .teacher-profile-timeline-group::before {
          content: "";
          position: absolute;
          left: 8px;
          top: 46px;
          bottom: 0;
          width: 2px;
          background: #DDE7F4;
          border-radius: 999px;
        }
        .teacher-profile-timeline-entry {
          position: relative;
          padding: 0 0 12px 0;
        }
        .teacher-profile-timeline-dot {
          position: absolute;
          left: -24px;
          top: 18px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 0 1px #CBD5E1;
        }
        .teacher-profile-timeline-card {
          background: #FFFFFF;
          border: 1px solid ${G.border};
          border-radius: 13px;
          padding: 13px 14px;
          min-width: 0;
        }
        @media (max-width: 820px) {
          .teacher-profile-timeline-group {
            padding-left: 24px;
          }
          .teacher-profile-timeline-dot {
            left: -20px;
          }
        }
      `}</style>

      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14}}>
        <button type="button" onClick={onBack} style={toneButtonStyle("neutral")}>
          <AppIcon icon={IconChevronLeft} size={16} color="currentColor" />
          Teachers
        </button>
        {!detailsReady ? <InfoChip label="Loading details" tone="blue" /> : null}
      </div>

      <div style={{...panelCardStyle, padding: isMobile ? "14px" : "16px", marginBottom: 14}}>
        <div style={{display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap"}}>
          <div style={{display: "flex", alignItems: "center", gap: 13, minWidth: 0}}>
            <div style={{
              width: isMobile ? 52 : 58,
              height: isMobile ? 52 : 58,
              borderRadius: 16,
              background: alphaHex(subjectColor(identity.name), 0.12),
              color: subjectColor(identity.name),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 950,
              fontFamily: G.mono,
              flexShrink: 0,
              overflow: "hidden",
            }}>
              {identity.photoURL ? <img src={identity.photoURL} alt="" style={{width: "100%", height: "100%", objectFit: "cover"}} /> : identity.initials}
            </div>
            <div style={{minWidth: 0}}>
              <div style={{fontSize: isMobile ? 22 : 28, fontWeight: 950, color: G.text, fontFamily: G.display, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                {identity.name}
              </div>
              <div style={{fontSize: 12.5, color: G.textM, marginTop: 5, fontFamily: G.mono, wordBreak: "break-all"}}>
                {identity.email}
              </div>
              <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9}}>
                {statusChip}
                {(model.institutes || []).slice(0, 4).map(group => <InfoChip key={group.key} label={group.institute} tone="slate" />)}
                {(model.institutes || []).length > 4 ? <InfoChip label={`+${model.institutes.length - 4}`} tone="slate" /> : null}
              </div>
            </div>
          </div>

          <div style={{display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end"}}>
            {isRenaming ? (
              <>
                <input
                  value={renameValue}
                  onChange={event => onRenameValueChange?.(event.target.value)}
                  style={{
                    minHeight: 36,
                    width: isMobile ? "100%" : 220,
                    borderRadius: 10,
                    border: `1px solid ${G.borderM}`,
                    padding: "0 11px",
                    fontFamily: G.sans,
                    fontSize: 13,
                    fontWeight: 750,
                    outline: "none",
                  }}
                />
                <ActionButton icon={IconDeviceFloppy} label="Save" tone="primary" disabled={!String(renameValue || "").trim()} onClick={onRenameSave} />
                <ActionButton icon={IconX} label="Cancel" onClick={onRenameCancel} />
              </>
            ) : (
              <>
                <ActionButton icon={IconFileText} label="View Entries" onClick={onViewEntries} />
                <ActionButton icon={IconUser} label="Rename" onClick={onRenameStart} />
                <ActionButton icon={IconRefresh} label={repairing ? "Repairing" : "Repair Index"} tone="blue" disabled={repairing} onClick={onRepairIndex} />
                {!identity.isMe && !identity.isAdminTeacher ? <ActionButton icon={IconCheck} label="Make Admin" tone="blue" onClick={onPromote} /> : null}
                {!identity.isMe ? <ActionButton icon={IconTrash} label="Remove" tone="danger" onClick={onRemoveTeacher} /> : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,minmax(0,1fr))", gap: 10, marginBottom: 14}}>
        <MetricCard label="Teaching hours" value={detailsReady ? formatDurationShort(summary.totalMinutes || 0) : "--"} caption={summary.untimedEntries ? `${summary.untimedEntries} untimed` : ""} icon={IconClock} />
        <MetricCard label="Entries" value={detailsReady ? summary.totalEntries || 0 : "--"} caption={detailsReady ? `${summary.activeDays || 0} active days` : ""} icon={IconFileText} />
        <MetricCard label="Classes" value={detailsReady ? summary.classCount || 0 : summary.classCount || "--"} caption={`${summary.subjectCount || 0} subjects`} icon={IconSchool} />
        <MetricCard label="Institutes" value={summary.instituteCount || 0} caption={(model.institutes || [])[0]?.institute || ""} icon={IconBuilding} />
        <MetricCard label="Last entry" value={detailsReady ? lastEntryLabel(summary.lastEntryTimestamp) : "--"} caption={summary.lastEntryTimestamp ? new Date(summary.lastEntryTimestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""} icon={IconChartBar} />
      </div>

      <div style={{...panelCardStyle, padding: isMobile ? "13px" : "15px", marginBottom: 14}}>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 11}}>
          <div>
            <div style={{fontSize: 11, fontWeight: 900, color: G.textL, textTransform: "uppercase", letterSpacing: 0.75}}>Sections</div>
            <div style={{fontSize: 16, fontWeight: 950, color: G.text, fontFamily: G.display, marginTop: 3}}>Class breakdown</div>
          </div>
          <InfoChip label={`${model.sections.length || 0} active`} tone="blue" />
        </div>
        {detailsReady && sectionCards.length > 1 ? (
          <div style={{display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(210px,1fr))", gap: 10}}>
            {sectionCards.map(section => {
              const color = section.key === TEACHER_PROFILE_ALL_SECTIONS_KEY ? G.blue : subjectColor(`${section.label} ${section.institute}`);
              return (
                <SectionCard
                  key={section.key}
                  section={section}
                  selected={activeSectionKey === section.key}
                  color={color}
                  onClick={() => onSelectSection?.(section.key)}
                />
              );
            })}
          </div>
        ) : (
          <div style={{fontSize: 13, color: G.textM, lineHeight: 1.6}}>
            {detailsReady ? "No active teaching sections." : "Loading active sections."}
          </div>
        )}
      </div>

      <div style={{display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(280px,0.85fr) minmax(0,1.45fr)", gap: 14, alignItems: "start"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 14, minWidth: 0}}>
          <div style={{...panelCardStyle, padding: "15px", minWidth: 0}}>
            <div style={{fontSize: 11, fontWeight: 900, color: G.textL, textTransform: "uppercase", letterSpacing: 0.75}}>Section split</div>
            <div style={{display: "grid", gridTemplateColumns: isMobile ? "1fr" : "160px minmax(0,1fr)", gap: 14, alignItems: "center", marginTop: 12}}>
              <div style={{display: "flex", justifyContent: "center"}}>
                <SectionSplitDonut segments={segments} totalMinutes={summary.totalMinutes || 0} label="classes" />
              </div>
              <div style={{display: "flex", flexDirection: "column", gap: 8, minWidth: 0}}>
                {segments.length ? segments.slice(0, 8).map(segment => (
                  <div key={segment.key} style={{display: "grid", gridTemplateColumns: "12px minmax(0,1fr) auto", gap: 8, alignItems: "center", minWidth: 0}}>
                    <span style={{width: 10, height: 10, borderRadius: 999, background: segment.color}} />
                    <span style={{fontSize: 12.5, fontWeight: 800, color: G.textS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{segment.label}</span>
                    <span style={{fontSize: 12.5, fontWeight: 900, color: G.text}}>{formatDurationShort(segment.minutes || 0)}</span>
                  </div>
                )) : (
                  <div style={{fontSize: 13, color: G.textM}}>No teaching entries yet.</div>
                )}
                {summary.untimedEntries ? <InfoChip label={`${summary.untimedEntries} untimed entries`} tone="amber" /> : null}
              </div>
            </div>
          </div>

          <div style={{...panelCardStyle, padding: "15px", minWidth: 0}}>
            <div style={{fontSize: 11, fontWeight: 900, color: G.textL, textTransform: "uppercase", letterSpacing: 0.75}}>Manage assignments</div>
            <div style={{display: "flex", flexDirection: "column", gap: 9, marginTop: 12}}>
              {(model.institutes || []).map(group => (
                <div key={`profile_inst_${group.key}`} style={{border: `1px solid ${G.border}`, borderRadius: 12, padding: "10px 11px", minWidth: 0}}>
                  <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10}}>
                    <div style={{minWidth: 0}}>
                      <div style={{fontSize: 13.5, fontWeight: 950, color: G.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{group.institute}</div>
                      <div style={{fontSize: 12, color: G.textM, marginTop: 3}}>{group.classCount || 0} classes - {formatDurationShort(group.minutes || 0)}</div>
                    </div>
                    <div style={{display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end"}}>
                      <button type="button" onClick={() => onViewInstituteEntries?.(group.institute)} style={{...toneButtonStyle("neutral"), minHeight: 30, borderRadius: 8, padding: "0 9px", fontSize: 11.5}}>Entries</button>
                      {group.isActionableInstitute && group.sourceGroup?.institute ? (
                        <button type="button" onClick={() => onMoveBranch?.(group.sourceGroup || group)} style={{...toneButtonStyle("blue"), minHeight: 30, borderRadius: 8, padding: "0 9px", fontSize: 11.5}}>Move branch</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {(model.sections || []).map(section => (
                <div key={`profile_class_${section.key}`} style={{display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", border: `1px solid ${G.border}`, borderRadius: 12, padding: "10px 11px", minWidth: 0}}>
                  <div style={{minWidth: 0}}>
                    <div style={{fontSize: 13.5, fontWeight: 950, color: G.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{section.label}</div>
                    <div style={{fontSize: 12, color: G.textM, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{section.institute} - {section.subject}</div>
                  </div>
                  <button type="button" disabled={!section.classId} onClick={() => onRemoveClass?.(section)} style={{...toneButtonStyle("danger", !section.classId), minHeight: 30, borderRadius: 8, padding: "0 9px", fontSize: 11.5}}>Remove</button>
                </div>
              ))}
              {!model.institutes.length && !model.sections.length ? (
                <div style={{fontSize: 13, color: G.textM, lineHeight: 1.55}}>{detailsReady ? "No assignments linked." : "Loading assignments."}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{...panelCardStyle, padding: isMobile ? "13px" : "15px", minWidth: 0}}>
          <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: `1px solid ${G.border}`, paddingBottom: 12, marginBottom: 14}}>
            <div style={{minWidth: 0}}>
              <div style={{fontSize: 11, fontWeight: 900, color: G.textL, textTransform: "uppercase", letterSpacing: 0.75}}>Timeline</div>
              <div style={{fontSize: 19, fontWeight: 950, color: G.text, fontFamily: G.display, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                {selectedSection?.label || "Timeline"}
              </div>
              <div style={{fontSize: 12.5, color: G.textM, marginTop: 5, lineHeight: 1.45}}>
                {selectedSection?.institute || ""} - {selectedSection?.subject || ""} - {formatDurationShort(selectedSection?.minutes || 0)} - {selectedSection?.entries || 0} entries
              </div>
            </div>
            <InfoChip label={`${activeTimeline.visibleCount}/${activeTimeline.totalCount}`} tone="blue" />
          </div>

          {activeTimeline.groups.length ? (
            <div style={{display: "flex", flexDirection: "column", gap: 16}}>
              {activeTimeline.groups.map(group => (
                <div key={`timeline_group_${group.dateKey}`} className="teacher-profile-timeline-group">
                  <div style={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10}}>
                    <div style={{fontSize: 15.5, fontWeight: 950, color: G.text, fontFamily: G.display}}>{dateGroupLabel(group.dateKey)}</div>
                    <div style={{fontSize: 12.5, fontWeight: 850, color: G.textM, whiteSpace: "nowrap"}}>
                      {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"} - {formatDurationShort(group.minutes || 0)}
                    </div>
                  </div>
                  {group.entries.map(entry => <TimelineEntry key={entry.id} entry={entry} />)}
                </div>
              ))}
              {activeTimeline.hasMore ? (
                <button type="button" onClick={onShowMore} style={{...toneButtonStyle("blue"), width: "100%", minHeight: 40}}>
                  Show more
                  <AppIcon icon={IconChevronRight} size={15} color="currentColor" />
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{minHeight: 190, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", border: `1px dashed ${G.borderM}`, borderRadius: 14, background: "#F8FAFC", padding: 18}}>
              <div>
                <AppIcon icon={IconUsersGroup} size={22} color={G.textL} />
                <div style={{fontSize: 16, fontWeight: 950, color: G.text, fontFamily: G.display, marginTop: 8}}>No timeline entries</div>
                <div style={{fontSize: 13, color: G.textM, marginTop: 5}}>{detailsReady ? "This selection has no teaching activity entries." : "Teacher details are loading."}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
