# Native Android Phase 5: Durable Report Export Checkpoint 4

## Goal

Move native report PDF export from a cache-only share flow to a persisted app
file export flow with clear progress/completion/failure feedback and
multi-institute report scoping.

This checkpoint keeps Firebase reads/writes, Firestore document shape, Room
schema, sync, outbox, teacher web, admin web, and production native write
behavior unchanged.

## Completed

- Added multi-select institute scope support for report summaries.
- Preserved the existing single-institute report model API.
- Added structured selected-institute metadata to `TeacherReportSummary` so PDF
  grouping no longer depends on parsing the display label.
- Updated Profile > Reports & Export scope chips so teachers can select any
  combination of institutes or clear back to all institutes.
- Moved generated PDF reports from app cache to app files under `reports/`.
- Added FileProvider coverage for persisted app report files.
- Added stable report filenames that include teacher, period, scope, and date
  range.
- Added temp-file replacement when writing PDFs to avoid leaving partial report
  files after generation failures.
- Moved PDF generation off the main thread.
- Added visible export progress, completion, and failure states around Share
  PDF.

## User Behavior

- Teachers can select one institute, multiple institutes, or all institutes for
  native report summaries and PDF exports.
- Tapping Share PDF shows a preparing state while the PDF is generated.
- Successful PDF creation saves a deterministic file in app files and opens the
  Android share sheet for that persisted PDF.
- If PDF creation or sharing fails, the report screen shows the failure message
  instead of crashing.

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
.\gradlew.bat :app:assembleBetaDebug
```

Manual acceptance should confirm:

- Profile > Reports & Export opens.
- Scope chips can select multiple institutes and return to All institutes.
- Share PDF shows a preparing state and then opens Android's share sheet.
- The saved/shared PDF filename includes teacher, period, scope, and date range.
- Multi-page PDFs still keep table headers after page breaks.

## Remaining Phase 5 Work

- Manual screenshot/PDF comparison against the teacher web export.
- Further PDF polish if exact visual parity is required.
- Optional export library/history UI if teachers need to browse past exports.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-5-3-web-style-pdf-report-checkpoint..native-phase-5-4-durable-report-export-checkpoint
```

If the tag is unavailable, revert the commit that introduced persisted native
report files, multi-institute report scoping, and export state feedback. The
previous stable PDF checkpoint remains
`native-phase-5-3-web-style-pdf-report-checkpoint`.
