# Native Android Phase 4: Recoverable Delete Checkpoint

## Goal

This checkpoint completes the next safe Phase 4 slice: beta teachers can move a
confirmed entry to the recycle bin and restore it later. The flow uses the
existing native offline outbox and the current web-compatible Firestore shape,
so the teacher web app and admin web app continue to understand the data.

## Completed

- Added first-class trashed-entry model support to the shared native model.
- Added a Room v2 migration with `teacher_trashed_entries` plus mutation fields
  for `teacherName` and `deletedAt`.
- Extended the existing outbox operation column from upsert-only behavior to
  `UPSERT`, `DELETE`, and `RESTORE`.
- Added local enqueue paths for delete and restore, with overlays that hide
  pending deletes, show pending restores, and keep failed mutations visible.
- Added Firestore transaction support for:
  - deleting from `users/{uid}/appdata/notes_{classId}`;
  - appending web-compatible entries to `main.trash.notes`;
  - restoring from `main.trash.notes` back into the original date bucket.
- Added sync processor routing for delete and restore operations.
- Added beta-only UI controls:
  - delete icon on eligible synced entry cards;
  - confirmation dialog before moving an entry to the recycle bin;
  - recycle-bin section at the bottom of class detail;
  - restore action for deleted entries.
- Kept production native builds read-only for delete/restore.
- Preserved the checkpoint 4 duplicate-entry draft flow.

## User Behavior

- Delete appears only for synced entries in the beta build.
- Tapping delete asks for confirmation and then moves the entry to the class
  recycle-bin section immediately.
- Restore moves a trashed entry back into active history immediately.
- If offline, delete and restore stay queued in the same WorkManager-backed
  outbox used by create/edit/duplicate.
- Web teacher and admin panels continue to see the existing `trash.notes`
  payload shape.

## Safety Boundary

- Production native builds still have `NATIVE_ENTRY_DELETE_ENABLED=false`.
- The React teacher web app, React admin app, Capacitor app, and Firebase rules
  were not changed for this checkpoint.
- Confirmed trash survives app restart through Room, not only in memory.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :core:sync:testDebugUnitTest
.\gradlew.bat :feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
```

Both verification commands pass.

The generated beta APK is:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Remaining Stage 4 Work

- Live-device acceptance for delete, restore, offline retry, and conflict
  handling against a disposable test account.
- Entry search and filters.
- Reliability acceptance for process death during pending delete/restore,
  simultaneous native/web edits, manual retry, and duplicate prevention.
- Decide whether delete should eventually be allowed for unsynced local drafts
  as a local discard action. This checkpoint intentionally limits delete to
  synced entries.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-4-4-duplicate-entry-checkpoint..native-phase-4-5-recoverable-delete-checkpoint
```

If the tag is unavailable, revert the commit that introduced the checkpoint 5
recoverable delete/restore changes. The previous intended native checkpoint is
`native-phase-4-4-duplicate-entry-checkpoint`.
