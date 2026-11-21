# AdmitSectorReinforcements

## Intention

Admit newly arriving participants into an already open `SectorSession` with exclusive, legal entry-edge placements in one transaction.

## Actor and trigger

The campaign arrival coordinator invokes this use case when a second `Squad` reaches a sector that already has an open `SectorSession` and resolves its `ArrivalDecision` with [FightOnArrival](../../journeys/fight-on-arrival/README.md).

## Request

`AdmitSectorReinforcementsUseCase.execute()` takes no direct argument; `AdmitSectorReinforcementsRepository.loadReinforcementAdmission()` supplies `ReinforcementAdmission`:

- `session`: the open `SectorSession`.
- `deployment`: a `SectorDeployment` initialized with the arriving participants and legal entry cells for each `EntryEdge` (`'N'`, `'E'`, `'S'`, `'W'`).
- `preferences`: ordered `{ characterId: string; point: DeploymentPoint }` preferred entry anchor coordinates for each arriving participant.
- `occupiedPoints`: ground-level `DeploymentPoint` coordinates already occupied by active participants, residents, `ResidentPositionReference` posts, or artillery.
- `revision`: the expected `sectorRevision`.

## Response

`AdmitSectorReinforcementsUseCase.execute()` returns `void` after committing the updated `SectorSession` and confirmed `placements` map (`Readonly<Record<string, DeploymentPoint>>`) to `AdmitSectorReinforcementsRepository.commitReinforcementAdmission`.

## Refusals

Expected refusals throw `CombatRefusal`, `DeploymentRefusal`, or `DomainRefusal`:

- `DomainRefusalCode.RevisionConflict`: the loaded `sectorRevision` is not a nonnegative safe integer, has reached `Number.MAX_SAFE_INTEGER`, or does not match `expectedRevision` at commit.
- `CombatRefusalCode.InvalidParticipant`: the incoming participant list is empty, contains duplicate character identifiers, or includes a `characterId` already participating in `SectorSession`.
- `DeploymentRefusalCode.InvalidPlan`: participant count exceeds `MaximumDeploymentParticipants` (48), an entry edge is invalid, or initial placements overlap.
- `DeploymentRefusalCode.InvalidSelection` / `DeploymentRefusalCode.InvalidEntryPoint`: a participant selection or preferred entry cell does not belong to the participant's assigned `EntryEdge`.
- `DeploymentRefusalCode.EntryFull`: the assigned `EntryEdge` has fewer legal cells than arriving participants.
- `DeploymentRefusalCode.Incomplete` / `DeploymentRefusalCode.EntryBlocked`: not every arriving participant received a placement, or `occupiedPoints` block all remaining legal cells on the assigned `EntryEdge`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- A `Character` can appear at most once in a `SectorSession`; `session.admitParticipants` verifies all incoming identifiers before placement confirmation.
- `SectorDeployment.placeNear` and `SectorDeployment.confirm` assign each arriving participant an exclusive legal entry cell on their `EntryEdge`, breaking ties deterministically by Manhattan distance to the preferred anchor, then `y` (row), then `x` (column).
- If any arriving participant cannot be placed on a legal, unoccupied cell, the entire admission is refused and neither `SectorSession` nor `sectorRevision` changes.
- Only newly admitted participants receive entry `ActionPoints` and initial observers; existing participants keep their current `ActionPoints`, `CombatSession` round and phase, `ReactionStack`, elapsed time, and unfinished `SectorOperation`.

## Repository

This README describes only the `AdmitSectorReinforcements` contract. `AdmitSectorReinforcementsUseCase` owns `AdmitSectorReinforcementsRepository`, which exposes `loadReinforcementAdmission()` and `commitReinforcementAdmission(session, placements, expectedRevision)`. It does not share a repository interface with [EnterSector](../enter-sector/README.md) or sector order use cases.

## Domain objects and related terms

- `SectorSession` owns participant membership for the active sector visit.
- `SectorDeployment` owns legal entry cells and exclusive participant coordinate assignment.
- `CombatRefusal`, `DeploymentRefusal`, and `DomainRefusal` carry typed refusal codes.
- Related contracts: [EnterSector](../enter-sector/README.md), [FightOnArrival](../../journeys/fight-on-arrival/README.md), and [ExecuteSectorOrder](../execute-sector-order/README.md).
