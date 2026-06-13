# Native Android Phase 4: Home After Save and Deliberate Swipes Checkpoint 22

## Goal

End entry creation on Home and reduce unintended left-right class changes.

## Completed

- Successful inline entry saves now:
  - clear the persisted draft;
  - dismiss focus and the keyboard;
  - consume the save-success event;
  - navigate directly to the app Home screen;
  - show a short success message.
- Applied the same less-sensitive paging behavior to Add Entry and Class
  History.
- Raised the positional class-switch threshold from the Compose default of 50%
  to 72%.
- Limited each swipe gesture to at most one class.
- Preserved the existing 170 ms class snap animation.

## Safety Boundary

- Entry persistence and Firebase data shapes are unchanged.
- Swipe tuning affects only native class paging.
- No live entry was created during verification.
- Unrelated untracked `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-13:

```powershell
cd native-android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
```

Additional verification:

- `git diff --check`
- Beta installed successfully on connected device `859013c6`.

## Manual Acceptance

1. Save a disposable entry from the inline Add Entry page.
2. Confirm the app returns directly to Home.
3. Confirm the saved-entry success message appears.
4. Open a class and make short horizontal or diagonal movements while
   scrolling vertically; confirm the class does not change.
5. Perform a deliberate horizontal swipe across most of the screen and confirm
   exactly one adjacent class opens.
6. Repeat the swipe check in Class History.

## Next Work

- Tune the 72% threshold after device feedback if it feels too firm.
- Continue Phase 4 reliability, conflict handling, and manual retry polish.

## Rollback

```powershell
git revert native-phase-4-21-post-save-history-and-recycle-actions-checkpoint..native-phase-4-22-home-after-save-and-deliberate-swipes-checkpoint
```
