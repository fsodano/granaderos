# Coarse poncho surface directions

[Art index](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

This fourth reference piece corrects surface normals on the gaucho poncho at
LOD1 and LOD2. It builds on [PR #308](https://github.com/fsodano/granaderos/pull/308).
The close model and every other character family remain exact.

## Visible result

The coarse poncho had dark bands where reduced inner and outer surface normals
mixed. The correction gives each retained triangle its geometric panel normal.
The bands are gone in the fixed-time standing, walking, rifle aim, crouch and
prone pairs. Flat cloth panels remain visible at close inspection. The result
is a surface correction; it does not change the poncho's width or shape.

| View | Before | After |
| --- | --- | --- |
| Front, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-44.jpg) |
| Front, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-88.jpg) |
| Side, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-side-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-side-44.jpg) |
| Side, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-side-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-side-88.jpg) |
| Rear, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-rear-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-rear-44.jpg) |
| Rear, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-rear-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-rear-88.jpg) |
| Rifle, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-rifle-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-rifle-44.jpg) |
| Rifle, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-rifle-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-rifle-88.jpg) |
| Crouch, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-crouch-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-crouch-44.jpg) |
| Crouch, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-crouch-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-crouch-88.jpg) |
| Prone, nominal 44 CSS pixels / LOD2 | [Before](tactical-reference-2026-10-08/poncho-before-prone-44.jpg) | [After](tactical-reference-2026-10-08/poncho-after-prone-44.jpg) |
| Prone, nominal 88 CSS pixels / LOD1 | [Before](tactical-reference-2026-10-08/poncho-before-prone-88.jpg) | [After](tactical-reference-2026-10-08/poncho-after-prone-88.jpg) |

The live pairs use the accepted `c675edf0` assets and the same camera control
sequence. Browser idle phase can vary. The offline pairs match time, sampled
joints, cloth state, props, camera, skin, light and render settings exactly.
They contain ten pairs and twenty frames for the two affected LODs and five
poses under `artifacts/character-coarse-garment-surfaces/review/`.
One fixed phase per clip does not prove every frame of motion.

The [fixed-time contact sheet](tactical-reference-2026-10-08/poncho-fixed-time-pairs.png)
shows all ten pairs. Its image source is candidate 3. Final seal 6 only changes
receipt metadata; the complete binary chunks and every other GLB JSON field,
including non-receipt extras, are exact. Root verified this equality before installation. The separate
render-data equivalence receipt retains both manifest hashes. Live captures use
the installed seal 6 files. Before publication, seal 7 removes one trailing empty
source line and updates its receipt pin. Its Python syntax tree, complete binary
chunks and all GLB fields outside the three receipt fields remain exact to seal 6.
Three focused preservation checks and strict verification cover that final seal.
The ordinary movement check also confirmed
that the [gaucho reached I5](tactical-reference-2026-10-08/poncho-movement.jpg)
from H5. Eight actors loaded with no pending models or reported browser errors.

## Source and preservation

The source patch runs after the ordinary LOD reduction. It changes poncho
polygon normals and exports only the owned garment. The installer imports the
new geometric normals, duplicates their corners, and retains the original
positions, oriented triangles, UVs, colours and skin weights exactly. Original
binary streams remain intact and the complete previous models restore exactly.
The four existing fold recipes and installers stay unchanged. A narrow checked
adapter gives the gaucho recipe its original connected drape selection, then
maps that selection onto the split corners. Other disconnected cloth still
rejects. The final active colour stream matches the previous model exactly.

Only `gaucho-lod1.glb`, `gaucho-lod2.glb` and `manifest.json` change in the
published library. All maps, other bodies, animation banks, equipment and horse
models remain exact. The vest and shawl fit work stays separate.

## Cost and validation

| Gaucho outfit | LOD1 before → after | LOD2 before → after |
| --- | --- | --- |
| Stored corners | 2,762 → 4,004 | 1,221 → 1,683 |
| Indexed corners | 2,762 → 3,797 | 1,221 → 1,606 |
| Outfit triangles | 3,864 → 3,864 | 1,394 → 1,394 |
| Body drawing parts | 7 → 7 | 7 → 7 |
| GLB bytes | 2,609,192 → 2,919,072 | 774,660 → 906,628 |

The two GLBs add 441,848 bytes. The manifest adds 75,605 bytes. The split adds vertex data, with no extra
triangles, drawing parts or maps. Old inactive attribute arrays remain in the
files for exact restoration. No per-frame work is added. Scene frame-rate
samples are bounded observations, not a sustained frame-rate claim.

The focused correction suite passes five checks, with no failures or skipped
checks (635.1 seconds). It covers complete committed-baseline preservation,
exact active colour/UV/skin streams, actual-source repeat with zero writes,
strict old and current donor checks, three adapter rejections, and 25 coherent
source/receipt/resource rejection cases. Every rejected candidate leaves the
published assets unchanged. The historical family retry passes all 20 checks
with every old golden hash and assertion unchanged.

The native verifier passes 24 appearance LODs, two 334-clip anatomy banks,
26 equipment items and three horse LODs. Typecheck and the production build pass.
Static export verifies 1,377 files and 1,045 asset references. The docs audit and
`git diff --check` pass. The final quick gate passes all 6,775 checks in 887 files,
with no failures or skipped checks (1,196.5 seconds).

The live front counters match the earlier scene at both sizes: 401,591 triangles
and 130 draw calls at 200%; 169,429 triangles and 128 draw calls at 100%. Eight
actors are loaded, with no pending actors. Frame-rate counter samples fall during
LOD loading and settle at 120 FPS in this scene. Local test processes were
running; these samples do not establish a paired or sustained performance result.


```sh
python3 tools/characters-3d/build-coarse-garment-surfaces.py --verify-only
node --test tests/characters-coarse-garment-surfaces.test.mjs
python3 tools/characters-3d/verify-library.py
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
