# FightOnArrival

## Intention

Resolve a squad's pending `ArrivalDecision` at a hostile sector boundary by committing the `Journey` to fight and authorizing sector entry.

## Actor and trigger

The player invokes this use case when a travelling `Squad` reaches a hostile sector boundary (`JourneyStatus.AwaitingArrivalDecision`) and chooses to fight (or invokes the compatibility `beginAssault` command).

## Request

`FightOnArrivalRequest` contains:

- `squadId`: the identifier of the arriving `Squad`.
- `decisionId`: the identifier of the pending `ArrivalDecision` to resolve.

## Response

`FightOnArrivalResponse` contains:

- `squadId`: the arriving `Squad` identifier.
- `sectorId`: the hostile destination `Sector` identifier (`journey.nextSector`).
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

- An `ArrivalDecision` can resolve at most once; `FightOnArrival` and [WithdrawOnArrival](../withdraw-on-arrival/README.md) are mutually exclusive resolutions of the same `decisionId`.
- Accepting fight marks the `ArrivalDecision` as `ArrivalDecisionStatus.Fight`, transitions the `Journey` to `JourneyStatus.Completed`, and clears any pause reason.
- This use case does not advance `WorldTimeline`, issue ammunition, run recruitment, or open the sector visit itself; the enclosing campaign transaction prepares `SectorEntryRequest` for [EnterSector](../../sector-sessions/enter-sector/README.md) (or admits the squad into an already open visit via [AdmitSectorReinforcements](../../sector-sessions/admit-sector-reinforcements/README.md)).
- A refusal leaves the `Journey`, `ArrivalDecision`, `journeyRevision`, world clock, and paid travel costs unchanged.

## Repository

This README describes only the `FightOnArrival` contract. `FightOnArrivalUseCase` owns `FightOnArrivalRepository`, which exposes `loadJourney(squadId)` and `commitJourney(squadId, journey, expectedRevision)`. It does not share a repository interface with withdrawal or redirection use cases; `CampaignFightOnArrivalRepository` in infrastructure delegates to `CampaignJourneyTransaction` within the caller's transaction.

## Domain objects and related terms

- `Journey` and `ArrivalDecision` enforce arrival-boundary state transitions and decision identity checks.
- `JourneyRefusal` and `DomainRefusal` carry typed refusal codes.
- Related contracts: [WithdrawOnArrival](../withdraw-on-arrival/README.md), [RedirectJourney](../redirect-journey/README.md), [EnterSector](../../sector-sessions/enter-sector/README.md), and [AdmitSectorReinforcements](../../sector-sessions/admit-sector-reinforcements/README.md).
