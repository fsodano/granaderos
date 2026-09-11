# Removable bayonet fitting plan — I06

This records the implementation plan. The implemented subset, its tests and live checks are tracked in [the parity audit](ja2-parity-audit.md#inventory-transfers-and-equipment) and [live verification](ja2-live-verification.md); this plan is not itself a completion report. Code was inspected on 6 September 2026. It covers owned, compatible bayonet fittings and their complete equipment lifecycle. It does not add a Charge command, a combined fit-and-attack order, firearm readiness, or new art.

## Evidence and first compatible host

The source review is [period-equipment-evidence.md](period-equipment-evidence.md), rows H2, H3 and H5. The primary sources were verified in that earlier review; this plan does not claim a new examination of their scans.

- The [1808 Spanish infantry regulation](https://idus.us.es/bitstreams/395a6249-ef2f-4d93-907c-678d2f21ddba/download#page=48), printed p.40 §§52–53 and p.51 §§110–111, describes separate fitting and removal commands. Its AP costs are not specified in game units.
- The [Museo Histórico Nacional collection guide](https://museohistoriconacional.cultura.gob.ar/media/uploads/site-6/ACTIVIDADES%20EDUCACION/armas.pdf#page=7), PDF pp.7–8, identifies muskets with corresponding bayonets in the independence setting.
- The [Baker sword bayonet record](https://collection.nam.ac.uk/detail.php?acc=1963-10-147-1) and [Royal Armouries weapon account](https://royalarmouries.org/objects-and-stories/stories/waterloo-1815) support distinct fittings. They do not support a universal socket bayonet.
- Classic JA2's relevant choice is attachment compatibility and retained item condition: Patusco printed pp.47–48 and the [manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed p.23.

Recommended first release: an explicitly matched **India Pattern socket bayonet**, represented by existing weapon family `1811` plus `fittingPattern:'india_socket'`, fits only firearm `1800`. A catalog label must say which host it fits. This is a bounded model compatibility rule; it does not certify interchangeability between every historic specimen.

| Existing host | First-release rule |
|---|---|
| `1800` Brown Bess India Pattern | Accept only `india_socket`. |
| `1801` Charleville 1777 | Reject `india_socket`. Add its own corresponding pattern only after the exact fitting definition is documented. |
| `1802` Baker | Reject all `1811` socket patterns. Its sword bayonet is a separate future item/profile. |
| `1803` tercería, `1804` escopeta, `1807` trabuco | Reject. A long barrel or firearm category is not evidence of a mount. |
| `1805`, `1806`, `1808` pistols; blades; generic legacy weapon IDs | Reject. |

An old unmarked `1811` stays an owned, loose bayonet with an unidentified pattern. Do not infer that it fits the user's current gun. This permits existing saves without granting a new attachment. Local shop availability of the matched variant remains authored campaign supply, not a documented universal issue claim.

## Current behavior and implicit fitting paths

| Current path | What it does now | Required change |
|---|---|---|
| `game/tactical.js`: `bladeFor`, `weaponFor`, `hasFirearm` | A held firearm uses `BUTTSTOCK`; it does **not** receive a free bayonet. But any `1811` in primary or secondary hand gets the full 2-tile, 50-damage bayonet profile, regardless of a host. | Full bayonet thrust requires a valid fitting on the currently held primary firearm. Retain a separate short improvised profile for a loose bayonet; do not describe it as fixed. |
| `weapon` and `equipLoot` orders; strategic `equip` | Selecting a loose `1811` costs ordinary hand selection or equip AP. The result is treated as a complete bayonet weapon. | Hand selection cannot perform installation. Fitting is a separate inventory transaction against a real source item. |
| `brace`, `interceptCharge`, `runEnemyPhase` | `bladeFor(...).id===1811` enables bracing, with no host. `brace` reserves 16 AP without spending them; interception spends 16. Enemy turn completion can set `braced` automatically. | Gate these legacy guard rules on a valid, serviceable, fitted, held gun. Change text from “calar” to guarding; fitting and guard readiness are different states. No automatic fitting, extra free strike, or revived Charge UI. |
| `useItem`, HUD `targetPreview`, Battlefield action/animation dispatch | A held firearm always resolves ordinary item use to a shot. Melee calls `bladeFor` separately. | Use one shared contextual attack resolver for reducer, preview and animation. A fixed bayonet can thrust in reach while the primary gun remains selected. |
| `meleeStrike`, `interceptCharge`, legacy `charge` | Blade condition is retained as data but does not drive bayonet wear or damage. | Read and wear the actual attacking fitting. A firearm shot wears the firearm condition only. All legacy bayonet strikes use the same owned fitting gate. |
| `game/mercenaries.js`, `character-profile.js`, `garrison.js`, `narrative.js`, `data.js` | Authored infantry commonly has `blade:1811`; some hosts are `1801` or unrelated arms. | New issue may mark an existing owned item as a documented matched variant only through an explicit authoring table. Do not add another bayonet or silently match every recruit. Old records stay unmarked. |

The current ordinary movement momentum bonus is separate from fitting. Do not change that rule or reintroduce AI charge decisions as part of I06.

## Proposed data and pure helper boundary

Add `game/weapon-fittings.js`, importing equipment data but not tactical/campaign reducers. Proposed exports:

```js
FITTING_PATTERNS
validateFitting(fitting, hostWeaponId)
fixedBayonetFor(unit)                 // valid held primary fitting, or null
fittingWeight(record)                 // nested weight only; no double count
planFitBayonet(unit, sourceItem)      // pure cloned unit or Spanish error
planRemoveBayonet(unit, destination)  // 'inventory' or 'blade'; atomic
fittingItemIds(record)                // recursive owned identity claims
```

Use one canonical fitting record, with exact allowed fields:

```js
{ weapon: 1811, fittingPattern: 'india_socket',
  instanceId: 'item-42', condition: 73 }
```

The fixed object lives only at `unit.weaponFittings.bayonet`. The same field is `record.fittings.bayonet` when its host is in a pack, on the ground, in a chest or in the armory. A loose record keeps normal `{count:1, weapon:1811, loaded:0, jammed:false, weight:.5, condition, instanceId, fittingPattern}`. A loose secondary hand needs `bladeFittingPattern`; a primary hand holding the loose item needs `weaponFittingPattern`. Extraction must move and clear those fields with the item.

There is one owner: the loose slot **or** the fixed host. Fitting consumes exactly one source quantity. Removal moves that same object out. No simultaneous `blade:1811` mirror represents the installed item. The host owns its ammunition, jam and firearm condition; the bayonet owns its identity, pattern and condition. The fitting cannot have ammunition, another fitting, an arbitrary damage override, or a duplicated host identity.

Identity allocation must be deterministic and must not consume combat RNG. Preserve an existing item identity. When an unidentified legacy item is individually moved, allocate one identity in the authoritative action/migration boundary. Never derive it only from weapon model or repeat it on re-entry. `armory-N` is currently a storage-entry ID that ends when equipped; keep that ID separate from an item's persistent `instanceId`.

Proposed initial balance: fit 12 AP, remove 8 AP, healthy fixed thrust retains current 16 AP / 50 base damage / 2-tile reach. These are game tuning. Condition 0 disables a fixed thrust; each committed thrust wears the fitting by 1. Apply the damage factor `.5 + condition / 200` before existing damage processing. Fitting/removal itself does not repair either item. For a loose bayonet, propose 16 AP / 24 damage / 1-tile reach as a short improvised attack; it never receives the fixed 2-tile reach or brace interception. These proposed new values need a focused balance check, not a historical accuracy claim.

## Paid actions and player controls

Proposed orders are `{type:'fitBayonet', unitId, item:'blade'|'primary'|'inventory:<key>'}` and `{type:'removeBayonet', unitId, destination:'inventory'|'blade'}`. The target host is the currently owned primary firearm, not another soldier's inventory. Fitting a bayonet from a loose primary hand therefore rejects until a compatible firearm is equipped there; supporting the source token does not permit two primary weapons at once.

Use the existing inventory order gate: conscious on-field actor, legal player/interrupt window, sufficient AP, no knocked-down handling, no enemy orders from the player. Require the primary gun in hand to fit/remove; changing from a tool, medical kit or secondary weapon remains a separate paid action. A secondary slot can supply a sheathed bayonet while the primary stays selected.

Preflight compatibility, condition, source quantity, identity and removal destination capacity before changing AP, inventory, seed or clock. In combat, each accepted order pays once and can provoke the existing observation/noise reaction after the committed item transfer. In exploration it uses the existing paid-order time conversion and wound clock; no AP replenishment. If time collapses the actor, preserve the completed transaction and wound result. Use the shared ordinary equipment-handling sound, without introducing a historical noise-radius claim.

Show “Fijar al Brown Bess · 12 PA” on the loose item's inventory row and “Retirar · 8 PA” on the attached item under its host. The shared preview returns `{valid,reason,pa,source,destination,host,fitting}`. Show compatibility, the two separate conditions, weight and pocket effect. An incompatible item stays selectable for ordinary give/drop handling with a clear fitting rejection. Removal to a full pack fails; removal to an empty secondary slot remains available. Do not silently drop or overwrite a held blade.

Default hostile click with a fitted primary within thrust reach resolves to melee; outside reach it resolves to fire. The explicit fire order remains available for a deliberate close shot. All three consumers—reducer item routing, HUD cost/range label, and Battlefield attack animation—must use the same resolver. Do not infer melee solely from `hasFirearm===false`. A thrust consumes no cartridge and does not reprime a failed ignition. A loaded or jammed gun can still thrust if its fitting is usable. No new main-toolbar command is required.

AI uses the same paid fitting and attack orders. It may fit an available compatible item when melee is relevant and enough AP remains, but cannot create one or change equipment during target scoring. An unfitted firearm continues to use its stock for explicit melee.

## Conservation across each equipment boundary

| Boundary / exact integration points | Required invariant |
|---|---|
| `tactical-inventory.js`: `record`, `handRecord`, `extractItemQuantity`, `applyItemQuantity`, `itemDescriptor`, `validateItemStack` | Preserve pattern and nested fitting metadata, clear the source fields, validate exact nested shape and claim recursive identities. An identified/fitted host must have `count:1`. Legacy unmodified weapon stacks may still split without losing quantities. |
| `tactical.js`: `planEquipLoot`, `planLoot`, `rout`, `addGroundStack` | Host swaps move the fitting with the displaced gun. Normal drop/give/catch failure/corpse loot moves the full assembly once. The special routed `droppedWeapons` path must copy and clear the fitting explicitly; it currently copies only weapon/load/condition/jam/ID. Picking that entry up must retain the nested record. |
| Carrying: `carriedWeight`, `tactical-awareness.js` burden calculation, inventory descriptors | Loose `1811` uses its existing data weight .5 kg and one compact pack slot. Fixed weight is added once to the host; it uses no extra pack slot while fixed. A stowed fitted long gun occupies the existing two units with total assembly weight. Hands stay outside the 12 pack units. Current coarse blade weight is 1.3 kg: use a shared data-based calculation so fitting does not create a weight reduction exploit between hands/pack/fixed states. |
| `equipment.js`: catalog, `storeEquipment`, `takeEquipment`, `returnEquipment`, `migrateEquipment`, `validateEquipment`, `resaleQuote`; campaign purchase/equip/sell | Retain pattern and fitting across armory storage and strategic swaps. A fitted gun's sale removes the whole assembly and pays a clearly itemized condition-adjusted quote; do not leave its fitting behind or pay twice. Repairing the firearm must not reset fitting condition. |
| Finite supply | Add the named matched variant to merchant stock with a distinct stable stock key; old generic `1811` stock remains generic. Purchasing that variant creates exactly one matched item. Stock/replenishment/import delays remain finite and use their existing clocks. Supply is authored game availability, not proof of local manufacture. A separate variant key avoids relabeling all saved stock as compatible. |
| `squads.js` personal inventory; `campaign.js` report validation and `applyReturnedOperative`; `deployment-return.js` remains; `world.js` | Return the held fitting and loose metadata explicitly. Full reports must record removal rather than fall back to the prior fitting. Current living roster authority, departed receipts, captured equipment, and dead-body ledgers retain the same physical assembly without reissue or corpse refill. |
| `validate-battle.js`, `validateEquipment`, `validatePersonalInventory`, `save.js` | Validate attachments in hands, backpacks, dropped weapons, ground stacks and container contents. Claim nested IDs alongside existing IDs; reject host mismatch, counterfeit pattern, nested attachments, duplicate loose/fixed item and identified stack count >1. Traverse active ownership, not historical deployment mirrors, when checking campaign-wide uniqueness. |

Merchant identity must remain separate from item identity: selling/rebuying or swapping an armory entry may change `armory-N`, but cannot reset or duplicate its fitting. Campaign records and an in-progress snapshot are mirrors of one deployment, not two inventories. Cross-check their authority boundary without rejecting valid snapshots for containing the same issued identity.

Use a merchant variant key such as `1811:india_socket`, resolved to actual weapon ID `1811` plus its pattern. Do not pass that string into the numeric handheld-weapon validator. Armory aggregate quantities can remain by weapon ID; variant availability and labels must come from exact stored records, not show that aggregate once for each variant. Extend the current catalog lookup, `handheld`/stock-cap checks and price resolution explicitly so buying or selling an unmarked bayonet cannot substitute a matched one.

## Save migration and implementation order

Add a fitting rules version inside tactical/campaign state while retaining envelope schema 1. Old missing attachment fields mean **unfitted**, not a new bayonet. Existing loose IDs, quantities and condition remain; old undefined patterns mean unidentified. Do not inspect the current host to assign a pattern. Do not auto-fit `blade:1811`, repair it, or move it into an already full pack. Old overfull saves remain loadable and able to give/drop owned equipment.

After versioned migration, require explicit fitting fields in new complete reports, or normalize and compare their canonical presence so omitting an owned fitting cannot resurrect the prior copy. Stacked generic old bayonets remain legal; each moved quantity becomes a distinct item. Reject a fitted host stack rather than multiply one fitting identity. If broader anonymous nested legacy content is ever supported, its migration needs separate conservation tests.

Recommended sequence: pure fitting/schema helpers → inventory assembly transfer → tactical paid actions/contextual targeting/weight → battle and campaign validation/report migration → finite merchant variant and strategic swaps → inventory controls → full save and re-entry tests. UI must not ship with a preview that treats unimplemented reducer actions as usable. I06 remains missing/partial until the complete lifecycle is tested; browser verification is a separate check.

## Required tests

1. Compatibility matrix: only the explicit matched host accepts the first pattern; Charleville, Baker, carbines, pistols, missing/dropped guns and unknown legacy records reject atomically. No pattern is inferred from caliber or slot.
2. Fit/remove from pack and secondary slot conserves one identity, separate conditions, jam, loaded charge, spare cartridges and exact weight. Repeat orders reject without AP/time changes. Full-pack removal fails; empty-secondary removal succeeds.
3. Primary equipped fixed gun gives contextual thrust at shared reach/cost, fire beyond reach, and explicit close fire. Bare firearm gives stock melee. Loose or broken bayonet cannot produce full thrust or brace. Medical/tool/supply hands cannot borrow an unequipped fitting.
4. Every committed bayonet strike wears only the attachment. Fire/reprime/firearm repair cannot repair or wear it. Interrupted fit/remove and ordinary movement → thrust preserve remaining AP and JSON resume equality.
5. Give, failed catch, drop, pickup, partial unconscious/corpse loot, equip swap and routed weapon drop preserve the assembly once. No free item appears after repeated loot, reload or re-entry.
6. Matched variant purchase, finite stock exhaustion, delayed supply if used, assembly resale, exact strategic swap and a full campaign report/save/re-entry round trip preserve both conditions and pattern. Departed, captured and destination corpse paths keep ownership.
7. Malformed saves reject incompatible nested hosts, duplicate IDs across pack/fitting/ground/chest, pattern overrides, illegal weights, ammunition on fittings and fitted stacks. Legacy unmarked, generic and overfull records still load without being upgraded.
8. HUD/render tests use shared fitting and attack previews, show the separate condition, reject incompatible choices, and do not add Charge or combined fit-and-attack controls. Live UI test: buy or recover a real matched item, fit it, thrust, remove it, transfer it, save and reload.

Existing regression anchors: `unarmed-combat`, `operative-abilities`, `cold-steel`, `tactical-web`, `tactical-inventory`, `inventory-transactions`, `inventory-equip-save`, `merchants`, `equipment-web`, `validate-battle`, `tactical-exit-campaign`, `world-exits`, `ja2-hud`, and `ja2-controls-render`. Update only their implicit fitting assumptions. Do not alter unrelated weapon stats, seeds, authored map layouts or the campaign opening to make I06 pass.
