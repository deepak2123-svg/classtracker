# Ledgr Timetable App — build plan (ticket-level)

Read `AGENTS.md` for how to work. Read `ledgr-timetable-app-roadmap.md` for the
full product spec and reasoning. This document is the *what, in order* —
every phase from the roadmap broken into small tickets, each one small
enough to build and verify in one sitting.

Each ticket has: **Depends on**, **Build**, **Acceptance criteria**, and
**Done means**. If any of those four things is unclear for a ticket you're
about to start, that's a stop-and-ask moment per AGENTS.md §1 — not a
guess-and-continue moment.

---

## Bucket 0 — Foundations

### T0.1 Project scaffold
- **Depends on**: nothing.
- **Build**: Kotlin + Jetpack Compose project, package structure
  (`data`, `ui`, `domain` or similar), Gradle set up for Room and
  Navigation-Compose.
- **Acceptance criteria**: project builds and launches to a blank screen
  on an emulator.
- **Done means**: builds clean, runs, blank screen visible.

### T0.2 Room database and entities
- **Depends on**: T0.1.
- **Build**: every entity from roadmap Section 3 (`Institute`, `Teacher`,
  `Section`, `Timetable`, `TimeSlot`, `Assignment`,
  `TeacherUnavailability`, `SubjectTeacherDefault`), with the exact fields
  listed there — including `supersededAt` and `duplicatedFromId`.
- **Acceptance criteria**: a smoke test inserts one row into every table
  and reads it back correctly, including foreign key relations.
- **Done means**: smoke test passes; run it, don't just read the DAO code.

### T0.3 Navigation skeleton
- **Depends on**: T0.1.
- **Build**: empty composables for every screen named in roadmap
  Section 4, wired into a Navigation-Compose graph with placeholder
  buttons to move between them.
- **Acceptance criteria**: every screen is reachable by tapping through
  from Home; no dead ends.
- **Done means**: manually navigated through every screen once.

### T0.4 Material 3 Expressive theme
- **Depends on**: T0.1.
- **Build**: color scheme, shape tokens (large rounded corners, pill
  buttons), and type scale matching the HTML mockups
  (`ledgr-timetable-app-mockups.html` — same tonal palette, same corner radii).
- **Acceptance criteria**: a themed sample screen (buttons, cards, chips)
  visually matches the mockup's look.
- **Done means**: side-by-side visual check against the mockup file.

---

## Bucket 1 — Institutes &amp; roster

### T1.1 Home screen — list &amp; create institutes
- **Depends on**: T0.2, T0.3.
- **Build**: list of `Institute` rows; "create new institute" flow
  (name input, minimum).
- **Acceptance criteria**: creating an institute persists it; relaunching
  the app still shows it (Room persistence, not in-memory state).
- **Done means**: kill and relaunch the app, institute still there.

### T1.2 Roster settings — teachers
- **Depends on**: T1.1.
- **Build**: add/edit/remove `Teacher` rows scoped to one institute.
- **Acceptance criteria**: teachers added here are what later populates
  the Assign step's teacher pool (T2.2) — verify the query, don't assume.
- **Done means**: add a teacher, confirm it's queryable by `instituteId`.

### T1.3 Roster settings — sections
- **Depends on**: T1.1.
- **Build**: same as T1.2, for `Section`.
- **Acceptance criteria**: same pattern as T1.2.
- **Done means**: same pattern as T1.2.

---

## Bucket 2 — Wizard core loop

This bucket produces one working end-to-end path: build a timetable, save
it, see it. Nothing in Buckets 3+ can be tested without this bucket done.

### T2.1 Time slots step
- **Depends on**: T1.1.
- **Build**: CRUD list of `TimeSlot` rows for a draft `Timetable` (not yet
  saved as `ACTIVE`). Reorderable. Prefill: if this institute has any
  prior `Timetable`, copy its slots in as the starting point, editable
  from there — per roadmap Section 9 item 1's spirit (start pre-filled,
  not blank).
- **Acceptance criteria**: slots can be added, edited, reordered, deleted;
  prefill works when a prior timetable exists, and shows a genuinely
  empty list (not a crash) when it's the institute's first timetable.
- **Done means**: tested both the "first ever timetable" and "has a
  prior one" cases.

### T2.2 Assign step — drag and drop
- **Depends on**: T2.1, T1.2, T1.3.
- **Build**: teacher pool (draggable chips) + grid of subject/section
  slots (drop targets), matching the interaction already proven out in
  `ledgr-timetable-app-mockups.html`. Conflict detection: **write this as a
  pure function first** (`fun findConflicts(assignments: List<Assignment>): List<Conflict>`)
  with unit tests covering — same teacher in the same slot twice, same
  section in the same slot twice, no conflict when everything's unique —
  *before* wiring it into the UI.
- **Acceptance criteria**: dropping a teacher on a slot creates/updates
  an `Assignment`; conflicting drops are visually flagged, not silently
  allowed or silently blocked.
- **Done means**: conflict unit tests pass, then manually verified in the
  actual drag-and-drop UI.

### T2.3 Availability step
- **Depends on**: T2.1.
- **Build**: CRUD for `TeacherUnavailability` scoped to the draft
  timetable — mark a teacher unavailable for specific slots.
- **Acceptance criteria**: marking a teacher unavailable for a slot is
  visible back in T2.2's pool (dimmed/blocked) if this ticket lands after
  T2.2 — if built before, at minimum persist correctly and surface a
  warning if an existing `Assignment` already violates it.
- **Done means**: unavailability persists and is queryable per slot.

### T2.4 Review &amp; save step
- **Depends on**: T2.2, T2.3.
- **Build**: conflict summary (reads T2.2's `findConflicts`), validity
  picker (tomorrow / this week / this month / this year), and the save
  transaction: set this draft's `status = ACTIVE`, and — if an active
  timetable already existed for this institute — set its `status =
  SUPERSEDED` and `supersededAt = now` in the *same* transaction.
- **Acceptance criteria**: after saving, there is exactly one `ACTIVE`
  timetable per institute, ever — write a test that saves twice and
  asserts the first one is now `SUPERSEDED` with a `supersededAt` set.
- **Done means**: that test passes, plus a manual save-twice check.

---

## Bucket 3 — History &amp; the duplicate shortcut

### T3.1 History screen
- **Depends on**: T2.4 (needs at least one superseded timetable to show).
- **Build**: list of `SUPERSEDED` timetables for an institute, newest
  first.
- **Acceptance criteria**: matches roadmap Section 4 item 5 — read-only
  entry point into T3.2.
- **Done means**: after two saves (T2.4's test scenario), the first one
  appears here.

### T3.2 Read-only timetable viewer
- **Depends on**: T3.1.
- **Build**: same visual component as the active timetable view (Bucket
  4) but non-editable, fed a `SUPERSEDED` timetable's ID.
- **Acceptance criteria**: no edit affordances rendered at all — not
  disabled buttons, actually absent.
- **Done means**: visually confirmed no edit controls appear.

### T3.3 Duplicate-as-new-draft
- **Depends on**: T3.1, T2.1.
- **Build**: cloning action that copies a chosen timetable's `TimeSlot`
  and `Assignment` rows into a brand-new draft, sets
  `duplicatedFromId` on the new one, and drops the user into T2.2 (Assign)
  to tweak from there — not back at an empty T2.1.
- **Acceptance criteria**: the clone is a genuine copy (new IDs, not
  shared rows) — editing the clone must never mutate the original.
- **Done means**: edited the clone, confirmed the original (still visible
  in History) is unchanged.

### T3.4 "Duplicate from previous" shortcut on Home
- **Depends on**: T3.3.
- **Build**: a single button from Home (or the active timetable view)
  that runs T3.3 against the institute's most recent timetable (active
  or superseded, whichever is latest) with one tap — this is the fast
  path referenced in roadmap decision #9.
- **Acceptance criteria**: fewer taps than going Home → wizard → History
  → pick → duplicate manually.
- **Done means**: timed both paths, shortcut is meaningfully faster.

---

## Bucket 4 — Result view &amp; polish

### T4.1 Active timetable viewer
- **Depends on**: T2.4.
- **Build**: the day/period list view from the mockups — periods in
  order, subject/teacher/section per row.
- **Acceptance criteria**: matches `ledgr-timetable-app-mockups.html`'s Step 7
  panel visually and structurally.
- **Done means**: visual side-by-side against the mockup.

### T4.2 Bottom-sheet quick-edit
- **Depends on**: T4.1.
- **Build**: tapping a period opens a bottom sheet to edit that single
  `Assignment` post-save. **Must re-run conflict detection** (T2.2's pure
  function) on save from this sheet — editing after the fact is exactly
  where a silent conflict could sneak back in.
- **Acceptance criteria**: a conflict introduced via quick-edit is
  flagged the same way it would be during the original Assign step.
- **Done means**: deliberately created a conflict this way and confirmed
  it's caught.

### T4.3 Empty states
- **Depends on**: everything above.
- **Build**: explicit empty-state UI for: institute with no timetable
  yet, institute with no teachers/sections yet, History with nothing in
  it.
- **Acceptance criteria**: none of these states show a blank/broken
  screen — each has a message and a next action.
- **Done means**: triggered each empty state manually and checked it.

---

## Bucket 5 — Reporting

### T5.1 Date-range picker
- **Depends on**: T0.3.
- **Build**: reusable component — this week / this month / custom range.
- **Acceptance criteria**: "custom range" allows any start/end date pair.
- **Done means**: standalone, testable without the report screens.

### T5.2 Reporting query engine
- **Depends on**: T2.4, T5.1.
- **Build**: **as a pure function first**, per AGENTS.md §3. Implements
  the exact math in roadmap Section 3's reporting note: for a date range,
  find every `Timetable` whose `[createdAt, supersededAt ?: now]` window
  overlaps the range, count overlapping calendar days *excluding
  Sundays*, multiply each of that timetable's `Assignment` rows by that
  day count, sum across timetables and group by subject/teacher/section
  as needed.
- **Acceptance criteria**: unit tests covering — a range fully inside one
  timetable's window; a range spanning two timetables (one superseded
  mid-range); a range containing a Sunday (must be excluded from the
  count); a range with zero matching timetables (must return empty, not
  crash).
- **Done means**: all four test cases pass before any UI is built on top
  of this.

### T5.3 Subject load report
- **Depends on**: T5.2.
- **Build**: ranked list (highest total first) + raw table, per roadmap
  Section 7.
- **Acceptance criteria**: list and table are two renderings of the same
  query result, not two separate queries.
- **Done means**: confirmed both views agree on the same numbers.

### T5.4 Teacher load report
- **Depends on**: T5.2.
- **Build**: per-teacher totals, plus the per-teacher-per-section
  breakdown called out explicitly in roadmap Section 7.
- **Acceptance criteria**: a teacher assigned to two sections shows a
  correct split, not just a combined total.
- **Done means**: verified against a manually-constructed two-section
  test case.

### T5.5 Unfilled-slots report
- **Depends on**: T5.2.
- **Build**: periods with no `Assignment` across the range.
- **Acceptance criteria**: correctly distinguishes "no assignment" from
  "assignment exists but teacher was marked unavailable" — these are
  different things, don't conflate them.
- **Done means**: both cases tested distinctly.

---

## Bucket 6 — Export &amp; sharing

### T6.1 Grid export — PDF
- **Depends on**: T4.1.
- **Build**: render the active timetable view to PDF, share intent.
- **Acceptance criteria**: opens correctly in a third-party PDF viewer,
  not just inside the app.
- **Done means**: actually opened the exported file outside the app.

### T6.2 Grid export — PNG
- **Depends on**: T4.1.
- **Build**: same as T6.1, as a shareable image.
- **Acceptance criteria**: same as T6.1.
- **Done means**: same as T6.1.

### T6.3 Per-teacher export
- **Depends on**: T4.1.
- **Build**: filter the active timetable to one teacher's periods only,
  export as its own PDF/PNG — per roadmap Section 8.
- **Acceptance criteria**: contains only that teacher's rows, correctly
  excludes everyone else's.
- **Done means**: spot-checked against the full grid for one teacher.

### T6.4 Report CSV export
- **Depends on**: T5.3, T5.4, T5.5.
- **Build**: CSV of whatever report/date-range is currently open.
- **Acceptance criteria**: opens cleanly in a spreadsheet app, correct
  headers.
- **Done means**: actually opened it in a spreadsheet app.

---

## Bucket 7 — Pairing-ease upgrades

### T7.1 SubjectTeacherDefault CRUD
- **Depends on**: T1.2, T1.3.
- **Build**: institute settings screen to set "Subject X is normally
  taught by Teacher Y" — optionally scoped to a specific section.
- **Acceptance criteria**: a default with no section set applies to that
  subject in any section; one with a section set overrides the
  no-section default for that section specifically.
- **Done means**: tested both the general and section-specific case.

### T7.2 Prefill Assign step from defaults
- **Depends on**: T7.1, T2.2.
- **Build**: when starting a fresh (non-duplicated) timetable, pre-fill
  `Assignment` rows from matching `SubjectTeacherDefault` rows.
- **Acceptance criteria**: prefill never overwrites an explicit choice
  already made in the same session — defaults only fill genuinely empty
  slots.
- **Done means**: manually overrode a prefilled slot, confirmed it stuck.

### T7.3 Subject-match sorting in the teacher pool
- **Depends on**: T7.1, T2.2.
- **Build**: when a slot is tagged with a subject, sort the teacher pool
  so teachers with a matching `SubjectTeacherDefault` appear first.
- **Acceptance criteria**: sort order changes visibly based on which
  slot is currently being targeted.
- **Done means**: visually confirmed with two different subjects in the
  same session.

### T7.4 Bulk-assign across sections
- **Depends on**: T2.2.
- **Build**: one action that assigns the same teacher+subject pairing to
  the same slot across multiple chosen sections at once.
- **Acceptance criteria**: conflict detection (T2.2) still runs per
  resulting `Assignment`, not skipped because it was a bulk action.
- **Done means**: deliberately bulk-assigned into a conflicting section
  and confirmed it's still flagged.

### T7.5 Contextual availability in the pool
- **Depends on**: T2.3, T2.2.
- **Build**: fold T2.3's data into T2.2's visuals — a teacher
  unavailable for the currently-targeted slot appears dimmed/undraggable
  in the pool itself.
- **Acceptance criteria**: this is a *visual* fold — T2.3's step/data
  still exists underneath; this ticket doesn't remove the Availability
  step, it surfaces its effect earlier.
- **Done means**: confirmed an unavailable teacher can't be dropped, with
  a clear reason shown (not just an inert chip).

---

## Bucket 8 — Stretch (post-v1, not detailed yet)

Do not start this bucket until 0–7 are done and verified. When it's time,
break these down into their own tickets the same way as above — don't
build ahead of the plan.

- Cloud sync (activating the dormant sync-readiness in the schema).
- Optional smart auto-generate/solver layered on top of manual assignment.
- Side-by-side history comparison.
