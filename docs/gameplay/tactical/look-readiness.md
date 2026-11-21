# Preparing a firearm with the look cursor

During tactical exploration and turn-based combat, confirming the **L** look cursor in the soldier's current facing direction raises and prepares an equipped firearm before its first shot. No separate action button is used.

## Source distinction

Classic JA2's look cursor turns a soldier and rejects an unchanged direction. See [Stracciatella, Handle_UI.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Handle_UI.cc#L3574-L3645).

The project's pinned JA2 v1.13 source extends the same control: `UIHandleLCOnTerrain` previews the ready cost when the soldier already faces the selected direction, and `MakeSoldierTurn` pays that cost to raise the weapon. Its comments explicitly avoid setting the last target merely by preparing the weapon. Reference: [1dot13/source at ddb6913, Handle UI.cpp](https://github.com/1dot13/source/blob/ddb691318eb3dd0cdc6eab42139739b6d498c645/Tactical/Handle%20UI.cpp#L5291-L5486). This behavior is the v1.13 enhancement, not a claim about the classic look control.

## Interaction

Press L and choose a map position. If its compass direction differs from the soldier's facing, the order spends the existing turn AP. Choose that direction again to prepare the held firearm. A soldier already facing the desired direction can prepare it on the first confirmation.

The shared target preview shows **Preparar el arma**, the preparation cost, and the remaining AP. Confirmation raises the weapon without firing, acquiring a target, granting extra aim, or consuming a cartridge. F then enters the usual firing cursor; the next shot charges only discharge and any extra aim. Preparation plus firing costs the same total as firing an initially lowered weapon.

The action uses only orientation and held equipment. An occupied tile, unseen enemy, or wall does not change its cost or disclose a target. Looking at the soldier's own tile or an invalid map position is rejected. An empty or jammed firearm may be raised, but remains empty or jammed. The normal firing/reload rules still apply. A blade, medical kit, empty hand, or dropped weapon cannot create a firearm preparation action.

Repeated confirmation when the weapon is already ready reports that state and spends nothing. No extra AP are required to reserve a future shot: the soldier may use the last preparation AP now and fire on a later turn. Existing movement, equipment, collapse and loading rules lower the weapon normally. Looking uses the [same angle and stance limits as firing](shot-turning.md): over 135 degrees standing, over 45 degrees crouched, or any prone turn lowers a ready weapon.

Combat preparation uses the current AP and interrupt window. In exploration it advances the existing action-duration clock without spending combat AP. Readiness follows the existing save rules; no new save field or migration is needed.

## Limits

The v1.13 control uses the current Granaderos AP tuning and eight-direction
facing. Dedicated lower-weapon input, weapon-holding stamina costs,
target-switch costs and persistent sprite pose dispatch remain separate work.
