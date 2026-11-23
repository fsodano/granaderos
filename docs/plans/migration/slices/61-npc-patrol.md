# Slice 61: the NPC patrol rule into the domain

**Branch:** `migration/npc-patrol`
**Intent:** Move the rule that decides where a patrolling civilian walks into
the domain, beside the patrol rule it mirrors.

## Why this slice exists

`packages/game/npc-patrol.js` decides where a patrolling civilian walks. It
holds three parts: whether the civilian patrols at all this turn, the
direction it aims for, and the cell it moves to among the ones it can reach.

The domain already owns the militia patrol rule from two slices ago: the
decision, the waypoint, and the choice of the cell. A civilian patrol is the
same kind of rule with a different set of conditions, and two copies of the
shape are how they drift apart.

What the domain cannot take is the question of which cells the civilian can
reach and what it can see: that is the tactical simulation, so the retained
module keeps asking the map and hands the answers to the domain.

## What it changes

- `packages/game/domain/personnel/npc-patrol.ts` holds the decision, the
  direction and the choice of the cell.
- `packages/game/npc-patrol.js` keeps asking the map for the reachable cells
  and for what the civilian can see, and now calls the domain.

The civilian walks exactly as it did: the same direction on the same turn, the
same cell chosen.

## Tests

- `packages/game/domain/personnel/npc-patrol.test.ts` covers the rule: the
  direction for a turn, the decision for a civilian that may patrol and one
  that may not, and the cell chosen among the reachable ones, with the same
  bounds and the same tie-breaking.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.65` to `0.2.66`.
