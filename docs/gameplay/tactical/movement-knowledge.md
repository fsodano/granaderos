# Movement and hidden occupants

During tactical exploration and turn-based combat, route planning and the displayed route preview consult only known friendly units and currently observed occupants—never an unseen person's position—and stop a moving soldier immediately before any physical obstruction encountered along the path. See [parity requirements rows T07 and V01](../../requirements/ja2-parity.md) for the broader AI movement and player-knowledge requirements.

Ordinary movement plans with friendly units and observed occupants. Player troops share their side's sight; enemy planning uses the acting soldier's sight. Civilian occupancy follows the same observation rule. Terrain, props, movement costs and elevation rules are unchanged. The rule does not change map discovery or building geometry.

The worker route preview uses the same observation rules. A hidden soldier, civilian or cannon cannot change the displayed route. Friendly soldiers remain known blockers. Budget previews and routes that preserve facing use the same observed battlefield, on both ground and upper levels.

The existing step loop still checks the complete physical battlefield. A soldier follows the planned path, pays for completed steps, and stops before an actual obstruction. It cannot overlap a person or silently reroute around unseen bodies. Existing contact, interruption, collapse, exploration time and light updates still run after each completed step. An already known occupied destination remains an atomic rejected order. Explicit climbing retains its existing access validation.

Direct and continued movement both stop before a physical obstruction and spend resources only for completed steps. A route preview does not permit entry into an occupied cell.
