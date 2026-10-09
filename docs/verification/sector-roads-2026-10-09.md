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

Focused route, contact, entry, map-control, equipment, and clock regressions passed. Type checking and the documentation and baseline audits passed. The production export identifies source `44d6dd636fd8`.

The frozen-source full run selected all 920 test files and completed 6,925 tests in 19 minutes 32 seconds: 6,910 passed, 15 failed, and none were skipped. All road, entry, save, rendering, and character-source checks passed. The failures were in campaign fixtures: old travel-time assumptions, incomplete retained-body reports, repair orders against current equipment, finite supply preparation, and native combat policies. Follow-up results are recorded after those fixtures are stable; this full run alone is not a green campaign gate.

The combined follow-up of fourteen militia, artillery, and authored post-campaign files passed all 84 tests in 86.77 seconds. It covers the six failed cases from those groups, including the unchanged abandoned cannon's native recapture and exact reserve, all ten callers of the corrected militia encounter fixture, finite care and repair, and saved soldier states.

The C++ black-powder assertions passed. The fifteen Python data and image-format tests passed using the existing primary checkout's upstream game-data fixtures. The checked Python tools, native rules, and packaged assets are unchanged by the road work.

A related report correction admits actual finite first aid for a retained critical enemy casualty. Reports must retain all prior bodies and exact identities; corpse supplies cannot fund invented healing, and dead enemies cannot be revived. The six military-remains tests passed in the full run, including native care and atomic rejection of invalid reports.

The visible strategic map was checked in Chrome. The roads remain visible through district fills, and the map explains the one-hour city cost and waypoint detours. The [local map picture](../evidence/sector-roads-2026-10-09/map-roads.jpg) is available without a remote image request.

## Limits

The atlas and roads are a schematic campaign adaptation. Organized postas, carts, and flotillas retain their locality transport networks. Named assault approaches retain their existing staging rules. This work does not establish full campaign balance or full JA2 1.13 parity.
