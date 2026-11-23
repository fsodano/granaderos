# Slice 39: the saved recruited list becomes the force roster

**Branch:** `migration/force-roster-field`
**Intent:** Give the saved list of serving combatants the name the ubiquitous
language gives it, and read the old name from saves that still carry it.

## Why this slice exists

The campaign snapshot carries the identifiers of the serving combatants under
the field `recruited`. The ubiquitous language lists it as a compatibility name
and says it "maps to `ForceRoster` membership", and it names `ForceRoster` as
the concept that owns "Player force membership and active squad capacity and
location".

The name is what is wrong. The field is not a list of people who were
recruited; it is the membership of the force. The canonical concept is
`ForceRoster`, so the saved field becomes `forceRoster`.

## What it changes

- A newly written save carries the serving members under `forceRoster`.
- A save that still carries `recruited` is read from that field, converted,
  and written back under the new name. The old name is never written again.
- Every place in the source that reads or writes the field uses the new name.

## What it does not change

The identifiers, the rules that read them, and every saved value. A save
written before this change loads into exactly the same state as before.

## Tests

- A test proves a save written now carries the serving members under the new
  name, and that the old name is absent.
- A test proves a save written with the old name still loads into the same
  state, and that saving it again writes the new name.
- The existing campaign, recruitment and restoration tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.43` to `0.2.44`.
