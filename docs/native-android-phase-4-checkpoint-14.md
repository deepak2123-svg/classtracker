# Native Android Phase 4: Add Class Admin Sections - Checkpoint 14

## Goal

Fix Add Class issues from live-device review:

- institute dropdown items need clearer borders;
- Class / Section should show sections already created by admin for the
  selected institute.

## Completed

- Added `availableSectionsByInstitute` to `TeacherSnapshot` with a default empty
  map so existing callers remain compatible.
- Mapped admin-created sections from `config/sections`:
  - reads each institute's `gradeGroups`;
  - includes group `sections`;
  - also includes `sectionOverrides` keys;
  - deduplicates labels while preserving display order.
- Preserved remote admin sections in `MainViewModel` during the app session so
  local Room emissions do not immediately strip them from the UI.
- Updated Add Class:
  - institute dropdown rows now render as bordered selectable rows;
  - selected institute row has stronger selected border/fill;
  - Class / Section becomes a dropdown when admin sections exist for the
    selected institute;
  - changing institute auto-selects the first available admin section;
  - manual Class / Section input remains available if no admin sections are
    configured for that institute.

## Safety Boundary

- No Firebase rules changed.
- No web/admin React code changed.
- No production feature flag changed.
- No Room schema migration in this pass.
- Existing `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11, 12, 13, and 14 remain uncommitted WIP in this worktree.

## Verification

Passed on 2026-06-12 from `native-android/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat :core:firebase:testDebugUnitTest :app:compileBetaDebugKotlin
```

Device install check on 2026-06-12:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta 1
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch succeeded, and package
metadata showed:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 06:20:32`

Also passed:

```powershell
git diff --check
```

Note: compile still emits existing deprecation warnings for `menuAnchor()`.

## Manual Acceptance Pending

- Refresh/sign in with a teacher account that can read admin `config/sections`.
- Open Add Class.
- Confirm institute dropdown rows have visible borders.
- Select multiple institutes and confirm Class / Section shows that institute's
  admin-created sections.
- Confirm Add Class still allows manual section typing for institutes without
  configured sections.
- Create a class from a selected admin section and confirm it appears on Home
  and has the expected timetable slots on Add Entry.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-14-add-class-admin-sections-checkpoint
```

## Next Work

- Live-device acceptance of Add Class admin sections.
- Decide whether admin section lists should be persisted in Room for fully
  offline Add Class after app restart.
- Commit/tag checkpoints 11-14 cleanly.
- Continue Phase 4 reliability closure:
  - class-create conflict behavior;
  - offline/durable class-create decision;
  - manual retry UX;
  - reports/export regression checks.
