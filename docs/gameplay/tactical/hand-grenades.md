# Hand-thrown arsenal grenades

Implemented 19 September 2026. This closes the missing equipped-item throw path; it does not establish full JA2 explosive parity.

## Player controls and supply

A grenade is an ordinary physical inventory stack. Put it in the main hand, right-click to enter the throw cursor, then left-click a ground point. A second right-click returns to movement. Grenades have a fixed throw cost and one target point: no extra aim levels or body regions. Explicit contextual `useItem` uses the held grenade, including a known person's position, without turning the action into a gift or a punch. A grenade in a pocket, the second hand or the equipment cursor is not a ready main-hand grenade.

One authored shipment of six is available from the supplied, friendly Mendoza workshop from campaign phase 3. Each costs 80 pesos; these are balance values. A present, available hired or created operative must have pocket capacity. The shipment does not refill, and recruits do not receive grenades by default. The ordinary inventory cursor supports holding, separating, merging compatible stacks, transferring, dropping and recovering them. Small pockets hold two; identified objects remain separate. Custom names, condition and provenance survive those transactions and saves.

The source is **campaign fiction**, not a verified delivery from Montevideo. The reviewed historical evidence establishes hand grenades in the captured Montevideo arsenal in 1814, not routine issue, an 1812 supply route, Mendoza manufacture, or a particular fuse. See [the period equipment evidence](../../reference/period-equipment-evidence.md).

## Costs, landing and damage

Throwing requires standing. That preparation is a separate paid action and can expose the soldier to a real reaction before the grenade leaves the hand. The cursor includes its cost. Turning is included in launch; there is no separate turning cost or launch breath cost. Exploration uses elapsed time without AP expenditure.

Strength, current energy and object weight limit range. Dexterity, marksmanship, wounds, morale, shock and fatigue affect the accuracy roll. A failed roll chooses a bounded, supported nearby destination without consulting hidden people. The throw removes exactly one actual grenade, preserves other equipment, and never spends firearm cartridges or priming powder.

A deterministic curved path tests shared wall, door, furniture and floor geometry. On an obstruction the grenade lands on the supported near side. It cannot pass through a ceiling or fall through a roof to a convenient ground tile. The UI shows the estimated landing, blocked path and known friendly risk. Launch and blast drawings are transient and expire; no animation state enters a save.

A normal grenade detonates at its final landing. Abstract blast values are radius 3, maximum health damage 55 and maximum energy damage 45. Distance and three physical body-height rays reduce exposure. Solid walls and slabs can block damage; low cover can shield part of an upright body or all of a prone body. Each living body is hit once, including the thrower, allies, routed, surrendered and unconscious people. Dead and departed people are excluded. Civilian health and energy changes survive report, save and sector reentry; dead and unconscious residents remain prone and cannot converse or move.

A poor-condition grenade can fail. It then remains as one condition-zero, recoverable, unusable ground object with its original metadata. A possible failure is rejected before payment if the ground-item limit cannot retain it. These condition and damage rules are game tuning, not instructions or specifications for real explosives.

Enemy soldiers and militia use the same finite inventory and paid equip, stand and throw orders. They require a visible target and a useful hit chance. Every possible supported scatter landing is checked against known allies, the thrower, visible civilians and visible incapacitated or surrendered opponents. The chooser does not use hidden enemy or civilian positions.

## Reference decisions and remaining gaps

The original [JA2 manual, printed page 32](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf) describes equipping and throwing to a point, separately from placed explosives. The implementation reference is Stracciatella commit `a06f4896c43c76396529e415a29a8ca26b00f9f1`:

- [Points.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Points.cc#L1694-L1746), [Handle_Items.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Handle_Items.cc#L856-L920) and [Soldier_Ani.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Ani.cc#L834-L865): standing, throw AP and zero launch breath.
- [UI_Cursors.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/UI_Cursors.cc#L1211): ordinary grenades do not gain right-click aim refinement.
- [Weapons.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L3533-L3745): throw range and accuracy use the soldier's relevant attributes, rather than explosives skill.
- [Physics.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Physics.cc#L2049-L2162) and [Explosion_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Explosion_Control.cc#L708-L743): landing detonation, malfunction branches and area damage to living occupants.

Still incomplete: subsequent physical bounces, classic blast propagation around corners and through destructible windows, object destruction and chain reactions, delayed malfunction fuses, placed timed/demolition charges, civilian faction hostility after an attack, and broader grenade encounter balance. An enemy turn displays its last visible grenade throw; a sequence of every AI action remains unfinished. The current direct-ray cover model, arc shape, AP scale, shipment, reliability and damage values are deliberate abstractions. Modern chemical/stun grenades and electronic remotes are outside the historical scope.

## Verification

The focused tests cover physical custody and capacity, finite paid supply, save migration, real throws and reactions, misses, failed grenades, health and energy loss, walls and floors, hidden-state independence, ordinary AI actions, NPC persistence, and actual HUD callbacks. The campaign tests use a stated late-Cuyo corridor checkpoint, then pay for recruitment, travel and grenade purchases through normal campaign orders. They are not evidence of a full campaign played from Retiro.

Live browser verification on 19 September 2026 used the stated checkpoint: purchase reduced stock 6 to 5 and treasury 3,289 to 3,209 pesos. Right-click cancellation restored actual movement and preserved all three held/pocket grenades. A subsequent aimed ground throw reduced three to two; exploration AP remained 44, HP remained 85, and reload/resume retained the two grenades and the moved position. No browser errors were reported. The demo uses a compact open field and does not establish full campaign progression or combat encounter balance.

The isolated gameplay tree passed all 2,427 tests, TypeScript checks, the production build, and the diff check. Static export validation confirmed 960 files and 856 asset references.
