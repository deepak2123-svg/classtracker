# Native Android Phase 4: Background Delete and Recycle Cleanup Checkpoint 19

## Goal

Remove avoidable waiting from recoverable class deletion, show duration
controls only for custom times, and add a protected way to permanently clear
deleted entries.

## Completed

- Made class deletion optimistic in the native UI.
- Removes the selected class and its entries from the visible snapshot
  immediately after confirmation.
- Returns Home immediately and shows `Moving class to recycle bin...`.
- Continues the protected web-compatible delete transaction in the background.
- Replaces the optimistic snapshot with the confirmed remote snapshot after
  success.
- Restores the original snapshot if a non-conflict failure occurs.
- Reloads the latest remote snapshot if a revision conflict occurs.
- Added unit coverage proving the class disappears before the repository call
  completes.
- Moved custom-time visibility state to the entry editor.
- Duration is now hidden for predefined timetable slots.
- `Time slot not listed?` opens custom start/end controls and Duration.
- Selecting a predefined timetable slot closes custom mode and hides Duration.
- Applied the same behavior to the standalone and embedded entry editors.
- Added `Delete all entries` to the global recycle bin.
- Requires an explicit confirmation with the affected entry count and an
  irreversible-deletion warning.
- Clears the visible recycle bin immediately while the protected remote
  transaction continues.
- Restores the original recycle-bin snapshot if the operation fails.
- Added Firebase shape coverage proving `trash.notes` is cleared while
  `trash.classes` is preserved.

## Safety Boundary

- Class deletion remains beta-only and recoverable.
- Permanent recycle-bin clearing is beta-only.
- Production class deletion remains disabled.
- Production permanent entry clearing remains disabled.
- The remote class trash transaction and web/admin restoration shape are
  unchanged from checkpoint 18.
- Bulk clearing only changes `main.trash.notes`; deleted classes and their saved
  notes remain intact.
- No Room schema, Firestore rules, web app, or admin app changes.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:firebase:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug :app:assembleProductionRelease
```

Additional verification:

- `git diff --check`
- Firebase mutation-shape tests passed
- Beta ViewModel tests passed
- Fresh beta and production release APKs generated
- Installed the fresh beta APK on connected device `859013c6`
- Confirmed the beta process starts successfully after installation

## Manual Acceptance

1. Select a predefined timetable slot and confirm Duration is absent.
2. Tap `Time slot not listed?` and confirm custom time and Duration appear.
3. Select a predefined slot again and confirm custom controls and Duration
   disappear.
4. Delete a disposable class and confirm the app returns Home immediately.
5. Confirm the class disappears immediately while the remote operation runs.
6. Confirm web/admin class trash receives the class and saved notes.
7. Test deletion without network and confirm the optimistic class is restored
   after the failure message.
8. Open Recycle Bin with disposable entries and tap `Delete all entries`.
9. Confirm Cancel leaves every entry intact.
10. Confirm the warning states that deleted classes are not affected.
11. Confirm permanent deletion empties entry trash in native, teacher web, and
    admin web while preserving deleted classes.

## Next Work

- Run disposable-class and disposable-entry online/offline deletion acceptance.
- Consider native class restoration if web/admin-only restoration is not
  sufficient.

## Rollback

After the checkpoint tag is created:

```powershell
git revert native-phase-4-18-recoverable-class-management-checkpoint..native-phase-4-19-background-delete-and-trash-cleanup-checkpoint
```
