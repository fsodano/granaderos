# Opposing routes and arrival contact

On the strategic campaign map, a squad moving north from Tucumán to Salta can intercept a real enemy column moving south from Salta to Tucumán. The two forces do not pass through each other. The enemy arrival is delayed, and contact occurs in Salta when the player enters it on the tactical battlefield. The battle uses that column's existing soldiers, wounds, weapons and ammunition.

## Classic behavior and adaptation

The JA2 Stracciatella source delays an enemy arrival when a player group crosses its path (`DelayEnemyGroupsIfPathsCross`, called during movement and coordinated arrival scheduling). Its sector enemy count includes mobile groups at their departure sector until arrival. This implementation follows that sector-based contact model.

Sources: [Strategic_Movement.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Strategic_Movement.cc), [Queen_Command.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Queen_Command.cc). The source uses a short randomized minute delay. Granaderos uses one campaign hour beyond the approaching squad's arrival, consistent with its current hourly strategic clock.

## Player behavior

- A moving squad delays an opposing group until the squad reaches its destination. The front report requires actual [scouting information](enemy-intelligence.md); an unobserved crossing does not reveal the enemy schedule.
- An assault squad waits at the boundary. Waiting continues to hold the opposing route. Entering the sector commits the actual enemy group to the battle.
- Turning back removes that squad's hold. Another approaching squad can still hold the crossing. The enemy keeps the time already lost and resumes on its updated schedule.
- Normal travel stops at an enemy contact, including an intermediate waypoint. A squad that returns to an origin captured during its journey also receives an encounter decision.
- A return into an occupied sector does not grant use of its enemy-held fortifications. Victory over its last waiting or occupying group recovers the sector; defeat preserves enemy occupation.
- Saved games keep the revised enemy arrival times and existing squad journeys. The encounter is derived from these records; there is no replacement army. Player reports are stored observations, separate from the hidden travel schedule.

Only the northern axis currently has enemy routes between mapped sectors. Coastal and interior incursions start off-map, so they do not create fictitious crossings on surface roads. Their ordinary destination encounters still apply. Queued routes and the existing direct travel/attack API both prevent opposing routes from bypassing contact.

## Remaining work

Full strategic parity remains open. [Observed intelligence](enemy-intelligence.md), [finite command reserves](enemy-reserves.md) and [initial arrival placement](sector-arrival-placement.md) are available. A full reinforcement economy and reinforcements entering an already running tactical battle remain open. Exhaustion is handled after the current stage, consistent with the classic source; see [sleep and collapse](../characters/sleep.md).
