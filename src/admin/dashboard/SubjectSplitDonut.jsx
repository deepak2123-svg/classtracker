import React from "react";
import { alphaHex, mixHex } from "../styles/adminTheme.js";
import { formatDurationShort } from "../utils/adminDates.js";

export function SubjectSplitDonut({ segments, totalMinutes, size = 120, strokeWidth = 18 }) {
  const safeTotal = Math.max(0, totalMinutes || 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const chartId = React.useId ? React.useId().replace(/[:]/g, "") : `chart_${size}_${strokeWidth}`;
  const sortedSegments = [...(segments || [])].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  const primaryColor = sortedSegments[0]?.color || "#1D4ED8";
  const ringGap = sortedSegments.length > 1 ? Math.min(5, circumference * 0.014) : 0;
  const innerRadius = Math.max(radius - strokeWidth / 2 - 5, 18);
  const totalLabel = safeTotal > 0 ? formatDurationShort(safeTotal) : "Untimed";
  const totalFontSize = totalLabel.length >= 7 ? 13 : totalLabel.length >= 5 ? 15 : 17;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        {sortedSegments.map((seg, index) => (
          <linearGradient key={`${seg.subject}_${index}_grad`} id={`${chartId}_grad_${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={mixHex(seg.color, "#FFFFFF", 0.2)} />
            <stop offset="100%" stopColor={mixHex(seg.color, "#0F172A", 0.08)} />
          </linearGradient>
        ))}
        <filter id={`${chartId}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={alphaHex(primaryColor, 0.16)} />
        </filter>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius + 5}
        fill={alphaHex(primaryColor, 0.06)}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E7EDF6"
        strokeWidth={strokeWidth}
      />
      {safeTotal > 0 && sortedSegments.map((seg, index) => {
        const rawLength = (seg.minutes / safeTotal) * circumference;
        const segmentLength = Math.max(rawLength - ringGap, 0);
        const segmentOffset = offset + ringGap / 2;
        const circle = (
          <circle
            key={`${seg.subject}_${seg.minutes}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${chartId}_grad_${index})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${Math.max(circumference - segmentLength, 0)}`}
            strokeDashoffset={-segmentOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter={`url(#${chartId}_shadow)`}
          />
        );
        offset += rawLength;
        return circle;
      })}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={innerRadius}
        fill="#FFFFFF"
        stroke="#EEF2F7"
        strokeWidth="1.5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={Math.max(innerRadius - 4, 10)}
        fill={safeTotal > 0 ? alphaHex(primaryColor, 0.06) : "#F8FAFC"}
      />
      <text
        x="50%"
        y={safeTotal > 0 ? "47%" : "44%"}
        textAnchor="middle"
        style={{ fill: "#111827", fontSize: safeTotal > 0 ? totalFontSize : 12, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}
      >
        {totalLabel}
      </text>
      <text
        x="50%"
        y={safeTotal > 0 ? "61%" : "60%"}
        textAnchor="middle"
        style={{ fill: "#6B7280", fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: 0.9 }}
      >
        {safeTotal > 0 ? `${sortedSegments.length} ${sortedSegments.length === 1 ? "subject" : "subjects"}` : "logs only"}
      </text>
    </svg>
  );
}
