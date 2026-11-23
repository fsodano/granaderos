# Slice 57: the militia patrol decision into the domain

**Branch:** `migration/militia-patrol-order`
**Intent:** Give the domain the rule that decides where a militia patrol goes
and which cell it picks, and leave the tactical module with the movement it
asks the map for.

## Why this slice exists

`packages/game/militia-patrol.js` decides where a militia patrol walks. It
holds three parts:

The decision: whether the unit patrols at all this turn (patrols are on, the
unit is a militia that can still act, it is not knocked down or entangled, it
has enough action points, and no enemy is in sight of its side), and whether it
is already close enough to its waypoint to stop.

The waypoint: the six fixed points of the map the patrol cycles through, one
every few turns.

The choice: which reachable cell the unit moves to, the one that brings it
closest to the waypoint, breaking ties by cost, then by row, then by column.

The domain already owns the patrol tuning and the scene consistency from the
previous slice, and the residents whose routines the patrol affects. The
decision, the waypoint and the choice belong with them.

What the domain cannot take is the question of which cells the unit can reach:
that is the tactical simulation, so the retained module keeps asking the map
for them and hands the answers to the domain.

## What it changes

- `packages/game/domain/personnel/militia-patrol.ts` gains the decision, the
  waypoint and the choice.
- `packages/game/militia-patrol.js` keeps asking the map for the reachable
  cells and for what the unit can see, and now calls the domain to decide.

The patrol moves exactly as it did: the same waypoint on the same turn, the
same cell chosen.

## Tests

- `packages/game/domain/personnel/militia-patrol.test.ts` covers the rule: the
  waypoint of a turn, the decision for a unit that may patrol and one that may
  not, and the cell chosen among reachable ones, with the same tie-breaking.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.61` to `0.2.62`.
