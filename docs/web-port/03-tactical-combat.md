# 03 — Tactical Combat Core (engine/Tactical → game/tactical.js)

Reference for porting the JA2 v1.13-derived turn-based combat core to the browser
simulation. Every formula below is extracted from the C++ engine under
`engine/Tactical/` (and `engine/TileEngine/` where noted) and mapped to the
JavaScript implementation in `game/tactical.js`. Line numbers cite the current
working tree; treat them as anchors, not a contract.

Scope: turn/initiative/interrupt, Action Points, movement, shooting, hit
chance/damage/armor, explosions, suppression/morale, fatigue/disease/drugs,
bleeding/bandage/doctor, animation state machine, overwatch, AI turn
orchestration, and sound/animation hooks. **Out of scope:** Strategic AI and
soldier stat definitions (separate docs).

---

## 1. Source map

| Subsystem | C++ anchor | JS anchor |
|---|---|---|
| AP constants | `engine/gamedir/Data-1.13/APBPConstants.ini` | `game/tactical.js` `maxActionPoints`/`actionCosts` |
| AP math | `engine/Tactical/Points.cpp` | `game/tactical.js` `actionCosts`, `stepCost` |
| Turn flow | `engine/Tactical/TeamTurns.cpp` | `game/tactical.js` `endTurn` |
| Interrupts | `engine/Tactical/Soldier Control.cpp` `ResolvePendingInterrupt` | `game/tactical.js` `reactionFire`, `interruptInitiative` |
| Movement | `engine/Tactical/Points.cpp` `ActionPointCost`; `PATHAI.cpp` `AStarPathfinder::AStar` | `game/tactical.js` `getReachable`, `stepCost` |
| Shooting | `engine/Tactical/Weapons.cpp` | `game/tactical.js` `apply` (fire), `shotChance` |
| Bullets | `engine/Tactical/Bullets.h` | `game/tactical.js` `line` |
| LOS/cover | `engine/Tactical/opplist.cpp` `DistanceVisible`; `DisplayCover.cpp` | `game/tactical.js` `hasLineOfSight`, `canSee` |
| Damage/armor | `engine/Tactical/Weapons.cpp` `BulletImpact`, `ArmourProtection` | `game/tactical.js` `damage` |
| Explosions | `engine/TileEngine/Explosion Control.cpp` | `game/tactical.js` artillery/canister branches |
| Suppression | `engine/Tactical/Overhead.cpp` `HandleSuppressionFire` | `game/tactical.js` morale loss on hit |
| Morale | `engine/Tactical/Morale.cpp` | `game/tactical.js` `morale` field, `rout` |
| Bleeding/bandage | `engine/Tactical/Soldier Control.cpp` `SoldierTakeDamage`, `CalcSoldierNextBleed` | `game/tactical.js` `bleeding`, `heal` |
| Animation | `engine/Tactical/Animation Control.cpp` `gAnimControl` | (browser renderer, not in tactical.js) |
| AI turn | `engine/TacticalAI/AIMain.cpp` `HandleSoldierAI` | `game/tactical.js` `endTurn` enemy loop |

---

## 2. Action Points (Points.cpp + APBPConstants.ini)

### 2.1 The AP/BP constant table

All AP values are authored against a **100 AP** system
(`APBPConstants.ini:18` `AP_MAXIMUM = 100`). The engine rescales dynamically
via `DynamicAdjustAPConstants` (`Points.cpp:911-919`). Key values:

| Constant | Value | Source line |
|---|---|---|
| `AP_MAXIMUM` | 100 | `APBPConstants.ini:18` |
| `AP_MINIMUM` | 40 | `APBPConstants.ini:23` |
| `MIN_APS_TO_INTERRUPT` | 16 | `APBPConstants.ini:29` |
| `MAX_AP_CARRIED` | 20 | `APBPConstants.ini:46` |
| `AP_REVERSE_MODIFIER` | 4 | `APBPConstants.ini:71` |
| `AP_STEALTH_MODIFIER` | 8 | `APBPConstants.ini:76` |
| `AP_MOVEMENT_FLAT/GRASS/BUSH/RUBBLE/SHORE/LAKE/OCEAN` | 12/14/18/24/28/36/32 | `APBPConstants.ini:97-103` |
| `AP_MODIFIER_RUN/WALK/SWAT/CRAWL/PACK` | −8/−4/0/+4/+4 | `APBPConstants.ini:108-112` |
| `AP_MODIFIER_WEAPON_READY` | 1 | `APBPConstants.ini:115` |
| `AP_CHANGE_FACING` | 4 | `APBPConstants.ini:120` |
| `AP_CHANGE_TARGET` | 2 | `APBPConstants.ini:125` |
| `AP_CROUCH` / `AP_PRONE` | 6 / 8 | `APBPConstants.ini:145-146` |
| `AP_LOOK_STANDING/CROUCHED/PRONE` | 4/6/8 | `APBPConstants.ini:151-153` |
| `AP_RELOAD_GUN` | 20 | `APBPConstants.ini:176` |
| `AP_START_FIRST_AID` | 20 | `APBPConstants.ini:181` |
| `AP_GET_WOUNDED_DIVISOR` | 1 | `APBPConstants.ini:192` |
| `AP_FALL_DOWN` | 16 | `APBPConstants.ini:197` |
| `AP_OPEN_DOOR` | 12 | `APBPConstants.ini:205` |
| `AP_PICKUP_ITEM` | 12 | `APBPConstants.ini:242` |
| `AP_GIVE_ITEM` | 4 | `APBPConstants.ini:247` |
| `AP_START_RUN_COST` | 4 | `APBPConstants.ini:268` |
| `AP_CLICK_AIM` | 4 | `APBPConstants.ini:290` |
| `AP_RELOAD_LOOSE` | 8 | `APBPConstants.ini:312` |
| `AP_UNJAM` | 2 | `APBPConstants.ini:322` |
| `AP_MAX_SUPPRESSED` | 64 | `APBPConstants.ini:384` |
| `AP_MAX_TURN_SUPPRESSED` | 200 | `APBPConstants.ini:385` |
| `AP_SUPPRESSION_MOD` | 24 | `APBPConstants.ini:386` |
| `AP_LOST_PER_MORALE_DROP` | 12 | `APBPConstants.ini:387` |
| `AP_MIN_LIMIT` | −100 | `APBPConstants.ini:392` |
| `AP_LOSS_PER_LEGSHOT_DAMAGE` | 4 | `APBPConstants.ini:393` |

Breath (BP) constants: `BP_PER_AP_NO_EFFORT = −50`, `MIN_EFFORT = −25`,
`LT_EFFORT = −12`, `MOD_EFFORT = 6` (`APBPConstants.ini:500-503`); movement BP
`FLAT/GRASS/BUSH/RUBBLE/SHORE/LAKE/OCEAN = 5/10/20/35/50/75/100`
(`APBPConstants.ini:508-514`); `BP_GET_HIT = 200`, `BP_FALL_DOWN = 250`
(`APBPConstants.ini:524,526`).

### 2.2 Max AP formula — `SOLDIERTYPE::CalcActionPoints` (`Soldier Control.cpp:1954`)

```
ubPoints = 20 + ((10*ExpLevel + 3*Agility + 2*LifeMax + 2*Dexterity + 5) / 10)   // :1965-1967
ubPoints += GetGearAPBonus(this)                                                 // :1970
if (Life < LifeMax)                                                              // :1977-1980
    ubPoints -= (2 * ubPoints * (LifeMax - Life + bandage/2)) / (3 * LifeMax)    //   up to 2/3rds
if (Breath < 100)                                                                // :1983-1985
    ubPoints -= (ubPoints * (100 - Breath)) / 200                                //   up to 1/2
if (weightCarriedAtTurnStart > 100)                                              // :1987-1989
    ubPoints = ubPoints * 100 / weightCarriedAtTurnStart
ubPoints = DynamicAdjustAPConstants(ubPoints, ubPoints)                          // :1992
if (ubPoints < AP_MINIMUM) ubPoints = AP_MINIMUM                                 // :1997-1998
if (ubPoints > gubMaxActionPoints[bodyType]) ubPoints = maxAPs                   // :2005-2012
```

Where `bandage = LifeMax - Life - Bleeding` (`Soldier Control.cpp:1986`).
Additional modifiers: squad-leader +5% AP per trait (`:2110-2114`), phobias
(claustrophobic ×0.9, fear-of-insects ×0.8, heat-intolerant ×0.9, heights ×0.9,
`:2116-2133`), drugs (`HandleAPEffectDueToDrugs`, `:2135`), enemy/militia/player
difficulty bonuses (`:2140-2160`), personal `GetAPBonus()` (`:2162`), boxing
halves AP (`:2176-2178`).

### 2.3 Turn refresh — `CalcNewActionPoints` (`Soldier Control.cpp:2182`)

```
carry-over capped at MAX_AP_CARRIED (20)                                        // :2184-2192
bActionPoints += CalcActionPoints()                                             // :2194
if (bActionPoints < AP_MIN_LIMIT) bActionPoints = AP_MIN_LIMIT                  // :2195-2197
if (not drugged) cap at body-type max + difficulty bonuses                      // :2199-2250
```

### 2.4 GRANADEROS diff vs vanilla (Points.cpp)

The GRANADEROS fork replaces the vanilla rate-of-fire AP math for firearms with
hard-coded per-weapon costs from `GranaderosBlackPowder.h`:

| Hook | Vanilla | GRANADEROS | Source |
|---|---|---|---|
| `BaseAPsToShootOrStab` | `(maxAP / ((MAXAIM*0.5 + aimSkill*0.5) * ROF/4)) * MAXAP` | `granaderos::fireAP(item)` | `Points.cpp:1882-1884` |
| `BaseAPsToShootOrStabNoModifier` | same ROF formula | `granaderos::fireAP(item)` | `Points.cpp:1969-1971` |
| Aimed-shot surcharge | `bAimTime * AP_CLICK_AIM` + scope/ready costs | `bAimTime * granaderos::aimAP(item)` | `Points.cpp:1667-1669` |
| `GetAPsToReloadGunWithAmmo` | clip/mag swap math | `granaderos::reloadAP(item, missing, avail, prone)` | `Points.cpp:2861-2865` |

The GRANADEROS tables (`GranaderosBlackPowder.h:12-27`), indexed by item id
1800–1808:

| Item | fireAP | aimAP | reloadAP (full load) |
|---|---|---|---|
| 1800 Brown Bess | 12 | 6 | 45 |
| 1801 Charleville | 11 | 5 | 42 |
| 1802 Fusil Baker | 16 | 10 | 70 |
| 1803 Tercerola | 9 | 4 | 38 |
| 1804 Escopeta Criolla | 10 | 4 | 35 |
| 1805 Pistola de Arzón | 7 | 3 | 32 |
| 1806 Pistola de Duelo | 6 | 2 | 28 |
| 1807 Trabuco Naranjero | 12 | 5 | 40 |
| 1808 Pistola Doble Cañón | 8 | 3 | 55 |

Reload is prorated per round: `base = (cost * rounds + capacity − 1) / capacity`
with `capacity = 1` (2 for 1808), and prone reloads cost ×1.5
(`GranaderosBlackPowder.h:20-27`). `reprimeAP = 15` (`:9`).

**JS mapping:** `game/tactical.js:26` `actionCosts` reproduces fire/aim/reload
with trait multipliers (cavalry ×0.8 fire, marksman ×0.65 aim, gunsmith ×0.85
reload, prone ×1.5 reload at `:33`). The JS reload formula
`ceil(ceil(reloadAP*rounds/capacity) * prone * assist * gunsmith)` matches the
C++ proration exactly.

---

## 3. Turn / initiative / interrupt system

### 3.1 Team turn state machine (`TeamTurns.cpp`)

```
EndTurn(nextTeam) ──► mark current team bMoved=TRUE ──► ubCurrentTeam = nextTeam
      │                                                      │
      └── BeginTeamTurn(ubTeam) ◄────────────────────────────┘
              │
              ├─ ubTeam > LAST_TEAM ──► HandleAirRaidEndTurn → wrap to player, EndTurnEvents()
              ├─ team inactive ──► skip to next team
              ├─ TURNBASED ──► EVENT_BeginMercTurn() for every living soldier (AP/BP refresh)
              ├─ ubTeam == player ──► StartPlayerTeamTurn(TRUE, FALSE)
              └─ AI team ──► BuildAIListForTeam() → StartNPCAI(first entry)
```

Sources: `TeamTurns.cpp:294` (`EndTurn`), `:499` (`BeginTeamTurn`), `:560-600`
(per-soldier `EVENT_BeginMercTurn`), `:601-620` (player vs AI dispatch).

`EndTurnEvents()` (`TeamTurns.cpp:444`) runs end-of-round services: team
healing, smell/blood decay, bomb timers, light/smoke decay, multi-turn actions,
world item cooldown, environment hazards.

### 3.2 Per-soldier turn start — `EVENT_BeginMercTurn` (`Soldier Control.cpp:7675`)

Order of operations (this is the canonical "start of turn" sequence to port):

1. `bUnderFire` decrements (2→1→0) (`:7678-7684`)
2. Drug end-turn adjustments (`HandleEndTurnDrugAdjustments_New`, `:7697`)
3. `RefreshSoldierMorale` (`:7700`)
4. Bleeding check (`CheckBleeding`) unless auto-bandage (`:7703-7716`)
5. `bShock /= 2` (residual shock halves) (`:7727`)
6. AI morale regen toward `80 + 2*ExpLevel` (`:7728-7736`)
7. Noise volume decay (`:7738-7746`)
8. Gas/blind/deaf counters (`:7748-7770`)
9. `UnusedAPsToBreath` (breath recovery from unspent AP) (`:7778`)
10. `CalcNewActionPoints` (`:7788`)
11. Interrupt counters reset (`memset ubInterruptCounter`, `:7790`)
12. `bTilesMoved = 0` (`:7808`)

### 3.3 Interrupts — Improved Interrupt System (IIS)

Trigger points: `BEFORESHOT_INTERRUPT` (`Soldier Control.cpp:4981`),
`MOVEMENT_INTERRUPT` (`Overhead.cpp:2874`), `AFTERSHOT_INTERRUPT`
(`Overhead.cpp:9835`).

`ResolvePendingInterrupt` (`Soldier Control.cpp:24800`) — reaction time:

```
base = ubBasicReactionTimeLengthIIS  (INI, default 16-ish; ×10 internally)
if Agility >= 80:  rt *= (100 - 2*(Agility-80)) / 100
elif Agility > 50: rt *= (100 + 2*(80-Agility)) / 100
else:              rt *= 8/5
rt *= (100 + 50 - 50*APleft/CalcActionPoints()) / 100        // AP-left penalty
if injured: rt *= (100 + injuryPenalty*(100-3*ExpLevel)/100) / 100
if breath < 100: rt *= (100 + (100-breath)/2) / 100
if gassed: rt *= (100 + AIM_PENALTY_GASSED) / 100
if shock:  rt *= (100 + shock*20) / 100
if phlegmatic: rt *= 110/100
rt = (rt + 5) / 10                                            // undo ×10
interrupt fires when ubInterruptCounter[target] >= rt
```

Sources: `Soldier Control.cpp:24860-24940`. Eligibility: `bActionPoints >= 4`,
`bBreath >= OKBREATH` (non-player), enemy side, and target seen currently (or
heard this turn for after-shot/after-action/close-range). Collective interrupts:
teammates within 5 tiles roll
`10 * ((Leadership*3 + ExpLevel*20 + ExpLevel*20 + Agility*2 + Wisdom) / 100)`
(`:25019-25060`).

**JS mapping:** `game/tactical.js:28` `interruptInitiative` is a simplified
priority score (`agility + wisdom*0.25 + commander bonuses`) used to order
reaction fire, and `reactionFire` (`:71-77`) enforces one reaction shot per
turn, `shotChance >= 25`, range ≤ 8 (10/12 with commanders), and AP cost
availability. This is a bounded approximation, not the full IIS counter system —
see coverage gaps §12.

### 3.4 Overwatch (JS)

`{type:'overwatch'}` sets `u.overwatch=true` (`tactical.js:133`); requires a
loaded, unjammed firearm. `reactionFire` (`:71-77`) is the overwatch trigger:
any enemy move step within sight/range triggers one shot per turn, consuming
reserved AP (`reactionSpent`). Enemy AP at turn start is
`maxAP - reactionSpent` (`:139`), mirroring the C++ "reserved AP" concept.

---

## 4. Movement

### 4.1 Per-tile AP cost — `ActionPointCost` (`Points.cpp:409`)

```
sTileCost = TerrainActionPoints(soldier, gridNo, dir, level)   // terrain base
switch (movementMode):
  RUNNING:            sTileCost + AP_MODIFIER_RUN   (−8)
  WALKING:            sTileCost + AP_MODIFIER_WALK  (−4); +AP_MODIFIER_READY if weapon raised
  WALKING_WEAPON_RDY: sTileCost + AP_MODIFIER_WALK + AP_MODIFIER_READY
  SWATTING:           sTileCost + AP_MODIFIER_SWAT  (0)
  CRAWLING:           sTileCost + AP_MODIFIER_CRAWL (+4)
if reverse:           += AP_REVERSE_MODIFIER (4)
if stealth:           += AP_STEALTH_MODIFIER (8)
if RUNNING and prev != RUNNING: += GetAPsStartRun (4)
if diagonal (dir & 1): sPoints *= 1.4
return round(sPoints + 0.5)
```

Sources: `Points.cpp:409-660`. Terrain costs come from `TerrainActionPoints`
(`Points.cpp:53`): flat 12, grass 14, bush 18, rubble 24, shore 28, lake 36,
ocean 32. Fence jumps add crouch/prone stance-change surcharges
(`Points.cpp:446-464`). `TRAVELCOST_NOT_STANDING` adds `GetAPsCrouch`
(`:643`). Backpack penalty `AP_MODIFIER_PACK` (`:611`), riot shield and drag
multipliers (`:560-565`).

**JS mapping:** `game/tactical.js:61` `stepCost`:
`base = mounted ? 3/4 : (prone ? 16 : id==4 ? 6 : 8)`, mud ×1.5 (mounted ×2),
run ×0.7, crouch ×1.25, weight penalty, guerrilla ×0.75 on rough terrain,
min 2. The JS uses a flat 8 AP/tile walk baseline (vs vanilla 12−4=8 after the
walk modifier — numerically equivalent for flat ground).

### 4.2 Pathfinding

- **Tactical A\***: `AStarPathfinder::AStar` (`PATHAI.cpp:902`) — binary heap
  open list, `EstimateActionPointCost` as edge cost (`PATHAI.cpp:1040`),
  diagonal ×1.4, fence hops cost 2 tiles (`:1060-1070`), `WantToTraverse` /
  `IsSomeoneInTheWay` filters. Returns −222 for "no path".
- **Strategic A\*** (`AStarPathfinder.cpp:25`): profit/time heuristic
  `F = (HProfit − GCost) / (HTime + GTime)` with `CalcHTime` using
  `diagonal*1.42 + straight` (`AStarPathfinder.cpp:155-171`). This is the
  campaign-map pathfinder, not tactical — do not port it into tactical.js.
- **JS mapping:** `game/tactical.js:62` `getReachable` is a Dijkstra flood over
  the 4-neighborhood with `stepCost`, bounded by `u.ap` in combat (unbounded in
  exploration). It returns `{x, y, cost, path}` per reachable tile. This is a
  reachability set, not a single-path A\*; the browser UI picks the destination
  and the engine replays the stored path.

### 4.3 Carry weight

- `carryCapacity(u) = max(10, strength * 0.5)` (`tactical.js:47`)
- `carriedWeight(u) = weight + inventory + (loaded+ammo)*0.04 + weapon(4|1.3)`
  (`tactical.js:48`)
- `weightPenalty = max(1, carried/capacity)` (`tactical.js:49`) multiplies
  movement energy and step cost.
- C++ equivalent: `sWeightCarriedAtTurnStart > 100` scales AP down
  (`Soldier Control.cpp:1987-1989`); `BreathPointAdjustmentForCarriedWeight`
  scales breath recovery (`Points.cpp:1210`).

---

## 5. Shooting (Weapons.cpp + Bullets.h + LOS)

### 5.1 Fire sequence (GRANADEROS)

`CheckForGunJam` (`Weapons.cpp:1355`): black-powder ignition applies to both
armies. If `bGunAmmoStatus < 0` (misfire pending), re-priming costs
`granaderos::reprimeAP` (15) and consumes the action (`Weapons.cpp:1358-1368`).
On a successful shot both OCTH and NCTH paths emit engine smoke
(`NewSmokeEffect(sGridNo, granaderos::smokeItem=1840, ...)`,
`Weapons.cpp:2745-2748` and `:3573-3576`).

Misfire chance (`GranaderosBlackPowder.h:30-33`):

```
misfirePercent(condition, precipitation, humidity, base=2) =
    clamp((base*10 + (100-condition)*2 + precipitation*5 + humidity*10 + 5) / 10, 0, 95)
```

**JS mapping:** `tactical.js:23` `misfireChance` =
`clamp(round(2 + (100-condition)*0.2 + rain*0.5 + humidity), 0, 95)` — identical
shape; `ignitionRisk` (`:29`) adds weapon/trait modifiers and a +15 priming
penalty. Smoke: `s.smoke.push({radius:1, turns:3})` per shot (`:80`), matching
the C++ `NewSmokeEffect`.

### 5.2 Bullet trajectory (`Bullets.h`)

`BULLET` struct (`Bullets.h:27-82`) carries fixed-point position/increment
(`qCurrX/Y/Z`, `qIncrX/Y/Z`), horizontal angle, LOS index, `sHitBy`, `iImpact`,
`iImpactReduction`, `iRange`, flags (`BULLET_FLAG_KNIFE`, `_MISSILE`,
`_BUCKSHOT`, `_ANTIMATERIEL`, `_TRACER`). `UpdateBullets()` advances
`ubTilesPerUpdate` per clock tick. The JS `line(a,b)` (`tactical.js:63`) is a
Bresenham raster used for both LOS and bullet path; the C++ uses a 3D
cube-stepping LOS (`SoldierToSoldierLineOfSightTest`) with per-cube height.

### 5.3 Line of sight

`DistanceVisible` (`opplist.cpp:1189`):

```
sDistVisible = gbLookDistance[facingDir][subjectDir]   // 8-direction lookup table
sDistVisible *= 2
if RUNNING and not facing: sDistVisible *= ANGLE_RATIO
if tunnelVision: sDistVisible *= (100 - tunnelVision%) / 100
if different level: sDistVisible += sDistVisible / 6
sDistVisible = AdjustMaxSightRangeForEnvEffects(soldier, lightLevel, sDistVisible)
sDistVisible += sDistVisible * GetTotalVisionRangeBonus() / 100
if cowering: sDistVisible = max(1, sDistVisible * (maxShock - shock) / maxShock)
night-ops trait: += NightBonusScale(...)
gas: min(sDistVisible, 2)
```

Sources: `opplist.cpp:1189-1400`. `MaxNormalDistanceVisible()` is the day
ceiling; `GetMaxDistanceVisible` (`opplist.cpp:1159`) wraps it.

**JS mapping:** `tactical.js:53` `canSee` — night range `6 + nightVisionBonus`
(2 for `night_vision`, 1 for `night_vision_basic`, Bouchard id 6), day 12,
stealth concealment `min(1, stealth*0.1)`, illuminated targets visible to 16,
smoke blocks if ≥5 smoke tiles on the line. `hasLineOfSight` (`:64`) checks
`blocksSight`/`blocked` on Bresenham cells.

### 5.4 DisplayCover (cover overlay)

`DisplayCover.cpp` computes per-tile cover overlays from enemy sight lines:
`CalculateCoverFromEnemySoldier` (`DisplayCover.cpp:730`) tests the target tile
against each stance (`animArr` prone→crouch→stand) using
`SoldierToVirtualSoldierLineOfSightTest` with `usAdjustedSight =
usSightLimit + usSightLimit * GetSightAdjustment(...)/100`. Overlay colors map
cover tiers (`GetOverlayIndex`, `DisplayCover.cpp:87`): red = no cover, orange
= min, yellow = med, green = max. This is a **renderer aid**; the JS equivalent
is the per-tile `cover` value (0–100) consumed by `shotChance` (`tactical.js:65`).

---

## 6. Hit chance, damage, armor

### 6.1 Chance to hit — `CalcChanceToHitGun` (`Weapons.cpp:6668`)

OCTH pipeline (order matters — port in this order):

```
base = marksmanship (EffectiveMarksmanship + GetMoraleModifier − fatigue penalty)
if gunCondition >= marksmanship: chance = marksmanship
else: chance = (marksmanship + gunCondition) / 2
if same target as last shot: chance += AIM_BONUS_SAME_TARGET
range penalty:  iPenalty = ((maxRange − (range−accRangeMod)*3) * 10) / (17*CELL_X_SIZE)
                if iPenalty < 0: chance += iPenalty          // ~1.5%/tile past 30% max range
close-range penalty: iPenalty = ((range − minRange − accRangeMod)*12*10)/(17*CELL_X_SIZE)
                if iPenalty < 0: chance += iPenalty
visual range:   chance += 3 * (NORMAL_RANGE − sightRange) / CELL_X_SIZE
if can't see target: chance = min(chance, −iPenaltyShootUnSeen)
head shot:      chance -= uShotHeadPenalty * sightRange / 10
legs shot:      chance -= sightRange / 10
target crouched: −AIM_PENALTY_TARGET_CROUCHED (beyond point-blank)
target prone:   −min(3*(range−pointBlank)/CELL_X_SIZE, AIM_PENALTY_TARGET_PRONE)
height diff:    chance += −100 * heightDiff / range
target moved:   chance −= min(tilesMoved * iMovementEffectOnAiming, maxCTHPenalty)
dodge:          chance −= max(0, (targetAgility/5 + targetExp*2)*stanceFactor − (attackerDex/5 + attackerExp*2))
crouched shooter: +min(range/10, AIM_BONUS_CROUCHING)
prone shooter:    +min(range/10, AIM_BONUS_PRONE) if range > MIN_PRONE_RANGE
one-hand:       pistol +AIM_BONUS_TWO_HANDED_PISTOL; SMG −AIM_PENALTY_SMG; dual −AIM_PENALTY_DUAL_PISTOLS
burst/auto:     −burstPenalty*(shots−1) (bipod/prone reductions)
aim clicks:     per click: +min(maxBonus*progression[i]/1000, 10) + scope bonus
AI difficulty:  easy −5; else +gbDiff[DIFF_ENEMY_TO_HIT_MOD][level]
gassed: −AIM_PENALTY_GASSED; getting aid: −AIM_PENALTY_GETTINGAID; shock: −shock*AIM_PENALTY_PER_SHOCK
firing up: −AIM_PENALTY_FIRING_UP; firing down: +AIM_BONUS_FIRING_DOWN
injured:  chance −= (chance*2*(lifeMax−life+bandage/2))/(3*lifeMax) * (100−10*(exp−1))/100
low breath: chance −= (chance*(100−breath))/200 * (100−(dex−10))/100
gear: +GetGearToHitBonus + GetToHitBonus(weapon, range, light, prone)
suppression (target shock): −coweringPenalty (stance-scaled, range-scaled)
beyond max range: chance /= fOutOfGunRangeOrSight
clamp: if <= ubMinimumCTH → ubMinimumCTH (or 0 for vehicles); else min(chance, ubMaximumCTH)
```

Sources: `Weapons.cpp:6760-7695`. Aim progression table
`bonusProgression[8] = {500,500,600,600,750,750,750,1000}` (`:6680`).

**GRANADEROS cap** (`Weapons.cpp:7692-7695`): after all modifiers,
`chance = min(chance, granaderos::rangeCeiling(item, tiles))` where
`rangeCeiling` (`GranaderosBlackPowder.h:36-43`):

```
1802 (Baker): tiles<=45 → 95; tiles<=50 → 85; else clamp(85−(tiles−50)*5, 1, 85)
tiles<=15 → 85
tiles<=25 → 85 − (tiles−15)*5
tiles<=35 → 35 − (tiles−25)*3
else       → clamp(5 − (tiles−35), 1, 5)
```

**JS mapping:** `tactical.js:65` `shotChance` reproduces the cap exactly and
approximates the rest: `min(cap, marksmanship + commander bonuses + aim*8 −
range*1.1 − wounds*0.3 − prone 18 − cover − night penalty − out-of-range*4 −
mounted 15 − smoke*12)`, clamped 1–95. The JS uses flat per-tile penalties
(−1.1/tile) instead of the piecewise OCTH range curve; the GRANADEROS cap
dominates at long range anyway.

### 6.2 Damage — `BulletImpact` (`Weapons.cpp:8160`)

```
iOrigImpact = weapon.ubImpact * ammoDamageModifierLife
iFluke = PreRandom(51) − 25                    // −25%..+25%
iBonus = sHitBy / 2                             // up to +50% for accurate hits
iOrigImpact = iOrigImpact * (100 + iFluke + iBonus) / 100
if (iOrigImpact < 1) iOrigImpact = 1
if HE ammo: iOrigImpact *= beforeArmourMultiplier / beforeArmourDivisor
iTotalArmourProtection = TotalArmourProtection(target, hitLocation, iOrigImpact, ammoType, fragment)
iImpact = iOrigImpact − iTotalArmourProtection
if not zeroMinimumDamage:
    iImpact = max(iImpact, (iOrigImpact + 5) / 10)          // 10% minimum
    if pellets: iImpact += (pelletsHit − 1) / 2
iImpact *= afterArmourMultiplier / afterArmourDivisor
iImpact = max(1, iImpact * (100 − GetDamageResistance()) / 100)
AdjustImpactByHitLocation(iImpact, hitLocation, &iImpact, &iImpactForCrits)
```

Sources: `Weapons.cpp:8230-8390`. Hit-location adjustment
(`Weapons.cpp:1340-1355`): head ×`fShotHeadMultiplier` (1.5 default), legs
quarter damage (`LEGS_DAMAGE_ADJUSTMENT` applied twice). Head instant-kill if
`iImpactForCrits > MIN_DAMAGE_FOR_INSTANT_KILL && < life` within
`maxdistformessydeath` (`:8420-8440`).

### 6.3 Armor — `ArmourProtection` (`Weapons.cpp:7919`)

```
iProtection = Armour[type].ubProtection
iCoverage   = Armour[type].ubCoverage
if PreRandom(100)+1 > iCoverage:            // bullet missed armor
    return vest ? iImpact/2 : 0
if PreRandom(100)+1 > status:               // weak spot
    iProtection -= failure; if < 0 return 0
iProtection *= armourImpactReductionMultiplier / armourImpactReductionDivisor
iAppliedProtection = min(iProtection, iImpact) or full protection if iProtection <= iImpact
status -= iAppliedProtection * ubDegradePercent / 100
return iProtection
```

`TotalArmourProtection` (`Weapons.cpp:8013`) selects slot by hit location
(helmet/legs/vest), adds vest-pack plates (flak ×3), and only applies armor if
`iImpact > iTotalProtection` (plates first, then base armor). Explosive armor:
`ArmourVersusExplosivesPercent` (`Weapons.cpp:1310`) sums `FireEffectiveArmour`
over all slots, capped 100.

**JS mapping:** `tactical.js:70` `damage` is a flat reduction model: no armor
slots, `bleeding += ceil(amount/15)`, `morale −= amount*0.45`, kill → −18 morale
to all allies, rout at morale < 15. Armor exists only as tile `cover` in
`shotChance`. This is the largest fidelity gap (see §12).

---

## 7. Explosions (`engine/TileEngine/Explosion Control.cpp`)

### 7.1 Damage falloff

```
newDamage = GetModifiedExplosiveDamage(ubDamage, 0)
if InARoom(bombGridNo): newDamage += newDamage * bIndoorModifier
sWoundAmt = newDamage + (newDamage * uiRoll) / 100          // uiRoll = PreRandom(100)
sBreathAmt = newBreath*100 + (newBreath/2 * 100 * uiRoll) / 100
if uiDist < ubRadius:  sWoundAmt -= sWoundAmt * uiDist / ubRadius   // linear falloff
else:                  sWoundAmt = (sWoundAmt / ubRadius) / 2       // edge: half of last step
```

Sources: `Explosion Control.cpp:2280-2332`. Commented example: radius 5 →
100/80/60/40/20/10% (`:2300-2302`).

### 7.2 Soldier blast damage — `DamageSoldierFromBlast` (`Explosion Control.cpp:1513`)

```
sNewWoundAmt = sWoundAmt − min(sWoundAmt, 35) * ArmourVersusExplosivesPercent / 100
sNewWoundAmt = max(0, sNewWoundAmt * (100 − GetDamageResistance()) / 100)
suppression: ubSuppressionPoints += max(0, (radius*3 − uiDist)) * usExplosionSuppressionEffect / 100
```

Sources: `:1605`, `:1650`, `:1870`. Flashbangs beyond half radius only add
suppression (`:1584-1595`). Riot shields facing the blast absorb damage
(`:1558-1578`).

**JS mapping:** `tactical.js:85-120` artillery: canister cone
(`forward <= radius*2`, `across <= max(1, forward*0.5)`, damage
`spec.damage * max(0.35, 1 − forward/(radius*3))`), solid shot line with
penetration (`bronze4:3, field8:5, swivel:1` + Barcala +1) and energy decay
×0.75 per victim, wall breaching when `penetration >= resistance` (stone 3,
else 1). The JS cone geometry mirrors the C++ fragment cone but the C++ blast
radius falloff (`sWoundAmt * (1 − dist/radius)`) is not reproduced for
artillery — only the canister cone and line shot exist.

---

## 8. Suppression, morale, fatigue, disease, drugs

### 8.1 Suppression — `HandleSuppressionFire` (`Overhead.cpp:8780`)

```
bTolerance = CalcSuppressionTolerance(soldier)
sPointsLost = ((suppressionPoints * AP_SUPPRESSION_MOD) / (bTolerance + 6) * 2 + 1) / 2
sPointsLost *= suppressionEffectiveness (player/AI INI) / 100
cap per attack (usLimitSuppressionAPsLostPerAttack) and per turn (usLimitSuppressionAPsLostPerTurn)
shock += min(maxSuppressionShock, sPointsLost * usSuppressionShockEffect * 25 / (100 * AP_MAXIMUM))
morale: for each 12 AP lost (AP_LOST_PER_MORALE_DROP): HandleMoraleEvent(MORALE_SUPPRESSED)
stance drop: if sPointsLost >= crouch+prone cost → drop to prone (free, uses lost APs)
AP: bActionPoints = max(AP_MIN_LIMIT, bActionPoints − sPointsLost)
```

Sources: `Overhead.cpp:8822` (AP loss), `:8840-8860` (shock), `:8870-8890`
(morale), `:8900-9050` (stance drop), `:9160-9190` (AP reduction). Cowering
threshold: `CoweringShockLevel(soldier)`.

**JS mapping:** no suppression-point accumulator. Morale loss on hit
(`tactical.js:70` `morale −= amount*0.45`) and rout at `< 15` are the only
suppression-like mechanics. See §12 gap list.

### 8.2 Morale — `Morale.cpp`

Event table `gbMoraleEvent` (`Morale.cpp:43-120`), key entries:

| Event | Type | Δ |
|---|---|---|
| MORALE_KILLED_ENEMY | tactical | +4 |
| MORALE_SQUADMATE_DIED | tactical | −5 |
| MORALE_SUPPRESSED | tactical | −1 (up to 4/turn) |
| MORALE_DID_LOTS_OF_DAMAGE | tactical | +2 |
| MORALE_TOOK_LOTS_OF_DAMAGE | tactical | −3 |
| MORALE_BATTLE_WON | strategic | +4 |
| MORALE_RAN_AWAY | strategic | −5 |
| MORALE_BUDDY_DIED | strategic | −15 |
| MORALE_DRUGS_CRASH | tactical | −5 |
| MORALE_ALCOHOL_CRASH | tactical | −10 |
| MORALE_DEIDRANNA_KILLED | strategic | +25 |

`GetMoraleModifier` (`Morale.cpp:154`): `morale > 50 → (morale−45)/10`
(+1 at 55 … +5 at 95); `morale <= 50 → (morale−50)*2/5` (−2 at 45 … −20 at 0).
`RefreshSoldierMorale` (`:379`):
`morale = ubDefaultMorale + teamMod + tacticalMod + strategicMod + progress/5 +
drugs[DRUG_EFFECT_MORALE]`, clamped 0–100, facility max-morale normalization.
`DecayTacticalMorale` (`:207`): positive decays `−max(0, mod − (8 − mod/10))`,
negative `+min(0, mod + (6 + mod/10))`.

**JS mapping:** `tactical.js:34` initial morale
`(optimistic 90 / pessimistic 70 / else 80) + 10 if steadfast`; `damage()`
morale loss; `rout()` at `< 15`; `holdMorale` (`:32`) keeps morale ≥ 20 near
leaders (Azurduy id 1 militia, San Martín id 57, Barcala id 7 infantry,
cavalry commander). No strategic/tactical modifier split.

### 8.3 Fatigue / drugs / disease

- **Fatigue (JS):** `fatigue` 0–100; `maxActionPoints` (`tactical.js:31`)
  `= round(clamp(100 − fatigue*(0.4|0.25 guerrilla) − 15 high-altitude − 10 cold-without-poncho, 35, 100))`.
  Movement adds `ceil(cost/25)` fatigue (`:79`); ration action removes 25
  (`:130`).
- **Drugs (C++):** `giDrunkModifier = {100, 75, 65, 50, 100}` for
  sober/feeling-good/borderline/drunk/hungover (`Drugs And Alcohol.cpp:18-23`);
  hungover −5 AP (`HANGOVER_AP_REDUCE`) and +200 BP (`:25-26`); stat effects
  `stat * drunkModifier / 100` (`:384-387`). `HandleEndTurnDrugAdjustments_New`
  (`:222`) runs each turn start.
- **Disease (C++):** `HandlePossibleInfection` (`Disease.cpp:194`) — wound
  types (animal/fire/gas/gunshot/open/traumatic) with modifiers
  `0.5 + damage/100`; gunshot infection only when `damage > 20`
  (`Soldier Control.cpp:10390-10410`). Population-level disease is strategic
  (out of scope).

### 8.4 Bleeding / bandage / doctor

- **Bleeding rate** — `CalcSoldierNextBleed` (`Soldier Control.cpp:21977`):
  `val = 1 + (life + bandage/2) / (10 + tilesMoved)`; hemophiliac:
  `1 + life / (30 + 2*tilesMoved)`. Bleeding damage applied via
  `SoldierTakeDamage(TAKE_DAMAGE_BLOODLOSS)`; enemies below OKLIFE have a
  1-in-3 chance to die from blood loss (`:10340-10350`).
- **Bleeding accrual** (`Soldier Control.cpp:10349-10363`): hand-to-hand +1
  bleeding per hit; gunfire sets `bBleeding = LifeMax − (Life + bandage)`.
- **Bandage** (`Soldier Control.cpp:13300-13490`):
  ```
  uiDressSkill = (7*Medical + kitStatus + 10*ExpLevel + Dexterity) / 10   // new traits
  uiPossible   = (availAPs * uiDressSkill) / 50
  medical kit: +50%; prone self: /2; prone other: *4/5
  deficiency = 2*belowOKLIFE + remainingBleeding
  healing pts restore life 1:1 above OKLIFE, 2:1 below; bleeding stops 1:1
  ```
  Doctor trait surgery heals `iHealableInjury` (hundredths of HP) at
  `ubDOSurgeryHealPercentBase + per-trait bonus` (`:13530-13560`).

**JS mapping:** `tactical.js:70` `bleeding = min(10, bleeding + ceil(amount/15))`
on hit; `endTurn` (`:140`) applies `hp −= bleeding` per round; `heal` action
(`:135`) costs 25 AP (18 for Paroissien id 10, 20 for field_rescuer), consumes
a medkit, stops bleeding, restores `10 + round(medical*0.25)` HP. Ration action
also stops bleeding (`:130`).

---

## 9. Animation state machine

### 9.1 `gAnimControl` table (`Animation Control.cpp:110`)

Each entry: `{name, AP, speed, moveRate, flags, ubHeight, ubEndHeight, ...}`.
Core states:

| State | Height→End | Flags (subset) |
|---|---|---|
| WALKING | STAND→STAND | MOVING, TURNING, NORESTART, RAISE_WEAPON, VARIABLE_EFFORT |
| STANDING | STAND→STAND | STATIONARY, TURNING, FASTTURN, BREATH |
| KNEEL DOWN / KNEEL UP | STAND→CROUCH / CROUCH→STAND | STANCECHANGEANIM, MIN_EFFORT |
| CROUCHED | CROUCH→CROUCH | STATIONARY, BREATH |
| SWAT | CROUCH→CROUCH | MOVING, LIGHT_EFFORT |
| RUN | STAND→STAND | MOVING, MODERATE_EFFORT |
| PRONE DOWN / PRONE UP | CROUCH→PRONE / PRONE→CROUCH | STANCECHANGEANIM |
| CRAWL | PRONE→PRONE | MOVING, MODERATE_EFFORT |
| PRONE | PRONE→PRONE | STATIONARY, BREATH |
| READY/AIM/SHOOT/END (R) STAND | STAND | FIREREADY / FIRE / ATTACK |
| FLYBACK HIT | STAND→PRONE | HITSTART, HITFINISH, NONINTERRUPT, ATTACK |

Sources: `Animation Control.cpp:110-180`. `ubHeight` is the stance the
animation *starts* from, `ubEndHeight` the stance it *ends* in — the state
machine uses `ubEndHeight` for stance transitions
(`Soldier Control.h:26-28`).

### 9.2 Transition logic — `EVENT_InitNewSoldierAnim` (`Soldier Control.cpp:2973`)

```
if newState height != current endHeight and not STANCECHANGEANIM/IGNORE_AUTOSTANCE:
    usPendingAnimation = newState
    SendChangeSoldierStanceEvent(soldier, newState height)   // queue stance change first
    return
if same state and ANIM_NORESTART and not forced: return (no restart)
```

`SoldierGotoStationaryStance` (`Soldier Control.cpp:7199`) maps end-height to
idle state: STAND→STANDING (or AIM_RIFLE_STAND if weapon raised, COWERING if
cowering), CROUCH→CROUCHING, PRONE→PRONE. `ChangeSoldierState`
(`:2782`) is the public wrapper.

### 9.3 Animation cache (`Animation Cache.cpp`)

Per-soldier LRU surface cache: `guiCacheSize = MIN_CACHE_SIZE` (`:11`),
`GetCachedAnimationSurface` (`:63`) bumps the least-hit entry
(`sCacheHits`), never evicts the currently-playing surface (`:97-100`).
`DetermineSoldierAnimationSurface` (`Animation Control.cpp:4163`) resolves
body-type × state → STI surface. **Porting note:** the cache is a renderer
concern; the browser equivalent is preloading sprite sheets per body type.

### 9.4 Sound hooks

- Weapon fire: `PlayJA2Sample(Weapon[item].sSound, ...)` with
  `SoundVolume(HIGHVOLUME, gridNo)` and `SoundDir(gridNo)`
  (`Weapons.cpp:2456-2460`); burst uses `PlayJA2SampleFromFile`
  (`:2436-2444`).
- Misses: `MISS_1 + Random(8)` (`Weapons.cpp:5993`); water impact
  `S_WATER_IMPACT1` (`:5989`).
- Explosions: `EXPLOSION_1`, `EXPLOSION_BLAST_2`, `SMALL_EXPLODE_1`
  (`Weapons.cpp:5414-5492`); grenade pin/flare/gas/fire sounds selected in
  `EVENT_InitNewSoldierAnim` (`Soldier Control.cpp:2980-3040`).
- Turn end: `PlayJA2Sample(ENDTURN_1, ...)` (`TeamTurns.cpp:960`).

**JS mapping:** no audio in `tactical.js`; the browser UI layer owns sound.
The doc contract is: fire → weapon sound + smoke; miss → whiff; explosion →
blast; turn end → chime.

---

## 10. AI turn orchestration

### 10.1 C++ flow

```
EndTurn → BeginTeamTurn → BuildAIListForTeam(team) → StartNPCAI(soldier)
StartNPCAI (AIMain.cpp:1009): SetSoldierAsUnderAiControl, DecideAlertStatus
HandleSoldierAI (AIMain.cpp:407):
    bail if engaged/explosion-queue/enemy-sighting
    if bAction == AI_ACTION_NONE:
        TurnBasedHandleNPCAI(soldier)          // turn-based
        RTHandleAI(soldier)                    // real-time
    else: continue current action (movement completion, ActionDone)
TurnBasedHandleNPCAI (AIMain.cpp:1544):
    deadlock guard (100 same-soldier decisions → EndAIGuysTurn)
    if bNextAction != NONE: promote next action
    else: create AI master plan (AI::tactical::PlanFactoryLibrary) and execute
```

Sources: `AIMain.cpp:407-750` (HandleSoldierAI), `:1009` (StartNPCAI),
`:1544` (TurnBasedHandleNPCAI). Difficulty table `gbDiff`
(`AIMain.cpp:100-106`): enemy to-hit mod −10/−5/0/+5/+10, interrupt mod
−2/−1/0/+1/+2, radio red-alert 50/65/80/90/95, max cover range 4/6/8/10/13.

### 10.2 UI event loop — `HandleTacticalUI` (`Handle UI.cpp:517`)

Input priority: mouse movement → keyboard polling → mouse buttons → queued
keyboard events (`Handle UI.cpp:600-640`). Turn-based input uses
`GetTBMousePositionInput`/`GetTBMouseButtonInput`; real-time uses
`GetRT*`. `Handle UI Plan.cpp` implements **planning mode**: `BeginUIPlan`
(`:22`), `AddUIPlan` (`:36`) clones the soldier per planned move/fire
(`TacticalCreateSoldier` with `fPlayerPlan=TRUE`), deducts AP per step
(`:105`), and `EndUIPlan` (`:239`) removes the clones. `SelectPausedFireAnimation`
(`:276`) picks the fire pose by stance.

### 10.3 JS mapping

`endTurn` (`tactical.js:139`) is the whole enemy phase: for each enemy, up to
12 actions per turn, priority: free (bolas) → stand up → melee → charge →
reprime → reload → fire (if `shotChance >= 20`) → move toward nearest visible
target. After the phase: smoke growth/decay, energy regen +10, bleeding ticks,
player AP refresh, `turn++`, phase back to player. This is a greedy
deterministic policy, not the C++ plan-library AI.

---

## 11. Web event-loop porting hazards (real-time vs turn-based)

1. **The C++ engine is a frame loop with an attack-busy counter.**
   `gTacticalStatus.ubAttackBusyCount` gates AI decisions and UI
   (`AIMain.cpp:407-420`, `Handle UI.cpp:530-545`). The JS engine is a pure
   function `actBattle(state, action)` (`tactical.js:138`) — there is no
   in-flight animation state. Any port that adds animation must keep the
   *rules* synchronous and let the renderer replay from the returned state.
2. **Determinism.** `random(s)` (`tactical.js:19`) is an LCG seeded from
   `s.seed`; the C++ uses `PreRandom`/`Random` with a global RNG that is
   order-sensitive. Replays must clone state (`clone`, `:18`) and never call
   `Math.random`. The C++ RNG is *not* portable — do not try to match C++
   roll sequences; match the *distribution* and document seed divergence.
3. **Real-time mode.** C++ has `REALTIME` combat with breath-only costs
   (`Points.cpp:380-390`, `EnoughPoints` ignores AP in RT). The JS has only
   `exploration` mode (AP-scaled durations, `:78`) and `combat`. If RT combat
   is ever added, it needs a tick loop, not the action API.
4. **Interrupts are preemptive in C++** (they stop the mover mid-path via
   `AdjustNoAPToFinishMove`, `TeamTurns.cpp:700-710`). The JS `reactionFire`
   runs *between* move steps (`:79`) but does not refund or freeze the mover —
   the mover keeps its path. Document this as an intentional simplification.
5. **Multi-turn actions.** C++ `UpdateMultiTurnAction` (`TeamTurns.cpp:460`)
   persists actions across turns (surgery, fortification). JS has none; the
   `heal`/`repair` actions complete in one action.
6. **Clock.** C++ uses `GetWorldTotalSeconds()` for light/smoke/bomb decay
   (`TeamTurns.cpp:150-170`). JS uses `advanceBattleClock` + `COMBAT_ROUND_SECONDS`
   (6 s/round) and `REST_SECONDS` (10 min) via `game/time.js` — see
   `docs/tactical-verification.md` "Shared campaign clock".
7. **UI planning mode** (`Handle UI Plan.cpp`) clones soldiers; the JS has no
   planning mode — the browser must implement it client-side by previewing
   `getReachable` paths and `actionCosts` without mutating state.

---

## 12. Coverage map: C++ → JS → verification

| C++ mechanic | JS (`game/tactical.js`) | Verified by |
|---|---|---|
| AP max formula | `maxActionPoints` (`:31`) | `tests/tactical-web.test.mjs` |
| AP costs (fire/aim/reload) | `actionCosts` (`:26`), `reloadCost` (`:33`) | `tests/operative-profiles.test.mjs` |
| Movement cost | `stepCost` (`:61`), `getReachable` (`:62`) | `tests/battle-integration.test.mjs` |
| Carry weight | `carryCapacity`/`carriedWeight`/`weightPenalty` (`:47-49`) | save validation |
| Misfire | `misfireChance`/`ignitionRisk` (`:23`,`:29`) | `tests/tactical-web.test.mjs` |
| Range ceiling | `shotChance` cap (`:65`) | `tests/operative-profiles.test.mjs` |
| CTH | `shotChance` (`:65`) | `tests/tactical-web.test.mjs` |
| Damage | `damage` (`:70`) | `tests/battle-integration.test.mjs` |
| Armor | **missing** (tile cover only) | — |
| Explosions | artillery canister/solid-shot (`:85-120`) | `tests/battle-integration.test.mjs` |
| Suppression | morale loss only | — |
| Morale events | `damage`/`rout`/`holdMorale` (`:70`,`:67`,`:32`) | `tests/operative-profiles.test.mjs` |
| Bleeding | `bleeding` field, `endTurn` tick (`:140`) | `tests/battle-integration.test.mjs` |
| Bandage/doctor | `heal` (`:135`) | `tests/operative-profiles.test.mjs` |
| Interrupts | `reactionFire`/`interruptInitiative` (`:71`,`:28`) | `tests/operative-profiles.test.mjs` |
| Overwatch | `overwatch` action (`:133`) | `tests/operative-profiles.test.mjs` |
| Animation | — (renderer) | browser verification pending |
| Sound | — (renderer) | browser verification pending |
| AI turn | `endTurn` enemy loop (`:139`) | `tests/battle-integration.test.mjs` |

### Coverage gaps (from `docs/tactical-verification.md` + code audit)

1. **Armor slots** — C++ `TotalArmourProtection`/`ArmourProtection`
   (`Weapons.cpp:7919,8013`) has no JS equivalent. `validate-battle.js` has no
   armor field. **Gap.**
2. **Suppression points** — `ubSuppressionPoints` accumulator + shock + cowering
   (`Overhead.cpp:8780`) absent in JS. **Gap.**
3. **Full IIS interrupt counters** — JS uses a priority sort, not the
   `ubInterruptCounter` reaction-time accumulator (`Soldier Control.cpp:24800`).
   `tactical-verification.md:61` explicitly states reaction fire "is a bounded
   rule, not a complete recreation of JA2's interrupt initiative system."
   **Documented gap.**
4. **Breath/energy** — C++ has a full BP system (`APBPConstants.ini` BP
   section); JS has `energy` (0–100) with exhaustion/unconsciousness
   (`tactical.js:51`). Different model, same role. **Intentional divergence.**
5. **Explosion radius falloff** — C++ `sWoundAmt * (1 − dist/radius)`
   (`Explosion Control.cpp:2315-2325`) not applied to JS artillery.
   **Gap.**
6. **Aim progression** — C++ `bonusProgression[8]` + scope bonuses
   (`Weapons.cpp:6680,7440-7490`) vs JS flat `aim*8`. **Gap.**
7. **Planning mode** (`Handle UI Plan.cpp`) — no JS equivalent. **Gap.**
8. **Multi-turn actions** — none in JS. **Gap.**
9. **Disease** — C++ `HandlePossibleInfection` (`Disease.cpp:194`) absent in
   JS. **Gap.**
10. **Drugs** — C++ `ApplyDrugs_New`/drunk modifiers (`Drugs And Alcohol.cpp`)
    absent in JS. **Gap.**

---

## 13. Reproduction checklist

To reproduce any formula in this document against the current tree:

1. **AP costs:** read `engine/gamedir/Data-1.13/APBPConstants.ini`; verify
   `game/tactical.js:26` `actionCosts` against `GranaderosBlackPowder.h:12-27`
   (fire/aim/reload tables) and `tactical.js:33` `reloadCost` against
   `GranaderosBlackPowder.h:20-27` (proration + prone ×1.5).
2. **Max AP:** `node -e "import('./game/tactical.js').then(m=>{const s=m.createBattle([{id:'1',name:'t',strength:75,agility:75,marksmanship:70}],{});console.log(s.units[0].maxAP)})"`
   — expect `100` at fatigue 0 (matches `CalcActionPoints` ceiling).
3. **Movement:** `getReachable(state, unit)` — walk cost on flat grass must be
   8 AP/tile (vanilla `AP_MOVEMENT_GRASS 14 + AP_MODIFIER_WALK −4 = 10`; JS
   baseline 8 — note the divergence), diagonal ×1.4, mud ×1.5.
4. **Misfire:** `misfireChance(100, 0, 0) === 2`; `misfireChance(50, 40, 30)`
   must equal `clamp(round(2 + 50*0.2 + 20 + 30), 0, 95) = 62` — matches
   `GranaderosBlackPowder.h:30-33` tenths-of-percent rounding.
5. **Range ceiling:** `shotChance` cap for 1802 at 60 tiles must be
   `clamp(85 − 10*5, 1, 85) = 35`; for 1800 at 40 tiles
   `clamp(5 − 5, 1, 5) = 1` (`GranaderosBlackPowder.h:36-43`).
6. **Damage:** `damage(state, target, 50, source)` → `hp −= 50`,
   `bleeding += ceil(50/15) = 4`, `morale −= 22` (round(50*0.45));
   kill → allies −18 morale (`tactical.js:70`).
7. **Bleeding tick:** after `endTurn`, a unit with `bleeding: 4` loses 4 HP
   (`tactical.js:140`); C++ rate is `1 + (life + bandage/2)/(10 + tilesMoved)`
   per turn (`Soldier Control.cpp:21977`).
8. **Interrupt:** enemy with `overwatch: true`, loaded musket, `shotChance ≥
   25`, within 8 tiles → exactly one `reactionFire` per turn, consuming
   `actionCosts().fire` AP and one cartridge (`tactical.js:71-77`).
9. **Determinism:** `actBattle` twice on the same seed must produce
   byte-identical state (LCG `tactical.js:19`); run
   `node --test tests/tactical-web.test.mjs tests/battle-integration.test.mjs`.
10. **Save validation:** any produced state must pass
    `validateBattleSnapshot` (`game/validate-battle.js`) — run
    `node --test tests/validate-battle.test.mjs`.

### Formula quick-reference (JS-reproducible)

```
maxAP        = round(clamp(100 − fatigue*(0.4|0.25) − 15*high − 10*cold, 35, 100))
stepCost     = max(2, ceil(base * mud * mode * weight * rough))
               base = mounted 3|4 : prone 16 : id4 6 : 8
misfire      = clamp(round(2 + (100−cond)*0.2 + rain*0.5 + humidity), 0, 95)
ignitionRisk = clamp(misfire * (0.9 Charleville) * (0.65 gunsmith) − (1 duel) + (15 no priming), 0, 95)
rangeCeiling = 1802: 95/85/85−(t−50)*5 ; ≤15:85 ; ≤25:85−(t−15)*5 ; ≤35:35−(t−25)*3 ; else 5−(t−35)
shotChance   = clamp(min(cap, mrk + cmd + aim*8 − range*1.1 − wounds*0.3 − prone18 − cover − night − ooR*4 − mounted15 − smoke*12), 1, 95)
damage       = hp −= round(amount); bleeding += min(10, ceil(amount/15)); morale −= amount*0.45
reloadCost   = rounds<=0 ? 0 : ceil(ceil(reloadAP*rounds/capacity) * prone1.5 * assist0.8 * gunsmith0.85)
interruptInit= agility + wisdom*0.25 + 25*(Paz near) + 50*(San Martín near)
```

---

## 14. GRANADEROS vs vanilla diff summary

| Area | Vanilla JA2 v1.13 | GRANADEROS fork |
|---|---|---|
| Fire AP | ROF-based `BaseAPsToShootOrStab` | per-weapon `fireAP` table (1800–1808) |
| Aim AP | `AP_CLICK_AIM` + scope/ready surcharges | per-weapon `aimAP` table |
| Reload AP | clip/mag swap math | per-weapon `reloadAP`, prorated, prone ×1.5 |
| Misfire | modern jam settings | black-powder `misfirePercent` (condition/rain/humidity) |
| CTH cap | `ubMaximumCTH` only | + `rangeCeiling` ballistic cap per weapon |
| Smoke | optional | mandatory `NewSmokeEffect` on every firearm shot |
| Re-prime | `AP_UNJAM` (2) | `reprimeAP` (15), consumes priming powder |
| Ammo | magazines | single-shot (capacity 1, double-barrel 2) |

Sources: `GranaderosBlackPowder.h` (all), `Points.cpp:1667,1882,1969,2861`,
`Weapons.cpp:1355,2745,3573,7692`.