# Native Android Phase 4: Duplicate Entry Checkpoint

## Goal

This checkpoint adds the first non-destructive follow-up workflow after native
create/edit: teachers can duplicate an existing class entry into a new draft
without changing the original entry.

The teacher web app, admin web app, Capacitor app, Firebase rules, and legacy
Firestore document shape are unchanged.

## Completed

- Added a duplicate action beside edit on native class-detail entry cards.
- Routed duplicate actions through a dedicated native Compose editor route.
- Prefilled duplicate drafts from the source entry while stripping the original
  entry id and created timestamp.
- Kept duplicate writes on the existing beta-only create/edit outbox path.
- Gated duplicate availability behind the native create flag, the existing
  editable date window, and non-syncing entry state.
- Isolated duplicate draft recovery from normal new-entry draft recovery so a
  half-finished copy does not replace an ordinary new draft for the class.
- Added model coverage for duplicate draft identity behavior.

## User Behavior

- Teachers can tap the copy action on an eligible entry from the selected date
  section or all-history section.
- The editor opens as "Duplicate entry" with the source topic, notes, tag,
  status, date, and time filled in.
- The duplicate remains a new entry; saving it creates a new mutation and new
  entry id.
- If the copied time overlaps the original entry, the existing validation asks
  the teacher to adjust the time before saving.

## Safety Boundary

- No destructive entry operations were added in this checkpoint.
- No production native write behavior changed; production remains read-only.
- No React teacher web, React admin web, Capacitor, Firebase rules, or Firebase
  document-model files changed.
- Delete, trash, restore, search, filters, and reliability acceptance remain
  future Stage 4 work.
- The unrelated untracked `outputs/` directory and `temp_excerpt.txt` file
  remain untouched.

## Verification

From `native-android/`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :core:model:test :app:compileBetaDebugKotlin
.\gradlew.bat :app:assembleBetaDebug
```

Both verification commands pass for this checkpoint.

The generated beta APK is:

```text
native-android/app/build/outputs/apk/beta/debug/app-beta-debug.apk
```

## Remaining Stage 4 Work

- Complete an authenticated side-by-side teacher-web screenshot pass when a
  test browser session is available.
- Delete entries with confirmation.
- Trash, restore, and recoverable destructive actions.
- Entry search and filters.
- Reliability acceptance for offline create/edit/duplicate, process death,
  reconnect, simultaneous native/web edits, conflicts, manual retry, and
  duplicate prevention.

## Rollback

After the checkpoint tag is created, roll back this UI/workflow checkpoint with:

```powershell
git revert native-phase-4-3-teacher-web-parity-checkpoint..native-phase-4-4-duplicate-entry-checkpoint
```

If the tag is unavailable, revert the commit that introduced the Stage 4.4
duplicate entry changes. The previous stable native checkpoint remains
`native-phase-4-3-teacher-web-parity-checkpoint`.
