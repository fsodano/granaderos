# Campaign studio

Updated: 11 October 2026.

[Documentation index](../README.md) · [Campaign folder format](../development/campaign-authoring.md) · [Studio acceptance plan](../plans/campaign-studio.md)

The campaign studio is the active website authoring work on top of the
`feature/campaigns` package implementation. Its route is `/studio`. The
project, file and storage foundation is delivered; the master website and its
visible acceptance checks are still in progress. This guide records the current
interfaces and workflow. It does not certify a complete creator website.

Read the [studio evidence record](../evidence/campaign-studio-2026-10-10/README.md)
for completed checks and pending evidence. The historical `0.1` tag remains a
separate game checkpoint and does not include the studio.

## One project

A project contains a campaign's manifest, content, world, presentation, map
index, tactical maps, resource catalogue and actual resource bytes. Specialized
workspaces edit this shared project. They do not require exporting a character
file and manually copying it into a separate map draft.

The portable project format is `granaderos-editor-project`, version `1`:

```text
project
  manifest              campaign identity, revision and document paths
  content               characters, equipment, quests, rules and story
  world                 geography, localities, roads and world definitions
  presentation          menu, introduction, calendar and portrait catalogue
  maps                  map documents keyed by map ID
  mapIndex              map IDs and paths relative to the index directory
  assets                IDs, package paths, MIME types and SHA-256 values
  resources             package paths with {type, base64} resource bytes
  editor                optional editor metadata, including building templates
```

The documents retain authored fields. The compiled runtime package is a copy
used for validation and playtests. Its `campaignOrigin` is not inserted into
editable content. Gameplay saves and sandbox snapshots are separate from the
editable project.

## Create or open

The new-project helper creates the same generic scaffold as the author CLI:
two connected localities, a complete fixed strategic grid, two tactical maps,
one recruit, a tool, one local neutral portrait, a calendar and a day-two
chapter objective. It includes no Granaderos actors or campaign images.

Use a new lowercase campaign ID with letters, digits and hyphens. Each installed
folder uses the same ID. Campaign name and revision are separate fields. Keep
stable character, weapon, locality, map and quest IDs when revising a campaign.
The scaffold is an editable starting point; replace its text, forces, art and
objectives before distributing it.

Use **Crear campaña** to open the scaffold. The section menu opens **Mundo**,
**Mapas tácticos**, **Edificios**, **Historia y personajes**, **Presentación**,
**Recursos**, **Pruebas**, **Validación y descarga**, and **Todos los documentos**.
These sections edit the same project and share its history.

The website can use three input forms:

| Input | Result |
| --- | --- |
| Portable project JSON | Opens the editable documents, bytes and editor metadata. |
| A complete campaign folder selected in the browser | Reads the manifest's referenced documents, map index and local resources. |
| A campaign ZIP with one complete folder | Reads stored or deflated files and keeps the same raw documents and bytes. |

The installed-package loader also opens a complete copy of an installed
campaign, including its local resources. It checks that registry identity,
manifest identity and resource bytes agree. Opening a copy does not change the
installed folder.

Changing the campaign ID rewrites its own `/campaigns/<id>/...` references in
one operation. References to other campaigns are not rewritten. A copied
historical package that receives a new ID selects `generic-v1`; historical
JavaScript scenario hooks are not portable authored mechanics. The copy must
then meet generic map and content requirements before it can be exported.

For a Granaderos copy, add a reachable player spawn and enemy spawn to each
tactical map. In **Presentación**, replace or remove the sample battle's
original actor selection: generic copies use their own actor IDs. In
**Historia y personajes**, author chapters and their objectives if the copy
needs campaign progression. The historical scenario's objectives do not
transfer. The duplicate retains the raw authored maps and text; it does not
invent new spawns, actors or a story. Use **Validación y descarga** to check
the remaining repairs. An invalid copy can still be saved as a project.

## Workspaces

The current components provide specialized controls and full structured field
editing. A document view also permits JSON text editing. Use the structured
controls for ordinary authoring. The document view preserves access to every
supported optional field and permits repair of invalid drafts.

Imports, artillery supply/trading, ammunition markets and roadside placement
records use the full structured fields where a dedicated form is absent.
Legacy priming and flint supply conditions retain their compatibility meaning
in those fields; they are not offered as new live supply conditions.

| Workspace | Editable package surfaces and preview |
| --- | --- |
| Campaign identity | Manifest ID, name, revision and referenced document paths. |
| Characters and NPCs | Identity, portrait, skin, sprite family, attributes, recruitment, service, progression, equipment, supplies, wounds, traits, abilities, speech and encounter dialogue. |
| Weapons and forces | Supported weapon profiles, ammunition, alternate loads, artillery, force equipment and force appearance. Weapon previews use the current draft. |
| Dialogue, quests and story | Conditions, choices, effects, quest states, delivery and escort errands, placements, chapter objectives, victory and defeat, timed events and discoveries. |
| Campaign rules | Starting territory, headquarters, roles, foundry, treasury, contracts, arrival sites, medical care, militia and artillery policies. |
| Strategic world | All 36 by 33 cells, localities, districts, roads, cities, factions, projection, geography, income, physical sources, scene links, deployment, expansion, weather and invasion policies. |
| Tactical maps | Terrain, walls, openings, rooms, props, items, spawns, exits, lights, supported height fields, roof slabs and climbing links. Each installed map is 20 by 16 cells. |
| Buildings | Shared architecture styles, wall and trim pigments, height, roof, finishes, exterior details, map placement and reusable editor templates. Actual 3D previews use the current package. |
| Presentation | Menu text and art, introduction scenes and chart, calendar, atlas labels, manual, portrait chooser, officer-creation labels and sample battle. |
| Resources | PNG, JPEG, WebP and JSON files, stable asset IDs, local paths, reference usage, replacement, rename and actual byte hashes. |
| Campaign sandbox | Real recruitment, travel, tactical entry, dialogue, quests, time, costs, rewards, failures and saved continuation. |

Specialized world operations keep linked localities, cells, districts and maps
consistent. Deletion can require the author to reassign existing references.
Direct field editing does not automatically repair every reference; validation
reports remaining invalid links.

A character preview selects the authored portrait, sprite, skin and equipment.
Its direction, motion and posture controls affect only the preview. Supported
sprite archetypes, weapon templates, renderer materials and architecture kinds
remain engine contracts. The studio does not import arbitrary animated meshes
or add executable mechanics.

Building styles set default pigments, roof and visual height. Explicit map
roof and finish fields take precedence. Metric roof slabs determine rendered
wall height when supplied. Existing exterior-detail flags do not create
additional collision cells or playable floors. See the
[building format](../development/campaign-authoring.md#building-styles-and-map-layout)
for supported profiles and limits.

## Include images and other resources

A resource is part of the project, rather than a reference to an author machine.
Its portable path starts with `assets/`. Authored image references use
`/campaigns/my-campaign/assets/<path>`. Do not insert a deployment prefix such as
`/granaderos` into that reference.

Resource replacement hashes the actual new bytes and retains the existing
asset ID for the same path. Resource renaming must update its authored
references. Removing a file does not silently remove character or menu
references; those references must be reassigned or repaired.

Live browser previews resolve project resources from their bytes. Temporary
data or Blob URLs belong only to the preview. They must not enter stored definitions
or the installable package. JSON metadata resources remain files inside
`assets/`; they are not executable code.

## Validate and repair

Invalid authored drafts can be saved and reopened. Validation and campaign
export remain separate steps. Malformed project structure, unsafe JSON keys or
invalid binary encoding cannot be admitted as a project.

Project validation uses the existing campaign compiler, content integration
report, world and presentation validators, and map validator. It also checks:

- The manifest, map index and all document paths are safe and nonduplicated.
- Every tactical map has an index entry and the required IDs and dimensions.
- Localities and scenes have the maps their definitions require.
- Authored images belong to the package and appear in its resource catalogue.
- Every declared resource file exists, has the declared type and matches its
  SHA-256 value calculated from actual bytes.
- Every resource stored in the project is declared in the catalogue.

The result lists issues by section with file or field paths when available.
The installable campaign ZIP is blocked while validation has errors. An
imported missing-file draft can be repaired by replacing the missing resource
without changing its asset ID or other content.

Archive and directory admission has bounded limits: 4096 files, 16 MiB per
file, 128 MiB in total, and 8 MiB per JSON document. Existing content and map
validators can impose smaller limits. ZIP import rejects traversal, duplicate
paths, encrypted or split archives, ZIP64, symlinks and other special files.
Only JSON, PNG, JPEG and WebP package files are admitted. ZIP file sizes and
CRC values are checked in addition to the campaign's resource hashes.

A valid package establishes supported definitions and dependencies. It does
not establish a balanced, polished or historically accurate campaign.

## Test the draft

The campaign sandbox runs a copy through the game's strategic and tactical
actions. Recruitment, travel, conversation requirements, finite resources,
costs, deadlines and effects retain their runtime rules. The test setup can
use an explicitly different initial treasury without changing the project.

Restart the test after changing the draft. Its content identity prevents a
saved sandbox from being reopened against different project definitions.
Sandbox save and restore use the real game save reader. Test receipts and
runtime progress do not become campaign definitions or installed save slots.

The sandbox retains at most 2,000 command receipts. Automatic approach uses
at most 240 actual steps. The seed is an unsigned 32-bit integer; an optional
test treasury is between 0 and 1,000,000,000. Sandbox imports are capped at
50 MB and the inner game save remains subject to its 5,000,000-byte limit.
Waiting can leave a peaceful visit; it does not finish an active battle.
Quests complete through actual conditions and actions, rather than a forced
completion control.

The map and building previews also use the selected draft context. Use the
actual character and tactical renderer to inspect authored appearance and
geometry. A preview is not a full campaign playthrough or a sustained frame-rate
measurement.

## Save, download and install

Browser persistence uses IndexedDB. It stores complete projects atomically,
with resource bytes as binary Blobs. It does not put all image strings into
localStorage. Projects are keyed by campaign ID. Keep a downloaded project copy
before clearing browser data or moving to another device.

The two downloads have different purposes:

| Download | Contents and use |
| --- | --- |
| Portable project JSON | All editable documents, resource bytes and optional editor metadata. Use it to recover or exchange an editable project. |
| Installable campaign ZIP | One `<campaign-id>/` folder with manifest, referenced JSON, map index, tactical maps and local resources. Optional editor templates and runtime save state are excluded. |

Map buildings already placed from templates remain in the runtime maps. The
template catalogue itself survives project JSON and browser persistence; it is
not a runtime campaign dependency.

Extract a valid campaign ZIP under `campaigns/` in a compatible engine checkout,
so the resulting path is `campaigns/<id>/manifest.json`. The development server
and build discover its manifest. The existing CLI command remains available:

```sh
npm run campaign:check -- ./campaigns/my-campaign
```

A browser author can prepare and download the complete folder without a CLI.
Installing it into a hosted game's campaign registry still requires the host
owner to add that folder and publish the game. This website does not upload a
campaign to a community catalogue or deploy it to GitHub Pages.

## Acceptance boundary

The package, archive, byte-integrity and storage foundation has focused test
coverage, including the complete Granaderos package and acceptance by the
existing folder validator. The master website workflow, browser recovery,
keyboard use, narrow layout and actual visible export/preview checks remain
pending. Consult the [evidence record](../evidence/campaign-studio-2026-10-10/README.md)
and [acceptance plan](../plans/campaign-studio.md) for current results.

Full historical campaign routes, game balance, release readiness, unrestricted
renderer imports and community hosting are outside this studio verification.
