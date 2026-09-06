# Web Port Series 04 — Soldiers, Mercs & Character Stats

> **Audience:** an agent with zero prior JA2 knowledge who must port engine behavior into the
> browser clone (`game/` + `web/`). This document is the exact data model for the soldier/merc/
> character systems: the `SOLDIERTYPE` runtime struct, the `MERCPROFILESTRUCT` persistent
> profile, attributes/skills/traits, health/energy/breath, stances, inventory slots, faces/
> animations/speech hooks, skill checks + training, AI-vs-player flags, enemy/civilian/creature
> variants, and the assignment/contract hooks into the Strategic layer. It ends with a
> TypeScript interface proposal for the web save schema and a reproduction checklist.
> Nothing here modifies engine code — read-only analysis with `file:line` citations.
>
> **Scope boundary:** weapons ballistics, AP costs of firing, and the black-powder misfire
> model are covered in `05-tactical-combat.md` (and `00-overview.md` §6). This doc covers the
> *soldier as a data record*, not the projectile math.

---

## 1. Two-layer data model

The engine keeps **two** soldier representations, and the web clone must mirror both:

| Layer | Struct | Where | Persistence |
|---|---|---|---|
| **Profile** (authoring) | `MERCPROFILESTRUCT` | `Tactical/soldier profile type.h:770-1055` | `BINARYDATA/Prof.dat` + `MercProfiles.xml` overrides (`Soldier Profile.cpp:554` `LoadMercProfiles`) |
| **Runtime** (in-sector) | `SOLDIERTYPE` | `Tactical/Soldier Control.h:1079-2101` | Savegame (`SOLDIERTYPE::Save`/`Load`, `Soldier Control.h:1090-1091`) |

The bridge is `TacticalCopySoldierFromProfile` (`Soldier Create.cpp:1267`): when a soldier is
created with a valid `ubProfile`, the runtime struct is populated field-by-field from the
profile (stats at `Soldier Create.cpp:1287-1299`, traits at `:1312-1315`, palettes at
`:1275-1278`). The web equivalent is `rosterFor()` in `game/recruitment.js:36-43`, which
merges authored `OPERATIVES`/`CIVIC_RECRUITS` with per-campaign `operativeState`.

---

## 2. `SOLDIERTYPE` — the runtime soldier (field-by-field)

`Tactical/Soldier Control.h:1079-2101`. POD fields end at `endOfPOD` (`:1608`); non-POD
sub-structs follow (`:1615-1626`). The web save only needs the *semantic* subset — the
rendering/animation pointers (`pLevelNode`, `pBackGround`, palettes) are engine-internal.

### 2.1 Identity & team

| Field | Type | Line | Meaning |
|---|---|---|---|
| `ubID` | `SoldierID` | `:1106` | Per-team slot index (`gTacticalStatus.Team[bTeam].bFirstID..bLastID`, `Soldier Create.cpp:758-793`) |
| `name[10]` | `CHAR16` | `:1107` | Display name (nickname from profile, `Soldier Create.cpp:1285`) |
| `ubProfile` | `UINT8` | `:1316` | Profile index into `gMercProfiles`; `NO_PROFILE` (200) = generated soldier (`Soldier Control.h:11`) |
| `ubBodyType` | `UINT8` | `:1112` | Body/animation type (male/female/civ/monster/vehicle) |
| `bTeam` | `INT8` | `:1118` | Team id: `OUR_TEAM`, `ENEMY_TEAM`, `MILITIA_TEAM`, `CREATURE_TEAM`, `CIV_TEAM`, `PLAYER_PLAN` |
| `bSide` | `UINT8` | `:1198` | Side (faction) — can be overridden per civilian group (`Soldier Create.cpp:818-823`) |
| `ubSoldierClass` | `UINT8` | `:1388` | `SOLDIER_CLASS_*` enum (`Soldier Control.h:326-343`): NONE/ADMIN/ELITE/ARMY/GREEN_MILITIA/REG_MILITIA/ELITE_MILITIA/CREATURE/MINER/ZOMBIE/TANK/JEEP/BANDIT/ROBOT |
| `ubWhatKindOfMercAmI` | `UINT8` | `:1361` | `MERC_TYPE__*` enum (`Soldier Control.h:273-282`): PLAYER_CHARACTER/AIM_MERC/MERC/NPC/EPC/NPC_WITH_UNEXTENDABLE_CONTRACT/VEHICLE |
| `uiUniqueSoldierIdValue` | `UINT32` | `:1400` | Monotonic unique instance id (`Soldier Create.cpp:627-629`) |
| `usSoldierProfile` | `UINT16` | `:1562` | XML soldier-profile link (name/visuals/traits) |
| `usIndividualMilitiaID` | `UINT16` | `:1591` | Militia data id (`Soldier Create.cpp:633-636`) |

### 2.2 Stats sub-struct `STRUCT_Statistics`

`Tactical/Soldier Control.h:1033-1053` — the 10 attributes + traits, all `INT8` (0-100):

| Field | Line | Web key |
|---|---|---|
| `bExpLevel` | `:1037` | `level` (1-10, `MAXEXPLEVEL` `Campaign.h:26`) |
| `bLife` / `bLifeMax` | `:1038-1039` | `hp` / `maxHp` |
| `bStrength` | `:1040` | `strength` |
| `bAgility` | `:1041` | `agility` |
| `bDexterity` | `:1042` | `dexterity` |
| `bWisdom` | `:1043` | `wisdom` |
| `bLeadership` | `:1044` | `leadership` |
| `bMarksmanship` | `:1045` | `marksmanship` |
| `bMechanical` | `:1046` | `mechanical` |
| `bExplosive` | `:1047` | `explosives` |
| `bMedical` | `:1048` | `medical` |
| `bScientific` | `:1049` | (research; web: not modeled) |
| `ubSkillTraits[30]` | `:1050` | `traits[]` (see §4) |

### 2.3 Vitality: health, bleeding, breath, energy

| Field | Type | Line | Meaning |
|---|---|---|---|
| `sFractLife` | `INT16` | `:1126` | Fractional life (hundredths) |
| `bBleeding` | `INT8` | `:1127` | Blood loss per turn; `BANDAGED(s)` macro `Soldier Control.h:185`; `MIN_BLEEDING_THRESHOLD 12` `:183` |
| `bBreath` | `INT8` | `:1128` | Current breath (fatigue/energy) |
| `bBreathMax` | `INT8` | `:1129` | Max breath, affected by fatigue/sleep |
| `sBreathRed` | `INT16` | `:1131` | Current breath-loss accumulator |
| `bCollapsed` / `bBreathCollapsed` | `INT8` | `:1180-1181` | Collapsed from 0 AP / 0 breath |
| `bFoodLevel` / `bDrinkLevel` | `INT32` | `:1549-1550` | Food/drink saturation (Flugente food system) |
| `usStarveDamageHealth/Strength` | `UINT8` | `:1552-1553` | Starvation stat damage |
| `bSleepDrugCounter` | `INT8` | `:1435` | Sleep-dart collapse counter |
| `bBlindedCounter` / `bDeafenedCounter` | `INT8` | `:1439,1501` | Blind/deaf duration |

Breath mechanics: `CalcActionPoints` reduces AP by up to ½ when `bBreath < 100`
(`Soldier Control.cpp:1996-1997`); `CheckForBreathCollapse` (`Soldier Control.cpp:14320`)
triggers collapse; `GetSleepBreathRegeneration` (`Soldier Control.cpp:20059`) computes hourly
regen; `EVENT_BeginMercTurn` (`Soldier Control.cpp:7675`) runs bleeding, shock decay, morale
recovery, and `SoldierPropertyUpkeep` (`:7803` → `:17810`).

### 2.4 Action points & movement

| Field | Type | Line | Meaning |
|---|---|---|---|
| `bActionPoints` | `INT16` | `:1113` | Current AP (100-AP scale) |
| `bInitialActionPoints` | `INT16` | `:1114` | AP at turn start |
| `bStealthMode` | `INT8` | `:1130` | Stealth toggle |
| `sWeightCarriedAtTurnStart` | `INT16` | `:1140` | Carry weight → AP penalty (`Soldier Control.cpp:1999-2002`) |
| `ubAttackingHand` | `UINT8` | `:1139` | Which hand attacks |
| `bTilesMoved` | `INT8` | `:1228` | Tiles moved this turn |
| `ubMovementNoiseHeard` | `UINT8` | `:1158` | 8-direction noise flags |
| `bOverTurnAPS` | `INT16` | `:1556` | Multi-turn action AP carryover |
| `usMultiTurnAction` | `UINT8` | `:1558` | `MTA_*` enum (`Soldier Control.h:588-595`) |

`CalcActionPoints` (`Soldier Control.cpp:1954`): base `20 + ((10*ExpLevel + 3*Agility +
2*LifeMax + 2*Dexterity + 5)/10)` (`:1974-1977`), then gear bonus, injury penalty (up to ⅔,
`:1989-1993`), breath penalty (up to ½, `:1996-1997`), weight penalty, `AP_MINIMUM` floor and
`gubMaxActionPoints[ubBodyType]` cap (`:2013-2025`), plus squadleader/vehicle/monster/phobia
adjustments (`:2027-2073`).

### 2.5 World position & stance

| Field | Type | Line | Meaning |
|---|---|---|---|
| `dXPos` / `dYPos` | `FLOAT` | `:1162-1163` | World coords |
| `sGridNo` | `INT32` | `:1171` | Tile index |
| `sInitialGridNo` / `sInsertionGridNo` | `INT32` | `:1170,1193` | Spawn / insertion tile |
| `ubDirection` | `UINT8` | `:1172` | Facing (0-7) |
| `ubDesiredHeight` | `UINT8` | `:1183` | Desired stance height |
| `usAnimState` | `UINT16` | `:1186` | Current `AnimationStates` enum (`Animation Control.h:139+`) |
| `usPendingAnimation` | `UINT16` | `:1184` | Queued animation |
| `bLevel` (pathing) | `INT8` | `:1066` | Roof/ground level |
| `sSectorX/Y`, `bSectorZ` | `INT16/INT8` | `:1365-1367` | Strategic sector |
| `ubGroupID` | `UINT8` | `:1154` | Strategic movement group |
| `ubCivilianGroup` | `UINT8` | `:1397` | Civ group id (side override, `Soldier Create.cpp:818-823`) |

**Stance levels** (`Animation Control.h:85-87`): `ANIM_STAND = 6`, `ANIM_CROUCH = 3`,
`ANIM_PRONE = 1`. Stance is derived from `gAnimControl[usAnimState].ubHeight`
(`Soldier Control.h:26-28` macros `PTR_STANDING/PTR_CROUCHED/PTR_PRONE`). Stance changes cost
AP (`ChangeSoldierStance`, `Soldier Control.h:1711`).

### 2.6 Inventory & hands

| Field | Type | Line | Meaning |
|---|---|---|---|
| `inv` | `Inventory` | `:1615` | Slot vector of `OBJECTTYPE` (`Soldier Control.h:747-783`) |
| `pTempObject` | `OBJECTTYPE*` | `:1121` | Scratch object |
| `pKeyRing` | `KEY_ON_RING*` | `:1122` | Keys (`Soldier Control.h:696-700`) |
| `usAttackingWeapon` | `UINT16` | `:1407` | Weapon item id in use |
| `bWeaponMode` | `INT8` | `:1408` | Fire mode |
| `bGunType` | `INT8` | `:1136` | Gun type |
| `bSlotItemTakenFrom` | `INT8` | `:1429` | Inventory slot of last take |
| `usQuickItemId` / `ubQuickItemSlot` | `UINT16/UINT8` | `:1645-1646` | Quick item |
| `usGrenadeItem` | `UINT16` | `:1648` | Grenade in hand |

**Inventory slots** (`Item Types.h:49-106`, `INVENTORY_SLOT` enum — 49 slots):

| Range | Slots | Lines |
|---|---|---|
| Body | `HELMETPOS(0) VESTPOS LEGPOS HEAD1POS HEAD2POS HANDPOS SECONDHANDPOS VESTPOCKPOS LTHIGHPOCKPOS RTHIGHPOCKPOS CPACKPOCKPOS BPACKPOCKPOS GUNSLINGPOCKPOS KNIFEPOCKPOS` | `:50-63` |
| Big pockets | `BIGPOCK1POS..BIGPOCK7POS` | `:64-70` |
| Med pockets | `MEDPOCK1POS..MEDPOCK4POS` | `:71-74` |
| Small pockets | `SMALLPOCK1POS..SMALLPOCK30POS` | `:75-104` |
| `NUM_INV_SLOTS` | 49 | `:105` |

**Hand positions** are `HANDPOS` (right hand, primary weapon) and `SECONDHANDPOS` (left hand,
sidearm/knife) — deliberately placed right before the big pockets so loops can iterate
hand→pockets (`Item Types.h:15-16`). Slot-range markers `BODYPOSSTART/BIGPOCKSTART/
SMALLPOCKSTART` and extern finals `BODYPOSFINAL/MEDPOCKFINAL/SMALLPOCKFINAL` (`:108-117`)
define the LBE (load-bearing equipment) pocket layout. Legacy 19-slot layout is
`OldInventory` (`:21-45`). The web's `validatePersonalInventory` (`game/squads.js:8-22`)
currently models a flat key→count map, not positional slots — see §11 gap.

### 2.7 AI data sub-struct `STRUCT_AIData`

`Tactical/Soldier Control.h:785-850` — the AI knowledge base:

| Field | Line | Meaning |
|---|---|---|
| `bOppList[MAX_NUM_SOLDIERS]` | `:791` | Per-soldier knowledge (seen/heard/unknown) |
| `bAction` / `bNextAction` / `bActionInProgress` | `:793-797` | Current/queued AI action |
| `bAlertStatus` | `:798` | Alert level |
| `bNeutral` | `:800` | Neutral (won't attack) — see `CONSIDERED_NEUTRAL` `:690-694` |
| `bOrders` | `:803` | `STATIONARY/ONGUARD/SEEKENEMY/FARPATROL/SNIPER/...` |
| `bAttitude` | `:804` | `Attitudes` enum (`soldier profile type.h:416-429`) |
| `bUnderFire` | `:805` | Under-fire counter (decays per turn, `Soldier Control.cpp:7681-7689`) |
| `bShock` | `:806` | Shock (halved each turn, `Soldier Control.cpp:7739`) |
| `bMorale` + `bTeamMoraleMod/bTacticalMoraleMod/bStrategicMoraleMod/bAIMorale` | `:819-823` | Morale stack |
| `sPatrolGrid[MAXPATROLGRIDS]` / `bPatrolCnt` | `:813-814` | Patrol waypoints (10 max, `Soldier Control.h:6-7`) |
| `sNoiseGridno` / `ubNoiseVolume` | `:815-816` | Heard-noise memory (decays, `Soldier Control.cpp:7754-7765`) |
| `bInterruptDuelPts` / `bPassedLastInterrupt` | `:831-832` | Interrupt system |
| `bFrenzied` | `:841` | Creature frenzy |
| `bNormalSmell` / `bMonsterSmell` | `:842-843` | Smell tracking |
| `bMobility` | `:844` | Mobility |
| `fAIFlags` | `:846` | AI flags |
| `bAimTime` | `:847` | Aim time (100-AP scale) |

### 2.8 Flags sub-struct `STRUCT_Flags` + status flag masks

`STRUCT_Flags` (`Soldier Control.h:852-946`) holds ~90 `BOOLEAN` render/UI flags plus
`uiStatusFlags` (`:940`). The **status flag masks** are the semantic core:

**`uiStatusFlags`** (`Soldier Control.h:69-102`): `SOLDIER_IS_TACTICALLY_VALID`,
`SOLDIER_PC` (player-controlled), `SOLDIER_PCUNDERAICONTROL`, `SOLDIER_UNDERAICONTROL`,
`SOLDIER_DEAD`, `SOLDIER_ENEMY`, `SOLDIER_ROBOT`, `SOLDIER_MONSTER`, `SOLDIER_ANIMAL`,
`SOLDIER_VEHICLE`, `SOLDIER_MULTITILE`, `SOLDIER_COWERING`, `SOLDIER_MUTE`, `SOLDIER_GASSED`,
`SOLDIER_OFF_MAP`, `SOLDIER_DRIVER`, `SOLDIER_PASSENGER`, `SOLDIER_BOXER`.

**`usSoldierFlagMask`** (`Soldier Control.h:365-403`): `SOLDIER_DRUGGED`, `SOLDIER_NO_AP`,
`SOLDIER_COVERT_CIV` (disguised as civilian), `SOLDIER_COVERT_SOLDIER`, `SOLDIER_HEADSHOT`,
`SOLDIER_POW`, `SOLDIER_ASSASSIN`, `SOLDIER_POW_PRISON`, `SOLDIER_FRESHWOUND`,
`SOLDIER_BATTLE_PARTICIPATION`, `SOLDIER_ENEMY_OFFICER`, `SOLDIER_ENEMY_OBSERVEDTHISTURN`,
`SOLDIER_VIP`, `SOLDIER_BODYGUARD`, `SOLDIER_TURNCOAT`, `SOLDIER_BACK_ATTACK`,
`SOLDIER_SNEAK_ATTACK`, `SOLDIER_BAYONET_RUNBONUS`, `SOLDIER_TRAIT_FOCUS`.

**`usSoldierFlagMask2`** (`Soldier Control.h:407-437`): `SOLDIER_SNITCHING_OFF`,
`SOLDIER_PREVENT_MISBEHAVIOUR_OFF`, `SOLDIER_INTERROGATE_*` (admin/troop/elite/officer/
general/civilian), `SOLDIER_POTENTIAL_VOLUNTEER` (civilian may join as volunteer),
`SOLDIER_HUNGOVER`, `SOLDIER_TAKEN_LARGE_HIT`, `SOLDIER_CONCEALINSERTION`,
`SOLDIER_MERC_POW_LOCATIONKNOWN`, `SOLDIER_SPENT_AP`, `SOLDIER_TURNCOAT`.

**`usDisabilityFlagMask`** (`Soldier Control.h:1594`) — multiple disabilities from
`PersonalityTrait` enum (`soldier profile type.h:394-412`): HEAT_INTOLERANT, NERVOUS,
CLAUSTROPHOBIC, NONSWIMMER, FEAR_OF_INSECTS, FORGETFUL, PSYCHO, DEAF, SHORTSIGHTED,
HEMOPHILIAC, AFRAID_OF_HEIGHTS, SELF_HARM.

---

## 3. `MERCPROFILESTRUCT` — the persistent profile

`Tactical/soldier profile type.h:770-1055`. `NUM_PROFILES = 255` (`:8`); `FIRST_RPC = 57`,
`FIRST_NPC = 75` (`:16,19`). Key fields:

| Field | Line | Meaning |
|---|---|---|
| `zName[30]` / `zNickname[10]` | `:805-806` | Name / nickname (`NAME_LENGTH 30`, `NICKNAME_LENGTH 10`, `:21-22`) |
| `ubFaceIndex` | `:814` | Face portrait index |
| `PANTS/VEST/SKIN/HAIR` | `:815-818` | Palette rep ids |
| `bSex` | `:819` | `Sexes` enum (`:431-435`) |
| `ubMiscFlags` / `ubMiscFlags2` / `ubMiscFlags3` | `:823,821,990` | `PROFILE_MISC_FLAG_*` (`:26-54`) — recruited, EPC active, good-guy, etc. |
| `bLifeMax` / `bLife` | `:862,895` | Health |
| `bStrength` / `bAgility` / `bDexterity` / `bWisdom` / `bLeadership` / `bMarksmanship` / `bMechanical` / `bExplosive` / `bMedical` | `:860,919,896,912,904,910,925,901,845` | The 9 attributes |
| `bExpLevel` | `:908` | Experience level |
| `bSkillTraits[30]` | `:898` | Trait array (old + new system) |
| `bCharacterTrait` | `:956` | `CharacterTraits` enum (`:190-207`) |
| `bDisability` | `:897` | `PersonalityTrait` (`:394-412`) |
| `bAttitude` | `:955` | `Attitudes` (`:416-429`) |
| `bBaseMorale` | `:957` | Base morale |
| `bBuddy[5]` / `bHated[5]` | `:906-907` | Buddy/hated profile ids (`BUDDY_OPINION +25`, `HATED_OPINION -25`, `:451-452`) |
| `bLearnToLike` / `bLearnToHate` | `:960,825` | Dynamic buddy/hate |
| `bMercOpinion[255]` | `:966` | Per-profile opinion (`NUMBER_OF_OPINIONS 255`, `:101`) |
| `bMercStatus` | `:968` | `MERC_OK(0)` … `MERC_IS_DEAD(-5)`, `MERC_RETURNING_HOME(-6)`, `MERC_WORKING_ELSEWHERE(-7)`, `MERC_FIRED_AS_A_POW(-8)` (`:61-81`) |
| `sSalary` / `uiWeeklySalary` / `uiBiWeeklySalary` | `:894,952-953` | Pay |
| `sTrueSalary` | `:984` | Salary when working free |
| `uiTotalCostToDate` | `:1005` | Lifetime pay |
| `iMercMercContractLength` | `:1003` | MERC contract days |
| `bRace` / `bNationality` | `:943-944` | `Races` (`:368-377`), `Nationalities` (`:241-365`) |
| `bAppearance` + care level | `:945-946` | `Appearances` (`:210-218`) |
| `bRefinement` + care level | `:947-948` | `Refinements` (`:231-238`) |
| `bRacist` / `bSexist` | `:951,824` | `RacistLevels` (`:380-387`), `SexistLevels` (`:437-444`) |
| `ubNeedForSleep` | `:986` | Sleep need |
| `uiMoney` / `iBalance` | `:987,983` | Personal money |
| `ubCivilianGroup` | `:985` | Civ group |
| `bTown` / `bTownAttachment` | `:963-964` | Town loyalty |
| `usBackground` | `:1024` | Background id (flags `Soldier Control.h:455-471`) |
| `usVoiceIndex` | `:1038` | Voice set |
| `Type` | `:1041` | `ProfileType` enum (`Soldier Profile.h`: PROFILETYPE_AIM/MERC/RPC/NPC/VEHICLE/IMP) |
| `records` | `:1021` | `STRUCT_Records` (`:456-516`): kills by class, assists, shots fired/hit, battles, wounds, locks picked, traps removed, items repaired, surgeries, militia trained, sectors discovered, damage dealt/taken |
| `bGrowthModifier*` | `:1044-1054` | Per-stat growth modifiers (ignored if `fRegresses` `:822`) |
| `inv` / `bInvStatus` / `bInvNumber` | `:1016-1018` | Starting inventory (vector) |
| `usOptionalGearCost` | `:965` | Gear-kit cost |
| `uiDayBecomesAvailable` | `:858` | Availability day |

`MERCPROFILEGEAR` (`:523-556`) holds up to `NUM_MERCSTARTINGGEAR_KITS = 5` (`:11`) starting
gear kits per profile (name, price modifier/absolute, item/status/drop vectors).

---

## 4. Attributes, skills & traits (v1.13)

### 4.1 Attributes

The 10 attributes are `INT8` 0-100 (`MAX_STAT_VALUE 100`, `Campaign.h:25`): Health
(`bLifeMax`), Strength, Agility, Dexterity, Wisdom, Leadership, Marksmanship, Mechanical,
Explosives, Medical. Stat-change enums: `Campaign.h:6-19` (`HEALTHAMT=1 … LDRAMT=11`,
`FIRST_CHANGEABLE_STAT HEALTHAMT`, `LAST_CHANGEABLE_STAT LDRAMT`). `StatChange` /
`ChangeStat` / `UpdateStats` (`Campaign.h:65-72`) drive growth; subpoints per point:
`SKILLS_SUBPOINTS_TO_IMPROVE`, `ATTRIBS_SUBPOINTS_TO_IMPROVE`, `LEVEL_SUBPOINTS_TO_IMPROVE`
(`Campaign.h:32-34`). `MAXEXPLEVEL 10` (`:26`).

### 4.2 Old trait system (`SkillTrait`)

`soldier profile type.h:109-134`: `LOCKPICKING, HANDTOHAND, ELECTRONICS, NIGHTOPS, THROWING,
TEACHING, HEAVY_WEAPS, AUTO_WEAPS, STEALTHY, AMBIDEXT, THIEF, MARTIALARTS, KNIFING,
PROF_SNIPER, CAMOUFLAGED, EXPERT`. Gated by `!gGameOptions.fNewTraitSystem`
(`Soldier Create.cpp:1327-1355`).

### 4.3 New trait system (`SkillTraitNew`) — the v1.13 traits

`soldier profile type.h:138-170`. `NUM_MAJOR_TRAITS 10`, `NUM_MINOR_TRAITS 13` (`:172-173`):

| # | Major trait | # | Minor trait |
|---|---|---|---|
| 1 | `AUTO_WEAPONS_NT` | 10 | `AMBIDEXTROUS_NT` |
| 2 | `HEAVY_WEAPONS_NT` | 11 | `MELEE_NT` |
| 3 | `SNIPER_NT` | 12 | `THROWING_NT` |
| 4 | `RANGER_NT` | 13 | `NIGHT_OPS_NT` |
| 5 | `GUNSLINGER_NT` | 14 | `STEALTHY_NT` |
| 6 | `MARTIAL_ARTS_NT` | 15 | `ATHLETICS_NT` |
| 7 | `SQUADLEADER_NT` | 16 | `BODYBUILDING_NT` |
| 8 | `TECHNICIAN_NT` | 17 | `DEMOLITIONS_NT` |
| 9 | `DOCTOR_NT` | 18 | `TEACHING_NT` |
| — | — | 19 | `SCOUTING_NT` |
| 20 | `COVERT_NT` | 21 | `RADIO_OPERATOR_NT` |
| — | — | 22 | `SNITCH_NT` |
| — | — | 23 | `SURVIVAL_NT` |

Traits live in `stats.ubSkillTraits[30]` (`Soldier Control.h:1050`); helpers
`HAS_SKILL_TRAIT` / `NUM_SKILL_TRAITS` (`Soldier Control.h:123-124`). Assignment:
`AssignTraitsToSoldier` (`Soldier Create.cpp:4709`) — XML soldier-profile traits first
(`:4721-4751`, max 2 major + 1 minor), then squadleader promotion with leadership/level
bump (`:4754-4827`), then weapon-based trait chances (auto-weapons for assault rifles/LMG,
`:4831+`). Skill-use API: `CanUseSkill` / `UseSkill` / `IsAIAllowedtoUseSkill`
(`Soldier Control.h:1961-1967`); skill enum `SKILLS_*` (`:598-639`: radio, intel/spy,
disguise, spotter/focus/drag); counters `SOLDIER_COUNTER_*` (`:642-649`) and cooldowns
`SOLDIER_COOLDOWN_*` (`:652-661`).

### 4.4 Character traits, disabilities, backgrounds

- `CharacterTraits` (`soldier profile type.h:190-207`): NORMAL, SOCIABLE, LONER, OPTIMIST,
  ASSERTIVE, INTELLECTUAL, PRIMITIVE, AGGRESSIVE, PHLEGMATIC, DAUNTLESS, PACIFIST, MALICIOUS,
  SHOWOFF, COWARD.
- `PersonalityTrait` disabilities (`:394-412`) — see §2.8.
- Backgrounds: `usBackground` + `BACKGROUND_*` flags (`Soldier Control.h:455-471`), e.g.
  `BACKGROUND_DRUGUSE`, `BACKGROUND_XENOPHOBIC`, `BACKGROUND_ANIMALFRIEND`,
  `BACKGROUND_GLOBALOYALTYLOSSONDEATH`.

---

## 5. Skill checks & training

### 5.1 Skill checks

`Tactical/SkillCheck.h`:
- `SkillCheck(pSoldier, bReason, bDifficulty)` (`:10`) — returns ≥0 on success; reasons in
  `enum SkillChecks` (`:24-45`): `LOCKPICKING_CHECK, ELECTRONIC_LOCKPICKING_CHECK,
  ATTACHING_DETONATOR_CHECK, PLANTING_BOMB_CHECK, OPEN_WITH_CROWBAR, SMASH_DOOR_CHECK,
  DISARM_TRAP_CHECK, UNJAM_GUN_CHECK, NOTICE_DART_CHECK, LIE_TO_QUEEN_CHECK,
  ATTACHING_SPECIAL_ITEM_CHECK, DISARM_ELECTRONIC_TRAP_CHECK, PLANTING_MECHANICAL_BOMB_CHECK,
  DISARM_MECHANICAL_TRAP_CHECK`.
- `Effective*` wrappers (`:13-22`): `EffectiveStrength/Wisdom/Agility/Dexterity/Mechanical/
  Explosive/Leadership/Marksmanship/Medical/ExpLevel` — apply trait/drug/gear modifiers.
- `GetSkillCheckPenaltyForFatigue` (`:9`), `ReducePointsForFatigue` (`:7-8`).
- `CalcTrapDetectLevel` (`:11`).
- Result hooks on the soldier: `bLastSkillCheck`, `ubSkillCheckAttempts`
  (`Soldier Control.h:1331-1332`), `sSkillCheckGridNo` (`:1455`).

### 5.2 Training (strategic assignments)

`Strategic/Assignments.cpp:2100` `CanCharacterTrainStat(pSoldier, bStat, fTrainSelf,
fTrainTeammate)` — gates: alive+conscious (`:2116`), surface only (`:2123`), not EPC
(`:2141`), stat within `ubTrainingSkillMin`/`ubTrainingSkillMax` and `ubMinSkillToTeach`
(`:2148-2249+`). Training assignments: `TRAIN_SELF, TRAIN_TOWN, TRAIN_TEAMMATE,
TRAIN_BY_OTHER, TRAIN_WORKERS, DRILL_MILITIA` (`Assignments.h:86-90,114,118`). The soldier's
current training target is `bTrainStat` (`Soldier Control.h:1364`). Improvement rates:
`WORKIMPROVERATE 2`, `TRAINIMPROVERATE 2` (`Campaign.h:36-37`).

---

## 6. Faces, animations & speech hooks

### 6.1 Faces

`Tactical/Faces.cpp:109` `InitSoldierFace(pSoldier)` — allocates a `FACETYPE` from
`gFacesData`, keyed by `ubFaceIndex` from the profile (`:147`), with blink/expression
frequencies. `SetProfileFaceData` (`Soldier Profile.cpp:1457`) overrides face index + eye/
mouth coords. Soldier field: `iFaceIndex` (`Soldier Control.h:1236`); created only for
`OUR_TEAM` profile mercs (`Soldier Create.cpp:797-800`).

### 6.2 Animations

`AnimationStates` enum (`Animation Control.h:139+`): `WALKING, STANDING, KNEEL_DOWN,
CROUCHING, SWATTING, RUNNING, PRONE_DOWN, CRAWLING, PRONE_UP, PRONE, READY_RIFLE_*,
AIM_RIFLE_*, SHOOT_RIFLE_*, END_RIFLE_*` (per stance), `FLYBACK_HIT, GENERIC_HIT_*,
FALLBACK_HIT_*, ROLLOVER, CLIMBUPROOF, FALLOFF, GETUP_FROM_ROLLOVER, CLIMBDOWNROOF,
PUNCH_BREATH, PUNCH, OPEN_DOOR, OPEN_STRUCT, PICKUP_ITEM, DROP_ITEM, SLICE, STAB,
CROUCH_STAB, START_AID, GIVING_AID, END_AID, SLEEPING, THROW_KNIFE, KNIFE_BREATH,
COWERING_*, ADULTMONSTER_*` etc. Key handlers in `Soldier Ani.cpp`: `HandleSoldierDeath`
(`:3905`), `CheckForAndHandleSoldierIncompacitated` (`:4362`), `HandleUnjamAnimation`
(`:4768`), `ChangeToFlybackAnimation`/`ChangeToFallbackAnimation` (`Soldier Control.h:1787-1788`).

### 6.3 Speech / quotes

`DialogQuoteIDs` enum (`Tactical/Dialogue Control.h:10-160+`): `QUOTE_SEE_ENEMY(0),
QUOTE_OUT_OF_AMMO(13), QUOTE_SERIOUSLY_WOUNDED(14), QUOTE_BUDDY_1_KILLED(15),
QUOTE_JAMMED_GUN(19), QUOTE_UNDER_HEAVY_FIRE(20), QUOTE_STARTING_TO_BLEED(24),
QUOTE_NEED_SLEEP(25), QUOTE_OUT_OF_BREATH(26), QUOTE_KILLED_AN_ENEMY(27),
QUOTE_HEADSHOT(34), QUOTE_ASSIGNMENT_COMPLETE(36), QUOTE_STARTING_TO_WHINE(40),
QUOTE_EXPERIENCE_GAIN(47), QUOTE_BUDDY_1_GOOD(52), QUOTE_SECTOR_SAFE(65),
QUOTE_CONTRACTS_OVER(89), QUOTE_CONTRACT_ACCEPTANCE(91), QUOTE_GREETING(108), …`.

Per-soldier quote state: `ubQuoteRecord` (`Soldier Control.h:1317`), `ubQuoteActionID`
(`:1318`), `ubBattleSoundID` (`:1319`), `usQuoteSaidFlags` (`:1330`, masks `:126-141`),
`usQuoteSaidExtFlags` (`:1446`, masks `:143-161`), `bNumHitsThisTurn` (`:1329`),
`uiTimeSinceLastSpoke` (`:1479`). Battle sounds: `DoMercBattleSound` (`Soldier Control.h:1764`),
`BATTLE_SOUND_*` enum (`:250-269`). Quote triggers in `Soldier Ani.cpp`: `HandleMercArrivesQuotes`
(`:1286`), `SayBuddyWitnessedQuoteFromKill` (`:3543`), `ShouldMercSayHappyWithGunQuote`
(`:3512`), `TacticalCharacterDialogue` calls (`:3693,3755,3829,3861,3877`).

---

## 7. Creation functions (enemy/civilian/creature variants)

All in `Tactical/Soldier Create.cpp`; entry point `TacticalCreateSoldier` (`:569`) →
`CreateSoldierCommon` (`Soldier Control.h:1659`). `SOLDIERCREATE_STRUCT` (`Soldier Create.h`)
carries team/body/orders/attitude/attributes/inventory/palettes.

| Variant | Function | Line | Team / class / notes |
|---|---|---|---|
| Generic | `TacticalCreateSoldier` | `:569` | Auto-team by body type (`:689-731`) |
| Random stats | `RandomizeNewSoldierStats` | `:524` | All stats `50+Random(50)`, level `1+Random(4)`, morale 50, `FARPATROL` |
| Profile copy | `TacticalCopySoldierFromProfile` | `:1267` | Profile → soldier bridge (§1) |
| Administrator | `TacticalCreateAdministrator` | `:3070` | `ENEMY_TEAM`, `SOLDIER_CLASS_ADMINISTRATOR`, `SEEKENEMY` |
| Army troop | `TacticalCreateArmyTroop` | `:3103` | `ENEMY_TEAM`, `SOLDIER_CLASS_ARMY` |
| Elite enemy | `TacticalCreateEliteEnemy` | `:3137` | `ENEMY_TEAM`, `SOLDIER_CLASS_ELITE`; may upgrade to profiled NPC (`OkayToUpgradeEliteToSpecialProfiledEnemy`) |
| Zombie | `TacticalCreateZombie` | `:3307` | `SOLDIER_CLASS_ZOMBIE` |
| Militia | `TacticalCreateMilitia` | `:3381` | `MILITIA_TEAM`, class = green/reg/elite militia, `STATIONARY` |
| Creature | `TacticalCreateCreature` | `:3422` | `CREATURE_TEAM`, `SOLDIER_CLASS_CREATURE`, `AGGRESSIVE` |
| Armed civilian | `TacticalCreateArmedCivilian` | `:3448` | `CIV_TEAM`, needs new trait system, random clothes |
| Civilian | `TacticalCreateCivilian` | `:3493` | `CIV_TEAM`, random body type, up to 4 items at 80-100% status |
| Bandit | `TacticalCreateBandit` | `:3661` | `SOLDIER_CLASS_BANDIT` |
| Assassin | `TacticalCreateEnemyAssassin` | `Soldier Create.h` | Elite of civ team, disguised (`SOLDIER_COVERT_SOLDIER`, `Soldier Create.cpp:1364-1369`) |
| Tank/Jeep/Robot | `TacticalCreateEnemyTank/Jeep/Robot` | `:3179+` | `SOLDIER_CLASS_TANK/JEEP/ROBOT` |

**Init list** (`Soldier Init List.cpp`): `AddSoldierInitListTeamToWorld` (`:869`) fills
priority placements first then random basic placements; `AddSoldierInitListEnemyDefenceSoldiers`
(`:1042`), `AddSoldierInitListMilitia` (`:1602`), `AddSoldierInitListCreatures` (`:1950`),
`AddSoldierInitListBloodcats` (`:2425`), `AddProfilesUsingProfileInsertionData` (`:2622`),
`AddProfilesNotUsingProfileInsertionData` (`:2711`). `SOLDIERINITNODE` linked list
(`Soldier Init List.h`).

---

## 8. Assignments & contracts (Strategic hooks)

### 8.1 Assignments

`Strategic/Assignments.h:37-125` — full enum: `SQUAD_1..SQUAD_40` (0-39), `ON_DUTY(40),
DOCTOR(41), PATIENT(42), VEHICLE(43), IN_TRANSIT(44), REPAIR(45), RADIO_SCAN(46),
TRAIN_SELF(47), TRAIN_TOWN(48), ASSIGNMENT_UNUSED(49), TRAIN_TEAMMATE(50), TRAIN_BY_OTHER(51),
MOVE_EQUIPMENT(52), FACILITY_STAFF(53), FACILITY_EAT(54), FACILITY_REST(55),
FACILITY_INTERROGATE_PRISONERS(56), ASSIGNMENT_DEAD(57), ASSIGNMENT_UNCONCIOUS(58),
ASSIGNMENT_POW(59), ASSIGNMENT_HOSPITAL(60), ASSIGNMENT_EMPTY(61), FACILITY_PRISON_SNITCH(62),
FACILITY_SPREAD_PROPAGANDA(63), FACILITY_SPREAD_PROPAGANDA_GLOBAL(64),
FACILITY_GATHER_RUMOURS(65), SNITCH_SPREAD_PROPAGANDA(66), SNITCH_GATHER_RUMOURS(67),
FACILITY_STRATEGIC_MILITIA_MOVEMENT(68), DISEASE_DIAGNOSE(69), DISEASE_DOCTOR_SECTOR(70),
FACILITY_DOCTOR(71), FACILITY_PATIENT(72), FACILITY_REPAIR(73), FORTIFICATION(74),
TRAIN_WORKERS(75), CONCEALED(76), GATHERINTEL(77), DOCTOR_MILITIA(78), DRILL_MILITIA(79),
BURIAL(80), ADMINISTRATION(81), EXPLORATION(82), ASSIGNMENT_MINIEVENT(83),
ASSIGNMENT_REBELCOMMAND(84), NUM_ASSIGNMENTS(85)`.

Soldier fields: `bAssignment` / `bOldAssignment` (`Soldier Control.h:1362-1363`),
`bTrainStat` (`:1364`), `ubHoursOnAssignment` (`:1441`), `uiLastAssignmentChangeMin`
(`:1385`), `ubDesiredSquadAssignment` (`:1393`). Helpers: `IS_DOCTOR/IS_PATIENT/IS_REPAIR/
SPY_LOCATION/ADMINISTRATION_BONUS` (`Assignments.h:127-156`).

### 8.2 Contracts

`Strategic/Merc Contract.h`: `MercContractHandling` (`:57`), `StrategicRemoveMerc` (`:59`),
`BeginStrategicRemoveMerc` (`:60`), `WillMercRenew` (`:63`), `CheckIfMercGetsAnotherContract`
(`:65`), `ContractIsExpiring` (`:74`), `GetHourWhenContractDone` (`:75`),
`ContractIsGoingToExpireSoon` (`:76`). Soldier fields: `iEndofContractTime` /
`iStartContractTime` / `iTotalContractLength` (`Soldier Control.h:1357-1359`),
`uiTimeOfLastContractUpdate` / `bTypeOfLastContract` (`:1432-1433`), `ubMercJustFired`
(`:1443`), `ubContractRenewalQuoteCode` (`:1480`), `iTimeCanSignElsewhere` (`:1497`),
`usMedicalDeposit` / `usLifeInsurance` (`:1370-1371`).

---

## 9. Web clone: what already exists vs missing

### 9.1 Already ported (cross-reference)

| Web module | Covers | Engine source |
|---|---|---|
| `game/data.js:2-289` `OPERATIVES` | 13 historical operatives + San Martín (id 57): 10 attributes, `hp/maxHp`, `weapon/blade`, `weeklyPay/monthlyPay`, `role`, `biography` | `MERCPROFILESTRUCT` stats + salary |
| `game/recruitment.js:16-25` `CIVIC_RECRUITS` | 7 civic volunteers (ids 100-106) with `traits[]`, `sector`, `tier`, `ridingSkill` | `PROFILETYPE_RPC`-style profiles |
| `game/recruitment.js:26-35` `createOfficerRecord` | Custom officer (id 1000) from Cabildo exam | IMP creation (`PROFILETYPE_IMP`) |
| `game/recruitment.js:36-43` `rosterFor` | Merges authored + `operativeState` growth (`level = 1+floor(xp/100)`, stat bumps) | `StatChange`/`UpdateStats` (`Campaign.h:65-72`) |
| `game/characters.js` | `CHARACTER_PROFILES` (personality, skills, speech lines), `SPEECH_EVENTS` = hired/contact/cleared/wounded/exhausted/death/ending, `ATTRIBUTE_LABELS` | `DialogQuoteIDs` subset + `CharacterTraits` |
| `game/character-profile.js` | `PROFILE_ATTRIBUTES` (10 attrs), `PROFILE_POINTS 550`, `CHARACTER_CLASSES` (gaucho/soldado/baqueano/artesano), `defaultProfile`, `applyCharacterProfile` | IMP stat allocation |
| `game/skill-training.js` | `TRAINABLE_SKILLS` = agility/stealth/marksmanship/medical/mechanical/ridingSkill; `PRACTICE_THRESHOLD 40`; `practice()`; `trainingProgress()` | `StatChange` + `SKILLS_SUBPOINTS_TO_IMPROVE` |
| `game/contracts.js` | `CONTRACT_TERMS` (day/week/month), `contractQuote`, `contractStatus`, `migrateContracts` | `Merc Contract.cpp` + `iEndofContractTime` |
| `game/squads.js` | `migrateSquads`, `activeSquad`, `operativeLocation`, `synchronizeSquad`, `validatePersonalInventory` | `ubGroupID` + `SQUAD_*` assignments |
| `game/campaign.js:57` `operativeState` | Per-operative `{hp, fatigue, alive, xp, priming, flints, rations, torches, condition}` | `SOLDIERTYPE` vitality subset |
| `game/tactical.js:34` `makeUnit` | Battle unit: `maxHp/hp/ap/morale/marksmanship/agility/strength/medical/mechanical/stealth/weapon/loaded/ammo/condition/stance/mounted/energy/fatigue/priming/flints/rations/inventory` | `SOLDIERTYPE` + `STRUCT_Statistics` |
| `game/validate-battle.js:9-37` | Full battle-snapshot schema validation (units, tiles, traits ≤30, inventory, mounts) | `SOLDIERTYPE::Save`/`Load` |

### 9.2 Missing / gaps for the web save schema

1. **Positional inventory slots** — engine has 49 named slots (`Item Types.h:49-106`);
   web uses a flat key→count map (`squads.js:8-22`). No `HANDPOS`/`SECONDHANDPOS`/
   `VESTPOS`/pocket semantics, no LBE pocket ranges (`Item Types.h:108-117`).
2. **`ubSoldierClass`** — web units have no admin/elite/army/militia/creature class field
   (`Soldier Control.h:1388`); `validate-battle.js` doesn't validate it.
3. **`ubWhatKindOfMercAmI`** (`MERC_TYPE__*`, `Soldier Control.h:273-282`) — no
   player/AIM/MERC/NPC/EPC distinction in web saves.
4. **Traits** — web `traits[]` are Granaderos-flavored strings (`cavalry_commander`,
   `guerrilla_tactician`, …); engine v1.13 traits are numeric `SkillTraitNew` ids
   (`soldier profile type.h:138-170`). No mapping table exists.
5. **Morale stack** — engine has `bMorale + bTeamMoraleMod + bTacticalMoraleMod +
   bStrategicMoraleMod + bAIMorale` (`Soldier Control.h:819-823`); web has a single
   `morale` number.
6. **Bleeding** — engine `bBleeding` + `MIN_BLEEDING_THRESHOLD 12` (`Soldier Control.h:1127,183`);
   web tracks `bleeding` in battle units but not in `operativeState`.
7. **Breath/energy** — engine `bBreath/bBreathMax/sBreathRed` (`Soldier Control.h:1128-1131`)
   with collapse (`:1180-1181`); web uses `energy` (0-100) + `fatigue` in battle only.
8. **Buddy/hated/opinion** — `bBuddy[5]/bHated[5]/bMercOpinion[255]`
   (`soldier profile type.h:906-907,966`) not modeled.
9. **Records** — `STRUCT_Records` (`soldier profile type.h:456-516`) kills/assists/battles/
   wounds not tracked in web saves.
10. **Disabilities/backgrounds** — `usDisabilityFlagMask` (`Soldier Control.h:1594`) and
    `usBackground` (`:1562`-adjacent profile field) absent.
11. **Contracts** — web `contracts.js` covers day/week/month + expiry, but not
    `iEndofContractTime`/`iStartContractTime`/`iTotalContractLength` triple
    (`Soldier Control.h:1357-1359`) or `usMedicalDeposit`/`usLifeInsurance` (`:1370-1371`).
12. **Assignments** — web has squads + militia training but no `bAssignment` enum
    (`Assignments.h:37-125`) for DOCTOR/REPAIR/TRAIN_*/FACILITY_*/CONCEALED/GATHERINTEL/
    ADMINISTRATION/EXPLORATION.
13. **Skill checks** — `SkillCheck` reasons (`SkillCheck.h:24-45`) not ported; web has no
    lockpick/trap/disarm/unjam checks.
14. **`ubSkillTraits[30]`** — engine supports up to 30 trait slots (`Soldier Control.h:1050`);
    web `validate-battle.js:25` caps `traits` at 30 but `characters.js`/`recruitment.js`
    only ever produce 1-3.

---

## 10. TypeScript interface proposal (web save schema)

```typescript
// docs/web-port/04-soldiers-stats.md — proposed web save schema
// Mirrors SOLDIERTYPE (Soldier Control.h:1079-2101) + MERCPROFILESTRUCT
// (soldier profile type.h:770-1055) at the semantic level.

/** 10 attributes, 0-100 (MAX_STAT_VALUE, Campaign.h:25). */
export interface Attributes {
  maxHp: number;        // bLifeMax   (Soldier Control.h:1039)
  hp: number;           // bLife      (:1038)
  strength: number;     // bStrength  (:1040)
  agility: number;      // bAgility   (:1041)
  dexterity: number;    // bDexterity (:1042)
  wisdom: number;       // bWisdom    (:1043)
  leadership: number;   // bLeadership(:1044)
  marksmanship: number; // bMarksmanship (:1045)
  mechanical: number;   // bMechanical (:1046)
  explosives: number;   // bExplosive (:1047)
  medical: number;      // bMedical   (:1048)
}

/** v1.13 trait ids (soldier profile type.h:138-170). */
export type SkillTraitId =
  | 'auto_weapons' | 'heavy_weapons' | 'sniper' | 'ranger' | 'gunslinger'
  | 'martial_arts' | 'squadleader' | 'technician' | 'doctor' | 'covert'
  | 'ambidextrous' | 'melee' | 'throwing' | 'night_ops' | 'stealthy'
  | 'athletics' | 'bodybuilding' | 'demolitions' | 'teaching' | 'scouting'
  | 'radio_operator' | 'snitch' | 'survival';

/** 49 positional slots (Item Types.h:49-106). */
export type InventorySlot =
  | 'helmet' | 'vest' | 'legs' | 'head1' | 'head2'
  | 'hand' | 'secondHand'                       // HANDPOS / SECONDHANDPOS
  | 'vestPocket' | 'lThighPocket' | 'rThighPocket'
  | 'cPackPocket' | 'bPackPocket' | 'gunslingPocket' | 'knifePocket'
  | `bigPocket${1|2|3|4|5|6|7}`
  | `medPocket${1|2|3|4}`
  | `smallPocket${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30}`;

export interface InventoryItem {
  item: number;          // usItem (weapon 1800-1808, blade 1809-1813, gear)
  status: number;        // 0-100 condition
  count: number;         // stack size
  loaded?: number;       // shots left (capacity 1-2)
  attachments?: number[]; // ATTACHMENT_SLOT ids (Item Types.h:119+)
}

/** Soldier class (Soldier Control.h:326-343). */
export type SoldierClass =
  | 'none' | 'administrator' | 'elite' | 'army'
  | 'greenMilitia' | 'regMilitia' | 'eliteMilitia'
  | 'creature' | 'miner' | 'zombie' | 'tank' | 'jeep' | 'bandit' | 'robot';

/** Merc type (Soldier Control.h:273-282). */
export type MercType =
  | 'playerCharacter' | 'aimMerc' | 'merc' | 'npc' | 'epc'
  | 'npcUnextendableContract' | 'vehicle';

/** Assignment (Assignments.h:37-125). */
export type Assignment =
  | `squad${1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40}`
  | 'onDuty' | 'doctor' | 'patient' | 'vehicle' | 'inTransit' | 'repair'
  | 'radioScan' | 'trainSelf' | 'trainTown' | 'trainTeammate' | 'trainByOther'
  | 'moveEquipment' | 'facilityStaff' | 'facilityEat' | 'facilityRest'
  | 'facilityInterrogatePrisoners' | 'dead' | 'pow' | 'hospital' | 'empty'
  | 'facilityPrisonSnitch' | 'facilitySpreadPropaganda' | 'facilityGatherRumours'
  | 'concealed' | 'gatherIntel' | 'doctorMilitia' | 'drillMilitia' | 'burial'
  | 'administration' | 'exploration';

/** Persistent operative record (web save). */
export interface OperativeRecord extends Attributes {
  id: number;                    // ubProfile (Soldier Control.h:1316)
  name: string;                  // zName (soldier profile type.h:805)
  nickname: string;              // zNickname (:806)
  level: number;                 // bExpLevel 1-10 (Campaign.h:26)
  traits: SkillTraitId[];        // ubSkillTraits[30] (Soldier Control.h:1050)
  classId?: string;              // web class (gaucho/soldado/baqueano/artesano)
  soldierClass?: SoldierClass;   // ubSoldierClass (:1388)
  mercType?: MercType;           // ubWhatKindOfMercAmI (:1361)
  weapon: number;                // HANDPOS item
  blade: number;                 // SECONDHANDPOS item
  inventory?: Partial<Record<InventorySlot, InventoryItem>>;
  weeklyPay: number;             // uiWeeklySalary (soldier profile type.h:952)
  monthlyPay: number;            // sSalary (:894)
  role: string;                  // display role
  biography: string;
  portrait?: string;             // ubFaceIndex (:814) → asset
  personality?: string;          // bCharacterTrait (:956) / web temperament
  disabilities?: string[];       // usDisabilityFlagMask (Soldier Control.h:1594)
  background?: number;           // usBackground (soldier profile type.h:1024)
  buddyIds?: number[];           // bBuddy[5] (:906)
  hatedIds?: number[];           // bHated[5] (:907)
  morale?: number;               // bMorale (Soldier Control.h:819)
  bleeding?: number;             // bBleeding (:1127)
  breath?: number;               // bBreath (:1128)
  breathMax?: number;            // bBreathMax (:1129)
  assignment?: Assignment;       // bAssignment (:1362)
  sector?: string;               // sSectorX/Y + bSectorZ (:1365-1367)
  contract?: {
    kind: 'patriot' | 'paid' | 'legacy';
    term: 'day' | 'week' | 'month';
    started: number;             // iStartContractTime (:1358)
    expiresAt: number | null;    // iEndofContractTime (:1357)
    paid: number;                // uiTotalCostToDate (soldier profile type.h:1005)
  };
  records?: {                    // STRUCT_Records (soldier profile type.h:456-516)
    kills: number; assists: number; shotsFired: number; shotsHit: number;
    battlesFought: number; timesWounded: number; daysServed: number;
  };
}
```

---

## 11. Reproduction checklist

Use this to verify the web soldier system against the engine. Each item cites the source.

### 11.1 Data model

- [ ] `OPERATIVES`/`CIVIC_RECRUITS` cover the 10 attributes + `hp/maxHp` + `level`
      (`STRUCT_Statistics`, `Soldier Control.h:1033-1053`; `MAX_STAT_VALUE 100`,
      `MAXEXPLEVEL 10`, `Campaign.h:25-26`).
- [ ] `rosterFor()` growth matches `StatChange`/`UpdateStats` semantics
      (`Campaign.h:65-72`; web `recruitment.js:36-43`).
- [ ] Traits map to `SkillTraitNew` ids (`soldier profile type.h:138-170`) with a
      Granaderos-string ↔ numeric-id translation table (gap §9.2.4).
- [ ] Save schema validates `soldierClass` (`Soldier Control.h:1388`) and `mercType`
      (`:1361`) (gap §9.2.2-3).

### 11.2 Vitality

- [ ] `hp`/`maxHp`/`bleeding`/`breath`/`breathMax` round-trip (`Soldier Control.h:1126-1131`).
- [ ] Bleeding threshold `MIN_BLEEDING_THRESHOLD 12` (`:183`) and `BANDAGED` macro (`:185`)
      reproduced.
- [ ] Breath collapse (`CheckForBreathCollapse`, `Soldier Control.cpp:14320`) and
      turn-start bleeding/shock/morale (`EVENT_BeginMercTurn`, `:7675`) reproduced in
      `endTurn` (`game/tactical.js:139`).

### 11.3 AP & stances

- [ ] `CalcActionPoints` formula (`Soldier Control.cpp:1954-2025`): base
      `20 + ((10*Exp + 3*Agi + 2*LifeMax + 2*Dex + 5)/10)`, injury −⅔, breath −½, weight,
      `AP_MINIMUM` floor, body-type cap. Web: `maxActionPoints` (`game/tactical.js:31`).
- [ ] Stance heights `ANIM_STAND=6 / ANIM_CROUCH=3 / ANIM_PRONE=1`
      (`Animation Control.h:85-87`); stance-change AP cost (`ChangeSoldierStance`,
      `Soldier Control.h:1711`).

### 11.4 Inventory

- [ ] 49 positional slots (`Item Types.h:49-106`) with `HANDPOS`/`SECONDHANDPOS` hand
      semantics (`:15-16,55-56`) — replace flat map (gap §9.2.1).
- [ ] LBE pocket ranges `BODYPOSFINAL/MEDPOCKFINAL/SMALLPOCKFINAL` (`Item Types.h:108-117`).

### 11.5 Creation & variants

- [ ] Player mercs created via profile copy (`TacticalCopySoldierFromProfile`,
      `Soldier Create.cpp:1267`); generated soldiers via `RandomizeNewSoldierStats`
      (`:524`).
- [ ] Enemy classes admin/army/elite (`:3070,3103,3137`), militia (`:3381`), creatures
      (`:3422`), civilians (`:3493`), bandits (`:3661`), zombies (`:3307`) each produce
      correct `bTeam` + `ubSoldierClass` + orders.
- [ ] Trait assignment rules (`AssignTraitsToSoldier`, `:4709`): XML traits first, then
      squadleader promotion, then weapon-based chances.

### 11.6 Skills & training

- [ ] `SkillCheck` reasons ported (`SkillCheck.h:24-45`); `bLastSkillCheck`/
      `ubSkillCheckAttempts` tracked (`Soldier Control.h:1331-1332`).
- [ ] Training gates match `CanCharacterTrainStat` (`Assignments.cpp:2100`): alive,
      surface, not EPC, stat within min/max/teach bounds.

### 11.7 Strategic hooks

- [ ] Assignment enum (`Assignments.h:37-125`) represented in save (gap §9.2.12).
- [ ] Contract triple `iStartContractTime/iEndofContractTime/iTotalContractLength`
      (`Soldier Control.h:1357-1359`) + `contractQuote`/`contractStatus`
      (`game/contracts.js:2-11`).
- [ ] `bMercStatus` states (`soldier profile type.h:61-81`) — dead/returning/working
      elsewhere — reflected in `operativeState.alive` + `contracts`.

### 11.8 Faces / speech

- [ ] Portrait keyed by `ubFaceIndex` (`soldier profile type.h:814`; `Faces.cpp:109`).
- [ ] Speech events map to `DialogQuoteIDs` (`Dialogue Control.h:10-160`); web
      `SPEECH_EVENTS` (`game/characters.js:28`) covers hired/contact/cleared/wounded/
      exhausted/death/ending.
- [ ] Quote-once flags (`usQuoteSaidFlags`, `Soldier Control.h:1330`) prevent repeats.

### 11.9 Verification

- [ ] `npm test` passes (rules, campaign, maps, integration — `README.md`).
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` produces `dist/`.
- [ ] A human has completed the campaign end-to-end (`README.md`).

---

## 12. Gotchas

1. **Two representations, one bridge.** Profile (`MERCPROFILESTRUCT`) is the authored
   record; `SOLDIERTYPE` is the runtime copy. The web must keep `OPERATIVES` (authored)
   separate from `operativeState` (campaign mutations) — `rosterFor()` already does this
   (`game/recruitment.js:36-43`).
2. **`ubSkillTraits[30]` is positional, not a set.** Slots 0-2 are the "active" traits in
   the new system (max 2 major + 1 minor, `Soldier Create.cpp:4741-4748`); the rest are
   legacy/XML fill. Web `traits[]` should preserve order.
3. **`NO_PROFILE = 200` is invalid** (`Soldier Control.h:11`) — generated soldiers have no
   profile; web uses `id: 1000` for the custom officer instead.
4. **Morale is a stack, not a scalar** (`Soldier Control.h:819-823`). A single web `morale`
   number loses the team/tactical/strategic decomposition.
5. **`bMercStatus` negative values are states, positive are days-away**
   (`soldier profile type.h:968` comment). Don't treat it as a boolean hired flag.
6. **Stance is derived from the animation** (`gAnimControl[usAnimState].ubHeight`,
   `Soldier Control.h:26-28`), not stored directly — the web stores `stance` as a string
   (`game/tactical.js:34`), which is fine for saves but must stay in sync with
   `movementMode`.
7. **The 49-slot inventory is the v1.13 LBE system** (`Item Types.h:47-106`); the legacy
   19-slot layout (`OldInventory`, `:21-45`) exists only for old save compatibility.
8. **Traits are numeric enums in the engine** (`soldier profile type.h:138-170`) but
   Spanish-flavored strings in the web (`game/recruitment.js:4-9`). Any future engine↔web
   data exchange needs a mapping table.