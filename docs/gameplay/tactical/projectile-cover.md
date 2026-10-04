# Projectile cover and concealment

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Patusco's JA2 guide, printed page 13, distinguishes protection that stops shots from vegetation that hides a soldier. Granaderos uses separate firearm-path and concealment rules, now shared with the later playable elevation geometry.

## Behavior

Ordinary firearms trace the line from the shooter's muzzle to the selected head, torso or legs. The trace checks height along each crossed cell and spends material force over the actual crossed depth. It considers terrain, window sills, low rubble and furniture. Touching intervals from the same furniture footprint merge into one continuous span; several cells do not reset its resistance. Separate overlapping objects add resistance. A zero-length corner touch spends no penetrable-material force. Ground and floor slabs remain solid stops.

Shots above an obstacle retain their ordinary damage. A penetrated obstacle reduces damage as the ray crosses it. A body inside a larger obstacle receives the force remaining at its own contact; any continued passage then spends the remaining material depth. An obstacle that exhausts the projectile allowance stops the ray at the point where force reaches zero. [Physical shot loads](physical-shot-loads.md) use nine finite weighted rays around one resolved direction, including allies and intervening bodies; they no longer trace a newly aimed shot at every person in a cone. Each pellet spends its own share of the load's force. Ordinary shot costs, ignition failure, loaded rounds, weapon wear, sound, smoke, wounds and time still use their existing rules. A deliberately blocked shot can be fired at a visible target and consumes its charge if ignition succeeds. A blocked preview is a warning, not a free attack or an automatic order cancellation.

Single lead balls now also spend force on [conditional body passage](body-penetration.md). Bodies and cover share one ordered force budget; passing a body can expose a later person or obstacle. The cover-damage tuning setting cannot restore force spent on a body. Forecasts retain known-body conditional reach, while actual passage uses seeded rolls after the original shot damage draw.

The existing body-region controls show the resulting impact chance and cover warning. A leg shot can be blocked while a head shot clears the same furniture. Penetrable cover displays its damage reduction separately from impact chance. The public order projection includes that warning without exposing internal obstruction records.

Concealment reduces detection range and aiming accuracy without absorbing a projectile. Forest and scrub have default concealment; posture changes its effect on detection. `concealment` can override the terrain value. Legacy nonstructural tile `cover` values remain concealment inputs. Walls, doors, windows and rubble use physical geometry rather than that old accuracy subtraction.

## Explicit game tuning

These are abstract simulation values, not measured ballistics or exact JA2 formulas:

- Projectile allowance equals the firearm's base damage. Wood consumes 24, adobe 80, stone 120 and hay 3 per unit of crossed tactical ray length. That length includes the ray’s horizontal and vertical components. Oblique crossings and deeper footprints can consume more force; clipped edges and height crossings consume less. These grid dimensions are abstract reference units, not metres or measured material densities. Damage is multiplied by the remaining fraction. Distance still affects the existing accuracy calculation.
- Standing muzzle/head/torso/leg heights are 1.4/1.6/1.1/0.45. Crouched heights are 0.9/1/0.7/0.3; prone 0.25/0.3/0.2/0.15; mounted 2/2.2/1.8/1.1.
- Window sills are 0.8 high, rubble 0.35 and full obstacles 2.5. Tables, benches, beds, chests, barrels and hay are 0.8/0.45/0.55/0.8/1.2/1.3 high. Furniture uses a solid-height approximation, including tables and beds.
- Forest concealment is at least 20; scrub at least 15. Detection-range loss is concealment/10 multiplied by 0.5 standing, 1 crouched, 1.5 prone or 0.25 mounted, capped at six tiles. Aiming retains the existing concealment deduction.

Optional `obstacleHeight`, `projectileResistance` and `concealment` metadata are range-validated on tactical restore. Missing fields derive their defaults from existing terrain and prop types; no item or resource migration is needed. Successful breach/artillery terrain destruction clears old ballistic overrides and leaves low rubble. Open doors contribute no obstruction.

## Verification and limits

Projectile-cover and continuation checks exercise ray corners, body regions, muzzle posture, window sills, partial damage, multiple obstacles, finite shot costs, separate concealment, spread friendly fire, AI rejection of blocked shots, breach metadata, public warnings and deterministic save/replay. Depth checks add thin/deep and oblique crossings, clipped height, overlapping materials, an embedded body, and exact force exhaustion inside cover. Existing firearm, body-targeting, HUD, inventory, interrupt and campaign tests remain covered by the broader suite.

The older three-person battle controller rushed across the field during interrupts. It now uses the same observed-contact and cover scoring as ordinary AI, with bounded legal orders and no fabricated victory or changed combatant stats. Its real victory, defeat, survivor/resource accounting and deterministic replay checks pass. The separate fresh-campaign opening playthrough also passes.

Live verification used an imported, controlled three-barrel layout. The head preview showed 75% without an obstruction warning; the leg preview showed 0% and warned that firing spends the charge. An aimed leg shot spent 36 AP, consumed the loaded round, reduced weapon condition by one and left the target at 100 HP. Reloading the save retained these results. A paid reload and subsequent head shot passed above the barrels and dealt 79 damage. No browser warning/error was recorded.

[Location fire](location-fire.md) adds firing at unseen coordinates, seeded miss scatter and unintended body collisions to the F cursor. [Named-target shot paths](directed-projectiles.md) also check intervening bodies and seeded missed-shot collisions, with knowledge-limited warnings and shared AI shot options. The later elevation work supplies playable roofs and shared absolute-height rays. Cover depth now affects the shared firearm force budget. Destructible furniture, reflected ricochet, supported projectile mass/velocity and an exact JA2 projectile model remain open. Artillery retains its separate penetration/blast rules. AI ranks body regions using both impact chance and partial damage loss; incoming exposure still uses torso chance. See [AI shot selection](ai-shot-selection.md) and the parity audit for remaining systems.

The original cover checkpoint was 904 passing logic tests, typecheck, production build and `git diff --check`. The unchanged illustrated-sprite packing suite was excluded from this run.
