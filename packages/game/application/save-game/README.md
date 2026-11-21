# SaveGame

## Intention

Persist the current accepted `GameSnapshot` to storage when the request's session identity, revision, and request identity match the repository's current accepted state.

## Actor and trigger

The autosave coordinator or manual save workflow invokes this use case after a `GameUnitOfWork` commits a new revision or when flushing pending progress to storage.

## Request

`GameSaveIdentity` contains:

- `sessionId`: the active `GameSession` identifier.
- `revision`: the nonnegative safe integer revision of the accepted snapshot to persist.
- `requestId`: the unique identifier for this save request.

## Response

`SaveGameUseCase.execute` returns the persisted `GameSaveIdentity` (`{ sessionId: string; revision: number; requestId: string }`).

## Refusals

Expected refusals throw `DomainRefusal` with a typed `DomainRefusalCode`:

- `DomainRefusalCode.RevisionConflict`: `sessionId` or `requestId` is empty, `revision` is not a nonnegative safe integer, or `request` does not match `SaveGameRepository.current()` on `sessionId`, `revision`, or `requestId`.

Browser storage adapters translate `DomainRefusalCode.RevisionConflict` and keep accepted in-memory progress available.

## Invariants

- Stale save requests or out-of-order worker encoding callbacks cannot overwrite newer state: `SaveGameUseCase` verifies `sessionId`, `revision`, and `requestId` against `repository.current()` before calling `serialize()` and `persist(text, current)`.
- Accepted in-memory progress and persisted storage progress are distinct: a storage refusal or write failure updates [GetSaveStatus](../get-save-status/README.md) without rolling back the accepted `GameSession` revision in memory.
- In browser infrastructure, one exclusive Web Lock guards each save key so concurrent tabs cannot interleave writes, and background encoding workers never write to storage directly.

## Repository

This README describes only the `SaveGame` contract. `SaveGameUseCase` owns `SaveGameRepository`, which exposes `current(): GameSaveIdentity`, `serialize(): string`, and `persist(text: string, identity: GameSaveIdentity): void`. It does not share a repository interface with [RestoreGame](../restore-game/README.md) or [GetSaveStatus](../get-save-status/README.md).

## Domain objects and related terms

- `GameSaveIdentity` binds a save operation to one `GameSession`, revision, and request identity.
- `GameSnapshot` and `GameSnapshotMapper` define the serialized persistence payload.
- `DomainRefusal` and `DomainRefusalCode` represent typed revision refusals.
- Related contracts: [GetSaveStatus](../get-save-status/README.md), [RestoreGame](../restore-game/README.md), and [CreateGameSession](../create-game-session/README.md).
