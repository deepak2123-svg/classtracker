# Native Android Phase 4: Recoverable Class Management Checkpoint 18

## Goal

Add a safe teacher-facing place to manage active classes, support recoverable
class deletion in beta, and remove the impression that class creation is stuck
on the form while its protected remote write completes.

## Completed

- Added `Profile > Manage Classes`.
- Listed active classes with institute and entry count.
- Added an explicit confirmation before class deletion.
- Confirmation states that the class and all of its entries move together.
- Added a per-class progress state while deletion is running.
- Added beta-only `NATIVE_CLASS_DELETE_ENABLED`; production remains disabled.
- Added web-compatible class trashing:
  - removes the class from `main.classes`
  - copies the class to `main.trash.classes`
  - stores the class notes under `savedNotes`
  - records `deletedAt` and `deletedByName`
  - removes `notes_{classId}` after preserving its content
  - updates revision metadata, teacher index, latest backup, and history backup
- Preserved web/admin restoration compatibility.
- Changed class creation UX so a valid submission returns Home immediately.
- Added an `Adding class...` status message while the remote transaction,
  backup write, reload, and local replacement finish.
- Existing success and failure feedback still appears through the shared app
  snackbar.

## Safety Boundary

- Class deletion is enabled only in the beta flavor.
- Production class creation and deletion remain disabled.
- Deletion is recoverable through the existing web/admin class recycle bin.
- No permanent class-delete action was added.
- No Room schema or entry outbox shape changed.
- No teacher web, admin web, Firebase rules, or Capacitor code changed.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:firebase:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug :app:assembleProductionRelease
```

Also completed:

- `git diff --check`
- Installed the beta APK on connected device `859013c6`
- Confirmed Profile shows `Manage Classes`
- Confirmed the management screen lists 8 active classes and entry counts
- Confirmed the Madhav 3 dialog says its 36 entries move with the class
- Cancelled the confirmation without changing live data

## Manual Acceptance

Use a disposable class:

1. Create the class and confirm the app returns Home immediately.
2. Wait for the success confirmation and confirm the class appears.
3. Open Profile > Manage Classes.
4. Delete the disposable class.
5. Confirm teacher web and admin web no longer show it as active.
6. Confirm the web/admin recycle bin contains the class and its entries.
7. Restore it from web/admin and confirm the beta app receives it after refresh.
8. Repeat deletion while offline to confirm the UI reports the network failure
   without removing local data.

## Remaining Work

- Add native class restoration if teachers should restore classes without
  using web/admin.
- Consider a queued class mutation outbox if offline class creation/deletion is
  required.
- Measure remote class transaction latency and backup-history cost separately
  from the now-immediate UI transition.

## Rollback

After the checkpoint tag is created:

```powershell
git revert native-phase-5-5-report-controls-checkpoint..native-phase-4-18-recoverable-class-management-checkpoint
```

If the tag is unavailable, revert the commit introducing Manage Classes,
`deleteClass`, `trashLegacyClass`, and immediate class-submit navigation.
