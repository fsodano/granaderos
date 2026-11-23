# Slice 36: the strategic clock on the session timeline

**Branch:** `migration/strategic-clock-timeline`
**Intent:** Move the last campaign clock path onto the domain's timeline, so
every accepted second of game time comes from one owner.

## Why this slice exists

[Slice 35](35-session-clock.md) put the campaign's `advanceCampaignSeconds` on
the `WorldTimeline` the game session owns, and made the campaign's `hour` and
`secondOfHour` a projection of the timeline's accepted second.

One path was left behind. The `advanceStrategicTime` order, the one the
strategic clock uses to move time while the player watches, has its own
stepping loop that writes the campaign's clock fields directly. It computes
the same kind of boundaries the other loop computes, and it interrupts the
same way, but it does not go through the domain's clock.

So the accepted second still has two writers: the timeline, and this loop.

## What it changes

The `advanceStrategicTime` order advances the session's timeline instead of
writing the campaign's clock fields. Its step boundaries, the work it runs at
each step, and the moments it interrupts at stay the same, and the campaign's
clock fields remain a projection of the timeline's accepted second.

After this slice, every path that moves campaign time goes through
`WorldTimeline.advanceTo`, and no code writes the campaign's clock fields
except the projection.

## Tests

- A test of the strategic clock proves that advancing time produces the same
  hours, seconds and interruptions as before, and that the campaign's clock
  fields match the timeline's accepted second afterwards.
- The existing strategic clock, rest and quest tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.40` to `0.2.41`.
