# Slice 31: a checker rule for the game-interface direction

**Branch:** `migration/game-import-boundary`
**Intent:** Make the architecture checker refuse an import from the game
package into the player application, so the dependency direction cannot be
inverted by a later slice.

## Why this slice exists

A recent slice moved a Spanish HUD sentence into `apps/web/lib`. Its only
caller is a HUD model inside `packages/game`, so the fixer had to make the
game import from the app to keep the sentence in its new home. Every check
passed. The slice was corrected before it merged, but nothing in the tooling
would have stopped the inversion from landing.

The accepted architecture says the game is independent of the UI, and the
repository instructions enforce inward dependencies with
`tools/check-architecture.mjs` and `.dependency-cruiser.json`. The rule that
covers this direction is missing.

## What it adds

A rule in `tools/architecture-rules.ts`: no file under `packages/game` may
import a module under `apps/web`. The existing rules that block an interface
file from importing game layers stay as they are, so the two directions are
both enforced.

## What it changes

- `tools/check-architecture.mjs` applies the new rule to every import it
  resolves, as it already applies the others.
- `.dependency-cruiser.json` gets the same rule, with an explicit exception
  for the declared preview bridge that the campaign editor is allowed to use.
- `tools/architecture-rules.test.ts` gains cases: the rule refuses a game file
  importing `apps/web`, accepts a game file importing another game file,
  accepts an interface file importing a game public entry, and accepts the
  interface's own modules.

## Tests

- The pure rule tests prove the direction is refused and the allowed paths
  still pass.
- A repository test that exercises the actual checker confirms it still
  passes on the current source.

## Verification

- `npm run check:architecture` passes.
- `npm run check:dependencies` passes.
- `npm test` passes, including the new tests.
- `npm run typecheck` passes.

## Version

`0.2.35` to `0.2.36`.
