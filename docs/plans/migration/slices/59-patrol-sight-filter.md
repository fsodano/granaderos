# Slice 59: the patrol sight filter uses the domain's eligibility check

**Branch:** `migration/patrol-sight-filter`
**Intent:** Remove the second copy of the eligibility rule, so the domain holds
one and the retained module asks it.

## Why this slice exists

`packages/game/militia-patrol.js` declares a local `able` that decides
whether a combatant can still act: at least the critical health, not
unconscious, not routed, fled, surrendered or departing.

The domain now holds that same rule. The previous slice moved the patrol
decision into `packages/game/domain/personnel/militia-patrol.ts`, and with it
the eligibility check the decision depends on.

Two copies of the same condition are how they drift apart, and the retained
copy is the one that decides who the patrol can see.

## What it changes

- The retained module asks the domain for the eligibility check instead of
  declaring its own.
- Nothing else changes: the same units are treated as able, and the patrol
  sees and moves exactly as before.

## Tests

- The existing patrol tests keep passing, which proves the same units are
  eligible.
- A test proves the domain's check and the retained module's answer agree for
  the conditions that matter: below the critical health, without energy,
  routed, fled, surrendered and departing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.63` to `0.2.64`.
