# Established southern campaign through Yatasto

Checkpoint verified against `fede464` on 12 September 2026. The subsequent `d90e52b` building-footprint update changes the earlier battles: the first recovery step now lacks its expected field dressings, and this full northern route is not yet reverified on those maps. Concurrent elite-contract price changes also invalidate the old route budget. This scenario starts with Buenos Aires and Ensenada already secured through the explicit `secureArea` test fixture. It is **not** a full playthrough from the new Retiro-only start. That start and the first earned Buenos Aires capture have separate tests; see [Retiro opening](retiro-start.md).

| Battle | Turns | Orders | Result |
| --- | ---: | ---: | --- |
| San Nicolás | 14 | 149 | Victory |
| San Lorenzo | 7 | 107 | Victory |
| Córdoba | 11 | 83 | Victory |
| Tucumán, first attack | 6 | 78 | Defeat: four deaths and two captives |
| Tucumán, rescue | 1 | 19 | Victory and release |
| Salta, joint assault | 6 | 147 | Victory; operative 135 dies |

These are observations from this run, not required combat balance. Each battle repeats deterministically from the same request and saved sector. The verifier checks its actual result, elapsed clock, permanent deaths, custody, finite equipment and save/load behavior. It does not require a previously wounded person to be wounded again or a previous casualty to die again.

## Recovery and captivity

The opening ends at hour 42, second 419. Paid medical care consumes 18 dressings before the northern squad departs. Córdoba falls at hour 84, second 589. Paid contracts, seven purchased dressings and six hours of rest prepare the next march.

The first Tucumán battle ends at hour 102, second 736. Operatives 1000, 112, 128 and 142 die. Funes (115) is captured at 5 HP without bleeding; Arnaud (105) is captured at 13 HP with 4 bleeding. The campaign removes them from active squads and pauses their contracts while retaining their wounds and equipment.

The paid rescue force reaches the persistent garrison at hour 126. Enemy injuries and elapsed time remain in effect. It wins in one turn, at second 742, and releases both captives. Farías (145) survives this version of the rescue. The script does not manufacture his death or the dressings that an older run left on the ground. One hour of actual care stabilizes the freed patients.

## Finite supplies and Salta

There are no recovered dressings in the current rescue field. The doctor starts with carried supplies. A separate medical courier travels to Córdoba, buys 30 dressings for 900 pesos, and brings them back. Other present soldiers donate four real dressings as treatment exhausts supplies. Patients recover and rest through hour 176. Contracts are renewed through ordinary paid actions.

Two paid squads stage a daylight arrival and attack Salta together at hour 204. They win at second 1122. Operative 135 dies; 105, 106, 109 and 147 survive with critical wounds. The final care step selects the actual healthy, supplied doctors: 122, 132 and 143. Three dressings stop the bleeding and begin recovery. It does not assign the critically wounded Harcourt (109) as a doctor.

Doctor 122 then travels to the Yatasto meeting after the paid northern pact. Other survivors remain in Salta, where available medical care continues. Phase 3 is reached at hour 217, second 1211, with 2,008 pesos and nine permanent deaths: 107, 110, 112, 114, 128, 135, 137, 142 and 1000.

## Verification boundary

`tests/opening-playthrough.test.mjs` runs this complete scenario. Its route helpers issue ordinary campaign and tactical orders, preserve source states, repeat battles, and encode/decode checkpoints. Captives retain their exact property and unused contract time on release. Revisiting field equipment removes finite quantities and rejects stale requests. Dead soldiers remain dead.

The previous test stopped at a stale five-turn expectation for Tucumán. Replaying the unchanged committed version confirmed that failure before the campaign inventory changes. Continuing the actual result exposed stale assumptions about a dead supply donor and the identities of wounded people and doctors. The updated verifier retains the gameplay requirements while using the current outcomes.

This establishes the route from the stated southern scenario through Yatasto. General balance, a complete Retiro-only campaign, and later routes through the mountain passes and ending remain open. Earlier Mendoza/Cuyo reports are historical checkpoints and are not reverified by this run.
