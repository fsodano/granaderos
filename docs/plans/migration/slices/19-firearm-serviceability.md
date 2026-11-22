# Slice 19: the firearm serviceability rule into the domain

**Intent:** Move the rule that decides whether a firearm is still usable into
the domain, where the firearm's condition lives.

## Why this slice exists

`packages/game/firearm-serviceability.js` holds two facts about a firearm:
whether it is still serviceable, and the sentence the game refuses with when
it is not.

A firearm is serviceable when it exists and its condition is above zero. A
firearm with no recorded condition is serviceable, because older records
default to a perfect one. The module also says what the rule is not: the
mechanical condition is separate from ownership and from which hand holds the
weapon, so the callers keep their own checks.

The domain owns the firearm's condition: `Firearm` in
`packages/game/domain/combat/firearm.ts` holds the firearm's loaded charges,
its condition and its ignition failure. Whether that condition leaves the
firearm usable belongs with it.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/firearm-serviceability.ts` | The rule |
| `packages/game/domain/combat/firearm-serviceability.test.ts` | Its tests |

## What it changes

`packages/game/firearm-serviceability.js` keeps its module and its exports,
and becomes a thin re-export of the domain module. The files that import it
keep importing it from the same place.

The rule does not change: a firearm with a condition above zero is
serviceable, a firearm with no condition at all is serviceable, a firearm with
a condition of zero is not, and the refusal sentence stays the same.

## Tests

- `packages/game/domain/combat/firearm-serviceability.test.ts` covers the rule:
  a firearm with a good condition is serviceable, one with no recorded
  condition is serviceable, one with a condition of zero is not, a missing
  firearm is not, and the refusal sentence is the same one as today.
