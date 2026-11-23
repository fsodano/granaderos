# Clean architecture migration plan

This plan defines a 60-slice sequence for moving Granaderos toward the
[accepted domain architecture](../accepted/domain-architecture.md). The
[overview](overview.md) describes current source behavior and remaining
requirements; the [slice index](slices/README.md) links each note.

[Migration overview](overview.md) · [Slice notes](slices/README.md) · [Accepted domain architecture](../accepted/domain-architecture.md)

A revision is a counter tied to a saved snapshot; commands with an older
expected revision are rejected. A public entry is a declared module in
`packages/game/public` that lists the game API available to a consumer.

## Goal

Make the running game follow the architecture the repository already accepts:
one transaction mechanism, browser composition outside the interface layer,
declared public entries that constrain consumers, uniform use-case contracts,
and the glossary's [compatibility table](../accepted/ubiquitous-language.md#compatibility-names),
which maps retained API/save names to canonical terms.

The work is divided into small slices. Each slice keeps the repository
coherent and independently verifiable.

## Scope and non-goals

In scope:

- The layering and contract requirements summarized in
  [section 8 of the overview](overview.md#8-current-architecture-boundaries).
- The verification tooling that keeps the new boundaries honest.
- The documentation that records the new shape.

Most slices preserve gameplay rules and saved values. The sequence includes an
explicit conversion for legacy `hiringArrivals` entries: a valid booking starts
service at a legal recruitment site at the saved campaign time, or becomes a
`RefundableRecruitmentClaim` if no site is legal. The old travel schedule is not
continued. Renamed save fields retain explicit legacy reads; any remaining
persisted compatibility field needs a canonical representation and conversion
before its old name can be retired.

The migration does not require a wholesale rewrite of retained modules. Its
completion criteria require their procedural rules to move behind the domain
or declared public entries. Editor and campaign-format authoring work remain
outside this plan.

## Slice sequence

| Slice note | Change |
| --- | --- |
| [1. Plan and orientation](slices/01-plan-and-orientation.md) | Describe the current system and migration design |
| [2. Canonical transaction](slices/02-canonical-transaction.md) | Share revision validation and advancement across transaction adapters |
| [3. Browser composition](slices/03-browser-composition.md) | Move game composition out of React screens |
| [4. Use-case contracts](slices/04-use-case-contracts.md) | Standardize application use-case contracts |
| [5. Compatibility aliases](slices/05-compatibility-aliases.md) | Remove non-persisted command and query aliases |
| [6. Random source](slices/06-random-source.md) | Move the seeded random sequence into the domain |
| [7. Interface public entry](slices/07-interface-public-entry.md) | Add a declared runtime entry for the player application |
| [8. Campaign compiler](slices/08-campaign-compiler.md) | Add the service that compiles campaign definitions |
| [9. Game snapshot](slices/09-game-snapshot.md) | Name the versioned save and worker representation |
| [10. Weapon readiness](slices/10-weapon-readiness.md) | Move firearm-readiness rules into the domain |
| [11. Resident position reference](slices/11-resident-position-reference.md) | Name `ResidentPositionReference` for the saved character ID and local position |
| [12. Unarmed combat](slices/12-unarmed-combat.md) | Move unarmed-combat rules into the domain |
| [13. Sleep need](slices/13-sleep-need.md) | Move sleep-need rules and interface wording to their owners |
| [14. Held supplies](slices/14-held-supplies.md) | Move held-supply rules into the domain |
| [15. Projectile energy](slices/15-projectile-energy.md) | Move projectile-energy calculations into the domain |
| [16. Firearm loads](slices/16-firearm-loads.md) | Move firearm-load selection into the domain |
| [17. Study rate](slices/17-study-rate.md) | Move study-rate calculation into the domain |
| [18. Route queue](slices/18-route-queue.md) | Move the stable route queue into the domain |
| [19. Firearm serviceability](slices/19-firearm-serviceability.md) | Move the firearm-usability rule into the domain |
| [20. Kinetic impact](slices/20-kinetic-impact.md) | Move launch-to-impact calculation into the domain |
| [21. Combat balance](slices/21-combat-balance.md) | Move combat tuning and damage rules into the domain |
| [22. Combat journal](slices/22-combat-journal.md) | Move journal-admission rules into the domain |
| [23. Fatigue and energy](slices/23-fatigue.md) | Move fatigue and energy calculations into the domain |
| [24. Interior visibility](slices/24-interior-visibility.md) | Move interior visibility into the domain |
| [25. Strategic clock](slices/25-strategic-clock.md) | Move clock conversion and notices to their owners |
| [26. Tactical space](slices/26-tactical-space.md) | Move tactical-level rules (the vertical map layer assigned to a point) into the domain |
| [27. Interior visibility helpers](slices/27-interior-visibility-helpers.md) | Reuse domain tactical-level rules in interior visibility |
| [28. Shot range](slices/28-shot-range.md) | Move shot-range calculation into the domain and keep the HUD sentence with its caller |
| [29. NPC perception](slices/29-npc-perception.md) | Move simple NPC direction and heard-position rules into the domain |
| [30. Care composure](slices/30-care-composure.md) | Move the caregiver composure-relief rule into the domain |
| [31. Game import boundary](slices/31-game-import-boundary.md) | Block game-package imports from the player application in architecture checks |
| [32. Perception consolidation](slices/32-perception-consolidation.md) | Move the richer NPC perception rules into the domain and re-export them from both retained modules |
| [33. Session random source](slices/33-session-random-source.md) | Make `GameSession` own `RandomSource` and route campaign draws through it |
| [34. Retire hiring arrivals](slices/34-retire-hiring-arrivals.md) | Convert valid legacy bookings to immediate service or refundable claims, then remove `hiringArrivals` |
| [35. Session clock](slices/35-session-clock.md) | Put campaign time on the `GameSession`-owned `WorldTimeline` and project the accepted second |
| [36. Strategic clock timeline](slices/36-strategic-clock-timeline.md) | Advance strategic time through the same session timeline |
| [37. Sector session field](slices/37-sector-session-field.md) | Write the saved sector view as `sectorSession` and read legacy `battle` saves |
| [38. Sector entry request field](slices/38-sector-entry-request.md) | Write the saved request as `sectorEntryRequest` and read legacy `pendingBattle` saves |
| [39. Force roster field](slices/39-force-roster-field.md) | Write serving combatant membership as `forceRoster` and read legacy `recruited` saves |
| [40. Characters field](slices/40-characters-field.md) | Write per-character records as `characters` and read legacy `operativeState` saves |
| [41. Retained snapshot fields](slices/41-snapshot-fields.md) | Write retained maps as `sectorSnapshots` and `sceneSnapshots` and read their legacy names |
| [42. Sector entry request type](slices/42-sector-entry-request-type.md) | Name the saved public projection `CampaignSectorEntryRequest` while retaining the application `SectorEntryRequest` |
| [43. Retire the compile adapter](slices/43-retire-compile-adapter.md) | Remove `compileCampaignPackage` and use the declared compiler entry |
| [44. Suspended snapshot compaction](slices/44-suspended-snapshot-compaction.md) | Compact and expand eligible terrain arrays in suspended visit snapshots |
| [45. Retire `beginAssault`](slices/45-retire-begin-assault.md) | Resolve hostile arrivals through one `fightOnArrival` order per squad decision |
| [46. Condition and outcome rules](slices/46-condition-rules.md) | Move condition, care, and tactical-victory decisions into the domain |
| [47. Sector view request property](slices/47-sector-state-request.md) | Use `sectorSession` for campaign orders that carry the sector view |
| [48. Suspended visit record contract](slices/48-suspended-record-contract.md) | Declare every saved suspended-visit field in `CampaignSuspendedSectorSession` |
| [49. Aimed-shot rules](slices/49-targeted-combat.md) | Move aimed-shot eligibility, region choices, profiles, penalties, and effects into the domain |
| [50. Tactical grid label](slices/50-tactical-grid-label.md) | Move tactical cell-label generation into the domain |
| [51. Weapon reload rules](slices/51-weapon-reload.md) | Move reload-round cost, stored-progress validation, and planning into the domain |
| [52. Care defaults](slices/52-care-rules.md) | Move default care/rest tuning and the default strategic bleeding percentage into the domain; keep campaign-authored rule lookup at the content boundary |
| [53. Captive service contract rules](slices/53-captive-service.md) | Move remaining-service calculation and contract reconstruction on release into the domain; keep the record-backed status query in the retained module |
| [54. Care tuning and refill price](slices/54-dead-defaults.md) | Use domain care tuning for rest healing and require callers to supply the refill dressing price |
| [55. Tactical planning rules](slices/55-tactical-planning.md) | Move planning-point rules, movement-order construction, and same-surface hand reach into the domain while retaining the root re-export |
| [56. Militia patrol tuning and scene validation](slices/56-militia-patrol-rules.md) | Move default patrol tuning and saved-scene consistency validation into the domain; retain campaign-content lookup and authored-field validation at their boundaries |
| [57. Militia patrol movement](slices/57-militia-patrol-order.md) | Move patrol eligibility, waypoint selection, and reachable-cell choice into the domain; retain map queries and move-order assembly in [`militia-patrol.js`](../../../packages/game/militia-patrol.js) |
| [58. Projectile air drag](slices/58-projectile-air-drag.md) | Move the check for whether a weapon has a usable air-drag profile and energy retention by distance into the domain; retain shared file-contract validation at the boundary |
| [59. Patrol sight filter](slices/59-patrol-sight-filter.md) | Use the domain-owned patrol eligibility check for sight-query observers and opponents |
| [60. Material intervals](slices/60-material-intervals.md) | Move material-interval ordering, merging, and entering/leaving event construction into the domain; keep trajectory tracing and interval collection in [`projectile-cover.js`](../../../packages/game/projectile-cover.js) |

Each slice has a note under [slices](slices/README.md) that records its intent,
scope, and behavior tests. Read the relevant note before changing that area.

## Completion criteria

The migration is complete when:

1. Every procedural simulation rule must have a named domain owner or application
   use case, and retained compatibility modules must delegate rather than
   duplicate decisions. The domain owns aimed-shot rules in
   [`targeted-combat.ts`](../../../packages/game/domain/combat/targeted-combat.ts),
   tactical cell labels in
   [`tactical-grid.ts`](../../../packages/game/domain/sector-sessions/tactical-grid.ts),
   planning-point and movement-order rules in
   [`tactical-planning-space.ts`](../../../packages/game/domain/sector-sessions/tactical-planning-space.ts),
   and patrol tuning, saved-scene consistency, eligibility, waypoints, and
   reachable-cell choice in
   [`militia-patrol.ts`](../../../packages/game/domain/personnel/militia-patrol.ts).
   `canAct` is the single patrol eligibility check; the retained
   [`militia-patrol.js`](../../../packages/game/militia-patrol.js) uses it in the
   sight filter, queries map visibility and reachable cells, then assembles the
   move order. [`material-intervals.ts`](../../../packages/game/domain/combat/material-intervals.ts)
   orders and merges each object's material intervals and creates the entering
   and leaving events consumed by the flight. The retained
   [`projectile-cover.js`](../../../packages/game/projectile-cover.js) traces the
   shot and collects those intervals.
   [`projectile-air-drag.ts`](../../../packages/game/domain/combat/projectile-air-drag.ts)
   decides whether a weapon has a usable air-drag profile (its fraction retained
   at the weapon's range) and calculates energy retention by distance. The
   retained [`projectile-air-drag.js`](../../../packages/game/projectile-air-drag.js)
   validates records with the shared
   [`projectile-profile-schema.js`](../../../packages/campaign-format/projectile-profile-schema.js)
   and re-exports the domain rules.
   [`weapon-reload.ts`](../../../packages/game/domain/combat/weapon-reload.ts)
   owns reload cost, stored-progress validation, and planning; the retained
   [`weapon-reload.js`](../../../packages/game/weapon-reload.js) re-exports it.
   [`care-rules.ts`](../../../packages/game/domain/personnel/care-rules.ts)
   owns default care/rest tuning and the default strategic bleeding percentage.
   [`campaign-care-rules.js`](../../../packages/game/campaign-care-rules.js)
   selects authored care values and uses those defaults.
   [`campaign-rules-schema.js`](../../../packages/campaign-format/campaign-rules-schema.js)
   owns authored care and militia patrol field contracts and structural
   validation; [`militia-patrol-rules.js`](../../../packages/game/militia-patrol-rules.js)
   reads campaign patrol settings. `prisonerStatus` remains a query over
   campaign character and detention records.
   Architecture checks reject imports from `packages/game` into `apps/web`.
2. `GameSession` (the runtime consistency boundary) owns `RandomSource` (the
   seeded random sequence) and `WorldTimeline` (the accepted game-time clock).
   Campaign draws use `session.randomSource` and write its advanced seed back
   to the campaign snapshot. Campaign, strategic, and tactical time advances
   use `WorldTimeline.advanceTo`; campaign `hour` and optional `secondOfHour`
   project its accepted second.
3. The save envelope writes `campaign` and the active sector view under
   `sectorSession`; decoded `GameSnapshotContent` keeps `battle` in memory. The
   campaign snapshot writes `sectorEntryRequest`, `forceRoster`, `characters`,
   `sectorSnapshots`, and `sceneSnapshots`.
   Decoding reads top-level `battle` only when `sectorSession` is `undefined`.
   For campaign fields, it maps `pendingBattle` -> `sectorEntryRequest`,
   `recruited` -> `forceRoster`, `operativeState` -> `characters`,
   `sectorStates` -> `sectorSnapshots`, and `sceneStates` -> `sceneSnapshots`
   only when each current field is `undefined`, then removes the legacy key.
4. Each entry in
   [`CampaignSnapshot.suspendedSectorSessions`](../../../packages/game/public/campaign-types.ts)
   uses the public
   [`CampaignSuspendedSectorSession`](../../../packages/game/public/campaign-types.ts)
   contract. `request` is the saved
   [`CampaignSectorEntryRequest`](../../../packages/game/public/campaign-types.ts),
   `snapshot` is the saved
   [`BattleSnapshot`](../../../packages/game/public/compatibility-types.ts),
   `activeSquadId` identifies the squad to reactivate, `location` gives its
   sector, and `suspendedAtSeconds` is the game second when suspension
   occurred. The saved record is a projection, not a serialized domain
   `SectorSession` object for one sector visit; restoration preserves visit
   identity and progress.
5. Hostile arrivals resolve only through `fightOnArrival` or
   `withdrawOnArrival`. Each order resolves one squad's `ArrivalDecision`, the
   fight-or-withdraw choice created at its hostile boundary. A caller that
   wants multiple squads to fight sends one `fightOnArrival` order for each
   squad's own decision. `beginAssault` is not accepted.
6. Campaign orders that carry an active sector view use `sectorSession`, the
   order property that matches the save-envelope key.
   [`CampaignAction`](../../../packages/game/public/campaign-types.ts) does not
   include `sectorState`, and handlers that require the view read
   `sectorSession`.
7. [`captive-service.ts`](../../../packages/game/domain/personnel/captive-service.ts)
    owns remaining service hours and contract reconstruction at release. The
    retained [`prisoner-custody.js`](../../../packages/game/prisoner-custody.js)
    keeps `prisonerStatus`, a query over campaign records, and re-exports those
    rules. The default rest-healing duration is `restHealingHours` in domain
    care tuning; `careRules` selects authored values when present. `refillCost`
    has no default price, and each caller supplies `dressingPrice`.
8. The full verification profile, `npm run verify`, is a completion gate. It
   includes formatting, lint, architecture and dependency checks, type
   checking, tests, audits, and the production build.

## Branch and merge flow

Use `feature/clean-architecture-migration` as the integration branch. Make
each change on a short-lived slice branch from its current tip, then merge it
back with `--no-ff` so the slice boundary remains visible in history. Delete
the short-lived branch after the merge.

Do not push or open a pull request for an individual slice. Push the
integration branch once and open exactly one pull request to `main`, only
after the completion criteria above and the full verification profile pass.

## Verification strategy

Every slice must satisfy, in order:

1. Run `npm test` with the slice's new tests included.
2. Run `npm run typecheck`.
3. Run `npm run check:architecture`.
4. Run `npm run lint` and `npm run check:format`.

Tests added by a slice cover the behavior the slice moves, not the shape of the
code. A slice that only moves a boundary needs a test that fails when the
boundary is broken, and the architecture checker is that test for the
boundaries it can express as import rules.

## Resuming the work

Start with [overview.md](overview.md) for the current implementation and open
gaps, then use this plan for the branch flow and the [slice index](slices/README.md)
for the 60 slice notes. Read the accepted architecture and glossary before
work that changes a domain contract or term. Each slice note records its
intent, scope, and behavior tests.
