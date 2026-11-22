# Slice 25: the campaign clock rule into the domain, the campaign notices into the interface

**Branch:** `migration/strategic-clock`
**Intent:** Move the rule that turns the campaign clock into game seconds into
the domain, and move the choice of what the player is told into the
interface.

## Why this slice exists

`packages/game/strategic-clock.ts` holds two different things.

The rule: `campaignSeconds` turns the campaign's hour and second into the
accepted game second. The domain already owns that: `GameTime` in
`packages/game/domain/shared/game-time.ts` is the accepted instant in game
seconds, and it already knows how to be built from a campaign clock.

The notice: `strategicClockInterrupt` decides which sentence the player is
told after a campaign command: that a fight or a retreat must be chosen, that
the campaign is over, that a sector needs orders, that a combatant improved a
skill, that a contract needs attention. It is a choice of what to show, over
the accepted campaign state.

The accepted architecture says the domain owns the rules and that a
player-facing sentence belongs to the interface, and the ubiquitous language
keeps the Spanish translation of a concept in the interface's hands.

## What it adds

| File | Content |
| --- | --- |
| `apps/web/lib/campaign-notices.ts` | The choice of what the player is told |

## What it changes

- `packages/game/domain/shared/game-time.ts` gains the conversion of a
  campaign clock into game seconds, beside the `GameTime` that owns it. It
  computes what the game computes today, without refusing an unusual clock:
  `hour * 3600 + (secondOfHour ?? 0)`.
- `packages/game/strategic-clock.ts` keeps its module and its exports, and
  uses the domain conversion.
- `apps/web/lib/campaign-notices.ts` holds `strategicClockInterrupt`, with
  the same sentences and the same order of preference.
- `packages/game/public/game-runtime-api.ts` stops exporting
  `strategicClockInterrupt`, because the interface no longer takes that choice
  from the game. `apps/web/app/Campaign.tsx` reads it from the interface's own
  module.

## Tests

- A new test in `packages/game/domain/shared/` proves the conversion matches
  what the campaign computed before: an hour and a second become the accepted
  second, a missing second of the hour counts as zero, and the clock speeds
  keep their values.
- A new test in `apps/web` proves the notice selector still answers for the
  same campaign states and in the same order of preference: a pending arrival
  decision is reported before a pending battle, a refused command reports its
  error first, and a campaign with nothing to report says nothing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.29` to `0.2.30`.
