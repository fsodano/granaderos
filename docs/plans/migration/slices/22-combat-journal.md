# Slice 22: the combat journal rules into the domain

**Branch:** `migration/combat-journal`
**Intent:** Move the rules that decide what the public combat journal may
contain into the domain, where the records that feed it are decided.

## Why this slice exists

`packages/game/combat-journal.js` holds the admission rules of the public
combat journal: that an entry names a turn and a text, that the text is not
empty and is not absurdly long, that the journal keeps at most eighty
entries, that a stored journal is only read when it is valid, and that the
public view hides one false report an older partial wound step recorded.

The file states what the journal is: "an event-time public record, not a
projection of the legacy log", and it warns that a caller must admit the
observation before writing names or outcomes, and that earlier entries must
never be reconstructed from log strings.

Those are rules about what a record may say and who may write it. They belong
in the domain, which already decides what the game may observe.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/combat/combat-journal.ts` | The rules |
| `packages/game/domain/combat/combat-journal.test.ts` | Their tests |

## What it changes

`packages/game/combat-journal.js` keeps its module and its exports, and
becomes a thin re-export of the domain module. The six files that import it
keep importing it from the same path.

The rules do not change: the same limit of eighty entries, the same entry
shape, the same text bounds, the same hidden false report, and the same
behavior when a stored journal is invalid.

## Tests

- `packages/game/domain/combat/combat-journal.test.ts` covers the rules: a
  valid journal is accepted, an entry that names no turn or an empty text is
  refused, a text that is too long is refused, an entry from a later turn is
  refused, a journal with too many entries is refused, an invalid stored
  journal reads as empty, and the false bleeding report stays hidden while
  the stored entries remain intact.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.26` to `0.2.27`.
