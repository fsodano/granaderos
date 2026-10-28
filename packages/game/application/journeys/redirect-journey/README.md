# RedirectJourney

Change the destination of a travelling squad from its actual position. The
repository supplies the current journey, game time, revision, and a legal route
through one endpoint of the current segment. `Journey` preserves completed
travel, work toward fatigue, transport payment, and segment position.

Returning to the hostile boundary immediately creates a fresh arrival decision
when no withdrawal time has elapsed. After one minute of withdrawal, returning
requires one minute of travel. A new destination through the departure sector
first completes the physical return and then follows the selected route.

The command advances no time and refunds no cost. Pending arrival decisions,
invalid routes, and stale revisions are refused.

The repository checks that the journey revision can advance before applying the
choice. Revision exhaustion returns `DomainRefusalCode.RevisionConflict` and
preserves the journey, world time, and paid costs.
