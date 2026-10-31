# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Project overview](../../README.md)

The browser implementation in `packages/game/` and `apps/web/` is the primary game. Its interface is Spanish. Code and documentation are English.

Read the [campaign separation record](../verification/campaign-engine-separation-2026-10-10.md)
for current scope and known limits. The [version 0.1 status](../verification/version-0.1.md)
describes the earlier tagged checkpoint. Current development checks do not
establish complete game acceptance.

## Requirements

- Git, to clone the repository.
- An up-to-date **Node.js 22 LTS**, **22.18.0 or newer**, for development and native TypeScript tests.
- npm and a current browser.

The browser game does not require the `reference/native/engine/` submodule, a C++ toolchain or an original JA2 installation.

To play without a local installation, open [Granaderos on GitHub Pages](https://fsodano.github.io/granaderos/).

## Install and run

Run these commands in a terminal:

```sh
git clone https://github.com/fsodano/granaderos.git
cd granaderos
npm ci --prefix apps/web
npm run dev
```

The repository includes campaign folder tools and the independent editor in `apps/campaign-editor`. The [repository map](repository-layout.md) explains the source boundaries.

Run subsequent commands from the repository root. Dependencies are installed in `apps/web/node_modules`; the committed `apps/web/package-lock.json` fixes their versions.

`npm run dev` starts the web package's Vinext development server. Open [localhost:3000](http://localhost:3000), or the address printed by the server if its port changes. Stop the server with Ctrl+C.

Select an installed campaign. In the Granaderos campaign, choose **Nueva campaña** to begin at the Retiro desk. Retiro is the only controlled sector. Recruit combatants or create a free character. Recruitment gives immediate control at the selected safe site. The first person in service advances the opening chapter. **Combate de San Lorenzo** starts a separate battle.

The current economy uses pesos for hiring and campaign preparations. Equipment
commerce is disabled: equipment comes with its owner or is found in a sector.
Earlier supplier, price, import and artillery-trading records describe dated
features; they do not enable purchases in the current development code or the 0.1 checkpoint. The game has no strategic
material stocks or resource production chains. Present mounts retain their
condition, stamina and assigned rider; rest restores stamina. Buying, hiring,
feeding and breeding horses are disabled. Physical equipment transport remains
available. Saves from the earlier economy are rejected;
start a new campaign.

The title screen links to the separate `campaign-editor` application. The
compatibility routes `/studio`, `/story`, and `/editor` open its corresponding
workspaces in a production build. For development, install its dependencies with
`npm ci --prefix apps/campaign-editor` and start it with `npm --prefix apps/campaign-editor run dev`.
The story editor supports validated characters, weapons, abilities, dialogue
choices, quests and bounded campaign definitions, including a separate example.
Use the [campaign studio](../authoring/campaign-studio.md) at `/campaign-editor/` to create,
edit, test and export a complete campaign package. The
[campaign folder guide](campaign-authoring.md) describes local installation.
The editors open the selected package and keep its drafts separate. Community
campaign publication remains [future work](../plans/campaign-authoring.md).

## Save behavior

Campaign progress and its active battle are saved in browser storage. Installed campaigns use separate save slots by campaign ID. Editor launches use a content identity hash. **Continuar campaña** restores the stored game. **Guardar** exports a JSON file; **Importar partida** loads one.

Browser storage belongs to the current browser profile and site origin. A different protocol, hostname or port has separate storage. GitHub Pages and localhost have separate storage. Export a save before moving between origins or clearing browser data, then import it at the destination. The export is the portable copy.

The save implementation is in [`packages/game/save.js`](../../packages/game/save.js). [`useCampaignAutosave.ts`](../../apps/web/lib/useCampaignAutosave.ts) saves campaign and battle changes and reports storage errors through the game notice.

Validate current saves through export, import, and browser reload. The supported
save schemas and explicit migrations are described in the
[persistence guide](../architecture/persistence.md). Keep focused migration
fixtures for those contracts; a save from an unsupported economy is rejected.

## TypeScript toolchain

Type checking uses TypeScript **7.0.2**, pinned through the `@typescript/native`
npm alias in both applications. Run `npm run typecheck` from the repository root
to check the game, browser interface, and campaign editor with this compiler.

The `typescript` dependency is pinned to `@typescript/typescript6` **6.0.2**.
It supplies the compatible compiler API used by architecture checks, test loaders,
and preview tools. The `tsc` command runs TypeScript 7; `tsc6` belongs to the API
compatibility package. This follows Microsoft's
[side-by-side installation guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0).
Both dependency lockfiles include the platform packages needed by local development
and CI. The editor includes Vite's browser asset declarations for CSS imports.

## Checks

The test runner includes domain invariants, application contracts, persistence,
editor operations, and game integration checks. It discovers the current tests
and uses two workers. See [the test guide](../../tests/README.md).

Install dependencies with `npm ci --prefix apps/web` and
`npm ci --prefix apps/campaign-editor`, then run:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the complete current minimum with two worker processes. |
| `npm run test:quick` | Run the same minimum; this is an alias. |
| `npm run typecheck` | Check game, web, and editor types without emitting files. |
| `npm run check:architecture` | Enforce layer, package, browser, and public API dependencies. |
| `npm run check:format` | Check formatting of migrated architecture source. |
| `npm run audit:docs` | Check the documentation register and generated view. |
| `npm run audit:baseline` | Check the reference gameplay values. |
| `npm run build` | Build and verify the static browser export in root `.output/dist/`. |

The standard suite does not require Python, regenerate artwork, or run complete
campaign routes. Failures fail the command. Tests use real domain objects with
deterministic inputs. Add focused checks for new invariants, refusals, identity,
time, persistence, and worker admission. Use browser checks to verify visible
flows. A passing suite does not certify campaign completion or visual quality.

### GitHub Actions

[Minimal tests](../../.github/workflows/tests.yml) runs `npm test` on non-draft
pull requests and manual requests. A newer commit cancels the older run for
that pull request. It installs both application dependency sets and checks
architecture boundaries, formatting, and types before tests.

On `main`, the [Web game build and Pages workflow](../../.github/workflows/web.yml)
runs the same minimum, the documentation and baseline audits, the type check,
and the production build before publication. There is no separate main test
workflow and no repeated core/campaign job. Newer main builds cancel older
ones. Windows builds remain manual.

<a id="before-pushing"></a>

### Before pushing

Run the minimum and the checks relevant to the change locally. For a playable
version, use the following on the final candidate:

```sh
npm test
npm run audit:docs
npm run audit:baseline
npm run typecheck
npm run build
git diff --check
```

Record the source revision, actual test totals, failures and skips. Fix failures
locally before pushing once. A passing minimum does not establish complete
campaign acceptance, visual quality or sustained performance.

Build in a separate candidate checkout when the browser preview serves another
checkout. The build replaces `apps/web/dist/` and root `.output/dist/`. Preserve the preview
origin and saved progress. Check the affected controls in the browser before
delivery; the tests do not replace that review.

The [version 0.1 status](../verification/version-0.1.md),
[published progress ledger](../verification/published-progress.md),
[workspace acceptance record](../verification/gameplay-completion.md) and
[JA2 parity audit](../verification/ja2-parity-audit.md) retain dated evidence.
Each result applies to its recorded source. A version tag identifies a snapshot;
it does not certify a complete playthrough.

### Tags after each main merge

After each accepted merge into `main`, create a patch or minor tag for that exact merged commit. Preserve the historical `0.1` tag. The first tag after that checkpoint is `0.1.1`; later merges advance the patch or minor version. The agent chooses patch or minor versions; only the user can authorize a major version, including `1.0`.

Before freezing the local candidate, set the same version in `VERSION`, root `package.json`, `packages/game/package.json`, `apps/web/package.json` and the two root package records in `apps/web/package-lock.json`. Keep dependency versions unchanged. Verify that the production `build-info.json` records this version and the exact source revision.

Run the required local checks before publishing. After the reviewed merge, verify the remote `main` revision and bind the tag to it. Record the checks and remaining limits with the delivery. A development tag retains that evidence and does not establish complete campaign or release acceptance.

## Production output

```sh
npm run build
```

[`apps/web/next.config.ts`](../../apps/web/next.config.ts) configures a static export. The web build writes its client output to `apps/web/dist/client/`. [`tools/build-web.mjs`](../../tools/build-web.mjs) copies this output to root `.output/dist/`, checks the copied bytes, and adapts the file layout for project hosting. It then validates asset references, manifests, artwork checksums and browser worker URLs in the staged export.

Serve the root `.output/dist/` directory through an HTTP server for production review. The repository has no dedicated root preview command. The web package's `start` script targets a Wrangler server configuration; it is separate from the root static-export workflow.

Build success establishes that the export and its checked assets were produced. Browser checks must still cover the changed controls, rendering and save behavior.

### GitHub Pages

The hosted game is at [fsodano.github.io/granaderos](https://fsodano.github.io/granaderos/).
GitHub Pages serves the export from its last deployment; it can differ from
current `main` or a version tag. The game needs no application server.

The [web workflow](../../.github/workflows/web.yml) builds with `GRANADEROS_BASE_PATH=/granaderos`. It checks browser types, deployment paths, browser workers and the static export before publishing `.output/dist/`. Every push to `main` starts the verified build and publishes its successful export. Manual builds remain available through `workflow_dispatch`; manual publication also requires `main`. Pull requests, tag pushes and pushes to other branches do not start this workflow.

The selected main revision publishes even if unrelated commits advance main
during the build. A newer push or manual dispatch on the same branch replaces
an older run. The workflow records its selected revision in the run summary. Verify that the published
`/granaderos/build-info.json` revision equals that selected revision. This
confirms the deployed source, not complete campaign acceptance. The web workflow runs the same minimal test set used locally; it does not run
complete campaign routes.

Set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow uses the `github-pages` environment and the official [GitHub Pages actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To build the same export locally, run:

```sh
GRANADEROS_BASE_PATH=/granaderos npm run build
```

Serve this export at `/granaderos/` for browser review. Root-path exports use `npm run build` without that variable.

## Source layout

Use the [repository map](repository-layout.md) for the complete directory tree,
package boundaries, output locations, and reading paths.

| Path | Contents |
| --- | --- |
| [`apps/campaign-editor/`](../../apps/campaign-editor/README.md) | Independent editor application and domain model |
| [`packages/campaign-format/`](../../packages/campaign-format/README.md) | Shared published file contracts |
| [`content/campaigns/`](../../content/campaigns/) | Authored campaigns and packaged media |
| [`packages/game/`](../../packages/game/) | Campaign and tactical rules, maps, data and save validation |
| [`apps/web/app/`](../../apps/web/app/) | React screens, controls and styles |
| [`apps/web/lib/`](../../apps/web/lib/) | Shared browser helpers |
| [`apps/web/public/art/`](../../apps/web/public/art/) | Artwork installed in the browser game |
| [`tests/`](../../tests/) | Node tests and supporting fixtures |
| [`tools/`](../../tools/) | Build, artwork and verification utilities |
| [`content/assets/`](../../content/assets/) | Artwork sources, prompts, references and exports |
| [`docs/`](../README.md) | Guides, specifications and verification records |

Earlier native conversion work remains in `reference/native/engine/`, `reference/native/overlay/`, `reference/native/patches/` and `reference/native/mod/`. Its Windows toolchain, packaging and original JA2 data requirements are described in the [native build reference](../reference/native-build.md). Those instructions apply to that separate implementation.

The game, story editor and sector editor show the same source build ID.
`/build-info.json` exposes its source digest. Compare that identity with the
source under review before selecting a preview server. A running preview or
hosted deployment can still contain an earlier build. See
[version 0.1 status](../verification/version-0.1.md) for the version's evidence.
