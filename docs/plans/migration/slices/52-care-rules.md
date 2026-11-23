# Slice 52: the care tuning into the domain

**Branch:** `migration/care-rules`
**Intent:** Move the tuning of the care rules into the domain, beside the
wounds they treat.

## Why this slice exists

`packages/game/campaign-care-rules.js` holds two different things.

The tuning: the default care rules (the skill a treatment needs, how much it
heals, what a dressing costs, what a rest returns) and the percentage of
strategic bleeding a campaign applies by default.

The lookup: `careRules(campaign)`, which reads the care rules a campaign
authored, falling back to the defaults.

The domain owns the wounds: `Health` holds the bleeding and the bandaged
wounds, and `Corpse` owns what happens to a body. The tuning that decides how
a wound is treated belongs with them. The lookup stays where the campaign
content is, because the domain may not read campaign content.

## What it changes

- `packages/game/domain/personnel/care-rules.ts` holds the default care rules
  and the default strategic bleeding percentage.
- `packages/game/campaign-care-rules.js` keeps the lookup and the re-exports
  from the shared file contract, and reads the defaults from the domain.
- The files that import it keep importing it from the same path.

The tuning does not change: the same values, and the same fallback for a
campaign that authors no care rules.

## Tests

- `packages/game/domain/personnel/care-rules.test.ts` covers the tuning: the
  default care rules keep their values and stay frozen, and the default
  strategic bleeding percentage is the one it was.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.56` to `0.2.57`.
