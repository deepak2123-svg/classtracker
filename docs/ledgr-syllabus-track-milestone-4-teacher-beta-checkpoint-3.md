# Ledgr Syllabus Track - Milestone 4 Teacher Beta Checkpoint 3

Date: 2026-06-16

## Current state

Teacher beta syllabus progress is now an explicit edit-and-save flow. Teachers can tick or untick completed chapters/topics, review the draft state, and save only when finished.

## Completed

- Reworked the Syllabus tab card interaction:
  - collapsed cards show progress and an `Edit syllabus progress` action
  - expanded cards show editable chapter/topic checkboxes
  - changes are local until `Save syllabus progress` is tapped
  - `Reset changes` restores the last saved syllabus state
  - `Open class entry` remains available as a secondary action
- Made syllabus progress reversible:
  - teachers can deselect a completed chapter/topic before saving
  - the latest saved syllabus snapshot overrides older additive completion entries
  - old one-off syllabus completion entries remain backward compatible if no snapshot exists
- Kept Add Entry syllabus completion aligned with the same snapshot-aware progress model.
- Added a model test proving the latest saved snapshot overrides older coverage.

## Technical notes

- No Room migration was needed.
- The latest saved syllabus state is stored as a normal syllabus-tagged entry using title `Syllabus progress update`.
- Whole-chapter completion still uses the existing marker format: `chapter:{chapterId}`.
- Progress calculations now use `completedSyllabusUnitIds(...)`, which prefers the newest snapshot and falls back to legacy entry aggregation.

## Verified

- `.\gradlew.bat :core:model:test :feature:classes:compileDebugKotlin :feature:entries:compileDebugKotlin :app:compileBetaDebugKotlin --console=plain`
- `.\gradlew.bat :core:model:test :app:testBetaDebugUnitTest :app:assembleBetaDebug :app:installBetaDebug --console=plain`
- Installed beta APK on connected `AIN065` device.
- Launched `com.classtracker.app.nativebeta` and checked logcat for immediate fatal startup crashes.

## Not done

- Not committed, tagged, or pushed.
- No manual UI acceptance was performed on the Syllabus tab after install.
- No real PDF/export acceptance was run after saving revised syllabus progress.

## Next recommended checkpoint

1. On the connected teacher beta app, open Syllabus:
   - tap `Edit syllabus progress`
   - select multiple chapters
   - untick one previously selected chapter
   - tap `Save syllabus progress`
   - reopen Syllabus and confirm saved progress matches exactly
2. Confirm Add Entry still shows the next incomplete chapters first after saved progress changes.
3. Confirm Reports & Export PDF reflects the latest saved syllabus progress.
4. If accepted, commit/tag the Android syllabus checkpoint.
