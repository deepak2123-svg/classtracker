import assert from "node:assert/strict";
import test from "node:test";
import {
  collectGenesisTeacherInstituteNames,
  compareGenesisSnapshots,
  countGenesisEntryRows,
  createGenesisInstituteResolver,
  mapGenesisClasses,
} from "../src/tenant/genesisMigration.js";

const canonicalInstitutes = [
  "GIS, Karnal, Haryana",
  "Pratham, Sec-06, Karnal, Haryana",
  "The Genesis School, Sec 08, Karnal, Haryana",
];

test("Genesis aliases resolve without renaming source labels", () => {
  const resolver = createGenesisInstituteResolver(canonicalInstitutes);
  assert.deepEqual(resolver.resolve("TGS, Karnal"), {
    input: "TGS, Karnal",
    canonicalName: "The Genesis School, Sec 08, Karnal, Haryana",
    viaAlias: true,
  });
  assert.deepEqual(resolver.resolve("GIS Karnal, Haryana"), {
    input: "GIS Karnal, Haryana",
    canonicalName: "GIS, Karnal, Haryana",
    viaAlias: true,
  });
  assert.equal(resolver.resolve("Unknown Campus"), null);
});

test("class backfill adds tenant IDs while preserving every legacy field", () => {
  const resolver = createGenesisInstituteResolver(canonicalInstitutes);
  const instituteByCanonicalName = new Map([
    ["the genesis school, sec 08, karnal, haryana", { id: "inst-tgs" }],
  ]);
  const original = [{
    id: "class-1",
    institute: "TGS, Karnal",
    section: "10-A",
    subject: "Physics",
    custom: { nested: ["unchanged", 4] },
  }];
  const result = mapGenesisClasses(
    original,
    resolver,
    instituteByCanonicalName,
    "genesis-group"
  );
  assert.equal(result.unknownLabels.length, 0);
  assert.equal(result.mappedClassCount, 1);
  assert.deepEqual(result.classes[0], {
    ...original[0],
    groupId: "genesis-group",
    instituteId: "inst-tgs",
  });
  assert.equal(result.classes[0].institute, "TGS, Karnal");
});

test("parity comparison ignores only migration fields", () => {
  const before = [{
    path: "users/teacher-1/appdata/main",
    data: {
      profile: { name: "Teacher One" },
      classes: [{ id: "class-1", institute: "TGS, Karnal", section: "10-A" }],
    },
  }];
  const after = [{
    path: "users/teacher-1/appdata/main",
    data: {
      profile: { name: "Teacher One" },
      groupId: "genesis-group",
      groupIds: ["genesis-group"],
      instituteIds: ["inst-tgs"],
      tenantMigratedAt: 123,
      classes: [{
        id: "class-1",
        institute: "TGS, Karnal",
        section: "10-A",
        groupId: "genesis-group",
        instituteId: "inst-tgs",
      }],
    },
  }];
  assert.deepEqual(compareGenesisSnapshots(before, after), []);

  after[0].data.classes[0].section = "10-B";
  assert.deepEqual(compareGenesisSnapshots(before, after), [{
    path: "users/teacher-1/appdata/main",
    reason: "legacy_fields_changed",
  }]);
});

test("teacher institute discovery and note counts retain legacy structure", () => {
  const names = collectGenesisTeacherInstituteNames(
    { institutes: ["GIS Karnal, Haryana"] },
    {
      profile: { institutes: ["The Genesis School"] },
      classes: [
        { institute: "GIS Karnal, Haryana" },
        { institute: "Pratham" },
      ],
    }
  );
  assert.deepEqual(names, [
    "GIS Karnal, Haryana",
    "The Genesis School",
    "Pratham",
  ]);
  assert.equal(countGenesisEntryRows({
    "2026-07-15": [{ id: 1 }, { id: 2 }],
    "2026-07-16": [{ id: 3 }],
  }), 3);
});
