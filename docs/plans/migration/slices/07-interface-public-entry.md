# Slice 7: the interface reaches the game through a public entry

**Branch:** `migration/interface-public-entry`
**Intent:** Give the player application the declared door into the game that
the campaign editor already has.

## Why this slice exists

`packages/game/package.json` declares public entries, and the campaign editor
reaches the game only through them: `apps/campaign-editor/tools/check-boundaries.mjs`
fails when an editor file imports anything else. The player application has no
such door. `apps/web` imports 465 statements from the retained compatibility
modules at the root of `packages/game`, across about 150 files, by relative
path.

The accepted architecture puts the browser composition in `apps/web` and the
game rules behind declared public entries. A reader of the interface cannot
tell which parts of the game a screen depends on, because the dependency is a
path rather than a named surface, and nothing stops the next component from
reaching deeper.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/public/game-runtime-api.ts` | The declared surface the player application reads the game through |

The entry re-exports named symbols explicitly, in the style of the existing
`packages/game/public/campaign-editor-api.ts`. It does not re-export a module
whole, and it does not export the same name twice.

Six names are exported by more than one of the retained modules, because one
module re-exports what another defines: `operativeLocation`, `contractQuote`,
`contractStatus`, `incomeSummary`, `depotSelection`, and `localArtilleryDepot`.
The entry exports each of them once, from the module that defines it.

## What it changes

- `apps/web/app` and `apps/web/lib` import those symbols from the public entry
  instead of from the game package's root modules.
- `tools/architecture-rules.ts` and `tools/check-architecture.mjs` extend the
  rule that already forbids an interface file from importing a game layer: no
  file under `apps/web` may import a retained compatibility module from the
  root of `packages/game` either.
- `apps/web/lib` keeps its access to the game layers. It is the browser
  composition: constructing the object graph is its job. The rule that keeps
  the interface out of the layers still applies to `apps/web/app`.

The rule is what keeps the slice from being undone: the application may
import the game's public entries and nothing else from the package.

## Tests

- `tools/architecture-rules.test.ts` proves the extended rule refuses a file
  under `apps/web` that imports a retained compatibility module, and still
  accepts the public entries.
- A new test in `packages/game/public/` proves the entry covers what the
  application imports: it reads the application's import statements, collects
  the symbols it takes from the retained modules, and fails when the entry
  does not export one of them, or exports a name the entry defines twice.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.11` to `0.2.12`.
