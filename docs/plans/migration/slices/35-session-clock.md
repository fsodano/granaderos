# Slice 35: the game session owns the campaign clock

**Branch:** `migration/session-clock`
**Intent:** Make the domain's `WorldTimeline` the clock the campaign runs on,
owned by the game session, so the accepted game second has one owner.

## Why this slice exists

The accepted architecture says: "`WorldTimeline.advanceTo(targetSecond,
applyEvent)` is the only operation that moves game time", and that the game
session owns the world timeline. The source has neither.

The campaign clock is a pair of plain fields on the campaign snapshot,
`s.hour` and `s.secondOfHour`. The campaign advances them in
`advanceCampaignSeconds`, a stepping loop that stops at the next squad-travel
boundary, hiring arrival, contract expiry or quest deadline, and applies the
hourly and fractional work at each step. There are 48 places in
`packages/game/campaign.js` that read or write the clock directly, and the
world events of a sector keep their own separate timeline.

The result is that the accepted game second has more than one owner: the
campaign's two fields, and the timeline the world events use.

## What it changes

- `GameSession` owns a `WorldTimeline`, the way it already owns the
  `RandomSource`. It is created with the campaign's accepted second, restored
  from the snapshot, and exposed through a `timeline` accessor.
- `advanceCampaignSeconds` advances that timeline instead of writing the
  campaign's clock fields. The campaign's boundaries become events on the
  timeline, and the hourly and fractional work runs from the timeline's event
  callback, so the accepted second is decided by the domain.
- The campaign's `hour` and `secondOfHour` become a projection of the
  timeline's accepted second, written when the command finishes.
- The sector's world events use the same session timeline, so a campaign and
  its sector agree on the accepted second.

## What it does not change

The clock advances by the same amounts at the same moments, the same work runs
at each hour and each fraction, and the same boundaries interrupt an advance.
A campaign that is saved and restored resumes at the same accepted second.

## Tests

- The session tests prove that a restored session resumes at the same accepted
  second and that its snapshot carries the timeline.
- A test of the campaign clock proves that advancing the clock produces the
  same hours, seconds and boundary interruptions as before, and that the
  campaign's clock fields match the timeline's accepted second afterwards.
- The existing travel, rest, hiring and quest tests keep passing, which
  proves the boundaries still interrupt at the same moments.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.39` to `0.2.40`.
