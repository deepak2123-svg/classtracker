# Ledgr Native Android Roadmap

## Product boundary

The native Android project is a teacher application. The existing React teacher
web app, React admin app, and Capacitor application remain available throughout
development.

The native app is developed in `native-android/` and does not consume the web
build output. Until the final release:

- Web deployments continue from the existing Vite project.
- The Capacitor Android project remains in `android/`.
- Native development builds use `com.classtracker.app.nativebeta`.
- Production Firebase data is not changed without a compatibility plan and a
  tested rollback.

## Phase 1: Native foundation

Status: completed at tag `native-phase-1-foundation`.

### Deliverables

- Standalone Kotlin and Jetpack Compose project.
- Beta and production build environments.
- Only beta debug and production release variants are allowed.
- Material 3 design system and responsive teacher shell.
- Native navigation for Today, Classes, and Profile.
- Module boundaries for app, models, design system, and teacher features.
- Unit and Compose UI test foundations.
- Release roadmap, architecture decisions, and local build instructions.

### Acceptance gate

- `betaDebug` compiles and installs independently of the current app.
- Unit tests and lint pass.
- Existing web build still passes.
- No Firebase rules, documents, authentication settings, or web code change.

## Phase 2: Authentication and compatibility reads

Status: implementation complete; Firebase console registration and live-device
acceptance remain before internal distribution.

### Deliverables

- Firebase Android SDK configured for a separate beta Firebase application.
- Google sign-in through Android Credential Manager and Firebase Auth.
- Teacher session persistence and secure sign-out.
- Read-only compatibility adapter for:
  - `users/{uid}/appdata/main`
  - `users/{uid}/appdata/notes_{classId}`
  - `teachers/{uid}`
  - shared institute and section configuration
- Native profile, institute, class, and entry-history screens.
- Firebase Emulator coverage for authentication and Firestore reads.

### Acceptance gate

- A beta teacher sees the same profile, classes, and entries as the web app.
- Native code performs no production writes.
- Authorization failures and revoked sessions are handled safely.

## Phase 3: Offline database and synchronization

### Deliverables

- Room database as the native app's local source of truth.
- Repository layer exposing `Flow` data to ViewModels.
- Durable outbox with idempotent mutation identifiers.
- WorkManager synchronization with network constraints and retry policies.
- Sync states for pending, syncing, failed, and complete operations.
- Conflict policy compatible with current web revision handling.

### Acceptance gate

- Existing data remains browsable without a connection.
- A queued test mutation survives process death and restarts.
- Repeated retries do not create duplicate entries.
- Scrolling and navigation never depend on a remote refresh.

## Phase 4: Core teacher workflows

### Deliverables

- Create, edit, duplicate, and delete daily entries.
- Institute, class, section, subject, date, and time selection.
- Draft recovery and form validation.
- History, search, trash, and restore.
- Compatibility writes that remain visible to teacher web and admin web.
- Feature flags for each write capability.

### Acceptance gate

- Native and web clients can edit the same test account without data loss.
- Offline writes synchronize correctly after reconnecting.
- Destructive actions are recoverable.

## Phase 5: Notifications, analytics, and exports

### Deliverables

- Firebase Cloud Messaging and notification deep links.
- Native reminders and admin notices.
- Teacher analytics and timelines.
- Native PDF/file generation, storage, and Android share sheet integration.
- Background export work that does not block browsing.
- Profile, preferences, accessibility, and theme completion.

### Acceptance gate

- Notifications open the intended destination.
- Exports continue when the user navigates elsewhere.
- Large histories remain responsive on representative devices.

## Phase 6: Granular Firebase model

This phase is additive and may begin only after the native compatibility client
is stable.

### Target structure

```text
users/{uid}/classes/{classId}
users/{uid}/classes/{classId}/entries/{entryId}
users/{uid}/notifications/{notificationId}
users/{uid}/preferences/main
users/{uid}/devices/{installationId}
```

### Deliverables

- Server-side migration and validation tools.
- Dual-read or dual-write compatibility period.
- Per-record timestamps, versions, mutation IDs, and deletion tombstones.
- Web adapters so teacher and admin web apps continue to operate normally.
- Feature-flagged migration by account or institute.

### Acceptance gate

- Automated comparison reports show equivalent old and new data.
- Rollback does not discard writes made during the migration window.
- No large all-user or all-class document rewrite is required.

## Phase 7: Internal production pilot

### Deliverables

- Play Console internal-test release.
- Crashlytics, performance monitoring, App Check, and Play Integrity.
- Room migration tests, Compose UI tests, and device coverage.
- R8 rules, resource shrinking, baseline profiles, and macrobenchmarks.
- Pilot support and data-integrity dashboard.

### Acceptance gate

- Pilot users complete normal work for at least one full reporting cycle.
- Crash-free sessions and synchronization success meet release thresholds.
- Web and Capacitor fallbacks remain available.

## Phase 8: Stable replacement release

### Deliverables

- Native app built as `com.classtracker.app`.
- Existing production signing identity and Play listing retained.
- Staged rollout with stop and rollback criteria.
- Support runbook and release notes.

### Acceptance gate

- The Play Store accepts the native application as an update.
- Staged rollout telemetry is healthy.
- Teacher and admin web apps remain supported.

## Phase 9: Post-release cleanup

- Increase rollout to 100 percent.
- Remove Capacitor Android only after the rollback window closes.
- Retire legacy writes only after every supported client uses the new model.
- Continue the teacher web app as a browser and desktop alternative.

## Checkpoint policy

Every phase ends with:

1. Automated verification.
2. A human-readable changelog.
3. A Git tag named `native-phase-N-*`.
4. A production-data backup before any data-model change.
5. Explicit rollback instructions.
