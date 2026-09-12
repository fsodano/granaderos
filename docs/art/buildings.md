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

`web/app/TacticalBuildings.tsx` projects each roof tile onto the roof slope.
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
