# Slice 23: the fatigue and energy rules into the domain

**Intent:** Move the rules that decide how much a combatant can still do into
the domain, next to the character's condition.

## Why this slice exists

`packages/game/fatigue.js` holds the rules of a combatant's stamina: fatigue
limits sustained capacity, energy is the breath available right now, a
combatant never falls below ten points of energy, a strategic collapse clears
at sixty, and gaining fatigue or recovering energy and fatigue change what the
combatant can do.

The domain already owns the character's condition: `Health` holds the current
and maximum health, the bleeding and the bandaged wounds, and
`CharacterAbilities` holds the ratings and traits those depend on. Fatigue and
energy are the same kind of fact and belong with them.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/personnel/fatigue.ts` | The rules, as pure functions |
| `packages/game/domain/personnel/fatigue.test.ts` | Their tests |

## What it changes

- `packages/game/domain/personnel/fatigue.ts` holds the pure part of the
  rules: the maximum energy a combatant has at a given fatigue, whether a
  strategic collapse still needs recovery, the energy a combatant is left with
  after it is limited, the fatigue a combatant is left with after it gains
  some, and the energy and fatigue it is left with after it recovers them.
- `packages/game/fatigue.js` keeps its module and its exports. The four
  functions that change a combatant stay there and now call the domain rules
  to decide what to write, so the domain stays a pure function of its inputs.
- The files that import the module keep importing it from the same path.

The numbers do not change: the floor of ten, the recovery threshold of sixty,
the cap of one hundred on fatigue, and the rounding of gained fatigue.

## Tests

- `packages/game/domain/personnel/fatigue.test.ts` covers the rules: the
  maximum energy falls with fatigue and never below ten, a collapse still
  needs recovery below sixty and not at or above it, limiting energy leaves
  the smaller of the two, gaining fatigue rounds up and never leaves the
  range, and recovering energy and fatigue never raises energy above the
  maximum.
