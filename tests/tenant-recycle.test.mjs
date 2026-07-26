import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCleanupTarget,
  stripInstituteFromSyllabusRecord,
  stripInstituteFromTeacherRecord,
} from "../api/_lib/tenantRecycle.js";

test("permanent institute deletion strips active, trash, notes, profile, and stale notices", () => {
  const result = stripInstituteFromTeacherRecord(
    {
      classes: [
        { id: "remove-by-id", instituteId: "old-inst", institute: "Old spelling" },
        { id: "remove-by-name", institute: "TGS, Karnal" },
        { id: "keep", instituteId: "keep-inst", institute: "KIS SIP" },
      ],
      institutes: ["TGS, Karnal", "KIS SIP"],
      instituteIds: ["old-inst", "keep-inst"],
      profile: { name: "Teacher", institutes: ["TGS, Karnal", "KIS SIP"] },
      notes: {
        "remove-by-id": { "2026-07-01": [{ id: "n1" }] },
        keep: { "2026-07-01": [{ id: "n2" }] },
      },
      trash: {
        classes: [
          { id: "trash-remove", institute: "TGS, Karnal" },
          { id: "trash-keep", institute: "KIS SIP" },
        ],
        notes: [
          { id: "tn1", classId: "remove-by-id", institute: "TGS, Karnal" },
          { id: "tn2", classId: "keep", institute: "KIS SIP" },
        ],
      },
      _meta: {
        revision: 5,
        pendingAdminClassNotices: [
          { id: "notice-remove", institute: "TGS, Karnal" },
          { id: "notice-keep", institute: "KIS SIP" },
        ],
      },
    },
    ["old-inst"],
    ["TGS, Karnal"],
    { now: 12345 }
  );

  assert.equal(result.changed, true);
  assert.deepEqual(result.removedClassIds.sort(), ["remove-by-id", "remove-by-name", "trash-remove"]);
  assert.deepEqual(result.data.classes.map(item => item.id), ["keep"]);
  assert.deepEqual(result.data.trash.classes.map(item => item.id), ["trash-keep"]);
  assert.deepEqual(result.data.trash.notes.map(item => item.id), ["tn2"]);
  assert.deepEqual(result.data.institutes, ["KIS SIP"]);
  assert.deepEqual(result.data.instituteIds, ["keep-inst"]);
  assert.deepEqual(result.data.profile.institutes, ["KIS SIP"]);
  assert.deepEqual(Object.keys(result.data.notes), ["keep"]);
  assert.deepEqual(result.data._meta.pendingAdminClassNotices.map(item => item.id), ["notice-keep"]);
  assert.equal(result.data._meta.previousRevision, 5);
  assert.equal(result.data._meta.revision, 6);
  assert.equal(result.data._meta.updatedAt, 12345);
});

test("syllabus cleanup removes only the deleted institute from a shared syllabus", () => {
  const result = stripInstituteFromSyllabusRecord(
    {
      instituteIds: ["old-inst", "keep-inst"],
      scope: [
        { instituteId: "old-inst", instituteName: "TGS, Karnal", sectionNames: ["A"] },
        { instituteId: "keep-inst", instituteName: "KIS SIP", sectionNames: ["B"] },
      ],
      draft: {
        instituteIds: ["old-inst", "keep-inst"],
        targets: [
          { instituteName: "TGS, Karnal", sectionName: "A" },
          { instituteName: "KIS SIP", sectionName: "B" },
        ],
      },
    },
    ["old-inst"],
    ["TGS, Karnal"]
  );

  assert.equal(result.changed, true);
  assert.equal(result.hasRemainingScope, true);
  assert.deepEqual(result.data.instituteIds, ["keep-inst"]);
  assert.deepEqual(result.data.scope.map(item => item.instituteName), ["KIS SIP"]);
  assert.deepEqual(result.data.draft.instituteIds, ["keep-inst"]);
  assert.deepEqual(result.data.draft.targets.map(item => item.instituteName), ["KIS SIP"]);
});

test("syllabus cleanup reports no remaining scope when the deleted institute was the only target", () => {
  const result = stripInstituteFromSyllabusRecord(
    {
      instituteIds: ["old-inst"],
      instituteName: "TGS, Karnal",
      scope: [{ instituteId: "old-inst", instituteName: "TGS, Karnal" }],
      draft: {
        targets: [{ instituteName: "TGS, Karnal" }],
      },
    },
    ["old-inst"],
    ["TGS, Karnal"]
  );

  assert.equal(result.changed, true);
  assert.equal(result.hasRemainingScope, false);
});

test("manual institute deletion does not expand cleanup through legacy aliases", () => {
  const target = {
    entityType: "institute",
    institutes: [{
      id: "duplicate-institute",
      name: "The Genesis School",
      legacyName: "The Genesis School",
      legacyAliases: ["The Genesis School, Sec 08, Karnal, Haryana"],
    }],
  };

  const cleanupTarget = buildCleanupTarget(target, true);

  assert.deepEqual(cleanupTarget.institutes[0].legacyAliases, []);
  assert.equal(cleanupTarget.institutes[0].legacyName, "The Genesis School");
  assert.deepEqual(target.institutes[0].legacyAliases, [
    "The Genesis School, Sec 08, Karnal, Haryana",
  ]);
});
