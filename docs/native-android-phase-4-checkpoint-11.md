# Native Android Phase 4: Native Class Creation - Checkpoint 11

## Goal

Add beta-gated native class creation from the Home screen while preserving the
existing web-compatible teacher data shape.

This checkpoint extends the Phase 4 teacher workflow work after the Phase 5
report checkpoints. It intentionally keeps teacher web, admin web, Capacitor,
Firebase rules, Room schema, report export behavior, and production native
class writes unchanged.

## Completed

- Added a beta-only `NATIVE_CLASS_CREATE_ENABLED` build flag.
- Kept native production class creation disabled.
- Bumped native app version to `versionCode` 11 and `versionName` 0.5.3.
- Added `TeacherClassDraft`, `TeacherClassValidation`, and
  `validateTeacherClassDraft` to the model layer.
- Added an Add Class card to the Home screen when class creation is enabled.
- Added a native Add Class screen with institute selection, class/section
  input, subject input, subject shortcuts, save progress, and disabled states.
- Wired the Add Class route into `LedgrApp`.
- Added ViewModel state for class save progress and success feedback.
- Added a post-save snackbar and automatic return to Home after successful
  class creation.
- Added repository APIs for native class creation.
- Added Firebase-compatible class creation using the existing legacy
  `users/{uid}/appdata/main` document:
  - appends the new class map to `classes`;
  - updates `institutes`, `sections`, `subjects`, and profile subject indexes;
  - creates the matching `notes_{classId}` document;
  - writes `teachers/{uid}` index data;
  - writes latest and history backup documents;
  - uses `_meta.revision` conflict protection.
- Updated the offline repository wrapper to refresh the local snapshot after a
  successful remote class create and enqueue sync.

## Version

- versionCode: 11
- versionName: 0.5.3-beta for beta debug
- Proposed tag: `native-phase-4-11-native-class-create-checkpoint`
- Base checkpoint: `native-phase-5-4-durable-report-export-checkpoint`

## User Behavior

- Beta teachers see a Create new class card on Home.
- Tapping it opens the native Add class screen.
- Teachers select an existing institute, enter class/section, and optionally
  enter or pick a subject.
- Save is disabled until an institute and class/section are present.
- Successful save shows a snackbar and returns to Home with the refreshed class
  list.
- Revision conflicts reload newer data and ask the teacher to review and add
  the class again.

## Safety Boundary

- Production native class creation remains disabled by build config.
- The change writes to the existing legacy teacher data model only; no Firestore
  collection migration or new granular class model is introduced.
- No Firebase rules changed.
- No Room schema changed.
- No report export behavior changed.
- No React teacher web, React admin web, or Capacitor code changed.
- Class creation is not an offline-durable outbox mutation in this checkpoint;
  it requires the remote create to succeed before the local snapshot is
  refreshed.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Passed on 2026-06-10 from `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Device install check on 2026-06-11:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch succeeded, and package
metadata showed `versionCode=11`, `versionName=0.5.3-beta`, `lastUpdateTime=2026-06-11 15:45:14`.
Manual live-device acceptance is still pending.

## Manual Acceptance Pending

- Install the beta debug APK on a test device.
- Sign in with a disposable beta teacher account.
- Confirm Home shows Create new class.
- Confirm Add class validates blank institute/class fields.
- Create a class under an existing institute.
- Confirm the class appears on Home immediately after save.
- Confirm the class is visible to teacher web and admin web through the
  existing compatibility data.
- Confirm production build does not expose native class creation.
- Confirm a simultaneous web/native edit conflict reloads newer data instead
  of overwriting it.

## Remaining Phase 4 Work

- Decide whether class creation should become an offline outbox mutation before
  production enablement.
- Add focused unit tests for class draft validation and legacy class map
  mutation helpers.
- Run live-device compatibility acceptance against a disposable teacher
  account.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-5-4-durable-report-export-checkpoint..native-phase-4-11-native-class-create-checkpoint
```

If the tag is unavailable, revert the commit that introduced native class
creation, the `NATIVE_CLASS_CREATE_ENABLED` flag, and version 0.5.3.
