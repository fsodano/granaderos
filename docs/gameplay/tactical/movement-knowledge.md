# Movement and hidden occupants

Route planning must not consult an unseen person's current position. The Ensenada campaign continuation exposed a mismatch: the controller planned toward a forest cell using observed occupants, but execution recalculated that route with every hidden enemy. It rejected the entire order before the soldier took a step.

Ordinary movement now plans with friendly units and observed occupants. Player troops share their side's sight; enemy planning uses the acting soldier's sight. Civilian occupancy follows the same observation rule. Terrain, props, movement costs and elevation rules are unchanged. This is not a new map-discovery or building-geometry implementation.

The existing step loop still checks the complete physical battlefield. A soldier follows the planned path, pays for completed steps, and stops before an actual obstruction. It cannot overlap a person or silently reroute around unseen bodies. Existing contact, interruption, collapse, exploration time and light updates still run after each completed step. An already known occupied destination remains an atomic rejected order. Explicit climbing retains its existing access validation.

Five regressions cover an unseen occupied destination, a hidden intermediate obstruction, shared allied sight, a civilian obstruction, invalid-order atomicity and exact saved replay. The reproduced Ensenada move now ends at (30,22), before the hidden occupant at (31,21), with 45 AP and no error. The earlier rejected state had 116 AP at (27,24). The 25-test movement/interrupt/exploration run and subsequent 38-test movement/awareness/sharing run pass. The full campaign battle and broader suite still require validation.
