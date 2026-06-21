function trimCaption(value) {
  const clean = String(value || "").trim();
  return clean.length > 1000 ? `${clean.slice(0, 997)}...` : clean;
}

export function safePdfFilename(value) {
  const name = String(value || "ledgr-report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "ledgr-report"}.pdf`;
}

export async function sendTelegramDocument({ token, chatId, filename, caption, pdfBuffer }) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) form.set("caption", trimCaption(caption));
  form.set(
    "document",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    safePdfFilename(filename),
  );

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.description || "Telegram rejected the PDF send.");
    error.statusCode = response.status || 502;
    throw error;
  }

  return payload.result || {};
}
