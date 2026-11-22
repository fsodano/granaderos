# Slice 20: the kinetic impact rule into the domain

**Intent:** Move the rule that turns a projectile's launch into the impact it
lands with into the domain, where the projectile rules already are.

## Why this slice exists

After [slice 15](15-projectile-energy.md), `packages/game/projectile-energy.js`
still held one rule outside the domain: `kineticNominalImpact` decides how much
of a launch reaches the target after cover, a body, and a ricochet take their
share, and how much of it the weapon's damage can absorb. Slice 15 had moved
the launch-energy calculation; this slice moves the remaining impact rule.

It belongs beside the launch. The root module keeps the format check
`validProjectileEnergy`, because it reads the shared file contract and the
domain may not.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/kinetic-impact.ts` | The rule |
| `packages/game/domain/combat/kinetic-impact.test.ts` | Its tests |

## What it changes

- `packages/game/domain/combat/kinetic-impact.ts` holds `kineticNominalImpact`.
- `packages/game/projectile-energy.js` re-exports it, keeps the format check,
  and keeps every other name it exports today.
- The files that import the module keep importing it from the same path.

The impact does not change: the same cover loss, the same deductions for a
body, a ricochet and the air, the same cap at the weapon's damage, and the
same floor at zero.

## Tests

- `packages/game/domain/combat/kinetic-impact.test.ts` covers the rule: a
  shot with no cover lands with its whole launch, cover takes its share, a
  body and a ricochet take theirs, the result never exceeds the weapon's
  damage, and it never falls below zero.
