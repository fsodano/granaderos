# Soft bedding

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

The bed now has a rounded mattress and pillow, broad blanket folds and one
hanging edge. The paired house views show a softer outline beside the guard.
The hem is clearer close up. Fine folds remain quiet at normal tactical scale.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/soft-bedding-before-44.jpg) | [After](tactical-reference-2026-10-08/soft-bedding-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/soft-bedding-before-88.jpg) | [After](tactical-reference-2026-10-08/soft-bedding-after-88.jpg) |

Both scenes use the expanded house, initial guard position I7 and the default
camera. The before views are paused at 12:02; the after views are paused at 12:01.
They do not establish an exact clock or animation phase match. The before scene
is the accepted timber candidate. The after copy is byte exact to the fixed
private bedding candidate.
The browser reports no errors. Character assets and equipment remain exact.
An ordinary I7→H7 order completes with the guard
[beside the mattress](tactical-reference-2026-10-08/soft-bedding-movement.jpg).

The original seven frame parts, floor contact, horizontal footprint, all four
rotations and maximum bed height stay exact. Two support rails close the old
0.175 m gap between the platform and mattress. The mattress retains its 0.12 m
thickness. The authored gameplay obstacle height remains authoritative.

## Blanket contact and cost

The first private blanket trial showed pale cutouts in the live close view.
Whole-triangle checks found up to 7.604 mm of penetration into the mattress.
That trial was rejected. Its quick run stopped; it is not reported as a failed
or completed suite. The final shape lifts only depressed top-sheet vertices
to at least 2 mm in local Y. The hanging hem, triangle order, maximum fold,
mattress, pillow and frame remain exact.

All 168 supported footprint, height, elevation and rotation variants now have
positive separation over the full triangle overlap. Minimum measured clearance
is 1.238 mm; at default height it is 2.000 mm. The regression checks affine
vertical gaps at every vertex of clipped overlap polygons from final merged
float32 triangles. It rejects the old penetrating shape. The correction adds
no geometry or material batches.

A bed changes from 120 to 420 triangles and retains three material batches.
The three cached soft forms use 108, 108 and 96 triangles. Existing frame parts
use 84 triangles; new support rails use 24. The seven-prop fixture changes from
3,852 to 4,152 triangles and retains six batches. There are no new textures.

The live normal and close views each add 300 submitted triangles. Draw calls,
geometry and texture counts stay exact. One actor is loaded, with none pending.
Short settled display readings are about 120 FPS; they do not measure GPU time
or sustained performance.

The corrected focused checks pass 38 tests in 1.711 seconds. The final standard
quick run passes 6,831 tests across all 897 selected files, with four workers and
no filters. It takes 2,525.786 seconds. No tests fail, skip or cancel. The standard
selection excludes eight of 905 discovered files. Corrected typecheck passes in
10.720 seconds and production build passes in 17.418 seconds; those passes are
retained without repeat. The build verifies 1,377 output files and 1,045 asset
references. Node v25.1.0, npm 11.6.2 and Python 3.9.6 are pinned.

The [input seal](../../artifacts/soft-bedding/input-seal.json) proves unchanged
paths and bytes for all 10,417 regular non-document source, test, runtime and asset
files plus one engine gitlink: 10,418 input entries. It also verifies the engine
initialization state, 42,461 installed dependency files, runtime files and
production output. The build source is
`88ad57daef746bcdb71fd596f4512079bbc09dbd8c07ca8c7e69e45afa33c094`.
The [read-only comparison helper](../../artifacts/soft-bedding/verify-final-equivalence.py)
supports an optional strict dependency and runtime check. The
[root comparison](../../artifacts/soft-bedding/root-equivalence-proof.json) passes
with that strict check. Root docs, photos and revision labels receive separate checks.

The [review receipt](../../artifacts/soft-bedding/review-receipt.json) links
geometry, full overlap checks, counters, source proof and final gate results.
