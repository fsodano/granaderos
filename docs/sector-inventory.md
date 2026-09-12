# Equipment in a strategic sector

The strategic map's **Objetos** view now lists discovered field equipment beside supplies in depots. Select a sector and a local soldier, then use **Recoger** or **Dejar** with an exact quantity. The map marker counts discovered items separately from depot supplies.

A transfer requires a cleared patriotic sector, no pending encounter or deployment, and a living, conscious, awake local soldier who is not traveling. Pickup also requires an open walking route to the object. Walls, closed doors and blocking props prevent remote collection. A resident uses their last field position; a newly arrived soldier uses the arrival boundary. The transaction uses shared inventory capacity and item rules and rejects stale source contents before moving anything.

Knowledge survives leaving a sector. Visible ground equipment and dropped weapons become known; body contents require a nearby observer, and chest contents require an open chest. Closed, locked, trapped or undiscovered containers cannot supply the strategic inventory. The public campaign projection includes only discovered equipment, never the full sector snapshot. Existing saves without discovery records acquire them during subsequent reconnaissance.

Weapon loads, ignition failure, condition, individual identities, fittings and quantities survive transfer, save and reentry. Living soldiers in returned battle snapshots remain historical records; their next deployment uses current campaign equipment. Dead bodies and finite field objects retain their actual depleted contents.

Cartridges collected on the map remain with the selected soldier until deployment. Visits, attacks and defenses use those cartridges first, then draw from shared stock to reach the normal allocation. Soldiers without firearms can still carry cartridges. On return, surviving loose rounds use the existing shared campaign reserve. Ammunition already left in a sector and charges inside carried pack weapons have a joint deployment allowance. Moving a loaded gun between the ground and a pack cannot duplicate that allowance. Equipping a carried loaded gun and returning it credits its surviving charge; leaving it stored keeps the charge in the weapon. Captive ammunition stays in custody.

## Reference and adaptation

JA2's strategic inventory separates visible from unseen items and restricts transfer by reachability, local mercenary presence and combat state. See the primary [Stracciatella map-inventory implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Map_Screen_Interface_Map_Inventory.cc).

Granaderos performs safe map transfers without tactical movement, AP or elapsed time. The twelve-unit pack, shared campaign ammunition reserve and boundary access are project rules. This is not full parity with JA2 pocket geometry, elevations, remote inventory transport or every item class. Named mission scenes retain their own equipment and require tactical access; this panel covers ordinary strategic sectors.

## Verification

- Seventeen simulation/save tests cover exact and stale quantities, no free recovery, weapon ownership and fittings, finite bodies and containers, private knowledge, path restrictions, unavailable soldiers, capacity, and all three deployment ammunition paths.
- Two component-render checks cover labelled controls, quantity bounds, current supplies and rejection reasons on an authored sector map.
- The isolated gameplay checkout passes all 1,251 tests, type checking and the production build (278 exported files, 189 asset references).
- Live browser checks below now cover ordinary field drops, map pickup/drop, quantities, save continuation and tactical reentry. Remote access, blocked routes, full-pack rejection and body/container variants remain automated-test evidence.

## Live check, 12 September 2026

The existing separate `?qa=1` campaign supplied Kerr, a secure Retiro sector and three trained militia. The normal campaign storage was not changed. All steps used game controls.

1. In tactical exploration, Kerr dropped three of nine loose cartridges and his loaded Escopeta Criolla. The map listed both at U24, including the gun's 100% condition and one loaded round. The campaign reserve was 278.
2. A request for four cartridges disabled pickup. Taking two left one on the ground, put two with Kerr and left the reserve at 278. The campaign clock and 3,220-peso treasury did not change.
3. After a map drop and another partial pickup, the quantity input initially retained a value larger than the remaining stack. The fix remounts a row when its contents change. Repeating a two-of-three pickup then reset the input to one and kept pickup enabled.
4. Returning to the title screen and using Continue restored one ground cartridge, two carried cartridges and the stored gun. Tactical reentry showed the same two loose cartridges and the gun's one loaded round at 100% condition. Keyboard activation opened the field marker; the finite tactical picker collected the last ground round.
5. Equipping that stored gun exposed a missing allowance in the return receipt: its loaded round vanished from the campaign total. A regression reproduced the loss for one- and two-round guns. The corrected code counts starting pack charges and field charges together and subtracts charges still stored in either place.
6. The repaired live loop began with 281 reserve cartridges. Dropping a loaded gun and returning left 280 in reserve plus one in the field weapon. Map pickup, tactical reentry, equipping and return restored exactly 281. No field item remained.

A separate dressing test resolved the initial failed pointer attempts: the marker was outside the visible tactical camera. Centering the camera on Kerr put the marker on screen; mouse pickup opened the list even though the soldier overlapped it, and the dressing returned to his inventory. The reserve stayed at 281. The test campaign was left on Objects with one of his two dressings on the ground, ready for manual pickup. This evidence does not establish full JA2 parity.
