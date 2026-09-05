# Original cavalry locomotion

`cavalry-model.blend` contains the original infantry rider adapted to a seated
pose and an original horse assembled from simple meshes. Four articulated
hip/knee/ankle chains produce a four-beat walking sequence. Horse neck, tail,
body and rider torso have independent animation curves. No raster transforms,
external meshes or copied JA2 sprites contribute to the rendered frames.

Build with Blender running `assets/rig/render_cavalry.py`, then Python running
`assets/rig/pack_cavalry.py`. Verify saved curves by running
`assets/rig/audit_cavalry.py` inside Blender. Use the same installed Blender
command documented in README.md. The render script first opens the original
`infantry-granadero.blend`, which must be present.

Browser files: `cavalry-walk-atlas.png` is 2048×2048, eight columns of gait phases
and eight direction rows; `cavalry-idle-atlas.png` is 2048×256, eight direction
columns. Cells are 256×256. Directions are N, NE, E, SE, S, SW, W, NW. Play at
10 fps, a 0.8 second walking loop. `cavalry-animation.json` records the exact
normalized world anchor (0.5000002384, 0.8828744590), frame bounds and hashes. Draw approximately 140px
square for physical scale consistent with 96px infantry cells; both cameras
use the same orthographic elevation and azimuth. All output files and eight
animated WebP previews are installed in `web/public/art` by the packer.

Verification: all 72 frames have true alpha and unclipped edges. Every direction
has eight distinct frame hashes. The saved model audit verifies exact closure
of frame 1 with frame 9, motion of all four leg chains and independently raised
hooves. The full atlas and a southeast passing pose were visually inspected.

This is a walking gait, not a gallop or mounted combat animation. The miniature
style matches the original infantry rig rather than the painted assets. The
rider uses a generic curved saber and a fixed seated limb posture with torso
motion. Horse proportions, saddle fittings, rein attachment and weight transfer
remain simplified; there is no cloth, rein or stirrup physics. Existing painted
cavalry action poses are preserved separately.
