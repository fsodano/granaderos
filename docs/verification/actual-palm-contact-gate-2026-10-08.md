# Actual palm contact gate

Baseline: `f01916b070b4dfd59a92ef20c50d184ba8a194a1`, after PR #286.

The CPU sabre contact test passed a palm selector to its surface helper, but
the helper ignored that argument. It therefore measured the whole body against
the grip. That assertion did not establish actual right-palm contact.

The helper now applies its selector to both the mesh and every triangle vertex.
The palm selector accepts skin triangles with more than half of each vertex's
weight on `hand_r`. It requires at least eight nondegenerate triangles. A
separate geometric assertion confines all accepted points to twice the current
native wrist-to-middle-MCP distance. An ignored filter can no longer pass by
returning the chest, cuff, boot or head surfaces.

All five tests in `tests/three-melee-contact-fit.test.mjs` pass locally in about
62 seconds. The 40 LOD0 sabre contact samples cover both anatomies, cardinal and
diagonal direction, standing and crouched targets, and all five strike variants.
They use 414 or 446 actual palm triangles and meet the owned grip surface at
every sample. Native offsets/scales, free guard, fixed gameplay cells, one finite
paid result, full native support cycles and target fallback checks also pass.

The [measured receipt](../art/reviews/standing-sabre-thrust-wrist/actual-palm-contact.json)
records each case and the unchanged body/bank hashes. Generate a new receipt
with `GRANADEROS_PALM_RECEIPT=/tmp/palm-contact.json node --test tests/three-melee-contact-fit.test.mjs`.

This is a test correction. It changes no released runtime, gameplay or asset.
Surface contact alone does not prove nonpenetration, every finger mechanism,
every detail level, clothing clearance or complete visual polish.
