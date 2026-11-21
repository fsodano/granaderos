# Equipment in a strategic sector

The strategic map's **Objetos** view now lists discovered field equipment beside supplies in depots. Select a sector and a local soldier, then use **Recoger** or **Dejar** with an exact quantity. The map marker counts discovered items separately from depot supplies.

A transfer requires a cleared patriotic sector, no pending encounter or deployment, and a living, conscious, awake local soldier who is not traveling. Pickup also requires an open walking route to the object. Walls, closed doors and blocking props prevent remote collection. A resident uses their last field position; a newly arrived soldier uses the arrival boundary. The transaction uses shared inventory capacity and item rules and rejects stale source contents before moving anything.

Knowledge survives leaving a sector. Visible ground equipment and dropped weapons become known; body contents require a nearby observer, and chest contents require an open chest. Closed, locked, trapped or undiscovered containers cannot supply the strategic inventory. The public campaign projection includes only discovered equipment, never the full sector snapshot. Existing saves without discovery records acquire them during subsequent reconnaissance.

Weapon loads, ignition failure, condition, individual identities, fittings and quantities survive transfer, save and reentry. Living soldiers in returned battle snapshots remain historical records; their next deployment uses current campaign equipment. Dead bodies and finite field objects retain their actual depleted contents.

Cartridges collected on the map remain with the selected soldier until deployment. Visits, attacks and defenses use those cartridges first, then draw from shared stock to reach the normal allocation. Soldiers without firearms can still carry cartridges. On return, surviving loose rounds use the existing shared campaign reserve. Ammunition already left in a sector and charges inside carried pack weapons have a joint deployment allowance. Moving a loaded gun between the ground and a pack cannot duplicate that allowance. Equipping a carried loaded gun and returning it credits its surviving charge; leaving it stored keeps the charge in the weapon. Captive ammunition stays in custody.

## Reference and adaptation

JA2's strategic inventory separates visible from unseen items and restricts transfer by reachability, local mercenary presence and combat state. See the primary [Stracciatella map-inventory implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Map_Screen_Interface_Map_Inventory.cc).

Granaderos performs safe map transfers without tactical movement, AP or elapsed time. The twelve-unit pack, shared campaign ammunition reserve and boundary access are project rules. This is not full parity with JA2 pocket geometry, elevations, remote inventory transport or every item class. Named mission scenes retain their own equipment and require tactical access; this panel covers ordinary strategic sectors.

## Mission sites

The map's equipment view offers a **Lugar** selector when a visited mission has a saved site. San Nicolás includes **Combate de San Lorenzo**; Tucumán includes **Conferencia de Yatasto**. The sector map's object totals and the public campaign equipment projection include discovered items at those sites. Public rows identify their site, so identical local item keys from different maps cannot collide. Hidden equipment and unopened contents stay private.

Transfers resolve the selected site's own snapshot. San Lorenzo retains its separate sector snapshot; Yatasto retains its scene snapshot. A local soldier uses the parent campaign sector for presence and occupation checks. Historical coordinates are reused only if both the resident sector and resident scene match; otherwise the soldier approaches from an entry edge. Existing path, capacity, quantity, stale-source, health, transit and pending-encounter guards still apply. Pickup and drop update only the selected source and the current carrier; saving retains depleted stores and personal ammunition.
