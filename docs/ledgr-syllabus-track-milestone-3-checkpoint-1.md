# Ledgr Syllabus Track: Canonical Class Offerings - Checkpoint 1

## Goal

Introduce Admin-owned class offerings that connect an academic year,
institute, section, official subject, teachers, and an optional published
syllabus without rewriting existing classes or teaching entries.

## Completed

### Canonical Offerings

- Added deterministic offering IDs for academic year, institute, section, and
  official subject.
- Offering scope becomes immutable after creation.
- Offerings can be archived and restored without deleting history.
- A published syllabus can be linked only when its scope matches the offering.

### Teacher Mapping History

- One or more eligible teachers can be mapped to an offering.
- Teacher choices are limited to teachers assigned the official subject.
- Every offering starts with assignment history version 1.
- Later teacher changes append immutable assignment-history versions.
- Existing teacher classes and entries are never reassigned or rewritten.

### Admin Control Centre

- Added an `Offerings` tab.
- Admin can create, inspect, edit mappings, archive, and restore offerings.
- Offering rows show scope, teachers, status, and linked syllabus.
- Added a read-only legacy readiness report showing matched and unmatched
  existing classes with reasons for unmatched records.

## Firestore Shape

```text
classOfferings/{offeringId}
  academicYear
  instituteName
  sectionName
  subjectId
  subjectName
  teacherUids[]
  syllabusTemplateId
  syllabusVersion
  active
  assignmentVersion
  createdAt / createdBy
  updatedAt / updatedBy

classOfferings/{offeringId}/assignmentHistory/{version}
  offeringId
  version
  previousTeacherUids[]
  teacherUids[]
  changedAt
  changedBy
```

Only signed-in users may read offerings. Only Admin users may write offerings.
Assignment-history documents can be created by Admin users but cannot be
updated or deleted.

## Verification

Passed on 2026-06-14:

```powershell
npm run build
git diff --check
git diff --exit-code -- src/ClassTracker.jsx
```

The local Admin-mode login shell also loaded successfully at
`http://127.0.0.1:4174`.

Authenticated named-syllabus publishing and offering acceptance could not be
completed because `https://ctadmin.vercel.app/` currently returns a deployment
not found response.

## Live Acceptance

1. Restore or replace the Admin deployment.
2. Create and publish a named syllabus for an institute and section.
3. Create an offering with the same year, institute, section, and subject.
4. Link the published syllabus and map one or more eligible teachers.
5. Change the teacher mapping and confirm a new assignment-history version.
6. Confirm the legacy report identifies matching and unmatched classes.
7. Deploy the updated Firestore rules before production offering writes.

## Next Development

Continue Milestone 3 acceptance and migration preparation:

- restore the authenticated Admin deployment;
- validate real production institute, section, subject, and teacher data;
- review unmatched legacy classes before any migration;
- define the native read model for Milestone 4 Teacher Syllabus View.

## Safety Boundary

- `src/ClassTracker.jsx` and the Teacher web app were not changed.
- Native Teacher Beta behavior was not changed.
- Existing classes, entries, and reports were not rewritten.
- Root `outputs/` and `temp_excerpt.txt` remain untouched.
