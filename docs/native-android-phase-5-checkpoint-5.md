# Native Android Phase 5: Report Controls and Workflow Polish Checkpoint 5

## Goal

Make report period, scope, and PDF actions immediately understandable while
removing avoidable pauses and ambiguous selection states from daily teacher
workflows.

This checkpoint keeps Firebase reads/writes, Firestore document shape, Room
schema, sync, outbox, teacher web, admin web, and production native write
behavior unchanged.

## Completed

- Added previous/next month controls for Monthly reports.
- Added a direct month picker with year navigation and all twelve months.
- Updated monthly report calculation to use the selected calendar month,
  including its exact first and last dates.
- Added model coverage proving a selected May report does not fall back to the
  current June month.
- Reworked report scope into a labelled selection panel that distinguishes
  `All institutes` from specific institute selection.
- Added separate `Save PDF` and `Share PDF` actions beside each other.
- Added Android document creation support so teachers can choose where a PDF is
  saved.
- Removed the `Share text summary` action.
- Corrected class creation completion order so the app returns Home before
  showing the success snackbar instead of waiting on the form screen.
- Added an animated filled selected state and stronger border for the active
  timetable slot.

## User Behavior

- Choosing Monthly exposes a visible report-month control.
- Teachers can step month-by-month or open the picker for direct selection.
- The report range, totals, and generated PDF follow the selected month.
- Scope clearly communicates whether every institute or selected institutes
  are included.
- Save PDF opens Android's file destination picker.
- Share PDF continues to open Android's share sheet.
- A successfully created class returns to Home immediately, with confirmation
  shown there.
- The chosen timetable slot remains visibly highlighted.

## Safety Boundary

- No Firebase reads or writes changed.
- No Firestore document shape changed.
- No Room schema changed.
- No sync or outbox behavior changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, or Firebase rules changed.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :feature:entries:compileDebugKotlin :feature:profile:compileDebugKotlin :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

Also completed:

- `git diff --check`
- Installed `app-beta-debug.apk` on connected device `859013c6`
- Confirmed the beta process starts after installation

## Manual Acceptance

- Select Monthly and confirm previous, next, and direct month selection update
  the report range and totals.
- Select one and multiple institutes and confirm the report scope message and
  PDF contents match.
- Use Save PDF and choose a device folder, then open the saved file.
- Use Share PDF and confirm the Android share sheet receives the PDF.
- Create a disposable class and confirm navigation returns Home immediately
  after the server accepts it.
- Select different timetable slots and confirm only the active slot uses the
  filled selected style.

## Next Work

- Compare saved native PDFs against the teacher web PDF using populated report
  data and representative multi-page reports.
- Decide whether saved report history/library is needed inside the app.
- Continue Phase 6 notification deep links and separate notice preferences.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-5-4-durable-report-export-checkpoint..native-phase-5-5-report-controls-checkpoint
```

If the tag is unavailable, revert the commit that introduced selected-month
reports, separate save/share actions, scope-panel changes, class completion
navigation ordering, and timetable selection styling.
