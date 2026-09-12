# Firearm range and sight

A weapon's effective reach and the difficulty of seeing the aiming point now have separate effects on firearm accuracy. A long barrel does not improve a soldier's vision. A torch can make a target easier to aim at without extending a pistol's reach. A teammate can spot a distant target for a shooter, but the shooter still pays the accuracy cost of that difficult view.

## Source and adaptation

[JA2 Stracciatella, Weapons.cc, CalcChanceToHitGun](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Weapons.cc) separates physical distance, gun range, and effective sight distance. It penalizes distance beyond normal vision twice, uses effective sight distance for head/leg aim, and halves the remaining chance independently for exceeding gun range and sight range. These principles and the following range terms are source-derived, with ten source world units converted to one tile:

- Weapon deduction: `max(0, trunc((3 × distance − weaponRange) × 10 / 17))`.
- Effective sight distance: `apparentRange + max(0, apparentRange − visibleRange)`.
- Sight adjustment: `trunc(3 × (9 − effectiveSightDistance))`.
- Head/leg deductions use the effective sight distance at three/one points per tile.
- Exceeding weapon range or sight range each multiplies the remaining chance by one half. Both can apply. The exact boundary does not trigger a half penalty.

Granaderos maps its existing concealment, smoke, and darkness weights to apparent distance by dividing their combined accuracy weight by three. This conversion is explicit game tuning, not JA2's three-dimensional LOS routine. Night training changes the existing visual limit and reduces the darkness weight. The line-marksman trait retains its smaller smoke penalty. Detection still uses the existing facing, terrain, light, smoke and stealth gates; weapon range has no role in detection.

The former weapon-specific hard accuracy caps and linear over-range deduction are removed. Weapon identities and ranges, the 1–95% final bound, eight points per aim increment, stance support, injury, breath, shock, morale and authored trait modifiers remain period-game tuning. This change does not introduce modern scopes or reproduce every classic accuracy modifier. Roof elevation, detailed optical geometry and additional equipment modifiers remain separate gaps.

## Integration

Named shots, contextual firearm use, enemy shot options, reaction shots and location-fire impact share the same calculation. The target preview shows physical distance, weapon reach, and each active half-chance penalty. It retains obstruction and friendly-interception warnings. Projectile geometry can still reduce the actual impact chance to zero regardless of optical accuracy.

Location-fire previews remain anonymous: they expose no hit chance, body location or range-derived hidden occupant information. Actual impacts use a fixed aiming height and the same range calculation. The changed formula requires no new mutable save fields; saved units, lighting and smoke determine it on continuation.

## Verification

Nine focused cases cover the two independent range effects, exact boundaries, close-range bonus, weapon swaps, night training, real illumination, smoke and body targeting, teammate spotting, anonymous location previews, obstruction, HUD/AI agreement, paid aim and saved fire. Existing body-targeting tests now isolate location deductions below the final chance cap; the clear-cover preview test also expects the new range readout. All 1,215 tests pass in the isolated gameplay checkout, including the complete opening from the original campaign seed. The final opening replay also passes after strengthening the finite-loot assertions. Type checking and the production build pass. A separate run of the shared checkout passes 1,241 of 1,242 tests; its remaining civilian-prone playback mismatch belongs to the concurrent, uncommitted sprite changes and is outside this gameplay checkpoint.

Live QA used a separate `?qa=1` quick battle. Dorrego's pistol preview showed 15.8 tiles against a nine-tile weapon range and retained the obstruction warning. Barcala's rifle showed 13 tiles against a 22-tile range, 62% impact chance and 11 AP. The actual shot reduced AP from 100 to 89 and emptied the gun. The next firing input reloaded one cartridge: AP 89→47, reserve 12→11. Smoke from the first shot then produced the independent difficult-sight warning and a 29% preview while physical range remained unchanged.

## Opening campaign verification

The original seed-8 opening victory requirement in `tests/opening-playthrough.test.mjs` now passes both authored maps under this range model: San Nicolás in 19 turns/142 orders, then San Lorenzo in 16 turns/144 orders. Each battle replays deterministically. Nine deaths persist through campaign reports and saves; this is a costly route, not evidence that campaign balance is finished.

The driver recovers from knockdown before equipment orders, kneels when a prone Baker reload exceeds available AP, and lets the mission commander act when no other active squad member remains. After paid replacement recruitment, the new squad revisits the cleared San Nicolás field and approaches three fallen riflemen. It takes their actual primary weapons and equips them through ordinary loot and pack actions. The replaced guns and loaded rounds remain in the owners' packs. Tests compare weapon records before and after, verify stripped bodies, preserve reserve ammunition and round-trip the campaign save before the second attack.

The earlier opening failure was retained while this route was established. There is no seed change, injected victory, free equipment, free reload or weakened outcome assertion. Core AI maintenance also now pays to kneel when that makes an otherwise unaffordable reload possible; see [field equipment](ai-field-equipment.md).

Campaign timing inspection found that ordinary attack requests omit their starting hour, unlike joint assaults. That separate daylight-start defect is recorded in the parity audit for correction. The complete later campaign and broader balance coverage remain unverified.
