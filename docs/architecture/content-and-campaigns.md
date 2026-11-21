# Content and campaigns

[Architecture guide](README.md) · [Authoring use cases](use-cases/authoring.md) · [Rendering](rendering.md) · [Build and tooling](build-and-tooling.md)

This page explains how published campaign packages (`packages/campaign-format`), runtime package compilation (`packages/game/campaign-library.js`), trusted scenario implementations (`content/campaigns/`), and the independent campaign editor (`apps/campaign-editor`) work together. It connects the component boundaries in [C4 views](c4.md) and the [system map](system-map.md) to the authoring intentions in [authoring use cases](use-cases/authoring.md), the save representations in [persistence](persistence.md), and the staging pipeline in [build and tooling](build-and-tooling.md).

Campaigns are authored data packages interpreted by the game rather than executable plug-ins. A campaign manifest selects one of the engine's allowlisted scenario contracts (`generic-v1` or `granaderos-historical-v1`); it never loads arbitrary JavaScript from an imported package.

## At a glance

The flowchart below shows how `Campaign package files` and `manifest.json` pass through the `campaign registry`, `compileCampaignPackage`, and `Campaign library / install` into `Validate world, maps, data, assets` to produce `Resolved campaign definitions` for `Runtime campaign and battle` and `Static build campaign staging`.

```mermaid
flowchart TB
  Files[Campaign package files] --> Manifest[manifest.json]
  Manifest --> Registry[campaign registry]
  Files --> Compile[compileCampaignPackage]
  Manifest --> Compile
  Registry --> Load[Campaign library / install]
  Compile --> Validate[Validate world, maps, data, assets]
  Load --> Validate
  Validate --> Package[Resolved campaign definitions]
  Package --> Play[Runtime campaign and battle]
  Package --> Export[Static build campaign staging]
```

Each campaign `manifest.json` identifies the campaign and references five JSON documents: `content`, `world`, `maps` (a map index), `presentation`, and `assets`. Both `Campaign library / install` ([`apps/web/lib/campaign-library.ts`](../../apps/web/lib/campaign-library.ts)) and `Static build campaign staging` ([`tools/campaign-export.mjs`](../../tools/campaign-export.mjs)) pass loaded documents to `compileCampaignPackage` in [`packages/game/campaign-library.js`](../../packages/game/campaign-library.js), which constructs an immutable [`CampaignDefinition`](../../packages/campaign-format/campaign-definition.ts) and resolves runtime playable definitions. (Under the [accepted architecture plan](../plans/accepted/domain-architecture.md), `CampaignCompiler` in `packages/game/application` is the target application service for turning a validated `CampaignDefinition` into domain objects.)

The JSON snippet below shows a minimal authored `manifest.json` structure (based on the starter scaffold in [`apps/campaign-editor/infrastructure/project-scaffold.ts`](../../apps/campaign-editor/infrastructure/project-scaffold.ts)):

```json
{
  "format": "granaderos-campaign",
  "version": 1,
  "id": "sample-campaign",
  "name": "Sample Campaign",
  "revision": "1",
  "scenario": "generic-v1",
  "content": "content.json",
  "world": "world.json",
  "maps": "maps/index.json",
  "presentation": "presentation.json",
  "assets": "assets.json"
}
```

Here `format` (`"granaderos-campaign"`) and `version` (`1`) identify the manifest schema; `id`, `name`, and `revision` define the package identity; `scenario` selects an allowlisted scenario ruleset (`"generic-v1"` or `"granaderos-historical-v1"`); `content`, `world`, `presentation`, and `assets` name relative JSON document paths; and `maps` points to a map catalog JSON file (`{ "maps": [{ "id": "camp", "path": "camp.json" }] }`) rather than a single sector map. The `assets` document lists package-relative asset paths under `assets/` with expected SHA-256 digests.

## Package layout and validation contract

A published campaign package lives under `content/campaigns/<id>/` and contains `manifest.json`, the five referenced JSON documents, individual map JSON files, and packaged media files. The campaign registry (`index.json`) uses format `granaderos-campaign-registry` (version `1`) to map each installed campaign's `id`, `name`, and `revision` to `<id>/manifest.json`.

The flowchart below shows the validation sequence inside `compileCampaignPackage`: from `Manifest` through `Manifest and data validation`, `Content + world + maps + presentation + assets`, `World and map checks`, `Selected asset and path checks`, `Resolve content definitions`, and `Campaign content report` to either a `Resolved package` or `Reject`.

```mermaid
flowchart TB
  M[Manifest] --> S[Manifest and data validation]
  S --> D[Content + world + maps + presentation + assets]
  D --> W[World and map checks]
  W --> A[Selected asset and path checks]
  A --> R[Resolve content definitions]
  R --> C[Campaign content report]
  C -->|no blocked findings| P[Resolved package]
  C -->|blocked / invalid| X[Reject]
```

First, `new CampaignDefinition(manifest, documents)` in `packages/campaign-format/campaign-definition.ts` validates the `Manifest`, runs `CampaignContentSchema` (`packages/campaign-format/content-schema.js`), checks world and map schemas, validates presentation and asset catalog references, freezes the documents, and computes a deterministic content identity (`contentIdentity`). Next, `compileCampaignPackage` in `packages/game/campaign-library.js` enforces 20x16 map dimensions, scenario-specific playability rules (such as requiring an enemy spawn in `generic-v1`), building-architecture references, and world-to-map locality coverage, resolves defaults via `resolveContent`, and runs `campaignContentReport` ([`packages/game/campaign-content.js`](../../packages/game/campaign-content.js)) to `Reject` any package with blocked findings. The resulting `Resolved package` carries `campaignOrigin` (`{ version: 1, id, revision }`).

## Authoring paths and persistence boundaries

The independent `apps/campaign-editor` application is served at `/campaign-editor/` (with focused `?workspace=story` and `?workspace=sector` views). The game runtime (`packages/game` and `apps/web`) never imports editor code.

Inside the editor:

- [`CampaignProject`](../../apps/campaign-editor/domain/campaign-project.ts) and [`CampaignProjectDocument`](../../apps/campaign-editor/domain/project-document.ts) own mutable draft identity, envelope invariants, document edits, and base64 resource maps.
- [`CampaignProjectHistory`](../../apps/campaign-editor/domain/campaign-project-history.ts) owns bounded in-memory undo/redo snapshots (up to 50 steps), mutated by [`EditCampaignProjectUseCase`](../../apps/campaign-editor/application/edit-campaign-project/edit-campaign-project.use-case.ts), [`UndoCampaignProjectEditUseCase`](../../apps/campaign-editor/application/undo-campaign-project-edit/undo-campaign-project-edit.use-case.ts), and [`RedoCampaignProjectEditUseCase`](../../apps/campaign-editor/application/redo-campaign-project-edit/redo-campaign-project-edit.use-case.ts) through their own narrow repository interfaces at an expected project revision.
- [`CampaignWorld`](../../apps/campaign-editor/domain/campaign-world.js) owns strategic locality, district, place, and route draft invariants; [`CampaignMap`](../../apps/campaign-editor/domain/campaign-map.js) owns the fixed 20x16 campaign map slot; and [`SectorMap`](../../apps/campaign-editor/domain/sector-map.js) with [`SectorMapHistory`](../../apps/campaign-editor/domain/sector-map-history.js) owns physical sector map command batches (`SectorMapCommand`) applied through [`EditSectorMapUseCase`](../../apps/campaign-editor/application/edit-sector-map/edit-sector-map.use-case.ts).
- [`ValidateCampaignProjectUseCase`](../../apps/campaign-editor/application/validate-campaign-project/validate-campaign-project.use-case.ts) reads the project through its read-only repository and invokes [`packages/game/public/campaign-editor-api.ts`](../../packages/game/public/campaign-editor-api.ts) to return structured diagnostics without mutating the draft.

The table below contrasts each content `Representation`, its `Shape / storage`, and its `Role` across authoring, publication, and play.

| Representation | Shape / storage | Role |
| --- | --- | --- |
| Campaign project (`CampaignProject`) | `granaderos-editor-project` (version `1`) with `documents`, `mapIndex`, and base64 `resources` ([`create-project.js`](../../apps/campaign-editor/infrastructure/create-project.js)) | Mutable authoring draft; structural envelope checks allow incomplete or invalid drafts to be edited and saved locally while validation reports outstanding issues |
| Editor browser record | IndexedDB database `granaderos.campaign-studio.v1`, object store `projects`, storing binary resources as `Blob` values ([`campaign-studio-storage.ts`](../../apps/campaign-editor/web/lib/campaign-studio-storage.ts)) | Durable local draft storage in the browser (`localStorage` in Studio only remembers the last active project ID) |
| Editor history and archive files | Bounded in-memory undo/redo snapshots (`CampaignProjectHistory` / `SectorMapHistory`); Studio downloads `${id}.project.json`, imports `.json` or `.zip`, and exports `${id}-${revision}.zip` ([`campaign-studio-files.ts`](../../apps/campaign-editor/web/lib/campaign-studio-files.ts)) | Undo/redo history and portable project or installable package file downloads |
| Installed campaign (`CampaignPackage`) | Registry entry plus `manifest.json`, five JSON documents, map files, and SHA-256-checked asset bytes | Immutable published content loaded by the browser game and staged by the static build |
| Gameplay progress (`GameSnapshot`) | Portable save envelope (`format: "granaderos"`) in `localStorage` or exported JSON ([`save.ts`](../../packages/game/save.ts)) | Player campaign and sector progress, completely separate from editor drafts and undo history |

The editor supports two isolated playtest paths that never touch player saves or mutate the authoring draft:

- **Single-map playtest:** The sector and building workspaces call `packages/game/public/campaign-editor-api.ts` (backed by [`packages/game/map-playtest.js`](../../packages/game/map-playtest.js)) and render the resulting battle state through [`apps/web/game-preview.ts`](../../apps/web/game-preview.ts).
- **Full-campaign Quest Sandbox:** [`apps/campaign-editor/web/app/studio/QuestSandbox.tsx`](../../apps/campaign-editor/web/app/studio/QuestSandbox.tsx) calls [`packages/game/public/campaign-playtest-api.ts`](../../packages/game/public/campaign-playtest-api.ts) to run a seeded campaign and tactical battles in an isolated session, with its own `granaderos-editor-sandbox` fixture export/import bound to the project's content identity hash.

## Runtime loading and build-time staging paths

The sequence diagram below shows how the browser's `Installed campaign loader` ([`apps/web/lib/campaign-library.ts`](../../apps/web/lib/campaign-library.ts)) fetches a campaign from the `Static asset host`, compiles it with `compileCampaignPackage`, and checks asset digests through the `Resource verifier` (`verifyCampaignResources`).

```mermaid
sequenceDiagram
  participant Loader as Installed campaign loader
  participant Host as Static asset host
  participant Compiler as compileCampaignPackage
  participant Hash as Resource verifier
  Loader->>Host: GET campaigns/index.json
  Host-->>Loader: Registry entries and manifest path
  Loader->>Host: GET manifest.json
  Host-->>Loader: Manifest with five document paths
  par Fetch five documents
    Loader->>Host: GET content, world, maps index
    Host-->>Loader: JSON documents
  and
    Loader->>Host: GET presentation and assets
    Host-->>Loader: JSON documents
  end
  loop Each listed map
    Loader->>Host: GET map JSON file
    Host-->>Loader: Map document
  end
  Loader->>Compiler: Pass manifest and loaded documents
  Compiler-->>Loader: Resolved definitions or validation error
  Loader->>Hash: Verify referenced resource bytes
  Hash->>Host: GET campaign asset bytes
  Host-->>Hash: Resource bytes
  Hash-->>Loader: Hash checks complete or mismatch
```

At build time, static staging follows a separate filesystem sequence. The sequence diagram below shows how `tools/build-web.mjs` invokes `tools/campaign-export.mjs` to read each `content/campaigns/<id> folder`, validate it through `compileCampaignPackage`, check SHA-256 asset digests, and write the staged files to `.output/dist/campaigns`.

```mermaid
sequenceDiagram
  participant Build as tools/build-web.mjs
  participant Export as tools/campaign-export.mjs
  participant Source as content/campaigns/<id> folder
  participant Compiler as compileCampaignPackage
  participant Dist as .output/dist/campaigns
  Build->>Export: stageCampaigns(root, destination)
  Export->>Source: discover manifest.json folders
  Export->>Source: verifyCampaignFolder per registry entry
  Source-->>Export: manifest, five documents, map JSON, resource bytes
  Export->>Compiler: Compile package documents
  Compiler-->>Export: Resolved definitions or validation error
  Export->>Source: Compare resource bytes with SHA-256 catalog
  Export->>Dist: Copy JSON and assets for each valid campaign
  Export->>Dist: Write registry index.json last
```

Default historical campaign data is exported by [`content/campaigns/default.js`](../../content/campaigns/default.js), and historical scenario rules live under [`content/campaigns/granaderos/scenario.js`](../../content/campaigns/granaderos/scenario.js), invoked through [`packages/game/campaign-scenario.js`](../../packages/game/campaign-scenario.js).

Source anchors: [`packages/campaign-format/campaign-definition.ts`](../../packages/campaign-format/campaign-definition.ts), [`packages/game/campaign-library.js`](../../packages/game/campaign-library.js), [`packages/game/campaign-assets.js`](../../packages/game/campaign-assets.js), [`packages/game/campaign-content.js`](../../packages/game/campaign-content.js), [`packages/game/campaign-package-storage.js`](../../packages/game/campaign-package-storage.js), [`apps/campaign-editor/domain/campaign-project.ts`](../../apps/campaign-editor/domain/campaign-project.ts), [`apps/campaign-editor/infrastructure/project-validation.js`](../../apps/campaign-editor/infrastructure/project-validation.js), [`tools/campaign-export.mjs`](../../tools/campaign-export.mjs), and [`tools/campaign-authoring.mjs`](../../tools/campaign-authoring.mjs).
