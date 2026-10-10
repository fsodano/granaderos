# Walls between cells

Walls, doors, and windows must occupy a shared cell edge. Both adjacent floor
cells remain available for people and items. A wall blocks crossing its edge,
not standing in either cell.

## Data and geometry

- Runtime scenes store `wallEdges`. Buildings author their segments in `walls`.
- Each segment has a stable ID, integer `x` and `y`, and `axis: x | y`.
- Coordinates identify a grid vertex. Its world position is `(x-.5, y-.5)`.
  An x segment runs one cell east; a y segment runs one cell south.
- A building footprint contains `width * height` usable floor cells. Its outer
  wall follows the footprint boundary. Room membership uses edge flood fill.
- Doors retain their own state. Windows block walking and retain sill cover.
  Damage affects one edge and does not replace an adjacent floor cell.
- Existing map content is converted. Old save compatibility is outside scope,
  as requested by the user.

## Implementation stages

1. Add shared edge helpers and tests. Convert map authoring and compilation.
2. Add edge crossing checks to movement, diagonal corners, civilian routes,
   artillery movement, and contact interactions. Integrate thin edge volumes
   with sight, projectiles, throws, blast shielding, and destruction.
3. Render explicit edge segments in SVG and Three. Align floors, roofs, and
   facade details. Add precise door/wall controls and editor edge selection.
4. Validate focused edge behavior, existing regressions, the full local gate,
   and a visible browser scene. Commit completed stages and open a new PR.

## Main risks and required evidence

- Diagonal motion cannot bypass an edge endpoint.
- A shot from an incident cell cannot skip the adjacent wall volume.
- One thin wall must consume penetration depth once.
- Sight and public presentation must not disclose hidden actors or structures.
- Door and breach changes must invalidate renderer caches.
- Converted partitions must remain attached to the outer wall at T junctions.
- Cell contents, exits, and floor heights remain valid.

The baseline is latest `origin/main`, commit `b5a4a114`. Local full-suite output
is recorded in `/tmp/granaderos-wall-edges-baseline.log` for comparison.
