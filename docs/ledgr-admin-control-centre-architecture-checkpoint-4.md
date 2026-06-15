# Ledgr Admin: Control Centre Architecture - Checkpoint 4

## Goal

Make the Admin web app feel like one organized system:

- keep global tools at workspace level,
- keep institute-specific tools inside each institute,
- simplify the account menu,
- move the desktop rail to the true left edge,
- restore the Ledgr Report route.

## Completed

### Institute Workspaces

Each expanded institute now contains:

- Teachers
- Sections
- Syllabus
- Institute settings

Teachers opened from an institute are filtered to that institute. Institute
settings opened from an institute show only that institute instead of the
complete directory.

Workspace-wide tools remain available with explicit names:

- All Teachers
- Subject Catalog
- Institute Directory
- Admins

### Left Rail

- Moved the Control Centre rail flush to the left edge below the Admin header.
- Removed the floating-card placement around the rail.
- Made the rail use the available viewport height.
- Preserved institute filtering, collapsing, counts, and support tools.

### Admin Account Menu

- Replaced the oversized dark management drawer with a compact light account
  menu matching the current Control Centre visual system.
- Kept only account-level and global destinations:
  - workspace snapshot
  - Ledgr Report
  - Control Centre
  - Teacher Feedback
  - Recycle Bin
  - Sign Out
- Removed duplicated institute-management cards from the account menu.

### Ledgr Report

- Fixed the Control Centre report route.
- Opening Ledgr Report now exits the Control Centre render branch before
  showing the report page.
- Report loading and export behavior remain unchanged.

## Verification

Passed on 2026-06-15:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

The local app also reloaded to the authentication screen without a new startup
failure.

## Live Acceptance

1. Open the deployed Admin Control Centre on desktop.
2. Confirm the rail begins at the far-left edge.
3. Expand an institute.
4. Open Teachers and confirm only that institute's teachers appear.
5. Open Sections and Syllabus.
6. Open Institute settings and confirm only the selected institute appears.
7. Open All Teachers and Institute Directory from Workspace.
8. Open Ledgr Report from the rail and confirm the report page appears.
9. Open the Admin account menu and verify the compact organization.
10. Repeat the report action from the account menu.

## Next Development

- Complete authenticated visual acceptance on the deployed Admin app.
- Refine any rail widths or long institute labels found during acceptance.
- Continue the Teacher Beta syllabus read experience after Admin acceptance.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Teacher Beta Android behavior was not changed.
- Existing Admin data and Firestore shapes were not changed.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
