# ExecuteSectorOrder

`ExecuteSectorOrderUseCase` loads the current visit and revision through
`ExecuteSectorOrderRepository`, applies the requested order through the shared
sector runner, and commits the accepted result once. Domain combat classes own
AP, firearm condition and charges, loading work, injury, reaction authority, and
combat completion. Physical collision and projectile adapters supply geometry.

An atomic effect must fit the current `SectorTimeBudget`. A movement order keeps
completed cells and their costs. Reloading keeps earned fractional work. The
runner restores the last accepted checkpoint and presentation receipts if the
next effect cannot fit. It advances only the remaining permitted idle time and
stores the unfinished intention. A completed player action changes continuation
to automatic work so resumption cannot fire or pay for it again.

A refused order changes no gameplay state or local revision. Accepted changes
advance `sectorRevision`; the enclosing game transaction owns `gameRevision`.
Browser and worker execution use the same application path. Worker responses
must match game session, sector session, both revisions, and request identity.

Physical placement and movement respect `ResidentPositionReference` records for
other serving characters' saved posts. Civilian routes, soldier routes,
artillery movement, deployment, and reinforcement admission use the same occupied
positions and physical levels. Synchronization rejects omitted or altered
references when the current campaign requires those positions. Restoring an
older save derives missing references from canonical character presence.

A revision must be a nonnegative safe integer with room for one increment.
An exhausted revision is refused with `DomainRefusalCode.RevisionConflict` before
execution or publication. The source snapshot and pending work stay unchanged.
