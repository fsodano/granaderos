# Extend the campaign editors

Updated: 27 October 2026.

[Development index](README.md) · [Author workflow](../authoring/campaign-studio.md) · [Editor experience plan](../plans/editor-experience.md)

This guide describes the current project and controlled-editor contracts.
Use it when adding a field, workspace or editor control. The
[editor experience plan](../plans/editor-experience.md) records planned UX/DX
acceptance; it does not certify changes that are still being implemented.

## Start the tools

Use a Node.js version that supports native TypeScript type stripping. From the
repository root, install both browser packages and start the independent editor:

```sh
npm ci --prefix apps/web
npm ci --prefix apps/campaign-editor
npm --prefix apps/campaign-editor run dev
```

Open the printed address at `/campaign-editor/`. The default workspace edits a
complete project. `?workspace=story&campaign=<installed-id>` and
`?workspace=sector&campaign=<installed-id>` open focused content and map drafts.
The game routes `/studio`, `/story`, and `/editor` link to this application.

`pagePath` and `sitePath` apply the editor deployment prefix to pages and assets.
`gamePath` in `apps/campaign-editor/web/lib/game-path.ts` applies the game prefix for
player launch and return links. Do not hardcode a deployment prefix in authored
image references.

## Find the owner of a change

| Responsibility | Source |
| --- | --- |
| Master project lifecycle, selection, validation and panel routing | `apps/campaign-editor/web/app/studio/page.tsx` |
| Named workspace groups, navigation and section metadata | `apps/campaign-editor/web/app/studio/StudioNavigation.tsx` |
| Shared structured fields and optional JSON document view | `apps/campaign-editor/web/app/studio/FieldEditor.tsx` |
| In-memory staged text, document keys and close warning | `apps/campaign-editor/web/app/studio/DocumentDrafts.tsx` |
| Shared author theme, focus, actions and status tokens | `apps/campaign-editor/web/app/editor-tools.css`; route styles in each editor folder |
| World, map, building, content, presentation and resource panels | Named `*Workspace.tsx` modules in `apps/campaign-editor/web/app/studio/` |
| Reusable content editor and its standalone adapter | `apps/campaign-editor/web/app/story/ContentEditor.tsx`; `apps/campaign-editor/web/main.tsx` selects its workspace |
| Reusable map editor and its standalone adapter | `apps/campaign-editor/web/app/editor/SectorEditor.tsx`; `apps/campaign-editor/web/main.tsx` selects its workspace |
| Project mutations and envelope admission | `apps/campaign-editor/domain/campaign-project.ts` |
| Generic project creation | `apps/campaign-editor/infrastructure/create-project.js`, `apps/campaign-editor/infrastructure/project-scaffold.js` |
| Linked world/map changes and building templates | `apps/campaign-editor/infrastructure/world-editing.js` |
| Browser folder/ZIP import, export and installed-package reading | `apps/campaign-editor/web/lib/campaign-studio-files.ts` |
| Durable project bytes | `apps/campaign-editor/web/lib/campaign-studio-storage.ts` |
| Master undo/redo | `apps/campaign-editor/domain/campaign-project-history.ts`; browser adapter in `apps/campaign-editor/web/lib/campaign-studio-history.ts` |
| Project resource preview resolution | `apps/campaign-editor/web/lib/campaign-studio-assets.ts` |
| Standalone campaign selection and draft keys | `apps/campaign-editor/web/lib/editor-campaign.ts` |
| Compiler and runtime package contracts | `packages/game/campaign-library.js`, `packages/game/content-package.js` and their validators |

Editor domain and application code must not read the DOM, browser storage, or
a selected route. Game imports use declared public application APIs. The
`campaign-format` package owns pure published file contracts. The CLI and browser
use the same scaffold and validators. Keep file I/O, IndexedDB, object URLs, and
UI focus in browser adapters.

## Project documents and immutable changes

`CampaignProjectDocument` is defined in `apps/campaign-editor/domain/campaign-project.ts`.
Its version-1 envelope contains raw `manifest`, `content`, `world`,
`presentation`, `maps`, `mapIndex`, `assets` and `resources`. The optional
`editor` group holds editor-only metadata such as building templates. It does
not become runtime content or an installed campaign file.

A Studio workspace receives `{project, onChange}`. Treat the project as
immutable. Return a new project from a user edit; preserve unrelated documents,
unknown authored child fields and resource bytes. Do not call `onChange` merely
because the parent supplies an updated project. That update may be undo,
redo, import or another panel's edit.

Use these existing pure operations:

| Operation | Contract |
| --- | --- |
| `createCampaignProject(id, name?)` | Creates the shared generic scaffold asynchronously. |
| `projectContent(project)` | Combines authored definitions for a controlled editor or preview without inserting `campaignOrigin`. |
| `updateProjectContent(project, next)` | Separates combined content into the raw project documents while preserving the rest of the project. |
| `renameCampaignProject(project, id, name?)` | Rewrites the project's own campaign URLs with its identity. A historical copy requires generic-rule repair. |
| `validateCampaignProject(project)` | Asynchronously checks compiler admission, map/index references and actual resource hashes. |

Prefer the linked operations in `apps/campaign-editor/infrastructure/world-editing.js` for locality and
map edits. Changing only one side of an ID reference can leave an invalid
draft. Semantic invalidity can be retained for repair; the compiler controls
test launch and installable export.

Keep active tabs, selections, search queries, camera settings and preview
motion outside the authored package. Do not put Blob URLs or compiled runtime
state in raw definitions. Authored image URLs use
`/campaigns/<id>/assets/<path>`; the preview resolver reads their project bytes.

## Embed a story or map editor

The story editor accepts `content`, `onContentChange`, `embedded`,
`initialTab` and `resolveAsset`. Studio's `ContentWorkspace` passes
`projectContent(project)` and writes changes through
`updateProjectContent(project, next)`. Use its asset resolver for portraits,
weapon images and other draft resources.

The map editor accepts `document`, `campaign`, `onDocumentChange`,
`embedded`, `templates` and `onSaveTemplate`. Studio's `MapWorkspace` selects
one raw map, passes the combined campaign context, and commits it through
`setProjectMap`. Maps retain their ID and 20 × 16 dimensions. Editor templates
belong in `project.editor.buildingTemplates`.

Embedded mode leaves storage, campaign loading, URL changes and undo/redo to
the master. It must not use the standalone draft key or register a competing
history shortcut. Standalone mode retains its route-based selected campaign,
local draft and history. Test both modes when changing the reusable editor.

## Add a supported field or control

1. Identify the runtime validator and the raw document that owns the value.
   For a new admitted field, change its validator and runtime consumer as a
   separate explicit contract change. A label or form cannot add a mechanic.
2. Reuse the existing workspace and `FieldEditor` where suitable. Supply a
   readable label and its full path, such as `presentation.calendar.month`.
   Keep type, unit, help and supported choices consistent with admission.
3. Commit an immutable value through the owner callback. Preserve optional
   fields while editing a neighbour. Keep empty, missing and explicit `null`
   semantics distinct where the validator distinguishes them.
4. Make errors actionable. Keep invalid drafts recoverable, show the relevant
   path, and leave installable export disabled until the current project passes.
5. Add a bounded check for behavior that can regress: callback ownership,
   changed references, retained fields, undo adoption, validation, or resource
   round trip. Use mounted checks for actual controls rather than a duplicate
   of their implementation.

`FieldEditor` and `DocumentEditor` provide complete structured and optional
JSON access. Specialized forms are the ordinary author path. A document view
must not become the only way to perform an ordinary task that has a supported
form. Do not discard fields to make a draft conform to a simpler panel.

Use shared editor styles and controls instead of adding competing global
button/input rules. Name icon actions, use visible focus and native form
semantics, and provide a contained scroll region for large maps or code.
Preview effects must release listeners, renderer resources and temporary URLs.

## Own staged document text

Put `DocumentDraftProvider` at the long-lived editor owner. Studio supplies a
scope from the current project ID; the standalone story editor supplies its
story scope. A nested provider reuses the existing context instead of creating
another text store or close guard. Keep the owner mounted when panels change.
Use stable full paths in `DocumentEditor` so two maps or documents do not share
a stage accidentally.

The store is UI memory: a staged record holds `{text, base}` under
`documentDraftKey(scope, path)`. It is not an IndexedDB project field or a
runtime save. `DocumentDraftStatus` reports pending text and opens its review
path. The owner requests a browser leave warning until all stages are applied
or discarded. The user must apply or copy text before reload or close.

Applying parsed JSON calls the controlled `onChange` callback. The stage clears
only when the same document's applied props acknowledge that pending value.
A rejecting parent must leave its previous document in place; staged text
remains recoverable. Changing the document key resets pending acknowledgement
and replacement approval. Do not acknowledge one document from another
document's equal serialized value.

An external applied-data change makes the staged base conflict with current
props. The author must explicitly approve replacement. Reset that approval
when current applied data changes again. Normal autosave, download, validation
and sandbox actions read applied project documents, not the text stage.

## Reuse the interface conventions

`STUDIO_SECTIONS` supplies the typed section IDs, labels, groups, descriptions
and icons used by Studio navigation. Keep its author-facing description short.
The sidebar search filters that metadata; a compiler error routes to its named
section and shows an available file/field path. It does not automatically
focus every deeply nested field.

Use the tokens and action/status classes in `editor-tools.css` for author
surfaces. They are separate from the player HUD. Prefer route-specific layout
rules to broad selectors that override an embedded editor. Use named groups
for toolbars, visible context for the active tool and explicit no-result states.

`FieldEditor` labels and collection search preserve unknown authored fields.
Its numeric editor retains partial text while applied data stays numeric;
equivalent typing or blur must not emit another change or erase redo history.
Keep finite-number handling in the control and domain bounds in the validators.
The strategic world grid uses one roving tab stop. Story tabs and entity lists
use roving focus; tactical cells retain their existing Enter action. Test the
actual selected context and callback, not only the rendered labels.

## Run bounded checks

Run these commands from the repository root. They are command examples, not
claims that the current working changes passed.

| Change | Focused check |
| --- | --- |
| Project model, revisions, history, publication and playtest isolation | `npm --prefix apps/campaign-editor test` |
| Published package contract | `npm --prefix packages/campaign-format test` |
| Shared live/editor conversation | `node --test tests/talk-to-character.test.mjs` |
| Editor types | `npm --prefix apps/campaign-editor run typecheck` |
| Independent editor bundle and boundaries | `npm --prefix apps/campaign-editor run build` |
| Complete nested-path export | `GRANADEROS_BASE_PATH=/granaderos npm run build` |
| Documentation | `npm run audit:docs` |

Use an actual browser for field behavior, focus, narrow layouts, file pickers,
and WebGL previews. Model tests and a successful build do not establish these
visible behaviors.

The general [development setup](getting-started.md#checks) describes the
repository suites. Use affected editor checks and record their exact results. A
complete campaign run is a separate verification scope. Do not call a selected file list a full game gate.

Record the final source, commands, failures/skips, tested routes and viewports.
Use actual browser screenshots for hierarchy and narrow layouts. Report a
blocked file picker or untested route directly. Keep historical receipts
unchanged; a later source needs its own acceptance evidence.

The [11 October editor evidence](../evidence/editor-experience-2026-10-11/README.md)
records a dated editor check. Current independent-package browser evidence is
listed in the [editor README](../../apps/campaign-editor/README.md#browser-evidence).
