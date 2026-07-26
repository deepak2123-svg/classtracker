import QRCode from "qrcode";
import { adminDb, requireAdminUser } from "./_lib/firebaseAdmin.js";
import {
  parentWhatsAppEnvHealth,
  probeParentWhatsAppMeta,
  updateParentWhatsAppSchedule,
} from "./_lib/parentWhatsAppDelivery.js";
import {
  assertGlobalParentAdmin,
  bulkMoveParentSubscriptions,
  closeParentSectionInvite,
  decideParentJoinRequest,
  editParentSubscriptionNames,
  importParentContacts,
  readParentSectionPlanForAdmin,
  readParentWhatsAppConfig,
  readParentWhatsAppDashboard,
  rotateParentSectionInvite,
  saveParentContact,
  saveParentSectionPlan,
  setParentSubscriptionState,
  writeParentWhatsAppConfig,
  writeParentWhatsAppHealth,
} from "./_lib/parentWhatsAppStore.js";
import {
  buildParentSectionPreview,
  runParentSectionDelivery,
  runParentSectionTestSend,
} from "./_lib/parentWhatsAppRunner.js";

export const maxDuration = 120;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

const requestWindows = new Map();

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

function enforceRateLimit(key, limit = 90, windowMs = 60_000) {
  const now = Date.now();
  const cleanKey = String(key || "anonymous");
  const current = requestWindows.get(cleanKey) || [];
  const recent = current.filter(value => now - value < windowMs);
  if (recent.length >= limit) {
    const error = new Error("Too many Parent WhatsApp requests. Try again shortly.");
    error.statusCode = 429;
    throw error;
  }
  recent.push(now);
  requestWindows.set(cleanKey, recent);
}

function publicMetaHealth(metaProbe, envHealth) {
  return {
    env: envHealth,
    ready: metaProbe?.ready === true,
    templatesReady: metaProbe?.templatesReady === true,
    phoneReady: metaProbe?.phoneReady === true,
    phone: metaProbe?.phone || {},
    templates: metaProbe?.templates || [],
    warning: metaProbe?.warning || "",
    checkedAt: Date.now(),
  };
}

function inviteLink(code, displayPhoneNumber) {
  const phone = String(displayPhoneNumber || "").replace(/\D/g, "");
  if (!phone || !code) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(`JOIN ${code}`)}`;
}

async function inviteAssets(code, displayPhoneNumber) {
  const link = inviteLink(code, displayPhoneNumber);
  return {
    code,
    joinText: code ? `JOIN ${code}` : "",
    link,
    qrDataUrl: link ? await QRCode.toDataURL(link, {
      width: 640,
      margin: 2,
      color: { dark: "#102820", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }) : "",
  };
}

function reportForClient(report, sectionPlan) {
  return {
    instituteId: report.instituteId,
    instituteName: report.instituteName,
    sectionPlanId: report.sectionPlanId,
    sectionLabel: report.sectionLabel,
    dateKey: report.dateKey,
    dateLabel: report.dateLabel,
    entries: report.entries.map(entry => ({
      sourceId: entry.sourceId,
      subject: entry.subject,
      title: entry.title,
      notes: entry.notes,
      teacherName: entry.teacherName,
    })),
    summary: report.summary,
    contentHash: report.contentHash,
    changedSinceLastSend: sectionPlan?.lastDeliveryDate === report.dateKey
      && !!sectionPlan?.lastReportHash
      && sectionPlan.lastReportHash !== report.contentHash,
  };
}

async function loadHealth() {
  const env = parentWhatsAppEnvHealth();
  const meta = await probeParentWhatsAppMeta();
  return publicMetaHealth(meta, env);
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Use GET or POST for Parent WhatsApp administration." });
  }

  try {
    const adminUser = await requireAdminUser(req);
    enforceRateLimit(adminUser.uid);
    const db = adminDb();

    if (req.method === "GET") {
      const [dashboard, health] = await Promise.all([
        readParentWhatsAppDashboard(db, adminUser),
        loadHealth(),
      ]);
      await writeParentWhatsAppHealth(db, {
        metaReady: health.ready,
        templatesReady: health.templatesReady,
        qstashReady: health.env.qstashReady,
        warning: health.warning,
        lastProbeAt: health.checkedAt,
      }).catch(() => {});
      return sendJson(res, 200, { ok: true, dashboard, health });
    }

    const body = parseBody(req);
    const action = String(body?.action || "").trim();
    if (!action) return sendJson(res, 400, { error: "Choose a Parent WhatsApp action." });

    if (action === "save_global_schedule") {
      assertGlobalParentAdmin(adminUser);
      const current = await readParentWhatsAppConfig(db);
      const env = parentWhatsAppEnvHealth();
      if (!env.qstashReady) {
        const error = new Error("Connect QStash before saving the automatic Parent WhatsApp schedule.");
        error.statusCode = 409;
        throw error;
      }
      const nextVersion = current.scheduleVersion + 1;
      const scheduleState = await updateParentWhatsAppSchedule({
        enabled: body?.enabled === true,
        timeKey: body?.timeKey,
        scheduleVersion: nextVersion,
      });
      const saved = await writeParentWhatsAppConfig(db, {
        enabled: body?.enabled === true,
        timeKey: body?.timeKey,
        scheduleVersion: nextVersion,
      }, adminUser, scheduleState);
      return sendJson(res, 200, { ok: true, config: saved });
    }

    if (action === "save_section") {
      const health = await loadHealth();
      const section = await saveParentSectionPlan(db, adminUser, body?.section || {}, {
        metaReady: health.ready,
        qstashReady: health.env.qstashReady,
        templatesReady: health.templatesReady,
      });
      return sendJson(res, 200, { ok: true, section });
    }

    if (action === "save_contact") {
      const saved = await saveParentContact(db, adminUser, body?.contact || {});
      return sendJson(res, 200, { ok: true, ...saved });
    }

    if (action === "import_contacts") {
      const result = await importParentContacts(db, adminUser, body?.import || {});
      return sendJson(res, result.failedCount ? 207 : 200, { ok: result.failedCount === 0, ...result });
    }

    if (action === "set_subscription_state") {
      const subscription = await setParentSubscriptionState(db, adminUser, body || {});
      return sendJson(res, 200, { ok: true, subscription });
    }

    if (action === "edit_subscription_names") {
      const result = await editParentSubscriptionNames(db, adminUser, body || {});
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (action === "decide_join") {
      const result = await decideParentJoinRequest(db, adminUser, body || {});
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (action === "bulk_move") {
      const result = await bulkMoveParentSubscriptions(db, adminUser, body || {});
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (action === "rotate_invite") {
      const [result, health] = await Promise.all([
        rotateParentSectionInvite(db, adminUser, body?.sectionPlanId),
        loadHealth(),
      ]);
      const assets = await inviteAssets(result.code, health?.phone?.displayPhoneNumber);
      return sendJson(res, 200, { ok: true, invite: { ...result, ...assets } });
    }

    if (action === "close_invite") {
      const result = await closeParentSectionInvite(db, adminUser, body?.sectionPlanId);
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (action === "invite_assets") {
      const [section, health] = await Promise.all([
        readParentSectionPlanForAdmin(db, adminUser, body?.sectionPlanId),
        loadHealth(),
      ]);
      const assets = await inviteAssets(section.inviteCode, health?.phone?.displayPhoneNumber);
      return sendJson(res, 200, { ok: true, invite: assets });
    }

    if (action === "preview") {
      const section = await readParentSectionPlanForAdmin(db, adminUser, body?.sectionPlanId);
      const report = await buildParentSectionPreview({ db, sectionPlan: section });
      return sendJson(res, 200, { ok: true, report: reportForClient(report, section) });
    }

    if (action === "test_send") {
      const section = await readParentSectionPlanForAdmin(db, adminUser, body?.sectionPlanId);
      const result = await runParentSectionTestSend({
        db,
        sectionPlan: section,
        phone: body?.phone,
        parentName: body?.parentName,
        childName: body?.childName,
      });
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (["send_now", "corrected_resend", "retry"].includes(action)) {
      const section = await readParentSectionPlanForAdmin(db, adminUser, body?.sectionPlanId);
      const runKind = action === "corrected_resend" ? "corrected" : action === "retry" ? "retry" : "manual";
      const result = await runParentSectionDelivery({
        db,
        sectionPlanId: section.id,
        runKind,
      });
      return sendJson(res, 200, { ok: true, result });
    }

    return sendJson(res, 400, { error: "Unsupported Parent WhatsApp action." });
  } catch (error) {
    const status = Number(error?.statusCode || (error instanceof SyntaxError ? 400 : 500));
    return sendJson(res, status, {
      error: error?.message || "Parent WhatsApp request failed.",
      code: error?.code || "",
      subscriptionId: error?.subscriptionId || "",
    });
  }
}
