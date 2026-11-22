# Slice 2: canonical revision policy

**Branch:** `migration/canonical-transaction`
**Intent:** Give the infrastructure one implementation of the revision policy
that every transaction adapter uses, and let `GameUnitOfWork` name the
revision field it guards instead of assuming one.

## Why this slice exists

The accepted architecture states that shared infrastructure handles identity,
transactions, mapping, and persistence, and that an accepted transaction reads
a session and revision, copies the loaded snapshot, hands the copy to the use
case, validates the resulting invariants, and stores the whole snapshot with
one revision advance.

The source implements the revision half of that statement three times:

| Mechanism | File | Revision it guards | Conflict code |
| --- | --- | --- | --- |
| `GameUnitOfWork` | `packages/game/infrastructure/persistence/game-unit-of-work.ts` | `gameRevision` on the campaign snapshot | `DomainRefusalCode.RevisionConflict` |
| `CampaignJourneyTransaction` | `packages/game/infrastructure/journeys/campaign-journey-repositories.js` | `journeyRevision` on one squad | `JourneyRefusalCode.JourneyRevisionConflict` |
| `SectorOperationTransaction` | `packages/game/infrastructure/sector-sessions/sector-operation-repositories.js` | `sectorRevision` on the sector snapshot | `DomainRefusalCode.RevisionConflict` |

Each re-reads the revision, checks it against the expected value, computes the
next one, and writes it back. `packages/game/infrastructure/shared/revision.js`
holds a six-line `nextRevision` helper that only two of the three use, so the
validation rule itself is duplicated as well.

The three guard different revision fields on purpose: `gameRevision` belongs to
the campaign, `journeyRevision` to one squad, and `sectorRevision` to the
active sector. They are separate fields in the persisted snapshot and this
slice does not merge them. What this slice removes is the duplication of the
policy that decides what a valid revision is, what a conflict is, and how a
revision advances.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/infrastructure/shared/revision-policy.ts` | The shared revision policy and the revision domains the adapters name |
| `packages/game/infrastructure/shared/revision-policy.test.ts` | The policy's own tests |

The policy replaces `packages/game/infrastructure/shared/revision.js`, which held
a single `nextRevision` helper that only half of the adapters used.

## What it changes

- `packages/game/infrastructure/persistence/game-unit-of-work.ts` takes an
  optional revision domain and an optional expected revision, exposes its
  revision, and delegates the conflict check and the advance to the shared
  policy. The default domain is `gameRevision`, so every current caller keeps
  its behavior.
- `packages/game/infrastructure/sector-sessions/sector-operation-repositories.js`,
  `packages/game/infrastructure/sector-sessions/sector-reinforcement-repository.js`,
  `packages/game/infrastructure/journeys/campaign-journey-repositories.js`,
  and `packages/game/squad-travel.js` use the shared policy and name their
  revision domains, instead of carrying their own copies of the rules.

The accepted behavior of each path does not change:

- A campaign command still refuses a stale `gameRevision` with
  `DomainRefusalCode.RevisionConflict`, still copies the snapshot, still
  advances the revision by exactly one on commit, and still refuses to act
  twice on the same transaction.
- A sector operation still refuses a stale `sectorRevision`, still leaves the
  revision untouched when the order was refused or when nothing about the
  gameplay changed, and still advances it by one when the sector state changed.
- A journey command still refuses a stale `journeyRevision` with
  `JourneyRefusalCode.JourneyRevisionConflict` and still advances it by one.

## Tests

- `packages/game/infrastructure/shared/revision-policy.test.ts` covers the
  shared policy: a valid revision reads back, a non-integer or negative
  revision is refused, a conflicting expectation is refused, and an advance
  produces exactly the next integer.
- `packages/game/infrastructure/persistence/game-unit-of-work.test.ts` gains
  cases for the named revision domain and for the expected-revision argument.
- `packages/game/infrastructure/sector-sessions/sector-operation-repositories.test.ts`
  covers the sector transaction behavior that the policy change touches: a
  stale sector revision is refused, a refused order leaves the revision
  untouched, an unchanged sector state leaves the revision untouched, and a
  changed one advances it.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.6` to `0.2.7`.
