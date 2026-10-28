# Architecture: a progressive guide

[Documentation index](../README.md) · [Development setup](../development/getting-started.md)

This guide describes the reviewed source. For the target architecture and naming
contract, read the [accepted plan](../plans/accepted/domain-architecture.md)
and [ubiquitous language](../plans/accepted/ubiquitous-language.md).
The [28 October verification record](../verification/domain-architecture-2026-10-28.md)
connects the accepted stages to executable tests and browser evidence.

Start with the overview. Each subsequent level explains the same system at a
smaller scale: first its boundaries, then its interactions, then its internals.
You do not need to read every deep dive to understand a particular subsystem.

The [repository map](../development/repository-layout.md) explains the `apps`,
`packages`, `content`, `docs`, `tools`, and `reference` directories and where to
start in the IDE.

## Reading ladder

| Level | Document | What you should understand afterward |
| --- | --- | --- |
| 1 | [Overview](overview.md) | What runs where, who owns state, and how campaign and combat connect |
| 2 | [C4 levels 1–3](c4.md) | People, running applications, stores and components, with source links |
| 2 | [System map](system-map.md) | Directory responsibilities, actual dependencies, and integration boundaries |
| 3 | [Use-case catalogue](use-cases/README.md) | Player and author intentions, current availability, and their rule boundaries |
| 3 | [Runtime flows](runtime-flows.md) | The concrete call sequences behind loading, orders, battles, and saving |
| 4 | [Strategic engine](strategic-engine.md) | Campaign commands, time, travel, personnel, and battle settlement |
| 4 | [Tactical engine](tactical-engine.md) | Battle state, orders, perception, geometry, AI, and turn transitions |
| 4 | [Content and campaigns](content-and-campaigns.md) | Packages, trusted scenarios, authoring, and editor playtests |
| 4 | [Rendering](rendering.md) | Simulation-to-visual projection, Three.js, animation, and input overlays |
| 4 | [Persistence](persistence.md) | Save identity, validation, compaction, storage, and asynchronous serialization |
| 4 | [Build and tooling](build-and-tooling.md) | Source-to-static-site deployment, verification, assets, and native history |

## Choose a route

- **Understand the whole application:** overview → C4 views → system map → runtime flows.
- **Understand everything you can do:** overview → use-case catalogue → domain capabilities and worked contracts.
- **Change a game rule:** the first three → strategic or tactical engine → persistence.
- **Create or extend a campaign:** overview → content and campaigns → runtime flows.
- **Work on graphics:** overview → rendering → tactical engine's space and visibility model.
- **Investigate a deployment:** system map → build and tooling → persistence for origin-specific saves.

The diagrams are Mermaid blocks, rendered by GitHub and other Mermaid-capable
Markdown readers. Source links are relative to this directory. A diagram shows
logical ownership or a particular path, not necessarily every module import.

## Terms used throughout

| Term | Meaning here |
| --- | --- |
| Campaign definitions / package | Authored world, cast, equipment, maps, presentation, and supported rules |
| Campaign state | Mutable strategic progress represented as serializable data |
| Scenario | A trusted, compiled-in rule implementation selected by a supported identifier |
| `SectorEntryRequest` | Campaign-owned entry input; the compatibility field remains `pendingBattle` |
| `SectorSession` | One sector visit, including exploration, deployment and combat; compatibility snapshots still use `battle` |
| `CombatSession` | One bounded combat episode within a sector visit |
| Retained scene | Saved sector/mission state used to preserve changes across later visits |
| Committed state | The accepted campaign/battle pair owned by the root application |
| Presentation frame | Temporary animation snapshot derived during simulation; not an independent save checkpoint |
| Worker | A browser thread adapter running shared logic on message-transferred snapshots |

## Source and limits

The overview, source map, C4 views, editor boundary, and persistence contracts
reflect the working source on **28 October 2026**. Detailed compatibility-engine
traces identify the older modules that remain in use. The package version alone
does not identify which local architecture changes have been published.

The locally modified native `reference/native/engine/` submodule is outside this browser work.
Evidence is source tracing of the named entry points and their collaborators,
not a full campaign playthrough, a performance certification, or proof that every
historical feature is available. The architecture is not a strict dependency DAG:
the engine imports trusted campaign defaults/scenarios, and some rule modules
import one another. Disabled commands can remain present in source.

The [JA2 reference series](../web-port/README.md) describes upstream behavior and
adaptation history. [Browser campaign systems](../development/WEB-SYSTEMS.md)
contains successive historical checkpoints. Neither should replace current
source when it disagrees with this guide. For release status and dated gameplay
evidence, use the [documentation index](../README.md), not architecture diagrams.

When updating these documents, follow a changed operation across its UI, rule,
worker, content, and save boundaries. Update the relevant sequence diagram as
well as the subsystem description; preserve the difference between code
availability, accepted commands, and verified user behavior.
