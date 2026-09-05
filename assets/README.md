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
