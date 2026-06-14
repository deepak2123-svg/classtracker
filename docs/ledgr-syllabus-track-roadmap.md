# Ledgr Syllabus Track Roadmap

## Product Boundary

Ledgr Syllabus Track may change:

- the Admin web app;
- the native Teacher Ledgr Beta Android app.

It must not change the Teacher web app.

Existing free-text class subjects remain compatible until every active teacher
has been migrated to canonical subjects.

## Milestone 1: Subject Foundation

Status: implementation complete; live admin assignment acceptance remains.

### Deliverables

- Admin-owned canonical subject catalog.
- Stable subject IDs independent of display names.
- Teacher-to-subject assignment in Admin Manage Teachers.
- Versioned assignment metadata in `teachers/{uid}`.
- Native one-time acknowledgement after each assignment update.
- Native class creation restricted to assigned subject choices.
- Room persistence and migration for canonical assignment metadata.
- Legacy class subject strings remain readable and unchanged.

### Acceptance Gate

- Admin can import existing subject names and create official subjects.
- Admin can assign one or more official subjects to a teacher.
- The beta app displays the updated assignment once.
- Add Class offers only the assigned subjects.
- Existing classes, entries, reports, and Teacher web behavior remain intact.
- Offline restart retains the assignment version and subject choices.

## Milestone 2: Admin Syllabus Builder

Status: builder and quick-authoring checkpoints implemented; live acceptance remains.

- Draft and published syllabus versions.
- Admin-defined syllabus names.
- Institute, section, curriculum, academic year, grade, and subject scope.
- Fast ordered chapter and optional topic entry.
- Stable chapter/topic IDs across revisions.

## Milestone 3: Canonical Class Offerings

- Define an offering by academic year, institute, section, and subject ID.
- Map one or more teachers to an offering.
- Preserve teacher changes without losing class or entry history.
- Add migration reporting for unmatched legacy class subjects.

## Milestone 4: Teacher Syllabus View

- Add Syllabus to native bottom navigation.
- Read-only class and subject progress.
- Chapter/topic detail and linked teaching entries.
- Offline syllabus availability.

## Milestone 5: Entry Progress Tracking

- Select chapters and topics covered in an entry.
- Explicit chapter-completed action.
- Append-only progress events compatible with offline sync.
- Separate coverage from completion.

## Milestone 6: Admin Progress Dashboard

- Institute, section, subject, and teacher progress.
- Planned versus completed chapters.
- Delays, upcoming targets, and class comparisons.
- Exportable progress summaries.
