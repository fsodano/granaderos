# Slice 28: the shot range rule into the domain, its wording into the interface

**Branch:** `migration/shot-range`
**Intent:** Move the rule that turns distance and visibility into a shot's
modifiers into the domain, and move the sentence that describes it into the
interface.

## Why this slice exists

`packages/game/shot-range.js` holds two different things.

The rule: `shotRangeModifiers` decides how distance, weapon range and
apparent distance combine: which range the weapon is beyond, which the sight
is beyond, the effective sight range, the weapon and sight penalties, and the
factor applied to the chance of hitting.

The wording: `shotRangeText` builds the Spanish sentence the player reads.

The domain already owns shot accuracy: `FirearmAccuracy` in
`packages/game/domain/combat/` calculates the accuracy of a shot from the
actor, the target, the range and the environment. The range modifiers belong
beside it. The sentence belongs in the interface, where a player-facing line
is kept.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/shot-range.ts` | The rule |
| `packages/game/domain/combat/shot-range.test.ts` | Its tests |
| `apps/web/lib/shot-range-labels.ts` | The sentence the player reads |

## What it changes

- The domain module holds `shotRangeModifiers`.
- `packages/game/shot-range.js` keeps its module and its exports, re-exports
  the rule from the domain, and no longer holds the sentence.
- `apps/web/lib/shot-range-labels.ts` holds `shotRangeText`, with the same
  sentence. Its caller reads it from the interface's own module.
- `packages/game/public/game-runtime-api.ts` stops exporting the sentence.

The rule and the sentence do not change: a shot beyond the weapon's range
still halves the chance, one beyond the sight still halves it, and the text
still names the distance and the range in the same words.

## Tests

- `packages/game/domain/combat/shot-range.test.ts` covers the rule: a shot
  inside both ranges has no penalty, a shot beyond the weapon gets the weapon
  factor, a shot beyond the sight gets the sight factor, the two factors
  combine, an invalid distance is refused, and the penalties keep their
  values.
- A test of the interface module proves the sentence is the same one the game
  showed before.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.32` to `0.2.33`.
