# Migration slice notes

Each note states the intent of one slice, the files it touches, the tests it
adds, and how it is verified. Write the note before implementing the slice and
update it when the slice lands, so a later session can resume without reading
the diff.

[Migration plan](../plan.md) · [Orientation and gap analysis](../overview.md)

| Slice | Branch | State | Version |
| --- | --- | --- | --- |
| [1. Plan and orientation](01-plan-and-orientation.md) | `migration/plan-and-orientation` | landed | 0.2.6 |
| [2. Canonical transaction](02-canonical-transaction.md) | `migration/canonical-transaction` | landed | 0.2.7 |
| [3. Browser composition](03-browser-composition.md) | `migration/browser-composition` | landed | 0.2.8 |
| [4. Use-case contracts](04-use-case-contracts.md) | `migration/use-case-contracts` | landed | 0.2.9 |
| [5. Compatibility aliases](05-compatibility-aliases.md) | `migration/compatibility-aliases` | landed | 0.2.10 |
| [6. Random source](06-random-source.md) | `migration/random-source` | landed | 0.2.11 |
| [7. Interface public entry](07-interface-public-entry.md) | `migration/interface-public-entry` | landed | 0.2.12 |

A slice moves from planned to in progress when its branch is created, and to
landed when it is merged into `feature/clean-architecture-migration` and its
branch is deleted.

## What the series changed

- The orientation survey and the gap analysis are recorded in
  [the overview](../overview.md), and section 8 of that document states which
  gaps are closed and which remain.
- The infrastructure has one revision policy, and `GameUnitOfWork` names the
  revision field it guards.
- The player interface no longer builds game object graphs. The construction
  lives in `apps/web/lib`, and `tools/check-architecture.mjs` refuses an
  interface file that reaches into a game layer.
- Every use case has the same contract shape, and a test keeps it that way.
- The command alias `recruitCivic` and the eligibility query `civicStatus`
  are gone from the source. The glossary records `candidateAdmission` and the
  compatibility table shrank by two rows.
- The seeded random sequence is a domain object, `RandomSource`, and the
  campaign reads it from there.
- The player application reaches the game through
  `packages/game/public/game-runtime-api.ts`, and the checker refuses any
  other way in.
