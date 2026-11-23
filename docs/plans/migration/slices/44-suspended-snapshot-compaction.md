# Slice 44: the terrain compaction reaches the suspended visits

**Branch:** `migration/suspend-snapshot-compaction`
**Intent:** Make the save compaction reach the tile arrays of a suspended
sector visit, so a campaign with suspended visits cannot grow past the save
limit because of them.

## Why this slice exists

The save compaction shrinks the tile arrays of a sector before the save is
written, so that a large map does not fill the save. The compaction reaches the
active view, the retained `sectorSnapshots` and `sceneSnapshots`, and the
retained session inside `sectorEntryRequest.resumeSnapshot`.

It does not reach the ordinary tile arrays inside the suspended sector
sessions, `suspendedSectorSessions[*].snapshot`. Those arrays stay raw and
count toward the five-megabyte limit of a saved campaign. A campaign with a
suspended visit on a large map can therefore hit the limit while holding far
less real content than the limit suggests.

## What it changes

The compaction walks the suspended sector sessions as well, so their tile
arrays are compacted the same way the active and retained ones are.

## What it does not change

The size of a campaign that has no suspended visit, the shape of a saved
campaign, and every rule. A campaign with suspended visits gets smaller, not
different.

## Tests

- A test proves that a campaign with a suspended sector session saves smaller
  once the compaction reaches it, and that the suspended session's content is
  restored exactly as before.
- The existing save and compaction tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.48` to `0.2.49`.
