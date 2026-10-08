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
python3 tools/characters-3d/build-cloth-depth.py --receipt artifacts/character-cloth-depth/receipt.json
```

Use the real tactical view at 1× and 2× zoom to judge the result. The appended
navy colours provide headroom for normalized vertex highlights. This pilot
does not add weave/roughness detail, alter anatomy or poses, or establish final visual
agreement with the supplied tactical references.

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
