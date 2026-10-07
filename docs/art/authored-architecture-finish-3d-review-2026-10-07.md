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

Six focused proposal checks pass. They compare recipes with the live source components, verify shader encode/decode order before native lighting, verify role cache separation and shared textures, compare unchanged geometry and metric UVs in 112 actual template/orientation/disclosure states, preserve retained props and unpainted legacy selection, and verify explicit saved paints through four rotated legacy terraces. The combined affected architecture, door and surface gate passes 71 checks in 5.79 seconds. A separate before/after proposal benchmark also compares these 112 states with the released renderer and finds identical geometry, UVs, normals, opening records and vertex illumination data. The complete copied proposal passes TypeScript. The proposal has no live visual acceptance yet and is not a release claim; the shared renderer and material source remain unchanged pending the separate source commit and browser comparison.
