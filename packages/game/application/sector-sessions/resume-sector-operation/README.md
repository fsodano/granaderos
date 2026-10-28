# ResumeSectorOperation

`ResumeSectorOperationUseCase` continues the current visit through its own
`ResumeSectorOperationRepository`. It reads the accepted checkpoint and applies
the unfinished intention under the current time budget.

A pending player order returns through `ExecuteSectorOrder`; remaining rest
returns through `EndSectorTurn`. Automatic combat continuation preserves current
phase, actor index, reaction stack, and paid budgets. Group movement preserves
its original formation targets and resumes its remaining members until completion,
contact, or the next time boundary. The public resume job always returns the
accepted sector snapshot.

This use case continues work inside the active visit. `ResumeSectorSession`
activates another preserved visit. Neither operation refreshes existing combat AP.

A revision must be a nonnegative safe integer with room for one increment.
An exhausted revision is refused with `DomainRefusalCode.RevisionConflict` before
execution or publication. The source snapshot and pending work stay unchanged.
