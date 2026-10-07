# Authored architecture finish review — 7 October 2026

The current direct catalogue contains fourteen compiled templates with explicit wall finishes: posta, chapel, palace and pulpería use ochre; house and stable use adobe; barracks, church, cabildo, town hall and farmhouse use limewash; warehouse uses stone; depot and smithy use brick. None of these catalogue states selects a legacy wall colour. The current direct screenshots are in `artifacts/three-gameplay-review/direct-facade-audit/`.

The current authored 2D source uses `architecture-plaster-v2.png`. Its mean encoded RGB is approximately 233/220/192. The native plaster used `buildings/plaster-v1.webp`, whose mean is 164/150/132, plus linear pigment multiplication. This is an asset and compositing mismatch. The native plaster shader already reduced the old diffuse map to 20% for limewash, 30% for ochre and 35% for adobe; it did not use the full map. The posta is explicitly ochre, so substituting a legacy cream/lime finish would conceal the error and change the authored paint.

The source formula is retained from `WallSurface`, `ArchitectureDefs` and `WALL_COLOURS` in `web/app/TacticalArchitectureMaterials.tsx`, and `ArchitectureVolume` in `web/app/TacticalBuildingVolumes.tsx`:

| Surface | Encoded texture overlay | Additional encoded pigment multiply |
| --- | --- | --- |
| Plaster main wall | 85% over its authored palette base | Adobe 48%; ochre 34%; limewash none |
| Stone or brick main wall | 92% over its authored palette base | None |
| Plaster solid ornament or shaft | 36% over its authored palette base | None |
| Stone or brick solid volume | 60% over its authored palette base | None |

The isolated proposal adds an explicit architecture role to the retained material cache. It composites the actual source image and paint in encoded sRGB, then decodes the result before ordinary vertex illumination and physical lighting. Native normal lighting supplies the side shade represented by the flat sprite's palette shadow; that shade is not multiplied into the same face again. Unpainted legacy surfaces and prop materials retain the released assets and shaders. An explicit saved wall paint overrides legacy style colour, matching the current 2D authored-wall rule; legacy height and roof selection remain unchanged. Plaster retains the existing metre repeat, UV origin, UV spacing and 12 mm bump scale. Stone and brick retain their current image, UVs and density. Roof shaders and source finishes are unchanged.

The narrow initial callers are the main building fabric, shared authored architectural details, the posta shaft and the palace facade. The warehouse buttress body keeps its released shading for a separate source comparison. Ground movement cells, doorway dimensions, disclosure, authored roof routes and geometry are unchanged.

Six focused proposal checks pass. They compare recipes with the live source components, verify shader encode/decode order before native lighting, verify role cache separation and shared textures, compare unchanged geometry and metric UVs in 112 actual template/orientation/disclosure states, preserve retained props and unpainted legacy selection, and verify explicit saved paints through four rotated legacy terraces. The combined affected architecture, door and surface gate passes 71 checks in 5.79 seconds. A separate before/after proposal benchmark also compares these 112 states with the released renderer and finds identical geometry, UVs, normals, opening records and vertex illumination data. The complete copied proposal passes TypeScript. These were initial isolated proposal checks. The following clean source review completes the bounded material cut.

## Clean source acceptance

Source `c967345bf352235846fe7fdd5294a639fba53459` passes 87 affected architecture checks in 10.28 seconds, TypeScript, the documentation and baseline audits, and the static game/editor build (`0bd513889feb`, 1,244 files and 1,039 asset references). The ordinary playable catalogue passes 84 browser views across all fourteen current templates: exterior, partial and interior disclosure, with all four rotations represented for each template. No page, console or asset-response errors are recorded. The captures and telemetry are in `artifacts/three-architecture-finish-cut-review/` on the clean review checkout.

The posta, barracks, house, warehouse and depot captures were inspected against the current direct catalogue sprites. The authored ochre, adobe, limewash, stone and brick remain distinct; the former dark legacy-plaster map is removed from the authored plaster walls. Native lighting continues to shade their physical faces. Main wall paint, pier paint and solid-volume paint retain their separate source formulas. The visible source comparison also identifies remaining house front piers/door hood and warehouse buttress paint as separate cuts. This acceptance covers the material correction, rather than final art or complete gameplay.
