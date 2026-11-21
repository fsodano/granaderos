# Weapon readiness

During turn-based combat (and action-duration checks in tactical exploration), the cost of raising a firearm into firing position is separate from the cost of discharging it (parity row [I09](../../requirements/ja2-parity.md)). The same-facing first-shot total retains the existing Granaderos balance. Keeping a weapon in its firing position avoids paying the raising portion again.

## Source and adaptation

Classic JA2 checks firing-ready animation state before adding the weapon's ready time. Its attack cost also coordinates turning and raising according to stance and adds a cost for changing targets. See [Points.cc: GetAPChargeForShootOrStabWRTGunRaises and MinAPsToShootOrStab](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L989-L1076) and [GetAPsToReadyWeapon](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L1516-L1546).

Granaderos represents the firing posture as saved simulation state, independent of animation timing and cursor movement. The readiness portion is supplemented by [target-specific turning](shot-turning.md), which uses the pinned v1.13 stance combination. Target-change, rate-of-fire and skill formulas are not fully reproduced.

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

Paid movement, posture changes, equipment use, pickups, drops, handoffs, weapon swaps and melee end the firing posture. A successful handoff also lowers the receiver's weapon. Knockdown, unconsciousness, death, rout and departure clear readiness. A failed order does not clear it. Looking retains readiness through 135 degrees standing or 45 degrees crouched. Larger turns and every prone turn lower the weapon. Free movement-mode, stealth and overwatch settings do not grant or remove readiness.

Readiness survives turn boundaries and saved reaction queues. It belongs to the actor, not the weapon item: packing, passing or stealing a gun cannot give the receiver a free prepared shot. A new deployment begins with lowered weapons. Older tactical saves without the field begin unprepared; malformed ready states are rejected.

The existing reticle total includes all costs. The target preview and held-item help show **Preparar** and **disparar** separately, or **Arma en posición de tiro**. There is no additional action button, and entering aim mode remains free. The [L look control](look-readiness.md) can also prepare a firearm before firing: face a direction, then confirm that direction again for the preparation cost. Enemy choices, militia actions, point shots, ordinary shots and aim limits use the shared cost calculation. Public state exposes a hired soldier's readiness but does not expose enemy readiness.

## Limits

Dedicated lower-weapon input, held-weapon stamina costs, target-switch AP and
persistent firing-posture sprite dispatch remain separate work. Artillery is
unchanged.
