# Granadero authoring sources

The uniform, boots, shako, weapons, fabric maps and weapon actions are original
Granaderos work based on the supplied photographs. This is not the Sketchfab model.

The complete adult body, joint positions and skin weights come from the MakeHuman
hm08 base, adult male morph and MPFB game-engine rig. The source bundle is pinned
to commit `afb9f530a7c2741dedb8df0ebae2e0b183caec21`. The body retains its native
proportions and is scaled uniformly to 1.76 metres. No horizontal compression or
separate head/hand fitting is applied. Garment surfaces follow the body and use
its bone weights.

These assets are CC0. The MPFB Python addon is not included or used. Its general
code license in `vendor/makehuman/LICENSE.md` is distinct from the CC0 asset
license in `vendor/makehuman/LICENSE.ASSETS.md`.

The photographic skin detail and normal maps derive from Mindfront Aksel,
listed as CC0 on the [official skin pack page](https://static.makehumancommunity.org/assets/assetpacks/skins02.html).
Exact URLs, local SHA-256 hashes and derivations are recorded in
`vendor/makehuman/source-manifest.json`. `prepare_skin_maps.py` regenerates the
reduced maps with Pillow. Neutral skin detail permits runtime skin tint. Eyes,
clothing and equipment use separate materials. All runtime textures are embedded
in the GLB and packed into the Blender scene.

Idle, Walk and Run use recorded human movement from the Carnegie Mellon Graphics
Lab Motion Capture Database. The data was obtained from mocap.cs.cmu.edu. The
database was created with funding from NSF EIA-0196217. The selected BVH conversion
was made by Bruce Hahne. Exact sources, hashes, crop frames and use terms are in
`vendor/motion/source-manifest.json` and `vendor/motion/SOURCES.md`. The recorded
trajectories are retargeted to native bone lengths and closed into loops. Actual
boot geometry is checked during grounding. CMU does not supply finger capture;
the finger poses and all rifle, pistol and sabre actions are original work.

Build with `build_human.py` in Blender 5. Add `-- --publish` to copy the completed
candidate into the local playground. Modules separate character, equipment,
animation and export. `build_granadero.py` is a compatibility entry point for the
same build. Source coordinates are metres, Z-up, -Y forward. Exported coordinates
are glTF Y-up, +Z forward. Firearms point along local +X; named muzzle markers
supply the runtime origin and direction. Weapon groups are attached to `hand_r`.

The fixed orthographic camera uses a 30 degree tactical viewing angle. The saved
scene includes review lighting and a camera, but neither is exported in the GLB.
This is a character and rendering study. It has not been optimized or measured
for a sector containing many soldiers.
