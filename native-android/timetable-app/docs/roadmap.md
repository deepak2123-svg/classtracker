# Ledgr Timetable App — product spec &amp; build roadmap

This document is the source of truth for building the Ledgr Timetable App
as a native Android app.
It exists so a coding agent (or a human) can start building without having to
guess at product decisions — every decision below was deliberately made, not
assumed. Section 2 shows the reasoning trail; sections 3 onward are the actual
spec to build against.

## 1. Core concept, in one paragraph

Ledgr helps a school, college, or coaching institute build a timetable without
being overwhelmed — a step-by-step wizard instead of one big spreadsheet. The
fundamental unit is **one day's schedule**: which subject, which teacher, in
which time slot, for which section. There is no separate "weekly" data shape —
"daily / weekly / monthly / yearly" is just how long a built schedule is
considered valid before someone needs to revisit it. Teachers and sections
belong to the institute and are reused everywhere; everything else belongs to
the specific timetable being built. The app is local-first (works with no
internet, no account) but built so a sync layer can be added later without a
rewrite. Assignment is manual (drag a teacher onto a slot), with the app
flagging conflicts — no automatic solver in v1.

## 2. Decisions log (why the spec looks like this)

| # | Question | Decision |
|---|---|---|
| 1 | What does daily/weekly/monthly/yearly mean? | They're the *same* schedule shape. The difference is purely how long it stays valid before rebuilding — not a different data structure. |
| 2 | Can an institute run two timetables of the same type at once? | No — exactly one **active** timetable per institute at a time. Rebuilding supersedes the old one, which moves into history. |
| 3 | Do teachers/sections belong to the institute or to each timetable? | Institute. One shared roster, reused by every timetable that institute ever builds. |
| 4 | Are time slots (period start/end times) shared too? | No — independent. Redefined per timetable build (they're quick to set and can legitimately change). |
| 5 | Does the schedule vary by weekday within one build? | No. One build = one day's pattern. If Monday needs to differ from Tuesday, that's two separate timetable builds, not one build with six days in it. |
| 6 | Are Monthly/Yearly their own wizard? | No — purely a "valid until" label attached at save time (tomorrow / this week / this month / this year). No separate flow. |
| 7 | What's "old timetables" (originally called Archives) for? | Every previously-active timetable for an institute, kept automatically, viewable read-only, duplicable as a starting point for a new one, and — eventually — comparable side by side. |
| 8 | How automated is the assignment step? | Fully manual (drag-and-drop, as in the mockups). The app only flags conflicts (double-booked teacher, double-booked section) — it does not auto-resolve them. |
| 9 | How often is a new timetable built? | Often — potentially daily. Needs a fast "duplicate from the last one" shortcut so rebuilding isn't a full wizard pass every time. |
| 10 | Local-only or sync-ready? | Local-first (Room database, fully offline), but schema designed so a sync layer can be bolted on later without migration pain. |
| 11 | What ships first? | There's only one flow to ship — see #1 and #6. There's no "daily vs weekly MVP" choice to make. |
| 12 | Do off-days exist for hour/class counting? | Yes, fixed: Sunday is off, every other day (including Saturday) counts. No per-institute customization in v1. |
| 13 | What did "simplify the wizard" actually mean? | Not fewer screens — ease of the core task itself: pairing a teacher to a class faster and with less repetition. Addressed in Section 9, not by cutting steps. |
| 14 | Where does this app live in the monorepo? | native-android/timetable-app, package com.ledgr.timetable — independent build for now, intentionally positioned to merge into the LedgrNative workspace later. A prior auto-generator-based attempt at this path (commits e3fd36b, 7d68d77) was deleted, since it conflicted with the manual-assignment decision in this spec — recoverable via those commit hashes if ever needed. |

## 3. Data model

```
Institute
  id            UUID
  name          String
  createdAt     Instant

Teacher
  id            UUID
  instituteId   UUID   -> Institute
  name          String

Section
  id            UUID
  instituteId   UUID   -> Institute
  name          String

Timetable
  id                UUID
  instituteId       UUID   -> Institute
  createdAt         Instant
  supersededAt      Instant?                    (set when a newer timetable replaces it — the end
                                                   boundary used for report date-range math)
  validUntil        Enum(TOMORROW, END_OF_WEEK, END_OF_MONTH, END_OF_YEAR) | Date
  status            Enum(ACTIVE, SUPERSEDED)
  duplicatedFromId  UUID?  -> Timetable   (nullable, set when built via "duplicate from previous")

TimeSlot
  id            UUID
  timetableId   UUID   -> Timetable
  startTime     Time
  endTime       Time
  type          Enum(CLASS, BREAK)
  sortOrder     Int

Assignment                          (one filled cell in the grid)
  id            UUID
  timetableId   UUID   -> Timetable
  slotId        UUID   -> TimeSlot
  sectionId     UUID   -> Section
  subjectName   String
  teacherId     UUID   -> Teacher

TeacherUnavailability
  id            UUID
  timetableId   UUID   -> Timetable
  teacherId     UUID   -> Teacher
  slotId        UUID   -> TimeSlot

SubjectTeacherDefault               (institute-level pairing template — see Section 9)
  id            UUID
  instituteId   UUID   -> Institute
  subjectName   String
  teacherId     UUID   -> Teacher
  sectionId     UUID?  -> Section    (nullable = applies to this subject in any section)
```

Notes:
- **History is not a separate table.** It's just every `Timetable` row with
  `status = SUPERSEDED` for that institute, ordered by `createdAt` descending.
  Building and saving a new active timetable is the only thing that changes
  an old one's status, and is also what sets `supersededAt`.
- Every table uses a UUID primary key and carries `createdAt` — this is
  what makes a future sync layer bolt-on rather than a migration.
- A conflict (same teacher or same section assigned twice in the same slot)
  is *computed*, not stored — check it at save time and on every edit, don't
  persist a conflicts table.
- **Reporting math**: for any date range, find every `Timetable` whose
  `[createdAt, supersededAt or now]` window overlaps the range, count the
  overlapping calendar days *excluding Sundays*, and multiply each of that
  timetable's `Assignment` rows by that day count. Sum across timetables to
  get totals per subject/teacher/section.

## 4. Screens &amp; flow (maps to the existing mockups)

1. **Home** — list of institutes. Tapping one opens its current active
   timetable (or the wizard, if none exists yet).
2. **Institute roster settings** — manage the shared Teachers list and
   Sections list. Reached from institute detail, not repeated inside the
   wizard every time.
3. **Build wizard** (shortened from the original 7 steps, now that roster is
   shared):
   - **Time slots** — define today's periods.
   - **Assign** — drag-and-drop teachers onto subject/section slots, with
     live conflict flags. If a teacher or section doesn't exist yet, add it
     inline (which writes back to the shared roster).
   - **Availability** — mark any teacher as unavailable for specific slots.
   - **Review &amp; save** — shows a conflict summary (if any) and a validity
     picker (tomorrow / this week / this month / this year) before saving.
     Saving flips any previous active timetable to `SUPERSEDED`.
4. **Timetable view** — the result screen from the mockups (day context,
   list of periods, tap to quick-edit in a bottom sheet).
5. **History** ("old timetables", not "archives") — every superseded
   timetable for this institute. Each entry: view read-only, or
   "Duplicate as new" to jump into the wizard pre-filled from it.
6. **Duplicate-from-previous shortcut** — a single button (from Home or the
   timetable view) that clones the current/most recent timetable's slots
   and assignments straight into the wizard's Assign step, so a daily rebuild
   is a quick edit, not a fresh build.

## 5. Technical architecture

- **Language/UI**: Kotlin + Jetpack Compose, Material 3 Expressive theming
  (the tonal color system and shapes already established in the mockups).
- **Local storage**: Room. Repository layer sits between Room and the
  ViewModels so a future remote data source can be swapped in without
  touching UI code.
- **Drag-and-drop**: Compose's `dragAndDropSource` / `dragAndDropTarget`
  modifiers (or a pointer-based custom implementation if finer control over
  the drop-hover highlight is needed — the web mockup's pointer-event
  approach translates directly).
- **State/navigation**: standard MVVM, one ViewModel per wizard flow,
  Navigation-Compose for the screen graph.
- **Sync-readiness**: no network code in v1, but every entity's shape
  (UUIDs, timestamps) is chosen so a sync layer is additive later.

## 6. Build phases

**Phase 0 — Foundations**
Project setup, Room schema from Section 3, navigation graph skeleton,
Material 3 Expressive theme (colors/shapes/type from the mockups).

**Phase 1 — Institutes &amp; roster**
Home screen (create/select institute), roster settings screen (add/remove
teachers and sections).

**Phase 2 — Wizard core loop**
Time slots step, drag-and-drop Assign step with live conflict detection,
Availability step, Review &amp; Save step (with validity picker). Ends with a
working save that produces one `ACTIVE` `Timetable`.

**Phase 3 — History &amp; the duplicate shortcut**
History screen (list of `SUPERSEDED` timetables, read-only viewer),
duplicate-as-new-draft action, and the fast "duplicate from previous"
shortcut from Home/timetable view.

**Phase 4 — Result view &amp; polish**
Full timetable viewer with bottom-sheet quick-edit, empty states, conflict
banner detail.

**Phase 5 — Reporting &amp; export**
Subject load and teacher load reports (ranked list + raw table first, chart
view after), grid PDF/PNG export, per-teacher export, report CSV export.

**Phase 6 — Pairing-ease upgrades**
`SubjectTeacherDefault` templates, subject-match sorting in the teacher
pool, bulk-assign across sections, contextual availability at drag time.

**Phase 7 — Stretch (post-v1)**
Cloud sync (activating the dormant sync-readiness in the schema), an
optional smart auto-generate/solver layered on top of manual assignment,
side-by-side history comparison.

## 7. Reporting &amp; analytics

A "Reports" tab per institute, filterable by a date range (this week / this
month / custom range). Three views, computed with the date-range math from
Section 3:

- **Subject load** — total classes and total hours per subject across the
  range. Default view: ranked list, highest first. Secondary view: bar
  chart. Both read from the same underlying table, which is also the CSV
  export.
- **Teacher load** — total classes/hours per teacher, and a breakdown per
  teacher *per section* (so "Mr. Rao: 8h Grade 6, 3h Grade 7" is visible,
  not just a single number).
- **Unfilled slots** — periods with no `Assignment` at all across the
  range, a quick way to spot under-staffing.

Build order: the ranked list and the raw table first (they're the same
query, two renderings) — charts are a visual layer on top, not a separate
data path, so they can slot in after the list view already works.

## 8. Export &amp; sharing

- **Grid export** — the full timetable as PDF or a shareable PNG, for
  printing or sending to a staff group.
- **Per-teacher export** — a teacher's own schedule only, not the whole
  grid. Small feature, high value: a teacher shouldn't have to read the
  entire institute's timetable to find their own periods.
- **Report export** — CSV of whatever date range is currently open in the
  Reports tab, for anyone who wants their own pivot table.

## 9. Making the actual pairing easier

This was the real ask behind "simplify the wizard" — not fewer screens, but
less repetitive work in the Assign step itself. In priority order:

1. **Subject–teacher default templates** (`SubjectTeacherDefault` in the
   data model). Once you've told the app "Math is Mr. Rao," every new
   timetable starts with that pairing pre-filled — building becomes
   reviewing and adjusting exceptions, not assigning from a blank grid
   every time. This is the single highest-leverage change here.
2. **Filter the teacher pool by subject match.** When a slot is tagged
   "Mathematics," teachers already associated with Mathematics (via their
   defaults or recent history) sort to the top of the drag pool instead of
   the whole staff list being flat and alphabetical.
3. **Bulk-assign across sections.** "Mr. Rao teaches Math to all of Grade
   6" as one action, instead of dragging into Grade 6-A and Grade 6-B
   separately when the pairing is identical.
4. **Availability shown at drag time, not declared up front.** A teacher
   marked unavailable for a slot just appears dimmed/undraggable for that
   slot in the pool, rather than needing a dedicated screen filled out
   before assignment even starts.

Items 1–3 do most of the work; item 4 is what actually removes a step,
naturally, as a side effect of being contextual instead of upfront.

## 10. Explicit non-goals for v1

- No automatic constraint-solving generator — manual assignment with
  conflict flags only.
- No per-weekday variation inside a single timetable build.
- No accounts, login, or active sync — schema is ready, feature is dormant.
- No separate Monthly/Yearly wizard — it's a label on Weekly, nothing more.
- No custom off-day patterns — Sunday is off, fixed, for v1 reporting.

## 11. Open items to revisit later (not blockers)

- Whether "duplicate from previous" should carry over teacher
  unavailability marks or reset them each time.
- Side-by-side history comparison (mentioned as wanted "eventually").
- Whether `SubjectTeacherDefault` should be editable mid-build or only
  managed from institute settings.
