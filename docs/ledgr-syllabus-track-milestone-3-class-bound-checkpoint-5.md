# Ledgr Syllabus Track: Class-Bound Workflow - Checkpoint 5

## Goal

Replace the Subject Catalog-first syllabus workflow with a workflow based on
the classes teachers have already created.

## Completed

### New Admin Workflow

The syllabus flow is now:

1. Select one or more institutes.
2. Select one or more configured sections.
3. Select a subject already used by a teacher class in those sections.
4. Review the automatically matched teachers and classes.
5. Add chapters and optional topics.
6. Save a draft or publish.

The subject list no longer falls back to the Subject Catalog. A subject is
shown only when a real teacher class in the selected scope uses it.

### Automatic Binding

Each saved and published syllabus now stores target records containing:

- teacher UID and display name;
- class ID and class name;
- institute;
- section;
- subject.

This makes the teacher, class, subject, and syllabus relationship explicit and
auditable.

### Simplification

- Removed Subject Catalog entry points from desktop and mobile Control Centre
  navigation.
- Removed the requirement to manually name a new syllabus. New syllabi receive
  a clear subject-based name automatically.
- Added a matching-teachers-and-classes summary above the chapter builder.
- Added permanent syllabus deletion from the builder.

### Existing Test Data

The existing `syllabusTemplates` and `publishedSyllabi` collections were
cleared on 2026-06-15 before testing the new workflow.

### Firestore

- Draft and published syllabus records now include normalized `targets`.
- Admins may delete immutable syllabus version documents when permanently
  deleting a syllabus.
- Existing class, entry, teacher, and institute data were not deleted.

## Verification

Passed:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
firebase deploy --only firestore:rules --project classtracker-84920
```

The Firebase CLI successfully removed the old syllabus template and published
syllabus collections.

## Live Acceptance

1. Open Admin Control Centre.
2. Expand an institute and open Syllabus.
3. Select an institute and section with existing teacher classes.
4. Confirm only subjects already used by those classes are shown.
5. Select a subject.
6. Confirm the matching teacher and class cards are correct.
7. Add chapters and optional topics.
8. Save a draft and reopen it.
9. Publish version 1.
10. Confirm the published Firestore record includes the expected targets.
11. Delete the disposable syllabus and confirm its draft, published copy, and
    version history are removed.

## Next Development

- Perform authenticated Admin acceptance on desktop and mobile.
- Add the Teacher Beta syllabus read model using the published target records.
- Add chapter/topic progress updates from Add Entry after the read model is
  accepted.

## Safety Boundary

- The Teacher web app in `src/ClassTracker.jsx` was not changed.
- Teacher Beta Android behavior was not changed.
- Existing classes, entries, teachers, institutes, and sections were preserved.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
