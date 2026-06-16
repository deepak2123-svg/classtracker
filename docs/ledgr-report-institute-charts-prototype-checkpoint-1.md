# Ledgr Report Institute Charts Prototype - Checkpoint 1

Date: 2026-06-16

## Current state

A PDF-only visual prototype was created for adding per-institute section charts to the Ledgr Report.

No app code was changed.

## Completed

- Reviewed the supplied Ledgr Report PDF.
- Confirmed institute detail pages begin after the executive overview.
- Created a prototype report copy with two appended chart pages.
- Chart layout shows:
  - section card
  - logs and active-teacher count
  - total timed duration pill
  - donut chart for subject time split
  - subject split rows with bars and minutes
- Rendered the appended pages to PNG for visual QA.

## Prototype file

`output/pdf/ledgr-report-with-institute-charts-prototype.pdf`

## Recommendation

Add these charts inside each institute detail section, before the teacher activity table.

Use a full-width card layout in PDF, two section cards per page. The compact two-column card layout was tested first and was too cramped for readable subject rows.

## Not done

- Not wired into Admin web app export code.
- Not committed/pushed.
- Data in the prototype is representative, not directly generated from live report rows.

## Next

1. User reviews the prototype PDF.
2. If approved, implement section-level aggregation in `src/AdminPanel.jsx`.
3. Add chart blocks to:
   - executive PDF institute pages
   - Centre PDF ZIP institute PDFs
4. Rebuild and visually test exported PDFs.
