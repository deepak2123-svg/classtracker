import { safePdfFilename, sendTelegramDocument } from "./_lib/telegramDelivery.js";

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

function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

function normaliseRouteRecipient(item, index = 0) {
  const id = String(item?.id || item?.recipientId || "").trim();
  const institute = String(item?.institute || "").trim();
  const usernameRaw = String(item?.username || "").trim().replace(/\s+/g, "");
  const username = usernameRaw ? (usernameRaw.startsWith("@") ? usernameRaw : `@${usernameRaw}`) : "";
  const chatId = String(item?.chatId || "").trim().replace(/\s+/g, "");
  if (!id || !chatId) return null;
  return {
    id,
    institute,
    label: String(item?.label || "").trim(),
    username,
    chatId,
    notes: String(item?.notes || "").trim(),
    destinationType: ["channel", "group", "private"].includes(item?.destinationType)
      ? item.destinationType
      : "channel",
    enabled: item?.enabled !== false,
    sortIndex: index,
  };
}

function readJobPdfBuffer(job) {
  const pdfBase64 = String(job?.pdfBase64 || "").trim();
  if (!pdfBase64) return null;
  const buffer = Buffer.from(pdfBase64, "base64");
  return buffer.length ? buffer : null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
      let savedConfig = {};
      let firebaseAdminReady = false;
      let firebaseAdminError = "";
      try {
        const { adminDb } = await import("./_lib/firebaseAdmin.js");
        const configRef = adminDb().doc("config/ledgrTelegramDelivery");
        const configSnap = await configRef.get();
        savedConfig = configSnap.exists ? (configSnap.data() || {}) : {};
        firebaseAdminReady = true;
      } catch (error) {
        firebaseAdminReady = false;
        firebaseAdminError = error?.message || "Firebase Admin is not ready on the server.";
      }
      const health = {
        ...(savedConfig.health || {}),
        manualEndpointReady: !!token && firebaseAdminReady,
        manualEndpointReachable: true,
        scheduledEndpointReady: !!token && firebaseAdminReady,
        tokenPresent: !!token,
        firebaseAdminReady,
        lastProbeAt: Date.now(),
      };
      return sendJson(res, 200, {
        ok: !!token && firebaseAdminReady,
        health,
        warning: !token
          ? "Missing TELEGRAM_BOT_TOKEN on the server."
          : firebaseAdminReady
            ? ""
            : firebaseAdminError,
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
    const { requireAdminUser, adminDb } = await import("./_lib/firebaseAdmin.js");
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

    const configRef = adminDb().doc("config/ledgrTelegramDelivery");
    const configSnap = await configRef.get();
    const savedConfig = configSnap.exists ? (configSnap.data() || {}) : {};
    const savedRecipients = Array.isArray(savedConfig.recipients) ? savedConfig.recipients : [];
    const requestRecipients = Array.isArray(body.recipients)
      ? body.recipients
          .map((item, index) => normaliseRouteRecipient(item, index))
          .filter(Boolean)
      : [];
    const mergedRecipients = [...savedRecipients];
    requestRecipients.forEach(item => {
      const index = mergedRecipients.findIndex(saved => String(saved?.id || "").trim() === item.id);
      if (index >= 0) {
        mergedRecipients[index] = {
          ...mergedRecipients[index],
          ...item,
        };
      } else {
        mergedRecipients.push(item);
      }
    });
    const recipientMap = new Map(mergedRecipients.map(item => [String(item?.id || "").trim(), item]));

    const now = Date.now();
    const results = [];

    for (const [index, job] of jobs.entries()) {
      const recipientId = String(job?.recipientId || "").trim();
      const html = typeof job?.html === "string" ? job.html : "";
      const pdfBufferFromJob = readJobPdfBuffer(job);
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
      if (!pdfBufferFromJob && (!html || !html.includes("<html"))) {
        results.push({ recipientId, ok: false, error: "A report PDF or complete HTML document is required." });
        continue;
      }
      if (pdfBufferFromJob && pdfBufferFromJob.byteLength > 10 * 1024 * 1024) {
        results.push({ recipientId, ok: false, error: "Report PDF is too large to send." });
        continue;
      }
      if (!pdfBufferFromJob && Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024) {
        results.push({ recipientId, ok: false, error: "Report HTML is too large to render." });
        continue;
      }

      try {
        const pdfBuffer = pdfBufferFromJob || await (async () => {
          const { renderLedgrPdfBuffer } = await import("./_lib/renderLedgrPdf.js");
          return renderLedgrPdfBuffer(html);
        })();
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
          username: recipient.username || "",
          chatId: recipient.chatId || "",
          ok: true,
          messageId: telegramResult?.message_id || null,
        });
      } catch (error) {
        results.push({
          recipientId,
          institute: recipient.institute || "",
          label: recipient.label || "",
          username: recipient.username || "",
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
