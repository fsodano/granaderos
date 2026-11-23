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

`GameSnapshot` is the versioned save-envelope and worker representation. The
portable envelope writes the campaign under `campaign` and the active sector
view under `sectorSession`. The campaign snapshot writes its sector-entry
request under `sectorEntryRequest`, force membership under `forceRoster`,
per-character records under `characters`, and retained physical maps under
`sectorSnapshots` and `sceneSnapshots`. The saved field
[`CampaignSnapshot.sectorEntryRequest`](../../../packages/game/public/campaign-types.ts)
uses the public `CampaignSectorEntryRequest` type; the application layer keeps
the narrower `SectorEntryRequest` name.

Twenty-one migrated game rules have domain ownership in
`packages/game/domain`: firearm readiness, unarmed combat, sleep need, held
supplies, projectile energy,
firearm loads, study rate, the route queue, firearm serviceability, kinetic
impact, combat balance, combat journal, fatigue and energy, interior
visibility, campaign clock conversion, `WorldTimeline` clock advancement,
tactical-level rules (the vertical map layer assigned to a point), shot-range
calculation, `directionTo` (NPC facing), `approximateHeardPosition` (anonymous
sound location), and care-composure relief
(`CARE_COMPOSURE_RELIEF` & `careComposureRelief`). The browser interface owns
the sleep-need sentence and campaign notices. The Spanish shot-range sentence
remains in [`packages/game/shot-range.js`](../../../packages/game/shot-range.js)
beside its caller in [`packages/game/ja2-hud.ts`](../../../packages/game/ja2-hud.ts);
moving it to the player application would invert the dependency direction.
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
field is removed. New saves write the active sector view under `sectorSession`;
decoding reads legacy top-level `battle` only when `sectorSession` is absent.
Legacy campaign fields `pendingBattle`, `recruited`, `operativeState`,
`sectorStates`, and `sceneStates` map to the current campaign fields only when
their corresponding current key is absent. The current key wins if both are
present, and decoding removes the legacy key.

[`packages/game/domain/sector-sessions/tactical-space.ts`](../../../packages/game/domain/sector-sessions/tactical-space.ts)
owns the game's tactical-level rules. `packages/campaign-format` keeps an
independent implementation for authored-map validation because that package
cannot import the game.

`directionTo` and `approximateHeardPosition` live in
[`packages/game/domain/perception/npc-perception.ts`](../../../packages/game/domain/perception/npc-perception.ts).
The retained modules
[`packages/game/tactical-awareness.js`](../../../packages/game/tactical-awareness.js)
and [`packages/game/npc-perception.js`](../../../packages/game/npc-perception.js)
re-export them so callers keep their import paths and behavior.

## 5. What remains

- Retained simulation modules still carry procedural game rules. Moving
  twenty-one rules into domain ownership does not move the simulation as a
  whole; the remaining rules need named domain or application owners.
- `suspendedSectorSessions` remains a saved list of suspended-visit request and
  snapshot records. Its replacement field and canonical saved shape are not
  defined; choose them before converting supported saves, preserving each
  visit's request, identity, and progress.
- `sectorState` remains a campaign-action request property carrying a sector
  snapshot. Its replacement property name is not defined; choose a
  glossary-backed name and update the public action contract and all callers
  together. It is not a saved field.

## 6. Current source and accepted target

The accepted architecture and glossary define the target. Current source gives
`GameSession` ownership of `WorldTimeline`, advances campaign and strategic
time through that timeline, and projects its accepted second into the campaign
clock fields. The remaining names are explicit boundaries:
`suspendedSectorSessions` is the current saved representation and `sectorState`
is a request property. The replacement names and mapping for the saved list and
request property still need decisions.

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
| Saved field names | The [`GameSnapshot`](../../../packages/game/public/game-snapshot-types.ts) envelope writes `campaign` and `sectorSession`. [`CampaignSnapshot`](../../../packages/game/public/campaign-types.ts) writes `sectorEntryRequest`, `forceRoster`, `characters`, `sectorSnapshots`, and `sceneSnapshots`. [`decodeSave`](../../../packages/game/save.ts) reads legacy top-level `battle` only when `sectorSession` is absent; it maps campaign keys `pendingBattle`, `recruited`, `operativeState`, `sectorStates`, and `sceneStates` to their corresponding current fields only when the current key is absent, then removes the old key. `GameSnapshotContent.battle` is an in-memory field. | Keep the current key authoritative when both names occur and preserve the legacy conversion contract. |
| Sector-entry types | [`CampaignSnapshot.sectorEntryRequest`](../../../packages/game/public/campaign-types.ts) uses `CampaignSectorEntryRequest`, the saved campaign projection; the application use case retains its narrower `SectorEntryRequest` input. | Keep the public campaign projection distinct from the application request. |
| Domain rule ownership | Twenty-one game rules have domain ownership, including `WorldTimeline` clock advancement, `CARE_COMPOSURE_RELIEF` & `careComposureRelief` in [`care-composure.ts`](../../../packages/game/domain/personnel/care-composure.ts), and `directionTo` & `approximateHeardPosition` in [`npc-perception.ts`](../../../packages/game/domain/perception/npc-perception.ts). Both retained modules re-export the perception rules. Retained modules still carry most simulation rules procedurally. The game uses [`tactical-space.ts`](../../../packages/game/domain/sector-sessions/tactical-space.ts); `packages/campaign-format` keeps an independent map-validation copy. | Move remaining procedural rules behind the domain or a declared public entry. |
| Time and randomness | `GameSession` owns `RandomSource` and `WorldTimeline`. `drawCampaignRandom(session, draft)` draws through `session.randomSource` and writes its advanced seed to `draft.seed`. Campaign, strategic, and tactical clock paths advance `session.timeline`; campaign `hour` and optional `secondOfHour` project its accepted second. | Preserve session ownership and keep campaign clock fields as projections of accepted time. |
| Compatibility table | The glossary maps retained API and save names to canonical terms. `recruitCivic` and `civicStatus` are not accepted; `candidateAdmission` is canonical. Validated legacy `hiringArrivals` entries start service immediately at a legal site or become a `RefundableRecruitmentClaim` if none is legal; the old field is removed. The remaining compatibility items are `suspendedSectorSessions` and the `sectorState` request property. | Define the suspended-visit saved shape and conversion, and replace `sectorState` with a glossary-backed request property. |
| Resident position | `ResidentPositionReference` names the saved reference to a character identity and local position. | Keep the saved projection separate from character health and inventory ownership. |
| Player-facing messages | The domain owns the sleep-need rule; the browser interface owns its sentence and campaign notices. | Keep player-facing copy outside domain and application code. |
