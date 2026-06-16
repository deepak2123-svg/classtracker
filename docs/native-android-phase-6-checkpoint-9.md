# Native Android Phase 6 Checkpoint 9

Date: 2026-06-16

## Current state

Ledgr beta/native syllabus polish, haptics, home-card drag affordances, report export corrections, and Ledgr branding/loading polish are implemented in the working tree.

Do not touch unrelated local outputs: `outputs/`, `output/`, `tmp/`, or `temp_excerpt.txt`.

## Completed in this checkpoint

- Admin web app Ledgr Report `Centre PDFs ZIP` now downloads one ZIP containing institute-wise PDF files instead of opening multiple PDFs.
- Rejected oversized section-chart PDF layout was removed from the ZIP PDF generator.
- Institute-wise ZIP PDFs now use the normal Ledgr report structure: institute header, scorecards, teacher daily-entry tables, and pending follow-up.
- Syllabus progress entries are filtered out of normal daily-entry counts.
- Syllabus coverage is appended as simple `Syllabus / Covered` rows in the teacher table, directly after the teacher's normal class entries.
- Shared Ledgr logo mark/lockup added for web.
- Teacher web header/loading and Admin web header now use the Ledgr logo lockup.
- Native Android splash icon is visible again on Android 12+ instead of using the transparent splash icon.
- Native beta already contains the Ledgr animated loading/logo surface and Sacramento font asset.

## Verified

- `npm run build`
- `.\gradlew.bat :app:compileBetaDebugKotlin --console=plain` with `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`

## Blocked / not verified

- `.\gradlew.bat :app:installBetaDebug --console=plain` packaged the APK but failed at install because no USB device was visible to ADB:
  - `adb devices` returned an empty device list.

## Next tasks

1. Reconnect/authorize the Android device and run `:app:installBetaDebug`.
2. Device-test:
   - Ledgr splash/loading logo on cold launch.
   - Home card drag/reorder and haptic feedback.
   - Syllabus tab save/deselect flow.
   - Add-entry page with syllabus block removed.
3. Admin web app acceptance:
   - Export combined PDF.
   - Export `Centre PDFs ZIP`.
   - Confirm each institute PDF has the normal report structure and syllabus `Covered` rows only where syllabus exists.
4. If exact browser-print parity is still required for ZIP PDFs, plan a server/headless-render path; browser print output cannot be captured into multiple zipped PDF blobs directly from the client.
