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

These are headless engine and campaign checks, not screenshots or browser interaction evidence. UI event wiring, rendering, audio, and save-file controls require separate browser verification. The terrain generator currently uses a small common battlefield layout with biome-dependent surface/cover; it is not a historical authored map for every sector. Reaction fire is a bounded rule, not a complete recreation of JA2's interrupt initiative system.
