# WithdrawOnArrival

## Intention

Resolve a squad's pending `ArrivalDecision` at a hostile sector boundary by reversing the `Journey` into a redirectable withdrawal (`JourneyPurpose.Withdrawal`) from the squad's exact physical boundary position.

## Actor and trigger

The player invokes this use case when a travelling `Squad` reaches a hostile sector boundary (`JourneyStatus.AwaitingArrivalDecision`) and chooses to withdraw instead of entering the sector.

## Request

`WithdrawOnArrivalRequest` contains:

- `squadId`: the identifier of the arriving `Squad`.
- `decisionId`: the identifier of the pending `ArrivalDecision` to resolve.

## Response

`WithdrawOnArrivalResponse` contains:

- `squadId`: the withdrawing `Squad` identifier.
- `destination`: the sector identifier toward which the withdrawal `Journey` is now headed (`journey.destination`, initially the current segment's origin).
- `decisionId`: the resolved `ArrivalDecision` identifier.

## Refusals

Expected refusals throw `JourneyRefusal` with a typed `JourneyRefusalCode`, or `DomainRefusal` with `DomainRefusalCode.RevisionConflict` when the journey revision is invalid or exhausted:

- `JourneyRefusalCode.JourneyNotFound`: the requested `squadId` does not exist or has no active `Journey`.
- `JourneyRefusalCode.ArrivalDecisionNotPending`: the `Journey` is not in `JourneyStatus.AwaitingArrivalDecision` or has no pending `ArrivalDecision`.
- `JourneyRefusalCode.ArrivalDecisionMismatch`: `request.decisionId` does not match the current pending `ArrivalDecision.id`.
- `JourneyRefusalCode.ArrivalDecisionAlreadyResolved`: the `ArrivalDecision` was already resolved.
- `JourneyRefusalCode.JourneyRevisionConflict`: the squad's `journeyRevision` changed between `loadJourney` and `commitJourney`.
- `DomainRefusalCode.RevisionConflict`: the squad's `journeyRevision` is not a nonnegative safe integer or has reached `Number.MAX_SAFE_INTEGER`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- An `ArrivalDecision` can resolve at most once; `WithdrawOnArrival` and [FightOnArrival](../fight-on-arrival/README.md) are mutually exclusive resolutions of the same `decisionId`.
- Choosing withdrawal marks the `ArrivalDecision` as `ArrivalDecisionStatus.Withdrawal`, sets `purpose` to `JourneyPurpose.Withdrawal`, flips `direction` to `JourneyDirection.Backward`, and returns `status` to `JourneyStatus.Travelling`.
- Choosing withdrawal advances no `GameTime`, grants no free displacement, and preserves `positionSeconds`, `travelledSeconds`, `workSeconds`, and `legPaid`.
- Once in `JourneyStatus.Travelling`, the withdrawal journey can advance over campaign time or be redirected immediately (at zero elapsed time) or after travel has begun through [RedirectJourney](../redirect-journey/README.md).
- A refusal leaves the `Journey`, `ArrivalDecision`, `journeyRevision`, world clock, and paid travel costs unchanged.

## Repository

This README describes only the `WithdrawOnArrival` contract. `WithdrawOnArrivalUseCase` owns `WithdrawOnArrivalRepository`, which exposes `loadJourney(squadId)` and `commitJourney(squadId, journey, expectedRevision)`. It does not share a repository interface with fight or redirection use cases; `CampaignWithdrawOnArrivalRepository` in infrastructure delegates to `CampaignJourneyTransaction` within the caller's transaction.

## Domain objects and related terms

- `Journey`, `JourneyPurpose.Withdrawal`, and `ArrivalDecision` own withdrawal state transitions and position preservation.
- `JourneyRefusal` and `DomainRefusal` carry typed refusal codes.
- Related contracts: [FightOnArrival](../fight-on-arrival/README.md) and [RedirectJourney](../redirect-journey/README.md).
