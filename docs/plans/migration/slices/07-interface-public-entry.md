# Slice 7: the interface reaches the game through a public entry

**Intent:** Give the player application the declared door into the game that
the campaign editor already has.

## Why this slice exists

`packages/game/package.json` declares public entries, and the campaign editor
reaches the game only through them: `apps/campaign-editor/tools/check-boundaries.mjs`
fails when an editor file imports anything else. The player application has no
such door. `apps/web` imports retained compatibility modules from the root of
`packages/game` by relative path across many files.

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

- This slice added `game-runtime-api.ts` for symbols previously imported from
  retained modules. `apps/web` also imports other public entries, including:
  `campaign-types.ts`, `compatibility-types.ts`, `inventory-types.ts`,
  `battle-job-types.ts`, `game-snapshot-types.ts`, and
  `campaign-compiler-api.ts`.
- `tools/architecture-rules.ts` blocks every file under `apps/web` from
  importing a retained module directly from the `packages/game` root. It also
  blocks files under `apps/web/app` from importing game domain, application,
  or infrastructure modules.
- `apps/web/lib` is the browser-composition layer and may import game domain,
  application, and infrastructure modules. This permits it to construct
  use-case/repository pairs without allowing React screens to depend on those
  layers.

The boundary is therefore narrower for React screens than for browser
composition code.

## Tests

- `tools/architecture-rules.test.ts` proves the extended rule refuses a file
  under `apps/web` that imports a retained compatibility module, and still
  accepts the public entries.
- A new test in `packages/game/public/` proves the entry covers what the
  application imports: it reads the application's import statements, collects
  the symbols it takes from the retained modules, and fails when the entry
  does not export one of them, or exports a name the entry defines twice.
