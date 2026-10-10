# Shared wall edge verification

## Result

Walls, doors, and windows occupy the shared edge between adjacent floor cells.
Building footprints provide all `width * height` floor cells. Closed edges block
crossing, including diagonal corner routes, without blocking either cell centre.
Opening or destroying one segment changes that segment and retains the floors.

The change covers authoring and compilation, room identity, movement and contact
orders, civilians and artillery, sight and projectile volumes, blast damage,
public combat forecasts, sector reentry, SVG and Three rendering, exact tactical
controls, and editor edge selection. All 15 shipped maps and 14 templates use
the new format. Compatibility with earlier campaign saves is outside scope.

## Focused checks

- Native geometry and admission tests cover duplicate identities, unsupported
  levels, malformed coordinates, conflicting action references, and all four
  diagonal boundary edges.
- Boundary checks cover exits, arrivals, departure receipts, prisoners and quest
  escorts at closed outside edges in all four directions. Ground cells remain
  usable; a closed outside edge prevents crossing out of the map.
- Combat checks cover thin wall clipping, penetration depth, incident-cell
  firing, windows, doors, throws, blast shielding, damage, artillery contact,
  bodyguard interception, and hidden stone ricochet forecasts.
- Content checks cover every shipped map and template, floor membership, room
  partitions, transforms, independent barriers, container routes, and reentry.
- Rendering checks cover all 14 building types in four rotations, door apertures,
  runtime damage and cache changes, facade partition junctions, raised controls,
  and exact edge IDs for mouse and keyboard input.
- The browser review opened a door by its edge control and moved the soldier
  through that edge. The editor review placed a 5 by 5 building and a south-edge
  door, then verified schema version 2, its x axis, its stable IDs, and the absence
  of structural terrain cells in exported JSON. Undo restored the empty test map.

## Local build checks

- Production build and type check passed. Static export verification checked
  1,377 files and 1,045 asset references. Build identity: `bc59a1ee65da`.
- Documentation and baseline audits passed. Test partition self-tests passed
  5/5, and coverage verification included all 962 files exactly once.
- Production source was held at `74944df9` during the final full suite and
  browser review. Later checkpoints update test drivers and their assertions.

## Main branch comparison

The unchanged main branch at `b5a4a114` completed all 955 test files with
7,054 tests: 7,045 passed, five failed, and four skipped. The five failed cases
belong to four files:

| File | Main branch failure |
| --- | --- |
| `fresh-ending-route.test.mjs` | Required finite physician dressings were unavailable. |
| `fresh-campaign-recovery.test.mjs` | The Córdoba travel route included an inaccessible land cell. |
| `fresh-cuyo-route.test.mjs` | Ángela Cejas refused renewal with morale below 30. |
| `opening-playthrough.test.mjs` | Operative 130 lacked six finite musket rounds at Córdoba; its parent case also failed. |

Full-suite results for this branch are recorded below after the final run.
