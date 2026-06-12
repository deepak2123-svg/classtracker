# Native Android Phase 6: Feedback Startup Crash Hotfix - Checkpoint 7

## Goal

Prevent an unavailable optional feedback backend from closing the signed-in
teacher beta app.

## Root Cause

The live Firestore rules do not yet allow the new `feedbackThreads` listener.
Firestore returned `PERMISSION_DENIED`, the feedback flow closed with that
exception, and the uncaught ViewModel coroutine exception terminated the app.

## Completed

- Contained feedback listener failures inside `MainViewModel`.
- Kept the teacher snapshot, classes, entries, reports, reminders, and profile
  available when feedback cannot connect.
- Added a feedback-only unavailable state.
- Disabled the feedback composer while that backend is unavailable.
- Added a regression test that throws from the feedback flow and confirms the
  signed-in workspace still loads.
- Rebuilt and installed the beta APK on the connected Android device.

## Verification

Passed on 2026-06-12:

```powershell
.\gradlew.bat :app:testBetaDebugUnitTest :app:assembleBetaDebug
```

Device acceptance:

- Installed `app-beta-debug.apk` successfully with `adb install -r`.
- Four forced cold launches remained alive.
- Android crash buffer remained empty.
- Home loaded with the existing teacher data.
- Feedback opened with `Feedback is temporarily unavailable.`
- Feedback input and send action were disabled.

## Remaining Deployment Gate

The crash is fixed independently of backend deployment. Feedback messaging
will remain unavailable until an authenticated Firebase CLI deploys the rules:

```powershell
firebase login
firebase deploy --only firestore:rules --project classtracker-84920
```

After deployment, restart the beta app and complete teacher-to-admin reply
acceptance from checkpoint 6.

## Safety Boundary

- No Room schema, outbox schema, entry/class mutation, report, or reminder
  behavior changed.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.
- Backend permission failures are shown only inside the optional feedback
  feature and no longer become process-wide failures.

## Suggested Tag

After rules deployment and live feedback acceptance:

```powershell
git tag native-phase-6-7-feedback-crash-hotfix
```
