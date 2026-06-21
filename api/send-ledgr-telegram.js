import { requireAdminUser, adminDb } from "./_lib/firebaseAdmin.js";

export const maxDuration = 120;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function trimCaption(value) {
  const clean = String(value || "").trim();
  return clean.length > 1000 ? `${clean.slice(0, 997)}...` : clean;
}

function safePdfFilename(value) {
  const name = String(value || "ledgr-report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "ledgr-report"}.pdf`;
}

function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

async function sendTelegramDocument({ token, chatId, filename, caption, pdfBuffer }) {
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

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await requireAdminUser(req);
      const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
      const configRef = adminDb().doc("config/ledgrTelegramDelivery");
      const configSnap = await configRef.get();
      const savedConfig = configSnap.exists ? (configSnap.data() || {}) : {};
      const health = {
        ...(savedConfig.health || {}),
        manualEndpointReady: !!token,
        manualEndpointReachable: true,
        scheduledEndpointReady: !!savedConfig?.health?.scheduledEndpointReady,
        tokenPresent: !!token,
        lastProbeAt: Date.now(),
      };
      return sendJson(res, 200, {
        ok: !!token,
        health,
        warning: token ? "" : "Missing TELEGRAM_BOT_TOKEN on the server.",
      });
    } catch (error) {
      const status = Number(error?.statusCode || 500);
      return sendJson(res, status, { error: error?.message || "Could not verify messenger delivery." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Use GET to inspect or POST to send Ledgr reports to Telegram." });
  }

  try {
    const adminUser = await requireAdminUser(req);
    const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) {
      return sendJson(res, 500, { error: "Missing TELEGRAM_BOT_TOKEN on the server." });
    }

    const body = parseBody(req);
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    if (!jobs.length) {
      return sendJson(res, 400, { error: "Add at least one Telegram delivery job." });
    }
    if (jobs.length > 25) {
      return sendJson(res, 400, { error: "Too many Telegram delivery jobs in one request." });
    }

    const { renderLedgrPdfBuffer } = await import("./_lib/renderLedgrPdf.js");

    const configRef = adminDb().doc("config/ledgrTelegramDelivery");
    const configSnap = await configRef.get();
    const savedConfig = configSnap.exists ? (configSnap.data() || {}) : {};
    const savedRecipients = Array.isArray(savedConfig.recipients) ? savedConfig.recipients : [];
    const recipientMap = new Map(savedRecipients.map(item => [String(item?.id || ""), item]));

    const now = Date.now();
    const results = [];

    for (const [index, job] of jobs.entries()) {
      const recipientId = String(job?.recipientId || "").trim();
      const html = typeof job?.html === "string" ? job.html : "";
      if (!recipientId) {
        results.push({ ok: false, error: `Job ${index + 1} is missing recipientId.` });
        continue;
      }
      const recipient = recipientMap.get(recipientId);
      if (!recipient) {
        results.push({ recipientId, ok: false, error: "Telegram route is no longer configured." });
        continue;
      }
      if (recipient.enabled === false) {
        results.push({ recipientId, ok: false, error: "Telegram route is paused." });
        continue;
      }
      if (!html || !html.includes("<html")) {
        results.push({ recipientId, ok: false, error: "A complete report HTML document is required." });
        continue;
      }
      if (Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024) {
        results.push({ recipientId, ok: false, error: "Report HTML is too large to render." });
        continue;
      }

      try {
        const pdfBuffer = await renderLedgrPdfBuffer(html);
        const telegramResult = await sendTelegramDocument({
          token,
          chatId: recipient.chatId,
          filename: job?.filename || `${recipient.institute || "ledgr-report"}.pdf`,
          caption: job?.caption || `${recipient.institute || "Ledgr"} report`,
          pdfBuffer,
        });
        results.push({
          recipientId,
          institute: recipient.institute || "",
          label: recipient.label || "",
          chatId: recipient.chatId || "",
          ok: true,
          messageId: telegramResult?.message_id || null,
        });
      } catch (error) {
        results.push({
          recipientId,
          institute: recipient.institute || "",
          label: recipient.label || "",
          chatId: recipient.chatId || "",
          ok: false,
          error: error?.message || "Telegram send failed.",
        });
      }
    }

    const successCount = results.filter(item => item.ok).length;
    const failureCount = results.length - successCount;
    const execution = {
      lastAttemptAt: now,
      lastRunType: "manual",
      lastSentByUid: adminUser.uid,
      lastSentByEmail: adminUser.email || "",
      lastRequestedCount: jobs.length,
      lastDeliveredCount: successCount,
      lastFailureCount: failureCount,
      lastSuccessAt: successCount > 0 ? now : Number(savedConfig.execution?.lastSuccessAt || 0),
      lastErrorMessage: failureCount > 0
        ? String(results.find(item => !item.ok)?.error || "One or more Telegram deliveries failed.")
        : "",
      lastResults: results.slice(-10),
    };
    const health = {
      ...(savedConfig.health || {}),
      manualEndpointReady: true,
      manualEndpointReachable: true,
      tokenPresent: true,
      lastVerifiedAt: now,
    };

    await configRef.set({ execution, health }, { merge: true });

    const payload = {
      ok: failureCount === 0,
      partial: successCount > 0 && failureCount > 0,
      results,
      execution,
      health,
    };
    const status = failureCount === 0 ? 200 : successCount > 0 ? 207 : 502;
    return sendJson(res, status, payload);
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error("Telegram Ledgr send failed", error);
    return sendJson(res, status, { error: error?.message || "Could not send Ledgr reports to Telegram." });
  }
}
