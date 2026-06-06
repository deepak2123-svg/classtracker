# Native Android Phase 2

## Completed

- Added Firebase Authentication and Firestore through the Firebase Android BoM.
- Added native email/password sign-in.
- Added Google sign-in through Android Credential Manager's dedicated button
  flow, feature-gated until the beta Android app is registered in Firebase.
- Added Hilt dependency injection and persistent Firebase Auth sessions.
- Added read-only adapters for the existing web data:
  - `users/{uid}/appdata/main`
  - `users/{uid}/appdata/notes_{classId}`
  - `teachers/{uid}`
  - `config/institutes`
  - `config/sections`
- Added native Today, Classes, class history, and Profile data surfaces.
- Kept teaching history ordered from oldest to newest.
- Added one-shot loading after an account change and explicit manual refresh.
- Added mapper and ViewModel tests for legacy compatibility and refresh
  behavior.

## Read-only boundary

The native data repository exposes only `loadTeacherSnapshot`. It uses
Firestore document `get()` calls and contains no listeners, timers,
transactions, batches, or create/update/delete operations.

Phase 2 does not change Firestore rules, documents, Firebase authentication
providers, the React web apps, or the existing Capacitor Android project.

## Firebase activation

Register this beta app in Firebase project `classtracker-84920`:

```text
Package: com.classtracker.app.nativebeta
SHA-1: 93:FC:C0:E7:A7:61:B4:C8:67:BE:86:ED:81:26:2E:C9:B8:C5:8C:95
SHA-256: 41:68:F0:62:C5:10:32:09:BB:A5:20:87:2B:B2:1E:55:A6:6C:04:7A:37:55:11:C9:B2:98:29:B4:F7:15:38:E7
```

Then create the ignored `native-android/firebase.local.properties` from the
example file:

```properties
firebaseApplicationId=1:170006710635:android:REPLACE_WITH_BETA_APP_ID
betaGoogleSignInConfigured=true
```

The beta button remains disabled until this flag is enabled. Email/password
sign-in remains available for compatibility testing.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleBetaDebug test :app:lintBetaDebug
```

From the repository root:

```powershell
npm run build
```

Expected APK:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

Automated verification covers model mapping, oldest-first entry ordering,
navigation metadata, and the no-repeat/manual-refresh ViewModel contract.
Live Firebase sign-in and Compose instrumentation still require a configured
beta Firebase app and an Android device or emulator.

## Rollback

The Phase 2 tag is the rollback boundary. Revert the Phase 2 commit to return to
the Phase 1 native shell. The web apps and Capacitor project do not need a
rollback because Phase 2 does not modify them.
