import { adminDb } from "./_lib/firebaseAdmin.js";
import { getParentDateContext } from "./_lib/parentWhatsAppCore.js";
import {
  parentWhatsAppBaseUrl,
  readRawRequestBody,
  verifyQstashRequest,
} from "./_lib/parentWhatsAppDelivery.js";
import { runParentSectionDelivery } from "./_lib/parentWhatsAppRunner.js";
import { readParentWhatsAppConfig } from "./_lib/parentWhatsAppStore.js";

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
    return sendJson(res, 405, { error: "Use POST for the Parent WhatsApp worker." });
  }
  try {
    const rawBody = await readRawRequestBody(req, 128 * 1024);
    const signature = String(req.headers["upstash-signature"] || "");
    const requestUrl = `${parentWhatsAppBaseUrl()}${String(req.url || "/api/parent-whatsapp-worker").split("?")[0]}`;
    const verified = await verifyQstashRequest({ signature, body: rawBody, url: requestUrl });
    if (!verified) return sendJson(res, 401, { error: "Invalid QStash signature." });

    const body = JSON.parse(rawBody || "{}");
    const db = adminDb();
    const [configRecord, dateContext] = await Promise.all([
      readParentWhatsAppConfig(db),
      Promise.resolve(getParentDateContext()),
    ]);
    if (configRecord.enabled !== true) {
      return sendJson(res, 200, { ok: true, skipped: true, reason: "schedule_disabled" });
    }
    if (Number(body?.scheduleVersion || 0) !== Number(configRecord.scheduleVersion || 0)) {
      return sendJson(res, 200, { ok: true, skipped: true, reason: "stale_schedule" });
    }
    if (String(body?.dateKey || "") !== dateContext.dateKey) {
      return sendJson(res, 200, { ok: true, skipped: true, reason: "stale_date" });
    }
    const result = await runParentSectionDelivery({
      db,
      sectionPlanId: body?.sectionPlanId,
      runKind: "daily",
      now: dateContext.now,
    });
    return sendJson(res, 200, { ok: true, result });
  } catch (error) {
    return sendJson(res, Number(error?.statusCode || 500), {
      error: error?.message || "Parent WhatsApp section delivery failed.",
    });
  }
}
