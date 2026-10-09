# Broken leaf silhouettes

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Trees and scrub now use open, folded leaf groups with gaps. The matched live
views show a less solid outline at normal and close scale. Trunks, forks,
root positions, seeded lobe transforms, tree bounds and poplar proportions
stay exact. Every leaf tip uses an old hull corner. Folded sides stay within
the old convex crown envelope.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/leaf-sprays-before-44.jpg) | [After](tactical-reference-2026-10-08/leaf-sprays-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/leaf-sprays-before-88.jpg) | [After](tactical-reference-2026-10-08/leaf-sprays-after-88.jpg) |

These pairs use the same terrain fixture, camera, paused daylight and zoom.
The before scene is the accepted rock candidate. The after preview is an exact
copy of the private final leaf candidate; its input receipt links it to the
gated source. The close view clips the guard's head and serves as terrain evidence.

Ordinary orders move the guard from I9 through J10, K11 and M11 to
[O11](tactical-reference-2026-10-08/leaf-sprays-movement.jpg).
The canopy fades at K11 in both the
[before](tactical-reference-2026-10-08/leaf-sprays-before-canopy-movement.jpg) and
[after](tactical-reference-2026-10-08/leaf-sprays-canopy-movement.jpg) views,
then restores at O11. Each order completes. The browser reports no errors.
Existing same-level actor fade, admission, material keys, roughness, opacity,
depth writing and shadow rules remain in use. No simulation, save, visibility,
obstruction or input-order rule changes.

## Cost and checks

Each old crown lobe used 80 triangles. The three new cached forms use 64, 70
and 70. A measured tree changes from 2,112 to 1,968 triangles; scrub changes
from 320 to 268. Tree merged attribute buffers shrink by 19,008 bytes.
The new primitive buffers add 22,032 typed-array bytes. Old source crowns can
remain cached, for a combined canopy primitive cache of 53,712 bytes.
There are no new material batches or textures.

The native front and rear pairs cover five tree and scrub samples:
[front](tactical-reference-2026-10-08/leaf-sprays-native-front.png),
[rear](tactical-reference-2026-10-08/leaf-sprays-native-rear.png).
Projected foliage gaps measure 22.10–33.45% at 44 pixels and 22.34–32.71%
at 88 pixels. The probe excludes trunks, lighting, alpha accumulation and shadows.
It does not prove live shading or performance.

Live normal-scale triangles fall from 122,776 to 115,456, with 68 draw calls,
69 geometries and 40 textures retained. Close-scale triangles fall from
178,132 to 171,540, with 62 calls, 62 geometries and 25 textures retained.
One actor is loaded, with none pending. Both final views and completed movement
report 120.0 FPS, about 8.33 ms mean interval. These short display-counter
readings do not measure GPU time or sustained performance.

The final private quick gate passes 6,811/6,811 tests across 894 selected files,
with no failures, skips or cancellations. The four-worker run takes 2,470.703
seconds. Typecheck and production build pass, with 1,377 export files and
1,045 verified asset references. All 10,413 non-document inputs, the exact engine
gitlink state, dependency files and production source identity `1be6fd7e6d96`
match the ordered root candidate. Private and root Git revision metadata differ.
Root docs, links, live records and diff checks pass separately. The
[review receipt](../../artifacts/leaf-sprays/review-receipt.json)
records source identity, exact inputs and final results.

```sh
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
