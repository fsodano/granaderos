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
- The final presentation check passed 53 tests. SVG, Three, and the minimap
  retain the authored wall shape until an active player observer sees a door or
  breach change. Unseen damage cannot change an actor silhouette. This check
  includes cache refreshes, inactive observers, and raised edges.
- The browser review opened a door by its edge control and moved the soldier
  through that edge. The editor review placed a 5 by 5 building and a south-edge
  door, then verified schema version 2, its x axis, its stable IDs, and the absence
  of structural terrain cells in exported JSON. Undo restored the empty test map.

## Local build checks

- Production build and type check passed. Static export verification checked
  1,377 files and 1,045 asset references. Build identity: `f1079b1eba64`.
- Documentation and baseline audits passed. Test partition self-tests passed
  5/5, and final partition verification included all 965 files exactly once.
- The complete full gate began with production source `74944df9`. The final
  presentation fix is `662f42a4`; its 53 affected tests, type check, production
  build, and browser door-crossing review passed separately. Campaign driver
  updates were checked against earned checkpoints with finite supplies, actual
  costs and casualties, official save round trips, and exact order replay.

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

## Complete branch gate

The complete branch run executed all 962 files: 956 passed and six failed.
It reported 7,113 tests: 7,104 passed, seven failed, and two skipped. The extra
failed case is the parent of the opening campaign subtest. The full suite is
not green. Its first failure in each affected file was:

| File | First failure in the complete branch run |
| --- | --- |
| `fresh-campaign-recovery.test.mjs` | The old Tucumán combat policy lost a hospital patient. |
| `fresh-ending-route.test.mjs` | The native campaign required a real rifle for operative 130. |
| `fresh-northern-route.test.mjs` | Urgent wounded northern veterans needed care before the physician approach. |
| `fresh-cuyo-route.test.mjs` | The same urgent northern care check failed. |
| `fresh-historical-loss.test.mjs` | The same urgent northern care check failed. |
| `opening-playthrough.test.mjs` | A rescued clinic patient died during its real raid. |

The follow-on recovery check passed Tucumán and hospital care with the public
clear-shot policy, then reached the same inaccessible Córdoba travel error as
main. Native readiness now proves a real rear rifle exchange, 12 paid recruits,
finite ammunition and physician stock, actual Tucumán victory, and exact saved
replay. Urgent northern care now uses only dressings found in the actual battle.
The earned Salta battery proof spends all seven real charges, retains six actual
losses, and completes Yatasto with saved replay. These focused results do not
claim that the entire ending, Cuyo, or historical-loss routes passed.

The clinic follow-on diagnostic used two paid recruits, three paid forts, real
contract renewals, and finite equipment. It won the raid with exact replay but
still lost patient 129 and physician 122. The original patient assertions remain
intact. This is a remaining branch campaign limit, not a confirmed main failure.
