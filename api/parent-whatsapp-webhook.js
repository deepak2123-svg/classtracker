import { adminDb } from "./_lib/firebaseAdmin.js";
import {
  normaliseParentPhone,
  parseParentJoinDetails,
} from "./_lib/parentWhatsAppCore.js";
import {
  readRawRequestBody,
  sendParentWhatsAppFreeformText,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from "./_lib/parentWhatsAppDelivery.js";
import {
  createParentJoinRequest,
  claimParentInboundRequest,
  finalizeParentDelivery,
  findParentDeliveryByMetaMessageId,
  markParentWebhookEvent,
  readActiveParentInvite,
  readParentConversation,
  setParentPhoneOptOut,
  upsertParentConversation,
  writeParentWhatsAppHealth,
} from "./_lib/parentWhatsAppStore.js";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: false },
};

const STATUS_RANK = Object.freeze({
  sending: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
});

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function allWebhookValues(payload) {
  return (Array.isArray(payload?.entry) ? payload.entry : [])
    .flatMap(entry => Array.isArray(entry?.changes) ? entry.changes : [])
    .map(change => change?.value)
    .filter(Boolean);
}

async function processDeliveryStatus(db, status) {
  const messageId = String(status?.id || "");
  const state = String(status?.status || "").toLowerCase();
  if (!messageId || !["sent", "delivered", "read", "failed"].includes(state)) return;
  const eventId = `status:${messageId}:${state}:${String(status?.timestamp || "")}`;
  if (!await markParentWebhookEvent(db, eventId, { kind: "delivery_status" })) return;
  const delivery = await findParentDeliveryByMetaMessageId(db, messageId);
  if (!delivery) return;
  const current = String(delivery?.status || "accepted");
  if (state !== "failed" && (STATUS_RANK[state] || 0) < (STATUS_RANK[current] || 0)) return;
  if (state === "failed" && ["delivered", "read"].includes(current)) return;
  const eventAt = Number(status?.timestamp || 0) * 1000 || Date.now();
  const patch = {
    status: state,
    [`${state}At`]: eventAt,
  };
  if (state === "failed") {
    const firstError = Array.isArray(status?.errors) ? status.errors[0] : null;
    patch.error = firstError?.error_data?.details || firstError?.title || firstError?.message || "Meta reported delivery failure.";
    patch.metaCode = firstError?.code || null;
  }
  await finalizeParentDelivery(db, delivery.id, patch);
}

function inboundText(message) {
  if (message?.type === "text") return String(message?.text?.body || "").trim();
  if (message?.type === "button") return String(message?.button?.text || message?.button?.payload || "").trim();
  if (message?.type === "interactive") {
    return String(
      message?.interactive?.button_reply?.title
      || message?.interactive?.button_reply?.id
      || message?.interactive?.list_reply?.title
      || message?.interactive?.list_reply?.id
      || "",
    ).trim();
  }
  return "";
}

async function reply(to, body) {
  await sendParentWhatsAppFreeformText({ to, body });
}

async function processInboundMessage(db, message) {
  const messageId = String(message?.id || "");
  if (!messageId || !await markParentWebhookEvent(db, `message:${messageId}`, { kind: "inbound_message" })) return;
  const phone = normaliseParentPhone(`+${String(message?.from || "").replace(/\D/g, "")}`, "+91");
  if (!phone) return;
  if (!await claimParentInboundRequest(db, phone)) return;
  const text = inboundText(message);
  const command = text.trim().toUpperCase();

  if (command === "STOP") {
    await setParentPhoneOptOut(db, phone, true);
    await upsertParentConversation(db, phone, { state: "stopped", sectionPlanId: "", inviteCode: "" });
    await reply(phone, "You have been opted out of all Ledgr WhatsApp class updates. Send START any time to restore parent-level consent.");
    return;
  }

  if (command === "START") {
    await setParentPhoneOptOut(db, phone, false);
    await upsertParentConversation(db, phone, { state: "started", sectionPlanId: "", inviteCode: "" });
    await reply(phone, "Your Ledgr WhatsApp opt-out has been cleared. Any section paused or revoked by an administrator remains inactive.");
    return;
  }

  const joinMatch = /^JOIN\s+([A-Z0-9]{4,20})$/i.exec(text.trim());
  if (joinMatch) {
    const invite = await readActiveParentInvite(db, joinMatch[1]);
    if (!invite) {
      await reply(phone, "That Ledgr section code is invalid or closed. Please ask your institute for the current code.");
      return;
    }
    await upsertParentConversation(db, phone, {
      state: "awaiting_join_details",
      inviteCode: invite.code,
      sectionPlanId: invite.sectionPlanId,
    });
    await reply(
      phone,
      `Join request for ${invite.instituteName}, ${invite.sectionLabel}. Reply in this format:\nParent name | Student name | Relationship`,
    );
    return;
  }

  const conversation = await readParentConversation(db, phone);
  if (conversation?.state === "awaiting_join_details") {
    const details = parseParentJoinDetails(text);
    if (!details) {
      await reply(phone, "Please reply as: Parent name | Student name | Relationship");
      return;
    }
    const invite = await readActiveParentInvite(db, conversation.inviteCode);
    if (!invite || invite.sectionPlanId !== conversation.sectionPlanId) {
      await upsertParentConversation(db, phone, { state: "invite_closed", sectionPlanId: "", inviteCode: "" });
      await reply(phone, "That Ledgr section invitation is now closed. Please ask your institute for a new code.");
      return;
    }
    await createParentJoinRequest(db, {
      phoneE164: phone,
      invite,
      details,
      messageId,
    });
    await upsertParentConversation(db, phone, {
      state: "join_pending",
      sectionPlanId: invite.sectionPlanId,
      inviteCode: invite.code,
    });
    await reply(phone, `Thank you. ${invite.instituteName} will review this request before class updates begin.`);
    return;
  }

  await reply(phone, "This is a one-way Ledgr class-update channel. Send JOIN followed by your section code, STOP to opt out, or START to restore consent.");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query?.["hub.mode"];
    const token = req.query?.["hub.verify_token"];
    const challenge = req.query?.["hub.challenge"];
    if (!verifyMetaWebhookChallenge({ mode, token })) return sendJson(res, 403, { error: "Webhook verification failed." });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    return res.end(String(challenge || ""));
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Use GET or POST for the Meta webhook." });
  }

  try {
    const rawBody = await readRawRequestBody(req, 1024 * 1024);
    const signature = String(req.headers["x-hub-signature-256"] || "");
    if (!verifyMetaWebhookSignature({ signature, rawBody })) {
      return sendJson(res, 401, { error: "Invalid Meta webhook signature." });
    }
    const payload = JSON.parse(rawBody || "{}");
    const db = adminDb();
    let statusCount = 0;
    let messageCount = 0;
    for (const value of allWebhookValues(payload)) {
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const status of statuses) {
        await processDeliveryStatus(db, status);
        statusCount += 1;
      }
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const message of messages.slice(0, 50)) {
        await processInboundMessage(db, message);
        messageCount += 1;
      }
    }
    await writeParentWhatsAppHealth(db, {
      lastWebhookAt: Date.now(),
      lastWebhookStatusCount: statusCount,
      lastWebhookMessageCount: messageCount,
      lastWebhookError: "",
    }).catch(() => {});
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, Number(error?.statusCode || 500), {
      error: error?.message || "Meta webhook processing failed.",
    });
  }
}
