# Equipment in a strategic sector

The strategic map's **Objetos** view now lists discovered field equipment beside supplies in depots. Select a sector and a local soldier, then use **Recoger** or **Dejar** with an exact quantity. The map marker counts discovered items separately from depot supplies.

A transfer requires a cleared patriotic sector, no pending encounter or deployment, and a living, conscious, awake local soldier who is not traveling. Pickup also requires an open walking route to the object. Walls, closed doors and blocking props prevent remote collection. A resident uses their last field position; a newly arrived soldier uses the arrival boundary. The transaction uses shared inventory capacity and item rules and rejects stale source contents before moving anything.

Knowledge survives leaving a sector. Visible ground equipment and dropped weapons become known; body contents require a nearby observer, and chest contents require an open chest. Closed, locked, trapped or undiscovered containers cannot supply the strategic inventory. The public campaign projection includes only discovered equipment, never the full sector snapshot. Existing saves without discovery records acquire them during subsequent reconnaissance.

Weapon loads, ignition failure, condition, individual identities, fittings and quantities survive transfer, save and reentry. Living soldiers in returned battle snapshots remain historical records; their next deployment uses current campaign equipment. Dead bodies and finite field objects retain their actual depleted contents.

Cartridges collected on the map remain with the selected soldier until deployment. Visits, attacks and defenses use those cartridges first, then draw from shared stock to reach the normal allocation. Soldiers without firearms can still carry cartridges. On return, surviving loose rounds use the existing shared campaign reserve. Ammunition already left in a sector has a separate deployment allowance, so picking it up tactically does not lose it at the next report. Loaded stored weapons retain their own charges.

## Reference and adaptation

JA2's strategic inventory separates visible from unseen items and restricts transfer by reachability, local mercenary presence and combat state. See the primary [Stracciatella map-inventory implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Map_Screen_Interface_Map_Inventory.cc).

Granaderos performs safe map transfers without tactical movement, AP or elapsed time. The twelve-unit pack, shared campaign ammunition reserve and boundary access are project rules. This is not full parity with JA2 pocket geometry, elevations, remote inventory transport or every item class. Named mission scenes retain their own equipment and require tactical access; this panel covers ordinary strategic sectors.

## Verification

- Fourteen simulation/save tests cover exact and stale quantities, no free recovery, weapon ownership and fittings, finite bodies and containers, private knowledge, path restrictions, unavailable soldiers, capacity, and all three deployment ammunition paths.
- Two component-render checks cover labelled controls, quantity bounds, current supplies and rejection reasons on an authored sector map.
- The isolated gameplay checkout passes all 1,248 tests, type checking and the production build (278 exported files, 189 asset references).
- Live browser interaction with this new panel has not been verified. Component rendering does not establish browser interaction.
