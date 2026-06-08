# Native Android Phase 4: Sliding Class Pager Checkpoint

## Goal

This checkpoint upgrades checkpoint 7 class swiping from an instant route swap
to a native sliding page motion. Teachers should see the neighboring class move
with the finger while swiping left or right from class detail.

The teacher web app, admin web app, Capacitor app, Firebase rules, Firestore
document shape, and native write paths are unchanged.

## Completed

- Replaced the manual horizontal drag detector with Compose `HorizontalPager`.
- Class detail pages now slide horizontally during left/right class swipes.
- Kept the class route in sync after the pager settles on a new page.
- Kept add, edit, duplicate, delete, and restore callbacks bound to the active
  pager page's class id.
- Left the sticky class banner, newest-first history, search filters, date
  focus, recycle bin, duplicate, delete, restore, and outbox behavior unchanged.
- Updated native README and roadmap references to checkpoint 8.

## User Behavior

- Swiping left/right on class detail now shows visible sliding motion instead of
  instantly reflecting the next class after release.
- The current class detail route updates after the pager settles, so entry
  editor routes still open for the correct class.
- First and last classes naturally stop at pager edges.
- Each class page keeps its own saved date focus and history filter state.

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
- lastUpdateTime: `2026-06-08 09:30:51`

Manual device acceptance should confirm:

- class detail swipes visibly slide between classes;
- sticky class banner still works while scrolling;
- newest-first all-history ordering remains intact;
- add/edit/duplicate/delete/restore still target the visible class after a
  swipe;
- search/status filters still work after swiping to another class.

## Remaining Stage 4 Work

- Live-device acceptance for delete, restore, offline retry, and conflict
  handling against a disposable test account.
- Reliability acceptance for process death during pending mutations,
  simultaneous native/web edits, manual retry, and duplicate prevention.
- Confirm sliding class pager behavior on first, middle, and last classes with
  dense histories.
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
git revert native-phase-4-7-class-detail-navigation-checkpoint..native-phase-4-8-sliding-class-pager-checkpoint
```

If the tag is unavailable, revert the commit that introduced the checkpoint 8
sliding class pager. The previous stable native checkpoint remains
`native-phase-4-7-class-detail-navigation-checkpoint`.
