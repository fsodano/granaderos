# EditCampaignProject

## Intention

Apply one editing operation to an open `CampaignProject` at its expected revision and advance the project history by one revision.

## Actor and trigger

The campaign author invokes this use case from `campaign-editor` when renaming a project, updating its authored content, replacing its draft envelope, or removing a resource.

## Request

`EditCampaignProjectRequest` contains:

- `projectId`: the identifier of the open `CampaignProject`.
- `revision`: the expected editing revision.
- `edit`: one discriminated operation:
  - `{ kind: 'rename'; identifier: string; name?: string }` to change the project identifier and optional display name, rewriting `/campaigns/<oldId>/` prefixes and resetting `granaderos-historical-v1` scenarios to `generic-v1` when the identifier changes.
  - `{ kind: 'replace-content'; content: JsonDocument }` to update `content` and any supplied `world`, `maps`, `presentation`, or `assets` documents while keeping `manifest.id` authoritative.
  - `{ kind: 'replace-draft'; document: CampaignProjectDocument }` to replace the draft envelope without changing `manifest.id`.
  - `{ kind: 'remove-resource'; path: string }` to delete a binary resource entry and its matching record in `assets`.

## Response

`EditCampaignProjectResponse` contains:

- `project`: the accepted `CampaignProjectDocument` snapshot.
- `revision`: the incremented editing revision.

## Refusals

Expected refusals throw `CampaignEditorRefusal` with a typed `CampaignEditorRefusalCode` and structured `details`:

- `ProjectNotOpen`: no project with `projectId` is currently open in the editing repository.
- `StaleProjectRevision`: `request.revision` does not match the repository's current revision on load or commit.
- `ReservedProjectIdentity`: a `rename` operation attempts to claim the reserved `'granaderos'` identifier from another project identity.
- `ProjectIdentityOperationRequired`: a `replace-draft` operation supplies a `manifest.id` that differs from the open project's identity instead of using `rename`.
- `InvalidProjectIdentity`: the project identifier does not match the permitted slug format (`^[a-z][a-z0-9-]{0,79}$`) or uses a reserved prototype property name.
- `InvalidProjectName`: a supplied display name is blank or exceeds 100 characters.
- `IncompatibleProjectDocument`: the draft envelope is not a valid version-1 `'granaderos-editor-project'` JSON document.
- `TooManyProjectResources`: the project exceeds the maximum resource file count.
- `InvalidProjectResource`: a resource path is outside `assets/` or its record lacks valid `type` and `base64` fields.
- `ProjectResourcesTooLarge`: the decoded resource bytes exceed the total project byte limit.

UI adapters translate `CampaignEditorRefusalCode` into Spanish player-facing messages. Structural data errors detected by `validateCampaignData` throw an `Error` with explicit diagnostic lines.

## Invariants

- A refusal leaves the open `CampaignProject`, `CampaignProjectHistory`, and editing revision unchanged.
- An accepted edit records the new `CampaignProject` snapshot in `CampaignProjectHistory`, clears any redo branch, and increments the revision by one.
- Authored content inside `CampaignProjectDocument` may remain incomplete while saved as a draft; publication readiness is inspected separately by [ValidateCampaignProject](../validate-campaign-project/README.md).
- Editing a project does not advance `GameTime` or mutate a live `GameSession`.

## Repository

This README describes only the `EditCampaignProject` contract. `EditCampaignProjectUseCase` owns `EditCampaignProjectRepository`, which exposes `load(identifier)` and `commit(identifier, project, expectedRevision)`. It does not share a repository interface with undo, redo, or validation use cases; `CampaignProjectEditingRepository` in infrastructure implements each narrow interface over the same `CampaignProjectHistory`.

## Domain objects and related terms

- `CampaignProject` and `CampaignProjectDocument` own the draft envelope, identity rules, and resource removal.
- `CampaignProjectHistory` owns the bounded undo and redo snapshots behind the repository adapter.
- `CampaignEditorRefusal` and `CampaignEditorRefusalCode` represent typed domain and revision refusals.
- Related contracts: [UndoCampaignProjectEdit](../undo-campaign-project-edit/README.md), [RedoCampaignProjectEdit](../redo-campaign-project-edit/README.md), and [ValidateCampaignProject](../validate-campaign-project/README.md).
