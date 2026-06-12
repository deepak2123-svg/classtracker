# Native Android Phase 6: FCM Admin Notices - Checkpoint 4

## Goal

Add native Firebase Cloud Messaging reception for administrator announcements,
without expanding into notification deep links or separate preferences.

## Completed

- Added the Firebase Messaging SDK through the existing Firebase BOM.
- Moved manual Firebase initialization into a reusable early bootstrap so FCM
  also works when the application starts for a background message.
- Added `AdminNoticeMessagingService` for foreground and data-message handling.
- Added environment-specific broadcast topics:
  - beta: `teacher_admin_notices_beta`
  - production: `teacher_admin_notices`
- The app subscribes on startup and resubscribes after FCM token refresh.
- Added the `Admin notices` Android notification channel.
- Added a monochrome Ledgr status-bar notification icon.
- Admin notices support:
  - `title`
  - `body`
  - optional stable `noticeId`
- Repeated delivery with the same `noticeId` updates the same notification.
- Tapping an admin notice opens the app root and dismisses the notification.
- Added manifest defaults so notification-payload messages use the same channel
  and icon when Android handles them in the background.

## Sender Contract

For beta acceptance, target this FCM topic:

```text
teacher_admin_notices_beta
```

Recommended data payload:

```json
{
  "title": "Schedule update",
  "body": "Tomorrow's first class begins at 9:30 AM.",
  "noticeId": "schedule-2026-06-13"
}
```

Production broadcasts use:

```text
teacher_admin_notices
```

FCM sending credentials remain on Firebase Console or a trusted server. No
server credential is included in the Android application.

## Safety Boundary

- Broadcast admin-notice reception only.
- No notification deep-link routing.
- No per-user token storage or Firestore device documents.
- No separate admin-notice preference yet.
- No admin web or teacher web changes.
- No Firebase rules or production data changes.
- No Room schema changes.
- Daily reminder scheduling remains unchanged.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-12:

```powershell
.\gradlew.bat :app:compileBetaDebugKotlin
.\gradlew.bat :app:testBetaDebugUnitTest
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
git diff --check
```

Installed and launched on attached device `859013c6`:

```powershell
adb install -r native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
adb shell monkey -p com.classtracker.app.nativebeta 1
```

Device verification confirmed:

- package `versionName=0.5.3-beta`;
- FCM service registered for `com.google.firebase.MESSAGING_EVENT`;
- notification permission granted;
- `Admin notices` channel created at default importance;
- successful subscription to `teacher_admin_notices_beta`;
- successful topic refresh after FCM token creation.

## Manual Acceptance Pending

- Send a Firebase Console test notification to
  `teacher_admin_notices_beta`.
- Confirm it appears while the app is foregrounded.
- Confirm it appears while the app is backgrounded.
- Confirm long body text expands correctly.
- Tap it and confirm Ledgr opens at the app root.
- Send the same `noticeId` twice through a trusted sender and confirm the
  notification updates instead of duplicating.

## Suggested Next Tag

After live FCM delivery acceptance:

```powershell
git tag native-phase-6-4-fcm-admin-notices-checkpoint
```

## Next Work

- Add an admin-web message composer backed by an admin-authorized Cloud Function
  that sends FCM messages without exposing server credentials to the browser.
- Add notification deep links to the intended destination.
- Add separate daily-reminder and admin-notice preferences.
- Add per-user device-token registration only when targeted notices are needed.
