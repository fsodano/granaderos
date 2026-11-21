# EnterSector

## Intention

Open a new or resumed `SectorSession` from an admitted `SectorEntryRequest` and commit the resulting sector visit at its expected revision.

## Actor and trigger

The campaign or tactical session coordinator invokes this use case when a `Squad` enters a sector peacefully, commits to sector entry after [FightOnArrival](../../journeys/fight-on-arrival/README.md), or reopens a saved sector visit.

## Request

`EnterSectorUseCase.execute()` takes no direct argument; `EnterSectorRepository.loadSectorEntry()` supplies:

- `request`: a `SectorEntryRequest` (`{ sessionId: string; sectorId: string; participantIds: readonly string[]; deploymentRequired: boolean }`).
- `resumedSession`: an optional restored `SectorSession` when resuming an existing visit.
- `revision`: the expected entry revision.

## Response

`EnterSectorResponse<Snapshot>` contains:

- `snapshot`: the committed sector snapshot returned by `EnterSectorRepository.commitSectorEntry`.
- `sessionId`: the active `SectorSession` identifier (`session.id`).
- `resumed`: `true` when `resumedSession` was restored; `false` when a fresh `SectorSession` was created.

## Refusals

Expected refusals throw `CombatRefusal` with a typed `CombatRefusalCode`, or repository validation errors when the entry snapshot is inconsistent:

- `CombatRefusalCode.InvalidCombatSession`: `sessionId` or `sectorId` is empty, or a restored `SectorSession` has an invalid mode, combat sequence, or termination state.
- `CombatRefusalCode.InvalidParticipant`: `participantIds` contains an empty or duplicate character identifier.
- `'sector-entry-location-mismatch'` / `'stale-sector-entry'`: `SnapshotEnterSectorRepository` rejects an entry snapshot whose `sectorId` does not match the requested sector or whose commit revision is stale.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- The canonical entry naming pair is `EnterSector` with `SectorEntryRequest`: `SectorEntryRequest` describes the entry intention and authority, whereas `SectorSession` represents the active visit.
- On a fresh visit (`resumed: false`), `SectorSession.enter` starts in `SectorSessionMode.Deployment` when `deploymentRequired` is true or `SectorSessionMode.Exploration` otherwise, and admits each participant in `request.participantIds` once. Initial perception runs after non-deployment entry positions exist.
- On a resumed visit (`resumed: true`), `EnterSectorUseCase` preserves the restored `SectorSession` (including its `CombatSession`, `ActionPoints`, participant positions, equipment, clock, and any pending operation) without re-admitting participants or re-issuing initial budgets.
- In infrastructure, `ResidentPositionReference` projections reserve the saved local posts of living serving characters who are not participating in the current visit without creating duplicate `SectorParticipant`, `Health`, or `Inventory` records.
- When a sector visit is already open and another squad arrives to fight at the same sector, entry routes through [AdmitSectorReinforcements](../admit-sector-reinforcements/README.md) instead of opening a second `SectorSession`.

## Repository

This README describes only the `EnterSector` contract. `EnterSectorUseCase` owns `EnterSectorRepository<Snapshot>`, which exposes `loadSectorEntry()` and `commitSectorEntry(session, expectedRevision)`. It does not share a repository interface with reinforcement or order-execution use cases.

## Domain objects and related terms

- `SectorEntryRequest` defines the entry input contract.
- `SectorSession` and `CombatSession` own the sector visit and combat episode lifecycles.
- `ResidentPositionReference` projects occupied local posts of non-participating serving characters.
- `CombatRefusal` and `CombatRefusalCode` represent typed domain refusals.
- Related contracts: [FightOnArrival](../../journeys/fight-on-arrival/README.md), [AdmitSectorReinforcements](../admit-sector-reinforcements/README.md), [ResumeSectorSession](../resume-sector-session/README.md), and [ExecuteSectorOrder](../execute-sector-order/README.md).
