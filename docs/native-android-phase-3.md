# Native Android Phase 3

## Completed

- Replaced the generic Material shell with a reusable Ledgr design system.
- Aligned the native colour, typography, spacing, status, and class-card
  language with the teacher web application.
- Kept the native code split across:
  - `core:designsystem`
  - `core:model`
  - `core:firebase`
  - `feature:auth`
  - `feature:today`
  - `feature:classes`
  - `feature:profile`
- Rebuilt the Today screen with:
  - time-aware greeting
  - daily completion summary
  - current-month entry count
  - status-aware class cards
- Rebuilt the Classes screen with:
  - institute filtering
  - logged-today status
  - schedule and entry counts
  - oldest-first class history
- Rebuilt the Profile screen with:
  - teacher workspace summary
  - institutes and subjects
  - persistent light and dark theme selection
  - environment and cloud revision status
- Added cached-data messaging without replacing the current screen.
- Kept refresh explicit and non-blocking.

## Data boundary

Phase 3 remains read-only. It does not add Firestore writes, listeners, timers,
transactions, background jobs, or schema migrations.

The existing teacher web app, admin web app, and Capacitor Android project are
unchanged and continue to use the same Firebase backend.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat test
.\gradlew.bat :app:lintBetaDebug
```

From the repository root:

```powershell
npm run build
```

Expected APK:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Rollback

The Phase 3 Git tag is the rollback boundary. Revert the Phase 3 commit to
return to the Phase 2 read-only native interface. No web or Firebase rollback
is required.

## Next milestone

Phase 4 adds native teacher entry creation and editing behind repository and
use-case interfaces, with conflict handling and web compatibility tests.
