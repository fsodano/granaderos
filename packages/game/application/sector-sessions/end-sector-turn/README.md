# EndSectorTurn

## Intention

Yield current player authority in a `CombatSession` or spend a bounded rest interval during sector exploration within the current `SectorTimeBudget`.

## Actor and trigger

The player invokes this use case from the tactical sector view (directly or through the sector worker) to end the player combat turn or rest during peaceful exploration.

## Request

`EndSectorTurnUseCase.execute()` takes no request argument; `EndSectorTurnRepository.loadSectorTurn()` supplies the current sector snapshot (`Snapshot extends SectorOperationState`) and `revision`.

## Response

`EndSectorTurnUseCase.execute()` returns the committed `Snapshot` (`SectorOperationState`), including updated turn or rest state, any incremented `sectorRevision`, and `pendingSectorOperation` when interrupted by `SectorTimeBudget`.

## Refusals

Expected refusals throw `DomainRefusal`, `CombatRefusal`, or `RangeError` (or record a refusal on the snapshot without advancing `sectorRevision`):

- `DomainRefusalCode.RevisionConflict`: `sectorRevision` is not a nonnegative safe integer, has reached `Number.MAX_SAFE_INTEGER` on load, or changed before `commitSectorTurn`.
- `CombatRefusalCode.CombatAlreadyCompleted` / `CombatRefusalCode.InvalidCombatPhase`: the `CombatSession` is already finished or cannot transition phase.
- `RangeError('invalid-sector-time-budget')` / `RangeError('invalid-sector-duration')` / `RangeError('sector-operation-time-reversed')`: the sector clock or elapsed duration is invalid or moves backward.
- When `SectorTimeBudget` is reached during turn progression or rest, `SectorTimeBudget` throws `SectorTimeLimitReached`, which `SectorOperationRunner` catches to preserve the last accepted checkpoint and store a `pendingSectorOperation`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- In combat (`SectorSessionMode.Combat`), `CombatSession` manages phase transitions (`CombatPhase.Player`, `CombatPhase.Enemy`, `CombatPhase.Interrupt`) and charges round time once per round (`chargeRoundTime`). `CombatTurn` issues each automatic participant's `ActionPoints` budget once and tracks its actor index across interruptions, while `ReactionStack` restores parent authority after nested `ReactionWindow` interrupts finish.
- In exploration (`SectorSessionMode.Exploration`), ending the turn rests for the requested interval, recovering condition and advancing `ResidentRoutine` on the shared clock.
- If `SectorTimeBudget` stops an exploration rest at a campaign arrival boundary, `SectorOperation` records `remainingRestSeconds` in `pendingSectorOperation` so [ResumeSectorOperation](../resume-sector-operation/README.md) finishes only the remaining rest duration rather than starting a new full rest.
- If `SectorTimeBudget` stops automatic combat progression at a boundary, the unexecuted continuation remains pending before spending `ActionPoints` or drawing from `RandomSource`.
- When an operation produces `lastError` or no gameplay state change, `SectorOperationTransaction.commit` leaves `sectorRevision` and the stored snapshot unchanged.

## Repository

This README describes only the `EndSectorTurn` contract. `EndSectorTurnUseCase` owns `EndSectorTurnRepository<Snapshot>`, which exposes `loadSectorTurn()` and `commitSectorTurn(snapshot, expectedRevision)`. It does not share a repository interface with [ExecuteSectorOrder](../execute-sector-order/README.md) or [ResumeSectorOperation](../resume-sector-operation/README.md); `SnapshotEndSectorTurnRepository` in infrastructure delegates to `SectorOperationTransaction`.

## Domain objects and related terms

- `SectorOperation`, `SectorOperationRunner`, and `SectorTimeBudget` manage checkpoints, rest continuation, and campaign-time boundaries.
- `SectorSession`, `CombatSession`, `CombatTurn`, `ReactionWindow`, `ReactionStack`, and `ActionPoints` govern turn progression.
- Related contracts: [ExecuteSectorOrder](../execute-sector-order/README.md) and [ResumeSectorOperation](../resume-sector-operation/README.md).
