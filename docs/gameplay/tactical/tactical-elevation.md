# Tactical elevation

Fresh campaign maps now include accessible terraces on 36 existing single-storey
houses in nine sectors. The full-size maps contain 1,085 upper cells, of which
688 are walkable, joined to the ground by 71 access links. Existing saved maps keep
their stored topology. This remains partial JA2 parity: tall roofs, arbitrary
terrain heights and multi-storey interiors need further work.

Eligible sectors are Buenos Aires, Ensenada, San Nicolás, Santa Fe, Córdoba,
Mendoza, Tucumán, Salta and Jujuy. Retiro, the mountain passes, San Lorenzo and
Yatasto retain their existing pitched roofs. Mansions keep their tall roof art;
they do not receive an artificial 3 m playable floor.

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

The elevation foundation at `fc04e4d`, before campaign activation, passed 1,780
tests, typecheck and the production build (960 exported files, 856 verified asset
references). See the separate
[performance measurements](../../development/performance/tactical-elevation-performance.md) for route and sight
query timing and its browser limitations.

## Campaign activation

Campaign authoring runs through normal sector construction and final neighbourhood
expansion. Chimneys and the east/south parapets block walking but retain the solid
ceiling beneath them. Each house has west access; all but the Jujuy landmark also
have north access. Its northern cliff stays blocked. The topology tests verify
every walkable roof cell can reach a real ground sector exit through legal,
bidirectional movement.

Live checks on the full Buenos Aires map confirmed the west approach and climb
in daylight and at night. The complete four-cell roof crossing and north descent
were checked at night. During that route, the 17-cell approach used 22 energy, climbing used 12, the crossing
used 5 and descent used 8. Dorrego ended at 53 energy, with no exploration AP
charge. Equipping and using a torch reduced the real supply from two to one.
The torch lit the roof; the floor slab kept upstairs and downstairs light separate.

Campaign lifecycle tests use Buenos Aires ownership as their only strategic setup
precondition. They then pay for a civic recruit at Retiro, march to Buenos Aires,
enter at the boundary, approach and climb normally, use a held torch, drop and
collect ammunition, save/resume and return/reenter. No tactical geometry, position,
HP or equipment is injected. Carried ammunition, the roof pile and campaign stock
are checked together so legitimate resupply is not mistaken for duplication.

Roof props, lights, smoke and interactive upper controls now require shared sight;
a person below the ceiling cannot reveal them just by changing the cursor floor.
Static roof art remains visible. Browser verification is limited to the Buenos
Aires house and the earlier isolated fixture. Other sectors have complete topology
checks but still need visual and combat acceptance. Climbing currently uses the
available movement poses; dedicated climb animation remains an art task.

## Integrated verification

The campaign activation, patrol recovery, disclosure and room-index source at
`1002802` passed all 1,820 tests with zero skips, typecheck and the production
build (960 exported files, 856 verified asset references). The earned opening
and northern route preserve actual losses, captivity, finite equipment, paid
replacements and medical supplies through Yatasto. Those acceptance controllers
now use legal physical-floor routes and living available soldiers; they do not
force the earlier casualty counts. See [current route evidence](../../verification/northern-route.md).

The [room visibility index](../../development/performance/tactical-room-visibility-performance.md) reduces a
measured minimap cost while retaining exact tested render output. Browser checks
after integration confirmed normal approach, ascent and finite torch use with
the existing detailed artwork. Remaining long frames and long-session memory
still need performance work.

## Patrol recovery

Campaign acceptance found that long exploration waits let enemy patrols exhaust
nearly all their energy before contact. Patrols now use the existing six-second
recovery tick before a step would leave less than half their fatigue-limited
capacity. A costly climb can use a smaller reserve when full capacity cannot
retain half; it must still leave at least one energy point. Movement and climbing
retain their normal costs. Contact takes priority over recovery, and combat does
not accept free ambient recovery.

The real Buenos Aires six-recruit, 600-second wait regression leaves unseen
patrols at 55–58 energy instead of 1–11. Equivalent ambient ticks give the same
result. Ground and roof recovery, fatigue limits, costly and impossible climbs,
hidden-player independence and save replay have focused coverage. The reserve
threshold is Granaderos tuning.

## Remaining work

Cross-floor thrown items, artillery, mounted travel, manual breach and charge
remain unsupported in this slice. All floor slabs stop firearm projectiles.
Stairs, swimming, vaulting, arbitrary terrain slopes, destructible floor support,
fall damage, furniture destruction and ricochet remain outside this model.
