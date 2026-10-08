# Civic storey bands

The current town hall and palace sprites have a two-part warm stone band between their floors. The native facade had one 15 cm strip with the generic stone texture. This cut restores the two source stages and their local stone recipe. It keeps the existing upper roof trim.

The source is `civicUpperStorey()` in `web/app/TacticalBuildingDetails.tsx`. Its stone body spans `h - 2` to `h + 4` and projects 0.22 tile. The second stage spans `h + 3` to `h + 5` and projects 0.30 tile. At the current scale, their combined height is 27.93 cm. The outer cap extends 12.58 cm farther than the old strip. Both pieces return 0.12 tile into the supported wall. The body uses `#a99a79` under the current 0.60 stone overlay; the flat cap uses `#c7b795`. Saved wall and roof finishes remain selected by the existing code.

The illustration paints the two visible positive-axis facades. The native model keeps the existing four-facade adaptation. Each band follows real intact wall cells and complete door/window heads. Edited corner shells and unpainted legacy geometry retain their existing fallback. A band part that overlaps a real usable upper cell is omitted; blocked upper cells retain it. The two-floor rule still requires an actual height of at least 4 m. Short slabs, room disclosure, balcony heights, roof routes and movement cells keep their prior behavior.

| Building | Before | After | Current sprite |
|---|---|---|---|
| Town hall | [Before](townhall-before.png) | [After](townhall-after.png) | [Source](townhall-current-sprite.png) |
| Palace | [Before](palace-before.png) | [After](palace-after.png) | [Source](palace-current-sprite.png) |

The before and after captures use the same normal catalogue controls, camera and compiled building. The stone step is now clearer at the ordinary camera scale. The wider building review also checked all 14 current sprites and 28 ordinary native exterior views. The supplied playtest reference archive is a detail/readability guide; its modern JA2 buildings do not define this local colonial facade recipe.

Validation:

- 45 focused and affected checks pass in 8.01 s. They cover both buildings, four rotations, five saved wall paints, metric UVs, day/night light, actual standing door/window rays, altered heights, blocked/usable upper cells, edited corners, short slabs and normal room disclosure.
- TypeScript passes. The old source fails four of the seven new checks; the three opening/fallback/upper-trim checks still pass. The original palace check for a fixed 15 cm strip was updated to the actual source body/cap bounds. Its real balcony support assertion remains.
- A controlled before/after comparison covers 360 compiled states and 9,472 non-band meshes. Geometry, material recipes, world transforms, opening records and disclosure are byte-identical. The shared record hash is `3f473081caa338cf6908e547c6cad3623c23e76fd529bc433d153e668f28af9b`.
- 48 ordinary after views pass with no browser, console or network errors: 24 original roof views, 12 closed 3 m slab views and 12 accessible 3 m roof views. All four rotations and exterior/partial/interior states are represented. Original 0°/90° exteriors were reviewed beside the source, along with disclosed interiors and the edited roofs. Each full exterior adds 56 triangles; the retained non-band geometry is exact.

The wider prototype also copied the source upper plaster cornice literally. Its top is one source unit (3.99 cm) above the wall. That cap emerged through the current pitched eave and produced an extra bright line on the far roof edge. The prototype was rejected. The released upper trim remains exactly at `height - 0.175` through `height - 0.025`, with its original projection and pigment. A source-accurate upper cornice needs a separate physical roof-join adaptation. The rejected images and checks are retained in the private review package. This cut does not claim complete building polish.

`source-bounds.json` contains the actual source points, prior measurements, local finish recipe and limits. Base: `5d584532` (PR #265). No source bank or manifest changes are part of this cut.
