# Slice 38: the saved pending battle becomes the sector entry request

**Branch:** `migration/sector-entry-request`
**Intent:** Give the saved request to enter a sector the name the ubiquitous
language gives it, and read the old name from saves that still carry it.

## Why this slice exists

The campaign snapshot carries the request to enter a sector under the field
`pendingBattle`. The ubiquitous language lists it as a compatibility name and
says it is the "Saved and compatibility request field for `SectorEntryRequest`",
and that it "can request a peaceful visit".

The name is the last thing wrong with it. A request to enter a sector is not
pending: the request is what the player asked for, and what it becomes depends
on what happens next. The canonical term is `SectorEntryRequest`, so the saved
field becomes `sectorEntryRequest`.

This is the largest of the saved-name conversions: the field is read and
written in 83 files.

## What it changes

- A newly written save carries the request under `sectorEntryRequest`.
- A save that still carries `pendingBattle` is read from that field, converted,
  and written back under the new name. The old name is never written again.
- Every place in the source that reads or writes the field uses the new name.

## What it does not change

The request's shape, the rules that act on it, and every saved value. A save
written before this change loads into exactly the same state as before, and a
save written now loads in the same way.

## Tests

- A test proves a save written now carries the request under the new name, and
  that the old name is absent.
- A test proves a save written with the old name still loads into the same
  state, and that saving it again writes the new name.
- The existing campaign, entry and restoration tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.42` to `0.2.43`.
