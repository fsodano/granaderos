# Slice 6: RandomSource in the domain

**Intent:** Move the seeded random sequence out of a procedural helper and into
the domain, where the ubiquitous language says it belongs.

## Why this slice exists

The [ubiquitous language](../../accepted/ubiquitous-language.md) names
`RandomSource` as "the seeded random sequence for one game session" whose
"state is part of the game snapshot", and the accepted plan adds the acceptance
criterion that "a `RandomSource` restored from the snapshot repeats the same
sequence".

Before Slice 6, no such class existed. The sequence lived as a bare `seed`
field on the campaign snapshot. The production helper in
`packages/game/campaign.js` at the start of the slice was:

`s` is the campaign snapshot. The helper mutates `s.seed`, then divides the
updated unsigned 32-bit state by `4294967296` to return a value below one.
`Math.imul` multiplies as a 32-bit integer, and `>>> 0` interprets the result
as unsigned.

```js
const random = (s) => {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
};
```

Two rules therefore live outside the domain: what a valid seed is, and how the
next value is produced. The domain cannot state the sequence a game owns, and
no domain service can ask for a draw.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/shared/random-source.ts` | The domain class that owns the seeded sequence |
| `packages/game/domain/shared/random-source.test.ts` | Its tests, including the sequence it must produce |

## What it changes

- `packages/game/campaign.js`: the procedural `random` helper delegates to the
  domain class. The sequence it produces does not change.

## Why the game session does not own it

The ubiquitous language says the game session owns the `RandomSource`. It
cannot own it while the campaign snapshot's `seed` field is the state that the
running rules advance, because a session-held copy and the campaign's field
would be two owners of the same sequence, and the two would disagree after the
first draw. The accepted plan allows one declared owner per fact.

For the session to own it, the campaign's `seed` must become a projection of
the session's source, and every draw in the campaign rules must go through the
session rather than the campaign snapshot. The 27-slice plan leaves
ownership with the campaign snapshot.

## The sequence does not change

The domain `RandomSource` uses the same generator step as the production helper
it replaced:

`seed` is the 32-bit generator state; each call updates it. `value` is the
normalized draw returned by the generator.

```js
seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
value = seed / 4294967296;
```

The domain test `random-source.test.ts` expects these first values for a seed
of 1812:

```text
0.9383129708003253, 0.6337893842719495, 0.5109232396353036, 0.7415219265967607
```

A test asserts those values, so the rule cannot drift.

## Tests

- `packages/game/domain/shared/random-source.test.ts`: the source refuses a
  seed that is not an unsigned 32-bit integer, produces the values above,
  produces an integer draw inside the requested range, and produces the same
  values again after it is restored from its snapshot.
- `tests/random-source-persistence.test.ts`: a campaign that is saved and
  restored keeps its seed and continues the same sequence, so the accepted
  behavior "a restored game repeats the sequence it saved" holds end to end.
