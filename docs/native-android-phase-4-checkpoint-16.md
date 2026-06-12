# Native Android Phase 4: Pager Smoothness and Route Recomposition - Checkpoint 16

## Goal

Improve left/right class swipe smoothness on Add Entry and Class History, and
reduce avoidable recomposition/work across entry routes.

## Completed

- Added route-level snapshot indexes in `LedgrApp`:
  - `classesById`;
  - `entriesByClass`;
  - `trashedEntriesByClass`.
- Replaced repeated `snapshot.entriesForClass(...)` and
  `snapshot.trashedEntriesForClass(...)` calls in Add/Edit/Duplicate Entry and
  class pager routes with cached lookups.
- Memoized `snapshot.dashboard(todayKey)` so dashboard counts are not recomputed
  on ordinary app recomposition.
- Preloaded new-entry recovered drafts for all pager classes once per teacher
  and class-id set, instead of reading `SharedPreferences` inside each moving
  pager page composition.
- Reduced class pager snap time from `220ms` to `170ms` for a quicker, less
  floaty settle after swipes.
- Kept the previous checkpoint 15 behavior:
  - real adjacent pages are rendered;
  - no preview-to-full swap;
  - no pager page scale/fade transforms.

## Safety Boundary

- No Firebase rules changed.
- No web/admin React code changed.
- No Room schema migration in this pass.
- No production feature flag changed.
- Existing `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11, 12, 13, 14, 15, and 16 remain uncommitted WIP in this
  worktree.

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

Device `859013c6` was attached. Install succeeded, launch command returned
cleanly, and package metadata showed:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 14:31:01`

Also passed:

```powershell
git diff --check
```

Note: `git diff --check` only reported existing Windows LF-to-CRLF warnings.

## Manual Acceptance Pending

- On device, swipe Add Entry left/right across multiple classes.
- On device, swipe Class History left/right across multiple classes.
- Confirm the swipe settles faster and no page visibly swaps from preview to
  full content.
- Confirm Add/Edit/Duplicate Entry still validate against the correct class
  entry list.
- If swipe still feels jerky, capture a System Trace/Layout Inspector session
  during the swipe and look for expensive `ClassEntryScreen`/`ClassHistoryScreen`
  recomposition or sticky-header measure work.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-16-pager-recomposition-smoothness-checkpoint
```

## Next Work

- Live-device acceptance of checkpoint 16 swipe behavior.
- If needed, add a temporary recomposition counter/log only around pager pages,
  then remove it after profiling.
- Continue Phase 4 reliability closure:
  - class-create conflict behavior;
  - offline/durable class-create decision;
  - manual retry UX;
  - reports/export regression checks.
