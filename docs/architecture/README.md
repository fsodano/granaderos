# Architecture: a progressive guide

[Documentation index](../README.md) · [Development setup](../development/getting-started.md)

This index explains the reading order, shared vocabulary, and scope of the Granaderos architecture guide, connecting the high-level overview, C4 diagrams, and source map to the use-case catalogue and subsystem guides. It describes the current source code; for the target architecture and naming contract, read the [accepted plan](../plans/accepted/domain-architecture.md) and [ubiquitous language](../plans/accepted/ubiquitous-language.md).

Start with the [overview](overview.md). Each subsequent level explains the same system at a smaller scale: first its boundaries, then its interactions, then its internals. You can read any level-4 deep dive independently once you know the terms below.

The [repository map](../development/repository-layout.md) explains the `apps`, `packages`, `content`, `docs`, `tools`, and `reference` directories and where to start in the IDE.

## Reading ladder

The table below lists each guide in the reading ladder by `Level`, links to the `Document`, and states `What you should understand afterward`.

| Level | Document | What you should understand afterward |
| --- | --- | --- |
| 1 | [Overview](overview.md) | What runs where, who owns each fact, and how campaign and sector play connect |
| 2 | [C4 levels 1–3](c4.md) | People, running applications, data stores, and internal components, with source links |
| 2 | [System map](system-map.md) | Directory responsibilities, dependency rules, and fact-ownership boundaries |
| 3 | [Use-case catalogue](use-cases/README.md) | Player and author intentions, interface exposure, and rule boundaries |
| 3 | [Runtime flows](runtime-flows.md) | The concrete call sequences behind loading, orders, sector visits, and saving |
| 4 | [Strategic engine](strategic-engine.md) | Campaign commands, time, travel, personnel, and sector-visit settlement |
| 4 | [Tactical engine](tactical-engine.md) | Sector visits, combat episodes, orders, perception, geometry, AI, and turn flow |
| 4 | [Content and campaigns](content-and-campaigns.md) | Campaign packages, trusted scenarios, authoring projects, and editor playtests |
| 4 | [Rendering](rendering.md) | Simulation-to-visual projection, Three.js scenes, animation cues, and input overlays |
| 4 | [Persistence](persistence.md) | Save identity, validation, terrain compaction, browser storage, and worker encoding |
| 4 | [Build and tooling](build-and-tooling.md) | Static-site staging, architecture and boundary checks, assets, and native history |

## Choose a route

- **Understand the whole application:** [overview](overview.md) -> [C4 views](c4.md) -> [system map](system-map.md) -> [runtime flows](runtime-flows.md).
- **Understand everything you can do:** [overview](overview.md) -> [use-case catalogue](use-cases/README.md) -> domain capability pages and [application contracts](use-cases/application-contracts.md).
- **Change a game rule:** [overview](overview.md) -> [C4 views](c4.md) -> [system map](system-map.md) -> [strategic engine](strategic-engine.md) or [tactical engine](tactical-engine.md) -> [persistence](persistence.md).
- **Create or extend a campaign:** [overview](overview.md) -> [content and campaigns](content-and-campaigns.md) -> [runtime flows](runtime-flows.md).
- **Work on graphics:** [overview](overview.md) -> [rendering](rendering.md) -> [tactical engine](tactical-engine.md).
- **Investigate a deployment:** [system map](system-map.md) -> [build and tooling](build-and-tooling.md) -> [persistence](persistence.md) for origin-specific saves.

The diagrams are Mermaid blocks rendered by GitHub and other Mermaid-capable Markdown readers. Source links are relative to this directory. Each diagram shows logical ownership or one specific execution path rather than every module import.

## Terms used throughout

The table below defines each core `Term` and its `Meaning here` across all architecture pages.

| Term | Meaning here |
| --- | --- |
| Campaign definitions / package | Authored world, cast, equipment, maps, presentation, and supported rule identifiers admitted by `CampaignDefinition` |
| Campaign state | Mutable strategic progress serialized as a campaign snapshot |
| Scenario | A trusted, compiled-in rule module selected by an allowlisted scenario identifier (`generic-v1` or `granaderos-historical-v1`) |
| [`CampaignSectorEntryRequest`](../../packages/game/public/campaign-types.ts) | The campaign snapshot's saved projection of a sector-entry request, stored in `CampaignSnapshot.sectorEntryRequest` |
| [`SectorEntryRequest`](../../packages/game/application/sector-sessions/enter-sector/sector-entry.request.ts) | The narrower application input to `EnterSector` |
| `SectorSession` | One active or suspended sector visit, including deployment, exploration, and combat; the save envelope writes the active view under `sectorSession` and reads legacy `battle` saves |
| [`sectorSession`](../../packages/game/public/campaign-types.ts) | The campaign-order property for an order that carries the active sector view and the save-envelope key for it; not a campaign-snapshot field. Decoded `GameSnapshotContent` keeps the in-memory field `battle` |
| `CombatSession` | One bounded combat episode within a `SectorSession`, owning turn authority, action-point budgets, reactions, and the combat outcome |
| Retained scene | Saved sector or mission state (`sectorSnapshots` / `sceneSnapshots`) used to preserve physical world changes across later visits without duplicating character or inventory ownership |
| Committed state | The accepted campaign and active sector snapshot pair owned by the root browser application at one `gameRevision` |
| Presentation frame | Temporary visual or animation data projected from accepted simulation state; never an owner of game rules or a save checkpoint |
| Worker | A browser Web Worker running shared simulation, save-encoding, or contact-fitting logic on message-transferred snapshots |

## Source and limits

The overview, system map, C4 views, editor boundary, and persistence guides
describe the current source in `apps/`, `packages/`, `content/`, and `tools/`.
Detailed traces in the strategic and tactical engine guides identify where
migrated domain classes and use cases connect to procedural compatibility
modules (`packages/game/campaign.js`, `packages/game/tactical.js`,
`packages/game/world.js`, `packages/game/time.js`, and `packages/game/save.ts`).
The retained root modules
[`actor-condition.js`](../../packages/game/actor-condition.js),
[`medical-patient.js`](../../packages/game/medical-patient.js),
[`battle-outcome.js`](../../packages/game/battle-outcome.js),
[`targeted-combat.js`](../../packages/game/targeted-combat.js),
[`tactical-grid.js`](../../packages/game/tactical-grid.js), and
[`weapon-reload.js`](../../packages/game/weapon-reload.js) re-export rules
owned by [`actor-condition.ts`](../../packages/game/domain/personnel/actor-condition.ts),
[`medical-patient.ts`](../../packages/game/domain/personnel/medical-patient.ts),
[`completed-victory.ts`](../../packages/game/domain/combat/completed-victory.ts),
[`targeted-combat.ts`](../../packages/game/domain/combat/targeted-combat.ts),
[`tactical-grid.ts`](../../packages/game/domain/sector-sessions/tactical-grid.ts),
and [`weapon-reload.ts`](../../packages/game/domain/combat/weapon-reload.ts).
[`tactical-space.ts`](../../packages/game/domain/sector-sessions/tactical-space.ts)
owns the game's tactical-level and cell-space rules. The root modules are
compatibility entry points; the domain modules own these rules.
For care, [`medical-patient.ts`](../../packages/game/domain/personnel/medical-patient.ts)
owns care eligibility and [`care-rules.ts`](../../packages/game/domain/personnel/care-rules.ts)
owns default treatment/rest tuning and the default strategic bleeding
percentage. [`campaign-care-rules.js`](../../packages/game/campaign-care-rules.js)
reads campaign-authored care values and uses those domain defaults;
[`campaign-rules-schema.js`](../../packages/campaign-format/campaign-rules-schema.js)
defines and validates the authored fields.

The native `reference/native/` tree is separate from the browser applications. Each architectural claim traces the named entry points and their collaborators; disabled commands can remain in compatibility switch blocks behind preflight guards. While `packages/game/domain` and `packages/game/application` have strict inward dependency rules enforced by `npm run check:architecture` and `.dependency-cruiser.json`, the compatibility simulation modules at the `packages/game/` root still import trusted campaign defaults and scenario modules in `content/campaigns/`.

The [JA2 reference series](../web-port/README.md) describes upstream behavior and adaptation history. [Browser campaign systems](../development/WEB-SYSTEMS.md) contains historical design notes. Neither overrides current source code or the [accepted architecture plan](../plans/accepted/domain-architecture.md). For the repository documentation index, see [docs/README.md](../README.md).
