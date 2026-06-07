# Native Android Phase 4: Entry Write Checkpoint

## Goal

This checkpoint introduces the first native teacher write workflow without
changing the web applications or the legacy Firestore document contract.

## Completed

- Added a dedicated `feature:entries` module.
- Added beta-only feature flags for create and edit.
- Kept production native builds read-only.
- Added native create and edit entry routes from class history.
- Added date, start time, optional end time, status, topic, and notes fields.
- Limited new dates and edit actions to today and the previous seven days.
- Added required-field, time-order, and overlap validation.
- Added device-local draft recovery with stable mutation identifiers.
- Added revision-aware Firestore transactions.
- Added retry recognition so an already-committed mutation is not duplicated.
- Preserved the web-compatible split document model:
  - `users/{uid}/appdata/main`
  - `users/{uid}/appdata/notes_{classId}`
- Updated the teacher index used by the admin web application.
- Created the same latest and history backup records used by web saves.
- Kept backup history capped at 12 records.

## Safety Boundary

- Native writes are enabled only in `betaDebug`.
- `productionRelease` keeps create, edit, and delete disabled.
- A revision mismatch reloads current cloud data instead of overwriting it.
- A date change removes the entry from its previous date bucket.
- Delete remains disabled.
- The teacher and admin web applications were not modified.

## Remaining Phase 4 Work

- Durable Room-backed outbox and WorkManager synchronization.
- Offline create/edit with idempotent retry after process death.
- Duplicate entry.
- Delete, trash, restore, and destructive-action recovery.
- Entry search and filters.
- Full physical-device acceptance against a test teacher account.

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

All commands pass for this checkpoint.

## Device Acceptance

The generated APK is:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

Before advancing, verify on the beta Firebase app:

1. Create an entry and confirm it appears in native class history.
2. Confirm the same entry appears in the teacher web app.
3. Confirm admin reports see the updated teacher revision and entry.
4. Edit the date or topic and confirm the old date does not keep a duplicate.
5. Leave an unfinished draft, restart the app, and confirm it is restored.
6. Make a web edit before native save and confirm native reloads instead of
   overwriting it.

Physical-device verification remains pending because no ADB device was
connected when this checkpoint was built.

## Rollback

Use tag `native-phase-4-entry-write-checkpoint` after it is created. The
previous native UI parity checkpoint remains available at
`native-phase-3-1-web-parity`.
