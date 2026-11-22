# Slice 29: the NPC perception rules into the domain

**Branch:** `migration/npc-perception`
**Intent:** Move the rules that decide where a civilian looks and where they
believe a sound came from into the domain, next to the other perception
rules.

## Why this slice exists

`packages/game/npc-perception.js` holds two pure rules: `directionTo` decides
which way a civilian faces when looking at a point, and
`approximateHeardPosition` decides where a civilian believes a sound came
from, given its radius, the obstructions, and the map bounds.

The file states the invariant that matters: a report never retains the live
identity of the shooter. A civilian can know where a sound came from without
knowing who made it.

The domain already owns perception: `VisionObserver` holds the condition and
posture that determine perception, `FieldOfView` holds facing and angular
limits, `VisibilityPolicy` holds range and posture rules, and
`KnownSectorPolicy` limits what the player may know. The civilian rules
belong with them.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/perception/npc-perception.ts` | The rules |
| `packages/game/domain/perception/npc-perception.test.ts` | Their tests |

## What it changes

`packages/game/npc-perception.js` keeps its module and its exports, and
becomes a thin re-export of the domain module. The two files that import it
keep importing it from the same path.

The rules do not change: the same facing, the same approximate position, the
same uncertainty, and the same bounds on the map.

## Tests

- `packages/game/domain/perception/npc-perception.test.ts` covers the rules:
  a listener looking at its own cell keeps its facing, the direction to a
  point follows the eight compass steps, a sound inside the radius produces
  an approximate position with an uncertainty, a sound beyond the radius
  produces none, obstructions shrink the radius, the position stays inside
  the map, and the report carries no shooter identity.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.33` to `0.2.34`.
