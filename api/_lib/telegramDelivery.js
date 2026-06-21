function trimCaption(value) {
  const clean = String(value || "").trim();
  return clean.length > 1000 ? `${clean.slice(0, 997)}...` : clean;
}

async function telegramApiJson(token, method, searchParams = null) {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  const response = await fetch(url);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.description || `Telegram ${method} request failed.`);
    error.statusCode = response.status || 502;
    throw error;
  }
  return payload.result;
}

export function safePdfFilename(value) {
  const name = String(value || "ledgr-report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "ledgr-report"}.pdf`;
}

function extractPrivateChatCandidate(update) {
  const containers = [
    update?.message,
    update?.edited_message,
    update?.my_chat_member,
    update?.chat_member,
  ].filter(Boolean);
  for (const entry of containers) {
    const chat = entry?.chat;
    const from = entry?.from || entry?.new_chat_member?.user || entry?.old_chat_member?.user;
    if (String(chat?.type || "").trim() !== "private") continue;
    const chatId = String(chat?.id || from?.id || "").trim();
    if (!chatId) continue;
    const usernameRaw = String(from?.username || chat?.username || "").trim();
    const username = usernameRaw ? (usernameRaw.startsWith("@") ? usernameRaw : `@${usernameRaw}`) : "";
    const firstName = String(from?.first_name || chat?.first_name || "").trim();
    const lastName = String(from?.last_name || chat?.last_name || "").trim();
    const label = `${firstName} ${lastName}`.trim() || username || chatId;
    const seenAt = Number(entry?.date || 0) || 0;
    return {
      id: `private_${chatId}`,
      chatId,
      username,
      label,
      firstName,
      lastName,
      destinationType: "private",
      seenAt,
    };
  }
  return null;
}

export async function listTelegramRecentPrivateContacts({ token, limit = 100 } = {}) {
  const updates = await telegramApiJson(token, "getUpdates", {
    limit: Math.max(1, Math.min(Number(limit || 100), 100)),
    timeout: 0,
  });
  const contactMap = new Map();
  (Array.isArray(updates) ? updates : []).forEach(update => {
    const candidate = extractPrivateChatCandidate(update);
    if (!candidate?.chatId) return;
    const existing = contactMap.get(candidate.chatId);
    if (!existing || candidate.seenAt >= existing.seenAt) {
      contactMap.set(candidate.chatId, candidate);
    }
  });
  return [...contactMap.values()]
    .sort((a, b) => Number(b?.seenAt || 0) - Number(a?.seenAt || 0))
    .map(({ seenAt, ...item }) => ({
      ...item,
      lastSeenAt: seenAt > 0 ? seenAt * 1000 : 0,
    }));
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
