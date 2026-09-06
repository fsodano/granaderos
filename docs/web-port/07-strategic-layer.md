# 07 — Strategic Layer (engine/Strategic → game/campaign.js + clock/world)

Reference for porting the JA2 v1.13-derived strategic layer to the browser
simulation. Every claim below is extracted from the C++ engine under
`engine/Strategic/` and mapped to the JavaScript implementation in
`game/campaign.js` and its satellite modules (`time.js`, `world.js`,
`cities.js`, `militia.js`, `garrison.js`, `missions.js`, `quests.js`,
`industry.js`, `politics.js`, plus `data.js`, `narrative.js`, `logistics.js`,
`equipment.js`, `contracts.js`, `recruitment.js`, `horses.js`, `squads.js`,
`save.js`). Line numbers cite the current working tree; treat them as anchors,
not a contract.

Scope: game clock and time compression, the strategic event system, the map
screen (sectors, squad movement, transport), assignments (training, repair,
doctors), militia/garrison, facilities, auto resolve, enemy strategic AI,
mines/income economy, and the strategic→tactical handoff. **Out of scope:**
tactical combat rules (see `03-tactical-combat.md`), soldier stat definitions
(`04-soldiers-stats.md`), and the laptop/desk UI (`07-laptop.md` in the
overview's numbering).

---

## 1. Source map

| Subsystem | C++ anchor | JS anchor |
|---|---|---|
| Game clock / time compression | `engine/Strategic/Game Clock.cpp` `AdvanceClock`, `UpdateClock`, `giTimeCompressSpeeds` | `game/campaign.js` `tick`, `campaignDate`; `game/time.js` `advanceBattleClock`, `syncBattleTime` |
| Strategic event queue | `engine/Strategic/Game Events.h` `STRATEGICEVENT`, `AddAdvancedStrategicEvent` | `game/campaign.js` `dispatchCampaign` (reducer) + due-timestamp fields (`due`, `expiresAt`, `hireUntil`) |
| Event hooks | `engine/Strategic/Game Event Hook.h` `EVENT_*` | `game/campaign.js` `tick` hourly/daily branches; `game/politics.js` `dailyPolitics` |
| Map screen | `engine/Strategic/Map Screen Interface Map.cpp`, `Map Screen Interface Bottom.cpp`, `Map Screen Helicopter.cpp` | `game/data.js` `CAMPAIGN_SECTORS`; `game/campaign.js` `travel`, `attack`, `visitSector` |
| Assignments | `engine/Strategic/Assignments.h` assignment enum | `game/campaign.js` `militia`, `resupply`, `repairWeapon`, `produce`; `game/skill-training.js` `validateTraining` |
| Militia | `engine/Strategic/Town Militia.cpp`, `MilitiaSquads.cpp` | `game/militia.js` `militiaCourse`, `militiaEligibility`; `game/garrison.js` `prepareGarrison`, `returnGarrison` |
| Facilities | `engine/Strategic/Facilities.h` | `game/campaign.js` `academy`, `foundry`, `produce`; `game/industry.js` `MATERIAL_SITES` |
| Auto resolve | `engine/Strategic/Auto Resolve.cpp` `EnterAutoResolveMode` | `game/campaign.js` `raid` defense roll; `game/narrative.js` `oppositionFor` |
| Strategic AI | `engine/Strategic/Strategic AI.cpp`, `Queen Command.cpp`, `Campaign Init.cpp` | `game/campaign.js` `raid`; `game/narrative.js` `ROYALIST_COMMANDS`, `royalistIntel` |
| Mines / income | `engine/Strategic/Strategic Mines.cpp`, `Map Screen Interface TownMine Info.cpp` | `game/campaign.js` daily income loop; `game/industry.js` `materialYield`; `game/narrative.js` `coastalRevenue` |
| Town loyalty | `engine/Strategic/Strategic Town Loyalty.cpp` | `game/cities.js` `recordCityLoyalty`, `getCityStatus` |
| Quests | `engine/Strategic/Quests.cpp` | `game/quests.js` `questForNPC`, `validateQuests` |
| Missions | `engine/Strategic/Meanwhile.cpp` (cutscenes) | `game/missions.js` `MISSION_SCENES`, `talkMission` |
| Save | `engine/Strategic/Game Events.h` `SaveStrategicEventsToSavedGame` | `game/save.js` `encodeSave`/`decodeSave`; `game/campaign.js` `restoreCampaign` |

---

## 2. Game Clock and time compression

### 2.1 Time model

The browser campaign is an **hour-discrete simulation**. `initialCampaign`
(`game/campaign.js:55`) seeds `hour:0`; every strategic order that consumes
time calls `tick(s,hours)` (`game/campaign.js:116`), which advances the clock
one hour at a time and runs the per-hour pipeline. The calendar is derived, not
stored: `campaignDate(s)` (`game/campaign.js:47`) computes a 30-day-month,
360-day-year calendar starting **1 March 1812**:

```
day   = floor(hour / 24)
year  = 1812 + floor((2 + floor(day/30)) / 12)
month = (2 + floor(day/30)) % 12 + 1
day   = day % 30 + 1
hour  = hour % 24
```

Winter (months 6–8) closes the Andean passes: `travel` and `attack` reject
routes through `uspallata`/`los_patos` during those months
(`game/campaign.js:265`, `:315`).

### 2.2 Time compression

The C++ clock exposes six compression speeds
(`Game Clock.h:87-94`, `Game Clock.cpp:93`):

| C++ constant | Value | Meaning |
|---|---|---|
| `NOT_USING_TIME_COMPRESSION` | −1 | paused |
| `TIME_COMPRESS_X0` | 0 | real time |
| `TIME_COMPRESS_X1` | 1 | 1 game-second per real second |
| `TIME_COMPRESS_5MINS` | 5·60 | 5 game-minutes per real second |
| `TIME_COMPRESS_30MINS` | 30·60 | 30 game-minutes per real second |
| `TIME_COMPRESS_60MINS` | 60·60 | 1 game-hour per real second |
| `TIME_SUPER_COMPRESS` | — | fast-forward until next event |

`AdvanceClock` (`Game Clock.cpp:190`) advances `guiGameClock` and fires
strategic events whose `uiTimeStamp` has been reached. The browser port
replaces continuous compression with **discrete hour jumps**: the player issues
`wait {hours}` (default 24, clamped 1–240, `game/campaign.js:117`) or a
travel/attack order that internally calls `tick`. There is no real-time clock;
`game/time.js` only reconciles the *tactical* clock (see §2.5).

### 2.3 Clock-tick diagram

```
dispatchCampaign(state, action)
        │
        ▼
   clone(state) ──► migrateSquads / migrateContracts / defaults
        │
        ▼
   switch(action.type)
        │
        ├── wait / travel / attack / syncTacticalTime ──► tick(s, hours)
        │                                                      │
        │                                                      ▼
        │                                          for i in 1..hours:
        │                                              s.hour++
        │                                              ├─ contract expiry check        (per recruited id)
        │                                              ├─ horseState advance           (horses.js:applyHorseAction)
        │                                              ├─ militia course progress      (militiaTraining)
        │                                              ├─ convoy delivery              (convoyStatus ready)
        │                                              ├─ equipment shipments          (equipment.js:deliverEquipmentShipments)
        │                                              ├─ production completion        (production due)
        │                                              ├─ contraband arrival           (shipments due)
        │                                              ├─ if hour % 24 == 0:  DAILY    (income, politics, recovery)
        │                                              ├─ if hour % 720 == 0: PAYROLL  (legacy stipends)
        │                                              ├─ if hour % 120 == 0: raid north
        │                                              ├─ if hour % 168 == 0: raid coast (if coastalRevenue ≥ 500)
        │                                              ├─ if hour % 144 == 0: raid interior
        │                                              └─ progress(s)  (phase gates; defeat breaks loop)
        │
        ├── battleResult / leaveSector ──► reconcile survivors, garrison, ammo
        │
        ▼
   releaseDeferred(s) → synchronizeSquad(s) → progress(s) → return s
```

### 2.4 Hourly tick pipeline (`game/campaign.js:tick`, `:116-147`)

Each of the `hours` iterations performs, in order:

1. **Contract expiry** (`:119`): for every recruited operative whose
   `contracts[id].expiresAt <= hour`, the operative leaves service — unless
   currently deployed in a pending battle, in which case `departurePending` is
   set and the departure is deferred until `releaseDeferred` (`:115`).
2. **Horse clock** (`:119`): `applyHorseAction({type:'advance',hour})`
   (`game/horses.js:13`) advances feed/condition/stamina, returns hired mounts
   at `hireUntil`, and births foals at `pregnantUntil`.
3. **Militia courses** (`:120-124`): each `militiaTraining` entry decrements
   `remaining`; a course completes when it reaches 0, adding `count` militia to
   `sectors[sector].militia[rank]`. Courses pause (not cancel) when the sector
   is occupied, the trainer dies/moves, supply is cut, or the city loses
   eligibility (`militiaEligibility`).
4. **Convoys** (`:125-129`): a convoy whose `due` has passed and whose route is
   still open (`convoyStatus`, `game/logistics.js:45`) delivers its goods into
   the reserve or the destination depot.
5. **Equipment shipments** (`:130`): `deliverEquipmentShipments`
   (`game/equipment.js:21`) lands imported arms at Ensenada unless blockaded.
6. **Production** (`:131`): a `production` task whose `due` has passed and whose
   sector is owned+supplied adds its `yield` to the reserve.
7. **Contraband** (`:132`): `shipments` arrive when due, if Ensenada is Patriot
   and not blockaded.

### 2.5 Daily tick (`hour % 24 === 0`, `game/campaign.js:133-140`)

- `dailyPolitics(s)` (`game/politics.js:28`): weekly tax reminders, Pardos
  demands, and Indigenous frontier retaliation.
- **Income**: each Patriot sector contributes
  `floor(income × damageMultiplier × blockadeMultiplier × supplyMultiplier)`
  where damage (`damageUntil > hour`) cuts income to 25%, coastal blockade to
  25%, and an unsupplied sector to 50%. Supplied sectors gain +1 loyalty.
- **Material yield**: `materialYield(s,isSupplied)` (`game/industry.js:8`)
  adds per-site raw materials (Córdoba timber/iron, Mendoza copper/charcoal/
  sulfur, Salta lead/saltpeter, etc.).
- **Recovery**: recruited operatives not deployed in a supplied sector recover
  +5 HP and −10 fatigue.

### 2.6 Monthly payroll (`hour % 720 === 0`, `game/campaign.js:141`)

Only `legacy` contracts (pre-redesign saves) draw monthly stipends. If the
treasury covers the payroll, `foreign` standing rises +5; otherwise `foreign`
−20 and `directory` −10. Paid day/week/month contracts are handled by the
expiry check in §2.4 instead.

### 2.7 Tactical clock sync (`game/time.js`)

`COMBAT_ROUND_SECONDS = 6` and `REST_SECONDS = 600` (`game/time.js:2-3`) are
the tactical time constants. `advanceBattleClock` (`game/time.js:4`) advances
the battle's `elapsedSeconds` and recomputes `night` and light timers.
`syncBattleTime` (`game/time.js:9`) calls
`dispatchCampaign({type:'syncTacticalTime', battleId, elapsedSeconds})`
(`game/campaign.js:160`), which converts elapsed tactical seconds into whole
strategic hours (`secondOfHour` carries the remainder) and runs `tick` for
those hours. This is the only path where tactical time advances the strategic
clock; an open tactical sector pauses strategic contract expiry
(`docs/WEB-SYSTEMS.md:119`).

---

## 3. Strategic event system (Game Events / Game Event Hook)

### 3.1 C++ model

`STRATEGICEVENT` (`Game Events.h:10-19`) is a linked list node with
`uiTimeStamp`, `uiParam`, `ubEventType`, `ubCallbackID`, and flags
(`SEF_PREVENT_DELETION`, `SEF_DELETION_PENDING`). Events are scheduled with
`AddAdvancedStrategicEvent` and executed by `ExecuteStrategicEvent` when the
clock reaches their timestamp. Event **types** (`Game Events.h:22-29`):

| Type | Meaning |
|---|---|
| `ONETIME_EVENT` | fires once at timestamp |
| `RANGED_EVENT` | fires once within a time window |
| `ENDRANGED_EVENT` | closes a ranged window |
| `EVERYDAY_EVENT` | repeats daily |
| `PERIODIC_EVENT` | repeats on a period |
| `QUEUED_EVENT` | deferred until conditions allow |

The **hook callbacks** (`Game Event Hook.h:7+`) include `EVENT_HOURLY_UPDATE`,
`EVENT_HANDLE_MINE_INCOME`, `EVENT_SETUP_MINE_INCOME`, `EVENT_QUEUED_BATTLE`,
`EVENT_GROUP_ARRIVAL`, `EVENT_MERC_CONTRACT_OVER`, `EVENT_DAILY_UPDATE_OF_MERC_SITE`,
`EVENT_CHANGELIGHTVAL`, `EVENT_WEATHERSTART/END`, `EVENT_CHECKFORQUESTS`, and
`EVENT_HELICOPTER_*` hooks.

### 3.2 JS equivalent

The browser port has **no event queue object**. Instead:

- **Scheduled work** is stored as due timestamps on state and polled by the
  hourly tick: `production[].due`, `shipments[].due`,
  `equipmentShipments[].due`, `convoys[].due`, `contracts[id].expiresAt`,
  `militiaTraining[].remaining`, `horseState.horses[].hireUntil/pregnantUntil`,
  `politics.requisitionAfter`, `sectors[].damageUntil`.
- **Periodic events** are modulo checks in `tick` (§2.3): raids at
  `hour % 120/144/168`, payroll at `hour % 720`, daily at `hour % 24`.
- **One-time events** are reducer actions gated by flags: `academy`,
  `foundry`, `diplomacy` kinds, `visitMission`, `talkNPC` approaches.
- **Queued events** map to `deferredRaids` (`game/campaign.js:104`, `:115`):
  a raid targeting a sector with a pending battle is deferred and re-fired by
  `releaseDeferred` after the battle resolves.

### 3.3 Event/type enums (JS)

Reducer action types accepted by `dispatchCampaign` (`game/campaign.js:159-343`):

```
syncTacticalTime  wait              academy           horseAction
purchaseEquipment configureArtillery equip             resupply
repairWeapon      createOfficer     recruitCivic      recruit (rejected)
renewContract     dismiss           createSquad       squad
selectSquad       talkNPC           visitMission      finishMission
visitSector       leaveSector       travel            supplyTransfer
transport         produce           foundry           contraband
policy            diplomacy         militia           cancelMilitia
fortify           attack            battleResult
```

Diplomacy kinds (`game/campaign.js:288-299`): `northPact`, `partisanSupply`,
`parliament`, `emancipation`, `commission`, `gift`, `requisition`, `autonomy`.
Policy kinds (`game/politics.js:13`): `tax`, `frontierRequisition`.
Horse orders (`game/horses.js:8`): `acquire`, `hire`, `feed`, `assign`,
`unassign`, `ride`, `breed`, `advance`.
Transport modes (`game/logistics.js:4`): `posta`, `carts`, `flotilla`, `mules`.
Battle outcomes (`game/campaign.js:325`): `victory`, `defeat`, `retreat`.
Talk approaches (`game/campaign.js:225`): `friendly`, `direct`, `recruit`,
`quest`, `mission`.
Loyalty event kinds (`game/cities.js:23`): `quest` (+8), `victory` (+10),
`defense` (+3), `defeat` (−12).
Raid theaters (`game/campaign.js:99`): `north`, `coast`, `interior`.
Contract terms (`game/contracts.js:1`): `day` (24h), `week` (168h), `month`
(720h); kinds `paid`, `patriot`, `legacy`.
Mission stages (`game/missions.js:16`): `arrival`, `reports`, `assessment`,
`ready`, `completed`, `failed`.
Quest statuses (`game/quests.js:7`): `unoffered`, `offered`, `completed`.

---

## 4. Map Screen Interface

### 4.1 Sectors

The C++ map is a 16×16 grid of `SEC_A1 … SEC_P16` (`Campaign Types.h:33-52`)
with per-sector strategic values (`NO_VALUE … GOOD_VALUE`,
`Campaign Types.h:64`) and group types `NOGROUP/MOBILE/DEFENCE`
(`Campaign Types.h:57`). The browser port collapses this to **13 authored
sectors** in `CAMPAIGN_SECTORS` (`game/data.js:536-550`), each with:

```js
{ id, grid, name, theater, biome, x, y, income, asset, neighbors }
```

Example: `{id:'cordoba', grid:'F5', theater:'interior', biome:'scrub',
income:130, asset:'Maestranza y cruce del Camino Real',
neighbors:['buenos_aires','san_nicolas','santa_fe','tucuman','mendoza']}`.

Theaters (`game/data.js:531`): `coast`, `interior`, `cuyo`, `north`. Biomes:
`urban`, `wetland`, `river`, `scrub`, `foothills`, `mountain`, `forest`.
`grid` labels are the specification's campaign references, not geographic
coordinates (`game/data.js:535`).

### 4.2 Sector schema proposal (runtime state)

`initialCampaign` (`game/campaign.js:56`) builds `sectors` as a map keyed by
sector id. Proposed canonical schema for the runtime sector record:

```js
sectors[<id>] = {
  owner: 'patriot' | 'royalist',   // campaign.js:56
  loyalty: 0..100,                 // starts 65 (capital trio) / 25 (rest)
  militia: [rank0, rank1, rank2],  // 3 ranks, cohort of 3, cap 60 (militia.js:4-5)
  damageUntil: hour,               // raid damage window; income ×0.25 (campaign.js:136)
  fort: 0..3,                      // fortify raises; defense +4/level (campaign.js:108,312)
}
```

Derived per-sector/city views: `getCityStatus` (`game/cities.js:16`) groups
sectors into operational cities (`CITIES`, `game/cities.js:4`) and computes
average loyalty + `controlled`; `isSupplied` (`game/campaign.js:58`) runs a BFS
from `buenos_aires` through Patriot-owned neighbors.

### 4.3 Squad movement

- `travel` (`game/campaign.js:258-269`): requires a Patriot destination, a
  Patriot-only path (`travelPath`, `game/campaign.js:148`), and a non-empty
  squad. Mode `march` costs 12h/leg, `posta` 4h/leg (consumes a remount per
  leg), `flotilla` 5h/leg (coastal, unblocked), `carts` 18h/leg; mountains
  ×1.5. Winter closes the passes. Fatigue accrues (+8, or +20 in mountains,
  unless operative 57 is recruited). A raid that cuts the route mid-march stops
  the advance at the last open sector.
- `attack` (`game/campaign.js:313-322`): requires adjacency to the target
  (or `san_lorenzo` from `san_nicolas`); a non-San-Lorenzo attack advances the
  clock 12h and moves the squad to the target sector before deploying.
- `visitSector` (`game/campaign.js:248-251`): opens the current friendly
  sector as an exploration tactical request (no capture reward).
- `selectSquad`/`createSquad`/`squad` (`game/campaign.js:212-221`): up to 8
  squads of ≤6 members; `synchronizeSquad` (`game/squads.js:9`) keeps the
  legacy `squad`/`location` aliases in sync.

### 4.4 Vehicles / helicopter → transport mapping

The C++ map screen supports vehicles and the Skyrider helicopter
(`Map Screen Helicopter.cpp`, `FACILITY_SKYRIDER_COST_MOD` in
`Facilities.h:45`). The browser port has no vehicles or helicopter; the
equivalent mobility layer is:

| C++ capability | JS equivalent |
|---|---|
| Vehicle squad movement | `travel` modes `posta`/`carts`/`flotilla`/`mules` (`game/logistics.js:4`) |
| Helicopter refuel/hover events | `EVENT_HELICOPTER_*` hooks → not ported; no air transport |
| Skyrider cost modifier | `FACILITY_SKYRIDER_COST_MOD` → not ported |
| Individual mounts | `horseAction` + `mountForOperative` (`game/horses.js:28`); assigned horses enter tactical loadouts |

---

## 5. Assignments

### 5.1 C++ assignment enum → JS equivalents

`Assignments.h:37-124` defines the full assignment enum. The browser port
implements a subset as reducer actions:

| C++ assignment | JS equivalent |
|---|---|
| `SQUAD_1 … SQUAD_40`, `ON_DUTY` | `createSquad`/`selectSquad`/`squad` (`game/campaign.js:212-221`) |
| `TRAIN_SELF`, `TRAIN_TOWN`, `TRAIN_TEAMMATE`, `TRAIN_BY_OTHER` | `skill-training.js` `validateTraining` (trained stats persist via `returnTraining`, `game/campaign.js:34`) |
| `REPAIR`, `FACILITY_REPAIR` | `repairWeapon` (`game/campaign.js:193-198`), cost `firearmRepairCost` (`game/equipment.js:10`) |
| `DOCTOR`, `PATIENT`, `FACILITY_DOCTOR`, `FACILITY_PATIENT` | daily HP recovery in `tick` (`game/campaign.js:138`); `medical` skill on operatives; no dedicated doctor assignment |
| `DRILL_MILITIA`, `DOCTOR_MILITIA` | `militia` order + `militiaTraining` courses (`game/campaign.js:300-308`) |
| `FORTIFICATION` | `fortify` (`game/campaign.js:312`) |
| `MOVE_EQUIPMENT` | `supplyTransfer` (`game/campaign.js:270-274`) |
| `VEHICLE`, `IN_TRANSIT` | convoy objects in `state.convoys` (`game/campaign.js:273`) |
| `RADIO_SCAN`, `GATHERINTEL`, `CONCEALED`, `SNITCH_*`, `BURIAL`, `ADMINISTRATION`, `EXPLORATION`, `DISEASE_*`, `ASSIGNMENT_POW/HOSPITAL` | not ported |

Trainable stats (`Assignments.h:167-176`): `HEALTH, AGILITY, DEXTERITY,
STRENGTH, LEADERSHIP, MARKSMANSHIP, MECHANICAL, EXPLOSIVE_ASSIGN, MEDICAL`
(wisdom is not trainable). The JS `TRAINABLE_SKILLS` list in
`game/skill-training.js` mirrors this set for the campaign roster.

### 5.2 Training

- **Skill training**: `returnTraining` (`game/campaign.js:34`) validates and
  stores `trainedStats`/`skillPractice` from tactical reports; `rosterFor`
  (`game/campaign.js:33`) overlays trained stats onto base profiles.
- **Militia training**: `militiaCourse(trainer,rank)` (`game/militia.js:6`)
  computes hours from leadership, specialist traits (`line_marksman`,
  `guerrilla_tactician`), and the `teacher` trait; cost is
  `{treasury:60*(rank+1), muskets: rank===1?0:5, horses: rank===1?3:0}`.
  `militiaEligibility` (`game/militia.js:16`) requires a fully controlled city
  with average loyalty ≥ 50 (`CITY_LOYALTY_THRESHOLD`, `game/cities.js:3`).
- **Officer creation**: `createOfficer` (`game/campaign.js:199-202`) charges
  300 pesos and builds a custom officer via `createOfficerRecord`
  (`game/recruitment.js:26`).

### 5.3 Repair and resupply

`resupply`/`repairWeapon` (`game/campaign.js:193-198`) require the operative to
be at an owned, supplied `retiro`/`cordoba`/`mendoza` workshop. `refillCost`
(`game/equipment.js:9`) charges for missing priming/flints/rations/torches;
`firearmRepairCost` (`game/equipment.js:10`) charges 1.5 pesos per missing
condition point.

### 5.4 Doctors / medical

There is no dedicated doctor assignment in the JS port. Medical capacity is
expressed as: the `medical` stat on operatives (e.g. Paroissien 98,
`game/data.js:233`), daily +5 HP recovery for non-deployed operatives in
supplied sectors (`game/campaign.js:138`), and `hp` reconciliation on
`battleResult`/`leaveSector` (`game/campaign.js:329`, `:255`). The C++
`DOCTOR`/`PATIENT`/`FACILITY_DOCTOR` assignments and `DISEASE_*` hooks are
unported.

---

## 6. Militia and garrisons

- **Strategic militia** are three ranks (`MILITIA_NAMES`, `game/militia.js:3`):
  Cívicos, Montoneras, Granaderos y línea. `MILITIA_COHORT = 3`,
  `MILITIA_LIMIT = 60` (`game/militia.js:4-5`). Promotion consumes a cohort of
  the previous rank; `cancelMilitia` refunds the cohort
  (`game/campaign.js:309-311`).
- **Garrison deployment**: `prepareGarrison(s,sector)` (`game/garrison.js:8`)
  converts strategic militia counts into persistent tactical soldiers with
  rank-specific stats (`GARRISON_RANKS`, `game/garrison.js:3`), stable numeric
  IDs starting at 20000, and finite cartridges deducted from campaign stores.
  Garrisons deploy only in Patriot-controlled sectors (defense/exploration),
  never on offensive missions (`docs/WEB-SYSTEMS.md:135`).
- **Garrison return**: `returnGarrison` (`game/garrison.js:21`) requires a
  complete validated tactical snapshot, removes dead defenders from strategic
  militia counts, and preserves surviving identities. `validGarrisons`
  (`game/garrison.js:28`) validates the saved roster.
- **Raid defense**: `raid` (`game/campaign.js:99-113`) computes
  `defense = Σ militia[rank]×(rank+1) + fort×4 + squad members×2 (+5 north pact)`
  and compares against enemy `strength = 3 + floor(hour/240)`. A successful
  defense records a `defense` loyalty event; a failed defense sets
  `damageUntil = hour + 24×14`, records `defeat`, and (for interior/coast)
  may flip ownership or impose a blockade.

---

## 7. Facilities

The C++ facility system (`Facilities.h:31-53`) provides global modifiers
(`FACILITY_PERFORMANCE_MOD`, `FACILITY_MINE_INCOME_MOD`,
`FACILITY_SKYRIDER_COST_MOD`, `FACILITY_CANTINA_MOD`, `FACILITY_PRISON_MOD`,
etc.) and daily income/debt settlement (`HandleDailyPaymentFacilityIncome`).
The browser port replaces facilities with **flag-gated campaign actions**:

| C++ facility concept | JS equivalent |
|---|---|
| Facility staffing (`FACILITY_STAFF`) | `academy` (Retiro, `game/campaign.js:162`), `foundry` (El Plumerillo, `:282`) |
| Mine income modifier | `MATERIAL_SITES` + `materialYield` (`game/industry.js:3-10`) |
| Workshops | `produce` with `RECIPES` (`game/campaign.js:276-281`, `game/data.js:558-567`); ≤3 concurrent orders per maestranza |
| Facility debt | not ported; payroll shortfall instead hits `foreign`/`directory` standing (`game/campaign.js:141`) |

Production recipes: `powder`, `charcoal`, `cartridges`, `muskets`, `sabres`,
`cannon`, `uniforms`, `infantry` (`game/data.js:558-567`). `productionHours`
(`game/industry.js:12`) shortens recipes as more material sites are controlled.

---

## 8. Auto Resolve

`EnterAutoResolveMode` (`Auto Resolve.h:36`) runs a fast abstract battle with
generic face icons (`ADMIN_FACE … AUTORESOLVEFACES_MAX`,
`Auto Resolve.h:7-33`). The browser port has **no player-facing auto-resolve
screen**; the equivalent abstraction is the **raid defense roll** in `raid`
(`game/campaign.js:107-109`): a numeric comparison of militia/fort/squad
defense against enemy strength, resolved instantly with a loyalty event and a
log entry. Player-initiated battles always enter tactical combat
(`attack`, `game/campaign.js:313`). A future auto-resolve could reuse
`oppositionFor` (`game/narrative.js:25`) to generate the enemy force and the
`defense` formula as the resolution function.

---

## 9. Enemy strategic AI (Campaign Init / Strategic AI / Queen Command)

The C++ side runs `Strategic AI.cpp` / `Queen Command.cpp` (Queen's army
orders) initialized by `Campaign Init.cpp`. The browser port implements a
**deterministic, schedule-driven AI** in `game/narrative.js` + `game/campaign.js`:

- **Command hierarchy**: `ROYALIST_COMMANDS` (`game/narrative.js:2`) defines
  four commands — `crown` (Elío/Vigodet), `north` (Pezuela/Tristán), `naval`
  (Romarate), `partisans` (local loyalist cadres) — each with theater,
  objective, and doctrine.
- **Northern advance** (`game/campaign.js:142`): every 120h, `raid('north')`
  targets the first Patriot sector in `NORTHERN_AXIS`
  (`['humahuaca','jujuy','salta','tucuman']`, `game/narrative.js:8`). A
  defended border blocks the advance; the AI cannot skip it.
- **Coastal raids** (`game/campaign.js:143`): every 168h, if
  `coastalRevenue(s) >= 500` (`game/narrative.js:9`), Romarate raids the most
  valuable Patriot port; success imposes `blockade = true`, which then reduces
  the revenue that motivated the raid.
- **Interior sabotage** (`game/campaign.js:144`): every 144h, low-loyalty
  Córdoba (<50) is raided; success seizes up to 150 pesos and 20 powder and
  flips the sector.
- **Intel view**: `royalistIntel(s)` (`game/narrative.js:10`) exposes each
  command's current target, `nextActionHours`, and `active` state for the UI.
- **Battle opposition**: `oppositionFor(request)` (`game/narrative.js:25`)
  generates the enemy force for a pending battle from the theater's command,
  with difficulty `1 + floor(hour/240) + (north?1:0)` capped at 4
  (`game/campaign.js:322`).
- **Mentorship**: `mentorDispatch(s)` (`game/narrative.js:15`) returns
  San Martín's phase-specific advisory text and `deployable: phase >= 4`.

---

## 10. Game Events / Hooks (JS scheduled events)

The JS equivalent of the C++ event hooks, keyed to the tick pipeline:

| C++ hook | JS trigger |
|---|---|
| `EVENT_HOURLY_UPDATE` | every hour in `tick` (`game/campaign.js:118-146`) |
| `EVENT_HANDLE_MINE_INCOME` / `EVENT_SETUP_MINE_INCOME` | daily income loop (`game/campaign.js:133-140`) + `materialYield` (`game/industry.js:8`) |
| `EVENT_QUEUED_BATTLE` | `pendingBattle` gate in `dispatchCampaign` (`game/campaign.js:157`) |
| `EVENT_GROUP_ARRIVAL` | convoy delivery (`game/campaign.js:125-129`) |
| `EVENT_MERC_CONTRACT_OVER` | contract expiry check (`game/campaign.js:119`) |
| `EVENT_CHECKFORQUESTS` | `questForNPC` availability in `talkNPC` (`game/campaign.js:229-233`) |
| `EVENT_CHANGELIGHTVAL` / `EVENT_WEATHERSTART/END` | `pendingBattle.weather` + `night` (`game/campaign.js:250`, `:322`; `game/time.js:6`) |
| `EVENT_DAILY_UPDATE_OF_MERC_SITE` | daily recovery (`game/campaign.js:138`) |

---

## 11. Mines and income economy

The C++ mines (`Strategic Mines.cpp`, `Map Screen Interface TownMine Info.cpp`)
produce daily income per controlled mine. The browser port splits this into:

- **Silver income**: daily `treasury` from Patriot sectors
  (`game/campaign.js:136`), modified by damage/blockade/supply. Sector `income`
  values are authored in `CAMPAIGN_SECTORS` (`game/data.js:536-550`).
- **Raw materials**: `MATERIAL_SITES` (`game/industry.js:3`) yield per-site
  materials daily when owned, undamaged, and supplied; `materialYield`
  aggregates them. `MATERIAL_STOCK` (`game/industry.js:2`) is the starting
  stock.
- **Contraband**: `contraband` (`game/campaign.js:283-286`) buys arms/supplies/
  materials/mounts/winter goods at `tradeQuote` prices (`game/politics.js:2`),
  arriving after a seeded 72–120h delay if Ensenada is open and unblocked.
- **Imports**: `purchaseEquipment` for imported items (Brown Bess 1800, Baker
  1802 — `isImportedEquipment`, `game/equipment.js:20`) requires Ensenada and
  `reputation.foreign >= 0`, landing via `equipmentShipments`.
- **Taxes**: `policy 'tax'` (`game/politics.js:15`) remits 120 pesos per
  168-hour period; `policyStatus` (`game/politics.js:7`) tracks `taxDue` and
  `requisitionReady` (336h cooldown).
- **Payroll**: monthly legacy stipends (§2.6) compete with industrial spending
  for the same treasury.

---

## 12. Strategic → tactical handoff sequence

```
1. dispatchCampaign(s, {type:'attack', sector})            campaign.js:313
2.   validate adjacency / phase / winter / supply           :315-317
3.   tick(s, 12) if moving from a neighbor                  :318
4.   allocate cartridges from reserve+depot (≤10/firearm)   :319-321
5.   build pendingBattle:                                   :322
       { id, origin, sector, name, biome, theater, seed,
         issuedCartridges, wasRoyalist, squad:[roster+state+ammo+mount+poncho],
         difficulty, weather, cannons, artillery, garrison,
         garrisonLootSources, enemyCommand/Commander/Objective,
         enemies, missionId?, missionAllies? }
6.   prepareGarrison(s, sector) → pendingBattle.garrison    garrison.js:8
7. UI: world.js enterSector(request, previous)              world.js:5
       builds map, merges garrison + squad + allies,
       restores terrain/ground gear/lights from previous
8. Tactical play (out of scope here) — time.js syncBattleTime
       periodically calls syncTacticalTime to fold elapsed
       tactical seconds into strategic hours                time.js:9
9. dispatchCampaign(s, {type:'battleResult', outcome,
       battleId, survivors, sectorState})                   campaign.js:324
10.  validate outcome + snapshot; reconcile survivors,
      garrison (returnGarrison), ammo (returnAmmunition),
      HP/fatigue/supplies, XP for officer/civics            :328-334
11.  victory → liberate sector, clear blockade, capture
      bounty, loyalty event; defeat/retreat → return to
      origin                                               :335-339
12.  store sectorStates[sector] snapshot; clear pendingBattle;
      refill squad from reserve if empty; defeat check      :340-341
13.  releaseDeferred(s) → fire deferred raids                :115
```

The exploration variant (`visitSector` → `leaveSector`,
`game/campaign.js:248-257`) follows the same shape but never awards capture
bounty and requires `pendingBattle.exploration === true`.

---

## 13. Save-relevant state

`restoreCampaign` (`game/campaign.js:350-401`) is the authoritative schema.
Persisted top-level fields (all validated):

| Field | Validation anchor |
|---|---|
| `version`, `hour`, `phase`, `seed`, `location` | `:355` |
| `resources` (all `RESOURCE_NAMES` keys, ≤1e9) | `:357` |
| `reputation` (6 factions, −100..100, royalists pinned −100) | `:358` |
| `sectors` (13 records: owner/loyalty/fort/damageUntil/militia[3]) | `:359` |
| `militiaTraining` (≤13, unique sector+trainer) | `:361` |
| `officer` (null or name+answers) | `:363-365` |
| `operativeState` (per-op HP/fatigue/alive/xp/supplies/inventory) | `:366-368` |
| `depots`, `convoys`, `routes` | `:369-371` |
| `missions`, `sceneStates`, `missionAllies` | `:372` |
| `garrisons`, `nextMilitiaId` | `:373` |
| `quests` | `:374` |
| `conversations`, `lastConversation` | `:376-377` |
| `armory`, `loadouts`, `artillerySelection` | `:378-380` |
| `cityLoyaltyEvents` | `:381` |
| `contracts` (paid/patriot/legacy, day/week/month) | `:382` |
| `recruited`, `squad`, `squads` (≤8, unique members) | `:383-398` |
| `flags`, `routes` booleans | `:386` |
| `production`, `shipments`, `equipmentShipments` | `:388-389`, `equipment.js:26` |
| `blockade`, `completed`, `defeated`, `log` (≤80) | `:390` |
| `pendingBattle` (id/sector/seed/squad/garrison/missionAllies) | `:391` |
| `horseState` (version 1, unique horse ids, assigned mounts unique) | `:392-395` |
| `sectorStates` (validated tactical snapshots) | `:399` |
| `secondOfHour`, `deferredRaids`, `politics` | `:400`, `politics.js:37` |

`save.js:encodeSave` wraps `{format:'granaderos', schema:1, savedAt, campaign,
battle}`; `decodeSave` (`game/save.js:5`) cross-checks that a stored battle
matches `pendingBattle` (id, sector, squad, synced clock).

---

## 14. Reproduction checklist

To verify the strategic layer end-to-end (mirrors `tests/campaign-web.test.mjs`
and `tests/contracts-web.test.mjs`):

1. **Clock**: `initialCampaign()` starts `hour:0`; `campaignDate` returns
   1 March 1812. `wait {hours:24}` advances exactly 24 and fires one daily
   tick (income + politics + recovery).
2. **Calendar**: advance past month 6 and attempt `travel` to `uspallata` —
   rejected with the winter-pass error (`game/campaign.js:265`).
3. **Supply**: liberate a sector disconnected from Buenos Aires and confirm
   `isSupplied` is false, income ×0.5, and production/convoys suspend.
4. **Raids**: at `hour % 120 === 0` with a Patriot `humahuaca`, a north raid
   fires; a defended border (militia+fort) repels it and records a `defense`
   loyalty event; an undefended one flips ownership and sets `damageUntil`.
5. **Blockade**: reach `coastalRevenue >= 500` and let the 168h naval raid
   succeed — `blockade` becomes true and coastal income drops to 25%.
6. **Militia**: train a course in a fully controlled city with loyalty ≥ 50;
   verify the cohort appears in `sectors[].militia[rank]` after `remaining`
   hours; cancel mid-course and confirm the cohort refunds.
7. **Garrison**: `attack` a Patriot sector (or `visitSector`) and confirm
   `pendingBattle.garrison` contains rank-statted militia with IDs ≥ 20000 and
   finite cartridges; `battleResult` with a snapshot removes dead defenders
   from strategic counts.
8. **Handoff**: `attack` an enemy sector from a neighbor; verify
   `pendingBattle` carries squad ammo allocation (≤10/firearm), artillery,
   weather, and `enemyCommand`; resolve with `victory` and confirm the sector
   flips, loyalty records, and `sectorStates` stores the snapshot.
9. **Economy**: run `produce` for `muskets` at a maestranza; confirm the yield
   lands after `productionHours` and that a supply cutoff suspends completion.
10. **Save**: `encodeSave`/`decodeSave` round-trip; tamper with `resources`
    or `sectors` and confirm `restoreCampaign` rejects the file.
11. **Full campaign**: reach phase 5 (San Martín recruited, all 13 sectors
    Patriot, no blockade, no pending battle) using only reducer orders and
    tactical outcome events — the integration test completes within 120
    simulated days (`docs/WEB-SYSTEMS.md:41`).