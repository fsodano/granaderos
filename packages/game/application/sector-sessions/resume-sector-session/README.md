# ResumeSectorSession

## Intention

Activate a suspended `SectorSession` at the current accepted `GameTime` while suspending and preserving any currently active `SectorSession` in one transaction.

## Actor and trigger

The player invokes this use case from the campaign view to return to an open, suspended sector visit after resolving arrival decisions or managing another sector visit.

## Request

`ResumeSectorSessionRequest` contains:

- `sectorSessionId`: the identifier of the suspended `SectorSession` to activate.

## Response

`ResumeSectorSessionResponse` contains:

- `activeSectorSessionId`: the identifier of the newly activated `SectorSession` (`registration.id`).

## Refusals

Expected refusals throw `DomainRefusal` with a typed `DomainRefusalCode` (or an infrastructure validation `Error` when a suspended session record is missing or out of sync):

- `DomainRefusalCode.InvalidValue`: `request.sectorSessionId` is empty, `GameSession` snapshot state is malformed, or the target registration's `sectorId` or `characterIds` do not match the existing registration in `GameSession`.
- `DomainRefusalCode.DuplicateSectorParticipation`: the target registration shares a `sectorId` or any `characterId` with another registered open `SectorSession`.
- `DomainRefusalCode.TransactionClosed`: `load` or `commit` is called more than once on the repository instance or with a different `GameSession` instance.
- `DomainRefusalCode.RevisionConflict`: the enclosing `GameUnitOfWork` detects a stale `gameRevision`.
- Infrastructure admission checks reject resuming a visit when an unresolved `ArrivalDecision` pauses the campaign, when `sectorSessionId` is not found in `suspendedSectorSessions`, or when suspended session validation detects unsynchronized state.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- `GameSession.activateSectorSession` moves any previously active `SectorSession` (`activeSectorSessionId`) into `suspendedSectorSessionIds`, removes the target `sectorSessionId` from `suspendedSectorSessionIds`, and sets `activeSectorSessionId` to `registration.id`.
- A `Sector` and a `Character` can belong to at most one open `SectorSession` (active or suspended) at a time.
- Suspending the previous visit and activating the selected visit preserves each visit's local `CombatSession` round, `ActionPoints`, participant positions, equipment, and `pendingSectorOperation` without re-issuing turn budgets.
- While a visit is suspended, world progression (`WorldTimeline`, `ResidentRoutine`, and wound clocks) continues through the shared campaign timeline.

## Repository

This README describes only the `ResumeSectorSession` contract. `ResumeSectorSessionUseCase` owns `ResumeSectorSessionRepository`, which exposes `load(sectorSessionId)` and `commit(game)`. It does not share a repository interface with [EnterSector](../enter-sector/README.md) or [ResumeSectorOperation](../resume-sector-operation/README.md); `CampaignResumeSectorSessionRepository` in infrastructure coordinates active and suspended snapshots inside the caller's `GameUnitOfWork`.

## Domain objects and related terms

- `GameSession` and `SectorSessionRegistration` enforce single-visit ownership per sector and character across active and suspended visits.
- `SectorSession` represents the open sector visit being suspended or activated.
- `DomainRefusal` and `DomainRefusalCode` carry typed domain refusals.
- Related contracts: [EnterSector](../enter-sector/README.md) and [ResumeSectorOperation](../resume-sector-operation/README.md).
