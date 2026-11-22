# Slice 32: consolidate the richer perception rules into the domain

**Branch:** `migration/perception-consolidation`
**Intent:** Make the domain's perception rules the single implementation of
direction and heard-position, and have both retained modules read them.

## Why this slice exists

`packages/game/domain/perception/npc-perception.ts` holds simpler rules for
`directionTo` and `approximateHeardPosition`, moved there by an earlier slice.
It has no in-repo callers: the game actually reads richer copies of the same
two functions from `packages/game/tactical-awareness.js`, which adds input
validation, a facing fallback, night vision, a running penalty, map bounds,
and an unconscious-listener check.

Two implementations of the same rule in the domain area are how they drift.
The richer ones are the ones the game uses, so they are the ones the domain
should own.

## What it adds

The domain module `packages/game/domain/perception/npc-perception.ts` becomes
the owner of the richer rules, with the input validation and the extra
mechanics they have today.

## What it changes

- `packages/game/tactical-awareness.js` keeps its module and its exports, and
  re-exports those two functions from the domain. Its other rules stay.
- `packages/game/npc-perception.js` keeps its module and its exports, and
  re-exports the same two domain functions.
- Both sets of callers keep importing from the paths they use today, and each
  gets the richer behavior it already had.
- The simpler rule tests are replaced by tests of the richer rules.

No caller changes its behavior: the richer rules are what the game already
ran.

## Tests

- The domain test covers the richer rules: input validation, a facing
  fallback for coincident points, the eight compass steps, the night vision
  and running bonuses, the obstruction penalty, the map-bound clamp, an
  unconscious listener, and the exact keys of the report.
- The retained modules' existing consumer tests keep passing, which proves
  the callers' behavior did not change.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.36` to `0.2.37`.
