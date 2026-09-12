# Automatic return to exploration

Following the user's 2026-09-12 clarification, two complete combat rounds without visual contact on either side now return to exploration automatically. A sighting at any point in a round resets the delay, even if the target leaves sight before the round ends. The round containing the last sighting does not count as a quiet round. Anonymous sound keeps its existing investigation history but does not prolong turn-based combat by itself.

The return waits for the complete enemy and local militia phases. It cannot occur inside an interrupt or unfinished autonomous queue, or while a routed unit still needs to leave. Enemy-first initiative counts complete rounds without accidentally triggering a ten-minute exploration rest at the transition. The saved `quietCombatTurns` and `contactThisRound` fields retain the delay and are validated.

The transition does not change ammunition, health or ownership. Ordinary end-turn AP and energy recovery still happen once. Exploration movement spends energy and time without subtracting AP. Seeing an active opponent starts combat again and stops the movement on the observed tile. Unseen opponents remain present and the sector is not marked cleared. Existing post-victory reporting remains available before exploration and looting.

The separate **Volver a explorar** control is removed. The selected soldier readout says **Sin coste de PA** during exploration. Main action controls, held equipment, reload previews, target AP and artillery loading help reflect the free AP cost. Tactical work still consumes time and its finite supplies.

## Verification — 2026-09-12

All **1,431 tests**, type checking, production build and whitespace checks pass. Five new focused cases cover retained quiet turns, a sighting within a round, enemy-first initiative, corrupt counters and free AP previews/reloading. Existing contact, HUD, artillery and handheld loading cases now use the new rule. Loading tests that specifically require several combat turns keep an actual visible observer behind movement-blocking, sight-transparent terrain. The full actual northern campaign route continues to pass for the current deployment rules.

In a separate browser harness using the production Battlefield and reducer, turn one remained combat; a validated tactical save/restore retained that first quiet turn. Finishing the second round changed the mode to exploration without a separate button. Moving two tiles reduced energy from 85 to 83 while retaining 116 AP. A separate free-exploration approach moved from x=2 to x=8, spending energy without AP; sight of the sentry at x=24 began combat immediately. The harness never accessed the user's campaign save. Exact clock-at-transition checks are automated; live ambient exploration ticks continued before the browser pause.

## Next boundary

This commit changes the return from combat and its UI. It does not change the initial mode requested for a hostile deployment. An experiment starting all world entries in exploration passed direct contact and save checks, but changed the opening campaign casualties and invalidated the existing fixed recovery route. That world-entry change is not included here. It needs a revised actual campaign continuation, with real casualties and finite supplies preserved, before being delivered. It must not be claimed complete from the quiet-round demonstration.
