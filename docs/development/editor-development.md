# Extend the campaign editors

Updated: 11 October 2026.

[Development index](README.md) · [Author workflow](../authoring/campaign-studio.md) · [Editor experience plan](../plans/editor-experience.md)

This guide describes the current project and controlled-editor contracts.
Use it when adding a field, workspace or editor control. The
[editor experience plan](../plans/editor-experience.md) records planned UX/DX
acceptance; it does not certify changes that are still being implemented.

## Start the tools

Install Node.js 22.13.0 or later. From the repository root, run:

```sh
npm ci --prefix web
npm run dev
```

Use the address printed by the server. `/studio` edits a complete project.
`/story?campaign=<installed-id>` and `/editor?campaign=<installed-id>` open
standalone content and map drafts for an installed campaign. If the server
uses a deployment prefix, include it before the route. Generate UI links
with `pagePath` from `web/lib/site-path.js`; use `sitePath` for installed
resources. Do not hardcode `/granaderos` in authored image references.

## Find the owner of a change

| Responsibility | Source |
| --- | --- |
| Master project lifecycle, selection, validation and panel routing | `web/app/studio/page.tsx` |
| Shared structured fields and optional JSON document view | `web/app/studio/FieldEditor.tsx` |
| World, map, building, content, presentation and resource panels | Named `*Workspace.tsx` modules in `web/app/studio/` |
| Reusable content editor and its standalone adapter | `web/app/story/ContentEditor.tsx`; `/story/page.tsx` mounts it |
| Reusable map editor and its standalone adapter | `web/app/editor/SectorEditor.tsx`; `/editor/page.tsx` mounts it |
| Pure project creation, content split, identity rewrite and admission | `game/campaign-editor-project.js`, `game/campaign-scaffold.js` |
| Linked world/map changes and building templates | `game/campaign-editor-world.js` |
| Browser folder/ZIP import, export and installed-package reading | `web/lib/campaign-studio-files.ts` |
| Durable project bytes | `web/lib/campaign-studio-storage.ts` |
| Master undo/redo | `web/lib/campaign-studio-history.ts` |
| Project resource preview resolution | `web/lib/campaign-studio-assets.ts` |
| Standalone campaign selection and draft keys | `web/lib/editor-campaign.ts` |
| Compiler and runtime package contracts | `game/campaign-library.js`, `game/content-package.js` and their validators |

Pure helpers in `game/` must not read the DOM, browser storage or a selected
route. The CLI and browser use the same scaffold and package validators.
Keep browser file I/O, IndexedDB, object URLs and UI focus in the web layer.

## Project documents and immutable changes

`CampaignEditorProject` is exported by `web/lib/campaign-studio-files.ts`.
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

Prefer the linked operations in `campaign-editor-world.js` for locality and
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

## Run bounded checks

Run these commands from the repository root. They are command examples, not
claims that the current working changes passed.

| Change | Existing focused checks |
| --- | --- |
| Master shell, validation, recovery or keyboard | `node --test tests/campaign-studio-mounted.test.mjs` |
| Embedded content editor or character preview | `node --test tests/campaign-studio-content.test.mjs` plus affected story cases |
| Embedded world/map/building controls or history | `node --test tests/campaign-editor-world-mounted.test.mjs tests/campaign-editor-world.test.mjs` |
| Project model, archive or storage | `node --test tests/campaign-studio-project.test.mjs tests/campaign-studio-files.test.mjs tests/campaign-studio-storage.test.mjs tests/campaign-studio-history-assets.test.mjs` |
| Standalone content or map behavior | Affected cases in `tests/story-editor.test.mjs` and `tests/map-editor.test.mjs`; use their existing mounted fixtures for controls |
| Author CLI or shared scaffold | `node --test tests/campaign-authoring.test.mjs` |
| Types and documentation | `npm run typecheck`; `npm run audit:docs` |
| Final nested-path export | `GRANADEROS_BASE_PATH=/granaderos npm run build` |

The mounted fixtures use the existing `tests/tactical-render-loader.mjs`
for TSX imports, JSDOM for controls and `fake-indexeddb` for durable project
storage. Restore globals and unmount roots after each fixture. A JSDOM pass
does not establish real WebGL rendering or a visible browser layout.

The general [development setup](getting-started.md#checks) describes the
repository suites. For this editor-experience goal, full historical campaign
routes are outside the authorized check scope. Use affected editor checks and
record their exact results. Do not call a selected file list a full game gate.

Record the final source, commands, failures/skips, tested routes and viewports.
Use actual browser screenshots for hierarchy and narrow layouts. Report a
blocked file picker or untested route directly. Keep historical receipts
unchanged; a later source needs its own acceptance evidence.
