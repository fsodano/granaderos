# Equip carried weapons from the campaign map

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

A conscious, awake soldier in a friendly, unoccupied town can equip a weapon from their own backpack through **Equipo del sector → Con el combatiente → Equipar principal/secundaria**. Scouting is required to collect or drop field items, but not to use a weapon already carried. Primary firearms and blades use the existing tactical inventory swap planner. The shared hand controls also support compatible physical firearms in the other hand.

The outgoing weapon goes into the backpack only if the resulting inventory fits. The incoming weapon retains its identity, condition, ignition failure, loaded cartridges, unfinished reload fraction, and fitted bayonet. The action consumes no campaign time, money, ammunition, or medical supplies. It cannot heal or repair the weapon. Stale selections, wrong hands, full packs, sleep, unconsciousness, travel, occupation, and pending encounters reject before changing either item.

## Ammunition and return boundaries

An explicitly map-equipped firearm records its actual load, including zero. Visits, attacks, and forced defenses retain that load. A supplied town can buy a finite reserve shortfall under its authored supplier rules, but does not automatically load this gun. Its unfinished work passes to the tactical reload action, where only completed charges consume cartridges.

`carriedAmmo` includes the gun's `carriedLoaded` cartridges. The loaded and loose rounds remain with their owner after tactical return. There is no return refund or global cartridge pool. The witnessed return allowance includes every physical owner and prevents a retained charge from being credited again. Capture puts the prepared load and reload work in custody. Rescue restores the held load and the captive's loose reserve exactly once. Swaps into the armory, sale, buyback, and re-equipping preserve the exact stored load and work.

Every held gun now retains its actual load on return, including ordinary issued guns, full guns and empty guns. There is no longer a map-prepared loading exception. See [persistent gun loads](campaign-gun-loads.md) for the current accounting, initial-issue boundary and route verification.

Map transfers retire equipment identities from returned living soldiers' snapshots before placing that equipment on the ground. That snapshot is a historical receipt; the current campaign soldier is the owner. The receipt's health, ammunition totals, and return ledger remain intact. Dead bodies remain finite field owners.

## Historical isolated evidence

The suite and browser results below predate the current consolidation and treasury-only economy. Their general-stock figures do not describe current ownership. See [latest consolidation checks](../../verification/latest-build-consolidation.md) for current results.

Validation: all 1,341 automated tests, TypeScript checking, the production build, and whitespace checks passed on the isolated gameplay checkout. The browser result below was checked again with the final component.

- `tests/campaign-carried-equip.test.mjs`: loaded and partial firearms; visits, attacks, defenses; repeated return; actual remaining reload; map drop/recovery; secondary blade swaps; finite armory sale/buyback; capture/rescue; save validation and atomic rejection.
- `tests/campaign-carried-equip-render.test.mjs`: unscouted-town controls, displayed load/work/condition, selected-hand dispatch, unavailable carried actions.
- Existing sector-inventory, reload, equipment, and tactical-exit tests retain their separate evidence.
- Live browser check used the production `SectorInventory` component and reducers in an isolated preview, starting from the actual Córdoba recovery save at hour 274, second 496. Reed (142), whose primary weapon was dropped, collected the discovered Charleville (1801), equipped it from his backpack, then saved and loaded the result. The gun retained one charge and 100% condition; the field source disappeared, the backpack changed from 7/12 to 5/12 spaces, and treasury (1,557 pesos), reserve stock (502 cartridges), and campaign hour stayed unchanged. The normal campaign tab was not changed. Combat reload, capture/rescue, and invalid selections are automated evidence, not live browser evidence.

The local preview is `http://127.0.0.1:3004/` while its development server remains running. It is not a published build or a complete campaign playthrough.
