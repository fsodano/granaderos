# Slice 14: the held supply rule into the domain

**Intent:** Move the rule that decides which consumable a combatant holds and
what it costs to use into the domain, where the inventory lives.

## Why this slice exists

`packages/game/held-supplies.js` holds a game rule: the consumables a
combatant can hold in hand, the action each one performs, the action points
and the range it costs, and which of them the combatant currently holds.

The domain already owns what a combatant carries. `Inventory` owns the
capacity-constrained holder of items, `Item` the identified instance, and
`PocketLayout` the personal pocket allocation. A consumable held in hand, with
its own cost and reach, belongs with them.

The rule is pure: it reads the combatant's active slot and its counts. Moving
it into the domain is the same change
[slice 10](10-weapon-readiness.md) made for the firearm preparation rule and
[slice 12](12-unarmed-combat.md) made for the unarmed combat rule.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/inventory/held-supplies.ts` | The rule |
| `packages/game/domain/inventory/held-supplies.test.ts` | Its tests |

## What it changes

`packages/game/held-supplies.js` keeps its module and its exports, and
becomes a thin re-export of the domain module. The five files that import it
keep importing it from the same place.

The consumables, their names, their action points and their ranges do not
change, and a combatant's held consumable is chosen the same way.

## Tests

- `packages/game/domain/inventory/held-supplies.test.ts` covers the rule: the
  three consumables keep their costs and ranges, a combatant holding a
  consumable in the supply slot is found, a combatant holding nothing in that
  slot is not, and an unknown consumable is refused.
