# Ledgr Syllabus Track: Quick Authoring - Checkpoint 2

## Goal

Make syllabus creation fast enough for real Admin use while preserving the
existing draft, publication, and immutable-version safeguards.

## Completed

### Named Syllabi

- New syllabi require an Admin-defined name.
- Existing templates remain readable and fall back to their previous scope
  label until they are named and saved.
- New template IDs include the syllabus name and exact institute-section
  scope, allowing separately named syllabi for the same official subject.

### Quick Chapter Entry

- Admin types a chapter name and presses Enter or Add.
- The input clears immediately so the next chapter can be entered.
- Chapter titles remain directly editable.
- Chapters can still be reordered and removed.

### Optional Topics

- Topics provide one optional level beneath each chapter.
- Admin types a topic and presses Enter or Add topic.
- Added topics appear as compact numbered labels and can be removed.
- Empty topics are never persisted.

### Removed Planning Fields

The builder and normalized Firestore payload no longer write:

- planned sessions;
- target dates;
- private admin notes.

Older documents containing these fields remain readable. Saving a revised
draft writes the simpler chapter-and-topic model.

## Firestore Shape

The collection paths are unchanged:

```text
syllabusTemplates/{templateId}
publishedSyllabi/{templateId}
syllabusTemplates/{templateId}/versions/{version}
```

The draft and published syllabus now include `name`. Chapters retain stable
IDs, titles, ordering, and optional ordered topics.

## Verification

Passed on 2026-06-14:

```powershell
npm run build
git diff --check
```

The local Admin shell loaded correctly. Authenticated builder interaction and
mobile-width visual acceptance still require a signed-in Admin session.

## Next Acceptance

1. Open `General Studies for NDA` in the live Admin app.
2. Select an institute and section.
3. Name the syllabus.
4. Add several chapters rapidly using Enter.
5. Add optional topics to at least one chapter.
6. Save the draft, reopen it, and confirm its name and order.
7. Publish version 1 and inspect the current and immutable Firestore records.

## Next Development

Continue Milestone 3 with canonical class offerings:

- define institute-section-subject offerings;
- map teachers to offerings;
- report unmatched legacy classes before migration;
- preserve all existing class and entry history.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Native Teacher Beta behavior was not changed.
- Existing entries and classes were not rewritten.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
