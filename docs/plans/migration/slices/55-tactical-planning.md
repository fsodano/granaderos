# Slice 55: the tactical planning rules into the domain

**Branch:** `migration/tactical-planning`
**Intent:** Move the rules that shape a movement order into the domain, beside
the space rules they name.

## Why this slice exists

`packages/game/tactical-planning-space.ts` holds the rules that shape a
movement order: the point a plan names, which must name its ground level when
the order is elevated, and the order the plan produces for a combatant.

The domain already owns the tactical space: `packages/game/domain/sector-sessions/tactical-space.ts`
holds the rules that read a point's level and say whether two points share a
surface. The rules that turn a plan into an order belong with them.

## What it changes

- `packages/game/domain/sector-sessions/tactical-planning-space.ts` holds the
  rules.
- `packages/game/tactical-planning-space.ts` becomes a thin re-export of it,
  and the files that import it keep importing it from the same path.

The orders do not change: an elevated order still names its level, and a flat
report stays flat.

## Tests

- `packages/game/domain/sector-sessions/tactical-planning-space.test.ts` covers
  the rules: a flat point stays flat, an elevated point names its level, a
  point that already carries a level keeps it, and the order a plan produces
  names the destination and the combatant.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.59` to `0.2.60`.
