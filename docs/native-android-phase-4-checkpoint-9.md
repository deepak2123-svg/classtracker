# Native Android Phase 4: Entry Calendar and Motion Polish Checkpoint

## Goal

This checkpoint brings the native add/edit entry date picker closer to the
teacher web app's date focus calendar and adds subtle Android-standard motion
to date and filter controls.

The teacher web app, admin web app, Capacitor app, Firebase rules, Firestore
document shape, and native write paths are unchanged.

## Completed

- Replaced the entry editor's platform `DatePickerDialog` with an in-screen
  Compose month calendar.
- Matched the web app's compact date focus structure:
  - month title;
  - previous/next month buttons;
  - seven weekday labels;
  - month grid;
  - highlighted editable date window;
  - today/selected emphasis;
  - entry dots for dates with existing class entries.
- Kept the existing native write safety window: only today and the previous
  seven days can be selected for entry writing.
- Added animated color, dot-size, and scale transitions for calendar day cells.
- Added animated color/scale transitions for class date chips and history
  status filter chips.
- Kept class-detail sliding pager, sticky banner, newest-first history,
  search/status filters, recycle bin, duplicate, delete, restore, and outbox
  behavior unchanged.
- Updated native README and roadmap references to checkpoint 9.

## User Behavior

- While adding or editing an entry, teachers see a web-style calendar directly
  in the schedule card instead of opening the old platform date dialog.
- Tapping an allowed calendar date updates the draft date immediately.
- Existing class entries are marked with a small dot on their dates.
- The selected date and today use smooth animated visual changes.
- Date chips and history filter chips now animate between selected and
  unselected states.

## Safety Boundary

- No write path changed.
- No production native write behavior changed.
- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- No Firebase reads or compatibility mapper behavior changed.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

Full checkpoint verification is green.

From `native-android/`, with Android Studio JBR on `JAVA_HOME`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :app:compileBetaDebugKotlin
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :core:sync:testDebugUnitTest
.\gradlew.bat :feature:classes:testDebugUnitTest :app:testBetaDebugUnitTest :app:assembleBetaDebug
.\gradlew.bat :app:assembleProductionRelease
.\gradlew.bat :app:lintBetaDebug
.\gradlew.bat :app:assembleBetaDebug --rerun-tasks
```

From the repository root:

```powershell
npm run build
```

The Vite build still reports the existing Firebase dynamic/static import
chunking warning and the existing large-chunk warning.

Installed and launched the generated beta APK on the connected device
`859013c6`:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
```

Installed package metadata:

```text
versionCode=6
versionName=0.4.1-beta
lastUpdateTime=2026-06-08 10:11:48
```

Manual device acceptance should confirm:

- entry editor shows the embedded month calendar;
- month previous/next buttons work;
- selecting an allowed date updates the draft date;
- future/older non-window dates cannot be selected;
- existing-entry dots appear for dates with class entries;
- animated selection states feel smooth on calendar days, class date chips, and
  history filter chips.

## Remaining Stage 4 Work

- Live-device acceptance for delete, restore, offline retry, and conflict
  handling against a disposable test account.
- Reliability acceptance for process death during pending mutations,
  simultaneous native/web edits, manual retry, and duplicate prevention.
- Confirm entry calendar behavior on add and edit flows with dense class
  histories.
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
git revert native-phase-4-8-sliding-class-pager-checkpoint..native-phase-4-9-entry-calendar-motion-checkpoint
```

If the tag is unavailable, revert the commit that introduced the checkpoint 9
entry calendar and motion polish. The previous stable native checkpoint remains
`native-phase-4-8-sliding-class-pager-checkpoint`.
