# Granadero authoring sources

The uniform, boots, shako, weapon meshes, cloth weave maps, study rig and nine
skeletal actions are original Granaderos work. The model is an authored study
based on the supplied uniform reference images. It is not the Sketchfab model.

The continuous human head, hands and upper coat topology are derived from the
MakeHuman hm08 base with the adult male morph. The source joint and weight data
come from the MPFB asset bundle at commit
`afb9f530a7c2741dedb8df0ebae2e0b183caec21`. These asset files are CC0. The
MPFB Python addon is not included or used. The general code license in
`vendor/makehuman/LICENSE.md` is distinct from the CC0 asset license in
`vendor/makehuman/LICENSE.ASSETS.md`.

The photographic skin detail/normal maps are derived from Mindfront Aksel,
listed as CC0 on the [official skin pack page](https://static.makehumancommunity.org/assets/assetpacks/skins02.html).
The selected source files, exact URLs, local SHA-256 hashes and derivations are
in `vendor/makehuman/source-manifest.json`. No viewer assets were extracted.

`prepare_skin_maps.py` regenerates the two reduced maps with Pillow. The neutral
luminance map permits runtime skin tint; eyes use separate materials. Both skin
and original cloth maps are embedded into the GLB and packed into the native
Blender file. No external texture requests are required by the playground.

Run `build_granadero.py` with Blender 5 or newer to regenerate the native file,
GLB, manifest and fixed isometric preview. Source coordinates are metres, Z-up
and -Y forward; the exported model is glTF Y-up and +Z forward. Weapon group
axes differ from the whole-model basis: exported firearm forward is local -Y,
and muzzle markers determine the precise origin/direction in runtime.

This study uses original keyframed cycles, not captured human motion. The
playground is an art and rendering prototype; it is not a production character
or a measured game performance result.
