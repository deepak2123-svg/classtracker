# Ledgr Native Android

This project is the native teacher application built with Kotlin and Jetpack
Compose. It is intentionally separate from:

- the Vite/React teacher and admin web application at the repository root;
- the Capacitor Android application in `../android`.

## Phase 1 variants

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

## Current scope

Phase 1 contains the native shell, design system, navigation, module boundaries,
and test foundation. It does not connect to Firebase or production data.

See `../docs/native-android-roadmap.md` for the complete migration plan.
