# Complete campaign authoring studio

The user requests one website that authors a campaign from start to finish.
This plan records the completed studio goal. The required result is one
workspace that edits and exports every supported campaign
definition, resource and tactical map through one project and one history.

Implemented on `feature/campaigns` and published in `main` through
[PR #334](https://github.com/fsodano/granaderos/pull/334).
Progress PR #336 and [studio PR #337](https://github.com/fsodano/granaderos/pull/337)
are merged. PR #334 records the scope, evidence and test limits.

## Required result and evidence

- [x] One `/studio` workspace creates, opens, duplicates and imports complete
  projects. Authors can change campaign identity and revision. One project owns
  manifest, content, world, presentation, tactical maps, map index, assets and
  resource bytes. Evidence: create/import/round-trip tests and visible workflow.
- [x] Project autosave, recovery, undo/redo and portable project downloads
  preserve all files and isolate authored projects from gameplay saves.
  Evidence: mounted reload, history and storage tests.
- [x] Every supported content field is authorable: people, NPCs, appearance,
  equipment, supplies, conditions, traits, abilities, recruitment, placements,
  dialogue, quests, errands, chapters, failures, roles, rules, forces, events
  and discoveries. Evidence: schema coverage and real editor mutations.
- [x] World authoring covers the full fixed grid, geography, projection,
  localities, cities, districts, roads, factions, income, arrival facilities,
  physical sources, scene links, expansion, weather and enemy strategy.
  Evidence: edited world compiles and changes the actual runtime scene.
- [x] Integrated tactical map and building tools create maps, terrain,
  openings, rooms, slabs, elevations, props, spawns, building styles and
  reusable templates. Evidence: map export, actual renderer and collision
  admission; changes update the project directly.
- [x] Presentation and asset authoring covers menu, introductions, calendar,
  atlas, officer creation, portrait choices, local images, asset IDs and
  hashes. Evidence: own uploaded resources appear and survive package export.
- [x] Character previews show the selected authored portrait, appearance,
  skin and equipment with the actual renderer. Evidence: live preview and
  mounted selected-profile checks.
- [x] Quest and dialogue sandboxes use engine evaluators, real costs,
  prerequisites, deadlines, rewards, failures and saved continuation.
  Evidence: authored success/failure cases, isolated reset, save and continued play.
- [x] Campaign, tactical, weapon and building sandboxes use the current draft
  package. Tests and reports stay inside the studio. Evidence: actual authored
  playtests without changing an installed campaign or its saves.
- [x] The studio uses the same package, map, reference and resource validation
  as the author CLI. Errors name the affected section. A complete valid folder
  exports as an installable archive without hand-editing JSON or running a CLI.
  Evidence: browser export passes the existing folder compiler and round trip.
- [x] The website is usable with keyboard and at narrow widths. Documentation
  covers a complete author workflow. Typecheck, affected editor checks, build
  and visible browser evidence match the final source. Historical campaign
  playthroughs remain outside this goal.
- [x] Progress is committed and published through work PRs to
  `feature/campaigns`; PR #334 published it in `main` with current scope and
  evidence.

## Acceptance scope and publication

The eleven implementation rows above are satisfied for every field admitted
by the current package format, through specialized controls or complete
structured fields. The [evidence record](../evidence/campaign-studio-2026-10-10/README.md)
links the 57-case final studio/CLI gate, typecheck, hosted production export
`ee2f1aaf0cb1`, actual quest/renderer/download/project-reload review, and the
earlier affected checks. Browser file selection was blocked by the automation
setup. Production ZIP reimport and sandbox test-save continuation were not
visually established; mounted/API checks cover those paths. Narrow review was
of Resources at 390 × 844, not every panel.

Studio PR #337 merged into `feature/campaigns` as
`c2e7ae602418075c9270c1e72e431ef92d140d74`. PR #334 records the
engine-separation and studio scope, evidence and test limits. It merged into
`main` on 11 October 2026 as `0a04f72c1c0a1b0ec56a8db84668f2e3b12a722e`.
This acceptance does not add arbitrary executable mechanics, unrestricted
meshes or a hosted community service. It does not certify the full game or
historical campaign routes. The historical `0.1` tag remains unchanged.

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
