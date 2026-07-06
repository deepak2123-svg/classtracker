import { G } from "../styles/adminTheme.js";
import { drawRoundedRect, waitForCanvasFonts, wrapCanvasText } from "./canvasExportUtils.js";

export async function renderInstituteGlanceCopyTextImageBlob({ text, mimeType = "image/png" } = {}) {
  await waitForCanvasFonts();
  const safeText = String(text || "").trim();
  if (!safeText) throw new Error("No report text available.");

  const rawLines = safeText.split(/\r?\n/);
  const readValue = (prefix, fallback = "") => {
    const found = rawLines.find(line => line.toLowerCase().startsWith(prefix.toLowerCase()));
    return found ? found.replace(new RegExp(`^${prefix}\\s*`, "i"), "").trim() : fallback;
  };
  const centre = readValue("Centre:", "Institute");
  const generated = readValue("Report generated:", "");
  const period = readValue("Period:", "Today");
  const summary = readValue("Summary:", "");
  const bodyStart = rawLines.findIndex(line => /^Updated\s*\(/i.test(line));
  const bodyLines = rawLines.slice(bodyStart >= 0 ? bodyStart : 0);

  const width = 1180;
  const margin = 34;
  const cardX = 28;
  const cardY = 28;
  const cardWidth = width - cardX * 2;
  const contentX = cardX + margin;
  const contentWidth = cardWidth - margin * 2;
  const metaGap = 14;
  const metaWidth = (contentWidth - metaGap * 2) / 3;
  const rowGap = 8;
  const sectionGap = 14;

  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = width;
  measureCanvas.height = 400;
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas is not available.");

  const reportLineMeta = bodyLines.map(line => {
    const value = String(line || "");
    const blank = !value.trim();
    const heading = /^Updated\s*\(|^Not updated\s*\(/i.test(value.trim());
    const font = heading ? "800 24px 'Poppins',sans-serif" : "600 17px 'Inter',sans-serif";
    measureCtx.font = font;
    const wrapped = blank ? [] : wrapCanvasText(measureCtx, value, contentWidth - (heading ? 0 : 14));
    const lineHeight = heading ? 31 : 23;
    return {
      value,
      blank,
      heading,
      wrapped,
      font,
      lineHeight,
      height: blank ? 12 : wrapped.length * lineHeight + (heading ? sectionGap : rowGap),
    };
  });

  const titleFont = "800 42px 'Poppins',sans-serif";
  measureCtx.font = titleFont;
  const titleLines = wrapCanvasText(measureCtx, centre, contentWidth);
  const titleHeight = Math.max(52, titleLines.length * 50);
  const bodyHeight = reportLineMeta.reduce((sum, item) => sum + item.height, 0);
  const cardHeight = 42 + 22 + titleHeight + 92 + 28 + bodyHeight + 34;
  const height = Math.max(760, Math.ceil(cardY * 2 + cardHeight));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.fillStyle = "#F5F7FA";
  ctx.fillRect(0, 0, width, height);
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#DDE3ED";
  ctx.lineWidth = 2;
  ctx.stroke();

  let y = cardY + 34;
  ctx.fillStyle = G.blue;
  ctx.font = "900 16px 'Inter',sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("LEDGR REPORT", contentX, y);
  y += 28;

  ctx.fillStyle = G.text;
  ctx.font = titleFont;
  titleLines.forEach(line => {
    ctx.fillText(line, contentX, y);
    y += 50;
  });
  y += 12;

  const metaItems = [
    { label: "Generated", value: generated || "Just now" },
    { label: "Period", value: period },
    { label: "Summary", value: summary || "No summary available" },
  ];
  metaItems.forEach((item, index) => {
    const x = contentX + index * (metaWidth + metaGap);
    drawRoundedRect(ctx, x, y, metaWidth, 78, 16);
    ctx.fillStyle = "#EEF4FF";
    ctx.fill();
    ctx.strokeStyle = "#C7D7F5";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = G.blue;
    ctx.font = "900 12px 'Inter',sans-serif";
    ctx.fillText(item.label.toUpperCase(), x + 17, y + 15);
    ctx.fillStyle = G.text;
    ctx.font = "800 18px 'Inter',sans-serif";
    const lines = wrapCanvasText(ctx, item.value, metaWidth - 34).slice(0, 2);
    lines.forEach((line, lineIndex) => ctx.fillText(line, x + 17, y + 39 + lineIndex * 20));
  });
  y += 106;

  reportLineMeta.forEach(item => {
    if (item.blank) {
      y += item.height;
      return;
    }
    ctx.font = item.font;
    ctx.fillStyle = item.heading ? G.text : "#334155";
    if (item.heading) {
      drawRoundedRect(ctx, contentX, y - 4, contentWidth, 42, 14);
      ctx.fillStyle = "#F8FAFC";
      ctx.fill();
      ctx.strokeStyle = "#E5EAF2";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = G.text;
      item.wrapped.forEach((line, lineIndex) => ctx.fillText(line, contentX + 16, y + lineIndex * item.lineHeight));
    } else {
      item.wrapped.forEach((line, lineIndex) => ctx.fillText(line, contentX + 8, y + lineIndex * item.lineHeight));
    }
    y += item.height;
  });

  const imageType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const quality = imageType === "image/jpeg" ? 0.94 : undefined;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, imageType, quality));
  if (!blob) throw new Error("Could not render report image.");
  return blob;
}

export async function copyBlobImageToClipboard(blob) {
  if (!blob) throw new Error("No image available.");
  if (!navigator?.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported in this browser.");
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}
