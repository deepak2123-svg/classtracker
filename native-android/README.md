# Ledgr Native Android

This project is the native teacher application built with Kotlin and Jetpack
Compose. It is intentionally separate from:

- the Vite/React teacher and admin web application at the repository root;
- the Capacitor Android application in `../android`.

## Application variants

| Variant | Application ID | Purpose |
| --- | --- | --- |
| `betaDebug` | `com.classtracker.app.nativebeta` | Development and internal testing |
| `productionRelease` | `com.classtracker.app` | Disabled from normal development use until stable release |

`productionDebug` and `betaRelease` are disabled. This prevents a development
build from replacing the currently installed application.

## Local build

Android Studio is the recommended environment. From this directory:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleBetaDebug
.\gradlew.bat testBetaDebugUnitTest
.\gradlew.bat :app:lintBetaDebug
```

The APK is written to:

```text
app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Firebase beta setup

The committed defaults keep CI reproducible and leave Google sign-in disabled
for the beta package. Before installing the beta for live account testing:

1. Register `com.classtracker.app.nativebeta` as an Android app in Firebase
   project `classtracker-84920`.
2. Add the debug signing SHA-1 and SHA-256 fingerprints listed in
   `../docs/native-android-phase-2.md`.
3. Copy `firebase.local.properties.example` to
   `firebase.local.properties`.
4. Set the beta Firebase application ID and enable Google sign-in in that
   ignored local file.

Do not commit `firebase.local.properties`.

## Current scope

Phase 4 checkpoint 2 includes native Firebase authentication, compatibility
reads, beta-only entry creation and editing, Room-backed offline browsing, and a
durable WorkManager outbox. Production native builds remain read-only, and the
teacher/admin web applications continue to use the existing Firestore model.

See `../docs/native-android-phase-4-checkpoint-2.md` for synchronization
behavior, verification, and rollback details.

See `../docs/native-android-roadmap.md` for the complete migration plan.
