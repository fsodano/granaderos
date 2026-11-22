# Slice 30: the care composure rule into the domain

**Branch:** `migration/care-composure`
**Intent:** Move the rule that steadies a caregiver after a successful care
stroke into the domain, where the health rules live.

## Why this slice exists

`packages/game/care-composure.js` holds a pure rule: a successful local care
stroke can settle an explicitly authored caregiver, but only when the
giver has the care composure ability, the patient has been observed, the
treatment was effective, and the giver already has a small amount of shock.
The relief is capped at the shock the giver has.

The file states what the rule is not: it is not extra treatment work and not
a saved reward receipt. The domain owns the health facts it reads: `Health`
holds current and maximum health, bleeding and bandaged wounds, and
`CombatInjury` derives breath, balance, shock and morale. The relief belongs
with them.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/personnel/care-composure.ts` | The rule |
| `packages/game/domain/personnel/care-composure.test.ts` | Its tests |

## What it changes

`packages/game/care-composure.js` keeps its module and its exports, and
becomes a thin re-export of the domain module. The files that import it keep
importing it from the same path.

The rule does not change: the same relief value, the same conditions, and the
same cap at the caregiver's shock.

## Tests

- `packages/game/domain/personnel/care-composure.test.ts` covers the rule: an
  observed effective treatment by an able caregiver gives the relief, a
  treatment that did not improve the patient gives none, an unobserved
  treatment gives none, a caregiver without the ability gives none, a
  caregiver treating themselves gives none, and the relief never exceeds the
  caregiver's shock.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.34` to `0.2.35`.
