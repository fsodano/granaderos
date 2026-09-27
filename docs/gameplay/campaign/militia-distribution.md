# City militia distribution

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

## Source and player choice

The original [JA2 manual, printed page 44](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)
describes moving militia between a town's sectors, either manually or with an
automatic equal distribution. The supplied Patusco guide, pages 59–60, describes
training, ranks and field treatment. These references do not establish a classic
tactical command menu. The separately listed tactical-command audit item remains
open; this change implements the documented strategic distribution choice.

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

## Verification — 21 September 2026

Eleven simulation/save tests and two render tests cover manual and automatic
orders, exact custody, actual paid training, finite initial supplies, triage,
training reservations, connected ownership, destination capacity, malformed
orders, old-sector reentry and automatic idempotence across twelve varied rank
mixes. The tests use a declared established-area fixture; they do not prove a
fresh campaign victory or general campaign balance. All 30 focused distribution,
training, promotion and render checks pass.

The live browser used a validated controlled import with twelve Retiro defenders.
One veteran had 30/85 health. The player controls moved that veteran to Ensenada;
the destination's Personal panel retained the wound. Reloading and continuing
retained Retiro's eleven defenders and Ensenada's veteran. Automatic distribution
then produced two cívicos, one montonero and one veteran in each of Buenos Aires,
Retiro and Ensenada. The clock remained at hour zero and the treasury at 3,200
pesos. Entering three rookies when only two were available disabled the transfer
and showed the reason. The final control layout was inspected at 1280 × 720.

The integrated suite passes **2,649/2,649 tests with no skips** in 264.7 seconds.
The final 30-check focused run also covers the later control-spacing and type
narrowing corrections. Type checking, production build and diff checks pass.
All 49 unrelated files in the preservation snapshot remain unchanged.
