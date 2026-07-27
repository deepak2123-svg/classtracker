export const MAX_TEACHER_INVITE_BATCH = 25;

export function normaliseTeacherInviteCount(value) {
  const count = Math.floor(Number(value) || 1);
  return Math.min(MAX_TEACHER_INVITE_BATCH, Math.max(1, count));
}

export async function createTeacherInviteBatch({ count, createInvite }) {
  if (typeof createInvite !== "function") {
    throw new Error("An invite creator is required.");
  }

  const total = normaliseTeacherInviteCount(count);
  const tokens = new Array(total);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(5, total) }, async () => {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      tokens[index] = await createInvite();
    }
  });
  await Promise.all(workers);
  return tokens;
}
