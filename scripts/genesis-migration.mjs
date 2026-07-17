import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  collectGenesisTeacherInstituteNames,
  countGenesisEntryRows,
  countGenesisLeafValues,
  createGenesisInstituteResolver,
  normaliseGenesisInstituteKey,
  uniqueGenesisLabels,
} from "../src/tenant/genesisMigration.js";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "classtracker-84920";
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "(default)";
const MANAGER_UID = process.env.GENESIS_MANAGER_UID || "ygjJz0IuS1daqX15KB9Nyq08R3i1";
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN || "";
const ROOT_URL = process.env.FIRESTORE_REST_ROOT ||
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const IGNORE_PRECONDITIONS = process.env.GENESIS_IGNORE_PRECONDITIONS === "true";
const DOCUMENT_NAME_PREFIX =
  `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/`;
const GENESIS_GROUP_ID = "genesis-group";
const MAX_COMMIT_WRITES = 100;
const MAX_COMMIT_BYTES = 5 * 1024 * 1024;

function parseArgs(argv) {
  const args = { mode: "dry-run", backupDir: "", baseline: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--execute") args.mode = "execute";
    else if (value === "--dry-run") args.mode = "dry-run";
    else if (value === "--backup-dir") args.backupDir = argv[++index] || "";
    else if (value === "--baseline") args.baseline = argv[++index] || "";
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function encodePath(value) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function relativeDocumentPath(name) {
  return String(name || "").startsWith(DOCUMENT_NAME_PREFIX)
    ? String(name).slice(DOCUMENT_NAME_PREFIX.length)
    : "";
}

function fullDocumentName(relativePath) {
  return `${DOCUMENT_NAME_PREFIX}${relativePath}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normaliseLabel(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function decodeValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeValue);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item)])
    );
  }
  return null;
}

function decodeDocument(document) {
  return Object.fromEntries(
    Object.entries(document?.fields || {}).map(([key, value]) => [key, decodeValue(value)])
  );
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, encodeValue(item)])
        ),
      },
    };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function encodeFields(value) {
  return Object.fromEntries(
    Object.entries(value || {}).map(([key, item]) => [key, encodeValue(item)])
  );
}

function clone(value) {
  return structuredClone(value);
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortDeep(value[key])])
  );
}

function rawString(fieldValue) {
  return String(fieldValue?.stringValue || "").trim();
}

function rawArrayStrings(values) {
  return (values || []).map(item => ({ stringValue: item }));
}

function rawMapFields(arrayItem) {
  return arrayItem?.mapValue?.fields || {};
}

function rawPathValue(document, fieldPath) {
  const parts = String(fieldPath || "").split(".");
  let fields = document?.fields || {};
  let value = null;
  for (let index = 0; index < parts.length; index += 1) {
    value = fields?.[parts[index]];
    if (index < parts.length - 1) fields = value?.mapValue?.fields || {};
  }
  return value;
}

function rawArrayMaps(value, transform) {
  const current = value?.arrayValue?.values || [];
  return {
    arrayValue: {
      values: current.map((item, index) => {
        if (!item?.mapValue) return item;
        return transform(clone(item), index);
      }),
    },
  };
}

function isActiveClassRecord(item) {
  if (!item || typeof item !== "object") return false;
  if (item.left || item.archived || item.archivedByAdmin || item.transferArchive) return false;
  return Number(item.deletedAt || 0) <= 0;
}

function teacherIndexFromMain(uid, main, now) {
  const classes = (Array.isArray(main?.classes) ? main.classes : []).filter(isActiveClassRecord);
  const classInstitutes = uniqueGenesisLabels(classes.map(item => item?.institute));
  const profileInstitutes = uniqueGenesisLabels(main?.profile?.institutes || []);
  const classSubjects = uniqueGenesisLabels(classes.map(item => item?.subject));
  const profileSubjects = uniqueGenesisLabels(main?.profile?.subjects || []);
  const revision = Number(main?._meta?.revision || 0);
  return {
    uid,
    name: String(main?.profile?.name || ""),
    email: String(main?.profile?.email || ""),
    institutes: classInstitutes.length ? classInstitutes : profileInstitutes,
    subjects: classSubjects.length ? classSubjects : profileSubjects,
    classCount: classes.length,
    mainRevision: Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : 0,
    lastActive: now,
  };
}

function syllabusInstituteNames(source = {}) {
  return uniqueGenesisLabels([
    source?.instituteName,
    source?.draft?.instituteName,
    source?.published?.instituteName,
    ...(Array.isArray(source?.scope) ? source.scope.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.draft?.scope)
      ? source.draft.scope.map(item => item?.instituteName)
      : []),
    ...(Array.isArray(source?.published?.scope)
      ? source.published.scope.map(item => item?.instituteName)
      : []),
    ...(Array.isArray(source?.targets) ? source.targets.map(item => item?.instituteName) : []),
    ...(Array.isArray(source?.draft?.targets)
      ? source.draft.targets.map(item => item?.instituteName)
      : []),
    ...(Array.isArray(source?.published?.targets)
      ? source.published.targets.map(item => item?.instituteName)
      : []),
  ]);
}

async function requestJson(url, options = {}, attempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      if (response.ok) return await response.json();
      const body = await response.text();
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${response.status} ${body}`);
      }
      lastError = new Error(`${response.status} ${body}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function listCollectionIds(parentPath = "") {
  const ids = [];
  let pageToken = "";
  do {
    const suffix = parentPath ? `/${encodePath(parentPath)}:listCollectionIds` : ":listCollectionIds";
    const response = await requestJson(`${ROOT_URL}${suffix}`, {
      method: "POST",
      body: JSON.stringify({
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    ids.push(...(response.collectionIds || []));
    pageToken = response.nextPageToken || "";
  } while (pageToken);
  return ids.sort();
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      pageSize: "1000",
      showMissing: "true",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await requestJson(
      `${ROOT_URL}/${encodePath(collectionPath)}?${query.toString()}`
    );
    documents.push(...(response.documents || []));
    pageToken = response.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function exportFirestoreSnapshot() {
  const actualDocuments = new Map();
  const collectionPaths = new Set();
  let missingParentCount = 0;
  let currentCollections = await listCollectionIds();
  let depth = 0;

  while (currentCollections.length) {
    currentCollections = uniqueGenesisLabels(currentCollections);
    currentCollections.forEach(item => collectionPaths.add(item));
    console.log(`[backup] scanning depth ${depth}: ${currentCollections.length} collections`);
    const listed = await mapLimit(currentCollections, 12, async collectionPath => ({
      collectionPath,
      documents: await listDocuments(collectionPath),
    }));

    const parentPaths = [];
    listed.forEach(({ documents }) => {
      documents.forEach(document => {
        const relativePath = relativeDocumentPath(document.name);
        if (!relativePath) return;
        parentPaths.push(relativePath);
        if (document.fields || document.createTime || document.updateTime) {
          actualDocuments.set(relativePath, {
            ...document,
            fields: document.fields || {},
          });
        } else {
          missingParentCount += 1;
        }
      });
    });

    const subcollections = await mapLimit(parentPaths, 24, async parentPath => ({
      parentPath,
      ids: await listCollectionIds(parentPath),
    }));
    currentCollections = subcollections.flatMap(({ parentPath, ids }) =>
      ids.map(id => `${parentPath}/${id}`)
    );
    depth += 1;
  }

  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    createdAt: Date.now(),
    collectionPaths: Array.from(collectionPaths).sort(),
    missingParentCount,
    documents: Array.from(actualDocuments.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([relativePath, document]) => ({ relativePath, ...document })),
  };
}

async function saveVerifiedBackup(snapshot, backupDir) {
  await fs.mkdir(backupDir, { recursive: true });
  const json = JSON.stringify(snapshot);
  const jsonBuffer = Buffer.from(json, "utf8");
  const digest = sha256(jsonBuffer);
  const baseName = `genesis-firestore-${timestampSlug(new Date(snapshot.createdAt))}`;
  const backupPath = path.join(backupDir, `${baseName}.json.gz`);
  const digestPath = path.join(backupDir, `${baseName}.sha256`);
  await fs.writeFile(backupPath, gzipSync(jsonBuffer, { level: 9 }));
  await fs.writeFile(digestPath, `${digest}  ${path.basename(backupPath)}\n`, "utf8");

  const verifiedBuffer = gunzipSync(await fs.readFile(backupPath));
  const verifiedDigest = sha256(verifiedBuffer);
  const verifiedSnapshot = JSON.parse(verifiedBuffer.toString("utf8"));
  if (verifiedDigest !== digest) throw new Error("Backup hash verification failed.");
  if (verifiedSnapshot.documents.length !== snapshot.documents.length) {
    throw new Error("Backup document count verification failed.");
  }
  return { backupPath, digestPath, sha256: digest, bytes: jsonBuffer.length };
}

async function loadBackup(backupPath) {
  const compressed = await fs.readFile(backupPath);
  const jsonBuffer = gunzipSync(compressed);
  return {
    snapshot: JSON.parse(jsonBuffer.toString("utf8")),
    sha256: sha256(jsonBuffer),
    backupPath,
    bytes: jsonBuffer.length,
  };
}

function documentsByPath(snapshot) {
  return new Map(snapshot.documents.map(document => [document.relativePath, document]));
}

function decodedByPath(snapshot) {
  return new Map(
    snapshot.documents.map(document => [document.relativePath, decodeDocument(document)])
  );
}

function findDocuments(snapshot, pattern) {
  return snapshot.documents.filter(document => pattern.test(document.relativePath));
}

function createInstituteCode(usedCodes) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `LDG-${randomBytes(6).toString("hex").slice(0, 8).toUpperCase()}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
  throw new Error("Could not generate a unique Institute ID.");
}

function resolveScope(names, resolver, instituteByCanonicalName, aliasUsage, unknownLabels) {
  const scope = [];
  names.forEach(originalName => {
    const resolved = resolver.resolve(originalName);
    if (!resolved) {
      unknownLabels.add(normaliseLabel(originalName));
      return;
    }
    const institute = instituteByCanonicalName.get(
      normaliseGenesisInstituteKey(resolved.canonicalName)
    );
    if (!institute) {
      unknownLabels.add(normaliseLabel(originalName));
      return;
    }
    if (resolved.viaAlias) {
      const aliases = aliasUsage.get(resolved.canonicalName) || new Set();
      aliases.add(normaliseLabel(originalName));
      aliasUsage.set(resolved.canonicalName, aliases);
    }
    if (!scope.some(item => item.id === institute.id)) {
      scope.push({ ...institute, legacyLabel: normaliseLabel(originalName) });
    }
  });
  return scope;
}

function buildMigrationPlan(snapshot, backupMeta) {
  const rawDocs = documentsByPath(snapshot);
  const decodedDocs = decodedByPath(snapshot);
  const blockers = [];
  const warnings = [];
  const now = Date.now();
  const institutesConfig = decodedDocs.get("config/institutes") || {};
  const deletedInstituteKeys = new Set(
    (institutesConfig.deletedList || []).map(normaliseGenesisInstituteKey)
  );
  const canonicalInstituteNames = uniqueGenesisLabels(
    (institutesConfig.list || [])
      .filter(name => normaliseGenesisInstituteKey(name) !== "__noop__")
      .filter(name => !deletedInstituteKeys.has(normaliseGenesisInstituteKey(name)))
  );
  if (!canonicalInstituteNames.length) blockers.push("config/institutes has no active institutes.");
  const resolver = createGenesisInstituteResolver(canonicalInstituteNames);
  if (resolver.canonicalNames.length !== canonicalInstituteNames.length) {
    blockers.push("The active institute directory contains duplicate normalized names.");
  }

  const groupDocs = findDocuments(snapshot, /^groups\/[^/]+$/);
  const genesisGroups = groupDocs.filter(
    document => decodedDocs.get(document.relativePath)?.legacyKey === "genesis"
  );
  if (genesisGroups.length > 1) blockers.push("More than one Genesis tenant group exists.");
  const existingGroupDoc = genesisGroups[0] || null;
  const groupId = existingGroupDoc
    ? existingGroupDoc.relativePath.split("/").pop()
    : GENESIS_GROUP_ID;
  const groupPath = `groups/${groupId}`;

  const existingInstituteDocs = findDocuments(snapshot, /^institutes\/[^/]+$/);
  const existingGenesisInstitutes = existingInstituteDocs.filter(
    document => decodedDocs.get(document.relativePath)?.groupId === groupId
  );
  const canonicalKeys = new Set(canonicalInstituteNames.map(normaliseGenesisInstituteKey));
  const extraGenesisInstitutes = existingGenesisInstitutes.filter(document => {
    const item = decodedDocs.get(document.relativePath) || {};
    return item.status !== "deleted" && !canonicalKeys.has(normaliseGenesisInstituteKey(item.name));
  });
  if (extraGenesisInstitutes.length) {
    blockers.push(
      `${extraGenesisInstitutes.length} non-canonical institutes already exist under Genesis Group.`
    );
  }

  const usedCodes = new Set(
    findDocuments(snapshot, /^instituteCodes\/[^/]+$/).map(document =>
      document.relativePath.split("/").pop()
    )
  );
  const institutePlans = canonicalInstituteNames.map((name, index) => {
    const existing = existingGenesisInstitutes.find(document =>
      normaliseGenesisInstituteKey(decodedDocs.get(document.relativePath)?.name) ===
      normaliseGenesisInstituteKey(name)
    );
    const id = existing
      ? existing.relativePath.split("/").pop()
      : `genesis-institute-${String(index + 1).padStart(2, "0")}`;
    const collision = rawDocs.get(`institutes/${id}`);
    if (
      collision &&
      decodedDocs.get(`institutes/${id}`)?.groupId !== groupId
    ) {
      blockers.push(`Institute document ID collision: ${id}.`);
    }
    const existingCode = String(
      existing ? decodedDocs.get(existing.relativePath)?.instituteCode || "" : ""
    ).trim();
    return {
      id,
      path: `institutes/${id}`,
      name,
      nameKey: normaliseGenesisInstituteKey(name),
      sortOrder: index,
      instituteCode: existingCode || createInstituteCode(usedCodes),
      existing,
      legacyAliases: [],
    };
  });
  const instituteByCanonicalName = new Map(
    institutePlans.map(item => [normaliseGenesisInstituteKey(item.name), item])
  );

  const teacherIndexDocs = new Map(
    findDocuments(snapshot, /^teachers\/[^/]+$/).map(document => [
      document.relativePath.split("/").pop(),
      document,
    ])
  );
  const mainDocs = new Map(
    findDocuments(snapshot, /^users\/[^/]+\/appdata\/main$/).map(document => [
      document.relativePath.split("/")[1],
      document,
    ])
  );
  const roleDocs = new Map(
    findDocuments(snapshot, /^roles\/[^/]+$/).map(document => [
      document.relativePath.split("/").pop(),
      document,
    ])
  );
  const removedIds = new Set(
    (decodedDocs.get("config/removedTeachers")?.ids || []).map(value => String(value || ""))
  );
  const allUids = new Set([...teacherIndexDocs.keys(), ...mainDocs.keys()]);
  const unknownLabels = new Set();
  const aliasUsage = new Map();
  const records = [];
  const crossGroupUids = [];

  allUids.forEach(uid => {
    const indexDocument = teacherIndexDocs.get(uid) || null;
    const mainDocument = mainDocs.get(uid) || null;
    const roleDocument = roleDocs.get(uid) || null;
    const index = indexDocument ? decodedDocs.get(indexDocument.relativePath) || {} : {};
    const main = mainDocument ? decodedDocs.get(mainDocument.relativePath) || {} : {};
    const role = roleDocument ? decodedDocs.get(roleDocument.relativePath) || {} : {};
    const removed = removedIds.has(uid);
    const names = collectGenesisTeacherInstituteNames(index, main);
    const recordUnknownLabels = new Set();
    const scope = resolveScope(
      names,
      resolver,
      instituteByCanonicalName,
      aliasUsage,
      recordUnknownLabels
    );
    if (!removed) recordUnknownLabels.forEach(label => unknownLabels.add(label));
    if (
      !removed &&
      role.role !== "manager" &&
      role.groupId &&
      role.groupId !== groupId
    ) {
      crossGroupUids.push(uid);
    }
    records.push({
      uid,
      removed,
      indexDocument,
      mainDocument,
      roleDocument,
      index,
      main,
      role,
      names,
      scope,
      instituteIds: scope.map(item => item.id),
    });
  });

  const syllabusDocs = [
    ...findDocuments(snapshot, /^syllabusTemplates\/[^/]+$/),
    ...findDocuments(snapshot, /^publishedSyllabi\/[^/]+$/),
  ];
  const syllabusScopes = new Map();
  syllabusDocs.forEach(document => {
    const names = syllabusInstituteNames(decodedDocs.get(document.relativePath) || {});
    syllabusScopes.set(
      document.relativePath,
      resolveScope(names, resolver, instituteByCanonicalName, aliasUsage, unknownLabels)
    );
  });

  const telegramDocument = rawDocs.get("config/ledgrTelegramDelivery") || null;
  const telegram = decodedDocs.get("config/ledgrTelegramDelivery") || {};
  const telegramScopes = (telegram.recipients || []).map(recipient => {
    const scope = resolveScope(
      [recipient?.institute],
      resolver,
      instituteByCanonicalName,
      aliasUsage,
      unknownLabels
    );
    return scope[0] || null;
  });

  const scheduleDocument = rawDocs.get("config/ledgrReportSchedule") || null;
  const schedule = decodedDocs.get("config/ledgrReportSchedule") || {};
  const scheduleScope = resolveScope(
    schedule?.scope?.institutes || [],
    resolver,
    instituteByCanonicalName,
    aliasUsage,
    unknownLabels
  );

  institutePlans.forEach(institute => {
    institute.legacyAliases = uniqueGenesisLabels([
      ...resolver.aliasesFor(institute.name),
      ...Array.from(aliasUsage.get(institute.name) || []),
    ]).sort();
  });

  if (unknownLabels.size) {
    blockers.push(
      `Unmapped institute labels: ${Array.from(unknownLabels).sort().join(", ")}.`
    );
  }
  if (crossGroupUids.length) {
    blockers.push(`${crossGroupUids.length} existing accounts already belong to another group.`);
  }

  const activeRecords = records.filter(record => !record.removed);
  const unassignedActiveRecords = activeRecords.filter(record => !record.instituteIds.length);
  const legacyAdmins = Array.from(roleDocs.entries())
    .filter(([, document]) => {
      const role = decodedDocs.get(document.relativePath) || {};
      return role.role === "admin" ||
        (role.role === "group_admin" && role.migratedFromRole === "admin");
    })
    .map(([uid]) => uid);
  const activeClasses = activeRecords.reduce(
    (sum, record) => sum + (Array.isArray(record.main?.classes) ? record.main.classes.length : 0),
    0
  );
  const removedClasses = records
    .filter(record => record.removed)
    .reduce(
      (sum, record) => sum + (Array.isArray(record.main?.classes) ? record.main.classes.length : 0),
      0
    );
  const noteDocuments = findDocuments(snapshot, /^users\/[^/]+\/appdata\/notes_[^/]+$/);
  const backupDocuments = findDocuments(
    snapshot,
    /^users\/[^/]+\/appdata\/main_backup_[^/]+$/
  );
  const noteEntries = noteDocuments.reduce(
    (sum, document) => sum + countGenesisEntryRows(decodedDocs.get(document.relativePath)),
    0
  );
  const appdataDocuments = findDocuments(snapshot, /^users\/[^/]+\/appdata\/[^/]+$/);
  const dataPointCount = snapshot.documents.reduce(
    (sum, document) => sum + countGenesisLeafValues(decodedDocs.get(document.relativePath)),
    0
  );
  const expectedMembershipCount = activeRecords.reduce(
    (sum, record) => sum + record.instituteIds.length,
    0
  );

  if (unassignedActiveRecords.length) {
    warnings.push(
      `${unassignedActiveRecords.length} non-removed accounts have no institute data and will remain unassigned.`
    );
  }
  if (removedIds.size) {
    warnings.push(`${removedIds.size} removed accounts will remain excluded and untouched.`);
  }
  if (aliasUsage.size) {
    warnings.push(
      `${Array.from(aliasUsage.values()).reduce((sum, values) => sum + values.size, 0)} legacy aliases will map to canonical institutes without renaming source fields.`
    );
  }

  return {
    now,
    backup: backupMeta,
    snapshot,
    rawDocs,
    decodedDocs,
    blockers,
    warnings,
    groupId,
    groupPath,
    existingGroupDoc,
    canonicalInstituteNames,
    resolver,
    institutePlans,
    instituteByCanonicalName,
    records,
    activeRecords,
    removedIds,
    legacyAdmins,
    syllabusDocs,
    syllabusScopes,
    telegramDocument,
    telegramScopes,
    scheduleDocument,
    scheduleScope,
    summary: {
      documents: snapshot.documents.length,
      collections: snapshot.collectionPaths.length,
      dataPoints: dataPointCount,
      appdataDocuments: appdataDocuments.length,
      mainDocuments: mainDocs.size,
      noteDocuments: noteDocuments.length,
      backupDocuments: backupDocuments.length,
      noteEntries,
      classes: activeClasses + removedClasses,
      activeClasses,
      removedClasses,
      teacherIndexDocuments: teacherIndexDocs.size,
      activeAccounts: activeRecords.length,
      removedAccounts: removedIds.size,
      unassignedActiveAccounts: unassignedActiveRecords.length,
      institutes: canonicalInstituteNames.length,
      legacyAdmins: legacyAdmins.length,
      syllabusDocuments: syllabusDocs.length,
      syllabusVersions: findDocuments(
        snapshot,
        /^syllabusTemplates\/[^/]+\/versions\/[^/]+$/
      ).length,
      messengerThreads: findDocuments(snapshot, /^feedbackThreads\/[^/]+$/).length,
      messengerMessages: findDocuments(
        snapshot,
        /^feedbackThreads\/[^/]+\/messages\/[^/]+$/
      ).length,
      legacyInvites: findDocuments(snapshot, /^invites\/[^/]+$/).length,
      expectedMemberships: expectedMembershipCount,
      aliases: Object.fromEntries(
        Array.from(aliasUsage.entries()).map(([name, values]) => [name, Array.from(values).sort()])
      ),
    },
  };
}

function patchWrite(document, fields, fieldPaths) {
  const write = {
    update: {
      name: document.name,
      fields,
    },
    updateMask: { fieldPaths },
  };
  if (IGNORE_PRECONDITIONS) {
    return write;
  }
  if (document.updateTime) {
    write.currentDocument = { updateTime: document.updateTime };
  } else {
    write.currentDocument = { exists: true };
  }
  return write;
}

function upsertFullWrite(relativePath, fields, existingDocument = null) {
  const write = {
    update: {
      name: fullDocumentName(relativePath),
      fields,
    },
  };
  if (IGNORE_PRECONDITIONS) return write;
  write.currentDocument = existingDocument?.updateTime
    ? { updateTime: existingDocument.updateTime }
    : { exists: false };
  return write;
}

function deleteWrite(relativePath, existingDocument) {
  const write = { delete: fullDocumentName(relativePath) };
  if (!IGNORE_PRECONDITIONS && existingDocument?.updateTime) {
    write.currentDocument = { updateTime: existingDocument.updateTime };
  }
  return write;
}

function buildTenantDocumentWrite(relativePath, payload, existingDocument) {
  if (!existingDocument) {
    return upsertFullWrite(relativePath, encodeFields(payload));
  }
  const fields = encodeFields(payload);
  return patchWrite(existingDocument, fields, Object.keys(fields));
}

function buildStageWrites(plan) {
  const writes = [];
  const now = plan.now;
  const existingGroup = plan.existingGroupDoc
    ? plan.decodedDocs.get(plan.existingGroupDoc.relativePath) || {}
    : {};
  writes.push(
    buildTenantDocumentWrite(
      plan.groupPath,
      {
        name: "Genesis Group",
        nameKey: "genesis group",
        kind: "group",
        status: "active",
        legacyKey: "genesis",
        createdAt: Number(existingGroup.createdAt || now),
        createdBy: String(existingGroup.createdBy || MANAGER_UID),
        updatedAt: now,
        updatedBy: MANAGER_UID,
        schemaVersion: 1,
      },
      plan.existingGroupDoc
    )
  );

  plan.institutePlans.forEach(institute => {
    const existingDocument = plan.rawDocs.get(institute.path) || null;
    const existing = existingDocument
      ? plan.decodedDocs.get(institute.path) || {}
      : {};
    writes.push(
      buildTenantDocumentWrite(
        institute.path,
        {
          groupId: plan.groupId,
          name: institute.name,
          nameKey: institute.nameKey,
          instituteCode: institute.instituteCode,
          status: "active",
          legacyName: institute.name,
          legacyNameKey: institute.nameKey,
          legacyAliases: institute.legacyAliases,
          sortOrder: institute.sortOrder,
          createdAt: Number(existing.createdAt || now),
          createdBy: String(existing.createdBy || MANAGER_UID),
          updatedAt: now,
          updatedBy: MANAGER_UID,
          schemaVersion: 1,
        },
        existingDocument
      )
    );
    const codePath = `instituteCodes/${institute.instituteCode}`;
    const existingCodeDocument = plan.rawDocs.get(codePath) || null;
    writes.push(
      buildTenantDocumentWrite(
        codePath,
        {
          groupId: plan.groupId,
          instituteId: institute.id,
          instituteName: institute.name,
          status: "active",
          createdAt: Number(
            existingCodeDocument
              ? plan.decodedDocs.get(codePath)?.createdAt || now
              : now
          ),
        },
        existingCodeDocument
      )
    );
  });

  plan.activeRecords.forEach(record => {
    if (record.mainDocument) {
      const fields = {
        groupId: { stringValue: plan.groupId },
        groupIds: { arrayValue: { values: rawArrayStrings([plan.groupId]) } },
        instituteIds: {
          arrayValue: { values: rawArrayStrings(record.instituteIds) },
        },
        tenantMigratedAt: { integerValue: String(now) },
      };
      const fieldPaths = ["groupId", "groupIds", "instituteIds", "tenantMigratedAt"];
      const rawClasses = rawPathValue(record.mainDocument, "classes");
      if (rawClasses?.arrayValue) {
        fields.classes = rawArrayMaps(rawClasses, item => {
          const classFields = rawMapFields(item);
          const legacyInstitute = rawString(classFields.institute);
          const resolved = plan.resolver.resolve(legacyInstitute);
          const institute = resolved
            ? plan.instituteByCanonicalName.get(
                normaliseGenesisInstituteKey(resolved.canonicalName)
              )
            : null;
          if (!institute) return item;
          classFields.groupId = { stringValue: plan.groupId };
          classFields.instituteId = { stringValue: institute.id };
          return item;
        });
        fieldPaths.unshift("classes");
      }
      writes.push(patchWrite(record.mainDocument, fields, fieldPaths));
    }

    const teacherPatch = {
      groupIds: [plan.groupId],
      instituteIds: record.instituteIds,
      legacyUnassigned: record.instituteIds.length === 0,
      tenantMigratedAt: now,
    };
    if (record.indexDocument) {
      writes.push(
        patchWrite(
          record.indexDocument,
          encodeFields(teacherPatch),
          Object.keys(teacherPatch)
        )
      );
    } else {
      writes.push(
        upsertFullWrite(
          `teachers/${record.uid}`,
          encodeFields({
            ...teacherIndexFromMain(record.uid, record.main, now),
            ...teacherPatch,
          })
        )
      );
    }

    if (record.role.role !== "manager") {
      const rolePatch = {
        groupId: plan.groupId,
        instituteIds: record.instituteIds,
        legacyUnassigned: record.instituteIds.length === 0,
        tenantMigratedAt: now,
      };
      if (record.roleDocument) {
        writes.push(
          patchWrite(
            record.roleDocument,
            encodeFields(rolePatch),
            Object.keys(rolePatch)
          )
        );
      } else {
        writes.push(
          upsertFullWrite(
            `roles/${record.uid}`,
            encodeFields({
              role: "teacher",
              teaches: true,
              ...rolePatch,
            })
          )
        );
      }
    }

    record.scope.forEach((institute, index) => {
      const membershipPath = `memberships/${record.uid}_${institute.id}`;
      const existingMembership = plan.rawDocs.get(membershipPath) || null;
      const existing = existingMembership
        ? plan.decodedDocs.get(membershipPath) || {}
        : {};
      writes.push(
        buildTenantDocumentWrite(
          membershipPath,
          {
            userId: record.uid,
            groupId: plan.groupId,
            instituteId: institute.id,
            role: "teacher",
            status: "approved",
            source: "genesis_migration",
            legacyInstituteName: institute.legacyLabel || institute.name,
            legacyOrder: index,
            approvedAt: Number(existing.approvedAt || now),
            approvedBy: String(existing.approvedBy || MANAGER_UID),
            createdAt: Number(existing.createdAt || now),
          },
          existingMembership
        )
      );
    });
  });

  plan.syllabusDocs.forEach(document => {
    const scope = plan.syllabusScopes.get(document.relativePath) || [];
    const payload = {
      groupId: plan.groupId,
      instituteIds: scope.map(item => item.id),
      tenantMigratedAt: now,
    };
    writes.push(
      patchWrite(document, encodeFields(payload), Object.keys(payload))
    );
  });

  if (plan.telegramDocument) {
    const rawRecipients = rawPathValue(plan.telegramDocument, "recipients");
    const rawFullRecipients = rawPathValue(plan.telegramDocument, "fullReportRecipients");
    const fields = {
      tenantMigratedAt: { integerValue: String(now) },
    };
    const fieldPaths = ["tenantMigratedAt"];
    if (rawRecipients?.arrayValue) {
      fields.recipients = rawArrayMaps(rawRecipients, (item, index) => {
        const institute = plan.telegramScopes[index];
        if (!institute) return item;
        const itemFields = rawMapFields(item);
        itemFields.groupId = { stringValue: plan.groupId };
        itemFields.instituteId = { stringValue: institute.id };
        return item;
      });
      fieldPaths.push("recipients");
    }
    if (rawFullRecipients?.arrayValue) {
      fields.fullReportRecipients = rawArrayMaps(rawFullRecipients, item => {
        rawMapFields(item).groupId = { stringValue: plan.groupId };
        return item;
      });
      fieldPaths.push("fullReportRecipients");
    }
    writes.push(patchWrite(plan.telegramDocument, fields, fieldPaths));
  }

  if (plan.scheduleDocument) {
    const rawScope = clone(rawPathValue(plan.scheduleDocument, "scope") || {
      mapValue: { fields: {} },
    });
    rawScope.mapValue ||= { fields: {} };
    rawScope.mapValue.fields ||= {};
    rawScope.mapValue.fields.instituteIds = {
      arrayValue: { values: rawArrayStrings(plan.scheduleScope.map(item => item.id)) },
    };
    writes.push(
      patchWrite(
        plan.scheduleDocument,
        {
          groupId: { stringValue: plan.groupId },
          instituteIds: {
            arrayValue: { values: rawArrayStrings(plan.scheduleScope.map(item => item.id)) },
          },
          scope: rawScope,
          tenantMigratedAt: { integerValue: String(now) },
        },
        ["groupId", "instituteIds", "scope", "tenantMigratedAt"]
      )
    );
  }

  findDocuments(plan.snapshot, /^invites\/[^/]+$/).forEach(document => {
    const currentGroupId = String(
      plan.decodedDocs.get(document.relativePath)?.groupId || ""
    ).trim();
    if (currentGroupId && currentGroupId !== plan.groupId) return;
    writes.push(
      patchWrite(
        document,
        {
          groupId: { stringValue: plan.groupId },
          tenantMigratedAt: { integerValue: String(now) },
        },
        ["groupId", "tenantMigratedAt"]
      )
    );
  });

  const recordByUid = new Map(plan.records.map(record => [record.uid, record]));
  findDocuments(plan.snapshot, /^feedbackThreads\/[^/]+$/).forEach(document => {
    const uid = document.relativePath.split("/").pop();
    const record = recordByUid.get(uid);
    if (!record || record.removed) return;
    writes.push(
      patchWrite(
        document,
        {
          groupId: { stringValue: plan.groupId },
          instituteIds: {
            arrayValue: { values: rawArrayStrings(record.instituteIds) },
          },
          tenantMigratedAt: { integerValue: String(now) },
        },
        ["groupId", "instituteIds", "tenantMigratedAt"]
      )
    );
  });

  const backupMarkerPath = "config/tenantMigrationGenesisBackup";
  writes.push(
    buildTenantDocumentWrite(
      backupMarkerPath,
      {
        status: "verified",
        sha256: plan.backup.sha256,
        backupFile: path.basename(plan.backup.backupPath),
        documentCount: plan.summary.documents,
        dataPointCount: plan.summary.dataPoints,
        createdAt: plan.snapshot.createdAt,
        verifiedAt: now,
        verifiedBy: MANAGER_UID,
      },
      plan.rawDocs.get(backupMarkerPath) || null
    )
  );

  return writes;
}

async function commitWrites(writes, label) {
  let batch = [];
  let batchBytes = 0;
  let committed = 0;

  async function flush() {
    if (!batch.length) return;
    await requestJson(`${ROOT_URL}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: batch }),
    });
    committed += batch.length;
    console.log(`[${label}] committed ${committed}/${writes.length} writes`);
    batch = [];
    batchBytes = 0;
  }

  for (const write of writes) {
    const writeBytes = Buffer.byteLength(JSON.stringify(write), "utf8");
    if (
      batch.length >= MAX_COMMIT_WRITES ||
      (batch.length && batchBytes + writeBytes > MAX_COMMIT_BYTES)
    ) {
      await flush();
    }
    batch.push(write);
    batchBytes += writeBytes;
  }
  await flush();
}

async function batchGet(relativePaths) {
  const found = new Map();
  const chunks = [];
  for (let start = 0; start < relativePaths.length; start += 300) {
    chunks.push(relativePaths.slice(start, start + 300));
  }
  const responses = await mapLimit(chunks, 6, async chunk =>
    requestJson(`${ROOT_URL}:batchGet`, {
      method: "POST",
      body: JSON.stringify({
        documents: chunk.map(fullDocumentName),
      }),
    })
  );
  responses.flat().forEach(item => {
    if (item.found) {
      found.set(relativeDocumentPath(item.found.name), {
        relativePath: relativeDocumentPath(item.found.name),
        ...item.found,
      });
    }
  });
  return found;
}

function removeRawKeys(fields, keys) {
  keys.forEach(key => delete fields[key]);
}

function stripRawMigrationFields(relativePath, sourceFields) {
  const fields = clone(sourceFields || {});
  if (/^users\/[^/]+\/appdata\/main$/.test(relativePath)) {
    removeRawKeys(fields, ["groupId", "groupIds", "instituteIds", "tenantMigratedAt"]);
    const classValues = fields.classes?.arrayValue?.values || [];
    classValues.forEach(item => {
      if (!item?.mapValue?.fields) return;
      removeRawKeys(item.mapValue.fields, ["groupId", "instituteId"]);
    });
  } else if (/^teachers\/[^/]+$/.test(relativePath)) {
    removeRawKeys(fields, [
      "groupIds",
      "instituteIds",
      "legacyUnassigned",
      "tenantMigratedAt",
      "migratedAt",
    ]);
  } else if (/^roles\/[^/]+$/.test(relativePath)) {
    if (
      fields.role?.stringValue === "group_admin" &&
      fields.migratedFromRole?.stringValue === "admin"
    ) {
      fields.role = { stringValue: "admin" };
    }
    removeRawKeys(fields, [
      "groupId",
      "instituteId",
      "instituteIds",
      "legacyUnassigned",
      "tenantMigratedAt",
      "migratedAt",
      "migratedBy",
      "migratedFromRole",
    ]);
  } else if (/^(syllabusTemplates|publishedSyllabi)\/[^/]+$/.test(relativePath)) {
    removeRawKeys(fields, ["groupId", "instituteIds", "tenantMigratedAt"]);
  } else if (/^feedbackThreads\/[^/]+$/.test(relativePath)) {
    removeRawKeys(fields, ["groupId", "instituteIds", "tenantMigratedAt"]);
  } else if (/^invites\/[^/]+$/.test(relativePath)) {
    removeRawKeys(fields, ["groupId", "tenantMigratedAt"]);
  } else if (relativePath === "config/ledgrTelegramDelivery") {
    removeRawKeys(fields, ["tenantMigratedAt"]);
    for (const item of fields.recipients?.arrayValue?.values || []) {
      if (item?.mapValue?.fields) {
        removeRawKeys(item.mapValue.fields, ["groupId", "instituteId"]);
      }
    }
    for (const item of fields.fullReportRecipients?.arrayValue?.values || []) {
      if (item?.mapValue?.fields) removeRawKeys(item.mapValue.fields, ["groupId"]);
    }
  } else if (relativePath === "config/ledgrReportSchedule") {
    removeRawKeys(fields, ["groupId", "instituteIds", "tenantMigratedAt"]);
    if (fields.scope?.mapValue?.fields) {
      removeRawKeys(fields.scope.mapValue.fields, ["instituteIds"]);
    }
  }
  return sortDeep(fields);
}

function compareLegacyDocuments(baselineSnapshot, currentDocuments) {
  const mismatches = [];
  baselineSnapshot.documents.forEach(before => {
    const after = currentDocuments.get(before.relativePath);
    if (!after) {
      mismatches.push({
        path: before.relativePath,
        reason: "missing_after_migration",
      });
      return;
    }
    const beforeFields = stripRawMigrationFields(before.relativePath, before.fields);
    const afterFields = stripRawMigrationFields(after.relativePath, after.fields);
    if (JSON.stringify(beforeFields) !== JSON.stringify(afterFields)) {
      mismatches.push({
        path: before.relativePath,
        reason: "legacy_fields_changed",
      });
    }
  });
  return mismatches;
}

async function fetchValidationDocuments(plan, baselineSnapshot) {
  const expectedNewPaths = [
    plan.groupPath,
    ...plan.institutePlans.flatMap(item => [
      item.path,
      `instituteCodes/${item.instituteCode}`,
    ]),
    ...plan.activeRecords.flatMap(record => [
      `teachers/${record.uid}`,
      ...(record.role.role === "manager" ? [] : [`roles/${record.uid}`]),
      ...record.instituteIds.map(
        instituteId => `memberships/${record.uid}_${instituteId}`
      ),
    ]),
    "config/tenantMigrationGenesisBackup",
    "config/tenantArchitecture",
    "config/tenantMigrationGenesis",
  ];
  const paths = uniqueGenesisLabels([
    ...baselineSnapshot.documents.map(document => document.relativePath),
    ...expectedNewPaths,
  ]);
  return batchGet(paths);
}

function validateTenantState(plan, documents, expectedRole = "admin") {
  const errors = [];
  const group = documents.get(plan.groupPath);
  if (!group || decodeDocument(group).legacyKey !== "genesis") {
    errors.push("Genesis Group document is missing or invalid.");
  }

  const orderedNames = plan.institutePlans
    .map(item => documents.get(item.path))
    .filter(Boolean)
    .map(decodeDocument)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    .map(item => item.name);
  if (JSON.stringify(orderedNames) !== JSON.stringify(plan.canonicalInstituteNames)) {
    errors.push("The migrated institute order does not match config/institutes.");
  }

  plan.activeRecords.forEach(record => {
    const teacher = documents.get(`teachers/${record.uid}`);
    if (!teacher) {
      errors.push(`Teacher index missing after migration: ${record.uid}`);
    } else {
      const data = decodeDocument(teacher);
      if (!Array.isArray(data.groupIds) || !data.groupIds.includes(plan.groupId)) {
        errors.push(`Teacher index group scope missing: ${record.uid}`);
      }
    }
    if (record.role.role !== "manager") {
      const role = documents.get(`roles/${record.uid}`);
      if (!role || decodeDocument(role).groupId !== plan.groupId) {
        errors.push(`Role scope missing: ${record.uid}`);
      }
    }
    record.instituteIds.forEach(instituteId => {
      const membership = documents.get(
        `memberships/${record.uid}_${instituteId}`
      );
      const data = membership ? decodeDocument(membership) : {};
      if (
        !membership ||
        data.status !== "approved" ||
        data.groupId !== plan.groupId ||
        data.instituteId !== instituteId
      ) {
        errors.push(`Membership missing or invalid: ${record.uid}_${instituteId}`);
      }
    });
  });

  plan.legacyAdmins.forEach(uid => {
    const role = documents.get(`roles/${uid}`);
    if (!role || decodeDocument(role).role !== expectedRole) {
      errors.push(`Legacy admin role is not ${expectedRole}: ${uid}`);
    }
  });
  return errors;
}

function activationWrites(plan, stagedDocuments) {
  const writes = [];
  plan.legacyAdmins.forEach(uid => {
    const document = stagedDocuments.get(`roles/${uid}`);
    if (!document) throw new Error(`Admin role missing before activation: ${uid}`);
    const current = decodeDocument(document);
    writes.push(
      patchWrite(
        document,
        encodeFields({
          role: "group_admin",
          groupId: plan.groupId,
          instituteId: "",
          instituteIds: Array.isArray(current.instituteIds) ? current.instituteIds : [],
          migratedFromRole: "admin",
          migratedAt: plan.now,
          migratedBy: MANAGER_UID,
        }),
        [
          "role",
          "groupId",
          "instituteId",
          "instituteIds",
          "migratedFromRole",
          "migratedAt",
          "migratedBy",
        ]
      )
    );
  });

  const architecturePath = "config/tenantArchitecture";
  const architectureDocument = stagedDocuments.get(architecturePath) || null;
  writes.push(
    buildTenantDocumentWrite(
      architecturePath,
      {
        enabled: true,
        schemaVersion: 1,
        genesisGroupId: plan.groupId,
        updatedAt: plan.now,
        updatedBy: MANAGER_UID,
      },
      architectureDocument
    )
  );

  const resultPath = "config/tenantMigrationGenesis";
  const resultDocument = stagedDocuments.get(resultPath) || null;
  writes.push(
    buildTenantDocumentWrite(
      resultPath,
      {
        status: "completed",
        genesisGroupId: plan.groupId,
        instituteCount: plan.summary.institutes,
        teacherRecordCount: plan.summary.activeAccounts,
        removedAccountCount: plan.summary.removedAccounts,
        membershipCount: plan.summary.expectedMemberships,
        classCount: plan.summary.classes,
        noteEntryCount: plan.summary.noteEntries,
        backupDocumentCount: plan.summary.backupDocuments,
        syllabusDocumentCount: plan.summary.syllabusDocuments,
        messengerThreadCount: plan.summary.messengerThreads,
        messengerMessageCount: plan.summary.messengerMessages,
        adminCount: plan.summary.legacyAdmins,
        sourceDocumentCount: plan.summary.documents,
        sourceDataPointCount: plan.summary.dataPoints,
        parityMismatchCount: 0,
        backupSha256: plan.backup.sha256,
        completedAt: plan.now,
        completedBy: MANAGER_UID,
      },
      resultDocument
    )
  );
  return writes;
}

function rollbackWrites(plan, baselineSnapshot, currentDocuments) {
  const baselineByPath = documentsByPath(baselineSnapshot);
  const writes = [];
  plan.legacyAdmins.forEach(uid => {
    const pathValue = `roles/${uid}`;
    const baseline = baselineByPath.get(pathValue);
    const current = currentDocuments.get(pathValue);
    if (!baseline || !current) return;
    writes.push({
      update: {
        name: current.name,
        fields: baseline.fields || {},
      },
      currentDocument: current.updateTime
        ? { updateTime: current.updateTime }
        : { exists: true },
    });
  });
  const architecturePath = "config/tenantArchitecture";
  const baselineArchitecture = baselineByPath.get(architecturePath);
  const currentArchitecture = currentDocuments.get(architecturePath);
  if (baselineArchitecture && currentArchitecture) {
    writes.push({
      update: {
        name: currentArchitecture.name,
        fields: baselineArchitecture.fields || {},
      },
      currentDocument: currentArchitecture.updateTime
        ? { updateTime: currentArchitecture.updateTime }
        : { exists: true },
    });
  } else if (!baselineArchitecture && currentArchitecture) {
    writes.push(deleteWrite(architecturePath, currentArchitecture));
  }
  return writes;
}

function publicPlanReport(plan) {
  return {
    mode: "Genesis background migration",
    projectId: PROJECT_ID,
    groupId: plan.groupId,
    backup: {
      file: path.basename(plan.backup.backupPath),
      sha256: plan.backup.sha256,
      bytes: plan.backup.bytes,
    },
    summary: plan.summary,
    warnings: plan.warnings,
    blockers: plan.blockers,
    ready: plan.blockers.length === 0,
  };
}

async function saveReport(backupDir, label, report) {
  const reportPath = path.join(
    backupDir,
    `genesis-${label}-${timestampSlug()}.json`
  );
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

async function main() {
  if (!ACCESS_TOKEN && !process.env.FIRESTORE_REST_ROOT) {
    throw new Error("FIREBASE_ACCESS_TOKEN is required.");
  }
  const args = parseArgs(process.argv.slice(2));
  const defaultBackupDir = path.resolve(process.cwd(), "..", "genesis-migration-backups");
  const backupDir = path.resolve(args.backupDir || defaultBackupDir);
  await fs.mkdir(backupDir, { recursive: true });

  let backup;
  if (args.baseline) {
    backup = await loadBackup(path.resolve(args.baseline));
    console.log(`[backup] loaded verified baseline ${path.basename(backup.backupPath)}`);
  } else {
    const snapshot = await exportFirestoreSnapshot();
    backup = {
      snapshot,
      ...(await saveVerifiedBackup(snapshot, backupDir)),
    };
    console.log(
      `[backup] verified ${snapshot.documents.length} documents, sha256 ${backup.sha256}`
    );
  }

  const plan = buildMigrationPlan(backup.snapshot, backup);
  const dryRunReport = publicPlanReport(plan);
  const dryRunReportPath = await saveReport(backupDir, "dry-run", dryRunReport);
  console.log(JSON.stringify(dryRunReport, null, 2));
  console.log(`[dry-run] report ${dryRunReportPath}`);
  if (plan.blockers.length) {
    throw new Error("Migration blocked by preflight validation.");
  }
  if (args.mode !== "execute") return;

  const stageWrites = buildStageWrites(plan);
  console.log(`[stage] prepared ${stageWrites.length} additive writes`);
  await commitWrites(stageWrites, "stage");

  const stagedDocuments = await fetchValidationDocuments(plan, backup.snapshot);
  const stageParityMismatches = compareLegacyDocuments(backup.snapshot, stagedDocuments);
  const stageValidationErrors = validateTenantState(plan, stagedDocuments, "admin");
  if (stageParityMismatches.length || stageValidationErrors.length) {
    const failedReport = {
      ...publicPlanReport(plan),
      status: "stage_validation_failed",
      parityMismatches: stageParityMismatches,
      validationErrors: stageValidationErrors,
    };
    const failedPath = await saveReport(backupDir, "stage-failed", failedReport);
    console.error(`[stage] validation failed; architecture remains inactive. ${failedPath}`);
    throw new Error("Staged migration did not pass exact parity validation.");
  }
  console.log("[stage] exact legacy parity verified; preparing atomic activation");

  const activation = activationWrites(plan, stagedDocuments);
  await commitWrites(activation, "activate");

  const activatedDocuments = await fetchValidationDocuments(plan, backup.snapshot);
  const finalParityMismatches = compareLegacyDocuments(backup.snapshot, activatedDocuments);
  const finalValidationErrors = validateTenantState(
    plan,
    activatedDocuments,
    "group_admin"
  );
  if (finalParityMismatches.length || finalValidationErrors.length) {
    const rollback = rollbackWrites(plan, backup.snapshot, activatedDocuments);
    await commitWrites(rollback, "rollback");
    const failedReport = {
      ...publicPlanReport(plan),
      status: "activation_rolled_back",
      parityMismatches: finalParityMismatches,
      validationErrors: finalValidationErrors,
    };
    const failedPath = await saveReport(backupDir, "activation-rolled-back", failedReport);
    console.error(`[activate] validation failed and roles were rolled back. ${failedPath}`);
    throw new Error("Activation failed validation and was rolled back.");
  }

  const successReport = {
    ...publicPlanReport(plan),
    status: "completed",
    completedAt: Date.now(),
    parityMismatchCount: 0,
    validationErrorCount: 0,
  };
  const successPath = await saveReport(backupDir, "completed", successReport);
  console.log(`[complete] Genesis migration completed with exact parity. ${successPath}`);
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
