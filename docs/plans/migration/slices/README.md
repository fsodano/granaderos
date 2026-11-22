# Migration slice notes

Each note states the intent of one slice, the files it touches, the tests it
adds, and how it is verified. Write the note before implementing the slice and
update it when the slice lands, so a later session can resume without reading
the diff.

[Migration plan](../plan.md) · [Orientation and gap analysis](../overview.md)

| Slice | Branch | State | Version |
| --- | --- | --- | --- |
| [1. Plan and orientation](01-plan-and-orientation.md) | `migration/plan-and-orientation` | landed | 0.2.6 |
| [2. Canonical transaction](02-canonical-transaction.md) | `migration/canonical-transaction` | landed | 0.2.7 |
| [3. Browser composition](03-browser-composition.md) | `migration/browser-composition` | landed | 0.2.8 |
| [4. Use-case contracts](04-use-case-contracts.md) | `migration/use-case-contracts` | landed | 0.2.9 |
| [5. Compatibility aliases](05-compatibility-aliases.md) | `migration/compatibility-aliases` | landed | 0.2.10 |
| [6. Random source](06-random-source.md) | `migration/random-source` | landed | 0.2.11 |
| [7. Interface public entry](07-interface-public-entry.md) | `migration/interface-public-entry` | landed | 0.2.12 |
| [8. Campaign compiler](08-campaign-compiler.md) | `migration/campaign-compiler` | landed | 0.2.13 |
| [9. Game snapshot](09-game-snapshot.md) | `migration/game-snapshot` | landed | 0.2.14 |
| [10. Weapon readiness](10-weapon-readiness.md) | `migration/weapon-readiness` | landed | 0.2.15 |
| [11. Resident position reference](11-resident-position-reference.md) | `migration/resident-position-reference` | landed | 0.2.16 |
| [12. Unarmed combat](12-unarmed-combat.md) | `migration/unarmed-combat` | landed | 0.2.17 |
| [13. Sleep need](13-sleep-need.md) | `migration/sleep-need` | landed | 0.2.18 |
| [14. Held supplies](14-held-supplies.md) | `migration/held-supplies` | landed | 0.2.19 |
| [15. Projectile energy](15-projectile-energy.md) | `migration/projectile-energy` | landed | 0.2.20 |
| [16. Firearm loads](16-firearm-loads.md) | `migration/firearm-loads` | landed | 0.2.21 |
| [17. Study rate](17-study-rate.md) | `migration/study-rate` | landed | 0.2.22 |
| [18. Route queue](18-route-queue.md) | `migration/route-queue` | landed | 0.2.23 |
| [19. Firearm serviceability](19-firearm-serviceability.md) | `migration/firearm-serviceability` | landed | 0.2.24 |
| [20. Kinetic impact](20-kinetic-impact.md) | `migration/kinetic-impact` | landed | 0.2.25 |
| [21. Combat balance](21-combat-balance.md) | `migration/combat-balance` | landed | 0.2.26 |
| [22. Combat journal](22-combat-journal.md) | `migration/combat-journal` | landed | 0.2.27 |
| [23. Fatigue and energy](23-fatigue.md) | `migration/fatigue` | landed | 0.2.28 |
| [24. Interior visibility](24-interior-visibility.md) | `migration/interior-visibility` | landed | 0.2.29 |
| [25. Strategic clock](25-strategic-clock.md) | `migration/strategic-clock` | landed | 0.2.30 |

A slice moves from planned to in progress when its branch is created, and to
landed when it is merged into `feature/clean-architecture-migration` and its
branch is deleted.

## What the series changed

- The orientation survey and the gap analysis are recorded in
  [the overview](../overview.md), and section 8 of that document states which
  gaps are closed and which remain.
- The infrastructure has one revision policy, and `GameUnitOfWork` names the
  revision field it guards.
- The player interface no longer builds game object graphs. The construction
  lives in `apps/web/lib`, and `tools/check-architecture.mjs` refuses an
  interface file that reaches into a game layer.
- Every use case has the same contract shape, and a test keeps it that way.
- The command alias `recruitCivic` and the eligibility query `civicStatus`
  are gone from the source. The glossary records `candidateAdmission` and the
  compatibility table shrank by two rows.
- The seeded random sequence is a domain object, `RandomSource`, and the
  campaign reads it from there.
- The player application reaches the game through
  `packages/game/public/game-runtime-api.ts`, and the checker refuses any
  other way in.
- `CampaignCompiler` is the application service that turns a validated campaign
  definition into runtime-playable definitions, and it is the only path the
  game and the editor use.
- The save envelope and the content it carries have the names
  `GameSnapshot` and `GameSnapshotContent`.
- The rule that prepares a firearm for firing lives in the domain, and the
  root module is a thin re-export of it.
- The saved resident post has the name `ResidentPositionReference`.
- Fifteen game rules have moved into the domain: the firearm preparation
  rule, the unarmed combat rule, the sleep need rule, the held consumable
  rule, the projectile energy rule, the firearm loads rule, the study rate
  rule, the route queue, the firearm serviceability rule, the kinetic impact
  rule, the combat tuning, the combat journal rules, the fatigue and energy
  rules, the interior visibility rule and the campaign clock rule. Their root
  modules are thin re-exports, and two player-facing sentences moved from the
  game into the interface.
