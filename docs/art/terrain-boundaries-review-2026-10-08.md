# Irregular soil and grass edges

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

This reference piece gives outdoor dirt and grass an uneven shared edge.
It uses the existing dirt, dry-grass and green-grass textures. The soil top and
grass tongue form one flat surface with no overlap or raised decoration.
The seeded profile varies in width, depth and position between cells.

The compact graphics review now includes a valid terrain detail scene. Its road
crossing lies on the eight-cell chunk borders. It also includes natural stone,
paving, mud, scrub, woodland and a raised northern strip. The real Tucumán scene
remains available in the full renderer sandbox.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/terrain-boundaries-before-44.jpg) | [After](tactical-reference-2026-10-08/terrain-boundaries-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/terrain-boundaries-before-88.jpg) | [After](tactical-reference-2026-10-08/terrain-boundaries-after-88.jpg) |

The before views use the same review fixture before the terrain patch. The after
views use the patch, with the same paused time, camera controls and zoom. The
road margins have broad, uneven incursions at both sizes. Paving, mud and the
raised strip retain their former edges. The 2x view clips the top of the guard;
these captures assess terrain. They are not character-shape evidence.

An ordinary movement order takes the guard from I9 to
[J10](tactical-reference-2026-10-08/terrain-boundaries-movement.jpg), across the
soil/grass edge. The order completes and the paused control becomes available
again. The browser reports no errors. No simulation, movement, visibility,
randomness, actor roots or save code changes.

The boundary reads admitted ground records only. Indoor, blocked, missing, upper
and unequal-height neighbours retain the original top. Terrain cache keys now
include neighbouring type, material and room/building membership as well as
height. A changed neighbour rebuilds the affected chunk and disposes its old
geometry. Unrelated chunks keep their existing objects.

## Cost and checks

One eligible edge adds eight top triangles. Four eligible edges add at most
26 triangles per cell. An otherwise dirt-only eight-cell chunk edge adds
64 triangles and one existing grass material batch. A dirt chunk beside both
grass texture types can add two batches. No texture or shader is added.

The live fixture reports 58 draw calls at 2x before and after, with triangles
changing from 170,714 to 171,306. At normal scale it reports 63 draw calls and
115,328 to 115,932 triangles. The visible set differs with zoom. One actor is
loaded and none is pending in each capture. The first normal-scale samples show
109.1 FPS before and 110.0 FPS after, or reported mean intervals of about
9.17 and 9.09 ms. The settled after sample is 120.0 FPS, about 8.33 ms. These are
short display-counter observations during LOD/cache changes. They do not measure
GPU time or establish sustained performance.

All 34 affected terrain, world and fixture checks pass. They cover exact flat
area, disjoint coverage, upward normals, metric texture coordinates, chunk seams,
repeatability, neighbour invalidation, disposal and ordinary fixture travel.
Typecheck and the production build pass. Static export verifies 1,377 files and
1,045 asset references. The final quick gate passes all 6,783 checks in 888 files,
with no failures or skipped checks (866.8 seconds). The docs audit, local links
and staged diff check also pass.

```sh
node --test tests/three-terrain-boundaries.test.mjs tests/three-sector-world.test.mjs tests/renderer-sandbox-fixtures.test.mjs
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
