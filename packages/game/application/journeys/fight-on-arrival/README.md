# FightOnArrival

Resolve one pending `ArrivalDecision` by committing to sector entry. The request
identifies the squad and the current decision. `Journey` validates the decision
identity and resolves it once. The repository commits the journey against the
revision that was loaded. The caller prepares the `SectorEntryRequest` in the
same game transaction.

The response identifies the squad, sector, and resolved decision. A stale or
resolved decision is refused. Recruitment, ammunition issue, deployment, and
combat progression do not run inside this use case.

The repository checks that the journey revision can advance before applying the
choice. Revision exhaustion returns `DomainRefusalCode.RevisionConflict` and
preserves the journey, world time, and paid costs.
