# Native Android Phase 6: Home Reorder, Centre ZIP, Report Prototype - Checkpoint 8

## Goal

Fix the immediate polish issues across the beta Android teacher app and admin
report export while keeping the syllabus/report visual work safely in prototype
form first.

## Completed

- Android beta home class cards now support real long-press drag reorder.
- Reorder is local/session saved with the current class list and respects the
  selected institute filter.
- Drag uses a deliberate movement threshold so normal vertical scrolling is less
  likely to be misread as reorder.
- Home cards keep the strong black border, drag handle, and dark green logged
  indicator from the previous visual pass.
- Admin web app Ledgr Report format option is now labelled `Centre PDFs ZIP`.
- Centre PDFs export now generates one `application/zip` download containing a
  `Ledgr centre PDFs` folder and one PDF per selected institute.
- Created a new report prototype PDF page that separates:
  - daily class entries; and
  - syllabus tracker coverage for teachers/classes/subjects with a published
    syllabus.
- The prototype explicitly preserves the old report look for teachers without a
  declared syllabus.

## Files Changed

- `native-android/feature/today/src/main/kotlin/com/classtracker/feature/today/HomeScreen.kt`
- `src/AdminPanel.jsx`

## New Artifacts

- `output/pdf/ledgr-report-daily-plus-syllabus-prototype.pdf`
- Render check:
  `tmp/pdfs/ledgr-report-daily-plus-syllabus-render/page-8.png`

## Verification

Passed on 2026-06-16:

```powershell
npm run build
```

```powershell
.\gradlew.bat :feature:today:compileDebugKotlin :app:compileBetaDebugKotlin --console=plain
```

Installed on the connected Android device:

```powershell
adb devices
.\gradlew.bat :app:installBetaDebug --console=plain
```

Device found and installed:

```text
859013c6 device
Installed app-beta-debug.apk
```

PDF visual verification:

- Generated `ledgr-report-daily-plus-syllabus-prototype.pdf`.
- Rendered page 8 to PNG.
- Visual check confirmed the daily entries and syllabus tracker are clearly
  separate sections.

## Haptics Proposed, Not Implemented Yet

Add haptics only after product decision for these moments:

- Entry saved successfully.
- Required field / validation failure.
- Class card drag starts and drops.
- Syllabus progress saved.
- Recycle bin restore/delete.
- Report PDF saved/shared.
- Reminder time saved.
- Sign out / delete-account final confirmation.
- Feedback sent / admin reply received.
- Network sync failure and retry success.

## Still Pending

- Live-device acceptance of long-press class reorder feel.
- Decide which haptic events should actually be implemented.
- Wire the daily-entry plus syllabus-tracker layout into the production admin
  PDF generator after approving the prototype.
- Live authenticated browser test of `Centre PDFs ZIP` export in the admin web
  app.
- Persist teacher custom home card order if the order must survive app reinstall
  or cross-device sign-in.

## Safety Boundary

- Teacher web app was not changed.
- Room schema, Firestore schema, entry mutation, syllabus mutation, and report
  data semantics were not changed.
- Existing `outputs/` and `temp_excerpt.txt` were left untouched.

## Suggested Tag

After device reorder acceptance and admin ZIP export acceptance:

```powershell
git tag native-phase-6-8-home-reorder-centre-zip-report-prototype
```
