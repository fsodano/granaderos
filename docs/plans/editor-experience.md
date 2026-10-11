# Editor experience: author workflow and developer contracts

Updated: 11 October 2026.

Status: the bounded editor UX/DX implementation is delivered on
`codex/editor-experience`. The
[11 October evidence record](../evidence/editor-experience-2026-10-11/README.md)
records completed affected checks, final focused follow-ups and production
review of all three editor routes. Checked rows apply to those named paths;
they do not mean full accessibility certification or every possible panel
variant. The broader preview row remains open. Native file-picker interaction
was not verified in this pass. Delivery is tracked in
[PR #340](https://github.com/fsodano/granaderos/pull/340).

The [published studio record](campaign-studio.md) and
[10 October evidence](../evidence/campaign-studio-2026-10-10/README.md) retain
their original sources and limits. The historical `0.1` tag is unchanged.

The goal is to make the existing author tools easy to learn, consistent and
safe to extend. It covers `/studio`, its embedded story and map workspaces,
and the standalone `/story` and `/editor` routes. It does not add campaign
mechanics, community hosting or historical campaign playthroughs.

## Required author experience

- [x] **Hierarchy and presentation.** Each route has a clear title, active
  workspace and primary action. Related controls form named groups. Shared
  colours, spacing, typography and focus styles keep nested editors legible.
  A project action is distinguishable from a character, map or preview action.
- [x] **Project workflow.** Create, open, import, duplicate, rename and download
  have readable labels and next steps. Authors can identify the current project,
  revision, save status and validation status without leaving the workspace.
  A duplicate/import collision preserves the existing draft and gives a usable
  copy path. Installed packages and gameplay saves remain separate from drafts.
- [x] **Discoverable workspaces.** Navigation makes world, maps, buildings,
  story, characters, presentation, resources, tests and package validation easy
  to find. The current selection survives ordinary field changes. Embedded
  editors do not add a competing project header, persistence system or undo bar.
- [x] **Guided fields and collections.** Ordinary fields use author-facing
  labels, help where needed, and supported choices where available. Required
  fields and invalid values are identifiable. Lists support finding, selecting,
  adding, duplicating and removing records without losing surrounding context.
  Empty states explain the next action. Complete structured fields retain
  access to admitted optional data and preserve fields during unrelated edits.
- [x] **Validation and repair.** The current project is checked by the existing
  compiler and resource-byte validators. Errors identify their section and
  available field path, and offer a direct repair route. A pending or stale
  report cannot enable a ZIP download. Invalid semantic drafts remain editable
  and downloadable as projects; malformed input cannot replace a recoverable
  project silently.
- [x] **Save and recovery.** Pending, saved, unavailable-storage and failed-save
  states give an actionable message. Project download remains available when
  durable storage fails. Reopening a saved project retains documents and
  resource bytes. Unapplied document text is distinguishable from committed
  project changes. Leaving or replacing work must not lose it without notice.
- [x] **One history owner.** Studio undo/redo works across content, map and
  document edits. Embedded panels accept an external undo without emitting an
  old value as a new change. Standalone editors keep their own existing draft
  and history behavior. Text input undo remains native to the text field.
- [x] **Keyboard and accessible controls.** All ordinary commands have usable
  labels and visible focus. Authors can move between workspace navigation,
  fields, reports and dialogs with the keyboard. Dialog focus returns to its
  trigger. Shortcuts do not intercept normal typing or fire in two owners.
  Selected controls, status changes and errors have appropriate semantics.
- [x] **Narrow and large layouts.** Review all three routes at 390 × 844 and a
  desktop width. Text, actions, lists and reports fit the document width. Large
  maps, world grids and document code may scroll inside their named regions;
  ordinary forms must not create document-wide horizontal scrolling. Preview
  controls remain reachable without covering the preview or editor actions.
- [ ] **Useful previews.** Character, building, weapon and campaign previews
  consume the selected draft and its resources. Editing and preview controls
  are clearly separated. Preview loading/errors are visible. Layout changes
  preserve renderer cleanup, map input and authoritative game behavior.
  **Open beyond the delivered UX scope:** earlier actual character/building
  review and current mounted wiring/final map rendering do not establish every
  preview, loading state and error path on the final source.

## Required developer experience

- [x] **Reusable contracts.** The contributor guide identifies the project
  model, panel inputs, immutable change callbacks, history ownership, asset
  resolver and standalone adapters. New controls reuse shared UI conventions.
  Browser I/O stays separate from pure project and engine helpers. Metadata
  helps authors; compiler validators remain the admission authority.
- [x] **Readable extension path.** A contributor can add a field or workspace
  from the guide without copying storage, import or history logic. Changed
  modules have clear types at their boundaries and readable functions. The
  guide maps changes to bounded existing tests and local commands. Runtime
  data, editor-only metadata and preview state have separate owners.
- [x] **Source-backed acceptance.** A final record names the source commit or
  digest, commands, terminal results, browser route/origin, viewports and
  screenshots. It distinguishes mounted checks from visible browser results,
  and records failures, skipped steps and limitations. No broad completion
  claim is made from a typecheck, build or old studio receipt alone.

## Verification matrix

This matrix identifies the bounded checks and author paths. The evidence
record gives the actual completed commands and visible results; the table does
not add passing claims for every suggested action.

| Area | Bounded check | Visible review |
| --- | --- | --- |
| Studio shell, project actions and error routing | `campaign-studio-mounted.test.mjs`; add assertions for changed controls, focus and stale reports as needed | Create/open/copy, navigate sections, repair an invalid field and download the current project |
| Structured fields and document edits | `editor-fields-experience.test.mjs` and mounted workspace assertions | Find an entry, use an admitted choice, add an optional field and repair a document |
| Embedded story | `campaign-studio-content.test.mjs`, affected `story-editor.test.mjs` cases | Edit a character and dialogue in Studio; confirm selected data and owner history |
| Standalone story | Affected `story-editor.test.mjs` and mounted standalone cases | Open `/story?campaign=<id>`, edit, recover and export its separate draft |
| Embedded map and buildings | `campaign-editor-world-mounted.test.mjs` plus affected map/building cases | Edit a map, change panel, undo/redo; verify selected map and actual preview |
| Standalone map | `sector-editor-experience.test.mjs` and affected map-engine cases | Open `/editor?campaign=<id>`, use map tools, local history and export |
| Resources and durable drafts | `campaign-studio-storage.test.mjs`, `campaign-studio-files.test.mjs`, affected history/assets cases | Replace an image, reload the project and verify the image; record file-picker limitations |
| Keyboard and layout | Mounted semantics/shortcut assertions; final typecheck | Keyboard path and 390 × 844 review on Studio, story and map routes; include focused dialogs and long labels |
| Developer contracts and hosted routes | `npm run typecheck`; affected static path checks and production build | Verify `/granaderos/studio/`, `/granaderos/story/` and `/granaderos/editor/` on the final staged export |

Use the [editor contributor guide](../development/editor-development.md) for
the command map. Run affected checks as the implementation requires. Full
historical campaign routes are outside this goal; do not add them to the
editor gate. A nested deployment check proves route/resource resolution, not
a new public deployment.

## Evidence status

The [current evidence record](../evidence/editor-experience-2026-10-11/README.md)
contains the earlier 138-case affected gate and final 9-case field/6-case master
follow-ups, typecheck and nested export. Final build `9c8fc8c4bb92` was reviewed
on Studio, story and map at desktop width and 390 × 844, including keyboard
selection, search, export-dialog focus return, contained grids and staged-text
recovery. The record links ten final screenshots and distinguishes earlier
preview observations from this final route review. No historical campaign
playthrough or full repository gate was run for this editor work.
