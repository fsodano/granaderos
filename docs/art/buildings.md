# Colonial buildings, 1810–1820

The tactical building renderer uses limewashed adobe, jointed stone footings,
clay roof tiles, timber doors, iron window bars, and brick floor joints. These
are interpretations for the campaign period, not measured reconstructions of
individual monuments. The industrial buildings in the supplied visual references
inform the exterior/interior reveal, not the building materials or furnishings.

Historical references:

- [Posta de Sinsacate, national monuments register](https://www.argentina.gob.ar/capital-humano/cultura/monumentos/posta-de-sinsacate): stone walls set in adobe, brick floors, and timber, cane and tile roofs; a post used by the independence armies.
- [Casa Natal de Sarmiento museum](https://casanatalsarmiento.cultura.gob.ar/info/museo/): adobe walls, timber openings and wrought iron window bars.
- [Casa Natal de Sarmiento, national register](https://www.argentina.gob.ar/node/417682): the original 1801 house had an earth roof on poplar beams. Tile roofing is therefore a choice for the game's authored tiled buildings, not a claim that all regional houses had tiled roofs.
- [Cabildo de Buenos Aires, national register](https://www.argentina.gob.ar/node/421639): arcaded civic frontage, a central tower, administrative offices and a council chamber inform the municipal building family.
- [Casa del Virrey Sobremonte, national register](https://www.argentina.gob.ar/capital-humano/cultura/monumentos/casa-del-virrey-sobremonte): a governor's residence with limewashed masonry, clay roof tiles, a formal entrance and rooms arranged around patios informs the palace's colonial treatment.
- [Espacio Virrey Liniers, Buenos Aires heritage service](https://buenosaires.gob.ar/gcaba_historico/cultura/casco-historico/espacio-virrey-liniers): thick walls, large openings and an emphasized main doorway provide further cues for the governor's residence.

`web/app/TacticalBuildings.tsx` projects structural wall segments from the map.
`web/app/TacticalRoof.tsx` builds gable, hip and shed roofs from plane geometry.
`game/building-profile.js` supplies the wall height, roof rise, eave depth and
plinth height for each building type. The first exterior door defines the front
of the building. The roof, tower, porch and other details follow that frame when
the map commands rotate a building. These visual dimensions do not change the
collision cells.

Wall planes use raster plaster, stone, brick and timber patterns. Wall samples
continue along a facade instead of restarting on every tile. Roof planes map
clay or thatch rasters through a plane-specific affine transform. Course lines
therefore follow the roof slope, with parallel spacing. Directional face shading
and structural edges remain vector geometry. Ridge caps, fascia, gables and
eaves close the shell. `web/app/TacticalBuildingVolumes.tsx` applies the same
material treatment to tower, porch, chimney and buttress volumes.

The six `web/public/art/architecture-*-v2.png` files are 512 × 512 PNG materials.
Generation prompts and resize provenance are in
`docs/art/architecture-materials-v2.json`. The served art manifest records each
file's dimensions, byte count, SHA-256 and provenance reference. The build checks
the six dynamic filenames, PNG dimensions and checksums with
`tools/verify-tactical-assets.mjs`. Tests also render the wall and roof definitions
to confirm that every emitted material URL belongs to that build contract.

Revealing a room removes only that room's roof. Adjacent front wall segments,
doors and windows reduce to low masonry and thresholds. Internal partition
segments also lower when either adjacent room is revealed. Back exterior walls
stay full height. Floor joints and perimeter shadows appear only in revealed rooms.
At wall junctions, diagonal room contact also reveals the joining segments. Once
all rooms are revealed, front and internal solid corners lower even if they have
no adjacent floor cell, as at the reserved parish tower foundation.
Lighting, structural tile collision, door state and reveal rules are preserved.
Furniture now has separate movement footprints: new beds occupy 1×2 cells and
other authored props occupy 1×1. Placement preserves connected walking space and
door approaches. See `game/props.js` and `docs/plans/sector-builder.md`. All architecture remains transparent to pointer events.

Generate exterior and interior images from the real React scene:

```sh
node tools/preview-buildings.mjs
```

Outputs: `assets/previews/buildings/exterior.png` and `interior.png`.
These are deterministic renderer checks, not browser interaction recordings.

Validation includes `tests/building-render.test.mjs`, the existing building and
visibility tests, TypeScript checks, and the production build.

## Catalog redesign review

The user selected the **town parish (B)** as the direction for the church. The
retained reference attachment is labeled **rural parish (A)**. Its rough warm
limewash, exposed stone base, dark timber and rounded clay tiles also establish
the material treatment. The town church must keep its own square bell tower and
shaped facade. Other buildings share this material treatment, with their own
proportions, roof shapes, entrances and functional details.

The catalog contains twelve distinct tile footprints and furnished layouts:

| Template | Footprint | Exterior form | Interior use |
| --- | --- | --- | --- |
| Posta colonial | 6 × 5 | Hip roof and veranda with masonry piers | Rest, table and stored supplies |
| Barraca de granaderos | 8 × 6 | Low gable, gate pilasters and military shield | Three beds and a common table |
| Casa rural | 6 × 6 | Hip roof, domestic chimney and timber lintel | Family bed, table and chest |
| Capilla rural | 5 × 8 | Modest gable and bell gable | Altar and two benches |
| Iglesia parroquial | 9 × 12 | High nave, square bell tower, shaped facade and buttresses | Nave, altar, benches and separate sacristy |
| Cabildo de villa | 11 × 7 | Hip roof, arched arcade and clock cupola | Separate clerk and council rooms |
| Pulpería | 8 × 7 | Timber porch and hanging trade sign | Counter, stores and seating |
| Almacén de abastos | 8 × 8 | Stout gable, buttresses and loading canopy | Barrels, chests and fodder with clear aisles |
| Herrería | 7 × 6 | Shed roof, brick forge chimney and awning | Workbench, water and tools |
| Caballeriza | 10 × 6 | Gable, timber facade frame and loft louvres | Four fodder stations and water |
| Ayuntamiento | 12 × 9 | Formal entrance columns, clock pediment and civic finials | Separate secretary, archive and council rooms |
| Palacio del gobernador | 14 × 11 | Broad tiled portico, formal pediment and masonry pilasters | Reception, private office, governor's chamber and guest chamber |

The ayuntamiento is the larger municipal template. Its three-room plan differs
from the smaller two-room cabildo. The palace is a compact governor's residence
with a broad reception room and three private rooms. Both are interpretations of
colonial construction, with one playable floor. Their plans do not reproduce
the multi-level layouts or patios of the historical references. Their entrances
remain on perimeter tiles. Columns stand on solid facade cells; the portico
stays shallow enough to keep the entrance and surrounding walking tiles clear.

The parish tower has a reserved 2 × 2 solid corner in the template. It occupies
structural cells, including the one former interior tile at `(1, 10)`. The two
windows within the tower foundation are closed with masonry. The compiler keeps
the nave and sacristy room IDs. This reservation must follow the building through
all four tile rotations. A tower must never cover a tile that a unit can enter.

Generate all review material with the same React renderer used by the game:

```sh
node tools/preview-architecture-catalog.mjs
# Optional output directory:
node tools/preview-architecture-catalog.mjs /tmp/granaderos-architecture-catalog
# Fast iteration: twelve front exterior views only
node tools/preview-architecture-catalog.mjs /tmp/granaderos-architecture-quick --overview-only
# Refresh all 48 interiors; keep existing exterior images and manifest records
node tools/preview-architecture-catalog.mjs /tmp/granaderos-architecture-catalog --interior-only
# Refresh the church and cabildo exteriors in every rotation
node tools/preview-architecture-catalog.mjs /tmp/granaderos-architecture-catalog --buildings=iglesia,cabildo --mode=exterior
# Review the two larger civic buildings, including interiors
node tools/preview-architecture-catalog.mjs /tmp/granaderos-civic-review --buildings=ayuntamiento,palacio
node --test tests/architecture-catalog.test.mjs
```

The default output is `artifacts/architecture-catalog/`, which is excluded from
Git. Open `index.html` to select a building. Each building page has close views
for exterior and interior at 0°, 90°, 180° and 270°. Each view has an independent
SVG with embedded textures and a PNG. The script also writes 48 importable map
documents, `catalog.json` with all twelve buildings, an overview PNG, and a manifest.
All generated map documents include a player spawn for a disposable playtest.
`--interior-only` can also write to a new directory. Its pages then offer only
the four interior rotations. A focused refresh does not prove that retained
exterior views match the new renderer; use the full command for final acceptance.
`--buildings` accepts comma-separated template IDs. `--mode=exterior` and
`--mode=interior` select one mode across all four rotations. Targeted runs keep
other view files and their prior manifest records in an existing output folder.

The automated catalog checks cover each template in every rotation. They prove
that every unoccupied interior tile can be reached from outside when the doors
are opened, that closed entrance doors block those routes, and that furniture
has an accessible side. They also check exact round-trip rotation and movement,
stable room and door IDs, independent template copies, and the tower foundation.
They do not establish visual quality.

Use these acceptance gates for human review of the rendered files:

1. Plaster, masonry and timber have restrained texture, edge wear and directional
   light consistent with the selected parish. Avoid a flat, repeated pattern.
2. Roofs show rounded courses, a ridge, thick eaves and contact with the walls.
3. Towers, porches, chimneys and arcades have visible depth and sound joins.
4. Every building is recognizable by its silhouette and use, not only its color.
5. All four rotations are free of floating details, wall gaps, impossible
   intersections, incorrect depth order and clipped roof details.
6. Full and partial interior revelation preserve the tile structure, furniture
   footprints and usable walking space.

Review every close view at a useful size. A contact sheet is only an index and
cannot prove that the geometry or material treatment is correct.

The original ten template exteriors and interiors were reviewed across all four
rotations (80 rendered views). The town hall and palace also passed exterior and
interior review in all four rotations (16 additional views), including the final
clock proportions and palace pediment paint order. The catalog route checks and renderer regressions cover
walking space, object identity, partial roof revelation, partition junctions and
the solid tower corner. Added civic checks also cover named room functions,
minimum-size shells and supports edited into doors or windows. The original
review did not repeat live pointer interaction because the Mac was locked.
No new browser interaction pass is claimed by this renderer review.

Regenerate the catalog after renderer or material changes; an earlier image is
evidence only for the revision that produced it. Use the generated JSON maps in
the editor to inspect partial room revelation and walk through the interiors in
playtest mode.
