# Campaign editor

`campaign-editor` owns editable campaign projects and the editor browser application.
It provides project identity changes, resource editing, undo/redo, browser project
storage, package validation, archive import/export, and isolated playtests.

From the repository root, start the editor with
`npm --prefix apps/campaign-editor run dev`. Open
`http://127.0.0.1:4178/campaign-editor/`. Use `?workspace=story` or
`?workspace=sector` for the focused document editors. Build its static application with
`npm --prefix apps/campaign-editor run build`. The output is `apps/campaign-editor/dist`.
The game application links to `/campaign-editor/`; its bundle does not include
editor implementation code.

## Model and boundaries

`CampaignProject` owns a valid project envelope. Authored documents can be
incomplete. Mutations validate the envelope before replacing the accepted draft.
Snapshots are copies. `CampaignProjectHistory` owns bounded copies for undo and
redo. A new edit discards the redo branch.

`EditCampaignProjectUseCase` uses `EditCampaignProjectRepository` to admit an edit
at its expected project revision. `ValidateCampaignProjectUseCase` has its own
read-only repository and a validation port. Validation does not modify the draft.
The campaign studio calls these use cases for its live edits and validation.
Undo and redo use named application contracts over the same editing repository.
Every accepted edit advances the project revision once. Opening another project
invalidates pending edits from the previous project.

`CampaignWorld` owns locality membership, anchor movement, connected land routes,
and reference-safe deletion. `CampaignMap` admits maps into fixed campaign slots
and owns building slab access. `SectorMap` owns standalone map authoring operations,
including nested object movement and template transformations. `EditSectorMap`
commits one valid command batch through its narrow repository; its history owns
undo/redo. Shared game geometry and validation enter through an injected port.
The game renderer review scenes use generated map documents, without editor rules.
Map commands use a discriminated union. Expected rule and revision refusals carry
`CampaignEditorRefusal` codes; the editor adapter translates them into Spanish.
Schema validation retains explicit diagnostics. Refused edits preserve accepted
state and history.

The `campaign-format` package owns published file contracts and content identity.
Editor drafts, published packages, and game saves have different formats.
Publication validates the package through the game validation API before it
creates the archive. Archive output excludes editor metadata.

The editor imports game rules through two declared public composition APIs:

- `packages/game/public/campaign-editor-api.js` supplies rule validation,
  authoring choices, and map/equipment previews.
- `packages/game/public/campaign-playtest-api.js` executes an isolated game
  session and produces a save-backed playtest record.

`apps/web/game-preview.ts` is the declared UI preview entry, including preview styles.
`apps/web/game-preview-assets.js` is the pure public contract for preview asset URLs. It supplies the same
field rendering components used by the game. These public entry modules use
explicit exports. `apps/campaign-editor/public/map-editing-api.js` composes the editor
map use case and repository. Public composition lives outside the application
layer. Internal source uses direct module imports.

Project state does not absorb playtest progress. A playtest record identifies
the source definition and refuses restoration against a different definition.

## Checks

- `npm --prefix apps/campaign-editor run test` checks domain mutations, revisions,
  undo/redo, publication, playtest isolation, and dependency boundaries.
- `npm --prefix apps/campaign-editor run typecheck` checks editor contracts and UI.
- `npm --prefix apps/campaign-editor run build` checks dependency boundaries and
  creates the independent application bundle.

The dependency check rejects editor imports of internal game modules. It also
walks the game entry-point dependency graph and rejects editor implementations.

## Browser evidence

On 27 October 2026, the independent editor was opened in Brave at port 4178.
The check created a project, changed its name, undid the change, obtained a valid
package report, and started a playtest. The playtest recruited its guide, entered
the camp, rendered the character and sector, and passed save/restore validation.
This check covers the editor workflow; it does not establish a full campaign run.

On 28 October 2026, the studio edit path was checked again in Brave. A project
rename, undo and redo passed. An embedded map title edit advanced the map revision;
project undo restored the original map. The standalone map route was also checked
for map editing and history. A reserved project identity was refused with its
Spanish message and left the accepted identity and revision unchanged. The
standalone map draft was recovered at its saved revision. This is a bounded
editing check.
