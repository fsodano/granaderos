# Slice 15: the projectile energy rule into the domain

**Branch:** `migration/projectile-energy`
**Intent:** Move the rule that turns a projectile's mass and velocity into
impact into the domain, where the shot rules live.

## Why this slice exists

`packages/game/projectile-energy.js` holds two different things.

The rule: `projectileEnergyJ` derives the energy of a projectile from its
mass and muzzle velocity, `projectileLaunchImpact` turns that energy into the
impact points a launch costs, and `projectileDamageFactor` scales the damage
a shot still does as the weapon's damage is spent.

The format check: `validProjectileEnergy` admits a projectile energy record
that the shared file contract defines, and it reads that contract's schema.

The domain owns the shot rules: `FirearmAccuracy` calculates the accuracy of a
shot, `Firearm` owns the firearm's charges and condition, and
`CombatInjury` applies the impact. The energy of the projectile belongs with
them. The format check belongs with the shared file contract, so it stays in
the root module, which is also where the shared contract can be read.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/projectile-energy.ts` | The rule |
| `packages/game/domain/combat/projectile-energy.test.ts` | Its tests |

## What it changes

`packages/game/projectile-energy.js` keeps its module and its exports. The
rule moves to the domain, and the format check stays where the shared file
contract can be read. The files that import the module keep importing it from
the same place.

The joules, the impact points and the damage factor do not change: the same
mass and velocity give the same energy, and a weapon with no energy record
still falls back to its authored damage.

## Tests

- `packages/game/domain/combat/projectile-energy.test.ts` covers the rule: the
  energy of a projectile follows its mass and velocity, the launch impact
  divides that energy by the joules per impact, a weapon with no energy record
  falls back to its authored damage and never below one, and the damage
  factor falls to zero as the weapon's damage is spent.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.19` to `0.2.20`.
