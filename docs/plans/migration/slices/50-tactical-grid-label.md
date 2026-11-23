# Slice 50: the tactical grid label into the domain

**Branch:** `migration/tactical-grid-label`
**Intent:** Move the rule that names a tactical cell into the domain, beside the
space rules that name its level.

## Why this slice exists

`packages/game/tactical-grid.js` holds one rule: the label a cell carries on
the tactical map, where the rows are named the way a spreadsheet names them and
the letters continue past Z on a large map.

The domain already owns the tactical space: `packages/game/domain/sector-sessions/tactical-space.ts`
holds the rules that read a point's level and name a cell on a level. The label
of a cell is the same kind of fact.

## What it changes

- `packages/game/domain/sector-sessions/tactical-grid.ts` holds the rule.
- `packages/game/tactical-grid.js` becomes a thin re-export of it, and the
  files that import it keep importing it from the same path.

The labels do not change: the first row is A, the twenty-sixth is Z, the
twenty-seventh is AA, and the column number starts at one.

## Tests

- `packages/game/domain/sector-sessions/tactical-grid.test.ts` covers the rule:
  the first row is A, the row after Z is AA, the row after AA is AB, and the
  label carries the column number from one.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.54` to `0.2.55`.
