# RedoCampaignProjectEdit

## Intention

Restore the next retained `CampaignProjectDocument` snapshot from the open project's redo history at the expected revision.

## Actor and trigger

The campaign author invokes this use case from `campaign-editor` through the studio toolbar or redo keyboard shortcut after an undo operation.

## Request

`RedoCampaignProjectEditRequest` contains:

- `projectId`: the identifier of the open `CampaignProject`.
- `revision`: the expected editing revision.

## Response

`RedoCampaignProjectEditResponse` contains:

- `project`: the active `CampaignProjectDocument` snapshot after applying the redo step (or the unchanged snapshot when no future history step exists).
- `revision`: the new editing revision when a future history step was restored, or the unchanged revision when the redo stack was empty.

## Refusals

Expected refusals throw `CampaignEditorRefusal` with a typed `CampaignEditorRefusalCode`:

- `ProjectNotOpen`: no project with `projectId` is currently open in the editing repository.
- `StaleProjectRevision`: `request.revision` does not match the repository's current editing revision.

UI adapters translate `CampaignEditorRefusalCode` into Spanish messages.

## Invariants

- A stale revision or closed project refuses the operation before `CampaignProjectHistory` is modified.
- When `CampaignProjectHistory` has a retained redo snapshot (`canRedo`), the current snapshot moves to the end of the undo stack, the next redo snapshot becomes current, and the editing revision increments by one.
- When `CampaignProjectHistory` has no redo snapshot, the current project and editing revision remain unchanged.
- Project identity, authored JSON documents, and resource bytes move together as one atomic `CampaignProjectDocument` snapshot.
- Redoing a project edit does not advance `GameTime` or depend on browser storage.

## Repository

This README describes only the `RedoCampaignProjectEdit` contract. `RedoCampaignProjectEditUseCase` owns `RedoCampaignProjectEditRepository`, which exposes `redo(identifier, expectedRevision)`. It does not share a repository interface with other use cases; `CampaignProjectEditingRepository` in infrastructure implements this narrow interface over `CampaignProjectHistory`.

## Domain objects and related terms

- `CampaignProject` and `CampaignProjectDocument` represent the restored editor draft envelope.
- `CampaignProjectHistory` owns the bounded past, current, and future project snapshots.
- `CampaignEditorRefusal` and `CampaignEditorRefusalCode` represent typed project and revision refusals.
- Related contracts: [EditCampaignProject](../edit-campaign-project/README.md) and [UndoCampaignProjectEdit](../undo-campaign-project-edit/README.md).
