import crypto from "node:crypto";
import { Client, Receiver } from "@upstash/qstash";
import {
  PARENT_WHATSAPP_LANGUAGE,
  PARENT_WHATSAPP_TEMPLATE_NAMES,
  buildParentQstashCron,
  cleanParentText,
  normaliseParentScheduleTime,
} from "./parentWhatsAppCore.js";

const PARENT_QSTASH_SCHEDULE_ID = "ledgr-parent-whatsapp-daily";

function envValue(name) {
  return String(process.env[name] || "").trim();
}

export function parentWhatsAppBaseUrl() {
  const explicit = envValue("PARENT_WHATSAPP_BASE_URL");
  if (explicit) return explicit.replace(/\/+$/g, "");
  const production = envValue("VERCEL_PROJECT_PRODUCTION_URL") || envValue("VERCEL_URL");
  if (production) return `https://${production.replace(/^https?:\/\//i, "").replace(/\/+$/g, "")}`;
  return "https://admin.ledgrclasses.com";
}

export function parentWhatsAppEnvHealth() {
  const meta = {
    accessToken: !!envValue("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: !!envValue("WHATSAPP_PHONE_NUMBER_ID"),
    wabaId: !!envValue("WHATSAPP_WABA_ID"),
    appSecret: !!envValue("WHATSAPP_APP_SECRET"),
    webhookVerifyToken: !!envValue("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    graphApiVersion: !!envValue("WHATSAPP_GRAPH_API_VERSION"),
  };
  const qstash = {
    token: !!envValue("QSTASH_TOKEN"),
    currentSigningKey: !!envValue("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: !!envValue("QSTASH_NEXT_SIGNING_KEY"),
  };
  return {
    meta,
    qstash,
    metaReady: Object.values(meta).every(Boolean),
    qstashReady: Object.values(qstash).every(Boolean),
  };
}

function qstashClient() {
  const token = envValue("QSTASH_TOKEN");
  if (!token) throw new Error("Missing QSTASH_TOKEN on the server.");
  return new Client({ token });
}

export async function verifyQstashRequest({ signature, body, url = "" }) {
  const currentSigningKey = envValue("QSTASH_CURRENT_SIGNING_KEY");
  const nextSigningKey = envValue("QSTASH_NEXT_SIGNING_KEY");
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error("QStash signing keys are not configured.");
  }
  if (!signature) return false;
  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  try {
    return await receiver.verify({
      signature: String(signature),
      body: String(body || ""),
      url: url || undefined,
      clockTolerance: 10,
    });
  } catch {
    return false;
  }
}

export async function updateParentWhatsAppSchedule({
  enabled,
  timeKey,
  scheduleVersion,
}) {
  const client = qstashClient();
  if (!enabled) {
    try {
      await client.schedules.pause({ schedule: PARENT_QSTASH_SCHEDULE_ID });
    } catch (error) {
      if (!/not found|404/i.test(String(error?.message || ""))) throw error;
    }
    return {
      scheduleId: PARENT_QSTASH_SCHEDULE_ID,
      paused: true,
      cron: buildParentQstashCron(normaliseParentScheduleTime(timeKey)),
    };
  }

  const time = normaliseParentScheduleTime(timeKey);
  const cron = buildParentQstashCron(time);
  const destination = `${parentWhatsAppBaseUrl()}/api/run-parent-whatsapp-schedule`;
  const result = await client.schedules.create({
    scheduleId: PARENT_QSTASH_SCHEDULE_ID,
    destination,
    cron,
    method: "POST",
    retries: 3,
    timeout: 120,
    label: "ledgr-parent-whatsapp-daily",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scheduleVersion: Number(scheduleVersion || 1),
      source: "qstash_schedule",
    }),
  });
  return {
    scheduleId: result?.scheduleId || PARENT_QSTASH_SCHEDULE_ID,
    paused: false,
    cron,
    destination,
  };
}

export async function enqueueParentSectionJob(payload = {}) {
  const client = qstashClient();
  const url = `${parentWhatsAppBaseUrl()}/api/parent-whatsapp-worker`;
  return client.publishJSON({
    url,
    body: payload,
    retries: 3,
    timeout: 120,
    label: "ledgr-parent-whatsapp-section",
    deduplicationId: cleanParentText(
      `parent-section-${payload?.dateKey}-${payload?.sectionPlanId}-${payload?.runKind || "daily"}-${payload?.reportVersion || 1}`,
      128,
    ),
  });
}

function graphVersion() {
  const version = envValue("WHATSAPP_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("Missing or invalid WHATSAPP_GRAPH_API_VERSION on the server.");
  }
  return version;
}

function graphUrl(path) {
  return `https://graph.facebook.com/${graphVersion()}/${String(path || "").replace(/^\/+/, "")}`;
}

async function metaJson(path, options = {}) {
  const accessToken = envValue("WHATSAPP_ACCESS_TOKEN");
  if (!accessToken) throw new Error("Missing WHATSAPP_ACCESS_TOKEN on the server.");
  const response = await fetch(graphUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.error) {
    const error = new Error(
      payload?.error?.error_user_msg
      || payload?.error?.message
      || `Meta WhatsApp request failed (${response.status}).`,
    );
    error.statusCode = response.status || 502;
    error.metaCode = payload?.error?.code || null;
    error.metaSubcode = payload?.error?.error_subcode || null;
    error.permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
    throw error;
  }
  return payload || {};
}

export async function probeParentWhatsAppMeta() {
  const health = parentWhatsAppEnvHealth();
  if (!health.metaReady) {
    return {
      ready: false,
      templatesReady: false,
      phoneReady: false,
      warning: "Meta WhatsApp environment variables are incomplete.",
      templates: [],
    };
  }
  const wabaId = envValue("WHATSAPP_WABA_ID");
  const phoneNumberId = envValue("WHATSAPP_PHONE_NUMBER_ID");
  try {
    const [phone, templatesPayload] = await Promise.all([
      metaJson(`${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,name_status`),
      metaJson(`${wabaId}/message_templates?fields=name,status,category,language&limit=100`),
    ]);
    const wantedNames = new Set(Object.values(PARENT_WHATSAPP_TEMPLATE_NAMES));
    const templates = (Array.isArray(templatesPayload?.data) ? templatesPayload.data : [])
      .filter(item => wantedNames.has(String(item?.name || "")))
      .map(item => ({
        name: String(item?.name || ""),
        status: String(item?.status || ""),
        category: String(item?.category || ""),
        language: String(item?.language || ""),
      }));
    const approved = new Set(
      templates
        .filter(item => item.status === "APPROVED" && item.language === PARENT_WHATSAPP_LANGUAGE)
        .map(item => item.name),
    );
    const templatesReady = [...wantedNames].every(name => approved.has(name));
    return {
      ready: !!phone?.display_phone_number && templatesReady,
      templatesReady,
      phoneReady: !!phone?.display_phone_number,
      phone: {
        displayPhoneNumber: String(phone?.display_phone_number || ""),
        verifiedName: String(phone?.verified_name || ""),
        qualityRating: String(phone?.quality_rating || ""),
        nameStatus: String(phone?.name_status || ""),
      },
      templates,
      warning: templatesReady ? "" : "One or more Parent WhatsApp templates are not approved.",
    };
  } catch (error) {
    return {
      ready: false,
      templatesReady: false,
      phoneReady: false,
      warning: error?.message || "Could not verify Meta WhatsApp.",
      templates: [],
    };
  }
}

export async function uploadParentPdfToMeta({ pdfBuffer, filename }) {
  const phoneNumberId = envValue("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneNumberId) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID on the server.");
  if (!pdfBuffer?.length) throw new Error("The parent PDF is empty.");
  if (pdfBuffer.byteLength > 100 * 1024 * 1024) throw new Error("The parent PDF is too large for WhatsApp.");
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "application/pdf");
  form.set(
    "file",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    cleanParentText(filename, 180) || "ledgr-class-update.pdf",
  );
  const payload = await metaJson(`${phoneNumberId}/media`, {
    method: "POST",
    body: form,
  });
  const mediaId = String(payload?.id || "").trim();
  if (!mediaId) throw new Error("Meta did not return a media id for the parent PDF.");
  return { mediaId };
}

export async function sendParentWhatsAppTemplate(payload) {
  const phoneNumberId = envValue("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneNumberId) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID on the server.");
  const result = await metaJson(`${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const messageId = String(result?.messages?.[0]?.id || "");
  if (!messageId) throw new Error("Meta accepted the request without returning a message id.");
  return {
    messageId,
    contactWaId: String(result?.contacts?.[0]?.wa_id || ""),
    raw: result,
  };
}

export async function sendParentWhatsAppFreeformText({ to, body }) {
  const phoneNumberId = envValue("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneNumberId) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID on the server.");
  const result = await metaJson(`${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to || "").replace(/\D/g, ""),
      type: "text",
      text: {
        preview_url: false,
        body: cleanParentText(body, 1400),
      },
    }),
  });
  const messageId = String(result?.messages?.[0]?.id || "");
  if (!messageId) throw new Error("Meta accepted the reply without returning a message id.");
  return { messageId };
}

export function verifyMetaWebhookSignature({ signature, rawBody }) {
  const secret = envValue("WHATSAPP_APP_SECRET");
  if (!secret || !signature || !String(signature).startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(String(rawBody || "")).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(signature));
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyMetaWebhookChallenge({ mode, token }) {
  return String(mode || "") === "subscribe"
    && !!envValue("WHATSAPP_WEBHOOK_VERIFY_TOKEN")
    && String(token || "") === envValue("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
}

export async function readRawRequestBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
