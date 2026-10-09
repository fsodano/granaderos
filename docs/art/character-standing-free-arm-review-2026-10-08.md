# Relaxed free arm at standing rest

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Standing characters with a pistol, sabre or knife now lower the free left arm.
The right hand keeps its weapon pose. This gives the small figure a narrower,
more natural rest silhouette. The change uses the existing native unarmed arm
curves, with a bounded lower-arm adjustment for each anatomy. Period clothing,
faces and proportions stay exact.

| Live front view | Before | Final files |
| --- | --- | --- |
| Family equipment, nominal 44 pixels | [Before](tactical-reference-2026-10-08/relaxed-arm-before-front-44.jpg) | [After](tactical-reference-2026-10-08/relaxed-arm-after-final-front-44.jpg) |
| Family equipment, nominal 88 pixels | [Before](tactical-reference-2026-10-08/relaxed-arm-before-front-88.jpg) | [After](tactical-reference-2026-10-08/relaxed-arm-after-final-front-88.jpg) |
| Two pistols, nominal 44 pixels | [Before](tactical-reference-2026-10-08/relaxed-arm-before-paired-pistols-front-44.jpg) | [After](tactical-reference-2026-10-08/relaxed-arm-after-final-paired-pistols-front-44.jpg) |
| Two pistols, nominal 88 pixels | [Before](tactical-reference-2026-10-08/relaxed-arm-before-paired-pistols-front-88.jpg) | [After](tactical-reference-2026-10-08/relaxed-arm-after-final-paired-pistols-front-88.jpg) |

The browser review covers all eight families, front/side/rear views, both sizes,
and pistol, sabre, knife and paired pistols. Camera, light, zoom and stance match;
browser idle phase is not synchronized. Fixed-phase native renders provide the
controlled pose comparison. Each sheet pairs before and after for all families
and all three affected clips. The [full gallery](tactical-reference-2026-10-08/relaxed-arm-gallery.md)
includes the other live angles and equipment views.

| LOD and size | 0.10 seconds | 0.70 seconds | 1.36 seconds |
| --- | --- | --- | --- |
| LOD1, 44 pixels | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-44-phase-1.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-44-phase-2.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-44-phase-3.png) |
| LOD1, 88 pixels | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-88-phase-1.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-88-phase-2.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod1-88-phase-3.png) |
| LOD2, 44 pixels | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-44-phase-1.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-44-phase-2.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-44-phase-3.png) |
| LOD2, 88 pixels | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-88-phase-1.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-88-phase-2.png) | [Pair](tactical-reference-2026-10-08/relaxed-arm-final-paired-lod2-88-phase-3.png) |

There are 288 native pairs and 576 frames. These sheets use the earlier candidate
manifest `dae5b37b`. The final source guard changes receipt metadata only. Complete
render JSON and binary payloads are exact between that candidate and the final
manifest `4a58362a`. Older transition and second-pistol captures also have explicit
render/pose equivalence proofs. These are equivalent visual sources, not captures
of the final file bytes. The fresh `after-final` browser views use final files.

## Motion and limits

The motion review samples 4,392 idle poses and 2,496 production transition poses
through 192 native 120 ms fades. Root, torso, right-hand grip, weapon matrices,
destination clips and clocks stay exact. The surgeon's second pistol remains
visible on its left-hand socket; its relative transform is exact over all 61
idle keys at LOD1/2. It moves with the lowered hand.

Existing crouch entry has hand/legwear contacts. Male entry can add 10–17 triangle
pairs at 110 ms. Female entry can add pairs between 50 and 110 ms, including views
where the baseline already has contacts. The checked production-pose images at
[44 pixels](tactical-reference-2026-10-08/relaxed-arm-root-contact-paired-44.png)
and [88 pixels](tactical-reference-2026-10-08/relaxed-arm-root-contact-paired-88.png)
show no new outside cloth break. Gaucho idle has hidden poncho contact. This is a
bounded visual review; it does not prove that every intermediate surface is free
of intersections.

Ordinary controls complete [crouch](tactical-reference-2026-10-08/relaxed-arm-ordinary-crouch.jpg),
[prone](tactical-reference-2026-10-08/relaxed-arm-ordinary-prone.jpg), return to standing,
and [movement from E5 to E6](tactical-reference-2026-10-08/relaxed-arm-ordinary-movement.jpg)
with paired pistols. The pause control becomes available after movement. The
browser reports no errors. Simulation, AP, ammunition, visibility, saves,
input orders, rifle contacts, unarmed, aim, brace, attack, crouch/prone and paid
action timing do not change.

## Cost and checks

Only nine rotation bindings change in each anatomy bank, across the three standing
idles. Each bank appends 2,928 rotation bytes and grows by 7,448 GLB bytes. The old
binary prefix, full predecessor bank and manifest record restore exactly. All
331 other clips, unowned channels, sockets and the other 226 character files are
exact. No mesh vertices, triangles, drawing parts, textures or runtime code are
added. The manifest grows by 11,200 bytes.

The live family scene retains 130 draw calls and 401,591 triangles at 88 pixels,
and 128 calls and 169,429 triangles at 44 pixels. Normal-scale individual weapon
views also retain their counts. At 88 pixels, pistol and paired-pistol views show
two more draw calls and 896 more submitted triangles despite exact mesh resources;
the cause of that frame-counter difference is not established. Texture counts
stay exact. The final settled paired-pistol normal view reports 120.0 FPS
(about 8.33 ms mean interval), with eight loaded actors and none pending. This
short display sample does not measure GPU time or sustained performance.

The exporter pins its three recipe sources before either bank is prepared and
checks them again immediately before publication. Tests change source during
preparation and final preflight; both cases produce zero publication writes.
Historical fixtures verify and explicitly unwrap the current bank layer.
Normal runtime fixtures use published banks. Fresh native builds apply the
free-arm pass last; verified completed native passes return a zero-write no-op.

All 32 focused asset, motion and fixture checks pass. Typecheck and production
build pass; static export verifies 1,377 files and 1,045 asset references.
The final quick gate passes all 6,796 checks in 890 files, with no failures,
skipped or cancelled checks (1,141.6 seconds). The earlier interrupted run is
not counted. Native verification also passes for 24 appearance LODs, 334 clips
per anatomy, 26 equipment items and three horse LODs. The docs audit, 127
relative record links and staged diff check pass.
Hashes, motion limits, browser metrics and equivalence proofs are in the
[review receipt](../../artifacts/standing-free-arm/review-receipt.json).

```sh
node --test tests/characters-standing-free-arm-rest.test.mjs tests/characters-reviewed-motion.test.mjs tests/renderer-sandbox-fixtures.test.mjs
python3 tools/characters-3d/build-standing-free-arm-rest.py --verify-only
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
