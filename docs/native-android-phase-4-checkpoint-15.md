# Native Android Phase 4: Entry Custom Time and Pager Smoothness - Checkpoint 15

## Goal

Fix Add Entry issues from live-device review:

- hide custom Start/End clock fields until the teacher asks for custom time;
- use stronger standard lettering on Add Entry controls;
- make class swiping feel smoother by removing visible preview swaps and scale
  transforms.

## Completed

- Updated Add Entry timetable behavior:
  - when timetable slots exist, Start/End custom time fields are hidden by
    default;
  - a bold `Custom start and end time` row reveals Start/End fields on tap;
  - when no timetable slots exist, Start/End fields still show immediately so
    manual entry remains possible.
- Strengthened Add Entry typography:
  - `STATUS`, `TOPIC / TITLE`, `NOTES`, and `* Required` now use bolder ink
    lettering;
  - status pills use stronger text color instead of muted text.
- Reworked entry/history class paging:
  - neighboring pager pages now render the real full screen instead of a
    lightweight preview;
  - removed the preview-to-full swap that could show a jump at settle time;
  - removed per-frame page scaling/fade transforms from entry/history pagers;
  - kept `beyondViewportPageCount=1` so adjacent pages are ready during swipes.
- Removed unused class swipe preview composables and imports from `LedgrApp`.

## Safety Boundary

- No Firebase rules changed.
- No web/admin React code changed.
- No Room schema migration in this pass.
- No production feature flag changed.
- Existing `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11, 12, 13, 14, and 15 remain uncommitted WIP in this worktree.

## Verification

Passed on 2026-06-12:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
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
- `lastUpdateTime=2026-06-12 14:20:24`

Also passed:

```powershell
git diff --check
```

Note: `git diff --check` only reported existing Windows LF-to-CRLF warnings.

## Manual Acceptance Pending

- Open Add Entry for a class with timetable slots.
- Confirm Start/End custom time fields are hidden at first.
- Tap `Custom start and end time` and confirm Start/End fields appear.
- Select a normal timetable slot and confirm the form no longer shows confusing
  custom clock fields by default.
- Confirm Add Entry status/topic/notes lettering is stronger and readable.
- Swipe left/right between classes on Add Entry and Class History, especially on
  device, and confirm there is no preview jump or shrinking card effect.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-15-entry-time-pager-smoothness-checkpoint
```

## Next Work

- Live-device acceptance of checkpoint 15 UI behavior.
- If swipe still feels jerky on device, profile recomposition and data loading
  inside pager pages with Layout Inspector/System Trace.
- Continue Phase 4 reliability closure:
  - class-create conflict behavior;
  - offline/durable class-create decision;
  - manual retry UX;
  - reports/export regression checks.
