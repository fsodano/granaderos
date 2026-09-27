# Larger tactical sectors

New tactical sectors are **64 × 48 squares** (3,072 squares, 9.6 times the previous 20 × 16 area). The camera and minimap use the actual map dimensions. Grid labels continue from Z through AA to AV.

The ten settlement sectors each contain **20 enterable buildings**. New neighbourhood houses occupy 5 × 5 squares, including walkable interiors, a door, a window, and a chest. They leave at least two clear squares between footprints. One added building per town is a pulpería (`purpose: bar`) for future civilian social routines when the original layout has no tavern. Existing landmarks, courtyards, furniture, and building IDs remain in a protected central area. The rural mission maps of San Lorenzo and Yatasto have six buildings each; Uspallata, Los Patos, and Humahuaca remain undeveloped passes.

The expansion is an original gameplay layout, not a reconstruction of surveyed historical city blocks. Coast and cliff boundaries remain impassable. Roads continue to the new edges. The former Jujuy house's blocked southern doorstep gains a short passage to the exterior.

## Compatibility

- Saved 20 × 16 sectors retain their original terrain, doors, items, and unit positions when revisited. Active saved battles are not resized during combat. New or previously unvisited sectors use the larger layout.
- Expanded sectors retain their terrain when revisited.
- Original encounter formations retain their relative positions around the landmark. The expansion does not alter troop stats, seed, weapon rules, inventory, or income.
- NPCs, artillery, garrisons, and mission allies receive the same landmark translation as buildings.
- A campaign with all fifteen expanded locations and no deployed soldiers round-tripped at less than 5 MB under the 5 MB save limit; the inner campaign loader now uses the same limit as the save envelope. Active battles, troops, dropped items, and campaign history add to that size.

## Verification

`tests/large-sectors.test.mjs` covers dimensions, building count, door/interior access, house clearances, spawn collisions, compact-save compatibility, expanded revisits, full-sector exploration paths, save size/restore, and labels beyond row Z. Compact authored-map regression tests remain explicit compatibility fixtures.
