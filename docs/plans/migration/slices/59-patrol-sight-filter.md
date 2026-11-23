# Slice 59: one owner for patrol eligibility

A patrol's movement decision and sight filter depend on the same eligibility
rule: whether a unit can act. Using one domain check for both prevents the
sight query from admitting observers or opponents the patrol decision would
reject.

## Rule ownership

[`militia-patrol.ts`](../../../../packages/game/domain/personnel/militia-patrol.ts)
exports `canAct`, the eligibility check used by the patrol decision.
[`militia-patrol.js`](../../../../packages/game/militia-patrol.js) uses that
same check for friendly observers and opposing units in its sight query. The
retained module still asks tactical code for visibility and reachable cells,
then assembles the move order.

`canAct` requires at least [`CRITICAL_HEALTH`](../../../../packages/game/domain/personnel/actor-condition.ts)
(15 hit points), a conscious unit, and no routed, fled, surrendered, or
departure state. A living unit with zero energy is unconscious; if energy is
absent, [`isUnconscious`](../../../../packages/game/domain/personnel/actor-condition.ts)
treats it as 100. For example, a unit at 15 hit points with energy 1 qualifies,
while the same unit at zero energy does not.

## Behavior covered

[`militia-patrol.test.ts`](../../../../packages/game/domain/personnel/militia-patrol.test.ts)
covers the critical-health boundary, absent and zero energy, the disqualifying
statuses, and patrol eligibility.
