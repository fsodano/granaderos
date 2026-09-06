# Web-Port Reference Series — `engine/` (JA2 v1.13) → Browser Clone

Target reader: an agent with **zero prior JA2 knowledge** tasked with reproducing this
game in full as a web game. Each doc is self-contained, cites engine `file:line`
sources, maps to the existing web implementation (`game/*.js`, `web/app/*`), and ends
with a reproduction checklist.

Engine identity: JA2 v1.13 fork (`engine/` submodule, `1dot13/source`), C++17, Win32/x86,
CMake (`engine/CMakeLists.txt`). Web clone: Next.js + `game/*.js` rules + `tests/`.
Player-facing content is Spanish; code and docs are English.

## Reading order

| # | Doc | Engine dirs | Web target |
|---|-----|-------------|------------|
| 00 | [Engine Overview](00-overview.md) | all (build graph, screen FSM, GRANADEROS flags) | `game/` + `web/` layering |
| 01 | [Platform: SGP + Utils + ext](01-platform-sgp.md) | `sgp/`, `Utils/`, `ext/` | platform shims (Canvas/WebAudio/fetch/IndexedDB) |
| 02 | [Tile Engine](02-tile-engine.md) | `TileEngine/` | `game/maps.js`, `web/app/TacticalScene.tsx` |
| 03 | [Tactical Combat Core](03-tactical-combat.md) | `Tactical/` (AP, fire, LOS, morale) | `game/tactical.js`, `validate-battle.js` |
| 04 | [Soldiers, Mercs & Stats](04-soldiers-stats.md) | `Tactical/` soldiers, `Strategic/` assignments | `characters.js`, `recruitment.js`, `squads.js` |
| 05 | [Weapons, Items & Economy](05-weapons-items.md) | `Tactical/` items/weapons, dealers | `equipment.js`, `ammunition.js`, `industry.js` |
| 06 | [Tactical AI](06-tactical-ai.md) | `TacticalAI/`, `ModularizedTacticalAI/` | enemy phase in `game/tactical.js` |
| 07 | [Strategic Layer](07-strategic-layer.md) | `Strategic/` | `campaign.js`, `time.js`, `world.js` |
| 08 | [Laptop](08-laptop.md) | `Laptop/` | `Desk.tsx`, `Recruitment.tsx`, `Armory.tsx` |
| 09 | [Dialogue, Quests & NPCs](09-dialogue-quests.md) | dialogue/quests/facts, `lua/` | `narrative.js`, `quests.js`, `missions.js` |
| 10 | [Save / Load & Persistence](10-save-load.md) | save/load, INI, i18n selection | `game/save.js`, Guadar export |
| 11 | [Data Formats & Asset Pipeline](11-data-assets.md) | `gamedir/`, XML, STI, i18n | `assets/`, `web/public/` pipeline |
| 12 | [Audio, UI & Input](12-audio-ui-input.md) | buttons, sound, screens, fonts | `web/components`, `web/hooks` |
| 13 | [Multiplayer & Editor](13-multiplayer-editor.md) | `Multiplayer/`, `Editor/`, `tools/` | port-or-defer decisions |

Dependency notes: read `00` first; `02` before `03`; `01` before `10`/`11`/`12`;
`03` + `04` + `05` before `06`; `07` before `08`/`09`; `13` last (mostly defer).

## How this was produced (parallelization record)

14 files, ~7,900 lines, produced by parallel `deep` documentation agents:

1. Created `docs/web-port/` and fanned out one agent per doc (14 parallel tasks).
   Each prompt fixed: exact output path, line-count target, tool budget
   (`Read`/`Glob`/`Grep`/`Write` only), MUST DO topic list, MUST NOT DO
   boundaries (no code edits, no other files), and the web files to cross-reference.
2. Queue-timeout failures (4 docs) and missing-file completions (SGP, strategic,
   soldiers) were detected via `ls` + `wc -l`, then retried with tightened scopes
   (headers + signature grep instead of full `.cpp` reads, ≤30 tool calls) on the
   emptied queue — all landed.
3. Verified: every file present, 294–899 lines each, each with file:line citations,
   web-mapping tables, and a reproduction checklist.

## Coverage vs. the existing web game

- Already mirrored in `game/`: campaign clock, tactical AP/fire skeleton, operative
  roster, equipment/industry/logistics, authored maps, save/export.
- Known gaps each doc flags: positional inventory slots, trait-id mapping, morale
  stack, records/opinions, interrupt/overwatch fidelity, strategic-event parity,
  laptop transaction flows, dialogue trigger graph, save-schema versioning.
- Deliberately deferred (see `13`): networked multiplayer; native map editor
  (browser MVP proposed instead).

## Using these docs to build

A porting agent should work doc-by-doc: read the doc, implement against its
TypeScript/JSON schema proposals, tick its reproduction checklist, and run the
mapped `tests/` plus `npm run typecheck`. Do not start from the C++ — the docs
already distill the formulas, structs, and state machines.
