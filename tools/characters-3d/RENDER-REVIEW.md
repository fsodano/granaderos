# Exported character frame review

This review uses the exported body, native animation bank, textures, equipment
and horse GLBs from the selected library. It does not run the authoring pose
generators. Keep that library unchanged while its capture is running.

From the repository root:

```sh
python3 tools/characters-3d/render-review.py --pilot --details
python3 tools/characters-3d/render-review.py --samples 8
python3 tools/characters-3d/review-contact-sheets.py
```

The first command captures Granadero and exploradora in four key poses, with
head and hand detail views. The second command captures all eight presets in
27 representative actions, with 84 frames for each preset. The third command
makes one overview and seven motion sheets for each preset. It needs Pillow.

Add `--all-reviewed` to include all 29 distinct accepted standing reference
motions, including each weapon's walking motion, all cuts and thrusts, bayonet,
and weapon strikes. With the posture, loading and fall samples, this produces
41 actions and 126 frames per preset (1,008 frames for all eight). The bayonet
sample attaches the exported Brown Bess socket fitting used in the lab.

The default Blender path is `/Applications/Blender.app/Contents/MacOS/Blender`.
Use `--blender /path/to/blender` on another system. Results go to
`artifacts/character-anatomy-review/baseline/`. Each run replaces `index.json`
and `index.html`; use a separate `--output` directory to keep an earlier run.
The contact sheet index is `sheets/sheet-index.json`.

Use `--skin light`, `--skin brown`, or `--skin dark` to apply the runtime Skin
palette from the manifest. This replaces the material's base factor and retains
the exported skin texture, vertex pigment, and normal map. With no `--skin`,
the exported base color remains in use. Use separate output directories for
palette comparisons.

For an isolated body probe, keep the exported filenames and sibling textures:

```sh
python3 tools/characters-3d/render-review.py \
  --body-dir /tmp/character-probe/models \
  --presets granadero woman-scout --pilot --details \
  --output /tmp/character-probe/review
python3 tools/characters-3d/review-contact-sheets.py \
  /tmp/character-probe/review/index.json
```

For a complete candidate library, use `--library-dir /tmp/character-review-models`.
This reads that directory's manifest, bodies, banks, equipment, horse and textures.
Every asset must match that manifest. It also uses the candidate socket metadata,
which matters when reviewing paired weapon-grip changes. The report distinguishes
unpublished candidates from production files. `--body-dir` can still override only
the body inside either library.

The appearance, motion and equipment increment tools accept `--directory` for
a complete private copy of the library, and `--source-directory` for frozen
authoring source. Retain the source tree layout and its `game` contract when
freezing it. They check that source and target files did not change during the
build, and stage selected replacements before updating the manifest. Motion
filters use semantic posture names such as `standing` and `crouched`, not clip
prefixes such as `stand`. An empty selection is an error. A changed firearm
socket requires matching body exports, weapon geometry and all affected motion
clips; an isolated mesh or single standing pose is only a diagnostic probe.

Use the full `build-library.py` builder with the same directory/source options
when socket and motion changes must be rebuilt together. Start with a new
private output directory. The full builder and all increment writers share
one publication lock per canonical library path; calibration writes use the
same lock. A motion increment calibrates its staged bank before replacing any
destination files. The strict native rig check includes hierarchy, rest
transforms and inverse bind matrices, not just bone names.

Select an existing review action with `--clips stand.fire.long-gun`. The item
mapping in `REVIEW_CLIPS` supplies the physical equipment. For an additional
action, add its item mapping before reviewing weapon attachment. Clip labels
are the actual exported action names; frame times come from duration and event
markers in the exported manifest.
Explicit throw diagnostics also map `gesture.throw`, `gesture.throwKnife` and
`gesture.bolas` to their exported grenade, knife and boleadoras. The renderer
hides the held object at its declared release marker, as the runtime does;
it does not invent a projectile path.

To inspect a suspected discontinuity, select one clip and pass exact sample
times, for example `--clips stand.punch.unarmed --times 0.166667 0.183333 0.2`.
Times are seconds in that exported clip; values outside its duration are
rejected. Use `--details` for matching head and hand views. Each requested time
is recorded with its asset hashes and PNG in the review index.
Add `--hand-details` for separate close views of the left and right hands.
These retain the same isometric camera direction and expose finger shape and
contact that the combined hand view can hide.

The JSON records the Git revision, manifest and input hashes, external texture
hashes, renderer settings, native bind-frame comparison, clip times, active
props, morph weights, joints, cameras, lighting, and PNG hashes. A changed published GLB
or a different native bind frame stops the capture. Each completed frame is
added to the index. Only a successful full run sets `complete: true`.
The exact capture script and runtime cloth source are also copied into
`frozen-sources/` so subsequent source edits cannot erase that evidence.

The renderer uses the settled runtime cloth posture weights. For garments with
`cloth_supine`, the posed chest's facing direction selects a continuous blend
between face-down and face-up drapes. The runtime adds its normal 45 ms smoothing;
the still renderer captures the settled weights. Two-target garments retain
their original behavior. It applies item
grip offsets, timed ramrods, and the animated horse saddle position. It does
not simulate crossfades, cloth smoothing, projectile effects, gameplay timing,
or gameplay skin changes after the selected palette. Static frames can expose shape and contact
errors. They cannot establish that an animation has natural timing or that all
334 clips are correct. Check live playback in the lab as a separate step.
