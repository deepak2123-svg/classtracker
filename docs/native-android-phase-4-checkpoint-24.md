# Native Android Phase 4: First-Time Signup And Loading Screen Checkpoint 24

## Goal

Allow a completely new teacher to enter Ledgr Beta and replace the generic
startup indicator with the supplied Ledgr loading design.

## Completed

- Added `Create account` beside the existing email sign-in flow.
- New email accounts require a teacher name and a Firebase-compatible password.
- First-time email and Google users now receive an empty teacher workspace when
  `users/{uid}/appdata/main` does not yet exist.
- Workspace provisioning creates only missing documents:
  - `users/{uid}/appdata/main`
  - `teachers/{uid}`
  - `roles/{uid}`
- The new teacher is immediately discoverable in Admin Manage Teachers with an
  active status, zero classes, zero entries, and the teacher role.
- Existing account documents are never replaced during provisioning.
- Replaced the generic full-screen loader with the supplied Ledgr treatment:
  - pale blue background;
  - eight rotating moon-phase dots;
  - staggered phase and glow animation;
  - centered Sacramento `ledgr` wordmark;
  - matching startup and system-bar background;
  - Android 12+ system splash no longer inserts the legacy launcher badge
    before the custom animation.

## Safety Boundary

- Existing teacher workspaces are not modified by the first-time setup path.
- Teacher web and admin web application code are unchanged.
- No Firebase rules or production release credentials changed.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-14:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :core:firebase:testDebugUnitTest :feature:auth:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

Additional verification:

- New workspace shape, admin index, and role unit tests pass.
- `git diff --check`
- Confirmed no changes under the teacher web application.
- Beta installed successfully on connected device `859013c6`.
- Cold-start launch completed without a fatal exception and the process
  remained alive after startup.
- Captured the Android 12+ first frame and confirmed the legacy launcher badge
  is gone; startup begins on the matching pale-blue loading canvas.

## Manual Acceptance

1. Install Beta on a connected test device.
2. Create a disposable teacher account using name, email, and password.
3. Confirm the app opens an empty Home screen rather than rejecting the user.
4. Confirm Admin Manage Teachers shows the new active teacher.
5. Create a class and entry, then confirm normal synchronization.
6. Repeat with a new disposable Google account.
7. Force-stop and reopen Beta; confirm the moon-orbit loading screen appears
   cleanly without a white or dark startup flash.
8. Sign into an existing teacher account and confirm its workspace is unchanged.

## Next Work

- Complete live-device acceptance for both email and Google first-time users.
- Decide whether open self-signup remains enabled for production or is later
  restricted by invite, institute code, or admin approval.
- Continue Phase 4 reliability, conflict handling, and manual retry polish.

## Rollback

```powershell
git revert native-phase-4-23-keyboard-aware-entry-fields-checkpoint..native-phase-4-24-first-time-signup-loading-checkpoint
```
