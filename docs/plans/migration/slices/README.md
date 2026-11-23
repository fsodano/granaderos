# Migration slice notes

This index links to the 43 migration slice notes. Each note records its
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
  `sceneSnapshots`. [`decodeSave`](../../../../packages/game/save.ts) reads
  legacy top-level `battle` only when
  `sectorSession` is absent; it maps campaign keys `pendingBattle`, `recruited`,
  `operativeState`, `sectorStates`, and `sceneStates` only when each current
  field is absent, then removes the old key. The current value wins if both
  names are present. `GameSnapshotContent.battle` remains an in-memory field;
  `sectorState` remains a campaign-action request property, not a saved field
  ([`CampaignAction`](../../../../packages/game/public/campaign-types.ts)).
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
- Twenty-one migrated game rules have domain ownership: firearm readiness,
  unarmed combat, sleep need, held supplies, projectile energy, firearm loads,
  study rate, the route queue, firearm serviceability, kinetic impact, combat
  balance, combat journal, fatigue and energy, interior visibility, campaign
  clock conversion, `WorldTimeline` clock advancement, tactical-level rules
  (the vertical map layer assigned to a point), shot-range calculation, NPC
  facing (`directionTo`), anonymous sound-position approximation
  (`approximateHeardPosition`), and care-composure relief
  (`CARE_COMPOSURE_RELIEF` & `careComposureRelief`). The browser interface
  owns the sleep-need sentence and campaign notices. The shot-range sentence
  stays beside its HUD caller in
  [`packages/game/shot-range.js`](../../../../packages/game/shot-range.js) to
  preserve dependency direction.
- [`packages/game/domain/sector-sessions/tactical-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-space.ts)
  owns the game's tactical-level rules; `packages/campaign-format` keeps an
  independent map-validation implementation because it cannot import the game.
- `directionTo` and `approximateHeardPosition` live in
  [`packages/game/domain/perception/npc-perception.ts`](../../../../packages/game/domain/perception/npc-perception.ts);
  the retained modules
  [`packages/game/tactical-awareness.js`](../../../../packages/game/tactical-awareness.js)
  and [`packages/game/npc-perception.js`](../../../../packages/game/npc-perception.js)
  re-export them.
- `CARE_COMPOSURE_RELIEF` and `careComposureRelief` live in
  [`packages/game/domain/personnel/care-composure.ts`](../../../../packages/game/domain/personnel/care-composure.ts);
  the root module re-exports them. Architecture checks prohibit imports from
  `packages/game` into `apps/web`.

## What remains

- Retained simulation modules still carry procedural game rules.
- The saved field
  [`suspendedSectorSessions`](../../../../packages/game/public/campaign-types.ts)
  needs a canonical representation and conversion that preserve each
  suspended visit's request, identity, and progress.
- The campaign-action request property `sectorState` needs a glossary-backed
  canonical name; it is not a saved field.
