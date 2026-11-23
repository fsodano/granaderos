# Slice 55: tactical planning rules

This note describes the current ownership and compatibility boundary for the
rules that shape tactical movement orders.

## Domain ownership

[`tactical-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-space.ts)
owns tactical levels (vertical map layers) and whether two points share a
surface. Its sibling
[`tactical-planning-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-planning-space.ts)
owns the point a plan records and the `move` order it produces. The planning
rules preserve a point's coordinates and any named level. When a plan runs in a
map with upper surfaces, the order includes a level even for ground level 0;
flat maps keep the level field omitted. `atHand` also requires points to share
a surface and be within its default range of 1.5 coordinate units.

The point `(3, 4)` in
[`tactical-planning-space.test.ts`](../../../../packages/game/domain/sector-sessions/tactical-planning-space.test.ts)
is fixture data: on a flat map, its move order omits `tacticalLevel`; with an
upper surface present, the order includes `tacticalLevel: 0`. A level already
named by the point is preserved.

## Compatibility boundary

The retained
[`tactical-planning-space.ts`](../../../../packages/game/tactical-planning-space.ts)
re-exports `atHand`, `moveOrder`, and `planningPoint` from the domain module.
Existing game callers keep their import path; the retained module has no second
implementation.

## Behavior covered

The domain tests cover flat and elevated points, preservation of an existing
level, generated order identity and movement options, and hand reach on or
across surfaces.
