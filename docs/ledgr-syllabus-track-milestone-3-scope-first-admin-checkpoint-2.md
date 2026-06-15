# Ledgr Syllabus Track: Scope-First Admin - Checkpoint 2

## Goal

Replace the template-first syllabus workflow with the approved real-world
sequence:

```text
Institutes -> Sections -> Subject -> Chapters and optional topics
```

One syllabus can be shared by several selected sections across several
institutes.

## Completed

### Control Centre Navigation

- Reorganized the desktop left rail into:
  - Overview: Dashboard and Ledgr Report
  - Institutes: collapsible institute list
  - Workspace: Teachers, Subject Catalog, Manage Institutes, and Admins
  - Support & recovery: Teacher Feedback and Recycle Bin
- Selecting an institute now exposes only:
  - Sections
  - Syllabus
- Teachers remain a workspace-wide management area.
- Renamed Official Subjects to Subject Catalog to clarify that it supplies the
  canonical subject vocabulary used by assignments, syllabus selection, and
  reporting.

### Scope-First Syllabus Workflow

- Added multi-select institute cards.
- Added multi-select section cards grouped under each chosen institute.
- Added subject selection after the scope is complete.
- Uses subjects common to every selected section when class mappings are
  available.
- Falls back to the active Subject Catalog when no complete common mapping can
  be established, so Admins are not blocked by incomplete legacy data.
- The existing chapter/topic editor remains available after selecting a
  subject.
- Existing syllabi are matched by subject and the exact selected scope.
- Draft and publish behavior remains intact.

### Firestore Compatibility

- Added a normalized syllabus scope:

```js
scope: [
  {
    instituteName: "Institute name",
    sectionNames: ["11th A", "11th B"]
  }
]
```

- New drafts and published versions persist the complete scope.
- Legacy `instituteName` and `sectionName` fields remain populated from the
  first scope item for older clients and existing documents.
- Existing single-section syllabus documents are normalized into the new scope
  shape when loaded.
- New template IDs include a stable scope hash.

## Verification

Passed on 2026-06-15:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

The local app loaded to the authentication screen without a new compile or
startup failure. Authenticated visual acceptance still needs to be completed
against the deployed Admin app.

## Live Acceptance

1. Open Control Centre on desktop.
2. Collapse and expand the Institutes group.
3. Confirm each selected institute exposes only Sections and Syllabus.
4. Open workspace-wide Teachers and Subject Catalog.
5. Open Syllabus and select multiple institutes.
6. Select one or more sections under each institute.
7. Confirm common subjects appear, or the catalog fallback notice appears for
   incomplete legacy mappings.
8. Select a subject, name the syllabus, and add chapters and optional topics.
9. Save the draft, reopen the exact scope, and publish a version.
10. Confirm Teacher Feedback and Recycle Bin open from the left rail.

## Next Development

- Complete authenticated visual acceptance using production-like Admin data.
- Add explicit section-to-subject mappings so subject availability no longer
  needs a legacy class-data fallback.
- Begin the Teacher Beta syllabus read view only after this Admin workflow is
  accepted.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Teacher Beta Android behavior was not changed.
- Existing syllabus documents remain readable.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
