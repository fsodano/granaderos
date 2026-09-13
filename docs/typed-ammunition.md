# Typed handheld ammunition

The nine handheld firearms now use compatible prepared loads. Changing the gun does not change cartridges already in a soldier's pockets. A musket cannot reload with Baker rifle ammunition. An empty gun with no compatible reserve shows a crossed reticle and names the required load.

Use **R**, or click to fire an empty gun, to start loading. Loading consumes compatible cartridges only when a charge is completed. Existing work stays on the physical gun across turns, hand changes, drops, campaign returns and saves. Two pistols use their own types and the same available AP budget. Exploration does not spend AP.

## Loads and supply

| Weapon | Prepared load |
| --- | --- |
| Brown Bess | Musket .75 |
| Charleville | Musket .69 |
| Baker | Rifle .62 with patch |
| Tercerola | Carbine .65 |
| Escopeta | Shot, gauge 16 |
| Pistola de Arzón | Pistol .69 |
| Pistola de Duelo | Pistol .50 |
| Trabuco | Scatter load |
| Pistola Doble Cañón | Pistol .54 |

The mapping is an explicit game rule. Musket and pistol loads stay separate even where the nominal diameter matches. This is not a claim that these simplified loads reproduce every historical ammunition practice.

Loose ammunition uses ordinary inventory stacks: 20 rounds per pocket, 0.04 weight per round. Stacks can be divided, combined when metadata matches, held, passed, dropped and recovered. A stack on the equipment cursor has its own custody and is unavailable to automatic reloads until placed back. The weapon cards show only the compatible reserve for each hand. Inventory shows every carried type.

The armory offers a type selector with its compatible weapon, available stock and purchase quantity. Purchases cost three pesos per round and reduce the merchant's finite stock. The workshop can produce the selected type; each batch makes 60 rounds for 30 pesos, five powder and three lead over twelve hours. Contraband can import 100 selected rounds at the quoted price. Depots and convoy cargo preserve each type.

New campaigns have 300 shared rounds distributed across the nine types. First issue takes matching rounds from the local depot and shared stock. Chambers can receive their first charge even with full pockets; spare issue still needs space. A carried gun that was emptied does not gain a free charge on reentry. Militia and enemy squads also use finite compatible ammunition.

## Ownership and old saves

`inventory` is the authority for loose personal rounds. `unit.ammo` is a display projection for the primary weapon. It cannot create ammunition, supply a different gun or credit shared stock. Gun chambers, pack weapons, cursor contents, fallen soldiers, prisoners and field caches remain separate physical owners.

Return admission compares ammunition by type across those owners. Moving a round into another hand, a corpse or the ground cannot create a second return allowance. The first-entry field receipt includes authored supply caches. Returned loose reserves stay with their owner and are not also credited to the campaign stock.

The ammunition schema has its own version. Old unlabelled loose rounds, stock and cargo migrate once to musket .75; charges already inside a known gun retain that gun's type. A campaign journal message explains this conversion. New typed saves reject mixed or incomplete version data instead of treating a missing marker as permission to create old scalar reserves.

## Verification and limits

Regression coverage includes all nine weapon/load combinations, separate pistol loads, partial work, inventory/cursor custody, weight and pocket limits, immutable rejected actions, AI sharing and scavenging, finite merchants, production, convoys, legacy saves and campaign returns.

The live practice checked R with both musket and rifle loads. Loading the musket reduced only .75 stock; changing to the Baker and loading reduced only .62 stock. The wrong-load case retained its two rifle rounds and showed the crossed reticle with the missing .75 load. The normal pocket and hand controls also swapped the two guns, preserved the loaded musket in its pocket and restored the complete inventory after saving. The production tactical UI is used for these checks.

A live armory purchase of 20 Baker cartridges spent 60 pesos, raised the selected shared stock from 30 to 50, and reduced the merchant stock from 60 to 40.

The established northern route now orders a real batch of Baker cartridges during its existing recovery period. Its later rescue uses real replacement physician contracts and finite medical supplies. The route also exposed and fixed a return bug that copied a surviving soldier into a second squad after the selected column died.

Dragging cartridges directly onto a gun to load it is still absent. There is one supported prepared load per firearm; alternate ball/shot choices and unloading are not claimed here. Artillery cartridges remain separate. Full JA2 parity remains open in the main audit.

Reference: the user-supplied Patusco guide, pages 49–50, describes compatibility and ammunition availability. The implemented costs, pocket quantities and period adaptation are Granaderos rules.
