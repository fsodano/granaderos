# Slice 28: the shot-range rule and its HUD sentence

**Intent:** Move shot-range calculations into the domain while keeping the
player-facing sentence with its HUD caller.

## Why this slice exists

`packages/game/shot-range.js` contains two different responsibilities:
`shotRangeModifiers` calculates range effects on a shot, while `shotRangeText`
builds the Spanish sentence shown by the HUD.

The domain owns shot accuracy. `FirearmAccuracy` calculates shot accuracy from
the actor, target, range, and environment, so `shotRangeModifiers` belongs
beside it in `packages/game/domain/combat/shot-range.ts`.

The production caller for `shotRangeText` is
`packages/game/ja2-hud.ts`, a presentation adapter inside the retained game
module. The sentence stays in `packages/game/shot-range.js` beside that
caller, preserving the dependency direction: the game package does not depend
on the player application.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/shot-range.ts` | The shot-range calculation |
| `packages/game/domain/combat/shot-range.test.ts` | Tests for the calculation |

## What it changes

- `packages/game/domain/combat/shot-range.ts` owns `shotRangeModifiers`.
- `packages/game/shot-range.js` re-exports the domain rule and retains
  `shotRangeText`.
- `packages/game/ja2-hud.ts` continues to call `shotRangeText` from
  `packages/game/shot-range.js`.
- `packages/game/shot-range.test.ts` guards the Spanish sentence with exact
  string comparisons.

The rule and sentence keep their behavior: a shot beyond weapon range halves
the chance, a shot beyond sight range halves it, both factors combine, and the
sentence keeps the same distance and range wording.

## Tests

- `packages/game/domain/combat/shot-range.test.ts` covers the rule: a shot
  inside both ranges has no penalty, a shot beyond weapon range gets the
  weapon factor, a shot beyond sight range gets the sight factor, both factors
  combine, invalid distance is refused, and the penalties retain their values.
- `packages/game/shot-range.test.ts` checks the HUD sentence byte for byte for
  in-range shots, shots beyond weapon range, and shots beyond both ranges.
