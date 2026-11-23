# Slice 47: the sector state request property takes the canonical name

**Branch:** `migration/sector-state-request`
**Intent:** Rename the request property that carries the sector view, so the
game stops calling the same thing by two names.

## Why this slice exists

The campaign orders that return from a sector carry the sector view in a
property called `sectorState`. The saved envelope calls the same thing
`sectorSession` since the previous conversion, and the domain calls the
concept `SectorSession`. The ubiquitous language's compatibility row for
`battle` / `sectorState` lists this request property as the last name that
still carries the old vocabulary.

Two names for one thing is how a reader loses track of which is which, so the
request property takes the canonical name.

## What it changes

- Every campaign order that carries the sector view names it `sectorSession`.
- The playtest API's orders use the same name.
- The files that build and read those orders keep working as they do.

The property's type and meaning do not change: it is still the sector view
that the order returns.

## Tests

- A test proves an order that carries the sector view under the new name is
  accepted and behaves exactly as before.
- The existing leave-sector, mission, conversation and playtest tests keep
  passing.

## Verification

- `npm test` passes, including the new test.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.51` to `0.2.52`.
