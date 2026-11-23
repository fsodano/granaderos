# Slice 58: the projectile air drag rule into the domain

**Branch:** `migration/projectile-air-drag`
**Intent:** Move the rule that decides how much of a projectile's energy
survives the distance into the domain, beside the launch it comes from.

## Why this slice exists

`packages/game/projectile-air-drag.js` holds two things.

The rule: `projectileAirRetention`, which decides how much of a projectile's
energy is left at a distance, and `hasProjectileAirDrag`, which says whether a
weapon carries that profile at all.

The check: `validProjectileAirDrag`, which admits an air drag record that the
shared file contract defines.

The domain already owns the launch: `packages/game/domain/combat/projectile-energy.ts`
holds the energy of a projectile and the impact a launch costs, and
`kinetic-impact.ts` holds the impact it lands with. The retention along the way
belongs with them. The check stays where the shared file contract is, because
the domain may not read it.

## What it changes

- `packages/game/domain/combat/projectile-air-drag.ts` holds the retention
  rule, with the comment that explains the modelling.
- `packages/game/projectile-air-drag.js` keeps the check and re-exports the
  rule from the domain, and the files that import it keep importing it from
  the same path.

The retention does not change: the same decay, the same distance at which a
shot keeps its whole energy, and the same fallback to no loss.

## Tests

- `packages/game/domain/combat/projectile-air-drag.test.ts` covers the rule:
  a weapon with no air drag profile keeps all of its energy at any distance, a
  weapon with one loses energy as the distance grows, the loss follows the
  same exponential curve, and a distance of zero or less loses nothing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.62` to `0.2.63`.
