# Tactical visual assets and compilation

This document records the current original art pipeline. It does not assert visual parity with Jagged Alliance 2 or completion of the full Granaderos specification. No renderer changes accompany this documentation/script addition.

## Ground and building materials

The original generated source is `assets/source/tactical-materials-v1.png`, an RGB image measuring 1254×1254. Its built-in imagegen prompt and source provenance are in `assets/prompts/tactical-materials-v1.json`. The supplied JA2 screenshot informed the intended muted tactical aesthetic; these textures were not cropped from that screenshot or extracted from the game.

The atlas has nine 418×418 cells, in row-major order:

| Row | Left | Center | Right |
|---|---|---|---|
| 1 | Dry grass | Dirt | Cobble |
| 2 | Green grass | Mud | Terracotta floor |
| 3 | Plaster | Clay roof | Timber |

`tools/compile_tactical_materials.py` removes three pixels from each cell edge, producing a 412×412 crop, resizes it to 256×256 using Pillow LANCZOS, and encodes RGB WebP at quality 92. It writes identical `terrain-{name}-v1.webp` copies to `assets/web` and `web/public/art`. The material names are `dry-grass`, `dirt`, `cobble`, `green-grass`, `mud`, `floor`, `plaster`, `roof`, and `wood`.

From the repository root, with Pillow installed:

```sh
python3 tools/compile_tactical_materials.py
python3 tools/compile_tactical_materials.py --check
```

The check mode does not write files. It verifies every output in both destinations byte-for-byte and prints SHA-256 hashes. All eighteen existing files matched the compiler in the audited environment. WebP encoding can vary between Pillow/libwebp versions; retain the printed hashes and use matching codec versions when byte identity is required. The source crop/resize specification remains deterministic even across encoder revisions.

`web/app/TacticalScene.tsx` consumes the material names as SVG patterns, projecting ground textures onto the isometric terrain while using plaster, timber and roof textures on building geometry. Water is currently procedural geometry/color rather than a separate generated material. This document does not change those choices.

## Transparent scenery

Six original built-in imagegen sprites are available as `scenery-{tree,poplar,shrub,rocks,barrels,hay}-v1.webp`. Source, prompts, crop coordinates and preparation details are preserved in:

- `assets/web/scenery-source-v1.png`
- `assets/web/scenery-v1-prompts.md`
- `assets/web/scenery-v1.json`
- `assets/web/prepare-scenery-v1.py`
- `assets/web/scenery-atlas-v1.png`

Each runtime sprite is 512×640 with a nominal ground anchor at pixel (256,576), or normalized (0.5,0.9). The actual content bounding boxes differ; rendering every file at the same height does not make their visible objects equally large. The atlas is repacked into equal cells without redrawing or scaling the source objects.

The accepted source has genuine RGBA transparency. Two intermediate generation edits produced opaque checkerboards and were rejected. Preparation crops visible alpha bounds with safety padding and preserves alpha inside each crop; lossless WebP alpha was checked byte-for-byte against the prepared canvas. RGB colors beneath alpha-zero pixels can look like colored rectangles in viewers that ignore transparency; those are not runtime backgrounds. Inspect the assets in an alpha-aware renderer.

## Units and motion

The current runtime uses original articulated atlases through `web/app/SpriteFigure.tsx` and `web/app/useUnitMotion.ts`. Source rigs, rendering and packing tools are under `assets/rig`, including infantry, cavalry, combat-action and low-stance pipelines. Runtime atlas metadata includes `assets/web/infantry-animation.json`; other relevant manifests and previews are beside it. These are distinct from earlier imagegen action-pose sheets retained in the asset tree.

The sprite component selects Granadero/Royalist infantry, standing/crouching/prone movement, mounted motion and fire/reload/strike sequences. Infantry generally uses 192px cells, eight directions and eight movement frames; cavalry uses 256px cells. Fixed projected anchors and posture-specific framing keep the feet near the ground coordinate. Renderer integration and manifests, rather than the existence of unused source pictures, determine which artwork is visible in play.

Character portraits and inventory imagery have separate original generation prompts under `assets/prompts` and build scripts under `assets/`. Their presence should not be confused with complete tactical character-specific uniforms or a full period equipment-slot simulation.

## Verification and remaining gaps

The terrain compiler reproduces all current terrain exports exactly. Scenery dimensions and alpha were inspected and exported non-destructively. These checks establish asset integrity, not artistic quality or player acceptance.

The remaining visual work includes judging perceived scale and camera consistency in real tactical scenes; preventing repetitive texture patterns; improving natural transitions between terrain types; richer damaged/interior structures; more regional vegetation variants; convincing mounted combat and action transitions; and character-specific silhouettes/equipment where gameplay warrants them. The six scenery objects alone do not supply an entire Argentine environmental art set. Current procedural building faces are an implementation choice rather than hand-authored artwork for every historic structure.

Browser review must check occlusion, roof hiding, tree fading, unit selection, night lighting, zoom, movement anchors and readability at the actual viewport. A screenshot that looks better is evidence of that frame, not proof of all maps, all animations or complete JA2-level fidelity. Keep those claims separate from the reproducible asset pipeline documented here.
