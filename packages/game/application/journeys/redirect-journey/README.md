# RedirectJourney

## Intention

Replace the intended route and destination of a travelling `Squad` from its actual segment position while preserving completed distance, elapsed time, fatigue work, and paid segment fares.

## Actor and trigger

The player invokes this use case on the campaign map to redirect a travelling or withdrawing `Squad` to a new destination (including reversing a withdrawal back toward a hostile sector at zero elapsed time or after travel has begun).

## Request

`RedirectJourneyRequest` contains:

- `squadId`: the identifier of the travelling `Squad`.
- `destination`: the target sector identifier.
- `waypoints`: optional ordered intermediate sector identifiers (`readonly string[]`).

## Response

`RedirectJourneyResponse` contains:

- `squadId`: the redirected `Squad` identifier.
- `destination`: the committed destination sector identifier (`journey.destination`).
- `arrivalDecision`: an optional `ArrivalDecisionSnapshot` included when a zero-time redirection at a hostile boundary immediately transitions the `Journey` into `JourneyStatus.AwaitingArrivalDecision`.

## Refusals

Expected refusals throw `JourneyRefusal` with a typed `JourneyRefusalCode`, or `DomainRefusal` with `DomainRefusalCode.RevisionConflict` when the journey revision is invalid or exhausted:

- `JourneyRefusalCode.JourneyNotFound`: the requested `squadId` does not exist or has no active `Journey`.
- `JourneyRefusalCode.JourneyNotTravelling`: the `Journey` is not in `JourneyStatus.Travelling` (for example, it is paused or awaiting an unresolved `ArrivalDecision`).
- `JourneyRefusalCode.InvalidJourneyTime`: `nowSeconds` is not a safe integer or precedes `startedAtSeconds`.
- `JourneyRefusalCode.JourneyDestinationNotFound` / `JourneyRefusalCode.JourneyRouteUnavailable` / `JourneyRefusalCode.TooManyJourneyWaypoints` / `JourneyRefusalCode.HostileRedirectionOutsideCurrentSegment`: route planning (`planRoute`) rejects an unknown destination, impassable transport mode route, excessive waypoints, or illegal hostile redirection.
- `JourneyRefusalCode.InvalidJourneyRedirection`: the planned route is empty, does not begin at `plan.through`, or has an invalid `JourneyPurpose`.
- `JourneyRefusalCode.RedirectionMustStartAtCurrentSegment`: `plan.through` is neither the origin (`route[0]`) nor the forward endpoint (`route[1]`) of the squad's current segment.
- `JourneyRefusalCode.JourneyRevisionConflict`: the squad's `journeyRevision` changed between `loadJourney` and `commitJourney`.
- `DomainRefusalCode.RevisionConflict`: the squad's `journeyRevision` is not a nonnegative safe integer or has reached `Number.MAX_SAFE_INTEGER`.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- Redirection plans from the squad's actual physical position within its current segment (`route[0]` to `route[1]`) and never teleports the squad to a sector center.
- When `plan.through` is the current segment's origin (`route[0]`), the squad travels backward along the current segment first (`direction = JourneyDirection.Backward`) and stores `returnRoute` for any subsequent legs.
- When `plan.through` is the current segment's forward endpoint (`route[1]`), the squad travels forward (`direction = JourneyDirection.Forward`) along `[origin, ...plan.route]`.
- At zero elapsed withdrawal time (`remainingLegSeconds === 0` at the hostile boundary), redirecting forward with `JourneyPurpose.HostileApproach` immediately increments `arrivalSequence` and creates a fresh pending `ArrivalDecision` at `nowSeconds` without reusing the prior decision identifier.
- After withdrawal time has elapsed (`remainingLegSeconds > 0`), redirecting back toward the hostile sector requires the squad to travel the remaining physical distance before a new `ArrivalDecision` is created.
- Redirection advances no `GameTime`, refunds no transport fare, and preserves `positionSeconds`, `travelledSeconds`, `workSeconds`, and `legPaid`.

## Repository

This README describes only the `RedirectJourney` contract. `RedirectJourneyUseCase` owns `RedirectJourneyRepository`, which exposes `loadJourney(squadId)`, `planRoute(journey, destination, waypoints)`, and `commitJourney(squadId, journey, expectedRevision)`. It does not share a repository interface with arrival-decision use cases; `CampaignRedirectJourneyRepository` in infrastructure delegates journey persistence to `CampaignJourneyTransaction`.

## Domain objects and related terms

- `Journey`, `RedirectJourneyPlan`, `JourneyPurpose`, and `ArrivalDecision` govern segment progress, direction reversal, and hostile boundary re-entry.
- `JourneyRefusal` and `DomainRefusal` carry typed refusal codes.
- Related contracts: [FightOnArrival](../fight-on-arrival/README.md) and [WithdrawOnArrival](../withdraw-on-arrival/README.md).
