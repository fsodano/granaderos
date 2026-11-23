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
sector-entry request field) is handed to `prepareCampaignBattle` in
`packages/game/battle-handoff.js`, which produces the campaign and sector
snapshot pair and switches the interface to the tactical screen.
`EnterSectorUseCase` is reached from `packages/game/world.js`.

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

## 4. What the migration changed

The slices established a shared revision policy, moved browser composition out
of React components, standardized application use-case contracts, added a
runtime public entry, and blocked game-package imports from the player app with
the architecture checker and dependency-cruiser. They also added
`CampaignCompiler` (the application service that turns a validated campaign
definition into runtime-playable objects) and named `GameSnapshot` (the
versioned save and worker representation). The player-app import rules remain
intentionally different for React screens and browser composition, as section
8 describes.

Twenty-one game rules have domain ownership in `packages/game/domain`: firearm
readiness, unarmed combat, sleep need, held supplies, projectile energy,
firearm loads, study rate, the route queue, firearm serviceability, kinetic
impact, combat balance, combat journal, fatigue and energy, interior
visibility, campaign clock conversion, `WorldTimeline` clock advancement,
tactical-level rules (the vertical map layer assigned to a point), shot-range
calculation, `directionTo` (NPC facing), `approximateHeardPosition` (anonymous
sound location), and care-composure relief
(`CARE_COMPOSURE_RELIEF` & `careComposureRelief`). The sleep-need sentence
and campaign notices moved to the browser interface. The Spanish shot-range
sentence remains in `packages/game/shot-range.js` beside its caller in
`packages/game/ja2-hud.ts`; moving it to the player application would invert
the dependency direction. `GameSession` owns `RandomSource` and `WorldTimeline`.
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
field is removed. New saves write the sector view under
`sectorSession`, and decoding accepts legacy `battle` only when that key is
absent.

Slice 26 moved the game's tactical-level rules into
`packages/game/domain/sector-sessions/tactical-space.ts`. Slice 27 removed the
duplicate tactical-level rules from interior visibility. The independent
`packages/campaign-format` copy remains because that package validates authored
maps and cannot import the game.

Slice 32 consolidated the richer NPC perception rules used by the game in
`packages/game/domain/perception/npc-perception.ts`: `directionTo` and
`approximateHeardPosition`. Both retained modules,
`packages/game/tactical-awareness.js` and `packages/game/npc-perception.js`,
re-export these functions so callers keep their import paths and behavior.

## 5. What remains

- The retained simulation modules, including `tactical.js` and `campaign.js`,
  still carry most game rules procedurally. Moving twenty-one rules did not move
  the simulation as a whole.
- The saved campaign fields `sectorStates` and `sceneStates`
  still need explicit conversion to canonical domain representations before
  their compatibility names can be retired.

## 6. Current source and accepted target

The accepted architecture and glossary define the target. This overview
describes current source behavior: `GameSession` owns `WorldTimeline`, campaign
and strategic time paths advance through it, and the campaign clock fields
project its accepted second. The saved campaign fields still awaiting conversion
are `sectorStates` and `sceneStates`.

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
| Public entries used by `apps/web` | The app imports `game-runtime-api.ts`, `campaign-types.ts`, `compatibility-types.ts`, `inventory-types.ts`, `battle-job-types.ts`, `game-snapshot-types.ts`, and `campaign-compiler-api.ts` from `packages/game/public`. | Treat the declared entries as a set of APIs, not as one runtime entry. |
| Campaign compilation and saves | `CampaignCompiler` compiles a validated `CampaignDefinition`; the retained `compileCampaignPackage` adapter in `packages/game/campaign-library.js` delegates to it. `GameSnapshot` names the versioned save and worker representation. New saves write the active sector view under `sectorSession`, the sector entry request under `sectorEntryRequest`, the serving members under `forceRoster`, and the character records under `characters`; decoding reads legacy `battle` only when `sectorSession` is absent, legacy `pendingBattle` only when `sectorEntryRequest` is absent, legacy `recruited` only when `forceRoster` is absent, and legacy `operativeState` only when `characters` is absent. `GameSnapshotContent.battle` remains an in-memory field. | Keep supported save decoding behind the conversion policy. |
| Domain rule ownership | Twenty-one game rules have domain ownership, including `WorldTimeline` clock advancement, `CARE_COMPOSURE_RELIEF` & `careComposureRelief` in `packages/game/domain/personnel/care-composure.ts`, and `directionTo` & `approximateHeardPosition` in `packages/game/domain/perception/npc-perception.ts`. Both retained modules re-export the perception rules. Retained modules still carry most simulation rules procedurally. The game uses `packages/game/domain/sector-sessions/tactical-space.ts`; `packages/campaign-format` keeps an independent map-validation copy. | Move remaining procedural rules behind the domain or a declared public entry. |
| Time and randomness | `GameSession` owns `RandomSource` and `WorldTimeline`. `drawCampaignRandom(session, draft)` draws through `session.randomSource` and writes its advanced seed to `draft.seed`. Campaign, strategic, and tactical clock paths advance `session.timeline`; campaign `hour` and optional `secondOfHour` project its accepted second. | Preserve session ownership and keep campaign clock fields as projections of accepted time. |
| Compatibility table | The glossary maps retained API and save names to canonical terms. `recruitCivic` and `civicStatus` are not accepted; `candidateAdmission` is canonical. `beginAssault` remains a compatibility command. Validated legacy `hiringArrivals` entries start service immediately at a legal site or become a `RefundableRecruitmentClaim` if none is legal; the old field is removed. The saved campaign fields still to convert are `sectorStates` and `sceneStates`. | Convert the remaining saved campaign fields to canonical domain representations before retiring their compatibility names. |
| Resident position | `ResidentPositionReference` names the saved reference to a character identity and local position. | Keep the saved projection separate from character health and inventory ownership. |
| Player-facing messages | The domain owns the sleep-need rule; the browser interface owns its sentence and campaign notices. | Keep player-facing copy outside domain and application code. |
