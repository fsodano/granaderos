# Migration slice notes

This index links to all 62 migration slice notes. Each note records its
rationale, scope, and compatibility contract. The
[overview](../overview.md) describes current source and remaining requirements.

[Migration plan](../plan.md) · [Migration overview](../overview.md)

| Slice note |
| --- |
| [1. Plan and orientation](01-plan-and-orientation.md) |
| [2. Canonical transaction](02-canonical-transaction.md) |
| [3. Browser composition](03-browser-composition.md) |
| [4. Use-case contracts](04-use-case-contracts.md) |
| [5. Compatibility aliases](05-compatibility-aliases.md) |
| [6. Random source](06-random-source.md) |
| [7. Interface public entry](07-interface-public-entry.md) |
| [8. Campaign compiler](08-campaign-compiler.md) |
| [9. Game snapshot](09-game-snapshot.md) |
| [10. Weapon readiness](10-weapon-readiness.md) |
| [11. Resident position reference](11-resident-position-reference.md) |
| [12. Unarmed combat](12-unarmed-combat.md) |
| [13. Sleep need](13-sleep-need.md) |
| [14. Held supplies](14-held-supplies.md) |
| [15. Projectile energy](15-projectile-energy.md) |
| [16. Firearm loads](16-firearm-loads.md) |
| [17. Study rate](17-study-rate.md) |
| [18. Route queue](18-route-queue.md) |
| [19. Firearm serviceability](19-firearm-serviceability.md) |
| [20. Kinetic impact](20-kinetic-impact.md) |
| [21. Combat balance](21-combat-balance.md) |
| [22. Combat journal](22-combat-journal.md) |
| [23. Fatigue and energy](23-fatigue.md) |
| [24. Interior visibility](24-interior-visibility.md) |
| [25. Strategic clock](25-strategic-clock.md) |
| [26. Tactical space](26-tactical-space.md) |
| [27. Interior visibility helpers](27-interior-visibility-helpers.md) |
| [28. Shot range](28-shot-range.md) |
| [29. NPC perception](29-npc-perception.md) |
| [30. Care composure](30-care-composure.md) |
| [31. Game import boundary](31-game-import-boundary.md) |
| [32. Perception consolidation](32-perception-consolidation.md) |
| [33. Session random source](33-session-random-source.md) |
| [34. Retire hiring arrivals](34-retire-hiring-arrivals.md) |
| [35. Session clock](35-session-clock.md) |
| [36. Strategic clock timeline](36-strategic-clock-timeline.md) |
| [37. Sector session field](37-sector-session-field.md) |
| [38. Sector entry request field](38-sector-entry-request.md) |
| [39. Force roster field](39-force-roster-field.md) |
| [40. Characters field](40-characters-field.md) |
| [41. Retained snapshot fields](41-snapshot-fields.md) |
| [42. Sector entry request type](42-sector-entry-request-type.md) |
| [43. Retire the compile adapter](43-retire-compile-adapter.md) |
| [44. Suspended snapshot compaction](44-suspended-snapshot-compaction.md) |
| [45. Retire `beginAssault`](45-retire-begin-assault.md) |
| [46. Condition and outcome rules](46-condition-rules.md) |
| [47. Sector view request property](47-sector-state-request.md) |
| [48. Suspended visit record contract](48-suspended-record-contract.md) |
| [49. Aimed-shot rules](49-targeted-combat.md) |
| [50. Tactical grid label](50-tactical-grid-label.md) |
| [51. Weapon reload rules](51-weapon-reload.md) |
| [52. Care defaults](52-care-rules.md) |
| [53. Captive service contract rules](53-captive-service.md) |
| [54. Care tuning and refill price](54-dead-defaults.md) |
| [55. Tactical planning rules](55-tactical-planning.md) |
| [56. Militia patrol tuning and scene validation](56-militia-patrol-rules.md) |
| [57. Militia patrol movement](57-militia-patrol-order.md) |
| [58. Projectile air drag](58-projectile-air-drag.md) |
| [59. Patrol sight filter](59-patrol-sight-filter.md) |
| [60. Material intervals](60-material-intervals.md) |
| [61. Civilian patrol decisions](61-npc-patrol.md) |
| [62. Inventory discovery](62-inventory-discovery.md) |

## What the series changed

- [The overview](../overview.md) describes the current source and remaining
  gaps; section 8 maps current architecture boundaries to their requirements.
- `GameUnitOfWork` is the shared game transaction. A revision is the saved
  counter used to reject stale updates, and each adapter names the revision
  field it guards.
- `apps/web/lib` builds browser composition. The architecture check blocks
  every `apps/web` file from importing retained modules directly from the
  `packages/game` root. It also blocks game domain, application, and
  infrastructure imports from `apps/web/app`; `apps/web/lib` may import those
  layers.
- Every use case has the same contract shape, and a test keeps it that way.
- The glossary's [compatibility table](../../accepted/ubiquitous-language.md#compatibility-names)
  maps retained API and save names to canonical terms. `recruitCivic` and
  `civicStatus` are not accepted; `candidateAdmission` is the canonical
  eligibility query.
- `GameSession` owns `RandomSource` (the seeded random sequence) and
  `WorldTimeline` (the accepted game-time clock). `drawCampaignRandom(session,
  draft)` draws through `session.randomSource` and writes the advanced seed to
  `draft.seed`. Campaign, strategic, and tactical clock paths use
  `session.timeline`, and campaign `hour` and optional `secondOfHour` project
  its accepted second.
- Restoration validates legacy `hiringArrivals` entries. Valid bookings start
  service immediately at a legal recruitment site, or preserve a
  `RefundableRecruitmentClaim` when no site is legal. It removes the old field;
  new campaigns do not carry it.
- The [`GameSnapshot`](../../../../packages/game/public/game-snapshot-types.ts)
  envelope writes `campaign` and `sectorSession`. `campaign` carries
  `sectorEntryRequest`, `forceRoster`, `characters`, `sectorSnapshots`, and
  `sceneSnapshots`. Campaign orders that carry the sector view use
  `sectorSession`, while decoded `GameSnapshotContent` keeps `battle` as its
  in-memory field. [`decodeSave`](../../../../packages/game/save.ts) reads
  legacy top-level `battle` only when `sectorSession` is `undefined`; it maps
  campaign keys `pendingBattle`, `recruited`, `operativeState`, `sectorStates`, and
  `sceneStates` only when each current field is `undefined`, then removes each
  legacy key. The current value wins when both names are present.
  [`CampaignAction`](../../../../packages/game/public/campaign-types.ts) no
  longer declares `sectorState`.
- `apps/web` imports several declared entries from `packages/game/public`,
  including `game-runtime-api.ts`, `campaign-types.ts`,
  `compatibility-types.ts`, `inventory-types.ts`, `battle-job-types.ts`,
  `game-snapshot-types.ts`, and `campaign-compiler-api.ts`.
  `tools/architecture-rules.ts` blocks every file under `apps/web` from
  importing retained root modules; it also blocks `apps/web/app` from
  importing game domain, application, and infrastructure modules.
  `apps/web/lib` may import those layers for browser composition.
- The reverse direction is also blocked: the architecture checker and
  `.dependency-cruiser.json` refuse imports from `packages/game` into
  `apps/web`.
- [`CampaignCompiler`](../../../../packages/game/application/campaign-compiler/)
  compiles campaign definitions through
  [`createCampaignCompiler()`](../../../../packages/game/public/campaign-compiler-api.ts).
  The browser loader is
  [`apps/web/lib/campaign-library.ts`](../../../../apps/web/lib/campaign-library.ts);
  [`tools/campaign-export.mjs`](../../../../tools/campaign-export.mjs) uses the
  same public compiler entry.
  [`packages/game/campaign-library.js`](../../../../packages/game/campaign-library.js)
  contains `CampaignLibraryCompilerRepository`, not the browser loader, and
  does not export `compileCampaignPackage`.
- [`CampaignSnapshot.sectorEntryRequest`](../../../../packages/game/public/campaign-types.ts)
  uses the public `CampaignSectorEntryRequest` type. The application layer
  retains the narrower `SectorEntryRequest` request type for `EnterSector`.
- The save envelope and the content it carries have the names
  `GameSnapshot` and `GameSnapshotContent`; `GameSnapshot` is the versioned
  save and worker representation, and `GameSnapshotContent` is its state
  payload ([`game-snapshot-types.ts`](../../../../packages/game/public/game-snapshot-types.ts)).
- The rule that prepares a firearm for firing lives in the domain, and the
  root module is a thin re-export of it.
- `ResidentPositionReference` names the saved reference to a resident's
  character identity and local position.
- Thirty-six migrated game-rule groups have domain ownership. The 29 groups
  detailed below plus these seven groups make that total:
  [tactical planning](55-tactical-planning.md),
  [militia patrol tuning and scene validation](56-militia-patrol-rules.md),
  [militia patrol movement](57-militia-patrol-order.md),
  [projectile air drag](58-projectile-air-drag.md),
  [material intervals](60-material-intervals.md),
  [civilian patrol decisions](61-npc-patrol.md), and
  [inventory discovery](62-inventory-discovery.md). Slice
  [59](59-patrol-sight-filter.md) makes the retained sight filter use the
  domain-owned patrol eligibility check; it does not add a separate rule group.
  The 29 groups are firearm readiness,
  unarmed combat, sleep need, held supplies, projectile energy, firearm loads,
  study rate, the route queue, firearm serviceability, kinetic impact, combat
  balance, combat journal, fatigue and energy, interior visibility, campaign
  clock conversion, `WorldTimeline` clock advancement, tactical-level rules
  (the vertical map layer assigned to a point), shot-range calculation, NPC
  facing (`directionTo`), anonymous sound-position approximation
  (`approximateHeardPosition`), care-composure relief
  (`CARE_COMPOSURE_RELIEF` & `careComposureRelief`), aimed-shot eligibility,
  region choices, profiles, penalties, and effects in
  [`targeted-combat.ts`](../../../../packages/game/domain/combat/targeted-combat.ts),
  tactical cell labels in
  [`tactical-grid.ts`](../../../../packages/game/domain/sector-sessions/tactical-grid.ts),
  actor condition (critical health, unconsciousness, field capability, and
  condition refresh)
  in [`actor-condition.ts`](../../../../packages/game/domain/personnel/actor-condition.ts);
  medical-patient care eligibility in
  [`medical-patient.ts`](../../../../packages/game/domain/personnel/medical-patient.ts);
  completed tactical victory in
  [`completed-victory.ts`](../../../../packages/game/domain/combat/completed-victory.ts);
  weapon reload cost, stored-progress validation, and planning in
  [`weapon-reload.ts`](../../../../packages/game/domain/combat/weapon-reload.ts);
  and default care/rest tuning and default strategic bleeding percentage in
  [`care-rules.ts`](../../../../packages/game/domain/personnel/care-rules.ts);
  captive service-hour calculation and contract reconstruction on release in
  [`captive-service.ts`](../../../../packages/game/domain/personnel/captive-service.ts).
  The retained [`prisoner-custody.js`](../../../../packages/game/prisoner-custody.js)
  re-exports those rules and keeps `prisonerStatus`, a query over campaign
  character and detention records.
  The retained root modules [`actor-condition.js`](../../../../packages/game/actor-condition.js),
  [`medical-patient.js`](../../../../packages/game/medical-patient.js),
  [`battle-outcome.js`](../../../../packages/game/battle-outcome.js),
  [`targeted-combat.js`](../../../../packages/game/targeted-combat.js),
  [`tactical-grid.js`](../../../../packages/game/tactical-grid.js),
  and [`weapon-reload.js`](../../../../packages/game/weapon-reload.js)
  re-export their domain implementations. The campaign-content lookup in
  [`campaign-care-rules.js`](../../../../packages/game/campaign-care-rules.js)
  reads authored values and uses the domain defaults; the authored field
  contract and validation live in
  [`campaign-rules-schema.js`](../../../../packages/campaign-format/campaign-rules-schema.js).
  The browser interface owns the sleep-need sentence
  and campaign notices. The shot-range sentence stays beside its HUD caller in
  [`packages/game/shot-range.js`](../../../../packages/game/shot-range.js) to
  preserve dependency direction.
- [`packages/game/domain/sector-sessions/tactical-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-space.ts)
  owns the game's tactical-level rules; `packages/campaign-format` keeps an
  independent map-validation implementation because it cannot import the game.
- [`tactical-planning-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-planning-space.ts)
  owns planning-point normalization, movement-order construction, and
  same-surface hand reach. The retained
  [`tactical-planning-space.ts`](../../../../packages/game/tactical-planning-space.ts)
  re-exports those rules.
- [`militia-patrol.ts`](../../../../packages/game/domain/personnel/militia-patrol.ts)
  owns default patrol tuning, saved-scene consistency validation, patrol
  eligibility, waypoint selection (the map target for each turn), and
  reachable-cell choice. The retained
  [`militia-patrol.js`](../../../../packages/game/militia-patrol.js) uses the
  domain's `canAct` check for sight-query observers and opponents, asks tactical
  map code for visibility and reachable cells, then assembles the move order.
  [`militia-patrol-rules.js`](../../../../packages/game/militia-patrol-rules.js)
  retains the campaign-content lookup, while
  [`campaign-rules-schema.js`](../../../../packages/campaign-format/campaign-rules-schema.js)
  retains the authored-field contract and structural validation.
- [`npc-patrol.ts`](../../../../packages/game/domain/personnel/npc-patrol.ts)
  owns civilian patrol eligibility, turn direction and aim, and reachable-cell
  choice. The retained
  [`npc-patrol.js`](../../../../packages/game/npc-patrol.js) supplies map-derived
  sight and reachability, then assembles the selected move order.
- [`projectile-air-drag.ts`](../../../../packages/game/domain/combat/projectile-air-drag.ts)
  owns the runtime check for whether a weapon has a usable air-drag profile and
  the distance-based energy-retention rule. The retained
  [`projectile-air-drag.js`](../../../../packages/game/projectile-air-drag.js)
  validates records with the shared
  [`projectile-profile-schema.js`](../../../../packages/campaign-format/projectile-profile-schema.js)
  and re-exports the domain rules.
- [`material-intervals.ts`](../../../../packages/game/domain/combat/material-intervals.ts)
  owns interval ordering, merging of overlapping or touching spans, and their
  entering and leaving events. The retained
  [`projectile-cover.js`](../../../../packages/game/projectile-cover.js) traces
  the shot, collects geometry-derived intervals, and passes them to the domain.
- `directionTo` and `approximateHeardPosition` live in
  [`packages/game/domain/perception/npc-perception.ts`](../../../../packages/game/domain/perception/npc-perception.ts);
  the retained modules
  [`packages/game/tactical-awareness.js`](../../../../packages/game/tactical-awareness.js)
  and [`packages/game/npc-perception.js`](../../../../packages/game/npc-perception.js)
  re-export them.
- [`inventory-discovery.ts`](../../../../packages/game/domain/perception/inventory-discovery.ts)
  owns observer eligibility, point-seen checks, and the rules for finding loose
  equipment, dropped weapons, bodies, and open chests. The retained
  [`inventory-discovery.js`](../../../../packages/game/inventory-discovery.js)
  supplies sight, interior-visibility, and prop-cell data, then sets
  `knownToPlayer` for found records.
- `CARE_COMPOSURE_RELIEF` and `careComposureRelief` live in
  [`packages/game/domain/personnel/care-composure.ts`](../../../../packages/game/domain/personnel/care-composure.ts);
  the root module re-exports them. Architecture checks prohibit imports from
  `packages/game` into `apps/web`.

## What remains

- Every retained simulation decision must have a named domain owner or
  application use case. [`npc-patrol.js`](../../../../packages/game/npc-patrol.js)
  supplies tactical sight and reachable cells, then assembles the move order;
  [`inventory-discovery.js`](../../../../packages/game/inventory-discovery.js)
  supplies sight, interior visibility, and prop cells, then marks found records
  `knownToPlayer`. Those queries and updates are adapter responsibilities;
  [`npc-patrol.ts`](../../../../packages/game/domain/personnel/npc-patrol.ts)
  and
  [`inventory-discovery.ts`](../../../../packages/game/domain/perception/inventory-discovery.ts)
  own the decisions.
  `prisonerStatus` remains in
  [`prisoner-custody.js`](../../../../packages/game/prisoner-custody.js) as a
  query over campaign character and detention records, not an unowned custody
  rule.
- Campaign-authored care lookup remains in
  [`campaign-care-rules.js`](../../../../packages/game/campaign-care-rules.js):
  it selects authored values and falls back to
  [`care-rules.ts`](../../../../packages/game/domain/personnel/care-rules.ts)
  defaults. The retained `militiaPatrolRules` lookup in
  [`militia-patrol-rules.js`](../../../../packages/game/militia-patrol-rules.js)
  selects the campaign package setting, then the scene's stored patrol setting,
  then the domain default. The shared
  [`campaign-rules-schema.js`](../../../../packages/campaign-format/campaign-rules-schema.js)
  owns authored-field contracts and structural validation; domain
  `validateCampaignPatrol` checks saved-scene consistency against the campaign
  setting or domain default.
