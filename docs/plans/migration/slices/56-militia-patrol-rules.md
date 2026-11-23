# Slice 56: militia patrol tuning and scene validation

This note describes the current boundary for default patrol settings, checking
a saved scene against its campaign, and looking up campaign-authored patrol
settings.

## Domain ownership

[`militia-patrol.ts`](../../../../packages/game/domain/personnel/militia-patrol.ts)
owns `DEFAULT_MILITIA_PATROL` and `validateCampaignPatrol`. The frozen defaults
are `enabled: true`, `waypointTicks: 8`, `energyReserve: 50`, and `restEnergy: 10`.
These fields control whether patrols run, turns per waypoint, energy reserved
while moving, and energy recovered while resting.

`validateCampaignPatrol` accepts a missing scene. Otherwise, it treats an
omitted scene setting as the domain defaults and refuses an incomplete,
out-of-range, or mismatched setting. It compares the saved scene with
the patrol setting in the campaign's embedded content package, or with domain
defaults when the package has no patrol setting. This is a saved-scene
consistency rule, not authored campaign schema validation.

[`militia-patrol.test.ts`](../../../../packages/game/domain/personnel/militia-patrol.test.ts)
uses fixture campaign settings `enabled: false`,
`waypointTicks: 4`, `energyReserve: 40`, and `restEnergy: 12`. A scene with the
same values is accepted; changing `restEnergy` to `11` is refused.

## Content and compatibility boundary

The retained
[`militia-patrol-rules.js`](../../../../packages/game/militia-patrol-rules.js)
keeps `militiaPatrolRules(state)`, where `state` is the scene state. It resolves
rules in this order: the embedded campaign package, the scene's stored
`militiaPatrol` field, then `DEFAULT_MILITIA_PATROL`. The retained module
re-exports the domain default and consistency check.

[`campaign-rules-schema.js`](../../../../packages/campaign-format/campaign-rules-schema.js)
continues to define `MILITIA_PATROL_FIELDS` and `validateMilitiaPatrol` for the
authored field contract and its structural validation. That contract remains
separate from the domain check that compares a saved scene with campaign rules.
[`militia-patrol.js`](../../../../packages/game/militia-patrol.js) still
calculates patrol movement in `militiaPatrolOrder`; that procedural rule still
needs a domain owner.

## Behavior covered

The domain tests cover the default values and their immutability, acceptance of
a scene whose rules match the campaign, and refusal of a scene whose rules
differ.
