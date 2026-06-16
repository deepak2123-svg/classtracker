# Native Android home drag visual checkpoint 1

Date: 2026-06-16

## Current state

Teacher beta home screen visual polish is implemented and installed on the connected device, but not committed or pushed.

## Completed work

- Kept the home class card border style as the shared visual language.
- Applied the same strong border treatment to institute filter pills so they match the section/class cards.
- Changed the class-card logged indicator to a stronger dark-green marker:
  - logged classes now show a dark green outlined circle with a filled green center;
  - unlogged classes stay neutral gray.
- Added a small three-bar drag-handle affordance on every class card so the user can understand the cards can be dragged up/down.
- Kept existing card fill colors, class names, institute pills, and subject pills intact.

## Files changed

- `native-android/feature/today/src/main/kotlin/com/classtracker/feature/today/HomeScreen.kt`
- `docs/native-android-home-drag-visual-checkpoint-1.md`

## Verified

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :feature:today:compileDebugKotlin :app:compileBetaDebugKotlin --console=plain
```

Result: build successful.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
.\gradlew.bat :app:installBetaDebug --console=plain
```

Result: installed on connected device `859013c6`.

## Not touched

- Unrelated untracked `outputs/`.
- Unrelated `temp_excerpt.txt`.
- PDF chart prototype outputs under `output/`.
- Admin web app.
- Teacher web app.

## Next checks

1. Open the installed beta app on the phone and verify:
   - logged class indicator is clearly dark green;
   - unlogged class indicator remains neutral;
   - institute filter pills now have section-card-like borders;
   - drag handle feels visible but not noisy.
2. If the user wants actual class reordering persistence, implement the drag/drop behavior and save the order per teacher.
3. Continue pending Phase 5/6 work: syllabus report integration polish, admin PDF institute charts, and any remaining Android acceptance checks.
