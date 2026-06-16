# Ledgr report institute charts prototype checkpoint 2

Date: 2026-06-16

## Current state

Corrected chart prototype PDF is generated, but no app code has been changed for the report generator yet.

## What happened

- The earlier prototype PDF had chart pages only at the very end, so they were easy to miss and did not demonstrate the intended per-institute placement.
- A corrected prototype was generated from the original desktop report PDF.
- The corrected prototype inserts chart pages directly after institute summary pages.

## Completed work

- Created:
  - `output/pdf/ledgr-report-with-institute-charts-v3.pdf`
- Inserted 13 chart pages into the original report flow.
- Chart pages now show:
  - section-level doughnut chart;
  - total teaching time;
  - subject split;
  - logs count;
  - active teacher count for the institute.
- Rendered and visually checked sample pages:
  - `tmp/pdfs/ledgr-report-chart-v3-render/page-5.png`
  - `tmp/pdfs/ledgr-report-chart-v3-render/page-6.png`
  - `tmp/pdfs/ledgr-report-chart-v3-render/page-9.png`

## Important note

This is still a PDF prototype only. The admin web app report generator has not yet been updated to generate these charts automatically.

## Next task

Implement this chart block in the Admin Ledgr Report generator:

1. Aggregate each institute by section.
2. For each section, split timed logs by subject.
3. Insert the chart block before the teacher activity table inside each institute report.
4. Keep centre PDFs ZIP behavior intact.
5. Verify PDF, centre PDF ZIP, and PNG summary export still work.
