# Native Android Phase 5: PDF Report Export Checkpoint 2

## Goal

Turn the Reports & Export foundation into an actual native PDF export flow and
make custom report dates visible and editable.

This checkpoint keeps the teacher web app, admin web app, Capacitor app,
Firebase rules, Firestore document shape, Room schema, outbox, and native write
paths unchanged.

## Completed

- Added visible custom report date controls:
  - From date;
  - To date;
  - Android date picker for each field;
  - normalized date ordering through the existing report model.
- Updated the report hero to display the selected report date range.
- Added native PDF generation with Android `PdfDocument`.
- Added app `FileProvider` configuration for cached PDF sharing.
- Added cached report PDF files under app cache `reports/`.
- Added `Share PDF` action that opens Android's share sheet with a generated
  PDF file.
- Kept `Share text summary` as a lightweight fallback/export option.
- Bumped native version to `versionCode` 9 and `versionName` 0.5.1.

## User Behavior

- Teachers can open Profile > Reports & Export.
- Custom reports now show From and To dates directly on screen.
- Tapping either custom date opens a date picker.
- The report hero shows the active range for Daily, Weekly, Monthly, and
  Custom reports.
- Tapping Share PDF creates a PDF report and opens Android's share sheet.
- Tapping Share text summary still shares the plain text report.

## Safety Boundary

- No Firebase reads or writes changed.
- No Firestore document shape changed.
- No Room schema changed.
- No sync or outbox behavior changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, or Firebase rules changed.
- PDF files are generated in app cache for sharing, not persisted as a managed
  local export library yet.
- Background export progress/completion/failure states are not included yet.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Passed on 2026-06-10:

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

`npm run build` completed with the existing Vite warnings about Firebase
dynamic/static imports and large chunks.

Installed and launched on attached device `859013c6`:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

Installed package metadata:

```text
versionCode=9
versionName=0.5.1-beta
lastUpdateTime=2026-06-10 08:09:37
```

Manual acceptance should confirm:

- Profile > Reports & Export opens.
- Custom period shows From and To date fields.
- Tapping From and To opens a date picker and updates the report.
- Share PDF opens Android's share sheet with a PDF attachment.
- The shared PDF opens in a PDF viewer and contains summary and class breakdown.
- Share text summary still opens Android's share sheet with text.

## Remaining Phase 5 Work

- Durable local file saving with stable filenames.
- Android share sheet for persisted files.
- Background export progress, completion, and failure states.
- Multi-select institute scope.
- Better PDF styling, pagination polish, and optional detailed entry rows.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-5-1-reports-export-foundation-checkpoint..native-phase-5-2-pdf-report-export-checkpoint
```

If the tag is unavailable, revert the commit that introduced PDF generation,
custom date controls, and the native FileProvider. The previous stable Phase 5
checkpoint remains `native-phase-5-1-reports-export-foundation-checkpoint`.
