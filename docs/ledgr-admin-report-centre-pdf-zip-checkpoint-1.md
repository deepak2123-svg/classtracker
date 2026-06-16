# Ledgr Admin Report Centre PDF ZIP - Checkpoint 1

Date: 2026-06-16

## Current state

Admin web app Ledgr Report export now distinguishes the two PDF-style outputs:

- PDF report: one combined executive report for the selected institutes.
- Centre PDFs: one ZIP download containing separate PDF files for each selected institute.

This is implemented but not committed, tagged, pushed, or deployed.

## Completed

- Changed Centre PDFs from opening multiple print windows to downloading one ZIP.
- ZIP includes a `centre-pdfs/` folder.
- Each selected institute gets one generated PDF inside that folder.
- Added a `README.txt` inside the ZIP explaining the difference.
- Updated the modal copy:
  - `Downloads ZIP of institute PDFs`
  - `downloads centre ZIP`

## Files changed

- `src/AdminPanel.jsx`

## Technical notes

- The existing `jszip`, `jspdf`, and `jspdf-autotable` runtime loader is reused.
- The original executive PDF report still uses the browser print report flow.
- Centre ZIP PDFs are generated directly with jsPDF so the browser downloads actual PDF files in a ZIP instead of asking the admin to manually save multiple print windows.

## Verified

```powershell
npm run build
git diff --check
```

Build passed. `git diff --check` only reported normal CRLF warnings.

## Not done

- Not visually tested from the live admin UI.
- Not committed/tagged/pushed.
- Not deployed.

## Next

1. Open Admin web app.
2. Open Ledgr Report.
3. Choose Centre PDFs.
4. Export all institutes and confirm one ZIP downloads.
5. Extract ZIP and verify one PDF exists per selected institute.
6. If accepted, commit and push with the current Android syllabus checkpoint work or split into separate commits.
