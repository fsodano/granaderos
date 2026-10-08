# Woman with shawl: skirt and shawl pigments

The native woman with shawl now has a charcoal skirt and retains her burgundy
shawl. The old source assigned the same burgundy material to both parts. This
small correction applies to all three body LODs and leaves their complete
binary geometry, UVs, morphs, normals, vertex colours, rig and animation data
exact. Gameplay rules and action clocks do not change.

## Retained reference

The retained full-body front identity is
[`woman-shawl-s-identity-reference.png`](../../assets/source/illustrated-sprites/woman-shawl-s-identity-reference.png).
Its provenance records the crop from `woman-shawl-idle-v1.png`. The three
`assets/previews/sprite-consistency/woman-shawl-{1,2,3}.png` pages retain the
same general colour roles. These are full-body references; skin face/hand
layers cannot establish garment identity.

The front identity shows a burgundy shawl, cream blouse and charcoal long
skirt. The retained crouch/strike prompts also specify a charcoal skirt with
a rust hem. The old native source deliberately used linear RGB
`(.105, .025, .035)` for both skirt and shawl, exported as atlas RGB
`(91, 44, 53)` (`#5B2C35`). This was a shared material recipe, rather than a
lighting or LOD fault. The old library review recorded the implemented
burgundy skirt; it did not record a separate approval to change the sprite
skirt's colour.

The corrected skirt uses RGB `(49, 48, 49)` (`#313031`), the median of the
8,505 pixels in reference rectangle `[220, 205, 301, 310]`. This illustrated
image already includes shading. The swatch is a colour identity anchor, not
a measurement of unlit PBR albedo or a promise of identical rendered pixels.
The authoring helper converts the sRGB bytes to linear values before assigning
them. The shawl retains its original pigment and wool material treatment.

## Exact asset boundary

The published correction copies the existing atlas and changes only its
32×32 legwear tile at x32–63, y96–127. All 1,024 new tile pixels are
RGBA `(49, 48, 49, 255)`; all other pixels are exact. The old atlas files remain
byte-identical. All 6,135 legwear vertices across the three LODs, including
their complete bilinear texture neighborhoods, sample the solid new tile.

Each body appends one copied image, texture and material, then changes only
the `Human_legwear_LOD#` primitive's material pointer. The copied material
retains its normal map, roughness map, factors, extensions and sampler.
The existing material/image/texture/sampler records and all shawl bindings
remain exact. Roughness `.91`, metallic `0`, specular IOR level `.28`, woven
normal amplitude `.018`, and the existing variable vertex shading remain
unchanged. The authoring source also separates the two material roles, so a
later full source export retains the corrected distinction.

| Body | SHA-256 after correction | File growth |
|---|---|---:|
| LOD0 | `d499fbc64310599eac95fa6bf15516d7aa320053942d4c7d8d6723438a67e8ec` | 428 bytes |
| LOD1 | `634a03bcebb26b070aad89fb9cd40ebbe6a52f78b7c9d184e67bfefd95d8d6b0` | 432 bytes |
| LOD2 | `de735c7d5ac5bb798a02255ccd1a626464ebb1581583396a5f5e9298f6b605be` | 428 bytes |

The one new 128×128 colour PNG is 380 bytes:
`textures/7e88592eeb20ec0f16ff.png`. Total asset growth is 1,668 bytes.
Triangle counts and geometry draw submissions do not change. One additional
colour texture is required; no broad crowd-performance claim is made.

The close donor identity changes because its material JSON changes. Both
coarse `nativeClothTopology.sourceSha256` fields now point to the new LOD0
hash, in the GLB extras and corresponding manifest records. No other cloth
support metadata changes. The field-only installer preserves whatever
current animation bank hashes, support records, cues and profile are present;
it never installs a complete older manifest.

## Validation and normal view

The source basis is main `13baee9c4ed990f3af5c094aca535ed67638e265` (the
reviewed coarse cloth increment). The palette candidate used identical body,
bank and garment-consumer inputs from `dfe41950` plus that exact coarse cut.
The 26 focused colour/garment checks, native asset verifier, locomotion
profile check and type check passed. A second exact committed validation used
`7c54c622` (the prone-heal source in main `1ee978fd`); all 35 colour, garment
and prone-heal support checks passed. Both current banks and complete support
records remained exact: male `49f5d77abe97ae560f46060f93d3fdd31661eda97e47dfdf029216ade2beeb27`,
female `509a9c2c1ab0cb2a7d38c8f50cb7809cfa9f6c4cc946c69652b6918fdeb1ac10`.
The current native verifier, profile check, type check and coarse repeat also
passed. The coarse cloth builder reproduces all
four bodies byte-identically with the updated donor identity. The palette
builder is also unchanged on repetition. An independent whole-file proof
found all other 99 model-folder files and all other manifest records exact.

Eighteen ordinary HUD captures compare the baseline and candidate at actual
LOD0/1/2 in standing, crouched and prone postures. They use the normal
**Ocho personajes** roster, owned primary pistol, inventory posture controls
and camera zoom controls. No battle, pose or private model state is injected.
All loaded model hashes match their recorded source; there are no browser
errors. The candidate separates the dark neutral skirt from the retained
burgundy upper shawl at each detail level. Full-resolution captures and the
source receipts are retained with the frozen review cut.

This accepts the pigment-role correction. The supplied sprite's rust hem,
shawl drape/fringe and satchel/strap details remain separate geometry work.
The fixed-prone surface checks keep their existing bounded scope; this colour
change does not establish complete moving-cloth clearance, pixel parity,
historical reconstruction accuracy or final body polish.

Root integration at `282ab5a1eb24d531d905ba82f1c48b8643c86eb4` is based on published main `1ee978fd` (PR #267). All 35 focused colour/garment/prone-heal checks pass in 11.754 s. Native/profile verification, typecheck, documentation and all 38 baseline checks pass. The production build is `ebdfd7cf9fc9`, with 1,246 static files and 1,040 asset references. Both the palette and coarse garment builders repeat the complete current model hashes exactly.

Root independently reran the whole-file proof against the current baseline: the three complete GLB BIN chunks, all 99 other model files, both current animation banks/support records and complete profile remain exact. Only the eight recorded woman-shawl manifest fields change. The new atlas differs in exactly 1,024 pigment pixels, with every other old pixel and old atlas file retained. A fresh before/current normal HUD run saved nine images per source at LOD0/1/2 in standing, crouched and prone. Cards, actors, posture costs and inventory text match, with no browser errors. Source hashes stay exact before/after capture; current served body, manifest, banks and new colour texture match their source files. Root visually compared the close standing before/current images and retained full sprite reference. Evidence is in `artifacts/three-woman-shawl-palette-current-review/`.
