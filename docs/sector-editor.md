# Web sector editor

Open `/editor` from **Constructor de sectores** on the title screen. Run the app
with `npm ci --prefix web` and `npm run dev`. The editor runs in the browser;
there is no desktop editor or account requirement.

## Create a sector

1. Open an existing sector, or enter dimensions and choose **Nuevo mapa**.
   Maps can contain 4–64 tiles on each axis.
2. Select terrain and use a brush, rectangle or fill. **Generar terreno** uses a
   numeric seed to distribute the selected terrain over 15% of cells.
3. Drag a house or furnished template onto the map. **Dibujar edificio** creates
   a rectangle. Use **Tabique** to draw partitions. Place doors and windows on
   existing wall cells. Use **Quitar pared** to join rooms.
4. Select **Interiores**, **Exteriores**, or **Habitación activa**. Place furniture
   on the grid. Beds occupy two tiles. The inspector can change names, positions,
   material and dimensions. Rotation turns the building and its contents together.
5. Place supplies, player/enemy/civilian starts, exits and lights. An item's
   container field can attach it to a chest. It then follows the chest.
6. Use **Obstáculos** to see blocked cells in red and door approaches in gold.
   **Medir ruta** checks walking space from a clicked tile; green is reachable.
   Validation reports explain rejected edits. Locked doors produce warnings;
   route checks assume doors can be opened.
7. Add a player start and choose **Probar mapa**. This creates a disposable battle.
   **Volver al editor** returns to the authoring document without battle changes.
8. Choose **Exportar**, then **Descargar JSON** or **Copiar JSON**. **Importar**
   opens a map or building template. The export panel includes the complete JSON
   as selectable text for browsers that restrict downloads or clipboard access.

Select with a click. Use Shift to select several objects. Drag to move, or use
arrow keys. The inspector supplies rotate, duplicate and delete actions. Delete
and Backspace remove the selection. Ctrl/Cmd+Z undoes a transaction;
Ctrl/Cmd+Shift+Z redoes it. Escape or a drop outside the map cancels a gesture.
Use Alt+drag, the middle mouse button, or **Desplazar** to pan. Zoom controls and
**Centrar** change only the view. Layers can be hidden or locked.

A building owns the objects inside its bounds during group transforms. Moving,
rotating, duplicating or deleting it includes those objects. Locked child layers
prevent a transform. Templates expand into independent objects with new IDs.
Select a building to export it as a template. Ten furnished templates are bundled: posta, barracks, rural house, rural chapel,
parish church, cabildo, pulpería, storehouse, smithy and stable. The church has a
central aisle and a separate sacristy. Building kinds supply distinct facade
details, tied to the entrance so they follow rotation. The inspector can change
the kind independently of the layout. Bell structures and other tall facade
details cut away with the interior view.

These are game-scale types, not measured replicas of named monuments. Historical
references include the [rural church at Chamical](https://www.argentina.gob.ar/cultura/monumentos/capilla-san-francisco-chamical)
(single nave, adobe, clay tiles, bell gable) and the
[Cabildo of Jujuy](https://www.argentina.gob.ar/capital-humano/cultura/monumentos/cabildo-de-jujuy)
(adobe, tiled wooden roof and central tower). Later additions described in the
heritage records are not used. The cabildo remains a playable single-floor
abstraction; no second-floor navigation is implied.

The browser stores one local recovery draft. Recovery is explicit after reload.
Export important work to a file; local storage is not a project database. Opening
another sector does not save it into the repository. To change a shipped sector,
replace its JSON file under `game/maps/`, validate, and rebuild the game.

## Script editing

Browser tools and Node scripts share `applyMapCommands`. A command batch either
passes validation in full or returns the original document. IDs remain stable.
An optional expected revision rejects stale writes. Undo and redo also advance
revisions.

```sh
node tools/edit-map.mjs new /tmp/sector.json
node tools/edit-map.mjs validate /tmp/sector.json
node tools/edit-map.mjs apply /tmp/sector.json /tmp/commands.json /tmp/updated.json
node tools/edit-map.mjs validate /tmp/updated.json --playable
```

Example `commands.json`:

```json
{
  "expectedRevision": 0,
  "commands": [
    {"type":"paintTerrain","cells":[{"x":2,"y":3}],"terrain":"road"},
    {"type":"addBuilding","building":{"id":"posta","x":5,"y":4,"width":6,"height":6}},
    {"type":"addObject","layer":"spawns","object":{"id":"entry","side":"player","x":1,"y":1}}
  ]
}
```

Other commands include `moveObject`, `rotateObject`, `transformSelection`,
`duplicateObject`, `deleteObject`, `setObject`, `setMetadata`, `resizeBuilding`,
`setWall`, `setDoor` and `stampTemplate`. See `game/map-commands.js` and
`tests/map-editor.test.mjs` for argument examples. `seededTerrainCommands` in
`game/map-editor-tools.js` provides deterministic generation.

## Format and runtime boundary

Version 1 stores base terrain, features, buildings with wall cells and room
identity, furniture, supplies, spawns, exits and lights. The compiler derives
room connectivity, floors and collision tiles. Unknown format versions and
malformed files are rejected before use. All 15 original sector definitions
were migrated into JSON; reference hashes test their compiled geometry,
props, lighting and decoration against the pre-migration output.

Walls occupy full cells. Thin wall art does not change collision. Roofs use the
building footprint, with clipped sections for revealed rooms. Exterior and
interior views share one map. Colonial limewashed adobe/stone, clay roof tiles,
wooden doors and shutters match the existing historical setting.

Campaign snapshots retain their original geometry and source map revision.
Editing a base map does not rewrite an active saved sector. Multi-floor maps,
wall-edge collision, terrain elevation, shared editing and live save migration
remain outside this version.

## Verification

Automated coverage includes migration hashes, atomic edits and stale revisions,
map round trips, whole-building and group transforms, room partitions, doors,
furniture routes, templates and container references, playtest isolation,
malformed bounds, pointer projection, generators, CLI file protection and save
re-entry. Renderer tests cover full and partial roofs, wall direction, corner
geometry and two-cell furniture.

Browser checks covered import, draft recovery, drag placement, invalid placement,
undo/redo, rotated furniture, playtest movement, return without authoring changes,
and the JSON export panel. The in-app browser did not report a download event;
the complete exported JSON was verified through the export field.

A local Node sample on 2026-09-06 used a 64×64 map with 36 buildings. A single
36-building command batch took 44.5 ms; ten-run means were 7.2 ms to compile and
12.9 ms to validate. These measure map logic, not browser frame rates. The SVG
renderer remains suitable for the current sector sizes; dense large maps may
need more rendering work.
