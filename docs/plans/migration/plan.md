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

All five slices have landed on `feature/clean-architecture-migration`. Each
slice has its own note under [slices](slices/README.md) with the intent, the
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
