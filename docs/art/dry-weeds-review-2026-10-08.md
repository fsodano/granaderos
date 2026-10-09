# Thin dry weeds

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Dry grass and scrub now have occasional bent stems with two joined branches.
Height, lean and spacing vary. Broad bare patches interrupt the stems. Roads,
indoor, building, blocked, upper and green-grass cells stay clear. Both root
edges meet the exact terrain elevation, and every face stays within its cell.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/dry-weeds-before-44.jpg) | [After](tactical-reference-2026-10-08/dry-weeds-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/dry-weeds-before-88.jpg) | [After](tactical-reference-2026-10-08/dry-weeds-after-88.jpg) |

The paired live views use the same terrain fixture, camera, paused daylight and
zoom. They show thin, broken stems, with clearer branches at 2x. Some flat stems
turn edge-on and remain faint at normal size. The 2x view clips the guard's head
and serves as terrain evidence. These small details do not establish full
reference parity. The [native triangle projection](tactical-reference-2026-10-08/dry-weeds-native-projection.png)
is a geometry check; it does not prove browser lighting or occlusion.

An ordinary order moves the guard from I9 to
[J10](tactical-reference-2026-10-08/dry-weeds-movement.jpg). It completes, and the
pause control becomes available again. The browser reports no errors. Seeds
use admitted tile coordinates only. No simulation randomness, path, visibility,
save, input order or obstruction record changes.

## Cost and checks

One stem has six triangles. A decorated cell has one or two stems, with a maximum
of 12 added triangles. In 768-cell geometry probes, dry grass decorates 136 cells
(17.7%), and scrub decorates 183 (23.8%). The mean costs are 1.23 and 1.68 added
triangles per eligible cell. A 64-cell dry-grass chunk adds 90 weed triangles.
Stems use the existing grass batch, opaque double-sided material and illumination.
No material batch, texture or shader work is added. Temporary source geometry is
disposed after its attributes enter the shared batch.

Native stems are 0.297–0.517 m high. A fixed projection beside a 44-pixel actor
gives heights of 6.02–12.89 pixels and maximum root thickness of 0.55 pixels.
The measured projection doubles at 88 pixels. Some views are almost edge-on.

The live normal-scale scene keeps 67 draw calls and changes from 116,130 to
116,382 submitted triangles. The 2x scene keeps 61 calls and changes from
171,492 to 171,738 triangles. Texture counts stay at 40 and 25 respectively.
One actor is loaded, with none pending. The normal-scale capture reports
120.1 FPS; close scale and completed movement report 120.0 FPS (about 8.33 ms
mean interval). These short display-counter readings do not measure GPU time
or sustained performance. The earlier normal-scale baseline includes a LOD
switch and reports 104.9 FPS; it is not a controlled performance comparison.

All 44 affected terrain, world and fixture checks pass. They cover sparse
placement, branch joins, bounds, roots, seeded repeatability, exact tile records,
admission, illumination, shared batches, chunk borders, reuse and disposal.
The private final candidate has passed typecheck and production build, with
1,377 export files and 1,045 verified asset references. Its quick gate passes 6,801/6,801 tests across 891 selected files, with no
failures, skips or cancellations. The four-worker run takes 2,495.935 seconds.
All 10,409 runtime, test, asset and configuration inputs match the root candidate
exactly, including production source identity `744d77cc5983`. Git revision metadata
differs between the private copy and the ordered root branch. Root docs, links,
visual records and diff checks pass separately.
The [review receipt](../../artifacts/dry-weeds/review-receipt.json) records the
source hashes, geometry probe, browser counters and final gate status.

```sh
node --test tests/three-dry-weeds.test.mjs tests/three-soil-fragments.test.mjs tests/three-terrain-boundaries.test.mjs tests/three-sector-world.test.mjs tests/renderer-sandbox-fixtures.test.mjs
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
