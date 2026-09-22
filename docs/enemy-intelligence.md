# Observed enemy movement reports

The front panel and player-known state now use the same observations. Launching an enemy group off-map no longer publishes its count, destination or arrival schedule. A route crossing still changes the real encounter and arrival rules, but it does not by itself reveal the enemy's orders. The journal keeps historical commanders and general doctrine as reference information; it no longer predicts active commands, targets or dispatch times.

## Observation rules

- A recruited, living, fit and awake soldier can observe their actual sector. Captured, unconscious, routed, surrendered, departed, deployed and traveling soldiers cannot scout. Both queued and direct travel exclude the marching soldiers. Health below 15 prevents scouting.
- A fit militia garrison in a patriot sector can observe that sector and its campaign-graph neighbors. Where personal garrison records exist, wounded/incapacitated and deployed records cannot be replaced by the aggregate count to grant observation. Additional count-only paid cohorts can scout before their first deployment.
- Observed mobile groups show their current living, non-departed force count. Stationed forces show presence without a count. A pending encounter or battle remains reportable even if no fit scout remains; contact alone does not grant an exact count.
- An actual undefended occupation produces a presence report, consistent with the existing territorial loss/blockade notice. It does not expose the occupying force's size.

Reports store only the observed sector, hour, source, movement/presence status and count (or unknown). They contain no future route, target, arrival time, soldier records or random seed. Hidden casualties and changed travel times cannot update a stale report. The public projection selects its fields explicitly, so a future private field is not exposed automatically.

## Persistence and loss of contact

The last observation stays visible when the observers leave. The interface identifies it as an old sighting and gives its age; the reported count belongs to that sighting, not a current estimate. Reports expire after 72 campaign hours without a new observation. Returning scouts can confirm that the old position is empty. A known tactical victory clears the corresponding report. Up to 128 reports persist in a save.

Old saves acquire an empty report ledger, rather than inventing past sightings. Current scouts and actual pending contact can still provide current reports. Save validation rejects malformed sources, sectors, counts, times, identities and extra report fields.

## Source and adaptation

[JA2 Stracciatella's map code](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Map_Screen_Interface_Map.cc), `WhatPlayerKnowsAboutEnemiesInSector` and `CanMercsScoutThisSector`, distinguishes exact counts, known presence and no knowledge. It excludes sleeping, badly hurt and traveling mercenaries from scouting, and conceals stationary garrison numbers. Granaderos retains that distinction but uses its larger campaign sectors and neighbor graph. The 72-hour saved-sighting lifetime and occupation notices are explicit adaptations; they do not copy JA2's permanent visited-sector presence rule.

## Evidence and limits

The final current-code suite passes **2,710/2,710 tests**, with no failures or skips, in 358.7 seconds. Type checking and production build pass.

Nine new simulation/save cases cover hidden dispatch, real hourly movement into militia observation, loss of contact, hidden-state changes, unavailable observers, direct-travel exclusion, stationed-force uncertainty, actual occupation, report expiry, legacy migration, corrupt records, known victory and read-only projection. Related enemy, crossing, projection and render checks pass in a 46-test run; the final 30-test intelligence, narrative, projection and render run also passes, including direct travel and the journal boundary.

Live isolated QA verified a current three-soldier militia observation in Salta, an old report aging from one to eight hours, reload preserving its original time, and an actual undefended occupation replacing it with unknown-strength presence at Tucumán. With the militia retained, the actual arriving group instead produced a stopped clock and the normal tactical/automatic defense choices. The browser's player-known state matched the stale visible report and exposed no route or ETA. A separate live journal check retained Pezuela, Tristán and Romarate as reference material without target or activity predictions.

This covers persistent mobile groups. It does not add a scouting assignment, spies, false rumors, a full stationary-garrison intelligence model, or aerial reconnaissance. Force recruitment, strategic balancing and the campaign ending remain open.
