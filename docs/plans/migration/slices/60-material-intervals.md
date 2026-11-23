# Slice 60: material intervals belong to the domain

A material interval is the part of a shot's trajectory that crosses one
material object. The domain owns how a set of intervals for that object becomes
the material spans consumed by projectile flight.

## Rule ownership

[`material-intervals.ts`](../../../../packages/game/domain/combat/material-intervals.ts)
sorts intervals by entry and then exit, merges intervals that overlap or touch,
and creates an entering and leaving event for each merged span. The
`MATERIAL_INTERVAL_TOUCH_TOLERANCE` is `1e-10` trajectory-fraction units; it
absorbs last-bit differences at adjacent cell boundaries. A merged span keeps
the first interval's cell and volume payload and extends to the furthest exit.

[`projectile-cover.js`](../../../../packages/game/projectile-cover.js) traces
the shot through map geometry and collects the clipped intervals for each
material object. It passes those intervals to the domain and consumes the
resulting events. The flight applies material resistance while a span is
active and air retention only when no material span is active.

For example, the illustrative fractions `[0.2, 0.4]` and `[0.4, 0.6]` for one
object merge into `[0.2, 0.6]`, producing one enter event and one exit event.
Without merging, the same material can be charged twice at the shared cell face
and a shot can stop one cell too early.

The enter event has priority 2 and the exit event has priority 4. The flight
orders events by trajectory fraction, priority, and key, so material starts
before a body event at the same fraction and remains active through a body event
at its exit.

## Behavior covered

[`material-intervals.test.ts`](../../../../packages/game/domain/combat/material-intervals.test.ts)
covers separate intervals, overlapping and touching intervals, the touch
tolerance, entry order, the furthest exit, payload preservation, and the
entering and leaving events.
