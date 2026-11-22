# Slice 10: the weapon readiness rule into the domain

**Intent:** Move the rule that decides how much work a firearm is to bring
into firing position into the domain, where the firearm lives.

## Why this slice exists

`packages/game/weapon-readiness.js` holds a game rule: the action points a
firearm costs to come into firing position, how much of that work overlaps
with turning, whether a turn lowers the weapon again, which orders leave a
raised weapon alone, and whether a raised weapon is still valid for a given
combatant.

The domain already owns the firearm. `Firearm` in
`packages/game/domain/combat/firearm.ts` owns "physical loaded charges,
condition, and ignition failure for one firearm". How much work the firearm
is to prepare belongs with it, and the accepted architecture asks for exactly
this shape: "policies are pure functions of their explicit inputs" and domain
objects own the rules.

The repository already migrated a rule this way. `packages/game/action-points.js`
is now a thin re-export of `packages/game/domain/combat/action-points.ts`,
and its callers did not change. This slice does the same for the weapon
readiness rule.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/weapon-readiness.ts` | The rule, as pure functions and the action-point table |
| `packages/game/domain/combat/weapon-readiness.test.ts` | Its tests |

## What it changes

`packages/game/weapon-readiness.js` keeps its module and its exports, and
becomes a thin re-export of the domain module, exactly as
`packages/game/action-points.js` does. The seven files that import it keep
importing it from the same place, so the tactical code does not change.

The rule itself does not change: the same action points, the same split
between raising and discharging, the same refusal message.

## Tests

- `packages/game/domain/combat/weapon-readiness.test.ts` covers the rule: a
  standing shot spends the same action points as before, a prone shot adds the
  turning work, a turn lowers the weapon in the cases it did before, the free
  orders leave a raised weapon alone, and a raised weapon is refused for a
  combatant that cannot hold it, with the same Spanish message.
