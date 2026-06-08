# Native Android Phase 4: Entry Search and Filters Checkpoint

## Goal

This checkpoint completes the remaining non-destructive Stage 4.4 class-history
workflow: beta teachers can search and filter saved entries from the native
class detail screen while staying fully offline-first.

The teacher web app, admin web app, Capacitor app, Firebase rules, and
Firestore document shape are unchanged.

## Completed

- Added a local history filter panel to native class detail.
- Added text search for saved entries across:
  - topic/title;
  - notes/body;
  - date;
  - time;
  - teacher name;
  - tag and status labels.
- Added status filters for all current native entry statuses:
  - Started;
  - In Progress;
  - Completed;
  - Doubts.
- Kept the date-focus workflow unchanged so teachers can still add and review
  the selected date independently of the all-history filter.
- Kept filtering local to the Room-backed snapshot already loaded on device.
- Added shared model coverage for query and status filter behavior.
- Updated the roadmap so Phase 5 is teacher reports and exports, with
  notifications moved after exports to match the original plan.

## User Behavior

- Teachers see a "History filters" card above "All history" when the class has
  saved entries.
- Search narrows the all-history list immediately without a network request.
- Status chips narrow all-history to a single saved status.
- Clear resets both the search text and selected status filter.
- Empty results show a native empty state without changing the selected date or
  recycle-bin content.

## Safety Boundary

- No write path changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- Delete, restore, duplicate, and existing outbox behavior are unchanged.
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

The production release assemble task was rerun with a longer timeout after the
first local command timed out without reporting a Gradle failure.

The generated beta APK was rebuilt and installed on the connected Nothing Phone
2 / AIN065:

```powershell
.\gradlew.bat :app:assembleBetaDebug --rerun-tasks
adb install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
adb shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

Installed package metadata:

- package: `com.classtracker.app.nativebeta`
- versionCode: `6`
- versionName: `0.4.1-beta`
- lastUpdateTime: `2026-06-08 08:31:38`

A launch screenshot was captured after install. A tap attempt on the first class
did not navigate during automated screenshot capture, so manual on-device visual
acceptance of the class detail filter UI remains in the remaining work list.

## Remaining Stage 4 Work

- Live-device acceptance for delete, restore, offline retry, and conflict
  handling against a disposable test account.
- Reliability acceptance for process death during pending mutations,
  simultaneous native/web edits, manual retry, and duplicate prevention.
- Confirm search/filter behavior on a real account with a dense class history.
- Manually confirm the installed beta class detail screen shows the new search
  and status filters on a real class history.
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
git revert native-phase-4-5-recoverable-delete-checkpoint..native-phase-4-6-entry-search-filter-checkpoint
```

If the tag is unavailable, revert the commit that introduced the checkpoint 6
search/filter changes. The previous stable native checkpoint remains
`native-phase-4-5-recoverable-delete-checkpoint`.
