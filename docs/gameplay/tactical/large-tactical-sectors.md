# Larger tactical sectors

Tactical battlefield maps for both exploration and turn-based combat are **64 × 48 squares** (3,072 squares). The camera and minimap use the actual map dimensions. Grid labels continue from Z through AA to AV.

The ten settlement sectors each contain **20 enterable buildings**. New neighbourhood houses occupy 5 × 5 squares, including walkable interiors, a door, a window, and a chest. They leave at least two clear squares between footprints. One added building per town is a pulpería (`purpose: bar`) for civilian social routines when the original layout has no tavern. Existing landmarks, courtyards, furniture, and building IDs remain in a protected central area. The rural mission maps of San Lorenzo and Yatasto have six buildings each; Uspallata, Los Patos, and Humahuaca remain undeveloped passes.

The expansion is an original gameplay layout, not a reconstruction of surveyed historical city blocks. Coast and cliff boundaries remain impassable. Roads continue to the new edges. The Jujuy house has a short passage from its southern doorstep to the exterior.

## Compatibility

- Saved 20 × 16 sectors retain their original terrain, doors, items, and unit positions when revisited. Active saved battles are not resized during combat. New or previously unvisited sectors use the larger layout.
- Expanded sectors retain their terrain when revisited.
- Existing logical route descriptors remain unchanged. Arrival placement maps their canonical anchors onto the actual destination's boundary, preserving authorized routes and arrival facing. It does not substitute an interior spawn for a blocked edge.
- Original encounter formations retain their relative positions around the landmark. The expansion does not alter troop stats, seed, weapon rules, inventory, or income.
- NPCs, artillery, garrisons, and mission allies receive the same landmark translation as buildings.
- A campaign with all fifteen expanded locations and no deployed soldiers occupies about 3.3 MB of the existing 5 MB save limit. Active battles, troops, dropped items and campaign history add to that size.
