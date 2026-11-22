# Clean architecture migration plan

This plan moves the Granaderos source onto the
[accepted domain architecture](../accepted/domain-architecture.md). It starts
from the [orientation and gap analysis](overview.md) and turns the gaps it
found into a sequence of small, independently verifiable slices.

[Orientation and gap analysis](overview.md) · [Slice notes](slices/README.md) · [Accepted domain architecture](../accepted/domain-architecture.md)

## Goal

Make the running game follow the architecture the repository already accepts:
one transaction mechanism, browser composition outside the interface layer, a
public surface that actually constrains its consumers, uniform use-case
contracts, and a compatibility list that shrinks.

The work is a series, not a single change. Each slice is reviewed and merged
on its own, so the migration can stop at any point and still leave a coherent
repository.

## Scope and non-goals

In scope:

- The layering and contract gaps listed in [section 5 of the overview](overview.md#5-the-gaps-this-migration-closes).
- The verification tooling that keeps the new boundaries honest.
- The documentation that records the new shape.

Out of scope for this series:

- Gameplay changes. No rule, number, or player-visible outcome changes.
- Save format changes. The persisted `format` and `schema` values, and the
  persisted field names listed in the compatibility table, stay readable. This
  series removes command and query aliases, which are never persisted.
- The retained compatibility modules themselves. `packages/game/tactical.js`
  and `packages/game/campaign.js` still carry the simulation; the migration
  moves the boundaries around them, and later slices move their rules.
- The player application's package-level dependency on the game package. The
  interface no longer reaches past the public entries into the game layers,
  but making `apps/web` depend on `@granaderos/game` changes how the build
  resolves the game and needs its own slice.
- Editor and campaign format work. Both already meet the accepted plan.

## Slice sequence

| Slice | Branch | Intent | Version after merge |
| --- | --- | --- | --- |
| 1 | `migration/plan-and-orientation` | Record the orientation, the gap analysis, and this plan | 0.2.6 |
| 2 | `migration/canonical-transaction` | One revision policy, with the revision domain named by its caller | 0.2.7 |
| 3 | `migration/browser-composition` | Composition moves out of React components into `apps/web/lib`, and the checker keeps it there | 0.2.8 |
| 4 | `migration/use-case-contracts` | Uniform use-case contracts across the application layer | 0.2.9 |
| 5 | `migration/compatibility-aliases` | The first compatibility names leave the source | 0.2.10 |
| 6 | `migration/random-source` | The seeded random sequence becomes a domain object | 0.2.11 |
| 7 | `migration/interface-public-entry` | The player application reaches the game through a declared public entry | 0.2.12 |
| 8 | `migration/campaign-compiler` | The application service that is the only path from the shared file contract into the game | 0.2.13 |
| 9 | `migration/game-snapshot` | The versioned representation of the game model has the name the glossary gives it | 0.2.14 |
| 10 | `migration/weapon-readiness` | The rule that prepares a firearm moves into the domain | 0.2.15 |
| 11 | `migration/resident-position-reference` | The saved resident-post projection takes the name the glossary gives it | 0.2.16 |
| 12 | `migration/unarmed-combat` | The unarmed combat rule moves into the domain | 0.2.17 |
| 13 | `migration/sleep-need` | The sleep need rule moves into the domain and its wording into the interface | 0.2.18 |
| 14 | `migration/held-supplies` | The held consumable rule moves into the domain | 0.2.19 |
| 15 | `migration/projectile-energy` | The projectile energy rule moves into the domain | 0.2.20 |
| 16 | `migration/firearm-loads` | The rule that decides which loads a firearm can use moves into the domain | 0.2.21 |
| 17 | `migration/study-rate` | The rule that decides how fast a combatant learns moves into the domain | 0.2.22 |
| 18 | `migration/route-queue` | The queue that finds the cheapest route moves into the domain | 0.2.23 |
| 19 | `migration/firearm-serviceability` | The rule that decides whether a firearm is usable moves into the domain | 0.2.24 |
| 20 | `migration/kinetic-impact` | The rule that turns a launch into the impact it lands with moves into the domain | 0.2.25 |
| 21 | `migration/combat-balance` | The combat tuning table and the cover and penetration damage rules move into the domain | 0.2.26 |
| 22 | `migration/combat-journal` | The rules that decide what the public combat journal may contain move into the domain | 0.2.27 |
| 23 | `migration/fatigue` | The fatigue and energy rules move into the domain, next to the character's condition | 0.2.28 |

The first five slices landed in [pull request #505](https://github.com/fsodano/granaderos/pull/505), the next two in [pull request #506](https://github.com/fsodano/granaderos/pull/506), the two after them in [pull request #507](https://github.com/fsodano/granaderos/pull/507), and the two after those in [pull request #508](https://github.com/fsodano/granaderos/pull/508). The last two are the fifth batch.

Each slice has its own note under [slices](slices/README.md) with the intent, the
files it touches, the tests it adds, and how it is verified. Read the note
before starting the slice.

The survey that opened the series found that the use cases were already wired
and that the domain layer was already clean, so the sequence spends its effort
on the boundaries that were not: the revision policy, the composition layer,
the contract shape, and the compatibility list.

### Slice 1: plan and orientation

Writes this folder. It changes no source file, so its verification is the
documentation check plus the unchanged test suite. It exists so that a later
session can resume the migration without re-deriving the survey.

### Slice 2: canonical transaction

The infrastructure ends up with one implementation of the revision policy:
what a valid revision is, what a conflict is, and how a revision advances.
`packages/game/infrastructure/shared/revision-policy.ts` holds it, and it names
the revision domains the adapters protect. `GameUnitOfWork` takes the domain
it guards instead of assuming `gameRevision`, and the journey, sector, and
reinforcement adapters use the same policy instead of carrying their own copies
of the rules.

The three revision fields stay separate: `gameRevision`, `journeyRevision`,
and `sectorRevision` are different fields in the persisted snapshot, and
merging them would change the save format. The slice removes the duplication
of the policy, not the fields.

The slice adds tests for the shared policy and keeps the existing sector and
journey behavior tests green.

### Slice 3: browser composition

`apps/web/app` stops constructing game object graphs. The two React call sites
that build a use case and its repository today move into composition modules
under `apps/web/lib`, and the interface imports the composition module instead
of the game layers.

`tools/check-architecture.mjs` gains a rule: a file under `apps/web/app` may not
import from `packages/game/domain`, `packages/game/application`, or
`packages/game/infrastructure`. The rule is what keeps the slice from being
undone by the next component.

### Slice 4: use-case contracts

Every use-case folder in `packages/game/application` gets the same shape:
a readable use-case class, a request type, a response type in its own file, a
narrow repository interface, and a README that states the intention, the
refusal codes, and the invariants. The compressed one-line use cases are
expanded. `EnterSectorResponse` moves into its own file.

`packages/game/public/campaign-editor-api.ts` stops being a blanket barrel.
It keeps the names the editor already imports and drops the internal modules
that no editor code uses, and the editor's boundary check confirms the
published surface still satisfies it.

### Slice 5: compatibility aliases

The command alias `recruitCivic` and the query alias `civicStatus` leave the
source, together with the resolution alias `beginAssault`. None of them is
persisted, so no save conversion is needed. Callers move to the canonical
names `recruitCombatant`, the recruitment availability query, and the arrival
resolution.

The [ubiquitous language](../accepted/ubiquitous-language.md) compatibility
table is updated in the same slice, because the table is the record of what the
source still serves.

### Slice 6: random source

The seeded random sequence moves out of a procedural helper in
`packages/game/campaign.js` and into a domain class,
`packages/game/domain/shared/random-source.ts`. The class produces exactly the
sequence the campaign produces today, so no rule changes, and the domain can
finally state the sequence a game owns.

The game session does not own the source yet. The campaign snapshot's `seed`
field is the state the running rules advance, and a session-held copy would be
a second owner of the same sequence. The slice note records what has to change
before the session can own it.

### Slice 7: interface public entry

`packages/game/public/game-runtime-api.ts` becomes the declared surface the
player application reads the game through, in the style of the entry the
campaign editor already uses. The 465 import statements that reach the
retained compatibility modules by relative path become imports of that entry,
and the architecture checker refuses an application file that reaches the
package any other way.

### Slice 8: campaign compiler

The game gains the application service the ubiquitous language names as the
only path from the shared file contract into the game: `CampaignCompiler` in
`packages/game/application/campaign-compiler`. The compilation rules and the
refusal messages stay exactly as they are, so the editor shows the author the
same words.

### Slice 9: game snapshot

The versioned representation of the game model takes the name the glossary
gives it. `GameSnapshot` and the content it carries become named types that
`packages/game/save.ts` and the worker transport use, instead of anonymous
literals. No save format change.

### Slice 10: weapon readiness

The rule that decides how much work a firearm is to bring into firing position
moves from `packages/game/weapon-readiness.js` into
`packages/game/domain/combat/weapon-readiness.ts`, and the root module becomes
a thin re-export, the way `packages/game/action-points.js` already does. The
rule and its numbers do not change, and no caller changes.

### Slice 11: resident position reference

The saved resident-post projection takes the name the glossary gives it,
`ResidentPositionReference`, and the saved field states that type instead of
an inline shape. No saved value changes.

### Slice 12: unarmed combat

The rule that decides whether an unarmed strike lands, what it costs, and how
likely a weapon is to be taken moves from `packages/game/unarmed-combat.js`
into `packages/game/domain/combat/unarmed-combat.ts`, and the root module
becomes a thin re-export. The numbers do not change and no caller changes.

### Slice 13: sleep need

The rule that decides how much rest a combatant needs moves into
`packages/game/domain/personnel/sleep-need.ts`, and the Spanish sentence that
describes it moves out of the game and into the interface's own label module,
where the plan says a player-facing sentence belongs.

### Slice 14: held supplies

The rule that decides which consumable a combatant holds in hand, what it
costs to use and how far it reaches moves into
`packages/game/domain/inventory/held-supplies.ts`, next to the inventory that
owns what a combatant carries. The root module becomes a thin re-export.

### Slice 15: projectile energy

The rule that turns a projectile's mass and velocity into impact moves into
`packages/game/domain/combat/projectile-energy.ts`, next to the shot rules.
The format check stays in the root module, because the shared file contract
cannot be read from the domain.

### Slice 16: firearm loads

The rule that decides which loads a firearm may use, and how an authored
override replaces the default, moves into
`packages/game/domain/combat/firearm-loads.ts`, next to the firearm that
carries them. The root module becomes a thin re-export.

### Slice 17: study rate

The rule that decides how much training credit a combatant earns in an hour
moves into `packages/game/domain/personnel/study-rate.ts`, next to the
character's abilities. The forecast of how long the next gain takes stays in
the root module, because it reads the campaign's training tables.

### Slice 18: route queue

The stable minimum-cost queue that finds a route moves into
`packages/game/domain/journeys/route-queue.ts`, next to the journey route
planner that uses it. The root module becomes a thin re-export.

### Slice 19: firearm serviceability

The rule that decides whether a firearm is still usable moves into
`packages/game/domain/combat/firearm-serviceability.ts`, next to the firearm
that owns its condition. The root module becomes a thin re-export.

### Slice 20: kinetic impact

The rule that turns a projectile's launch into the impact it lands with moves
into `packages/game/domain/combat/kinetic-impact.ts`, beside the launch it
comes from. The root module keeps the format check, because the domain may
not read the shared file contract.

### Slice 21: combat balance

The combat tuning table and the cover and penetration damage rules move into
`packages/game/domain/combat/combat-balance.ts`. The domain already holds
this kind of tuning in `HealthRules`, `ActionPointRules` and `IgnitionRules`,
and the action point policy is now given its penalties from the domain's own
table.

### Slice 22: combat journal

The rules that decide what the public combat journal may contain move into
`packages/game/domain/combat/combat-journal.ts`. The root module becomes a
thin re-export.

### Slice 23: fatigue and energy

The rules of a combatant's stamina move into
`packages/game/domain/personnel/fatigue.ts`, next to the character's
condition. The domain holds the pure part, and the four functions that change
a combatant stay in the root module and call it, so the domain stays a pure
function of its inputs.

## Branch and merge flow

The series uses one integration branch and one short-lived branch per slice, so
that only a single pull request exists at the end.

```text
main
  |
  +-- feature/clean-architecture-migration        (integration branch)
        |
        +-- migration/plan-and-orientation   -> merged back, branch deleted
        +-- migration/canonical-transaction  -> merged back, branch deleted
        +-- migration/browser-composition    -> merged back, branch deleted
        +-- migration/use-case-contracts     -> merged back, branch deleted
        +-- migration/compatibility-aliases  -> merged back, branch deleted
```

Rules for every slice:

1. Branch the slice from the current tip of `feature/clean-architecture-migration`.
2. Implement the slice, add its tests, and verify it.
3. Commit the slice on its own branch, then merge it back into
   `feature/clean-architecture-migration` with `--no-ff` so the slice boundary
   stays visible in the history.
4. Delete the slice branch once its merge is in place.
5. Bump the version as part of the slice commit, so the bump travels with the
   change it describes.

The integration branch is pushed once, at the end, and a single pull request
opens against `main`. No pull request exists while the slices are in progress,
so the continuous integration run does not repeat for every commit.

## Version policy

The version lives in `VERSION`, in the root `package.json`, in
`packages/game/package.json`, and in `apps/web/package.json`. All four move
together.

Each merged slice bumps the patch version. The series does not change the
public browser API, the save format, or any gameplay rule, so a minor bump
would overstate the change. The minor version moves to `0.3.0` when the
migration series is complete, which is a separate, later decision.

## Verification strategy

Every slice must satisfy, in order:

1. `npm test` passes with the slice's new tests included. The suite takes
   about 92 seconds and runs on Node 26.13.1, the version pinned in
   `.node-version`.
2. `npm run typecheck` passes.
3. `npm run check:architecture` passes.
4. `npm run lint` and `npm run check:format` pass.

Before the pull request opens, `npm run verify:quick` must pass on the
integration branch.

Tests added by a slice cover the behavior the slice moves, not the shape of the
code. A slice that only moves a boundary needs a test that fails when the
boundary is broken, and the architecture checker is that test for the
boundaries it can express as import rules.

## Resuming the work

This folder is the resume point. A new session reads, in order:

1. [overview.md](overview.md) for the shape of the system and the gaps.
2. [plan.md](plan.md) for the sequence and the rules.
3. [slices/README.md](slices/README.md) for the state of each slice and the
   next one to start.
4. The slice note for that slice, which names the files, the tests, and the
   verification commands.

The slice notes record what a slice changed, so a later session does not have
to re-derive it from the diff.
