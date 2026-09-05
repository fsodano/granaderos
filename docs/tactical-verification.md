# Tactical simulation verification

Verified on 2026-09-05 against the JavaScript engine used by the browser.

```sh
node --test tests/tactical-web.test.mjs tests/battle-integration.test.mjs
```

Result: 19 passing tests. These include two complete strategic/tactical integrations. Neither test inserts a victory, edits enemy health, gives extra ammunition, or bypasses tactical action validation. Each starts with `initialCampaign`, requests the opening San Nicolás attack through `dispatchCampaign`, constructs the battle from the actual issued squad, and submits the resulting tactical status and survivors to `battleResult`.

## Winning transcript

Seed 1812. The initial squad is Cabral (ID 3), Dorrego (ID 4), and Paroissien (ID 10). Dorrego opens with an aimed shot, the enemy takes its turn, and a deterministic action policy then uses healing, mounted movement, weapon reach, and charges. The replay independently produces byte-equivalent battle state.

Outcome: **victory**, turn **2**, **7** accepted player actions.

| Operative ID | Health | Loaded rounds | Reserve rounds |
|---|---:|---:|---:|
| 3 | 96 | 0 | 0 |
| 4 | 84 | 1 | 8 |
| 10 | 72 | 1 | 9 |

The campaign issued 20 cartridges; 19 return, demonstrating consumption of an actual shot. The victory adds the specified 80 captured cartridges. Ownership changes to Patriot control, each numeric operative ID receives its actual tactical health, the pending battle clears, and campaign serialization round-trips.

```text
Combate en San Nicolás de los Arroyos. Cada soldado dispone de 100 puntos de acción.
Manuel Dorrego hiere a Realista 1: 44 de daño.
Realista 1 avanza (96 PA).
Realista 2 avanza (96 PA).
Realista 3 avanza (96 PA).
Realista 1 pierde 3 de salud por hemorragia.
Turno 2: ¡órdenes, comandante!
Juan Bautista Cabral monta a caballo.
Juan Bautista Cabral hiere a Realista 1: 50 de daño.
Juan Bautista Cabral hiere a Realista 1: 50 de daño.
Realista 1 cayó en combate.
Juan Bautista Cabral hiere a Realista 2: 50 de daño.
Juan Bautista Cabral hiere a Realista 2: 50 de daño.
Realista 2 cayó en combate.
Juan Bautista Cabral hiere a Realista 3: 69 de daño.
Realista 3 pierde la moral y huye.
Realista 3 huye ante la carga.
Juan Bautista Cabral ejecuta una carga de 1 casillas con Bayoneta de Cubo.
¡Victoria! El enemigo abandonó el campo.
```

## Losing transcript

Seed 17, with no player orders and normal enemy turns, reaches defeat on turn 4. Cabral and Dorrego die (0 HP); Paroissien survives with 7 HP and routes. Submitting those actual results leaves San Nicolás Royalist, records both deaths against numeric operative IDs, and preserves the survivor's wounds. This verifies that the tactical engine can defeat the opening force and that defeat persists in the campaign.

## Defects corrected during review

- Exposed charges previously crossed the entire opening map without a defensive response. Loaded defenders now perform one reaction shot per turn when an approaching unit enters a clear, useful firing line within eight tiles. Reaction shots consume cartridges and reserved AP; smoke can prevent them.
- A combatant killed during an interrupted charge no longer completes the attack or damages its intended target.
- Enemy AP no longer refreshes both immediately after its action phase and again before its next phase. Reaction fire therefore uses remaining or reserved AP.
- Charge endpoints stop within the actual blade's reach; diagonal charges cannot cut blocked corners.
- Failed optional AI actions no longer leave a player-facing `lastError` after ending a turn.

## Scope

These are headless engine and campaign checks, not screenshots or browser interaction evidence. UI event wiring, rendering, audio, and save-file controls require separate browser verification. The original transcripts above used the earlier common test battlefield. The current browser now uses fourteen authored maps from game/maps.js, tested separately for connected deployments, blocked footprints and terrain chokepoints. These original transcripts do not establish the balance of those newer maps. Reaction fire is a bounded rule, not a complete recreation of JA2's interrupt initiative system.

## Expanded rules verification

Additional suites cover custom doctrines, finite priming/flints/rations, operative command bonuses, distinct melee reactions and blunderbuss cone fire. Save tests use an authored map, perform an actual move, reload the envelope and compare the next enemy turn for determinism. See the current test output for totals; the historical transcripts above are retained as evidence of the earlier milestone rather than claimed to be current balance results.

## Operative profile audit — tactical implementation

The following effects are implemented against stable historical operative IDs. Listed health and skill attributes remain unchanged. Quantitative bonuses below are explicit game tuning where the specification describes an advantage without assigning a number.

| Operative | Verified tactical effect | Limits |
|---|---|---|
| Martín Miguel de Güemes (0) | Mounted mud movement costs 5 AP instead of the ordinary 8. | Regional strategic scouting and horse administration are outside this tactical audit. |
| Juana Azurduy (1) | Living friendly militia within four tiles retain a minimum 20 morale and do not route from a hit. | Does not protect enemies or distant formations. |
| Fray Luis Beltrán (2) | Nearby reload and artillery operation costs receive a 20% reduction. | Actual crew counts and ammunition are still required. |
| Juan Bautista Cabral (3) | Adjacent commander projectile interception costs 8 AP, once per turn; bounded cold-steel counterattack. | Requires a living guard with more than 25 HP and available AP. |
| Manuel Dorrego (4) | Standing movement costs 6 AP; carbine/standard-pistol fire costs 2 fewer AP. | Does not reduce prone movement or blunderbuss firing costs. |
| Guillermo Brown (5) | Artillery fire costs 15% less AP; canister damage increases 15%. | Solid-shot trajectories are resolved geometrically, not through an artillery accuracy roll. |
| Hipólito Bouchard (6) | Adjacent adobe/wood breaching costs 25 AP instead of 45; night accuracy penalty is 5 instead of 20; blunderbuss cover penalty is halved. | Cannot hand-breach stone, cliffs, or water. Night effects require `sector.night`, `weather.night`, or a supplied night hour. |
| Lorenzo Barcala (7) | Friendly infantry within four tiles resists routing; artillery reload costs 20% less and solid shot receives one additional penetration allowance. | Cavalry does not receive the infantry morale protection. |
| Macacha Güemes (8) | Uses her supplied scouting/medical/combat attributes. | No additional tactical power was invented; her specified intelligence and diplomatic role belongs to the campaign layer and is outside this audit. |
| Facundo Quiroga (9) | A mounted charge reduces nearby opposing militia/levy morale by 25, potentially causing additional routs. | Applies within four tiles to flagged levies/militia or troops with marksmanship below 60; commander morale protection remains effective. |
| James Paroissien (10) | Stabilization costs 18 AP instead of 25 and uses his actual medical attribute to restore health. | Does not resurrect casualties; the simulation has no permanent attribute-decay subsystem. |
| José María Paz (11) | Nearby accuracy +8; defensive interrupt initiative +25 and detection envelope increases from eight to ten tiles. | Available AP, line of sight, smoke, loaded ammunition and one-interrupt-per-turn limits still apply. |
| José de San Martín (57) | Nearby accuracy +12, morale protection, interrupt initiative +50/range twelve, and mounted charge damage +20%. | Strategic mountain travel-fatigue elimination must be verified in the campaign layer separately. |

`tests/operative-profiles.test.mjs` exercises real constrained-budget orders, an incoming morale-breaking hit, a multi-unit mounted intimidation event, actual interruption order, and comparative mounted charges. Additional existing tests cover the earlier operative effects. This is an engine audit; browser presentation of bonuses is independently verified by the UI owner.

New UI contract: `{type: 'breach', unitId, x, y}` targets an adjacent destructible blocked tile. `actionCosts(battle, unit)` now also reports `heal` and `breach`. Battle state preserves `night`, `enemyCommand`, and `objective` from the request for presentation; this does not imply those strings have been displayed in the browser.

## Period lighting and nighttime visibility

The lighting implementation follows the separation of transient light position, radius, duration and age in [Stracciatella LightEffects.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/1c7149ca64e69c9d71b86dd03535d266c4765367/src/game/TileEngine/LightEffects.cc), particularly `NewLightEffect` and effect aging. This is a JavaScript rules implementation, not copied C++ renderer code. Modern chemical lights are not included.

Battle requests can contain `lights: [{id, type: 'campfire'|'lantern', x, y, radius, intensity}]`; omitted duration makes these static. `{type:'throwTorch', unitId, x, y}` consumes one finite torch, costs 10 AP in combat, travels at most eight tiles along an unobstructed line, and creates a four-tile light for eight turns (four in heavy rain). Time advances through the same turn/rest function in exploration. Expired lights are removed. Legacy inventories default to two torches.

`tileIllumination(state,x,y)` returns 0–1 light intensity with distance falloff and wall occlusion. `canSee(state,unit,target)` and `visibleTiles(state,unit)` apply observer line of sight and smoke. Darkness permits six tiles; `night_vision_basic` adds one and `night_vision` adds two. Bouchard also gains two nighttime tiles. An illuminated target beyond the dark limit can be seen up to sixteen tiles away, so throwing a torch can reveal a hostile and trigger turn-based contact. Lighting reduces the existing nighttime accuracy penalty.

Four new tests verify darkness versus thrown-light reveal, wall occlusion, exact Night Vision range bonuses, finite inventory, and expiration while static lanterns remain. Burning terrain and fire propagation are not simulated by these light sources.
