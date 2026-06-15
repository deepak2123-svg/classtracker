# Ledgr Admin Report Route Hotfix - Checkpoint 6

Date: 2026-06-15

## Completed

- Fixed the Control Centre `Ledgr Report` action.
- Desktop report opening no longer depends on switching from the management view to the main view.
- The Control Centre now renders the report directly when its report state is active.
- Existing report loading, PDF/export options, scheduling controls, toast feedback, and back navigation are preserved.
- Mobile report navigation remains unchanged.

## Verified

- `npm run build`
- Local production preview loads without browser console errors.
- `git diff --check`

## Next

1. Verify the deployed authenticated Admin app:
   - Open Control Centre.
   - Select `Ledgr Report`.
   - Confirm the report page opens.
   - Confirm `Back to admin` returns to the Control Centre.
   - Confirm report options and PDF generation still work.
2. Continue the class-bound syllabus flow:
   - Derive selectable subjects from existing teacher classes in the chosen institute/section scope.
   - Remove the remaining catalog-first syllabus selection path.
   - Show the published syllabus only to teachers whose existing class matches institute, section, and subject.

## Protected Worktree Items

- Do not touch `outputs/`.
- Do not touch `temp_excerpt.txt`.
