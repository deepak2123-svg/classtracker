# Ledgr Admin Report - Teacher Activity Syllabus Layout Checkpoint 1

Date: 2026-06-17

## Completed

- Integrated the preferred Ledgr Report PDF layout into `src/AdminPanel.jsx`.
- Institute report pages now use a navy Ledgr header, compact teacher activity cards, daily-entry tables, and a compact syllabus tracker directly below the teacher when admin-published syllabus exists.
- Covered chapters now render as individually checked, compact chapter items with a completion count instead of a long comma-separated sentence.
- The chapter list keeps the approved teacher-activity report composition: a subtle two-column checklist inside the teacher card, without separate pill cards or a new page layout.
- The combined report and Centre PDFs ZIP path both call the shared HTML report builder, so institute-wise ZIP PDFs should use the same visual language as the combined report.
- Syllabus report rows are computed from admin-published syllabus and teacher syllabus progress entries, without showing syllabus blocks for teachers/classes where no syllabus is published.

## Prototype

- `output/pdf/ledgr-report-covered-chapters-prototype.pdf`
- `output/pdf/ledgr-report-covered-chapters-prototype.page1.png`
- `output/pdf/ledgr-report-teacher-activity-syllabus-prototype-v2.pdf`
- `output/pdf/ledgr-report-teacher-activity-syllabus-prototype-v2.page1.png`

## Verified

- `npm run build`
- `node --check api/render-ledgr-pdf.js`

## Notes

- The ZIP path depends on `/api/render-ledgr-pdf`, so local Vite alone will not exercise the headless PDF endpoint. Use deployed Admin or `vercel dev` for end-to-end PDF ZIP testing.
- Existing Android working-tree changes and untracked output/temp folders were not touched.

## Next

1. Test a real Admin Ledgr Report PDF with one teacher that has syllabus declared and one teacher without syllabus declared.
2. Export Centre PDFs ZIP and compare one institute PDF against the combined report page for pixel/style consistency.
3. If the visual output is approved, push `src/AdminPanel.jsx`, `api/render-ledgr-pdf.js` if not already pushed, package changes if any, and this checkpoint doc.
