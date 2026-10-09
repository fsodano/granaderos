# Sparse soil fragments

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Outdoor dirt roads and natural stone now have occasional groups of shallow,
uneven chips. The groups leave broad bare patches. Four corners of each chip
meet the exact ground elevation. Existing stone texture, material and roughness
are retained. A darker vertex colour lets the small chips read against pale dirt.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/soil-fragments-before-44.jpg) | [After](tactical-reference-2026-10-08/soil-fragments-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/soil-fragments-before-88.jpg) | [After](tactical-reference-2026-10-08/soil-fragments-after-88.jpg) |

The views use the same terrain fixture, paused time, camera and zoom. Before
views are the accepted terrain-boundary captures. The first chip trial was too
faint at normal scale. The final treatment changes vertex colour only. The
result is a quiet detail at normal size and clearer at 2x. These small marks do
not establish full terrain parity with the reference. The 2x view clips the top
of the guard and serves as terrain evidence only.

An ordinary order moves the guard from I9 to
[J10](tactical-reference-2026-10-08/soil-fragments-movement.jpg). It completes,
and the paused control becomes available again. The browser reports no errors.
Indoor, blocked, upper, paved, mud and non-soil cells receive no chips. Natural
stone keeps its existing larger rocks. No simulation, path, visibility, save or
obstruction record changes. Seeds read tile coordinates only.

## Cost and checks

A decorated cell has two or three chips, with six triangles each. The maximum
is 18 added triangles per cell and one extra existing stone batch per chunk.
The 768-cell geometry probe leaves 599 cells bare and decorates 169 cells
(22%). It adds an average of 2.96 triangles per eligible cell. Fixed projection
beside a 44-pixel actor gives chip widths of 1.67–4.18 pixels and projected
heights of 0.84–1.97 pixels. No texture or shader is added.

The live normal-scale scene changes from 63 to 67 draw calls and from 115,932
to 116,130 triangles. At 2x it changes from 58 to 61 draw calls and from 171,306
to 171,492 triangles. Texture counts stay at 40 and 25 respectively. One actor
is loaded, with none pending. The normal-scale capture reports 109.0 FPS
(about 9.17 ms mean interval); the settled movement sample and 2x capture report
120.0 FPS (about 8.33 ms). These short display-counter readings include LOD and
cache changes. They do not measure GPU time or sustained performance.

All 39 affected terrain, world and fixture checks pass. They cover sparse
occupancy, uneven profiles, triangle bounds, ground contact, upward faces,
repeatability, exact tile records, admitted lighting, exclusions, shared
materials, cache reuse and disposal. Typecheck and the production build pass.
Static export verifies 1,377 files and 1,045 asset references. The final quick
gate passes all 6,788 checks in 889 files, with no failures or skipped checks
(885.5 seconds). The docs audit, eight local record links and staged diff check
also pass. Local metrics and the geometry receipt are in
[soil-fragments evidence](../../artifacts/soil-fragments/review-receipt.json).

```sh
node --test tests/three-soil-fragments.test.mjs tests/three-terrain-boundaries.test.mjs tests/three-sector-world.test.mjs tests/renderer-sandbox-fixtures.test.mjs
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
