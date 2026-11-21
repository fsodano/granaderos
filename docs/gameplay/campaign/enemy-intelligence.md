# Observed enemy movement reports

On the strategic campaign screen, the front panel and player-known state use the same observations. Launching an enemy group off-map does not publish its count, destination or arrival schedule. A route crossing still changes the real encounter and arrival rules, but it does not by itself reveal the enemy's orders. The journal keeps historical commanders and general doctrine as reference information; it does not predict active commands, targets or dispatch times.

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

## Limits

This covers persistent mobile groups. It does not add a scouting assignment, spies, false rumors, a full stationary-garrison intelligence model, or aerial reconnaissance. Force recruitment, strategic balancing and the campaign ending remain open.
