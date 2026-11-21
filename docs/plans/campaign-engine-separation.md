# Campaign folders and shared engine

This plan defines the boundary between the shared game engine and installed
campaign folders. The engine owns mechanics, UI, strategy, tactical simulation,
rendering and reusable dialogue, encounter, hiring and quest execution. Campaigns
own their world, people, dialogue, objectives, buildings, initial allocations and
visual references. The first version installs only the existing Granaderos
campaign.

## Required result

- Complete the boundary between core code and campaign definitions. Move
  stock historical rules and data into `campaigns/granaderos/`; retain only
  documented compatibility facades in the core.
- Load and validate campaign folders through manifests. Discover multiple
  installed campaigns without edits to engine code. Keep the shared 36 by 33
  sector grid and allow campaign geography, localities and tactical maps to vary.
- Use explicit configurable mercenaries, NPCs, dialogue, quests and roles.
  Generic campaigns must not inherit stock identity powers or historical events.
- Resolve campaign portraits, skins, building presentation and other visual
  resources without changing simulation. Validate and export local resources.
- Select, start, continue and import campaigns. Pin their content identity
  and isolate their saves and editor drafts.
- Preserve the distributed campaign's mechanics and starting behavior.
  Compare normal stock behavior with the packaged campaign, rather than treating
  the older editor template as an equivalent gameplay baseline.
- Verify two different campaigns through the same runtime. Check their
  maps, hiring, encounters, dialogue, quests, visuals and saved continuation.
  Keep the second campaign as a fixture; distribute only Granaderos.
- Document the authoring workflow for both the engine boundary and the folder
  format, so a second campaign needs no engine edits.

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
format, scaffold, validation, assets, editors and installation. Full campaign
route acceptance is separate from the engine/content boundary.
