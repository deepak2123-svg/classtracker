# Native Android Phase 4: Class Detail Navigation Polish Checkpoint

## Goal

This checkpoint tightens the native class-detail teacher workflow after the
search/filter checkpoint:

- keep the selected class summary visible while reviewing long histories;
- show newest history entries first;
- allow left/right swipes between classes, matching the teacher web app flow.

The teacher web app, admin web app, Capacitor app, Firebase rules, Firestore
document shape, and native write paths are unchanged.

## Completed

- Converted the class-detail hero card into a sticky native header.
- Changed all-history ordering from oldest-first to newest-first.
- Added shared model sorting coverage for newest-first history ordering.
- Added left/right class swipe handling on the native class-detail screen.
- Kept swipe navigation inside the loaded teacher snapshot and route-replaced
  the current class detail screen instead of adding a long detail back stack.
- Left date focus, search filters, recycle bin, duplicate, delete, restore, and
  outbox behavior unchanged.
- Updated native README and roadmap references to checkpoint 7.

## User Behavior

- The class banner, for example "Madhav 3", stays pinned at the top as the
  teacher scrolls through the class history.
- "All history" now says "Newest entries first" and lists later dates before
  earlier dates.
- Swiping left on class detail opens the next class in the teacher's loaded
  class list.
- Swiping right on class detail opens the previous class in the teacher's loaded
  class list.
- Edge classes ignore swipes that would move past the first or last class.

## Safety Boundary

- No write path changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- No Firebase reads or compatibility mapper behavior changed.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

From `native-android/`, with Android Studio JBR on `JAVA_HOME`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :app:compileBetaDebugKotlin
```

Full checkpoint verification is green:

```powershell
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :core:sync:testDebugUnitTest
.\gradlew.bat :feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
.\gradlew.bat :app:lintBetaDebug
npm run build
```

`npm run build` completed with the existing Vite warnings about Firestore
dynamic/static imports and chunks larger than 500 kB.

The generated beta APK was rebuilt and installed on the connected Nothing Phone
2 / AIN065:

```powershell
.\gradlew.bat :app:assembleBetaDebug --rerun-tasks
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

Installed package metadata:

- device: `859013c6` / AIN065
- package: `com.classtracker.app.nativebeta`
- versionCode: `6`
- versionName: `0.4.1-beta`
- lastUpdateTime: `2026-06-08 08:55:47`

A launch screenshot was captured after install. Automated tap navigation into
class detail did not move from the home screen during screenshot capture, so
manual class-detail acceptance remains required.

Manual device acceptance should confirm:

- sticky class banner while scrolling;
- newest-first all-history ordering;
- left/right class swiping;
- search/status filters still work after swiping to another class.

## Remaining Stage 4 Work

- Live-device acceptance for delete, restore, offline retry, and conflict
  handling against a disposable test account.
- Reliability acceptance for process death during pending mutations,
  simultaneous native/web edits, manual retry, and duplicate prevention.
- Confirm class swiping on first, middle, and last classes with dense histories.
- Decide whether delete should eventually be allowed for unsynced local drafts
  as a local discard action.

## Next Stage

After Phase 4 reliability acceptance is complete, begin Phase 5 teacher reports
and exports:

- daily, weekly, monthly, and custom-range reports;
- institute scope for one institute, selected institutes, or all institutes;
- native PDF generation;
- local file saving and Android share sheet;
- background export progress, completion, and failure states.

## Rollback

After the checkpoint tag is created, roll back this workflow checkpoint with:

```powershell
git revert native-phase-4-6-entry-search-filter-checkpoint..native-phase-4-7-class-detail-navigation-checkpoint
```

If the tag is unavailable, revert the commit that introduced the checkpoint 7
class-detail navigation polish. The previous stable native checkpoint remains
`native-phase-4-6-entry-search-filter-checkpoint`.
