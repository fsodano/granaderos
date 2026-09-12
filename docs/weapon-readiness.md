# Weapon readiness

Implemented 12 September 2026. The cost of raising a firearm is now separate from the cost of discharging it. The first-shot total retains the existing Granaderos balance. Keeping a weapon in its firing position avoids paying the raising portion again.

## Source and adaptation

Classic JA2 checks firing-ready animation state before adding the weapon's ready time. Its attack cost also coordinates turning and raising according to stance and adds a cost for changing targets. See [Points.cc: GetAPChargeForShootOrStabWRTGunRaises and MinAPsToShootOrStab](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L989-L1076) and [GetAPsToReadyWeapon](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L1516-L1546).

Granaderos represents the firing posture as saved simulation state, independent of animation timing and cursor movement. This change implements the readiness portion. It does not reproduce all classic turning, target-change, rate-of-fire or skill formulas.

The raising portions are explicit period tuning on the existing 100-point scale:

| Weapon | Raise | First shot | Subsequent ready shot |
| --- | ---: | ---: | ---: |
| Brown Bess | 6 | 12 | 6 |
| Charleville | 6 | 11 | 5 |
| Baker | 8 | 16 | 8 |
| Tercerola | 4 | 9 | 5 |
| Escopeta Criolla | 4 | 10 | 6 |
| Pistola de Arzón | 2 | 7 | 5 |
| Pistola de Duelo | 2 | 6 | 4 |
| Trabuco | 6 | 12 | 6 |
| Pistola Doble Cañón | 2 | 8 | 6 |

These are the ordinary costs before personal or mounted firing modifiers. Extra aim remains a separate addition. A single-barrel firearm normally needs loading before another shot, which lowers it again. The immediate benefit is therefore most visible with the double-barrel pistol.

## Behavior

A valid named or location shot pays preparation when needed, then leaves the weapon ready. This also applies to a misfire: the weapon was raised, although the charge remains. Reloading or re-priming lowers it.

Paid movement, posture changes, equipment use, pickups, drops, handoffs, weapon swaps and melee end the firing posture. A successful handoff also lowers the receiver's weapon. Knockdown, unconsciousness, death, rout and departure clear readiness. A failed order does not clear it. Looking while standing or crouched can retain readiness; turning prone lowers it. Free movement-mode, stealth and overwatch settings do not grant or remove readiness.

Readiness survives turn boundaries and saved reaction queues. It belongs to the actor, not the weapon item: packing, passing or stealing a gun cannot give the receiver a free prepared shot. A new deployment begins with lowered weapons. Older tactical saves without the field begin unprepared; malformed ready states are rejected.

The existing reticle total includes all costs. The target preview and held-item help show **Preparar** and **disparar** separately, or **Arma en posición de tiro**. There is no additional action button, and entering aim mode remains free. Enemy choices, militia actions, point shots, ordinary shots and aim limits use the shared cost calculation. Public state exposes a hired soldier's readiness but does not expose enemy readiness.

## Verification and remaining scope

Seventeen focused tests cover every firearm's baseline, two real shots, cursor costs, free targeting, actual turn advancement, lowering actions, failures, misfires, transfers, invalid states, AI, named/location fire, a full campaign save and an actual interrupted enemy continuation. The existing projectile-cover test now checks preparation text as well as the unchanged range warning.

Live verification passed in the separate `?qa=1` San Lorenzo skirmish. With Dorrego's personal firing modifier, the first ground shot used 6 AP (120→114); the next used 4 AP (114→110). Two loaded charges were consumed and all 12 reserve cartridges remained. R loaded both barrels for 55 AP, leaving 55 AP and 10 reserve cartridges. The help text again showed **Preparar: 2 PA · disparar: 4 PA**. After centering the camera, a physical mouse click fired one barrel for 6 AP (55→49); the next-shot preview showed 4 AP and **Arma en posición de tiro**. The tab remains on that prepared soldier. The skirmish did not write to the campaign save.

All 1,285 tests, the type check and the production build pass in the isolated gameplay checkout. Live save/reload and prone turning remain automated-test evidence. Separate paid weapon-raising controls, held-weapon stamina costs, automatic turning/target-switch AP, and persistent firing-posture sprite dispatch remain separate work. Artillery is unchanged.
