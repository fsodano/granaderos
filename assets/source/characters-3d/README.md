# Tactical character library

This library uses real skinned human meshes. The Granadero motion reference is
shared across eight appearances, with separate native male and female anatomy
banks. `playgrounds/granadero-3d` opens the current game model in an isometric
view; its older reference remains a separate comparison. The builder does not
import that preview binary. See [the review inventory](REVIEW.md) for accepted
motion work, current evidence and remaining limits. The new face and skin pass
has passed local export and surface checks. User approval of its appearance is
still pending.

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
matte leather, and shaped uniform trim. The base face source uses separate
2048-pixel male and female skin maps. It preserves local color differences,
adds spatial roughness and derives restrained normals from fine source grain.
`facial_structure.py` adds small cheek, brow, nose and mouth surface changes
to the native face. The measured displacement is below 1.23 mm. Head geometry
has its own reduction budget, so the eyes and lips keep more of their source
shape at each detail level. A fitted brow base and irregular short hairs replace
the sparse dotted brows. Native UVs, skin weights, joints and the
light/brown/dark palette controls remain intact. The later eye pass increases
the iris diameter to 11 mm and softens the lower-lid ridge. These eye changes
leave skin geometry outside the face unchanged. Military coats have a smoother neckline; LOD1
retains the LOD0 coat support to prevent the shoulder belt entering the cloth
during compressed poses. Other LOD1 parts keep their normal reductions.
The Granadero additionally uses a reviewed 1254-pixel generated colour map
for clearer facial variation, lips and short stubble. Its separate UV1 registers
the lips and brows; the native UV0 normal/roughness maps stay intact. Fitted
eyebrow hairs remain, with the underlying extra pigment disabled for this map.
The runtime and lab compensate its colour reference when selecting a skin tone.
This is limited to the three Granadero detail levels. The other appearances
retain their base maps. The face still needs further art review, especially the
wide outer brow tails; see the dated evidence and limits in [REVIEW.md](REVIEW.md).
Civilian garments keep their own colors and do not retain military
cockades, chin scales, cords or epaulettes. Each complete hat is one replaceable
headwear part, including its small trim pieces.

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

## Motion inventory

The two anatomy banks each contain 334 semantic clips: 106 standing, 86 crouched,
63 prone and 79 mounted. Of these, 34 use 29
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

Reviewed clips retain the accepted 1.25 playback-rate reference; the lab shows
this as 1×. Gameplay cue timing remains authoritative; clip markers cannot
issue attacks, spend AP or
ammunition, apply damage, or move an actor. The later motion pass also corrects
weapon grips and loading, throws, crouched attacks, crawl support, work gestures,
recovery, mounted transitions and roof climbing. Climb supports, saved endpoints
and timing are retained. These focused checks do not certify every combination;
the review inventory records the corrected lance grips, their transition checks,
and the retained side-step loop seams.

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

## Sources and rights

- **MakeHuman / MPFB body, targets, rig and weights:** CC0-1.0 assets from
  `makehumancommunity/mpfb2`, commit
  `afb9f530a7c2741dedb8df0ebae2e0b183caec21`. No MPFB Python addon code is used.
  The original license texts, source URLs, hashes and derivations are in
  `authoring/vendor/makehuman/source-manifest.json` and `LICENSE.ASSETS.md`.
- **Base skin detail:** the clean young male and female skins from the
  [MakeHuman system assets CC0 pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html).
  The included material headers identify the September 2020 CC0 release and
  Data Collection AB, Joel Palmius and Jonas Hauquier as the copyright holders
  at release. The original diffuse maps and material headers are vendored;
  source URLs, archive members and file hashes are in
  [the source manifest](authoring/vendor/makehuman/source-manifest.json).
  `authoring/prepare_skin_maps.py` reproduces the 2048-pixel tintable color,
  spatial roughness and fine-grain normal maps without changing the native UVs.
  The earlier Mindfront Aksel maps remain recorded for provenance but are no
  longer used by the current appearance source.
- **Granadero colour texture:** generated with the built-in image tool using
  the vendored young male diffuse map as its UV reference. The unchanged PNG,
  exact prompt, generation record and hash are in `authoring/generated/`.
  `authoring/generated_skin.py` adds only albedo registration and material
  metadata; it does not edit pixels or replace the native surface maps. This
  generated colour texture is distinct from the original CC0 source asset.
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
