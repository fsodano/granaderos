# Original articulated infantry animation

This asset set is authored as original 3D geometry and joint animation in
Blender, independent of the earlier generated paintings. No external meshes,
textures, donor sprites or copyrighted original JA2 game art are inputs.

`infantry-model.blend` and the Granadero/Royalist variant files contain an
articulated object rig: hip/knee/ankle and shoulder/elbow pivots parent the
individual mesh segments. These are real independently rotating joints, not
translation, scaling or warping of a static raster image. A two-segment leg
solver supplies planted and raised feet; an opposing arm swing and subtle
body movement complete the gait. The rifle remains attached to its hand.
The animation curves have eight discrete cycle poses at 10 fps and a duplicate
closing pose at frame 9. The browser atlas excludes that duplicate.

## Build

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_infantry.py
python3 assets/rig/pack_infantry.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/audit_rig.py
```

`-- --preview` renders just four southeast contact/passing poses for art QA.
The full build renders 128 walking frames plus 16 neutral idle views using the
same model, lighting and camera. The initial version was built with installed
Blender 5.0.0 Alpha and CPU Cycles. Source geometry uses small smooth meshes,
solid materials, period color coding, crossed belts and a shako: a simple
miniature style rather than the earlier painterly raster style.

## Browser contract

- `granadero-walk-atlas.png` / `royalist-walk-atlas.png`: 1536×1536.
- Each frame: 192×192. Eight columns are gait phases 0–7.
- Rows: `n, ne, e, se, s, sw, w, nw` in that order.
- Idle atlases: 1536×192; eight direction columns in the same order.
- Loop rate: 10 fps; duration 0.8 seconds. Unit travel speed belongs to gameplay.
- Normalized world reference: `(0.5000002384, 0.8830497935)` for every frame.
- `infantry-animation.json`: full rectangles, hashes, camera and reference data.
- `*-walk-*-preview.webp`: animated lossless previews of actual rendered frames.

Draw a frame so its world reference lands on the unit's map position. Advance
its gait clock independently of other units. Map translation belongs to the
unit's movement path; atlas playback animates its actual legs and arms. Do not
use the center of each visible sprite bounding box as an anchor: the moving
feet deliberately change that box. These sprites have genuine alpha.

`rig-audit.json` records checks on saved Blender curves: exact loop closure,
nonconstant hip and arm rotations, and different world heights for the support
and passing ankles. Packing checks ensure correct sizes, alpha and no clipped
frame edges. Every direction was visually inspected in the complete atlas;
southeast contact/passing frames and both factions' idle views were inspected
separately. Per-direction hashes also prove eight distinct rendered images.

## JA2 reference

The user-provided [Anatomy of a sprite](http://ja2v113.pbworks.com/w/page/28015925/Anatomy%20of%20a%20sprite)
was successfully fetched with curl and read on 2026-09-05. Its orthographic
30° elevation/45° azimuth camera convention and frame-reference-offset discussion
inform this implementation. The article leaves animation-speed handling as a
TODO; our gait and timing are original implementation decisions. Its linked
“How to animate own sprites” legacy forum URL redirected to a 404 page, so it
was not treated as a read tutorial. The browser retains full RGBA rather than
JA2's indexed palette because no STI runtime is used here.

Further polish remains: textured clothing, more distinctive faces, equipment
variants, mounted gait, additional action animation and more nuanced weight
transfer. The current set provides real reusable eight-direction locomotion.
