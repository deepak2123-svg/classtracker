# Ledgr Syllabus Track - Milestone 4 Teacher Beta Checkpoint 4

Date: 2026-06-16

## Current state

Teacher beta now keeps syllabus work out of the Add Entry page and treats syllabus progress as its own dedicated tab experience.

## Completed

- Removed `SYLLABUS COVERED` from the Add Entry page.
- Kept syllabus progress editing in the Syllabus bottom-tab only.
- Redesigned Syllabus tab cards toward the supplied reference:
  - larger class title and percent
  - progress bar
  - completed / remaining / total chapter tiles
  - explicit `View chapters` / `Hide chapters` toggle
  - dark-style progress card treatment with theme-aware light mode support
  - custom square checkboxes for chapter/topic completion
  - save/reset controls remain inside expanded card
- Added a darker proportional border to home section cards while preserving their existing fill colors.

## Technical notes

- No Room migration was needed.
- Add Entry still receives syllabus context at route level, but no longer renders or mutates syllabus progress from the entry form.
- Syllabus tab continues using the latest snapshot model from checkpoint 3, so deselection remains reversible after save.

## Verified

- `.\gradlew.bat :feature:entries:compileDebugKotlin :feature:classes:compileDebugKotlin :feature:today:compileDebugKotlin :app:compileBetaDebugKotlin --console=plain`
- `.\gradlew.bat :core:model:test :app:testBetaDebugUnitTest :app:assembleBetaDebug :app:installBetaDebug --console=plain`
- Installed beta APK on connected `AIN065` device.
- Launched `com.classtracker.app.nativebeta` and checked logcat for immediate fatal startup crashes.

## Not done

- Not committed, tagged, or pushed.
- No screenshot-based visual QA was run after install.
- Manual acceptance still needed for Syllabus tab expand/save/reset and home card border appearance.

## Next recommended checkpoint

1. On device, verify Add Entry no longer shows syllabus content.
2. On Home, verify class-card black border feels proportional and not too heavy.
3. On Syllabus, verify:
   - collapsed card resembles the supplied reference
   - `View chapters` expands the checklist
   - checked/unchecked states are clear
   - save/reset still work correctly
4. If accepted, commit/tag this Android beta syllabus UI checkpoint.
