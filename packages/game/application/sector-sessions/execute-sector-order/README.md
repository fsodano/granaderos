# ExecuteSectorOrder

## Intention

Apply a player order inside the active `SectorSession` within the current `SectorTimeBudget`, preserving accepted partial progress if campaign time reaches an `ArrivalDecision` boundary.

## Actor and trigger

The player invokes this use case from the tactical sector view (directly or through the sector worker) to issue a combat, movement, deployment, reload, or interaction order inside the active `SectorSession`.

## Request

`ExecuteSectorOrderRequest` contains:

- `order`: a `SectorOrder` (`{ type: string; unitId?: string | number; [parameter: string]: unknown }`) describing the player's tactical command.

## Response

`ExecuteSectorOrderUseCase.execute` returns the committed `Snapshot` (`SectorOperationState`), including any updated `sectorRevision`, accepted checkpoints, or `pendingSectorOperation` continuation when paused by `SectorTimeBudget`.

## Refusals

Expected refusals throw `DomainRefusal`, `CombatRefusal`, `DeploymentRefusal`, `InventoryRefusal`, or `RangeError` (or record a refusal on the snapshot without advancing `sectorRevision`):

- `DomainRefusalCode.RevisionConflict`: `sectorRevision` is not a nonnegative safe integer, has reached `Number.MAX_SAFE_INTEGER` on load, or changed before `commitSectorOrder`.
- `RangeError('invalid-sector-time-budget')` / `RangeError('invalid-sector-duration')` / `RangeError('sector-operation-time-reversed')`: the sector clock or elapsed duration is invalid or moves backward.
- Domain combat, deployment, and inventory rules throw `CombatRefusal` (`CombatRefusalCode`), `DeploymentRefusal` (`DeploymentRefusalCode`), or `InventoryRefusal` (`InventoryRefusalCode`) when an action violates `ActionPoints`, `CombatSession` phase authority, `SectorDeployment`, or `Inventory` rules.
- When `SectorTimeBudget` is already zero at operation start or an atomic step exceeds remaining seconds, `SectorTimeBudget` throws `SectorTimeLimitReached`, which `SectorOperationRunner` catches to roll back to the last accepted checkpoint and store a `pendingSectorOperation`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- Every atomic step inside `SectorOperationRunner` must fit within `SectorTimeBudget` (`worldTimeLimitSecond - currentSecond`).
- Multi-step orders (such as movement cell by cell or `ReloadWork`) record accepted checkpoints via `SectorOperation.accept`. When a subsequent step exceeds `SectorTimeBudget`, `SectorOperationRunner` restores the last accepted checkpoint and presentation effects, advances any remaining idle seconds up to the boundary, and records `pendingSectorOperation` so [ResumeSectorOperation](../resume-sector-operation/README.md) can continue after the campaign pause resolves.
- When the player's order finishes before automatic continuation (such as enemy reactions or phase progression) completes, `SectorOperationRunner.completeOrder` switches the continuation intent to `SectorOperationKind.Continue` so resuming never repeats or double-charges the player's action.
- If an order fails (`snapshot.lastError` is set) or produces no gameplay state change, `SectorOperationTransaction.commit` leaves `sectorRevision` and the stored snapshot unchanged.
- Physical movement and placement respect `ResidentPositionReference` posts occupied by non-participating serving characters.

## Repository

This README describes only the `ExecuteSectorOrder` contract. `ExecuteSectorOrderUseCase` owns `ExecuteSectorOrderRepository<Snapshot>`, which exposes `loadSectorOrder()` and `commitSectorOrder(snapshot, expectedRevision)`. It does not share a repository interface with [EndSectorTurn](../end-sector-turn/README.md) or [ResumeSectorOperation](../resume-sector-operation/README.md); `SnapshotExecuteSectorOrderRepository` in infrastructure delegates to `SectorOperationTransaction`.

## Domain objects and related terms

- `SectorOperation`, `SectorOperationRunner`, and `SectorTimeBudget` bound execution by the next campaign boundary and preserve checkpoints.
- `SectorSession`, `CombatSession`, `CombatTurn`, `ReactionStack`, `ActionPoints`, `Firearm`, `ReloadWork`, `ReprimeWork`, `CombatInjury`, `MeleeExchange`, and `ResidentPositionReference` enforce tactical domain rules.
- `SectorOperationContext` binds worker and direct execution results to `GameSession`, `SectorSession`, both revisions, and request identity.
- Related contracts: [EndSectorTurn](../end-sector-turn/README.md), [ResumeSectorOperation](../resume-sector-operation/README.md), and [EnterSector](../enter-sector/README.md).
