# EndSectorTurn

`EndSectorTurnUseCase` loads and commits through its own `EndSectorTurnRepository`.
In combat, `CombatSession` owns phase authority and round-time charging.
`CombatTurn` grants each automatic actor a budget once and retains its action
index through interruptions. `ReactionStack` restores nested reaction authority.

In exploration, the operation rests for the remaining requested duration.
Accepted intervals recover condition and advance the shared world schedule.
An arrival boundary stores the exact remaining rest duration. Resumption uses
that duration and does not begin a second full rest.

At the exact boundary, enemy or allied continuation remains pending before it can
spend AP or change the random source. A paused operation can be resumed only after
the campaign supplies a later time limit. Refused requests publish no gameplay
changes or local revision.

A revision must be a nonnegative safe integer with room for one increment.
An exhausted revision is refused with `DomainRefusalCode.RevisionConflict` before
execution or publication. The source snapshot and pending work stay unchanged.
