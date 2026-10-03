# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Project overview](../../README.md)

The browser implementation in `game/` and `web/` is the primary game. Its interface is Spanish. Code and documentation are English.

## Requirements

- Git, to clone the repository.
- Node.js **22.13.0 or newer**, as required by [`web/package.json`](../../web/package.json).
- npm and a current browser.

The browser game does not require the `engine/` submodule, a C++ toolchain or an original JA2 installation.

To play without a local installation, open [Granaderos on GitHub Pages](https://fsodano.github.io/granaderos/).

## Install and run

Run these commands in a terminal:

```sh
git clone https://github.com/fsodano/granaderos.git
cd granaderos
npm ci --prefix web
npm run dev
```

Run subsequent commands from the repository root. Dependencies are installed in `web/node_modules`; the committed `web/package-lock.json` fixes their versions.

`npm run dev` starts the web package's Vinext development server. Open [localhost:3000](http://localhost:3000), or the address printed by the server if its port changes. Stop the server with Ctrl+C.

Choose **Nueva campaña** to begin at the Retiro desk. Retiro is the only controlled sector. Hire combatants or create a free character. The first person in service advances the opening chapter without an extra academy payment; wait for a pending hire to arrive. **Combate de San Lorenzo** starts a separate battle.

The published economy uses pesos for hiring, equipment and campaign preparations. It has no strategic material stocks, production chains, resource convoys or horse care. Saves from the earlier economy are rejected; start a new campaign.

The title screen opens the [story editor](story-editor.md) at `/story` and the [sector editor](sector-editor.md) at `/editor`. The story editor can start a separate campaign with validated character, firearm and ability definitions. Branching dialogue, quests and complete campaign authoring remain open work.

## Save behavior

Campaign progress and its active battle are saved in browser storage. **Continuar campaña** restores the stored game. **Guardar** exports a JSON file; **Importar partida** loads one.

Browser storage belongs to the current browser profile and site origin. A different protocol, hostname or port has separate storage. GitHub Pages and localhost have separate storage. Export a save before moving between origins or clearing browser data, then import it at the destination. The export is the portable copy.

The save implementation is in [`game/save.js`](../../game/save.js). [`useCampaignAutosave.ts`](../../web/lib/useCampaignAutosave.ts) saves campaign and battle changes and reports storage errors through the game notice.

## Checks

The root [`package.json`](../../package.json) defines these commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run every `tests/*.test.mjs` file with automatic worker selection and a timing report. |
| `npm run typecheck` | Check the web TypeScript project without emitting files. |
| `npm run build` | Build and verify the static browser export, then stage it in root `dist/`. |

Use relevant focused tests while making a change. For example:

```sh
node --test tests/economy-web.test.mjs tests/campaign-web.test.mjs
node --test tests/save-web.test.mjs
```

The first command checks campaign and economy rules. The second checks save behavior. Run broader checks when the change affects shared systems. Report failures, skipped cases and the exact scope checked.

The full runner uses one process per test file. It runs up to eight files at once, limited by the available CPU count. A machine with 12 available CPUs uses eight workers; a CI runner with four CPUs uses four. Individual simulation tests remain single-threaded, so a long campaign route can still limit the total time.

Use `npm test -- --concurrency 4` to select the worker count, or set `GRANADEROS_TEST_CONCURRENCY=4`. Explicit settings accept integers from 1 to 64. The full runner does not accept file or test-name filters. All selected files run, and any failure makes the command fail.

The runner writes per-file durations, results and totals to `.cache/test-times/full.json`. It updates the report as files finish and marks it complete after every file finishes. Future runs start the measured slow files first. Without a timing report, known long campaign-route and artillery tests start first. Each CI group writes its own `group-1.json` through `group-4.json` in the same directory.

### Before pushing

Keep small fixes local. GitHub Actions runs only when a maintainer starts the workflow manually. Use focused local tests to find and fix failures. Then run all checks below on the complete candidate before pushing it:

```sh
node --test tools/test-shard-selftest.mjs tests/test-runner.test.mjs
node tools/test-shard.mjs --check
npm test
npm run audit:docs
npm run audit:baseline
npm run typecheck
npm run build
git diff --check
```

Each command must finish successfully. `npm test` includes every test file used by the four CI groups and selects the worker count for the current machine. Record the source revision, test totals, failures and skips. Use the timing report to identify slow files. A focused test result does not replace this full run. If a command fails, fix the problem locally; do not push to use CI as a diagnostic tool.

Run the build in a private candidate folder if a preview serves this checkout's output. The build replaces both `web/dist/` and root `dist/`. Check the affected game or editor behavior in the browser before delivery. Keep the user's preview origin and saved progress intact.

After all local checks pass on the final candidate, push the completed batch once. Keep required GitHub checks enabled and wait for them before merging. If the candidate changes after verification, repeat the affected checks and run the full final checks before the next push. Do not claim a complete campaign or smooth rendering from build and unit-test results alone.

The [published progress ledger](../verification/published-progress.md) records delivered scope and remaining acceptance work on `main`. The [development-workspace acceptance record](../verification/gameplay-completion.md) and [JA2 parity audit](../verification/ja2-parity-audit.md) describe a separate integration checkout. Their results do not establish that the published checkout has those features or passes those checks.

Documentation link checks and `git diff --check` verify documentation structure and formatting. They do not establish game health, browser behavior or a successful campaign. Automated scenarios also do not replace a complete gameplay acceptance run.

## Production output

```sh
npm run build
```

[`web/next.config.ts`](../../web/next.config.ts) configures a static export. The web build writes its client output to `web/dist/client/`. [`tools/build-web.mjs`](../../tools/build-web.mjs) copies this output to root `dist/`, checks the copied bytes, and adapts the file layout for project hosting. It then validates asset references, manifests, artwork checksums and browser worker URLs in the staged export.

Serve the root `dist/` directory through an HTTP server for production review. The repository has no dedicated root preview command. The web package's `start` script targets a Wrangler server configuration; it is separate from the root static-export workflow.

Build success establishes that the export and its checked assets were produced. Browser checks must still cover the changed controls, rendering and save behavior.

### GitHub Pages

The published game is at [fsodano.github.io/granaderos](https://fsodano.github.io/granaderos/). GitHub Pages serves the verified static export; the game needs no application server.

The [web workflow](../../.github/workflows/web.yml) builds with `GRANADEROS_BASE_PATH=/granaderos`. It checks browser types, deployment paths, browser workers and the static export before publishing `dist/`. Publication runs only when a maintainer starts the workflow manually on the latest `main` revision. Pushes, pull requests and tags do not start a run.

The **Run the full tactical and campaign simulation suite** option is enabled by default. Its four test groups run independently and can take more than an hour. Clear this option when those tests have already passed locally and the run is only for publication. Browser export checks always run and must pass before publication.

Set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow uses the `github-pages` environment and the official [GitHub Pages actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To build the same export locally, run:

```sh
GRANADEROS_BASE_PATH=/granaderos npm run build
```

Serve this export at `/granaderos/` for browser review. Root-path exports use `npm run build` without that variable.

## Source layout

| Path | Contents |
| --- | --- |
| [`game/`](../../game/) | Campaign and tactical rules, maps, data and save validation |
| [`web/app/`](../../web/app/) | React screens, controls and styles |
| [`web/lib/`](../../web/lib/) | Shared browser helpers |
| [`web/public/art/`](../../web/public/art/) | Artwork installed in the browser game |
| [`tests/`](../../tests/) | Node tests and supporting fixtures |
| [`tools/`](../../tools/) | Build, artwork and verification utilities |
| [`assets/`](../../assets/) | Artwork sources, prompts, references and exports |
| [`docs/`](../README.md) | Guides, specifications and verification records |

Earlier native conversion work remains in `engine/`, `native/`, `patches/` and `mod/`. Its Windows toolchain, packaging and original JA2 data requirements are described in the [native build reference](../reference/native-build.md). Those instructions apply to that separate implementation.

The game, story editor and sector editor show the same source build ID. `/build-info.json` exposes its source digest. See [the consolidation record](../verification/latest-build-consolidation.md) before selecting a preview server; a running preview can still contain an earlier build.
