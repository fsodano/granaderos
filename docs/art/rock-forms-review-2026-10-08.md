# Uneven terrain rocks

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Terrain stones now use three cached forms with unequal shoulders and broken
tops. The larger blocked rocks show the change clearly at normal scale.
The smaller natural stones show quiet variation, with clearer facets at 2x.
The old generic rock remains exact for rubble, props and hearths.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/rock-forms-before-44.jpg) | [After](tactical-reference-2026-10-08/rock-forms-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/rock-forms-before-88.jpg) | [After](tactical-reference-2026-10-08/rock-forms-after-88.jpg) |

These live pairs use the same fixture, camera, paused daylight and zoom.
The 2x view clips the guard's head and serves as terrain evidence.
The [native pairs](tactical-reference-2026-10-08/rock-forms-native-pairs.png)
cover all three forms at natural and blocked scales from front and rear.
Those projections do not establish browser lighting or occlusion.

The terrain fixture adds three blocked rocks and three mature trees. It keeps
all roads and the existing unblocked stone patch exact. Ordinary orders move
the guard from I9 through J10, K11 and M11 to
[O11](tactical-reference-2026-10-08/rock-forms-movement.jpg).
[The canopy fades at K11](tactical-reference-2026-10-08/rock-forms-canopy-movement.jpg).
Each order completes, and the pause control becomes available again.
The browser reports no errors. No simulation randomness, path, visibility,
save, input order or obstruction record changes.

## Cost and checks

Each rock retains 12 connected corners and 20 oriented faces. A two-rock cell
keeps 40 triangles and 5,280 merged attribute bytes. The three additional cached
position, normal and UV buffers use 5,760 typed-array bytes in total.
There are no new material batches, textures or shader operations.
The original axis extrema, convex plan footprint, instance transforms,
elevation, burial depth, obstacle height, UVs and light rules remain exact or
bounded as recorded in the geometry receipt.

In the native 44-pixel projection, natural stones measure 17.20–17.33 pixels
wide and 6.40–6.80 high. Blocked stones measure 31.78–32.15 wide and
25.90–27.70 high. The projection doubles at 88 pixels.

Live before and after counts match. Normal scale reports 68 draw calls,
122,776 submitted triangles, 69 geometries and 40 textures. Close scale
reports 62 calls, 178,132 triangles, 62 geometries and 25 textures.
One actor is loaded, with none pending. Both final views and completed movement
report 120.0 FPS, about 8.33 ms mean interval. These short display readings
do not measure GPU time or sustained performance.

The final private quick gate passes 6,808/6,808 tests across 893 selected files,
with no failures, skips or cancellations. The four-worker run takes 2,476.886
seconds. Typecheck and production build pass, with 1,377 export files and
1,045 verified asset references. All 10,411 non-document inputs, the engine
gitlink pin and production source identity `6ed8a6fbe679` match the ordered
root candidate exactly. Private and root Git revision metadata differ.
Root docs, links, visual records and diff checks pass separately. The
[review receipt](../../artifacts/rock-forms/review-receipt.json)
records final input hashes, source identity and gate results.

```sh
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
