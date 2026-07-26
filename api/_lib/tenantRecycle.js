import { FieldValue } from "firebase-admin/firestore";

const WRITE_BATCH_SIZE = 400;
const READ_CONCURRENCY = 12;

function clean(value) {
  return String(value || "").trim();
}

function normalise(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function unique(values) {
  const source = Array.isArray(values)
    ? values
    : values instanceof Set
      ? Array.from(values)
      : [];
  return Array.from(new Set(source.map(clean).filter(Boolean)));
}

async function forEachWithConcurrency(values, concurrency, worker) {
  const source = Array.isArray(values) ? values : [];
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), source.length) },
    async () => {
      while (nextIndex < source.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(source[index], index);
      }
    }
  );
  await Promise.all(workers);
}

function isActive(data) {
  return clean(data?.status || "active") !== "deleted";
}

function isProtectedGenesis(group) {
  if (!group || group.protected === false) return false;
  return group.protected === true || clean(group.legacyKey).toLowerCase() === "genesis";
}

function classBelongsToScope(item, instituteIds, instituteNames) {
  if (!item || typeof item !== "object") return false;
  const itemInstituteId = clean(item.instituteId || item.tenantInstituteId);
  const itemInstituteName = normalise(item.institute || item.instituteName);
  return (itemInstituteId && instituteIds.has(itemInstituteId))
    || (itemInstituteName && instituteNames.has(itemInstituteName));
}

function targetScopeSets(target) {
  return {
    instituteIds: new Set(target.institutes.map(item => clean(item.id)).filter(Boolean)),
    instituteNames: new Set(
      target.institutes
        .flatMap(item => [item.name, item.legacyName, ...(item.legacyAliases || [])])
        .map(normalise)
        .filter(Boolean)
    ),
  };
}

export function buildCleanupTarget(target, exactInstituteNameOnly = false) {
  if (!exactInstituteNameOnly || target?.entityType !== "institute") return target;
  return {
    ...target,
    institutes: (Array.isArray(target.institutes) ? target.institutes : []).map(item => ({
      ...item,
      legacyName: clean(item.name),
      legacyAliases: [],
    })),
  };
}

function instituteReferenceMatches(item, instituteIds, instituteNames) {
  if (!item || typeof item !== "object") return false;
  const id = clean(item.instituteId || item.tenantInstituteId);
  const name = normalise(item.institute || item.instituteName);
  return (id && instituteIds.has(id)) || (name && instituteNames.has(name));
}

function stripInstituteNames(values, instituteNames) {
  return unique(values).filter(item => !instituteNames.has(normalise(item)));
}

function stripInstituteIds(values, instituteIds) {
  return unique(values).filter(item => !instituteIds.has(clean(item)));
}

export function stripInstituteFromTeacherRecord(
  source,
  instituteIdValues = [],
  instituteNameValues = [],
  { bumpRevision = true, now = Date.now() } = {}
) {
  const data = source && typeof source === "object" ? structuredClone(source) : {};
  const instituteIds = new Set(unique(instituteIdValues));
  const instituteNames = new Set(unique(instituteNameValues).map(normalise));
  const classes = Array.isArray(data.classes) ? data.classes : [];
  const trash = data.trash && typeof data.trash === "object" && !Array.isArray(data.trash)
    ? data.trash
    : {};
  const trashClasses = Array.isArray(trash.classes) ? trash.classes : [];
  const trashNotes = Array.isArray(trash.notes) ? trash.notes : [];
  const removedClasses = classes.filter(item => classBelongsToScope(item, instituteIds, instituteNames));
  const removedTrashClasses = trashClasses.filter(item => classBelongsToScope(item, instituteIds, instituteNames));
  const removedClassIds = new Set(
    [...removedClasses, ...removedTrashClasses].map(item => clean(item?.id)).filter(Boolean)
  );
  const nextClasses = classes.filter(item => !classBelongsToScope(item, instituteIds, instituteNames));
  const nextTrashClasses = trashClasses.filter(item => !classBelongsToScope(item, instituteIds, instituteNames));
  const nextTrashNotes = trashNotes.filter(item =>
    !removedClassIds.has(clean(item?.classId))
    && !instituteReferenceMatches(item, instituteIds, instituteNames)
  );
  const nextInstitutes = stripInstituteNames(data.institutes, instituteNames);
  const nextProfileInstitutes = stripInstituteNames(data.profile?.institutes, instituteNames);
  const nextInstituteIds = stripInstituteIds(data.instituteIds, instituteIds);
  const nextPendingNotices = (Array.isArray(data?._meta?.pendingAdminClassNotices)
    ? data._meta.pendingAdminClassNotices
    : []
  ).filter(item =>
    !removedClassIds.has(clean(item?.classId))
    && !instituteReferenceMatches(item, instituteIds, instituteNames)
    && !instituteNames.has(normalise(item?.oldInstitute))
    && !instituteNames.has(normalise(item?.newInstitute))
  );
  const legacyNotes = data.notes && typeof data.notes === "object" && !Array.isArray(data.notes)
    ? Object.fromEntries(
        Object.entries(data.notes).filter(([classId]) => !removedClassIds.has(clean(classId)))
      )
    : data.notes;

  const changed = removedClasses.length > 0
    || removedTrashClasses.length > 0
    || nextTrashNotes.length !== trashNotes.length
    || nextInstitutes.length !== unique(data.institutes).length
    || nextProfileInstitutes.length !== unique(data.profile?.institutes).length
    || nextInstituteIds.length !== unique(data.instituteIds).length
    || nextPendingNotices.length !== (Array.isArray(data?._meta?.pendingAdminClassNotices)
      ? data._meta.pendingAdminClassNotices.length
      : 0)
    || (legacyNotes && data.notes && Object.keys(legacyNotes).length !== Object.keys(data.notes).length);

  if (!changed) return { changed: false, data, removedClassIds: [] };

  const currentRevision = Number(data?._meta?.revision || 0);
  const nextMeta = {
    ...(data._meta || {}),
    pendingAdminClassNotices: nextPendingNotices,
    updatedAt: now,
    source: "adminPermanentDeleteInstitute",
  };
  if (bumpRevision) {
    nextMeta.previousRevision = currentRevision;
    nextMeta.revision = currentRevision + 1;
  }

  return {
    changed: true,
    removedClassIds: Array.from(removedClassIds),
    data: {
      ...data,
      classes: nextClasses,
      institutes: nextInstitutes,
      instituteIds: nextInstituteIds,
      ...(data.profile && typeof data.profile === "object"
        ? { profile: { ...data.profile, institutes: nextProfileInstitutes } }
        : {}),
      trash: {
        ...trash,
        classes: nextTrashClasses,
        notes: nextTrashNotes,
      },
      ...(data.notes && typeof data.notes === "object" ? { notes: legacyNotes } : {}),
      _meta: nextMeta,
    },
  };
}

function stripInstituteFromSyllabusNode(source, instituteIds, instituteNames) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { changed: false, data: source };
  }
  const data = structuredClone(source);
  let changed = false;

  if (Array.isArray(data.instituteIds)) {
    const next = stripInstituteIds(data.instituteIds, instituteIds);
    changed ||= next.length !== data.instituteIds.length;
    data.instituteIds = next;
  }
  for (const key of ["instituteId", "tenantInstituteId"]) {
    if (clean(data[key]) && instituteIds.has(clean(data[key]))) {
      delete data[key];
      changed = true;
    }
  }
  for (const key of ["institute", "instituteName"]) {
    if (normalise(data[key]) && instituteNames.has(normalise(data[key]))) {
      delete data[key];
      changed = true;
    }
  }
  for (const key of ["scope", "targets"]) {
    if (!Array.isArray(data[key])) continue;
    const next = data[key].filter(item =>
      !instituteReferenceMatches(item, instituteIds, instituteNames)
    );
    changed ||= next.length !== data[key].length;
    data[key] = next;
  }

  return { changed, data };
}

function syllabusHasInstituteScope(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return false;
  return (Array.isArray(source.instituteIds) && source.instituteIds.length > 0)
    || !!clean(source.instituteId || source.tenantInstituteId)
    || !!clean(source.institute || source.instituteName)
    || (Array.isArray(source.scope) && source.scope.length > 0)
    || (Array.isArray(source.targets) && source.targets.length > 0);
}

export function stripInstituteFromSyllabusRecord(
  source,
  instituteIdValues = [],
  instituteNameValues = []
) {
  const instituteIds = new Set(unique(instituteIdValues));
  const instituteNames = new Set(unique(instituteNameValues).map(normalise));
  const root = stripInstituteFromSyllabusNode(source, instituteIds, instituteNames);
  const data = root.data && typeof root.data === "object" ? root.data : {};
  let changed = root.changed;

  for (const key of ["draft", "published"]) {
    const nested = stripInstituteFromSyllabusNode(data[key], instituteIds, instituteNames);
    if (nested.changed) {
      data[key] = nested.data;
      changed = true;
    }
  }

  return {
    changed,
    data,
    hasRemainingScope: syllabusHasInstituteScope(data)
      || syllabusHasInstituteScope(data.draft)
      || syllabusHasInstituteScope(data.published),
  };
}

async function commitOperations(db, operations) {
  for (let start = 0; start < operations.length; start += WRITE_BATCH_SIZE) {
    const batch = db.batch();
    operations.slice(start, start + WRITE_BATCH_SIZE).forEach(operation => {
      if (operation.type === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, operation.options || { merge: true });
    });
    await batch.commit();
  }
}

async function queryDocuments(db, collectionName, field, operator, value) {
  const snap = await db.collection(collectionName).where(field, operator, value).get();
  return snap.docs;
}

async function collectTarget(
  db,
  { entityType, groupId = "", instituteId = "", instituteName = "" },
  { allowActiveInstitute = false } = {}
) {
  if (["group", "standalone"].includes(entityType)) {
    const groupRef = db.doc(`groups/${clean(groupId)}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) throw Object.assign(new Error("This item no longer exists."), { statusCode: 404 });
    const group = { id: groupSnap.id, ...(groupSnap.data() || {}) };
    if (isActive(group)) throw Object.assign(new Error("Only items in the Recycle Bin can be permanently deleted."), { statusCode: 409 });
    if (isProtectedGenesis(group)) {
      throw Object.assign(new Error("Genesis Group is protected from permanent deletion."), { statusCode: 409 });
    }
    const instituteDocs = await queryDocuments(db, "institutes", "groupId", "==", group.id);
    return {
      entityType: group.kind === "single" ? "standalone" : "group",
      name: clean(group.name),
      group,
      groupRef,
      instituteDocs,
      institutes: instituteDocs.map(item => ({ id: item.id, ...(item.data() || {}) })),
    };
  }

  const requestedInstituteId = clean(instituteId);
  let instituteSnap = requestedInstituteId
    ? await db.doc(`institutes/${requestedInstituteId}`).get()
    : null;
  if (!instituteSnap?.exists && clean(instituteName)) {
    const allInstitutes = await db.collection("institutes").get();
    const matches = allInstitutes.docs.filter(item =>
      normalise(item.data()?.name || item.data()?.legacyName) === normalise(instituteName)
    );
    if (matches.length > 1) {
      throw Object.assign(new Error("More than one tenant institute matches this name."), { statusCode: 409 });
    }
    instituteSnap = matches[0] || null;
  }
  if (!instituteSnap?.exists) {
    const architectureSnap = await db.doc("config/tenantArchitecture").get();
    const architecture = architectureSnap.exists ? (architectureSnap.data() || {}) : {};
    const resolvedGroupId = clean(groupId || architecture.genesisGroupId);
    const groupRef = resolvedGroupId ? db.doc(`groups/${resolvedGroupId}`) : null;
    const groupSnap = groupRef ? await groupRef.get() : null;
    const label = clean(instituteName);
    if (!label) {
      throw Object.assign(new Error("This institute no longer exists."), { statusCode: 404 });
    }
    return {
      entityType: "institute",
      name: label,
      group: {
        id: resolvedGroupId,
        ...(groupSnap?.exists ? (groupSnap.data() || {}) : {}),
      },
      groupRef,
      instituteDocs: [],
      institutes: [{
        id: "",
        groupId: resolvedGroupId,
        name: label,
        legacyName: label,
        legacyAliases: [],
      }],
    };
  }
  const institute = { id: instituteSnap.id, ...(instituteSnap.data() || {}) };
  if (isActive(institute) && !allowActiveInstitute) {
    throw Object.assign(new Error("Only items in the Recycle Bin can be permanently deleted."), { statusCode: 409 });
  }
  const groupRef = db.doc(`groups/${institute.groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists || !isActive(groupSnap.data() || {})) {
    throw Object.assign(new Error("Delete or restore the parent Group of Institutes as one bundle."), { statusCode: 409 });
  }
  return {
    entityType: "institute",
    name: clean(institute.name),
    group: { id: groupSnap.id, ...(groupSnap.data() || {}) },
    groupRef,
    instituteDocs: [instituteSnap],
    institutes: [institute],
  };
}

async function removeSyllabusScope(db, target, operations) {
  const { instituteIds, instituteNames } = targetScopeSets(target);
  for (const collectionName of ["syllabusTemplates", "publishedSyllabi"]) {
    const docs = target.entityType === "institute"
      ? (await db.collection(collectionName).get()).docs
      : await queryDocuments(db, collectionName, "groupId", "==", target.group.id);
    for (const item of docs) {
      const data = item.data() || {};
      if (target.entityType !== "institute") {
        if (collectionName === "syllabusTemplates") {
          const versions = await item.ref.collection("versions").get();
          versions.docs.forEach(version => operations.push({ type: "delete", ref: version.ref }));
        }
        operations.push({ type: "delete", ref: item.ref });
        continue;
      }
      const stripped = stripInstituteFromSyllabusRecord(
        data,
        Array.from(instituteIds),
        Array.from(instituteNames)
      );
      if (!stripped.changed) continue;
      if (!stripped.hasRemainingScope) {
        if (collectionName === "syllabusTemplates") {
          const versions = await item.ref.collection("versions").get();
          versions.docs.forEach(version => operations.push({ type: "delete", ref: version.ref }));
        }
        operations.push({ type: "delete", ref: item.ref });
      } else {
        operations.push({
          ref: item.ref,
          data: { ...stripped.data, updatedAt: Date.now() },
          options: { merge: false },
        });
      }
    }
  }
}

async function removeTeacherDataScope(db, target, operations) {
  const { instituteIds, instituteNames } = targetScopeSets(target);
  const userRefs = await db.collection("users").listDocuments();
  let affectedTeacherCount = 0;
  let removedClassCount = 0;

  await forEachWithConcurrency(userRefs, READ_CONCURRENCY, async userRef => {
    const appdataSnap = await userRef.collection("appdata").get();
    const mainSnap = appdataSnap.docs.find(item => item.id === "main") || null;
    const removedClassIds = new Set();

    if (mainSnap) {
      const stripped = stripInstituteFromTeacherRecord(
        mainSnap.data() || {},
        Array.from(instituteIds),
        Array.from(instituteNames)
      );
      stripped.removedClassIds.forEach(id => removedClassIds.add(id));
      if (stripped.changed) {
        affectedTeacherCount += 1;
        removedClassCount += stripped.removedClassIds.length;
        if (target.entityType !== "institute" && clean(stripped.data.groupId) === target.group.id) {
          delete stripped.data.groupId;
        }
        operations.push({
          ref: mainSnap.ref,
          data: stripped.data,
          options: { merge: false },
        });
      }
    }

    for (const backupSnap of appdataSnap.docs.filter(item =>
      item.id === "main_backup_latest" || item.id.startsWith("main_backup_")
    )) {
      const backup = backupSnap.data() || {};
      if (!backup.data || typeof backup.data !== "object") continue;
      const stripped = stripInstituteFromTeacherRecord(
        backup.data,
        Array.from(instituteIds),
        Array.from(instituteNames),
        { bumpRevision: false }
      );
      stripped.removedClassIds.forEach(id => removedClassIds.add(id));
      if (!stripped.changed) continue;
      operations.push({
        ref: backupSnap.ref,
        data: {
          ...backup,
          data: stripped.data,
          classCount: Array.isArray(stripped.data.classes) ? stripped.data.classes.length : 0,
          instituteCount: unique(
            (Array.isArray(stripped.data.classes) ? stripped.data.classes : [])
              .map(item => item?.institute)
          ).length,
        },
        options: { merge: false },
      });
    }

    appdataSnap.docs
      .filter(item => item.id.startsWith("notes_") && removedClassIds.has(item.id.slice(6)))
      .forEach(item => operations.push({ type: "delete", ref: item.ref }));
  });
  return { affectedTeacherCount, removedClassCount };
}

async function removeIndexAndRoleScope(db, target, operations) {
  const { instituteIds, instituteNames } = targetScopeSets(target);
  const roleDocs = target.entityType === "institute"
    ? (await db.collection("roles").get()).docs
    : await queryDocuments(db, "roles", "groupId", "==", target.group.id);
  for (const item of roleDocs) {
    const role = item.data() || {};
    const singularMatch = instituteIds.has(clean(role.instituteId));
    const listMatch = unique(role.instituteIds).some(id => instituteIds.has(clean(id)));
    if (target.entityType === "institute" && !singularMatch && !listMatch) continue;
    if (
      (role.role === "institute_admin" && (singularMatch || listMatch))
      || (
        target.entityType !== "institute"
        && ["group_admin", "institute_admin"].includes(role.role)
      )
    ) {
      operations.push({ type: "delete", ref: item.ref });
      continue;
    }
    const nextInstituteIds = unique(role.instituteIds).filter(id => !instituteIds.has(id));
    const patch = { instituteIds: nextInstituteIds, updatedAt: Date.now() };
    if (singularMatch) patch.instituteId = FieldValue.delete();
    if (target.entityType !== "institute" && clean(role.groupId) === target.group.id) patch.groupId = FieldValue.delete();
    operations.push({ ref: item.ref, data: patch, options: { merge: true } });
  }

  const teacherDocs = target.entityType === "institute"
    ? (await db.collection("teachers").get()).docs
    : await queryDocuments(db, "teachers", "groupIds", "array-contains", target.group.id);
  teacherDocs.forEach(item => {
    const teacher = item.data() || {};
    const nextInstituteIds = stripInstituteIds(teacher.instituteIds, instituteIds);
    const nextInstitutes = stripInstituteNames(teacher.institutes, instituteNames);
    const changed = nextInstituteIds.length !== unique(teacher.instituteIds).length
      || nextInstitutes.length !== unique(teacher.institutes).length
      || target.entityType !== "institute";
    if (!changed) return;
    operations.push({
      ref: item.ref,
      data: {
        groupIds: unique(teacher.groupIds).filter(id => id !== target.group.id || target.entityType === "institute"),
        instituteIds: nextInstituteIds,
        institutes: nextInstitutes,
        updatedAt: Date.now(),
      },
      options: { merge: true },
    });
  });
}

async function removeLegacyConfigScope(db, target, operations) {
  const rawNames = unique(
    target.institutes.flatMap(item => [item.name, item.legacyName, ...(item.legacyAliases || [])])
  );
  const names = new Set(rawNames.map(normalise).filter(Boolean));
  const [institutesConfigSnap, sectionsSnap, telegramSnap, scheduleSnap, adminBinSnap] = await Promise.all([
    db.doc("config/institutes").get(),
    db.doc("config/sections").get(),
    db.doc("config/ledgrTelegramDelivery").get(),
    db.doc("config/ledgrReportSchedule").get(),
    db.doc("config/adminBin").get(),
  ]);
  if (institutesConfigSnap.exists) {
    const data = institutesConfigSnap.data() || {};
    operations.push({
      ref: institutesConfigSnap.ref,
      data: {
        list: unique(data.list).filter(name => !names.has(normalise(name))),
        deletedList: unique([...unique(data.deletedList), ...rawNames]),
      },
      options: { merge: true },
    });
  }
  if (sectionsSnap.exists) {
    const sections = { ...(sectionsSnap.data() || {}) };
    Object.keys(sections).forEach(key => {
      if (names.has(normalise(key))) delete sections[key];
    });
    operations.push({ ref: sectionsSnap.ref, data: sections, options: { merge: false } });
  }
  if (telegramSnap.exists) {
    const data = telegramSnap.data() || {};
    const { instituteIds } = targetScopeSets(target);
    const belongs = item => (
      target.entityType !== "institute"
      && clean(item?.groupId) === target.group.id
    ) || (
      clean(item?.instituteId)
      && instituteIds.has(clean(item?.instituteId))
    ) || names.has(normalise(item?.institute));
    operations.push({
      ref: telegramSnap.ref,
      data: {
        recipients: (Array.isArray(data.recipients) ? data.recipients : []).filter(item => !belongs(item)),
        fullReportRecipients: (Array.isArray(data.fullReportRecipients) ? data.fullReportRecipients : [])
          .filter(item => !(target.entityType !== "institute" && clean(item?.groupId) === target.group.id)),
        updatedAt: Date.now(),
      },
      options: { merge: true },
    });
  }
  if (scheduleSnap.exists) {
    const data = scheduleSnap.data() || {};
    const nextInstituteIds = stripInstituteIds(data.instituteIds, targetScopeSets(target).instituteIds);
    const currentScope = data.scope && typeof data.scope === "object" ? data.scope : {};
    const nextScopeInstitutes = stripInstituteNames(currentScope.institutes, names);
    const nextScopeInstituteIds = stripInstituteIds(
      currentScope.instituteIds,
      targetScopeSets(target).instituteIds
    );
    const selectedScopeIsEmpty = currentScope.type === "selected"
      && !nextScopeInstitutes.length
      && !nextScopeInstituteIds.length;
    operations.push({
      ref: scheduleSnap.ref,
      data: {
        ...data,
        enabled: selectedScopeIsEmpty ? false : data.enabled,
        instituteIds: nextInstituteIds,
        scope: {
          ...currentScope,
          institutes: nextScopeInstitutes,
          instituteIds: nextScopeInstituteIds,
        },
        updatedAt: Date.now(),
      },
      options: { merge: false },
    });
  }
  if (adminBinSnap.exists) {
    const data = adminBinSnap.data() || {};
    operations.push({
      ref: adminBinSnap.ref,
      data: {
        ...data,
        items: (Array.isArray(data.items) ? data.items : []).filter(item =>
          item?.type !== "institute" || !names.has(normalise(item?.name))
        ),
        updatedAt: Date.now(),
      },
      options: { merge: false },
    });
  }
}

async function removeLifecycleScope(db, target, operations) {
  const { instituteIds, instituteNames } = targetScopeSets(target);
  for (const collectionName of ["memberships", "invites", "joinRequests"]) {
    const snap = await db.collection(collectionName).get();
    snap.docs.forEach(item => {
      const data = item.data() || {};
      const belongs = target.entityType !== "institute"
        ? clean(data.groupId) === target.group.id
        : (
          instituteIds.has(clean(data.instituteId))
          || instituteNames.has(normalise(data.institute || data.instituteName))
        );
      if (belongs) operations.push({ type: "delete", ref: item.ref });
    });
  }
}

async function removeFeedbackScope(db, target, operations) {
  const { instituteIds, instituteNames } = targetScopeSets(target);
  const snap = await db.collection("feedbackThreads").get();
  snap.docs.forEach(item => {
    const data = item.data() || {};
    if (target.entityType !== "institute") {
      if (clean(data.groupId) === target.group.id) {
        operations.push({ type: "delete", ref: item.ref });
      }
      return;
    }
    const singularMatch = instituteIds.has(clean(data.instituteId))
      || instituteNames.has(normalise(data.institute || data.instituteName));
    const nextInstituteIds = stripInstituteIds(data.instituteIds, instituteIds);
    const changed = singularMatch
      || nextInstituteIds.length !== unique(data.instituteIds).length;
    if (!changed) return;
    operations.push({
      ref: item.ref,
      data: {
        ...data,
        instituteIds: nextInstituteIds,
        ...(singularMatch ? { instituteId: "", institute: "", instituteName: "" } : {}),
        updatedAt: Date.now(),
      },
      options: { merge: false },
    });
  });
}

export async function permanentlyPurgeRecycleItem(
  db,
  input,
  actor,
  {
    automatic = false,
    allowActiveInstitute = false,
    preserveInstituteTombstone = false,
    exactInstituteNameOnly = false,
  } = {}
) {
  const target = await collectTarget(db, input, { allowActiveInstitute });
  if (!automatic) {
    if (clean(input.confirmationName) !== target.name) {
      throw Object.assign(new Error(`Type ${target.name} exactly to confirm permanent deletion.`), { statusCode: 400 });
    }
    if (target.entityType === "group" && clean(input.deleteConfirmation) !== "DELETE") {
      throw Object.assign(new Error("Type DELETE to permanently delete this Group of Institutes."), { statusCode: 400 });
    }
  }

  const operations = [];
  const instituteIds = target.institutes.map(item => clean(item.id)).filter(Boolean);
  const cleanupTarget = buildCleanupTarget(target, exactInstituteNameOnly);
  const [
    ,
    ,
    teacherResult,
  ] = await Promise.all([
    removeLifecycleScope(db, cleanupTarget, operations),
    removeSyllabusScope(db, cleanupTarget, operations),
    removeTeacherDataScope(db, cleanupTarget, operations),
    removeIndexAndRoleScope(db, cleanupTarget, operations),
    removeLegacyConfigScope(db, cleanupTarget, operations),
    removeFeedbackScope(db, cleanupTarget, operations),
  ]);

  target.instituteDocs.forEach(item => {
    const current = item.data() || {};
    const code = clean(current.instituteCode);
    if (code) operations.push({ type: "delete", ref: db.doc(`instituteCodes/${code}`) });
    if (preserveInstituteTombstone && target.entityType === "institute") {
      operations.push({
        ref: item.ref,
        data: {
          groupId: clean(current.groupId || target.group.id),
          name: clean(current.name || target.name),
          nameKey: normalise(current.name || target.name),
          legacyName: clean(current.legacyName || current.name || target.name),
          legacyAliases: unique(current.legacyAliases),
          status: "deleted",
          deletedAt: Date.now(),
          deletedBy: clean(actor?.uid),
          deletedByName: clean(actor?.name || actor?.email || "Manager"),
          updatedAt: Date.now(),
          updatedBy: clean(actor?.uid),
        },
        options: { merge: false },
      });
    } else {
      operations.push({ type: "delete", ref: item.ref });
    }
  });
  if (target.entityType !== "institute") operations.push({ type: "delete", ref: target.groupRef });
  operations.push({
    ref: db.collection("managerAuditLogs").doc(),
    data: {
      action: automatic ? "automatic_permanent_delete" : "permanent_delete",
      entityType: target.entityType,
      entityId: target.entityType === "institute"
        ? (instituteIds[0] || `legacy:${normalise(target.name)}`)
        : target.group.id,
      entityName: target.name,
      groupId: target.group.id,
      instituteIds,
      actorUid: clean(actor?.uid || "scheduled-purge"),
      actorName: clean(actor?.name || actor?.email || (automatic ? "Scheduled purge" : "Manager")),
      createdAt: Date.now(),
      details: {
        automatic,
        directDelete: allowActiveInstitute,
        exactInstituteNameOnly,
        operationCount: operations.length,
        affectedTeacherCount: teacherResult.affectedTeacherCount,
        removedClassCount: teacherResult.removedClassCount,
      },
    },
    options: { merge: false },
  });

  await commitOperations(db, operations);
  return {
    ok: true,
    entityType: target.entityType,
    entityName: target.name,
    groupId: target.group.id,
    instituteIds,
    affectedTeacherCount: teacherResult.affectedTeacherCount,
    removedClassCount: teacherResult.removedClassCount,
    operationCount: operations.length,
  };
}

export async function purgeExpiredRecycleItems(db, now = Date.now()) {
  const [groupsSnap, institutesSnap] = await Promise.all([
    db.collection("groups").where("status", "==", "deleted").get(),
    db.collection("institutes").where("status", "==", "deleted").get(),
  ]);
  const results = [];
  const expiredGroups = groupsSnap.docs.filter(item => Number(item.data()?.purgeAfter || 0) > 0 && Number(item.data()?.purgeAfter || 0) <= now);
  for (const item of expiredGroups) {
    try {
      results.push(await permanentlyPurgeRecycleItem(db, {
        entityType: item.data()?.kind === "single" ? "standalone" : "group",
        groupId: item.id,
      }, { uid: "scheduled-purge", name: "Scheduled purge" }, { automatic: true }));
    } catch (error) {
      results.push({ ok: false, entityType: "group", entityId: item.id, error: error?.message || "Purge failed." });
    }
  }

  const expiredGroupIds = new Set(expiredGroups.map(item => item.id));
  const groupStates = new Map(groupsSnap.docs.map(item => [item.id, item.data() || {}]));
  const expiredInstitutes = institutesSnap.docs.filter(item => {
    const data = item.data() || {};
    return data.recycleRootType === "institute"
      && !expiredGroupIds.has(data.groupId)
      && !groupStates.has(data.groupId)
      && Number(data.purgeAfter || 0) > 0
      && Number(data.purgeAfter || 0) <= now;
  });
  for (const item of expiredInstitutes) {
    try {
      results.push(await permanentlyPurgeRecycleItem(db, {
        entityType: "institute",
        instituteId: item.id,
      }, { uid: "scheduled-purge", name: "Scheduled purge" }, { automatic: true }));
    } catch (error) {
      results.push({ ok: false, entityType: "institute", entityId: item.id, error: error?.message || "Purge failed." });
    }
  }
  return results;
}
