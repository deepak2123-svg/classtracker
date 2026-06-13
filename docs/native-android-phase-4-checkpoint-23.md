# Native Android Phase 4: Keyboard-Aware Entry Fields Checkpoint 23

## Goal

Keep Topic and Notes visible above the Android keyboard while the teacher types.

## Completed

- Added IME inset padding to both entry experiences:
  - inline Add Entry inside the class page;
  - standalone new, edit, and duplicate entry pages.
- Topic and Notes now request that their complete text box be brought into view
  after focus and keyboard presentation.
- The Notes field no longer requires manual upward dragging before typing.
- Existing `adjustResize` activity behavior remains enabled.

## Safety Boundary

- Entry data, validation, saving, and Firebase behavior are unchanged.
- The change is limited to keyboard insets, focus, and scrolling.
- No live teacher entry was created or edited during verification.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :feature:entries:testDebugUnitTest :feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

Additional verification:

- `git diff --check`
- Beta installed successfully on connected device `859013c6`.
- Automated visual inspection was not completed because the connected device
  locked before the field-focus check.

## Manual Acceptance

1. Open Add Entry and tap Topic without manually scrolling.
2. Confirm Topic remains fully visible above the keyboard.
3. Tap Notes and confirm the complete Notes box moves above the keyboard.
4. Type several lines and confirm the current text and cursor remain visible.
5. Repeat on edit and duplicate entry screens.
6. Dismiss the keyboard and confirm normal page scrolling remains unchanged.

## Next Work

- Confirm keyboard behavior with the device's preferred keyboard and font size.
- Continue Phase 4 reliability, conflict handling, and manual retry polish.

## Rollback

```powershell
git revert native-phase-4-22-home-after-save-and-deliberate-swipes-checkpoint..native-phase-4-23-keyboard-aware-entry-fields-checkpoint
```
