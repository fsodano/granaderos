# FormSquad

## Intention

Form a new `Squad` or reorganize an existing `Squad` from one to six available combatants at the same strategic location in one transaction.

## Actor and trigger

The player invokes this use case from the personnel and squad organization screen to create a squad or reassign combatants between squads and reserve at one location.

## Request

`FormSquadRequest` contains:

- `characterIds`: one to six unique `Character` identifiers to assign to the target `Squad`.
- `squadId`: optional identifier of an existing `Squad` to reorganize. When omitted, a new `Squad` is formed.
- `name`: display name for a newly formed `Squad` (2 to 30 characters after trimming, without `<` or `>`).
- `locationId`: optional strategic location identifier for a new `Squad` (defaults to the campaign's current location).

## Response

`FormSquadResponse` contains:

- `squadId`: the identifier of the formed or reorganized `Squad`.
- `characterIds`: the committed member identifiers of that `Squad`.
- `locationId`: the strategic location identifier of that `Squad`.

## Refusals

Expected refusals throw `DomainRefusal` with a typed `DomainRefusalCode`:

- `DomainRefusalCode.InvalidSquadName`: a new squad's trimmed name is shorter than 2 characters, longer than 30 characters, or contains `<` or `>`.
- `DomainRefusalCode.InvalidSquadMembers`: `characterIds` is empty, exceeds 6 members (`SquadRules.MaximumMembers`), or contains duplicates or empty identifiers.
- `DomainRefusalCode.SquadUnavailable`: `squadId` does not exist, or the target `Squad` (or any source `Squad` losing a selected member) has `membershipLocked` set because it is on a `Journey` or has members deployed in an open `SectorSession`.
- `DomainRefusalCode.CharacterUnavailable`: a selected combatant is not available for reassignment.
- `DomainRefusalCode.SquadLocationMismatch`: a selected combatant's physical location differs from the target `Squad` location.
- `DomainRefusalCode.TooManySquads`: forming a new squad would exceed 8 squads (`SquadRules.MaximumSquads`) and no existing vacant squad can be replaced.
- `DomainRefusalCode.InvalidValue`: the target squad identity conflicts with a distinct squad instance in the roster.
- `DomainRefusalCode.TransactionClosed`: `load` or `commit` is called more than once on the repository instance.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- `SquadFormationService` validates the target `Squad`, every selected combatant, the 8-squad limit, and every affected source `Squad` before mutating any membership.
- A squad that is travelling on a `Journey` or participating in an open `SectorSession` (`membershipLocked: true`) cannot gain or lose members.
- Reorganizing squads never teleports combatants: every assigned member must already be at `target.locationId`, and members released into reserve retain their physical location.
- When the force already has 8 squads and forms a new squad, one vacant unlocked squad (`memberIds.length === 0`) is discarded to make room.
- A refusal leaves all squad memberships, active squad selection, and combatant locations unchanged.

## Repository

This README describes only the `FormSquad` contract. `FormSquadUseCase` owns `FormSquadRepository`, which exposes `load(request)` and `commit(formation)`. It does not share a repository interface with other personnel use cases; `CampaignFormSquadRepository` in infrastructure shares `Squad` instances through the `GameUnitOfWork` identity map.

## Domain objects and related terms

- `SquadFormationService` validates shared membership and transfers combatants across `Squad` objects.
- `Squad` and `SquadRules` protect member limits (1..6), squad count limits (8), name validity, and lock invariants.
- `DomainRefusal` and `DomainRefusalCode` represent typed domain refusals.
- Related contracts: [RecruitCombatant](../recruit-combatant/README.md) and [RedirectJourney](../../journeys/redirect-journey/README.md).
