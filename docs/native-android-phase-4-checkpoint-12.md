# Native Android Phase 4: Add Class UI and Timetable Slots - Checkpoint 12

## Goal

Fix live beta UX issues found after native class creation:

- replace the crowded Add Class institute chip grid with a dropdown;
- keep Add Class fields visible when the keyboard opens;
- show all available timetable slots on the entry page, matching the web app
  timetable behavior.

This checkpoint builds on checkpoint 11 and is still beta-only.

## Completed

- Replaced Add Class institute selection chips with a Material dropdown.
- Made Add Class keyboard-aware with extra bottom inset so section/subject/save
  controls remain reachable while typing.
- Redesigned the native Home screen to match the supplied reference:
  - warm canvas background;
  - navy Ledgr app mark and circular notification button;
  - large white Today/Visible summary card;
  - rounded institute filter card with 2-column pills;
  - compact colored class rows with institute/subject pills and completion ring.
- Restyled the Add Entry/class page toward the supplied references:
  - same warm canvas background as Home;
  - circular back button on Add Entry;
  - dark class banner with white class title, translucent pills, warning status,
    and darker stat tiles;
  - white rounded calendar with circular month arrows, navy selected day,
    muted disabled dates, red Sundays, and green entry dots;
  - 2-column evenly placed timetable slot buttons;
  - warm start/end picker fields;
  - Topic/Title and Notes fields with icon rail, white rounded panels, muted
    placeholders, required text, and dark rounded Save entry button.
- Follow-up density pass after device review:
  - reduced Home top bar/card/class-row scale to a more practical phone size;
  - reduced Add Entry calendar, timetable chips, start/end pickers, text fields,
    and save button so the screen no longer feels oversized.
- Follow-up visual correction pass after second device review:
  - removed the unnecessary "teacher web app compatible" wording from entry
    surfaces;
  - slightly reduced the sticky class banner and calendar;
  - restored timetable slot/picker proportions to match the supplied reference;
  - rebuilt Topic/Title and Notes inputs so text no longer clips or sits
    mismatched inside the field;
  - added a compact Class history break after the save button so history is
    visually separate from the daily-entry form.
- Timetable slot correction after review:
  - removed grey/dark selected-slot fill from timetable slot chips;
  - changed slot chips to the reference-style white fill, thin border, bold navy
    text;
  - changed slot time separator from a plain hyphen to an en dash.
- Fourth-review timetable slot exact-reference pass:
  - tightened the 2-column slot grid gap and row rhythm;
  - centered slot labels in a stronger title-style weight;
  - kept every timetable slot visually as a plain white outlined pill, including
    used slots, so the row no longer shows a grey selected-chip treatment.
- Home screen readability pass:
  - made institute filter pill text bold with strong black/ink text while
    preserving the existing pill fill colors;
  - made class section names use the same strong ink treatment;
  - increased visibility of institute/subject mini-pills inside class rows with
    stronger text and a clearer white fill.
- Home class-card institute readability follow-up:
  - made institute mini-pills slightly taller than subject pills;
  - increased institute label size and spacing;
  - strengthened the institute mini-pill white fill for better contrast on
    colored class cards.
- Class swipe polish:
  - tuned the class detail and class history horizontal pagers with visible page
    spacing;
  - added a short 210ms snap animation for swifter left/right settles;
  - added subtle scale/fade while dragging so the outgoing and incoming class
    pages are visibly moving instead of feeling like an instant content swap.
- Entry-page card-carousel follow-up:
  - made the Add Entry class pager use stronger carousel scaling from 90% to
    100% as a page settles;
  - increased side reveal and spacing so neighboring class pages read as cards;
  - wrapped entry pages in a rounded elevated surface during pager transforms.
- High-refresh swipe smoothness pass:
  - removed the route rewrite that was recreating pager content after a class
    swipe settled;
  - removed the rounded/elevated wrapper from the live pager transform to reduce
    per-frame work;
  - changed the entry/history pager transform to a lighter 94% to 100% scale
    with subtle alpha only;
  - lengthened the snap to 260ms for a smoother settle on high-refresh devices.
- Home typography consistency pass:
  - changed institute filter pill labels to the same title-style ExtraBold ink
    treatment used by the Home class cards.
- Entry time picker and pager size correction:
  - replaced the analog clock time picker with wheel/drum spinners for hour,
    minute, and AM/PM;
  - removed the entry pager side padding and spacing so the Add Entry page is
    full-size again at rest;
  - kept only the lightweight swipe scale/alpha behavior instead of making the
    whole entry page look like a separate card.
- Add Entry/history/dark-theme pass after review:
  - replaced the small Class history label with a bordered history section card
    below Save entry;
  - made the four status pills taller with stronger outlines and bolder text;
  - added a theme-state composition local so screens can reliably know when the
    app is in dark mode;
  - made Home, Add Entry, Class Entry, and the app bar use theme-aware canvas,
    surface, border, and text colors while preserving the supplied light-mode
    reference;
  - changed first-run theme behavior to follow the device/system theme by
    default;
  - added a System option to the Profile theme selector.
- Added `TeacherTimeSlot` to the native model.
- Added native timetable-slot resolution from the existing web-compatible
  `config/sections` shape:
  - reads institute `gradeGroups`;
  - matches class section;
  - uses section override slots first;
  - falls back to shared group slots;
  - keeps the KIS SIP hardcoded fallback from the web app.
- Added Room cache support for class time slots.
- Bumped Room database to v3 and generated schema `3.json`.
- Rendered timetable slots on the entry editor and inline class-entry editor.
- Timetable slot chips wrap into multiple rows so teachers can see the slots
  at once instead of needing horizontal scrolling.
- Marks already-used slots for the selected date as disabled/done.
- Keeps manual start/end time fields available for off-schedule entries.

## Safety Boundary

- No Firebase rules changed.
- No React web/admin code changed.
- No production class-create flag changed.
- Existing web-compatible Firestore data shape is preserved.
- Existing `outputs/` and `temp_excerpt.txt` remain untouched.
- Checkpoint 11 native class creation remains uncommitted WIP in this worktree.

## Verification

Passed on 2026-06-11 from `native-android/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :core:database:testDebugUnitTest :core:firebase:testDebugUnitTest :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Device install check on 2026-06-11:

```powershell
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r -d native-android\app\build\outputs\apk\beta\debug\app-beta-debug.apk
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.classtracker.app.nativebeta -c android.intent.category.LAUNCHER 1
C:\Users\iamdj\AppData\Local\Android\Sdk\platform-tools\adb.exe shell dumpsys package com.classtracker.app.nativebeta
```

Device `859013c6` was attached. Install succeeded, launch succeeded, process was
running, and package metadata showed `versionCode=11`, `versionName=0.5.3-beta`.
Latest reinstall after the history/status/dark-theme pass showed
`lastUpdateTime=2026-06-11 17:28:27`. Latest reinstall after the timetable
slot exact-reference pass showed `lastUpdateTime=2026-06-11 21:58:08`.
Latest reinstall after the Home readability pass showed
`lastUpdateTime=2026-06-11 22:04:54`. Latest reinstall after the class swipe
polish showed `lastUpdateTime=2026-06-11 22:09:39`. Latest reinstall after the
Home institute mini-pill follow-up showed `lastUpdateTime=2026-06-11 22:11:56`.
Latest reinstall after the entry-page card-carousel follow-up showed
`lastUpdateTime=2026-06-11 22:14:18`. Latest reinstall after the high-refresh
swipe and Home typography consistency pass showed
`lastUpdateTime=2026-06-11 22:18:18`. Latest reinstall after the wheel time
picker and entry pager size correction showed
`lastUpdateTime=2026-06-11 22:21:44`.

Also passed:

```powershell
git diff --check
```

Note: compile emitted only a deprecation warning for `Modifier.menuAnchor()`;
behavior is valid and can be modernized later.

## Manual Acceptance Pending

- Install the beta APK on device.
- Confirm Home visually matches the supplied reference on the phone.
- Confirm Add Entry page visually matches the supplied calendar, class banner,
  timetable, topic/notes, and background references.
- Confirm Home and Add Entry density now feels reasonable on the phone.
- Confirm Add Entry now matches the supplied references for class banner,
  calendar, timetable slots, topic/notes fields, and history separation.
- Confirm dark mode on Home, Add Entry/Class Entry, app bar, and Profile theme
  selector.
- Confirm Home institute filter text, class section names, and institute
  mini-pills are bold/strong enough on device.
- Confirm class detail/history left-right swipes feel swift and visibly animated.
- Open Add Class and confirm institute is a dropdown.
- Tap Class / Section and Subject with keyboard open; confirm fields and Add
  Class button can still be reached.
- Open an existing class with admin timetable slots.
- Confirm all timetable slots appear on Add Entry.
- Confirm timetable slots wrap into visible rows without horizontal scrolling.
- Confirm used slots no longer show a grey selected-chip treatment.
- Confirm custom manual time still works.
- Confirm KIS SIP fallback slots still appear where no admin timetable config
  exists.

## Suggested Next Tag

After final review and live-device acceptance:

```powershell
git tag native-phase-4-12-add-class-timetable-slots-checkpoint
```

## Next Work

- Live-device acceptance and APK install.
- Commit/tag checkpoint 11 and 12 together or split them cleanly.
- Continue Phase 4 reliability polish:
  - conflict behavior for class create;
  - offline/durable class-create decision;
  - manual retry UX;
  - broader entry editor polish.
