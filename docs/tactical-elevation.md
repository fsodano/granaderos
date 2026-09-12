# Tactical elevation

The elevation branch adds a first playable terrace model. Production sector maps
still need authored surfaces and access points. Decorative roofs alone do not
activate this feature. This is partial JA2 parity, not complete support for all
terrain heights or building floors.

## Physical space

`tacticalLevel` is independent of a soldier's earned `level`. Existing dense
terrain stays at level 0. Optional `upperSurfaces` provide stable IDs, physical
height, solid floor thickness, cover and building membership. Optional
`climbLinks` connect supported adjacent cells on consecutive levels. Both
endpoints must be free terrain. A roof can contain blocked chimney and parapet
cells without removing the solid ceiling below them.

Walking requires support at the same physical height and rejects diagonal corner
cuts. Occupancy includes the floor, so a person upstairs does not block the same
coordinates downstairs. Paths retain each climb link and destination level.
Sector expansion translates coordinates, and save/reentry keeps physical levels
separate from earned grade. Fresh enemy posts retain their authored floor and
coordinates. Admission rejects unsupported upper positions, overlapping conscious
occupants, blocking roof furniture and mounted upper occupants before relocation.

## Costs and interactions

- Climb up: 20 AP in combat, 12 base energy, 6 seconds in exploration.
- Climb down: 15 AP in combat, 8 base energy, 4 seconds in exploration.
- Load modifies energy. Exploration never deducts AP. Combat uses the existing
  turn budget and does not grant an extra budget for a climb.
- Soldiers must stand before climbing. Mounted, bound, knocked-down, blocked,
  exhausted or unaffordable climbs reject before moving.
- First visual contact stops an exploration route at the completed step and
  starts the existing combat initiative and AP rules.
- Medical aid, melee, item transfers, loot, doors and containers use their real
  floor. An equipped-item approach must traverse an actual access before use.
- Enemy decisions, group orders, medical automation, patrols and retreat retain
  floors and execute paid movement. An unseen enemy's live floor cannot become
  a remembered position or an AI route instruction.

## Sight and projectiles

Absolute muzzle and body heights share a geometry trace with terrain, furniture
and floor slabs. Shots can pass over a low obstacle or meet a ceiling. Stacked
actors remain separate targets. Seeded misses retain the aimed absolute height.
Only a specifically requested door or container can expose its own visible face;
that exception does not reveal a person behind it or change bullet resistance.

Smoke occupies the space above its supporting surface. Roof smoke does not
obscure a downstairs horizontal shot. Light uses the same occlusion model.
Heights, smoke depth, climb costs and resistance are explicit game tuning.

## Controls and checks

On an authored elevation map, Tab over the battlefield changes the cursor floor.
Tab in an ordinary control or inventory keeps native keyboard navigation.
Right-click inventory shows adjacent access controls. Movement, target regions,
selection rings, item markers and actor positions use the selected floor. Actor
feet, rings, hit targets and movement endpoints align with the existing roof mesh,
including its horizontal inset. Tests compare the actual house, mansion and flat
warehouse roof vertices with these rendered positions.

An isolated house fixture provides day/night and combat/exploration variants,
six existing operatives, blocked roof decor, two climb routes, and stacked actors.
Live checks confirmed:

- An exploration climb changed Dorrego's energy from 100 to 88, with no AP cost.
- The combat climb changed AP from 100 to 80 and energy from 100 to 88.
- A shot from Beltran wounded the roof guard for 44 damage while the guard at
  the same ground coordinates stayed at 100 health.
- R reloaded one cartridge, changed reserve ammunition from 12 to 11, and spent
  26 combat AP. Tab selected the ground guard, and the cursor correctly reported
  that the ceiling blocked the firing line.
- A fresh browser session confirmed the corrected roof alignment, the west climb,
  a five-cell roof crossing and the north descent. Dorrego returned to ground with
  73 energy after the complete exploration route; its journal reported no AP cost.

The final integrated source passed 1,780 tests, typecheck and the production build
(960 exported files, 856 verified asset references). See the separate
[performance measurements](tactical-elevation-performance.md) for route and sight
query timing and its browser limitations.

## Remaining work

Production maps still need authored roof surfaces, legal access points and blocked
roof decor, passed through the normal sector-plan construction path. A legal
campaign visit/attack, climb, save/resume, return and reentry cycle must also be
verified with the real roof actors and gear; direct fixture placement is not proof
of that complete cycle. Each occupied roof must have a usable descent to a real
ground exit; link validation alone does not prove whole-map reachability. Each
sector needs live checks for floor selection, depth ordering, climb routes and
combat, followed by browser performance checks on the full map.
The standalone fixture does not enable campaign rooftops. Climbing currently uses
the available movement poses; dedicated climb animation remains an art task.

Cross-floor thrown items, artillery, mounted travel, manual breach and charge
remain unsupported in this slice. All floor slabs stop firearm projectiles.
Stairs, swimming, vaulting, arbitrary terrain slopes, destructible floor support,
fall damage, furniture destruction and ricochet remain outside this model.
