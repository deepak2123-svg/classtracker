# Native Android beta acceptance checkpoint 1

Date: 2026-06-17

## Completed

- Persisted teacher home class-card drag order across app restarts.
  - Order is stored in app SharedPreferences under a key scoped by the signed-in teacher UID.
  - The order is normalized when classes are added/removed, so new classes still appear and removed classes do not leave stale IDs.
- Updated Android 12+ launch splash configuration.
  - The old `L` launcher icon is no longer used as the platform splash icon.
  - The custom Ledgr loading animation is held briefly on cold start so it can actually be seen.
- Replaced old webapp APK artifacts in `github-apk`.
  - Removed tracked `classlog-arm64-v8a-debug.apk`.
  - Removed tracked `classlog-armeabi-v7a-debug.apk`.
  - Removed tracked `classlog-universal-debug.apk`.
  - Added `github-apk/ledgr-teacher-beta-debug.apk`.
  - Updated `github-apk/README.md`.

## Files changed

- `native-android/feature/today/src/main/kotlin/com/classtracker/feature/today/HomeScreen.kt`
- `native-android/app/src/main/kotlin/com/classtracker/nativeapp/LedgrApp.kt`
- `native-android/app/src/main/res/values-v31/themes.xml`
- `github-apk/README.md`
- `github-apk/ledgr-teacher-beta-debug.apk`
- `docs/native-android-beta-acceptance-checkpoint-1.md`

## Verified

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :feature:today:compileDebugKotlin :app:assembleBetaDebug
```

Result: build successful.

## Blocked / not verified on device

ADB could not see the connected phone from this shell:

```powershell
adb kill-server
adb start-server
adb devices -l
```

Result: empty device list.

Once the phone appears, install with:

```powershell
adb install -r native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Next

1. Push this checkpoint commit to GitHub.
2. Reconnect/authorize the phone and install the beta APK.
3. On device, verify:
   - Drag class cards, close app fully, reopen app, and confirm the order stays changed.
   - Cold open shows the Ledgr animated loading screen instead of the old `L` splash.
   - `github-apk/ledgr-teacher-beta-debug.apk` is downloadable from GitHub after push.
