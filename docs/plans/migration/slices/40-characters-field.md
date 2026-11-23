# Slice 40: the saved operative state becomes the characters table

**Branch:** `migration/characters-field`
**Intent:** Give the saved per-character table the name the ubiquitous language
gives it, and read the old name from saves that still carry it.

## Why this slice exists

The campaign snapshot carries a table of per-character records under the field
`operativeState`. The ubiquitous language lists it as a compatibility name and
says it "maps to `Character`, `Health`, `CharacterAbilities`, `ServiceContract`,
and strategic location/assignment state".

The name is what is wrong. The table holds characters and their state; it is
not a separate thing called "operative state" that happens to describe people.
The canonical term is `Character`, so the saved field becomes `characters`.

This is the last of the large saved-name conversions: the field is read and
written in about 88 files.

## What it changes

- A newly written save carries the character records under `characters`.
- A save that still carries `operativeState` is read from that field,
  converted, and written back under the new name. The old name is never
  written again.
- Every place in the source that reads or writes the field uses the new name.

## What it does not change

The records, the rules that read them, and every saved value. A save written
before this change loads into exactly the same state as before.

## The stale baseline fixture

`tests/stock-startup-baseline.json` still carries the old field names and is
not read by any source or test. The slice updates it so the repository has one
name for each fact, and reports whether the file is worth keeping.

## Tests

- A test proves a save written now carries the character records under the new
  name, and that the old name is absent.
- A test proves a save written with the old name still loads into the same
  state, and that saving it again writes the new name.
- The existing campaign, personnel and restoration tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.44` to `0.2.45`.
