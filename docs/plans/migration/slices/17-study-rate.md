# Slice 17: the study rate rule into the domain

**Branch:** `migration/study-rate`
**Intent:** Move the rule that decides how fast a combatant learns a skill into
the domain, where the character's abilities live.

## Why this slice exists

`packages/game/study-training.js` holds two different things.

The rule: `studyRate` decides how much training credit a combatant earns in
an hour. Practice gets slower as the skill improves, a better teacher teaches
faster, and a teacher with the teaching trait teaches faster again.

The forecast: `studyForecast` combines that rate with the hours already
banked and the progress still owed, and answers how long the next gain takes.
It is a view of the character's training state, and it reads the campaign's
own training tables.

The domain already owns what a character can learn: `CharacterAbilities` is
the character's immutable ability value, and it applies earned training. The
rate at which training is earned belongs with it. The forecast stays where the
campaign's training tables are.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/personnel/study-rate.ts` | The rule |
| `packages/game/domain/personnel/study-rate.test.ts` | Its tests |

## What it changes

- `packages/game/domain/personnel/study-rate.ts` holds `studyRate`.
- `packages/game/study-training.js` keeps the module, re-exports the rule from
  the domain, and keeps `studyForecast`, which now calls the domain rule.
- The files that import the module keep importing it from the same place.

The rate does not change: the same hours of practice, the same wisdom weight,
the same teaching bonus, the same integer credit.

## Tests

- `packages/game/domain/personnel/study-rate.test.ts` covers the rule: a
  combatant with no instructor learns at the base rate, practice slows as the
  skill improves, a better teacher teaches faster, the teaching trait adds its
  bonus, and the credit is never below one.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.21` to `0.2.22`.
