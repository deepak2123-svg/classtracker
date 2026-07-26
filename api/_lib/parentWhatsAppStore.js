import crypto from "node:crypto";
import {
  PARENT_WHATSAPP_CONVERSATION_TTL_MS,
  PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS,
  PARENT_WHATSAPP_TEMPLATE_NAMES,
  PARENT_WHATSAPP_TIME_ZONE,
  buildParentDeliveryId,
  buildParentSectionPlanId,
  cleanParentText,
  getParentDateContext,
  groupParentRecipients,
  normaliseParentPhone,
  normaliseParentScheduleTime,
  normaliseParentSectionKey,
  normaliseWeekdays,
  parentPhoneHash,
  shouldRunParentSection,
  validateParentImportRows,
} from "./parentWhatsAppCore.js";

const COLLECTIONS = Object.freeze({
  sections: "parentWhatsAppSections",
  contacts: "parentWhatsAppContacts",
  subscriptions: "parentWhatsAppSubscriptions",
  invites: "parentWhatsAppInvites",
  joinRequests: "parentWhatsAppJoinRequests",
  conversations: "parentWhatsAppConversations",
  deliveries: "parentWhatsAppDeliveries",
  reports: "parentWhatsAppReports",
  webhookEvents: "parentWhatsAppWebhookEvents",
});

const GLOBAL_CONFIG_PATH = "config/parentWhatsAppDelivery";
const GLOBAL_ADMIN_ROLES = new Set(["manager", "admin"]);

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function stableId(source, prefix = "") {
  return `${prefix}${crypto.createHash("sha256").update(String(source || "")).digest("hex")}`;
}

function docData(doc) {
  return { id: doc.id, ...(doc.data() || {}) };
}

function getInstituteSectionConfig(sectionConfig, instituteName) {
  if (!sectionConfig || !instituteName) return {};
  const key = Object.keys(sectionConfig).find(name => sameText(name, instituteName));
  return key ? (sectionConfig[key] || {}) : {};
}

function getInstituteSectionNames(sectionConfig, instituteName) {
  const current = getInstituteSectionConfig(sectionConfig, instituteName);
  const seen = new Set();
  return [
    ...(Array.isArray(current?.gradeGroups) ? current.gradeGroups : []).flatMap(group => group?.sections || []),
    ...(Array.isArray(current?.extraSections) ? current.extraSections : []),
  ].map(value => cleanParentText(value, 180))
    .filter(value => {
      const key = normaliseParentSectionKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function resolveConfiguredSectionLabel(instData, sectionLabel) {
  let current = cleanParentText(sectionLabel, 180);
  [...(instData?.sectionChangeEvents || [])]
    .filter(event => Array.isArray(event?.changes))
    .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0))
    .forEach(event => {
      const change = event.changes.find(item =>
        normaliseParentSectionKey(item?.oldSection) === normaliseParentSectionKey(current)
        && cleanParentText(item?.newSection, 180),
      );
      if (change) current = cleanParentText(change.newSection, 180);
    });
  return current;
}

export async function getVisibleParentInstitutes(db, adminUser) {
  const snap = await db.collection("institutes").get();
  return snap.docs.map(docData)
    .filter(institute => institute?.status !== "deleted")
    .filter(institute => {
      if (GLOBAL_ADMIN_ROLES.has(adminUser?.role)) return true;
      if (adminUser?.role === "group_admin") return String(institute?.groupId || "") === String(adminUser?.groupId || "");
      if (adminUser?.role === "institute_admin") {
        const allowed = new Set([
          String(adminUser?.instituteId || ""),
          ...(Array.isArray(adminUser?.instituteIds) ? adminUser.instituteIds : []).map(String),
        ].filter(Boolean));
        return allowed.has(institute.id);
      }
      return false;
    })
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { numeric: true, sensitivity: "base" }));
}

export async function assertParentInstituteAccess(db, adminUser, instituteId) {
  const cleanId = String(instituteId || "").trim();
  if (!cleanId) {
    const error = new Error("Choose an institute.");
    error.statusCode = 400;
    throw error;
  }
  const snap = await db.doc(`institutes/${cleanId}`).get();
  if (!snap.exists || snap.data()?.status === "deleted") {
    const error = new Error("That institute is not available.");
    error.statusCode = 404;
    throw error;
  }
  const institute = { id: snap.id, ...(snap.data() || {}) };
  const visible = GLOBAL_ADMIN_ROLES.has(adminUser?.role)
    || (adminUser?.role === "group_admin" && String(institute.groupId || "") === String(adminUser.groupId || ""))
    || (adminUser?.role === "institute_admin" && new Set([
      String(adminUser?.instituteId || ""),
      ...(Array.isArray(adminUser?.instituteIds) ? adminUser.instituteIds : []).map(String),
    ].filter(Boolean)).has(institute.id));
  if (!visible) {
    const error = new Error("That institute is outside your access.");
    error.statusCode = 403;
    throw error;
  }
  return institute;
}

export function assertGlobalParentAdmin(adminUser) {
  if (!GLOBAL_ADMIN_ROLES.has(adminUser?.role)) {
    const error = new Error("Manager access is required to change the global WhatsApp schedule.");
    error.statusCode = 403;
    throw error;
  }
}

async function readCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(docData);
}

function filterToVisibleInstitutes(records, visibleInstituteIds) {
  return records.filter(record => visibleInstituteIds.has(String(record?.instituteId || "")));
}

export async function readParentWhatsAppConfig(db) {
  const snap = await db.doc(GLOBAL_CONFIG_PATH).get();
  const saved = snap.exists ? (snap.data() || {}) : {};
  return {
    schemaVersion: 1,
    enabled: saved?.enabled === true,
    timeKey: normaliseParentScheduleTime(saved?.timeKey || "20:00"),
    timezone: PARENT_WHATSAPP_TIME_ZONE,
    scheduleVersion: Math.max(1, Number(saved?.scheduleVersion || 1)),
    scheduleId: String(saved?.scheduleId || ""),
    cron: String(saved?.cron || ""),
    templates: {
      ...PARENT_WHATSAPP_TEMPLATE_NAMES,
      ...(saved?.templates || {}),
    },
    health: saved?.health || {},
    execution: saved?.execution || {},
    updatedAt: Number(saved?.updatedAt || 0),
    updatedBy: String(saved?.updatedBy || ""),
  };
}

export async function writeParentWhatsAppConfig(db, config, adminUser, scheduleState = {}) {
  const current = await readParentWhatsAppConfig(db);
  const next = {
    schemaVersion: 1,
    enabled: config?.enabled === true,
    timeKey: normaliseParentScheduleTime(config?.timeKey || current.timeKey),
    timezone: PARENT_WHATSAPP_TIME_ZONE,
    scheduleVersion: Math.max(current.scheduleVersion + 1, Number(config?.scheduleVersion || 0)),
    scheduleId: String(scheduleState?.scheduleId || current.scheduleId || ""),
    cron: String(scheduleState?.cron || current.cron || ""),
    templates: { ...PARENT_WHATSAPP_TEMPLATE_NAMES },
    updatedAt: Date.now(),
    updatedBy: String(adminUser?.uid || ""),
  };
  await db.doc(GLOBAL_CONFIG_PATH).set(next, { merge: true });
  return { ...current, ...next };
}

export async function writeParentWhatsAppHealth(db, patch = {}) {
  await db.doc(GLOBAL_CONFIG_PATH).set({
    health: {
      ...(patch || {}),
      updatedAt: Date.now(),
    },
  }, { merge: true });
}

export async function readParentWhatsAppDashboard(db, adminUser) {
  const institutes = await getVisibleParentInstitutes(db, adminUser);
  const visibleInstituteIds = new Set(institutes.map(item => item.id));
  const [config, sectionConfigSnap, sections, contacts, subscriptions, joinRequests, deliveries] = await Promise.all([
    readParentWhatsAppConfig(db),
    db.doc("config/sections").get(),
    readCollection(db, COLLECTIONS.sections),
    readCollection(db, COLLECTIONS.contacts),
    readCollection(db, COLLECTIONS.subscriptions),
    readCollection(db, COLLECTIONS.joinRequests),
    readCollection(db, COLLECTIONS.deliveries),
  ]);
  const sectionConfig = sectionConfigSnap.exists ? (sectionConfigSnap.data() || {}) : {};
  const visibleSections = filterToVisibleInstitutes(sections, visibleInstituteIds);
  const sectionById = new Map(visibleSections.map(item => [item.id, item]));
  const visibleContacts = filterToVisibleInstitutes(contacts, visibleInstituteIds);
  const visibleSubscriptions = filterToVisibleInstitutes(subscriptions, visibleInstituteIds);
  const visibleRequests = filterToVisibleInstitutes(joinRequests, visibleInstituteIds)
    .filter(item => item?.status === "pending");
  const cutoff = Date.now() - PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS * 86400000;
  const visibleDeliveries = filterToVisibleInstitutes(deliveries, visibleInstituteIds)
    .filter(item => Number(item?.updatedAt || item?.createdAt || 0) >= cutoff)
    .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
    .slice(0, 500);

  const instituteRows = institutes.map(institute => {
    const instSectionConfig = getInstituteSectionConfig(sectionConfig, institute.name);
    const catalog = getInstituteSectionNames(sectionConfig, institute.name);
    const institutePlans = visibleSections.filter(plan => plan.instituteId === institute.id);
    const resolvedPlans = institutePlans.map(plan => ({
      ...plan,
      resolvedSectionLabel: resolveConfiguredSectionLabel(instSectionConfig, plan.sectionLabel),
    }));
    const planLabels = resolvedPlans.map(plan => plan.resolvedSectionLabel);
    const seen = new Set();
    const labels = [...catalog, ...planLabels].filter(label => {
      const key = normaliseParentSectionKey(label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      id: institute.id,
      groupId: String(institute?.groupId || ""),
      name: cleanParentText(institute?.name || "Institute", 180),
      sections: labels.map(label => {
        const key = normaliseParentSectionKey(label);
        const saved = resolvedPlans.find(plan => normaliseParentSectionKey(plan.resolvedSectionLabel) === key)
          || sectionById.get(buildParentSectionPlanId(institute.id, key))
          || {};
        const planId = saved?.id || buildParentSectionPlanId(institute.id, key);
        const sectionSubscriptions = visibleSubscriptions.filter(item =>
          item?.sectionPlanId === planId && item?.status === "active" && item?.adminPaused !== true,
        );
        const contactIds = new Set(sectionSubscriptions.map(item => item.contactId));
        const activeContacts = visibleContacts.filter(contact =>
          contactIds.has(contact.id) && contact?.status === "active" && !contact?.optedOutAt,
        );
        const lastDelivery = visibleDeliveries.find(item => item?.sectionPlanId === planId);
        return {
          id: planId,
          instituteId: institute.id,
          instituteName: institute.name,
          groupId: institute.groupId || "",
          sectionKey: key,
          sectionLabel: label,
          enabled: saved?.enabled === true,
          status: saved?.status || "active",
          weekdays: normaliseWeekdays(saved?.weekdays),
          skipDates: Array.isArray(saved?.skipDates) ? saved.skipDates : [],
          inviteGeneration: Number(saved?.inviteGeneration || 0),
          inviteCode: String(saved?.inviteCode || ""),
          contactCount: activeContacts.length,
          childCount: sectionSubscriptions.length,
          pendingCount: visibleRequests.filter(item => item?.sectionPlanId === planId).length,
          lastDelivery: lastDelivery ? {
            status: lastDelivery.status || "",
            dateKey: lastDelivery.dateKey || "",
            updatedAt: Number(lastDelivery.updatedAt || 0),
          } : null,
          lastReportHash: String(saved?.lastReportHash || ""),
          lastReportVersion: Number(saved?.lastReportVersion || 0),
          lastDeliveryDate: String(saved?.lastDeliveryDate || ""),
          execution: saved?.execution || {},
          updatedAt: Number(saved?.updatedAt || 0),
        };
      }),
    };
  });

  return {
    actor: {
      role: adminUser?.role || "",
      canManageGlobalSchedule: GLOBAL_ADMIN_ROLES.has(adminUser?.role),
    },
    config,
    institutes: instituteRows,
    contacts: visibleContacts,
    subscriptions: visibleSubscriptions,
    joinRequests: visibleRequests,
    deliveries: visibleDeliveries,
  };
}

export async function saveParentSectionPlan(db, adminUser, input = {}, readiness = {}) {
  const institute = await assertParentInstituteAccess(db, adminUser, input?.instituteId);
  const sectionLabel = cleanParentText(input?.sectionLabel, 180);
  const sectionKey = normaliseParentSectionKey(input?.sectionKey || sectionLabel);
  if (!sectionLabel || !sectionKey) {
    const error = new Error("Choose a valid section.");
    error.statusCode = 400;
    throw error;
  }
  if (Array.isArray(input?.weekdays) && input.weekdays.length === 0) {
    const error = new Error("Choose at least one active weekday.");
    error.statusCode = 400;
    throw error;
  }
  let planId = buildParentSectionPlanId(institute.id, sectionKey);
  let explicitCurrent = {};
  if (input?.sectionPlanId) {
    const explicitSnap = await db.doc(`${COLLECTIONS.sections}/${String(input.sectionPlanId)}`).get();
    if (explicitSnap.exists) {
      explicitCurrent = explicitSnap.data() || {};
      if (String(explicitCurrent.instituteId || "") !== institute.id) {
        const error = new Error("That Parent WhatsApp section belongs to another institute.");
        error.statusCode = 403;
        throw error;
      }
      planId = explicitSnap.id;
    }
  }
  const currentSnap = Object.keys(explicitCurrent).length ? null : await db.doc(`${COLLECTIONS.sections}/${planId}`).get();
  const current = Object.keys(explicitCurrent).length
    ? explicitCurrent
    : currentSnap?.exists ? (currentSnap.data() || {}) : {};
  if (input?.enabled === true && current?.enabled !== true) {
    if (!readiness?.metaReady || !readiness?.qstashReady || !readiness?.templatesReady) {
      const error = new Error("Connect Meta, approve templates, and connect QStash before enabling a section.");
      error.statusCode = 409;
      throw error;
    }
    const subscriptions = await readCollection(db, COLLECTIONS.subscriptions);
    const contacts = await readCollection(db, COLLECTIONS.contacts);
    if (!groupParentRecipients({ contacts, subscriptions, sectionPlanId: planId }).length) {
      const error = new Error("Add at least one active, consented parent before enabling this section.");
      error.statusCode = 409;
      throw error;
    }
  }
  const skipDates = [...new Set((Array.isArray(input?.skipDates) ? input.skipDates : current?.skipDates || [])
    .map(value => String(value || "").trim())
    .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)))]
    .slice(-120);
  const payload = {
    schemaVersion: 1,
    groupId: String(institute?.groupId || ""),
    instituteId: institute.id,
    instituteName: cleanParentText(institute?.name || "", 180),
    sectionKey,
    sectionLabel,
    sectionAliases: [...new Set([
      ...(Array.isArray(current?.sectionAliases) ? current.sectionAliases : []),
      cleanParentText(current?.sectionLabel, 180),
      sectionLabel,
    ].filter(Boolean))],
    enabled: input?.enabled === true,
    status: input?.status === "closed" ? "closed" : "active",
    weekdays: normaliseWeekdays(input?.weekdays),
    skipDates,
    inviteGeneration: Number(current?.inviteGeneration || 0),
    createdAt: Number(current?.createdAt || Date.now()),
    updatedAt: Date.now(),
    updatedBy: String(adminUser?.uid || ""),
  };
  await db.doc(`${COLLECTIONS.sections}/${planId}`).set(payload, { merge: true });
  return { id: planId, ...current, ...payload };
}

async function readSectionPlanWithAccess(db, adminUser, sectionPlanId) {
  const snap = await db.doc(`${COLLECTIONS.sections}/${String(sectionPlanId || "")}`).get();
  if (!snap.exists) {
    const error = new Error("Save this section’s Parent WhatsApp settings first.");
    error.statusCode = 404;
    throw error;
  }
  const plan = { id: snap.id, ...(snap.data() || {}) };
  await assertParentInstituteAccess(db, adminUser, plan.instituteId);
  return plan;
}

export async function readParentSectionPlan(db, sectionPlanId) {
  const cleanId = String(sectionPlanId || "").trim();
  if (!cleanId) {
    const error = new Error("Choose a section.");
    error.statusCode = 400;
    throw error;
  }
  const snap = await db.doc(`${COLLECTIONS.sections}/${cleanId}`).get();
  if (!snap.exists) {
    const error = new Error("That Parent WhatsApp section is not available.");
    error.statusCode = 404;
    throw error;
  }
  return { id: snap.id, ...(snap.data() || {}) };
}

export async function readParentSectionPlanForAdmin(db, adminUser, sectionPlanId) {
  return readSectionPlanWithAccess(db, adminUser, sectionPlanId);
}

function normaliseContactInput(input = {}) {
  const phoneE164 = normaliseParentPhone(input?.phoneE164 || input?.phone);
  const parentName = cleanParentText(input?.parentName, 120);
  const childName = cleanParentText(input?.childName, 120);
  const relationship = cleanParentText(input?.relationship || "Guardian", 80) || "Guardian";
  if (!phoneE164) throw new Error("Enter a valid parent phone number.");
  if (!parentName) throw new Error("Enter the parent or guardian name.");
  if (!childName) throw new Error("Enter the student name.");
  return {
    phoneE164,
    phoneHash: parentPhoneHash(phoneE164),
    parentName,
    childName,
    relationship,
  };
}

export async function saveParentContact(db, adminUser, input = {}) {
  const plan = await readSectionPlanWithAccess(db, adminUser, input?.sectionPlanId);
  if (input?.consentConfirmed !== true && input?.enrollmentMethod !== "self_join") {
    const error = new Error("Confirm that the parent consented to WhatsApp class updates.");
    error.statusCode = 400;
    throw error;
  }
  const clean = normaliseContactInput(input);
  const contactId = stableId(`${plan.instituteId}::${clean.phoneHash}`, "parent_");
  const contactRef = db.doc(`${COLLECTIONS.contacts}/${contactId}`);
  const existingContactSnap = await contactRef.get();
  const existingContact = existingContactSnap.exists ? (existingContactSnap.data() || {}) : {};
  const subscriptions = await readCollection(db, COLLECTIONS.subscriptions);
  const sameChildElsewhere = subscriptions.find(subscription =>
    subscription?.contactId === contactId
    && sameText(subscription?.childName, clean.childName)
    && subscription?.sectionPlanId !== plan.id
    && subscription?.status === "active",
  );
  if (sameChildElsewhere && input?.confirmMove !== true) {
    const error = new Error("This child is already linked to another section. Confirm the move to continue.");
    error.statusCode = 409;
    error.code = "confirm_child_move";
    error.subscriptionId = sameChildElsewhere.id;
    throw error;
  }

  const now = Date.now();
  const subscriptionId = stableId(`${contactId}::${clean.childName.toLowerCase()}::${plan.id}`, "child_");
  const subscriptionRef = db.doc(`${COLLECTIONS.subscriptions}/${subscriptionId}`);
  const existingSubscriptionSnap = await subscriptionRef.get();
  const existingSubscription = existingSubscriptionSnap.exists ? (existingSubscriptionSnap.data() || {}) : {};
  const batch = db.batch();
  batch.set(contactRef, {
    schemaVersion: 1,
    groupId: plan.groupId || "",
    instituteId: plan.instituteId,
    instituteName: plan.instituteName,
    phoneE164: clean.phoneE164,
    phoneHash: clean.phoneHash,
    parentName: clean.parentName,
    relationship: clean.relationship,
    status: "active",
    optedOutAt: Number(existingContact?.optedOutAt || 0),
    consent: {
      confirmed: true,
      source: cleanParentText(input?.consentSource || input?.enrollmentMethod || "admin_confirmed", 120),
      confirmedAt: Number(input?.consentAt || now),
      confirmedBy: String(input?.consentBy || adminUser?.uid || ""),
    },
    createdAt: Number(existingContact?.createdAt || now),
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  }, { merge: true });
  if (sameChildElsewhere) {
    batch.set(db.doc(`${COLLECTIONS.subscriptions}/${sameChildElsewhere.id}`), {
      status: "moved",
      adminPaused: true,
      movedToSectionPlanId: plan.id,
      updatedAt: now,
      updatedBy: String(adminUser?.uid || ""),
    }, { merge: true });
  }
  batch.set(subscriptionRef, {
    schemaVersion: 1,
    groupId: plan.groupId || "",
    instituteId: plan.instituteId,
    instituteName: plan.instituteName,
    sectionPlanId: plan.id,
    sectionKey: plan.sectionKey,
    sectionLabel: plan.sectionLabel,
    contactId,
    childName: clean.childName,
    relationship: clean.relationship,
    status: "active",
    adminPaused: false,
    enrollmentMethod: input?.enrollmentMethod === "self_join" ? "self_join" : "admin",
    approvedAt: now,
    approvedBy: String(adminUser?.uid || ""),
    createdAt: Number(existingSubscription?.createdAt || now),
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  }, { merge: true });
  await batch.commit();
  return { contactId, subscriptionId };
}

export async function importParentContacts(db, adminUser, input = {}) {
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  if (!rows.length) throw new Error("Add at least one CSV row.");
  if (rows.length > 500) throw new Error("Import at most 500 rows at once.");
  if (input?.consentConfirmed !== true) throw new Error("Confirm consent for this import.");
  const results = [];
  const validation = validateParentImportRows(rows);
  validation.rows.filter(row => row.duplicate || !row.valid).forEach(row => {
    results.push({
      row: row.row,
      ok: false,
      code: row.duplicate ? "duplicate_import_row" : "invalid_import_row",
      error: row.duplicate ? "Duplicate phone + child row in this import." : row.errors.join("; "),
    });
  });
  for (const row of validation.validRows) {
    try {
      const saved = await saveParentContact(db, adminUser, {
        parentName: row.parentName,
        childName: row.childName,
        relationship: row.relationship,
        phone: row.phone,
        sectionPlanId: input?.sectionPlanId,
        consentConfirmed: true,
        consentSource: "csv_admin_confirmed",
        consentAt: Date.now(),
        confirmMove: input?.confirmMoves === true,
      });
      results.push({ row: row.row, ok: true, ...saved });
    } catch (error) {
      results.push({
        row: row.row,
        ok: false,
        code: error?.code || "",
        error: error?.message || "Could not import this row.",
      });
    }
  }
  return {
    results,
    importedCount: results.filter(item => item.ok).length,
    failedCount: results.filter(item => !item.ok).length,
  };
}

export async function setParentSubscriptionState(db, adminUser, input = {}) {
  const subscriptionRef = db.doc(`${COLLECTIONS.subscriptions}/${String(input?.subscriptionId || "")}`);
  const snap = await subscriptionRef.get();
  if (!snap.exists) throw new Error("Parent subscription was not found.");
  const subscription = { id: snap.id, ...(snap.data() || {}) };
  await assertParentInstituteAccess(db, adminUser, subscription.instituteId);
  const action = String(input?.state || "");
  const patch = {
    updatedAt: Date.now(),
    updatedBy: String(adminUser?.uid || ""),
  };
  if (action === "paused") patch.adminPaused = true;
  else if (action === "active") {
    patch.adminPaused = false;
    patch.status = "active";
  } else if (action === "revoked") {
    patch.adminPaused = true;
    patch.status = "revoked";
    patch.revokedAt = Date.now();
  } else {
    throw new Error("Choose a valid subscription state.");
  }
  await subscriptionRef.set(patch, { merge: true });
  return { ...subscription, ...patch };
}

export async function editParentSubscriptionNames(db, adminUser, input = {}) {
  const subscriptionRef = db.doc(`${COLLECTIONS.subscriptions}/${String(input?.subscriptionId || "")}`);
  const subscriptionSnap = await subscriptionRef.get();
  if (!subscriptionSnap.exists) throw new Error("Parent subscription was not found.");
  const subscription = { id: subscriptionSnap.id, ...(subscriptionSnap.data() || {}) };
  await assertParentInstituteAccess(db, adminUser, subscription.instituteId);
  const contactRef = db.doc(`${COLLECTIONS.contacts}/${String(subscription.contactId || "")}`);
  const contactSnap = await contactRef.get();
  if (!contactSnap.exists) throw new Error("Parent contact was not found.");
  const contact = { id: contactSnap.id, ...(contactSnap.data() || {}) };
  const parentName = cleanParentText(input?.parentName || contact.parentName, 120);
  const childName = cleanParentText(input?.childName || subscription.childName, 120);
  const relationship = cleanParentText(input?.relationship || subscription.relationship || contact.relationship || "Guardian", 80) || "Guardian";
  if (!parentName || !childName) throw new Error("Parent and student names are required.");
  const nextSubscriptionId = stableId(`${contact.id}::${childName.toLowerCase()}::${subscription.sectionPlanId}`, "child_");
  const now = Date.now();
  const batch = db.batch();
  batch.set(contactRef, {
    parentName,
    relationship,
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  }, { merge: true });
  const subscriptionPatch = {
    ...subscription,
    childName,
    relationship,
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  };
  delete subscriptionPatch.id;
  batch.set(db.doc(`${COLLECTIONS.subscriptions}/${nextSubscriptionId}`), subscriptionPatch, { merge: true });
  if (nextSubscriptionId !== subscription.id) batch.delete(subscriptionRef);
  await batch.commit();
  return { subscriptionId: nextSubscriptionId, parentName, childName, relationship };
}

export async function rotateParentSectionInvite(db, adminUser, sectionPlanId) {
  const plan = await readSectionPlanWithAccess(db, adminUser, sectionPlanId);
  const invites = await readCollection(db, COLLECTIONS.invites);
  const batch = db.batch();
  const now = Date.now();
  invites.filter(item => item?.sectionPlanId === plan.id && item?.active !== false).forEach(item => {
    batch.set(db.doc(`${COLLECTIONS.invites}/${item.id}`), {
      active: false,
      revokedAt: now,
      revokedBy: String(adminUser?.uid || ""),
    }, { merge: true });
  });
  const code = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "").slice(0, 8).toUpperCase();
  batch.set(db.doc(`${COLLECTIONS.invites}/${code}`), {
    schemaVersion: 1,
    code,
    groupId: plan.groupId || "",
    instituteId: plan.instituteId,
    instituteName: plan.instituteName,
    sectionPlanId: plan.id,
    sectionKey: plan.sectionKey,
    sectionLabel: plan.sectionLabel,
    generation: Number(plan?.inviteGeneration || 0) + 1,
    active: true,
    createdAt: now,
    createdBy: String(adminUser?.uid || ""),
  });
  batch.set(db.doc(`${COLLECTIONS.sections}/${plan.id}`), {
    inviteGeneration: Number(plan?.inviteGeneration || 0) + 1,
    inviteCode: code,
    inviteUpdatedAt: now,
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  }, { merge: true });
  await batch.commit();
  return {
    code,
    joinText: `JOIN ${code}`,
    sectionPlanId: plan.id,
    sectionLabel: plan.sectionLabel,
  };
}

export async function closeParentSectionInvite(db, adminUser, sectionPlanId) {
  const plan = await readSectionPlanWithAccess(db, adminUser, sectionPlanId);
  const invites = await readCollection(db, COLLECTIONS.invites);
  const batch = db.batch();
  const now = Date.now();
  invites.filter(item => item?.sectionPlanId === plan.id && item?.active !== false).forEach(item => {
    batch.set(db.doc(`${COLLECTIONS.invites}/${item.id}`), {
      active: false,
      revokedAt: now,
      revokedBy: String(adminUser?.uid || ""),
    }, { merge: true });
  });
  batch.set(db.doc(`${COLLECTIONS.sections}/${plan.id}`), {
    inviteCode: "",
    inviteUpdatedAt: now,
    updatedAt: now,
    updatedBy: String(adminUser?.uid || ""),
  }, { merge: true });
  await batch.commit();
  return { closed: true };
}

export async function readActiveParentInvite(db, code) {
  const cleanCode = cleanParentText(code, 20).toUpperCase();
  if (!cleanCode) return null;
  const snap = await db.doc(`${COLLECTIONS.invites}/${cleanCode}`).get();
  if (!snap.exists || snap.data()?.active === false) return null;
  return { id: snap.id, ...(snap.data() || {}) };
}

export async function upsertParentConversation(db, phoneE164, patch = {}) {
  const phone = normaliseParentPhone(phoneE164);
  if (!phone) throw new Error("Invalid parent phone.");
  const phoneHash = parentPhoneHash(phone);
  const ref = db.doc(`${COLLECTIONS.conversations}/${phoneHash}`);
  const snap = await ref.get();
  const current = snap.exists ? (snap.data() || {}) : {};
  const payload = {
    phoneE164: phone,
    phoneHash,
    ...patch,
    expiresAt: new Date(Date.now() + PARENT_WHATSAPP_CONVERSATION_TTL_MS),
    updatedAt: Date.now(),
    createdAt: Number(current?.createdAt || Date.now()),
  };
  await ref.set(payload, { merge: true });
  return { id: phoneHash, ...current, ...payload };
}

export async function readParentConversation(db, phoneE164) {
  const phoneHash = parentPhoneHash(phoneE164);
  if (!phoneHash) return null;
  const snap = await db.doc(`${COLLECTIONS.conversations}/${phoneHash}`).get();
  if (!snap.exists) return null;
  const data = { id: snap.id, ...(snap.data() || {}) };
  const expiresAt = typeof data?.expiresAt?.toMillis === "function"
    ? data.expiresAt.toMillis()
    : Number(data?.expiresAt || 0);
  if (expiresAt < Date.now()) return null;
  return data;
}

export async function claimParentInboundRequest(db, phoneE164, limit = 12, windowMs = 60_000) {
  const phone = normaliseParentPhone(phoneE164);
  if (!phone) return false;
  const phoneHash = parentPhoneHash(phone);
  const ref = db.doc(`${COLLECTIONS.conversations}/${phoneHash}`);
  let allowed = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() || {}) : {};
    const now = Date.now();
    const currentWindow = Number(current?.rateWindowStartedAt || 0);
    const sameWindow = now - currentWindow < windowMs;
    const count = sameWindow ? Number(current?.rateWindowCount || 0) : 0;
    if (count >= limit) return;
    tx.set(ref, {
      phoneE164: phone,
      phoneHash,
      rateWindowStartedAt: sameWindow ? currentWindow : now,
      rateWindowCount: count + 1,
      expiresAt: new Date(now + PARENT_WHATSAPP_CONVERSATION_TTL_MS),
      updatedAt: now,
      createdAt: Number(current?.createdAt || now),
    }, { merge: true });
    allowed = true;
  });
  return allowed;
}

export async function createParentJoinRequest(db, { phoneE164, invite, details, messageId = "" }) {
  const phone = normaliseParentPhone(phoneE164);
  if (!phone || !invite || !details) throw new Error("Incomplete parent join request.");
  const requestId = stableId(`${invite.sectionPlanId}::${parentPhoneHash(phone)}::${details.childName.toLowerCase()}`, "join_");
  const ref = db.doc(`${COLLECTIONS.joinRequests}/${requestId}`);
  const existing = await ref.get();
  const now = Date.now();
  await ref.set({
    schemaVersion: 1,
    groupId: invite.groupId || "",
    instituteId: invite.instituteId,
    instituteName: invite.instituteName,
    sectionPlanId: invite.sectionPlanId,
    sectionKey: invite.sectionKey,
    sectionLabel: invite.sectionLabel,
    inviteCode: invite.code,
    phoneE164: phone,
    phoneHash: parentPhoneHash(phone),
    parentName: details.parentName,
    childName: details.childName,
    relationship: details.relationship || "Guardian",
    status: "pending",
    sourceMessageId: String(messageId || ""),
    createdAt: Number(existing.exists ? existing.data()?.createdAt : now) || now,
    updatedAt: now,
  }, { merge: true });
  return { id: requestId };
}

export async function decideParentJoinRequest(db, adminUser, input = {}) {
  const requestRef = db.doc(`${COLLECTIONS.joinRequests}/${String(input?.requestId || "")}`);
  const snap = await requestRef.get();
  if (!snap.exists) throw new Error("Join request was not found.");
  const request = { id: snap.id, ...(snap.data() || {}) };
  await assertParentInstituteAccess(db, adminUser, request.instituteId);
  if (input?.decision === "reject") {
    await requestRef.set({
      status: "rejected",
      decidedAt: Date.now(),
      decidedBy: String(adminUser?.uid || ""),
      updatedAt: Date.now(),
    }, { merge: true });
    return { status: "rejected" };
  }
  const saved = await saveParentContact(db, adminUser, {
    sectionPlanId: request.sectionPlanId,
    phone: request.phoneE164,
    parentName: input?.parentName || request.parentName,
    childName: input?.childName || request.childName,
    relationship: input?.relationship || request.relationship,
    consentConfirmed: true,
    enrollmentMethod: "self_join",
    consentSource: `whatsapp_join:${request.inviteCode}`,
    consentAt: request.createdAt,
    confirmMove: input?.confirmMove === true,
  });
  await requestRef.set({
    status: "approved",
    decidedAt: Date.now(),
    decidedBy: String(adminUser?.uid || ""),
    contactId: saved.contactId,
    subscriptionId: saved.subscriptionId,
    updatedAt: Date.now(),
  }, { merge: true });
  return { status: "approved", ...saved };
}

export async function setParentPhoneOptOut(db, phoneE164, optedOut) {
  const phoneHash = parentPhoneHash(phoneE164);
  if (!phoneHash) return { updated: 0 };
  const contacts = await readCollection(db, COLLECTIONS.contacts);
  const batch = db.batch();
  const now = Date.now();
  const matching = contacts.filter(contact => contact?.phoneHash === phoneHash);
  matching.forEach(contact => {
    batch.set(db.doc(`${COLLECTIONS.contacts}/${contact.id}`), {
      optedOutAt: optedOut ? now : 0,
      optedOutSource: optedOut ? "whatsapp_stop" : "",
      updatedAt: now,
      updatedBy: "parent_whatsapp",
    }, { merge: true });
  });
  if (matching.length) await batch.commit();
  return { updated: matching.length };
}

export async function bulkMoveParentSubscriptions(db, adminUser, input = {}) {
  const targetPlan = await readSectionPlanWithAccess(db, adminUser, input?.targetSectionPlanId);
  const subscriptionIds = [...new Set((Array.isArray(input?.subscriptionIds) ? input.subscriptionIds : []).map(String).filter(Boolean))];
  if (!subscriptionIds.length) throw new Error("Select at least one child mapping to move.");
  if (subscriptionIds.length > 200) throw new Error("Move at most 200 child mappings at once.");
  const batch = db.batch();
  const now = Date.now();
  let moved = 0;
  const sourcePlanIds = new Set();
  for (const subscriptionId of subscriptionIds) {
    const snap = await db.doc(`${COLLECTIONS.subscriptions}/${subscriptionId}`).get();
    if (!snap.exists) continue;
    const current = { id: snap.id, ...(snap.data() || {}) };
    await assertParentInstituteAccess(db, adminUser, current.instituteId);
    if (String(current.instituteId || "") !== String(targetPlan.instituteId || "")) {
      const error = new Error("Academic-year moves must stay within the same institute.");
      error.statusCode = 400;
      throw error;
    }
    sourcePlanIds.add(String(current.sectionPlanId || ""));
    const nextId = stableId(`${current.contactId}::${String(current.childName || "").toLowerCase()}::${targetPlan.id}`, "child_");
    const { id: _currentId, ...currentData } = current;
    batch.set(db.doc(`${COLLECTIONS.subscriptions}/${nextId}`), {
      ...currentData,
      groupId: targetPlan.groupId || "",
      instituteId: targetPlan.instituteId,
      instituteName: targetPlan.instituteName,
      sectionPlanId: targetPlan.id,
      sectionKey: targetPlan.sectionKey,
      sectionLabel: targetPlan.sectionLabel,
      status: "active",
      adminPaused: false,
      movedFromSubscriptionId: current.id,
      createdAt: now,
      updatedAt: now,
      updatedBy: String(adminUser?.uid || ""),
    }, { merge: true });
    batch.set(db.doc(`${COLLECTIONS.subscriptions}/${current.id}`), {
      status: "moved",
      adminPaused: true,
      movedToSubscriptionId: nextId,
      movedToSectionPlanId: targetPlan.id,
      updatedAt: now,
      updatedBy: String(adminUser?.uid || ""),
    }, { merge: true });
    moved += 1;
  }
  if (input?.pauseSource === true) {
    sourcePlanIds.forEach(sourcePlanId => {
      if (!sourcePlanId || sourcePlanId === targetPlan.id) return;
      batch.set(db.doc(`${COLLECTIONS.sections}/${sourcePlanId}`), {
        enabled: false,
        rolloverPausedAt: now,
        rolloverTargetSectionPlanId: targetPlan.id,
        updatedAt: now,
        updatedBy: String(adminUser?.uid || ""),
      }, { merge: true });
    });
  }
  if (moved) await batch.commit();
  return { moved, pausedSourceCount: input?.pauseSource === true ? sourcePlanIds.size : 0 };
}

export async function listDueParentSections(db, dateContext = getParentDateContext()) {
  const snap = await db.collection(COLLECTIONS.sections).get();
  return snap.docs.map(docData).filter(section => shouldRunParentSection(section, dateContext));
}

export async function claimParentGlobalSlot(db, { dateContext, scheduleVersion }) {
  const configRef = db.doc(GLOBAL_CONFIG_PATH);
  let result = { claimed: false, reason: "unknown", config: null };
  await db.runTransaction(async tx => {
    const snap = await tx.get(configRef);
    const config = snap.exists ? (snap.data() || {}) : {};
    const version = Number(config?.scheduleVersion || 0);
    const slotKey = `${dateContext.dateKey}@${normaliseParentScheduleTime(config?.timeKey)}@${version}`;
    result.config = config;
    if (config?.enabled !== true) {
      result.reason = "disabled";
      return;
    }
    if (Number(scheduleVersion || 0) !== version) {
      result.reason = "stale_schedule";
      return;
    }
    if (String(config?.execution?.lastCompletedSlotKey || "") === slotKey) {
      result.reason = "already_completed";
      return;
    }
    const activeSlotKey = String(config?.execution?.activeSlotKey || "");
    const activeClaimedAt = Number(config?.execution?.activeClaimedAt || 0);
    if (activeSlotKey && activeSlotKey !== slotKey && dateContext.nowMs - activeClaimedAt < 15 * 60 * 1000) {
      result.reason = "another_slot_active";
      return;
    }
    tx.set(configRef, {
      execution: {
        activeSlotKey: slotKey,
        activeClaimedAt: dateContext.nowMs,
        lastAttemptAt: dateContext.nowMs,
        lastAttemptStatus: "claimed",
        activeDateKey: dateContext.dateKey,
      },
    }, { merge: true });
    result = { claimed: true, reason: "", config, slotKey };
  });
  return result;
}

export async function finalizeParentGlobalSlot(db, patch = {}) {
  const now = Date.now();
  const execution = {
    lastRunAt: now,
    lastAttemptAt: now,
    lastAttemptStatus: patch?.status || "success",
    lastSectionCount: Number(patch?.sectionCount || 0),
    lastQueuedCount: Number(patch?.queuedCount || 0),
    lastErrorMessage: cleanParentText(patch?.error || "", 600),
    activeSlotKey: "",
    activeClaimedAt: 0,
  };
  if (patch?.slotKey && patch?.status === "success") {
    execution.lastCompletedSlotKey = String(patch.slotKey);
  }
  await db.doc(GLOBAL_CONFIG_PATH).set({ execution }, { merge: true });
}

export async function loadParentSectionRecipients(db, sectionPlanId) {
  const [contacts, subscriptions] = await Promise.all([
    readCollection(db, COLLECTIONS.contacts),
    readCollection(db, COLLECTIONS.subscriptions),
  ]);
  return groupParentRecipients({ contacts, subscriptions, sectionPlanId });
}

export async function prepareParentSectionRun(db, {
  sectionPlan,
  report,
  runKind = "daily",
}) {
  const sectionRef = db.doc(`${COLLECTIONS.sections}/${sectionPlan.id}`);
  let result = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(sectionRef);
    const current = snap.exists ? (snap.data() || {}) : sectionPlan;
    const lastDate = String(current?.lastDeliveryDate || "");
    const lastHash = String(current?.lastReportHash || "");
    const lastVersion = Number(current?.lastReportVersion || 0);
    if (runKind === "retry") {
      if (lastDate !== report.dateKey || lastVersion <= 0 || lastHash !== report.contentHash) {
        result = { ready: false, reason: "nothing_to_retry", reportVersion: lastVersion };
        return;
      }
    } else if (runKind !== "corrected" && lastDate === report.dateKey && lastVersion > 0) {
      result = { ready: false, reason: "already_sent", reportVersion: lastVersion };
      return;
    }
    if (runKind === "corrected") {
      if (lastDate !== report.dateKey || lastVersion <= 0) {
        result = { ready: false, reason: "nothing_to_correct", reportVersion: lastVersion };
        return;
      }
      if (lastHash === report.contentHash) {
        result = { ready: false, reason: "unchanged", reportVersion: lastVersion };
        return;
      }
    }
    const reportVersion = runKind === "retry"
      ? lastVersion
      : lastDate === report.dateKey ? lastVersion + 1 : 1;
    const lockKey = `${report.dateKey}@${reportVersion}@${report.contentHash}`;
    const activeKey = String(current?.execution?.activeReportKey || "");
    const activeAt = Number(current?.execution?.activeClaimedAt || 0);
    // Replays of the same section/date/version are allowed to resume. Individual
    // delivery records remain the final idempotency boundary for Meta sends.
    if (activeKey && activeKey !== lockKey && Date.now() - activeAt < 15 * 60 * 1000) {
      result = { ready: false, reason: "another_run_active", reportVersion };
      return;
    }
    tx.set(sectionRef, {
      execution: {
        activeReportKey: lockKey,
        activeClaimedAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastAttemptKind: runKind,
      },
    }, { merge: true });
    result = { ready: true, reportVersion, lockKey };
  });
  return result;
}

export async function createParentDeliveryAttempt(db, {
  sectionPlan,
  report,
  reportVersion,
  runKind,
  recipient,
}) {
  const kind = runKind === "corrected"
    ? "corrected"
    : report?.entries?.length ? "daily" : "no_update";
  const deliveryId = buildParentDeliveryId({
    dateKey: report.dateKey,
    sectionPlanId: sectionPlan.id,
    phoneHash: recipient.phoneHash,
    reportVersion,
    kind,
  });
  const ref = db.doc(`${COLLECTIONS.deliveries}/${deliveryId}`);
  let claimed = false;
  let existing = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    existing = snap.exists ? (snap.data() || {}) : null;
    if (existing && ["accepted", "sent", "delivered", "read"].includes(existing.status)) return;
    if (
      existing?.status === "sending"
      && Date.now() - Number(existing?.updatedAt || 0) < 15 * 60 * 1000
    ) return;
    const attempts = Number(existing?.attempts || 0) + 1;
    tx.set(ref, {
      schemaVersion: 1,
      groupId: sectionPlan.groupId || "",
      instituteId: sectionPlan.instituteId,
      instituteName: sectionPlan.instituteName,
      sectionPlanId: sectionPlan.id,
      sectionKey: sectionPlan.sectionKey,
      sectionLabel: sectionPlan.sectionLabel,
      dateKey: report.dateKey,
      reportVersion,
      reportHash: report.contentHash,
      kind,
      phoneHash: recipient.phoneHash,
      phoneMasked: `${recipient.phone.slice(0, 3)}••••${recipient.phone.slice(-4)}`,
      contactIds: recipient.contactIds,
      subscriptionIds: recipient.subscriptionIds,
      childCount: recipient.childNames.length,
      status: "sending",
      attempts,
      createdAt: Number(existing?.createdAt || Date.now()),
      updatedAt: Date.now(),
      expiresAt: new Date(Date.now() + PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS * 86400000),
    }, { merge: true });
    claimed = true;
  });
  return { claimed, deliveryId, existing };
}

export async function finalizeParentDelivery(db, deliveryId, patch = {}) {
  await db.doc(`${COLLECTIONS.deliveries}/${deliveryId}`).set({
    ...patch,
    error: cleanParentText(patch?.error || "", 600),
    updatedAt: Date.now(),
  }, { merge: true });
}

function parentReportRecordId(sectionPlanId, dateKey, reportVersion) {
  return `${String(sectionPlanId || "")}_${String(dateKey || "")}_${Math.max(1, Number(reportVersion || 1))}`;
}

export async function readParentReportMediaId(db, {
  sectionPlanId,
  dateKey,
  reportVersion,
  reportHash,
}) {
  const ref = db.doc(`${COLLECTIONS.reports}/${parentReportRecordId(sectionPlanId, dateKey, reportVersion)}`);
  const snap = await ref.get();
  if (!snap.exists || String(snap.data()?.reportHash || "") !== String(reportHash || "")) return "";
  return String(snap.data()?.metaMediaId || "");
}

export async function saveParentReportMediaId(db, {
  sectionPlan,
  report,
  reportVersion,
  mediaId,
}) {
  if (!mediaId) return;
  const now = Date.now();
  await db.doc(`${COLLECTIONS.reports}/${parentReportRecordId(sectionPlan.id, report.dateKey, reportVersion)}`).set({
    schemaVersion: 1,
    groupId: sectionPlan.groupId || "",
    instituteId: sectionPlan.instituteId,
    sectionPlanId: sectionPlan.id,
    dateKey: report.dateKey,
    reportVersion,
    reportHash: report.contentHash,
    metaMediaId: String(mediaId),
    entryCount: report.entries.length,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now + PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS * 86400000),
  }, { merge: true });
}

export async function finalizeParentSectionRun(db, {
  sectionPlan,
  report,
  reportVersion,
  runKind,
  deliveredCount,
  failureCount,
  requestedCount,
  error = "",
}) {
  const now = Date.now();
  const patch = {
    lastDeliveryDate: report.dateKey,
    lastReportHash: report.contentHash,
    lastReportVersion: reportVersion,
    lastDeliveryAt: now,
    execution: {
      activeReportKey: "",
      activeClaimedAt: 0,
      lastAttemptAt: now,
      lastAttemptKind: runKind,
      lastAttemptStatus: failureCount === 0 ? "success" : deliveredCount > 0 ? "partial" : "failed",
      lastRequestedCount: requestedCount,
      lastDeliveredCount: deliveredCount,
      lastFailureCount: failureCount,
      lastErrorMessage: cleanParentText(error, 600),
    },
    updatedAt: now,
  };
  await db.doc(`${COLLECTIONS.sections}/${sectionPlan.id}`).set(patch, { merge: true });
  await db.doc(`${COLLECTIONS.reports}/${parentReportRecordId(sectionPlan.id, report.dateKey, reportVersion)}`).set({
    schemaVersion: 1,
    groupId: sectionPlan.groupId || "",
    instituteId: sectionPlan.instituteId,
    sectionPlanId: sectionPlan.id,
    dateKey: report.dateKey,
    reportVersion,
    reportHash: report.contentHash,
    entryCount: report.entries.length,
    runKind,
    createdAt: now,
    expiresAt: new Date(now + PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS * 86400000),
  }, { merge: true });
}

export async function findParentDeliveryByMetaMessageId(db, messageId) {
  if (!messageId) return null;
  const snap = await db.collection(COLLECTIONS.deliveries)
    .where("metaMessageId", "==", String(messageId))
    .limit(1)
    .get();
  return snap.empty ? null : docData(snap.docs[0]);
}

export async function markParentWebhookEvent(db, eventId, payload = {}) {
  const cleanId = stableId(eventId, "event_");
  const ref = db.doc(`${COLLECTIONS.webhookEvents}/${cleanId}`);
  let created = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    tx.set(ref, {
      eventId: cleanParentText(eventId, 300),
      kind: cleanParentText(payload?.kind, 80),
      createdAt: Date.now(),
      expiresAt: new Date(Date.now() + PARENT_WHATSAPP_DELIVERY_RETENTION_DAYS * 86400000),
    });
    created = true;
  });
  return created;
}

export async function cleanupExpiredParentWhatsAppRecords(db, nowMs = Date.now()) {
  const collections = [
    COLLECTIONS.conversations,
    COLLECTIONS.webhookEvents,
    COLLECTIONS.deliveries,
    COLLECTIONS.reports,
  ];
  let deleted = 0;
  for (const collectionName of collections) {
    const snap = await db.collection(collectionName).where("expiresAt", "<=", new Date(nowMs)).limit(200).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted += 1;
    });
    await batch.commit();
  }
  return { deleted };
}

export { COLLECTIONS as PARENT_WHATSAPP_COLLECTIONS };
