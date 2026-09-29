# Compatible ammunition and implicit ignition kit

Local implementation on source `8a06687ddb845eb2ea836afcd5aca2d46f3fac09`, based on
merged PR #128. This record does not claim publication on main.

The user removed separate priming charges and flints from the inventory design.
Soldiers have the basic ignition and maintenance kit. Misfires, weapon condition,
and the action/time costs of clearing a misfire or maintaining a firearm remain.
Workshop resupply no longer charges for ignition supplies.

Four ammunition families have separate pocket stacks and images:

| Family | Compatible firearms |
| --- | --- |
| Cartuchos de mosquete | Brown Bess, Charleville, Tercerola |
| Munición de fusil | Baker |
| Cartuchos de pistola | All three pistol models |
| Cargas de perdigones | Escopeta, Trabuco |

These are gameplay families, not a simulation of individual historical calibers.
Transfers, drops, collection and active saves preserve the family. A different
weapon uses only its compatible reserve; changing weapons does not convert it.
The inventory and roster show the compatible ammunition. Each family stacks in
quantities of 20 within the existing shared pocket capacity.

Legacy carried rounds migrate to the primary weapon family. Unarmed legacy
carriers and generic ground piles become musket ammunition. Existing rounds are
not granted again on restore. Obsolete mutable priming/flint fields and ground
piles are removed. Immutable authored packages keep their signatures; old dialogue
conditions see implicit full kit values (50 priming, 4 flints). New authoring does
not offer these supplies. The campaign keeps its existing paid deployment and
return/refund model; this is not full strategic ammunition custody.

## Verification

- Full regression: 1,275 passed, one obsolete resupply-price assertion failed.
  After correcting the removed-kit price from 87 to 46, the complete ending-route
  test passed. No runtime changes followed that full run.
- Eight new tests cover all nine firearms, wrong-family rejection, exact transfers,
  drops/collection, save migration, weapon changes, pocket capacity and slow
  multi-barrel reload conservation. All passed.
- Type check and production export passed (735 files, 637 asset references).
- All 36 baseline comparisons passed.
- Desktop preview on port 3132: musket and pistol reserves are distinct; the pistol
  detail identifies its compatible family and all eight visible inventory images
  load. No browser console errors. Ignition supply controls are absent. Maintenance
  remains visible with its action cost. No mobile or responsive changes were made.

The new rifle, pistol and shot images were generated with the built-in image
generator and saved as transparent 256-pixel WebP files. The existing musket
image is reused. See the [prompts and asset paths](../../web/public/art/supplies/ammunition-prompts.json).

This does not establish advanced-checkout integration, full JA2 ammunition variants,
individual historical calibers or sustained combat frame rate.
