# Cloth depth across six more character families

[Art index](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

This second reference piece adds local cloth form to the Realista, Cirujano,
Gaucho, Fraile, Exploradora and Mujer con rebozo at all three LODs. It builds on
[PR #306](https://github.com/fsodano/granaderos/pull/306). The accepted Granadero
and worker models and their source recipe remain exact.

## Visible result

The result is a small improvement in cloth depth. Dark garments gain useful
highlight range; trousers show local waist and knee shading. The poncho, habit
and skirt use vertical folds along their existing hanging surfaces. The change
is easier to see at twice normal scale. It does not complete the reference's
character aesthetic. Material finish, distant detail and the free-arm rest pose
remain separate pieces.

The compact `/graphics-review` page now selects valid standing, crouched and
prone fixtures for all eight families. It also selects family equipment,
unarmed or rifle equipment, and front, side or rear views. These use the real
battlefield, orders and presentation. They do not assign private renderer poses.

| View | Before | After |
| --- | --- | --- |
| Front, about 44 CSS pixels, 100% / LOD2 | [Before](tactical-reference-2026-10-08/family-before-44.jpg) | [After](tactical-reference-2026-10-08/family-after-44.jpg) |
| Front, about 88 CSS pixels, 200% / LOD1 | [Before](tactical-reference-2026-10-08/family-before-88.jpg) | [After](tactical-reference-2026-10-08/family-after-88.jpg) |
| Rear, unarmed, 200% / LOD1 | [Before](tactical-reference-2026-10-08/family-before-rear-88.jpg) | [After](tactical-reference-2026-10-08/family-after-rear-88.jpg) |
| Crouched, unarmed, 200% / LOD1 | [Before](tactical-reference-2026-10-08/family-before-crouch-88.jpg) | [After](tactical-reference-2026-10-08/family-after-crouch-88.jpg) |

Browser idle phase can vary between captures. Fixed-time offline pairs provide
the exact pose comparison. Front, side, rear, close zoom, ordinary movement and
rifle mode were checked live. The comparison preserves the same light and camera
for each pair. Changing review options resets the camera to 200%.

No new trim tint or rust-band spill was found. Pale shoulder flecks on the coarse
shawl and dark facets on the coarse poncho are present in the actual previous
commit. They remain visible and are recorded for piece 4. This surface pass
keeps geometry, so it does not claim to correct garment or limb widths.

## Source and preservation

`authoring/family_cloth_depth.py` defines a separate frozen recipe. The installer
appends colour arrays to named cloth surfaces. Dark cloth gets bounded colour
atlas headroom. The combined cloth response stays between 0.70 and 1.26 of the
previous value. It follows connected hanging panels and protects the shawl's UV1
rust stripe, crossing triangles and an adjacent vertex ring.

All 18 previous bodies can be reconstructed exactly, including complete JSON
and binary streams. Positions, normals, UVs, skin, trim, face maps, rigs, sockets,
morphs and action banks remain exact. The original normal and roughness maps
remain exact. The pass changes 60,375 cloth vertices. Repeated application writes
nothing. Invalid input and destination texture collisions reject before writes.

The existing native topology, shawl palette and hem passes can replay through a
private copy of the verified library. They restore the previous native body,
run their own pass, then reapply the family layer. Unchanged replay preserves
every live file byte. A selected fresh source rebuild publishes only its owned
bodies and manifest. The final verifier remains strict about stale coarse donor
links; the private topology rebuild repairs those links before publication.

## Cost and validation

The 18 GLBs add 1,219,836 bytes. Ten PNG maps add 3,347 bytes. Triangle and draw
counts remain exact. The colour pass adds no runtime update or simulation work.
An eight-character live scene had no pending loads or errors. A short local
120 FPS counter sample is not a sustained performance claim. Geometry and texture
caches grow when another LOD is loaded, as in the previous scene.

The family preservation and rejection checks pass all 20 tests. Related cloth,
skin, palette, hem, native-action and runtime checks pass. The native library
verifier passes 24 appearance LODs, two banks with 334 clips each, 26 equipment
items and three horse LODs. Typecheck and production static export pass. The
export verifies 1,321 files and 1,045 asset references.

The final quick gate passes all 6,743 checks in 885 files, with no failures or
skipped checks. The documentation audit and `git diff --check` pass. Native
surface replay tests cover three byte-exact no-ops, a selected fresh close body
and a selected fresh coarse body. Offline review uses one fixed sample per
clip; it does not prove full continuous-motion quality.

Offline pairs are retained under
`artifacts/character-family-cloth-depth/expanded-review/`. They compare the actual
previous commit `10e7f9f5`, all six affected families and all three LODs. The
standing, crouched and prone set contains 108 frames in 54 pairs. The separate
`action-review/` set adds 72 walking and rifle-aim frames in 36 pairs. There are
180 fixed-time images in 90 before/after pairs in total.

```sh
python3 tools/characters-3d/build-family-cloth-depth.py --receipt /tmp/family-cloth-depth.json
node --test tests/characters-family-cloth-depth.test.mjs tests/characters-library-pipeline.test.mjs tests/renderer-sandbox-fixtures.test.mjs
python3 tools/characters-3d/verify-library.py
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
