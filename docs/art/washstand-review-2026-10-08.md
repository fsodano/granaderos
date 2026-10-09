The washstand now has a 24 cm pitcher, an open basin with blue water, and a
hanging towel with a broad fold. The complete default model is 1.04 m high. The
0.8 m frame and gameplay obstacle height stay exact. The floor, footprint, frame
vertices, usable sides, four rotations, room admission, saved state and input
rules stay exact. The accepted washstand body is unchanged. The accepted piece 13
blanket clearance correction is in this source.

Root accepted the final source at 44 and 88 px beside the standing guard at H17,
after ordinary H12 to H17 visits with the default camera. Before is paused at
12:03; after is paused at 12:02. Root let the after guard settle with a brief
ordinary resume and pause. The pair does not prove an exact clock or pose match.
The jug, basin water and towel read at close scale and stay quiet at normal scale.
Fine lip and handle edges need close scale. There are no after console errors.

| Scale | Before | After |
| --- | --- | --- |
| 44 px | [Photo](tactical-reference-2026-10-08/washstand-before-44.jpg) | [Photo](tactical-reference-2026-10-08/washstand-after-44.jpg) |
| 88 px | [Photo](tactical-reference-2026-10-08/washstand-before-88.jpg) | [Photo](tactical-reference-2026-10-08/washstand-after-88.jpg) |

The [native cost](../../artifacts/washstand/native-cost.json) is 276 to 864
triangles and four to five combined material batches for a default washstand.
It adds 588 triangles and one existing water material batch. Its calculated
projection sizes are offline facts; the four photos above are root live captures.

| Live counter | Normal before → after | Close before → after |
| --- | --- | --- |
| Draws | 108 → 109 | 84 → 85 |
| Triangles | 65,836 → 66,424 | 122,734 → 123,322 |
| Geometries | 108 → 109 | 101 → 102 |
| Textures | 43 → 43 | 28 → 28 |

The [before metrics](../../artifacts/washstand/before-metrics.json) and
[after metrics](../../artifacts/washstand/after-metrics.json) have one loaded
actor, none pending, and no effects. The counters include resources retained
after zoom changes. Short FPS readings are near 120; they do not prove sustained
performance.

The final affected checks pass 45 tests in six files in 2.856 seconds. Typecheck
passes in 12.635 seconds and production build in 19.613 seconds. The build has
1,377 output files and checks 1,045 asset references. One standard quick run
passes 6,838 tests in all 898 selected files, with four workers and no test name
filters, in 2,653.436 seconds. No tests fail, skip or cancel. Eight extended files
are outside the standard quick selection. Node 25.9.0, npm 11.12.1 and the actual
generic Python 3.9.6 subprocess are pinned in the [gate receipt](../../artifacts/washstand/gate-receipt.json).
The old piece 14 quick was stopped when its bedding prerequisite was rejected.
That stopped run is preserved and is not this final gate.

The [input seal](../../artifacts/washstand/input-seal.json) proves exact source,
assets, dependencies, engine state and production source. Final source:
`6d2c831742b358edcec58e70468c2d271a10cd17b1580c6c9a9288ffbf78ed77`.
The [root comparison](../../artifacts/washstand/root-equivalence-proof.json)
passes for all 10,418 regular runtime, test, asset and configuration inputs plus
the engine gitlink, with strict dependency equality. The
[portable helper](../../artifacts/washstand/verify-equivalence.py) supports
`--root PATH --include-dependencies` and an optional production build-info path.
Root docs, photos and revision labels receive separate checks.

The [review receipt](../../artifacts/washstand/review-receipt.json) records live
acceptance and limits. The [fixed source proof](../../artifacts/washstand/fixed-washstand-source-proof.json)
keeps the accepted washstand body exact. The three-file patch follows corrected
piece 13; its [UTF-8 wrapper](../../artifacts/washstand/piece14-washstand.patch.json)
preserves decoded bytes and SHA. The [delivery plan](../plans/tactical-reference-graphics.md) records the PR and merge state.
