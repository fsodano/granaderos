# Slice 26: the tactical space helpers into the domain

**Branch:** `migration/tactical-space`
**Intent:** Move the rules that read a point's tactical level into the domain,
so the game has one implementation of them.

## Why this slice exists

`packages/game/tactical-space.js` re-exports the tactical level rules from the
shared file contract and then defines the game's own space rules on top:
which level a point is on, whether a level is a legal one, the key that names
a cell on a level, whether two points are on the same surface or the same
cell, and the point a space record becomes.

[Slice 24](24-interior-visibility.md) had to copy five of those helpers into
the domain, because the module they lived in reads the shared file contract
and the domain may not. Two copies of the same rule is how they drift apart.

The rule itself belongs in the domain: a point's tactical level is a fact
about the map the game plays on. The shared file contract keeps its own copy
because it validates authored maps and cannot import the game.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/sector-sessions/tactical-space.ts` | The level rules |
| `packages/game/domain/sector-sessions/tactical-space.test.ts` | Their tests |

## What it changes

- `packages/game/domain/sector-sessions/tactical-space.ts` holds
  `MAX_TACTICAL_LEVEL`, `tacticalLevel`, `validTacticalLevel`, `spaceKey`,
  `sameSurface`, `sameCell`, and `spacePoint`. The values and the behavior
  are the ones the game uses today: a point with no level is on level zero,
  a legal level is an integer from zero to eight, and the key of a cell names
  its level and its coordinates.
- `packages/game/tactical-space.js` re-exports those from the domain instead
  of from the shared file contract, and keeps `DEFAULT_SLAB_THICKNESS`, which
  is an authored default, together with the space functions it already
  defines. The files that import the module keep importing it from the same
  path.

## The importer edits this slice needed

The helpers were untyped JavaScript before, so a point that might be missing
passed silently. Typed, they surfaced four places that relied on that
silence: `packages/game/group-movement.ts` and `packages/game/movement-step.ts`,
`apps/web/app/useUnitMotion.ts`, and three test fixtures. Each was narrowed
without changing what it computes, and the full suite covers them.

## Tests

- `packages/game/domain/sector-sessions/tactical-space.test.ts` covers the
  rules: a point with no level is on level zero, a point with a level keeps
  it, a legal level is an integer from zero to eight, the key of a cell names
  its level and its coordinates, two points on the same level and coordinates
  are the same cell, points on different levels are not, and the space point
  of a record keeps its coordinates and its level.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.30` to `0.2.31`.
