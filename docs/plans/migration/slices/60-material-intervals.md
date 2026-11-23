# Slice 60: the material interval rule into the domain

**Branch:** `migration/material-intervals`
**Intent:** Move the rule that decides which spans of a shot cross material
into the domain, beside the shot rules it belongs to.

## Why this slice exists

`packages/game/projectile-cover.js` traces a shot across the map and, when it
meets cover, decides how much of the material the shot spends. The part that
decides the spans is a rule of its own: the clipped intervals of one object are
ordered, the ones that overlap or touch are merged into one span, and each span
becomes an entering and an leaving event along the flight.

The domain already owns what a shot does to a body and to a wall:
`CombatInjury` applies the impact, `BodyRegion` owns the modifiers, and the
projectile energy and impact modules own the flight. The spans a shot crosses
belong with them.

## What it changes

- `packages/game/domain/combat/material-intervals.ts` holds the rule: order
  the clipped intervals of one object, merge the ones that overlap or touch,
  and turn the merged spans into the events the flight reads.
- `packages/game/projectile-cover.js` keeps tracing the shot across the map
  and collecting the intervals, and now calls the domain to decide the spans
  and their events.

The spans and the events do not change: the same cover stops the same shots.

## Tests

- `packages/game/domain/combat/material-intervals.test.ts` covers the rule:
  intervals that do not overlap stay separate, overlapping ones merge, ones
  that only touch merge, the merged span reaches the furthest exit, and each
  span produces the entering and leaving events with the same order.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.64` to `0.2.65`.
