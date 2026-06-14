# Ledgr Syllabus Track: Subject Foundation - Checkpoint 1

## Goal

Establish canonical admin-owned subjects and teacher assignments without
changing the Teacher web app or breaking existing class data.

## Completed

### Admin Web App

- Added an official Subject Catalog to Control Centre.
- Added canonical subject creation with stable slug IDs.
- Added import of existing teacher-index subject labels.
- Added archive and restore controls without deleting historical data.
- Added subject assignment pills inside Manage Teachers.
- Teacher assignment writes now include:
  - `assignedSubjectIds`;
  - `assignedSubjects`;
  - `subjectAssignmentVersion`;
  - assignment update time and admin identity.

### Teacher Ledgr Beta

- Reads canonical assignments from the existing `teachers/{uid}` index.
- Falls back to legacy profile/class subjects until an admin assignment exists.
- Shows a one-time subject assignment notice for each new assignment version.
- Stores acknowledgement locally per teacher and assignment version.
- Add Class now uses a locked subject dropdown.
- Add Class is unavailable when no official subject is assigned.
- Admin notices now check Android 13 notification permission before delivery.

### Offline Persistence

- Room database upgraded from version 3 to version 4.
- Teacher profiles now retain canonical subject IDs and assignment version.
- Added a non-destructive `3 -> 4` migration.
- Existing cached classes, entries, trash, and mutation outbox remain intact.

## Compatibility

- Existing class `subject` strings were not rewritten.
- Existing entries and reports were not changed.
- Teacher web app files were not changed.
- Teachers without a canonical assignment continue using their existing
  subject suggestions.
- Once an assignment version exists, canonical admin assignments become the
  authoritative choices in the native beta app.

## Verification

Passed on 2026-06-14:

```powershell
npm run build

.\gradlew.bat :core:model:test `
  :core:database:testDebugUnitTest `
  :core:firebase:testDebugUnitTest `
  :app:testBetaDebugUnitTest `
  :app:assembleBetaDebug

.\gradlew.bat :app:assembleProductionRelease
.\gradlew.bat :app:lintBetaDebug
```

Device verification:

- installed the rebuilt beta APK with `adb install -r`;
- migrated the existing on-device Room database from 3 to 4;
- launched the signed-in teacher workspace successfully;
- confirmed the process remained alive;
- found no fatal exception or Room migration verification error.

Notes:

- The first lint attempt exposed a pre-existing missing runtime permission guard
  in admin-notice delivery.
- The notification service now skips delivery when Android 13 notification
  permission is unavailable, and the standalone lint run passes.

## Not Yet Performed

- Live Admin Subject Catalog interaction with an authenticated admin session.
- Live assignment of subjects to a disposable teacher account.
- Cross-client confirmation that the teacher sees and acknowledges the update.

## Release State

- Checkpoint commit and GitHub tag created.
- Main branch and checkpoint tag pushed to GitHub.
- Admin web deployment is expected to follow the repository's connected
  deployment pipeline; confirm the production deployment before live acceptance.

## Next Checkpoint

1. Perform live admin acceptance:
   - import existing subjects;
   - create or archive a subject;
   - assign multiple subjects to a disposable teacher.
2. Confirm the native assignment notice appears once.
3. Confirm Add Class contains only assigned subjects.
4. Confirm the assignment survives offline restart.
5. Begin Milestone 2 canonical class offerings and legacy-subject matching.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- No production data was migrated automatically.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.
