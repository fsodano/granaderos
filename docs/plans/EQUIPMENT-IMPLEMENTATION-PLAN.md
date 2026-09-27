# Required equipment implementation plan

Read-only code/specification audit, 2026-09-05. This plan does not implement the
items below and does not claim the full equipment requirement is complete.
Primary requirement source: docs/specification/original.txt, especially the
weapon tables and “Munitions, Field Consumables, and Accoutrements” table.

## Exact current gaps

| Required item/function | Current implementation | Missing behavior |
| --- | --- | --- |
| Paper cartridges: 20 rounds / 0.8 kg; cartridge box | Finite ammo and loaded counts; 0.04 kg each counted by carriedWeight; reload transfers reserve to weapon | No cartridge-box item or capacity/compatibility; every firearm uses the same reserve; keep caliber compatibility a deliberate follow-up decision rather than silently claiming it exists |
| Priming flask: 50 charges / 0.3 kg; small belt pocket | priming count, reload/priming consumption, shortage penalty and reprime checks | No flask/container record, no maximum carry capacity, no weight counted; distinguish refill from adding another flask |
| Flint packet: 4 flints / 0.1 kg; ammunition pouch | Finite flints restore firearm condition via repair action | No pouch, packet capacity or weight counted |
| Tasajo and linen bandages: 1.2 kg; haversack/backpack | Finite rations stop bleeding, reduce fatigue and restore AP | No haversack/backpack allocation or weight; action does not restore energy despite the specification's stamina recovery intent |
| Mule pack saddle: 6 kg, +40 kg mountain carry; animal equipment slot | logistics.js mules transport option has baseCapacity40, saddleBonus40, capacity80 and saddleWeight6 | Bonus is inherent to transport mode, not earned by owning/equipping an albarda; no pack-animal equipment slot or actual squad carrying connection; saddleWeight is metadata rather than demonstrated load subtraction |
| Socket bayonet attached to musket | Existing blade ID1811, reach/interception and brace mechanics | Bayonet is an interchangeable secondary weapon; compatible musket attachment/mount state is not modeled |
| Personal weapons and recovered equipment | Finite armory, primary/blade slots, recovered weapon swap retaining load and condition | Generic 4kg firearm / 1.3kg melee weights replace table weights; secondary equipped blade weight omitted; primary slot accepts melee and firearm while attachment compatibility is absent |
| Corpses and unconscious inventory | Loot transfers counters, primary weapon and inventory records with source depletion | Equipped secondary blade is not transferred by current all-loot branch; no container transfer or destination pocket checks; jammed state is not consistently retained in corpse/dropped records |

`RecoveredInventory.tsx` only displays object records and equips recognized
weapons. Counters for priming/flints/rations live outside that inventory. There
is no current uniform finite item/container model. Overweight movement penalties
exist, but do not compensate for missing item mass or unlimited pocket storage.

Shako, regimental uniform, powder measure and sighting rule are also explicitly
named in starting equipment (original.txt around lines309/373). They have no
wearable/accessory slots. The original table gives no protection/aim modifiers
for them: do not invent large bonuses and present them as specified behavior.
Canteens, modern vests, modern backpacks and elaborate arbitrary attachment
systems are not requirements found in this table and should not delay the
concrete period kit above.

## Minimal staged implementation

1. Add a canonical item registry with stable IDs, Spanish names, mass, stack
   unit and accepted slot types. Reuse weapon IDs1800–1813 and their specified
   masses. Add cartridge box, priming flask, flint pouch, haversack, albarda and
   period wearable/accessory records. Define one cartridge as0.04kg, one flint
   as0.025kg, a full priming allotment as0.3kg and each ration bundle as1.2kg.
   Explicitly document whether flask0.3kg includes its contents; avoid counting
   the same supplied mass twice. Container capacities beyond the given50/4/20
   pack sizes are design parameters requiring documentation, not source facts.

2. Introduce small slot schema: primary hand, secondary/blade, cartridge box,
   belt flask, flint pouch, haversack, headwear, coat and pack-animal saddle.
   Containers constrain accepted item kinds and count/volume; wearable items
   occupy one slot; saddle only accepts an actual available pack animal.
   Keep carried mass and pocket compatibility separate: a strong soldier does
   not make a flask pocket accept a musket. Provide pure canStore/transfer/equip
   planners that reject invalid destinations before mutating either inventory.

3. Preserve save compatibility with a one-time migration from counters into
   item records and appropriate default containers. Maintain counters only as
   derived views until consumers migrate; never keep two independently mutable
   ammo stores. Existing legacy loadouts retain their exact quantities. Mark
   migration version and verify repeated restore cannot duplicate equipment.

4. Route reload, reprime, repair, ration, resupply and strategic purchasing
   through the same item accessors. Rations must recover actual energy as well
   as the established wound/fatigue effects, with a documented bounded amount.
   Worn kit has real weight; cartridge/flint packets refill their compatible
   containers. No reload or resupply action may mint empty-container capacity.
   Mounted/albarda benefits apply only while the identified animal and saddle
   are available and at the squad's location; dead/lost animals remove access.

5. Implement bayonet mounting only on explicitly compatible weapons, consuming
   the existing bayonet instance and an AP cost. Mounted socket bayonet enables
   current reach/intercept behavior; detaching returns that same instance to a
   valid pocket. A pistol, blunderbuss or arbitrary saber cannot gain that reach.
   Uniform/shako should initially provide mass and equipment identity without
   invented armor. Powder measure/sighting rule can enable measured loading or
   deliberate sight calibration only after modest costs/effects are documented
   and tested; otherwise label them nonfunctional pending work, not complete.

6. Replace bulk corpse loot with a transfer preview listing primary, secondary,
   ammunition, consumables, accessories and containers. Each transfer preserves
   condition, loaded count, priming/jam state and item identity. Destination
   rejection leaves the corpse unchanged; partial transfer leaves exact residue.
   Friendly transfers and ground drops use the same planner. An equipped blade
   must move exactly once, not remain available for repeated corpse farming.

7. UI: a compact kit panel with named slots, selected item, mass/capacity and
   accepted destinations; explicit Equip/Move/Use/Drop controls. Recoverable
   corpses use the same panel. Surface short Spanish reasons for incompatibility,
   full containers and missing animals. Existing hand-slot weapon controls remain
   usable throughout migration. Do not expose raw registry keys in player text.

## Acceptance checks before marking complete

- Exact table masses; secondary equipment and every consumable count toward
  weight once; loading transfers mass rather than creating/removing a round.
- Pocket type/count rejection is atomic. Swapping full containers cannot bypass
  capacity, overwrite items or erase a loaded/jammed firearm's state.
- Empty flask/flint/ration behavior, partial refill and actual energy recovery.
- Bayonet compatibility and attach/detach conservation, reach only when mounted.
- Owned equipped albarda supplies exactly40kg bonus under the documented mountain
  rule; its6kg burden counted once; loss/detach removes bonus without deletion.
- Dead/unconscious source transfers secondary blade, kit and containers once;
  repeat and interrupted transfers preserve quantities and condition.
- Save migration/restoration and tactical-to-campaign return conserve all items.
- Browser inspection of equip, consume, failed-capacity transfer, corpse pickup
  and return/save/resume; screenshots alone cannot establish item conservation.

Implementation ownership should separate the pure registry/transfer engine from
campaign persistence and UI consumers. Land a tested coherent slice (canonical
weights plus finite consumable containers and corpse transfers) before optional
accessory mechanics. This keeps “full equipment” measurable rather than a list
of decorative slot names.
