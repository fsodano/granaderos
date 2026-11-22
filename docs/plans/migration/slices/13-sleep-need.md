# Slice 13: the sleep need rule into the domain, its wording into the interface

**Branch:** `migration/sleep-need`
**Intent:** Move the rule that decides how much rest a combatant needs into
the domain, and move the sentence that describes it into the interface.

## Why this slice exists

`packages/game/sleep-needs.js` holds two different things at once.

The rule: `sleepNeed` derives how many hours of rest a combatant needs from
their profile, their wounds and their night training, and `sleepRecovery`
derives the fatigue and energy that each hour of rest returns.

The wording: `sleepNeedStatus` builds the Spanish sentence the medical screen
shows, and it is the only part of the module the interface uses.

The accepted architecture says the domain owns the rules and that "domain and
application code are independent of UI", and the ubiquitous language keeps the
Spanish translation of a concept in the interface's hands. The rule belongs in
the domain; the sentence belongs in `apps/web`.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/personnel/sleep-need.ts` | The rule |
| `packages/game/domain/personnel/sleep-need.test.ts` | Its tests |
| `apps/web/lib/care-labels.ts` | The sentence the medical screen shows |

## What it changes

- `packages/game/domain/personnel/sleep-need.ts` holds `sleepNeed` and
  `sleepRecovery`. The numbers do not change: the same hours, the same fatigue
  and energy per hour, the same bounds.
- `packages/game/sleep-needs.js` keeps the module, re-exports the rule, and
  no longer holds the sentence.
- `apps/web/app/MedicalCare.tsx` reads the sentence from the interface's own
  label module.
- `packages/game/public/game-runtime-api.ts` stops exporting the sentence,
  because the interface no longer takes it from the game.

## Tests

- `packages/game/domain/personnel/sleep-need.test.ts` covers the rule: a
  healthy combatant rests the profile hours, wounds add to the need, night
  training shortens it, the total stays inside its bounds, and each hour of
  rest returns the same fatigue and energy as before.
- The existing rest and sleep tests keep passing, which proves the numbers did
  not change.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.17` to `0.2.18`.
