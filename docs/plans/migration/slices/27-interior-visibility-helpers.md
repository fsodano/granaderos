# Slice 27: the interior visibility module uses the domain's space rules

**Intent:** Remove the copies of the tactical level rules that the interior
visibility module had to make, now that the domain owns them.

## Why this slice exists

[Slice 24](24-interior-visibility.md) moved the interior visibility rule into
the domain. The module had local copies of four tactical-level helpers:
`tacticalLevel`, `validTacticalLevel`, `spaceKey`, and `sameCell`. It also had a
separate surface lookup. These helpers were copied because the original module
read the shared file contract, which the domain may not import.

[Slice 26](26-tactical-space.md) moved the tactical-level rules into the
domain. This slice makes the interior visibility module use those domain rules
instead of its own copies.

## What it changes

`packages/game/domain/perception/interior-visibility.ts` imports the level
rules from `packages/game/domain/sector-sessions/tactical-space.ts` and drops
its copies of `tacticalLevel`, `validTacticalLevel`, `spaceKey`, and `sameCell`.
The separate surface lookup is not part of this slice's duplicate-rule check.
The independent `packages/campaign-format` copy remains necessary for
authored-map validation; that package cannot import game code.

The rule does not change: the same rooms, the same visibility answer, and the
same cache of the room index.

## Tests

- The existing interior-visibility test covers the unchanged room and
  visibility behavior.
- A new test in `packages/game/domain/perception/` proves the domain module no
  longer declares its own copy of the level rules: it reads the file and
  fails when it declares a local `tacticalLevel`, `validTacticalLevel`,
  `spaceKey` or `sameCell`. The test is a guard against the copies coming
  back.
