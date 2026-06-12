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

## Firestore Rules Deployment

Completed on 2026-06-12 using the authenticated Firebase account
`deepakkarnal321@gmail.com`:

```powershell
firebase deploy --only firestore:rules --project classtracker-84920
```

Firebase compiled and released `firestore.rules` successfully.

Post-deployment device verification:

- restarted the beta app;
- feedback unavailable state was absent;
- feedback message field was enabled;
- no `PERMISSION_DENIED`, `FirebaseFirestoreException`, or fatal exception
  appeared in logcat.

Full teacher-send, admin-reply, resolve, and reopen acceptance from checkpoint
6 remains pending.

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
