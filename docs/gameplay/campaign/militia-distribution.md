# City militia distribution

## Source and player choice

The original [JA2 manual, printed page 44](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)
describes moving militia between a town's sectors, either manually or with an
automatic equal distribution. *Patusco's JA2 Strategy Guide 1.3* (source `G` in
[the parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)),
pages 59–60, describes training, ranks and field treatment. These references do
not establish a classic tactical command menu. The separately listed
tactical-command audit item remains open; Granaderos implements the documented
strategic distribution choice on the strategic campaign screen.

Open **Sector → Distribuir milicias**. Choose the destination, rank and quantity,
then use **Trasladar defensores**. The same panel shows every connected friendly
garrison and an automatic forecast. **Distribuir de forma pareja** spreads the
available defenders and experienced ranks across those sectors. Once the result
is balanced, the automatic button is disabled.

## Campaign rules

- Transfers remain inside the existing operational city definition. Buenos Aires,
  Retiro and Ensenada form one city area in Granaderos. Other current cities have
  one strategic sector. This grouping and the 60-person limit are period-game
  adaptations, not claims about historical city boundaries or JA2's exact cap.
- The route must use connected, controlled sectors of that city. Waiting,
  engaged or stationed hostile groups make their sectors unavailable. A partially
  captured city can distribute defenders within its connected friendly area.
- A pending tactical deployment or strategic encounter blocks distribution.
  The player cannot remove a defending garrison during its battle.
- Distribution is immediate, like the town management operation in the manual.
  It does not spend money or advance the campaign clock. It does not send local
  militia on intercity campaigns.
- Stable wounded defenders may move without recovering health. Critical,
  bleeding, unconscious, sleeping, routed, surrendered or exhausted defenders
  remain at their current post. Training cohorts retain their separate custody.
  Both stationary patients and trainees occupy capacity in the automatic plan.
- The automatic plan shares veterans first, then regulars and rookies, while
  balancing total occupancy and retaining current posts where possible. A city
  without room for all existing reserves rejects automatic distribution; manual
  transfers can still relieve a sector with room elsewhere.

## Identity and supply custody

Every transferred defender retains their ID, health, fatigue, rank, combat credit,
weapons, fittings, inventory and typed ammunition. The next tactical entry uses
the destination's actual approach edge. Saved old-sector snapshots cannot add the
transferred soldier back to the source garrison.

A paid cohort can exist as rank counts before its first deployment. Distribution
creates only the individual records required for that move, through the same
initial equipment and finite ammunition allocation as deployment. Returning the
same soldiers does not allocate ammunition again. Empty ammunition stock produces
empty guns and no spare rounds. Existing count-only reserves above the deployment
limit can be moved without replacing their already recorded comrades.
