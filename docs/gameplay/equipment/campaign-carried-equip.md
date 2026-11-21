# Equip carried weapons from the campaign map

A conscious, awake soldier in a friendly, unoccupied town can equip a weapon from their own backpack through **Equipo del sector → Con el combatiente → Equipar principal/secundaria**. Scouting is required to collect or drop field items, but not to use a weapon already carried. Primary firearms and blades use the existing tactical inventory swap planner. The shared hand controls also support compatible physical firearms in the other hand.

The outgoing weapon goes into the backpack only if the resulting inventory fits. The incoming weapon retains its identity, condition, ignition failure, loaded cartridges, unfinished reload fraction, and fitted bayonet. The action consumes no campaign time, money, ammunition, or medical supplies. It cannot heal or repair the weapon. Stale selections, wrong hands, full packs, sleep, unconsciousness, travel, occupation, and pending encounters reject before changing either item.

## Ammunition and return boundaries

An explicitly map-equipped firearm records its actual load, including zero. Visits, attacks, and forced defenses retain that load. A supplied town can buy a finite reserve shortfall under its authored supplier rules, but does not automatically load this gun. Its unfinished work passes to the tactical reload action, where only completed charges consume cartridges.

`carriedAmmo` includes the gun's `carriedLoaded` cartridges. The loaded and loose rounds remain with their owner after tactical return. There is no return refund or global cartridge pool. The witnessed return allowance includes every physical owner and prevents a retained charge from being credited again. Capture puts the prepared load and reload work in custody. Rescue restores the held load and the captive's loose reserve exactly once. Swaps into the armory, sale, buyback, and re-equipping preserve the exact stored load and work.

Every held gun retains its actual load on return, including ordinary issued guns, full guns and empty guns. There is no map-prepared loading exception. See [persistent gun loads](campaign-gun-loads.md) for the accounting and initial-issue boundary.

Map transfers retire equipment identities from returned living soldiers' snapshots before placing that equipment on the ground. That snapshot is a historical receipt; the current campaign soldier is the owner. The receipt's health, ammunition totals, and return ledger remain intact. Dead bodies remain finite field owners.
