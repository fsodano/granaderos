# Editor experience: author workflow and developer contracts

Updated: 11 October 2026.

Status: active implementation on `codex/editor-experience`. This plan defines
the next editor UX and DX acceptance. Its unchecked rows are requirements,
not completed evidence. The [published studio record](campaign-studio.md) and
[10 October evidence](../evidence/campaign-studio-2026-10-10/README.md) retain
their original sources and limits. The historical `0.1` tag is unchanged.

The goal is to make the existing author tools easy to learn, consistent and
safe to extend. It covers `/studio`, its embedded story and map workspaces,
and the standalone `/story` and `/editor` routes. It does not add campaign
mechanics, community hosting or historical campaign playthroughs.

## Required author experience

- [ ] **Hierarchy and presentation.** Each route has a clear title, active
  workspace and primary action. Related controls form named groups. Shared
  colours, spacing, typography and focus styles keep nested editors legible.
  A project action is distinguishable from a character, map or preview action.
- [ ] **Project workflow.** Create, open, import, duplicate, rename and download
  have readable labels and next steps. Authors can identify the current project,
  revision, save status and validation status without leaving the workspace.
  A duplicate/import collision preserves the existing draft and gives a usable
  copy path. Installed packages and gameplay saves remain separate from drafts.
- [ ] **Discoverable workspaces.** Navigation makes world, maps, buildings,
  story, characters, presentation, resources, tests and package validation easy
  to find. The current selection survives ordinary field changes. Embedded
  editors do not add a competing project header, persistence system or undo bar.
- [ ] **Guided fields and collections.** Ordinary fields use author-facing
  labels, help where needed, and supported choices where available. Required
  fields and invalid values are identifiable. Lists support finding, selecting,
  adding, duplicating and removing records without losing surrounding context.
  Empty states explain the next action. Complete structured fields retain
  access to admitted optional data and preserve fields during unrelated edits.
- [ ] **Validation and repair.** The current project is checked by the existing
  compiler and resource-byte validators. Errors identify their section and
  available field path, and offer a direct repair route. A pending or stale
  report cannot enable a ZIP download. Invalid semantic drafts remain editable
  and downloadable as projects; malformed input cannot replace a recoverable
  project silently.
- [ ] **Save and recovery.** Pending, saved, unavailable-storage and failed-save
  states give an actionable message. Project download remains available when
  durable storage fails. Reopening a saved project retains documents and
  resource bytes. Unapplied document text is distinguishable from committed
  project changes. Leaving or replacing work must not lose it without notice.
- [ ] **One history owner.** Studio undo/redo works across content, map and
  document edits. Embedded panels accept an external undo without emitting an
  old value as a new change. Standalone editors keep their own existing draft
  and history behavior. Text input undo remains native to the text field.
- [ ] **Keyboard and accessible controls.** All ordinary commands have usable
  labels and visible focus. Authors can move between workspace navigation,
  fields, reports and dialogs with the keyboard. Dialog focus returns to its
  trigger. Shortcuts do not intercept normal typing or fire in two owners.
  Selected controls, status changes and errors have appropriate semantics.
- [ ] **Narrow and large layouts.** Review all three routes at 390 × 844 and a
  desktop width. Text, actions, lists and reports fit the document width. Large
  maps, world grids and document code may scroll inside their named regions;
  ordinary forms must not create document-wide horizontal scrolling. Preview
  controls remain reachable without covering the preview or editor actions.
- [ ] **Useful previews.** Character, building, weapon and campaign previews
  consume the selected draft and its resources. Editing and preview controls
  are clearly separated. Preview loading/errors are visible. Layout changes
  preserve renderer cleanup, map input and authoritative game behavior.

## Required developer experience

- [ ] **Reusable contracts.** The contributor guide identifies the project
  model, panel inputs, immutable change callbacks, history ownership, asset
  resolver and standalone adapters. New controls reuse shared UI conventions.
  Browser I/O stays separate from pure project and engine helpers. Metadata
  helps authors; compiler validators remain the admission authority.
- [ ] **Readable extension path.** A contributor can add a field or workspace
  from the guide without copying storage, import or history logic. Changed
  modules have clear types at their boundaries and readable functions. The
  guide maps changes to bounded existing tests and local commands. Runtime
  data, editor-only metadata and preview state have separate owners.
- [ ] **Source-backed acceptance.** A final record names the source commit or
  digest, commands, terminal results, browser route/origin, viewports and
  screenshots. It distinguishes mounted checks from visible browser results,
  and records failures, skipped steps and limitations. No broad completion
  claim is made from a typecheck, build or old studio receipt alone.

## Verification matrix

These are the intended checks. A test name in this table identifies a useful
existing fixture, not a passing result for this implementation.

| Area | Bounded check | Visible review |
| --- | --- | --- |
| Studio shell, project actions and error routing | `campaign-studio-mounted.test.mjs`; add assertions for changed controls, focus and stale reports as needed | Create/open/copy, navigate sections, repair an invalid field and download the current project |
| Structured fields and document edits | Mounted field/workspace assertions for the actual changed component | Find an entry, use an admitted choice, add an optional field and repair a document |
| Embedded story | `campaign-studio-content.test.mjs`, affected `story-editor.test.mjs` cases | Edit a character and dialogue in Studio; confirm selected data and owner history |
| Standalone story | Affected `story-editor.test.mjs` and mounted standalone cases | Open `/story?campaign=<id>`, edit, recover and export its separate draft |
| Embedded map and buildings | `campaign-editor-world-mounted.test.mjs` plus affected map/building cases | Edit a map, change panel, undo/redo; verify selected map and actual preview |
| Standalone map | Affected `map-editor.test.mjs` and mounted standalone cases | Open `/editor?campaign=<id>`, use map tools, local history and export |
| Resources and durable drafts | `campaign-studio-storage.test.mjs`, `campaign-studio-files.test.mjs`, affected history/assets cases | Replace an image, reload the project and verify the image; record file-picker limitations |
| Keyboard and layout | Mounted semantics/shortcut assertions; final typecheck | Keyboard path and 390 × 844 review on Studio, story and map routes; include focused dialogs and long labels |
| Developer contracts and hosted routes | `npm run typecheck`; affected static path checks and production build | Verify `/granaderos/studio/`, `/granaderos/story/` and `/granaderos/editor/` on the final staged export |

Use the [editor contributor guide](../development/editor-development.md) for
the command map. Run affected checks as the implementation requires. Full
historical campaign routes are outside this goal; do not add them to the
editor gate. A nested deployment check proves route/resource resolution, not
a new public deployment.

## Evidence status

No final editor-experience receipt is recorded yet. Record completed checks
here or link a dedicated evidence record once the implementation is frozen.
Keep the earlier studio acceptance as a baseline. It does not establish the
new theme, navigation, keyboard behavior or all three narrow layouts.
