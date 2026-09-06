# 05 — Weapons, Items, Attachments, Ammo, and Economy

**Audience:** an agent with zero prior JA2 knowledge who must port the engine's item/weapon
systems into the browser clone (`game/` + `web/`). This document is the translation guide from
the C++ engine (`engine/Tactical/`, `engine/Laptop/`, `engine/Strategic/`) and the JA2 v1.13
TableData XML to the web modules `game/equipment.js`, `game/ammunition.js`, `game/industry.js`,
and `game/logistics.js`, plus the shop/inventory UI in `web/app/Armory.tsx` and
`web/app/Logistics.tsx`.

**Source of truth:** the engine headers declare the data structures and constants; the `.cpp`
files implement them; the `gamedir/Data-1.13/TableData/Items/*.xml` files are the authored data
schema. The web game already has a working armory/equipment surface; this document maps the
engine onto that existing surface so the web clone can be pushed toward fidelity.

**Scope:** items, weapons, attachments, ammunition, explosives/heavy weapons, armour/LBE,
food/medical, arms-dealer inventory/pricing/repairs, and strategic supply/production hooks.
**Out of scope:** soldier statistics (owned by `04-tactical-core.md`), rendering, and any code
edits — this is read-only analysis with `file:line` citations.

---

## 1. Big picture: how JA2 models an item

Every object in JA2 is an **`OBJECTTYPE`** (`Tactical/Item Types.h:588-650`) that wraps a
**`usItem`** index into the global `Item[MAXITEMS]` array (`Item Types.h:1817`). Each entry is
an **`INVTYPE`** (`Item Types.h:1094-1240`) — the "item statistics" record that carries the
item's class, weight, price, attachment classes, and every modifier. Weapons additionally
reference a **`Weapon[]`** record (`Weapons.h`) and an **`AmmoTypes[]`** / **`Magazine[]`**
record (`Weapons.cpp:173`).

The web clone does **not** reproduce this three-table indirection. It folds the authored
content into `game/data.js` (`WEAPONS`, `RECIPES`, `RESOURCE_NAMES`) and `game/equipment.js`
(`EQUIPMENT_CATALOG`), keeping the same *semantic* fields (caliber, capacity, damage, AP costs,
range) but flattening the engine's `Item → Weapon → Magazine → AmmoType` chain into one record
per weapon. The engine remains the authoritative reference for the *rules* (AP costs, misfire,
reload, pricing) even where the web shape differs.

---

## 2. The item-class enum (the "what kind of thing is this" bitmask)

JA2 classifies items with **bitmask flags**, not a single enum. The canonical definitions live
in `Tactical/Item Types.h:655-700`:

| Flag | Value | Meaning |
|---|---|---|
| `IC_NONE` | `0x00000001` | Nothing |
| `IC_GUN` | `0x00000002` | Firearm |
| `IC_BLADE` | `0x00000004` | Melee blade |
| `IC_THROWING_KNIFE` | `0x00000008` | Throwing knife |
| `IC_LAUNCHER` | `0x00000010` | Grenade/rocket launcher |
| `IC_TENTACLES` | `0x00000020` | Monster tentacles |
| `IC_THROWN` | `0x00000040` | Thrown weapon |
| `IC_PUNCH` | `0x00000080` | Punch/knuckles |
| `IC_GRENADE` | `0x00000100` | Grenade |
| `IC_BOMB` | `0x00000200` | Bomb |
| `IC_AMMO` | `0x00000400` | Ammunition |
| `IC_ARMOUR` | `0x00000800` | Armour |
| `IC_MEDKIT` | `0x00001000` | Medical kit |
| `IC_KIT` | `0x00002000` | Tool kit |
| `IC_APPLIABLE` | `0x00004000` | Applicable item |
| `IC_FACE` | `0x00008000` | Face gear |
| `IC_KEY` | `0x00010000` | Key |
| `IC_LBEGEAR` | `0x00020000` | Load-bearing equipment |
| `IC_BELTCLIP` | `0x00040000` | Belt clip |
| `IC_MISC` | `0x10000000` | Miscellaneous |
| `IC_MONEY` | `0x20000000` | Money |
| `IC_RANDOMITEM` | `0x40000000` | Random item |

**Parent types** (`Item Types.h:685-700`) combine these: `IC_WEAPON = IC_GUN|IC_BLADE|
IC_THROWING_KNIFE|IC_LAUNCHER|IC_TENTACLES`; `IC_EXPLOSV = IC_GRENADE|IC_BOMB`;
`IC_BOBBY_GUN = IC_GUN|IC_LAUNCHER` (what Bobby Ray sells as "guns"); and the `IC_MAPFILTER_*`
masks used by the inventory UI filters.

**Web mapping:** the web clone uses a string `category` field instead of bitmasks —
`firearm`, `blade`, `artillery` in `game/equipment.js:3-7` and `game/data.js` `WEAPONS`
(`type: "firearm" | "melee" | "artillery"`). The engine's `IC_GUN`/`IC_BLADE`/`IC_LAUNCHER`
distinction maps to `firearm`/`blade`/`artillery`. The `IC_AMMO`, `IC_ARMOUR`, `IC_LBEGEAR`,
`IC_MEDKIT`, `IC_FACE` classes are **not yet modeled** as separate web item records — the web
clone tracks priming/flints/rations as numeric counters on each operative
(`game/campaign.js:56` `operativeState`), which is a deliberate simplification documented in
`docs/EQUIPMENT-IMPLEMENTATION-PLAN.md`.

---

## 3. The `INVTYPE` item-statistics record

`Tactical/Item Types.h:1094-1240` defines `INVTYPE`, the per-item record loaded from
`Items.xml`. Key fields for the web port:

| Field | Type | Meaning |
|---|---|---|
| `uiIndex` | `UINT32` | Item id (the `usItem` index) |
| `usItemClass` | `UINT32` | The class bitmask from §2 |
| `attachmentclass` / `nasAttachmentClass` | `UINT32`/`UINT64` | What this item *is* as an attachment |
| `ulAvailableAttachmentPoint` / `ulAttachmentPoint` | `UINT64` | What slots this item can accept / occupies |
| `ubWeight` | `UINT16` | Weight (2 units ≈ 1 kg) |
| `usPrice` | `UINT16` | Base price (used by dealers) |
| `ubCoolness` | `UINT8` | Rarity/availability tier (0–10) |
| `bReliability` | `INT8` | Reliability modifier |
| `bRepairEase` | `INT8` | Repair ease (±10% per point) |
| `ubPerPocket` | `UINT8` | How many fit per pocket |
| `ItemSize` / `ItemSizeBonus` | `UINT16` | Volume for LBE pockets |
| `inseparable` | `UINT8` | 0 removable, 1 inseparable, 2 replaceable |
| `ubAttachToPointAPCost` | `UINT8` | AP to attach to a matching point |
| `usItemFlag` / `usItemFlag2` | `FLAGS64` | Bitflags for item properties |

The **"Item Statistics editor"** is the `XML Editor.exe` shipped in `gamedir/`
(`gamedir/XML Editor.exe`, `XMLEditorInit.xml`, `XMLEditorSettings.xml`). It reads/writes the
`TableData/Items/*.xml` files. The web clone has no editor; it authors `game/data.js` directly.

---

## 4. Weapon tables and fire modes

### 4.1 Weapon-mode enum

`Tactical/Weapons.h:7-20` defines `enum WeaponMode`:

```
WM_NORMAL, WM_BURST, WM_AUTOFIRE, WM_ATTACHED_GL, WM_ATTACHED_GL_BURST,
WM_ATTACHED_GL_AUTO, WM_ATTACHED_UB, WM_ATTACHED_UB_BURST, WM_ATTACHED_UB_AUTO,
WM_ATTACHED_BAYONET, NUM_WEAPON_MODES
```

The **weapon-fire-mode matrix** for the GRANADEROS conversion is deliberately degenerate: every
black-powder firearm is single-shot (`capacity: 1`, except the double-barrel pistol `1808` with
`capacity: 2`), so only `WM_NORMAL` and `WM_ATTACHED_BAYONET` are meaningful. The web clone
mirrors this in `game/tactical.js:4-10` (`WEAPONS` table) and `game/data.js` `WEAPONS`
(`capacity` field). There is no burst/auto in the period.

### 4.2 Weapon-class and ammo-type enums

`Tactical/Weapons.h:88-99` defines the weapon classes: `NOGUNCLASS, HANDGUNCLASS, SMGCLASS,
RIFLECLASS, MGCLASS, SHOTGUNCLASS, KNIFECLASS, MONSTERCLASS`. `Weapons.h:115-136` defines the
ammo calibers (`NOAMMO, AMMO38, AMMO9, AMMO45, AMMO357, AMMO12G, AMMOCAWS, AMMO545, AMMO556,
AMMO762N, AMMO762W, AMMO47, AMMO57, AMMOMONST, AMMOROCKET, AMMODART, AMMOFLAME, AMMO50, AMMO9H`).
`Weapons.h:146-161` defines ammo *types* (`AMMO_REGULAR, AMMO_HP, AMMO_AP, AMMO_SUPER_AP,
AMMO_BUCKSHOT, AMMO_FLECHETTE, AMMO_GRENADE, AMMO_MONSTER, AMMO_KNIFE, AMMO_HE, AMMO_HEAT,
AMMO_SLEEP_DART, AMMO_FLAME`).

**Web mapping:** the web clone uses **named calibers** as strings, not enum indices —
`"Bala de plomo .75"`, `"Bala de plomo .69"`, `"Bala con parche .62"`, `"Bala corta .65"`,
`"Perdigón calibre 16"`, `"Bala de precisión .50"`, `"Metralla"`, `"Bala de plomo .54"`
(`game/data.js:294,310,326,342,358,390,406,422`). This is a faithful, human-readable
translation of the engine's caliber enum.

### 4.3 The GRANADEROS weapon table (the 9 firearms + 5 blades + 3 artillery)

The GRANADEROS conversion is gated by `#ifdef GRANADEROS` and the standalone rules header
`Tactical/GranaderosBlackPowder.h` (44 lines, `namespace granaderos`). It defines the 9
firearms as item ids **1800–1808** (`firstFirearm = 1800`, `lastFirearm = 1808`,
`GranaderosBlackPowder.h:6-7`), with per-weapon AP arrays:

| id | Weapon | fireAP | aimAP | reloadAP | capacity |
|---|---|---|---|---|---|
| 1800 | Brown Bess (India) | 12 | 6 | 45 | 1 |
| 1801 | Charleville 1777 | 11 | 5 | 42 | 1 |
| 1802 | Baker 1800 (rifled) | 16 | 10 | 70 | 1 |
| 1803 | Tercerola de Caballería | 9 | 4 | 38 | 1 |
| 1804 | Escopeta Criolla | 10 | 4 | 35 | 1 |
| 1805 | Pistola de Arzón | 7 | 3 | 32 | 1 |
| 1806 | Pistola de Duelo | 6 | 2 | 28 | 1 |
| 1807 | Trabuco Naranjero | 12 | 5 | 40 | 1 |
| 1808 | Pistola Doble Cañón | 8 | 3 | 55 | 2 |

(`GranaderosBlackPowder.h:12-27`; `reloadAP` is prorated by rounds and ×1.5 when prone.)

The **specification** (`docs/specification/original.txt:478-513`) supplies the historical
calibers, damage, and range for these plus the 5 blades (1809–1813) and 3 artillery pieces
(1820–1822). The web clone's `game/data.js` `WEAPONS` table (lines 290–521) and
`game/equipment.js` `EQUIPMENT_CATALOG` (lines 2–7) reproduce these exactly, including the
`rifled`/`spread` flags and the artillery `crew`/`radius`/`range`/`damage` fields.

---

## 5. Ammo, magazines, and reloads

### 5.1 Magazine and ammo-type XML

`gamedir/Data-1.13/TableData/Items/Magazines.xml` defines each magazine as
`<uiIndex> <ubCalibre> <ubMagSize> <ubAmmoType> <ubMagType>`. `AmmoTypes.xml` defines the
ammo-type properties (structure/armour impact multipliers, `numberOfBullets` for buckshot,
`standardIssue` for AI inventory). `Weapons.xml` links a weapon to its magazine via
`ubCalibre`/`ubMagSize` and to its ammo via `ubCalibre` + `ubAmmoType`.

### 5.2 Reload logic

The engine's reload AP is computed in `Tactical/Points.cpp:2859` `GetAPsToReloadGunWithAmmo`.
Under `#ifdef GRANADEROS` (lines 2861–2867) it returns `granaderos::reloadAP(...)` directly for
firearms, passing the missing rounds, available rounds, and prone flag. The non-GRANADEROS path
(lines 2868–2928) handles magazine swap (`swapClips == 1`), wrong-size ammo, and individually
loaded guns.

**Web mapping:** `game/tactical.js:33` `reloadCost` mirrors this: it computes
`Math.ceil(w.reloadAP * rounds / w.capacity)` with a ×1.5 prone multiplier and
gunsmith/assist reductions. The `reload` action (`tactical.js:81`) transfers rounds from
`ammo` reserve to `loaded`, consuming priming.

### 5.3 Ammunition conservation (web)

`game/ammunition.js` `returnAmmunition` (lines 1–16) is the web-side conservation rule: it
credits looted rounds from dead/unconscious sources and caps returned rounds by each soldier's
issued quantity and the total issued stock. This is the web analogue of the engine's
`DeductAmmo` (`Weapons.cpp:2744,3573`) and the campaign's finite-cartridge handoff
(`docs/WEB-SYSTEMS.md:35-37`).

---

## 6. Attachments and combinability

### 6.1 Attachment classes

`Tactical/Item Types.h:704-735` defines the attachment-class bitmask (`AC_BIPOD, AC_MUZZLE,
AC_LASER, AC_SIGHT, AC_SCOPE, AC_STOCK, AC_MAGWELL, AC_INTERNAL, AC_EXTERNAL, AC_UNDERBARREL,
AC_GRENADE, AC_ROCKET, AC_FOREGRIP, AC_HELMET, AC_VEST, AC_PANTS, AC_DETONATOR, AC_BATTERY,
AC_EXTENDER, AC_SLING, AC_REMOTEDET, AC_DEFUSE, AC_IRONSIGHT, AC_FEEDER, AC_MODPOUCH,
AC_RIFLEGRENADE, AC_BAYONET, ...`). The **`AC_BAYONET`** flag (`0x04000000`) is the one that
matters for GRANADEROS — it is the socket-bayonet attachment class.

### 6.2 Combinability XML

The engine resolves attachment compatibility through several XML files in
`gamedir/Data-1.13/TableData/Items/`:

- **`Attachments.xml`** — the master list: `<attachmentIndex> <itemIndex> <APCost> <NASOnly>`
  (which item can attach to which weapon, and the AP cost).
- **`AttachmentSlots.xml`** — the slot definitions: `<uiSlotIndex> <szSlotName>
  <nasAttachmentClass> <nasLayoutClass> <fMultiShot> <fBigSlot> <ubPocketMapping>`.
- **`IncompatibleAttachments.xml`** — explicit exclusions: `<itemIndex>
  <incompatibleattachmentIndex>` (e.g. a grenade launcher cannot coexist with a bipod).
- **`AttachmentComboMerges.xml`** — multi-part merges: `<usItem> <usAttachment1..10>` (e.g.
  rod + spring → a combined item).
- **`Merges.xml`** — general item merges.

### 6.3 GRANADEROS attachment reality

The **only** period attachment is the **socket bayonet** (`Bayoneta de Cubo`, id 1811). The
specification (`original.txt:502`) gives it 2-tile reach, intercept bonuses, and piercing
damage. The web clone models this as a **secondary blade** (`game/tactical.js:12` `BLADES`,
`bladeFor`), with the `brace` action (`tactical.js:131`) requiring `bladeFor(u).id === 1811`
and the `interceptCharge` mechanic (`tactical.js:69`) requiring a braced bayonet. The engine's
`WM_ATTACHED_BAYONET` mode (`Weapons.h:18`) is the conceptual equivalent.

**Port note:** the web clone does **not** yet model a mounted/attached bayonet state on the
musket — the bayonet is an interchangeable secondary weapon. `docs/EQUIPMENT-IMPLEMENTATION-PLAN.md`
explicitly lists "socket bayonet attached to musket" as a gap: "Bayonet is an interchangeable
secondary weapon; compatible musket attachment/mount state is not modeled."

---

## 7. Explosives and heavy weapons

### 7.1 Explosives XML

`gamedir/Data-1.13/TableData/Items/Explosives.xml` defines each explosive:
`<uiIndex> <ubType> <ubDamage> <ubStunDamage> <ubRadius> <ubVolume> <ubVolatility>
<ubAnimationID> <ubDuration> <ubStartRadius> <ubMagSize> <fExplodeOnImpact>
<usNumFragments> <ubFragType> <ubFragDamage> <ubFragRange> <ubHorizontalDegree> ...`.
`ExplosionData.xml` and `Launchables.xml` complete the explosive/launcher model.

### 7.2 GRANADEROS heavy weapons = artillery

The GRANADEROS conversion has **no grenades/rockets**; the "heavy weapons" are the three
crew-served artillery pieces (ids 1820–1822). The specification (`original.txt:510-513`) gives:

| id | Piece | Ammo | Crew | AP fire/reload | Radius | Range |
|---|---|---|---|---|---|---|
| 1820 | Cañón de Bronce de 4 lb | 4 lb solid/metralla | 2 | 30/60 | 4 | 80 |
| 1821 | Cañón de Campaña de 8 lb | 8 lb solid/canister | 3 | 40/75 | 6 | 110 |
| 1822 | Pedrero de Regala | 1 lb canister/stone | 1 | 20/35 | 3 | 35 |

The web clone models these in `game/tactical.js:11` (`ARTILLERY`) and `game/data.js:485-520`
(`WEAPONS` 1820–1822), with `crew`, `fireAP`, `reloadAP`, `radius`, `range`, `damage`. The
tactical artillery actions (`tactical.js:85-120`) implement fire (solid/canister), reload,
move, and pivot, requiring the crew count and AP per crewman. `game/equipment.js:11-18`
(`deployedArtillery`) selects up to 3 pieces for a deployment.

---

## 8. Armour, LBE, food, and medical

### 8.1 Armour XML

`gamedir/Data-1.13/TableData/Items/Armours.xml` defines each armour:
`<uiIndex> <ubArmourClass> <ubProtection> <ubCoverage> <ubDegradePercent>`. The armour-class
enum is in `Tactical/Weapons.h:102-110` (`ARMOURCLASS_HELMET, ARMOURCLASS_VEST,
ARMOURCLASS_LEGGINGS, ARMOURCLASS_PLATE, ARMOURCLASS_MONST, ARMOURCLASS_VEHICLE`).

### 8.2 LBE XML

`gamedir/Data-1.13/TableData/Items/LoadBearingEquipment.xml` defines each LBE rig:
`<lbeIndex> <lbeClass> <lbeCombo> <lbeFilledSize> <lbeAvailableVolume> <lbePocketsAvailable>
<lbePocketIndex1..12>`. `Pockets.xml` and `PocketPopups.xml` define the pocket types. This is
the engine's "pocket hierarchy" that the specification (`original.txt:517-524`) maps the
period kit onto (cartridge box, belt pocket, ammunition pouch, haversack).

### 8.3 Food and medical XML

`gamedir/Data-1.13/TableData/Items/Food.xml` defines food/drink:
`<uiIndex> <szName> <bFoodPoints> <bDrinkPoints> <usDecayRate>`. `Drugs.xml` defines medical
drugs. `Clothes.xml` defines wearable clothing.

### 8.4 GRANADEROS period kit (web)

The specification's "Munitions, Field Consumables, and Accoutrements" table
(`original.txt:519-524`) is the authoritative period kit:

| Item | Weight | LBE pocket | Effect |
|---|---|---|---|
| Cartuchos de Papel (×20) | 0.8 kg | Cartridge box | 1 per discharge |
| Frasco de Pólvora de Cebar | 0.3 kg | Belt pocket | 50 pan charges |
| Piedras de Sílex (×4) | 0.1 kg | Ammo pouch | Restores condition |
| Tasajo y Vendas de Lino | 1.2 kg | Haversack | Restores stamina, stops bleeding |
| Albarda de Carga para Mula | 6.0 kg | Pack-animal slot | +40 kg mountain carry |

The web clone tracks these as **numeric counters** on each operative
(`game/campaign.js:56` `operativeState`: `priming:50, flints:4, rations:2, torches:2,
condition:100`), consumed by the tactical actions `reprime` (`tactical.js:82`), `repair`
(`tactical.js:129`, consumes a flint), and `ration` (`tactical.js:130`). The albarda is modeled
in `game/logistics.js:8` (`mules` transport option: `baseCapacity:40, saddleBonus:40,
saddleWeight:6`). `docs/EQUIPMENT-IMPLEMENTATION-PLAN.md` documents the gap between these
counters and a full finite-item/container model.

---

## 9. Arms dealers, inventory, pricing, and repairs

### 9.1 Dealer identity and init

The arms-dealer system lives in `Tactical/Arms Dealer Init.cpp` and `Tactical/ArmsDealerInvInit.cpp`.
`Arms Dealer Init.h:9-58` defines the dealer enum (`ARMS_DEALER_TONY, ARMS_DEALER_FRANZ,
ARMS_DEALER_KEITH, ARMS_DEALER_JAKE, ARMS_DEALER_GABBY, ... ARMS_DEALER_DEVIN, ...`).
`Arms Dealer Init.h:64-72` defines the dealer *type* (`ARMS_DEALER_BUYS_SELLS,
ARMS_DEALER_SELLS_ONLY, ARMS_DEALER_BUYS_ONLY, ARMS_DEALER_REPAIRS`).

`Arms Dealer Init.cpp:119` `InitAllArmsDealers()` and `:134` `InitializeOneArmsDealer()` are
the init entry points. `ArmsDealerInvInit.cpp` holds the per-dealer inventory tables
(`gTonyInventory`, `gDevinInventory`, `gFranzInventory`, ... — `ArmsDealerInvInit.h:56-88`),
each an array of `DEALER_POSSIBLE_INV { sItemIndex, ubOptimalNumber, uiIndex }`
(`ArmsDealerInvInit.h:22-28`).

### 9.2 The dealer-info struct

`Arms Dealer Init.h:142-179` defines `ARMS_DEALER_INFO`, the per-dealer configuration:

| Field | Meaning |
|---|---|
| `dBuyModifier` / `dSellModifier` | Price multipliers when buying/selling |
| `dRepairSpeed` / `dRepairCost` | Repair speed/cost multipliers (repair dealers) |
| `ubTypeOfArmsDealer` | Buys/sells, sells-only, buys-only, or repairs |
| `iInitialCash` | Starting cash (reset daily) |
| `minCoolness` / `maxCoolness` / `addToCoolness` | Item availability tiers |
| `daysDelayMin` / `daysDelayMax` | Reorder delay |
| `allInventoryAlwaysAvailable` | Whether stock is always present |

### 9.3 Pricing

`Tactical/ShopKeeper Interface.cpp:3132` `CalcShopKeeperItemPrice` computes a price from
`CalcValueOfItemToDealer` (`Arms Dealer Init.cpp:2078`) times the dealer's `dSellModifier` /
`dBuyModifier`. `CalcValueOfItemToDealer` starts from `Item[usItemIndex].usPrice`
(`Arms Dealer Init.cpp:2085`) and applies the dealer's price class (Jake=junk, Keith=cheap,
Franz=expensive — lines 2110-2132). The buy/sell path is at `ShopKeeper Interface.cpp:7070-7084`.

### 9.4 Repairs

`Arms Dealer Init.cpp:1982` `CalculateObjectItemRepairCost` sums the repair cost of an item and
its attachments. `CalculateSimpleItemRepairCost` (`:2003`) computes
`Item[usItemIndex].usPrice * dRepairCost` adjusted by `bRepairEase` (±10% per point, floor 10%).

### 9.5 Bobby Ray

`Laptop/BobbyR.cpp` is the mail-order arms dealer. `GameInitBobbyR` (`:197`) registers the
delivery callback; `EnterBobbyR` (`:205`) initializes the site. `BobbyRGuns.cpp` holds the
purchase/order structures (`BobbyRayPurchases[100]`, `:138`). The specification maps Bobby Ray
to **Contrabando Británico** (`original.txt:133`) and the domestic armory to **Sala de Armas /
Maestranza** (`original.txt:134`).

### 9.6 Web mapping

The web clone replaces the multi-dealer engine with **two purchase channels** in
`game/campaign.js:171-178` (`purchaseEquipment`):

- **Local armory** (`Retiro`): any `EQUIPMENT_CATALOG` item at its base `price`, added to
  `s.armory` immediately.
- **Imported** (`isImportedEquipment`, `game/equipment.js:20` — ids 1800 and 1802, the Brown
  Bess and Baker): requires Patriot Ensenada + `reputation.foreign >= 0`, priced via
  `tradeQuote` (`game/politics.js:2-6`, a reputation-scaled multiplier), and delivered after a
  seeded 72–120 h delay via `s.equipmentShipments` (`game/equipment.js:21-25`).

Repairs/resupply are the `repairWeapon` / `resupply` actions (`game/campaign.js:193-198`),
priced by `firearmRepairCost` / `refillCost` (`game/equipment.js:9-10`), requiring an owned,
supplied Retiro/Córdoba/Mendoza workshop. This mirrors the engine's `dRepairCost`/`dSellModifier`
concept but with flat web prices.

---

## 10. Strategic supply and facilities production hooks

### 10.1 Engine facilities

`Strategic/Facilities.h:31-52` defines the facility performance modifiers
(`FACILITY_PERFORMANCE_MOD, FACILITY_SLEEP_MOD, FACILITY_FATIGUE_MOD, FACILITY_KIT_DEGRADE_MOD,
FACILITY_MAX_MORALE, FACILITY_MINE_INCOME_MOD, FACILITY_SKYRIDER_COST_MOD, ...`).
`gamedir/Data-1.13/TableData/Map/FacilityTypes.xml` defines each facility type with its
assignments, staff limits, performance, and conditions (e.g. Hospital → DOCTOR assignment with
`ubMinimumMedical`/`ubMinimumWisdom`). `Facilities.cpp` / `XML_Facilities.cpp` load and apply
them.

### 10.2 Web production hooks

The web clone models production as **recipes** in `game/data.js:558-567` (`RECIPES`):

| Recipe | Hours | Cost | Yield |
|---|---|---|---|
| `powder` | 12 | 20 pesos, 15 saltpeter, 3 charcoal, 2 sulfur | 20 powder |
| `charcoal` | 18 | 10 pesos, 12 timber | 8 charcoal |
| `cartridges` | 12 | 30 pesos, 5 powder, 3 lead | 60 cartridges |
| `muskets` | 24 | 80 pesos, 2 copper, 8 scrapIron, 8 timber | 50 muskets |
| `sabres` | 18 | 60 pesos, 3 copper, 6 scrapIron, 3 charcoal | 20 sabres |
| `cannon` | 48 | 180 pesos, 15 copper, 10 timber, 8 charcoal | 1 cannon |
| `uniforms` | 12 | 40 pesos, 40 textiles, 10 leather | 200 uniforms |
| `infantry` | 24 | 100 pesos, 200 muskets, 200 uniforms, 5 powder | 200 infantry |

`game/industry.js` provides `MATERIAL_STOCK` (starter stocks), `MATERIAL_SITES` (which sector
yields which material), `materialYield` (daily yield from owned/supplied/undamaged sites), and
`productionHours` (recipe hours reduced 10% per active site). `game/campaign.js:277-282`
(`produce`) enforces the recipe, the workshop location (cannon/infantry require Mendoza +
foundry), the 3-concurrent-order cap, and the supply requirement. `game/logistics.js` provides
`CARGO_WEIGHTS` and `TRANSPORT_OPTIONS` for moving materials between depots.

This is the web analogue of the engine's `Facilities` + `Assignments` production model, but
expressed as a recipe table rather than facility-assignment staffing.

---

## 11. XML schemas and key tables (reference)

All under `gamedir/Data-1.13/TableData/Items/` unless noted:

| File | Root element | Key per-entry fields |
|---|---|---|
| `Items.xml` | `<ITEMLIST><ITEM>` | `uiIndex, szItemName, usItemClass, AttachmentClass, nasAttachmentClass, ubWeight, usPrice, ubCoolness, bReliability, bRepairEase, ubPerPocket, ItemSize, Inseparable` |
| `Weapons.xml` | `<WEAPONLIST><WEAPON>` | `uiIndex, szWeaponName, ubWeaponClass, ubWeaponType, ubCalibre, ubReadyTime, ubShotsPerBurst, ubImpact, ubDeadliness, bAccuracy, ubMagSize, usRange, usReloadDelay, APsToReload, SwapClips, nAccuracy, bRecoilX/Y, ubAimLevels, Handling, BarrelConfiguration` |
| `AmmoTypes.xml` | `<AMMOTYPES>` | `uiIndex, red/green/blue, structureImpactReductionMultiplier/Divisor, armourImpactReductionMultiplier/Divisor, beforeArmourDamageMultiplier/Divisor, afterArmourDamageMultiplier/Divisor, zeroMinimumDamage, usPiercePersonChanceModifier, standardIssue, numberOfBullets, multipleBulletDamageMultiplier/Divisor` |
| `Magazines.xml` | `<MAGAZINELIST><MAGAZINE>` | `uiIndex, ubCalibre, ubMagSize, ubAmmoType, ubMagType` |
| `Attachments.xml` | `<ATTACHMENTLIST><ATTACHMENT>` | `attachmentIndex, itemIndex, APCost, NASOnly` |
| `AttachmentSlots.xml` | `<ATTACHMENTSLOTLIST><ATTACHMENTSLOT>` | `uiSlotIndex, szSlotName, nasAttachmentClass, nasLayoutClass, fMultiShot, fBigSlot, ubPocketMapping` |
| `IncompatibleAttachments.xml` | `<INCOMPATIBLEATTACHMENTLIST>` | `itemIndex, incompatibleattachmentIndex` |
| `AttachmentComboMerges.xml` | `<ATTACHMENTCOMBOMERGELIST>` | `uiIndex, usItem, usAttachment1..10` |
| `Explosives.xml` | `<EXPLOSIVELIST><EXPLOSIVE>` | `uiIndex, ubType, ubDamage, ubStunDamage, ubRadius, ubVolume, ubVolatility, ubMagSize, fExplodeOnImpact, usNumFragments, ubFragType, ubFragDamage, ubFragRange` |
| `Armours.xml` | `<ARMOURLIST><ARMOUR>` | `uiIndex, ubArmourClass, ubProtection, ubCoverage, ubDegradePercent` |
| `LoadBearingEquipment.xml` | `<LOADBEARINGEQUIPMENTLIST>` | `lbeIndex, lbeClass, lbeCombo, lbeFilledSize, lbeAvailableVolume, lbePocketsAvailable, lbePocketIndex1..12` |
| `Food.xml` | `<FOODSLIST><FOOD>` | `uiIndex, szName, bFoodPoints, bDrinkPoints, usDecayRate` |
| `FacilityTypes.xml` (TableData/Map) | `<FACILITYTYPES><FACILITYTYPE>` | `ubIndex, szFacilityName, ubTotalStaffLimit, ASSIGNMENT{ubAssignmentType, ubStaffLimit, usPerformance, usKitDegrade, CONDITIONS{ubMinimumMedical, ubMinimumWisdom}}` |

---

## 12. Web JSON schema and shop/inventory UI recipe

### 12.1 Web weapon record (from `game/data.js` `WEAPONS`)

```json
{
  "id": 1800,
  "name": "Brown Bess modelo India",
  "caliber": "Bala de plomo .75",
  "capacity": 1,
  "damage": 58,
  "readyAP": 12,
  "fireAP": 12,
  "aimAP": 6,
  "reloadAP": 45,
  "range": 18,
  "type": "firearm",
  "rifled": false,
  "spread": false,
  "weight": 4
}
```

Blades add `attackAP` and `range: 1`; artillery adds `crew`, `radius`, and `reloadAP`/`fireAP`
with `type: "artillery"`. `game/equipment.js` `EQUIPMENT_CATALOG` adds `item` (the id),
`category` (`firearm`/`blade`/`artillery`), and `price`.

### 12.2 Shop/inventory UI recipe

The web shop/inventory UI is `web/app/Armory.tsx` (21 lines), wired into the campaign office
via `web/app/CampaignOffice.tsx:7` (`import Armory from './Armory'`). The recipe:

1. **Catalog** — `EQUIPMENT_CATALOG` (from `game/equipment.js`) grouped by `category`
   (`firearm`/`blade`/`artillery`), each row showing name, armory quantity
   (`armoryInventory(s)`), and a buy/import button.
2. **Pricing** — local items use `w.price`; imported items (1800/1802) use
   `tradeQuote(s, w.price)` (`game/politics.js:2-6`), which scales by `reputation.foreign`.
3. **Loadout** — per-operative `weapon`/`blade` selects, filtered to owned armory stock; the
   `equip` action (`game/campaign.js:186-192`) swaps the previous item back to the armory.
4. **Camp maintenance** — `refillCost`/`firearmRepairCost` buttons (`resupply`/`repairWeapon`),
   gated on an owned, supplied Retiro/Córdoba/Mendoza workshop.
5. **Artillery battery** — up to 3 selects over `EQUIPMENT_CATALOG` artillery, dispatched via
   `configureArtillery` (`game/campaign.js:179-185`).
6. **Import queue** — `s.equipmentShipments` rendered with hours remaining and blockade delay
   (`Armory.tsx:12`).

The tactical recovered-inventory UI is `web/app/RecoveredInventory.tsx` (8 lines), wired into
`web/app/Battlefield.tsx:9`, which equips looted weapons via the `equipLoot` action
(`game/tactical.js:124`).

---

## 13. Reproduction checklist

Use this to verify a ported system against the engine. Each item cites the engine source.

### 13.1 Item classes and records

- [ ] Item classes are the bitmask flags from `Item Types.h:655-700` (web: string `category`).
- [ ] The `INVTYPE` record fields (weight, price, coolness, reliability, repair ease) map to
      the web weapon/equipment records (`Item Types.h:1094-1240`).
- [ ] The 9 firearms (1800–1808), 5 blades (1809–1813), and 3 artillery (1820–1822) match
      `GranaderosBlackPowder.h` and `original.txt:478-513` (web: `game/data.js` `WEAPONS`).

### 13.2 Weapons and fire modes

- [ ] Fire AP / aim AP / reload AP match `GranaderosBlackPowder.h:12-27` (web:
      `game/tactical.js:4-10` `WEAPONS`).
- [ ] Reload is prorated by rounds and ×1.5 prone (`Points.cpp:2861-2867`; web:
      `tactical.js:33` `reloadCost`).
- [ ] Only `WM_NORMAL` and `WM_ATTACHED_BAYONET` are meaningful (single-shot period weapons).

### 13.3 Ammo and conservation

- [ ] Calibers are the named strings from `original.txt` (web: `game/data.js` `caliber`).
- [ ] Returned ammunition is capped by issued quantity and total stock
      (`game/ammunition.js:1-16`).

### 13.4 Attachments

- [ ] The socket bayonet (1811) is the only period attachment; `AC_BAYONET` is its class
      (`Item Types.h:730`).
- [ ] Bayonet reach/intercept/brace match `original.txt:502` (web: `tactical.js:69,131`).
- [ ] Attachment compatibility XMLs (`Attachments.xml`, `IncompatibleAttachments.xml`) are
      documented even though the web clone does not yet model mounted state.

### 13.5 Explosives and heavy weapons

- [ ] Artillery crew/AP/radius/range match `original.txt:510-513` (web: `tactical.js:11`,
      `data.js:485-520`).
- [ ] Artillery actions (fire/reload/move/pivot) require the crew count and per-crew AP
      (`tactical.js:85-120`).

### 13.6 Armour/LBE/food/medical

- [ ] Period kit weights match `original.txt:519-524` (web: counters in
      `game/campaign.js:56`).
- [ ] The albarda +40 kg mountain carry matches `original.txt:524` (web:
      `game/logistics.js:8` `mules`).

### 13.7 Dealers, pricing, repairs

- [ ] Local vs imported purchase channels match the engine's dealer types
      (`Arms Dealer Init.h:64-72`; web: `game/campaign.js:171-178`).
- [ ] Imported pricing scales with reputation (`game/politics.js:2-6`), the web analogue of
      `dSellModifier` (`Arms Dealer Init.h:153`).
- [ ] Repair/resupply costs are flat web prices (`game/equipment.js:9-10`), the web analogue of
      `CalculateSimpleItemRepairCost` (`Arms Dealer Init.cpp:2003`).

### 13.8 Strategic supply and production

- [ ] Recipes consume actual materials and yield products (`game/data.js:558-567`).
- [ ] Production requires an owned, supplied workshop and respects the 3-order cap
      (`game/campaign.js:277-282`).
- [ ] Material sites yield daily when owned/supplied/undamaged (`game/industry.js:8-11`).
- [ ] Cargo weights and transport options move materials between depots
      (`game/logistics.js:3-9`).

### 13.9 Verification

- [ ] `npm test` passes (equipment, industry, logistics, ammunition, campaign tests).
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` produces `dist/`.
- [ ] A human has bought, equipped, repaired, produced, and transported items end-to-end
      (automated checks do not prove this — `README.md`).

---

## 14. Gotchas

1. **The engine uses a three-table indirection** (`Item → Weapon → Magazine → AmmoType`); the
   web clone flattens this into one record per weapon. Keep the *semantic* fields aligned, not
   the table shape.
2. **Item classes are bitmasks, not enums** (`Item Types.h:655-700`). A single item can be
   `IC_GUN | IC_BLADE` (underbarrel bayonet). The web `category` string cannot express
   multi-class items — document any such case.
3. **`GRANADEROS` only touches `Tactical/`** (`CMakeLists.txt:11-14`). The arms-dealer and
   facility systems are stock JA2 v1.13; the web clone adapts them rather than reproducing
   their full dealer roster.
4. **The web clone has no `Data-Granaderos` directory** — the GRANADEROS data lives in
   `game/data.js`, not in engine XML. The engine `gamedir/Data-1.13/TableData/Items/*.xml` is
   the *schema* reference, not the GRANADEROS content.
5. **Period kit is counters, not finite items** (`game/campaign.js:56`). `docs/EQUIPMENT-IMPLEMENTATION-PLAN.md`
   documents the gap to a full finite-item/container model; do not claim container
   compatibility that does not exist.
6. **The bayonet is not yet a mounted attachment** — it is an interchangeable secondary blade.
   Do not claim musket-mounted bayonet state.
7. **Prices are game-balance values, not historical market claims** (`docs/WEB-SYSTEMS.md:83`).
   The engine's `usPrice`/`dSellModifier` are the *mechanism*; the web flat prices are the
   *balance*.
8. **File names contain spaces** (e.g. `"Arms Dealer Init.cpp"`, `"ShopKeeper Interface.cpp"`).
   Grep/glob patterns must quote them.
