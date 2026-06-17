# Ledgr Admin Report - Yesterday Period Checkpoint 1

Date: 2026-06-17

## Completed

- Added `Yesterday` to the Admin Ledgr Report period picker.
- Wired `Yesterday` as a real single-day report period.
- PDF report, PNG summary, and Centre PDFs ZIP all now use yesterday's date range when selected.
- Updated the period button grid so five choices fit cleanly and wrap on narrower screens.

## Verified

- `npm run build`

## Notes

- Existing generated folders/files were not touched: `output/`, `outputs/`, `tmp/`, `temp_excerpt.txt`.
- Vite still reports the existing Firebase dynamic-import and large-bundle warnings.

## Next

1. Test Admin web app after deployment.
2. Open Ledgr Report and verify the period row shows: Daily, Yesterday, Weekly, Monthly, Range.
3. Export Yesterday as PDF and ZIP and confirm report entries match only yesterday's date.
