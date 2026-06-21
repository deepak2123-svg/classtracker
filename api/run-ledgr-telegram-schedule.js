import { adminDb } from "./_lib/firebaseAdmin.js";
import { buildScheduledTelegramJobs, getDueScheduledSlot } from "./_lib/ledgrReportServer.js";
import { renderLedgrPdfBuffer } from "./_lib/renderLedgrPdf.js";
import { sendTelegramDocument } from "./_lib/telegramDelivery.js";

export const maxDuration = 120;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function isTrustedSchedulerRequest(req) {
  const userAgent = String(req.headers["user-agent"] || req.headers["User-Agent"] || "");
  if (/vercel-cron/i.test(userAgent)) return true;
  const expectedSecret = String(process.env.LEDGR_SCHEDULER_SECRET || "").trim();
  const providedSecret = String(req.headers["x-ledgr-scheduler-secret"] || "").trim();
  return !!expectedSecret && !!providedSecret && providedSecret === expectedSecret;
}

function createRunError(message, { consumeSlot = false } = {}) {
  const error = new Error(message);
  error.consumeSlot = consumeSlot;
  return error;
}

async function claimScheduledSlot(scheduleRef, slot) {
  const db = scheduleRef.firestore;
  const nowMs = slot.dateContext.nowMs;
  let schedule = null;
  let reason = "";

  await db.runTransaction(async tx => {
    const snap = await tx.get(scheduleRef);
    schedule = snap.exists ? (snap.data() || {}) : {};
    const execution = schedule.execution || {};
    const lastSlotKey = String(execution.lastSlotKey || "");
    const activeSlotKey = String(execution.activeSlotKey || "");
    const activeClaimedAt = Number(execution.activeClaimedAt || 0);
    const activeFresh = activeSlotKey === slot.slotKey && (nowMs - activeClaimedAt) < (30 * 60 * 1000);

    if (lastSlotKey === slot.slotKey) {
      reason = "already_sent";
      return;
    }
    if (activeFresh) {
      reason = "already_claimed";
      return;
    }

    tx.set(scheduleRef, {
      "execution.activeSlotKey": slot.slotKey,
      "execution.activeClaimedAt": nowMs,
      "execution.lastAttemptAt": nowMs,
      "execution.lastAttemptStatus": "claimed",
      "execution.lastRunType": "scheduled",
      "execution.lastLocalDateKey": slot.dateContext.todayKey,
      "execution.lastLocalTimeKey": slot.dueTimeKey,
      "execution.lastTimezone": slot.timeZone,
    }, { merge: true });
  });

  return {
    claimed: !reason,
    reason,
    schedule,
  };
}

async function finalizeScheduledRun({
  scheduleRef,
  telegramRef,
  slot,
  previousSchedule = {},
  previousTelegramConfig = {},
  requestedCount = 0,
  deliveredCount = 0,
  failureCount = 0,
  results = [],
  errorMessage = "",
  status = "failed",
  consumeSlot = true,
}) {
  const nowMs = slot.dateContext.nowMs;
  const previousExecution = previousTelegramConfig.execution || {};
  const lastSuccessAt = deliveredCount > 0
    ? nowMs
    : Number(previousExecution.lastSuccessAt || previousSchedule?.execution?.lastSuccessAt || 0);
  const health = {
    manualEndpointReady: true,
    manualEndpointReachable: true,
    scheduledEndpointReady: true,
    tokenPresent: true,
    firebaseAdminReady: true,
    lastVerifiedAt: nowMs,
  };

  const schedulePatch = {
    "execution.activeSlotKey": "",
    "execution.activeClaimedAt": 0,
    "execution.lastAttemptAt": nowMs,
    "execution.lastAttemptStatus": status,
    "execution.lastRunType": "scheduled",
    "execution.lastLocalDateKey": slot.dateContext.todayKey,
    "execution.lastLocalTimeKey": slot.dueTimeKey,
    "execution.lastTimezone": slot.timeZone,
    "execution.lastRequestedCount": requestedCount,
    "execution.lastDeliveredCount": deliveredCount,
    "execution.lastFailureCount": failureCount,
    "execution.lastSuccessAt": lastSuccessAt,
    "execution.lastErrorMessage": String(errorMessage || "").trim(),
  };
  if (consumeSlot) {
    schedulePatch["execution.lastSlotKey"] = slot.slotKey;
    schedulePatch["execution.lastRunAt"] = nowMs;
    schedulePatch.lastRunAt = nowMs;
  }

  const telegramPatch = {
    "execution.lastAttemptAt": nowMs,
    "execution.lastRunType": "scheduled",
    "execution.lastRequestedCount": requestedCount,
    "execution.lastDeliveredCount": deliveredCount,
    "execution.lastFailureCount": failureCount,
    "execution.lastSuccessAt": lastSuccessAt,
    "execution.lastErrorMessage": String(errorMessage || "").trim(),
    "execution.lastResults": results.slice(-10),
    "execution.lastScheduledSlotKey": consumeSlot ? slot.slotKey : "",
    "execution.lastScheduledLocalDate": slot.dateContext.todayKey,
    "execution.lastScheduledLocalTime": slot.dueTimeKey,
    "execution.lastScheduledTimezone": slot.timeZone,
    "health.manualEndpointReady": health.manualEndpointReady,
    "health.manualEndpointReachable": health.manualEndpointReachable,
    "health.scheduledEndpointReady": health.scheduledEndpointReady,
    "health.tokenPresent": health.tokenPresent,
    "health.firebaseAdminReady": health.firebaseAdminReady,
    "health.lastVerifiedAt": health.lastVerifiedAt,
  };

  await Promise.all([
    scheduleRef.set(schedulePatch, { merge: true }),
    telegramRef.set(telegramPatch, { merge: true }),
  ]);
}

function buildHealthPayload(schedule = {}, telegramConfig = {}, slot) {
  return {
    ok: true,
    mode: slot.mode || "daily_batch",
    scheduleEnabled: !!schedule?.enabled,
    messengerEnabled: telegramConfig?.enabled !== false,
    scheduledDeliveryEnabled: telegramConfig?.delivery?.scheduledEnabled !== false,
    timeZone: slot.timeZone,
    localDateKey: slot.dateContext.todayKey,
    localTimeKey: slot.dateContext.currentTimeKey,
    batchTimeKey: slot.dueTimeKey,
    slotKey: slot.slotKey,
    scheduleTimes: slot.times,
    lastRunAt: Number(schedule?.execution?.lastRunAt || schedule?.lastRunAt || 0),
    lastSlotKey: String(schedule?.execution?.lastSlotKey || ""),
    lastAttemptStatus: String(schedule?.execution?.lastAttemptStatus || ""),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Use GET to inspect or run the Telegram scheduler." });
  }

  const db = adminDb();
  const scheduleRef = db.doc("config/ledgrReportSchedule");
  const telegramRef = db.doc("config/ledgrTelegramDelivery");
  const [scheduleSnap, telegramSnap] = await Promise.all([
    scheduleRef.get(),
    telegramRef.get(),
  ]);
  const schedule = scheduleSnap.exists ? (scheduleSnap.data() || {}) : {};
  const telegramConfig = telegramSnap.exists ? (telegramSnap.data() || {}) : {};
  const slot = getDueScheduledSlot(schedule, new Date());

  if (!isTrustedSchedulerRequest(req)) {
    return sendJson(res, 200, buildHealthPayload(schedule, telegramConfig, slot));
  }

  if (!slot.enabled) {
    return sendJson(res, 200, { ok: true, state: "disabled", ...buildHealthPayload(schedule, telegramConfig, slot) });
  }
  if (telegramConfig?.enabled === false || telegramConfig?.delivery?.scheduledEnabled === false) {
    return sendJson(res, 200, { ok: true, state: "paused", ...buildHealthPayload(schedule, telegramConfig, slot) });
  }

  const claim = await claimScheduledSlot(scheduleRef, slot);
  if (!claim.claimed) {
    return sendJson(res, 200, { ok: true, state: claim.reason, ...buildHealthPayload(schedule, telegramConfig, slot) });
  }

  try {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) {
      throw createRunError("Missing TELEGRAM_BOT_TOKEN on the server.", { consumeSlot: true });
    }

    const payload = await buildScheduledTelegramJobs({
      db,
      schedule: claim.schedule,
      telegramConfig,
      now: slot.dateContext.now,
    });
    if (!payload.jobs.length) {
      throw createRunError("No active Telegram routes match the saved schedule scope.", { consumeSlot: true });
    }

    const renderCache = new Map();
    const results = [];

    for (const job of payload.jobs) {
      const renderKey = job.filename;
      if (!renderCache.has(renderKey)) {
        renderCache.set(renderKey, renderLedgrPdfBuffer(job.html)
          .then(pdfBuffer => ({ ok: true, pdfBuffer }))
          .catch(error => ({ ok: false, error: error?.message || "Could not render Ledgr PDF." })));
      }
      const renderResult = await renderCache.get(renderKey);
      if (!renderResult?.ok) {
        results.push({
          recipientId: job.recipientId,
          institute: job.institute,
          chatId: job.chatId,
          ok: false,
          error: renderResult?.error || "Could not render Ledgr PDF.",
        });
        continue;
      }

      try {
        const telegramResult = await sendTelegramDocument({
          token,
          chatId: job.chatId,
          filename: job.filename,
          caption: job.caption,
          pdfBuffer: renderResult.pdfBuffer,
        });
        results.push({
          recipientId: job.recipientId,
          institute: job.institute,
          chatId: job.chatId,
          ok: true,
          messageId: telegramResult?.message_id || null,
        });
      } catch (error) {
        results.push({
          recipientId: job.recipientId,
          institute: job.institute,
          chatId: job.chatId,
          ok: false,
          error: error?.message || "Telegram send failed.",
        });
      }
    }

    const deliveredCount = results.filter(item => item.ok).length;
    const failureCount = results.length - deliveredCount;
    const status = failureCount === 0 ? "success" : deliveredCount > 0 ? "partial" : "failed";
    const errorMessage = failureCount > 0
      ? String(results.find(item => !item.ok)?.error || "One or more scheduled Telegram sends failed.")
      : "";

    await finalizeScheduledRun({
      scheduleRef,
      telegramRef,
      slot,
      previousSchedule: claim.schedule,
      previousTelegramConfig: telegramConfig,
      requestedCount: payload.jobs.length,
      deliveredCount,
      failureCount,
      results,
      errorMessage,
      status,
      consumeSlot: true,
    });

    return sendJson(res, failureCount === 0 ? 200 : deliveredCount > 0 ? 207 : 502, {
      ok: failureCount === 0,
      partial: deliveredCount > 0 && failureCount > 0,
      state: status,
      deliveredCount,
      failureCount,
      results,
      slotKey: slot.slotKey,
      dueTimeKey: slot.dueTimeKey,
      localDateKey: slot.dateContext.todayKey,
    });
  } catch (error) {
    const consumeSlot = error?.consumeSlot === true;
    await finalizeScheduledRun({
      scheduleRef,
      telegramRef,
      slot,
      previousSchedule: claim.schedule,
      previousTelegramConfig: telegramConfig,
      requestedCount: 0,
      deliveredCount: 0,
      failureCount: 1,
      results: [],
      errorMessage: error?.message || "Scheduled Telegram run failed.",
      status: consumeSlot ? "failed" : "retry_pending",
      consumeSlot,
    });
    console.error("Scheduled Telegram run failed", error);
    return sendJson(res, consumeSlot ? 500 : 503, {
      ok: false,
      state: consumeSlot ? "failed" : "retry_pending",
      error: error?.message || "Scheduled Telegram run failed.",
      slotKey: slot.slotKey,
      dueTimeKey: slot.dueTimeKey,
    });
  }
}
