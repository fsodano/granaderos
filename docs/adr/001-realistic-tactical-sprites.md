# ADR 001 — Realistic pre-rendered tactical pixel sprites

Date: 2026-09-06. Status: implemented; review evidence below.

## Context

The requested tactical characters must look like adult people in the four supplied
JA2 reference scenes. The previous Granaderos models looked like toys. The
portraits already meet the requested style and must stay unchanged.

`docs/web-port/` is engine analysis. It informed this change and remains unchanged.
Its engine reproduction checks do not establish artistic quality.

The existing renderer already displayed pre-rendered PNG atlases. The main gaps
were smooth primitive anatomy, uniform surface shading, and 192px source cells
scaled into a 52-unit draw box. Responsive SVG scaling and fractional zoom could
soften those images further. Changing the file format alone would not fix this.

## Decision

Keep offline Blender authoring and 2D raster playback. Improve the source anatomy
and materials, render at the intended logical pixel size, and display the result
with nearest-neighbor sampling and integer camera zoom. No live 3D models are
needed in the browser.

`assets/rig/field_art.py` now supplies:

- Smaller anatomical heads, hands, boots, and shoulder ornaments.
- A coat shaped at the waist, ribs, shoulders, and collar.
- Tapered cloth limbs with small irregular folds.
- Matte, subdued fabric variation and restrained specular light.
- Native-resolution rendering with a narrow pixel filter and no denoising blur.
- An orthographic elevation of `asin(14/26)` (about 32.58 degrees), matching the
  existing map diamond. The map, picking, and world coordinates stay unchanged.
- A camera target that puts the world origin at an exact integer pixel anchor.

The same revised soldier source supplies both factions, low stances, combat,
mounted riders, and civilians. Civilian clothing has its own subdued materials.
The horse has smaller ears and a narrower muzzle, with restrained coat variation.

## Asset and renderer contract

`assets/rig/pack_pixel_sprites.py` packs the finished frames without resampling.
It writes identical runtime atlases to `assets/web/pixel/` and
`web/public/art/pixel/`, plus a manifest with frame rectangles, bounds, anchors,
source hashes, and atlas hashes. Original source renders remain in `assets/rig/`.

| Layout | Native square cell | Ground anchor | Pixels per world unit |
|---|---:|---|---:|
| Standing, crouch, run, civilian | 52 | (26, 46) | 20 |
| Fire, reload, strike | 70 | (35, 62) | 20 |
| Prone | 62 | (31, 40) | 20 |
| Horse and rider | 76 | (38, 63) | 20 |

Extra space accommodates long weapons and horizontal bodies. It does not enlarge
people between actions. Mounted riders now use the same body scale as infantry.

There are **24 atlases and 1,088 frames**. Directions remain
`n, ne, e, se, s, sw, w, nw`; movement and action cycles retain eight frames at
10 fps. Idle atlases use direction columns; animated atlases use direction rows.

| Family | Included sequences, each in eight directions |
|---|---|
| Granadero and Royalist, each | Standing idle/walk/run/fire/reload/strike; crouch idle/walk; prone idle/walk |
| Civilian | Idle/walk |
| Cavalry | Idle/walk |

`SpriteFigure.tsx` uses only `/art/pixel/` for these characters. It takes layout
information from `game/sprite-layouts.js`, snaps the sprite origin to the logical
pixel grid, and sets pixelated image sampling. Ground-depth ordering and action
selection remain in the existing tactical components.

`Battlefield.tsx` measures its SVG viewport and uses 1×, 2×, or 3× zoom, with 2× as
the default. One logical pixel occupies exactly that number of CSS pixels. Camera
translation is snapped to logical pixels. The radar receives the actual visible
rectangle. Physical display pixels still depend on device pixel ratio and browser
zoom; fractional operating-system scaling is not claimed to be pixel-exact.

The old large atlases remain as historical assets. Legacy packers can expand the
native frames to their old layouts, but the active runtime uses the new packer and
native files. Do not substitute the old atlas set when adding another action.

## Reference evidence

Use these screenshots for adult proportions, compact pixel shading, human scale
beside furniture, grounded poses, and occlusion. Keep Granaderos uniforms and
weapons. The screenshots are references, not source textures or donor sprites.
They do not establish how the original game's source artwork was produced.

| Reference | Scene | Main cue |
|---|---|---|
| [1](references/tactical-reference-1.png) | Bar | Small heads and hands; people fit doors and furniture |
| [2](references/tactical-reference-2.png) | Dry compound | Muted clothing; readable standing and crouching figures |
| [3](references/tactical-reference-3.png) | Garden | Natural silhouettes; compact shading; grounded feet |
| [4](references/tactical-reference-4.png) | Shop | Consistent scale in a busy furnished interior |

An image-generation trial improved surface detail but returned RGB pixels with a
painted checkerboard and inconsistent frame placement. It was rejected for runtime
use. Final sprites come from the revised original Blender sources; no generated
checkerboard pixels or JA2 screenshot pixels are installed.

## Rebuild and review

From the repository root, use Blender and Python with Pillow:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_infantry.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_combat.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_low_stances.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_civilian.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_cavalry.py
python3 assets/rig/pack_pixel_sprites.py
node tools/preview-tactical-sprites.mjs
npm run typecheck
npm test
npm run build
```

Render infantry first; the remaining renderers load that source. The packer rejects
wrong native sizes, missing alpha, empty sprites, and clipped bounds. The web build
checks all 24 layouts, all frame slots, fixed anchors, and atlas hashes. Regression
tests reject missing families, stale 192px layouts, repeated frame records,
incorrect anchors, and changed idle pixels. Camera tests cover 375px, 768px, and
1280px viewports at all three zoom levels.

Review files are generated with the actual React sprite and scene components:

- [Previous sprites](../../assets/previews/tactical-pixel-art/before.png).
- [Current direction sheet](../../assets/previews/tactical-pixel-art/directions.png).
- [San Lorenzo outdoor scene](../../assets/previews/tactical-pixel-art/san_lorenzo.png).
- [Yatasto furnished interior](../../assets/previews/tactical-pixel-art/yatasto.png).
- Native animation previews: `assets/web/pixel/*-preview.webp`.

These are offline renders, not browser screenshots. Inspect movement, input,
resize behavior, and physical display scaling in the browser before claiming full
browser visual acceptance. Native render and build checks establish reproducible
assets and integration; resemblance to the references remains an art judgment.

## Validation results

- `npm test`: 247 passed, zero failed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 218 exported files and 134 asset references verified.
- Infantry, cavalry, and low-stance Blender rig audits: passed.
- Native atlas packing: all 1,088 frames have valid alpha and unclipped bounds.
- Runtime atlas PNG payload: 936,734 bytes (previous large atlases: 8,717,421 bytes).
- Local documentation links and `git diff --check`: passed.
- `docs/web-port/`: no changes.

## Scope and consequences

Portrait images, portrait panels, and portrait-generation pipelines are unchanged.
All 47 recorded portrait source and export hashes match the baseline.
Terrain and furniture art are unchanged. The whole tactical screen is therefore
not claimed to reproduce every visual detail of JA2.

Whole-number zoom replaces fractional zoom to preserve pixel edges. Camera motion
and unit translation step through logical pixels. This is intentional for this art
style. More detailed equipment variants, hit/death animations, mounted attacks,
and revised action choreography remain separate work; this change preserves the
existing sequence coverage.
