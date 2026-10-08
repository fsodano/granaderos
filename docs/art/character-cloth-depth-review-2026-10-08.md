# Character cloth depth pilot

[Art index](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

The Granadero's navy coat loses much of its existing fold shading at tactical
scale. The worker's cloth also has little local contrast. This first reference
piece adds bounded fold colours to their existing outfit and legwear surfaces
at all three LODs. It keeps the Argentine period clothing.

## Same-size comparison

The compact `/graphics-review` page uses the actual battlefield and its existing
fixtures. It gives the scene more space than the full sandbox menu. These
1280 × 720 browser captures use the same fixture, daylight and camera:

| Actor scale | Before | After |
| --- | --- | --- |
| About 44 CSS pixels; 100% zoom, LOD2 | [Baseline](tactical-reference-2026-10-08/cloth-before-44.jpg) | [Pilot](tactical-reference-2026-10-08/cloth-after-44.jpg) |
| About 88 CSS pixels; 200% zoom, LOD1 | [Baseline](tactical-reference-2026-10-08/cloth-before-88.jpg) | [Pilot](tactical-reference-2026-10-08/cloth-after-88.jpg) |

The result is a small improvement. The navy has more highlight range and local
waist, elbow and knee contrast. The worker gains shaded fold valleys. The
effect is easier to see at 2× zoom; it remains subtle at normal scale. The
captures retain each idle's small phase variation and are not a pixel-difference
test. Fixed-time offline frames provide the same-pose comparison.

This pilot does not complete the reference character aesthetic. Posture,
garment silhouette, material finish and useful distant detail remain separate
pieces in the plan. Adult anatomy and the reviewed face treatment already exist.

## Source and preservation

`authoring/cloth_depth.py` defines a bounded rest-space fold field. The installer
selects only named base-cloth pigments. It appends garment colour arrays and a
separate Granadero colour atlas; the two navy pigments get linear highlight
headroom. The combined response remains between 0.76 and 1.48 of the original.
Worker highlights remain at or below 1.04. Normal and roughness bindings stay
exact. The original atlas and complete native binary payload remain intact.

The reconstruction gate restores only the permitted colour/material references,
then requires the complete previous JSON and binary to match. This includes
positions, normals, UVs, skin, trim, rig, sockets, morphs and every action. Other
appearance families remain exact. Fresh application is deterministic; repeated
application writes nothing. Invalid recipes, altered resources and destination
texture collisions reject before installation.

## Cost and checks

The six bodies add 452,520 bytes. Two content-addressed PNGs add 1,061 bytes.
Triangle and primitive counts remain exact:

| Family | LOD0 triangles / draws | LOD1 triangles / draws | LOD2 triangles / draws |
| --- | ---: | ---: | ---: |
| Granadero | 76,666 / 8 | 48,454 / 8 | 17,915 / 7 |
| Worker | 63,192 / 7 | 40,434 / 7 | 16,597 / 7 |

The colour pass adds no runtime update or simulation work. A live scene sample
has eight loaded actors and no pending loads. A 120 FPS counter reading is only
a short local observation; it is not a sustained performance claim. Cached
resources increase when zoom loads another LOD, as in the baseline.

The focused preservation, recipe and rejection checks pass (8 tests), along with
105 related skin, face, runtime, visibility and native-action checks. Typecheck,
production static export and the documentation audit pass. The quick gate passes
all 6,721 checks in 884 files, with no failures or skipped checks.

Sixty fixed-time offline frames compare both families, five supported poses and
all three LODs against the actual HEAD library. They show no new trim tint or
abrupt colour boundary. Small pale flecks on the worker's LOD2 vest are present
at the same locations in the baseline; this pilot retains that limit.

Review outputs stay in `artifacts/character-cloth-depth/`. Ordinary worker
movement, turning, stance orders and the native rifle posture fixture are
checked in the browser. Stance captures must allow the transition to settle;
an immediate capture after a paused order can show the previous posture.

```sh
python3 tools/characters-3d/build-cloth-depth.py --receipt /tmp/cloth-depth.json
node --test tests/characters-cloth-depth.test.mjs
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
