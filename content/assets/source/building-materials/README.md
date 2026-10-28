# Approved building material sources

Generated with the built-in image-generation tool on 2026-09-12. The user
approved the plaster and clay images as the intended realistic material style,
then requested more era-appropriate materials and a cart beside the Pulpería.
These original PNGs are retained unchanged. Runtime WebP files are prepared by
`node tools/prepare-building-materials.mjs`; it preserves material detail while
resizing, makes colour variants of the plaster, and retains the cart alpha.

## Generation prompts

Shared material specification: production seamless square texture, orthographic
front-on view of the material, detailed gritty realistic late-1990s isometric
tactical-game environmental art. Rich realistic surface detail, not cartoon,
no vector outlines or stylized blobs. Small hard pixel clusters that read at
256px material resolution. Flat diffuse light, no scene, building silhouette,
perspective, text, border or vignette. Fill the whole square, seamless edges.
Natural nonuniform weathering and local crevice shadows. Era 1810–1820 Argentina.

- **plaster-v1.png:** Weathered colonial lime plaster over adobe. Neutral warm
  grey midtones for later tinting. Irregular layered flaking patches, fine
  aggregate, pitting, small branched hairline cracks, partially exposed rough
  substrate and moisture-stained patches at several scales. No regular grid or
  large symbolic cracks. Restrained values without pure white or black.
- **clay-v1.png:** Old hand-fired Spanish colonial barrel roof tiles, viewed
  directly onto the roof plane. Staggered overlapping lips, dark irregular
  seams, muted burnt brown-red clay, dusty grey patches, soot-darkened clusters,
  chips, moss and lime deposits. Small individual variation plus larger patches
  crossing multiple tiles. Rounded relief and granular worn surfaces. No square
  checkerboard, bright outlines or perfect repeated rectangles.
- **brick-v1.png:** Old handmade colonial brick masonry wall. Uneven small warm
  dusty red-brown fired bricks in staggered courses, recessed pale earth/lime
  mortar, chipped corners, patches of thin worn limewash, soot and moisture
  stains across irregular areas. Cohesive muted earthy tones. No concrete blocks.
- **timber-v1.png:** Old weathered vertical timber planks for rural buildings and
  cart carpentry. Uneven grey-brown hardwood boards, rough grain, knots, cracks,
  worn splinters, small hand-forged nail heads and deep narrow joints. Variation
  across boards and dark age-stained patches. No bright varnish or modern siding.
- **thatch-v1.png:** Dense worn straw roof, viewed directly onto the roof plane.
  Overlapping irregular dry-straw bundles, muted ochre-brown, coarse fibres with
  fine shadows, dark aged patches, small uneven wisps and layered thickness.
  Staggered courses almost concealed by straw. No rectangular tiles or checkerboard.
- **cart-v1.png:** Standalone 1810 Argentine wooden ox cart on transparent alpha.
  Two-to-one dimetric view looking down about 28 degrees, front and right side
  visible, long axis upper-left to lower-right. Rough grey-brown timber bed and
  side boards, two large thin spoked wheels with iron rims, iron fittings,
  projecting shafts, rope and a sack. Detailed realistic tactical-game sprite,
  natural worn grain, pitting, chipped edges and deep crevice shadows. Muted
  earthy colours, no cartoon outlines or toy proportions. Full object with
  padding and a tight wheel contact shadow. No animals, people, text or scenery.
  Clear at about 85 by 65 game pixels; coherent top-left diffuse lighting.
