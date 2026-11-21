# CreateGameSession

## Intention

Create a new `GameSession` with a fresh session identity, revision zero, and deterministic initial campaign state from a `CampaignDefinition` and seed.

## Actor and trigger

The player or playtest adapter invokes this use case when starting a new campaign.

## Request

`CreateGameSessionRequest<TDefinition>` contains:

- `seed`: an unsigned 32-bit safe integer (`0 <= seed <= 0xffffffff`) used to initialize the session's deterministic `RandomSource`.
- `definition`: the validated `CampaignDefinition` (`TDefinition`) for the campaign.

## Response

`CreateGameSessionUseCase.execute` returns the newly created game state (`TGame`) with a unique `gameSessionId` and `gameRevision` set to `0`.

## Refusals

Expected refusals throw `DomainRefusal` with a typed `DomainRefusalCode`:

- `DomainRefusalCode.InvalidGameSeed`: `request.seed` is not a safe integer or lies outside `0..0xffffffff`.

UI adapters translate `DomainRefusalCode.InvalidGameSeed` into a Spanish player-facing message.

## Invariants

- An invalid seed is refused before `CreateGameSessionRepository.create` runs.
- Each accepted execution creates a new `GameSession` via `GameSession.create(id)` with `revision: 0`, `activeSectorSessionId: null`, and empty `suspendedSectorSessionIds`.
- Two calls with the same `seed` and `definition` produce identical initial world state and `RandomSource` sequences while receiving distinct `GameSession` identities.
- Creating a new session is distinct from restoring a saved snapshot ([RestoreGame](../restore-game/README.md)), which revives existing state without running initial creation effects.

## Repository

This README describes only the `CreateGameSession` contract. `CreateGameSessionUseCase` owns `CreateGameSessionRepository<TDefinition, TGame>`, which exposes `create(request)`. It does not share a repository interface with [RestoreGame](../restore-game/README.md) or [SaveGame](../save-game/README.md).

## Domain objects and related terms

- `GameSession` owns the runtime session identity, revision counter, and open sector-session registry.
- `CampaignDefinition` and `RandomSource` supply the authored campaign rules and seeded deterministic randomness.
- `DomainRefusal` and `DomainRefusalCode` represent typed domain refusals.
- Related contracts: [RestoreGame](../restore-game/README.md) and [SaveGame](../save-game/README.md).
