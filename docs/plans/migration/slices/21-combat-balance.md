# Slice 21: the combat balance rules into the domain

**Branch:** `migration/combat-balance`
**Intent:** Move the tuning table and the cover and penetration damage rules
into the domain, where the shot rules live.

## Why this slice exists

`packages/game/combat-balance.js` holds the game's combat tuning: the
multipliers that decide how a shot falls with distance, how cover absorbs it,
how a body or a stone face stops it, how a wound costs action points, and how
much energy a shot spends. The file says what it is: "Granaderos playtest
settings, not claimed JA2 constants."

It also holds two rules that use that table: `coveredFirearmDamage` decides
how much of a shot cover absorbs, and `penetratingFirearmDamage` decides how
much reaches the target once cover, a body and a ricochet have taken their
share, and how much of it the weapon's damage can absorb.

The domain already owns this kind of tuning: `HealthRules`, `ActionPointRules`
and `IgnitionRules` all live there, and the domain's `ActionPointPolicy` takes
the wound and energy penalties as parameters because the table that declares
them was outside. Moving the table brings that injection home.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/combat-balance.ts` | The tuning table and the two damage rules |
| `packages/game/domain/combat/combat-balance.test.ts` | Its tests |

## What it changes

- `packages/game/domain/combat/combat-balance.ts` holds `COMBAT_BALANCE`,
  `coveredFirearmDamage`, and `penetratingFirearmDamage`.
- `packages/game/combat-balance.js` keeps its module and its exports, and
  becomes a thin re-export of the domain module.
- The files that import it keep importing it from the same path. The domain's
  `ActionPointPolicy` is now given the penalties from the domain's own table.

The tuning values do not change, and neither do the two damage rules.

## Tests

- `packages/game/domain/combat/combat-balance.test.ts` covers the rules: a
  shot with no cover keeps its whole damage, cover reduces it by its factor,
  the reduction never passes below zero, a body and a ricochet take their
  share of a penetrating shot, and the result never exceeds the weapon's
  damage.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.25` to `0.2.26`.
