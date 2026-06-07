# Native Android Phase 4: Teacher Web Parity Checkpoint

## Goal

This checkpoint brings the native teacher class-detail and entry-editing
surfaces closer to the current mobile teacher web app while keeping the native
implementation fully in Jetpack Compose.

The teacher web app, admin web app, Firebase rules, and legacy Firestore
document shape are unchanged.

## Completed

- Compared the native teacher home, class detail/history, and add-entry flow
  against the mobile teacher web implementation in `src/ClassTracker.jsx`.
- Reworked the native class screen into a web-aligned class-detail hierarchy:
  class hero, institute and subject chips, today status, summary metrics, date
  focus, selected-date add action, focused entries, and all-history entries.
- Preserved the native Room source of truth and WorkManager synchronization
  behavior from checkpoint 2.
- Routed native add-entry actions through the selected class-detail date so the
  editor opens on the same date the teacher chose.
- Updated native entry cards to surface web-style status labels and pending
  synchronization states without changing the Firestore entry model.
- Updated the native add-entry editor with web-style status chips, selected
  status clearing, and duration presets after a start time is selected.
- Kept class-detail UI pieces in a dedicated feature component file instead of
  growing the route screen into a monolith.
- Captured portrait and landscape native screenshots on a physical Nothing
  Phone 2.

## User Behavior

- Tapping into a class now lands on a class-detail page that matches the mobile
  web information hierarchy more closely than the previous plain history list.
- Teachers can switch the date focus with horizontal chips and add an entry for
  the selected editable date.
- Older dates remain browsable; add is disabled outside the existing native
  edit window unless entries already exist for review.
- The all-history section remains available below the selected date focus.
- Entry status chips visually match the web status treatment and can be cleared
  by tapping the selected status again.
- Native create/edit writes still use the beta-only offline outbox.

## Safety Boundary

- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- Native production builds remain read-only.
- Duplicate, delete, trash, restore, search, and filter workflows remain future
  Stage 4.4 work.
- This checkpoint does not replace Compose screens with a WebView.
- The unrelated untracked `temp_excerpt.txt` file remains untouched.

## Screenshot Notes

Generated local evidence for this checkpoint includes:

- `stage-4-3-native-baseline-portrait.png`
- `stage-4-3-native-baseline-class-detail.png`
- `stage-4-3-native-after-home-portrait.png`
- `stage-4-3-native-after-class-detail-portrait.png`
- `stage-4-3-native-after-entry-editor-portrait.png`
- `stage-4-3-native-after-home-landscape.png`
- `stage-4-3-native-after-class-detail-landscape.png`
- `stage-4-3-native-after-entry-editor-landscape.png`
- `stage-4-3-web-baseline-portrait.png`

The captured web phone screenshot reached the teacher auth screen because
Chrome on the test phone did not have an authenticated teacher-web session.
Authenticated web parity was compared against the checked-in mobile teacher web
source and the same teacher data shown in the native beta app.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:testBetaDebugUnitTest :core:database:testDebugUnitTest :core:sync:testDebugUnitTest :app:lintBetaDebug :app:assembleBetaDebug :app:assembleProductionRelease
```

From the repository root:

```powershell
npm run build
```

Both verification commands pass for this checkpoint. The web build still emits
the existing Firebase dynamic-import and chunk-size warnings.

## Device Acceptance

Verified on a connected Nothing Phone 2 (`AIN065`):

- Installed the beta debug APK over the existing native beta app without
  clearing app data.
- Preserved the signed-in teacher session.
- Verified home, class detail, and add-entry screens in portrait.
- Verified home, class detail, and add-entry screens in landscape.
- Confirmed the implementation remains native Compose under
  `com.classtracker.app.nativebeta`.

The generated beta APK is:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Remaining Stage 4 Work

- Complete an authenticated side-by-side teacher-web screenshot pass when a
  test browser session is available.
- Duplicate entries.
- Delete entries with confirmation.
- Trash, restore, and recoverable destructive actions.
- Entry search and filters.
- Reliability acceptance for offline create/edit, process death, reconnect,
  simultaneous native/web edits, conflicts, manual retry, and duplicate
  prevention.

## Rollback

After the checkpoint tag is created, roll back this UI checkpoint with:

```powershell
git revert native-phase-4-offline-sync-checkpoint..native-phase-4-3-teacher-web-parity-checkpoint
```

If the tag is unavailable, revert the commit that introduced the Stage 4.3
teacher web parity changes. The previous stable native checkpoint remains
`native-phase-4-offline-sync-checkpoint`.
