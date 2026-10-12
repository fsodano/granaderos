# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Project overview](../../README.md)

The browser implementation in `game/` and `web/` is the primary game. Its interface is Spanish. Code and documentation are English.

Read the [campaign separation record](../verification/campaign-engine-separation-2026-10-10.md)
for current scope and known limits. The [version 0.1 status](../verification/version-0.1.md)
describes the earlier tagged checkpoint. Current development checks do not
establish complete game acceptance.

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

The `main` branch includes the campaign folder tools and `/studio`. To inspect the earlier checkpoint, use `git checkout 0.1` instead.

Run subsequent commands from the repository root. Dependencies are installed in `web/node_modules`; the committed `web/package-lock.json` fixes their versions.

`npm run dev` starts the web package's Vinext development server. Open [localhost:3000](http://localhost:3000), or the address printed by the server if its port changes. Stop the server with Ctrl+C.

Select an installed campaign. In the Granaderos campaign, choose **Nueva campaña** to begin at the Retiro desk. Retiro is the only controlled sector. Hire combatants or create a free character. The first person in service advances the opening chapter without an extra academy payment; wait for a pending hire to arrive. **Combate de San Lorenzo** starts a separate battle.

The current economy uses pesos for hiring and campaign preparations. Equipment
commerce is disabled: equipment comes with its owner or is found in a sector.
Earlier supplier, price, import and artillery-trading records describe dated
features; they do not enable purchases in the current development code or the 0.1 checkpoint. The game has no strategic
material stocks, resource production chains or horse care. Physical equipment
transport remains available. Saves from the earlier economy are rejected;
start a new campaign.

The title screen opens the [story editor](story-editor.md) at `/story` and the
[sector editor](sector-editor.md) at `/editor`. These are experimental tools.
The story editor supports validated characters, weapons, abilities, dialogue
choices, quests and bounded campaign definitions, including a separate example.
Use the [campaign studio](../authoring/campaign-studio.md) at `/studio` to create,
edit, test and export a complete campaign package. The
[campaign folder guide](campaign-authoring.md) describes local installation.
The editors open the selected package and keep its drafts separate. Community
campaign publication remains [future work](../plans/campaign-authoring.md).

## Save behavior

Campaign progress and its active battle are saved in browser storage. Installed campaigns use separate save slots by campaign ID. Editor launches use a content identity hash. **Continuar campaña** restores the stored game. **Guardar** exports a JSON file; **Importar partida** loads one.

Browser storage belongs to the current browser profile and site origin. A different protocol, hostname or port has separate storage. GitHub Pages and localhost have separate storage. Export a save before moving between origins or clearing browser data, then import it at the destination. The export is the portable copy.

The save implementation is in [`game/save.js`](../../game/save.js). [`useCampaignAutosave.ts`](../../web/lib/useCampaignAutosave.ts) saves campaign and battle changes and reports storage errors through the game notice.

Version 0.1 uses the shared wall-edge map format. Compatibility with campaign
saves made before that format is not guaranteed. Keep exported backups and use
a new campaign for version 0.1 checks. See the
[wall verification record](../verification/wall-edges.md).

## Checks

For editor changes, use the [editor development guide](editor-development.md)
to select affected project, archive, storage, embedded or standalone checks.
The [editor experience plan](../plans/editor-experience.md) defines the current
UX/DX acceptance and its browser evidence requirements.

The root [`package.json`](../../package.json) defines these commands:

The core renderer tests reconstruct and verify image resources with Python and
Pillow. Before `test:core`, `test:quick`, `test:extended` or `npm test`, install the
pinned test dependency in a virtual environment. The core Action uses Python
3.13 and the same requirements file. This dependency is used by tests; it is
not required to play, run or build the browser game.

```sh
python3 -m venv .venv-core-tests
source .venv-core-tests/bin/activate
python3 -m pip install --requirement tools/requirements-core-tests.txt
```

Keep the environment active while running the checks below. Use `deactivate`
when finished.

| Command | Purpose |
| --- | --- |
| `npm run test:core` | Run every core mechanic, renderer, portable editor and tooling test file. |
| `npm run test:campaign` | Run every reviewed campaign data, scenario, earned episode and route test file. |
| `npm run test:quick` | Run all discovered test files except the extended files listed in the suite configuration. |
| `npm run test:extended` | Run the campaign, native replay and artwork files listed in the extended suite configuration. |
| `npm test` | Run every `tests/*.test.mjs` file with automatic worker selection and a timing report. |
| `npm run typecheck` | Check the web TypeScript project without emitting files. |
| `npm run build` | Build and verify the static browser export, then stage it in root `dist/`. |

Use relevant focused tests while making a change. For example:

```sh
node --test tests/economy-web.test.mjs tests/campaign-web.test.mjs
node --test tests/save-web.test.mjs
```

The first command checks campaign and economy rules. The second checks save behavior. Select core tests for shared mechanic changes and campaign tests for campaign changes. Report failures, skipped cases and the exact scope checked.

Core and campaign are separate file scopes. The reviewed campaign list is
[`tools/test-campaign-config.mjs`](../../tools/test-campaign-config.mjs); all other
discovered files belong to core. Mixed files run intact in their assigned scope.
Portable campaign-engine or editor tests can belong to core; the word
"campaign" in a filename does not assign its scope. The runner rejects stale or
duplicate manifest entries. New earned-input and full-route dependencies need
an explicit campaign declaration or a justified core fixture review. Core and
campaign cover the complete discovered suite once, with no overlap.

Duration is a separate selection. Both semantic commands default to all files
in their scope. Use these forms to inspect or run a bounded intersection:

```sh
npm run test:core -- --duration quick
npm run test:campaign -- --duration quick
npm run test:campaign -- --duration extended --list
npm run test:campaign -- --duration full
```

Each command runs every assertion in its selected files. Duration selection
does not change the semantic membership or the exhaustive `npm test` command.

The quick and extended partition is defined in
[`tools/test-suite-config.mjs`](../../tools/test-suite-config.mjs) and checked by
[`tools/test-suites.mjs`](../../tools/test-suites.mjs). Extended files cover long
campaign routes, earned native replay checks and full illustrated sprite
repacking. Their assertions remain in the full suite. Small engineer and
commander death checks, synthetic sprite packing checks and other asset checks
remain in quick. New test files enter quick by default. Timings change execution
order; they do not remove files from a suite. Use the runner's list commands
below for the current file counts.

Use affected extended checks when changing their campaign routes, test drivers, authored sprite sources or sprite packer. Add affected campaign checks when a shared mechanic can change a route outcome. Run the full suite before a release or a claim of complete campaign acceptance. A short result does not establish that the complete campaign passes.

Use `npm run test:quick -- --list` or `npm run test:extended -- --list` to inspect the selected files. The runner checks that quick and extended form the complete suite with no missing files or overlap. It fails if an excluded file is missing. The quick and extended commands print their scope before running and reject test-name filters, as the full command does.

The full runner uses one process per test file. It runs up to eight files at once, limited by the available CPU count. A machine with 12 available CPUs uses eight workers; a CI runner with four CPUs uses four. Individual simulation tests remain single-threaded, so a long campaign route can still limit the total time.

Use `npm test -- --concurrency 4` to select the worker count, or set `GRANADEROS_TEST_CONCURRENCY=4`. Explicit settings accept integers from 1 to 64. The full runner does not accept file or test-name filters. All selected files run, and any failure makes the command fail.

The runner writes per-file durations, results and totals to `.cache/test-times/`.
The report names are `full.json`, `quick.json`, `extended.json`, `core.json` and
`campaign.json`; a semantic duration intersection uses `core-quick.json`,
`campaign-quick.json`, `core-extended.json` or `campaign-extended.json`. Reports
contain the selected files, exclusions, duration profile and complete totals.
They update as files finish and become complete after all selected files finish.
Future runs start measured slow files first. A new profile uses the full report
until it has its own timings. The old four-group shard tool remains available
and writes `group-1.json` through `group-4.json`.

### Focused GitHub Actions

[`tests.yml`](../../.github/workflows/tests.yml) selects separate
[core](../../.github/workflows/test-core.yml) and
[campaign](../../.github/workflows/test-campaign.yml) jobs on main pushes and
non-draft pull requests. Draft pull requests wait until they are ready for
review. Automatic jobs run only their scope intersected with `quick`. The
separate workflows also accept manual `quick`, `full` or `extended` selections.
Choose `full` or `extended` explicitly for long campaign routes. Test failures
fail the job, and timing/scope reports are retained as artifacts.

[`tools/ci-test-selection.mjs`](../../tools/ci-test-selection.mjs) is the single
path authority. It reads the complete Git diff: three-dot for pull requests,
two-dot for pushes, including both sides of renames. Campaign JSON, maps,
scenario code and assets in `campaigns/` select campaign tests. `game/` and
`web/` changes select core tests. Test files use the same reviewed scope list;
helper and fixture ownership follows their test dependencies. A shared helper,
runner, scope configuration or package change selects both. Tracked earned
campaign cache inputs also select campaign. Documentation-only changes select
neither test job. Unknown paths select both as a safe fallback.

This is a focused ownership rule, not exhaustive runtime dependency analysis.
A core mechanic change can affect a historical route. Select the affected
campaign checks locally or start the campaign workflow manually when needed.
Automatic quick success does not prove the extended routes or full suite.
These workflows do not build the browser, deploy Pages or compile Windows.

<a id="before-pushing"></a>

### Before a release or broad gameplay change

Keep small fixes local. Use focused tests and the relevant quick scope to find and fix failures during development. Routine changes do not require a complete campaign on every edit. The focused test Actions are automatic; browser builds, Pages deployment and Windows builds remain manual. Before publishing a release, run all checks below on the complete candidate:

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

Each command must finish successfully. `npm test` includes every file in both semantic scopes and both duration profiles, and selects the worker count for the current machine. Record the source revision, test totals, failures and skips. Use the timing report to identify slow files. A focused or quick result does not replace this release check. If a command fails, fix the problem locally; do not push to use CI as a diagnostic tool.

Run the build in a private candidate folder if a preview serves this checkout's output. The build replaces both `web/dist/` and root `dist/`. Check the affected game or editor behavior in the browser before delivery. Keep the user's preview origin and saved progress intact.

After the required local checks pass on the final candidate, push the completed batch once. Keep required GitHub checks enabled and wait for them before merging. If the candidate changes after verification, repeat the affected checks. Repeat the complete gate if a release candidate or shared gameplay behavior changes. Do not claim a complete campaign or smooth rendering from build and unit-test results alone.

The [version 0.1 status](../verification/version-0.1.md) records the version's
scope and known acceptance limits. The
[published progress ledger](../verification/published-progress.md) contains
feature evidence and historical checkpoints. The
[workspace acceptance record](../verification/gameplay-completion.md) describes
its dated checkout. The [JA2 parity audit](../verification/ja2-parity-audit.md)
also includes named published receipts. Each result applies to its recorded
source; these records do not prove a complete pass on a later checkout.

For a documentation-only change, run the documentation audit and whitespace
check. For a playable development checkpoint, record the exact checks and
known failures in its status page. A version tag identifies that snapshot;
it does not establish a passed release gate or waive the checks above for
complete release acceptance.

Documentation link checks and `git diff --check` verify documentation structure and formatting. They do not establish game health, browser behavior or a successful campaign. Automated scenarios also do not replace a complete gameplay acceptance run.

## Production output

```sh
npm run build
```

[`web/next.config.ts`](../../web/next.config.ts) configures a static export. The web build writes its client output to `web/dist/client/`. [`tools/build-web.mjs`](../../tools/build-web.mjs) copies this output to root `dist/`, checks the copied bytes, and adapts the file layout for project hosting. It then validates asset references, manifests, artwork checksums and browser worker URLs in the staged export.

Serve the root `dist/` directory through an HTTP server for production review. The repository has no dedicated root preview command. The web package's `start` script targets a Wrangler server configuration; it is separate from the root static-export workflow.

Build success establishes that the export and its checked assets were produced. Browser checks must still cover the changed controls, rendering and save behavior.

### GitHub Pages

The hosted game is at [fsodano.github.io/granaderos](https://fsodano.github.io/granaderos/).
GitHub Pages serves the export from its last deployment; it can differ from
current `main` or a version tag. The game needs no application server.

The [web workflow](../../.github/workflows/web.yml) builds with `GRANADEROS_BASE_PATH=/granaderos`. It checks browser types, deployment paths, browser workers and the static export before publishing `dist/`. Publication runs only when a maintainer starts this workflow manually on `main`. Pushes, pull requests and tags do not start a web build.

The selected main revision publishes even if unrelated commits advance main
during the build. A newer manual dispatch replaces an older run. The workflow
records its selected revision in the run summary. Verify that the published
`/granaderos/build-info.json` revision equals that selected revision. This
confirms the deployed source, not complete campaign acceptance. Simulation
tests use the separate workflows above; the web workflow does not run the full
campaign suite.

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

The game, story editor and sector editor show the same source build ID.
`/build-info.json` exposes its source digest. Compare that identity with the
source under review before selecting a preview server. A running preview or
hosted deployment can still contain an earlier build. See
[version 0.1 status](../verification/version-0.1.md) for the version's evidence.
