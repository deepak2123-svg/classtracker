# Ledgr Syllabus Track - Milestone 4 Teacher Beta Checkpoint 2

Date: 2026-06-16

## Current state

Teacher beta now treats syllabus as completed coverage, not a single ongoing chapter picker.

## Completed

- Reworked Add Entry syllabus UI from `ONGOING CHAPTER` to `SYLLABUS COVERED`.
- Teachers can select multiple chapters covered in one entry.
- Completed chapters move below incomplete chapters, so the next uncovered chapter appears first next time.
- Whole-chapter completion supports chapters with or without topics.
- Syllabus tab is now actionable:
  - teachers can tick completed chapters directly from the syllabus tab
  - teachers can tick individual topics where topics exist
  - progress is persisted through normal entry sync/export paths
- Existing PDF/report progress continues to use the same syllabus progress model.
- Added a model test for whole-chapter completion markers.

## Technical notes

- No Room migration was needed.
- Whole-chapter completion is represented using a stable marker in the existing completed syllabus unit list.
- Existing single-chapter completion entries remain compatible.
- Syllabus-tab ticks create lightweight syllabus progress entries so sync, restore, and PDFs continue using existing entry infrastructure.

## Verified

- `.\gradlew.bat :core:model:test :feature:classes:compileDebugKotlin :feature:entries:compileDebugKotlin :app:compileBetaDebugKotlin --console=plain`
- `.\gradlew.bat :core:model:test :app:testBetaDebugUnitTest :app:assembleBetaDebug --console=plain`
- `.\gradlew.bat :app:installBetaDebug --console=plain`
- Launched `com.classtracker.app.nativebeta` on connected AIN065 device and checked logcat for immediate fatal startup crashes.

## Not done

- Not committed, tagged, or pushed yet.
- No manual end-to-end Firestore/PDF acceptance was run after marking real syllabus items on device.

## Next recommended checkpoint

1. On the connected teacher beta app, test with a real published syllabus:
   - mark chapter 4 complete from Add Entry
   - confirm chapter 5 appears first on the next entry
   - select multiple chapters in one entry and save
   - mark chapters/topics from the Syllabus tab
   - confirm progress updates in Syllabus and Reports & Export PDF
2. If the “syllabus progress” entries feel too visible in class history, consider a dedicated progress store in the next milestone.
3. Commit/tag this checkpoint if acceptance looks good.
