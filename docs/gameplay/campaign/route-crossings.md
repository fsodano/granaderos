# Opposing routes and arrival contact

A squad moving north from Tucumán to Salta can now intercept a real enemy column moving south from Salta to Tucumán. The two forces do not pass through each other. The enemy arrival is delayed, and contact occurs in Salta when the player enters it. The battle uses that column's existing soldiers, wounds, weapons and ammunition.

## Classic behavior and adaptation

The JA2 Stracciatella source delays an enemy arrival when a player group crosses its path (`DelayEnemyGroupsIfPathsCross`, called during movement and coordinated arrival scheduling). Its sector enemy count includes mobile groups at their departure sector until arrival. This implementation follows that sector-based contact model.

Sources: [Strategic_Movement.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Strategic_Movement.cc), [Queen_Command.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Queen_Command.cc), inspected 2026-09-11. The source uses a short randomized minute delay. Granaderos uses one campaign hour beyond the approaching squad's arrival, consistent with its current hourly strategic clock.

## Player behavior

- A moving squad delays an opposing group until the squad reaches its destination. The front report now requires actual [scouting information](enemy-intelligence.md); an unobserved crossing does not reveal the enemy schedule.
- An assault squad waits at the boundary. Waiting continues to hold the opposing route. Entering the sector commits the actual enemy group to the battle.
- Turning back removes that squad's hold. Another approaching squad can still hold the crossing. The enemy keeps the time already lost and resumes on its updated schedule.
- Normal travel stops at an enemy contact, including an intermediate waypoint. A squad that returns to an origin captured during its journey also receives an encounter decision.
- A return into an occupied sector does not grant use of its enemy-held fortifications. Victory over its last waiting or occupying group recovers the sector; defeat preserves enemy occupation.
- Saved games keep the revised enemy arrival times and existing squad journeys. The encounter is derived from these records; there is no replacement army. Player reports are stored observations, separate from the hidden travel schedule.

Only the northern axis currently has enemy routes between mapped sectors. Coastal and interior incursions start off-map, so they do not create fictitious crossings on surface roads. Their ordinary destination encounters still apply. Queued routes and the existing direct travel/attack API both prevent opposing routes from bypassing contact.

## Verification and remaining work

`route-crossings.test.mjs` covers real route progression, delayed and equal-time arrivals, a ready column waiting, reversals, a second column retaining the hold, remote intermediate-waypoint contact, a newly occupied return destination, direct orders, save recovery, finite enemy equipment, actual tactical withdrawal and an actual automatically played battle. A separately labeled scripted report verifies the sector-recovery ledger. Rendered React checks now verify that an unobserved crossing gives no report or arrival estimate, while nearby militia can report the actual observed sector and count.

Full strategic parity is still incomplete. [Observed intelligence](enemy-intelligence.md), [finite command reserves](enemy-reserves.md) and [initial arrival placement](sector-arrival-placement.md) now exist. A full reinforcement economy and reinforcements entering an already running tactical battle remain open. Exhaustion is handled after the current stage, consistent with the classic source; see [sleep and collapse](../characters/sleep.md). The crossing-specific browser interaction remains unverified; observed reports and ordinary contact choices have separate live evidence.
