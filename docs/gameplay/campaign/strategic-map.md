# Geographic campaign map

The campaign chart uses approximate longitude and latitude anchors for the thirteen existing operational sectors. North is up; longitude is scaled at 30° south. Geographic coordinates replace the old display grid axes. Existing sector codes, save keys, travel links, tactical exits, and campaign balance stay unchanged.

## Historical scope

The main chart covers the northern and central campaign theatre, from Humahuaca through Cuyo to the Río de la Plata. The continental Argentina locator supplies full-country context. Its modern outline is explicitly labelled as a reference, not an 1812 boundary. The main chart draws land and waterways without modern internal or international borders.

Cities occupy connected groups of enlarged, selectable district tiles on a shared 18-unit grid. Each city has an outer boundary and visible internal tile divisions. The eight cities cover three or more tiles each; Buenos Aires and Retiro share an urban footprint. Ensenada has its own port footprint. Rural passes remain single tiles. District labels identify approximate functional areas, not surveyed historical neighborhood boundaries. Selection highlights the district and targets its existing operational sector; districts within a sector share control, income, the tactical map. Ensenada remains a separate physical port even though the existing campaign groups it with Buenos Aires for operational loyalty. Uspallata and Los Patos lie west of Mendoza. The campaign's Uspallata sector is anchored at the valley staging area, not a surveyed international pass boundary. San Lorenzo (1813) and the posta of Yatasto (1814) have separate geographic mission markers which select their existing parent operational sectors. No new tactical sectors are implied.

The initial royalist occupations, conquest sequence, income values, routes, city-sector groupings, and dates of facility availability remain game abstractions. They are not a reconstruction of historical control. This is stated on the chart.

Historical reference: [Instituto Nacional Sanmartiniano, chronology](https://sanmartiniano.cultura.gob.ar/noticia/cronologia-sanmartiniana/). Context for Cuyo and El Plumerillo: [Mendoza provincial government](https://www.mendoza.gov.ar/prensa/un-viaje-al-pasado-para-descubrir-los-preparativos-del-ejercito-de-los-andes-2/).

## Bottom controls

The six controls remain directly below the map, left to right:

1. Cities: connected district tile groups, shared city outlines, place and mission labels; selected district, city tile count, loyalty, and operational control.
2. Resources: each sector's current pesos/day and a base/current income table. Current income applies control, damage, blockade modifiers. Values are gross income, not profit after expenses.
3. Squads: soldier counts by current squad location, existing travel links, and the squad management controls.
4. Militia: defenders per location; select a location and use its existing training orders.
5. Horses: organize the existing postas, cart, mule, and flotilla routes; choose transport and travel with the active squad. Individual horse care belongs to the separate gameplay update.
6. Items: recorded ground items in the selected sector, the existing equipment inventory and outfitting controls. Tactical ground loot still belongs to the tactical inventory.

Surface and three disabled depth controls stay at the lower right. No underground simulation is available. All six view buttons expose their pressed state. Map locations support Enter and Space.

## Geographic data

`game/strategic-geography.json` contains only geometry extracted from Natural Earth:

- [1:110m country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson): South American land and the Argentina locator.
- [1:50m river geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_rivers_lake_centerlines.geojson): Paraná, Paraguay, and Uruguay.
- [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/): public domain.

Place anchors are approximate regional display coordinates, not survey data. The Andes band is schematic. The projection's scale bar is approximate across this latitude range.
