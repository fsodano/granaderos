# ValidateCampaignProject

## Intention

Inspect a `CampaignProject` for structural, resource, and runtime playability validity without modifying project state or advancing `GameTime`.

## Actor and trigger

The campaign author or export workflow in `campaign-editor` invokes this read-only use case before publishing or exporting a `CampaignPackage`, or while inspecting draft diagnostics in the editor.

## Request

`ValidateCampaignProjectRequest` contains:

- `projectId`: the identifier of the `CampaignProject` to inspect.

## Response

`ValidateCampaignProjectResponse` combines `CampaignProjectValidation` with the inspected project revision:

- `valid`: `true` when `issues` is empty; `false` otherwise.
- `issues`: ordered `CampaignProjectIssue` entries (`{ section: string; message: string; path?: string }`) locating structural, manifest, world, presentation, content, map, resource, or package compilation problems.
- `content`: the compiled `CompiledCampaignContent` when package compilation succeeds.
- `checks`: summary counts (`{ maps: number; resources: number; resourceBytes: number }`) when envelope validation succeeds.
- `revision`: the editing revision of the loaded `CampaignProject`.

## Refusals

- If the requested project is not open or cannot be found by the repository implementation, `load(projectId)` throws `CampaignEditorRefusal` with `CampaignEditorRefusalCode.ProjectNotOpen` or `CampaignEditorRefusalCode.ProjectNotFound`.
- Document, schema, asset checksum, map, and playability failures inside an open project are returned as located `issues` with `valid: false` rather than thrown as exceptions.

## Invariants

- Validation is read-only: it never mutates `CampaignProject`, advances the editing revision, or advances `GameTime`.
- `ValidateCampaignProjectUseCase` passes an immutable `project.snapshot()` (`CampaignProjectDocument`) to the injected `CampaignProjectValidator` port.
- An incomplete or invalid project remains editable and saveable as a draft; archive publication requires `valid: true`.
- Playability checks reach `packages/game` only through its declared public API (`packages/game/public/campaign-editor-api.ts`).

## Repository

This README describes only the `ValidateCampaignProject` contract. `ValidateCampaignProjectUseCase` owns `ValidateCampaignProjectRepository`, which exposes only `load(identifier)` and has no commit method. It does not share a repository interface with mutating editor use cases.

## Domain objects and related terms

- `CampaignProject` and `CampaignProjectDocument` own the editor draft envelope inspected by the validator.
- `CampaignProjectValidator` is the application port that checks `campaign-format` schemas, asset integrity, and game playability.
- `CampaignEditorRefusal` and `CampaignEditorRefusalCode` represent repository lookup refusals.
- Related contracts: [EditCampaignProject](../edit-campaign-project/README.md) and [EditSectorMap](../edit-sector-map/README.md).
