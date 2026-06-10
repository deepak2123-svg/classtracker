# Native Android Phase 5: Web-Style PDF Report Checkpoint 3

## Goal

Fix the native PDF report export so it follows the teacher web app export
structure instead of producing a plain summary document.

This checkpoint keeps Firebase reads/writes, Firestore document shape, Room
schema, sync, outbox, teacher web, admin web, and production native write
behavior unchanged.

## Completed

- Reworked native PDF generation to use the full `TeacherSnapshot`, not only
  summary totals.
- Matched the teacher web PDF export structure more closely:
  - `ClassLog` title;
  - teacher, period, scope, exported date, and report range header;
  - summary cards for institutes, classes, and entries;
  - institute sections with class and entry counts;
  - rounded class headers with subject labels;
  - grid table rows for Date, Time, Status, Title, and Notes;
  - alternating row backgrounds and web export color tokens.
- Added native PDF grouping by institute and class.
- Added entry-level rows filtered by the selected report range and scope.
- Added native pagination that redraws table headers after page breaks.
- Kept the existing `Share PDF` and `Share text summary` actions.
- Bumped native version to `versionCode` 10 and `versionName` 0.5.2.

## User Behavior

- Teachers can open Profile > Reports & Export.
- Tapping Share PDF now creates a report that looks much closer to the teacher
  web app PDF export.
- The PDF includes individual entry rows, not only class totals.
- Empty report ranges still create a styled empty-state PDF.

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
versionCode=10
versionName=0.5.2-beta
lastUpdateTime=2026-06-10 08:36:07
```

Manual acceptance should confirm:

- Profile > Reports & Export opens.
- Share PDF opens Android's share sheet with a PDF attachment.
- The PDF has the `ClassLog` header, summary cards, institute/class sections,
  and entry table rows.
- The PDF styling is close to the teacher web app export.
- Multi-page PDFs keep table headers after page breaks.

## Remaining Phase 5 Work

- Manual screenshot/PDF comparison against the teacher web export.
- Durable local file saving with stable filenames.
- Android share sheet for persisted files.
- Background export progress, completion, and failure states.
- Multi-select institute scope.
- Further PDF polish if exact visual parity is required.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-5-2-pdf-report-export-checkpoint..native-phase-5-3-web-style-pdf-report-checkpoint
```

If the tag is unavailable, revert the commit that reworked native PDF rendering
to use web-style grouped entry tables. The previous stable PDF checkpoint
remains `native-phase-5-2-pdf-report-export-checkpoint`.
