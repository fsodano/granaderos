# Connected sector roads and city travel

Local development evidence, 9 October 2026. The implementation is in the
`codex/blast-structures` checkout. This is not a published-main or full JA2 parity claim.

## Implemented behavior

- The sixteen campaign road links follow adjacent land cells. Roads cross shared edges, with no diagonal gaps or skipped cells.
- Foot and horse routes choose the fastest open physical path. Waypoints allow longer off-road detours. Enemy occupation, fatigue, contracts, and the normal clock still apply.
- Adjacent districts in the same city take one hour. This includes the Buenos Aires and Retiro districts. Anchor-to-anchor trips can cross more than one district.
- Rural roads take two hours per step on foot, compared with four hours off road. Mountain roads take four hours, compared with eight hours off road. Horses halve rural durations.
- Old saves keep the stored duration of their current leg. Fresh rural maps show only their connected road directions. Fresh landmark maps have passable approaches from adjacent land sectors. Authored core tiles and previously visited terrain remain intact.
- Ordinary travel and queued map travel use the same travel clock. A route can pause for actual exhaustion or contact.

## Evidence

`tests/sector-roads.test.mjs` checks the road network, default Buenos Aires–Córdoba road route, off-road waypoints, one-hour city arrivals, fractional progress, fatigue, saved journeys, horse compatibility, and seasonal closure. It also checks six soldiers entering every fresh landmark from each adjacent land cell, with the authored core and saved terrain unchanged.

The patrol case uses a real thirty-person enemy group from the finite interior reserve. It occupies San Nicolás at hour 6 and stops the previously queued road route. The squad cancels at its actual safe sector and takes a waypoint detour around every occupied San Nicolás district. The detour requires 55 hours of movement; actual rest brings arrival in Córdoba to hour 73. Enemy strength, the reserve debit, occupation history, and original enemy arrival time remain exact after saves.

Focused route, contact, entry, map-control, equipment, and clock regressions passed. Type checking and the documentation and baseline audits passed. After the departed-body correction below, the production export identifies source `8476681dc25a`.

The frozen-source full run for `44d6dd636fd8` selected all 920 test files and completed 6,925 tests in 19 minutes 32 seconds: 6,910 passed, 15 failed, and none were skipped. All road, entry, save, rendering, and character-source checks passed. The failures were in campaign fixtures: old travel-time assumptions, incomplete retained-body reports, repair orders against current equipment, finite supply preparation, and native combat policies. Follow-up results are recorded after those fixtures are stable; this full run alone is not a green campaign gate.

The final-source follow-up of fourteen militia, artillery, and authored post-campaign files passed all 84 tests in 64.99 seconds. It covers the six failed cases from those groups, including the unchanged abandoned cannon's native recapture and exact reserve, all ten callers of the corrected militia encounter fixture, finite care and repair, and saved soldier states. Five build-identity and character-source files also passed all 29 tests, with no skips, in 10 minutes 6 seconds.

The combined coastal-opening, created-opening, finite-equipment, and local-care follow-up passed all 13 tests, with no skips, in 3 minutes 36 seconds. The funded routes retain actual deaths, paid replacements, exact replay, and recovery of a fallen soldier's unique finite toolkit. The free local route now wins all three battles without losses; it preserves native wounds, actual San Nicolás care, and exact cohort, ammunition, and inventory through a saved revisit. No casualties or supplies are created to satisfy an earlier seed assumption.

The seven-file regional follow-up passed five of nine tests. Four routes reached the same obsolete officer-relief fixture purchase, which the target rules disable. The southern opening passed its first two subtests, including the actual Córdoba victory and finite care; staging then stopped for the real hour-150 clinic raid, and four dependent subtests skipped. Both checked defense policies lost in native combat. Those results are validation limits, not successful campaign completions.

Read-only inspection of the actual regional Tucumán victory confirmed that the officer-relief route cannot obtain its assumed swivel from a controlled finite arsenal. Its three recovered guns are bronze four-pounders; the swivel arsenal remains in enemy-held Ensenada. A remote critical casualty and the route's required fit support also need an earlier relief plan. That fixture remains unchanged; the inspection is not proof of a successful alternative route.

The visible-remains, ammunition, inventory, and care follow-up passed all 17 tests, with no skips, in 15.61 seconds. The recovery fixture uses public battlefield searches and ordinary hand orders to collect actual corpse dressings. Four native dressings plus one quoted, paid physician's two issued dressings restored the remaining Córdoba patient. Exact saved replay, source debits, treasury, and prior deaths remain checked. The complete funded recovery file passed the hospital defense, full Córdoba recovery, and Tucumán victory, then failed at a later fixture assigning doctor 123 with no dressings; its 6-minute-31-second run is not a green end-to-end gate.

The C++ black-powder assertions passed. The fifteen Python data and image-format tests passed using the existing primary checkout's upstream game-data fixtures. The checked Python tools, native rules, and packaged assets are unchanged by the road work.

A related report correction admits actual finite first aid for a retained critical enemy casualty. Reports must retain all prior bodies and exact identities; corpse supplies cannot fund invented healing, and dead enemies cannot be revived. The six military-remains tests passed in the full run, including native care and atomic rejection of invalid reports.

The longer native hospital route exposed a separate return-validation error: a dead departed soldier's recorded roof route was checked against a temporary flat scene. Validation now uses the saved source terrain and roof geometry. When the body actually arrives in another sector, only its new tactical clone loses the source movement paths; the raw custody record, saved source body, death, and finite equipment remain exact. The captured native battle report and full save passed an independent replay, while an unsupported roof point still rejected. The new native roof-departure tests and existing dimension tests passed all four cases. The final-source follow-up of twenty-two road, entry, roof, return, and save files passed all 161 tests, with no skips, in 30.19 seconds.

The visible strategic map was checked in Chrome. The roads remain visible through district fills, and the map explains the one-hour city cost and waypoint detours. The [local map picture](../evidence/sector-roads-2026-10-09/map-roads.jpg) is available without a remote image request.

Final documentation and whitespace checks passed. Test partition checks include all 922 current files exactly once. A separate read-only review found no material road-planning, map-control, city-cost, or saved-journey issue. The final production source identity remains `8476681dc25a` after the fixture-only commits.

## Limits

The atlas and roads are a schematic campaign adaptation. Organized postas, carts, and flotillas retain their locality transport networks. Named assault approaches retain their existing staging rules. The full campaign gate still has the route-fixture and native-combat limits recorded above. This work does not establish full campaign balance or full JA2 1.13 parity.
