# Slice 31: a checker rule for the game-interface direction

**Intent:** Make the architecture checker refuse an import from the game
package into the player application, so the dependency direction cannot be
inverted by a later slice.

## Why this slice exists

The game package contains domain rules and application operations; the player
application contains browser presentation. A game import from `apps/web`
would reverse this dependency and couple game behavior to the UI.
The existing player-to-game rules block retained root modules from all
`apps/web` files and block game-layer imports from `apps/web/app`; the browser
composition in `apps/web/lib` may import those layers. They do not block the
reverse game-to-player dependency.

## What it adds

A rule in `tools/architecture-rules.ts`: no file under `packages/game` may
import a module under `apps/web`. The existing rules that block an interface
file from importing game layers stay as they are, so the two directions are
both enforced.

## What it changes

- `tools/check-architecture.mjs` applies the new rule to every import it
  resolves, as it already applies the others.
- `.dependency-cruiser.json` adds the same prohibition on imports from
  `packages/game` into `apps/web`.
- `tools/architecture-rules.test.ts` gains cases: the rule refuses a game file
  importing `apps/web`, accepts a game file importing another game file,
  accepts an interface file importing a game public entry, and accepts the
  interface's own modules.

## Tests

- The pure rule tests assert that game imports from `apps/web` are refused and
  game-to-game imports remain allowed.
- A repository test exercises the architecture checker against the source tree.
