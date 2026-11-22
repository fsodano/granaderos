# Slice 11: ResidentPositionReference

**Intent:** Give the saved resident-post projection the name the ubiquitous
language gives it.

## Why this slice exists

The [ubiquitous language](../../accepted/ubiquitous-language.md) names
`ResidentPositionReference` as "a campaign-adapter projection of one serving
character's saved local post while that character does not participate in the
current visit. It contains the canonical character identity and physical
position only."

The projection exists. `packages/game/infrastructure/world/campaign-resident-positions.js`
builds it, and it travels in the saved sector state under `residentPositions`.
What does not exist is the name: the shape is written inline in
`packages/game/public/compatibility-types.ts` as
`{ characterId: string; position: { x: number; y: number; level: number } }[]`,
and the projection function returns an untyped value.

The glossary also warns what this projection is not: it "does not create
another participant, character, inventory, or health record". Naming it makes
that explicit at every place it appears.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/public/resident-position-types.ts` | The `ResidentPositionReference` type and its position type |

## What it changes

- `packages/game/public/compatibility-types.ts` states the saved
  `residentPositions` field with the named type instead of the inline shape.
- `packages/game/infrastructure/world/campaign-resident-positions.js` returns
  the named type, with the JSDoc annotation the repository uses for its
  JavaScript modules.
- `packages/game/world.js` and `packages/game/time.js`, which copy the field
  into and out of the sector state, keep working with the same values.

## What it does not change

No saved value changes: the field keeps its name, its shape, and its place in
the save. A restored sector still places its residents on the same cells.

## Tests

- A new test proves the projection holds only what the glossary says it holds:
  the canonical character identity and the physical position, and no health,
  inventory or participant record.
- Existing resident-placement tests cover restoring residents to their saved
  cells.
