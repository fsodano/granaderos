# UndoCampaignProjectEdit

## Intention

Restore the previous accepted `CampaignProjectDocument` snapshot from the open project's history at the expected revision.

## Actor and trigger

The campaign author invokes this use case from `campaign-editor` through the studio toolbar or undo keyboard shortcut.

## Request

`UndoCampaignProjectEditRequest` contains:

- `projectId`: the identifier of the open `CampaignProject`.
- `revision`: the expected editing revision.

## Response

`UndoCampaignProjectEditResponse` contains:

- `project`: the active `CampaignProjectDocument` snapshot after applying the undo step (or the unchanged snapshot when no prior history step exists).
- `revision`: the new editing revision when a prior history step was restored, or the unchanged revision when the undo stack was empty.

## Refusals

Expected refusals throw `CampaignEditorRefusal` with a typed `CampaignEditorRefusalCode`:

- `ProjectNotOpen`: no project with `projectId` is currently open in the editing repository.
- `StaleProjectRevision`: `request.revision` does not match the repository's current editing revision.

UI adapters translate `CampaignEditorRefusalCode` into Spanish messages.

## Invariants

- A stale revision or closed project refuses the operation before `CampaignProjectHistory` is modified.
- When `CampaignProjectHistory` has a previous snapshot (`canUndo`), the current snapshot moves to the head of the redo stack, the previous snapshot becomes current, and the editing revision increments by one.
- When `CampaignProjectHistory` has no previous snapshot, the current project and editing revision remain unchanged.
- Project identity, authored JSON documents, and resource bytes move together as one atomic `CampaignProjectDocument` snapshot.
- Undoing a project edit does not advance `GameTime` or depend on browser storage.

## Repository

This README describes only the `UndoCampaignProjectEdit` contract. `UndoCampaignProjectEditUseCase` owns `UndoCampaignProjectEditRepository`, which exposes `undo(identifier, expectedRevision)`. It does not share a repository interface with other use cases; `CampaignProjectEditingRepository` in infrastructure implements this narrow interface over `CampaignProjectHistory`.

## Domain objects and related terms

- `CampaignProject` and `CampaignProjectDocument` represent the restored editor draft envelope.
- `CampaignProjectHistory` owns the bounded past, current, and future project snapshots.
- `CampaignEditorRefusal` and `CampaignEditorRefusalCode` represent typed project and revision refusals.
- Related contracts: [EditCampaignProject](../edit-campaign-project/README.md) and [RedoCampaignProjectEdit](../redo-campaign-project-edit/README.md).
