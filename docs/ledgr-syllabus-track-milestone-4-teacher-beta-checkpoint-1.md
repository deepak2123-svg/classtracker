# Ledgr Syllabus Track - Milestone 4 Teacher Beta Checkpoint 1

## Current state

The beta Android teacher app now consumes syllabi published by the Admin web app and records syllabus coverage with normal class entries.

The implementation is complete and builds cleanly, but live-device acceptance is still required because no Android device was visible to ADB at the end of this checkpoint.

Do not touch unrelated untracked `outputs/` or `temp_excerpt.txt`.

## Completed

- Added a `Syllabus` bottom-navigation destination immediately beside Home.
- Added a teacher syllabus screen that:
  - only shows published syllabi targeted to the signed-in teacher and class;
  - shows cumulative chapter progress;
  - expands to show chapter completion;
  - opens the matching class entry page.
- Added published-syllabus loading from Firestore `publishedSyllabi`.
- Matched the Admin publishing contract:
  - `targets[].teacherUid`
  - `targets[].classId`
  - subject, class, institute, and section metadata
  - immutable published version and chapter/topic content.
- Added an `Ongoing chapter` section to Add Entry.
- Teachers can:
  - choose the chapter taught in the entry;
  - tick covered topics;
  - mark a topic-less chapter covered.
- Previously covered topics are shown as covered and cannot be accidentally unchecked by a later entry.
- Entry-linked syllabus coverage now survives:
  - draft persistence;
  - Room caching;
  - sync outbox retries;
  - Firestore writes;
  - delete, recycle-bin restore, and duplicate-entry flows.
- Room database upgraded from v4 to v5 with an exported schema and migration.
- Reports & Export now includes cumulative syllabus progress for each class in both:
  - Share PDF
  - Save PDF
- Added focused model tests for cumulative topic/chapter progress and unrelated-syllabus isolation.
- Preserved the teacher web app unchanged.
- Also retained the Admin Ledgr Report route hotfix documented in:
  - `docs/ledgr-admin-report-route-hotfix-checkpoint-6.md`

## Verified

```text
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :core:sync:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug :app:lintBetaDebug
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

All commands passed.

Beta APK:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Live-device acceptance

1. Connect the Android phone with USB debugging and install the beta APK.
2. Open the existing beta installation to verify the Room v4-to-v5 migration does not crash.
3. Sign in as a teacher targeted by an Admin-published syllabus.
4. Confirm Syllabus appears beside Home and only assigned class syllabi are visible.
5. Open a class, choose a chapter, tick one or more topics, and save the entry.
6. Confirm the saved coverage appears on the Syllabus progress screen.
7. Restart the app and confirm progress remains.
8. Test an offline syllabus-linked entry, reconnect, and confirm sync.
9. Delete and restore that entry and confirm syllabus progress follows the entry state.
10. Generate both Share PDF and Save PDF and verify the class syllabus percentage/chapter count.

## Next checkpoint

- Complete live-device acceptance.
- Refine the entry chapter selector if a real syllabus with many chapters feels too tall.
- Add Admin-side syllabus progress reporting after teacher acceptance is confirmed.
- Then continue the remaining reliability and release-hardening roadmap.
