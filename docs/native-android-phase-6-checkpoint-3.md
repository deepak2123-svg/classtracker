# Native Android Phase 6: Entry CTA and Theme Preview Polish - Checkpoint 3

## Goal

Correct two focused presentation issues:

- make the Add Entry custom-time action clear, concise, and well spaced;
- make Profile theme previews accurately represent system, light, and dark.

## Completed

- Replaced the inline custom-time sentence with a full-width clickable action:
  - `Time slot not listed?`
  - `Choose a custom time`
- Added a clock icon, clear hierarchy, spacing, border, and theme-aware colors.
- Preserved the existing behavior that reveals Start and End time controls only
  after the action is tapped.
- Rebuilt the Profile theme previews:
  - System now visibly combines light and dark surfaces.
  - Light now uses an actual light preview.
  - Dark now uses an actual dark preview.
  - The selected mode uses a stable border and check indicator.
  - Removed the wrapping `ACTIVE` badge.
  - Fixed preview dimensions and single-line labels to prevent overlap.
- Updated the Phase 6 roadmap status.

## Safety Boundary

- UI presentation changes only.
- No Firebase Cloud Messaging changes.
- No Firebase rules or production data changes.
- No Room schema changes in this checkpoint.
- No web or admin React changes.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.
- Existing uncommitted checkpoint work remains preserved.

## Verification

Passed on 2026-06-12:

```powershell
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Installed and launched on attached device `859013c6`:

```powershell
adb install -r native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
adb shell monkey -p com.classtracker.app.nativebeta 1
adb shell dumpsys package com.classtracker.app.nativebeta
```

Installed package metadata:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 15:16:36`

Also passed:

```powershell
git diff --check
```

Only existing Windows LF-to-CRLF warnings were reported.

## Manual Acceptance Pending

- Open Add Entry and confirm the custom-time action is easy to scan.
- Tap it and confirm Start and End drum controls appear.
- Open Profile and confirm all three theme previews match their modes.
- Switch between System, Light, and Dark and confirm selection remains clear.

## Suggested Next Tag

After live-device acceptance:

```powershell
git tag native-phase-6-3-entry-cta-theme-preview-polish-checkpoint
```

## Next Work

- Add notification deep links to the intended destination.
- Add optional reminder wording based on classes not logged today.
- Add Firebase Cloud Messaging for admin notices.
- Separate daily-reminder and admin-notice preferences.
