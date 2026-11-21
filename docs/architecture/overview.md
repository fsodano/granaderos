# Understand the game from the player to the source

[Architecture guide](README.md) · [C4 views](c4.md) · [Source map](system-map.md)

This overview explains how Granaderos connects strategic campaign management and tactical sector visits across one continuing world, who owns each piece of state, and how player intentions travel from the browser interface through application use cases and domain objects to storage. It is the starting point for the [architecture guide](README.md) and connects directly to the [C4 views](c4.md), the [system map](system-map.md), the [use-case catalogue](use-cases/README.md), and the [runtime flows](runtime-flows.md).

## 1. One force, two scales

Granaderos lets you manage a force on a campaign map and control individual combatants inside a sector. The campaign map governs where squads travel, which localities they control, and how game time affects service contracts, wounds, treasury funds, and supplies. A sector visit shows physical terrain, buildings, residents, equipment, and local encounters.

A sector visit can be peaceful exploration or include one or more combat episodes. The same characters and items continue across both scales with one authoritative owner per fact:

- `Character` owns persistent identity, `Health` (current and maximum hit points, bleeding, and bandaged wounds), `CharacterAbilities` (ratings, traits, and capabilities), `ServiceContract`, and strategic `locationId`.
- `Squad` and `Journey` own strategic squad membership and physical route progress between sectors; during an active or suspended `SectorSession`, local coordinates on the sector grid belong to the sector visit and synchronize with strategic location on entry and exit.
- `Inventory` and `ItemCustody` own item quantities, pocket placement, and the single authoritative custodian (`character`, `container`, `ground`, or `corpse`) for every item.
- `SectorParticipant` references a `Character` by `characterId` and owns only visit-local action points (`ActionPoints`). Read models, retained sector caches, and `ResidentPositionReference` projections never create a second owner of character health, inventory, position, or item custody.

## 2. Follow one player intention

Start a campaign. The game loads a published `CampaignDefinition` and runs `CreateGameSessionUseCase` to initialize a new `GameSession` with a stable session ID and revision `0`. At headquarters, recruit a combatant through `RecruitCombatantUseCase`. `RecruitmentService` checks the candidate, charges `Treasury` once, starts a `ServiceContract`, admits the character into `ForceRoster`, and places the combatant either into an eligible local `Squad` with a free slot or into the controllable reserve at that safe recruitment site.

Order a journey. `Journey` records the squad's route and physical segment progress. When a squad reaches a hostile sector boundary, `ArrivalDecision` pauses campaign time and requires `FightOnArrival` or `WithdrawOnArrival`. Choosing withdrawal starts a journey with `JourneyPurpose.Withdrawal` without advancing time. The player can invoke `RedirectJourney` immediately at zero elapsed time or after travel has progressed; completed distance, elapsed time, and spent fatigue remain part of the journey.

Enter a sector. `EnterSectorUseCase` admits a `SectorEntryRequest` and constructs a `SectorSession` from the map definition, participating characters, and retained `Sector` state. `SectorDeployment` places participants on authorized entry cells when deployment is required. Exploration can transition into combat, opening a `CombatSession` where participants spend `ActionPoints` on orders through `ExecuteSectorOrderUseCase` and advance phases through `EndSectorTurnUseCase`.

Leave or resolve the visit. Finishing or leaving reconciles participant health, physical inventories, ammunition, and sector consequences into the campaign snapshot in one transaction. Inactive and retained sectors continue to evolve as `WorldTimeline.advanceTo` moves game time forward: residents follow `ResidentRoutine` and collect eligible unattended supplies, and each `Corpse` is removed 72 game hours after death while transferring remaining recoverable equipment to sector ground custody once and preserving the character's death record.

## 3. Name the four different kinds of data

The table below distinguishes each data `Concept`, `What it owns`, and a concrete `Example` so authoring drafts, published definitions, live gameplay progress, and transient visuals are never conflated.

| Concept | What it owns | Example |
| --- | --- | --- |
| `CampaignDefinition` | Validated immutable authored facts and allowlisted scenario settings in `packages/campaign-format` | A published sector map, character definition, dialogue tree, or weapon profile |
| `CampaignProject` | An editable authoring draft, resource bytes, and undo history in `apps/campaign-editor` | An unfinished sector map or portrait awaiting package validation |
| `GameSession` and game state | Accepted player progress, canonical identities, and active or suspended `SectorSession` state | Recruited combatants, journeys, service contracts, `Health`, `Inventory`, and `CombatSession` |
| Presentation | Temporary visible output and animation state projected from accepted simulation state | A walking clip, camera frustum, sound effect, or floating damage indicator |

The campaign editor mutates `CampaignProject` drafts. Exporting a validated project produces a `CampaignPackage` admitted by `CampaignDefinition`. The game compiles that definition into playable state (`compileCampaignPackage` in current source; `CampaignCompiler` in `packages/game/application` under the [accepted plan](../plans/accepted/domain-architecture.md)). Editor playtests run inside an isolated game session without mutating the authoring draft or the player's saved campaign. Presentation adapters project accepted simulation state and never decide combat outcomes or spend ammunition.

## 4. Read an operation through its layers

The flowchart below shows how a migrated player command moves from `Player input` through `Use-case class`, `Domain behavior and invariants`, `Use-case repository interface`, `Repository adapter`, and `Shared transaction and identity map` to produce an `Accepted game snapshot` for `UI and rendering` and the `Save queue and storage adapter`.

```mermaid
flowchart TB
  Input["Player input"] --> UseCase["Use-case class"]
  UseCase --> Domain["Domain behavior and invariants"]
  UseCase --> Repository["Use-case repository interface"]
  Repository --> Adapter["Repository adapter"]
  Adapter --> Work["Shared transaction and identity map"]
  Work --> Snapshot["Accepted game snapshot"]
  Snapshot --> UI["UI and rendering"]
  Snapshot --> Save["Save queue and storage adapter"]
```

Every use case owns one narrow repository interface with a matching stem (for example, `RecruitCombatantUseCase` depends on `RecruitCombatantRepository`). Repository adapters share `GameUnitOfWork`, `DomainIdentityMap`, and `GameSnapshotMapper` beneath those interfaces so all domain objects in one transaction reference the same canonical `Character`, `Squad`, `Sector`, and `Inventory` instances. When the use case finishes, `dispatchCampaign` validates the draft itself, then `GameUnitOfWork.commit()` stores the snapshot and advances `gameRevision` by one. A refusal aborts the transaction and leaves prior state untouched.

For restoration, `RestoreGameUseCase` reads saved text through `RestoreGameRepository`. `GameSnapshotMapper` decodes the portable save, validates clocks and cross-system relationships, and rebuilds domain objects through their static `restore` factories without repeating creation-only effects such as starting equipment issuance or contract charges.

Read-only use cases (`GetRecruitmentCandidatesUseCase`, `GetVisibleCharactersUseCase`, and `GetSaveStatusUseCase`) query the same logical model through read-only repository interfaces and return narrow view records (such as `{ characterIds }` or `SaveStatus`) rather than mutable domain objects, without advancing `WorldTimeline`.

## 5. Find the code that implements each role

The table below maps each architectural `Role` to its `Source` path in the repository.

| Role | Source |
| --- | --- |
| Domain entities, value objects, state machines, policies, and services | [`packages/game/domain`](../../packages/game/domain/) |
| Application use cases and narrow repository contracts | [`packages/game/application`](../../packages/game/application/) |
| Repository adapters, unit of work, identity map, and snapshot mappers | [`packages/game/infrastructure`](../../packages/game/infrastructure/) |
| Declared public composition entry points for game, editor, and persistence | [`packages/game/public`](../../packages/game/public/) |
| Compatibility simulation entry points and specialized procedural rules | [`packages/game/`](../../packages/game/) (`campaign.js`, `tactical.js`, `world.js`, `time.js`, `save.ts`) |
| Player UI, Three.js tactical renderer, and browser composition | [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx), [`apps/web/lib`](../../apps/web/lib/) |
| Independent campaign editor application, domain, and storage adapters | [`apps/campaign-editor`](../../apps/campaign-editor/README.md) |
| Shared published campaign-file schemas and `CampaignDefinition` | [`packages/campaign-format`](../../packages/campaign-format/README.md) |
| Installed campaign packages, art sources, and trusted scenario implementations | [`content/campaigns`](../../content/campaigns/), [`content/assets`](../../content/assets/README.md) |

The compatibility modules at the `packages/game/` root bridge the browser UI to both migrated domain slices and retained procedural rules. See [C4 levels 1–3](c4.md) and the [system map](system-map.md) for how these modules interact.

## 6. Know what saving guarantees

An accepted operation updates in-memory progress and advances `gameRevision`. The autosave queue (`useCampaignAutosave`) then serializes the campaign and active sector snapshot pair through `SaveGameUseCase` and `GameSnapshotMapper`. Details on save envelopes, terrain compaction, Web Lock ownership, and restoration validation live in [persistence](persistence.md).

The browser game (`apps/web`) and campaign editor (`apps/campaign-editor`) deploy as static browser files staged by `npm run build` (documented in [build and tooling](build-and-tooling.md)). All game rules execute locally in the browser main thread and Web Workers.

Continue with [C4 levels 1–3](c4.md) for visual boundary diagrams, or jump to the [system map](system-map.md) and [runtime flows](runtime-flows.md) to trace a concrete operation end to end.
