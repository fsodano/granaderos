# Projectile cover and concealment

During tactical exploration and turn-based combat, physical obstacles along a firearm ray reduce or stop projectile damage over their crossed depth, while vegetation and non-structural concealment reduce visual detection range and aiming accuracy without absorbing projectiles (parity row [C04](../../requirements/ja2-parity.md)). Patusco's JA2 guide, printed page 13 ([G13](../../requirements/ja2-parity.md#scope-and-evidence)), distinguishes protection that stops shots from vegetation that hides a soldier. Granaderos keeps firearm-path and concealment rules separate; both share the playable elevation geometry.

## Behavior

Ordinary firearms trace the line from the shooter's muzzle to the selected head, torso or legs. The trace checks height along each crossed cell and spends material force over the actual crossed depth. It considers terrain, window sills, low rubble and furniture. Touching intervals from the same furniture footprint merge into one continuous span; several cells do not reset its resistance. Separate overlapping objects add resistance. A zero-length corner touch spends no penetrable-material force. Ground and floor slabs remain solid stops.

Shots above an obstacle retain their ordinary damage. A penetrated obstacle reduces damage as the ray crosses it. A body inside a larger obstacle receives the force remaining at its own contact; any continued passage then spends the remaining material depth. An obstacle that exhausts the projectile allowance stops the ray at the point where force reaches zero. [Physical shot loads](physical-shot-loads.md) use nine finite weighted rays around one resolved direction, including allies and intervening bodies; they do not trace a newly aimed shot at every person in a cone. Each pellet spends its own share of the load's force. Ordinary shot costs, ignition failure, loaded rounds, weapon wear, sound, smoke, wounds and time still use their existing rules. A deliberately blocked shot can be fired at a visible target and consumes its charge if ignition succeeds. A blocked preview is a warning, not a free attack or an automatic order cancellation.

Single lead balls also spend force on [conditional body passage](body-penetration.md). Bodies and cover share one ordered force budget; passing a body can expose a later person or obstacle. The cover-damage tuning setting cannot restore force spent on a body, reflection or optional free-flight air loss. Forecasts retain known-body conditional reach, while actual passage uses seeded rolls after the original shot damage draw.

The existing body-region controls show the resulting impact chance and cover warning. A leg shot can be blocked while a head shot clears the same furniture. Penetrable cover displays its damage reduction separately from impact chance. The public order projection includes that warning without exposing internal obstruction records.

Concealment reduces detection range and aiming accuracy without absorbing a projectile. Forest and scrub have default concealment; posture changes its effect on detection. `concealment` can override the terrain value. Legacy nonstructural tile `cover` values remain concealment inputs. Walls, doors, windows and rubble use physical geometry rather than an accuracy subtraction.

## Explicit game tuning

These are abstract simulation values, not measured ballistics or exact JA2 formulas:

- Omitted kinetic profiles use the firearm's base damage as projectile allowance; an admitted kinetic profile uses the separate energy budget. Wood consumes 24, adobe 80, stone 120 and hay 3 per unit of crossed tactical ray length. That length includes the ray’s horizontal and vertical components. Oblique crossings and deeper footprints can consume more force; clipped edges and height crossings consume less. These grid dimensions are abstract reference units, not metres or measured material densities. Damage is multiplied by the remaining fraction. Distance still affects the existing accuracy calculation.
- Standing muzzle/head/torso/leg heights are 1.4/1.6/1.1/0.45. Crouched heights are 0.9/1/0.7/0.3; prone 0.25/0.3/0.2/0.15; mounted 2/2.2/1.8/1.1.
- Window sills are 0.8 high, rubble 0.35 and full obstacles 2.5. Tables, benches, beds, chests, barrels and hay are 0.8/0.45/0.55/0.8/1.2/1.3 high. Furniture uses a solid-height approximation, including tables and beds.
- Forest concealment is at least 20; scrub at least 15. Detection-range loss is concealment/10 multiplied by 0.5 standing, 1 crouched, 1.5 prone or 0.25 mounted, capped at six tiles. Aiming retains the existing concealment deduction.

Optional `obstacleHeight`, `projectileResistance` and `concealment` metadata are range-validated on tactical restore. Missing fields derive their defaults from existing terrain and prop types; no item or resource migration is needed. Successful breach/artillery terrain destruction clears old ballistic overrides and leaves low rubble. Open doors contribute no obstruction.

## Limits

The battle controller uses the same observed-contact and cover scoring as
ordinary AI, with bounded legal orders and no fabricated victory or changed
combatant stats.

Destructible furniture, reflection from other surfaces, aerodynamic calibration
and an exact JA2 projectile model remain open. Artillery retains its separate
penetration and blast rules. AI ranks body regions using both impact chance and
partial damage loss; incoming exposure still uses torso chance.
