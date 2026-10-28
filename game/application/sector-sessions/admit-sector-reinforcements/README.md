# AdmitSectorReinforcements

`AdmitSectorReinforcementsUseCase` loads the open `SectorSession`, new participants,
legal entry cells, occupied positions, and revision through its own repository.
`SectorSession` refuses repeated participant identities. `SectorDeployment` assigns
exclusive cells and confirms that all placements are legal before commit.

Reinforcements use deterministic nearest legal edge placement. Distance, row,
and column order resolve ties. Existing participants, residents, and artillery
block occupied cells. If the edge cannot hold all arrivals, the whole admission
is refused. Initial player deployment continues to use explicit placement controls.

Only new participants receive normal entry AP. Existing AP, combat round, phase,
reactions, unfinished operations, and elapsed time remain in the same visit.
The repository admits grief participants and conduct observers once for each new
combatant and extends pending initial deployment when it is still open.

A hostile approach continues when another squad opens a visit at its destination.
The arriving squad receives its own required fight-or-withdraw decision. A fight
choice admits that squad into the same visit through this use case.

A revision must be a nonnegative safe integer with room for one increment.
An exhausted revision is refused with `DomainRefusalCode.RevisionConflict` before
execution or publication. The source snapshot and pending work stay unchanged.
