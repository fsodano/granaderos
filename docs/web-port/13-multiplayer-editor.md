# 13 — Multiplayer & Editor: Native Inventory and Web Port Guidance

**Audience:** a web engineer with **no Jagged Alliance 2 experience** who must decide what
(if anything) of the native multiplayer stack and the map editor can be ported to the
browser game. This document is a **translation guide and scoping document**, not a
specification to implement verbatim. It inventories the native code, documents the
compile-time flags that govern cooperative play, and gives a concrete recommendation on
what to port, what to defer, and what to leave out of scope.

**Source of truth:** `engine/Multiplayer/`, `engine/Ja2/MP*Screen.*`, `engine/Editor/`,
`engine/export/src/`, `engine/tools/`, `engine/crash-telemetry/`. Headers declare the data
structures and constants; `.cpp` files implement them. This document reads **headers and
build configuration only** — it does not trace full `.cpp` bodies.

**Companion docs:** [02 — Tile Engine](02-tile-engine.md) owns the isometric renderer and
world data; [11 — Data Assets](11-data-assets.md) owns asset pipelines. This doc reuses
02's map-format section for the browser map-editor MVP (§7).

---

## 1. Big picture: what the native code actually is

Two largely independent subsystems live under `engine/`:

1. **Multiplayer** (`engine/Multiplayer/` + `engine/Ja2/MP*Screen.*`) — a peer-to-peer
   (host/client) networking layer built on the **RakNet** library, plus five UI screens
   (connect, host, join, chat, score). It is a **native, LAN-era, turn-based** system with
   file-transfer sync and a `ja2_mp.ini` configuration file.
2. **Map Editor** (`engine/Editor/`) — a full in-game sector editor compiled only under
   `JA2EDITOR`. It edits terrain, buildings, items, mercs, map info, and options, and
   writes `.dat` map files.

Neither is currently reachable from the browser game (`web/`). The browser game authors
maps in `game/maps.js` (see [02 §14](02-tile-engine.md#14-saveloadmapdat-format-worlddefcpp-saveworld))
and has no networking at all. This document's job is to say **what maps cleanly onto the
web surface and what does not**.

---

## 2. Multiplayer inventory

### 2.1 Core networking (`engine/Multiplayer/`)

| File | Role |
|---|---|
| `network.h` | Shared structs/constants between client and server. Defines `settings_struct` (all lobby options), `client_info`, `filetransfersettings_struct`, `mapchange_struct`, `edgechange_struct`, `teamchange_struct`, `progress_struct`. Also `ja2_mp.ini` section/property name macros. |
| `connect.h` | The connection state machine. Globals `is_connected`, `is_connecting`, `is_client`, `is_server`, `is_networked`, `is_host`; the `send_*` family (path, stance, fire, bullet, hire, dismiss, end-turn, AI, grenade, explosive, smoke); `MPEncodeSoldierID`/`MPDecodeSoldierID`; the `MP_TYPE_*` game-type enum (Deathmatch, Team Deathmatch, Coop); `player_stats`; `MPVERSION` string. |
| `client.cpp` | Client packet handling and the interrupt/deadlock workaround (`INTERRUPT_MP_DEADLOCK_FIX`). |
| `server.cpp` | Server packet handling and authoritative turn/team/edge logic. |
| `transfer_rules.h/.cpp` | File-transfer rules for syncing game data between host and clients. |
| `fresh_header.h` | Header shim. |
| `raknet/` | The vendored **RakNet** library (peer, RPC, replica, file-transfer, lobby, etc.). Third-party; not ported. |

### 2.2 UI screens (`engine/Ja2/`)

| Screen | Header | Role |
|---|---|---|
| Connect | `MPConnectScreen.h` | Entry screen; sets heading/sub-message text. |
| Host | `MPHostScreen.h` | Create a server; configure lobby settings. |
| Join | `MPJoinScreen.h` | Browse/join servers; `CUniqueServerId` + `SaveJoinSettings`; `MpIniExists`. |
| Chat | `MPChatScreen.h` | In-game chat box; `DoChatBox`, `ChatLogMessage`, `gszChatBoxInputString`, `gbChatSendToAll`. |
| Score | `MPScoreScreen.h` | End-of-match scoreboard. |

All five follow the same `*Init` / `*Handle` / `*Shutdown` screen pattern used across the
JA2 engine.

### 2.3 Cooperative-play compile-time flags (`engine/CMakeLists.txt`)

These are **compile-time `add_compile_definitions`**, not runtime options. They are the
single most important thing to understand before porting any coop logic:

| Flag | Meaning |
|---|---|
| `DISABLE_MP_INTERRUPTS_IN_COOP` | Interrupts stay off in COOP: AI interrupts computed on a pure client are still wrong. Also drops the server-side ALT+E "override turn" dialog. Guarded in `engine/Tactical/Turn Based Input.cpp:1959` and `engine/Tactical/TeamTurns.cpp:1496`. |
| `INTERRUPT_MP_DEADLOCK_FIX` | r5623 workaround for the enemy AI deadlocking on a pure-client interrupt. Guarded in `engine/Multiplayer/client.cpp:1938` and `engine/Tactical/TeamTurns.cpp:1197,2339`. |
| `ENABLE_MP_FRIENDLY_PLAYERS_SHARE_SAME_FOV` | **Coop FOV flag.** Friendly players on the same team share the same field-of-view (fog-of-war reveal). This is the "coop FOV" behavior. |

**Web implication:** these are compile-time switches baked into the native binary. A web
port must instead model them as **runtime configuration** (a lobby setting), because the
browser ships one build to everyone. The semantics to preserve: in coop, disable
interrupts, apply the deadlock workaround, and share FOV among friendly players.

---

## 3. Editor inventory (`engine/Editor/`)

Compiled only under `JA2EDITOR`. The editor is a **taskbar-driven** tool with seven task
modes and a large set of draw modes.

### 3.1 Task modes (`EditorDefines.h`)

```
TASK_NONE, TASK_TERRAIN, TASK_BUILDINGS, TASK_ITEMS, TASK_MERCS, TASK_MAPINFO, TASK_OPTIONS
```

### 3.2 Toolbar modes (`EditorDefines.h` `TBAR_MODE_*`)

- **File/global:** NONE, DRAW, ERASE, UNDO, EXIT_EDIT, QUIT_GAME, NEW_MAP, SAVE, LOAD,
  SET_BGRND, CHANGE_BRUSH, ERASE_OFF, FILL_AREA, FILL_AREA_OFF.
- **Terrain:** DRAW_DEBRIS, DRAW_BANKS, DRAW_MERC, DRAW_NPC1..4, DRAW_OSTRUCTS(1/2),
  GET_WALL/DOOR/WINDOW/ROOF/BROKEN_WALL/DECOR/DECAL/FLOOR/TOILET/OSTRUCTS/FGRND/BGRND/
  DEBRIS/BANKS/ROADS/ROOM/NEW_ROOF/TILE_TO_ROOM, CHANGE_TILESET, CIVILIAN_GROUP,
  FAKE_LIGHTING, LIGHT_UP/DWN, DEC/INC_DIFF, RAISE/LOWER_LAND, DENS_UP/DWN, MAKE_NEW_ROOM.
- **Items:** ITEM_WEAPONS, ITEM_AMMO, ITEM_ARMOUR, ITEM_LBEGEAR, ITEM_EXPLOSIVES,
  ITEM_EQUIPMENT1..3, ITEM_TRIGGERS, ITEM_KEYS, ITEM_RANDOMITEM.
- **Other:** RADAR_MAP.

### 3.2b Draw modes (`EditorDefines.h` `DRAW_MODE_*`)

Ground/new/high ground, debris, banks, roads, ostructs, walls/doors/windows/roofs/
broken-walls/decor/decals/floors, smart walls/windows/doors/broken-walls/doorkeys,
toilet/room/saw-room/roomnum/caves/slanted-roof/kill/copy/move building, show-tileset,
light, player/enemy/creature/rebel/civilian placement, schedule-action, exit-grid,
N/S/E/W/center/isolated points, place-item, select-brush, fill-area, undo, erase.

### 3.3 Key editor files

| File | Role |
|---|---|
| `editscreen.h` | Main editor screen; light handles, waypoints, toolbar show/hide, entry points, `CreateNewMap`, `HandleKeyboardShortcuts`, `PerformSelectedAction`. |
| `EditorDefines.h` | All task/toolbar/draw-mode enums and shared editor globals. |
| `Item Statistics.h` | Item-stats editing panel; `ACTIONITEM_*` enum (traps, explosives, doors, alarms); `SpecifyItemToEdit`, `ShowItemStatsPanel`, `ExecuteItemStatsCmd`. |
| `EditorTerrain.*`, `EditorBuildings.*`, `EditorItems.*`, `EditorMercs.*`, `EditorMapInfo.*` | Per-task editing logic. |
| `Editor Undo.*` | Undo system. |
| `Road Smoothing.*`, `Smoothing Utils.*`, `smooth.*`, `newsmooth.*` | Road/terrain smoothing. |
| `SmartMethod.*` | Smart wall/door placement. |
| `XML_ActionItems.cpp` | Action-item XML import. |
| `LoadScreen.*`, `Sector Summary.*`, `Summary Info.h` | Map load and sector summary. |
| `edit_sys.*`, `messagebox.*`, `popupmenu.*`, `selectwin.*` | Editor UI plumbing. |

### 3.4 Editor feature matrix (native → web)

| Native feature | Web portability | Notes |
|---|---|---|
| Terrain draw/erase/fill | **High** | Maps to the tile grid in `game/maps.js`; see §7 MVP. |
| Buildings (walls/doors/windows/roofs) | **Medium** | `game/maps.js` uses `blocked` footprints; needs a building primitive. |
| Items placement | **Medium** | Reuses item stats from [05 — Weapons & Items](05-weapons-items.md). |
| Merc/NPC placement | **Medium** | Reuses roster from [04 — Soldiers & Stats](04-soldiers-stats.md). |
| Map info / sector summary | **High** | Metadata form. |
| Undo | **High** | Trivial in a JS editor (command stack). |
| Road smoothing | **Low** | Algorithmic; defer. |
| Smart walls | **Low** | Algorithmic; defer. |
| Lighting / shade | **Low** | Renderer concern (02); defer. |
| `.dat` save/load | **Low** | Browser authors `game/maps.js`; see 02 §14. |

---

## 4. Tools, export, and crash-telemetry inventory

### 4.1 `tools/` (repo root — build/asset scripts)

| File | Role |
|---|---|
| `build-web.mjs` | Builds the browser-only game and stages a verified static export. |
| `verify-tactical-assets.mjs` | Verifies tactical asset integrity (terrain materials, scenery objects). |
| `compile_tactical_materials.py` | Compiles the preserved 3×3 terrain atlas (Pillow); `--check` for byte-for-byte reproduction. |
| `generate_campaign.py` | Generates JA2 table overlays from pinned upstream data. |
| `sti.py` / `sti_assets.py` | Encode PNGs as JA2 STCI/ETRLE surfaces; rebuild/install original assets. |
| `apply_engine_patch.py` | Applies reviewed Granaderos changes to pinned upstream; repeatable. |
| `build-windows.ps1` / `build-package.ps1` | Windows build and packaging. |

### 4.2 `engine/export/src/` — Ja2Export utility

A console tool (`Ja2Export`) that converts native assets to web-friendly formats. Built
from `init_vfs.cpp`, `main.cpp`, `progress_bar.cpp`, and `ja2/` + `export/` submodules
(`jsd`, `slf`, `sti`). Links `bfVFS` and `libpng`. **This is the asset-export path** — it
is the bridge between native `.sti`/`.slf`/`.jsd` data and the browser. Relevant to
[11 — Data Assets](11-data-assets.md), not to multiplayer.

### 4.3 `engine/tools/` — developer tools

| File | Role |
|---|---|
| `symbolize_crash.cpp` | Reads a crash report written by `sgp::writeExceptionBacktrace` and resolves addresses against a build's PDB. C++23 (game is C++17). |
| `CMakeLists.txt` | Builds `symbolize_crash`; links `dbghelp.lib`. |

### 4.4 `engine/crash-telemetry/` — Cloudflare Worker sink

A **Cloudflare Worker** (`worker.js`, `wrangler.toml`, `package.json`, `test.mjs`) that
receives crash reports uploaded by `sgp::processCrashTelemetry` and posts them to a
Discord channel. Key contract (from `README.md`):

- Client (`reportIsSettled()` in `sgp/crash_telemetry.cpp`) deletes its report copy on
  **2xx** and on **400/413/415**; keeps it on **429** and **5xx** (retries next launch).
- Per-IP rate limit via `UPLOAD_LIMITER` binding (50/min), must clear client
  `kMaxUploadsPerRun` (20).
- No auth; endpoint URL ships in every player's `Ja2.ini` under `CRASH_TELEMETRY_URL`.

---

## 5. WebSocket port-vs-defer recommendation

**Recommendation: defer a full multiplayer port; do not build a WebSocket transport for
the native RakNet protocol.**

Rationale:

1. **Protocol mismatch.** The native stack is RakNet peer-to-peer with a bespoke
   `send_*` packet family and a `settings_struct` lobby handshake. Reimplementing that
   over WebSocket is a from-scratch protocol design, not a port — the wire format is
   undocumented and tied to RakNet's framing.
2. **Turn-based, LAN-era model.** The system assumes a host with authoritative
   turn/team/edge logic and file-transfer sync. The browser game is single-player,
   save-in-browser, with no server. There is no existing web surface to attach it to.
3. **Compile-time flags.** Coop behavior (`DISABLE_MP_INTERRUPTS_IN_COOP`,
   `INTERRUPT_MP_DEADLOCK_FIX`, `ENABLE_MP_FRIENDLY_PLAYERS_SHARE_SAME_FOV`) is baked at
   compile time; a web port would need to re-model it as runtime config, which is a
   design change, not a translation.
4. **Cost/benefit.** The browser game's roadmap (per `README.md`) is single-player
   campaign fidelity. Multiplayer is not on the critical path.

**What to do instead (if multiplayer is ever wanted):** design a **new, minimal
WebSocket protocol** that reuses the *semantics* (turn passing, shared FOV, chat) rather
than the *wire format*. Model the three coop flags as lobby settings. Reuse the chat
screen's message model (`MPChatScreen.h`) and the score screen's `player_stats` shape
(`connect.h`) as the only directly portable pieces.

---

## 6. Browser map-editor MVP (reusing doc 02)

The editor is the **higher-value, lower-cost** port. The browser already has an
isometric renderer and authored maps (`game/maps.js`, see [02 §14](02-tile-engine.md#14-saveloadmapdat-format-worlddefcpp-saveworld)).
An MVP map editor should **edit `game/maps.js` tile data directly**, not `.dat` files.

**MVP scope (reuses 02's tile model):**

1. **Tile grid editor** — paint `type` (grass/stone/forest/road/water/…) onto the
   `WIDTH×HEIGHT` grid, mirroring `TBAR_MODE_DRAW`/`ERASE`/`FILL_AREA`.
2. **Blocked/cover flags** — toggle `blocked` and `cover` per tile, mirroring the
   `MAP_ELEMENT` flags documented in 02 §3.1.
3. **Building footprints** — place `wall`/`stone` rectangles, mirroring `TASK_BUILDINGS`
   and the `rect()` helper in `game/maps.js`.
4. **Undo/redo** — a JS command stack, mirroring `Editor Undo.*`.
5. **Export** — serialize back to the `game/maps.js` tile shape (or JSON) so authored
   maps drop into the existing renderer.

**Explicitly out of MVP:** road smoothing, smart walls, lighting/shade, `.dat` I/O,
merc/NPC placement, item-stats editing. These are algorithmic or renderer concerns that
02 and 05 already own.

---

## 7. Telemetry mapping (native → web)

The native crash-telemetry pipeline is: `sgp::processCrashTelemetry` → Cloudflare Worker
→ Discord, with a strict status-code settlement contract. The browser game has no such
pipeline today.

**Mapping recommendation:**

| Native concept | Web equivalent |
|---|---|
| `sgp::processCrashTelemetry` upload | Browser `window.onerror` / `unhandledrejection` handler posting to the same Worker. |
| `reportIsSettled()` status contract | Reuse the exact 2xx/400/429/5xx settlement rules so reports aren't silently dropped. |
| `CRASH_TELEMETRY_URL` in `Ja2.ini` | A build-time config constant (or env var) in the web build. |
| `symbolize_crash` (PDB resolution) | Source maps (`webpack`/`vite` sourcemap upload) — the browser analog of PDB symbolication. |
| `kMaxUploadsPerRun` (20) | A client-side retry queue with the same cap. |

The Worker itself (`worker.js`) is **directly reusable** — it is already a generic
HTTP→Discord forwarder and does not care whether the body came from native or browser
code.

---

## 8. Out-of-scope list (with rationale)

| Item | Rationale |
|---|---|
| RakNet library port | Third-party, undocumented wire format, no web equivalent. |
| Native `send_*` packet protocol | Bespoke, undocumented, tied to RakNet framing. |
| Full multiplayer (host/join/score) | No web server/session surface; single-player roadmap. |
| Coop FOV / interrupt / deadlock logic | Compile-time flags; requires runtime-config redesign; not on critical path. |
| File-transfer sync (`transfer_rules`) | LAN-era data sync; browser ships one build. |
| `ja2_mp.ini` parsing | Native config; browser uses JS config. |
| Editor `.dat` save/load | Browser authors `game/maps.js`; see 02 §14. |
| Road smoothing / smart walls / lighting | Algorithmic or renderer concerns owned by 02. |
| Core combat / tactical rules | Owned by [03 — Tactical Combat](03-tactical-combat.md); explicitly excluded. |

---

## 9. Reproduction checklist

To verify the inventory and flags in this document against the source:

1. **MP screens exist:** `ls engine/Ja2/MP*Screen.h` → Connect, Host, Join, Chat, Score.
2. **MP core exists:** `ls engine/Multiplayer/*.h` → `network.h`, `connect.h`,
   `transfer_rules.h`, `fresh_header.h`; plus `client.cpp`, `server.cpp`.
3. **Coop flags:** `grep -n "DISABLE_MP_INTERRUPTS_IN_COOP\|INTERRUPT_MP_DEADLOCK_FIX\|ENABLE_MP_FRIENDLY_PLAYERS_SHARE_SAME_FOV" engine/CMakeLists.txt` → all three present in `add_compile_definitions`.
4. **Flag guard sites:** `grep -rn "DISABLE_MP_INTERRUPTS_IN_COOP\|INTERRUPT_MP_DEADLOCK_FIX" engine/Tactical engine/Multiplayer` → `Turn Based Input.cpp`, `TeamTurns.cpp`, `client.cpp`.
5. **Editor exists:** `ls engine/Editor/` → `editscreen.h`, `EditorDefines.h`,
   `Item Statistics.h`, task files.
6. **Editor task modes:** `grep -n "TASK_" engine/Editor/EditorDefines.h` → 7 modes.
7. **Export tool:** `ls engine/export/src/` → `main.cpp`, `ja2/`, `export/`.
8. **Crash telemetry:** `ls engine/crash-telemetry/` → `worker.js`, `wrangler.toml`,
   `README.md`; confirm the status-code contract table in §4.4.
9. **Browser map surface:** `head -30 game/maps.js` → `WIDTH=20, HEIGHT=16`, tile
   `{x,y,type,blocked,cover}` shape referenced by the §6 MVP.

---

## 10. Summary

- **Multiplayer: defer.** The native RakNet stack and its compile-time coop flags do not
  map onto the single-player browser game. If ever wanted, design a new minimal
  WebSocket protocol reusing only the chat/score semantics and re-modeling the three
  coop flags as runtime lobby settings.
- **Editor: port a browser MVP.** Edit `game/maps.js` tile data directly (paint
  type/blocked/cover, building footprints, undo, export), reusing 02's tile model.
- **Telemetry: reuse the Worker.** The Cloudflare Worker is transport-agnostic; map the
  native settlement contract and `symbolize_crash` to browser error handling + source
  maps.
