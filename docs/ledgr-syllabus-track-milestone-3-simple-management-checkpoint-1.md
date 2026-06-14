# Ledgr Syllabus Track: Simple Management - Checkpoint 1

## Goal

Make the Admin control centre institute-first and make syllabus creation follow
the same real-world path an Admin already understands.

## Completed

### Institute-First Control Centre

- Desktop management now uses a persistent left sidebar.
- Institutes are the primary navigation.
- Selecting an institute reveals:
  - Teachers
  - Sections
  - Syllabus
- Teacher counts remain visible beside institute names.
- Official subjects, institute administration, and Admin accounts remain
  separate workspace tools below the institute list.
- The previous wide tab strip is retained only for the mobile layout.

### Simple Syllabus Flow

The visible workflow is now:

```text
Institute -> Section -> Subject -> Syllabus name -> Chapters -> Topics
```

- Opening Syllabus from an institute skips the redundant institute selector.
- Sections are grouped using the existing Admin-defined section groups.
- Official subjects appear only after a section is selected.
- Existing published status is shown beside matching subjects.
- The builder receives the selected institute, section, and subject directly.
- Academic year remains automatic.
- Technical curriculum and grade metadata are filled underneath for new
  syllabi instead of adding another visible form step.
- Draft saving and immutable published versions remain unchanged.

### Deliberately Excluded

- No Offerings page or offering terminology.
- No separate teacher-mapping workflow for syllabus creation.
- No migration report in the normal Admin workflow.
- No changes to the Teacher web app.

## Verification

Passed on 2026-06-14:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

The local Admin login shell loaded without browser console errors. Full
authenticated visual and interaction acceptance still requires a working
Admin deployment or an authenticated local Admin browser session.

## Live Acceptance

1. Open Control Centre on desktop.
2. Select an institute from the left sidebar.
3. Open Teachers and confirm the institute group is focused.
4. Open Sections and confirm the selected institute opens directly.
5. Open Syllabus.
6. Select a section, then an official subject.
7. Name the syllabus and rapidly add chapters and optional topics.
8. Save, reopen, publish, and confirm the version remains available.
9. Repeat at a phone-width viewport.

## Next Development

- Complete authenticated acceptance and visual polish from real data.
- Decide whether multi-institute syllabus copying is needed as a later explicit
  action, rather than exposing it in the primary creation flow.
- Begin Milestone 4 Teacher Syllabus View only after this Admin flow is
  accepted.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Native Teacher Beta behavior was not changed.
- Existing syllabus documents and published versions remain compatible.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
