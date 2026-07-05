export const G = {
  navy:  "#1A2F5A",   navyS: "#243D72",
  blue:  "#1D4ED8",   blueV: "#3B82F6",  blueL: "#DBEAFE",
  bg:     "#F5F7FA",  surface:"#FFFFFF",
  border: "#DDE3ED",  borderM:"#BCC8DC",
  // Text - high contrast for mobile readability
  text:  "#111827",
  textS: "#1F2937",
  textM: "#4B5563",
  textL: "#6B7280",
  red:"#C93030",  redL:"#FDF1F1",
  amber:"#B45309",amberL:"#FEF3C7",
  mono:"'Inter',sans-serif",
  sans:"'Inter',sans-serif",
  display:"'Poppins',sans-serif",
  shadowSm:"0 1px 4px rgba(15,23,42,0.08),0 1px 2px rgba(15,23,42,0.05)",
  shadowMd:"0 4px 14px rgba(15,23,42,0.10),0 2px 4px rgba(15,23,42,0.05)",
};

export const PANEL_RAIL_THEMES = {
  p1: {
    bg: "#E4EEFF",
    edge: "#B8CCF7",
    tab: "#CFE0FF",
    accent: "#1D4ED8",
    text: "#1E3A6D",
  },
  p2: {
    bg: "#FFF1D9",
    edge: "#EBC886",
    tab: "#F9DDAB",
    accent: "#B9770E",
    text: "#6A4708",
  },
  p3: {
    bg: "#E3F7EC",
    edge: "#AFDCC1",
    tab: "#C9EDD9",
    accent: "#198754",
    text: "#1A5A3E",
  },
};

export const APP_ICON_STROKE = 2.05;

export const pill = (bg, color, border) => ({
  background: bg,
  color,
  border: `1px solid ${border || bg}`,
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: G.sans,
  fontWeight: 500,
  transition: "all 0.15s",
});

const SUBJECT_COLOR_PALETTE = ["#1D4ED8","#16A34A","#EA580C","#7C3AED","#0891B2","#DC2626","#CA8A04","#4F46E5"];

export function subjectColor(name){
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash) + text.charCodeAt(i);
  return SUBJECT_COLOR_PALETTE[Math.abs(hash) % SUBJECT_COLOR_PALETTE.length];
}

function hexToRgb(hex){
  const clean = String(hex || "").replace("#","").trim();
  if(clean.length !== 6) return { r:29, g:78, b:216 };
  return {
    r: parseInt(clean.slice(0,2), 16),
    g: parseInt(clean.slice(2,4), 16),
    b: parseInt(clean.slice(4,6), 16),
  };
}

export function mixHex(baseHex, mixHexValue = "#FFFFFF", weight = 0.5){
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHexValue);
  const ratio = Math.max(0, Math.min(1, weight));
  const toHex = value => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(base.r + (mix.r - base.r) * ratio)}${toHex(base.g + (mix.g - base.g) * ratio)}${toHex(base.b + (mix.b - base.b) * ratio)}`;
}

export function alphaHex(baseHex, alpha = 1){
  const { r, g, b } = hexToRgb(baseHex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}
