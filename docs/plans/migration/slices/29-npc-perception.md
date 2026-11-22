# Slice 29: NPC perception rules in the domain

**Intent:** Put the simple facing and heard-position rules for non-player
characters in the domain.

## Why this slice exists

`directionTo` calculates a facing direction between two points.
`approximateHeardPosition` returns a coarse, anonymous position for a sound
within hearing range, accounting for obstructions and map bounds.

The domain owns these simple rules in
`packages/game/domain/perception/npc-perception.ts`. The retained
`packages/game/npc-perception.js` module re-exports them, but no source file
imports that module.

The live NPC consumers, `packages/game/npc-ai.js` and
`packages/game/tactical.js`, import both functions from
`packages/game/tactical-awareness.js`, which keeps richer copies. Other
tactical code also imports `directionTo` from that module. Consolidating the
duplicate perception rules in `tactical-awareness.js` remains a requirement.

A hearing report contains no shooter identity. A non-player character can know
where a sound came from without knowing who made it.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/perception/npc-perception.ts` | The domain rules |
| `packages/game/domain/perception/npc-perception.test.ts` | Their tests |

## What it changes

- `packages/game/npc-perception.js` re-exports the domain functions. No source
  module imports this compatibility module.
- `packages/game/npc-ai.js` and `packages/game/tactical.js` continue to import
  the richer copies from `packages/game/tactical-awareness.js`.
- The duplicate perception implementations in `tactical-awareness.js` remain
  to be consolidated.

The domain rules preserve their facing, approximate-position, uncertainty, and
map-bound behavior.

## Tests

- `packages/game/domain/perception/npc-perception.test.ts` covers the rules:
  a listener looking at its own cell keeps its facing, the direction to a
  point follows the eight compass steps, a sound inside the radius produces an
  approximate position with uncertainty, a sound beyond the radius produces
  none, obstructions shrink the radius, the position stays inside the map,
  and the report carries no shooter identity.
