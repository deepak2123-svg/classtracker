# Native Android Phase 4: Permanent Entry Delete and Account Departure Checkpoint 20

## Goal

Let teachers permanently delete individual recycle-bin entries and safely leave
the workspace without deleting organisation-owned teaching records.

## Completed

- Added a beta-only `Delete` action beside `Restore` on each recycle-bin entry.
- Individual permanent deletion requires an explicit irreversible-action prompt.
- Entry removal is optimistic and restores the original snapshot on failure.
- The Firestore transaction removes only the selected item from
  `main.trash.notes`, increments revision metadata, and writes normal backups.
- Added `Delete Account` below Sign Out in the native profile.
- Account deletion uses two separate confirmation prompts.
- The final action remains disabled until the teacher types
  `DELETE MY ACCOUNT` exactly.
- Both prompts clearly state that classes and entries remain with the
  organisation.
- The teacher index is marked `accountStatus: departed`, `active: false`, and
  receives a departure timestamp before Firebase Authentication is deleted.
- If authentication deletion fails, the teacher-index departure status is
  rolled back.
- Admin Manage Teachers now shows `Left workspace`, `Departed`, and the
  departure date while retaining access to the teacher's classes and entries.

## Safety Boundary

- Individual permanent entry deletion remains beta-only.
- Production permanent recycle-bin deletion remains disabled.
- Account deletion never deletes `users/{uid}/appdata`, notes, classes, trash,
  reports, or feedback records.
- The teacher must recently authenticate; Firebase can reject deletion and ask
  the teacher to sign in again.
- No Firestore rules or database schema changes were required.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :core:firebase:testDebugUnitTest :app:testBetaDebugUnitTest
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

Web verification:

```powershell
npm run build
```

Additional verification:

- `git diff --check`
- Fresh beta installed successfully on connected device `859013c6`.
- Profile rendering shows `Delete Account` below Sign Out with preserved-data
  wording.
- Destructive entry and account confirmations were not completed against live
  data.

## Manual Acceptance

1. Open Recycle Bin and confirm each entry shows Restore and Delete.
2. Tap Delete, cancel, and confirm the entry remains.
3. Permanently delete one disposable entry and confirm other trash remains.
4. Confirm teacher web and admin web show the same remaining trash.
5. Open Profile > Delete Account and confirm the final action remains disabled
   until `DELETE MY ACCOUNT` is entered exactly.
6. Use a disposable teacher account to confirm account deletion.
7. Confirm the admin teacher card shows Left workspace and retains all entries.
8. Confirm the deleted Firebase sign-in can no longer authenticate.

## Next Work

- Run live acceptance with a disposable teacher account.
- Decide whether admins need a dedicated departed-teacher filter.
- Continue Phase 4 reliability and conflict-polish work.

## Rollback

```powershell
git revert native-phase-4-19-background-delete-and-trash-cleanup-checkpoint..native-phase-4-20-entry-delete-and-account-departure-checkpoint
```
