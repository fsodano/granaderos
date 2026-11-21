# EditSectorMap

## Intention

Apply an ordered batch of `SectorMapCommand` operations atomically to an open `SectorMap` at its expected revision.

## Actor and trigger

The map author or tooling invokes this use case from the standalone sector map editor, the embedded `campaign-editor` map view, the map command CLI, or fixture generation scripts.

## Request

`EditSectorMapRequest` contains:

- `mapId`: the identifier of the target `SectorMap`.
- `revision`: the expected map revision.
- `commands`: an ordered array of `SectorMapCommand` items (`transformSelection`, `paintTerrain`, `addBuilding`, `addObject`, `moveObject`, `rotateObject`, `deleteObject`, `setObject`, `setMetadata`, `setDoor`, `setOpeningStyle`, `setWall`, `resizeBuilding`, `duplicateObject`, or `stampTemplate`).

## Response

`EditSectorMapResponse` matches `SectorMapEditResult`:

- `document`: the resulting `PhysicalMap` snapshot (with revision incremented by one when accepted, or the unchanged snapshot when refused or invalid).
- `errors`: map schema validation error messages from the geometry port.
- `warnings`: non-blocking map validation warnings.
- `refusal`: an optional `CampaignEditorRefusalSnapshot` (`{ code: CampaignEditorRefusalCode; details: CampaignEditorRefusalDetails }`) when a domain or revision rule refuses the batch.

## Refusals

- If `mapId` does not match the open map in `EditSectorMapRepository`, `load(mapId)` throws `CampaignEditorRefusal` with `CampaignEditorRefusalCode.MapNotOpen`.
- Inside `SectorMap.edit`, expected domain and revision refusals are caught and returned in `response.refusal` (with `errors: []` and the unchanged `document`) without calling `repository.commit`:
  - `StaleMapRevision`: `request.revision` does not match the map's current revision.
  - `InvalidMapCommandBatch`: `commands` is not an array, exceeds 10,000 commands, or contains a non-object entry.
  - `UnsupportedMapCommand`: a command `type` is not part of `SectorMapCommand`.
  - `InvalidMapSelection`: `transformSelection` omits a valid `ids` array.
  - `InvalidTerrainBrush` / `CellOutsideMap`: `paintTerrain` uses an unknown terrain key, exceeds 4,096 cells, or targets coordinates outside the map.
  - `InvalidBuildingDimensions`: `addBuilding` or `resizeBuilding` uses non-integer coordinates or dimensions outside 3..64.
  - `InvalidMapLayer` / `FurnitureNotFound`: `addObject` targets a non-object layer or an unknown furniture type in `props`.
  - `ObjectNotFound`: an object or building identifier does not exist in any map layer.
  - `MapGeometryOperationRequired`: `setObject` attempts to mutate geometry fields (`id`, `x`, `y`, `walls`, `rooms`, `width`, `height`, or `footprint`) directly.
  - `DoorNotFound`: `setDoor` targets an unknown `doorId`.
  - `OpeningRequired` / `InvalidWallEdge` / `OpeningRequiresWall`: `setOpeningStyle` or `setWall` targets an invalid building edge or an edge without the required wall or opening.
  - `UnsupportedTemplateVersion` / `InvalidTemplateDimensions`: `stampTemplate` supplies a template version other than `1` or invalid building dimensions.
- If `EditSectorMapRepository.commit` detects a revision mismatch against `SectorMapHistory`, it throws `CampaignEditorRefusal` with `CampaignEditorRefusalCode.StaleMapRevision`.
- UI adapters translate `CampaignEditorRefusalCode` into Spanish messages. Map schema validation errors remain in `response.errors`.

## Invariants

- The command batch is atomic: `EditSectorMapUseCase` commits the updated `SectorMap` to `EditSectorMapRepository` only when both `result.errors.length === 0` and `result.refusal === undefined`.
- Every accepted batch compiles updated buildings through the injected geometry port, validates the map before and after building compilation, advances `document.revision` by one, and drops any redo branch in `SectorMapHistory`.
- Moving, rotating, duplicating, or deleting a building transforms or removes its interior objects, `upperSurfaces`, `climbLinks`, and container-bound items together.
- `SectorMap` owns physical map authoring state only; it never mutates live characters, `CombatSession` state, or `GameTime`.

## Repository

This README describes only the `EditSectorMap` contract. `EditSectorMapUseCase` owns `EditSectorMapRepository`, which exposes `load(identifier)` and `commit(map, expectedRevision)`. It does not share a repository interface with project-level use cases; `SectorMapEditingRepository` in infrastructure implements this interface over `SectorMapHistory`.

## Domain objects and related terms

- `SectorMap` owns physical map editing rules, building and container transformations, and revision progression.
- `SectorMapCommand` defines the discriminated union of permitted map operations.
- `SectorMapHistory` retains bounded undo and redo `PhysicalMap` snapshots in the repository adapter.
- `CampaignEditorRefusal` and `CampaignEditorRefusalCode` represent typed map editing refusals.
- Related contracts: [EditCampaignProject](../edit-campaign-project/README.md) and [ValidateCampaignProject](../validate-campaign-project/README.md).
