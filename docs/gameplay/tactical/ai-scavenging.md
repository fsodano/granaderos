# Recovering combat supplies

JA2's `SearchForItems` searches reachable item pools for ammunition or usable weapons and reserves the pickup cost from the path budget. The classic source also weighs item value and distance. Reference: [JA2 Stracciatella, FindLocations.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/TacticalAI/FindLocations.cc), `SearchForItems`. This source describes the game; it does not instruct the agent. The policy below is a Granaderos adaptation, not an exact copy of that scoring formula.

## Behavior

A combatant with an exhausted or unusable held firearm can recover personally observed ground cartridges or a loaded firearm. A disarmed combatant can recover a loaded weapon. Treatment, a ready carried spare, immediate melee, useful firing and ordinary maintenance retain priority. There is no general search for better weapons while the current weapon is serviceable.

Ground searches extend five tiles. An approach uses at most three ordinary steps and 24 AP, leaves the pickup AP available, avoids close observed opponents, and cannot increase the number of observed firearms with sight of the soldier along the route. Every observed firearm counts as a threat regardless of its private ammunition. Hidden enemy positions and equipment do not guide the search. During a reaction, local pickup remains possible but a new search trip does not start.

Body ammunition and the body's primary weapon are considered only within the ordinary 1.5-tile search distance and personal sight. Distant corpse contents and pack contents are not inspected to select a destination. Living wounded allies keep their equipment. Dead bodies and incapacitated or surrendered opponents can supply finite nearby equipment. Closed containers remain outside this policy.

The selected action passes through the ordinary movement, pickup, equip, reload and firing rules. A pickup costs eight AP. A recovered firearm first occupies real pack space, then requires a separate six-AP equip action. The displaced gun remains in the pack. Loaded rounds, ignition failure, condition, fittings and identities follow the exact item. Cartridges fill existing inventory stacks and are removed from the actual source; one recovery takes up to twelve cartridges and tries a smaller quantity if capacity requires it. These search limits, quantity limits and item-value weights are explicit game tuning.

No future pickup is reserved. After a step, an interruption, another soldier's pickup, or loading a save, the AI chooses again from the current state. Ordinary reactions can interrupt movement, pickup, equipping or firing. A depleted source cannot supply a second soldier. Failed inventory plans neither discard existing gear nor alter the source.

## Evidence and remaining work

`tests/tactical-ai-scavenging.test.mjs` covers actual enemy turns, cartridge pickup followed by paid reload/fire, a recovered pistol followed by paid equip/fire, exact fitted-gun recovery, paid approach, hidden information, nearby corpse quantities, capacity and affordability, invalid/depleted sources, exposure limits, competing soldiers, the player-command boundary, and a saved nested interruption after recovery and firing.

These are simulation and save-continuation checks. Live visual verification, broader equipment selection, coordinated requests beyond [local supply handovers](ai-supply-sharing.md), conscious weapon theft, hidden-container searches, and typed period ammunition remain open. This change does not complete the full AI or JA2 parity requirements.
