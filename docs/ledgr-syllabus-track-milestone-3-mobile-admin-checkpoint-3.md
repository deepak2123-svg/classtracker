# Ledgr Syllabus Track: Mobile Admin - Checkpoint 3

## Goal

Make the Admin web app comfortable and efficient on phones while preserving
the accepted desktop Control Centre and scope-first syllabus workflow.

## Completed

### Mobile Control Centre

- Replaced the large management-card grid with a compact sticky tool strip.
- The tool strip is horizontally swipeable and keeps the active area visible.
- Added direct access to all six Admin tools:
  - Teachers
  - Syllabus
  - Sections
  - Subject Catalog
  - Institutes
  - Admins
- Reordered the tools around the most common Admin workflow.
- Increased bottom spacing so content remains clear of mobile navigation and
  device safe areas.

### Mobile Profile Navigation

- Expanded Manage the workspace from four zones to six tools.
- Added direct Syllabus and Subject Catalog destinations.
- Shortened supporting labels for faster scanning on a phone.

### Mobile Syllabus Workflow

- Reduced institute and section selection-card height without shrinking touch
  targets below a comfortable size.
- Added Select all and Clear all actions for each institute's sections.
- Stacked chapter and optional-topic controls on narrow screens.
- Made Save draft and Publish version full-width mobile actions.
- Preserved the approved workflow:

```text
Institutes -> Sections -> Subject -> Chapters and optional topics
```

## Verification

Passed on 2026-06-15:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

The local web app was also smoke-tested at a 390 x 844 viewport. It loaded the
authentication screen without overflow, startup failure, or new console-blocking
errors.

## Live Acceptance

Authenticated acceptance remains:

1. Open the deployed Admin app on a phone.
2. Open Control Centre and swipe through the sticky tool strip.
3. Confirm all six tools open directly and the active tool remains clear.
4. Open Syllabus and select multiple institutes.
5. Use Select all and Clear all for sections.
6. Choose a subject, add chapters and optional topics.
7. Confirm Save draft and Publish version are easy to reach and use.
8. Check that long institute, section, and subject names remain readable.
9. Repeat the workflow in both portrait and landscape orientation.

## Next Development

- Complete signed-in mobile acceptance against deployed Admin data.
- Refine any device-specific spacing discovered during acceptance.
- After Admin acceptance, begin the Teacher Beta syllabus read view.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Teacher Beta Android behavior was not changed.
- Desktop Admin navigation and syllabus behavior remain available.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
