# Four ammunition families across the game variants

The published game and the advanced local game now use the same catalog in
`game/ammunition-families.js`. Historical caliber names are migration keys.
The player chooses one of four families:

| Family | Default firearms |
|---|---|
| Musket | Brown Bess, Charleville, cavalry carbine |
| Rifle | Baker rifle |
| Pistol | Horse pistol, dueling pistol, double-barrel pistol |
| Shot | Shotgun and blunderbuss |

Each family has its own name and image. The published editor can override one
firearm's family, as recorded in [PR #132](authored-ammunition-family.md).
That is one selected family per firearm. Alternative loads with different effects
remain open.

## Published scope

Runtime source: `05fc52514697eea83ee9d7eb88f3dedccc8c0f9e`.
The published ammunition adapter reads the shared catalog. Existing public IDs,
names, images, default compatibility and authored overrides remain unchanged.
All thirteen catalog, typed-ammunition and authored-family checks pass. Types,
the production export (735 files, 637 asset references) and all 36 reference
comparisons pass. Complete remote checks gate the final PR head.

## Advanced local integration

The advanced game uses physical inventory stacks. Its ammunition format changes
from version 1 to version 2. Restoration groups the nine historical cartridge
labels into the four shared families, before current-state validation.

- Existing stacks keep their inventory keys, custom names, lot metadata and
  quantities. Hand references, cursor custody and pocket partitions stay attached
  to the same stack. Migration does not combine physical lots.
- Loaded guns keep their charges and unfinished loading. Compatible loose rounds
  can be used by every firearm in their family. Both pistols draw from that same
  finite reserve.
- Campaign stock, depots, merchants, paid production, shipments, convoys,
  delivery notices and battle-return totals are grouped once. Actual source
  receipts remain totals; migration does not create inventories for them.
- Personal, captive, militia, enemy, mission-ally, corpse, ground, container and
  NPC-gift holders are included. Missing versions, inconsistent old counters,
  invalid hand references and retired aliases in a new save are rejected.
- A fresh campaign retains 300 rounds: 180 musket, 30 rifle, 50 pistol and 40 shot.
  Shop caps and replenishment preserve the sum of the old stocks. Cartridge
  weight, twenty-round pocket limits, action costs and gun capacities stay intact.
- Purchase, production and import lists offer four choices. The purchase form
  names compatible guns and shows the selected family's image. Inventory artwork
  also uses that image.

Seven migration checks include an actual version-one save, repeat restoration,
sector return and reentry, malformed input, field ownership, paid deliveries and
previous battle receipts. Related tests cover finite issue, paired reloads,
capture, rescue, transfers, pocket loading, AI and merchant stock.

The preview loads all four images. Buying 20 pistol rounds changes the reserve
from 50 to 70, shop stock from 180 to 160 and treasury from 3,173 to 3,113 pesos.
It reports no browser errors. [Purchase capture](../evidence/four-ammunition-preview.png).

The 56-file local change was applied only after every target matched its recorded
pre-edit hash. All 743 other protected source/test files kept their hashes. Types
and the original checkout's production build pass (1,110 files, 997 asset
references). The local server on port 3000 runs this build.

An exported copy of the user's actual day-three Buenos Aires save migrates and
restores twice. All eleven tactical units retain their health, energy, position,
loaded rounds and physical cartridge totals. Inventory keys remain unchanged.
The browser resumes the same campaign, including its earlier casualties, with
family labels and no console errors. No gameplay order was issued in that save.
[Local campaign capture](../evidence/four-ammunition-live.png).

The complete original-checkout regression passes **3,223 of 3,231** cases.
Five failures include movement timing, the fresh campaign route, Córdoba
recapture and prisoner relief, plus a failed route parent. Three later route
milestones are skipped. The fresh route now stops earlier because its controller
expects an unavailable recovered gun in Córdoba; the earlier baseline reached
the northern relief-medic failure. The recapture now retreats instead of winning.
These changed campaign outcomes need further work. The eight added catalog
and migration cases pass; this result does not accept the full game.

## Limits

The final purchase form also caps each order at 60 rounds, even when the grouped
shop stock is larger. Its two related checks, types and export pass after that
form correction.

The advanced adapter and physical inventory runtime are still separate local
source. This published PR shares the catalog and records the local integration;
it does not publish the full advanced runtime. The evidence record stores exact
file hashes and test results. Movement-worker timing, the fresh-route recovered-gun shortage, Córdoba
recapture and prisoner-rescue failures remain open; the later relief-medic
acceptance cannot be re-established until the earlier route succeeds. Complete campaign,
smooth walking artwork, loaded-combat performance, advanced authored family
selection and alternative loads are not accepted by this change.

[Evidence record](../evidence/four-ammunition-families.json).
