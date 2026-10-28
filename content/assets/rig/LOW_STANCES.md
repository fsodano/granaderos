# Original low-stance infantry animation

The four `granadero-{crouch|prone}.blend` and `royalist-{crouch|prone}.blend`
files adapt the original articulated infantry models. Crouching lowers the
pelvis and bends both knees; prone crawling rotates the torso horizontally,
with opposing hip/knee and shoulder motion. These are original 3D joint poses.

Build using Blender with `render_low_stances.py`, Python with
`pack_low_stances.py`, and Blender with `audit_low_stances.py`. Input infantry
Blender models must be present. There are 288 rendered RGBA frames total:
two factions × two postures × (64 movement + eight idle frames).

`stance-animation.json` records every frame hash and the camera reference.
Walk atlases are 1536×1536, idle atlases 1536×192, using 192-square cells.
Direction rows/idle columns are N, NE, E, SE, S, SW, W, NW. Eight gait columns
play at 10 fps. The world reference stays fixed throughout each posture:

- Crouch: (0.5000002384, 0.8830497935), 2.6 orthographic scale, draw 96px.
- Prone: (0.5000002384, 0.6396817267), 3.1 orthographic scale, draw 114.46px.

The larger prone camera captures the horizontal body without clipping, while
its proportionately larger browser canvas preserves physical character scale.
The battlefield chooses prone when either stance or movement mode is prone,
crouch for crouch movement mode, and standing otherwise. Mounted units retain
their horse renderer. Painted standing action poses are used only standing:
there are no dedicated low-stance firing/reloading action animations yet.

Verification includes true alpha and unclipped bounds on all 288 frames,
eight distinct images per direction, exact joint loop closure, independent
hip/knee/shoulder motion, lowered crouch and horizontal prone torso. Southeast
prototypes, revised prone passing pose and both complete idle direction strips
were visually inspected. Animated WebP previews are also supplied.

The stylized crawl is a first usable cycle; exact musket handling, transitions
between postures, cloth motion and low-stance combat actions remain unfinished.
