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
  The final arrival correction passed 43 tests, including distributed militia,
  invaders, ordinary deployment, and a clear first inward step for entry.
- Combat checks cover thin wall clipping, penetration depth, incident-cell
  firing, windows, doors, throws, blast shielding, damage, artillery contact,
  bodyguard interception, and hidden stone ricochet forecasts.
- Content checks cover every shipped map and template, floor membership, room
  partitions, transforms, independent barriers, container routes, and reentry.
- Rendering checks cover all 14 building types in four rotations, door apertures,
  runtime damage and cache changes, facade partition junctions, raised controls,
  and exact edge IDs for mouse and keyboard input.
- The final presentation check passed 53 tests. SVG, Three, and the minimap
  use current active player sight for wall state. Outside that sight they use
  static geometry, without persistent memory of live wall changes. Unseen
  damage cannot change an actor silhouette. This check
  includes cache refreshes, inactive observers, and raised edges.
- The browser review opened a door by its edge control and moved the soldier
  through that edge. The editor review placed a 5 by 5 building and a south-edge
  door, then verified schema version 2, its x axis, its stable IDs, and the absence
  of structural terrain cells in exported JSON. Undo restored the empty test map.

## Local build checks

- Production build and type check passed. Static export verification checked
  1,377 files and 1,045 asset references. Build identity: `be9a567f1fdc`.
- Documentation and baseline audits passed. Test partition self-tests passed
  6/6. The latest quick run passed all 7,101 tests across 954 files in 1,219
  seconds. Its partition contained 967 files with 13 extended files excluded.
  Later checkpoint tests are checked separately and require a final partition
  count; the quick result does not include tests added after its discovery.
- The final partition includes all 971 files exactly once: 957 quick and 14
  extended. Its six self-tests pass. The extra extended entry is the new bounded
  earned Salta guard/raid/detour check. Final mountain component checks pass
  11/11, including the unchanged four deployment cases and the added explicit
  field-gun/swivel case with ordinary, presented, and saved order replay.
- The complete full gate began with production source `74944df9`. The final
  presentation fix is `662f42a4`; its 53 affected tests, type check, production
  build, and browser door-crossing review passed separately. Campaign driver
  updates were checked against earned checkpoints with finite supplies, actual
  costs and casualties, official save round trips, and exact order replay.
- Final production source is `f12c2d0f`. Its last correction makes distributed
  militia use the same outside boundary rule as ordinary arrivals. The affected
  43-test gate, type check, production build, and browser crossing review passed.

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
| `fresh-ending-route.test.mjs` | The native campaign required a real long gun for operative 130. |
| `fresh-northern-route.test.mjs` | Urgent wounded northern veterans needed care before the physician approach. |
| `fresh-cuyo-route.test.mjs` | The same urgent northern care check failed. |
| `fresh-historical-loss.test.mjs` | The same urgent northern care check failed. |
| `opening-playthrough.test.mjs` | A rescued clinic patient died during its real raid. |

The follow-on recovery check passed Tucumán victory and pre-evacuation
stabilization with the public clear-shot policy, then reached the same
inaccessible Córdoba travel error as main, before the hospital setup. Native
readiness now proves a real rear musket exchange, 12 paid recruits,
finite ammunition and physician stock, actual Tucumán victory, and exact saved
replay. Urgent northern care now uses only dressings found in the actual battle.
The earned Salta battery proof spends all seven real charges, retains six actual
losses, and completes Yatasto with saved replay. These focused results do not
claim that the entire ending or Cuyo routes passed.

The first clinic diagnostic won the raid but lost a patient. A later public
search found seven finite dressings on four inspected bodies. With the two
existing reserve dressings, real paid care restored all four released patients
before the unchanged raid clock. The original medical assertions passed 2/2;
the six-case clinic gate passed 6/6. No patient health, supply, raid clock, or
victory was assigned. The whole opening run passed its first five stages, then
reached a distinct Salta rear-guard shortlist failure.

The Cuyo continuation won Mendoza with exact replay and settlement. It then
recaptured Salta through actual combat to free the delayed `arsenal:cordoba:2`
convoy. Five additional actual casualties remain dead. The unloaded cannon
reached Córdoba with its original identity and no added rounds. Actual contract
renewals, return travel, and 60 militia training completed the army funding
requirements. The earned convoy and funding regression passed 1/1.

The stock northern continuation passed Salta with a public support order for
the actual physician, finite local first aid, and physical relief of routed
survivor 107 at `cell-12-8`. Its earned regression passed 1/1 with full and
midpoint saved replay. Stock Yatasto completed at hour 378, second 2572. A later
physician visit replaced the scene cache, so the provincial meeting now also
uses actual surviving resident records. The original health, leadership,
service, and contract gates remain in place. The full ending is not verified.

The historical-loss route now uses the same admitted Mendoza battery policy as
the Cuyo route. It wins actual Mendoza with eight finite charges, then performs
the two real melee actions required to kill engineer 2. The foundry refusal,
loss flags, previous deaths, saves, and settlement pass. The complete fresh
historical-loss file passed 1/1 in a separate run.

## Campaign recheck

The six failed campaign files were rechecked after the readiness, urgent care,
and created Salta driver updates. The recheck ran on production `662f42a4`,
before the final isolated militia arrival correction. It reported 13 tests:
five passed, six failed, and two skipped. One of the six failed cases is the
opening test's parent. The entire `fresh-northern-route.test.mjs` file passed.
The remaining failures were:

| File | Recheck result |
| --- | --- |
| `fresh-campaign-recovery.test.mjs` | Same inaccessible Córdoba travel error as main, before hospital setup. |
| `fresh-cuyo-route.test.mjs` | The third bronze cannon had no remaining controlled physical supply source. |
| `fresh-ending-route.test.mjs` | Finite first aid failed to stabilize actual survivor 101 after Salta. |
| `fresh-historical-loss.test.mjs` | The Mendoza loss setup battle remained active at the driver's limit. |
| `opening-playthrough.test.mjs` | The raid left an actual critical wound, capture, or death that rest could not bypass. |

Only the recovery error was confirmed at the same stage on unchanged main.
The other failures remain branch limits. The full suite was not run again after
the isolated militia correction; its four affected files passed 43/43 instead.

## Later bounded campaign checks

The complete quick run on final production `f12c2d0f` passed 7,101/7,101 tests
across 954/954 selected files. Its 13 extended files were excluded by the
declared partition. This run includes the final wall, visibility, boundary,
editor, and rendering code. Checkpoint tests added after discovery were run
separately. The earlier complete full run and its failures remain recorded above.

The stock rear-defense regression passed 1/1. It admits the actual hour 438
Córdoba raid while the battery crew is in Tucumán. The defense wins in seven
turns and 209 paid actions, retains five deaths, then consumes two existing
dressings to stabilize survivor 108. Full and midpoint saved battle replay
match. The original two cannon records arrive at Córdoba at hour 457 without
added ammunition. Treasury checks include real renewals, transport, posta
tolls, and ordinary midnight income.

The stock service-relief regression passed 1/1. Operative 130 has morale zero
and refuses the required renewal. Ordinary dismissal returns all nine exact
stacks at Córdoba. A current available replacement receives a paid week term
for 46,200 pesos, arrives after six real hours, and takes the returned loaded
musket and 11 compatible rounds. All 11 public orders match midpoint saved
replay. The subsequent original stock Mendoza preparation admits 14 actual
living soldiers at hour 490, second 1435. One original gun still has seven
charges; the other remains spent. This proves preparation, not battle victory
or completion of the ending route.

The earned Cuyo artillery procurement regression passed 1/1. Two actual paid
columns win Ensenada in 13 turns and 410 orders with complete saved replay.
Eight additional real casualties remain dead. The surviving crew opens the
one-time arsenal through public orders and sends its original field gun and
swivel cannon to Mendoza by 54-hour carts. Each has seven finite charges; none
of the three original spent bronze cannons gains ammunition or changes custody.
The original foundry squad returns at hour 976, second 1721. This verifies the
side operation and finite supply, not a mountain victory or the whole Cuyo route.

The later native mountain preparation moves actual healthy serving reserves
127 and 144 from Córdoba to Mendoza, then uses ordinary paid rest. Both reach
readiness at hour 1094. Six real replacements become eligible. Before the
Uspallata battle, the existing recruit treasury assertion then differs by 53
pesos because the retained-order helper renews clinic physician 116 on that
action. The mountain attack and later Cuyo stages remain unverified.

The final combined procurement/readiness regression passes 1/1. Its reserve
step records 157 public orders, 3,980 pesos of renewals, ten pesos of posta
tolls, and five normal 8,000-peso midnight payments. Exact midpoint saved
replay reproduces the same readiness state. The physical clinic, patient wounds,
supplies, gun custody, and all prior deaths remain unchanged by that step.

The later opening preparation hires an actually available paid rear guard,
recovers one exact local firearm, and wins its real support-battery raid with
saved replay. Actual survivors 144 and 130 still bleed. The immediate care
attempt finds no dressings in inspected bodies, local clinic/shop stock, or
usable carried linen. Its unproven care helper was removed. The original care,
deployment, victory, permanent-loss, and Yatasto assertions remain enforced.
The whole opening route remains unverified.

The final bounded guard/raid/detour file passes 2/2 in 148 seconds. It preserves
the actual raid deaths and wounds. The bounded coastal detour uses the public
route planner and ordinary march
orders. With actual participant renewals, 24 hourly waits cost 897 pesos and
end at `cell-26-27` with a real exhaustion pause. Exact midpoint saved replay
matches. Survivor 144 has 28 HP with bleeding one; survivor 130 has four HP
with bleeding two. This verifies admission and progress, not arrival, cannon
delivery, medical recovery, or completion of Salta and Yatasto.
