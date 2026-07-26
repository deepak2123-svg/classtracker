import { buildParentSectionReport } from "./ledgrReportServer.js";
import { renderLedgrPdfBuffer } from "./renderLedgrPdf.js";
import {
  PARENT_WHATSAPP_TEMPLATE_NAMES,
  buildParentTemplatePayload,
  normaliseParentPhone,
  parentPhoneHash,
} from "./parentWhatsAppCore.js";
import {
  sendParentWhatsAppTemplate,
  uploadParentPdfToMeta,
} from "./parentWhatsAppDelivery.js";
import {
  createParentDeliveryAttempt,
  finalizeParentDelivery,
  finalizeParentSectionRun,
  loadParentSectionRecipients,
  prepareParentSectionRun,
  readParentReportMediaId,
  readParentSectionPlan,
  readParentWhatsAppConfig,
  saveParentReportMediaId,
} from "./parentWhatsAppStore.js";

const DELIVERY_CHUNK_SIZE = 10;

export async function buildParentSectionPreview({ db, sectionPlan, now = new Date() }) {
  return buildParentSectionReport({
    db,
    instituteId: sectionPlan.instituteId,
    instituteName: sectionPlan.instituteName,
    sectionPlanId: sectionPlan.id,
    sectionKey: sectionPlan.sectionKey,
    sectionLabel: sectionPlan.sectionLabel,
    now,
  });
}

async function prepareParentMedia(report, forcePdf = false) {
  if (!report.entries.length && !forcePdf) return { mediaId: "" };
  const pdfBuffer = await renderLedgrPdfBuffer(report.html);
  return uploadParentPdfToMeta({
    pdfBuffer,
    filename: report.filename,
  });
}

function templateKind(report, runKind) {
  if (runKind === "corrected") return "corrected";
  if (!report.entries.length) return "no_update";
  return "daily";
}

function payloadForRecipient({
  report,
  sectionPlan,
  recipient,
  runKind,
  mediaId,
  templates,
}) {
  return buildParentTemplatePayload({
    to: recipient.phone,
    kind: templateKind(report, runKind),
    parentName: recipient.parentName,
    childNames: recipient.childNames,
    instituteName: sectionPlan.instituteName,
    sectionLabel: sectionPlan.sectionLabel,
    dateLabel: report.dateLabel,
    summary: report.summary,
    mediaId,
    filename: report.filename,
    templates,
  });
}

async function sendProductionRecipient({
  db,
  report,
  sectionPlan,
  recipient,
  runKind,
  reportVersion,
  mediaId,
  templates,
}) {
  const claim = await createParentDeliveryAttempt(db, {
    sectionPlan,
    report,
    reportVersion,
    runKind,
    recipient,
  });
  if (!claim.claimed) {
    return { skipped: true, status: claim?.existing?.status || "already_sent" };
  }
  try {
    const response = await sendParentWhatsAppTemplate(payloadForRecipient({
      report,
      sectionPlan,
      recipient,
      runKind,
      mediaId,
      templates,
    }));
    await finalizeParentDelivery(db, claim.deliveryId, {
      status: "accepted",
      metaMessageId: response.messageId,
      acceptedAt: Date.now(),
    });
    return { delivered: true, deliveryId: claim.deliveryId, messageId: response.messageId };
  } catch (error) {
    await finalizeParentDelivery(db, claim.deliveryId, {
      status: "failed",
      failedAt: Date.now(),
      error: error?.message || "Meta rejected this message.",
      metaCode: error?.metaCode || null,
      metaSubcode: error?.metaSubcode || null,
      permanent: error?.permanent === true,
    });
    return { failed: true, deliveryId: claim.deliveryId, error: error?.message || "Send failed." };
  }
}

export async function runParentSectionDelivery({
  db,
  sectionPlanId,
  runKind = "daily",
  now = new Date(),
} = {}) {
  const allowedKinds = new Set(["daily", "manual", "corrected", "retry"]);
  if (!allowedKinds.has(runKind)) throw new Error("Unsupported Parent WhatsApp send type.");
  const [sectionPlan, config] = await Promise.all([
    readParentSectionPlan(db, sectionPlanId),
    readParentWhatsAppConfig(db),
  ]);
  if (sectionPlan.status === "closed") throw new Error("Parent WhatsApp is closed for this section.");
  if (runKind === "daily" && sectionPlan.enabled !== true) {
    return { sent: false, reason: "section_disabled" };
  }

  const report = await buildParentSectionPreview({ db, sectionPlan, now });
  const run = await prepareParentSectionRun(db, { sectionPlan, report, runKind });
  if (!run?.ready) return { sent: false, reason: run?.reason || "not_ready", report };

  const recipients = await loadParentSectionRecipients(db, sectionPlan.id);
  let mediaId = "";
  let mediaError = null;
  try {
    const needsPdf = report.entries.length > 0 || runKind === "corrected";
    if (needsPdf) {
      mediaId = await readParentReportMediaId(db, {
        sectionPlanId: sectionPlan.id,
        dateKey: report.dateKey,
        reportVersion: run.reportVersion,
        reportHash: report.contentHash,
      });
    }
    if (!mediaId) {
      ({ mediaId } = await prepareParentMedia(report, runKind === "corrected"));
      await saveParentReportMediaId(db, {
        sectionPlan,
        report,
        reportVersion: run.reportVersion,
        mediaId,
      });
    }
  } catch (error) {
    mediaError = error;
  }

  const results = [];
  if (!mediaError) {
    for (let start = 0; start < recipients.length; start += DELIVERY_CHUNK_SIZE) {
      const chunk = recipients.slice(start, start + DELIVERY_CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map(recipient => sendProductionRecipient({
        db,
        report,
        sectionPlan,
        recipient,
        runKind,
        reportVersion: run.reportVersion,
        mediaId,
        templates: config?.templates || PARENT_WHATSAPP_TEMPLATE_NAMES,
      })));
      results.push(...chunkResults);
    }
  }

  const deliveredCount = results.filter(item =>
    item?.delivered || (item?.skipped && ["accepted", "sent", "delivered", "read"].includes(item?.status)),
  ).length;
  const inProgressCount = results.filter(item => item?.skipped && item?.status === "sending").length;
  const failureCount = mediaError
    ? recipients.length
    : results.filter(item => item?.failed).length + inProgressCount;
  const firstError = mediaError?.message
    || results.find(item => item?.error)?.error
    || (inProgressCount ? `${inProgressCount} delivery attempt${inProgressCount === 1 ? " is" : "s are"} still within the replay-safety window.` : "");
  await finalizeParentSectionRun(db, {
    sectionPlan,
    report,
    reportVersion: run.reportVersion,
    runKind,
    deliveredCount,
    failureCount,
    requestedCount: recipients.length,
    error: firstError,
  });
  if (mediaError) throw mediaError;
  return {
    sent: true,
    sectionPlanId: sectionPlan.id,
    dateKey: report.dateKey,
    reportVersion: run.reportVersion,
    reportHash: report.contentHash,
    entryCount: report.entries.length,
    requestedCount: recipients.length,
    acceptedOrAlreadySentCount: deliveredCount,
    failureCount,
    inProgressCount,
    results,
  };
}

export async function runParentSectionTestSend({
  db,
  sectionPlan,
  phone,
  parentName = "Test parent",
  childName = "Test student",
  now = new Date(),
} = {}) {
  const normalisedPhone = normaliseParentPhone(phone);
  if (!normalisedPhone) throw new Error("Enter a valid test phone number.");
  const [report, config] = await Promise.all([
    buildParentSectionPreview({ db, sectionPlan, now }),
    readParentWhatsAppConfig(db),
  ]);
  const { mediaId } = await prepareParentMedia(report);
  const payload = payloadForRecipient({
    report,
    sectionPlan,
    recipient: {
      phone: normalisedPhone,
      phoneHash: parentPhoneHash(normalisedPhone),
      parentName,
      childNames: [childName],
    },
    runKind: "daily",
    mediaId,
    templates: config?.templates || PARENT_WHATSAPP_TEMPLATE_NAMES,
  });
  const response = await sendParentWhatsAppTemplate(payload);
  return {
    sent: true,
    messageId: response.messageId,
    dateKey: report.dateKey,
    entryCount: report.entries.length,
  };
}
