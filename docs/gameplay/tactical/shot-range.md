# Firearm range and sight

During tactical exploration and turn-based combat, a firearm's effective physical reach and the observer's effective sight distance to the aiming point have separate effects on shot accuracy (parity row [C03](../../requirements/ja2-parity.md)). A long barrel does not improve a soldier's vision. A torch can make a target easier to aim at without extending a pistol's reach. A teammate can spot a distant target for a shooter, but the shooter still pays the accuracy cost of that difficult view.

## Source and adaptation

[JA2 Stracciatella, Weapons.cc, CalcChanceToHitGun](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Weapons.cc) separates physical distance, gun range, and effective sight distance. It penalizes distance beyond normal vision twice, uses effective sight distance for head/leg aim, and halves the remaining chance independently for exceeding gun range and sight range. These principles and the following range terms are source-derived, with ten source world units converted to one tile:

- Weapon deduction: `max(0, trunc((3 × distance − weaponRange) × 10 / 17))`.
- Effective sight distance: `apparentRange + max(0, apparentRange − visibleRange)`.
- Sight adjustment: `trunc(3 × (9 − effectiveSightDistance))`.
- Head/leg deductions use the effective sight distance at three/one points per tile.
- Exceeding weapon range or sight range each multiplies the remaining chance by one half. Both can apply. The exact boundary does not trigger a half penalty.

Granaderos maps its existing concealment, smoke, and darkness weights to apparent distance by dividing their combined accuracy weight by three. This conversion is explicit game tuning, not JA2's three-dimensional LOS routine. Night training changes the existing visual limit and reduces the darkness weight. The line-marksman trait retains its smaller smoke penalty. Detection still uses the existing facing, terrain, light, smoke and stealth gates; weapon range has no role in detection.

Weapon identities and ranges, the 1–95% final bound, eight points per aim increment, stance support, injury, breath, shock, morale and authored trait modifiers are period-game tuning. Modern scopes and every classic accuracy modifier are outside this model. Roof elevation, detailed optical geometry and additional equipment modifiers remain separate gaps.

## Integration

Named shots, contextual firearm use, enemy shot options, reaction shots and location-fire impact share the same calculation. The target preview shows physical distance, weapon reach, and each active half-chance penalty. It retains obstruction and friendly-interception warnings. Projectile geometry can still reduce the actual impact chance to zero regardless of optical accuracy.

Location-fire previews remain anonymous: they expose no hit chance, body location or range-derived hidden occupant information. Actual impacts use a fixed aiming height and the same range calculation. The range calculation requires no new mutable save fields; saved units, lighting and smoke determine it on continuation.
