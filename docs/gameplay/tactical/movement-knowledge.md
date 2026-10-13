# Movement and hidden occupants

Route planning must not consult an unseen person's current position. This rule applies to both the displayed route preview and native movement orders.

Ordinary movement now plans with friendly units and observed occupants. Player troops share their side's sight; enemy planning uses the acting soldier's sight. Civilian occupancy follows the same observation rule. Terrain, props, movement costs and elevation rules are unchanged. This is not a new map-discovery or building-geometry implementation.

The worker route preview uses the same observation rules. A hidden soldier, civilian or cannon cannot change the displayed route. Friendly soldiers remain known blockers. Budget previews and routes that preserve facing use the same observed battlefield, on both ground and upper levels.

The existing step loop still checks the complete physical battlefield. A soldier follows the planned path, pays for completed steps, and stops before an actual obstruction. It cannot overlap a person or silently reroute around unseen bodies. Existing contact, interruption, collapse, exploration time and light updates still run after each completed step. An already known occupied destination remains an atomic rejected order. Explicit climbing retains its existing access validation.

Regression tests cover hidden occupants, shared allied sight, civilians, invalid orders, exact saved replay and the worker preview. Direct and continued movement both stop before a physical obstruction and spend resources only for completed steps. A route preview does not permit entry into an occupied cell.
