# Native Android Phase 3.1

## Goal

Phase 3.1 makes the native teacher application closely match the current
mobile teacher web application while keeping the implementation fully native.

## Completed

- Consolidated the former Today and Classes split into the web-style Home
  workspace.
- Matched the mobile web hierarchy:
  - Ledgr header
  - daily summary
  - two-column institute filter
  - complete filtered class list
  - home, stats, and profile navigation
- Matched class-card geometry, dark outlines, section tones, institute pills,
  subjects, and completion indicators.
- Added native Stats surfaces for total time, today, week, month, weekly
  rhythm, institute summaries, and class history navigation.
- Aligned the Profile screen with the web workspace card, action order, and
  theme previews.
- Bundled Poppins and Inter so native typography matches the web application
  without requiring a network connection.
- Restored the same newest-class-first ordering used by the web teacher app.

## Architecture

The parity work remains split across the existing modules:

- `core:designsystem`
- `core:model`
- `core:firebase`
- `feature:today` for Home
- `feature:classes` for Stats and class history
- `feature:profile`
- `app` for navigation and shell

No WebView, shared web bundle, Firebase write, schema migration, or background
listener was added.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat test
.\gradlew.bat :app:lintBetaDebug
.\gradlew.bat :app:assembleBetaDebug
```

From the repository root:

```powershell
npm run build
```

## Rollback

Use the Phase 3.1 Git tag to return to this parity checkpoint. The preceding
`native-phase-3-design-alignment` tag remains available for the earlier native
layout.
