import fs from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getBytes,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

const projectId = "classtracker-84920";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
    storage: {
      rules: fs.readFileSync(new URL("../storage.rules", import.meta.url), "utf8"),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const writes = [
      ["roles/manager-1", { role: "manager" }],
      ["roles/group-admin-1", { role: "group_admin", groupId: "group-1", instituteIds: [] }],
      ["roles/institute-admin-1", { role: "institute_admin", groupId: "group-1", instituteId: "inst-1", instituteIds: ["inst-1"] }],
      ["roles/teacher-1", { role: "teacher", groupId: "group-1", instituteIds: ["inst-1"] }],
      ["roles/teacher-2", { role: "teacher", groupId: "group-2", instituteIds: ["inst-2"] }],
      ["groups/group-1", { name: "Genesis Group", status: "active" }],
      ["groups/group-2", { name: "Other Group", status: "active" }],
      ["institutes/inst-1", { name: "Genesis Main", nameKey: "genesis main", groupId: "group-1", status: "active" }],
      ["institutes/inst-1b", { name: "Genesis Child", nameKey: "genesis child", groupId: "group-1", status: "active" }],
      ["institutes/inst-2", { name: "Other Main", nameKey: "other main", groupId: "group-2", status: "active" }],
      ["memberships/teacher-1_inst-1", { userId: "teacher-1", groupId: "group-1", instituteId: "inst-1", role: "teacher", status: "approved" }],
      ["memberships/teacher-2_inst-2", { userId: "teacher-2", groupId: "group-2", instituteId: "inst-2", role: "teacher", status: "approved" }],
      ["teachers/teacher-1", { uid: "teacher-1", name: "Teacher One", groupIds: ["group-1"], instituteIds: ["inst-1"], institutes: ["Genesis Main"] }],
      ["teachers/teacher-2", { uid: "teacher-2", name: "Teacher Two", groupIds: ["group-2"], instituteIds: ["inst-2"], institutes: ["Other Main"] }],
      ["users/teacher-1/appdata/main", { profile: { name: "Teacher One" }, groupId: "group-1", instituteIds: ["inst-1"] }],
      ["users/teacher-2/appdata/main", { profile: { name: "Teacher Two" }, groupId: "group-2", instituteIds: ["inst-2"] }],
    ];
    await Promise.all(writes.map(([path, data]) => setDoc(doc(db, path), data)));
  });
});

test("manager can access every group", async () => {
  const db = testEnv.authenticatedContext("manager-1").firestore();
  await assertSucceeds(getDoc(doc(db, "groups", "group-1")));
  await assertSucceeds(getDoc(doc(db, "groups", "group-2")));
});

test("sample PDF storage is public-read and admin-write only", async () => {
  const objectPath = "sampleReports/storage-sample.pdf";
  const samplePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const managerStorage = testEnv.authenticatedContext("manager-1").storage();
  const teacherStorage = testEnv.authenticatedContext("teacher-1").storage();
  const publicStorage = testEnv.unauthenticatedContext().storage();

  await assertFails(uploadBytes(storageRef(teacherStorage, objectPath), samplePdf, { contentType:"application/pdf" }));
  await assertSucceeds(uploadBytes(storageRef(managerStorage, objectPath), samplePdf, { contentType:"application/pdf" }));
  await assertSucceeds(getBytes(storageRef(publicStorage, objectPath)));
  await assertFails(uploadBytes(storageRef(managerStorage, "sampleReports/not-a-pdf.txt"), samplePdf, { contentType:"text/plain" }));
  await assertFails(deleteObject(storageRef(teacherStorage, objectPath)));
  await assertSucceeds(deleteObject(storageRef(managerStorage, objectPath)));
});

test("sample reports are publicly readable and writable only by admins", async () => {
  const reportId = "daily-sample";
  const reportPath = `sampleReports/${reportId}`;
  const reportData = {
    title: "Ledgr Sample - Daily Report",
    storagePath: `sampleReports/${reportId}.pdf`,
    downloadUrl: "https://firebasestorage.googleapis.com/sample.pdf",
    createdAt: serverTimestamp(),
    createdBy: "manager-1",
  };
  const publicDb = testEnv.unauthenticatedContext().firestore();
  const managerDb = testEnv.authenticatedContext("manager-1").firestore();
  const teacherDb = testEnv.authenticatedContext("teacher-1").firestore();

  await assertSucceeds(getDocs(collection(publicDb, "sampleReports")));
  await assertFails(setDoc(doc(teacherDb, reportPath), { ...reportData, createdBy:"teacher-1" }));
  await assertSucceeds(setDoc(doc(managerDb, reportPath), reportData));
  await assertSucceeds(getDoc(doc(publicDb, reportPath)));
  await assertFails(setDoc(doc(managerDb, reportPath), { title:"Changed" }, { merge:true }));
  await assertFails(deleteDoc(doc(teacherDb, reportPath)));
  await assertSucceeds(deleteDoc(doc(managerDb, reportPath)));
});

test("sample report metadata rejects unsafe paths and unknown fields", async () => {
  const managerDb = testEnv.authenticatedContext("manager-1").firestore();
  const base = {
    title: "Ledgr Sample - Weekly Report",
    storagePath: "sampleReports/weekly-sample.pdf",
    downloadUrl: "https://firebasestorage.googleapis.com/weekly.pdf",
    createdAt: serverTimestamp(),
    createdBy: "manager-1",
  };
  await assertFails(setDoc(doc(managerDb, "sampleReports", "weekly-sample"), {
    ...base,
    storagePath:"sampleReports/another-file.pdf",
  }));
  await assertFails(setDoc(doc(managerDb, "sampleReports", "weekly-sample"), {
    ...base,
    internalNote:"must not be public",
  }));
});

test("group admin is limited to its own group", async () => {
  const db = testEnv.authenticatedContext("group-admin-1").firestore();
  await assertSucceeds(getDoc(doc(db, "groups", "group-1")));
  await assertFails(getDoc(doc(db, "groups", "group-2")));
  await assertSucceeds(
    getDocs(query(collection(db, "institutes"), where("groupId", "==", "group-1")))
  );
  await assertFails(getDoc(doc(db, "institutes", "inst-2")));
  await assertSucceeds(getDoc(doc(db, "users", "teacher-1", "appdata", "main")));
  await assertFails(getDoc(doc(db, "users", "teacher-2", "appdata", "main")));
});

test("institute admin is limited to its assigned institute", async () => {
  const db = testEnv.authenticatedContext("institute-admin-1").firestore();
  await assertSucceeds(getDoc(doc(db, "institutes", "inst-1")));
  await assertFails(getDoc(doc(db, "institutes", "inst-1b")));
  await assertFails(getDoc(doc(db, "institutes", "inst-2")));
  await assertSucceeds(getDoc(doc(db, "users", "teacher-1", "appdata", "main")));
  await assertFails(getDoc(doc(db, "users", "teacher-2", "appdata", "main")));
});

test("teacher reads only own data and approved institute records", async () => {
  const db = testEnv.authenticatedContext("teacher-1").firestore();
  await assertSucceeds(getDoc(doc(db, "users", "teacher-1", "appdata", "main")));
  await assertFails(getDoc(doc(db, "users", "teacher-2", "appdata", "main")));
  await assertSucceeds(getDoc(doc(db, "institutes", "inst-1")));
  await assertFails(getDoc(doc(db, "institutes", "inst-1b")));
  await assertFails(getDocs(collection(db, "institutes")));
});

test("cross-group teacher membership and join requests are blocked", async () => {
  const teacherDb = testEnv.authenticatedContext("teacher-1").firestore();
  await assertFails(setDoc(doc(teacherDb, "memberships", "teacher-1_inst-2"), {
    userId: "teacher-1",
    groupId: "group-2",
    instituteId: "inst-2",
    role: "teacher",
    status: "approved",
  }));
  await assertFails(setDoc(doc(teacherDb, "joinRequests", "teacher-1_inst-2"), {
    userId: "teacher-1",
    groupId: "group-2",
    instituteId: "inst-2",
    requestedRole: "teacher",
    status: "pending",
  }));

  const otherGroupAdminDb = testEnv.authenticatedContext("group-admin-1").firestore();
  await assertFails(setDoc(doc(otherGroupAdminDb, "memberships", "teacher-2_inst-1"), {
    userId: "teacher-2",
    groupId: "group-1",
    instituteId: "inst-1",
    role: "teacher",
    status: "approved",
  }));
});

test("scoped admin invite activates only the assigned group role", async () => {
  const groupAdminDb = testEnv.authenticatedContext("group-admin-1").firestore();
  await assertSucceeds(setDoc(doc(groupAdminDb, "invites", "group-admin-token"), {
    inviteType: "group_admin",
    role: "group_admin",
    groupId: "group-1",
    instituteId: "",
    createdBy: "group-admin-1",
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    maxUses: 1,
    useCount: 0,
    used: false,
    status: "active",
  }));

  const invitedDb = testEnv.authenticatedContext("new-group-admin").firestore();
  await assertSucceeds(runTransaction(invitedDb, async tx => {
    const inviteRef = doc(invitedDb, "invites", "group-admin-token");
    await tx.get(inviteRef);
    tx.set(inviteRef, {
      used: true,
      usedBy: "new-group-admin",
      usedAt: Date.now(),
      useCount: 1,
      lastUsedBy: "new-group-admin",
      lastUsedAt: Date.now(),
    }, { merge: true });
    tx.set(doc(invitedDb, "roles", "new-group-admin"), {
      role: "group_admin",
      groupId: "group-1",
      instituteId: "",
      instituteIds: [],
      adminMode: "admin_only",
      teaches: false,
      inviteToken: "group-admin-token",
    });
  }));
  await assertSucceeds(getDoc(doc(invitedDb, "groups", "group-1")));
  await assertFails(getDoc(doc(invitedDb, "groups", "group-2")));
});

test("teacher invite creates one approved institute membership", async () => {
  const groupAdminDb = testEnv.authenticatedContext("group-admin-1").firestore();
  await assertSucceeds(setDoc(doc(groupAdminDb, "invites", "teacher-token"), {
    inviteType: "teacher",
    role: "teacher",
    groupId: "group-1",
    instituteId: "inst-1",
    createdBy: "group-admin-1",
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    maxUses: 1,
    useCount: 0,
    used: false,
    status: "active",
  }));

  const teacherDb = testEnv.authenticatedContext("new-teacher").firestore();
  await assertSucceeds(runTransaction(teacherDb, async tx => {
    const inviteRef = doc(teacherDb, "invites", "teacher-token");
    await tx.get(inviteRef);
    tx.set(inviteRef, {
      used: true,
      usedBy: "new-teacher",
      usedAt: Date.now(),
      useCount: 1,
      lastUsedBy: "new-teacher",
      lastUsedAt: Date.now(),
    }, { merge: true });
    tx.set(doc(teacherDb, "memberships", "new-teacher_inst-1"), {
      userId: "new-teacher",
      groupId: "group-1",
      instituteId: "inst-1",
      role: "teacher",
      status: "approved",
      inviteToken: "teacher-token",
    });
    tx.set(doc(teacherDb, "roles", "new-teacher"), {
      role: "teacher",
      groupId: "group-1",
      instituteIds: ["inst-1"],
      inviteToken: "teacher-token",
    });
  }));
  await assertSucceeds(getDoc(doc(teacherDb, "institutes", "inst-1")));
  await assertFails(getDoc(doc(teacherDb, "institutes", "inst-2")));
  await assertFails(getDocs(collection(teacherDb, "invites")));
});
