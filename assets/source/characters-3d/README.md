# Tactical character library

This production library uses real skinned human meshes. It does not use sprites,
billboards, baked animation pictures, or primitive substitute bodies. The approved
`playgrounds/granadero-3d` demo is independent and is not changed by this builder.
On 2026-10-06 the user accepted that Granadero as the reference for the other
characters. The production sources now apply its human proportions, surface
detail and reviewed standing movement to all eight appearances. See
[the review inventory](REVIEW.md) for the exact scope and remaining limits.

## Rebuild

With Blender 5 installed:

```sh
python3 tools/characters-3d/build-library.py --review
```

Use `--blender /path/to/blender` on another machine. `--only appearance`,
`--only garments`, `--only equipment`, `--only horse`, or `--only animations`
rebuilds one class. `--preset granadero --lod 1` limits a character pass.
The full build writes `web/public/models/characters/manifest.json` and the
referenced GLBs and shared texture PNGs. Review renders and logs are local in
`authoring/.build/`; they are not production assets. No network access is needed.

`complete` in the manifest confirms that all expected output records exist.
It is a coverage flag, not a claim that every motion or garment is visually final.

## Anatomy and skeleton

`character.py` uses the complete MakeHuman body topology, native source helper
joints, native skin weights, and native game-engine rig. The male and female
bodies use separate pinned native macro targets. Both are normalized uniformly
to a 1.76 m bare body height. Clothing has clearance over this body; it never
narrows a body axis or substitutes new limb lengths. The skeleton has the same
53 named bones across all presets. Female joint positions remain native to the
female source. Animation banks are therefore shared within each sex, not across
incompatible bind poses.

Authoring coordinates are metres, +Z up, -Y forward. Export coordinates are
metres, +Y up, +Z forward. These are presentation coordinates only. Gameplay
coordinates, collision bounds, body heights, damage, and action timing are not
changed by the asset builder.

## Appearance and equipment

The eight active appearances are granadero, royalist, worker, surgeon, gaucho,
friar, woman-scout, and woman-shawl. Uniforms, shirts, coats, a poncho, a habit,
a shawl, trousers, a skirt, hair, hats, boots and trim are fitted meshes.
The shared surface treatment adds facial pigment, cloth folds and seams,
matte leather, and shaped uniform trim. Female faces omit the male jaw stubble
treatment. Civilian garments keep their own colors and do not retain military
cockades, chin scales, cords or epaulettes. Each complete hat is one replaceable
headwear part, including its small trim pieces.

The first tactical cloth-depth pilot applies only to Granadero and worker base
outfit and legwear at all three LODs. `authoring/cloth_depth.py` defines broad
rest-space tones around existing waist, sleeve and knee folds. The append-only
`tools/characters-3d/build-cloth-depth.py` pass installs new `COLOR_0` arrays and
a separate Granadero colour atlas. Only navy cloth tiles receive bounded albedo
headroom so their fold ridges can remain visible. The original atlas, trim,
skin, faces, normal/roughness maps, geometry, bindings and action data stay exact.
Each changed LOD records the original binary/JSON hashes and colour
references in `clothDepth`. Repeating the pass verifies its output without
accumulating contrast. Changed source recipes require a fresh source build.

The normal builder includes this pass. To apply it to the current library and
save a local preservation receipt:

```sh
python3 tools/characters-3d/build-layered-cloth-depth.py --layer pilot --receipt artifacts/character-cloth-depth/receipt.json
```

Use the real tactical view at 1× and 2× zoom to judge the result. The appended
navy colours provide headroom for normalized vertex highlights. This pilot
does not add weave/roughness detail, alter anatomy or poses, or establish final visual
agreement with the supplied tactical references.

The six remaining appearance families use an independent frozen recipe in
`authoring/family_cloth_depth.py`. The family pass retains the accepted pilot
files and source recipe exactly. It appends garment colour arrays, with small
owned albedo maps for surgeon, gaucho and friar cloth only. Faction trim, leather,
faces, normals and roughness remain exact. Royalist and both women's active
colour maps remain exact. Hanging panels use vertical radial form shading.
The woman's UV1 rust-band triangles and an adjacent triangle ring retain their
original vertex colours, including triangles that cross the stripe between
sparse sampled vertices.

```sh
python3 tools/characters-3d/build-layered-cloth-depth.py --layer family --receipt artifacts/character-family-cloth-depth/receipt.json
node --test tests/characters-family-cloth-depth.test.mjs
```

Each `familyClothDepth` receipt pins the complete original LOD record, JSON,
binary prefix and external image bytes. Restoring the recorded colour/material
references and donor links recovers the exact original GLB. Repeats verify the
recipe, delivered colours, maps and donor links before writing nothing. Changed
recipes require a source rebuild. All map collisions are checked before any
installation. This preflight does not promise rollback after a filesystem I/O
failure.

Native topology, palette and hem postpasses replay completed family surfaces
inside a private complete library. They restore native source inputs, run the
existing rig/morph/hem/boot gates, then rebuild family colours. A native replay
with equal decoded data and LOD metadata retains the exact released bytes;
packing unused arrays is not a new source change. Changed source data receives
a fresh colour receipt. The library installs only checked final differences.
This surface pass adds no triangles or draw calls and does not add weave,
roughness detail, geometry changes or new poses.

Family attire is the base visual. An empty inventory outfit slot keeps that base
visual and does not create an owned item. Equipped inventory garments use the
manifest's explicit replacement/overlay rules. Each anatomy has fitted poncho,
linen-shirt, trousers and hat meshes. All inherit the actor's live skeleton.

Each owned item has a separate node in `equipment.glb`; the game can attach it
to either hand, a stowed socket, or a ground-item position. The library covers all
14 current personal weapon IDs, the socket bayonet fitting, ramrod, four tools,
torch, bolas, rations, dressings, grenade, ammunition, and a wrapped generic item.
Weapon variants have distinct measured profiles. Gameplay remains the authority
for which item exists, which hand holds it, and when it acts.

Hand sockets are calculated from the native palm and knuckle geometry. The
matching item is attached at identity below its named socket. Do not apply a
second arbitrary orientation or move the hand mesh to fit the weapon.

## Reviewed standing movement

The two anatomy banks each contain 334 semantic clips. Of these, 34 use 29
distinct motions transferred from the accepted Granadero reference. This covers
unarmed idle/walk/run/punch, rifle and pistol aim/fire/carry/close strikes,
bayonet thrust, sabre guard/carry/cuts/thrust/hilt strike, and knife
guard/carry/cuts/thrust. Shared guard poses serve multiple semantic requests.
`reviewed_motion.py` contains the reusable source; the builder does not import
the playground. Exported `reviewedPose` metadata identifies the source motion
and its source hash. Native male and female proportions determine the targets.

Knife item 1813 has explicit bindings to knife motions. Standing sabre and knife
strikes select a stable variant from the action cue ID; preparation, contact and
recovery keep the same variant. Each variant has one contact. The playground's
two-cut combination remains a preview action and does not create a second hit
for one paid gameplay action.

The standing sabre **thrust** uses the pinned, compact native donor
`authoring/standing_blade_wrist_donor.json`. After a fresh animation build,
`tools/characters-3d/build-standing-blade-wrists.py` replaces only the right
upper-arm, forearm, wrist and three thumb rotation outputs in this one clip.
It checks the donor's native rest transforms and exact input clocks before
installing either anatomy bank. All other clips, joint offsets, scales, markers,
meshes, equipment and original binary data remain exact. The source commit and
bank hashes are recorded in each changed clip's `nativeBladeWrist` metadata.
The donor is applied once to fresh banks; a repeated application is rejected.
The other standing cuts and hilt strike retain their released channels and
still need separate physical and visual review.

The three standing pistol, sabre and knife idles use the native unarmed left
upper-arm and hand rotations. `authoring/standing_free_arm_rest.py` appends a
small chest-forward forearm correction (male 4 degrees; female 12 degrees).
`tools/characters-3d/build-standing-free-arm-rest.py` keeps the complete old bank
as an exact binary prefix and retains all input clocks and other channels. Its
compact receipt reconstructs the complete previous bank and manifest record.
The normal library build runs this pass after native motion authoring. A repeat
verifies the result without writes. The explicit historical bank context also
verifies the completed prone-pistol and standing blade-wrist donors without
running their writing installers. Historical graphics fixtures use the verified
bank predecessor; runtime fixtures continue to load the published banks.

The review checks all eight families at both tactical LODs, real secondary
pistol seating, and the production 0.12-second idle transitions. Small hand and
legwear triangle contacts can occur during the existing crouch transition;
matched 44/88-pixel review is needed to assess visible breakthrough. This is
not a proof of zero garment intersections in every pose.


Reviewed clips retain the accepted 1.25 playback-rate reference. Gameplay cue
timing remains authoritative; clip markers cannot issue attacks, spend AP or
ammunition, apply damage, or move an actor. The other clips retain the existing
production authoring for crouching, prone and mounted actions, reloads,
interactions and reactions. They are not newly approved by the Granadero review.

Open `/renderer-sandbox` and select **Ocho personajes** to inspect all eight
appearances and move or equip them without loading a saved campaign. The combat
fixture also includes a knife user. This fixture supports visual review; it is
not proof that every posture, garment and weapon combination has been checked.

## Mesh budgets and sharing

Three real geometry LODs preserve the skeleton contract. Decimation occurs in
rest space before the Armature modifier, never on a posed mesh. Fine details are
removed at the far LOD; crossbelts and other important silhouettes are retained.
Weights are limited to the strongest four influences and normalized.

Apparel uses a PBR palette atlas with separate metal/roughness and normal data.
Skin remains a distinct material for deterministic light/brown/dark palettes.
The atlas grows to fit its material count. All joined parts preserve a common
`Human_Surface_Tone` attribute, exported as `COLOR_0`; this keeps facial and
cloth pigment visible in the game renderer. Supported multiply nodes preserve
the pigment and texture together during export.
Body parts are batched by equipment slot so owned clothing can replace them.
Images are external content-addressed PNGs shared across GLBs. Constant animation
samplers retain their true value at both endpoints; non-default weapon holds are
not discarded. Each actor needs its own bones but can share loaded geometry,
textures, materials where immutable, and animation clips.

## Native long cloth correction

After native animation support is rebuilt, `build-library.py` runs
`tools/characters-3d/build-long-cloth-support.py`. This pass fits the existing
`cloth_prone` shape of the friar habit and woman's long skirt at all three LODs
to `prone.idle.long-gun`. It changes only existing prone position offsets and
normals on adjacent triangles. Rest geometry, skin weights, rig, crouched
shape, textures and animation data are preserved and checked after packing.
Targets remain sparse. The manifest stores the exact semantic native clip hash.

A repeated fit makes no asset changes. If that native pose changes, rebuild the
six authored long-cloth bodies before fitting again. The pass rejects a second
nonlinear fit against a changed pose. Builds of other assets retain the reviewed
cloth record when the published body hash still matches. To run the pass alone:

```sh
python3 tools/characters-3d/build-long-cloth-support.py
node --test tests/characters-long-garments.test.mjs
```

The checks cover prone height, floor bounds, crawling, posture blending,
replacement clothing, shading normals, repeat fitting and stale-pose rejection.
They do not establish cloth and boot collision clearance in every motion.

## Close long-cloth boot support

The detailed friar and woman's skirt bodies have a third additive target,
`cloth_prone_boot_clearance`. It clears complete boot surfaces for the recorded
fixed native prone support set while retaining the original rest mesh, rig,
two cloth targets and crawling shape. Normal camera zoom can now select these
detailed bodies; the character LOD thresholds are 120 and 65 projected pixels.

```sh
python3 tools/characters-3d/build-close-long-cloth-boot-support.py
node --test tests/three-long-cloth-boot-clearance.test.mjs
```

The library runs this pass after the native cloth-height pass. Repeat fitting
changes no asset. Changed source-pose or compatible clip-set hashes require
authored body regeneration. Runtime weights follow scheduled native actions,
including paused paid phases, and exclude mirrored or moving lower-body clips.
The [close garment review](../../../docs/art/close-long-cloth-boot-clearance-review-2026-10-08.md)
records complete surface checks and remaining coarse-LOD and motion limits.

The layered dispatcher verifies and removes any completed apparel layer in a
private library, runs the frozen cloth installer, and restores the apparel
layer. Direct `build-cloth-depth.py` and `build-family-cloth-depth.py` commands
are limited to an explicitly unwrapped predecessor library. Historical review
records retain the commands used for their original captures.

## Broad apparel surfaces

`authoring/apparel_surfaces.py` defines broad garment pigment regions and boot
wear. Main cloth is selected by its original pigment and roughness role, so
same-colour facings and seams remain exact. Delivered cloth roughness is already
matte (224/255 for wool and 232/255 for trousers); this pass retains it. Boots
start at 171/255 and gain one broad worn region with bounded matte roughness.
The existing woven normal maps are retained without additional fine noise.

Blackened steel and aged brass on equipment receive a roughness factor of .48.
Their material names, colours and metallic factors remain exact. Polished
blades, grip leather and uniform trim retain their complete previous materials.

```sh
python3 tools/characters-3d/build-apparel-surfaces.py
python3 tools/characters-3d/build-apparel-surfaces.py --verify-only
node --test tests/characters-apparel-surfaces.test.mjs
```

The library installs this layer after both frozen cloth-form passes. It appends
material/image/texture definitions only; complete binary streams, fold colour
accessors and receipts, normals, UVs, skin, rust hem, rig and motion remain
exact. Each compact `apparelSurface` receipt pins the preceding complete LOD
record and restores it through byte/hash fields and explicit donor patches.
It proves complete top-layer removal without copying nested earlier receipts.
Friar/skirt coarse donor links point to the final
close body and restore to their exact preceding values when the layer is removed.

Pixel bounds and passing preservation checks do not prove readability. Review
all eight appearances at 44 and 88 projected pixels, including rear views and
movement, before accepting a recipe change.

## Sources and rights

- **MakeHuman / MPFB body, targets, rig and weights:** CC0-1.0 assets from
  `makehumancommunity/mpfb2`, commit
  `afb9f530a7c2741dedb8df0ebae2e0b183caec21`. No MPFB Python addon code is used.
  The original license texts, source URLs, hashes and derivations are in
  `authoring/vendor/makehuman/source-manifest.json` and `LICENSE.ASSETS.md`.
- **Skin detail:** Mindfront's Aksel CC0 skin, via the MakeHuman `skins02_cc0`
  pack. The tint-neutral diffuse and reduced normal map are reproduced by
  `authoring/prepare_skin_maps.py`. Source maps and exact recipes are retained.
- **Female macro target:** the matching native female target from the same
  pinned upstream commit; URL and SHA256 are in
  `authoring/vendor/additional-source-manifest.json`.
- **Horse:** Lyndon Daniels, submitted by ChadM, CC0, from
  https://opengameart.org/content/rigged-horse . Original `riggedHorse.blend`
  is retained unchanged. `horse.py` converts its scale, preserves the horse
  mesh and native rig, assigns missing mane/tail/eye weights, adds a saddle,
  and produces local gait clips. Source URL and SHA256 are recorded in
  `authoring/vendor/additional-source-manifest.json`.
- **Human motion:** recorded CMU clips and authored period actions. See
  `authoring/vendor/motion/SOURCES.md`, the upstream terms, and its source
  manifest. Recorded motion is not claimed to be an authored historical action.
- **Uniforms, equipment, appearances, sockets and build code:** original
  Granaderos work based on the user's visual references. No Sketchfab model,
  proprietary preview binary, or ripped model was used.

The horse source is one horse build, and the base human library has two native
anatomies. Additional individual faces, ages, body builds, hair and horse coats
can be added as source-derived variants without changing the runtime contract.
