# Slice 16: the firearm loads rule into the domain

**Intent:** Move the rule that decides which loads a firearm can use into the
domain, where the firearm lives.

## Why this slice exists

`packages/game/firearm-loads.js` holds a game rule: the default alternative
loads of each firearm, how the identity of a firearm is read from whatever
the caller holds, how the authored definition of a weapon is found inside a
unit or an item, and which loads that definition therefore offers. An
authored primary-family override never inherits an incompatible default, and
campaign content can replace or remove every list.

The domain already owns the firearm: `Firearm` owns its loaded charges, its
condition and its ignition failure. Which loads it may use belongs with it.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/firearm-loads.ts` | The rule |
| `packages/game/domain/combat/firearm-loads.test.ts` | Its tests |

## What it changes

`packages/game/firearm-loads.js` keeps its module and its exports, and
becomes a thin re-export of the domain module, the way
`packages/game/weapon-readiness.js` already is. The files that import it keep
importing it from the same place.

The default loads, their damage and their range, and the override rule do not
change.

## Tests

- `packages/game/domain/combat/firearm-loads.test.ts` covers the rule: the
  default loads of each firearm keep their family, damage and range, the
  identity of a firearm is read from a unit, an item and a plain identifier
  alike, an authored definition is found inside a unit or an item, an authored
  override wins over the default, a weapon that declares its ammunition family
  inherits no default, and a weapon with no definition offers no loads.
