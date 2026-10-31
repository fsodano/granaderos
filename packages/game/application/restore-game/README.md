# RestoreGame

The player recovers a saved campaign and its open sector visits.
`RestoreGameUseCase` reads serialized data through `RestoreGameRepository`.
`GameSnapshotMapper` retains the existing format, size, scenario, clock, identity,
and custody validation. It restores domain behavior through the shared identity
map. Legacy saves receive a new session identity on their owned restored copy.

The result retains `GameSession`, personnel, journeys, sector sessions, combat
sessions, participants, and world lifecycle objects. Mapping their changes back
produces one serializable game snapshot. Restoration does not advance time, pay
contracts, issue equipment, or repeat recruitment. Resource-byte verification
remains a browser admission step before the candidate replaces the live game.

Verification: `node --test tests/game-persistence.test.ts`.

An absent save is refused with `DomainRefusalCode.SavedGameUnavailable`. Browser
adapters translate the code. Format validation returns its existing diagnostics.
