# Slice 45: the beginAssault command alias goes away

**Branch:** `migration/retire-begin-assault`
**Intent:** Remove the last command alias from the campaign dispatcher, so a
hostile arrival is resolved the one way the architecture names.

## Why this slice exists

The ubiquitous language lists `beginAssault` as a compatibility name to
retire: "Compatibility resolution of the current hostile arrival decision. It
cannot bypass the required decision or its identity."

The command resolves the arrival decision for every squad already at a
sector's boundary, while `fightOnArrival` resolves the decision of one named
squad. The alias is a convenience over the canonical command, not a second
kind of resolution, and the dispatcher's own guard already treats the two as
one family of orders.

## What it changes

- The campaign dispatcher handles `fightOnArrival` alone.
- A caller that wants every squad at a sector's boundary to fight resolves
  each squad's decision and sends `fightOnArrival` for it, which is what the
  alias did.
- The action type no longer offers `beginAssault`.

## What it does not change

Which squads fight, which decision is resolved, and the notices the player
sees. The same squads arrive and the same decisions resolve.

## Tests

- The test that used the alias now sends the canonical command for each ready
  squad, and proves the same squads arrive with the same notices.
- A test proves the dispatcher no longer accepts the retired command.
- The existing journey, arrival and route tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.49` to `0.2.50`.
