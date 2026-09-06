# 01 — Platform Layer: SGP + Utils + ext (Web Port Reference)

**Consumer:** web-port agent building the Next.js/Canvas/WebAudio clone.
**Source root:** `/Users/fsodano/fibradev/games/granaderos/engine/`
**Scope:** `sgp/` (Standard Gaming Platform), `Utils/` (game-side helpers), `ext/` (vendored libs: VFS, lua-5.1.5, libsmacker, libpng, zlib), plus the main loop in `Ja2/gameloop.cpp` and `sgp/sgp.cpp`.
**Rule:** every subsystem below lists key structs/functions with `file:line` anchors, a Web API mapping table, and port notes. Do not touch engine code; this document is read-only reference.

---

## 1. Architecture Overview

SGP ("Standard Gaming Platform") is the JA2 v1.13 hardware-abstraction layer. It wraps Win32 + DirectDraw 7 + FMOD into a game-facing API: surfaces, video objects (ETRLE-compressed sprites), fonts, buttons, mouse regions, input atoms, file handles, memory, and a millisecond clock. `Utils/` builds game logic on top (event queue, timer callbacks, music, INI config, popup UI). `ext/` provides the virtual filesystem (bfVFS), Lua scripting, Smacker video decode, and PNG/zlib codecs.

Layering (bottom → top):

```
Win32/DirectDraw/FMOD (native only)
  └─ sgp/  (video.cpp, vsurface.cpp, vobject.cpp, himage.cpp, Font.cpp, Button System.cpp,
            Cursor Control.cpp, mousesystem.cpp, input.cpp, FileMan.cpp, MemMan.cpp,
            Random.cpp, soundman.cpp, STCI/PCX/PngLoader, DirectDraw Calls.cpp, DirectX Common.cpp)
       └─ Utils/  (Event Pump.cpp, Timer Control.cpp, Music Control.cpp, Cursors.cpp,
                   INIReader.cpp, Quantize.cpp, STIConvert.cpp, Slider.cpp, PopUpBox.cpp,
                   MercTextBox.cpp, KeyMap.cpp, Font Control.cpp, Sound Control.cpp)
            └─ Ja2/  (gameloop.cpp GameLoop(), jascreens.cpp screen manager)
                 └─ Strategic/ + Tactical/ (game logic)
```

Web port strategy: **replace the bottom two layers** (Win32/DirectDraw/FMOD and most of sgp's rasterizers) with Canvas 2D/WebGL + WebAudio + fetch/IndexedDB, and **port the game-logic-facing API surface** (button IDs, mouse regions, input atoms, fonts, file handles) as a compatibility shim so `Utils/` and game code port with minimal change.

---

## 2. Main Loop & Timing

### 2.1 Win32 message pump (native entry)

- `WinMain` — `sgp/sgp.cpp:697`. Sets up SGP, then enters the message pump.
- Pump: `while (gfProgramIsRunning) { GetMessage; TranslateMessage; DispatchMessage; }` — `sgp/sgp.cpp:846`. `gfProgramIsRunning` is the global kill switch (`sgp/sgp.h:16`); `SGPExit()` (`sgp/sgp.cpp:901`) clears it and runs `ShutdownStandardGamingPlatform()`.
- The window proc calls `GameLoop()` per idle message via `CallGameLoop(false)` — `sgp/sgp.cpp:539`; `CallGameLoop` (`sgp/sgp.cpp:1376`) wraps `SGPGameLoop()` (`sgp/sgp.cpp:1346`) in a critical section + SEH exception filter (5 retries, then `ShutdownWithErrorBox`).

### 2.2 GameLoop() — one tick per frame

`void GameLoop(void)` — `Ja2/gameloop.cpp:226`. Per-frame order (this is the tick contract a web port must reproduce):

1. `ResizeWorldItems()` if a mouse button is down (`gameloop.cpp:235`).
2. `GetCursorPos` + `ScreenToClient` → window coords (`gameloop.cpp:239`).
3. `MouseSystemHook(MOUSE_POS, x, y, ...)` — feed current mouse pos into MSYS (`gameloop.cpp:244`).
4. `MusicPoll(FALSE)` — advance music state machine (`gameloop.cpp:246`).
5. Drain mouse events: `while (DequeueSpecificEvent(&InputEvent, LEFT/RIGHT/MIDDLE/X1/X2_BUTTON_* | MOUSE_WHEEL_UP|DOWN))` → `MouseSystemHook(...)` per event (`gameloop.cpp:251`).
6. Screen-change handling: `guiPendingScreen` → `HandleNewScreenChange` → `GameScreens[guiCurrentScreen].HandleScreen()` (`gameloop.cpp:351-393`).
7. `RenderRain()`, tactical ambients, dynamic-opinion refresh (`gameloop.cpp:396-411`).
8. `RefreshScreen(NULL)` unless `gfSkipFrame` (`gameloop.cpp:448-454`) — this is where the frame buffer is blitted to the primary surface.
9. `guiGameCycleCounter++` (`gameloop.cpp:456`).
10. `UpdateClock()` (`gameloop.cpp:459`) — advances the JA2 clock (see 2.3).

**Web mapping:** `requestAnimationFrame` replaces the message pump; one `GameLoop()` tick = one rAF callback. `gfSkipFrame` maps to a frame-skip flag. `GetCursorPos/ScreenToClient` → `event.clientX/Y` minus canvas bounding rect. `RefreshScreen` → composite the offscreen canvas to the visible canvas.

### 2.3 Clock & timer callbacks

- `sgp/timer.h` — `TIMER` is `UINT32` ms; `GetClock()`, `SetCountdownClock()`, `ClockIsTicking()` (`timer.h:20-24`); `InitializeClockManager`/`ShutdownClockManager` (`timer.h:20-21`).
- `Utils/Timer Control.h` — the game clock:
  - `guiBaseJA2Clock` / `guiBaseJA2NoPauseClock` (`Timer Control.h:101-102`), `GetJA2Clock()` / `GetJA2NoPauseClock()` macros (`Timer Control.h:68-70`).
  - Timer ID enum `TOVERHEAD..NUMTIMERS` (`Timer Control.h:22-51`) — 30 named timers (overhead slice, scroll, tile anim, FPS counter, cursor, click delays, physics, music, etc.).
  - `giTimerIntervals[NUMTIMERS]` / `giTimerCounters[NUMTIMERS]` (`Timer Control.h:54-56`).
  - `UpdateCounter(INT32)` / `ResetCounter` / `CounterDone` (`Timer Control.h:110-112`), `UpdateTimeCounter`/`TimeCounterDone`/`ZeroTimeCounter` (`Timer Control.h:113-115`).
  - `SetCustomizableTimerCallbackAndDelay(INT32, CUSTOMIZABLE_TIMER_CALLBACK, BOOLEAN)` + `CheckCustomizableTimer()` (`Timer Control.h:80-81`) — the CALLBACKTIMER mechanism (used by item locator).
  - `PauseTime(BOOLEAN)` (`Timer Control.h:78`), fast-forward controls (`Timer Control.h:83-92`), `IsHiSpeedClockMode` (`Timer Control.h:97-98`).
- `Utils/Timer Control.cpp`:
  - `InitializeJA2Clock()` — `Timer Control.cpp:391`; `ShutdownJA2Clock()` — `:455`.
  - `GetJA2Clock()` — `:798`; `GetJA2NoPauseClock()` — `:805`; `UpdateTimer()` — `:833` (the per-frame accumulator).
  - `InitializeJA2TimerID(uiDelay, uiCallbackID, uiUser)` — `:519`; `RemoveJA2TimerCallback` — `:513`; `InitializeJA2TimerCallback` (Win32 `timeSetEvent` wrapper) — `:486`.
  - `SetCustomizableTimerCallbackAndDelay` — `:550`; `CheckCustomizableTimer` — `:565`.
  - `UpdateCounter` — `:755/:761`; `CounterDone` — `:772`; `UpdateTimeCounter` — `:739`; `TimeCounterDone` — `:782`.
  - `PauseTime` — `:545`; fast-forward — `:611-644`; `SetClockSpeedPercent` — `:826`.
  - `AddTimerNotifyCallback`/`RemoveTimerNotifyCallback`/`ClearTimerNotifyCallbacks` — `:654/:674/:687`.
  - `IsJA2TimerThread()` — `:792` (TRUE only on the Win32 multimedia-timer thread; see §9 thread hazards).

**Web mapping:**

| Native | Web |
|---|---|
| `GetJA2Clock()` (ms, pause-aware) | `performance.now()` minus accumulated paused time; keep a `gameClockMs` accumulator advanced in rAF |
| `GetJA2NoPauseClock()` | raw `performance.now()` |
| `UpdateTimer()` per frame | called once per rAF before `GameLoop()` |
| `UpdateCounter/CounterDone` (interval-based) | `(now - lastReset) >= interval` check in rAF |
| `InitializeJA2TimerID` (Win32 `timeSetEvent` thread) | `setTimeout`/`setInterval` — **do not run game logic on it**; post to the main loop instead |
| `SetCustomizableTimerCallbackAndDelay` | single `setTimeout` re-armed by `CheckCustomizableTimer()` |
| `PauseTime` | stop advancing `gameClockMs`; keep rendering |
| Fast-forward (`SetFastForwardPeriod/Key/Mode`) | multiply `dt` or run N loop iterations per rAF (`GetFastForwardLoopCount`) |

---

## 3. Input Pipeline

### 3.1 Input atoms & event queue

- `sgp/input.h` — event bit flags `KEY_DOWN/KEY_UP/KEY_REPEAT/LEFT_BUTTON_*/RIGHT_BUTTON_*/MOUSE_POS/MOUSE_WHEEL_UP/DOWN/MIDDLE/X1/X2` (`input.h:10-32`); modifier bits `SHIFT_DOWN/CTRL_DOWN/ALT_DOWN` (`input.h:34-36`); `DBL_CLK_TIME=300ms`, `BUTTON_REPEAT_TIMEOUT=250`, `BUTTON_REPEAT_TIME=50` (`input.h:39-41`).
- `InputAtom` struct — `input.h:43-51` (`uiTimeStamp, usKeyState, usEvent, usParam, uiParam`; mouse X/Y packed into `uiParam`).
- `StringInput` struct — `input.h:58-72` (text-entry state machine: filter, max length, insert mode, focus, linked list).
- Globals: `gfKeyState[256]`, `gusMouseXPos/YPos`, `gsMouseWheelDeltaValue`, `gfLeft/Right/MiddleButtonState` (`input.h:119-126`); convenience macros `_KeyDown(a)`, `_LeftButtonDown`, `_MouseXPos`, `_gusMouseInside(...)` (`input.h:130-139`).
- `sgp/input.cpp`:
  - `InitializeInputManager` — `:231`; `ShutdownInputManager` — `:275`.
  - `QueueEvent` — `:448`; `InternalQueueEvent` — `:324`; `QueuePureEvent` — `:286`.
  - `DequeueEvent` — `:518`; `DequeueSpecificEvent` — `:458`; `PeekSpecificEvent` — `:1712`; `DequeueAllKeyBoardEvents` — `:1632`.
  - `KeyChange` — `:535` (core key→atom translation, uses `gsKeyTranslationTable`); `KeyDown` — `:1012`; `KeyUp` — `:1057`.
  - `HandleSingleClicksAndButtonRepeats` — `:1656` (implements DBL_CLK_TIME / BUTTON_REPEAT_* semantics).
  - String input: `RedirectToString` — `:1258`; `SetStringFocus` — `:1447`; `EndStringInput` — `:1522`; `GetStringInputState` — `:1430`.
  - Mouse clamp: `RestrictMouseToXYXY` — `:1549`; `RestrictMouseCursor` — `:1561`; `FreeMouseCursor` — `:1571`; `SimulateMouseMovement` — `:1610`.
  - `GetMouseWheelDeltaValue` — `:1705`.

### 3.2 Keymap (English.cpp)

- `sgp/english.h` — virtual-key constants: `SHIFT=16, CTRL=17, ALT=18` (`english.h:6-8`), `F1..F12=124..135` (`english.h:10-21`), shifted/alt/ctrl combos (`english.h:23-60`), `ESC=27, TAB=9, ENTER=13, SPACE=32` (`english.h:62-126`), arrows/nav `245..254` (`english.h:71-82`), `CURSOR=1023` (`english.h:123`).
- `sgp/English.cpp:8` — `UINT16 gsKeyTranslationTable[1024]` — the **scan-code → JA2 virtual key** table. This is the keymap a web port must reproduce (browser `KeyboardEvent.code` → JA2 key id). Note the table is 1024 entries: base key + SHIFT(+256) + ALT(+512) + CTRL(+768) offsets, matching the `SHIFT_F1=368` style constants.

### 3.3 Mouse regions (MSYS)

- `sgp/mousesystem.h` — `MOUSE_REGION` struct (rect, priority, cursor, callbacks, user data, fast-help text), `MOUSE_HELPTEXT_DONE_CALLBACK`.
- `sgp/mousesystem.cpp`:
  - `MSYS_Init` — `:129`; `MSYS_Shutdown` — `:211`.
  - `MSYS_SGP_Mouse_Handler_Hook` — `:229` (Win32 mouse-message entry; converts to region events).
  - `MSYS_DefineRegion` — `:953`; `MSYS_AddRegion` — `:1046`; `MSYS_RemoveRegion` — `:1059`; `MSYS_EnableRegion`/`MSYS_DisableRegion` — `:1128/:1142`.
  - `MSYS_UpdateMouseRegion` — `:644` (hit-test + priority resolution + callback dispatch: move/click/drag).
  - `MSYS_ChangeRegionCursor` — `:1019`; `MSYS_SetCurrentCursor` — `:1153`; `MSYS_GrabMouse`/`MSYS_ReleaseMouse` — `:1225/:1245`.
  - `MSYS_SetRegionUserData`/`MSYS_GetRegionUserData` — `:1180/:1202`.
  - Fast help (tooltips): `SetRegionFastHelpText` — `:1320`; `RenderFastHelp` — `:1588`; `DisplayFastHelp` — `:1397`; `SetFastHelpDelay` — `:1848`.
  - `MSYS_MoveMouseRegionTo/By` — `:1266/:1295`.

### 3.4 Cursor rendering (two layers)

- **SGP cursor database** — `sgp/Cursor Control.h`: `CursorFileData` (`:52-61`), `CursorImage` (`:63-71`), `CursorData` (`:73-84`, composites + offsets + flags), `SetCurrentCursorFromDatabase` (`:21`), `LoadCursorData` (`:18`), `InitCursorDatabase` (`:102`), `SetMouseBltHook` (`:103`), `SetExternVOData` (`:105`).
- `sgp/Cursor Control.cpp`: `InitCursorDatabase` — `:70`; `LoadCursorData` — `:86`; `SetCurrentCursorFromDatabase` — `:308`; `BltToMouseCursorFromVObject` — `:34`; `BltToMouseCursorFromVObjectWithOutline` — `:43`; `SetMouseBltHook` — `:568`; `CursorDatabaseClear` — `:287`.
- **Game cursor modes** — `Utils/Cursors.h`: `CursorTypeDefines` enum (~150 logical cursors, `:6-195`) and `CursorSurfaceDefines` enum (STI files, `:197-301`); `InitCursors` (`:308`), `HandleAnimatedCursors` (`:309`), `SetCursorSpecialFrame` (`:314`), `SetCursorFlags`/`RemoveCursorFlags` (`:316-318`), `RaiseMouseToLevel` (`:306`).
- `Utils/Cursors.cpp`: `InitCursors` — `:1410`; `HandleAnimatedCursors` — `:1419`; `DrawMouseGraphics` — `:1556`; `DrawMouseGraphicsNCTH` — `:1468`; `BltJA2CursorData` — `:1639`; `UpdateAnimatedCursorFrames` — `:1861`; `GetCursorFileVideoObject` — `:1976`.

**Web mapping (input pipeline):**

| Native | Web |
|---|---|
| Win32 `WM_KEYDOWN/UP` → `KeyChange` → `QueueEvent` | `keydown`/`keyup` → `KeyboardEvent.code` → `gsKeyTranslationTable` equivalent → atom queue |
| `InputAtom` queue + `DequeueSpecificEvent(mask)` | typed-array/ring-buffer queue; `dequeueSpecific(mask)` filter |
| `DBL_CLK_TIME`/`BUTTON_REPEAT_*` in `HandleSingleClicksAndButtonRepeats` | `setTimeout`-free: track `lastClickTime`/`lastRepeatTime` in the rAF tick |
| `MOUSE_REGION` hit-test + priority in `MSYS_UpdateMouseRegion` | z-ordered region list; per-pointer hit-test on `pointermove` |
| `MouseSystemHook` per event | dispatch from `pointerdown/up/move/wheel` handlers |
| `RestrictMouseToXYXY` | clamp pointer coords (or `Pointer Lock` for tactical) |
| Hardware cursor blit (`BltToMouseCursorFromVObject`) | `canvas.style.cursor` with data-URL, or draw cursor sprite last in the composite |
| `StringInput` text entry | `<input>` overlay or manual `keydown` char assembly (respect `pFilter`) |

---

## 4. File Abstraction (FileMan + VFS + SLF/7ZIP)

### 4.1 FileMan API

- `sgp/FileMan.h` — flags: `FILE_ACCESS_READ/WRITE/READWRITE` (`:35-37`), `FILE_CREATE_NEW/ALWAYS/OPEN_EXISTING/OPEN_ALWAYS/TRUNCATE_EXISTING` (`:39-43`), `FILE_SEEK_FROM_START/END/CURRENT` (`:45-47`); `GETFILESTRUCT` (`:112-117`); `MAX_FILENAME_LEN=48` (`:33`).
- `sgp/FileMan.cpp`:
  - `InitializeFileManager(STR strIndexFilename)` — `:151` (loads the SLF index); `ShutdownFileManager` — `:175`.
  - `FileExists` — `:205`; `FileDelete` — `:257`; `FileOpen` — `:287` (returns `HWFILE`); `FileClose` — `:350`.
  - `FileRead` — `:407`; `FileReadLine` — `:443`; `FileWrite` — `:486`; `FileLoad` — `:545`; `FilePrintf` — (declared `FileMan.h:96`).
  - `FileSeek` — `:636`; `FileGetPos` — `:710`; `FileGetSize` — `:756`; `FileSize` — `:914`; `FileCheckEndOfFile` — `:885`.
  - Directory: `SetFileManCurrentDirectory` — `:767`; `GetFileManCurrentDirectory` — `:782`; `GetExecutableDirectory` — `:821`; `RemoveFileManDirectory` — `:803`; `EraseDirectory` — `:814`.
  - `GetFileFirst`/`GetFileNext`/`GetFileClose` — `:830/:854/:878` (directory enumeration).
  - `SoundFileExists` — `:926` (probes mp3/ogg/wav variants).

### 4.2 bfVFS (ext/VFS)

- `ext/VFS/README` — bfVFS: mounts directories + read-only archives (SLF and uncompressed 7-Zip) into one virtual tree.
- Core: `ext/VFS/src/Core/vfs_init.cpp` — reads a VFS config (INI-style) with `MOUNT_POINT` per location (`:154`); per extension dispatch: `.slf` → `vfs::CSLFLibrary` (`:260-263`), `.7z` → `vfs::CUncompressed7zLibrary` (`:267-272`), else `CDirectoryTree`/`CReadOnlyDirectoryTree` (`:309/:315`).
- Ext: `ext/VFS/src/Ext/slf/vfs_slf_library.cpp` (SLF archive reader), `ext/VFS/src/Ext/7z/vfs_7z_library.cpp` + `vfs_create_7z_library.cpp` (uncompressed 7z).
- API surface: `vfs::Path`, `vfs::PropertyContainer` (used by `CIniReader`), `vfs::Exception` (caught in `sgp.cpp:863`), `vfs::File`/RAII (`vfs_file_raii.cpp`), `vfs::VFile` (`vfs_vfile.cpp`), `vfs::VLocation` (`vfs_vloc.cpp`), `vfs::Profile` (`vfs_profile.cpp`).

### 4.3 Gamedir layout (native install)

`engine/gamedir/` contains: `Ja2.ini` (main config), `Base/` (original JA2 data), `Data-1.13/` (mod data: `Ja2Set.dat.xml`, `Ja2_Options.INI`, `APBPConstants.ini`, `CTHConstants.ini`, `Item_Settings.ini`, `Laptop/`, `Interface/`, `IMPFaces/`, `BinaryData/`, `BattleSNDS/`, `IntroVideos.ini`), `Data-UB/`, `Profiles/` (saved games), `Shaders/`, plus `ddraw.dll`/`cnc-ddraw config.exe` (DirectDraw wrapper, detected at `sgp.cpp:936`).

**Web mapping (file abstraction):**

| Native | Web |
|---|---|
| `FileOpen/FileRead/FileSeek/FileGetSize` | `fetch()` + `ArrayBuffer`/`DataView` cursor wrapper; or preloaded `Uint8Array` per asset |
| `FileLoad` (whole file) | `await fetch(url).arrayBuffer()` |
| `FileExists` | HEAD request or prebuilt manifest lookup |
| `FileReadLine` | `TextDecoder` + split on `\n` |
| `GetFileFirst/Next` (dir enum) | prebuilt asset manifest (JSON) — browsers cannot enumerate dirs |
| `InitializeFileManager(SLF index)` | fetch SLF index once; build `path → {offset,size}` map |
| SLF/7z archives | decode at build time (offline) into `public/`; or runtime `DecompressionStream('deflate')` for zlib members |
| `SetFileManCurrentDirectory` | virtual path prefix (no real cwd on web) |
| `Profiles/` saves | IndexedDB (key: save slot) + export/import via File System Access API |
| `Ja2.ini` + `*.ini` | fetch + INI parser (see §7.5 INIReader) |
| `SoundFileExists` (mp3/ogg/wav probe) | try `fetch` per candidate extension |

---

## 5. RNG Semantics (save-compat critical)

- `sgp/random.h` — `MAX_PREGENERATED_NUMS = 256` (`:9`) with the warning: *changing this invalidates JA2 saves*.
- Two implementations selected by `#ifdef BMP_RANDOM` (`random.h:12`):
  - **BMP_RANDOM (default, must keep):** `guiPreRandomIndex` + `guiPreRandomNums[256]` (`random.h:14-15`); `Random(uiRange)` inline → `NewRandom` or `GetRndNum` depending on `gGameExternalOptions.fNewRandom` (`random.h:24-30`); `Chance(uiChance)` = `Random(100) < uiChance` (`random.h:37-40`); `PreRandom`/`PreChance` are **aliases of Random** in this build (`random.h:42-51`) — used to deter save-scumming.
  - **Legacy (non-BMP):** `Random` = `rand()*uiRange/RAND_MAX%uiRange` (`random.h:70-76`); `PreRandom` consumes the pregenerated table with half-table refill (`random.h:102-127`).
- `sgp/Random.cpp`:
  - `NewRandom(max)` — `:48` — `std::mt19937 gRandomNumberGenerator` seeded from `std::random_device` (`:45-46`), `std::uniform_int_distribution<int>(0, max-1)` (`:58`). **Unbiased, but NOT deterministic across platforms** — never use for save-critical rolls.
  - `GetRndNum(maxnum)` — `:64` — legacy LCG-ish: re-seeds `srand` every `RAND_MAX` calls from cursor pos + tick count (`:72-76`), then `rnd = rand(); rnd<<=11; rnd^=rand(); rnd<<=7; rnd^=rand(); return rnd % maxnum` (`:79-84`). **Deterministic given the same `rand()` sequence** — this is what save compat depends on.
  - `InitializeRandom()` — `:87` — pregenerates all 256 values via `GetRndNum(0xFFFFFFFF)` and resets the index (`:90-92`).
  - Multiplayer: `MPPreRandom` — `:12` (networked clients use server-provided numbers).

**Web port rules (save compat):**
1. Reimplement `GetRndNum` **exactly** (same shift/xor chain, same `% maxnum`). The MSVC `rand()` sequence (LCG, seed→`srand`) must be emulated — implement MSVC's `rand()` LCG (`state = state*214013+2531011; return (state>>16)&0x7fff`) rather than calling `Math.random()`.
2. Keep `guiPreRandomNums[256]` + `guiPreRandomIndex` semantics identical; `InitializeRandom` must produce the same table for the same seed inputs (cursor pos/time are the only entropy — on web substitute `performance.now()` + pointer pos).
3. `NewRandom` (mt19937) may map to `Math.random()`-based `Math.floor(Math.random()*max)` — it is explicitly the non-save-critical path (`fNewRandom` option).
4. Never reorder `Random()` call sites relative to save/load; the pregenerated table is the anti-save-scum contract.

---

## 6. Per-Subsystem Reference & Web Mapping

### 6.1 Button System (`sgp/Button System.h/.cpp`)

Key structs: `GUI_BUTTON` (`Button System.h:97-142` — ID, image, `MOUSE_REGION Area`, click/move callbacks, cursor, flags, text/font/colors, icon, sound scheme), `BUTTON_PICS` (`:153-163` — 5-state image slots: Grayed/OffNormal/OffHilite/OnNormal/OnHilite), `ButtonList` vector (`:148`), `MAX_BUTTONS=400` (`:145`), `MAX_BUTTON_PICS=256` (`:165`). Flags: `BUTTON_TOGGLE/QUICK/ENABLED/CLICKED_ON/NO_TOGGLE/GENERIC/HOT_SPOT/CHECKBOX/...` (`:49-68`). Default images `GENBUTN.STI` etc. (`:19-22`).

Key functions (impl): `InitButtonSystem` — `Button System.cpp:1189`; `ShutdownButtonSystem` — `:1226`; `QuickCreateButton` — `:1898`; `CreateEasyNoToggleButton` — `:2043`; `CreateEasyToggleButton` — `:2048`; `CreateEasyNewToggleButton` — `:2053`; `CreateEasyButton` — `:2059`; `CreateSimpleButton` — `:2065`; `CreateCheckBoxButton` — `:4009`; `CreateIconButton` — `:1517`; `CreateTextButton` — `:1646`; `CreateHotSpot` — `:1789`; `CreateIconAndTextButton` — `:2089`; `LoadButtonImage` — `:184`; `UseLoadedButtonImage` — `:309`; `UseVObjAsButtonImage` — `:438`; `LoadGenericButtonImages` — `:988`; `RenderButtons` — `:2851`; `DrawButton` — `:3002`; `DrawQuickButton` — `:3082`; `DrawGenericButton` — `:3581`; `DrawCheckBoxButton` — `:3226`; `DrawIconOnButton` — `:3284`; `DrawTextOnButton` — `:3391`; `EnableButton` — `:633`; `DisableButton` — `:671`; `RemoveButton` — `:1260`; `HideButton`/`ShowButton` — `:4159/:4175`; `SpecifyButtonText` — `:2227`; `SpecifyButtonIcon` — `:2418`; `SetButtonCursor` — `:1882`; `BtnGenericMouseMoveButtonCallback` (default move cb) — `:4058`; `QuickButtonCallbackMMove/MButn` — `:2568/:2671`; dirty tracking `MarkButtonsDirty` — `:2943`, `UnmarkButtonsDirty` — `:2966`.

| Native | Web |
|---|---|
| `GUI_BUTTON` + `ButtonList[400]` | React component state or plain object registry keyed by button ID |
| 5-state `BUTTON_PICS` (Grayed/Off/OffHi/On/OnHi) | 5 `<img>`/sprite frames; `:hover`/`:active`/`disabled` CSS or state-driven frame swap |
| `ClickCallback`/`MoveCallback` (`GUI_CALLBACK`) | `onClick`/`onMouseEnter`/`onMouseLeave` handlers |
| `RenderButtons()` + dirty flags | React re-render of dirty buttons only; or canvas redraw of marked rects |
| `BUTTON_TOGGLE/NO_TOGGLE/NEWTOGGLE` | `useState` toggle semantics |
| `SpecifyButtonText/Font/Colors` | CSS font/color props; shadow = `text-shadow` |
| `CreateHotSpot` | transparent `<div>` hit area |
| `SetButtonCursor` | `style.cursor` |
| Button sounds (`SpecifyButtonSoundScheme`, `Button Sound Control.cpp`) | WebAudio one-shots per event (click on/off, move on/off, disabled) |

### 6.2 Cursor Control (`sgp/Cursor Control.h/.cpp`)

Structs: `CursorFileData` (`Cursor Control.h:52-61`), `CursorImage` (`:63-71`), `CursorData` (`:73-84`). Flags `ANIMATED_CURSOR=0x02`, `USE_EXTERN_VO_CURSOR=0x04`, `USE_OUTLINE_BLITTER=0x08` (`:23-25`); `MAX_COMPOSITES=5` (`:29`); `CENTER_SUBCURSOR=31000`, `HIDE_SUBCURSOR=32000` (`:30-31`); `CENTER/RIGHT/LEFT/TOP/BOTTOM_CURSOR` (`:33-37`); animation flags `CURSOR_TO_FLASH/FLASH2/SUB_CONDITIONALLY/DELAY_START/PLAY_SOUND` (`:39-43`). Globals `gsCurMouseOffsetX/Y`, `gsCurMouseHeight/Width` (`:89-92`).

Impl: `InitCursorDatabase` — `Cursor Control.cpp:70`; `LoadCursorData` — `:86`; `SetCurrentCursorFromDatabase` — `:308`; `UnLoadCursorData` — `:254`; `CursorDatabaseClear` — `:287`; `SetMouseBltHook` — `:568`; `SetExternVOData` — `:575`; `RemoveExternVOData` — `:606`.

| Native | Web |
|---|---|
| Cursor STI frames + composites | pre-decoded sprite atlas; composite = draw N frames at offsets |
| `SetCurrentCursorFromDatabase` | set `cursorId` state; renderer picks frames |
| `ANIMATED_CURSOR` + `CURSORCOUNTER` timer | rAF frame advance (see `Utils/Cursors.cpp:1861`) |
| `USE_OUTLINE_BLITTER` | draw 1px outline pass before sprite |
| `HIDE_SUBCURSOR` | skip drawing that composite |
| `SetMouseBltHook` | custom cursor draw callback |

### 6.3 Font (`sgp/Font.h/.cpp` + `WinFont`)

- `Font.h`: `MAX_FONTS=25` (`:12`); shadow constants `DEFAULT_SHADOW=2`, `MILITARY_SHADOW=67`, `NO_SHADOW=0` (`:14-16`); palette-index color symbols `FONT_FCOLOR_*`/`FONT_BCOLOR_*` (`:21-39`); `FontTranslationTable` (`:45-50`); `SetFontDestBuffer` macro family (`:63-79`).
- API: `SetFont` — `Font.cpp:773`; `SetFontForeground` — `:115`; `SetFontBackground` — `:180`; `SetFontShadow` — `:143`; `SetFontColors` — `:92`; `SetRGBFontForeground/Background/Shadow` — `:211/:225/:239` (+16-bit overloads `:248/:260`); `SetFontDestBuffer` — `:792`; `LoadFontFile` — `:385`; `InitializeFontManager` — `:1255`; `ShutdownFontManager` — `:1313`; `UnloadFont` — `:423`; `GetFontHeight` — `:716`; `GetFontObject` — `:353`; `IsFontLoaded` — `:339`; `mprintf` — `:817`; `gprintf` — `:924`; `gprintfDirty` — `:974`; `mprintf_buffer` — `:1071`; `gprintf_buffer` — `:1035`; `mprintf_coded` — `:1174` (color-code escapes `FONT_CODE_BEGINCOLOR=180`/`RESETCOLOR=181`, `Font.h:112-113`); `StringPixLength` — `:587`; `StringNPixLength` — `:561`; `SubstringPixLength` — `:628`; `StringPixLengthArg` — `:462`; `GetWidth` — `:437`; `GetIndex` — `:739`; `FindFontCenterCoordinates` — `:904`; `FindFontRightCoordinates` — `:892`; `SaveFontSettings`/`RestoreFontSettings` — `:652/:675`; `CreateEnglishTransTable`/`DestroyEnglishTransTable` — `Font.h:128/:101`.
- Fonts are ETRLE-compressed STI images with per-glyph sub-images; `WinFont.h/.cpp` adds GDI-font fallback (native only).

| Native | Web |
|---|---|
| STI font glyphs (ETRLE) | decode once to per-glyph `ImageBitmap`/canvas sprites; or re-render with a TTF that matches metrics |
| `SetFontDestBuffer` (surface + clip rect) | `ctx.save(); ctx.beginPath(); ctx.rect(clip); ctx.clip();` |
| `SetFontForeground/Background/Shadow` | `ctx.fillStyle`; shadow = `ctx.shadowColor/shadowBlur` or offset dark pass |
| `mprintf/gprintf` (formatted) | `ctx.fillText` with same format string |
| `StringPixLength` (measure) | `ctx.measureText().width` |
| `mprintf_coded` color escapes | parse `\x180...\x181` spans into per-segment fillStyle |
| `FindFontCenterCoordinates` | `measureText` + centering math |
| `FontTranslationTable` (char remap) | JS `Map<codePoint, glyphIndex>` |

### 6.4 FileMan — see §4.

### 6.5 MemMan (`sgp/MemMan.h/.cpp`)

- `MemMan.h`: `MemAlloc/MemFree/MemRealloc` macros — release build = `malloc/free/realloc` (`:87-89`); debug variants with file/line (`:74-79`); `EXTREME_MEMORY_DEBUGGING` variants (`:63-68`); `MemAllocLocked`/`MemFreeLocked` (`:95-96`); `MemGetFree` (`:99`); `MemGetTotalSystem` (`:102`); `MemCheckPool` (`:104`); counters `guiMemTotal/Alloced/Freed` (`:48-50`).
- Impl: `InitializeMemoryManager` — `MemMan.cpp:130`; `ShutdownMemoryManager` — `:183`; `MemAllocReal` — `:232`; `MemFreeReal` — `:265`; `MemReallocReal` — `:295`; `MemAllocLocked` — `:342`; `MemFreeLocked` — `:373`; `MemGetFree` — `:417`; `MemGetTotalSystem` — `:442`; `MemCheckPool` — `:467`; `DumpMemoryInfoIntoFile` — `:649`.

| Native | Web |
|---|---|
| `MemAlloc/MemFree` | JS GC — no-op shim; keep the macros for source compat |
| `MemAllocLocked` (page-locked) | no-op (no DMA on web) |
| `MemGetFree/MemGetTotalSystem` | `navigator.deviceMemory` (approx) or fixed budget |
| `MemCheckPool` | no-op returning TRUE |
| Debug leak dump | dev-only: track allocations in a `Map` for leak reports |

### 6.6 Random — see §5.

### 6.7 Image loaders: STCI / PCX / PNG / JPC

- **STCI** (`sgp/imgfmt.h`): `STCIHeader` 64-byte header (`imgfmt.h:31-66`), `STCISubImage` (`:70-78`), `STCIPaletteElement` (`:82-87`); flags `STCI_ETRLE_COMPRESSED=0x20`, `STCI_ZLIB_COMPRESSED=0x10`, `STCI_INDEXED=0x8`, `STCI_RGB=0x4`, `STCI_ALPHA=0x2`, `STCI_TRANSPARENT=0x1` (`:16-21`); ETRLE run codes `COMPRESS_TRANSPARENT=0x80`, `COMPRESS_NON_TRANSPARENT=0x00`, `COMPRESS_RUN_LIMIT=0x7F` (`:24-26`). `sgp/STCI.h`: `LoadSTCIFileToImage` (`:3`), `IsSTCIETRLEFile` (`:5`). Impl: `LoadSTCIFileToImage` — `STCI.cpp:14`; `STCILoadRGB` — `:82`; `STCILoadIndexed` — `:154`; `STCISetPalette` — `:338`; `IsSTCIETRLEFile` — `:367`.
- **PCX** (`sgp/pcx.h`): `PcxHeader` (`:8-24`), `PcxObject` (`:26-34`); `LoadPCXFileToImage` — `PCX.cpp:29`; `LoadPcx` — (decl `pcx.h:37`); `BlitPcxToBuffer` — `PCX.cpp:148`; `SetPcxPalette` — `:350`.
- **PNG/JPC** (`sgp/PngLoader.h`): `LoadPNGFileToImage` — `PngLoader.cpp:610`; `LoadJPCFileToImage` — `:644`; internal `Load24bppPNGImage` — `:860`, `Load32bppPNGImage` — `:815`, `LoadPalettedPNGImage` — `:906`; `user_read_data` (libpng read callback over `HWFILE`) — `:31`.
- **HIMAGE** (`sgp/himage.h/.cpp`): `CreateImage` — `himage.cpp:125` (dispatches by extension via `ImageFileType::TestOrder`); `DestroyImage` — `:172`; `LoadImageData` — `:236`; `CopyImageToBuffer` — `:282`; `Copy8BPPCompressedImageTo8BPPBuffer` — `:354`; `Copy8BPPCompressedImageTo16BPPBuffer` — `:435`; `Copy8BPPImageTo16BPPBuffer` — `:641`; `Get16BPPColor` — `:840`; `GetRGBColor` — `:884`; `GetETRLEImageData` — `:953`; RGB-distribution converters — `:991-1072`.
- **VObject** (`sgp/vobject.h/.cpp`): `CreateVideoObject` — `vobject.cpp:508`; `AddStandardVideoObject` — `:214`; `BltVideoObject` — `:467/:499`; `BltVideoObjectFromIndex` — `:335`; `BltVideoObjectToBuffer` — `:903`; `BltVideoObjectOutline` — `:1516`; `BltVideoObjectOutlineShadow` — `:1600`; `SetVideoObjectPalette` — `:700`; `GetVideoObjectETRLEProperties` — `:1229`; `CreateObjectPaletteTables` — `:823`; `SetObjectShade` — `:1090`; `InitializeVideoObjectManager` — `:138`.
- **VSurface** (`sgp/vsurface.h/.cpp`): `AddStandardVideoSurface` — `vsurface.cpp:382`; `BltVideoSurface` — `:758`; `ColorFillVideoSurfaceArea` — `:791`; `ImageFillVideoSurfaceArea` — `:855`; `ShadowVideoSurfaceRect` — `:2506`; `BltStretchVideoSurface` — `:2551`; `MakeVSurfaceFromVObject` — `:2598`; `SetVideoSurfacePalette` — `:1477`; `SetClipList` — `:1679`; `InitializeVideoSurfaceManager` — `:309`.

| Native | Web |
|---|---|
| STCI ETRLE decode | port the ETRLE run-length decoder to JS; output `ImageData` (indexed → palette lookup) |
| STCI zlib-compressed | `DecompressionStream('deflate')` or pako |
| PCX decode | port RLE + palette; or pre-convert to PNG at build time |
| PNG decode | browser `createImageBitmap`/`Image` (native codec) |
| JPC (JA2 palette PNG) | decode PNG, then apply embedded palette |
| 8-bit palette surfaces | `ImageData` with `Uint8ClampedArray`; palette → RGBA LUT |
| 16-bit 565/555 surfaces | convert to RGBA once at load; keep `Get16BPPColor`/`GetRGBColor` as helpers |
| `BltVideoObject` (ETRLE sprite blit w/ transparency) | `ctx.drawImage` of pre-decoded sprite; transparency = alpha channel |
| `ShadowVideoSurfaceRect` | `ctx.fillRect` with translucent black |
| `BltStretchVideoSurface` | `ctx.drawImage` with scaled dest rect |
| `SetClipList` | `ctx.clip()` region list |

### 6.8 DirectDraw Calls / DirectX Common / video

- `sgp/DirectDraw Calls.h/.cpp` — thin wrappers over DirectDraw 7: `DDCreateSurface` (`DirectDraw Calls.h:16`), `DDLockSurface` — `DirectDraw Calls.cpp:77`; `DDUnlockSurface` — `:97`; `DDBltFastSurface` — `:222`; `DDBltSurface` — `:238`; `DDCreatePalette` — `:256`; `DDSetSurfacePalette` — `:266`; `DDSetPaletteEntries` — `:284`; `DDSetSurfaceColorKey` — `:330`; `DDCreateClipper` — `:348`; `DDSetClipperList` — `:373`; software fallbacks `BltFastDDSurfaceUsingSoftware` — `:383`, `BltDDSurfaceUsingSoftware` — `:444`; macros `IDirectDrawSurface2_SGPBltFast`/`_SGPBlt` switch on `gfDontUseDDBlits` (`DirectDraw Calls.h:89-90`).
- `sgp/DirectX Common.h/.cpp` — error helpers: `DirectXErrorDescription` — `DirectX Common.cpp:28`; `DirectXAttempt` — `:17`; `DirectXZeroMem` — `:11`; `ATTEMPT(x)`/`ZEROMEM(x)` macros (`DirectX Common.h:17-20`).
- `sgp/video.h/.cpp` — the display manager: `InitializeVideoManager` (`video.h:35`), `LockFrameBuffer`/`UnlockFrameBuffer` (`video.h:56-57`), `LockPrimarySurface` (`:52`), `Set8BPPPalette` (`:78`), `SetMouseCursorFromObject` (`:62`), `HideMouseCursor` (`:63`), `InvalidateScreen` (`:44`), `StartFrameBufferRender`/`EndFrameBufferRender` (`:66-67`), `RefreshScreen` (`:86`), `FatalError` (`:89`), `gSgpPalette[256]` (`:92`). `gfDontUseDDBlits` global (`sgp.h:18`).

| Native | Web |
|---|---|
| DirectDraw surfaces (primary/back/frame/mouse) | offscreen `<canvas>` per surface; frame buffer = main render canvas |
| `DDLockSurface` (raw pixel access) | `ctx.getImageData` (slow) or keep CPU-side `Uint8Array` + `putImageData` |
| `DDBltFastSurface` (color-key blit) | `drawImage`; color key → pre-multiplied alpha at decode |
| `DDSetSurfacePalette` | palette LUT applied at decode time |
| `DDCreateClipper`/`SetClipperList` | `ctx.clip()` |
| `Set8BPPPalette` | rebuild RGBA LUT; re-render indexed surfaces |
| `RefreshScreen` | composite frame buffer → visible canvas (single `drawImage`) |
| `InvalidateScreen/Region` | dirty-rect tracking → redraw only dirty rects |
| `FatalError` | `console.error` + error screen component |

### 6.9 Sound: Mss (legacy) + soundman (FMOD)

- `sgp/Mss.h` — **legacy Miles Sound System 6.1a header (RAD Game Tools), retained but NOT wired in** (no `#include "Mss.h"` in any sgp source; only `MSSBreakPoint()` at `Mss.h:2857`). `Mss-old.h` is the older variant. **Do not port; ignore.**
- `sgp/soundman.h` — the real API: `SOUNDPARMS` (`soundman.h:29-38`: speed, pitch bend, volume, pan, loop, priority, EOS callback), `RANDOMPARMS` (`:42-49`), `InitializeSoundManager` (`:53`), `SoundLoadSample` (`:67`), `SoundPlay` (`:75`), `SoundPlayStreamedFile` (`:76`), `SoundPlayFromBuffer` (`:77`), `SoundPlayRandom` (`:78`), `SoundServiceStreams` (`:79`), `SoundServiceRandom` (`:80`), `SoundStopAll` (`:86`), `SoundStop` (`:88`), `SoundIsPlaying` (`:89`), `SoundSetVolume` (`:90`), `SoundSetPan` (`:91`), `SoundGetPosition` (`:93`), `SoundSetMemoryLimit` (`:57`), `SoundSetCacheThreshhold` (`:58`), `SoundSetDefaultVolume` (`:62`).
- `sgp/soundman.cpp` — FMOD-backed: `InitializeSoundManager` — `:241`; `ShutdownSoundManager` — `:288`; `SoundPlay` — `:324`; `SoundPlayStreamedFile` — `:398`; `SoundPlayFromBuffer` — `:441`; `SoundPlayRandom` — `:472`; `SoundServiceStreams` — `:979`; `SoundServiceRandom` — `:852`; `SoundStopAll` — `:693`; `SoundStop` — `:598`; `SoundIsPlaying` — `:551`; `SoundSetVolume` — `:718`; `SoundSetPan` — `:775`; `SoundGetPosition` — `:1037`; cache: `SoundInitCache` — `:1069`, `SoundLoadSample` — `:1148`, `SoundLockSample` — `:1168`, `SoundUnlockSample` — `:1190`, `SoundFreeSample` — `:1212`, `SoundEmptyCache` — `:1126`; hardware: `SoundInitHardware` — `:1470`, `SoundStartSample` — `:1561`, `SoundStartStream` — `:1659`, `SoundStartStreamFromBuffer` — `:1688`; `SoundGetUniqueID` — `:1834`; `SoundSetSampleFlags` — `:1916`; `SoundEnableSound` — `:214`; `ResetSoundMap` — `:380`.
- `sgp/fmod.h` — vendored FMOD header (API reference only; the web port replaces FMOD entirely).

| Native | Web |
|---|---|
| `SoundPlay` (cached sample) | `AudioBufferSourceNode` from decoded `AudioBuffer` cache |
| `SoundPlayStreamedFile` | `<audio>` element or `MediaElementSource` |
| `SoundPlayFromBuffer` | `decodeAudioData(arrayBuffer)` → source node |
| `SoundPlayRandom` (`RANDOMPARMS` min/max time/speed/vol/pan) | JS: schedule with `Math.random()` within ranges; cap `uiMaxInstances` |
| `SoundSetVolume/Pan` | `GainNode.gain` / `StereoPannerNode.pan` |
| `SoundGetPosition` | `AudioContext.currentTime - startTime` |
| `SoundServiceStreams/Random` (per-frame service) | no-op — WebAudio is callback-driven; keep stubs for source compat |
| EOS callback (`SOUNDPARMS.EOSCallback`) | `source.onended` |
| `SoundSetMemoryLimit`/cache threshold | LRU cache of decoded `AudioBuffer`s |
| `SoundStopAll` | stop all active source nodes |
| `SoundEnableSound` | master `GainNode` mute |

### 6.10 Input — see §3.

### 6.11 English.cpp — see §3.2 (keymap table only).

---

## 7. Utils/ Subsystems

### 7.1 Event Pump (`Utils/Event Pump.h/.cpp`)

Game-logic event queue (distinct from input atoms): `eJA2Events` enum (`Event Pump.h:9-41`: `E_PLAYSOUND`, `S_CHANGEDEST`, `S_BEGINTURN`, `S_CHANGESTANCE`, `S_FIREWEAPON`, `S_WEAPONHIT`, `S_STRUCTUREHIT`, `S_WINDOWHIT`, `S_MISS`, `S_NOISE`, `S_STOP_MERC`, `S_GETNEWPATH`, `S_SETPOSITION`, `S_CHANGESTATE`, `S_SETDIRECTION`, network-only events); per-event payload structs `EV_E_PLAYSOUND` (`:49-57`) … `EV_S_UPDATENETWORKSOLDIER` (`:249-264`); `DEMAND_EVENT_DELAY=0xFFFF` (`:46`).

Impl: `AddGameEvent` — `Event Pump.cpp:901`; `AddGameEventFromNetwork` — `:929`; `DequeAllGameEvents` — `:935`; `DequeueAllDemandGameEvents` — `:1004`; `ExecuteGameEvent` — `:1040`; `ClearEventQueue` — `:1361`; `AddEvent` (internal, 4 queues) — `:659`; `EventQueueSize` — `:755`.

| Native | Web |
|---|---|
| `AddGameEvent(uiEvent, usDelay, pEventData)` | push `{type, dueTime, payload}` into a min-heap keyed by `gameClockMs + delay` |
| `DequeAllGameEvents(fExecute)` | pop due events each tick; execute or drop |
| `DEMAND_EVENT_DELAY` events | separate demand queue drained by `DequeueAllDemandGameEvents` |
| Network events | no-op (single-player web) or WebSocket/WebRTC channel |

### 7.2 Timer Control (CALLBACKTIMER) — see §2.3.

### 7.3 Music Control (`Utils/Music Control.h/.cpp`)

- `MusicMode` enum (`Music Control.h:7-23`: NONE/RESTORE/MAIN_MENU/TACTICAL_*/LAPTOP/…), `NewMusicList` enum (`:25-40`), `MusicLists[MAX_MUSIC]` vectors of song filenames (`:42`).
- Impl: `InitializeMusicLists` — `Music Control.cpp:97`; `MusicPlay(NewMusicList, songIndex)` — `:230`; `MusicSetVolume` — `:248`; `MusicGetVolume` — `:291`; `MusicPoll` — `:369` (per-frame: starts next song on end, handles fades); `SetMusicMode` — `:604`; `GetMusicMode` — `:626`; `SetMusicFadeSpeed` — `:621`; `IsMusicPlaying` — `:646`; `GetMusicHandle` — `:651`; `MusicStopCallback` — `:190`; `MusicStop`/`MusicFadeOut`/`MusicFadeIn` — `:191-193`.

| Native | Web |
|---|---|
| `MusicPlay(mode, index)` | `new Audio(url)`; keep `MusicLists` as URL arrays |
| `MusicPoll(fForce)` | `audio.onended` → advance to next track; fade via `GainNode` ramp |
| `MusicSetVolume` | master music `GainNode` |
| `SetMusicFadeSpeed` | ramp duration |
| `MusicMode` switching | crossfade between two `<audio>`/source nodes |

### 7.4 Cursors (game cursor modes) — see §3.4.

### 7.5 INIReader (`Utils/INIReader.h/.cpp`)

- `CIniReader` class (`INIReader.h:24-68`): `ReadInteger` (`:31-32`), `ReadUINT32/UINT16/UINT8` (`:36-38`), `ReadDouble/ReadFloat` (`:44-45`), `ReadFloatArray/ReadINT32Array` (`:47-48`), `ReadBoolean` (`:50`), `ReadString` (`:52-55`), `RegisterFileForMerging` (`:60`), `iniErrorMessages` stack (`:22`). Backed by `vfs::PropertyContainer` (`:62`).
- Impl: ctor — `INIReader.cpp:37/:71`; `ReadInteger` — `:107/:113`; `ReadDouble` — `:144`; `ReadFloat` — `:163`; `ReadFloatArray` — `:184`; `ReadINT32Array` — `:221`; `ReadBoolean` — `:258`; `ReadString` — `:287/:296`; `ReadUINT8/UINT16/UINT32` — `:306/:317/:327`; `ReadUINT` (core) — `:337`; `RegisterFileForMerging` — `:32`.

| Native | Web |
|---|---|
| `CIniReader(file)` | fetch + parse INI into `Map<section, Map<key, string>>` |
| `ReadUINT32(section, key, def, min, max)` | typed getter with clamp + default |
| `ReadBoolean` | parse `TRUE/FALSE/1/0/yes/no` |
| `ReadFloatArray` | split on commas |
| `RegisterFileForMerging` | merge multiple INI files (mod overrides) |
| `iniErrorMessages` | queue for later display |

### 7.6 Quantize (`Utils/Quantize.h/.cpp`)

Octree color quantizer (used to build 8-bit palettes from 24-bit images): `NODE` (`Quantize.h:4-12`), `CQuantizer` (`:14-41`). Impl: ctor — `Quantize.cpp:11`; `ProcessImage` — `:27`; `AddColor` — `:72`; `CreateNode` — `:107`; `ReduceTree` — `:126`; `GetPaletteColors` — `:177`; `GetColorCount` — `:197`; `GetColorTable` — `:202`.

| Native | Web |
|---|---|
| `CQuantizer(nMaxColors, nColorBits)` | port octree to JS; or use `canvas` `getImageData` + median-cut at build time |
| `ProcessImage` | operate on `Uint8ClampedArray` RGBA |
| `GetColorTable` | output `[r,g,b]` LUT for STCI palette |

### 7.7 STIConvert (`Utils/STIConvert.h/.cpp`)

STI **writer** (editor tooling): `WriteSTIFile` — `STIConvert.cpp:97`; `ETRLECompressSubImage` — `:398`; `ETRLECompress` — `:425`; `ConvertToETRLE` — `:220`; sub-image discovery `DetermineSubImageSize` — `:618`, `DetermineSubImageUsedSize` — `:651`, `GoToNextSubImage` — `:539`; `ConvertRGBDistribution555To565` — `:72`.

| Native | Web |
|---|---|
| `WriteSTIFile` | build STCI byte buffer in JS (DataView) → download |
| `ETRLECompress` | port run-length encoder (transparent runs `0x80|len`, opaque runs `len`) |
| Sub-image splitting | port bounding-box scan |

### 7.8 Slider (`Utils/Slider.h/.cpp`)

`AddSlider` — `Slider.cpp:149`; `InitSlider` — `:111`; `ShutDownSlider` — `:125`; `RenderAllSliderBars` — `:259`; `RemoveSliderBar` — `:399`; `SetSliderValue` — `:752`; callbacks `SelectedSliderMovementCallBack` — `:444`, `SelectedSliderButtonCallBack` — `:537`; `SLIDER_CHANGE_CALLBACK` (`Slider.h:21`); styles `SLIDER_DEFAULT_STYLE`/`SLIDER_VERTICAL_STEEL` (`Slider.h:11-18`).

| Native | Web |
|---|---|
| `AddSlider(style, cursor, x, y, width, increments, priority, cb)` | `<input type="range">` or custom drag component |
| `SetSliderValue` | controlled value prop |
| `SLIDER_CHANGE_CALLBACK` | `onChange` |

### 7.9 PopUpBox (`Utils/PopUpBox.h/.cpp`)

Right-click context menus: `popupstring` (`PopUpBox.h:19-31`), `popupbox` (`:36-55`, up to 4 columns × 128 strings), `MAX_POPUP_BOX_COUNT=32` (`:10`). Impl: `CreatePopUpBox` — `PopUpBox.cpp:86`; `AddMonoString` — `:360`; `AddColorString` — `:458`; `AddSecondColumnMonoString` — `:409`; `DisplayBoxes` — `:1306`; `DisplayOnePopupBox` — `:1318`; `DrawBox` — `:1349`; `DrawBoxText` — `:1472`; `ShowBox`/`HideBox` — `:1258/:1273`; `RemoveBox` — `:1234`; `ResizeBoxToText` — `:1566`; `HighLightLine` — `:1040`; `ShadeStringInBox` — `:184`; `SetMargins` — `:152`; `SetBoxFont` — `:629`; `MarkAllBoxesAsAltered` — `:1668`; `HideAllBoxes` — `:1682`.

| Native | Web |
|---|---|
| `CreatePopUpBox` + `AddMonoString/AddColorString` | React menu component; strings as state array |
| `DisplayBoxes(uiBuffer)` | render at `Position` with margins/line-space |
| `HighLightLine`/`ShadeStringInBox` | per-row hover/disabled styling |
| `ResizeBoxToText` | measure text, set width/height |
| `ShowBox/HideBox` | conditional render |
| 2nd column | flex/grid two-column layout |

### 7.10 MercTextBox (`Utils/MercTextBox.h/.cpp`)

Merc info popups (portrait + text): `MercPopUpBox` (`MercTextBox.h:36-48`), `PrepareMercPopupBox` — `MercTextBox.cpp:300`; `RenderMercPopupBox` — `:219`; `RenderMercPopUpBoxFromIndex` — `:207`; `InitMercPopupBox` — `:118`; `RemoveMercPopupBox` — `:577`; `OverrideMercPopupBox` — `:100`; `SetPrepareMercPopupFlags` — `:664`; background/border enums (`MercTextBox.h:57-73`).

| Native | Web |
|---|---|
| `PrepareMercPopupBox` | build tooltip/modal with background+border STI frames |
| `RenderMercPopupBox(x, y, buffer)` | absolutely-positioned div at (x,y) |
| Background/border enums | pre-decoded frame assets |

---

## 8. ext/ Vendored Libraries

| Library | Path | Purpose | Web mapping |
|---|---|---|---|
| **bfVFS** | `ext/VFS/` | Virtual file system; mounts dirs + SLF/7z archives (`vfs_init.cpp:154-315`) | Build-time asset bundling; manifest; see §4 |
| **lua-5.1.5** | `ext/lua-5.1.5/src/` (`lapi.c`, `lbaselib.c`, `lvm.c`, …) | Scripting (NPC init, `Luaglobal.cpp` in Strategic/) | **Do not port Lua VM.** Reimplement the ~20 exposed game functions (`MusicPlay`, item/merc spawn, etc.) as JS APIs; or use a tiny JS interpreter if script fidelity is required |
| **libsmacker** | `ext/libsmacker/smacker.c` (1835 lines) + `smacker.h` | Smacker video decode (intro cinematics, `Cinematics Bink.cpp` uses Bink; smacker is the older codec) | Pre-transcode to WebM/MP4 at build time; `<video>` element |
| **libpng** | `ext/libpng/png.c` (1105 lines) | PNG decode for `PngLoader.cpp` | Native browser PNG decode (`createImageBitmap`) |
| **zlib** | `ext/zlib/` (8888 lines total) | STCI zlib-compressed images, save compression | `DecompressionStream('deflate')` / pako |

---

## 9. Thread / Timing Assumptions That Break on Web

1. **Win32 multimedia timer thread** (`InitializeJA2TimerCallback`, `Timer Control.cpp:486`): callbacks fire on a separate thread; `IsJA2TimerThread()` (`:792`) is TRUE there. **Web has no threads** — all timer callbacks must be marshalled into the rAF tick. Never run game logic in `setTimeout` directly.
2. **Blocking file I/O**: `FileRead`/`FileLoad` are synchronous (`FileMan.cpp:407/:545`). Web `fetch` is async — either preload everything into memory at boot (JA2 asset set is ~hundreds of MB; use a loading screen + IndexedDB cache) or make the file layer async and await at call sites.
3. **`GetTickCount`/`timeGetTime`** used for seeding (`Random.cpp:75`) and clock — map to `performance.now()`.
4. **`GetCursorPos`** is synchronous and always valid; on web, pointer position is only known from events — cache last `pointermove`.
5. **DirectDraw surface locking** (`DDLockSurface`, `DirectDraw Calls.cpp:77`) assumes raw pixel access; `getImageData` is slow — keep CPU-side buffers and blit via `putImageData`/`drawImage` only.
6. **`srand`/`rand` global state** (`Random.cpp:72-84`) is process-global and order-sensitive — the web port must keep a single emulated MSVC `rand()` state and never interleave other RNG use.
7. **`clock()` CPU-load patch** (`gameloop.cpp:233`) — irrelevant on web; rAF is vsync-bound.
8. **Message-pump-driven loop** (`sgp.cpp:846`): on web, rAF fires even when idle — add an idle-skip (only render when dirty) to save battery, mirroring `gfSkipFrame`.
9. **`timeSetEvent`-style periodic callbacks** (`ITEM_LOCATOR_CALLBACK`, `Timer Control.h:13`) — re-implement as per-frame checks against `gameClockMs`.
10. **`Sleep`/busy-wait** anywhere in game code — replace with rAF yields.

---

## 10. Asset-Loading Order (boot sequence)

1. **VFS init** — `InitializeFileManager` (`FileMan.cpp:151`) loads SLF index; VFS mounts `Base/`, `Data-1.13/`, `Data-UB/` (`vfs_init.cpp:154-315`). Web: fetch manifest + mount virtual tree.
2. **INI config** — `Ja2.ini`, `Ja2_Options.INI`, `APBPConstants.ini`, `CTHConstants.ini`, `Item_Settings.ini` via `CIniReader` (`INIReader.cpp:37`). Web: fetch + parse before game init.
3. **Video manager** — `InitializeVideoManager` (`video.h:35`) creates primary/back/frame/mouse surfaces. Web: create canvases.
4. **Font manager** — `InitializeFontManager` (`Font.cpp:1255`) loads font STIs (25 slots, `Font.h:12`). Web: decode font glyph atlases.
5. **Button image manager** — `InitializeButtonImageManager` (`Button System.cpp:706`) + `InitButtonSystem` (`:1189`); generic buttons `GENBUTN.STI` (`Button System.h:19-22`).
6. **Cursor database** — `InitCursorDatabase` (`Cursor Control.cpp:70`) + `InitCursors` (`Cursors.cpp:1410`); cursor STIs from `CursorSurfaceDefines` (`Cursors.h:197-301`).
7. **Sound manager** — `InitializeSoundManager` (`soundman.cpp:241`); music lists `InitializeMusicLists` (`Music Control.cpp:97`).
8. **Input manager** — `InitializeInputManager` (`input.cpp:231`); MSYS `MSYS_Init` (`mousesystem.cpp:129`).
9. **Clock** — `InitializeJA2Clock` (`Timer Control.cpp:391`).
10. **Random** — `InitializeRandom` (`Random.cpp:87`) pregenerates the 256-number table.
11. **Game init** — `MAGIC()` + `GameLoop()` (`sgp.cpp:845-846`, `gameloop.cpp:226`).

Per-screen lazy loads (tactical maps, laptop, IMP faces) happen through `CreateImage` (`himage.cpp:125`) → STCI/PCX/PNG dispatch.

---

## 11. Reproduction Checklist (web port acceptance)

- [ ] `GameLoop()` tick order reproduced exactly (mouse hook → music poll → event drain → screen handler → rain → refresh → cycle counter → `UpdateClock`), §2.2.
- [ ] `GetJA2Clock` pause-aware; `PauseTime` freezes game time but not rendering; fast-forward multiplies ticks, §2.3.
- [ ] `gsKeyTranslationTable` (English.cpp:8) ported; all `english.h` virtual keys incl. SHIFT/ALT/CTRL combos resolve, §3.2.
- [ ] Input atoms carry `uiTimeStamp` from the game clock; `DBL_CLK_TIME`/`BUTTON_REPEAT_*` semantics match, §3.1.
- [ ] MSYS region hit-testing honors priority order and `MSYS_GrabMouse`; tooltips (`RenderFastHelp`) work, §3.3.
- [ ] `GetRndNum` bit-exact (shift/xor chain + MSVC `rand()` LCG); `guiPreRandomNums[256]`/`guiPreRandomIndex` semantics preserved; `InitializeRandom` produces identical table for identical seed inputs, §5.
- [ ] Save/load round-trips with identical RNG stream (no extra `Random()` calls between save and load).
- [ ] STCI ETRLE + zlib decode correct (transparent runs, sub-images, palettes); PCX/PNG/JPC loaders produce identical pixels, §6.7.
- [ ] Font metrics (`StringPixLength`) match native so text layout/centering is identical, §6.3.
- [ ] Buttons: 5-state images, toggle semantics, dirty-rect rendering, disabled styles (`DISABLED_STYLE_*`), fast-help, §6.1.
- [ ] Cursor composites + animation frames + `CURSOR_TO_FLASH`/`PLAY_SOUND` flags, §6.2/§3.4.
- [ ] Sound: `SoundPlayRandom` respects `uiMaxInstances` and min/max ranges; EOS callbacks fire; pan/volume per instance, §6.9.
- [ ] Music: `MusicPoll` advances tracks on end; fades honor `SetMusicFadeSpeed`; mode switching crossfades, §7.3.
- [ ] Event Pump: delayed events fire at `gameClockMs + delay`; `DEMAND_EVENT_DELAY` events only on demand, §7.1.
- [ ] INI reads clamp to min/max and apply defaults; merged files override in order, §7.5.
- [ ] PopUpBox/MercTextBox/Slider render at correct coordinates with correct fonts/colors, §7.8-7.10.
- [ ] Asset boot order (§10) completes with a loading screen; all assets served from manifest; saves in IndexedDB with export/import.
- [ ] No game logic runs on `setTimeout` threads; all timers marshalled to rAF, §9.