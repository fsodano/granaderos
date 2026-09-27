# Skin tones

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../verification/published-progress.md) for the main branch baseline.

The same animation atlas now supports light, brown, and dark skin. Uniforms,
equipment, and poses retain their original image. A grayscale skin overlay is
coloured by an SVG palette filter, restricted to the displayed frame.

Coverage: 240 active atlases, eight directions each. The masks total 3,216,413
bytes (about 3 MB); this does not triple the animation download.

`game/sprite-skin.js` selects the tone. An explicit `unit.skinTone` value of
`light`, `brown`, or `dark` takes priority (`white` and `black` are also accepted).
The named cast uses its existing portrait art direction. Fictional mercenary
entries use the authored portrait descriptions, recorded in
`game/sprite-skin-roster.js`. Other units use a stable hash of their ID. No game
statistics, faction, name, animation state, or health determine the tone.
Existing saves do not need migration. Portrait images remain unchanged.

Masks are stored in `assets/source/skin-masks/` and copied to
`web/public/art/skin/`. Aim and dead masks are exact copies of the corresponding
fire/collapse frame. Death does not change the skin layer or start breathing.

## Rebuild

Use an isolated Python environment with torch, torchvision, transformers, pillow,
and numpy. The offline candidate parser is
[mattmdjaga/segformer_b2_clothes](https://huggingface.co/mattmdjaga/segformer_b2_clothes),
pinned at revision `584abc1e1d260e23c0fc627c5217a09b2b461046`. Its face/arm labels
are restricted by a warm-colour gate that retains eyes, hair, outlines, and ivory
cloth. The fall template has additional exposed-skin regions because the parser
is less reliable on lying bodies. No model or model dependency ships in the game.

1. Run `python tools/skin-masks/build.py` (`--force` regenerates candidates).
2. Run `python tools/skin-masks/correct-falls.py`.
3. Run `python tools/skin-masks/correct-scalps.py` to include the friar’s exposed scalp.
4. Run `node tools/skin-masks/finalize.mjs`.
5. Run `node tools/skin-masks/preview.mjs` and inspect the local preview at
   `assets/previews/skin-tones/index.html`.
6. Run the skin tests, type check, and build.

Generated masks are approximate segmentation, with source-aligned pixels and
fall corrections. Browser review covers the eight standing families and sample
mounted, prone, and fall views; it is not a manual trace of every skin boundary.
The original images remain intact, so a mask can be corrected independently.

The build checks mask coverage, dimensions, file checksums, and source hashes.
Finalization additionally checks that masks do not extend beyond source alpha.
Tests cover stable assignment, explicit overrides, separate SVG filter IDs,
unchanged base-image rendering, and exact collapse-to-dead mask continuity.

## Game integration audit

The runtime audit renders all 240 active sheets with each of the three palettes
in all eight directions (5,760 combinations). It checks for missing-art fallbacks,
matching overlay names, and filter bounds aligned with the displayed frame.
A scene test also checks allies, Royalist enemies, and civilian NPCs after battle
creation and JSON save reload. Portrait-description corrections cover IDs 110, 119, 122,
127, and 136; eye colour must not be used as skin colour.
