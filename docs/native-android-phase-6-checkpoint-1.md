# Native Android Phase 6: Daily Reminder Foundation - Checkpoint 1

## Goal

Start Phase 6 with a safe local reminder foundation:

- ask the teacher once on fresh app open whether they want a reminder;
- allow exactly one reminder per day;
- skip Sundays;
- let the teacher change or turn off the reminder from Profile.

## Completed

- Added local reminder preferences:
  - prompted/not prompted;
  - enabled/disabled;
  - selected hour and minute;
  - human-readable time label.
- Added a daily reminder scheduler using WorkManager unique work:
  - one pending reminder work item at a time;
  - schedules the next valid Monday-Saturday occurrence;
  - replaces old work when the teacher changes the time;
  - cancels work when reminders are turned off.
- Added `DailyReminderWorker`:
  - posts "Time to log today's classes";
  - opens the app when tapped;
  - skips notification posting on Sunday;
  - reschedules the next valid reminder after each run;
  - safely skips posting if notifications are disabled.
- Added Android `POST_NOTIFICATIONS` permission.
- Added runtime permission request only when the teacher enables reminders.
- Added first-run reminder setup dialog after the teacher opens the app.
- Updated Profile notification card:
  - shows reminder enabled/disabled state;
  - shows selected reminder time;
  - opens the same reminder setup dialog for changes.
- Updated the roadmap Phase 6 status.

## Safety Boundary

- Local reminders only.
- No Firebase Cloud Messaging yet.
- No admin notices yet.
- No notification deep links beyond opening the app root.
- No Firebase rules changed.
- No web/admin React code changed.
- No Room schema migration in this pass.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoints 11-17 and Phase 6 checkpoint 1 remain uncommitted WIP in this
  worktree.

## Verification

Passed on 2026-06-12:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Device install and launch check on 2026-06-12:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta 1
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch command returned
cleanly, and package metadata showed:

- `versionCode=11`
- `versionName=0.5.3-beta`
- `lastUpdateTime=2026-06-12 14:48:47`
- `android.permission.POST_NOTIFICATIONS` declared
- notification permission currently `granted=false`, expected until the teacher
  enables reminders

Also passed:

```powershell
git diff --check
```

Note: `git diff --check` only reported existing Windows LF-to-CRLF warnings.

## Manual Acceptance Pending

- Clear app data or use a fresh beta install, then sign in.
- Confirm the reminder setup dialog appears once after the teacher workspace
  opens.
- Enter a time and save.
- Confirm Android notification permission is requested on Android 13+.
- Confirm Profile shows the enabled reminder time.
- Change the time from Profile and confirm only one reminder remains scheduled.
- Turn reminder off from Profile and confirm scheduled work is cancelled.
- Confirm Sunday is skipped by testing scheduler delay or with a controlled
  device date.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-6-1-daily-reminder-foundation-checkpoint
```

## Next Work

- Add direct notification deep link to the add-entry/home target.
- Add optional reminder copy based on classes not logged today.
- Add Firebase Cloud Messaging setup for admin notices.
- Add notification preference structure for admin notices vs daily reminders.
