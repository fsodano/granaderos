# Granaderos original artwork

Generated with the built-in OpenAI image generation tool on 2026-09-05.
Full prompts are retained under `prompts/`; full-resolution tool outputs are
preserved under `source/`. `san-lorenzo-menu-v2.png` is the approved menu image;
v1 is its original painting without typography. No external photographs or
third-party game art were inputs to generation.

These images are historical interpretations, not documentary reconstructions.
Cabral's portrait is an invented likeness, informed by the supplied character
specification. Uniform details and convent placement still need historical art
review. The portrait is static: JA2's existing nonanimated-face path handles it.
Eye and mouth animation remains outstanding. The browser roster now has all
thirteen static portraits; see the browser section and portrait-references.md.

## Engine assets

| Source | Output | Format | Mod destination |
|---|---|---|---|
| `san-lorenzo-menu-v2.png` | `san-lorenzo-menu.sti` | 640×480 RGB565 | `Loadscreens/MainMenuBackground.sti` |
| `juan-bautista-cabral-v1.png` | `cabral-tactical.sti` | 48×43 indexed ETRLE | `Faces/03.sti` |
| same | `cabral-dialogue.sti` | 90×100 indexed ETRLE | `Faces/b03.sti` |
| same | `cabral-recruitment.sti` | 106×122 indexed ETRLE | `Faces/BIGFACES/03.sti` |

The Cabral profile uses `ubFaceIndex=3`. `TableData/Layout/LayoutMainMenu.xml`
loads the new background and disables the separate original JA2 logo. This
configuration uses the existing engine loader, not a new rendering system.
Menu button labels are provided by the engine's language assets and require the
Spanish build/data configuration. Existing foreign character voice audio and
camouflage variants must be replaced or disabled before a complete conversion.

## Reproduce and verify

Install Pillow in your Python environment (`python3 -m pip install Pillow`).
From the repository root, `python3 tools/sti_assets.py` rebuilds all images,
copies them into the mod, and records source/output hashes in `manifest.json`.
Individual conversion commands are:

```sh
python3 tools/sti.py assets/source/san-lorenzo-menu-v2.png assets/engine/san-lorenzo-menu.sti --size 640x480 --preview assets/previews/san-lorenzo-menu.png
python3 tools/sti.py assets/source/juan-bautista-cabral-v1.png assets/engine/cabral-tactical.sti --size 48x43 --mode etrle --preview assets/previews/cabral-tactical.png
python3 tools/sti.py assets/source/juan-bautista-cabral-v1.png assets/engine/cabral-dialogue.sti --size 90x100 --mode etrle --preview assets/previews/cabral-dialogue.png
python3 tools/sti.py assets/source/juan-bautista-cabral-v1.png assets/engine/cabral-recruitment.sti --size 106x122 --mode etrle --preview assets/previews/cabral-recruitment.png
python3 -m unittest discover -s tests -p test_sti.py -v
```

The preview PNGs are decoded from the final STI files, including RGB565 color
quantization and indexed palette conversion. They were visually inspected.
Tests independently check primary-color byte ordering, run splitting and
transparency, malformed streams, original engine fixture compatibility, and
all delivered engine assets. This verifies file format contracts; it does not
substitute for loading the menu and Cabral in a running Windows game.

The ETRLE converter reserves palette index zero for transparency and preserves
opaque black as a distinct palette entry. Alpha uses a 128 threshold because
JA2's indexed sprites do not support partial transparency. RGB565 surfaces
reject alpha input rather than silently dropping it. Image resizing is
necessary format conversion using aspect-preserving crop and Lanczos sampling.

## Browser game delivery

The browser game uses `web/`, which contains eight web-sized assets with retained
PNG masters and generation prompts. Run `python3 assets/build_web.py` to rebuild
them. `web/manifest.json` records dimensions, byte lengths, SHA256 hashes, alpha
bounds and suggested normalized anchors. Copy this directory into the browser
public asset directory or serve it directly. WebP is used for opaque paintings;
PNG retains original generated alpha for unit/building cutouts.

| Browser file | Dimensions | Use |
|---|---|---|
| `main-menu.webp` | 1448×1086 | Painted title screen with GRANADEROS lettering |
| `san-lorenzo.webp` | 1448×1086 | Same landscape, without title |
| `cabral.webp` | 384×384 | Cabral roster portrait |
| `granadero.png` | 256×256 RGBA | Navy/red dismounted saber unit, southeast facing |
| `royalist.png` | 256×256 RGBA | White/red musket unit, southwest facing |
| `cavalry.png` | 384×384 RGBA | Mounted navy/red Granadero, southeast facing |
| `convent.png` | 512×512 RGBA | Isometric colonial convent building |
| `grassland.webp` | 512×512 | Low-contrast painterly grass ground texture |

These are single static unit poses, not eight-direction animation sheets.
Movement can reposition the sprites but does not yet animate their limbs.
The convent is a simplified interpretive building and does not reproduce the
full San Carlos complex. Grass was prompted as a repeating texture; exact
edge continuity has not been mathematically guaranteed. All four transparent
cutouts were verified to contain real alpha from 0 to 255, with no opaque
background. All content text is Spanish or numeric; documentation is English.
The original Windows STI deliverables remain available as a conversion artifact;
the browser game should use the web files above.

## Complete browser roster portrait set

All thirteen operative IDs (0 through 11, plus 57) now have original static
portraits at `web/portrait-{id}.webp`, each 384×384. Cabral 3 reuses the initial
portrait. All masters and prompts are retained. `build_web.py` includes the
full set in the hash manifest. Copies are installed in `web/public/art/` at
the repository root. See [portrait-references.md](portrait-references.md) for
historical context and limits of the interpretive likenesses.

## Artillery, foundry and infantry action poses

`web/cannon.png` (384×384, RGBA) is an original southeast-facing bronze
smoothbore field cannon. It can represent the 4 lb class; scaling the same art for
8 lb guns is a gameplay symbol, not evidence of exact historical dimensions.
`web/foundry.png` (512×512, RGBA) depicts a colonial ordnance workshop with an
open forge, anvil and barrel stock. Both are installed in `web/public/art` and
included by `build_web.py`.

`web/granadero-actions.png` is a 1280×640 transparent atlas, with 4 columns and
2 rows of 320×320 cells. Row 0 faces southeast and row 1 southwest. Columns are
idle, aimed fire, ramrod reload, and bayonet strike. The matching JSON gives
all source and atlas rectangles, hashes, names and anchors. Foot anchor is
(160,300), normalized (0.5,0.9375). Single frame files are also shipped as
`granadero-{se|sw}-{idle|fire|reload|strike}.png`, so the UI can switch action
poses without atlas cropping. All use a common scale and anchored baseline.

Rebuild the atlas with `python3 assets/build_action_atlas.py`. This mechanically
extracts the generated figures from measured source rectangles and packs them
into uniform cells. The raw generated sheet is not uniformly sliceable because
some musket barrels extend across its approximate grid; the delivered atlas
fixes packing without altering the artwork. It was visually checked for
separated figures, intact weapons, consistent uniforms and baseline placement.

These are action-state keyframes rather than fluid animation sequences. Each
action currently has one pose, two view directions exist, firing has no baked
muzzle flash, and the reload is a representative ramrod pose rather than a
complete historical drill. Equipment, anatomy and timing still need review.
The sprite carries a musket and bayonet; do not present it as a pistol or saber
animation. The initial separate Granadero token carries a saber. The first
source idle plume touches the source image edge, a small generation limitation
preserved in the source record. These painted action poses remain limited to two
directions. Separate original 3D infantry locomotion is now available below.

## Weapon inventory icons

`web/weapon-1800.png` through `web/weapon-1813.png` are fourteen original
256×128 transparent inventory images mapped directly to `game/data.js` IDs.
`web/weapon-icons.json` supplies Spanish names, source sheets and measured
extraction bounds, dimensions, alpha bounds and hashes. There is no text baked
into the images. Rebuild with `python3 assets/build_weapon_icons.py`.

The nine firearm icons distinguish long muskets, the Baker brass patchbox,
compact cavalry carbine, slender rustic shotgun, cavalry pistol, octagonal
barrel dueling pistol, bell-mouthed blunderbuss, and visibly double-barreled
pistol. The five melee icons show the curved Mameluke-style hilt, standard
cavalry knuckle guard, offset tubular socket bayonet, bamboo lance and facón.
Each was inspected after extraction. All outputs have real alpha, unclipped
content bounds, and a common inventory canvas. The sizes are normalized for
legibility, not a diagram of comparative physical weapon lengths.

Historical context was checked against the
[Australian War Memorial India Pattern musket record](https://www.awm.gov.au/collection/C236722)
and [Museo Histórico Nacional discussion of San Martín's saber](https://museohistoriconacional.cultura.gob.ar/noticia/sable-corvo-del-general-jose-de-san-martin/).
The exact firearm fittings, manufactured proportions, and generic local weapon
models remain artistic interpretations pending specialist review. No reference
photograph was provided to generation and these icons are not museum scans.
The 0–15 alpha source padding is excluded only for
content-bound measurement; surviving generated alpha is preserved in outputs.


## Cavalry action poses

`web/cavalry-actions.png` contains eight transparent keyframes in a 1536×768
atlas of 384×384 cells. Rows are southeast and southwest; columns are idle,
mounted fire, saber strike and charge. Every cell shares the foot reference
(192,360), normalized (0.5,0.9375). The matching JSON records source rectangles,
anchors and hashes; individual `cavalry-{direction}-{action}.png` files are also
installed in the browser. Rebuild with `python3 assets/build_cavalry_atlas.py`.

The accepted v3 source has true alpha. The earlier v1 source is retained only as
a rejected generation record because it baked a checkerboard into its pixels.
The mounted poses are action keyframes, not a horse locomotion cycle.

## Original eight-direction infantry locomotion

[The rig documentation](rig/README.md) describes the original Blender models,
articulated gait, reproducible rendering, frame offsets and verification.
Granadero and Royalist each have eight distinct walking poses in eight views
plus eight neutral idle views. Browser-ready atlases and metadata are installed
in `web/public/art`. The frames animate separate limb joints and preserve a
fixed projected world reference; they are not transformed copies of paintings.
The simplified miniature style differs from the painted action keyframes.
