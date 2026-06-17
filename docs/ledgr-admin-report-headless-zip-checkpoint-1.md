# Ledgr Admin Report - Headless ZIP PDF Checkpoint 1

Date: 2026-06-17

## Completed

- Added Vercel serverless PDF rendering endpoint at `/api/render-ledgr-pdf`.
- The endpoint uses headless Chromium through `puppeteer-core` and `@sparticuz/chromium`.
- Centre PDFs ZIP now renders each institute PDF from the same `buildInstituteGlanceInstituteHtml(...)` print template used by the normal institute PDF flow.
- Removed the ZIP path's dependency on the old synthetic jsPDF institute layout, so ZIP PDFs should visually match the combined/print-template styling.
- Updated ZIP README wording and export modal help to clarify that ZIP contains pixel-matched institute PDFs.
- Export errors now show the renderer's actual message instead of hiding it behind a generic alert.

## Verified

- `node --check api/render-ledgr-pdf.js`
- `npm run build`
- Puppeteer default launch args resolve correctly with `headless: "shell"`.

## Notes

- Local Vite dev does not serve Vercel API routes. Test this through the deployed Admin app or `vercel dev`.
- The ZIP still downloads as one ZIP file in the browser; each PDF inside the ZIP is now rendered server-side.
- `output/`, `outputs/`, `tmp/`, and `temp_excerpt.txt` were not touched.

## Next

1. Test Centre PDFs ZIP from the deployed Admin web app with all institutes selected.
2. Open two or three PDFs inside the ZIP and compare them against the combined report styling.
3. If many institutes hit Vercel timeout or payload limits, batch the ZIP render in smaller groups or move the ZIP assembly fully server-side.
