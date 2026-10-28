# WithdrawOnArrival

Resolve one pending `ArrivalDecision` by starting a withdrawal journey. The
request identifies the squad and current decision. `Journey` changes purpose
and direction while preserving its physical position and all paid progress.
The repository commits against the loaded revision.

The command consumes no time. `RedirectJourney` can change this journey at once
or after travel has begun. Resolving a stale or completed decision is refused.

The repository checks that the journey revision can advance before applying the
choice. Revision exhaustion returns `DomainRefusalCode.RevisionConflict` and
preserves the journey, world time, and paid costs.
