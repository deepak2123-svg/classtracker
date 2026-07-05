export async function waitForCanvasFonts() {
  try {
    if (document?.fonts?.ready) await document.fonts.ready;
  } catch {}
}

export function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function fitCanvasText(ctx, value, maxWidth) {
  const text = String(value || "");
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  let best = ellipsis;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export function wrapCanvasText(ctx, value, maxWidth) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    if (current) {
      lines.push(current);
      current = word;
      return;
    }
    lines.push(fitCanvasText(ctx, word, maxWidth));
    current = "";
  });
  if (current) lines.push(current);
  return lines;
}

export function drawCanvasPill(ctx, { x, y, label, bg, border, color, font = "700 20px 'Inter',sans-serif", padX = 16, height = 46 }) {
  ctx.save();
  ctx.font = font;
  const textWidth = ctx.measureText(label).width;
  const width = Math.ceil(textWidth + padX * 2);
  drawRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX, y + height / 2 + 1);
  ctx.restore();
  return width;
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}
