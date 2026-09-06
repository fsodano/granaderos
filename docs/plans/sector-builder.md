# Sector builder implementation plan

Status: implemented as the web editor at `/editor` in the dedicated feature worktree.
See [the editor guide](../sector-editor.md) for controls, file workflows, limits
and verification evidence. The sections below preserve the design rationale.
The actual source format is version 1; unknown versions are rejected. All 15
existing sector definitions are migrated and tested against reference hashes.

## Recommendation

Build a dedicated React editor in this repository, with the same isometric scene
renderer and map rules as the game. Store maps as versioned JSON documents. Put
all changes through a pure command API shared by the editor and Node scripts.
Start with one complete import/edit/playtest/export workflow, then add tools.

This gives the editor an accurate view of roofs, room cutaways, furniture
footprints and movement. Reuse the renderer, but extract a read-only scene surface
from its battle HUD and selection handlers before embedding it in the editor.
Do not build an independent drawing system with separate collision rules.

## Shared data and compilation

Use this pipeline:

```text
Drag, paint, inspector edit ─┐
                           ├─> map commands -> validated MapDocument -> compile -> game
Node script or generator ───┘                         │
                                                      └─> JSON file
```

`MapDocument` is the authoring source. A compiled battle is derived data. Save
files retain runtime state separately. Do not use screenshots, SVG coordinates,
or a saved battle as the authoring format.

Implemented files:

- `game/maps/<sector-id>.json`: one authoring document per sector.
- `game/map-schema.js`: validation, schema versions and migrations.
- `game/map-commands.js`: pure, transactional editing operations.
- `game/compile-map.js`: deterministic conversion to existing tactical structures.
- `game/map-catalog.js`: allowed terrain, materials, furniture and item definitions.
- `game/map-templates/`: versioned building and terrain templates.
- `web/app/editor/`: editor route, tools and inspectors.
- `tools/edit-map.mjs`: validate, apply command files, and export from Node.

Use plain JavaScript modules for shared rules, consistent with this repository.
A JSON Schema can supply external tool validation and editor field descriptions.
Choose one authoritative schema and derive other validation metadata from it.

The map document needs:

| Data | Ownership and purpose |
| --- | --- |
| `schemaVersion`, `id`, `revision` | Format migration, stable identity, conflict detection. |
| `width`, `height` | Integer cell bounds; begin with existing sector sizes. |
| `terrain` | Base terrain per cell: grass, earth, roads, water, stone. |
| `features` | Trees, rocks, scrub and other features with catalog IDs and footprints. |
| `buildings` | Footprint, material, roof, room cells, wall cells and openings. |
| `props` | Stable ID, catalog type, tile anchor, footprint and room membership. |
| `items` | Ground or container contents; item ID, quantity and initial condition. |
| `spawns`, `exits`, `lights` | Initial entity placement, sector connections and lighting. |
| `metadata` | Title, description and optional historical notes. |

The layers are logical data layers, not independently editable copies of the
same geometry. For version one, preserve the game's current **wall-cell** model:
a wall occupies a whole movement cell even though its art is thin. Do not introduce
walls on tile edges at the same time as the editor. That would require movement,
sight, doors, destruction and save migrations of its own.

Rectangular building tools create wall cells, interior floors and room membership
in one transaction. Partition tools must update room connectivity, doors and
roof sections together. Each cell has at most one room. Exteriors and interiors
are views of the same building, not two independent images or maps.

Base terrain remains stored under buildings. Removing a building can therefore
restore the original ground. The compiler combines terrain and structures;
furniture occupancy stays a separate derived layer. Movement blocking, sight
blocking, cover and decoration must remain distinct properties.

All placed entities have stable string IDs. Generate an ID once on placement and
retain it on moves and edits. Never identify objects by array position or label.
Sort exported records consistently so source-control diffs remain readable.

## Drag-and-drop workflow

The main screen has an asset palette on the left, the map in the centre, and an
inspector on the right. Player-facing labels use Spanish.

1. Open an existing sector or create a blank grid.
2. Paint terrain with a brush, rectangle or fill tool.
3. Drag a building template, or draw a rectangular building footprint.
4. Place doors and windows on valid wall cells.
5. Switch to interior view and place furniture and items.
6. Turn on the walking overlay and choose a start cell to inspect reachable space.
7. Playtest in a disposable battle, then return to the unchanged editor document.
8. Validate and export JSON.

Use pointer events and pointer capture for tile placement and brush strokes.
Use inverse isometric projection to convert pointer coordinates to grid cells.
Account for zoom and pan before snapping. A drag shows the **entire footprint**,
with a valid/invalid colour and an explanation when placement is rejected.
Provide click-to-place and keyboard movement as alternatives to dragging.

Release outside the map or press Escape to cancel. Treat a brush stroke or
multi-object move as one undo transaction. Include selection, move, duplicate,
rotate, delete, undo/redo and keyboard shortcuts. Rotation is in quarter turns;
rotate footprint dimensions and the rendered geometry together.

Add layer visibility and locking. Offer roof-on, roof-off and active-room views.
Editor visibility is separate from the game's discovered-room state. The editor
must not reveal rooms in a saved campaign just because the author inspected them.

Use the game renderer for isometric preview. An optional top-down grid view can
make room planning easier, but must edit the same document and command API.
Start with current SVG rendering and current map sizes. Profile real large maps
before selecting a different rendering technology.

## Validation and walkability

Reuse `game/props.js` for furniture occupancy and placement. New authored beds
currently have a 1×2 footprint; legacy props without a footprint retain 1×1.
The first editor catalog should expose only asset sizes with accurate rendering.
Do not offer arbitrary stretching of barrel or hay images as custom furniture.

Validate these conditions before applying a placement transaction:

- The full footprint is in bounds and on permitted terrain.
- Solids do not overlap other solids, walls, entrances or initial actor positions.
- Doors and windows belong to wall cells and have valid room connections.
- Furniture fits its room and preserves door approaches.
- Required walking space remains connected and furniture has an accessible side.
- Spawns and required exits are reachable with intended doors open.
- Entity IDs and references are valid; item types and quantities are valid.

Show blocked cells, reserved door approaches, unreachable floor cells and full
object footprints as overlays. Treat deliberate locked areas as explicit design
choices with warnings, rather than silently repairing them. Separate errors
that prevent export from warnings that the author can acknowledge.

Run room flood fills after geometry changes, not on every pointer movement.
Cache compiled occupancy by document revision and preview only the proposed
footprint during dragging. Refresh validation on drop.

The current placement check protects routes in an individual room. The editor
must add whole-sector exits, actor placement and multi-room validation before
claiming that a complete sector is playable.

## Programmatic editing, templates and persistence

Public API:

```js
const result = applyMapCommands(document, [
  {type: 'paintTerrain', cells: [{x: 2, y: 3}], terrain: 'road'},
  {type: 'moveObject', id: 'barracks-bed-01', x: 8, y: 5},
  {type: 'setDoor', id: 'barracks-front', open: false, locked: true},
], {expectedRevision: document.revision});

// Either all commands succeed, or the original document is returned with errors.
const battleMap = compileMap(result.document);
```

The UI and scripts call this same API. Undo restores the previous values for the
whole command batch. File imports are validated before replacing the current
document. Map files contain data only; never execute code embedded in JSON.
Generators take explicit random seeds so their output is reproducible.

A template initially expands into ordinary map entities with fresh IDs and an
optional template version reference. Editing the template does not silently
rewrite existing sectors. A later explicit upgrade can show an affected-object
diff. Rotation and translation must transform room cells, wall openings, props,
items and local references together.

For the first editor release, use JSON import/export and local draft recovery.
Keep committed maps under source control. Browser storage is draft recovery,
not the sole copy. Defer shared online editing until it is requested.

Runtime changes need a separate boundary: an opened door, breached wall or moved
object belongs to the campaign instance. Keep the existing battle snapshot save
format initially. Record the source map ID and revision. Later, add runtime
patches keyed by stable entity IDs if their smaller size is useful. Never apply
an edited base map automatically to an active save: require a migration or start
a new sector instance. A script that changes a live map must also validate actor
positions and invalidate pathfinding/visibility caches.

## Delivery stages and acceptance checks

1. **Map format and compiler.** Extract one existing sector into JSON, compile it,
   compare its terrain, buildings, doors, props and deployment behaviour with the
   current map. Then migrate the remaining sectors. Keep existing map IDs and
   save behaviour. Acceptance: deterministic round-trip and existing map tests.
2. **First editor workflow.** Import one sector; select and move furniture; paint
   terrain; undo/redo; export; reload; playtest. Acceptance: script and UI commands
   produce identical documents, invalid drops change nothing, export/reload loses
   no data, and playtest does not modify the authoring document.
3. **Building and room tools.** Rectangle buildings, openings, roof/interior
   toggles, partitions and templates. Acceptance: room membership, roofs, collision
   and walking routes agree after move, resize, rotate, duplicate and delete.
4. **Contents and diagnostics.** Items, containers, spawns, lights, exits, selection
   groups, reachability overlays and full validation reports. Acceptance: a sector
   can be authored and played without editing source code.
5. **Automation and hardening.** CLI command files, seeded generators, schema
   migrations, revision checks and larger-map profiling. Acceptance: malformed
   files fail safely, batches are atomic, stale revisions are rejected, and
   generated maps pass the same validation as hand-authored maps.

Build the second stage early after the first format is proven. Do not wait for
all terrain tools or a large asset catalog before testing the full editing loop.

## Explicitly deferred

Multi-floor buildings, free-angle geometry, collaborative editing, terrain
height simulation, wall-edge collision, live campaign hot reload and a new
rendering engine. Reserve format versioning for these; do not implement empty
frameworks for them in the first release.
