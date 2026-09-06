# 12 — Audio, UI, and Input Systems (Web Port Reference)

**Consumer:** web-port agent building the Next.js/Canvas/WebAudio clone.
**Source root:** `/Users/fsodano/fibradev/games/granaderos/engine/`
**Scope:** `sgp/Button System.h`, `sgp/Button Sound Control.h`, `Utils/Music Control.h`, `TileEngine/Ambient Control.h`, `TileEngine/Radar Screen.h`, `Tactical/Interface Panels.h`, `Ja2/Fade Screen.h`, `Ja2/Loading Screen.h`, `Ja2/HelpScreen.h`, `Ja2/Credits.h`, `sgp/Font.h`, `Utils/Font Control.h`, plus the hotkey tables.
**Rule:** every subsystem lists key structs/functions with `file:line` anchors, a DOM/Canvas/WebAudio recipe, keyboard/a11y notes, and a mapping to `web/components`, `web/hooks`, `docs/TACTICAL-VISUALS.md`, and `docs/TACTICAL-HOTKEYS.md`. Do not touch engine code; this document is read-only reference.

> **SGP core is not re-derived here.** The button/mouse-region/input-atom/font-rasterizer plumbing that lives in `sgp/` (video surfaces, `mousesystem`, `input.cpp`, `soundman`, `Cursor Control`) is covered by `docs/web-port/01-platform-sgp.md`. This document covers the **game-facing UI/audio/input subsystems** built on top of that core, and how each maps to the browser.

---

## 1. Button System (`sgp/Button System.h`)

### 1.1 What it is

The `GUI_BUTTON` abstraction is the game's universal clickable control. It wraps a `MOUSE_REGION` (from `mousesystem.h`) plus rendering state, text, icon, sound scheme, and callbacks. `ButtonList` is a global vector of up to `MAX_BUTTONS` (400) buttons (`Button System.h:145-150`).

Key structure — `GUI_BUTTON` (`Button System.h:97-142`):
- `IDNum`, `ImageNum`, `Area` (the `MOUSE_REGION`), `ClickCallback`, `MoveCallback`, `Cursor`.
- `uiFlags` / `uiOldFlags` — 32-bit state flags (`Button System.h:49-68`): `BUTTON_ENABLED`, `BUTTON_CLICKED_ON`, `BUTTON_TOGGLE`/`BUTTON_NO_TOGGLE`, `BUTTON_GENERIC`, `BUTTON_HOT_SPOT`, `BUTTON_CHECKBOX`, `BUTTON_IGNORE_CLICKS`, `BUTTON_ALLOW_DISABLED_CALLBACK`.
- Text fields: `string`, `usFont`, `sForeColor`/`sShadowColor` (+ `Down`/`Hilited` variants), `bJustification` (`BUTTON_TEXT_LEFT/CENTER/RIGHT`, `Button System.h:24-30`), `sWrappedWidth`.
- Icon fields: `iIconID`, `usIconIndex`, `bIconXOffset`/`bIconYOffset` (`-1` = centered), `fShiftImage`.
- `ubSoundSchemeID` — which sound scheme plays on hover/click (`Button System.h:141`).

Button image model — `BUTTON_PICS` (`Button System.h:153-163`): a single image object with up to five states — `Grayed`, `OffNormal`, `OffHilite`, `OnNormal`, `OnHilite`. Default generic button files are `GENBUTN.STI`..`GENBUTN4.STI` (`Button System.h:19-22`).

### 1.2 Key functions

- Creation: `QuickCreateButton` (`:235`), `CreateEasyNoToggleButton`/`CreateEasyToggleButton`/`CreateEasyNewToggleButton` (`:241-245`), `CreateCheckBoxButton` (`:252`), `CreateHotSpot` (`:255`), `CreateTextButton` (`:257`), `CreateIconAndTextButton` (`:258`).
- State: `EnableButton`/`DisableButton` (`:211-212`), `HideButton`/`ShowButton` (`:214-215`), `RemoveButton` (`:213`).
- Render: `RenderButtons` (`:217`), `DrawGenericButton`/`DrawQuickButton`/`DrawCheckBoxButton` (`:222-224`), `DrawIconOnButton`/`DrawTextOnButton` (`:227-228`).
- Text/icon spec: `SpecifyButtonText` (`:266`), `SpecifyButtonFont` (`:267`), `SpecifyButtonTextJustification` (`:271`), `SpecifyButtonIcon` (`:317`).
- Sound: `SpecifyButtonSoundScheme` (`:284`), `PlayButtonSound` (`:288`).
- Disabled style: `SpecifyDisabledButtonStyle` (`:308`) — `DISABLED_STYLE_NONE/DEFAULT/HATCHED/SHADED` (`:301-307`).
- Default status: `GiveButtonDefaultStatus` (`:298`) — `DEFAULT_STATUS_DARKBORDER/DOTTEDINTERIOR/WINDOWS95` (`:292-297`).

### 1.3 Web recipe (DOM/Canvas)

- **DOM buttons** (`web/components/ui/button.tsx`): the `GUI_BUTTON` maps to the shadcn/base-ui `Button` primitive. `BUTTON_ENABLED` → `disabled`; `BUTTON_TOGGLE`/`BUTTON_CLICKED_ON` → `aria-pressed` + `data-state`; `BUTTON_CHECKBOX` → `role="checkbox"` + `aria-checked`. `ClickCallback` → `onClick`; `MoveCallback` → `onMouseEnter`/`onMouseLeave` (hover). `bJustification` → `text-align` / flex alignment.
- **Five-state image** → CSS `:hover`, `:active`, `[aria-pressed="true"]`, `:disabled` pseudo-classes over the same sprite/background, or a `<button>` with `background-image` swapping per state. `fShiftImage`/`fShiftText` (down-state +1,+1 offset) → `active:translate-x-px active:translate-y-px` (already in `button.tsx`).
- **Hot spots** (`CreateHotSpot`) → transparent `<button>`/`<div role="button">` overlaying a region; use `aria-label` for the invisible control.
- **Disabled style** → `disabled:opacity-50` (shaded) or a CSS hatch pattern (hatched); `DISABLED_STYLE_NONE` → keep full opacity for decorative panels.
- **Default status** (dark border / dotted interior) → `focus-visible:ring` + `border` utilities already present in `button.tsx`.

### 1.4 Keyboard / a11y

- Native `<button>` gives Space/Enter activation for free; the hotkey resolver already guards this — `tacticalShortcut` returns `null` when the event target is a native control (`game/hotkeys.js:15`), and `Battlefield.tsx:36` detects `button,a,summary,[role="button"]`.
- `BUTTON_IGNORE_CLICKS` → `pointer-events:none` + `tabIndex={-1}`.
- `BUTTON_ALLOW_DISABLED_CALLBACK` (fast-help on disabled buttons) → keep the button focusable but visually disabled, or render a `tooltip` on hover (`web/components/ui/tooltip.tsx`).
- Every icon-only button needs `aria-label` (see `Battlefield.tsx` pan/zoom buttons, `:72`).

---

## 2. Button Sound Control (`sgp/Button Sound Control.h`)

### 2.1 What it is

A tiny enum of named sound schemes (`Button Sound Control.h:6-18`): `BUTTON_SOUND_SCHEME_NONE`, `GENERIC`, `VERYSMALLSWITCH1/2`, `SMALLSWITCH1/2/3`, `BIGSWITCH3`, `COMPUTERBEEP2`, `COMPUTERSWITCH1`. Each scheme is a set of short UI clicks/beeps.

The per-event sound flags live in `Button System.h:70-80`: `BUTTON_SOUND_CLICKED_ON`, `CLICKED_OFF`, `MOVED_ONTO`, `MOVED_OFF_OF`, `DISABLED_CLICK`, `DISABLED_MOVED_ONTO`, `DISABLED_MOVED_OFF_OF`, plus `BUTTON_SOUND_ALREADY_PLAYED` (dedupe) and `BUTTON_SOUND_ALL_EVENTS` (`0xff`). `PlayButtonSound(iButtonID, iSoundType)` (`Button System.h:288`) is the dispatch entry.

### 2.2 Web recipe (WebAudio)

- Map each scheme to a tiny synthesized click/beep (no samples needed). Reuse the oscillator/noise helpers already in `web/lib/battle-audio.ts` (`drum`, `noise`).
- Event → sound mapping:
  - `MOVED_ONTO` → `onMouseEnter` → short high click (e.g. 2–4 kHz square blip, ~30 ms).
  - `CLICKED_ON` → `onClick` → slightly louder click.
  - `CLICKED_OFF` (toggle off) → lower-pitch click.
  - `DISABLED_CLICK` → dull thud (lowpass noise, low cutoff).
- Dedupe via `BUTTON_SOUND_ALREADY_PLAYED` → guard with a per-button "last played" timestamp so hover spam doesn't retrigger.
- **Autoplay policy:** WebAudio must start after a user gesture. `BattleAudio.toggle()` already creates/resumes the `AudioContext` on first explicit toggle (`battle-audio.ts:6-14`). Route all button sounds through the same shared context; do not create a new `AudioContext` per click.

### 2.3 Keyboard / a11y

- Play the same `CLICKED_ON` sound on Space/Enter activation (keyboard users should get audio feedback too).
- Respect `prefers-reduced-motion`/a mute toggle; never play sound on pure focus (only on activation/hover).

---

## 3. Utils Music Control (`Utils/Music Control.h`)

### 3.1 What it is

The game's music state machine. `MusicMode` enum (`Music Control.h:7-23`) selects the emotional context: `MUSIC_MAIN_MENU`, `MUSIC_TACTICAL_NOTHING`, `MUSIC_TACTICAL_ENEMYPRESENT`, `MUSIC_TACTICAL_BATTLE`, `MUSIC_TACTICAL_VICTORY`, `MUSIC_TACTICAL_DEATH`, `MUSIC_LAPTOP`, etc. `NewMusicList` (`:25-40`) enumerates concrete playlists (`MUSICLIST_MAIN_MENU`, `MUSICLIST_TACTICAL_BATTLE`, `MUSICLIST_TACTICAL_BATTLE_NIGHT`, `MUSICLIST_TACTICAL_CREEPY`, …).

Key functions:
- `SetMusicMode(UINT8)` / `GetMusicMode()` (`:46-47`) — switch the active mode.
- `MusicPlay(NewMusicList mode, UINT8 songIndex)` (`:50`) — play a specific track.
- `MusicGetVolume`/`MusicSetVolume` (`:52-53`).
- `MusicPoll(BOOLEAN fForce)` (`:55`) — advance the state machine each frame (called from `GameLoop`, see `01-platform-sgp.md` §2.2).
- `SetMusicFadeSpeed(INT8)` (`:57`) — crossfade rate.
- `IsMusicPlaying()` / `GetMusicHandle()` (`:63-64`).

### 3.2 Web recipe (WebAudio)

- **Mode → playlist:** a `useMusicMode(mode)` hook (`web/hooks/`) that, on mode change, crossfades the current `HTMLAudioElement`/`AudioBufferSourceNode` to the first track of the new playlist. `MusicPoll` per-frame → a `requestAnimationFrame`/`setInterval` check that advances to the next track when the current one ends.
- **Volume:** `MusicSetVolume` → `gain.gain` on a master music bus (separate from SFX bus). Persist in `localStorage`.
- **Fade:** `SetMusicFadeSpeed` → `gain.gain.linearRampToValueAtTime` over the fade duration. `MUSIC_TACTICAL_BATTLE` ↔ `MUSIC_TACTICAL_NOTHING` transitions should crossfade ~1–2 s.
- **Tactical triggers:** `Battlefield.tsx` already knows `s.status` (victory/defeat) and enemy presence (`enemies.length`). Drive mode from those: no enemies → `MUSIC_TACTICAL_NOTHING`; enemies visible → `ENEMYPRESENT`; in combat → `BATTLE`; `s.status==='victory'` → `VICTORY`. Night variant when `s.night`.
- **Autoplay:** same gesture-gated context as §2.2; start music only after first user interaction.

### 3.3 Keyboard / a11y

- Provide a mute/music toggle (keyboard reachable). Respect `prefers-reduced-motion` for fade duration (shorten or skip).
- Announce mode changes via `aria-live="polite"` only if meaningful (e.g. "combat music").

---

## 4. TileEngine Ambient Control (`TileEngine/Ambient Control.h`)

### 4.1 What it is

Steady-state ambient soundscapes per sector type. `STEADY_STATE_AMBIENCE` (`Ambient Control.h:46-50`) holds up to `NUM_SOUNDS_PER_TIMEFRAME` (8) sound names per ambience. The `SSA_*` enum (`:29-43`) lists the biomes: `SSA_COUNTRYSIDE`, `SSA_NEAR_WATER`, `SSA_IN_WATER`, `SSA_HEAVY_FOREST`, `SSA_PINE_FOREST`, `SSA_ABANDONED`, `SSA_AIRPORT`, `SSA_WASTELAND`, `SSA_UNDERGROUND`, `SSA_OCEAN`.

Key functions:
- `SetSteadyStateAmbience(UINT8)` / `SetSSA()` (`:19-20`) — set the current soundscape.
- `HandleNewSectorAmbience(UINT8)` (`:10`) — swap ambience on sector change.
- `StopAmbients()` / `DeleteAllAmbients()` (`:13-14`).
- Fire ambience: `StartFireAmbient`/`StopFireAmbient`/`UpdateFireAmbient` (`:22-24`).

### 4.2 Web recipe (WebAudio)

- **Ambience = looping noise bed + sparse one-shots.** For each `SSA_*` biome, synthesize a looping `AudioBufferSourceNode` (wind/water via filtered noise) plus a scheduler that randomly triggers bird/insect one-shots within `NUM_SOUNDS_PER_TIMEFRAME` windows.
- **Sector change** (`HandleNewSectorAmbience`) → crossfade the ambience bus to the new biome's bed. `TacticalScene.tsx` already reads `s.tiles`/`s.buildings`; derive biome from tile composition (water tiles → `SSA_NEAR_WATER`/`OCEAN`, forest → `SSA_HEAVY_FOREST`, etc.).
- **Fire ambience** → tie to the `torch`/fire state in `Battlefield.tsx` (`order({type:'throwTorch'})`, `:67`); `StartFireAmbient` on torch throw, `StopFireAmbient` when extinguished.
- **Underground** → `SSA_UNDERGROUND` (muffled, low-pass filtered bed).

### 4.3 Keyboard / a11y

- Ambient volume should sit well below SFX/music; expose in the same audio settings panel.
- No keyboard interaction needed (it is a background bed), but ensure it stops when the tab is hidden (`visibilitychange` → suspend `AudioContext`).

---

## 5. Tactical Interface Panels (`Tactical/Interface Panels.h`)

### 5.1 What it is

The tactical HUD panels: the **Single-Merc Panel (SMPanel)** and the **Team Panel (TEAMPanel)**.

- `SM_*` button enum (`Interface Panels.h:4-22`): `STANCEUP_BUTTON`, `UPDOWN_BUTTON`, `CLIMB_BUTTON`, `STANCEDOWN_BUTTON`, `HANDCURSOR_BUTTON`, `PREVMERC_BUTTON`, `NEXTMERC_BUTTON`, `OPTIONS_BUTTON`, `BURSTMODE_BUTTON`, `LOOK_BUTTON`, `TALK_BUTTON`, `MUTE_BUTTON`, `SM_DONE_BUTTON`, `SM_MAP_SCREEN_BUTTON`.
- `TEAM_*` button enum (`:24-30`): `TEAM_DONE_BUTTON`, `TEAM_MAP_SCREEN_BUTTON`, `CHANGE_SQUAD_BUTTON`.
- Team slots: `NUM_TEAM_SLOTS` (10), `gTeamPanel[NUM_TEAM_SLOTS]` of `TEAM_PANEL_SLOTS_TYPE {ubID, fOccupied}` (`:35`, `:119-126`).
- Functions: `CreateSMPanelButtons`/`RemoveSMPanelButtons` (`:49-50`), `RenderSMPanel` (`:53`), `EnableSMPanelButtons` (`:54`), `SetSMPanelCurrentMerc`/`GetSMPanelCurrentMerc` (`:80-82`), `UpdateSMPanel` (`:83`); team equivalents `CreateTEAMPanelButtons`/`RenderTEAMPanel`/`UpdateTEAMPanel` (`:68-73`), `AddPlayerToInterfaceTeamSlot`/`RemovePlayerFromInterfaceTeamSlot` (`:86-87`).
- `ShowRadioLocator`/`EndRadioLocator` (`:110-111`) — the pulsing locator ring on a soldier.
- `HandlePanelFaceAnimations` (`:143`) — portrait face animation.

### 5.2 Web recipe (DOM/Canvas)

- **SMPanel** → the `battle-inspector` aside in `Battlefield.tsx` (`:77-79`): selected soldier's portrait, HP/AP/energy meters, weapon, morale, movement orders, field supplies. The `SM_*` buttons map to the inspector's action buttons (stance, options, done, map screen).
- **TEAMPanel** → the `squad-strip tactical-roster` (`Battlefield.tsx:86`): one portrait card per hired player, `aria-label` with index/name/HP/AP/energy. `AddPlayerToInterfaceTeamSlot` → append a card; `RemovePlayerFromInterfaceTeamSlot` → remove/disable.
- **`PREVMERC`/`NEXTMERC`** → the `next`/`select:` hotkeys and the roster click handlers (`Battlefield.tsx:44-45`).
- **`SM_DONE_BUTTON`** → the `end-turn` button (`:83`); **`SM_MAP_SCREEN_BUTTON`** → `onMap` (`:46`).
- **Radio locator** (`ShowRadioLocator`) → a CSS/SVG pulsing ring on the selected unit in `TacticalScene.tsx` (reuse the `selected` highlight).
- **Face animation** → portrait swap on pose/action (already driven by `poses` state in `Battlefield.tsx:29`).

### 5.3 Keyboard / a11y

- Roster cards are `<button>`s → Space/Enter select; `aria-pressed`/`aria-current` for the active soldier.
- Meters (HP/AP/energy) should expose numeric text (`aria-label` already includes values, `Battlefield.tsx:86`).
- `gfDisableTacticalPanelButtons` (`:116`) → disable all panel buttons during busy/animation (the `busy` flag in `Battlefield.tsx:23`).

---

## 6. Radar Screen (`TileEngine/Radar Screen.h`)

### 6.1 What it is

The tactical minimap. `RADAR_WINDOW_*` defines (`Radar Screen.h:13-20`) position/size the radar window (TM = team mode, SM = single-merc, STRAT = strategic). `fRenderRadarScreen` (`:42`) toggles radar vs squad-list rendering.

Key functions:
- `InitRadarScreen`/`RenderRadarScreen`/`MoveRadarScreen` (`:22-24`).
- `DisableRadarScreenRender`/`EnableRadarScreenRender`/`ToggleRadarScreenRender` (`:27-33`).
- `RadarRegionMoveCallback`/`RadarRegionButtonCallback` (`:6-7`) — click/drag on the radar to move the camera.
- `LoadRadarScreenBitmap` (`:9`) — the radar background image.
- `CreateDestroyMouseRegionsForSquadList` (`:36`) — squad-list regions.

### 6.2 Web recipe (DOM/Canvas)

- **Direct mapping:** `web/app/TacticalMinimap.tsx` is the radar. It renders an SVG of all tiles (`state.tiles.map`), unit dots (player `#dcdf9d`, enemy `#d7755a`), and a camera viewport rect (`:5-10`).
- `RenderRadarScreen` → the minimap SVG; `MoveRadarScreen` → camera pan.
- `RadarRegionButtonCallback` → the minimap `onClick` that calls `onCenter` (`TacticalMinimap.tsx:5`); `RadarRegionMoveCallback` → drag-to-pan (add `onPointerDown`/`onPointerMove`).
- `ToggleRadarScreenRender` → show/hide the minimap (the `hud-selection` block in `Battlefield.tsx:86`).
- `LoadRadarScreenBitmap` → the minimap background (currently a flat `#17211a` rect; could use the terrain atlas from `docs/TACTICAL-VISUALS.md`).
- `CreateDestroyMouseRegionsForSquadList` → the roster cards rendered alongside the minimap.

### 6.3 Keyboard / a11y

- The minimap is `role="button"` with `tabIndex={0}` and arrow-key panning already implemented (`TacticalMinimap.tsx:5`). Keep `aria-label` describing click-to-center and arrow-to-pan.
- Ensure the minimap is keyboard-reachable but does not trap focus; arrow keys should `stopPropagation` so they don't scroll the page.

---

## 7. Ja2 Fade Screen (`Ja2/Fade Screen.h`)

### 7.1 What it is

Screen transition fades. Fade types (`Fade Screen.h:4-12`): `FADE_OUT_VERSION_ONE`, `FADE_OUT_VERSION_FASTER`, `FADE_OUT_VERSION_SIDE`, `FADE_OUT_SQUARE`, `FADE_OUT_REALFADE`, `FADE_IN_VERSION_ONE`, `FADE_IN_SQUARE`, `FADE_IN_REALFADE`. Hooks: `gFadeInDoneCallback`/`gFadeOutDoneCallback` (`:16-17`).

Key functions:
- `BeginFade(uiExitScreen, bFadeValue, bType, uiDelay)` (`:29`) — start a fade to a target screen.
- `HandleBeginFadeIn`/`HandleBeginFadeOut` (`:31-32`), `HandleFadeInCallback`/`HandleFadeOutCallback` (`:34-35`).
- `FadeInNextFrame`/`FadeOutNextFrame` (`:37-38`) — per-frame fade step.

### 7.2 Web recipe (DOM/Canvas)

- **CSS transition:** a full-screen overlay `<div>` with `opacity` transitioned 0→1 (fade out) then 1→0 (fade in), with `onTransitionEnd` firing the `gFadeOutDoneCallback`/`gFadeInDoneCallback` equivalents. `uiDelay` → `transitionDelay`.
- **`FADE_OUT_REALFADE`/`FADE_IN_REALFADE`** → a black overlay with `transition: opacity` (the "real" fade). **`FADE_OUT_SQUARE`/`FADE_IN_SQUARE`** → a CSS `clip-path`/mask wipe. **`FADE_OUT_VERSION_SIDE`** → a slide/wipe.
- **Screen change:** `BeginFade(uiExitScreen,…)` → in React, set a `fading` state, run the fade-out, swap the routed screen, then fade-in. This composes with the screen manager in `01-platform-sgp.md` §2.2 (`guiPendingScreen` → `HandleNewScreenChange`).
- **Canvas variant:** if fading the tactical canvas, draw a black rect with `globalAlpha` ramping per frame in the rAF loop.

### 7.3 Keyboard / a11y

- Respect `prefers-reduced-motion`: skip or shorten fades (set duration ~0).
- Keep the overlay `aria-hidden="true"` and `pointer-events:none` when fully transparent so it never blocks interaction or screen readers.

---

## 8. Ja2 Loading Screen (`Ja2/Loading Screen.h`)

### 8.1 What it is

Sector-loading splash screens. `LOADINGSCREEN_*` enum (`Loading Screen.h:6-80`) enumerates day/night variants per biome: `LOADINGSCREEN_DAYGENERIC`, `DAYTOWN1/2`, `DAYWILD`, `DAYTROPICAL`, `DAYFOREST`, `DAYDESERT`, `DAYPALACE`, `NIGHT*` equivalents, `HELI`, `BASEMENT`, `MINE`, `CAVE`, `DAYPINE`, `DAYMILITARY`, `DAYSAM`, `DAYPRISON`, `DAYHOSPITAL`, `DAYAIRPORT`, `DAYLAB`, `DAYOMERTA`, `DAYCHITZENA`, `DAYMINE`, `DAYBALIME`, plus `DAY`/`NIGHT`/`HELI`/`UNDERGROUND` categories.

Key data/functions:
- `SECTOR_LOADSCREENS` struct (`:101-112`): `uiIndex`, `szLocation`, `RandomAltSector`, `szImageFormat`, `szDay`/`szNight`/`szDayAlt`/`szNightAlt` image paths.
- `gSectorLoadscreens[MAX_SECTOR_LOADSCREENS]` (`:114`) — the lookup table (257 entries).
- `GetLoadScreenID(sX, sY, sZ)` (`:90`) — resolve a sector to a load-screen ID.
- `DisplayLoadScreenWithID(ubLoadScreenID)` (`:94`) — draw the splash to the frame buffer.
- `gubLastLoadingScreenID` (`:85`), `fLoadingScreenAspectRatio` (`:87`).

### 8.2 Web recipe (DOM/Canvas)

- **Splash overlay:** a full-screen `<div>` showing the sector's loading image while the sector data loads (async `fetch`/`import` of the map). `GetLoadScreenID` → a lookup from `sectorName`/`s.night` to an image in `web/public/art` (reuse the terrain/scenery assets from `docs/TACTICAL-VISUALS.md`).
- **Day/night:** pick `szDay` vs `szNight` from `s.night`; `RandomAltSector` → randomly choose `szDayAlt`/`szNightAlt`.
- **Aspect ratio:** `fLoadingScreenAspectRatio` → `object-fit: cover` / `aspect-ratio` CSS so the splash fills without distortion.
- **Flow:** show splash → load map → `DisplayLoadScreenWithID` equivalent → fade out (compose with §7) → mount `Battlefield`/`TacticalScene`.

### 8.3 Keyboard / a11y

- The splash is transient; mark it `aria-hidden` or `role="status"` with `aria-live="polite"` ("Cargando sector…").
- Ensure it does not trap focus; keyboard users should be able to continue once loaded.

---

## 9. Ja2 Help Screen (`Ja2/HelpScreen.h`)

### 9.1 What it is

Contextual help overlays. `HELP_SCREEN_*` enum (`HelpScreen.h:6-18`): `HELP_SCREEN_LAPTOP`, `MAPSCREEN`, `MAPSCREEN_NO_ONE_HIRED`, `MAPSCREEN_NOT_IN_ARULCO`, `MAPSCREEN_SECTOR_INVENTORY`, `TACTICAL`, `OPTIONS`, `LOAD_GAME`.

`HELP_SCREEN_STRUCT` (`:23-61`) tracks: `bCurrentHelpScreen`, `usScreenLocX/Y/Width/Height`, `iLastMouseClickY`, `bCurrentHelpScreenActiveSubPage`, `bNumberOfButtons`, `fHaveAlreadyBeenInHelpScreenSinceEnteringCurrenScreen`, `fWasTheGamePausedPriorToEnteringHelpScreen`, and scroll state (`usTotalNumberOfPixelsInBuffer`, `iLineAtTopOfTextBuffer`, `usTotalNumberOfLinesInBuffer`).

Key functions:
- `ShouldTheHelpScreenComeUp(ubScreenID, fForce)` (`:68`) — decide whether to auto-show help.
- `HelpScreenHandler()` (`:69`), `InitHelpScreenSystem()` (`:70`), `NewScreenSoResetHelpScreen()` (`:71`).
- `HelpScreenDetermineWhichMapScreenHelpToShow()` (`:72`).

### 9.2 Web recipe (DOM/Canvas)

- **Direct mapping:** the tactical help is the `tactical-key-reference` section in `Battlefield.tsx:71` (toggled by `keyHelp` state, `H`/`?` hotkey, or the "Atajos de teclado" button). It renders `TACTICAL_KEYS` from `game/hotkeys.js` as a `<dl>`.
- **`HELP_SCREEN_TACTICAL`** → that key-reference panel. **`HELP_SCREEN_LAPTOP`/`MAPSCREEN`/`OPTIONS`/`LOAD_GAME`** → analogous help panels in the corresponding screens (`web/app/Desk.tsx`, `Campaign.tsx`, etc.).
- **Pause on help:** `fWasTheGamePausedPriorToEnteringHelpScreen` → `Battlefield.tsx:39` already returns early (`if(keyHelp)return;`) so gameplay shortcuts pause while help is open.
- **Sub-pages/scroll:** `bCurrentHelpScreenActiveSubPage` + scroll vars → a scrollable `<dialog>`/`<ScrollArea>` (`web/components/ui/scroll-area.tsx`) with paged content.
- **Auto-show:** `ShouldTheHelpScreenComeUp` → show help on first entry to a screen unless the user dismissed it (`fHaveAlreadyBeenInHelpScreenSinceEnteringCurrenScreen`).

### 9.3 Keyboard / a11y

- `H`/`?` toggles help; `Escape` closes it (`Battlefield.tsx:35,39`). This matches `docs/TACTICAL-HOTKEYS.md` ("H opens the Spanish reference").
- The help panel should be a real `<dialog>`/`role="dialog"` with `aria-modal` when open, focus trapped, and `aria-label` describing it.
- `iLastMouseClickY` (click-to-scroll) → optional; keyboard scroll via arrow keys/PageUp/PageDown.

---

## 10. Ja2 Credits (`Ja2/Credits.h`)

### 10.1 What it is

The end-credits screen. Minimal API (`Credits.h:5-7`): `CreditScreenInit()`, `CreditScreenHandle()`, `CreditScreenShutdown()` — a screen-manager triple (init/handle/shutdown).

### 10.2 Web recipe (DOM/Canvas)

- A full-screen scrolling credits view: `CreditScreenInit` → mount the credits component; `CreditScreenHandle` → per-frame scroll (CSS `@keyframes` translateY or a rAF-driven scroll); `CreditScreenShutdown` → unmount.
- Content: the game's credits (Granaderos team, historical references, art provenance from `assets/README.md`).
- Compose with the fade system (§7) for entry/exit.

### 10.3 Keyboard / a11y

- Provide a "skip" button and allow `Escape` to exit (matching the hotkey convention).
- Respect `prefers-reduced-motion`: render credits as a static, scrollable list instead of auto-scrolling.
- Ensure text is readable (adequate contrast) and the container is scrollable by keyboard.

---

## 11. Fonts (`sgp/Font.h` + `Utils/Font Control.h`)

### 11.1 What it is

The font system. `sgp/Font.h` defines the rasterizer API: `SetFont` (`:120`), `LoadFontFile` (`:122`), `GetFontHeight` (`:123`), `SetFontColors`/`SetFontForeground`/`SetFontBackground`/`SetFontShadow` (`:82-85`), `SetRGBFontForeground/Background/Shadow` (`:88-90`), `gprintf`/`mprintf` (`:105-107`), `StringPixLength`/`StringNPixLength` (`:135-137`), `FindFontCenterCoordinates`/`FindFontRightCoordinates` (`:143-147`). `MAX_FONTS` = 25 (`:12`). Font color symbols (`:21-39`) and shadow constants (`DEFAULT_SHADOW`=2, `MILITARY_SHADOW`=67, `NO_SHADOW`=0, `:14-16`).

`Utils/Font Control.h` defines the named font globals and their `#define` aliases (`Font Control.h:97-119`): `LARGEFONT1`, `SMALLFONT1`, `TINYFONT1`, `FONT12POINT1`, `COMPFONT`, `SMALLCOMPFONT`, `FONT10ROMAN`, `FONT12ROMAN`, `FONT14SANSERIF`, `MILITARYFONT1` (=`BLOCKFONT`), `FONT10ARIAL`, `FONT14ARIAL`, `FONT12ARIAL`, `FONT10ARIALBOLD`, `BLOCKFONT`/`BLOCKFONT2`/`BLOCKFONT3`, `FONT12ARIALFIXEDWIDTH`, `FONT16ARIAL`, `BLOCKFONTNARROW`, `FONT14HUMANIST`.

Named colors (`Font Control.h:123-175`): `FONT_MCOLOR_*` (black/white/dkwhite/ltgray/dkgray/ltblue/ltred/red/dkred/ltgreen/ltyellow), grayscale `FONT_WHITE`..`FONT_BLACK`, and color `FONT_LTRED`/`RED`/`DKRED`/`ORANGE`/`YELLOW`/`GREEN`/`BLUE`/`BEIGE`/`METALGRAY`/`BURGUNDY`/`KHAKI`. `SetFontShade(uiFontID, bColorID)` (`:180`) applies a shade.

### 11.2 Web recipe (DOM/Canvas)

- **Named fonts → CSS font stacks.** Map each `FONT*` alias to a web font: `FONT10ARIAL`/`FONT12ARIAL`/`FONT14ARIAL`/`FONT16ARIAL` → Arial/system sans; `FONT10ROMAN`/`FONT12ROMAN` → a serif (Georgia/Times); `BLOCKFONT*`/`MILITARYFONT1` → a condensed/blocky display font (e.g. a military-style webfont); `FONT14HUMANIST` → a humanist sans. Define these as CSS custom properties / utility classes.
- **Colors → CSS variables.** Map `FONT_MCOLOR_*`/`FONT_*` to a palette (e.g. `--font-white`, `--font-red`, `--font-khaki`). The tactical HUD already uses a parchment palette (`#f1e5c7`, `#20332c` in `Battlefield.tsx:71`).
- **Canvas text:** for the tactical canvas, use `ctx.font` with the mapped stack and `ctx.fillStyle` from the palette; `SetFontShadow` → `ctx.shadowColor`/`ctx.shadowOffsetY` (2px default). `FindFontCenterCoordinates` → `ctx.measureText` + centering math.
- **`StringPixLength`** → `ctx.measureText(text).width`; `GetFontHeight` → `parseFloat(ctx.font)` / `line-height`.
- **`SetFontShade`** → a brightness/opacity overlay on the text color.

### 11.3 Keyboard / a11y

- Fonts are presentation; ensure the DOM text remains real text (not canvas-only) wherever possible for screen readers and text scaling.
- Respect user font-size preferences; avoid fixed-pixel canvas text for critical readable content.
- Maintain contrast between `FONT_MCOLOR_*` foregrounds and the tactical backgrounds (see `docs/TACTICAL-VISUALS.md` for the muted palette).

---

## 12. Hotkey Tables

### 12.1 Source

The authoritative adapted hotkey table is `game/hotkeys.js`:
- `TACTICAL_KEYS` (`hotkeys.js:2-11`) — the display table (Spanish labels) rendered by the help panel.
- `tacticalShortcut(event, {editing, dialog, nativeControl})` (`hotkeys.js:12-19`) — the resolver. Guards: `editing`/`dialog`/`event.repeat`/`event.isComposing`/`ctrlKey`/`metaKey` return `null`; `nativeControl` blocks Space/Enter; `altKey` only allows `r` (reload); `shiftKey` only allows `?`/`+`/`{`/`}`. Returns action strings: `select:N`, `next`, `map`, `turn`, `move`, `fire`, `melee`, `run`, `walk`, `crouch`, `prone`, `sneak`, `stance-up/down`, `weapon`, `brace`, `overwatch`, `mount`, `sight`, `loot`, `heal`, `aim-up/down`, `zoom-in/out`, `help`, `cancel`.

### 12.2 Web recipe

- **Dispatch:** `Battlefield.tsx:32-58` registers a `window` `keydown` listener, calls `tacticalShortcut`, and maps each action to state/`order()` calls. This is the reference implementation for any new screen's hotkeys.
- **Help display:** `TACTICAL_KEYS` is rendered as a `<dl>` in the help panel (`Battlefield.tsx:71`).
- **Documentation:** the authoritative human-readable mapping is `docs/TACTICAL-HOTKEYS.md`; keep `game/hotkeys.js` and that doc in sync.

### 12.3 Keyboard / a11y

- Shortcuts suspend while editing/dialog/native-control focused (`hotkeys.js:13-15`; `Battlefield.tsx:33,36`).
- `Ctrl`/`Cmd` remain browser-owned; `Alt` only for reload (`hotkeys.js:16`).
- `Escape` closes help/conversation or returns to move cursor; it never undoes committed actions (`Battlefield.tsx:34-35,40`).
- Number keys `1–6` select squad members instead of browser function keys (`hotkeys.js:18`).

---

## 13. Mapping Summary

| Engine subsystem | Source header | Web target | Docs |
|---|---|---|---|
| Button System | `sgp/Button System.h` | `web/components/ui/button.tsx`, `Battlefield.tsx` | — |
| Button Sound | `sgp/Button Sound Control.h` | `web/lib/battle-audio.ts` | — |
| Music Control | `Utils/Music Control.h` | `web/hooks/useMusicMode` (new) | — |
| Ambient Control | `TileEngine/Ambient Control.h` | `web/lib/battle-audio.ts` (ambience bus) | `TACTICAL-VISUALS.md` (biomes) |
| Interface Panels | `Tactical/Interface Panels.h` | `Battlefield.tsx` inspector + roster | — |
| Radar Screen | `TileEngine/Radar Screen.h` | `web/app/TacticalMinimap.tsx` | `TACTICAL-VISUALS.md` |
| Fade Screen | `Ja2/Fade Screen.h` | CSS overlay / canvas fade | — |
| Loading Screen | `Ja2/Loading Screen.h` | splash overlay + `web/public/art` | `TACTICAL-VISUALS.md` |
| Help Screen | `Ja2/HelpScreen.h` | `Battlefield.tsx` key-reference panel | `TACTICAL-HOTKEYS.md` |
| Credits | `Ja2/Credits.h` | credits component (new) | — |
| Fonts | `sgp/Font.h`, `Utils/Font Control.h` | CSS font stacks + canvas `ctx.font` | `TACTICAL-VISUALS.md` |
| Hotkeys | `game/hotkeys.js` | `Battlefield.tsx` keydown | `TACTICAL-HOTKEYS.md` |

---

## 14. Reproduction Checklist

- [ ] **Buttons:** every `GUI_BUTTON` maps to a native `<button>` with `disabled`/`aria-pressed`/`aria-checked`; five-state images via CSS pseudo-classes; icon-only buttons have `aria-label`.
- [ ] **Button sounds:** synthesized clicks on hover/click/disabled via the shared gesture-gated `AudioContext`; dedupe hover spam; mute toggle respected.
- [ ] **Music:** `useMusicMode` hook crossfades playlists on mode change (menu/tactical/battle/victory); volume persisted; autoplay after first gesture.
- [ ] **Ambience:** per-biome looping beds + sparse one-shots; crossfade on sector change; fire ambience tied to torch state; suspend on tab hide.
- [ ] **Panels:** SMPanel → inspector; TEAMPanel → roster; prev/next merc, done, map-screen buttons wired; radio locator ring; panel buttons disabled while busy.
- [ ] **Radar:** `TacticalMinimap` renders tiles/units/camera; click-to-center and arrow-key pan; `role="button"` + `aria-label`.
- [ ] **Fade:** overlay fade with `onTransitionEnd` hooks; `prefers-reduced-motion` shortens/skips.
- [ ] **Loading:** sector splash with day/night variant and aspect-ratio handling; transient `role="status"`.
- [ ] **Help:** `H`/`?` toggles, `Escape` closes, gameplay pauses while open; real `role="dialog"` when modal.
- [ ] **Credits:** scrollable credits with skip + `Escape`; reduced-motion static fallback.
- [ ] **Fonts:** named `FONT*` aliases → CSS stacks; `FONT_MCOLOR_*` → palette variables; canvas text uses mapped stack + shadow; contrast checked against `TACTICAL-VISUALS.md` palette.
- [ ] **Hotkeys:** `game/hotkeys.js` resolver wired to `Battlefield.tsx`; editing/dialog/native-control guards; `Ctrl`/`Cmd` reserved; `Alt` only reload; `1–6` select squad; help table matches `TACTICAL-HOTKEYS.md`.
