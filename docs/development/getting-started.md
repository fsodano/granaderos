# Browser development guide

[Documentation index](../README.md) · [Development index](README.md) · [Project overview](../../README.md)

The browser implementation in `game/` and `web/` is the primary game. Its interface is Spanish. Code and documentation are English.

## Requirements

- Git, to clone the repository.
- Node.js **22.13.0 or newer**, as required by [`web/package.json`](../../web/package.json).
- npm and a current browser.

The browser game does not require the `engine/` submodule, a C++ toolchain or an original JA2 installation.

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

Choose **Nueva campaña** to begin at the Retiro desk. Hire combatants or create a character. Character creation is free; organizing the regiment costs 300 pesos and advances the opening chapter. **Combate de San Lorenzo** starts a separate battle.

The published economy uses pesos for hiring, equipment and campaign preparations. It has no strategic material stocks, production chains, resource convoys or horse care. Saves from the earlier economy are rejected; start a new campaign.

The title screen opens the [story editor](story-editor.md) at `/story` and the [sector editor](sector-editor.md) at `/editor`. The story editor can start a separate campaign with validated character, firearm and ability definitions. Branching dialogue, quests and complete campaign authoring remain open work.

## Save behavior

Campaign progress and its active battle are saved in browser storage. **Continuar campaña** restores the stored game. **Guardar** exports a JSON file; **Importar partida** loads one.

Browser storage belongs to the current browser profile and site origin. A different hostname or port has separate storage. Export a save before moving between origins or clearing browser data. The export is the portable copy.

The save implementation is in [`game/save.js`](../../game/save.js). [`web/app/page.tsx`](../../web/app/page.tsx) saves campaign and battle changes and reports storage errors through the game notice.

## Checks

The root [`package.json`](../../package.json) defines these commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run `tests/*.test.mjs` through the Node test runner. |
| `npm run typecheck` | Check the web TypeScript project without emitting files. |
| `npm run build` | Build and verify the static browser export, then stage it in root `dist/`. |

Use relevant focused tests while making a change. For example:

```sh
node --test tests/economy-web.test.mjs tests/campaign-web.test.mjs
node --test tests/save-web.test.mjs
```

The first command checks campaign and economy rules. The second checks save behavior. Run broader checks when the change affects shared systems. Report failures, skipped cases and the exact scope checked.

The [published progress ledger](../verification/published-progress.md) records delivered scope and remaining acceptance work on `main`. The [development-workspace acceptance record](../verification/gameplay-completion.md) and [JA2 parity audit](../verification/ja2-parity-audit.md) describe a separate integration checkout. Their results do not establish that the published checkout has those features or passes those checks.

Documentation link checks and `git diff --check` verify documentation structure and formatting. They do not establish game health, browser behavior or a successful campaign. Automated scenarios also do not replace a complete gameplay acceptance run.

## Production output

```sh
npm run build
```

[`web/next.config.ts`](../../web/next.config.ts) configures a static export. The web build writes its client output to `web/dist/client/`. [`tools/build-web.mjs`](../../tools/build-web.mjs) checks asset references, manifests and artwork checksums before replacing the root `dist/` directory with the verified export. It then checks the copied files.

Serve the root `dist/` directory through an HTTP server for production review. The repository has no dedicated root preview command. The web package's `start` script targets a Wrangler server configuration; it is separate from the root static-export workflow.

Build success establishes that the export and its checked assets were produced. Browser checks must still cover the changed controls, rendering and save behavior.

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
