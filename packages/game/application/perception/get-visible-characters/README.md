# GetVisibleCharacters

## Intention

Return the canonical `Character` identifiers currently visible to an observer or observing force in a sector without exposing hidden character records or modifying game state.

## Actor and trigger

Tactical perception adapters, visibility queries, and public journal projections invoke this read-only use case during a `SectorSession` to determine which characters an observer or force can see.

## Request

`GetVisibleCharactersUseCase.execute()` takes no request argument; the injected `GetVisibleCharactersRepository` binds the observer and candidate targets for the current inspection.

## Response

`GetVisibleCharactersResponse` contains:

- `characterIds`: unique `Character` identifiers (`readonly string[]`) for which `character.visible === true`, in first-observed iteration order.

## Refusals

- `GetVisibleCharactersUseCase` does not throw domain refusals; when no target satisfies the visibility rules, `execute()` returns `{ characterIds: [] }`.

## Invariants

- The query is read-only: it never advances `WorldTimeline`, spends `ActionPoints`, alters contact history, or mutates a `GameSnapshot`.
- The response exposes only `characterIds`; it never returns domain objects or hidden character records, ammunition counts, `ActionPoints`, or private contact history.
- In infrastructure, `SectorPerception` evaluates each candidate through `VisionObserver`, `FieldOfView`, `VisibilityPolicy`, and `IlluminationPolicy` (checking observer availability, departure status, angular field of view, day/night/illuminated range, concealment, cover penalties, clear line of sight, and the 5-cell smoke opacity threshold).
- `KnownSectorPolicy` enforces related information limits on tactical previews so hidden characters, undiscovered interior props, and unseen reflecting stone obstacles do not leak private sector state through projectile forecasts.

## Repository

This README describes only the `GetVisibleCharacters` contract. `GetVisibleCharactersUseCase` owns `GetVisibleCharactersRepository`, which exposes only `inspect(): Iterable<CharacterVisibility>` and has no commit method. It does not share a repository interface with mutating sector use cases.

## Domain objects and related terms

- `VisionObserver`, `FieldOfView`, `VisibilityPolicy`, and `IlluminationPolicy` compute visual perception in the domain.
- `KnownSectorPolicy` restricts sector observations and projectile forecasts to facts the player can know.
- Related contracts: [EnterSector](../../sector-sessions/enter-sector/README.md) and [ExecuteSectorOrder](../../sector-sessions/execute-sector-order/README.md).
