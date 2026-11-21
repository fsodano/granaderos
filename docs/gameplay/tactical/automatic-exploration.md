# Automatic return to exploration

When two complete turn-based combat rounds pass without visual contact on either side, the tactical session returns to real-time exploration (parity row [T02](../../requirements/ja2-parity.md)). A sighting at any point in a round resets the delay, even if the target leaves sight before the round ends. The round containing the last sighting does not count as a quiet round. Anonymous sound keeps its existing investigation history but does not prolong turn-based combat by itself.

The return waits for the complete enemy and local militia phases. It cannot occur inside an interrupt or unfinished autonomous queue, or while a routed unit still needs to leave. Enemy-first initiative counts complete rounds without accidentally triggering a ten-minute exploration rest at the transition. The saved `quietCombatTurns` and `contactThisRound` fields retain the delay and are validated.

The transition does not change ammunition, health or ownership. Ordinary end-turn AP and energy recovery still happen once. Exploration movement spends energy and time without subtracting AP. Seeing an active opponent starts combat again and stops the movement on the observed tile. Unseen opponents remain present and the sector is not marked cleared. Existing post-victory reporting remains available before exploration and looting.

There is no separate **Volver a explorar** control; the return is automatic. The selected soldier readout says **Sin coste de PA** during exploration. Main action controls, held equipment, reload previews, target AP and artillery loading help reflect the free AP cost. Tactical work still consumes time and its finite supplies.

## Scope boundary

The return from combat changes only the transition and its user interface. The initial mode requested for a hostile deployment is unchanged, so an assault still opens under the existing hostile-entry rules. Exploration-first world entry is not part of this behavior.
