# Slice 9: GameSnapshot

**Intent:** Give the versioned representation of the game model the name the
ubiquitous language gives it, and use it in the persistence and worker
contracts.

## Why this slice exists

The [ubiquitous language](../../accepted/ubiquitous-language.md) names
`GameSnapshot` as "a versioned representation of the game model for
persistence and worker transport", and names `GameSnapshotMapper` as the thing
that converts domain objects to and from it. The mapper exists, in
`packages/game/infrastructure/persistence/game-snapshot-mapper.js`, and so does
the save envelope, in `packages/game/save.ts`. Neither has the name.

The envelope is written by hand today: `encodeSave` builds an object literal
with `format`, `schema`, `savedAt`, `mapping`, `campaign`, and `battle`, and
`decodeSave` returns the `{ campaign, battle }` pair as an inline type. The
worker transport carries the same pair under its own inline type.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/public/game-snapshot-types.ts` | `GameSnapshot` and the content it carries |

## What it changes

- `packages/game/save.ts` states the envelope with the named types instead of
  building an anonymous literal, and returns them.
- The worker transport contracts state the same content with the named type.
- The save validation keeps accepting every supported save: the envelope's
  `format` and `schema` values do not change.

## What it does not change

No save format change, no gameplay change, and no Spanish text. The envelope
keeps its `format: 'granaderos'` value and its `schema` values.

## Tests

- A new test proves the named types describe the envelope the save produces:
  the decoded save carries the campaign and the sector snapshot, and its
  `schema` is one of the supported values.
- Existing save and restoration tests cover decoding supported saves.
