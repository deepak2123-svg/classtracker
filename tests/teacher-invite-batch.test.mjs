import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TEACHER_INVITE_BATCH,
  createTeacherInviteBatch,
  normaliseTeacherInviteCount,
} from "../src/admin/teachers/teacherInviteBatch.js";

test("teacher invite count stays within the supported range", () => {
  assert.equal(normaliseTeacherInviteCount(0), 1);
  assert.equal(normaliseTeacherInviteCount(7.9), 7);
  assert.equal(normaliseTeacherInviteCount(999), MAX_TEACHER_INVITE_BATCH);
});

test("teacher invite batch returns one unique result per requested link", async () => {
  let sequence = 0;
  const tokens = await createTeacherInviteBatch({
    count: 6,
    createInvite: async () => `token-${++sequence}`,
  });

  assert.equal(tokens.length, 6);
  assert.equal(new Set(tokens).size, 6);
});
