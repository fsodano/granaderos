# Slice 12: the unarmed combat rule into the domain

**Branch:** `migration/unarmed-combat`
**Intent:** Move the rule that decides whether an unarmed strike lands, and how
much it costs, into the domain, where the other close-combat rules live.

## Why this slice exists

`packages/game/unarmed-combat.js` holds a game rule: the chance an unarmed
attack lands against a given defender, the damage and breath loss it costs,
the chance of taking a weapon from a defender, and the two unarmed weapons
the campaign uses, the fists and the buttstock.

The domain already owns close combat. `CombatInjury` applies a physical impact
to the shared health owner, `MeleeExchange` owns the parry and counterattack
costs, and `FirearmAccuracy` calculates shot accuracy. The unarmed strike is
the third way a combatant reaches a defender, and its rule sits outside the
domain with the other retained modules.

The rule is pure: it reads the attacker's and the defender's attributes and
returns a number. Moving it into the domain is the same change
[slice 10](10-weapon-readiness.md) made for the firearm preparation rule.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/unarmed-combat.ts` | The rule, as pure functions |
| `packages/game/domain/combat/unarmed-combat.test.ts` | Its tests |

## What it changes

`packages/game/unarmed-combat.js` keeps its module and its exports, and
becomes a thin re-export of the domain module. `packages/game/tactical.js`,
`packages/game/ja2-hud.ts`, and `packages/game/public/campaign-editor-api.ts`
keep importing it from the same place.

The numbers do not change: the same chance, the same damage and breath loss,
the same weapon-take chance, the same fists and buttstock values.

## Tests

- `packages/game/domain/combat/unarmed-combat.test.ts` covers the rule: a
  still target is nearly always reached, a stronger and more experienced
  attacker improves the chance, an unaware defender is easier to hit, the
  chance stays inside its bounds, the impact damage and breath loss follow
  strength and energy, and the weapon-take chance behaves as before.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.16` to `0.2.17`.
