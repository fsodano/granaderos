# Slice 37: the saved battle field becomes the sector session

## Why this slice exists

A sector snapshot can describe exploration, deployment, or a completed fight;
it is not necessarily an active battle. [`SectorSession`](../../accepted/ubiquitous-language.md#canonical-terms)
is the canonical term for the visit, and the portable save envelope writes the
view under `sectorSession`. Older saves can still carry the legacy `battle`
key. The in-memory `GameSnapshotContent` field remains `battle`, and
`sectorState` remains the request field that carries the view.

## What it changes

- A newly written save carries the sector view under `sectorSession`.
- A save that still carries `battle` is read from that field, converted, and
  written back under the new name. The old name is never written again.
- The terrain compaction, which reads and rewrites the saved sector view,
  handles both names while reading.

## What it does not change

The saved values, sector snapshot shape, and gameplay rules remain unchanged.
An older save with only the legacy `battle` key still loads into the same
in-memory state.

## Test requirements

- New saves must write the sector view under `sectorSession` and omit the
  legacy envelope key `battle`.
- A save with only the legacy `battle` key must load into the same in-memory
  state; saving that state again must write `sectorSession`.
- Terrain compaction must read the view from `sectorSession` or, when that key
  is absent, from legacy `battle`.
