# Slice 27: the interior visibility module uses the domain's space rules

**Branch:** `migration/interior-visibility-helpers`
**Intent:** Remove the copies of the tactical level rules that the interior
visibility module had to make, now that the domain owns them.

## Why this slice exists

[Slice 24](24-interior-visibility.md) moved the interior visibility rule into
the domain, and had to copy five small helpers into the domain module:
`tacticalLevel`, `validTacticalLevel`, `spaceKey`, `sameCell` and the surface
lookup. The copy was honest but temporary: the module those helpers lived in
read the shared file contract, which the domain may not import.

[Slice 26](26-tactical-space.md) moved those helpers into the domain. This
slice is the cleanup it enabled: the interior visibility module uses the
domain's helpers instead of its own copies.

## What it changes

`packages/game/domain/perception/interior-visibility.ts` imports the level
rules from `packages/game/domain/sector-sessions/tactical-space.ts` and drops
its copies. It may keep the helper that finds the surface a point is on, if
that helper is not in the domain yet, but it must not keep a copy of a rule
the domain now owns.

The rule does not change: the same rooms, the same visibility answer, and the
same cache of the room index.

## Tests

- The existing test of the interior visibility rule keeps passing unchanged,
  which proves the behavior did not change.
- A new test in `packages/game/domain/perception/` proves the domain module no
  longer declares its own copy of the level rules: it reads the file and
  fails when it declares a local `tacticalLevel`, `validTacticalLevel`,
  `spaceKey` or `sameCell`. The test is a guard against the copies coming
  back.

## Verification

- `npm test` passes, including the new test.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.31` to `0.2.32`.
