# 11. Engine Data Formats, Asset Pipeline & i18n

Scope: how the JA2 v1.13 engine (`engine/`) stores its data, how the Granaderos
mod overlay (`mod/`) and the asset pipeline (`assets/`, `tools/`) feed it, and
what each format converts to for the browser game (`web/`, `game/`). This is a
reference for the web port; it does not re-derive binary layouts that are
already documented in [02-tile-engine.md](02-tile-engine.md).

All paths are relative to the repository root unless noted.

---

## 1. gamedir layout

The engine reads everything from a game directory. The pinned engine submodule
ships a full one at `engine/gamedir/`:

| Path | Contents |
|---|---|
| `engine/gamedir/Base/` | Vanilla JA2 data (retail assets, not committed) |
| `engine/gamedir/Data-1.13/` | v1.13 data: `TableData/`, `Maps/`, `tilesets/`, `Faces/`, `Loadscreens/`, `Speech/`, `Npc_Speech/`, `BigItems/`, `Interface/`, `Laptop/`, `BinaryData/`, `Scripts/`, `Ja2Set.dat.xml`, `Ja2_Options.INI`, `*.ini` |
| `engine/gamedir/Data-UB/` | Unfinished Business data |
| `engine/gamedir/Profiles/` | Writable user profile (saves, settings) |
| `engine/gamedir/Ja2.ini` | Main config; selects the VFS config |
| `engine/gamedir/vfs_config.*.ini` | Virtual file system mount order (JA2Vanilla, JA2113, UBVanilla, UB113) |
| `engine/gamedir/XML Editor.exe`, `INI Editor.exe` | Data editing tools (Windows) |

The Granaderos overlay is `mod/Data-Granaderos/` (see §7). Per
`mod/README.md`, it is copied over the engine's `gamedir`, the retail JA2
`Data` assets are supplied, and `mod/ja2.ini` selects
`mod/vfs_config.Granaderos.ini`, which mounts the mod after `Data-1.13` and
before the writable user profile.

---

## 2. TableData XML: names and loader

All gameplay tables live under `engine/gamedir/Data-1.13/TableData/`. Top-level
XML files (from directory listing):

`AIMAvailability.xml`, `Backgrounds.xml`, `CampaignStatsEvents.xml`,
`CivGroupNames.xml`, `DifficultySettings.xml`, `Disease.xml`,
`EnemyNames.xml`, `EnemyRank.xml`, `FaceGear.xml`, `HiddenNames.xml`,
`History.xml`, `IMPPortraits.xml`, `IMPVoices.xml`, `LoadScreenHints.xml`,
`MercAvailability.xml`, `MercOpinions.xml`, `MercProfiles.xml`,
`MercQuote.xml`, `MilitiaIndividual.xml`, `OldAIMArchive.xml`,
`RandomStats.xml`, `RPCFacesSmall.xml`, `SpreadPatterns.xml`,
`SquadNames.xml`, `Vehicles.xml`.

Subdirectories (from `TableData/` listing):

| Subdir | Example files |
|---|---|
| `Items/` | `AmmoTypes.xml`, `AmmoStrings.xml`, `AttachmentSlots.xml`, `CompatibleFaceItems.xml`, `Explosives.xml`, `Food.xml`, `LoadBearingEquipment.xml`, `Merges.xml`, `Pockets.xml`, `StructureDeconstruct.xml`, `StructureMove.xml` |
| `Inventory/` | item inventory tables |
| `NPCInventory/` | `Merchants.xml`, `JakeInventory.xml`, `TonyInventory.xml`, `AdditionalDealer_1..60_Inventory.xml` (per-NPC stock) |
| `Layout/` | `LayoutMainMenu.xml` (menu background/logo wiring) |
| `Map/`, `MapAction/` | map-related tables |
| `Army/` | enemy composition tables |
| `Email/` | `EmailMercAvailable.xml`, `EmailMercLevelUp.xml`, … |
| `BriefingRoom/`, `Multiplayer/`, `Lookup/`, `Profiles/`, `Sounds/` | misc tables |

### Loader: `engine/Ja2/Init.cpp` `LoadExternalGameplayData()`

`Init.cpp:136` defines `BOOLEAN LoadExternalGameplayData(STR directoryName,
BOOLEAN isMultiplayer)`; it is invoked at `Init.cpp:1420` with
`TABLEDATA_DIRECTORY`. It builds each filename as `directoryName + constant`
and calls the matching `ReadIn*` loader (all in `Utils/XML_*.cpp`). Load order
matters: `SpreadPatterns` before `AmmoTypes`/`Items` (referenced by name or
index), then enemy drops, sector loadscreens, ammo, items, sounds, magazines,
attachments, merges, explosives, drugs, food, disease, structure
construct/deconstruct, merchants, clothes, random items, squad names, load
screen hints, armour, LBE, weapons, gun choices, and more.

Key filename constants seen in the region (`Init.cpp:136–495`):
`SPREADPATTERNSFILENAME`, `ENEMYMISCDROPSFILENAME`,
`ENEMYEXPLOSIVEDROPSFILENAME`, `ENEMYWEAPONDROPSFILENAME`,
`ENEMYAMMODROPSFILENAME`, `ENEMYARMOURDROPSFILENAME`,
`SECTORLOADSCREENSFILENAME`, `AMMOTYPESFILENAME`, `AMMOFILENAME`,
`BURSTSOUNDSFILENAME`, `ITEMSFILENAME`, `SOUNDSFILENAME`,
`MAGAZINESFILENAME`, `ATTACHMENTSFILENAME`, `ATTACHMENTINFOFILENAME`,
`LAUNCHABLESFILENAME`, `COMPATIBLEFACEITEMSFILENAME`, `MERGESFILENAME`,
`ATTACHMENTCOMBOMERGESFILENAME`, `ITEMTRANSFORMATIONSFILENAME`,
`EXPLOSIVESFILENAME`, `DRUGSFILENAME`, `FOODFILENAME`,
`FOODOPINIONFILENAME`, `DISEASEFILENAME`, `STRUCTUREDECONSTRUCTFILENAME`,
`STRUCTURECONSTRUCTFILENAME`, `INTERACTIVEACTIONSFILENAME`,
`STRUCTUREMOVEFILENAME`, `MERCHANTSFILENAME`, `CLOTHESFILENAME`,
`RANDOMITEMFILENAME`, `SQUADNAMEFILENAME`, `LOADSCREENHINTSFILENAME`,
`ARMOURSFILENAME`, `LOADBEARINGEQUIPMENTFILENAME`, `LBEPOCKETFILENAME`,
`LBEPOCKETPOPUPFILENAME`, `MERCSTARTINGGEARFILENAME`, `WEAPONSFILENAME`,
`INCOMPATIBLEATTACHMENTSFILENAME`, `ATTACHMENTSLOTSFILENAME`,
`ENEMYGUNCHOICESFILENAME`, `GUNCHOICESFILENAME_ENEMY_ADMIN/REGULAR/ELITE`.

Localization pattern: for non-English `g_lang`, `AddLanguagePrefix(fileName)`
is applied and the prefixed file is loaded if it exists, falling back to the
English default (e.g. `Init.cpp:203–219`, `243–250`, `315–322`, `360–367`,
`397–430`, `446–453`, `470–477`).

---

## 3. STI / sprite formats

STI (STCI) is the engine's sprite container. Two header contracts matter:

- `engine/sgp/STCI.h` — reader API:
  `LoadSTCIFileToImage(HIMAGE, UINT16 fContents)` and
  `IsSTCIETRLEFile(CHAR8*)`. The `HIMAGE`/`STCISubImage` machinery lives in
  `engine/export/src/ja2/himage.h` / `imgfmt.h`.
- `engine/Utils/STIConvert.h` — writer API:
  `WriteSTIFile(...)` with flags `CONVERT_ETRLE_COMPRESS (0x0020)` and
  `CONVERT_TO_8_BIT (0x1000)`, plus `ETRLECompressSubImage(...)`.

Two surface types are used by the engine:
- **RGB565** (16-bit, no alpha) — full-screen images such as loadscreens.
- **ETRLE** (8-bit indexed, run-length encoded) — sprites/faces; palette index
  0 is reserved for transparency, alpha thresholded at 128 (no partial alpha).

The Granaderos conversion tooling is `tools/sti.py` (single-image converter)
and `tools/sti_assets.py` (rebuilds all engine assets and records hashes in
`assets/manifest.json`). See `assets/README.md` §"Engine assets" for the exact
commands and the delivered STI files.

---

## 4. Sound hook headers

The engine's sound layer is `engine/sgp/soundman.h` (the "sound manager"
interface), which includes `engine/sgp/fmod.h` (FMOD driver) and
`engine/sgp/dsound.h` (DirectSound driver). `soundman.h` defines the sample
status flags, `SOUNDPARMS` (speed, pitch bend, volume, pan, loop, priority,
`EOSCallback`), `RANDOMPARMS`, and the `InitializeSoundManager()` /
`ShutdownSoundManager()` lifecycle. Sound *content* is referenced from
`TableData/Sounds/` XML and `Data-1.13/Speech/` + `Npc_Speech/` (voice), and
`BattleSNDS/` (battle effects). For the web port these are the audio formats
that must be converted (see §8).

---

## 5. Map `.dat` format

The tactical map binary format is **not re-derived here**. It is fully
documented in [02-tile-engine.md](02-tile-engine.md) §14
"SaveLoadMap.dat format (`worlddef.cpp` `SaveWorld()`)":

- Flat little-endian binary stream: version floats, `WORLD_ROWS`/`WORLD_COLS`,
  flags, tileset id, soldier size, per-cell height + land/object/struct/
  shadow/roof/onroof **count nibbles**, then the `(type, subIndex)` layer
  payloads, room info, items, ambient, lights, map info, soldiers, exit
  grids, door table, edgepoints, NPC schedules.
- Loader is `LoadWorld()` (`worlddef.cpp:2807`).
- **Web recipe (from that doc):** the browser game does **not** load `.dat`
  files. `game/maps.js` authors maps procedurally as
  `{width, height, tiles:[{x,y,type,blocked,cover,...}], buildings, lights,
  decor}`. If a `.dat` parser is ever needed, the `type` byte + `subIndex`
  pair maps through `gTileTypeStartIndex[type] + subIndex` →
  `gTileDatabase` index → sprite.

---

## 6. i18n structure and runtime selection

### Source layout: `engine/i18n/`

- Per-language string tables: `_EnglishText.cpp`, `_GermanText.cpp`,
  `_RussianText.cpp`, `_DutchText.cpp`, `_PolishText.cpp`, `_FrenchText.cpp`,
  `_ItalianText.cpp`, `_ChineseText.cpp` (plus `_Ja25*` variants for
  Unfinished Business).
- `language.cpp` — runtime language state (see below).
- `LanguageStrings.cpp`, `LocalizedStrings.cpp`, `ExportStrings.cpp`,
  `ImportStrings.cpp`, `Multi Language Graphic Utils.cpp`, `text.def`.
- `include/` — headers: `language.hpp`, `Text.h`, `LocalizedStrings.h`,
  `ExportStrings.h`, `ImportStrings.h`, `Multi Language Graphic Utils.h`,
  per-language `_*Text.h`.

### Runtime selection: `engine/i18n/language.cpp`

- `g_lang` is a global `i18n::Lang` (`language.cpp:12`), defaulting to
  `kBuildDefaultLang = i18n::Lang::en` (`language.cpp:8`).
- `SetLanguageFromName()` (`language.cpp:20`) maps a string from `Ja2.ini`
  (`LANGUAGE=...`) to the enum: `ENGLISH`, `GERMAN`, `RUSSIAN`, `DUTCH`,
  `POLISH`, `FRENCH`, `ITALIAN`, `CHINESE`; unknown values keep the build
  default (`language.cpp:40`).
- `GetLanguagePrefix()` (`language.cpp:43`) returns the filename prefix used
  by `LoadExternalGameplayData`'s `AddLanguagePrefix()`: `""` for English,
  `"German."`, `"Russian."`, `"Dutch."`, `"Polish."`, `"French."`,
  `"Italian."`, `"Chinese."`.

Language is chosen at runtime, not at configure time (see
`engine/README.md` §Visual Studio setup). The browser game is Spanish-only;
player-facing strings live in the web app, not in these engine tables.

---

## 7. Editor / export / tools inventory

### `engine/Editor/` (map editor)

Headers only (from listing): `EditorDefines.h`, `Editor Callback
Prototypes.h`, `Button Defines.h`, `Cursor Modes.h`, `Editor Modes.h`,
`Editor Taskbar Creation.h`, `Editor Taskbar Utils.h`, `EditorUndo.h`,
`EditorBuildings.h`, `EditorItems.h`, `EditorMapInfo.h`, `EditorMercs.h`,
`EditorTerrain.h`, `LoadScreen.h`, `messagebox.h`, `newsmooth.h`,
`popupmenu.h`, `Road Smoothing.h`, `Sector Summary.h`, `selectwin.h`,
`SmartMethod.h`, `smooth.h`, `Smoothing Utils.h`, `Summary Info.h`,
`editscreen.h`, `Item Statistics.h`, `XML_ActionItems.cpp`. This is the
Windows tool that authors the `.dat` maps described in §5; the web port does
not use it.

### `engine/export/src/` (headless exporter)

- `main.cpp`, `exporter_base.h`, `init_vfs.cpp/.h` (VFS bootstrap),
  `progress_bar.cpp/.h`, `CMakeLists.txt`.
- `ja2/` — minimal engine surface for the exporter: `himage.cpp/.h`,
  `imgfmt.h`, `types.h`, `sgp_auto_memory.h`, `Structure Internals.h`,
  `XMLWriter.cpp/.h`. This is the harness used to convert engine assets
  (e.g. STI → PNG) without running the full game.

### `engine/tools/`

- `symbolize_crash.cpp` — crash-telemetry symbolizer; `CMakeLists.txt`.

### Repository-root `tools/` (Granaderos pipeline)

`sti.py` (STI converter), `sti_assets.py` (rebuild engine assets),
`apply_engine_patch.py`, `generate_campaign.py` (regenerates
`mod/Data-Granaderos/TableData`), `compile_tactical_materials.py`,
`build-web.mjs`, `build-package.ps1`, `build-windows.ps1`,
`verify-tactical-assets.mjs`.

### Repository-root `assets/`

`source/` (full-res masters), `prompts/` (generation prompts), `previews/`,
`web/` (browser-ready outputs + `manifest.json`), `engine/` (STI outputs),
`rig/` (Blender models), plus build scripts `build_web.py`,
`build_action_atlas.py`, `build_cavalry_atlas.py`, `build_avatars.py`,
`build_paid_portraits.py`, `build_weapon_icons.py`. See
`assets/README.md` for provenance and the full inventory.

---

## 8. Per-format web conversion targets

| Engine format | Where | Web target | Notes |
|---|---|---|---|
| STI RGB565 (loadscreens) | `Loadscreens/*.sti` | **WebP** | Opaque paintings; `assets/build_web.py` |
| STI ETRLE (faces/sprites) | `Faces/*.sti`, `BigItems/`, `Interface/` | **PNG** (RGBA) | Indexed → alpha; palette 0 = transparent |
| `.dat` maps | `Maps/*.dat` | **JSON** | Authored in `game/maps.js`, not parsed |
| `TableData/*.xml` | `Data-1.13/TableData/` | **JSON** | `game/data.js` + `mod/Data-Granaderos/TableData` |
| Sound (`.wav`/`.ogg` via FMOD) | `Speech/`, `Npc_Speech/`, `BattleSNDS/`, `TableData/Sounds/` | **OGG** | Web Audio; no conversion done yet |
| `.ini` options | `Ja2.ini`, `Ja2_Options.INI`, `*.ini` | **JSON/TS** | Ported by hand into `game/` rules |

**Original-data requirement:** the browser game runs without the engine or a
retail JA2 install (see root `README.md`). However, any future conversion of
original `.dat` maps, original STI sprites, or original voice audio **requires
the retail JA2 `Data` assets** (not committed; `engine/gamedir/Base/` is
empty). The Granaderos-specific assets are original and reproducible from
`assets/`; the engine's stock assets are not.

---

## 9. Reproduction checklist

1. **Engine STI assets** — `python3 tools/sti_assets.py` rebuilds all STI
   files, copies them into the mod, records hashes in `assets/manifest.json`.
   Individual: `python3 tools/sti.py <png> <sti> --size WxH [--mode etrle]
   --preview <png>` (see `assets/README.md`).
2. **Browser web assets** — `python3 assets/build_web.py` rebuilds
   `assets/web/` (WebP/PNG) and writes `web/manifest.json`; copies install to
   `web/public/art/`.
3. **Campaign tables** — `python3 tools/generate_campaign.py` regenerates
   `mod/Data-Granaderos/TableData/`; upstream hashes + source commit recorded
   in `mod/Data-Granaderos/campaign-manifest.json`.
4. **Tests** — `python3 -m unittest discover -s tests -p test_sti.py -v`
   (STI format contracts) and `-p test_campaign.py -v` (table preservation,
   roster, weapons, loadouts).
5. **Engine launch (optional)** — copy `mod/Data-Granaderos/` over the
   engine's `gamedir`, supply retail `Data`, run `mod/Granaderos.cmd`
   (`mod/README.md`).
6. **Web build** — `npm ci --prefix web && npm run dev` (or `npm run build`);
   `npm test` + `npm run typecheck` for verification.

---

## 10. Key file references

- `engine/Ja2/Init.cpp` — `LoadExternalGameplayData()` at line 136; call at 1420.
- `engine/sgp/STCI.h`, `engine/Utils/STIConvert.h` — STI read/write contracts.
- `engine/sgp/soundman.h`, `engine/sgp/fmod.h`, `engine/sgp/dsound.h` — sound hooks.
- `engine/i18n/language.cpp`, `engine/i18n/include/language.hpp` — runtime language.
- `engine/gamedir/Data-1.13/TableData/` — gameplay XML tables.
- `engine/Editor/`, `engine/export/src/`, `engine/tools/` — editor/exporter/tools.
- `mod/Data-Granaderos/`, `mod/README.md`, `mod/vfs_config.Granaderos.ini` — overlay.
- `assets/README.md`, `assets/manifest.json`, `assets/web/manifest.json` — asset provenance.
- `tools/sti.py`, `tools/sti_assets.py`, `tools/generate_campaign.py` — pipeline.
- `docs/web-port/02-tile-engine.md` §14 — `.dat` map format (referenced, not re-derived).