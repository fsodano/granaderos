# Campaign folders and shared engine

Implemented on `feature/campaigns` and published in `main` through
[PR #334](https://github.com/fsodano/granaderos/pull/334). The engine/package boundary is
implemented with the scope recorded below. Full campaign acceptance remains
separate work; the final broad run and browser refresh were stopped at the
user's instruction.

The engine owns mechanics, UI, strategy, tactical simulation, rendering and
reusable dialogue, encounter, hiring and quest execution. Campaigns own their
world, people, dialogue, objectives, buildings, initial allocations and visual
references. The first version installs only the existing Granaderos campaign.

## Required result

- [x] Complete the boundary between core code and campaign definitions. Move
  stock historical rules and data into `campaigns/granaderos/`; retain only
  documented compatibility facades in the core.
- [x] Load and validate campaign folders through manifests. Discover multiple
  installed campaigns without edits to engine code. Keep the shared 36 by 33
  sector grid and allow campaign geography, localities and tactical maps to vary.
- [x] Use explicit configurable mercenaries, NPCs, dialogue, quests and roles.
  Generic campaigns must not inherit stock identity powers or historical events.
- [x] Resolve campaign portraits, skins, building presentation and other visual
  resources without changing simulation. Validate and export local resources.
- [x] Select, start, continue and import campaigns. Pin their content identity
  and isolate their saves and editor drafts.
- [x] Preserve the actual shipped campaign's mechanics and starting behavior.
  Compare normal stock behavior with the packaged campaign, rather than treating
  the older editor template as an equivalent gameplay baseline.
- [x] Verify two different campaigns through the same runtime. Check their
  maps, hiring, encounters, dialogue, quests, visuals and saved continuation.
  Keep the second campaign as a fixture; ship only Granaderos.
- [x] Complete authoring documentation and record existing affected checks,
  types, production export and bounded browser evidence. Record the incomplete
  final checks and run no further campaign checks, as instructed by the user.
- [x] Commit progress, merge work PRs into `feature/campaigns`, and open a draft
  PR to `main` with exact evidence and remaining limits. PR #334 was later
  merged into `main` at the user's instruction.

## Current integration

The manifest format is `granaderos-campaign`, version 1. It references content,
world, a tactical map index, presentation and an asset catalogue. The static
export and development server discover folders by manifest. Saved packages
include the selected scenario and campaign origin. World queries compile a
separate immutable context for each pinned world.

Historical scenario hooks belong to the Granaderos campaign. Generic JSON
campaigns use the shared chapter and condition evaluators. JSON never supplies
executable mechanics. The immutable package covers all loaded definitions and
resource hashes; changed disk content cannot replace a saved package silently.

The [author guide](../development/campaign-authoring.md) describes the folder
format, scaffold, validation, assets, editors and installation. The
[verification record](../verification/campaign-engine-separation-2026-10-10.md)
records the exact test and browser scopes. Older full campaign route acceptance
remains separate from the engine/content boundary checks in this work.

## Publication

[Implementation PR #333](https://github.com/fsodano/granaderos/pull/333) contains
three progress commits and is merged into `feature/campaigns`.
[PR #334](https://github.com/fsodano/granaderos/pull/334) merged the feature
branch, documentation and evidence into `main` on 11 October 2026 as
`0a04f72c1c0a1b0ec56a8db84668f2e3b12a722e`. The historical `0.1` tag remains unchanged.
