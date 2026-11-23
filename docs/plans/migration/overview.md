# Clean architecture migration overview

The [accepted domain architecture](../accepted/domain-architecture.md) defines
the target design. This overview describes current source behavior and the
remaining requirements. Use it with the [migration plan](plan.md) and
[slice index](slices/README.md) to resume the work.

[Migration plan](plan.md) · [Slice notes](slices/README.md) · [Accepted domain architecture](../accepted/domain-architecture.md) · [Ubiquitous language](../accepted/ubiquitous-language.md)

## 1. What the project is

Granaderos is a browser-only turn-based strategy and tactical combat game set in
the Argentine War of Independence, inspired by Jagged Alliance 2. The player
manages a force on a campaign map and commands individual combatants inside a
sector. The interface and the manual are in Spanish; source code and
development documentation are in English.

Everything runs client-side. There is no server, database, or authenticated
backend. The tactical sector is rendered with Three.js over an SVG interaction
layer. Progress is stored in browser `localStorage`, with JSON export and import
for moving a campaign between browsers.

## 2. How the repository is arranged

Two runnable applications, two reusable packages, one content tree, and the
tooling that builds and checks them.

| Path | Responsibility |
| --- | --- |
| `apps/web` | The player interface; `apps/web/lib` builds use cases/adapters outside React screens |
| `apps/campaign-editor` | The independent campaign editor and its own domain model |
| `packages/game` | Game rules, use cases, adapters, and declared public APIs |
| `packages/campaign-format` | Published campaign file schemas, validation, and content identity |
| `content/campaigns` | Installed campaign packages, media, and trusted scenario code |
| `content/assets` | Art sources, prompts, rigs, previews, and production recipes |
| `docs` | Architecture guide, accepted plans, requirements, specification, gameplay guides |
| `tests`, `tools` | Integration tests and fixtures, build and verification tooling, review playgrounds |
| `reference/native` | The separate Windows engine and conversion build, not part of the browser build |
| `.output` | Ignored local build, cache, and diagnostic output |

### The game package

`packages/game` uses three layers enforced by tooling:

- `packages/game/domain` holds entities, value objects, state machines,
  policies, and domain services. It imports only domain code.
- `packages/game/application` holds one use-case class per player or author
  intention. Each use case has a narrow repository interface, its contract for
  the data it reads and commits, plus request and response types and a README.
  The layer imports the domain and its own contracts.
- `packages/game/infrastructure` implements repository interfaces and holds
  the shared unit of work (transaction mechanism), identity map (which reuses
  one in-memory domain object per identity), and snapshot mappers.

`apps/web/lib` is the browser-composition layer: it builds application
use cases and repository adapters outside the React screens and owns browser
adapters such as workers and storage.

The package root also retains compatibility and simulation modules, including
`tactical.js`, `campaign.js`, `world.js`, and `time.js`. These modules still
carry most of the running simulation, much of it procedurally.

`packages/game/public` contains declared API modules, called public entries,
for supported game consumers. `apps/web` imports several, including
`packages/game/public/game-runtime-api.ts`,
`packages/game/public/campaign-types.ts`,
`packages/game/public/compatibility-types.ts`,
`packages/game/public/inventory-types.ts`,
`packages/game/public/battle-job-types.ts`,
`packages/game/public/game-snapshot-types.ts`, and
`packages/game/public/campaign-compiler-api.ts`. The campaign editor uses its
declared editor, playtest, and preview entries.

The architecture check enforces two different rules for `apps/web`. No file
under `apps/web` may import a retained module from the `packages/game` root.
Files under `apps/web/app` also may not import the game domain, application,
or infrastructure layers. `apps/web/lib` is the browser-composition layer and
may import those layers.

The reverse direction is also prohibited: no file under `packages/game` may
import from `apps/web`. `tools/architecture-rules.ts` defines this rule,
`tools/check-architecture.mjs` applies it, and `.dependency-cruiser.json`
enforces the same dependency boundary.

### The player application

`apps/web/app/page.tsx` is the whole application shell: a client component that
holds the campaign snapshot, the active sector snapshot, and the current screen
in plain React state, and dispatches player intents downward as a callback
prop. Screens are `title`, `intro`, `desk`, `campaign`, and `battle`. The
tactical screen is `apps/web/app/Battlefield.tsx`; the strategic screen is
`apps/web/app/Campaign.tsx` with `StrategicMap.tsx`. `apps/web/lib` holds the
adapters: the battle worker and its fallback, the autosave queue, the browser
save writer, the Three.js scene construction, and the campaign loader.

### The editor and the shared format

`apps/campaign-editor` owns editable campaign projects: `domain` for project
and map behavior, `application` for its use cases, `infrastructure` for
validation, `public` for its composition entry, and `web` for the React studio,
story editor, and sector editor. The studio's IndexedDB storage adapter is
`apps/campaign-editor/web/lib/campaign-studio-storage.ts`.

`packages/campaign-format` is dependency-free. It owns published campaign file
schemas, the path that admits validated files as `CampaignDefinition` values,
and a synchronous SHA-256 content identity. It imports neither the game nor
the editor.

## 3. How a request moves through the system

The accepted architecture defines this path for player intentions:

```text
Player intent
  -> application use case
  -> use-case repository interface
  -> infrastructure adapter
  -> domain behavior and invariants
  -> shared transaction and identity map
  -> accepted game snapshot
  -> UI response and save adapter
```

The domain owns game rules; application use cases coordinate an intention
through a narrow repository interface; infrastructure adapts that interface to
the saved game model. An identity map keeps one in-memory object for each
domain identity, and the shared transaction commits accepted changes together.
Retained dispatchers and worker adapters bridge parts of the simulation into
this path.

A revision is a counter tied to a saved game snapshot; a command with an older
expected revision is rejected rather than overwriting newer state.

**Campaign actions.** A control in `apps/web/app/Recruitment.tsx` calls the
`dispatch` callback from `page.tsx`, which calls `dispatchCampaign` in
`packages/game/campaign.js`. That function opens a revision-checked
`GameUnitOfWork` transaction, enforces campaign guards, and routes migrated
intentions to their application use cases. Recruitment reaches
`RecruitCombatantUseCase`; contract renewal reaches
`RenewServiceContractUseCase`; squad formation reaches `FormSquadUseCase`;
reactivating an existing `SectorSession` (the active visit to one sector)
reaches `ResumeSectorSessionUseCase`; and arrival resolution reaches
`FightOnArrivalUseCase` or `WithdrawOnArrivalUseCase` through
`packages/game/squad-travel.js`. An accepted command returns a new campaign
snapshot and advances its revision.

**Sector entry.** A campaign snapshot carrying `sectorEntryRequest` (the saved
sector-entry request field) is handed to
[`prepareCampaignBattle`](../../../packages/game/battle-handoff.js), which
returns the updated campaign and sector snapshot pair or a refusal. In
[`apps/web/app/page.tsx`](../../../apps/web/app/page.tsx),
`openCampaignBattle` checks that result, installs the pair, and then switches
the interface to the tactical screen.
[`EnterSectorUseCase`](../../../packages/game/application/sector-sessions/enter-sector/README.md)
is reached from [`packages/game/world.js`](../../../packages/game/world.js).

**Sector orders.** `Battlefield.tsx` builds a tactical order and hands it to
`useBattleExecutor`, which posts a job to a Web Worker and falls back to the
same code inline when no worker is available. `packages/game/battle-job.ts`
dispatches the job and reaches `actBattle` in `packages/game/tactical.js`.
Migrated operations go through
`packages/game/infrastructure/sector-sessions/sector-operation-coordinator.js`
into `ExecuteSectorOrderUseCase`, `ResumeSectorOperationUseCase` (continues an
unfinished order inside the active `SectorSession`), and `EndSectorTurnUseCase`.
A reply is discarded when its session identity, revision, request identity, or
`SectorOperationContext` (session, visit, both revisions, and request identity)
no longer matches the active snapshot.

**Time ownership.** [`GameSession`](../../../packages/game/domain/session/game-session.ts),
the per-game runtime consistency boundary, owns a
[`WorldTimeline`](../../../packages/game/domain/world/world-timeline.ts), the
authority for accepted game time. `WorldTimeline.advanceTo` processes scheduled
events in chronological order with a stable identifier tie-break and stops at
the accepted second of an event that requires a decision. Campaign advancement,
tactical synchronization, and the strategic `advanceStrategicTime` order in
[`campaign.js`](../../../packages/game/campaign.js) use the session timeline.
On restoration, the [session mapper](../../../packages/game/infrastructure/session/campaign-game-session-mapper.js)
starts it from `campaign.hour * 3600 + (campaign.secondOfHour ?? 0)`. After an
accepted operation, `hour` and optional `secondOfHour` project the timeline's
accepted second. During a `SectorSession`, `SectorTimeBudget` (the per-operation
time limit) bounds each order at the next campaign-time boundary.

**Persistence.** After an accepted commit, the autosave queue encodes the
campaign and sector snapshot pair through `SaveGameUseCase` and
`packages/game/save.ts`, then writes it through
`apps/web/lib/browser-save-writer.ts` under a Web Lock per campaign storage key.

## 4. Current migrated architecture

The current source uses a shared revision policy, browser composition outside
React screens, standard application use-case contracts, declared public
entries, and import boundaries enforced by the architecture checker and
dependency-cruiser. No `apps/web` file imports a retained module from the
`packages/game` root; React screens cannot import game domain, application, or
infrastructure modules, while `apps/web/lib` can compose those layers.

[`CampaignCompiler`](../../../packages/game/application/campaign-compiler/)
applies runtime rules and resolves published campaign definitions.
[`createCampaignCompiler()`](../../../packages/game/public/campaign-compiler-api.ts)
composes that service with `CampaignLibraryCompilerRepository` in
[`packages/game/campaign-library.js`](../../../packages/game/campaign-library.js).
[`apps/web/lib/campaign-library.ts`](../../../apps/web/lib/campaign-library.ts)
reads campaign files for the browser and invokes the public compiler entry;
[`tools/campaign-export.mjs`](../../../tools/campaign-export.mjs) uses the same
entry for static staging. The root `campaign-library.js` module is the
compiler's repository adapter, not the browser loader. Current source and
public entries do not define `compileCampaignPackage`.

`GameSnapshot` is the save-envelope and worker representation. The portable
envelope writes the campaign under `campaign` and the active sector view under
`sectorSession`. Campaign orders use the same `sectorSession` property when they
carry that view; the decoded `GameSnapshotContent` keeps its in-memory field
named `battle`. The retired `sectorState` property is not in the
[`CampaignAction`](../../../packages/game/public/campaign-types.ts) contract.
The campaign snapshot writes its entry request under `sectorEntryRequest`,
force membership under `forceRoster`, per-character records under `characters`,
and retained physical maps under `sectorSnapshots` and `sceneSnapshots`. The
saved field
[`CampaignSnapshot.sectorEntryRequest`](../../../packages/game/public/campaign-types.ts)
uses the public `CampaignSectorEntryRequest` type; the application layer keeps
the narrower `SectorEntryRequest` name.

Each `suspendedSectorSessions` entry conforms to the public
[`CampaignSuspendedSectorSession`](../../../packages/game/public/campaign-types.ts)
type and carries the saved entry `request`, sector `snapshot`, `activeSquadId`,
`location`, and `suspendedAtSeconds`. The
[`CampaignSectorSessionCoordinator`](../../../packages/game/infrastructure/session/campaign-sector-session-coordinator.js)
writes those five fields. [`GameSnapshotMapper`](../../../packages/game/infrastructure/persistence/game-snapshot-mapper.js)
restores the domain `SectorSession` from the request and snapshot rather than
serializing that domain object.
[`save-terrain.js`](../../../packages/game/save-terrain.js) compacts and expands
eligible tile arrays in every suspended `snapshot` along with active and
retained maps.

Thirty-three migrated game-rule groups have domain ownership in
`packages/game/domain`, as listed in the [slice index](slices/README.md).
[`targeted-combat.ts`](../../../packages/game/domain/combat/targeted-combat.ts)
owns aimed-shot eligibility, region choices and profiles, aiming penalties, and
effects. [`tactical-grid.ts`](../../../packages/game/domain/sector-sessions/tactical-grid.ts)
owns tactical cell labels. The retained root modules
[`actor-condition.js`](../../../packages/game/actor-condition.js),
[`medical-patient.js`](../../../packages/game/medical-patient.js),
[`battle-outcome.js`](../../../packages/game/battle-outcome.js),
[`targeted-combat.js`](../../../packages/game/targeted-combat.js), and
[`tactical-grid.js`](../../../packages/game/tactical-grid.js) re-export their
domain implementations. The browser interface owns the sleep-need sentence and
campaign notices. The Spanish shot-range sentence remains in
[`packages/game/shot-range.js`](../../../packages/game/shot-range.js) beside its
caller in [`packages/game/ja2-hud.ts`](../../../packages/game/ja2-hud.ts);
moving it to the player application would invert the dependency direction.
[`weapon-reload.ts`](../../../packages/game/domain/combat/weapon-reload.ts)
owns reload-round cost, stored-progress validation, and planning; the retained
[`weapon-reload.js`](../../../packages/game/weapon-reload.js) re-exports those
rules. [`care-rules.ts`](../../../packages/game/domain/personnel/care-rules.ts)
owns default care and rest tuning and the default strategic bleeding percentage.
[`campaign-care-rules.js`](../../../packages/game/campaign-care-rules.js)
selects campaign-authored care rules and uses those domain defaults, while
[`campaign-rules-schema.js`](../../../packages/campaign-format/campaign-rules-schema.js)
defines and validates the authored fields.
[`captive-service.ts`](../../../packages/game/domain/personnel/captive-service.ts)
owns the service hours remaining during custody and the contract rebuilt at
release. The retained [`prisoner-custody.js`](../../../packages/game/prisoner-custody.js)
re-exports those rules and keeps `prisonerStatus`, which reads campaign character
and detention records. [`militia-patrol.ts`](../../../packages/game/domain/personnel/militia-patrol.ts)
owns default patrol tuning and the rule that checks saved-scene settings against
the campaign package or domain defaults, plus patrol eligibility, turn waypoint
selection (the map target for that turn), and reachable-cell choice. The retained
[`militia-patrol-rules.js`](../../../packages/game/militia-patrol-rules.js)
keeps `militiaPatrolRules`, which selects the campaign package setting, then the
scene's stored patrol setting, then the domain default. It also re-exports the
domain default and consistency check. The shared
[`campaign-rules-schema.js`](../../../packages/campaign-format/campaign-rules-schema.js)
keeps the authored field contract and structural validation.
[`militia-patrol.js`](../../../packages/game/militia-patrol.js) asks tactical map
code for enemy visibility and reachable cells, then assembles the move order
from the domain decision.
[`projectile-air-drag.ts`](../../../packages/game/domain/combat/projectile-air-drag.ts)
owns the check for whether a weapon has a usable air-drag profile and the
distance-based energy-retention rule. The profile's value is the fraction
retained at the weapon's range. The retained
[`projectile-air-drag.js`](../../../packages/game/projectile-air-drag.js)
uses the shared
[`projectile-profile-schema.js`](../../../packages/campaign-format/projectile-profile-schema.js)
to validate profile records, validates the associated energy profile, and
re-exports the domain rules.
[`projectile-cover.js`](../../../packages/game/projectile-cover.js)
selects open-air versus material intervals and applies retention only outside
material.
`GameSession` owns `RandomSource` and `WorldTimeline`.
Campaign code calls `drawCampaignRandom(session, draft)`, where
`session` is the `GameSession` and `draft` is the campaign snapshot. The helper
draws through `session.randomSource` and writes the advanced seed to
`draft.seed`. Campaign, strategic, and tactical clock paths use
`session.timeline`, and the campaign's `hour` and optional `secondOfHour`
project its accepted second.

The retired `hiringArrivals` field is accepted only as a legacy save input.
Restoration validates each entry. A valid booking starts service immediately at
a legal recruitment site at the saved campaign time; if no site is legal,
restoration preserves a `RefundableRecruitmentClaim`. After conversion, the old
field is removed. `decodeSave` reads legacy top-level `battle` only when
`sectorSession` is `undefined`. It maps campaign keys `pendingBattle`,
`recruited`, `operativeState`, `sectorStates`, and `sceneStates` to their
current fields only when each corresponding current key is `undefined`, then
removes the legacy key. If both names are present, the current value wins,
including `null` or an empty collection; the game writes the current field
names.

[`packages/game/domain/sector-sessions/tactical-space.ts`](../../../packages/game/domain/sector-sessions/tactical-space.ts)
owns the game's tactical-level rules. `packages/campaign-format` keeps an
independent implementation for authored-map validation because that package
cannot import the game.
[`tactical-planning-space.ts`](../../../packages/game/domain/sector-sessions/tactical-planning-space.ts)
owns point normalization, movement-order construction, and same-surface hand
reach. The retained
[`tactical-planning-space.ts`](../../../packages/game/tactical-planning-space.ts)
re-exports those domain rules.

`directionTo` and `approximateHeardPosition` live in
[`packages/game/domain/perception/npc-perception.ts`](../../../packages/game/domain/perception/npc-perception.ts).
The retained modules
[`packages/game/tactical-awareness.js`](../../../packages/game/tactical-awareness.js)
and [`packages/game/npc-perception.js`](../../../packages/game/npc-perception.js)
re-export them so callers keep their import paths and behavior.

## 5. What remains

- Any retained simulation decision without a named domain owner or application
  use case still needs one. Compatibility entry points may preserve imports,
  query map or content data, and assemble orders, but must delegate domain
  decisions rather than duplicate them. `prisonerStatus` remains a
  campaign-record query, not an outstanding rule move.
- Campaign-authored care lookup remains in
  [`campaign-care-rules.js`](../../../packages/game/campaign-care-rules.js),
  which selects authored values and falls back to domain defaults. The retained
  [`militia-patrol-rules.js`](../../../packages/game/militia-patrol-rules.js)
  keeps the campaign-content lookup for patrol settings. The shared
  [`campaign-rules-schema.js`](../../../packages/campaign-format/campaign-rules-schema.js)
  owns authored-field contracts and structural validation; the domain's
  `validateCampaignPatrol` checks saved-scene consistency against the campaign
  package setting or domain defaults.
- The `able` filter in
  [`militia-patrol.js`](../../../packages/game/militia-patrol.js) selects
  observers and opponents for the sight query, but duplicates the domain's
  private `canAct` condition and uses a literal 15-hit-point threshold instead
  of [`CRITICAL_HEALTH`](../../../packages/game/domain/personnel/actor-condition.ts).
  This sight-query filter is separate from the domain-owned patrol movement
  decision.
- [`projectile-cover.js`](../../../packages/game/projectile-cover.js) selects
  open-air versus material intervals and applies the domain retention factor
  only outside material. No domain module owns this interval-selection
  decision. Map queries and move-order assembly remain adapter responsibilities;
  they do not need separate domain owners.

## 6. Current source and accepted target

The accepted architecture and glossary define the target. Current source gives
`GameSession` ownership of `WorldTimeline`, advances campaign and strategic
time through that timeline, and projects its accepted second into the campaign
clock fields. The active sector view is named `sectorSession` in both the save
envelope and campaign orders; `GameSnapshotContent` keeps `battle` in memory.
The public
[`CampaignSuspendedSectorSession`](../../../packages/game/public/campaign-types.ts)
contract describes every saved field for a suspended visit. Restoration
reconstructs the domain `SectorSession` object for that visit from its saved
request and sector snapshot, rather than loading the domain object from the save.

## 7. Verification

For any further migration work, use the checks in the
[plan's verification strategy](plan.md#verification-strategy). Tests should
cover the behavior moved by a slice or the boundary it enforces.

## 8. Current architecture boundaries

The table separates current source behavior from the requirements in the
accepted architecture.

| Area | Current source behavior | Remaining requirement |
| --- | --- | --- |
| Revision policy | `packages/game/infrastructure/shared/revision-policy.ts` validates and advances revisions for `GameUnitOfWork` (the shared game transaction) and journey/sector adapters. `gameRevision`, `journeyRevision`, and `sectorRevision` remain separate saved fields. | Preserve each revision's own snapshot boundary. |
| Use-case contracts | Each application use case has request and response types, a repository interface, a use-case class, and a README. | Keep the contract shape enforced. |
| Public game surface | `tools/architecture-rules.ts` blocks every `apps/web` file from importing retained modules directly from the `packages/game` root. It also blocks `apps/web/app` from importing domain, application, or infrastructure modules; `apps/web/lib` may import those layers for browser composition. | Keep both import rules enforced and use declared entries for package APIs. |
| Game-to-player dependency | `tools/architecture-rules.ts`, `tools/check-architecture.mjs`, and `.dependency-cruiser.json` prohibit imports from `packages/game` into `apps/web`. | Keep the game package independent of player-interface modules. |
| Public entries used by `apps/web` | Among the imports from [`packages/game/public`](../../../packages/game/public/) are `game-runtime-api.ts`, `campaign-types.ts`, `compatibility-types.ts`, `inventory-types.ts`, `battle-job-types.ts`, `game-snapshot-types.ts`, `campaign-compiler-api.ts`, `battle-preview-types.ts`, `hud-types.ts`, and `terrain-types.ts`; other modules expose save, persistence, refusal, journey, personnel, equipment, worker, and preview contracts. | Treat the declared entries as a set of APIs, not as one runtime entry. |
| Campaign compilation | [`CampaignCompiler`](../../../packages/game/application/campaign-compiler/) is composed through [`createCampaignCompiler()`](../../../packages/game/public/campaign-compiler-api.ts). The browser loader is [`apps/web/lib/campaign-library.ts`](../../../apps/web/lib/campaign-library.ts); the static exporter uses the same public compiler entry. [`packages/game/campaign-library.js`](../../../packages/game/campaign-library.js) contains `CampaignLibraryCompilerRepository`, not the browser loader, and exports no `compileCampaignPackage` function. | Keep campaign compilation behind the declared public entry and keep browser file loading in `apps/web/lib`. |
| Saved field and order names | The [`GameSnapshot`](../../../packages/game/public/game-snapshot-types.ts) envelope writes `campaign` and `sectorSession`; campaign orders use `sectorSession` for the same view, while `GameSnapshotContent.battle` remains in memory. [`CampaignSnapshot`](../../../packages/game/public/campaign-types.ts) writes `sectorEntryRequest`, `forceRoster`, `characters`, `sectorSnapshots`, and `sceneSnapshots`. [`decodeSave`](../../../packages/game/save.ts) reads legacy top-level `battle` only when `sectorSession` is `undefined`; it maps campaign keys `pendingBattle`, `recruited`, `operativeState`, `sectorStates`, and `sceneStates` only when each current key is `undefined`, then removes the old key. `sectorState` is not in [`CampaignAction`](../../../packages/game/public/campaign-types.ts). | Keep current names authoritative and preserve the legacy conversion contract. |
| Suspended snapshot compaction | [`compactSaveTerrain`](../../../packages/game/save-terrain.js) and [`expandSaveTerrain`](../../../packages/game/save-terrain.js) include eligible tile arrays in every `suspendedSectorSessions[*].snapshot`, along with active and retained maps. Suspended snapshots use the same palette-compaction trigger, 20 MB expanded-size guard, and 5 MB final-file cap. | Preserve the suspended snapshot's tile data through save and restore. |
| Hostile-arrival orders | [`dispatchCampaign`](../../../packages/game/campaign.js) resolves a fight through `fightOnArrival` and a withdrawal through `withdrawOnArrival`; each order applies to one squad's `ArrivalDecision`. The dispatcher has no `beginAssault` order. | Keep each arrival resolution tied to the arriving squad's own decision and pause time until every pending decision resolves. |
| Sector-entry types | [`CampaignSnapshot.sectorEntryRequest`](../../../packages/game/public/campaign-types.ts) uses `CampaignSectorEntryRequest`, the saved campaign projection; the application use case retains its narrower `SectorEntryRequest` input. | Keep the public campaign projection distinct from the application request. |
| Domain rule ownership | Thirty-three migrated groups have domain owners (see the [slice index](slices/README.md)). [`militia-patrol.ts`](../../../packages/game/domain/personnel/militia-patrol.ts) owns patrol defaults, saved-scene consistency, eligibility, target waypoints, and reachable-cell choice; [`militia-patrol.js`](../../../packages/game/militia-patrol.js) supplies map data and assembles orders. [`projectile-air-drag.ts`](../../../packages/game/domain/combat/projectile-air-drag.ts) owns profile eligibility and distance retention; [`projectile-air-drag.js`](../../../packages/game/projectile-air-drag.js) validates records. [`projectile-cover.js`](../../../packages/game/projectile-cover.js) selects material and open-air intervals. | Reconcile the patrol sight filter's duplicate `able`/`canAct` checks and assign a domain owner to projectile interval selection. Map queries, order assembly, authored-content lookup, and schema validation may remain at their boundaries; `prisonerStatus` is a query. |
| Care and refill inputs | [`care-rules.ts`](../../../packages/game/domain/personnel/care-rules.ts) owns default care/rest tuning, including `restHealingHours`; [`campaign-care-rules.js`](../../../packages/game/campaign-care-rules.js) selects authored values or those defaults. [`workshopServiceQuote`](../../../packages/game/workshop-service.js) supplies `careRules(s).dressingPrice` to [`refillCost`](../../../packages/game/equipment.js), which has no default price. | Keep authored care lookup at the content boundary and pass the effective campaign dressing price to each refill quote. |
| Time and randomness | `GameSession` owns `RandomSource` and `WorldTimeline`. `drawCampaignRandom(session, draft)` draws through `session.randomSource` and writes its advanced seed to `draft.seed`. Campaign, strategic, and tactical clock paths advance `session.timeline`; campaign `hour` and optional `secondOfHour` project its accepted second. | Preserve session ownership and keep campaign clock fields as projections of accepted time. |
| Suspended-session record shape | The public [`CampaignSuspendedSectorSession`](../../../packages/game/public/campaign-types.ts) type declares `request` as a saved [`CampaignSectorEntryRequest`](../../../packages/game/public/campaign-types.ts), `snapshot` as a [`BattleSnapshot`](../../../packages/game/public/compatibility-types.ts), `activeSquadId` as `CampaignSquadId`, `location` as `CampaignSectorId`, and `suspendedAtSeconds` as `CampaignGameSecond`. The coordinator writes those fields; validation checks them against the squad, location, request identity, and campaign clock, while `GameSnapshotMapper` restores the domain `SectorSession` (the domain object for one sector visit) from the request and snapshot. | Preserve the declared five-field contract and visit identity/progress; keep the saved request and sector snapshot separate from the domain `SectorSession` object. |
| Compatibility table | The [glossary](../accepted/ubiquitous-language.md#compatibility-names) lists decoder-supported legacy save names. `suspendedSectorSessions` is the current domain-aligned name, not a compatibility alias; campaign orders use `sectorSession`, and `sectorState` is not part of the public order contract. `recruitCivic` and `civicStatus` are not accepted; `candidateAdmission` is canonical. Validated legacy `hiringArrivals` entries start service immediately at a legal site or become a `RefundableRecruitmentClaim` if none is legal; the old field is removed. | Keep legacy reads at the save boundary and do not add current domain names to the compatibility table. |
| Resident position | `ResidentPositionReference` names the saved reference to a character identity and local position. | Keep the saved projection separate from character health and inventory ownership. |
| Player-facing messages | The domain owns the sleep-need rule; the browser interface owns its sentence and campaign notices. | Keep player-facing copy outside domain and application code. |
