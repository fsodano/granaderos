# Granaderos

A browser strategy and turn-based tactical game set during the Argentine War of Independence (1810–1820), based on the supplied historical conversion specification and informed by JA2 v1.13.

**In development. The complete specification has not yet passed its completion audit.** Player-facing content is Spanish; code and documentation are English. The playable browser implementation uses JavaScript and React; it does not execute the original Windows C++ engine.

## Run locally

Requires Node.js 22 or newer:

```sh
npm ci --prefix web
npm run dev
```

Open http://localhost:3000. Campaign saves are stored in your browser; use **Guardar** to export a portable save file.

```sh
npm test
npm run typecheck
npm run build
```

The static production artifact is written to `dist/`. The browser build requires neither the engine submodule nor an original JA2 installation.

## Source layout

- `web/`: Spanish browser interface and installed original artwork.
- `game/`: deterministic tactical rules, campaign economy, authored maps and save validation.
- `assets/`: original artwork, prompts, historical references and reproducible exports.
- `tests/`: rules, campaign, map and integration checks.
- `docs/specification/original.txt`: supplied design preserved verbatim.
- `docs/PROGRESS.md`: requirement checklist with incomplete work explicitly tracked.
- `engine/`, `native/`, `patches/`, `mod/`: pinned upstream source and earlier native conversion work retained for reference; not browser runtime dependencies.

## Versioning and contributions

`VERSION` uses Semantic Versioning. Development milestones use prerelease versions; `1.0.0` requires the entire supplied specification to pass its completion audit. Work is checked in on feature branches and reviewed through pull requests. Generated files must be reproducible from committed source inputs. Build and unit-test evidence must not be represented as gameplay verification.

