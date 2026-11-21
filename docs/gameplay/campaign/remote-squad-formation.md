# Form squads where the soldiers are

On the strategic campaign screen, a formation request can need soldiers who are in a town other than the selected squad's location. The older formation form listed only soldiers in the selected squad's town, so organizing such a soldier for travel required first sending another squad to that town.

The squad screen has a **Localidad de formación** selector. It lists towns with hired, living soldiers who have no pending squad route. The player chooses a town, selects up to six people already there, and names the new squad. Creating it selects the new squad at that town; other squads and reserve personnel keep their physical positions, equipment, assignments, contracts and journeys. It costs no time or money. Travel remains a separate paid action.

`createSquad` accepts an optional `sector`; omission retains the current-town behavior. The normal `squad` edit still requires the selected squad's location. Both operations reject unavailable soldiers and soldiers with pending routes, including paused routes. The player must finish or cancel those routes first. Mixed-town selections, duplicate IDs, unknown sectors and the existing eight-squad cap remain invalid. Formation does not teleport soldiers or grant treatment or ammunition.
