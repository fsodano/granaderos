# Slice 36: route strategic time through the session timeline

`GameSession` is the runtime consistency boundary for one game and owns its
`WorldTimeline`, the authority for accepted game time. Campaign advancement
already uses that timeline; the strategic clock must use the same source. The
campaign's `hour` and optional `secondOfHour` are projections of the timeline's
accepted second, not independent clock state.

## Strategic advancement

The `advanceStrategicTime` order advances a bounded number of seconds while
campaign systems process the resulting time. It divides the request at hour,
contract, quest, and journey boundaries, then schedules each step on
`WorldTimeline`. The timeline callback runs campaign work for the step's target
second; when the callback returns, the timeline records that accepted second.
When an event requires the player to stop, the timeline and campaign clock
projection remain at the same accepted second.

The strategic clock must not write a second authoritative time into the
campaign snapshot. After an accepted operation, `hour` is the whole-hour count
of `timeline.currentSecond`, and optional `secondOfHour` is the remainder
within that hour.

## Requirements

- `advanceStrategicTime` must advance the `GameSession` timeline rather than
  maintain a separate clock.
- Whole-hour and fractional-second requests must leave the campaign clock
  projection equal to the timeline's accepted second.
- Contract warnings, journey boundaries, and other interruptions must stop
  progression at the same accepted second in both representations.

## Test requirements

- Whole-hour and fractional requests must leave the strategic clock projection
  equal to the session timeline's accepted second.
- Interruption tests must cover contract warnings, journey boundaries, and
  other stop conditions, checking the projection at each accepted second.

Source anchors: [`GameSession`](../../../../packages/game/domain/session/game-session.ts),
[`WorldTimeline`](../../../../packages/game/domain/world/world-timeline.ts),
[strategic clock advancement](../../../../packages/game/campaign.js), and the
[session mapper](../../../../packages/game/infrastructure/session/campaign-game-session-mapper.js).
