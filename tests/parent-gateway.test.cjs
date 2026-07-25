"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isTeachingActivityEntry,
  parentAccessDocId,
  parentKey,
  planParentFeedMutations,
  projectParentFeedEntries,
} = require("../functions/parentGateway");

test("parent keys normalise section labels safely", () => {
  assert.equal(parentKey("  8th – A "), "8th-a");
  assert.equal(parentAccessDocId("section-1", "parent-1"), "section-1__parent-1");
});

test("system syllabus progress records are excluded from the parent feed", () => {
  assert.equal(isTeachingActivityEntry({
    title:"Completed Algebra",
    body:"Syllabus progress update",
    syllabusChapterId:"algebra",
    syllabusChapterCompleted:true,
  }), false);
  assert.equal(isTeachingActivityEntry({title:"Linear equations",body:"Exercise 4.1"}), true);
});

test("parent projection exposes only parent-safe teaching fields", () => {
  const result = [...projectParentFeedEntries({
    sectionId:"section-1",
    teacherUid:"teacher-1",
    classId:"class-1",
    dateKey:"2026-07-25",
    subject:"Mathematics",
    teacherDisplayName:"Anita Rao",
    entries:[{
      id:"entry-1",
      title:"Linear equations",
      body:"Solved exercise 4.1",
      timeStart:"10:00",
      timeEnd:"11:00",
      status:"completed",
      privatePhone:"+91-not-for-parents",
    }],
  }).values()];
  assert.equal(result.length, 1);
  assert.equal(result[0].subject, "Mathematics");
  assert.equal(result[0].teacherDisplayName, "Anita Rao");
  assert.equal("timeStart" in result[0], false);
  assert.equal("status" in result[0], false);
  assert.equal("privatePhone" in result[0], false);
});

test("joint copies in the same section receive one canonical feed id", () => {
  const base = {
    sectionId:"section-1",
    teacherUid:"teacher-1",
    dateKey:"2026-07-25",
    subject:"Science",
    teacherDisplayName:"Teacher",
    entries:[{id:"copy-a",jointSessionId:"joint-9",title:"Lab",body:"Acids and bases"}],
  };
  const first = [...projectParentFeedEntries({...base,classId:"class-a"}).keys()][0];
  const second = [...projectParentFeedEntries({...base,classId:"class-b"}).keys()][0];
  assert.equal(first, second);
});

test("legacy joint-class copies without a session field still deduplicate", () => {
  const base = {
    entries:[{
      id:"entry-legacy",
      title:"Revision",
      body:"Linear equations",
      jointClass:true,
      jointPrimaryClassId:"class-a",
      jointClassIds:["class-a", "class-b"],
    }],
    sectionId:"section-1",
    teacherUid:"teacher-1",
    dateKey:"2026-07-25",
    subject:"Mathematics",
    teacherDisplayName:"A Teacher",
  };
  const primary = projectParentFeedEntries({ ...base, classId:"class-a" });
  const copy = projectParentFeedEntries({ ...base, classId:"class-b" });
  assert.deepEqual([...primary.keys()], [...copy.keys()]);
});

test("feed mutation planning covers add, edit, and delete propagation", () => {
  const before = new Map([
    ["kept", { title:"Old title" }],
    ["removed", { title:"Removed lesson" }],
  ]);
  const after = new Map([
    ["kept", { title:"Corrected title" }],
    ["added", { title:"New lesson" }],
  ]);
  assert.deepEqual(planParentFeedMutations(before, after), {
    remove:["removed"],
    upsert:["kept", "added"],
  });
});
