# Slice 37: the saved battle field becomes the sector session

**Branch:** `migration/sector-session-field`
**Intent:** Give the saved sector view the name the ubiquitous language gives
it, and read the old name from saves that still carry it.

## Why this slice exists

The saved envelope carries the sector view under the field `battle`. The
ubiquitous language lists `battle` and `sectorState` as compatibility names,
and says the field "maps to `SectorSession` and its optional `CombatSession`;
the field name does not imply active combat". The name `battle` is the one
thing about it that is wrong: a saved sector may hold an exploration, a
deployment, or a finished fight, and the field is not a battle.

The glossary's canonical term is `SectorSession`, so the saved field becomes
`sectorSession`.

## What it changes

- A newly written save carries the sector view under `sectorSession`.
- A save that still carries `battle` is read from that field, converted, and
  written back under the new name. The old name is never written again.
- The terrain compaction, which reads and rewrites the saved sector view,
  handles both names while reading.

## What it does not change

The saved values themselves, the sector snapshot's shape, and every rule. A
save written before this change still loads, and loads into exactly the same
state as before.

## Tests

- A test proves a save written now carries the sector view under the new
  name, and that the old name is absent.
- A test proves a save written with the old name still loads into the same
  state, and that saving it again writes the new name.
- The existing save and restoration tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.41` to `0.2.42`.
