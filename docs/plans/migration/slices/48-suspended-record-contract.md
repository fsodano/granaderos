# Slice 48: the suspended record states everything it carries

**Branch:** `migration/suspended-record-contract`
**Intent:** Make the saved record of a suspended sector session declare every
field it carries, so the type and the saved value agree.

## Why this slice exists

The campaign snapshot saves a record for each suspended sector session. The
public type declares two fields:

```ts
suspendedSectorSessions?: { request: CampaignSectorEntryRequest; snapshot: BattleSnapshot }[];
```

The runtime record carries five: the request, the sector snapshot, the squad
that was active, the location, and the second at which the visit was
suspended. The last three are read when a visit is validated and when its
world time is computed, so they are part of what the record means.

A type that declares less than the value carries lets a reader believe the
record is smaller than it is, and lets a builder add a field without anyone
noticing.

## What it changes

- The public type declares the whole record: the request, the sector snapshot,
  the active squad, the location, and the second at which the visit was
  suspended.
- The code that builds and validates the record keeps producing exactly those
  fields.

Nothing about the saved value changes: the same five fields are written, with
the same values.

## Tests

- A test proves a record written by the game carries the five fields the type
  declares, with the values the campaign had when the visit was suspended.
- A test proves a saved record that is missing one of them is still refused by
  the validation that already checks the suspended visits.
- The existing suspended sector and save tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.52` to `0.2.53`.
