# Tactical elevation performance

Measured on 12 September 2026 with Node 25.9.0, macOS arm64 and explicit garbage
collection. These are simulation query timings, not browser frame rates. They do
not establish that the reported browser slowdown or out-of-memory error is fixed.

## Controlled comparison

The baseline is commit `2ffd1c5`. The final experiment adds three changes now in
the integrated source: reject out-of-map surface lookups before fallback scans,
reject out-of-range sight targets before tracing geometry, and reuse indexed
surface records in movement edge checks. The final source for that experiment is `2edf376`, before campaign activation.

Actual Retiro and Tucumán maps each contain 3,072 ground tiles (64 × 48), six
existing operatives and one lamp. Each flat/upper pair shares the same ground,
actors, weather, buildings and props, including the same 6 × 5 test house. Only
30 optional roof cells and one legal climb link differ. Day/night and flat/upper
variants run separately. This comparison predates campaign activation; it does not measure the later
36-house rollout.

Each operation has three warmups, followed by 12 exploration route calls,
16 combat route calls or 24 visibility calls. Each implementation runs in a
separate process. JIT, collection and machine load can affect these measurements.

Median milliseconds per query, with the optional terrace present:

| Sector | Time | Full exploration routes, before → after | Visible tiles, before → after |
|---|---|---:|---:|
| Retiro | Day | 88.426 → 22.572 | 7.334 → 2.131 |
| Retiro | Night | 94.364 → 22.969 | 8.050 → 1.406 |
| Tucumán | Day | 94.099 → 23.645 | 11.533 → 2.533 |
| Tucumán | Night | 94.595 → 24.208 | 11.698 → 1.403 |

Combat route queries changed from 6.6–7.2 ms to 4.6–5.0 ms. Original flat-map
exploration queries took approximately 17–19 ms. A full exploration query still
exceeds a 16 ms frame budget and must not be scheduled for every rendered frame.

## Results and memory checks

For all eight sector/time/floor states, complete serialized reachable routes and
costs, combat routes, visibility including illumination, all-cell detection and
shot previews match across implementations. Hash equality checks full values,
not only destination counts. A separate check confirms 49,392 integer/fractional
line-of-sight results match. Flat and upper states intentionally differ from each
other because the roof changes support and occlusion.

The original bounded snapshot test created, queried, discarded and collected 40
fresh upper snapshots per case. Retained-heap deltas were 0.071–0.185 MB; process
RSS reached approximately 221–232 MB. It showed no accumulating snapshot/index
leak in that run. Temporary heap growth of 57–83 MB during 12–16 route queries is
accumulated garbage and retained outputs, not an allocation count per query.

The checks exclude React, DOM, rendering, browser heap, frame timing and stress
with multiple lamps. They cannot rule out a browser-only leak. Route output still
copies many path arrays; this change primarily reduces CPU work.

## Evidence

- [Baseline timing and output hashes](evidence/tactical-elevation/experiment-baseline.json)
- [Final timing and output hashes](evidence/tactical-elevation/experiment-indexed.json)
- [Baseline direct sight hashes](evidence/tactical-elevation/los-baseline.json)
- [Final direct sight hashes](evidence/tactical-elevation/los-indexed.json)

The timing JSON retains the pinned experimental source commit and variant label.
The final `indexed` variant is the baseline with all three optimizations above;
its `sourceCommit` field identifies the starting archive, not the final repository
commit. The temporary experiment harness and source copies are not runtime code.

## Campaign activation follow-up

The `e597eea` campaign geometry adds 125 upper cells/eight accesses in Buenos
Aires and 120/eight in Tucumán. Retiro retains zero playable roofs. Bounded
six-operative query probes measured approximately 20–24 ms for full reachable
routes and 23–27 ms for the public state projection in those two roof sectors.
These are separate runs, not a controlled before/after comparison.

A local development browser preview of full Buenos Aires completed the night
approach, ascent, equipped torch use, roof crossing and descent. A temporary
requestAnimationFrame observer showed about 120 fps between actions on this
host, but also long frames: the map-reset/movement sample reached 642 ms.
Observed JS heap samples ranged from approximately 78 to 114 MB and later
returned to 82 MB. This bounded observation is not a leak test or proof that
the original slowdown/OOM is resolved. Action and periodic update stalls remain
a performance concern; idle frame rate alone must not be reported as success.

The later [room visibility index](tactical-room-visibility-performance.md) addresses
a measured minimap lookup cost without changing rendered geometry or artwork.
Its controlled server comparison and separate browser observations are recorded
there; action stalls and long-session memory still require further work.
