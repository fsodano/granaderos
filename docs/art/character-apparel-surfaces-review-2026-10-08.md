# Character cloth, leather and metal surfaces

[Art index](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

This third reference piece adds broad pigment variation to the main cloth of all
eight families. Boots get one warm worn region with higher roughness. Named
blackened steel and aged brass equipment gets a rougher finish. It builds on
[PR #307](https://github.com/fsodano/granaderos/pull/307).

## Visible result

The change gives coats and trousers more surface variation. It is clearer at
88 CSS pixels and restrained at the ordinary 44 pixel height. It is a modest
finish improvement. It does not complete the reference's character appearance.
Cloth is already matte in the previous library, so its existing roughness and
normal maps stay exact. No fine grain, random scratches or isolated bright dots
are added.

| View | Before | After |
| --- | --- | --- |
| Front, about 44 CSS pixels, 100% / LOD2 | [Before](tactical-reference-2026-10-08/apparel-before-44.jpg) | [After](tactical-reference-2026-10-08/apparel-after-44.jpg) |
| Front, about 88 CSS pixels, 200% / LOD1 | [Before](tactical-reference-2026-10-08/apparel-before-88.jpg) | [After](tactical-reference-2026-10-08/apparel-after-88.jpg) |
| Rear, about 44 CSS pixels, 100% / LOD2 | [Before](tactical-reference-2026-10-08/apparel-before-rear-44.jpg) | [After](tactical-reference-2026-10-08/apparel-after-rear-44.jpg) |
| Rear, about 88 CSS pixels, 200% / LOD1 | [Before](tactical-reference-2026-10-08/apparel-before-rear-88.jpg) | [After](tactical-reference-2026-10-08/apparel-after-rear-88.jpg) |

Each pair uses the actual previous commit `89daba6a`, the same light and the same
camera control sequence. Browser idle phase can vary between captures. The
fixed-time offline pairs provide exact pose comparisons. The live review also
checks close LOD0, rifle equipment, ordinary aiming and movement, crouch and prone.

The coarse vest and shawl's pale flecks remain a known geometry defect. The
coarse poncho's dark facets remain a known normal defect. Piece 4 handles them.
Uniform facings, seams, trim, polished blades, grip leather and cream crossbelts
stay exact. The shawl's special UV1 charcoal/rust map stays exact.

## Source and preservation

`authoring/apparel_surfaces.py` defines the separate pigment and wear recipe.
Selection checks both the original colour and the material role. Main-cloth
roughness bytes 224/232 qualify; same-colour facings and seams at 214/240 do not.
The nominal cloth factor is 0.82–1.24 in linear light. Actual bilinear samples at
active garment UVs span 0.8114–1.2461 after 8-bit colour quantization. All 45
selected garment/LOD rows reach at least 197 distinct texels. At least 20.56% of
selected vertices gain more than 6% luminance; at least 16.47% lose more than 6%.
These measurements establish coverage, not visual acceptance by themselves.

Boot pigment receives a broad 0.96–1.24 warm response and 0.74–0.82 roughness.
Only `Equipment_Blackened_Steel` and `Equipment_Aged_Brass` change to 0.48
roughness. Material names stay exact.

The installer preserves the complete binary streams, including previous fold
colour arrays. Each record contains compact reversible resource and donor
patches with complete prior JSON, binary and record hashes. All 24 bodies and
equipment restore to the complete previous GLB bytes. The complete predecessor
manifest, all 32 original GLBs and all 140 original PNGs match actual Git inputs.
The four frozen fold recipes and installers remain exact.

A private verified predecessor supports existing native and frozen surface
passes. The selected pass can publish only its owned bodies, maps and manifest.
Unchanged replay writes nothing. Input changes, stale links and texture
collisions reject before publication. The layered dispatcher permits old fold
passes to replay without changing their frozen source or hashes.

## Cost and validation

The 25 GLBs add 125,732 bytes. The 56 new maps add 53,693 bytes. The manifest adds
154,081 bytes. The new maps include 49 images at 128×128 and seven at 256×256.
Their RGBA pixel payload is 5,046,272 bytes across all LODs, or about 6,728,363
bytes with a complete mip chain. This is a dimension estimate, not a measured GPU
allocation. Model triangles, primitives and drawing parts do not increase.
The pass adds no runtime update or simulation work. Live scene counters vary
with framing and loaded LOD caches; they are not a paired performance benchmark.
No sustained frame-rate claim is made.

The focused surface gate passes all 27 checks, including fresh deterministic
output, exact complete predecessor restoration, repeat and verify-only, and
five no-write rejection cases. The predecessor and role gates pass all 39
checks. The independent restoration audit confirms the complete earlier
manifest and original assets against actual Git bytes.

The native library verifier passes 24 appearance LODs, two native banks with
334 clips each, 26 equipment items and three horse LODs. Typecheck and the
production build pass. Static export verifies 1,377 files and 1,045 asset
references. The documentation audit and `git diff --check` pass.

The layered pipeline passes all nine checks. Completed native topology,
palette, hem, pilot and family replays write zero files. Strict stale donor
checks reject at both the top and lower layers. The fresh close and coarse
cases change only their exact owned file lists and preserve source markers,
banks and other files. The final quick gate passes all 6,770 checks in 886
files, with no failures, cancelled or skipped checks (911.4 seconds).

Offline review retains 240 images in 120 before/after pairs under
`artifacts/character-apparel-surfaces/expanded-review/`. This covers all eight
appearances, all three LODs and standing, walking, rifle aim, crouch and prone.
Render settings, light, skin, camera, clip phase, sampled joints and props match
for every pair. One fixed sample per clip does not prove full motion quality.
The root review includes the complete LOD0 and LOD2 contact sheets and the live
checks described above. The live scene has eight loaded actors, no pending
loads and no reported browser errors.

```sh
python3 tools/characters-3d/build-apparel-surfaces.py --verify-only
node --test tests/characters-apparel-surfaces.test.mjs tests/characters-library-pipeline.test.mjs
python3 tools/characters-3d/verify-library.py
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
