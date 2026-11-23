# Migration slice notes

This index links to the 37 migration slice notes. Each note records its
rationale, scope, and behavior tests. Its rationale describes the source at
that slice's start; the [overview](../overview.md) describes current source.

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
  eligibility query. `beginAssault` remains a compatibility command for
  resolving a hostile arrival.
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
- Portable saves write the sector view under `sectorSession`. Decoding and
  terrain compaction read legacy `battle` when `sectorSession` is absent, while
  the in-memory `GameSnapshotContent.battle` field remains distinct.
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
- `CampaignCompiler` compiles validated campaign definitions into
  runtime-playable definitions. The retained `compileCampaignPackage` adapter
  delegates to it.
- The save envelope and the content it carries have the names
  `GameSnapshot` and `GameSnapshotContent`; `GameSnapshot` is the versioned
  save and worker representation, and `GameSnapshotContent` is its state
  payload.
- The rule that prepares a firearm for firing lives in the domain, and the
  root module is a thin re-export of it.
- `ResidentPositionReference` names the saved reference to a resident's
  character identity and local position.
- Twenty-one game rules have domain ownership: firearm readiness, unarmed
  combat, sleep need, held supplies, projectile energy, firearm loads, study
  rate, the route queue, firearm serviceability, kinetic impact, combat
  balance, combat journal, fatigue and energy, interior visibility, campaign
  clock conversion, `WorldTimeline` clock advancement, tactical-level rules
  (the vertical map layer assigned to a point), shot-range calculation, NPC
  facing (`directionTo`), anonymous sound-position approximation
  (`approximateHeardPosition`), and care-composure relief
  (`CARE_COMPOSURE_RELIEF` & `careComposureRelief`). The sleep-need sentence
  and campaign notices moved from game code to the browser interface. The
  shot-range sentence stays beside its HUD caller in
  `packages/game/shot-range.js` to preserve dependency direction.
- Slice 26 moved the game's tactical-level rules into
  `packages/game/domain/sector-sessions/tactical-space.ts`. Slice 27 removed
  their duplicates from interior visibility. `packages/campaign-format` keeps
  an independent copy for authored-map validation because it cannot import the
  game.
- Slice 32 consolidated the richer `directionTo` and
  `approximateHeardPosition` rules used by the game in the domain.
  `packages/game/tactical-awareness.js` and
  `packages/game/npc-perception.js` re-export them, so callers keep their paths
  and behavior.
- Slice 30 moved `CARE_COMPOSURE_RELIEF` and `careComposureRelief` into
  `packages/game/domain/personnel/care-composure.ts`; the root module
  re-exports them.
- Slice 31 makes the architecture checker and dependency-cruiser reject
  imports from `packages/game` into `apps/web`.

## What remains

- Retained simulation modules still carry most game rules procedurally.
- The saved campaign fields `recruited`, `operativeState`, `sectorStates`, and
  `sceneStates` still need explicit conversion to canonical domain
  representations.
