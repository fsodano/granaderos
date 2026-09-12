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

`web/app/BuildingRoof.tsx` maps continuous material textures onto each roof slope.
Gables close the space above the walls. Corner segments stop at their intersection,
and roofs overhang the walls. Texture variation is deterministic.

Revealing a room removes only that room's roof. Adjacent front wall segments,
doors and windows reduce to low masonry and thresholds. Back walls stay full
height. Floor joints and perimeter shadows appear only in revealed rooms.
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

## Building catalogue and map placement

`game/building-types.js` defines nine construction styles: colonial house,
thatched farmhouse, estancia, church, casa de altos, Cabildo, pulpería,
port warehouse and barracks. Pass `architecture` to `buildBuilding` or
`placeBuilding`; the style supplies the default roof. Explicit roof choices
remain supported. Buildings without architecture metadata retain the house style.

The renderer uses the existing projected geometry, textures and lighting.
Upper floors, arcades, bell/clock towers, balconies, gallery roofs, warehouse
bracing, awnings and thatch fibres distinguish the buildings. These upper floors
and towers are visual details; they do not add playable elevation. Roof details
leave with the revealed room, and front walls still cut away at their openings.

New sector maps assign architecture by location. Buenos Aires has a broader
Cabildo footprint, houses of different heights, churches, streets and stone
pavements. Yatasto uses an estancia; San Lorenzo uses church architecture.
Neighbourhood lots vary in footprint while preserving two-cell spacing,
accessible entrances and the twenty-building town contract. Previously saved
sectors retain their stored plans; start an unexplored sector or a new campaign
to see the new layouts.

The Cabildo uses the double arcade and central tower described in the
[national monuments register](https://www.argentina.gob.ar/node/421639).
Its footprint and bay count are adapted to the tactical grid, not a measured
reconstruction. Rural construction draws on the
[Casa de Pepa Galarza](https://www.argentina.gob.ar/capital-humano/cultura/monumentos/casa-de-pepa-galarza)
and [Posta de Sinsacate](https://www.argentina.gob.ar/node/417345).

Run `node tools/preview-building-catalogue.mjs` for exterior/interior renders of
all nine styles and `assets/previews/buildings/catalogue.png`.
`tests/building-types.test.mjs` verifies that the styles actually occur in campaign
maps, render distinctly, and remove their roof and tower details on entry.

### Revised silhouettes and colours

The second art pass replaces the shared house roof with separate structural
compositions in `web/app/BuildingRoof.tsx`:

- Cream colonial houses: a low terrace, parapet and chimney.
- Earth-coloured farmhouses: compact walls and a thick hipped thatch roof.
- Rose-coloured estancias: a long hipped roof and full veranda.
- Churches: a long nave, shaped entrance pediment and projected bell tower.
- Blue-grey mansions: a roof terrace, balconies and an offset mirador.
- Yellow Cabildo: eleven arcade bays on two levels, continuous balcony,
  central entrance bay and a dark dome, following the user's supplied reference.
- Ochre pulperías: a shed roof, timber veranda and hanging sign.
- Brick warehouses: paired gables, louvres and a loading hoist.
- Sage barracks: a long low roof and two chimneys.

`BUILDING_FOOTPRINTS` gives neighbourhood types different proportions. New
sectors place complete plans, including on coastal lots. The catalogue uses
these same dimensions and a common viewing scale. All tower faces use the same
isometric projection as the walls. The Cabildo's façade renders its actual door
states, and the complete roof composition disappears when its room is revealed.

### Realistic material pass and Pulpería cart

The approved generated originals and generation specifications are in
`assets/source/building-materials/`. `tools/prepare-building-materials.mjs`
packages five material families (plaster, clay, brick, timber, thatch), nine
plaster colour variants, a weathered flat-roof surface, and a transparent cart
into `web/public/art/buildings/`. Source art stays unchanged.

`BuildingMaterials.tsx` declares the textures. Roofs map them through continuous
UV triangles on each actual slope, instead of drawing a coloured checkerboard.
This reduces roof geometry to a few faces. Wall cells use different texture
phases so damage does not repeat at every bay. Recess shading, eave/footing
shading, and ground shadows give the surfaces depth. Warehouses use brick;
barracks use weathered timber; farm roofs use the generated thatch.

`placePulperiaCart` adds a two-cell blocking exterior prop beside a Pulpería when
there is a valid location. Placement excludes doors, adjacent door approaches,
other buildings, furniture and deployed characters. Carts remain visible outside
revealed rooms, use the shared prop collision rules and round-trip through saves.
The renderer sorts entrance carts in front of their owner's broad roof object.

Validation: building/material/render tests, map connectivity and deployment,
large-sector save round trips, snapshot validation, type checks, production
build, and exterior/interior catalogue renders. The catalogue is a static render
of the game scene; it does not claim live browser interaction coverage.

### Building scale relative to people and carts

The approved cart remains 90×60 screen pixels and the soldier drawing size
remains 52 pixels. Architectural heights use a shared 1.6 multiplier in
`game/building-scale.js`: ordinary doors are 48 pixels high and 24 wall units
wide, with taller walls, porches, windows, arcades and towers. Cutaway walls
remain 9 pixels high so occupants stay visible. Surface textures retain their
detail density across taller walls and wider façades. Shed roofs have closed
raised ends, and revealed flooring extends to the wall planes.

New sectors use larger real collision plans and interiors:

| Building | Footprint | Usable interior |
| --- | --- | --- |
| Casa colonial | 6×5 | 4×3 |
| Rancho de campo | 6×4 | 4×2 |
| Estancia | 8×5 | 6×3 |
| Iglesia | 6×7 | 4×5 |
| Casa de altos | 7×6 | 5×4 |
| Cabildo | 11×6 | 9×4 |
| Pulpería | 7×5 | 5×3 |
| Almacén | 7×6 | 5×4 |
| Barraca | 8×4 | 6×2 |

The authored Yatasto estancia retains its larger 8×6 plan. Towns still contain
20 buildings on a 64×48 map, with two-cell clearances and reachable interiors.
Stored sectors retain their floor plans; their buildings receive the new
rendered heights. Fresh sectors receive the larger footprints.

The catalogue includes a standing granadero beside each exterior and another
inside each revealed room. To check selected buildings quickly, run
`node tools/preview-building-catalogue.mjs /tmp/building-preview pulperia cabildo`.
The scale pass also received a live browser check in San Lorenzo, at normal and
enlarged camera zoom, with no browser console errors.
