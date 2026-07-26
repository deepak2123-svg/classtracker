import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { SignJWT } from "jose";
import {
  buildParentQstashCron,
  buildParentReportHash,
  buildParentTemplatePayload,
  getParentDateContext,
  groupParentRecipients,
  normaliseParentPhone,
  parseParentJoinDetails,
  shouldRunParentSection,
  validateParentImportRows,
} from "../api/_lib/parentWhatsAppCore.js";
import { buildParentSectionReport } from "../api/_lib/ledgrReportServer.js";
import {
  verifyMetaWebhookSignature,
  verifyQstashRequest,
} from "../api/_lib/parentWhatsAppDelivery.js";
import { assertParentInstituteAccess } from "../api/_lib/parentWhatsAppStore.js";

test("normalises Indian and international phone numbers to E.164", () => {
  assert.equal(normaliseParentPhone("98765 43210"), "+919876543210");
  assert.equal(normaliseParentPhone("09876543210"), "+919876543210");
  assert.equal(normaliseParentPhone("+44 7700 900123"), "+447700900123");
  assert.equal(normaliseParentPhone("123"), "");
  assert.equal(normaliseParentPhone("+91+9876543210"), "");
});

test("CSV row validation rejects invalid rows and deduplicates phone + child", () => {
  const result = validateParentImportRows([
    { parent_name: "Asha", student_name: "Riya", phone: "9876543210" },
    { parent_name: "Asha", student_name: "Riya", phone: "+91 98765 43210" },
    { parent_name: "Kabir", student_name: "Zoya", phone: "+44 7700 900123", relationship: "Father" },
    { parent_name: "", student_name: "Missing", phone: "9876543211" },
  ]);
  assert.equal(result.validRows.length, 2);
  assert.equal(result.duplicateRows.length, 1);
  assert.equal(result.invalidRows.length, 1);
  assert.equal(result.validRows[0].relationship, "Guardian");
});

test("groups siblings by phone and section while STOP and admin pause take precedence", () => {
  const contacts = [
    { id: "p1", status: "active", phoneE164: "+919876543210", parentName: "Asha", phoneHash: "hash-1" },
    { id: "p2", status: "active", phoneE164: "+919999999999", parentName: "Stopped", phoneHash: "hash-2", optedOutAt: 1 },
  ];
  const subscriptions = [
    { id: "s1", sectionPlanId: "8a", contactId: "p1", childName: "Riya", status: "active" },
    { id: "s2", sectionPlanId: "8a", contactId: "p1", childName: "Karan", status: "active" },
    { id: "s3", sectionPlanId: "8a", contactId: "p1", childName: "Paused", status: "active", adminPaused: true },
    { id: "s4", sectionPlanId: "8a", contactId: "p2", childName: "Stopped child", status: "active" },
    { id: "s5", sectionPlanId: "8b", contactId: "p1", childName: "Other section", status: "active" },
  ];
  const groups = groupParentRecipients({ contacts, subscriptions, sectionPlanId: "8a" });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].childNames, ["Riya", "Karan"]);
  assert.deepEqual(groups[0].subscriptionIds, ["s1", "s2"]);
});

test("builds document and no-update Meta template payloads without leaking PDF names into no-update", () => {
  const daily = buildParentTemplatePayload({
    to: "+919876543210",
    kind: "daily",
    parentName: "Asha",
    childNames: ["Riya", "Karan"],
    instituteName: "Ledgr School",
    sectionLabel: "8th A",
    dateLabel: "26 Jul 2026",
    summary: "• Maths: Fractions",
    mediaId: "media-1",
    filename: "class-update.pdf",
  });
  assert.equal(daily.template.name, "ledgr_parent_daily_update_en_v1");
  assert.equal(daily.template.components[0].type, "header");
  assert.equal(daily.template.components[0].parameters[0].document.id, "media-1");

  const empty = buildParentTemplatePayload({
    to: "+919876543210",
    kind: "no_update",
    parentName: "Asha",
    childNames: ["Riya"],
    instituteName: "Ledgr School",
    sectionLabel: "8th A",
    dateLabel: "26 Jul 2026",
  });
  assert.equal(empty.template.name, "ledgr_parent_no_update_en_v1");
  assert.equal(empty.template.components.length, 1);
  assert.equal(empty.template.components[0].type, "body");
});

test("report hashes are stable and change with corrected teaching content", () => {
  const report = {
    dateKey: "2026-07-26",
    instituteId: "inst-1",
    sectionPlanId: "8a",
    sectionLabel: "8th A",
    entries: [{ sourceId:"e1", subject:"Maths", title:"Fractions", notes:"Pages 1–3", teacherName:"Ms Rao" }],
  };
  assert.equal(buildParentReportHash(report), buildParentReportHash({...report, entries:[...report.entries]}));
  assert.notEqual(
    buildParentReportHash(report),
    buildParentReportHash({...report, entries:[{...report.entries[0], notes:"Pages 1–4"}]}),
  );
});

test("Asia/Kolkata schedule calculations honor weekdays and holiday skips", () => {
  const context = getParentDateContext(new Date("2026-07-26T19:00:00.000Z"));
  assert.equal(context.dateKey, "2026-07-27");
  assert.equal(context.weekday, 1);
  assert.equal(buildParentQstashCron("08:05"), "CRON_TZ=Asia/Kolkata 5 8 * * *");
  assert.equal(shouldRunParentSection({ enabled:true, status:"active", weekdays:[1], skipDates:[] }, context), true);
  assert.equal(shouldRunParentSection({ enabled:true, status:"active", weekdays:[1], skipDates:["2026-07-27"] }, context), false);
  assert.equal(shouldRunParentSection({ enabled:false, weekdays:[1] }, context), false);
});

test("JOIN detail parser requires parent and student names", () => {
  assert.deepEqual(parseParentJoinDetails("Asha | Riya | Mother"), {
    parentName: "Asha",
    childName: "Riya",
    relationship: "Mother",
  });
  assert.equal(parseParentJoinDetails("Only one field"), null);
});

test("parent report preserves canonical rename, actual subject and joint-class deduplication", async () => {
  const dataByPath = {
    "config/sections": {
      "KIS South": {
        gradeGroups: [{ id:"8", sections:["8th A"] }],
        sectionChangeEvents: [{
          createdAt: 1,
          changes: [{ oldSection:"8 A", newSection:"8th A" }],
        }],
      },
    },
    "users/teacher-1/appdata/main": {
      profile: { name:"Ms Rao", institutes:["KIS South"] },
      classes: [
        { id:"math-8a", institute:"KIS South", section:"8 A", subject:"Mathematics" },
        { id:"science-8a", institute:"KIS South", section:"8th A", subject:"Science" },
      ],
    },
    "users/teacher-1/appdata/notes_math-8a": {
      "2026-07-26": [
        {
          id:"joint-1",
          jointSessionId:"joint-1",
          jointPrimaryClassId:"math-8a",
          jointClassIds:["math-8a","science-8a"],
          timeStart:"09:00",
          title:"Linear equations",
          body:"Examples 1–4\nPractice 1–8",
          tag:"note",
        },
        {
          id:"syllabus-1",
          timeStart:"09:45",
          title:"Completed Algebra",
          body:"Syllabus progress update",
          tag:"syllabus",
        },
      ],
    },
    "users/teacher-1/appdata/notes_science-8a": {
      "2026-07-26": [{
        id:"science-1",
        timeStart:"10:00",
        title:"Atomic structure",
        body:"Compared Thomson and Rutherford models.",
        tag:"note",
      }],
    },
  };
  const fakeSnap = (path, data, id = path.split("/").at(-1)) => ({
    id,
    exists: data !== undefined,
    data: () => data,
    ref: { path },
  });
  const db = {
    collection(name) {
      return {
        async get() {
          if (name === "teachers") {
            return { docs:[fakeSnap("teachers/teacher-1", {uid:"teacher-1",name:"Ms Rao",institutes:["KIS South"]},"teacher-1")] };
          }
          if (name === "roles") return { docs:[] };
          return { docs:[] };
        },
      };
    },
    collectionGroup() {
      return { where: () => ({ get: async () => ({ docs:[] }) }) };
    },
    doc(path) {
      return {
        path,
        get: async () => fakeSnap(path, dataByPath[path]),
      };
    },
    async getAll(...refs) {
      return refs.map(ref => fakeSnap(ref.path, dataByPath[ref.path]));
    },
  };
  const report = await buildParentSectionReport({
    db,
    instituteId:"inst-1",
    instituteName:"KIS South",
    sectionPlanId:"plan-8a",
    sectionKey:"8-a",
    sectionLabel:"8 A",
    now:new Date("2026-07-26T06:00:00.000Z"),
  });
  assert.equal(report.sectionLabel, "8th A");
  assert.equal(report.entries.length, 2);
  assert.deepEqual(report.entries.map(entry => entry.subject), ["Mathematics","Science"]);
  assert.equal(report.entries[0].teacherName, "Ms Rao");
  assert.equal(report.entries[0].notes, "Examples 1–4\nPractice 1–8");
  assert.equal(report.html.includes("09:00"), false);
  assert.equal(report.html.includes("Syllabus progress update"), false);
});

test("Meta webhook signature rejects forged bodies", () => {
  const previous = process.env.WHATSAPP_APP_SECRET;
  process.env.WHATSAPP_APP_SECRET = "test-meta-secret";
  try {
    const rawBody = JSON.stringify({ object:"whatsapp_business_account" });
    const signature = `sha256=${crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex")}`;
    assert.equal(verifyMetaWebhookSignature({ signature, rawBody }), true);
    assert.equal(verifyMetaWebhookSignature({ signature, rawBody:`${rawBody}x` }), false);
    assert.equal(verifyMetaWebhookSignature({ signature:"sha256=forged", rawBody }), false);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = previous;
  }
});

test("QStash signature verifies body and destination and rejects replay to another route", async () => {
  const previousCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const previousNext = process.env.QSTASH_NEXT_SIGNING_KEY;
  const signingKey = "unit-test-qstash-key";
  process.env.QSTASH_CURRENT_SIGNING_KEY = signingKey;
  process.env.QSTASH_NEXT_SIGNING_KEY = "unit-test-next-key";
  try {
    const body = JSON.stringify({ sectionPlanId:"8a", dateKey:"2026-07-26" });
    const url = "https://admin.ledgrclasses.com/api/parent-whatsapp-worker";
    const bodyHash = crypto.createHash("sha256").update(body).digest("base64url");
    const signature = await new SignJWT({ body:bodyHash })
      .setProtectedHeader({ alg:"HS256" })
      .setIssuer("Upstash")
      .setSubject(url)
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(new TextEncoder().encode(signingKey));
    assert.equal(await verifyQstashRequest({ signature, body, url }), true);
    assert.equal(await verifyQstashRequest({ signature, body:`${body}x`, url }), false);
    assert.equal(await verifyQstashRequest({ signature, body, url:`${url}-forged` }), false);
  } finally {
    if (previousCurrent === undefined) delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    else process.env.QSTASH_CURRENT_SIGNING_KEY = previousCurrent;
    if (previousNext === undefined) delete process.env.QSTASH_NEXT_SIGNING_KEY;
    else process.env.QSTASH_NEXT_SIGNING_KEY = previousNext;
  }
});

test("Parent WhatsApp API scope permits only the assigned tenant", async () => {
  const institutes = {
    "inst-1": { name:"One", groupId:"group-1", status:"active" },
    "inst-2": { name:"Two", groupId:"group-2", status:"active" },
  };
  const db = {
    doc(path) {
      const id = path.split("/").at(-1);
      return {
        get: async () => ({
          id,
          exists: !!institutes[id],
          data: () => institutes[id],
        }),
      };
    },
  };
  await assert.doesNotReject(() => assertParentInstituteAccess(db, {role:"manager"}, "inst-2"));
  await assert.doesNotReject(() => assertParentInstituteAccess(db, {role:"group_admin",groupId:"group-1"}, "inst-1"));
  await assert.rejects(
    () => assertParentInstituteAccess(db, {role:"group_admin",groupId:"group-1"}, "inst-2"),
    error => error.statusCode === 403,
  );
  await assert.doesNotReject(() => assertParentInstituteAccess(db, {role:"institute_admin",instituteId:"inst-1"}, "inst-1"));
  await assert.rejects(
    () => assertParentInstituteAccess(db, {role:"institute_admin",instituteId:"inst-1"}, "inst-2"),
    error => error.statusCode === 403,
  );
});
