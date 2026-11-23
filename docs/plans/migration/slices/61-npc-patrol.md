# Slice 61: civilian patrol decisions

Civilian and militia patrols share a decision pattern: decide whether the unit
patrols, choose that turn's aim, and select among map-reported reachable cells.
The civilian rule has its own conditions and movement bounds. Keeping those
decisions in the domain makes the policy independently testable while leaving
map-specific sight and reachability with the tactical adapter. It mirrors the
militia rule's decision structure, not its eligibility predicates: civilian
eligibility has no action-point threshold or no-enemy-in-sight condition.

## Rule ownership

[`npc-patrol.ts`](../../../../packages/game/domain/personnel/npc-patrol.ts)
owns civilian patrol eligibility, turn direction and aim, and reachable-cell
selection.

- A civilian patrols only when it has a patrol origin, its patrol order is not
  disabled, and it has not already patrolled this turn. It must have positive
  health and must not be unconscious, routed, departing, knocked down, or
  entangled.
- The sum of the character codes in the civilian identifier's string form
  offsets the turn modulo four, cycling through four cardinal directions. The
  aim is four cells from the patrol origin in that direction.
- A destination must be among the cells reported as reachable, have a positive
  movement cost no greater than 24, use a path of at most three steps, remain
  within a straight-line distance of six cells from the patrol origin, and
  reduce its straight-line distance to that turn's aim.
  The closest qualifying cell wins; ties go to lower movement cost, then lower
  row, then lower column. If no cell qualifies, the rule returns no destination.

Existing callers use `choosePatrolAction` in the retained
[`npc-patrol.js`](../../../../packages/game/npc-patrol.js). That entry point
filters the scene to same-side units and opponents the civilian can see, obtains
known artillery and reachable cells from tactical code, and formats the
selected destination as a `move` order. The domain does not query map geometry
or visibility: without map-reported reachability it could select a blocked
cell, and without the sight filter the reachable-cell query would use the wrong
perceived scene.

## Example

The test fixture in
[`npc-patrol.test.ts`](../../../../packages/game/domain/personnel/npc-patrol.test.ts)
places civilian `c1` at `(10, 10)` with patrol origin `(10, 10)` on turn `1`. Its
identifier and turn select the eastward aim `(14, 10)`. Of the reachable cells
`(11, 10)` at cost 8 and one path step and `(13, 10)` at cost 12 and two path
steps, the domain selects `(13, 10)` because it is closer to the aim. The
retained module formats that selection as a move order to `(13, 10)`. The
civilian and reachable-cell values are test data; the rule comes from the
domain module and the order shape from the retained module.

## Behavior checks

[`npc-patrol.test.ts`](../../../../packages/game/domain/personnel/npc-patrol.test.ts)
covers direction and aim, identifier and turn variation, patrol eligibility,
reachable-cell bounds, tie-breaking, and cases with no destination. These are
domain tests; tactical map queries and move-order assembly remain in the
retained module.
