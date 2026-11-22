# Clean architecture migration plan

This plan defines a 33-slice sequence for moving Granaderos toward the
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

This 33-slice sequence makes no gameplay changes. It preserves saved values and
does not retire persisted compatibility names. The broader migration requires
explicit conversions before completion; the `hiringArrivals` conversion is a
gameplay migration because it changes a recruitment travel delay.

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

Each slice has a note under [slices](slices/README.md) that records its intent,
scope, and behavior tests. Read the relevant note before changing that area.

## Completion criteria

The migration is complete when:

1. The remaining procedural game rules are moved behind the domain or a
   declared public entry, and architecture checks reject imports from
   `packages/game` into `apps/web`.
2. `GameSession` (the runtime consistency boundary) owns `RandomSource` (the
   seeded random sequence); campaign draws use `session.randomSource` and write
   its advanced seed back to the campaign snapshot. `GameSession` must own
   `WorldTimeline` (the game-time event scheduler), and every game-time change
   must go through `WorldTimeline.advanceTo`.
3. Persisted compatibility names are converted to the canonical game model.
   The `hiringArrivals` conversion follows the accepted save-migration policy
   because its travel delay affects recruitment.
4. The full verification profile, `npm run verify`, passes. It includes
   formatting, lint, architecture and dependency checks, type checking, tests,
   audits, and the production build.

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
for the 33 slice notes. Read the accepted architecture and glossary before
work that changes a domain contract or term. Each slice note records its
intent, scope, and behavior tests.
