# Native Android Phase 4: Combined Class Entry Screen — Checkpoint 10

## Goal

Collapse the three-screen add-entry flow (classes list → class detail → add
entry) into two screens (classes list → combined class entry screen).

Tapping a class card on the home screen or stats screen now opens a single
combined screen containing the class header, an inline entry editor, and the
full entry history below. The separate class-detail route and the separate
add-entry route are no longer reachable from the class card tap; they remain
in the nav graph for edit and duplicate flows only.

The teacher web app, admin web app, Capacitor app, Firebase rules, Firestore
document shape, and native write paths are unchanged.

## Completed

- Added `ClassEntryRoute = "class-entry/{classId}"` to the nav graph in
  `LedgrApp.kt`.
- Added `ClassEntryPagerRoute` composable (horizontal pager across all
  classes, matching the existing `ClassHistoryPagerRoute` pattern).
- Created `ClassEntryScreen.kt` in `feature/classes` — a single `LazyColumn`
  containing:
  - sticky `ClassDetailHero` (class name, institute, stats, logged-today pill);
  - inline entry editor (calendar, start/end time, status chips, topic field,
    notes field, save button) via `EntryEditorColumn`;
  - full history section (history filter card, search, status chips, entry
    cards, recycle bin).
- Added `EntryEditorColumn` to `EntryEditorScreen.kt` — a non-scrolling
  `Column` variant of the editor form for embedding inside `LazyColumn`
  without nesting scrollable containers.
- Changed `onClassClick` in `HomeScreen` and `StatsScreen` to navigate to
  `class-entry/{classId}` instead of `class/{classId}`.
- Updated top-bar title to "Add entry" for `ClassEntryRoute`.
- Added `feature:entries` dependency to `feature/classes/build.gradle.kts`.
- `ClassHistoryRoute`, `NewEntryRoute`, `EditEntryRoute`, and
  `DuplicateEntryRoute` remain in the nav graph unchanged.
- Added `TeacherEntryValidation.Overlap` — a soft warning state (distinct from
  `Invalid`) returned when a new entry's time overlaps an existing one on the
  same date. Overlap shows an amber inline warning and allows saving anyway.
  Hard `Invalid` states (blank title, invalid time) remain blocking.
- Updated `FirebaseTeacherEntryWriter` and `MainViewModel` `when` expressions
  to handle the new `Overlap` branch (treat as allowed on server side).
- Updated `TeacherEntryDraftTest` to assert `Overlap` instead of `Invalid`
  for time-conflict cases.
- Added `saveAttempted` flag to `EntryEditorColumn` — hard validation errors
  only show after the user has tapped Save at least once; resets on each new
  draft (keyed on `mutationId`).
- Post-save snackbar "✓ Entry saved successfully" shown for ~1.5 s from
  `TeacherApp` level (stable coroutine scope); `onConsumeEntrySaved()` called
  only after the snackbar completes so the state flip does not cancel the
  coroutine.
- Version bumped: versionCode 7, versionName 0.4.2.

## Version

- versionCode: 7
- versionName: 0.4.2-beta
- Tag: `native-phase-4-10-combined-class-entry-checkpoint`

## User Behavior

- Tapping a class card goes directly to the combined screen; no intermediate
  class-detail screen is shown.
- The combined screen opens with today pre-selected in the inline calendar.
- Scrolling down reveals the full entry history for the class.
- If the entry's time overlaps an existing entry on the same date, an amber
  warning appears proactively; teacher can still save.
- Hard validation errors (blank title, invalid start time) show only after
  the teacher taps Save; they block saving until resolved.
- After a successful save the form resets and a "✓ Entry saved successfully"
  snackbar appears for ~1.5 s.
- Tapping Edit or Duplicate on a history entry navigates to the dedicated
  full-screen editor.
- Swiping left/right between classes still works.

## Safety Boundary

- No write path changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, Firebase rules, or
  Firebase document-model files changed.
- No Firebase reads or compatibility mapper behavior changed.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Automated checkpoint verification is green as of 2026-06-09.

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :app:compileBetaDebugKotlin
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :core:sync:testDebugUnitTest
.\gradlew.bat :feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
.\gradlew.bat :app:lintBetaDebug
.\gradlew.bat :app:assembleBetaDebug --rerun-tasks
```

From the repository root:

```powershell
npm run build
```

The `:feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest
:app:assembleBetaDebug` command was rerun after an initial Kotlin daemon
`AccessDeniedException` against `AppData\Local\kotlin\daemon`; the rerun
completed successfully, so the earlier error was local daemon/temp-file access
noise rather than a checkpoint code failure.

The Vite build still reports the existing Firebase dynamic/static import
chunking warning and the existing large-chunk warning.

Install and launch:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

During checkpoint closure on 2026-06-09, `adb devices` returned no attached
devices after restarting the ADB daemon, so fresh install metadata was not
captured in this session. Rerun the install/launch commands above when a test
device is attached.

## Manual Acceptance

Manual acceptance was confirmed by the user on 2026-06-09.

- Tap a class card; confirm the combined screen opens directly.
- Confirm class header, inline calendar, status chips, topic field, notes
  field, and Save button are all visible on first open.
- Confirm tapping Save with a blank topic shows "Add the topic before saving."
  only after the first save attempt.
- Confirm a valid entry saves and shows "✓ Entry saved successfully" snackbar
  for ~1.5 s.
- Confirm the form resets cleanly after save with no stale validation error.
- Confirm overlapping time shows amber warning but allows saving.
- Confirm entry appears in history below after save.
- Confirm Edit and Duplicate on history entries navigate to dedicated screens.
- Confirm swiping between classes works.
- Confirm Stats screen class tap also goes to the combined screen.

## Remaining Phase 4 Work

- Live-device reliability acceptance on a disposable teacher account:
  delete/restore sync, offline delete/restore then reconnect, process death
  during pending mutations, simultaneous native/web edit conflict, manual
  retry polish.

## Next Stage — Phase 5

After Phase 4 reliability acceptance:

- Daily, weekly, monthly, and custom-range teacher reports.
- Institute scope filters.
- Native PDF generation.
- Local file saving and Android share sheet.
- Background export progress, completion, and failure states.

## Rollback

```powershell
git revert native-phase-4-9-entry-calendar-motion-checkpoint..native-phase-4-10-combined-class-entry-checkpoint
```

Previous stable checkpoint: `native-phase-4-9-entry-calendar-motion-checkpoint`.
