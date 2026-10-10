# Connected sector roads and city travel

Local validation record, 9 October 2026. The road implementation merged through [PR #326](https://github.com/fsodano/granaderos/pull/326) at `b8b14e2d544cec16535edbb26624ef80ac502720` and is included in main `462abba277a47dafbfed1f60fc4529c8a4721cdc`. The dated checks below retain their original scope and failures. They do not establish a passing full campaign gate or full JA2 parity.

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

Documentation and whitespace checks passed for that follow-up. Its test partition included all 922 then-current files exactly once. A separate read-only review found no material road-planning, map-control, city-cost, or saved-journey issue. Its production source identity remained `8476681dc25a` after the fixture-only commits.

## Later local reliability checks

The later local source `c32f9baede2f` retains the roads and adds corrections found by the broader audit. Incoming money preserves finite source custody at the treasury cap, and native unpaid victory funds retain strict saved source evidence. Resident positions persist when a different squad visits the same sector. Sight uses the same physical heights on flat and elevated maps, and ordinary wall clicks use the visible face. Observed stone reflections retain their exact public path without letting concealed adjacent objects alter that path. Loose blades use the pinned engine's usable condition threshold and impact scale; their deterministic contact wear remains a declared Granaderos rule. Empty-hand weapon pickup is unchanged.

On that source, seven road and map files passed all 61 tests in 11.97 seconds. Eight projectile and sight files passed all 75 tests in 2.51 seconds. Treasury, resident-position and roof-defense files passed all 12 tests in 7.51 seconds. None skipped. Type checking and the production export passed, with 1,377 static files and 1,045 asset references. Partition checks assign all 927 current files once, and the five shard self-tests pass. The C++ specification and fifteen unchanged Python checks also pass; the Python checks used the primary checkout's existing pinned engine data because the isolated worktree has no engine data.

The complete current southern-opening diagnostic passed its first three subtests: finite San Lorenzo supplies, paid Córdoba recovery and victory, and the real Tucumán defeat with permanent deaths and captivity. Rescue staging then failed when its actual replacement force had five people rather than six. Three later subtests skipped. The aggregate is three passes and two failures, including the parent failure, in 161.96 seconds. This is not a completed campaign route. Earlier saved suffix victories cannot establish this new starting cohort's complete route.

Later preparation orders fill the sixth relief position through a real quoted day contract after finite care. The twelve departing relief soldiers each retain ten matching cartridges recovered from actual local sources. Their existing local bronze gun retains its exact load and reserve. This correctly supplied force still retreats in native combat: 29 turns, 273 actions and 3,801 seconds. Exact replay and save checks preserve thirteen subsequent deaths and two captures. Review of the cannon orders found actual crew AP and routing limits, without an established engine error. This bounded result is not a successful rescue or a passed opening route.

The created northern route now reaches actual Córdoba and Tucumán victories with paid replacement arrivals and finite care. A public search and visible conversation with the Buenos Aires port representative activate normal future income, with no immediate cash credit. The funded route also reaches its native Tucumán victory using a recovered local bronze gun, while retaining all thirteen serving members through preparation. A later return journey leaves four fit defenders at Tucumán; their native response loses in eight turns and 187 seconds. Its exact replay preserves two deaths, two captures and the returning patients' healthy state and journey. Further route preparation remains under review.

The corrected paid roof-staging check passes its native unload and reload case without counting a loaded cartridge twice. The torch-motion rendering check also passes. Each check has one test and no skips; these are focused checks on the same production source, not a full campaign gate.

The [retained local checks and output](../evidence/local-reliability-2026-10-09/checks.json) distinguish these exact-source focused passes from the opening failure and the earlier mixed-input quick diagnostic. Long campaign fixture work remains open. No unchanged full 927-file pass or published result is claimed.

The unchanged full 927-file run now completed on `5f3ee12b`, production source `c32f9baede2f`: 6,957 passed, 10 failed, and 3 skipped. The before and after input digests match across 11,788 files. Seven files failed: the coastal, Cuyo, historical-loss, ending, funded-recovery, opening-playthrough, and partial-reload controls checks. The [frozen full-run summary](../evidence/local-reliability-2026-10-09/full-frozen-summary.json) retains the exact counts, file results, and input identity. This is a complete diagnostic and does not pass the release gate.

## Limits

The atlas and roads are a schematic campaign adaptation. Organized postas, carts, and flotillas retain their locality transport networks. Named assault approaches retain their existing staging rules. The full campaign gate still has the route-fixture and native-combat limits recorded above. This work does not establish full campaign balance or full JA2 1.13 parity.
