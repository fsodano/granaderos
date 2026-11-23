# Slice 51: the reload rule into the domain

**Branch:** `migration/weapon-reload`
**Intent:** Move the rule that costs a reload and validates its progress into
the domain, beside the reload work it plans.

## Why this slice exists

`packages/game/weapon-reload.js` holds three rules: what a reload round costs
for a given combatant, weapon and assistance, whether the stored progress of a
reload is a valid one, and how the reload is planned across the hands that
carry the guns.

The domain already owns the reload: `ReloadWork` in
`packages/game/domain/combat/reload-work.ts` holds the reload progress and the
rules that bound it, and `ReloadRules` holds the multipliers. The cost rule
and the progress check belong beside them.

## What it changes

- `packages/game/domain/combat/weapon-reload.ts` holds `reloadRoundCost`,
  `validateReloadProgress` and `planReload`, with the comments that explain them. It imports the
  reload rules and the combat balance from the domain, so the domain no longer
  reaches into a retained module for them.
- `packages/game/weapon-reload.js` becomes a thin re-export of it, and the
  files that import it keep importing it from the same path.

The costs and the validation do not change.

## Tests

- `packages/game/domain/combat/weapon-reload.test.ts` covers the rules: the
  cost of a round for a standing and for a prone combatant, the effect of
  assistance and of the gunsmith training, and the refusal of a progress value
  that is not a valid one.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.55` to `0.2.56`.
