export const GENESIS_INSTITUTE_ALIASES = Object.freeze({
  "tgs, karnal": "The Genesis School, Sec 08, Karnal, Haryana",
  "the genesis school": "The Genesis School, Sec 08, Karnal, Haryana",
  "pratham": "Pratham, Sec-06, Karnal, Haryana",
  "gis karnal, haryana": "GIS, Karnal, Haryana",
});

export function normaliseGenesisInstituteKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function createGenesisInstituteResolver(canonicalNames = []) {
  const canonicalByKey = new Map();
  canonicalNames.forEach(name => {
    const label = String(name || "").trim();
    const key = normaliseGenesisInstituteKey(label);
    if (key && !canonicalByKey.has(key)) canonicalByKey.set(key, label);
  });

  const aliasByKey = new Map();
  Object.entries(GENESIS_INSTITUTE_ALIASES).forEach(([alias, target]) => {
    const canonical = canonicalByKey.get(normaliseGenesisInstituteKey(target));
    if (canonical) aliasByKey.set(normaliseGenesisInstituteKey(alias), canonical);
  });

  const resolve = value => {
    const label = String(value || "").trim();
    const key = normaliseGenesisInstituteKey(label);
    if (!key) return null;
    const direct = canonicalByKey.get(key);
    if (direct) return { input: label, canonicalName: direct, viaAlias: false };
    const alias = aliasByKey.get(key);
    return alias ? { input: label, canonicalName: alias, viaAlias: true } : null;
  };

  const aliasesFor = canonicalName => Object.entries(GENESIS_INSTITUTE_ALIASES)
    .filter(([, target]) =>
      normaliseGenesisInstituteKey(target) === normaliseGenesisInstituteKey(canonicalName)
    )
    .map(([alias]) => alias);

  return {
    canonicalNames: Array.from(canonicalByKey.values()),
    resolve,
    aliasesFor,
  };
}

export function uniqueGenesisLabels(values = []) {
  const result = [];
  values.forEach(value => {
    const label = String(value || "").trim();
    if (!label) return;
    const key = normaliseGenesisInstituteKey(label);
    if (result.some(item => normaliseGenesisInstituteKey(item) === key)) return;
    result.push(label);
  });
  return result;
}

export function collectGenesisTeacherInstituteNames(index = {}, main = {}) {
  return uniqueGenesisLabels([
    ...(Array.isArray(index?.institutes) ? index.institutes : []),
    ...(Array.isArray(main?.institutes) ? main.institutes : []),
    ...(Array.isArray(main?.profile?.institutes) ? main.profile.institutes : []),
    ...(Array.isArray(main?.classes) ? main.classes.map(item => item?.institute) : []),
  ]);
}

export function mapGenesisClasses(classes, resolver, instituteByCanonicalName, groupId) {
  const unknownLabels = [];
  let mappedClassCount = 0;
  const mapped = (Array.isArray(classes) ? classes : []).map(item => {
    const label = String(item?.institute || "").trim();
    const resolved = resolver.resolve(label);
    const institute = resolved
      ? instituteByCanonicalName.get(normaliseGenesisInstituteKey(resolved.canonicalName))
      : null;
    if (!resolved || !institute) {
      if (label) unknownLabels.push(label);
      return item;
    }
    mappedClassCount += 1;
    return {
      ...item,
      groupId,
      instituteId: institute.id,
    };
  });
  return {
    classes: mapped,
    mappedClassCount,
    unknownLabels: uniqueGenesisLabels(unknownLabels),
  };
}

function canonicalPlainValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(canonicalPlainValue);
  if (typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return String(value);
    return value;
  }
  if (typeof value.toMillis === "function" && Number.isFinite(value.seconds)) {
    return {
      __type: "timestamp",
      seconds: Number(value.seconds),
      nanoseconds: Number(value.nanoseconds || 0),
    };
  }
  if (typeof value.path === "string" && value.firestore) {
    return { __type: "reference", path: value.path };
  }
  if (Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) {
    return {
      __type: "geopoint",
      latitude: Number(value.latitude),
      longitude: Number(value.longitude),
    };
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalPlainValue(value[key])])
  );
}

function removeKeys(target, keys) {
  keys.forEach(key => {
    if (target && typeof target === "object") delete target[key];
  });
}

export function stripGenesisMigrationFields(path, source) {
  const value = canonicalPlainValue(source);
  if (!value || typeof value !== "object") return value;

  if (/^users\/[^/]+\/appdata\/main$/.test(path)) {
    removeKeys(value, [
      "groupId",
      "groupIds",
      "instituteIds",
      "tenantMigratedAt",
    ]);
    value.classes = (Array.isArray(value.classes) ? value.classes : []).map(item => {
      if (!item || typeof item !== "object") return item;
      const next = { ...item };
      removeKeys(next, ["groupId", "instituteId"]);
      return next;
    });
  } else if (/^teachers\/[^/]+$/.test(path)) {
    removeKeys(value, [
      "groupIds",
      "instituteIds",
      "legacyUnassigned",
      "tenantMigratedAt",
      "migratedAt",
    ]);
  } else if (/^roles\/[^/]+$/.test(path)) {
    if (value.role === "group_admin" && value.migratedFromRole === "admin") {
      value.role = "admin";
    }
    removeKeys(value, [
      "groupId",
      "instituteId",
      "instituteIds",
      "legacyUnassigned",
      "tenantMigratedAt",
      "migratedAt",
      "migratedBy",
      "migratedFromRole",
    ]);
  } else if (/^(syllabusTemplates|publishedSyllabi)\/[^/]+$/.test(path)) {
    removeKeys(value, ["groupId", "instituteIds", "tenantMigratedAt"]);
  } else if (/^feedbackThreads\/[^/]+$/.test(path)) {
    removeKeys(value, ["groupId", "instituteIds", "tenantMigratedAt"]);
  } else if (/^invites\/[^/]+$/.test(path)) {
    removeKeys(value, ["groupId", "tenantMigratedAt"]);
  } else if (path === "config/ledgrTelegramDelivery") {
    removeKeys(value, ["tenantMigratedAt"]);
    value.recipients = (Array.isArray(value.recipients) ? value.recipients : []).map(item => {
      if (!item || typeof item !== "object") return item;
      const next = { ...item };
      removeKeys(next, ["groupId", "instituteId"]);
      return next;
    });
    value.fullReportRecipients = (
      Array.isArray(value.fullReportRecipients) ? value.fullReportRecipients : []
    ).map(item => {
      if (!item || typeof item !== "object") return item;
      const next = { ...item };
      removeKeys(next, ["groupId"]);
      return next;
    });
  } else if (path === "config/ledgrReportSchedule") {
    removeKeys(value, ["groupId", "instituteIds", "tenantMigratedAt"]);
    if (value.scope && typeof value.scope === "object") {
      value.scope = { ...value.scope };
      removeKeys(value.scope, ["instituteIds"]);
    }
  }

  return value;
}

export function stableGenesisSerialize(value) {
  return JSON.stringify(canonicalPlainValue(value));
}

export function compareGenesisSnapshots(beforeEntries, afterEntries) {
  const afterByPath = new Map(afterEntries.map(item => [item.path, item.data]));
  const mismatches = [];
  beforeEntries.forEach(item => {
    if (!afterByPath.has(item.path)) {
      mismatches.push({ path: item.path, reason: "missing_after_migration" });
      return;
    }
    const beforeValue = stripGenesisMigrationFields(item.path, item.data);
    const afterValue = stripGenesisMigrationFields(item.path, afterByPath.get(item.path));
    if (stableGenesisSerialize(beforeValue) !== stableGenesisSerialize(afterValue)) {
      mismatches.push({ path: item.path, reason: "legacy_fields_changed" });
    }
  });
  return mismatches;
}

export function countGenesisEntryRows(notes) {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return 0;
  return Object.values(notes).reduce(
    (sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0),
    0
  );
}

export function countGenesisLeafValues(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countGenesisLeafValues(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (sum, item) => sum + countGenesisLeafValues(item),
      0
    );
  }
  return 1;
}
