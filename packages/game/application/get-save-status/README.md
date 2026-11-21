# GetSaveStatus

## Intention

Read the accepted and persisted `GameSaveIdentity` revisions and current storage state without modifying `GameTime` or game state.

## Actor and trigger

The UI header and save-status presenter invoke this read-only use case to display whether the latest accepted campaign progress has been persisted to browser storage or requires manual export.

## Request

`GetSaveStatusUseCase.execute()` takes no request argument.

## Response

`SaveStatus` contains:

- `state`: one `SaveState` value (`'unsaved'`, `'saving'`, `'saved'`, `'blocked'`, or `'failed'`).
- `accepted`: the latest accepted `GameSaveIdentity` (`{ sessionId: string; revision: number; requestId: string }`) or `null`.
- `persisted`: the last persisted `GameSaveIdentity` or `null`.
- `message`: a diagnostic description when `state` is `'blocked'` or `'failed'`, or `null` otherwise.

## Refusals

- `GetSaveStatusUseCase` does not throw domain refusals; storage lock refusals (`'blocked'`) and write failures (`'failed'`) are reported as values in `SaveStatus`.

## Invariants

- The query is read-only: it never advances `WorldTimeline`, mutates `GameSession`, or triggers a storage write.
- `SaveStatusRepository.read()` returns defensive copies of `accepted` and `persisted` identities.
- `state` is `'saved'` only when `persisted` matches the latest `accepted` `sessionId`, `revision`, and `requestId`; accepting a new in-memory commit resets `state` to `'unsaved'` until [SaveGame](../save-game/README.md) persists that revision.

## Repository

This README describes only the `GetSaveStatus` contract. `GetSaveStatusUseCase` owns `GetSaveStatusRepository`, which exposes only `read(): SaveStatus` and has no commit method. It does not share a repository interface with [SaveGame](../save-game/README.md) or [RestoreGame](../restore-game/README.md); `SaveStatusRepository` in infrastructure tracks state transitions alongside the save adapter.

## Domain objects and related terms

- `SaveStatus`, `SaveState`, and `GameSaveIdentity` represent the relationship between accepted in-memory progress and persisted storage.
- Related contracts: [SaveGame](../save-game/README.md) and [RestoreGame](../restore-game/README.md).
