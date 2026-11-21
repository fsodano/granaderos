# JA2 engine reference for the browser game

[Documentation index](../README.md) · [Development](../development/README.md)

This series analyzes the original Jagged Alliance 2 v1.13 (`1dot13/source`)
codebase and design as reference material for the Granaderos browser adaptation.
It does **not** describe Granaderos' current browser implementation.

Each document includes C++ source citations, earlier or proposed mappings to
browser modules (`game/` and `web/`, now organized under `packages/game/` and
`apps/web/`), and a reproduction checklist. Source paths written as `engine/...`
and `mod/...` refer to the native reference checkout under
`reference/native/engine/` and `reference/native/mod/`; line numbers refer to
the analyzed engine revision and can change.

The reference engine is the `reference/native/engine/` submodule
(`1dot13/source`), built with C++17 and CMake for 32-bit Windows x86. The
playable browser game uses JavaScript/TypeScript rules and React with vinext.
See [browser setup](../development/getting-started.md).

**Reference scope:** proposals, checklists, and gap descriptions in this series
are source-analysis reference material. Use [the parity audit](../requirements/ja2-parity.md)
for the active gameplay requirements baseline.

## Reading order

| # | Doc | Engine dirs | Web target |
|---|-----|-------------|------------|
| 00 | [Engine Overview](00-overview.md) | all (build graph, screen FSM, GRANADEROS flags) | `game/` + `web/` layering |
| 01 | [Platform: SGP + Utils + ext](01-platform-sgp.md) | `sgp/` (Standard Gaming Platform), `Utils/`, `ext/` | platform shims (Canvas/WebAudio/fetch/IndexedDB) |
| 02 | [Tile Engine](02-tile-engine.md) | `TileEngine/` | `game/maps.js`, `web/app/TacticalScene.tsx` |
| 03 | [Tactical Combat Core](03-tactical-combat.md) | `Tactical/` (AP, fire, LOS, morale) | `game/tactical.js`, `validate-battle.js` |
| 04 | [Soldiers, Mercs & Stats](04-soldiers-stats.md) | `Tactical/` soldiers, `Strategic/` assignments | `characters.js`, `recruitment.js`, `squads.js` |
| 05 | [Weapons, Items & Economy](05-weapons-items.md) | `Tactical/` items/weapons, dealers | `equipment.js`, `ammunition.js`, `industry.js` |
| 06 | [Tactical AI](06-tactical-ai.md) | `TacticalAI/`, `ModularizedTacticalAI/` | enemy phase in `game/tactical.js` |
| 07 | [Strategic Layer](07-strategic-layer.md) | `Strategic/` | `campaign.js`, `time.js`, `world.js` |
| 08 | [Laptop](08-laptop.md) | `Laptop/` | `Desk.tsx`, `Recruitment.tsx`, `Armory.tsx` |
| 09 | [Dialogue, Quests & NPCs](09-dialogue-quests.md) | dialogue/quests/facts, `lua/` | `narrative.js`, `quests.js`, `missions.js` |
| 10 | [Save / Load & Persistence](10-save-load.md) | save/load, INI, i18n selection | `game/save.js`, Guardar export |
| 11 | [Data Formats & Asset Pipeline](11-data-assets.md) | `gamedir/`, XML, STI, i18n | `assets/`, `web/public/` pipeline |
| 12 | [Audio, UI & Input](12-audio-ui-input.md) | buttons, sound, screens, fonts | `web/components`, `web/hooks` |
| 13 | [Multiplayer & Editor](13-multiplayer-editor.md) | `Multiplayer/`, `Editor/`, `tools/` | port-or-defer decisions |

Dependency notes: read `00` first; `02` before `03`; `01` before `10`/`11`/`12`;
`03` + `04` + `05` before `06`; `07` before `08`/`09`; `13` last (mostly defer).

## Use the reference

1. Find the relevant system and its acceptance criteria in the parity audit.
2. Read its engine reference and the current [gameplay note](../gameplay/README.md).
3. Check the source when an exact formula, rule or proposed mapping matters.
4. Implement and verify the bounded behavior. Record results and remaining gaps
   in the relevant feature note and acceptance record.

The [editor and multiplayer reference](13-multiplayer-editor.md) includes
port-or-defer proposals. The [implementation plans](../plans/README.md) hold
separate project plans; neither location proves that a feature is available.
