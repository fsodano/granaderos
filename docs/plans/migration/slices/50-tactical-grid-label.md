# Slice 50: tactical grid labels belong to the domain

[`tacticalGridLabel`](../../../../packages/game/domain/sector-sessions/tactical-grid.ts)
maps a tactical cell's coordinates to its display label. The `y` coordinate
determines the spreadsheet-style letter prefix: `0` is `A`, `25` is `Z`, and
`26` is `AA`. The `x` coordinate determines the numeric suffix starting at one.
For example, `tacticalGridLabel(0, 26)` returns `AA1`.

## Domain rule

The label is part of the tactical grid's coordinate vocabulary. Its rule lives
in `tactical-grid.ts` beside
[`tactical-space.ts`](../../../../packages/game/domain/sector-sessions/tactical-space.ts),
which owns tactical-level and cell-space rules. The read-only `TacticalCell`
type names the `x` and `y` coordinates the label describes; the function keeps
its positional `(x, y)` signature for callers.

## Compatibility path

[`tactical-grid.js`](../../../../packages/game/tactical-grid.js) re-exports
`tacticalGridLabel` so existing callers retain their import path. The root
module delegates to the domain rule.

The tests in
[`tactical-grid.test.ts`](../../../../packages/game/domain/sector-sessions/tactical-grid.test.ts)
cover the first label, the transition from `Z` to `AA`, the next label `AB`,
and the one-based numeric suffix. A single rule keeps the label used by the
tactical interface consistent for each coordinate.
