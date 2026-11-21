# ResumeSectorOperation

## Intention

Continue an interrupted `SectorOperation` inside the active `SectorSession` from its last accepted checkpoint under an updated `SectorTimeBudget`.

## Actor and trigger

The sector coordinator invokes this use case after the player resolves all pending campaign `ArrivalDecision` prompts (updating `worldTimeLimitSecond`) to finish a `pendingSectorOperation` that was paused at the previous time boundary.

## Request

`ResumeSectorOperationUseCase.execute()` takes no request argument; `ResumeSectorOperationRepository.loadSectorOperation()` supplies the active sector `Snapshot` (containing `pendingSectorOperation` and the updated `SectorClockSnapshot`) and `revision`.

## Response

`ResumeSectorOperationUseCase.execute()` returns the committed `Snapshot` (`SectorOperationState`), with `pendingSectorOperation` cleared on completion or updated to a new checkpoint if paused by another `SectorTimeBudget` boundary.

## Refusals

Expected refusals throw `DomainRefusal`, `CombatRefusal`, or `RangeError`:

- `DomainRefusalCode.RevisionConflict`: `sectorRevision` is not a nonnegative safe integer, has reached `Number.MAX_SAFE_INTEGER` on load, or changed before `commitSectorOperation`.
- `RangeError('invalid-sector-time-budget')` / `RangeError('invalid-sector-duration')` / `RangeError('sector-operation-time-reversed')`: the sector clock or elapsed duration is invalid or moves backward.
- When `SectorTimeBudget` is still zero (for example, another unresolved `ArrivalDecision` still pauses campaign time) or a resumed step exceeds the new `SectorTimeBudget`, `SectorTimeBudget` throws `SectorTimeLimitReached`, and `SectorOperationRunner` retains the accepted checkpoint and remaining `pendingSectorOperation`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- Resuming continues from the accepted checkpoint stored on the snapshot; it never repeats completed movement cells, completed `ReloadWork`, already-charged `ActionPoints`, or prior `RandomSource` draws.
- Dispatched continuation follows `pendingSectorOperation.kind`:
  - `SectorOperationKind.Order` resumes the unfinished player `SectorOrder` (including remaining group movement members and their original formation targets).
  - `SectorOperationKind.EndTurn` resumes the remaining exploration rest (`remainingRestSeconds`) or turn-ending sequence.
  - `SectorOperationKind.Continue` resumes automatic combat phase progression from the saved `CombatTurn` actor index, `ReactionStack`, and issued budgets.
- `ResumeSectorOperation` continues unfinished work inside the currently active `SectorSession`; switching between different open sector visits uses [ResumeSectorSession](../resume-sector-session/README.md).

## Repository

This README describes only the `ResumeSectorOperation` contract. `ResumeSectorOperationUseCase` owns `ResumeSectorOperationRepository<Snapshot>`, which exposes `loadSectorOperation()` and `commitSectorOperation(snapshot, expectedRevision)`. It does not share a repository interface with [ExecuteSectorOrder](../execute-sector-order/README.md) or [EndSectorTurn](../end-sector-turn/README.md); `SnapshotResumeSectorOperationRepository` in infrastructure delegates to `SectorOperationTransaction`.

## Domain objects and related terms

- `SectorOperation`, `PendingSectorOperation`, `SectorOperationRunner`, and `SectorTimeBudget` own checkpoint restoration and continuation state.
- `SectorSession`, `CombatSession`, `CombatTurn`, and `ReactionStack` preserve tactical turn state across pauses.
- Related contracts: [ExecuteSectorOrder](../execute-sector-order/README.md), [EndSectorTurn](../end-sector-turn/README.md), and [ResumeSectorSession](../resume-sector-session/README.md).
