# Slice 24: the interior visibility rule into the domain

**Intent:** Move the rule that decides whether a point inside a building is
visible into the domain, next to the other perception rules.

## Why this slice exists

`packages/game/tactical-visibility.ts` holds the rule of interior visibility:
which room a point is in, and whether that point can be seen from where the
observer stands. It indexes the rooms of the map and answers whether a line
of sight reaches inside a building.

The domain already owns perception: `VisibilityPolicy` decides range, posture
and environmental visibility, `IlluminationPolicy` decides how much light
reaches a point, and `KnownSectorPolicy` limits what the player may know
about a sector. Whether the inside of a room is visible is the same kind of
fact and belongs with them.

The module imports no runtime module at all: it reads only the map's own
records.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/perception/interior-visibility.ts` | The rule |
| `packages/game/domain/perception/interior-visibility.test.ts` | Its tests |

## What it changes

- `packages/game/domain/perception/interior-visibility.ts` holds `roomAt` and
  `isInteriorVisible`, with the room index they build.
- `packages/game/tactical-visibility.ts` keeps its module and its exports, and
  becomes a thin re-export of the domain module. The nine files that import it
  keep importing it from the same path.

The rule does not change: the same rooms, the same visibility answer.

## Tests

- `packages/game/domain/perception/interior-visibility.test.ts` covers the
  rule: a point outside any building has no room, a point inside a room
  belongs to that room, a room is visible from the cell that contains it, and
  it is not visible from a cell that the building separates from it.
