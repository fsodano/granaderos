# Slice 57: militia patrol movement

The domain owns the rule that decides whether a militia patrol moves during a
turn, calculates that turn's waypoint (the map position it is moving toward),
and selects a reachable destination. The retained
[`militia-patrol.js`](../../../../packages/game/militia-patrol.js) supplies
map-derived visibility and reachability, then assembles the move order.

## Rule ownership

[`militia-patrol.ts`](../../../../packages/game/domain/personnel/militia-patrol.ts)
also owns default patrol settings and saved-scene consistency. For movement, it
receives the patrol settings, unit state, turn, map size, enemy-visibility
result, and reachable cells.

- A patrol acts only when the rules enable it, the unit is an able militia, its
  own patrol order is not disabled, it is not knocked down or entangled, it has
  at least 25 action points, no enemy is in sight of its side, and it is more
  than three map cells from that turn's waypoint. An able unit has at least
  the 15-hit-point [critical-health threshold](../../../../packages/game/domain/personnel/actor-condition.ts),
  positive energy when the field is present (missing energy defaults to 100),
  and is not routed, fled, surrendered, or departing.
- The waypoint cycles through six fixed map points at the configured
  `waypointTicks` interval, the number of turns spent at each point.
- A destination must be reachable with a positive movement cost no greater than
  32, and paying that cost must leave the unit with at least 20 action points.
  It must bring the unit closer to the waypoint by straight-line map distance.
  The domain chooses the candidate closest to the waypoint; ties go to lower
  movement cost, then lower map row, then lower column. If no candidate
  qualifies, the patrol has no destination.

The domain does not query the tactical map. The retained
[`militia-patrol.js`](../../../../packages/game/militia-patrol.js) uses tactical
visibility and reachability queries, passes their results to the domain, and
formats a `move` order for the selected cell. Without the reachable-cell query,
the domain could select a blocked destination; without map-derived visibility,
it could not apply the rule that a side stops patrolling when it sees an enemy.
The retained module's `able` filter also chooses which visible observers and
opponents count in that sight query. It repeats the private `canAct` conditions
in [`militia-patrol.ts`](../../../../packages/game/domain/personnel/militia-patrol.ts)
and hard-codes `15` instead of
[`CRITICAL_HEALTH`](../../../../packages/game/domain/personnel/actor-condition.ts).
That duplicated eligibility check remains a migration item, separate from the
domain-owned patrol movement decision.

## Example

The [domain test fixtures](../../../../packages/game/domain/personnel/militia-patrol.test.ts)
define an 8-by-8 map and a militia at `(0, 0)` with 100 hit points and 100
action points. On turn 1, with no enemy in sight, the
waypoint is `(3, 3)`. If the map reports `(3, 2)` and `(2, 3)` as reachable at
cost 32, the domain chooses `(3, 2)` by its row tie-break. The retained module
uses that cell as the move-order destination. The map, unit, and reachable-cell
values come from test fixtures; the order assembly follows the current retained
module.

## Behavior checks

[`militia-patrol.test.ts`](../../../../packages/game/domain/personnel/militia-patrol.test.ts)
covers default settings, saved-scene consistency, turn waypoints, patrol
eligibility, destination budgets, and tie-breaking. These tests exercise domain
rules; the retained module remains responsible for map queries and order
assembly.
