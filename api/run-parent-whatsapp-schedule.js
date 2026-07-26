import { adminDb } from "./_lib/firebaseAdmin.js";
import { getParentDateContext } from "./_lib/parentWhatsAppCore.js";
import {
  enqueueParentSectionJob,
  parentWhatsAppBaseUrl,
  readRawRequestBody,
  verifyQstashRequest,
} from "./_lib/parentWhatsAppDelivery.js";
import {
  claimParentGlobalSlot,
  cleanupExpiredParentWhatsAppRecords,
  finalizeParentGlobalSlot,
  listDueParentSections,
} from "./_lib/parentWhatsAppStore.js";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: false },
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Use POST for the Parent WhatsApp scheduler." });
  }

  let rawBody = "";
  let slotKey = "";
  let sectionCount = 0;
  let queuedCount = 0;
  try {
    rawBody = await readRawRequestBody(req, 128 * 1024);
    const signature = String(req.headers["upstash-signature"] || "");
    const requestUrl = `${parentWhatsAppBaseUrl()}${String(req.url || "/api/run-parent-whatsapp-schedule").split("?")[0]}`;
    const verified = await verifyQstashRequest({ signature, body: rawBody, url: requestUrl });
    if (!verified) return sendJson(res, 401, { error: "Invalid QStash signature." });

    const body = JSON.parse(rawBody || "{}");
    const dateContext = getParentDateContext();
    const db = adminDb();
    const claim = await claimParentGlobalSlot(db, {
      dateContext,
      scheduleVersion: Number(body?.scheduleVersion || 0),
    });
    if (!claim.claimed) {
      return sendJson(res, 200, { ok: true, skipped: true, reason: claim.reason });
    }
    slotKey = claim.slotKey;

    const sections = await listDueParentSections(db, dateContext);
    sectionCount = sections.length;
    const enqueueResults = await Promise.allSettled(sections.map(section => enqueueParentSectionJob({
      source: "qstash_schedule",
      scheduleVersion: Number(body?.scheduleVersion || 0),
      dateKey: dateContext.dateKey,
      sectionPlanId: section.id,
      runKind: "daily",
    })));
    queuedCount = enqueueResults.filter(item => item.status === "fulfilled").length;
    const failures = enqueueResults.filter(item => item.status === "rejected");
    if (failures.length) {
      const message = failures.map(item => item.reason?.message || "QStash enqueue failed.").join(" ");
      await finalizeParentGlobalSlot(db, {
        slotKey,
        status: "failed",
        sectionCount,
        queuedCount,
        error: message,
      });
      return sendJson(res, 503, {
        error: "One or more Parent WhatsApp section jobs could not be queued.",
        sectionCount,
        queuedCount,
      });
    }

    await finalizeParentGlobalSlot(db, {
      slotKey,
      status: "success",
      sectionCount,
      queuedCount,
    });
    await cleanupExpiredParentWhatsAppRecords(db).catch(() => {});
    return sendJson(res, 200, { ok: true, dateKey: dateContext.dateKey, sectionCount, queuedCount });
  } catch (error) {
    if (slotKey) {
      await finalizeParentGlobalSlot(adminDb(), {
        slotKey,
        status: "failed",
        sectionCount,
        queuedCount,
        error: error?.message || "Scheduler failed.",
      }).catch(() => {});
    }
    return sendJson(res, Number(error?.statusCode || 500), {
      error: error?.message || "Parent WhatsApp scheduler failed.",
    });
  }
}
