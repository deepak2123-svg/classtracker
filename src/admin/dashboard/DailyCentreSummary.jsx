import React from "react";
import { G } from "../styles/adminTheme.js";
import { getEntriesInRange } from "../utils/adminDates.js";
import { activeAdminTeacherClasses } from "../utils/adminTeachers.js";
import { sameInstituteName } from "../utils/adminText.js";

export function DailyCentreSummary({ institutes, teachers, fullData, instituteStats, onSelectInstitute }) {
  const [filter, setFilter] = React.useState("all");
  const [copied, setCopied] = React.useState(false);

  const rows = React.useMemo(() => {
    return institutes.map(inst => {
      const stats = instituteStats[inst] || { teacherCount: 0, classCount: 0 };
      // Use the same teacher-membership logic as instituteStats for consistency
      const instTeachers = teachers.filter(t => {
        const d = fullData[t.uid];
        const hasClassHere = d && activeAdminTeacherClasses(d).some(c => sameInstituteName(c?.institute, inst));
        const listedHere = (t.institutes || []).some(i => sameInstituteName(i, inst));
        return hasClassHere || listedHere;
      });
      // Use instituteStats.teacherCount as the authoritative registered count
      const registered = stats.teacherCount || instTeachers.length;
      let weekEntries = 0;
      const todayUpdatedTeachers = instTeachers.filter(t => {
        const d = fullData[t.uid];
        if (!d) return false;
        return activeAdminTeacherClasses(d)
          .filter(c => sameInstituteName(c?.institute, inst))
          .some(c => getEntriesInRange((d.notes || {})[c.id] || {}, 1).length > 0);
      }).length;
      instTeachers.forEach(t => {
        const d = fullData[t.uid];
        if (!d) return;
        const classesHere = activeAdminTeacherClasses(d).filter(c => sameInstituteName(c?.institute, inst));
        classesHere.forEach(c => {
          const notes = (d.notes || {})[c.id] || {};
          weekEntries += getEntriesInRange(notes, 7).length;
        });
      });
      // Teachers who haven't filled any entry this week
      const notFilledThisWeek = instTeachers.filter(t => {
        const d = fullData[t.uid];
        if (!d) return true;
        const classesHere = activeAdminTeacherClasses(d).filter(c => sameInstituteName(c?.institute, inst));
        return classesHere.every(c => getEntriesInRange((d.notes || {})[c.id] || {}, 7).length === 0);
      }).length;
      return { inst, registered, todayFilled: todayUpdatedTeachers, weekEntries, notFilledThisWeek };
    });
  }, [institutes, teachers, fullData, instituteStats]);

  const getStatus = row => {
    if (row.registered === 0) return "none";
    const p = row.todayFilled / row.registered;
    if (p >= 0.7) return "green";
    if (p >= 0.3) return "amber";
    return "red";
  };

  const visible = rows.filter(row => {
    const s = getStatus(row);
    if (filter === "all") return true;
    if (filter === "red") return s === "red" || s === "none";
    if (filter === "green") return s === "green";
    if (filter === "low") return row.registered === 0;
    return true;
  });

  const totalReg = rows.reduce((s, r) => s + r.registered, 0);
  const totalFilled = rows.reduce((s, r) => s + r.todayFilled, 0);
  const compPct = totalReg > 0 ? Math.round(totalFilled / totalReg * 100) : 0;
  const onTrackCount = rows.filter(r => getStatus(r) === "green").length;

  const dotColor = row => {
    const s = getStatus(row);
    return s === "green" ? "#16a34a" : s === "amber" ? "#b45309" : s === "red" ? "#C93030" : "#9ca3af";
  };
  const barColor = pct => pct >= 0.7 ? "#16a34a" : pct >= 0.3 ? "#b45309" : "#C93030";

  const handleCopy = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const lines = [`*Daily centre summary — ${dateStr}*\n`];
    const behind = rows.filter(r => { const s = getStatus(r); return s === "red" || s === "none"; });
    const good = rows.filter(r => getStatus(r) === "green");
    if (good.length) lines.push(`*Doing well:*\n${good.map(r => `✅ ${r.inst} — ${r.todayFilled}/${r.registered} teachers filled`).join("\n")}`);
    if (behind.length) lines.push(`\n*Needs follow-up:*\n${behind.map(r => `${r.registered === 0 ? "⭕" : "🔴"} ${r.inst} — ${r.registered === 0 ? "0 registered" : `${r.todayFilled}/${r.registered} filled today, ${r.notFilledThisWeek} not filled this week`}`).join("\n")}`);
    lines.push(`\n_Overall: ${totalFilled}/${totalReg} teachers updated today (${compPct}%)_`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const chipStyle = (active) => ({
    fontSize: 12, padding: "4px 12px", borderRadius: 999,
    border: `1px solid ${active ? G.borderM : G.border}`,
    background: active ? G.surface : "transparent",
    color: active ? G.text : G.textM,
    cursor: "pointer", fontFamily: G.sans, fontWeight: active ? 600 : 400,
    display: "inline-flex", alignItems: "center", gap: 5,
  });

  const filterBtns = [
    { key: "all", label: "All centres" },
    { key: "red", label: "Needs attention" },
    { key: "green", label: "On track" },
    { key: "low", label: "Not registered" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: G.text, fontFamily: G.display }}>Daily centre summary</div>
          <div style={{ fontSize: 14, color: G.textM, marginTop: 4 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <button
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: copied ? "#ECFDF5" : G.navy,
            color: copied ? "#166534" : "#fff",
            border: "none", borderRadius: 10, padding: "9px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: G.sans,
            transition: "all 0.2s",
          }}>
          {copied ? "✓ Copied!" : "Copy WhatsApp report"}
        </button>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        {[
          { label: "Total centres", value: institutes.length, sub: "across all regions" },
          { label: "Teachers on app", value: totalReg, sub: `of ${teachers.length} total` },
          { label: "Updated today", value: totalFilled, sub: `${compPct}% compliance` },
          { label: "Centres on track", value: onTrackCount, sub: "≥70% filled today" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: "12px 14px", boxShadow: G.shadowSm }}>
            <div style={{ fontSize: 11, color: G.textL, fontFamily: G.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: G.blue, fontFamily: G.display, marginTop: 4, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 12, color: G.textM, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {filterBtns.map(({ key, label }) => (
          <button key={key} style={chipStyle(filter === key)} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, overflow: "hidden", boxShadow: G.shadowSm }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              {["", "Centre", "Registered", "Today's entries", "This week", "Not filled (wk)", "Status"].map((h, i) => (
                <th key={i} style={{
                  fontSize: 11, fontWeight: 700, color: G.textM, padding: "8px 10px",
                  textAlign: i >= 2 && i !== 3 ? "right" : "left",
                  fontFamily: G.mono, textTransform: "uppercase", letterSpacing: 0.5,
                  background: G.bg, whiteSpace: "nowrap",
                  width: i === 0 ? 36 : "auto",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: G.textM, fontSize: 14 }}>No centres match this filter</td></tr>
            ) : visible.map(row => {
              const pct = row.registered > 0 ? row.todayFilled / row.registered : 0;
              const barW = Math.round(pct * 100);
              const filledPct = row.registered > 0 ? Math.round(pct * 100) : 0;
              const s = getStatus(row);
              return (
                <tr key={row.inst}
                  onClick={() => onSelectInstitute(row.inst)}
                  style={{ borderBottom: `1px solid ${G.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = G.bg)}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                >
                  <td style={{ paddingLeft: 14, width: 36 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(row) }} />
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{row.inst}</div>
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{row.registered}</div>
                  </td>
                  <td style={{ padding: "12px 10px", minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: G.bg, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ height: "100%", width: `${barW}%`, borderRadius: 999, background: barColor(pct) }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: "right", color: G.text }}>
                        {row.todayFilled}/{row.registered}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: G.textL, marginTop: 3, paddingLeft: 2 }}>{filledPct}% filled today</div>
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right", fontSize: 14, fontWeight: 600, color: G.text }}>{row.weekEntries}</td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    {row.notFilledThisWeek > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: G.red }}>{row.notFilledThisWeek}</span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    {s === "none" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.bg, color: G.textM, fontWeight: 700, border: `1px solid ${G.border}` }}>No activity</span>}
                    {s === "green" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#DCFCE7", color: "#166534", fontWeight: 700 }}>✓ On track</span>}
                    {s === "amber" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.amberL, color: G.amber, fontWeight: 700 }}>Partial</span>}
                    {s === "red" && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: G.redL, color: G.red, fontWeight: 700 }}>Behind</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${G.border}`, fontSize: 12, color: G.textL, fontFamily: G.mono }}>
          Click any row to drill into that institute
        </div>
      </div>
    </div>
  );
}
