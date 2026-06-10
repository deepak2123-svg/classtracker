# Native Android Phase 5: Reports and Export Foundation Checkpoint 1

## Goal

Start Phase 5 by adding a reusable native teacher report model and a
profile-launched Reports & Export screen before introducing PDF generation and
local file saving.

This checkpoint keeps the teacher web app, admin web app, Capacitor app,
Firebase rules, Firestore document shape, and native write paths unchanged.

## Completed

- Added reusable report summary logic in `core:model`.
- Added daily, weekly, monthly, and custom period report windows.
- Added institute scope filtering for all institutes or one institute.
- Added report metrics:
  - total entries;
  - timed entries;
  - total teaching minutes;
  - active days;
  - logged classes;
  - institute count;
  - per-class entry/time/status breakdown.
- Added shareable text export formatting for report summaries.
- Added a native Reports & Export screen in the profile feature.
- Wired Profile `Reports & Export` action to the new screen.
- Added Android share-sheet text export from the report screen.
- Bumped native version to `versionCode` 8 and `versionName` 0.5.0.

## User Behavior

- Teachers can open Profile > Reports & Export.
- Teachers can switch between Daily, Weekly, Monthly, and Custom reports.
- Teachers can filter the report to all institutes or a single institute.
- Teachers can review report totals and per-class breakdowns in-app.
- Teachers can tap Share report to open Android's share sheet with a text
  summary export.

## Safety Boundary

- No Firestore reads or writes changed.
- No Room schema changed.
- No outbox behavior changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- Native PDF generation, local file saving, and background export progress are
  not included yet.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Full checkpoint verification is green as of 2026-06-10.

```powershell
cd native-android
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

The Vite build still reports the existing Firebase dynamic/static import
chunking warning and the existing large-chunk warning.

Install and launch when a device is attached:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

Installed and launched on device `859013c6`.

Installed package metadata:

```text
versionCode=8
versionName=0.5.0-beta
lastUpdateTime=2026-06-10 07:50:11
```

Manual acceptance should confirm:

- Profile > Reports & Export opens the new screen.
- Daily, Weekly, Monthly, and Custom period chips update totals.
- All institutes and single institute scope chips update totals.
- Class breakdown matches visible history data for the selected period.
- Share report opens Android's share sheet with a text report summary.

## Remaining Phase 5 Work

- Native PDF generation.
- Local file saving with stable report filenames.
- Android share sheet for generated files.
- Background export progress, completion, and failure states.
- Custom start/end date picker controls.
- Selected-institutes multi-select scope.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-4-10-combined-class-entry-checkpoint..native-phase-5-1-reports-export-foundation-checkpoint
```

If the tag is unavailable, revert the commit that introduced the Phase 5 report
model and Reports & Export screen. The previous stable native checkpoint remains
`native-phase-4-10-combined-class-entry-checkpoint`.
