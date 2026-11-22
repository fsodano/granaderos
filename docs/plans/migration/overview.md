# Clean architecture migration: codebase orientation and gap analysis

This document records the orientation survey that opened the clean architecture
migration and the gaps it found. It is the starting point for
[the migration plan](plan.md) and its [slice notes](slices/README.md).

[Migration plan](plan.md) · [Slice notes](slices/README.md) · [Accepted domain architecture](../accepted/domain-architecture.md) · [Ubiquitous language](../accepted/ubiquitous-language.md)

## 1. What the project is

Granaderos is a browser-only turn-based strategy and tactical combat game set in
the Argentine War of Independence, inspired by Jagged Alliance 2. The player
manages a force on a campaign map and commands individual combatants inside a
sector. The interface and the manual are in Spanish; source code and
development documentation are in English.

Everything runs client-side. There is no server, no database, and no
authenticated backend. The game is a static site built with vinext (a
Vite-based Next.js-compatible runtime) and React 19; the tactical sector is
rendered with Three.js over an SVG interaction layer. Progress is stored in
browser `localStorage`, with explicit JSON export and import for moving a
campaign between browsers.

The release under migration is version 0.2.5.

## 2. How the repository is arranged

Two runnable applications, two reusable packages, one content tree, and the
tooling that builds and checks them.

| Path | Responsibility |
| --- | --- |
| `apps/web` | The player application and browser composition |
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

`packages/game` is in a half-migrated state. Three layers exist and are
enforced by tooling:

- `packages/game/domain` (66 TypeScript files) holds entities, value objects,
  state machines, policies, and domain services. It imports nothing outside
  itself.
- `packages/game/application` (24 use-case folders) holds one use-case class
  per player or author intention, each with its own narrow repository
  interface, request and response types, and a README. It imports the domain
  and its own contracts, nothing else.
- `packages/game/infrastructure` (51 files) holds repository adapters, the
  shared unit of work, the domain identity map, and the snapshot mappers.

Alongside those layers the package root still holds 331 legacy flat modules:
`tactical.js` (over ten thousand lines), `campaign.js` (over five thousand),
`world.js`, `time.js`, `save.ts`, `battle-job.ts`, `recruitment.ts`, and many
smaller rule modules. These carry most of the running simulation.

`packages/game/public` declares three composition entry points:
`campaign-editor-api`, `campaign-playtest-api`, and `game-persistence-api`.
The editor reaches the game only through the first two, enforced by
`tools/check-architecture.mjs` and `apps/campaign-editor/tools/check-boundaries.mjs`.

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
IndexedDB storage and validation, `public` for its composition entry, and
`web` for the React studio, story editor, and sector editor.

`packages/campaign-format` is dependency-free. It owns the published file
contracts: roughly 35 schema modules, the `CampaignDefinition` admission path,
and a synchronous SHA-256 content identity. It imports neither the game nor
the editor.

## 3. How a request moves through the system

The accepted architecture defines one path for every player intention:

```text
Player input -> use case class -> domain behavior and invariants
             -> use-case repository interface -> repository adapter
             -> shared transaction and identity map -> accepted game snapshot
             -> UI and rendering, and the save queue and storage adapter
```

The current source implements that path in three different ways depending on
the intention.

**Campaign actions.** A control in `apps/web/app/Recruitment.tsx` calls the
`dispatch` callback from `page.tsx`, which calls `dispatchCampaign` in
`packages/game/campaign.js`. That function opens a `GameUnitOfWork` at the
current revision, enforces the campaign guards, and routes migrated intentions
to their application use cases. Recruitment reaches `RecruitCombatantUseCase`,
contract renewal reaches `RenewServiceContractUseCase`, squad formation
reaches `FormSquadUseCase`, sector resumption reaches
`ResumeSectorSessionUseCase`, and arrival resolution reaches
`FightOnArrivalUseCase` or `WithdrawOnArrivalUseCase` through
`packages/game/squad-travel.js`. The accepted result is a new immutable
campaign snapshot with either a `lastError` or a `pendingBattle`, and the
revision advances by one.

**Sector entry.** A campaign snapshot carrying `pendingBattle` is handed to
`prepareCampaignBattle` in `packages/game/battle-handoff.js`, which produces the
campaign and sector snapshot pair and switches the interface to the tactical
screen. `EnterSectorUseCase` is reached from `packages/game/world.js`.

**Sector orders.** `Battlefield.tsx` builds a tactical order and hands it to
`useBattleExecutor`, which posts a job to a Web Worker and falls back to the
same code inline when no worker is available. `packages/game/battle-job.ts`
dispatches the job and reaches `actBattle` in `packages/game/tactical.js`.
Migrated operations go through
`packages/game/infrastructure/sector-sessions/sector-operation-coordinator.js`
into `ExecuteSectorOrderUseCase`, `ResumeSectorOperationUseCase`, and
`EndSectorTurnUseCase`. A reply is discarded when its session identity,
revision, request identity, or `SectorOperationContext` no longer matches the
active snapshot.

**Time.** `WorldTimeline.advanceTo` is the only operation that moves game time.
It applies scheduled events in chronological order with a stable identifier
tie-break and stops before any event that pauses the world, such as a hostile
arrival decision. During a sector visit, `SectorTimeBudget` bounds each
operation by the next campaign boundary.

**Persistence.** After an accepted commit, the autosave queue encodes the
campaign and sector snapshot pair through `SaveGameUseCase` and
`packages/game/save.ts`, then writes it through `apps/web/lib/browser-save-writer.ts`
under a Web Lock per campaign storage key.

## 4. What is already migrated

The survey confirmed that the migration is further along than the code layout
suggests. Every one of the 23 use cases in `packages/game/application` is
referenced from production code outside its own folder:

| Use case | Reached from |
| --- | --- |
| `CreateGameSessionUseCase`, `RestoreGameUseCase` | `packages/game/public/game-persistence-api.ts` |
| `RecruitCombatantUseCase`, `FormSquadUseCase`, `RenewServiceContractUseCase`, `ResumeSectorSessionUseCase` | `packages/game/campaign.js` |
| `FightOnArrivalUseCase`, `WithdrawOnArrivalUseCase`, `RedirectJourneyUseCase` | `packages/game/squad-travel.js` |
| `EnterSectorUseCase` | `packages/game/world.js` |
| `AdmitSectorReinforcementsUseCase` | `packages/game/battle-handoff.js` |
| `ExecuteSectorOrderUseCase`, `EndSectorTurnUseCase`, `ResumeSectorOperationUseCase` | `packages/game/infrastructure/sector-sessions/sector-operation-coordinator.js` |
| `AdvanceWorldTimeUseCase` | `packages/game/military-remains.js` |
| `CollectResidentSupplyUseCase` | `packages/game/resident-scavenging.js` |
| `GetVisibleCharactersUseCase` | `packages/game/tactical.js` |
| `TransferItemUseCase` | `packages/game/tactical-inventory.js` |
| `TalkToCharacterUseCase` | `apps/web/app/page.tsx` and the playtest API |
| `GetRecruitmentCandidatesUseCase` | `apps/web/app/Recruitment.tsx` |
| `SaveGameUseCase`, `GetSaveStatusUseCase` | `apps/web/lib/campaign-autosave.ts` |

The domain layer is also complete in the ways the accepted plan names: private
state with intention-revealing methods, typed `DomainRefusal` codes, static
`restore` factories that do not repeat creation effects, state machines for
journey, arrival, sector session, and combat session, and policies that stay
pure functions of explicit inputs.

The editor boundary is enforced: the editor imports the game only through the
two declared public entries and the declared preview entries, and
`apps/campaign-editor/tools/check-boundaries.mjs` fails when the game's own
entry points reach editor code.

## 5. The gaps this migration closes

Each gap below states the state the survey found. The closing status of each
one is in [section 8](#8-what-the-series-closed-and-what-remains).

### Gap 1: three transaction mechanisms where the plan names one

The accepted plan states that shared infrastructure handles identity,
transactions, mapping, and persistence, and that the committed set is derived
rather than listed. The source has three separate mechanisms:

- `GameUnitOfWork` in `packages/game/infrastructure/persistence/game-unit-of-work.ts`
  is the canonical one: it holds a source, a copy function, a draft, a
  revision, and a shared `DomainIdentityMap`, and it refuses a stale revision.
  `packages/game/campaign.js` uses it for every campaign command.
- `CampaignJourneyTransaction` in
  `packages/game/infrastructure/journeys/campaign-journey-repositories.js`
  reimplements revision handling for the per-squad `journeyRevision`.
- `SectorOperationTransaction` in
  `packages/game/infrastructure/sector-sessions/sector-operation-repositories.js`
  reimplements it again for the per-sector `sectorRevision`, including its own
  "gameplay unchanged, do not bump" rule.

The two reimplementations are not duplicates of each other: they guard
different revision domains. They are, however, duplicates of the revision
policy that `GameUnitOfWork` already states, and they diverge in how they
report a conflict.

### Gap 2: browser composition inside React components

The accepted plan places browser composition in `apps/web`, and the repository
map says the player interface lives in `apps/web/app` while browser adapters
live in `apps/web/lib`. Today the boundary is blurred:

- `apps/web/app/Recruitment.tsx` builds `GetRecruitmentCandidatesUseCase` and
  `CampaignGetRecruitmentCandidatesRepository` inside the render body, on every
  render, and reaches directly into the game application and infrastructure
  layers.
- `apps/web/app/page.tsx` builds `CampaignTalkToCharacterRepository` and
  `TalkToCharacterUseCase` inside an event handler and reaches into the same
  layers.
- `apps/web/app/Campaign.tsx` imports domain types from
  `packages/game/domain`, and `apps/web/app/SaveProgress.tsx` imports an
  application repository type.

A React component should state an intention and render a result. Constructing
the object graph is composition, and composition belongs in `apps/web/lib`.

### Gap 3: the public surface does not constrain the player application

`packages/game/package.json` declares three exports, and
`apps/campaign-editor` respects them. `apps/web` does not depend on
`@granaderos/game` at all: it reaches into the package by relative path, 697
import statements across roughly 90 distinct modules, including the game
domain, application, and infrastructure layers. The declared public surface
therefore constrains the editor but not the game itself.

Most of those 697 statements import the retained compatibility modules that
`packages/game/public/campaign-editor-api.ts` already re-exports, so the
surface can be made real incrementally rather than all at once.

### Gap 4: inconsistent contracts in the application layer

The accepted plan requires one use-case folder per intention, each with a
readable request, response, repository interface, class, tests, and short
README, and the repository instructions forbid compressed source. The
application layer does not meet that bar uniformly:

- Several use-case files are written in a compressed one-line style, for
  example `application/sector-sessions/enter-sector/enter-sector.use-case.ts`
  and `application/personnel/get-recruitment-candidates/get-recruitment-candidates.use-case.ts`.
- `EnterSectorResponse` is declared inline in the use-case file instead of in
  its own `enter-sector.response.ts`, unlike `recruit-combatant` and
  `form-squad`.
- `packages/game/public/campaign-editor-api.ts` is a 166-line barrel that
  re-exports about 150 root modules verbatim, including internals such as
  `tactical.js`. It publishes the pre-architecture implementation as if it
  were a designed API.

### Gap 5: the compatibility list has not started to shrink

The accepted plan keeps a table of retained compatibility names, each with an
owner, the call sites it serves, and the removal stage, and states that the list
only shrinks. Every entry in that table is still present in the source. The
table covers save fields (`pendingBattle`, `battle`, `sectorState`, `recruited`,
`operativeState`, `sectorStates`, `sceneStates`, `suspendedSectorSessions`), a
command alias (`recruitCivic`), a query alias (`civicStatus`), a resolution
alias (`beginAssault`), and a legacy prepaid claim (`hiringArrivals`).

Save field names are the delicate part: they are part of the persisted format
and cannot be dropped without an explicit conversion. Command and query
aliases are not persisted and can be retired safely.

## 6. What the survey did not find

Two suspected gaps were checked and dismissed, so the migration does not
address them:

- Use cases were believed to be unwired. Every one is referenced from
  production code, as the table in section 4 shows.
- The domain layer was believed to import legacy modules. It imports only
  domain files, and `tools/check-architecture.mjs` fails the build otherwise.

## 7. Verification baseline

At the start of the migration, on Node 26.13.1:

```sh
npm test
```

reports 452 passing tests in about 92 seconds, with no failures. The repository
verification profiles are `npm run verify:commit` (format, lint, architecture,
dependency checks), `npm run verify:quick` (the same plus types, tests, and
audits), and `npm run verify` (the push profile plus the production build).

Each slice in [the plan](plan.md) must leave that suite green and must add the
tests that cover the behavior it moves.

## 8. What the series closed and what remains

The nine slices of [the plan](plan.md) have landed on the
`feature/clean-architecture-migration` branch. The gap status is:

| Gap | State | Where |
| --- | --- | --- |
| Three transaction mechanisms | Closed for the revision policy. One policy in `packages/game/infrastructure/shared/revision-policy.ts` now decides what a valid revision is, what a conflict is, and how a revision advances. `GameUnitOfWork` names the revision field it guards. The three revision fields stay separate: `gameRevision`, `journeyRevision`, and `sectorRevision` are different fields in the persisted snapshot, and merging them would change the save format. | Slice 2 |
| Browser composition inside React components | Closed. The two components that built a game object graph now call composition modules under `apps/web/lib`, and `tools/check-architecture.mjs` refuses an interface file that imports a game domain, application, or infrastructure module. | Slice 3 |
| Uneven use-case contracts | Closed. Every use-case folder has a request module, a response module, a repository interface, a use-case class, and a README, and `packages/game/application/use-case-contracts.test.ts` fails when a future use case skips one. | Slice 4 |
| The compatibility list not shrinking | Partly closed. The command alias `recruitCivic` and the eligibility query `civicStatus` are gone from the source, and the glossary records `candidateAdmission` as the canonical name. The persisted field names and the legacy prepaid claim `hiringArrivals` remain, because retiring them needs an explicit save conversion. | Slice 5 |
| The seeded random sequence outside the domain | Closed for the rule. `RandomSource` in `packages/game/domain/shared/random-source.ts` owns the sequence and produces exactly what the campaign produced before. The game session does not own it yet: the campaign snapshot's `seed` field is the state the running rules advance, and a session-held copy would be a second owner of the same sequence. | Slice 6 |
| The public surface not constraining the player application | Closed. `packages/game/public/game-runtime-api.ts` is the surface the player application reads the game through, and `tools/check-architecture.mjs` refuses any file under `apps/web` that reaches the game package any other way. | Slice 7 |
| No named compiler for the shared file contract | Closed. `CampaignCompiler` in `packages/game/application/campaign-compiler` is the application service that turns a validated `CampaignDefinition` into runtime-playable definitions, and it is the only path the game and the editor use. The architecture checker gives it one narrow exception, because reading the shared contract and the retained runtime rules is what it is for. | Slice 8 |
| The versioned game model without a name | Closed. `GameSnapshot` and the content it carries are named types in `packages/game/public/game-snapshot-types.ts`, and the save envelope, the save decoder, the persistence metadata and the worker request state them. | Slice 9 |

What the series did not do:

- The retained compatibility modules still carry the simulation. The public
  entry gives them one declared door, and the interface uses it, but the rules
  themselves still live in `packages/game/tactical.js` and
  `packages/game/campaign.js`.
- The game session does not own the `RandomSource` or the `WorldTimeline`, and
  the campaign snapshot's `seed` and revision fields are still the state the
  rules advance.
- The persisted compatibility names are still in the save format. Retiring
  them needs an explicit conversion and its own slice. The one that is not
  only a legacy artifact is `hiringArrivals`: it carries the travel delay of a
  hiring, so retiring it is a gameplay change with a save migration, and the
  accepted plan sequences it after the saved field names.

The remaining work is recorded in the slice notes.
