# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Repository map](repository-layout.md)

The game runs from `apps/web`. The independent campaign editor runs from
`apps/campaign-editor`. Shared game code belongs in `packages/game`; campaign
file contracts belong in `packages/campaign-format`. The game interface is
Spanish. Source code and development documentation are English.

## Install and run

Use the exact Node.js version in [`.node-version`](../../.node-version), with
npm and Git. Select this version with your Node version manager before setup.
The browser applications do not require the native reference build or an
original JA2 installation.

```sh
git clone https://github.com/fsodano/granaderos.git
cd granaderos
npm run setup
npm run dev
```

Setup installs both application dependency sets and the 3D playground dependencies
from their committed lockfiles, then installs the repository Git hooks. It preserves an existing custom hook
configuration and reports how to integrate the repository hooks into it.
Dependencies live in their application or playground directory.

Open the local address printed by the server. The usual game address is
[localhost:3000](http://localhost:3000). Start the editor with
`npm --prefix apps/campaign-editor run dev`. Stop a development server with
Ctrl+C. See the [campaign authoring guide](campaign-authoring.md) for package
installation and editing.

To play the published game, open [Granaderos](https://fsodano.github.io/granaderos/).

## Local checks

Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run verify:commit` | Format, lint, architecture, and dependency checks. |
| `npm run verify:quick` | Commit checks, strict types, all automated tests, dependency security, documentation and baseline audits. |
| `npm run verify` | Push checks and the complete production build. |
| `npm test` | All discovered TypeScript tests, with two workers. |
| `npm run test:quick` | Alias for the same complete automated test suite. |
| `npm run typecheck` | Strict compiler checks for the game, applications, tests, campaign UI, and TypeScript tools. |
| `npm run lint` | Lint all maintained application, package, campaign, tool, and test source. |
| `npm run lint:audit` | The same lint scope and rules. |
| `npm run check:dependencies` | Enforce Dependency Cruiser layer and package boundaries. |
| `npm run audit:dependencies` | Audit all application and playground dependencies; any advisory fails the check. |
| `npm run check:architecture` | Enforce repository architecture policies and public entries. |
| `npm run format` | Format maintained source with Oxfmt. |
| `npm run lint:fix` | Apply supported safe lint fixes. Review the result. |
| `npm run build` | Build and verify the game and editor export in `.output/dist`. |

The pre-commit hook checks staged whitespace and runs `verify:commit`. The
pre-push hook runs `verify:quick`. These commands inspect the current working
tree. Run them on the complete intended change and keep the pushed branch in
sync with that tree. CI runs `npm run verify` on pull requests and before Pages
publication. Each verification profile stops at its first failed stage. The dependency audit
requires registry access and checks all three lockfiles, including development
dependencies. It reports each package set and preserves failures.

The suite checks domain invariants, use-case refusals, identity, partial progress,
time, save compatibility, worker admission, lifecycle ownership, and editor
operations. See the [test guide](../../tests/README.md) for focused commands and
fixture rules. Long campaign routes and browser acceptance remain separate
checks. Automated tests do not establish complete campaign acceptance or visual
quality. Record the source revision, checks, failures, and limits of each
acceptance run.

## TypeScript and lint rules

Both applications pin TypeScript **7.0.2** through `@typescript/native`.
The `typescript` dependency pins the **6.0.2** compiler API through
`@typescript/typescript6` for tools that use that API. The `tsc` executable runs
TypeScript 7. This follows Microsoft's
[side-by-side installation guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0).

[`tsconfig.strict.json`](../../tsconfig.strict.json) supplies common rules.
These include strict null checks, checked indexed access, exact optional
properties, checked return paths, explicit overrides, unused binding checks,
and library declaration checking. Automated tests and their shared helpers use
`.ts`; React test components use `.tsx` when needed. Runtime and file boundaries
validate external values before they expose concrete application types.
Existing JavaScript game modules remain explicit compatibility adapters during
the staged migration.

The common lint configuration uses Oxlint and its type-aware companion. It
rejects explicit `any`, unsafe assignments and calls, unsafe assertions,
non-null assertions, unused bindings, and React correctness violations. All
control-flow bodies require braces. Oxfmt supplies one source format.
The [source collector](../../tools/code-quality.mjs) includes applications,
packages, authored campaign UI, tools, and tests. Generated files, dependencies,
and build output are excluded.

Use named types and domain terms. Share a constant when it represents one
repeated domain concept; retain literal unions for finite typed choices.
Do not replace missing information with unchecked casts or invented defaults.
Keep negative tests explicit about the malformed input they submit.

The browser dependency lockfile uses patched releases. Its narrow override for
`satori@0.33.5` selects `fflate@0.7.5`, the patched version in the same minor series,
because Satori pins an affected archive decoder. See the
[fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98).
Remove this override when the upstream dependency selects a patched version.

## Architecture and React

Read the [accepted architecture](../plans/accepted/domain-architecture.md) and
[ubiquitous language](../plans/accepted/ubiquitous-language.md) before changing
layers or domain terms. Dependency Cruiser enforces inward domain and
application dependencies, the independent file-contract package, public editor
integrations, and production isolation from tests and tools. Architecture tests
exercise permitted and rejected imports against the actual configuration.

Keep React components direct. Put state near the controls that own it. Derive
values during render when they follow from current props or state. Handle user
commands in event handlers. Use effects for external systems such as event
subscriptions, workers, and renderer lifetimes, with matching cleanup. Add
memoization for a measured cost or a required stable identity.

These rules follow Kent C. Dodds's guidance on
[colocation](https://kentcdodds.com/blog/colocation),
[derived state](https://kentcdodds.com/blog/dont-sync-state-derive-it), and
[memoization](https://kentcdodds.com/blog/usememo-and-usecallback), together with
React's [effect guidance](https://react.dev/learn/you-might-not-need-an-effect).

## Saves and browser acceptance

The game saves campaign progress and its active battle in browser storage.
Installed campaigns use separate slots by campaign ID. Editor launches use a
content identity hash. **Continuar campaña** restores a saved game; **Guardar**
exports JSON; **Importar partida** loads a file.

Browser storage belongs to one browser profile and site origin. Export a save
before changing the protocol, hostname, port, or browser profile. The export is
the portable copy. Validate save changes through export, import, and browser
reload. The implementation is [save.ts](../../packages/game/save.ts); the
[persistence guide](../architecture/persistence.md) describes supported schemas
and migrations.

Check visible controls, rendering, and file flows in the real browser before
claiming browser acceptance. Keep local build, cache, and diagnostic output in
ignored `.output/` directories.
