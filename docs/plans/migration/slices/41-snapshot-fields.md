# Slice 41: the saved sector and scene snapshots take their names

**Branch:** `migration/sector-snapshot-fields`
**Intent:** Give the two saved maps of retained world state the names that say
what they hold, and read the old names from saves that still carry them.

## Why this slice exists

The campaign snapshot carries two maps of retained world state: `sectorStates`,
the physical state of each sector the player has entered, and `sceneStates`,
the same for the mission scenes. The ubiquitous language lists both as
compatibility names and says they are "Retained physical sector and mission-scene
snapshot maps on the campaign snapshot", mapped to `Sector`, `Inventory`,
`WorldTimeline`, `ResidentRoutine`, and `Corpse` "without duplicating character
or inventory ownership".

The names say "states" where they hold snapshots of a world. The canonical
concepts are `Sector` and the mission scenes, and the campaign already has a
`sectors` map for who owns which locality, so the retained world state takes
the names `sectorSnapshots` and `sceneSnapshots`.

## What it changes

- A newly written save carries the two maps under their new names.
- A save that still carries the old names is read from them, converted, and
  written back under the new names. The old names are never written again.
- Every place in the source that reads or writes the maps uses the new names.

## What it does not change

The maps, their contents, the rules that read them, and every saved value. A
save written before this change loads into exactly the same state as before.

## Tests

- A test proves a save written now carries the two maps under the new names,
  and that the old names are absent.
- A test proves a save written with the old names still loads into the same
  state, and that saving it again writes the new names.
- The existing world lifecycle, resident and sector tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.45` to `0.2.46`.
