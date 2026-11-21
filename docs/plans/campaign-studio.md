# Complete campaign authoring studio

This plan records the goal and acceptance scope for `/studio`, a single web workspace that authors a campaign from start to finish. The required result is one
workspace that edits and exports every supported campaign
definition, resource and tactical map through one project and one history.

## Required result

- One `/studio` workspace creates, opens, duplicates and imports complete
  projects. Authors can change campaign identity and revision. One project owns
  manifest, content, world, presentation, tactical maps, map index, assets and
  resource bytes.
- Project autosave, recovery, undo/redo and portable project downloads
  preserve all files and isolate authored projects from gameplay saves.
- Every supported content field is authorable: people, NPCs, appearance,
  equipment, supplies, conditions, traits, abilities, recruitment, placements,
  dialogue, quests, errands, chapters, failures, roles, rules, forces, events
  and discoveries.
- World authoring covers the full fixed grid, geography, projection,
  localities, cities, districts, roads, factions, income, arrival facilities,
  physical sources, scene links, expansion, weather and enemy strategy.
- Integrated tactical map and building tools create maps, terrain,
  openings, rooms, slabs, elevations, props, spawns, building styles and
  reusable templates. Changes update the project directly.
- Presentation and asset authoring covers menu, introductions, calendar,
  atlas, officer creation, portrait choices, local images, asset IDs and
  hashes.
- Character previews show the selected authored portrait, appearance,
  skin and equipment with the actual renderer.
- Quest and dialogue sandboxes use engine evaluators, real costs,
  prerequisites, deadlines, rewards, failures and saved continuation.
- Campaign, tactical, weapon and building sandboxes use the current draft
  package. Tests and reports stay inside the studio, without changing an
  installed campaign or its saves.
- The studio uses the same package, map, reference and resource validation
  as the author CLI. Errors name the affected section. A complete valid folder
  exports as an installable archive without hand-editing JSON or running a CLI.
- The website is usable with keyboard and at narrow widths. Documentation
  covers a complete author workflow. Historical campaign
  playthroughs remain outside this goal.

## Acceptance scope

The eleven rows above are the acceptance scope. Each applies to every field
admitted by the current package format, through specialized controls or complete
structured fields.

This acceptance does not add arbitrary executable mechanics, unrestricted
meshes or a hosted community service. It does not certify the full game or
historical campaign routes.

## Shared project contract

A version-1 `granaderos-editor-project` contains `manifest`, `content`,
`world`, `presentation`, `maps` keyed by map ID, `mapIndex`, `assets`, and
`resources` keyed by package-relative file path. Resource records contain
their media type and base64 bytes. Project metadata is separate from runtime
campaign state. The package compiler remains the admission authority.

Specialized tools edit this project directly. A structured field editor covers
all admitted JSON fields, with optional text editing for experienced authors;
text editing alone does not satisfy the normal author workflow. Runtime tests
compile a copy and never write into installed campaign save slots.
