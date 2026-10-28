# EditSectorMap

The author changes a sector map with one ordered edit batch. The request identifies the map and expected revision. The use case loads the rich `SectorMap`, applies the batch, and commits only a valid result. A stale revision or an invalid command leaves the whole batch unapplied.

`SectorMap` owns object selection, building geometry transformations, nested container movement, terrain edits, wall and opening edits, template admission, duplication, deletion, and one revision per accepted batch. Its injected geometry port provides the game's shared building compiler and map schema validator. `SectorMapHistory` owns bounded undo/redo snapshots; a new edit drops the redo branch.

The standalone sector editor, embedded campaign studio map editor, map command CLI, and fixture generator use this contract. Domain code imports no game runtime or browser implementation.

The request uses the discriminated `SectorMapCommand` union. Each operation has
its own required inputs. Expected rule refusals return `CampaignEditorRefusal`
codes and structured details. The use case does not commit a refusal. The public
editor adapter translates these codes into Spanish messages. Map schema
validation retains its explicit error and warning report. Unexpected failures
propagate without being classified as expected refusals.
