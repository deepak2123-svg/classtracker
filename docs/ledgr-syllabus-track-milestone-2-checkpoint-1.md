# Ledgr Syllabus Track: Admin Builder - Checkpoint 1

## Goal

Turn official subjects into safe, admin-owned syllabus templates without
changing the Teacher web app or prematurely exposing unfinished drafts.

## Completed

### Subject Workspace

- Every active official subject now has a `Build syllabus` action.
- The subject catalog shows template and published-template counts.
- A subject can hold multiple templates for different academic scopes.

### Template Scope

Each template records:

- academic year;
- curriculum or board;
- grade, course, or programme;
- canonical subject ID and display name.

The scope supports school classes as well as programmes such as NDA.

### Chapter Builder

- Add, remove, expand, and reorder chapters.
- Add and remove ordered topics.
- Record planned sessions.
- Record an optional target date.
- Record private admin notes.
- Stable chapter and topic IDs survive later revisions.

### Draft And Publish

- `Save draft` updates the private working copy.
- `Publish version` requires at least one chapter.
- Each publication increments the version number.
- Every published snapshot is written to an immutable version document.
- Later draft edits do not rewrite previous published versions.

### Affected-Class Preview

- The builder loads teacher data associated with the subject.
- It shows matching class, institute, and teacher counts.
- Matching class labels are displayed before publication.
- Matching currently uses the existing class subject text until canonical class
  offerings are introduced.

## Firestore Contract

Main template:

```text
syllabusTemplates/{templateId}
```

Current teacher-readable publication:

```text
publishedSyllabi/{templateId}
```

Immutable versions:

```text
syllabusTemplates/{templateId}/versions/{version}
```

Only admins may read drafts, admin notes, and version history. Signed-in
clients may read only `publishedSyllabi`. Only admins may write syllabus data,
and published version documents cannot be updated or deleted.

## Verification

Passed on 2026-06-14:

```powershell
npm run build

firebase deploy --only firestore:rules --project classtracker-84920
```

The Admin app shell was also opened through the local admin-mode Vite server.
The unauthenticated login screen loaded successfully. Authenticated builder
interaction still requires live admin acceptance.

The updated Firestore rules compiled and were released successfully to
`classtracker-84920`.

## Not Yet Performed

- Create and publish a disposable syllabus in the live Admin app.
- Confirm the immutable version document in Firestore.
- Confirm a second publication creates version 2 without changing version 1.
- Validate the builder at mobile width while signed in.
- Connect published syllabi to canonical institute/section class offerings.
- Expose the published syllabus in the native Teacher Beta app.

## Next Checkpoint

1. Live acceptance using `General Studies for NDA`.
2. Add its academic year, curriculum, programme, chapters, and topics.
3. Save the draft and confirm it is not visible as published.
4. Publish version 1 and inspect Firestore.
5. Continue with Milestone 3 canonical class offerings.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Native Teacher Beta behavior was not changed in this checkpoint.
- Existing classes and entries were not migrated or rewritten.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.

## Release State

- Firestore rules deployed.
- Checkpoint source committed and pushed to GitHub.
- Admin web hosting remains managed by the existing GitHub-connected release
  process; no direct Vercel deployment was performed.
