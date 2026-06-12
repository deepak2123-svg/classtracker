# Native Android Phase 4: Dark Theme System Bar Contrast - Checkpoint 17

## Goal

Fix dark theme status bar visibility so the phone time, network, signal, and
battery icons remain clearly readable.

## Completed

- Added activity-level system bar styling in `MainActivity`.
- Replaced the one-time default edge-to-edge call with theme-aware
  `ApplySystemBarContrast(themeMode)`.
- Uses AndroidX `enableEdgeToEdge` with explicit `SystemBarStyle`:
  - dark theme uses `#08111B` and light system icons;
  - light theme uses `#EFEEE8` and dark system icons;
  - navigation bar follows the same contrast behavior.
- Supports `Light`, `Dark`, and `System` theme modes by resolving system dark
  theme inside Compose.

## Safety Boundary

- No Firebase rules changed.
- No web/admin React code changed.
- No Room schema migration in this pass.
- No production feature flag changed.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11, 12, 13, 14, 15, 16, and 17 remain uncommitted WIP in this
  worktree.

## Verification

Passed on 2026-06-12:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Device install and launch check on 2026-06-12:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta 1
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe exec-out screencap -p
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch command returned
cleanly, and package metadata showed:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 14:37:19`

Visual verification:

- Captured screenshot from installed beta at
  `native-android/app/build/outputs/statusbar-checkpoint-17.png`.
- Confirmed dark theme status bar icons are now bright/readable.

Also passed:

```powershell
git diff --check
```

Note: `git diff --check` only reported existing Windows LF-to-CRLF warnings.

## Manual Acceptance Pending

- On device, toggle between Light, Dark, and System theme modes.
- Confirm status bar icons remain readable on Home, Add Entry, Class History,
  Reports, Recycle Bin, and Add Class.
- Confirm navigation bar remains readable at the bottom in dark theme.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-17-dark-system-bar-contrast-checkpoint
```

## Next Work

- Live-device acceptance of system bar contrast across all screens.
- Continue Phase 4 reliability closure:
  - class-create conflict behavior;
  - offline/durable class-create decision;
  - manual retry UX;
  - reports/export regression checks.
