# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Project overview](../../README.md)

The browser implementation in `game/` and `web/` is the primary game. Its interface is Spanish. Code and documentation are English.

Read the [campaign separation record](../verification/campaign-engine-separation-2026-10-10.md)
for current scope and known limits. The [version 0.1 status](../verification/version-0.1.md)
describes the earlier tagged checkpoint. Current development checks do not
establish complete game acceptance.

## Requirements

- Git, to clone the repository.
- An up-to-date **Node.js 22 LTS**, **22.18.0 or newer**, for development and tests. The [`web/package.json`](../../web/package.json) range `>=22.13.0` is the web package's engine lower bound.
- npm and a current browser.
- Python 3.13 and the pinned Pillow/NumPy dependencies for core and full tests, matching CI.

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
material stocks or resource production chains. Present mounts retain their
condition, stamina and assigned rider; rest restores stamina. Buying, hiring,
feeding and breeding horses are disabled. Physical equipment transport remains
available. Saves from the earlier economy are rejected;
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

This game is in pre-release development. Validate new campaigns and saves made
with the current build, including export, import and browser reload. Historical
save snapshots are not a release gate, and compatibility with earlier builds is
not guaranteed. Do not retain obsolete campaign checkpoints as replay fixtures.

## Checks

The owner requested a minimal test set on 2026-10-21. A broader testing
strategy is deferred. The current set contains 12 files covering campaign
creation and contracts, travel, combat, finite inventory, battle settlement,
workers, saves, autosave, public combat information, personnel controls and
browser deployment paths. See [the test baseline](../../tests/README.md).

Install dependencies with `npm ci --prefix web`, then run:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the complete current minimum with two worker processes. |
| `npm run test:quick` | Run the same minimum; this is an alias. |
| `npm run typecheck` | Check the web TypeScript project without emitting files. |
| `npm run audit:docs` | Check the documentation register and generated view. |
| `npm run audit:baseline` | Check the reference gameplay values. |
| `npm run build` | Build and verify the static browser export in root `dist/`. |

Tests do not require Python, regenerate artwork or run long campaign routes.
Failures still fail the command. No assertions in the retained test files were
removed to obtain a passing result. The old core/campaign, quick/extended and
shard configuration has been removed. Git tag `0.1.27` retains the previous
suite if individual checks are needed later. Historical evidence and pinned
test references remain in the verification ledger; they are not coverage for
the current minimum.

Keep this set small. Use a focused check when a change affects behavior that
it does not cover. Do not restore large automatic suites without a new testing
decision from the owner. For editor work, the [editor development guide](editor-development.md)
provides context for selecting a relevant local check or browser action.

### GitHub Actions

[Minimal tests](../../.github/workflows/tests.yml) runs `npm test` on non-draft
pull requests and manual requests. A newer commit cancels the older run for
that pull request. It uses a shallow checkout and one dependency install.

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
checkout. The build replaces `web/dist/` and root `dist/`. Preserve the preview
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

Before freezing the local candidate, set the same version in `VERSION`, root `package.json`, `web/package.json` and the two root package records in `web/package-lock.json`. Keep dependency versions unchanged. Verify that the production `build-info.json` records this version and the exact source revision.

Run the required local checks before publishing. After the reviewed merge, verify the remote `main` revision and bind the tag to it. Record the checks and remaining limits with the delivery. A development tag retains that evidence and does not establish complete campaign or release acceptance.

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

The [web workflow](../../.github/workflows/web.yml) builds with `GRANADEROS_BASE_PATH=/granaderos`. It checks browser types, deployment paths, browser workers and the static export before publishing `dist/`. Every push to `main` starts the verified build and publishes its successful export. Manual builds remain available through `workflow_dispatch`; manual publication also requires `main`. Pull requests, tag pushes and pushes to other branches do not start this workflow.

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
