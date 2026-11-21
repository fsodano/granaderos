# Turning to fire

During turn-based combat (and action-duration checks in tactical exploration), a firearm shot includes the action points needed to turn toward the selected target position and raise the weapon according to the shooter's stance and turn angle (parity row [I09](../../requirements/ja2-parity.md)). Named targets, ground shots, contextual firearm use, aim limits and autonomous shot selection use the same target-specific calculation. Cursor movement does not turn a soldier or spend AP.

## Source and period adaptation

Classic JA2 accounts for direction and weapon readiness in `MinAPsToShootOrStab`, but its stance combination differs from v1.13. See [Stracciatella Points.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L989-L1064).

Granaderos uses the combination rule in the project's pinned [v1.13 Points.cpp](https://github.com/1dot13/source/blob/ddb691318eb3dd0cdc6eab42139739b6d498c645/Tactical/Points.cpp#L1996-L2096) and [cost calculation](https://github.com/1dot13/source/blob/ddb691318eb3dd0cdc6eab42139739b6d498c645/Tactical/Points.cpp#L2383-L2419): above ground, turning and raising overlap, so the setup cost is the larger cost; prone setup adds both. A raised firearm must be prepared again for a standing turn over 135 degrees, a crouched turn over 45 degrees, or any prone turn. Smaller standing/crouched turns retain readiness.

Granaderos keeps its existing eight-direction turn tuning: 2 AP per 45-degree step standing or crouched, 4 AP prone, using the shorter direction. Weapon preparation and discharge retain their current period-specific values and personal modifiers. These are not a reproduction of classic JA2's numerical AP formula. The separate cost for changing the target location, gun-holding stamina, alternate firing modes and automatic stance animations remain outside this model.

## Behavior

`actionCosts(state, unit, point)` provides turning, raising, combined setup and discharge. Omitting the point gives the ordinary same-facing baseline for controls without a target. Named and point-shot validation use the full selected-position cost before any mutation. A rejected shot retains AP, facing, ammunition, readiness and time. A successful shot turns the unit and leaves its gun ready, including a misfire that retains the charge.

The preview shows **Girar** or **Preparar y girar**, followed by the discharge cost. Extra aim is added separately. The right-click aim cycle and the live aim limit reserve the selected target's complete base cost. AI evaluates the cost separately for each candidate target before buying aim. Militia and enemy reactions use that same planner and firing reducer.

The L look action pays only for the turn. It lowers a ready weapon when the same angle/stance limits require that. A second confirmation can then prepare it. Empty firing clicks remain reload requests: they spend only loading AP, deduct completed cartridges, and do not turn toward the clicked position.

Point-shot preflight uses coordinates and the shooter's state, without examining hidden occupants or cover. Exploration advances the full shot duration without reducing combat AP. Facing and readiness already belong to saved tactical state, so no new save field is needed.
