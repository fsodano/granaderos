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
