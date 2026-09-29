# Compatible ammunition and implicit ignition kit

Implementation in [PR #130](https://github.com/fsodano/granaderos/pull/130),
updated to include the published documentation from PR #129. Runtime source
`a464ee32e4ee98937168fda35b136aad9b916b83` includes the recovered-ground correction.
Publication of this combined source is pending final checks and merge.

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

Recovered ground bundles count toward the finite return allowance only when they
were already present before deployment. Their identity and family must match;
only actual depletion counts. New bundles, duplicate source records and dead
carriers cannot create extra credit. Partial pickup, picking up and dropping the
same stock again, saved peaceful returns and combat retreats preserve finite
stock. Legacy generic ground sources migrate to the same musket family as their
saved scene.

## Verification

- Initial remote verification on `3e1777128550a2f6ed32254ccc921a2774efd182`:
  all five checks passed in [run 36598764414](https://github.com/fsodano/granaderos/actions/runs/36598764414).
  The complete shards passed 259 + 286 + 359 + 372 = **1276/1276**. This supersedes
  the earlier local resupply-price failure, whose obsolete expectation was fixed.
- Review reproduced four failures in saved ground recovery and settlement. The
  correction passes 21 related tests, including five saved-stock simulations and
  one mounted production-control test. The complete combined regression on
  `a464ee32e4ee98937168fda35b136aad9b916b83` passes **1282/1282**, with zero failures or skips.
- Eight new tests cover all nine firearms, wrong-family rejection, exact transfers,
  drops/collection, save migration, weapon changes, pocket capacity and slow
  multi-barrel reload conservation. All passed.
- Type check and production export passed (735 files, 637 asset references).
- All 36 baseline comparisons passed.
- Desktop preview on port 3132: musket and pistol reserves are distinct; the pistol
  detail identifies its compatible family and all eight visible inventory images
  load. No browser console errors. Ignition supply controls are absent. Maintenance
  remains visible with its action cost. No mobile or responsive changes were made.
- Combined desktop preview on port 3134 at 1280 × 720: a separate imported QA save
  starts with nine musket and two pistol rounds. The ordinary inventory drops four
  musket rounds and the field picker collects two. Seven musket rounds and both
  pistol rounds remain in the pockets, two musket rounds remain on the ground and
  the loaded round remains in the firearm. All eight visible item images load;
  no console errors. The QA save contains an extra pistol stack for presentation
  review; actual paid deployment and settlement are covered by the simulations.

The new rifle, pistol and shot images were generated with the built-in image
generator and saved as transparent 256-pixel WebP files. The existing musket
image is reused. See the [prompts and asset paths](../../web/public/art/supplies/ammunition-prompts.json).

This does not establish advanced-checkout integration, full JA2 ammunition variants,
individual historical calibers or sustained combat frame rate.

The [combined evidence record](../evidence/typed-ammunition.json) contains source
and log hashes. The [desktop capture](../evidence/typed-ammunition.png) shows the
separate stacks after partial collection. Final remote checks and merge are pending.
