# Slice 35: the session-owned campaign clock

`GameSession` is the runtime consistency boundary for one game and owns its
`WorldTimeline`, the authority for accepted game time. The campaign's `hour` and
optional `secondOfHour` encode that accepted second as whole hours and the
remaining seconds within the hour. They are projections, not a separate clock.
When a campaign is restored, its session timeline starts at the saved campaign
time.

## Clock ownership

`WorldTimeline.advanceTo` is the only operation that changes accepted time.
`GameSession` exposes its timeline through `timeline`. The campaign session
mapper initializes that timeline from the saved `hour` and `secondOfHour`, then
projects `timeline.currentSecond` back to those campaign fields after an
accepted operation.

## Campaign advancement

The campaign advancement path divides requested time at hour boundaries and at
travel, contract-expiry, and quest-deadline boundaries. It schedules each step
on the session timeline; the callback runs the campaign's hourly or fractional
systems for that step's target second. After the callback returns, the timeline
records the accepted second. If the systems pause progression, the timeline
stops at that boundary. The campaign clock fields continue to describe only the
accepted second.

## Requirements

- Campaign advancement must use the session-owned timeline for every step.
- A pause at a travel, contract, or quest boundary must leave the timeline and
  the campaign clock projection at the same accepted second.
- Restoring a campaign at a whole-hour or fractional-hour time must initialize
  the timeline to that saved accepted second.

## Test requirements

- Campaign-time advances must leave the timeline and projected campaign clock at
  the same accepted second.
- Boundary tests must cover travel, contract expiry, and quest deadlines,
  including a pause inside an hour.
- Restoration tests must cover both a whole-hour boundary and a fractional
  second.

Source anchors: [`GameSession`](../../../../packages/game/domain/session/game-session.ts),
[`WorldTimeline`](../../../../packages/game/domain/world/world-timeline.ts),
[campaign clock advancement](../../../../packages/game/campaign.js), and the
[session mapper](../../../../packages/game/infrastructure/session/campaign-game-session-mapper.js).
