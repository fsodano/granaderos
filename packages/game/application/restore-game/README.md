# RestoreGame

## Intention

Validate and restore a saved `GameSnapshot` into a live `GameSession` and its domain relationships without repeating creation-only effects.

## Actor and trigger

The player or browser startup workflow invokes this use case when loading a saved game from browser storage or an imported save file.

## Request

`RestoreGameUseCase.execute()` takes no request argument; `RestoreGameRepository.read()` supplies the serialized snapshot text.

## Response

`RestoreGameUseCase.execute()` returns the restored game model (`TGame`) produced by `RestoreGameRepository.restore(text)`.

## Refusals

Expected refusals throw `DomainRefusal` with a typed `DomainRefusalCode` (or format validation errors from `GameSnapshotMapper`):

- `DomainRefusalCode.SavedGameUnavailable`: `RestoreGameRepository.read()` returns an empty string because no saved snapshot is present.
- `GameSnapshotMapper` throws domain or format validation errors when the serialized JSON is malformed, exceeds size limits, fails schema or scenario checks, or violates identity, clock, `ItemCustody`, or `SectorSession` invariants.

UI adapters translate `DomainRefusalCode.SavedGameUnavailable` into a Spanish player-facing message and surface format diagnostics.

## Invariants

- If `read()` returns empty text, `RestoreGameUseCase` throws `DomainRefusalCode.SavedGameUnavailable` before calling `restore(text)`.
- Restoration rebuilds `GameSession`, `Character`, `ServiceContract`, `Squad`, `Journey`, `ArrivalDecision`, `SectorSession`, `CombatSession`, `Inventory`, `ItemCustody`, `Corpse`, `WorldTimeline`, and `RandomSource` through `GameSnapshotMapper` and `DomainIdentityMap` using each domain object's restoration path (`restore`).
- Restoring a snapshot never advances `WorldTimeline`, charges `Treasury`, re-issues starting equipment or cartridges, or repeats `RecruitCombatant` side effects.
- Supported legacy snapshots containing `hiringArrivals` (prepaid recruitment claims) or missing corpse death timestamps are migrated deterministically at the saved `GameTime` instant according to the save migration policy.

## Repository

This README describes only the `RestoreGame` contract. `RestoreGameUseCase` owns `RestoreGameRepository<TGame>`, which exposes `read(): string` and `restore(text: string): TGame`. It does not share a repository interface with [CreateGameSession](../create-game-session/README.md) or [SaveGame](../save-game/README.md).

## Domain objects and related terms

- `GameSnapshot` and `GameSnapshotMapper` own versioned snapshot serialization, migration, and invariant validation.
- `GameSession` owns the restored session identity, revision, and open sector-session registrations.
- `DomainRefusal` and `DomainRefusalCode` represent typed domain refusals.
- Related contracts: [CreateGameSession](../create-game-session/README.md), [SaveGame](../save-game/README.md), and [GetSaveStatus](../get-save-status/README.md).
