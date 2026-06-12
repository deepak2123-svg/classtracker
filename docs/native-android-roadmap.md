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

Status: completed as part of
`native-phase-4-offline-sync-checkpoint`.

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

Status: checkpoint 11 adds beta-gated native class creation from Home using the
existing web-compatible teacher data model. Checkpoint 10 adds the combined
class entry screen, inline entry editor, soft overlap warnings, post-save
feedback, and the profile recycle bin entry point on top of checkpoint 9
web-style native entry calendar and smoother animated date/filter controls,
checkpoint 8 sliding class pager, checkpoint 7 sticky banner/newest-first
history/class swiping, checkpoint 6 entry search/status filters, checkpoint 5
beta-only recoverable entry delete/restore, checkpoint 4 duplicate workflow
support, checkpoint 3 teacher mobile web parity, and checkpoint 2 offline
create/edit foundation.

### Deliverables

- Create, edit, duplicate, and delete daily entries.
- Create classes in native beta using the existing compatibility data model.
- Institute, class, section, subject, date, and time selection.
- Draft recovery and form validation.
- History, search, trash, restore, and web-style native date selection.
- Combined class entry screen with inline entry creation and full history.
- Sticky class-detail summary and sliding swipe navigation across classes.
- Compatibility writes that remain visible to teacher web and admin web.
- Feature flags for each write capability.
- Native class-detail and add-entry screens that visually match the mobile
  teacher web information hierarchy before new workflows are added.

### Acceptance gate

- Native and web clients can edit the same test account without data loss.
- Offline writes synchronize correctly after reconnecting.
- Destructive actions are recoverable.

## Phase 5: Teacher reports and exports

Status: checkpoint 4 adds durable app-file PDF saving with stable filenames,
FileProvider sharing for persisted reports, non-blocking export
progress/completion/failure states, and multi-select institute report scope.
Checkpoint 3 corrected native PDF report styling and structure to more closely
follow the teacher web app export, including the `ClassLog` header, summary
cards, institute/class sections, entry tables, and paginated table headers.
Checkpoint 2 added native PDF generation, cached PDF sharing through Android's
share sheet, and visible custom report date controls on top of checkpoint 1
reusable report summary calculations, daily/weekly/monthly/custom period
filters, a profile-launched reports screen, and text summary export.

### Deliverables

- Daily, weekly, monthly, and custom-range reports.
- Institute scope for one institute, selected institutes, or all institutes.
- Weekly, monthly, and range reports that include dates.
- Native PDF generation.
- Local file saving and Android share sheet integration.
- Background export work that does not block browsing.
- Export progress, completion, and failure states.

### Acceptance gate

- Reports match the teacher web app's existing class-entry totals.
- Exports continue when the user navigates elsewhere.
- Generated files open and share correctly on representative devices.

## Phase 6: Notifications and reminders

Status: checkpoint 7 prevents unavailable feedback permissions from closing
the signed-in beta app, contains the failure inside the feedback screen, and
adds regression and live-device startup coverage. The required Firestore rules
are now deployed and the feedback composer reconnects successfully on device.
Checkpoint 6 adds realtime teacher-to-admin feedback conversations
across the native profile and admin web profile, with replies, separate unread
counts, resolve/reopen state, and scoped Firestore rules. Admin web deployment
plus live cross-client acceptance remain required. Checkpoint 5
replaces the mixed Inter/Poppins presentation with one
bold Poppins typography system across the native app. Checkpoint 4 adds
Firebase Cloud Messaging reception for broadcast admin notices, with
environment-specific topics and a dedicated Android notification channel.
Checkpoint 3 clarifies the Add Entry custom-time action and corrects Profile
theme previews for system, light, and dark modes. Checkpoint 2 polishes the
local daily reminder setup with a drum-style time picker. Checkpoint 1 adds
local daily entry reminders with one reminder per day, Monday through Saturday,
at a teacher-selected time. Notification deep links and separate notice
preferences remain pending.

### Deliverables

- Firebase Cloud Messaging.
- Daily entry reminders.
- Admin notices.
- Notification deep links.
- Per-user notification preferences.

### Acceptance gate

- Notifications open the intended destination.
- Reminder preferences survive app restart.
- Web and Capacitor fallbacks remain available.

## Phase 7: Granular Firebase model

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

## Phase 8: Internal production pilot

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

## Phase 9: Stable replacement release

### Deliverables

- Native app built as `com.classtracker.app`.
- Existing production signing identity and Play listing retained.
- Staged rollout with stop and rollback criteria.
- Support runbook and release notes.

### Acceptance gate

- The Play Store accepts the native application as an update.
- Staged rollout telemetry is healthy.
- Teacher and admin web apps remain supported.

## Phase 10: Post-release cleanup

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
