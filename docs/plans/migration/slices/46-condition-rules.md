# Slice 46: the condition and outcome rules into the domain

**Branch:** `migration/condition-rules`
**Intent:** Move the rules that decide whether a combatant is on their feet, can
be treated, and whether the field is won, into the domain.

## Why this slice exists

Three small modules hold rules that belong to the domain:

- `packages/game/actor-condition.js` decides whether a combatant is
  unconscious, whether they can still act on the field, and what happens to
  their state when their condition changes.
- `packages/game/medical-patient.js` decides whether a wounded person is
  present for care and whether they will accept it.
- `packages/game/battle-outcome.js` decides whether the field has been won.

The domain already owns the character's condition: `Health` holds the current
and maximum health, the bleeding and the bandaged wounds, and `CombatInjury`
applies an impact to it. Whether a combatant is still on their feet, whether
they can be treated, and whether the field is taken are the same kind of fact.

## What it changes

- `packages/game/domain/personnel/actor-condition.ts` holds the condition
  rules.
- `packages/game/domain/personnel/medical-patient.ts` holds the care
  rules.
- `packages/game/domain/combat/completed-victory.ts` holds the field outcome
  rule.
- The three retained modules become thin re-exports, and the files that import
  them keep importing them from the same paths.

The rules do not change: the same threshold, the same refusals, the same
result.

## Tests

- `packages/game/domain/personnel/actor-condition.test.ts` covers the
  condition rules: a combatant below the threshold is unconscious, one with
  no energy is unconscious, a routed combatant cannot act, and a refresh
  applies the same state changes.
- `packages/game/domain/personnel/medical-patient.test.ts` covers the care
  rules: a dead, captured, fled or departed person is not present, a routed
  conscious person refuses care, and an unconscious one does not.
- `packages/game/domain/combat/completed-victory.test.ts` covers the field
  outcome: the field is won only when the player's side can still act, the
  enemy's cannot, and the sector is cleared or the battle is won.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.50` to `0.2.51`.
