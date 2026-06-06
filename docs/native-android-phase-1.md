# Native Android Phase 1

## Completed

- Created a standalone Kotlin and Jetpack Compose application.
- Added independently installable beta package
  `com.classtracker.app.nativebeta`.
- Kept the current Vite web app and Capacitor app unchanged.
- Added native Today, Classes, and Profile destinations.
- Added shared Material 3 design-system and model modules.
- Added unit, Compose UI, lint, web-build, and CI foundations.
- Disabled unsafe `productionDebug` and `betaRelease` variants.

## Verification

Run from `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleBetaDebug test :app:lintBetaDebug
```

Run from the repository root:

```powershell
npm run build
```

## Production impact

Phase 1 makes no Firebase, Firestore rule, authentication, web application, or
production package changes. The native beta cannot replace the current Android
application because it has a distinct application ID.

## Rollback

The Phase 1 Git tag is the stable boundary. To remove Phase 1 after it is
committed, revert the Phase 1 commit. Do not reset or rewrite shared history.

## Next milestone

Phase 2 adds Firebase to a separately registered beta Android application,
Credential Manager Google sign-in, and read-only compatibility access to the
existing teacher data.
