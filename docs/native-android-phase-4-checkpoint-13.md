# Native Android Phase 4: Swipe Smoothness and Scroll Drum Time Picker - Checkpoint 13

## Goal

Fix the latest live-device UX feedback:

- make Add Entry class left/right swiping feel smoother and visibly animated;
- replace the platform time picker with a custom scroll-drum picker matching
  the supplied reference;
- keep this pass focused and beta-only.

## Completed

- Optimized Add Entry class swiping:
  - reduced pager snap duration to 220ms;
  - removed alpha fades during paging;
  - reduced transform work to a light 98% to 100% scale;
  - set pager precompose distance to `0`;
  - render only the settled page as the full heavy entry screen;
  - render neighboring swipe pages as a lightweight class-banner preview until
    they settle.
- Applied the same lighter precompose/scale treatment to the Class History
  pager.
- Replaced the previous platform `NumberPicker` time selector with a pure
  Compose scroll drum dialog:
  - hour, minute, and AM/PM drums;
  - white drum columns on a dark dialog surface;
  - center-row highlight;
  - faded non-selected values;
  - snap-to-nearest item when scrolling stops;
  - `Cancel` and `Set time` actions.
- Wired both Start and End time fields to the new drum picker.
- Removed Android view-based time picker code and imports from the entry editor.

## Safety Boundary

- No Firebase rules changed.
- No web/admin React code changed.
- No production feature flag changed.
- No database schema changed in this pass.
- Existing `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11, 12, and 13 remain uncommitted WIP in this worktree.

## Verification

Passed on 2026-06-12 from `native-android/`:

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
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell pidof com.classtracker.app.nativebeta
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch succeeded, process was
running, and package metadata showed:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 06:02:23`

Also passed:

```powershell
git diff --check
```

Note: compile still emits existing deprecation warnings for `MenuBook` and
`Notes` icons in `EntryEditorScreen.kt`.

## Manual Acceptance Pending

- On the phone, swipe Add Entry classes left/right and confirm the motion feels
  smoother.
- Confirm the settled page returns to full size and does not look like a card.
- Open Start and End time fields and confirm the custom scroll drum appears.
- Spin hour, minute, and AM/PM drums; confirm they snap to the nearest value.
- Save an entry after selecting a custom drum time; confirm stored/displayed
  start/end times are correct.
- Swipe between classes with an unsaved draft and confirm the current class
  draft is not lost.
- Recheck Class History left/right paging after the lighter pager settings.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-13-swipe-drum-checkpoint
```

## Next Work

- Live-device acceptance of checkpoint 13 smoothness and drum picker.
- If swipe still feels imperfect, profile the Add Entry pager with device
  frame stats/JankStats and reduce work inside the settled page.
- Commit/tag checkpoints 11, 12, and 13 together or split them cleanly.
- Continue Phase 4 reliability polish:
  - conflict behavior for class create;
  - offline/durable class-create decision;
  - manual retry UX;
  - broader entry/report/export polish.
