# Tactical character library

This production library uses real skinned human meshes. It does not use sprites,
billboards, baked animation pictures, or primitive substitute bodies. The approved
`playgrounds/granadero-3d` demo is independent and is not changed by this builder.

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

## Mesh budgets and sharing

Three real geometry LODs preserve the skeleton contract. Decimation occurs in
rest space before the Armature modifier, never on a posed mesh. Fine details are
removed at the far LOD; crossbelts and other important silhouettes are retained.
Weights are limited to the strongest four influences and normalized.

Apparel uses a PBR palette atlas with separate metal/roughness and normal data.
Skin remains a distinct material for deterministic light/brown/dark palettes.
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
