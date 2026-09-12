# Preparing a firearm with the look cursor

Implemented 12 September 2026. The existing L control can prepare an equipped firearm before its first shot. No separate action button is added.

## Source distinction

Classic JA2's look cursor turns a soldier and rejects an unchanged direction. See [Stracciatella, Handle_UI.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Handle_UI.cc#L3574-L3645).

The project's pinned JA2 v1.13 source extends the same control: `UIHandleLCOnTerrain` previews the ready cost when the soldier already faces the selected direction, and `MakeSoldierTurn` pays that cost to raise the weapon. Its comments explicitly avoid setting the last target merely by preparing the weapon. Reference: [1dot13/source at ddb6913, Handle UI.cpp](https://github.com/1dot13/source/blob/ddb691318eb3dd0cdc6eab42139739b6d498c645/Tactical/Handle%20UI.cpp#L5291-L5486). This behavior is the v1.13 enhancement, not a claim about the classic look control.

## Interaction

Press L and choose a map position. If its compass direction differs from the soldier's facing, the order spends the existing turn AP. Choose that direction again to prepare the held firearm. A soldier already facing the desired direction can prepare it on the first confirmation.

The shared target preview shows **Preparar el arma**, the preparation cost, and the remaining AP. Confirmation raises the weapon without firing, acquiring a target, granting extra aim, or consuming a cartridge. F then enters the usual firing cursor; the next shot charges only discharge and any extra aim. Preparation plus firing costs the same total as firing an initially lowered weapon.

The action uses only orientation and held equipment. An occupied tile, unseen enemy, or wall does not change its cost or disclose a target. Looking at the soldier's own tile or an invalid map position is rejected. An empty or jammed firearm may be raised, but remains empty or jammed. The normal firing/reload rules still apply. A blade, medical kit, empty hand, or dropped weapon cannot create a firearm preparation action.

Repeated confirmation when the weapon is already ready reports that state and spends nothing. No extra AP are required to reserve a future shot: the soldier may use the last preparation AP now and fire on a later turn. Existing movement, equipment, collapse and loading rules lower the weapon normally.

Combat preparation uses the current AP and interrupt window. In exploration it advances the existing action-duration clock without spending combat AP. The previous readiness save rules apply; no new save field or migration is needed.

## Verification

Eleven focused tests cover turn/prepare sequencing, exact total shot cost in every stance, no targeting bonus, knowledge-limited previews, held items, empty/jammed guns, invalid orders, zero remaining AP, a real saved interrupt, a complete campaign save and L/help text. The HUD regression now checks the preparation offered after a paid turn and the rejected repeated preparation.

The complete isolated suite passed 1,296/1,296 tests; type checking and the production build passed. Live verification in the separate `?qa=1` San Lorenzo skirmish used R to reload Dorrego: 49 to 21 AP, one to two prepared charges, and ten to nine reserve cartridges. L and confirmation turned him at the displayed cost. After the final turn he had 13 AP; a pointer confirmation in the same direction prepared the weapon for 2 AP, leaving 11 AP and both charges unchanged. Repeating the pointer confirmation showed the already-ready message and spent nothing. F then previewed a 4 AP shot with 7 AP remaining. This test did not use the normal campaign save. The v1.13 control uses the current Granaderos AP tuning and eight-direction facing. Dedicated lower-weapon input, weapon-holding stamina costs, automatic shot turning/target-switch costs and persistent sprite pose dispatch remain separate work.
