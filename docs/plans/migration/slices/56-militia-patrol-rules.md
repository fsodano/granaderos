# Slice 56: the militia patrol rules into the domain

**Branch:** `migration/militia-patrol-rules`
**Intent:** Move the rules that decide how a militia patrols into the domain,
and leave the lookup of a campaign's own patrol rules where the campaign
content is.

## Why this slice exists

`packages/game/militia-patrol-rules.js` holds three things.

The tuning: the default patrol rules, which say whether patrols are on, how
many turns a waypoint takes, how much energy a patrol keeps and how much a
rest returns.

The lookup: `militiaPatrolRules(campaign)`, which reads the patrol rules a
campaign authored and falls back to the defaults.

The validation: `validateCampaignPatrol(campaign, scene)`, which refuses a
scene whose patrol rules disagree with the campaign's.

The domain owns what a patrol does to the world: the residents, their
movement, and the supplies they collect. The tuning and the validation belong
with them. The lookup stays where the campaign content is, because the domain
may not read campaign content.

## What it changes

- `packages/game/domain/personnel/militia-patrol.ts` holds the default patrol
  rules and the validation.
- `packages/game/militia-patrol-rules.js` keeps the lookup and the re-exports
  from the shared file contract, and reads the defaults from the domain.
- The files that import it keep importing it from the same path.

The tuning and the refusals do not change.

## Tests

- `packages/game/domain/personnel/militia-patrol.test.ts` covers the tuning and
  the validation: the default patrol rules keep their values and stay frozen,
  a scene whose patrol rules match the campaign's is accepted, and a scene that
  disagrees is refused with the same message.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.60` to `0.2.61`.
