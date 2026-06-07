# Native Android Phase 4: Offline Sync Checkpoint

## Goal

This checkpoint makes native teacher entry creation and editing offline-first
without changing the teacher web app, admin web app, or legacy Firestore
document contract.

## Completed

- Added a dedicated `core:database` module using Room 2.8.4.
- Added a dedicated `core:sync` module using WorkManager 2.11.2.
- Made Room the native screen's local source of truth.
- Stored confirmed cloud snapshots separately from pending mutations.
- Added a durable entry outbox that survives process death and device restarts.
- Added connected-network WorkManager constraints and exponential retry.
- Added stable mutation identifiers so retries remain idempotent.
- Rebased later queued mutations after each successful revision change.
- Recovered mutations left in `SYNCING` if the process stops unexpectedly.
- Preserved pending edits when a Firebase refresh replaces confirmed data.
- Added revision-conflict detection and already-committed mutation recognition.
- Added visible `Pending`, `Syncing`, and `Failed` entry states.
- Added manual retry for failed mutations.
- Limited cached-data fallback to connectivity failures. Permission and missing
  workspace errors still surface normally.
- Kept Firebase transport, Room persistence, synchronization, ViewModel state,
  and Compose features in separate modules.

## User Behavior

- Saving an entry writes to Room immediately and returns the teacher to class
  history.
- The entry remains visible while offline.
- Background sync continues independently of navigation.
- A remote refresh cannot erase an unsynced local entry.
- Failed entries remain visible and can be retried.
- Existing teacher and admin web applications continue to use the same data.

## Safety Boundary

- Create and edit remain enabled only in `betaDebug`.
- `productionRelease` remains read-only.
- Delete remains disabled.
- No Firebase rules, web source, or legacy document shape changed.
- The confirmed snapshot and local outbox are updated transactionally.
- Room schema version 1 is exported in `core/database/schemas`.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat :app:testBetaDebugUnitTest
.\gradlew.bat :core:database:testDebugUnitTest
.\gradlew.bat :core:sync:testDebugUnitTest
.\gradlew.bat :app:lintBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

From the repository root:

```powershell
npm run build
```

All commands pass for this checkpoint.

## Device Acceptance

Verified on a connected Nothing Phone 2 (`AIN065`):

- Upgraded the existing beta installation without clearing app data.
- Retained the signed-in teacher session.
- Launched successfully in portrait and landscape with no fatal exception.
- Created `ledgr-teacher.db` and its WAL files.
- WorkManager started and completed the initial sync job successfully.

The generated beta APK is:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Remaining Phase 4 Work

- Duplicate entry.
- Delete, trash, restore, and destructive-action recovery.
- Entry search and filters.
- Extended physical-device acceptance for offline create, reconnect, web
  visibility, conflict, and retry scenarios.

## Rollback

Use tag `native-phase-4-offline-sync-checkpoint` after it is created. The
previous online write checkpoint remains available at
`native-phase-4-entry-write-checkpoint`.
