# FormSquad

Form or reorganize a squad from one to six available combatants at one location.
`FormSquadRequest` selects an existing squad by ID or supplies a name and location
for a new squad. The `FormSquadRepository` loads the domain squads and availability
facts in the caller's transaction. `SquadFormationService` validates every transfer
before changing any membership. A travelling or deployed squad cannot reorganize.

A force can have at most eight squads. A new squad can replace a vacant squad.
Reserve members and removed members keep their physical location. Selecting the
resulting squad changes the command view; it does not move a character.

The repository projects accepted membership once. The enclosing `GameUnitOfWork`
commits one revision. Refusals preserve all memberships and locations.
