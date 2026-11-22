# Slice 8: CampaignCompiler

**Intent:** Give the game the application service the ubiquitous language names
as the only path from the shared file contract into the game.

## Why this slice exists

The [ubiquitous language](../../accepted/ubiquitous-language.md) says:

> `CampaignCompiler` | The application service that turns a validated
> `CampaignDefinition` into runtime-playable domain objects. It is the only path
> from the shared file contract into the game.

The accepted architecture repeats it: "`CampaignCompiler` in
`packages/game/application` turns a validated definition into runtime-playable
domain objects; it is the only path from the shared file contract into the
game. Editor publication can invoke the public game validation API when
needed."

Before Slice 8, no `CampaignCompiler` existed. The path was a function in a
retained root module, `compileCampaignPackage` in
`packages/game/campaign-library.js`, which admitted the authored documents,
applied runtime rules, and resolved content into runtime-playable definitions.
The game application and campaign editor both called it, the editor through
`packages/game/public/campaign-editor-api.ts`.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/application/campaign-compiler/campaign-compiler.use-case.ts` | The `CampaignCompiler` application service |
| `packages/game/application/campaign-compiler/campaign-compiler.repository.ts` | Its narrow repository interface |
| `packages/game/application/campaign-compiler/campaign-compiler.request.ts` | The compilation request |
| `packages/game/application/campaign-compiler/campaign-compiler.response.ts` | The compilation response |
| `packages/game/application/campaign-compiler/README.md` | The contract the slice note records |

## What it changes

- `packages/game/campaign-library.js` keeps its role as the module that reads
  the shared file contract, and the compilation itself moves to the
  application layer.
- The game's and the editor's public entries expose the compiler.
- Player and editor call sites use the compiler in
  `apps/web/lib/campaign-library.ts`,
  `apps/campaign-editor/web/lib/campaign-library.ts`, and
  `apps/campaign-editor/infrastructure/project-validation.js`, as do the
  campaign-compilation tests.

## What it does not change

The compiler admits the same documents, applies the same runtime rules (the
fixed 20 by 16 map size, the adversary spawn a generic campaign needs, the
building styles, the asset catalog), and resolves the same definitions. The
messages it refuses with stay the same, because the editor shows them to the
author.

## Tests

- Existing campaign-compilation tests cover the compiler's accepted inputs.
- A new test in `packages/game/application/campaign-compiler/` proves the
  compiler admits a valid package, refuses a package whose map is not 20 by 16,
  refuses a generic campaign without an adversary spawn, and refuses a package
  whose assets do not match the catalog.
