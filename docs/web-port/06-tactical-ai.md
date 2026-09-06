# 06 — Tactical AI (engine/TacticalAI + engine/ModularizedTacticalAI → game/tactical.js)

Reference for porting the JA2 v1.13-derived per-soldier tactical decision loop to
the browser simulation. The C++ source lives in two places: the legacy monolithic
`engine/TacticalAI/` (the actual decision code) and the refactor scaffold
`engine/ModularizedTacticalAI/` (a Composite/Abstract-Factory wrapper that today
only re-dispatches into the legacy functions). Line numbers cite the current
working tree; treat them as anchors, not a contract.

Scope: the per-soldier think loop, alert-status state machine, knowledge /
opponent tracking, cover / flank / retreat / stance / fire-vs-advance choices,
difficulty scaling, interrupt hooks, and the modular plan wrapper. **Out of
scope:** strategic AI and combat formulas (docs 07 and 03 own those).

---

## 1. Source map

| Subsystem | C++ anchor | JS anchor (target) |
|---|---|---|
| Main-thread AI entry | `engine/TacticalAI/AIMain.cpp` `HandleSoldierAI` (:407) | `game/tactical.js` enemy turn loop |
| Soldier eligibility gate | `engine/TacticalAI/AIUtils.cpp` `SoldierAI` (:4885) | `game/tactical.js` `isAIControlled` |
| Alert-status dispatch | `engine/ModularizedTacticalAI/src/LegacyAIPlan.cpp` `LegacyAIPlan::execute` (:32) | `game/tactical.js` `decideAction` |
| Green/Yellow/Red/Black phases | `engine/TacticalAI/DecideAction.cpp` `DecideActionGreen` (:691), `DecideActionYellow`, `DecideActionRed`, `DecideActionBlack` | `game/tactical.js` per-phase functions |
| Creature / zombie / vehicle / crow | `CreatureDecideAction.cpp:1465`, `ZombieDecideAction.cpp:1269`, `DecideAction.cpp:7423` (`ArmedVehicleDecideAction`), `CrowDecideAction` | `game/tactical.js` special-unit branches |
| Knowledge / opponent tracking | `engine/TacticalAI/AIUtils.cpp` `Knowledge` (:5689), `PrepareThreatlist` (:317 in ai.h); `AIInternals.h` `THREATTYPE` (:110) | `game/tactical.js` `knowledge`, `threats` |
| Cover / flank / retreat / advance | `engine/TacticalAI/FindLocations.cpp` `FindFlankingSpot` (:2621), `FindAdvanceSpot` (:3096), `FindRetreatSpot` (:3373); `FindBestNearbyCover` (ai.h:202) | `game/tactical.js` `findCover`, `findFlank`, `findRetreat` |
| Difficulty scaling | `engine/TacticalAI/ai.h` `gbDiff[MAX_DIFF_PARMS][5]` (:149-156); `AIUtils.cpp` `SoldierDifficultyLevel` (:3002) | `game/tactical.js` `difficulty` |
| RNG (determinism) | `engine/sgp/Random.cpp` `Random`/`PreRandom`/`InitializeRandom`; `engine/Ja2/SaveLoadGame.cpp:8464` `srand(uiSeedNumber)` | `game/tactical.js` seeded PRNG |
| Plan wrapper (modular) | `engine/ModularizedTacticalAI/include/*.h` (see §7) | (optional; port the dispatch directly) |

---

## 2. The decision loop entry points

### 2.1 Main-thread entry: `HandleSoldierAI` (AIMain.cpp:407)

Called once per soldier per AI tick. It is a **guard + dispatch**, not the
decision itself:

1. Bail if the soldier is engaged in a scripted action, an enemy sighting is
   pending, or the explosion queue is non-empty (`AIMain.cpp:412-420`).
2. Bail for player-controlled soldiers unless autobandage / AI-control / boxer
   flags are set (`AIMain.cpp:422-436`).
3. Compute `gfTurnBasedAI` from `TURNBASED && INCOMBAT` flags (`:439`).
4. In turn-based mode, bail unless it is this team's turn and the soldier is
   under AI control and hasn't already moved (`:442-475`).
5. Otherwise hand off to the plan system (see §2.2), which sets
   `pSoldier->aiData.bAction`; `ExecuteAction` then runs the chosen action.

`SoldierAI` (`AIUtils.cpp:4885`) is the eligibility predicate: returns FALSE for
civilians, neutrals, boxers, vehicles, and robots — those get their own handlers.

### 2.2 The dispatch: `LegacyAIPlan::execute` (ModularizedTacticalAI/src/LegacyAIPlan.cpp:32)

This is the real top-level decision switch. It reads `aiData.bAlertStatus` and
routes to one of four phase functions:

```
if bypassToGreen && alertStatus < BLACK  -> DecideActionGreen
else switch (alertStatus):
  STATUS_GREEN  -> DecideActionGreen
  STATUS_YELLOW -> DecideActionYellow
  STATUS_RED    -> DecideActionRed
  STATUS_BLACK  -> DecideActionBlack
```

The legacy `DecideAction()` declared in `ai.h:187` has been superseded by this
plan wrapper; the browser port only needs the switch, not the plan machinery.

### 2.3 Alert statuses (Overhead Types.h:159-162)

| Status | Meaning |
|---|---|
| `STATUS_GREEN` | no suspicion; patrol / schedule / idle behavior |
| `STATUS_YELLOW` | heard something (noise) |
| `STATUS_RED` | definite evidence of an opponent (reported or seen recently) |
| `STATUS_BLACK` | currently sees an active opponent (combat) |

`DecideAlertStatus` (`DecideAction.cpp:7274`) and `SetNewSituation`
(`AIMain.cpp:2871`) are the transitions: they promote/demote a soldier between
statuses based on sight/noise events and broadcast "new situation" to friends.

---

## 3. Knowledge and opponent tracking

### 3.1 Knowledge levels

Knowledge is a per-(soldier, opponent) recency grade, defined in
`Overhead Types.h:229-231` and the `gStr8Knowledge` table
(`DecideAction.cpp:71`):

```
HEARD_3_TURNS_AGO .. HEARD_THIS_TURN   (auditive, -4..-1)
NOT_HEARD_OR_SEEN = 0
SEEN_CURRENTLY = 1, SEEN_THIS_TURN, SEEN_LAST_TURN, SEEN_2_TURNS_AGO, SEEN_3_TURNS_AGO
```

### 3.2 The knowledge API (ai.h:390-402, AIUtils.cpp:5689)

- `Knowledge(pSoldier, oppID)` — combined grade (max of personal + public).
- `KnownLocation` / `KnownLevel` — where the soldier *thinks* the opponent is.
- `PersonalKnowledge` / `KnownPersonalLocation` — what this soldier alone knows.
- `PublicKnowledge` / `KnownPublicLocation` — team-shared knowledge
  (`gsPublicNoiseGridNo`, `gubPublicNoiseVolume` in `Knowledge.cpp:34-35`).
- `UsePersonalKnowledge` — whether to trust private over public info.

### 3.3 Threat list (AIInternals.h:110-122)

`PrepareThreatlist` (ai.h:317) fills the global `Threat[MAXMERCS]` array of
`THREATTYPE` records: opponent pointer, gridno, threat value, APs to engage,
certainty, range, level, and the three knowledge grades. `ClosestSeenThreatID`
and `ClosestKnownThreatID` (ai.h:318-319) then pick the target. `CalcManThreatValue`
(AIInternals.h:200) scores each opponent; `PERCENT_TO_IGNORE_THREAT = 50`
(AIInternals.h:86) is the threshold below which a threat is ignored.

**Port note:** the browser equivalent is a per-soldier `Map<unitId, {grade,
location, level, threatValue}>` updated on sight/noise events, plus a team-shared
public-knowledge map. Do not port the global `Threat[]` array — make it a
parameter.

---

## 4. Cover, flank, retreat, stance, fire-vs-advance

### 4.1 Action vocabulary (ai.h:37-114)

Movement: `AI_ACTION_TAKE_COVER`, `AI_ACTION_RUN_AWAY`, `AI_ACTION_WITHDRAW`,
`AI_ACTION_FLANK_LEFT`, `AI_ACTION_FLANK_RIGHT`, `AI_ACTION_GET_CLOSER`,
`AI_ACTION_SEEK_OPPONENT`, `AI_ACTION_SEEK_FRIEND`, `AI_ACTION_SEEK_NOISE`,
`AI_ACTION_RANDOM_PATROL`. Posture: `AI_ACTION_CHANGE_STANCE`. Combat:
`AI_ACTION_FIRE_GUN`, `AI_ACTION_TOSS_PROJECTILE`, `AI_ACTION_KNIFE_STAB`,
`AI_ACTION_RELOAD_GUN`. Social: `AI_ACTION_YELLOW_ALERT`, `AI_ACTION_RED_ALERT`.

### 4.2 Cover

- `FindBestNearbyCover` (ai.h:202) — best cover tile within search radius,
  scored by `CalcPercentBetter` (ai.h:168) against the current tile; only
  accepted if improvement ≥ `MIN_PERCENT_BETTER = 5` (AIInternals.h:89).
- `FindSweetCoverSpot` (ai.h:221), `FindSpotMaxDistFromOpponents` (ai.h:220),
  `FindBestCoverNearTheGridNo` (AIInternals.h:282).
- Cover quality predicates: `SightCoverAtSpot`, `ProneSightCoverAtSpot`,
  `AnyCoverAtSpot` (ai.h:321-323); `CalcBestCTGT` / `CalcWorstCTGTForPosition`
  (ai.h:274-276) are the A*-based cover-to-gun-target scores.
- `gsCoverValue` (ai.h:17) is the precomputed per-tile cover map.

### 4.3 Flank

`FindFlankingSpot` (FindLocations.cpp:2621) picks a tile on the opponent's flank
using `MinFlankDirections` (ai.h:293), `CountFriendsInDirection` (ai.h:294), and
`CountFriendsFlankSameSpot` (ai.h:298). Flank distance is clamped by
`MIN_FLANK_DIST_RED/YELLOW` and `MAX_FLANK_DIST_RED/YELLOW` (ai.h:416-419),
which derive from day/night vision range. `AICheckIsFlanking` (ai.h:314) is the
"am I already flanking" predicate used to avoid re-flanking.

### 4.4 Retreat

`FindRetreatSpot` (FindLocations.cpp:3373) finds a tile far from opponents
(uses `FindSpotMaxDistFromOpponents`); `RunAway` (AIInternals.h:269) executes
`AI_ACTION_RUN_AWAY`. Retreat is gated by the realtime combat posture flags
`RTP_COMBAT_AGGRESSIVE / CONSERVE / REFRAIN` (ai.h:129-131) and the legacy
`AI_RTP_OPTION_CAN_RETREAT` flag (ai.h:134).

### 4.5 Advance / fire-vs-advance

`FindAdvanceSpot` (FindLocations.cpp:3096) is the "move closer to firing range"
search, parameterized by `ADVANCE_SPOT_SIGHT_COVER / PRONE_COVER / ANY_COVER`
(ai.h:158-162). `AdvanceToFiringRange` (AIInternals.h:191) and
`RangeChangeDesire` (AIInternals.h:265) decide whether to close distance or
shoot from here. `CalcBestShot` (AIInternals.h:194) fills an `ATTACKTYPE`
(AIInternals.h:130-150) with the best fire solution (aim time, hit chance,
AP cost, stance, friendly-fire chance); the phase functions compare
`iAttackValue` against movement value to pick fire-vs-advance.

### 4.6 Stance

`StanceChange` (AIInternals.h:272) and `ShootingStanceChange` (AIInternals.h:271)
pick stand/crouch/prone based on the chosen attack's `ubStance` and cover
quality at the current tile.

---

## 5. Per-phase pseudocode

### 5.1 Green (no contact) — `DecideActionGreen` (DecideAction.cpp:691)

```
if schedule active            -> DecideActionSchedule
if NPC with scripted behavior -> DecideActionNamedNPC
if orders == STATIONARY       -> AI_ACTION_NONE (hold, maybe change facing)
if orders == ONGUARD          -> point patrol / scan
if orders == CLOSEPATROL/FARPATROL/POINTPATROL -> patrol to next point
if orders == SEEKENEMY        -> seek noise / random patrol toward likely enemy
else                          -> random patrol (RandDestWithinRange)
```

### 5.2 Yellow (heard something) — `DecideActionYellow`

```
if noise heard this turn:
  if noise is important (MostImportantNoiseHeard) -> AI_ACTION_SEEK_NOISE
  else -> AI_ACTION_YELLOW_ALERT (tell friends), then cautious patrol
if friend in trouble nearby   -> AI_ACTION_SEEK_FRIEND
else                          -> fall through to Green behavior
```

### 5.3 Red (evidence of opponent) — `DecideActionRed`

```
PrepareThreatlist()
if closest known threat is close & I have APs:
  if can shoot now (CalcBestShot.iAttackValue high) -> AI_ACTION_FIRE_GUN
  else if can toss grenade safely                   -> AI_ACTION_TOSS_PROJECTILE
  else if flanking is viable (FindFlankingSpot)     -> AI_ACTION_FLANK_LEFT/RIGHT
  else if cover is poor & FindBestNearbyCover better-> AI_ACTION_TAKE_COVER
  else if outgunned / low morale (CalcMoraleNew)    -> AI_ACTION_RUN_AWAY / WITHDRAW
  else                                              -> AI_ACTION_GET_CLOSER (advance)
if no APs for combat -> AI_ACTION_RED_ALERT (radio), stance change, end turn
```

### 5.4 Black (currently seeing opponent) — `DecideActionBlack`

Same shape as Red but with the *seen* threat list (`ClosestSeenThreatID`),
tighter flank/cover distances, and `AI_ACTION_CHANGE_STANCE` before firing.
`gfHiddenInterrupt` (DecideAction.cpp:43) is consulted for interrupt-triggered
re-decisions.

### 5.5 Special units

- `CreatureDecideAction` (CreatureDecideAction.cpp:1465) — prey seeking,
  `CreatureCall` (AIInternals.h:208) communication, spit/tentacle attacks.
- `ZombieDecideAction` (ZombieDecideAction.cpp:1269) — relentless advance,
  no cover/flank logic.
- `ArmedVehicleDecideAction` (DecideAction.cpp:7423) — turret/coaxial weapon
  selection, hull-down positioning.
- `CrowDecideAction` — seek corpse → peck → fly away (see CrowPlan, §7).

---

## 6. Difficulty scaling and interrupt hooks

### 6.1 Difficulty (ai.h:149-156)

`gbDiff[MAX_DIFF_PARMS][5]` is a 5-level table indexed by
`SoldierDifficultyLevel` (AIUtils.cpp:3002):

| Index | Meaning |
|---|---|
| `DIFF_ENEMY_EQUIP_MOD` (0) | equipment quality bonus |
| `DIFF_ENEMY_TO_HIT_MOD` (1) | enemy hit-chance modifier |
| `DIFF_ENEMY_INTERRUPT_MOD` (2) | enemy interrupt chance modifier |
| `DIFF_RADIO_RED_ALERT` (3) | whether enemies radio red alerts |
| `DIFF_MAX_COVER_RANGE` (4) | how far enemies will seek cover |

The browser port should keep this as a `difficulty[5][5]` table and apply the
same four knobs (equip, to-hit, interrupt, cover range) plus the radio flag.

### 6.2 Interrupt hooks

- `DIFF_ENEMY_INTERRUPT_MOD` scales enemy interrupt rolls (see doc 03 for the
  interrupt formula itself).
- `gfHiddenInterrupt` (DecideAction.cpp:43) — set when a hidden interrupt fires;
  the AI re-decides instead of continuing the previous action.
- `gTacticalStatus.fInterruptOccurred` (DecideAction.cpp:10353) — debug/log
  signal that an interrupt happened this tick.
- `AI_HANDLE_EVERY_FRAME` (ai.h:139) — flag forcing per-frame AI processing
  (used for pending actions); `AI_CAUTIOUS` (ai.h:138) throttles movement.
- `ACTION_TIMEOUT_CYCLES = 50` (AIInternals.h:87) — deadlock breaker: after 50
  failed cycles the AI forces `AI_ACTION_NONE`/end turn (`EndAIDeadlock`,
  ai.h:196).

---

## 7. ModularizedTacticalAI module roles

The refactor scaffold (namespace `AI::tactical`) wraps the legacy loop in
Composite + Abstract Factory patterns. It does **not** yet contain new decision
logic — every concrete plan re-dispatches to the legacy functions.

| Module | Role |
|---|---|
| `Plan.h` `Plan` | Abstract product. `execute(PlanInputData&)` + `done()`. Owns the NPC pointer. |
| `Plan.h` `PlanInputData` | Environment wrapper (turn-based flag + `gTacticalStatus` ref). |
| `PlanList.h` `PlanList` | Composite: deque of sub-plans executed in order; advances when `done()`. |
| `AbstractPlanFactory.h` `AbstractPlanFactory` | Abstract factory: `create_plan(npc, AIInputData)` / `update_plan(npc, input)`; delayed `initialize()`. |
| `AbstractPlanFactory.h` `AIInputData` | Event wrapper: auditive (noise) or visual (opponent seen) event data. |
| `PlanFactoryLibrary.h` `PlanFactoryLibrary` | Singleton registry mapping `bAIIndex` → factory; entry point from legacy code. |
| `LegacyAIPlanFactory.h/.cpp` | Concrete factory → `LegacyAIPlan` (the alert-status dispatch, §2.2). |
| `LegacyAIPlan.h/.cpp` | Wrapper/re-write of `DecideAction()` — the only plan with real logic. |
| `LegacyZombiePlan.h/.cpp` | Wrapper of `ZombieDecideAction()`. |
| `LegacyCreaturePlan.h/.cpp` | Wrapper of `CreatureDecideAction()`. |
| `LegacyArmedVehiclePlan.h/.cpp` | Wrapper of `ArmedVehicleDecideAction()`. |
| `CrowPlan.h/.cpp` | Real (non-legacy) plans: `CrowSeekCorpsePlan`, `CrowPeckPlan`, `CrowFlyAwayPlan`. |
| `NullPlan.h/.cpp` + `NullPlanFactory.h/.cpp` | No-op plan/factory; debugging and performance-baseline tool. |

**Port decision:** the browser port does not need the factory scaffold. Port the
dispatch switch (§2.2) directly; keep the `Plan`/`PlanList` idea only if you want
composable action sequences for scripted NPCs.

---

## 8. Determinism notes (seeded RNG)

- Two RNG entry points in `engine/sgp/Random.cpp`: `Random(n)` (live `rand()`)
  and `PreRandom(n)` (draws from a pre-generated table
  `guiPreRandomNums[MAX_PREGENERATED_NUMS]`, `Random.cpp:97-112`).
- `InitializeRandom()` (`Random.cpp:100-112`) seeds once with `time(NULL)` and
  fills the table. Under `BMP_RANDOM` (`Random.cpp:36-62`) it uses a
  `std::mt19937` seeded from `std::random_device`.
- **Save/load determinism:** `engine/Ja2/SaveLoadGame.cpp:8464` and `:9006`
  re-seed with `srand(sGeneralInfo.uiSeedNumber)` — the saved seed is restored so
  post-load AI rolls are reproducible.
- AI code uses `PreRandom` for decisions that must not desync (e.g.
  `AIList.cpp:227`, `CreatureDecideAction.cpp:286`) and `Random` for cosmetic /
  non-critical rolls. **Port rule:** use the seeded PRNG for anything that
  affects outcomes (hit rolls, flank choice, patrol destinations); use a
  separate unseeded stream for debug/visual noise.
- The browser port must expose `Random(n)` and `PreRandom(n)` as pure functions
  of a `seed` state so a save file can restore the exact RNG position.

---

## 9. Web worker / main-thread recipe

The decision loop is CPU-heavy (cover A* searches, threat lists) and must not
block rendering. Recommended split:

1. **Main thread** owns the authoritative game state (soldiers, tiles, LOS
   results, RNG seed). It runs `HandleSoldierAI`-equivalent guards and the
   alert-status transitions (`SetNewSituation`).
2. **Worker** runs the expensive per-soldier decision: `PrepareThreatlist`,
   `FindBestNearbyCover`, `FindFlankingSpot`, `FindAdvanceSpot`,
   `FindRetreatSpot`, `CalcBestShot`. Input: a snapshot of the soldier, the
   knowledge maps, and the cover grid. Output: one `{action, data, stance}`
   decision per soldier.
3. **Determinism across threads:** the worker must receive the current RNG
   state and return the *consumed* RNG state with each decision, so the main
   thread can advance the shared seed. Never let the worker call the global
   RNG directly.
4. **Batching:** process soldiers in chunks (e.g. 4-8 per frame) in turn-based
   mode; in realtime mode use the `REALTIME_AI_DELAY`-style pacing
   (AIInternals.h:58-60) so decisions are spread over time.
5. **Interrupts:** when the main thread detects an interrupt
   (`gfHiddenInterrupt` equivalent), it must invalidate the worker's pending
   decisions for the interrupted soldier and re-queue a re-decision.

---

## 10. Reproduction checklist

- [ ] `HandleSoldierAI` guards replicated: engaged-in-action, sighting pending,
      explosion queue, turn ownership, already-moved.
- [ ] Alert-status state machine (Green/Yellow/Red/Black) with
      `DecideAlertStatus` / `SetNewSituation` transitions.
- [ ] Dispatch switch routes on `bAlertStatus` exactly as
      `LegacyAIPlan::execute` (including `bBypassToGreen`).
- [ ] Knowledge model: per-soldier personal + team public grades, recency decay
      (HEARD_3_TURNS_AGO … SEEN_CURRENTLY), `KnownLocation`/`KnownLevel`.
- [ ] Threat list: `PrepareThreatlist` → `ClosestSeenThreatID` /
      `ClosestKnownThreatID`; `PERCENT_TO_IGNORE_THREAT` threshold.
- [ ] Cover: `FindBestNearbyCover` with `MIN_PERCENT_BETTER` gate; cover-quality
      predicates (sight/prone/any).
- [ ] Flank: `FindFlankingSpot` with min/max flank distance clamps and
      `AICheckIsFlanking` guard.
- [ ] Retreat: `FindRetreatSpot` / `RunAway`, gated by combat posture
      (AGGRESSIVE/CONSERVE/REFRAIN).
- [ ] Fire-vs-advance: `CalcBestShot` `iAttackValue` vs `FindAdvanceSpot`
      movement value; stance chosen via `StanceChange`.
- [ ] Difficulty: `gbDiff[5][5]` table applied to equip, to-hit, interrupt,
      cover range, and red-alert radio.
- [ ] Interrupt hooks: hidden-interrupt re-decision, `ACTION_TIMEOUT_CYCLES`
      deadlock breaker.
- [ ] Special units: creature, zombie, armed vehicle, crow branches.
- [ ] RNG: seeded `Random`/`PreRandom` split; save/load restores seed and RNG
      position; worker never calls global RNG.
- [ ] Worker/main-thread contract: snapshot in, `{action, data, stance}` out,
      RNG state returned with each decision.