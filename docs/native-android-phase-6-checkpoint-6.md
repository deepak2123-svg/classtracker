# Native Android Phase 6: Teacher Feedback Conversations - Checkpoint 6

## Goal

Let a teacher report an issue or share feedback from the native profile, and
let an administrator read and reply from the admin web profile.

## Completed

- Added `Feedback & Support` to the native teacher profile.
- Added a dedicated conversation screen with:
  - chronological teacher/admin messages;
  - empty, sending, and resolved states;
  - 2,000-character validation;
  - unread admin-reply count on the profile card;
  - automatic read acknowledgement when the teacher opens the conversation.
- Added a realtime Firebase feedback repository and ViewModel state.
- Added `Teacher Feedback` to both admin profile surfaces:
  - mobile admin profile;
  - desktop admin profile menu.
- Added a responsive admin inbox with:
  - newest conversations first;
  - teacher identity and institute context;
  - separate unread count;
  - threaded replies;
  - resolve and reopen actions.
- Added an additive Firestore structure:

```text
feedbackThreads/{teacherUid}
feedbackThreads/{teacherUid}/messages/{messageId}
```

- Added scoped Firestore rules:
  - a teacher can read and create messages only in their own conversation;
  - a teacher message must identify the authenticated teacher and use the
    `teacher` sender role;
  - only admins can read all conversations, reply, resolve, reopen, or delete;
  - messages cannot be edited or deleted after creation.
- Added `firebase.json` and `.firebaserc` for rules-only deployment.
- Added a ViewModel test for feedback submission completion.

## Safety Boundary

- Feedback is stored outside `users/{uid}/appdata/main`.
- No entry, class, report, Room, or existing sync-outbox schema changed.
- Existing teacher/admin data remains untouched.
- Removing the feedback UI and `feedbackThreads` rules cleanly rolls back the
  feature without migrating legacy teacher documents.
- Existing root `outputs/` and `temp_excerpt.txt` remain untouched.

## Verification

Passed on 2026-06-12:

```powershell
.\gradlew.bat :core:model:test :core:firebase:testDebugUnitTest `
  :feature:profile:compileDebugKotlin :app:testBetaDebugUnitTest `
  :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
npm run build
git diff --check
firebase emulators:exec --only firestore --project demo-ledgr "cmd /c exit 0"
```

The Firestore emulator accepted and loaded the updated rules. The local admin
app also loaded successfully in admin mode. Authentication is required before
the live profile inbox can be exercised.

## Required Deployment Gate

The code is built, but the new Firestore path is denied by the currently
deployed rules until this command is run from an authenticated Firebase CLI:

```powershell
firebase login
firebase deploy --only firestore:rules --project classtracker-84920
```

The automated deployment attempt stopped safely because this machine has no
active Firebase CLI login.

The admin web build must also be deployed through the existing Vercel release
process before administrators see the inbox.

## Live Acceptance Still Required

- Reconnect the Android debugging device and install the beta APK.
- Send a teacher message.
- Confirm the admin inbox receives it and increments unread count.
- Reply as admin.
- Confirm the teacher sees the reply and unread count clears on open.
- Resolve, reopen by sending a teacher message, and verify ordering.
- Verify the teacher cannot read another teacher's conversation.
- Verify light/dark theme, keyboard behavior, and narrow admin viewport.

## Suggested Tag

After rules deployment and live cross-client acceptance:

```powershell
git tag native-phase-6-6-teacher-feedback-checkpoint
```
