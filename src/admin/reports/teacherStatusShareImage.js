import { todayKey } from "../../shared.jsx";
import { slugifyDownloadPart } from "../utils/adminText.js";
import {
  drawCanvasPill,
  drawRoundedRect,
  fitCanvasText,
  triggerBlobDownload,
  waitForCanvasFonts,
} from "./canvasExportUtils.js";

export async function downloadTeacherStatusShareImage({ instituteName, rows, summary, generatedOnLabel }) {
  await waitForCanvasFonts();
  const width = 1080;
  const cardX = 36;
  const cardY = 36;
  const cardWidth = width - cardX * 2;
  const headerHeight = 290;
  const rowHeight = 118;
  const cardHeight = headerHeight + Math.max(1, rows.length) * rowHeight + 28;
  const height = cardY * 2 + cardHeight;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#F4F7FB";
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#DDE3ED";
  ctx.lineWidth = 2;
  ctx.stroke();

  const contentX = cardX + 28;
  const contentWidth = cardWidth - 56;
  let cursorY = cardY + 30;

  ctx.fillStyle = "#111827";
  ctx.font = "800 34px 'Poppins',sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Teacher entry status", contentX, cursorY);

  cursorY += 50;
  ctx.fillStyle = "#1A2F5A";
  ctx.font = "800 30px 'Poppins',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, instituteName, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 40;
  ctx.fillStyle = "#4B5563";
  ctx.font = "600 18px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, `Generated ${generatedOnLabel}`, contentWidth),
    contentX,
    cursorY
  );

  cursorY += 32;
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 20px 'Inter',sans-serif";
  ctx.fillText(
    fitCanvasText(ctx, "Who has updated class logs today, plus week and month entry counts.", contentWidth),
    contentX,
    cursorY
  );

  cursorY += 44;
  let chipX = contentX;
  chipX += drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.updatedToday}/${summary.totalTeachers} updated today`,
    bg: "#DCFCE7",
    border: "#BBF7D0",
    color: "#166534",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  }) + 12;
  chipX += drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.weekEntries} this week`,
    bg: "#F8FAFC",
    border: "#DDE3ED",
    color: "#1F2937",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  }) + 12;
  drawCanvasPill(ctx, {
    x: chipX,
    y: cursorY,
    label: `${summary.monthEntries} this month`,
    bg: "#F8FAFC",
    border: "#DDE3ED",
    color: "#1F2937",
    font: "700 20px 'Inter',sans-serif",
    padX: 18,
    height: 48,
  });

  cursorY += 74;
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, cursorY);
  ctx.lineTo(contentX + contentWidth, cursorY);
  ctx.stroke();
  cursorY += 16;

  const rowsToDraw = rows.length ? rows : [{
    uid: "empty",
    name: "No teacher activity yet",
    classCount: 0,
    todayEntries: 0,
    weekEntries: 0,
    monthEntries: 0,
    todayUpdated: false,
  }];

  rowsToDraw.forEach((item, index) => {
    const rowTop = cursorY + index * rowHeight;
    const rowBottom = rowTop + rowHeight - 12;
    const leftWidth = contentWidth - 240;
    const pillLabel = item.todayUpdated ? "Updated today" : "No update today";
    const safeClassCount = Number.isFinite(item.classCount) ? item.classCount : 0;

    ctx.fillStyle = "#111827";
    ctx.font = "800 30px 'Poppins',sans-serif";
    ctx.fillText(fitCanvasText(ctx, item.name, leftWidth), contentX, rowTop);

    ctx.fillStyle = "#6B7280";
    ctx.font = "600 18px 'Inter',sans-serif";
    const classCountLabel = safeClassCount === 1 ? "1 class in this institute" : `${safeClassCount} classes in this institute`;
    ctx.fillText(fitCanvasText(ctx, classCountLabel, leftWidth), contentX, rowTop + 38);

    ctx.fillStyle = "#6B7280";
    ctx.font = "700 19px 'Inter',sans-serif";
    ctx.fillText(`Today ${item.todayEntries} • Week ${item.weekEntries} • Month ${item.monthEntries}`, contentX, rowTop + 74);

    ctx.font = "700 20px 'Inter',sans-serif";
    const pillWidth = ctx.measureText(pillLabel).width + 36;
    drawCanvasPill(ctx, {
      x: contentX + contentWidth - pillWidth,
      y: rowTop + 4,
      label: pillLabel,
      bg: item.todayUpdated ? "#DCFCE7" : "#F8FAFC",
      border: item.todayUpdated ? "#BBF7D0" : "#DDE3ED",
      color: item.todayUpdated ? "#166534" : "#1F2937",
      font: "700 20px 'Inter',sans-serif",
      padX: 18,
      height: 46,
    });

    if (index < rowsToDraw.length - 1) {
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentX, rowBottom);
      ctx.lineTo(contentX + contentWidth, rowBottom);
      ctx.stroke();
    }
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (blob) {
    triggerBlobDownload(blob, `${slugifyDownloadPart(instituteName)}_teacher_entry_status_${todayKey()}.png`);
    return;
  }
  const fallbackUrl = canvas.toDataURL("image/png");
  const anchor = Object.assign(document.createElement("a"), {
    href: fallbackUrl,
    download: `${slugifyDownloadPart(instituteName)}_teacher_entry_status_${todayKey()}.png`,
  });
  anchor.click();
}
