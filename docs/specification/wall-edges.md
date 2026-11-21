# Cell-edge wall, door, and window format

This specification defines the cell-edge map format (`schemaVersion: 2`,
`wallGeometryVersion: 2`) for walls, doors, and windows in authored physical
maps, templates, and compiled tactical scenes.

## Schema version

Published map documents in `packages/campaign-format` declare `schemaVersion: 2`
(`MAP_SCHEMA_VERSION = 2`). Compiled tactical scenes declare
`wallGeometryVersion: 2` (`WALL_GEOMETRY_VERSION = 2`) and wall segment thickness
`WALL_THICKNESS = 0.12` tiles.

A valid physical map has integer `width` and `height` from `4` to `64` and a
`terrain` array of `width * height` floor/ground tiles. In schema version 2,
`terrain` tiles cannot use structural types (`wall`, `door`, `window`) or carry
`buildingId` or `roomId`; structures live on cell edges in `buildings[].walls`
and `wallEdges`.

## Representation

Walls, doors, and windows occupy the shared edge between two orthogonally
adjacent floor cells rather than an entire cell. Both adjacent floor cells
remain available for characters, furniture, and items. A closed edge blocks
crossing between those two cells without blocking either cell center, and
opening or destroying a segment updates only that edge while retaining both
adjacent floor cells.

- Freestanding exterior segments live in the map's top-level `wallEdges` array
  (`buildingId` omitted or `null`). Building-owned segments live in
  `buildings[].walls` and receive `buildingId` during compilation.
- Each segment has a unique string `id`, integer vertex coordinates `x` and `y`,
  `axis: 'x' | 'y'`, and `type: 'wall' | 'door' | 'window'` (or `'rubble'` when
  destroyed at runtime). When `id` is omitted before normalization, the default
  identifier is `wall:<tacticalLevel>:<axis>:<x>:<y>` (or
  `<buildingId>:wall:<axis>:<x>:<y>` for normalized building walls), and the
  spatial lookup key is `<tacticalLevel>:<axis>:<x>,<y>`.
- Coordinates `(x, y)` identify a grid vertex at world position
  `(x - 0.5, y - 0.5)` relative to integer cell centers:
  - An `axis: 'x'` segment runs one cell east from `(x - 0.5, y - 0.5)` to
    `(x + 0.5, y - 0.5)` and separates cell `(x, y - 1)` from cell `(x, y)`.
    Valid coordinates satisfy `0 <= x < width` and `0 <= y <= height`.
  - An `axis: 'y'` segment runs one cell south from `(x - 0.5, y - 0.5)` to
    `(x - 0.5, y + 0.5)` and separates cell `(x - 1, y)` from cell `(x, y)`.
    Valid coordinates satisfy `0 <= x <= width` and `0 <= y < height`.
- Optional segment properties include `material` (`'adobe'` or `'stone'`),
  `style` (validated against `DOOR_STYLES` for doors and `WINDOW_STYLES` for
  windows), `cover` (`0` to `100`), `blocked`, `blocksSight`, `doorId`, `open`,
  `locked`, `broken`, `keyId`, `lockDifficulty`, `lockIntegrity`, `trap`,
  `obstacleHeight`, `projectileResistance`, `structureDamage`, and `destroyed`.

## Invariants

- **Ground-level placement:** Authored wall edges must sit at ground level
  (`tacticalLevel` and `elevation` omitted or `0`). Upper floors and roof
  terraces use `upperSurfaces` and `climbLinks`.
- **Unique edge identity and position:** Every segment `id` and `doorId` must be
  unique across map layers (`features`, `buildings`, `props`, `items`, `spawns`,
  `exits`, `lights`, `decor`, `rooms`, and `wallEdges`), and at most one segment
  may occupy a given `<tacticalLevel>:<axis>:<x>,<y>` key across both
  `wallEdges` and `buildings[].walls`.
- **Building footprints and ownership:** Each building has integer `width >= 3`
  and `height >= 3` inside the map bounds, providing `width * height` floor
  cells. Buildings cannot overlap each other or terrain features. All segments
  in `building.walls` must lie on or inside the building footprint boundary
  (`building.x <= x <= building.x + building.width` and
  `building.y <= y <= building.y + building.height`, with `x < building.x + building.width`
  for `axis: 'x'` and `y < building.y + building.height` for `axis: 'y'`).
  Top-level `wallEdges` cannot lie inside a building footprint where both
  adjacent cells belong to that building.
- **Room partitioning:** Room membership inside a building footprint is derived
  by orthogonal flood fill across floor cells that are not separated by any edge
  in `building.walls`. Closed and open doors still partition rooms, and runtime
  wall breaches do not rename or merge authored rooms.
- **Doors, windows, and damage:** Doors require a non-empty `doorId` and boolean
  `open` and `locked` flags; in runtime edge records, `blocked` and
  `blocksSight` must equal `!open` unless destroyed. Windows block movement,
  permit sight above the sill, and block rays below sill height.
  Structural damage and breaching modify or destroy the affected edge segment
  without replacing either adjacent floor tile.
- **Movement and corner rules:** An orthogonal step between adjacent cells on
  the same tactical level is blocked if any edge between them blocks movement.
  A diagonal step from `a` to `b` must clear both orthogonal two-step routes
  around the shared corner (`a -> (b.x, a.y) -> b` and `a -> (a.x, b.y) -> b`),
  preventing actors from slipping past an edge endpoint.
- **Sight, projectiles, and public projections:** Line of sight, projectile
  rays, thrown items, and blast propagation intersect thin edge volumes once per
  crossed segment. Public tactical projections (`sceneWallEdges`) expose static
  authored masonry by default and reveal live door state, breaches, or damage
  only when an active player observer has line of sight to that edge.

## Compatibility rules

- `validateMapDocument` accepts `schemaVersion: 1` and `schemaVersion: 2`.
- `parseMap`, `serializeMap`, and `migrateMapDocument` convert schema version 1
  cell-authored walls, doors, and windows into schema version 2 edge records and
  write `schemaVersion: 2`.
- During schema version 1 migration, `normalizeBuildingWalls` maps outer wall
  cells of a building onto its footprint boundary edges, connects internal
  partition cells to that boundary, converts any secondary segment produced at a
  corner opening into a solid `'wall'` so a single corner cell never creates two
  independent doors or windows, recomputes ground-floor rooms via
  `buildingEdgeRooms`, and converts the former wall cells under the building
  footprint into `'floor'` tiles (or `'grass'` tiles for freestanding exterior
  walls). Legacy terrain structural cells hidden underneath a building footprint
  are discarded in favor of the building's edges.
- All 15 authored campaign maps and 14 map templates use schema version 2.
  Compatibility with pre-version-2 campaign saves is outside scope.
