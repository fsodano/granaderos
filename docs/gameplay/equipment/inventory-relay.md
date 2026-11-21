# Passing items through adjacent soldiers

In tactical exploration and turn-based combat, a soldier can transfer inventory items to a non-adjacent ally through an unbroken chain of adjacent squad members. The JA2 manual, printed page 23, describes inventory transfers through a chain of adjacent mercenaries. [Primary reference](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf).

## Player controls

Use the existing inventory panel: choose an item, quantity, and recipient. A connected recipient shows **Pasar por aliados**, the total AP cost, and the route with each soldier's cost. There is no separate tactical action menu for relays.

An adjacent handover takes priority. Otherwise, the preview finds the shortest valid chain, with stable soldier-ID ordering for equal routes. If no chain is available, the existing throw can still be selected within six tiles and line of sight. Its catch chance and separate recipient cost remain visible. A confirmed order carries its transfer kind and route; a changed route cannot silently become a risky throw.

## Granaderos adaptation

- Each sender, including every intermediate soldier, pays 4 AP. The final recipient pays no catch AP. Exploration spends one second per handover without spending AP.
- Each connection requires adjacency, sight, and an unobstructed neighboring step. Closed obstacles and blocked diagonal corners cannot link the chain.
- Intermediate soldiers must be conscious, present, able to handle inventory in the current turn or interrupt, and able to receive the exact stack within inventory capacity. A hired soldier cannot spend an autonomous militia soldier's AP by using them as a helper.
- The complete relay is one atomic inventory action. Preflight checks the whole route and ownership before any item or AP changes. Intermediates lower their weapons, but keep their own equipment. The selected stack moves exactly once from source to recipient. The ordinary action clock and reaction processing then run; there are no persisted, partially completed handovers.
- Loaded barrels, unfinished loading work, condition, jams, identities, and fitted bayonets remain attached to the relayed weapon. A helper's similar weapon cannot replace the selected one.

The AP scale, capacity rules, geometry, atomic relay policy, six-tile throw range, and catch formula are period-game tuning. They are not claims about JA2's exact internal formulas.
